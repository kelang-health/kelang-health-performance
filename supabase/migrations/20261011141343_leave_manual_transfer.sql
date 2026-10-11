-- Manual, unit-scoped transfers. All RPCs use caller privileges and existing RLS.
CREATE TABLE public.hp_leave_transfer_sources(instance_id text PRIMARY KEY CHECK(length(instance_id) BETWEEN 1 AND 120),facility_code text NOT NULL REFERENCES public.hp_facilities(facility_code),label text NOT NULL CHECK(length(label)<=200),active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.hp_leave_transfer_receipts(package_id uuid PRIMARY KEY,facility_code text NOT NULL REFERENCES public.hp_facilities(facility_code),personnel_id uuid NOT NULL REFERENCES public.hp_personnel(id),fiscal_year int NOT NULL,source_instance text NOT NULL,packet_hash text NOT NULL,actor uuid NOT NULL DEFAULT auth.uid(),imported_at timestamptz NOT NULL DEFAULT now(),selected jsonb NOT NULL,backup jsonb NOT NULL,provenance jsonb NOT NULL,CHECK(octet_length(provenance::text)<=2200000),CHECK(octet_length(backup::text)<=2200000));
CREATE INDEX hp_leave_transfer_receipts_scope ON public.hp_leave_transfer_receipts(facility_code,personnel_id,fiscal_year);
ALTER TABLE public.hp_leave_transfer_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hp_leave_transfer_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hp_leave_transfer_sources,public.hp_leave_transfer_receipts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.hp_leave_transfer_sources TO authenticated;
GRANT SELECT,INSERT ON public.hp_leave_transfer_receipts TO authenticated;
GRANT ALL ON public.hp_leave_transfer_sources,public.hp_leave_transfer_receipts TO service_role;
CREATE POLICY source_read ON public.hp_leave_transfer_sources FOR SELECT TO authenticated USING(hp_private.leave_manager(facility_code));
CREATE POLICY source_insert ON public.hp_leave_transfer_sources FOR INSERT TO authenticated WITH CHECK(hp_private.session_valid() AND EXISTS(SELECT 1 FROM public.hp_user_facilities WHERE user_id=auth.uid() AND role='ADMIN'));
CREATE POLICY source_update ON public.hp_leave_transfer_sources FOR UPDATE TO authenticated USING(hp_private.session_valid() AND EXISTS(SELECT 1 FROM public.hp_user_facilities WHERE user_id=auth.uid() AND role='ADMIN')) WITH CHECK(hp_private.session_valid() AND EXISTS(SELECT 1 FROM public.hp_user_facilities WHERE user_id=auth.uid() AND role='ADMIN'));
CREATE POLICY receipt_read ON public.hp_leave_transfer_receipts FOR SELECT TO authenticated USING(hp_private.leave_manager(facility_code));
CREATE POLICY receipt_insert ON public.hp_leave_transfer_receipts FOR INSERT TO authenticated WITH CHECK(hp_private.leave_manager(facility_code) AND actor=auth.uid() AND EXISTS(SELECT 1 FROM public.hp_personnel p WHERE p.id=personnel_id AND p.facility_code=hp_leave_transfer_receipts.facility_code));

CREATE FUNCTION public.hp_leave_transfer_snapshot(pid uuid,fy int) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE p jsonb;rs jsonb;unit text;
BEGIN
 SELECT jsonb_build_object('id',id,'full_name',full_name,'facility_code',facility_code),facility_code INTO p,unit FROM public.hp_personnel WHERE id=pid AND active;
 IF p IS NULL OR NOT hp_private.leave_manager(unit) OR fy NOT BETWEEN 2500 AND 2700 THEN RAISE EXCEPTION 'Only unit manager can transfer' USING ERRCODE='42501';END IF;
 SELECT coalesce(jsonb_agg(r ORDER BY r->>'kind',r->>'id'),'[]') INTO rs FROM (
  SELECT jsonb_build_object('kind','calendar','id',id,'revision',revision,'data',jsonb_build_object('month_start',month_start,'overrides',overrides,'verified',verified)) r FROM public.hp_work_calendars WHERE facility_code=unit AND month_start BETWEEN make_date(fy-544,10,1) AND make_date(fy-543,9,1)
  UNION ALL SELECT jsonb_build_object('kind','quota','id',id,'revision',revision,'data',jsonb_build_object('quotas',quotas,'note',note)) FROM public.hp_leave_entitlements WHERE personnel_id=pid AND fiscal_year=fy
  UNION ALL SELECT jsonb_build_object('kind','leave','id',id,'revision',revision,'data',jsonb_build_object('leave_type',leave_type,'date_from',date_from,'date_to',date_to,'portion',portion,'status',status,'details',details)) FROM public.hp_leave_requests WHERE personnel_id=pid AND fiscal_year=fy
 ) x;
 IF jsonb_array_length(rs)>1012 OR octet_length(rs::text)>2000000 THEN RAISE EXCEPTION 'Transfer too large: split data before transfer';END IF;
 RETURN jsonb_build_object('instance','cloud:txjuiaiwffsxfcrxpkvd','person',p,'year',fy,'records',rs);
END $$;

CREATE FUNCTION public.hp_leave_transfer_plan(packet jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE snap jsonb; items jsonb:='[]';r jsonb;prior jsonb;incoming jsonb;act text;unit text:=packet->>'facility_code';pid uuid:=(packet->'person'->>'id')::uuid;fy int:=(packet->>'fiscal_year')::int;ids text[]:='{}';naturals text[]:='{}';natural_key text; k text;v jsonb;rec public.hp_leave_transfer_receipts;
BEGIN
 IF packet->>'format' IS DISTINCT FROM 'kelang-leave-transfer' OR packet->>'schema_version' IS DISTINCT FROM '1' OR jsonb_typeof(packet->'records') IS DISTINCT FROM 'array' OR octet_length(packet::text)>2200000 OR jsonb_array_length(packet->'records')>1012 THEN RAISE EXCEPTION 'Invalid transfer format/version/size';END IF;
 PERFORM (packet->>'package_id')::uuid;
 snap:=public.hp_leave_transfer_snapshot(pid,fy);
 IF unit IS DISTINCT FROM snap->'person'->>'facility_code' OR packet->'person'->>'facility_code' IS DISTINCT FROM unit THEN RAISE EXCEPTION 'Transfer facility mismatch' USING ERRCODE='42501';END IF;
 IF packet->>'source_instance' IS DISTINCT FROM 'cloud:txjuiaiwffsxfcrxpkvd' AND NOT EXISTS(SELECT 1 FROM public.hp_leave_transfer_sources WHERE instance_id=packet->>'source_instance' AND facility_code=unit AND active) THEN RAISE EXCEPTION 'Unregistered source installation' USING ERRCODE='42501';END IF;
 SELECT * INTO rec FROM public.hp_leave_transfer_receipts WHERE package_id=(packet->>'package_id')::uuid;
 IF FOUND THEN
  IF rec.packet_hash<>md5(packet::text) OR rec.personnel_id<>pid OR rec.facility_code<>unit THEN RAISE EXCEPTION 'Package ID reused with different content';END IF;
  RETURN jsonb_build_object('duplicate',true,'token',md5(snap::text),'items','[]'::jsonb);
 END IF;
 FOR r IN SELECT * FROM jsonb_array_elements(packet->'records') LOOP
  PERFORM (r->>'id')::uuid;
  IF r->>'id'=ANY(ids) OR r->>'kind' NOT IN ('calendar','quota','leave') OR jsonb_typeof(r->'data') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid or duplicate record';END IF;ids:=array_append(ids,r->>'id');
  incoming:=r->'data';prior:=NULL;natural_key:=NULL;
  IF r->>'kind'='calendar' THEN
   IF (incoming->>'month_start')::date NOT BETWEEN make_date(fy-544,10,1) AND make_date(fy-543,9,1) OR extract(day FROM (incoming->>'month_start')::date)<>1 OR jsonb_typeof(incoming->'overrides') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid calendar period';END IF;
   natural_key:='calendar:'||(incoming->>'month_start');
   SELECT x INTO prior FROM jsonb_array_elements(snap->'records') x WHERE x->>'kind'='calendar' AND x->'data'->>'month_start'=incoming->>'month_start';
   incoming:=jsonb_build_object('month_start',incoming->>'month_start','overrides',incoming->'overrides','verified',false);
  ELSIF r->>'kind'='quota' THEN
   natural_key:='quota';SELECT x INTO prior FROM jsonb_array_elements(snap->'records') x WHERE x->>'kind'='quota';
   IF jsonb_typeof(incoming->'quotas') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid quota';END IF;
   incoming:=jsonb_build_object('quotas',incoming->'quotas','note',coalesce(incoming->>'note',''));
  ELSE
   IF incoming->>'status' NOT IN ('pending','approved','rejected','cancelled') OR incoming->>'leave_type' NOT IN ('SICK','PERSONAL','VACATION','MATERNITY','ORDINATION','OFFICIAL','OTHER') OR incoming->>'portion' NOT IN ('full','half_am','half_pm') OR (incoming->>'date_from')::date<make_date(fy-544,10,1) OR (incoming->>'date_to')::date>make_date(fy-543,9,30) OR (incoming->>'date_from')::date>(incoming->>'date_to')::date OR (incoming->>'portion'<>'full' AND incoming->>'date_from'<>incoming->>'date_to') OR jsonb_typeof(incoming->'details') IS DISTINCT FROM 'object' OR length(trim(coalesce(incoming->'details'->>'note','')))=0 THEN RAISE EXCEPTION 'Invalid leave data';END IF;
   SELECT x INTO prior FROM jsonb_array_elements(snap->'records') x WHERE x->>'kind'='leave' AND x->>'id'=r->>'id';
   incoming:=jsonb_build_object('leave_type',incoming->>'leave_type','date_from',incoming->>'date_from','date_to',incoming->>'date_to','portion',incoming->>'portion','status',CASE WHEN incoming->>'status' IN ('rejected','cancelled') THEN incoming->>'status' ELSE 'pending' END,'details',incoming->'details'-ARRAY['approval_reference','approved_by_name','approval_date']);
  END IF;
  IF natural_key IS NOT NULL THEN IF natural_key=ANY(naturals) THEN RAISE EXCEPTION 'Duplicate natural_key key';END IF;naturals:=array_append(naturals,natural_key);END IF;
  act:=CASE WHEN prior IS NULL THEN 'add' WHEN (prior->'data')=(r->'data') OR (prior->'data')=incoming THEN 'skip' WHEN r->>'kind'='leave' AND prior->'data'->>'status'<>'pending' THEN 'conflict' ELSE 'update' END;
  -- Closed historical source rows stay in provenance. They never re-open a live request.
  IF r->>'kind'='leave' AND incoming->>'status' IN ('rejected','cancelled') AND prior IS NULL THEN act:='conflict';END IF;
  IF r->>'kind'='leave' AND prior IS NOT NULL AND incoming->>'status' IN ('rejected','cancelled') AND (prior->'data'-'status'-'details') IS DISTINCT FROM (incoming-'status'-'details') THEN act:='conflict';END IF;
  items:=items||jsonb_build_array(jsonb_build_object('id',r->>'id','target_id',coalesce(prior->>'id',r->>'id'),'kind',r->>'kind','action',act,'before',prior,'after',incoming));
 END LOOP;
 RETURN jsonb_build_object('duplicate',false,'token',md5(snap::text),'items',items);
END $$;

CREATE FUNCTION public.hp_leave_transfer_apply(packet jsonb,expected_token text,selected uuid[]) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE plan jsonb;snap jsonb;item jsonb;d jsonb;oldrow jsonb;pid uuid:=(packet->'person'->>'id')::uuid;fy int:=(packet->>'fiscal_year')::int;unit text:=packet->>'facility_code';n int:=0;target uuid;result jsonb;
BEGIN
 -- Serialize imports for a unit/year and lock current rows against normal edits.
 IF NOT hp_private.leave_manager(unit) THEN RAISE EXCEPTION 'Only unit manager can transfer' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('hp-leave:'||unit||':'||fy,0));
 PERFORM 1 FROM public.hp_personnel WHERE id=pid FOR UPDATE;
 PERFORM 1 FROM public.hp_work_calendars WHERE facility_code=unit AND month_start BETWEEN make_date(fy-544,10,1) AND make_date(fy-543,9,1) FOR UPDATE;
 PERFORM 1 FROM public.hp_leave_entitlements WHERE personnel_id=pid AND fiscal_year=fy FOR UPDATE;
 PERFORM 1 FROM public.hp_leave_requests WHERE personnel_id=pid AND fiscal_year=fy FOR UPDATE;
 plan:=public.hp_leave_transfer_plan(packet);
 IF (plan->>'duplicate')::boolean THEN RETURN jsonb_build_object('duplicate',true,'imported',0);END IF;
 IF plan->>'token' IS DISTINCT FROM expected_token THEN RAISE EXCEPTION 'Revision conflict: preview transfer again' USING ERRCODE='40001';END IF;
 IF selected IS NULL OR cardinality(selected)=0 OR cardinality(selected)<>(SELECT count(DISTINCT s) FROM unnest(selected)s) OR EXISTS(SELECT 1 FROM unnest(selected)s WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(plan->'items')x WHERE (x->>'id')::uuid=s AND x->>'action' IN ('add','update'))) THEN RAISE EXCEPTION 'Invalid selected transfer records';END IF;
 snap:=public.hp_leave_transfer_snapshot(pid,fy);
 -- Backup is committed in the same transaction before any row is changed.
 INSERT INTO public.hp_leave_transfer_receipts(package_id,facility_code,personnel_id,fiscal_year,source_instance,packet_hash,selected,backup,provenance) VALUES((packet->>'package_id')::uuid,unit,pid,fy,packet->>'source_instance',md5(packet::text),to_jsonb(selected),snap,packet);
 FOR item IN SELECT x FROM jsonb_array_elements(plan->'items')x WHERE (x->>'id')::uuid=ANY(selected) LOOP
  d:=item->'after';target:=(item->>'target_id')::uuid;oldrow:=item->'before';
  IF item->>'kind'='calendar' THEN
   IF item->>'action'='add' THEN INSERT INTO public.hp_work_calendars(id,facility_code,month_start,overrides,origin_instance,source_key) VALUES(target,unit,(d->>'month_start')::date,d->'overrides',packet->>'source_instance',item->>'id');
   ELSE UPDATE public.hp_work_calendars SET overrides=d->'overrides',verified=false,revision=revision+1 WHERE id=target;END IF;
  ELSIF item->>'kind'='quota' THEN
   IF item->>'action'='add' THEN INSERT INTO public.hp_leave_entitlements(id,personnel_id,facility_code,fiscal_year,quotas,note,origin_instance,source_key) VALUES(target,pid,unit,fy,d->'quotas',d->>'note',packet->>'source_instance',item->>'id');
   ELSE UPDATE public.hp_leave_entitlements SET quotas=d->'quotas',note=d->>'note',revision=revision+1 WHERE id=target;END IF;
  ELSE
   IF item->>'action'='add' THEN INSERT INTO public.hp_leave_requests(id,personnel_id,facility_code,fiscal_year,leave_type,date_from,date_to,portion,status,details,origin_instance,source_key) VALUES(target,pid,unit,fy,d->>'leave_type',(d->>'date_from')::date,(d->>'date_to')::date,d->>'portion','pending',d->'details',packet->>'source_instance',item->>'id');
   ELSIF d->>'status' IN ('rejected','cancelled') THEN UPDATE public.hp_leave_requests SET status=d->>'status',details=details||jsonb_build_object('decision_note',coalesce(d->'details'->>'decision_note','บันทึกสถานะจากแฟ้มที่ตรวจแล้ว')),revision=revision+1 WHERE id=target;
   ELSE UPDATE public.hp_leave_requests SET leave_type=d->>'leave_type',date_from=(d->>'date_from')::date,date_to=(d->>'date_to')::date,portion=d->>'portion',details=d->'details',revision=revision+1 WHERE id=target;END IF;
  END IF;n:=n+1;
 END LOOP;
 RETURN jsonb_build_object('duplicate',false,'imported',n,'package_id',packet->>'package_id');
END $$;
REVOKE ALL ON FUNCTION public.hp_leave_transfer_snapshot(uuid,int),public.hp_leave_transfer_plan(jsonb),public.hp_leave_transfer_apply(jsonb,text,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hp_leave_transfer_snapshot(uuid,int),public.hp_leave_transfer_plan(jsonb),public.hp_leave_transfer_apply(jsonb,text,uuid[]) TO authenticated,service_role;

