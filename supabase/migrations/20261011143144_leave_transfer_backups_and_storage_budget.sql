CREATE OR REPLACE FUNCTION public.hp_leave_transfer_apply(packet jsonb,expected_token text,selected uuid[]) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE plan jsonb;snap jsonb;item jsonb;d jsonb;oldrow jsonb;pid uuid:=(packet->'person'->>'id')::uuid;fy int:=(packet->>'fiscal_year')::int;unit text:=packet->>'facility_code';n int:=0;target uuid;result jsonb;before_image jsonb;
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
 SELECT jsonb_build_object('snapshot',snap,
  'calendars',coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM public.hp_work_calendars c WHERE facility_code=unit AND month_start BETWEEN make_date(fy-544,10,1) AND make_date(fy-543,9,1)),'[]'::jsonb),
  'entitlements',coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM public.hp_leave_entitlements e WHERE personnel_id=pid AND fiscal_year=fy),'[]'::jsonb),
  'leaves',coalesce((SELECT jsonb_agg(to_jsonb(l)) FROM public.hp_leave_requests l WHERE personnel_id=pid AND fiscal_year=fy),'[]'::jsonb)) INTO before_image;
 -- Backup is committed in the same transaction before any row is changed.
 INSERT INTO public.hp_leave_transfer_receipts(package_id,facility_code,personnel_id,fiscal_year,source_instance,packet_hash,selected,backup,provenance) VALUES((packet->>'package_id')::uuid,unit,pid,fy,packet->>'source_instance',md5(packet::text),to_jsonb(selected),before_image,packet);
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

CREATE FUNCTION public.hp_leave_transfer_receipt_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE used_bytes bigint;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('hp-leave-transfer-budget:'||new.facility_code,0));
 -- Per unit limit also applies through RLS; bounded retention rather than unbounded Free database growth.
 SELECT coalesce(sum(octet_length(backup::text)+octet_length(provenance::text)),0) INTO used_bytes FROM public.hp_leave_transfer_receipts WHERE facility_code=new.facility_code;
 IF used_bytes+octet_length(new.backup::text)+octet_length(new.provenance::text)>3*1024*1024 THEN RAISE EXCEPTION 'Transfer archive budget reached: ADMIN must archive encrypted backups before further imports';END IF;
 new.actor:=auth.uid();new.imported_at:=now();RETURN new;
END $$;
CREATE TRIGGER hp_leave_transfer_receipt_guard BEFORE INSERT ON public.hp_leave_transfer_receipts FOR EACH ROW EXECUTE FUNCTION public.hp_leave_transfer_receipt_guard();
