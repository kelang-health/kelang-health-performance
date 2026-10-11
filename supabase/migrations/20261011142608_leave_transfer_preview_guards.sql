CREATE OR REPLACE FUNCTION public.hp_leave_transfer_plan(packet jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
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
   incoming:=jsonb_build_object('leave_type',incoming->>'leave_type','date_from',incoming->>'date_from','date_to',incoming->>'date_to','portion',incoming->>'portion','status',CASE WHEN incoming->>'status' IN ('rejected','cancelled') THEN incoming->>'status' ELSE 'pending' END,'details',(incoming->'details')-ARRAY['approval_reference','approved_by_name','approval_date']);
  END IF;
  IF r->>'kind'='leave' THEN
   incoming:=jsonb_set(incoming,'{details}',(incoming->'details')||jsonb_build_object('full_name',snap->'person'->>'full_name'));
  END IF;
  IF natural_key IS NOT NULL THEN IF natural_key=ANY(naturals) THEN RAISE EXCEPTION 'Duplicate natural_key key';END IF;naturals:=array_append(naturals,natural_key);END IF;
  act:=CASE WHEN prior IS NULL THEN 'add' WHEN (prior->'data')=(r->'data') OR (prior->'data')=incoming THEN 'skip' WHEN r->>'kind'='leave' AND prior->'data'->>'status'<>'pending' THEN 'conflict' ELSE 'update' END;
  -- Closed historical source rows stay in provenance. They never re-open a live request.
  IF r->>'kind'='leave' AND incoming->>'status' IN ('rejected','cancelled') AND prior IS NULL THEN act:='conflict';END IF;
  IF r->>'kind'='leave' AND prior IS NOT NULL AND incoming->>'status' IN ('rejected','cancelled') AND ((prior->'data')-ARRAY['status','details']) IS DISTINCT FROM (incoming-ARRAY['status','details']) THEN act:='conflict';END IF;
  IF r->>'kind'='leave' AND incoming->>'status'='pending' AND EXISTS(SELECT 1 FROM jsonb_array_elements(snap->'records') x WHERE x->>'kind'='leave' AND x->>'id' IS DISTINCT FROM r->>'id' AND x->'data'->>'status' IN ('pending','approved') AND (x->'data'->>'date_from')::date<=(incoming->>'date_to')::date AND (x->'data'->>'date_to')::date>=(incoming->>'date_from')::date) THEN act:='conflict';END IF;
  IF r->>'kind'='leave' AND incoming->>'status'='pending' AND EXISTS(SELECT 1 FROM jsonb_array_elements(packet->'records') x WHERE x->>'kind'='leave' AND x->>'id' IS DISTINCT FROM r->>'id' AND x->'data'->>'status' IN ('pending','approved') AND (x->'data'->>'date_from')::date<=(incoming->>'date_to')::date AND (x->'data'->>'date_to')::date>=(incoming->>'date_from')::date) THEN act:='conflict';END IF;
  items:=items||jsonb_build_array(jsonb_build_object('id',r->>'id','target_id',coalesce(prior->>'id',r->>'id'),'kind',r->>'kind','action',act,'before',prior,'after',incoming));
 END LOOP;
 RETURN jsonb_build_object('duplicate',false,'token',md5(snap::text),'items',items);
END $$;

