CREATE OR REPLACE FUNCTION public.hp_leave_data_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE k text; v jsonb; d date; m date; changed boolean; actor uuid:=auth.uid();manager boolean;allowed text[];
BEGIN
 manager:=hp_private.leave_manager(new.facility_code);
 IF TG_OP='INSERT' THEN
  IF new.revision<>1 THEN RAISE EXCEPTION 'Invalid initial revision' USING ERRCODE='23514';END IF;
  new.created_at:=now();
 ELSE
  IF new.id<>old.id OR new.facility_code<>old.facility_code OR new.origin_instance<>old.origin_instance OR new.source_key IS DISTINCT FROM old.source_key THEN RAISE EXCEPTION 'Immutable identity' USING ERRCODE='42501'; END IF;
  IF new.revision<>old.revision+1 THEN RAISE EXCEPTION 'Revision conflict: reload before saving' USING ERRCODE='40001'; END IF;
  new.created_at:=old.created_at;
 END IF;
 IF length(new.origin_instance)>120 OR length(coalesce(new.source_key,''))>120 THEN RAISE EXCEPTION 'Source identity too long' USING ERRCODE='23514';END IF;
 IF TG_TABLE_NAME='hp_work_calendars' THEN
  IF TG_OP='UPDATE' AND new.month_start<>old.month_start THEN RAISE EXCEPTION 'Calendar identity immutable' USING ERRCODE='42501';END IF;
  IF new.month_start<date '1956-10-01' OR new.month_start>date '2157-09-01' THEN RAISE EXCEPTION 'Invalid calendar year' USING ERRCODE='23514';END IF;
  FOR k,v IN SELECT * FROM jsonb_each(new.overrides) LOOP
   d:=k::date;
   IF k<>d::text OR date_trunc('month',d)::date<>new.month_start OR jsonb_typeof(v)<>'object' OR jsonb_typeof(v->'is_holiday') IS DISTINCT FROM 'boolean' OR jsonb_typeof(v->'label') IS DISTINCT FROM 'string' OR length(v->>'label')>200 OR v-array['is_holiday','label']<>'{}'::jsonb THEN RAISE EXCEPTION 'Invalid calendar override' USING ERRCODE='23514';END IF;
  END LOOP;
  IF TG_OP='INSERT' THEN new.verified:=false;
  ELSIF new.overrides IS DISTINCT FROM old.overrides THEN new.verified:=false;END IF;
  IF new.verified THEN new.verified_by:=CASE WHEN TG_OP='UPDATE' AND old.verified THEN old.verified_by ELSE actor END;new.verified_at:=CASE WHEN TG_OP='UPDATE' AND old.verified THEN old.verified_at ELSE now() END;ELSE new.verified_by:=NULL;new.verified_at:=NULL;END IF;
  new.updated_by:=actor;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.hp_personnel p WHERE p.id=new.personnel_id AND p.facility_code=new.facility_code AND p.active) THEN RAISE EXCEPTION 'Personnel outside facility or inactive' USING ERRCODE='42501';END IF;
  IF TG_OP='UPDATE' AND (new.personnel_id<>old.personnel_id OR new.fiscal_year<>old.fiscal_year) THEN RAISE EXCEPTION 'Subject and fiscal year immutable' USING ERRCODE='42501';END IF;
  IF TG_TABLE_NAME='hp_leave_entitlements' THEN
   FOR k,v IN SELECT * FROM jsonb_each(new.quotas) LOOP
    IF k NOT IN ('SICK','PERSONAL','VACATION','MATERNITY','ORDINATION','OFFICIAL','OTHER') OR jsonb_typeof(v)<>'number' OR v::text::numeric<0 OR v::text::numeric>366 OR mod(v::text::numeric,0.5)<>0 THEN RAISE EXCEPTION 'Invalid leave quota' USING ERRCODE='23514';END IF;
   END LOOP;
   new.updated_by:=actor;
  ELSE
   allowed:=ARRAY['note','reference_no','submission_channel','written_date','written_at','addressee','form_employment_type','form_position_name','form_position_level','form_work_unit','form_section','form_division','contact_address','contact_phone','delegate_name','decision_note','approval_reference','approval_date','approved_by_name','vacation_grant','vacation_carry','full_name'];
   FOR k,v IN SELECT * FROM jsonb_each(new.details) LOOP
    IF NOT(k=ANY(allowed)) OR jsonb_typeof(v)<>'string' OR length(v#>>'{}')>1000 THEN RAISE EXCEPTION 'Invalid leave detail: %',k USING ERRCODE='23514';END IF;
   END LOOP;
   FOREACH k IN ARRAY ARRAY['vacation_grant','vacation_carry'] LOOP IF coalesce(new.details->>k,'')<>'' AND ((new.details->>k)::numeric<0 OR (new.details->>k)::numeric>366 OR mod((new.details->>k)::numeric,0.5)<>0) THEN RAISE EXCEPTION 'Invalid vacation days' USING ERRCODE='23514';END IF;END LOOP;
   IF btrim(coalesce(new.details->>'note',''))='' THEN RAISE EXCEPTION 'Leave reason required' USING ERRCODE='23514';END IF;
   IF coalesce(new.details->>'submission_channel','online') NOT IN ('online','paper') THEN RAISE EXCEPTION 'Invalid submission channel' USING ERRCODE='23514';END IF;
   FOREACH k IN ARRAY ARRAY['written_date','approval_date'] LOOP IF coalesce(new.details->>k,'')<>'' THEN PERFORM (new.details->>k)::date;END IF;END LOOP;
   IF TG_OP='INSERT' THEN
    IF new.status<>'pending' THEN RAISE EXCEPTION 'New leave must be pending' USING ERRCODE='23514';END IF;
    new.created_by:=actor;new.decided_by:=NULL;new.decided_at:=NULL;new.audit:='[]';
   ELSE
    new.created_by:=old.created_by;new.decided_by:=old.decided_by;new.decided_at:=old.decided_at;new.audit:=old.audit;
    IF old.status IN ('cancelled','rejected') THEN RAISE EXCEPTION 'Closed leave cannot be changed' USING ERRCODE='23514';END IF;
    changed:=new.status IS DISTINCT FROM old.status;
    IF old.status='approved' AND (new.status<>'cancelled' OR NOT manager OR (new.details-'decision_note') IS DISTINCT FROM (old.details-'decision_note') OR new.leave_type<>old.leave_type OR new.date_from<>old.date_from OR new.date_to<>old.date_to OR new.portion<>old.portion) THEN RAISE EXCEPTION 'Approved leave can only be cancelled by manager' USING ERRCODE='42501';END IF;
    IF changed AND new.status IN ('approved','rejected') AND NOT manager THEN RAISE EXCEPTION 'Only unit manager may record approval outcome' USING ERRCODE='42501';END IF;
    IF changed AND (new.leave_type<>old.leave_type OR new.date_from<>old.date_from OR new.date_to<>old.date_to OR new.portion<>old.portion) THEN RAISE EXCEPTION 'Save pending edits before recording outcome' USING ERRCODE='23514';END IF;
    IF changed THEN new.decided_by:=actor;new.decided_at:=now();END IF;
   END IF;
   IF TG_OP='INSERT' OR new.status='pending' THEN new.details:=new.details||jsonb_build_object('full_name',(SELECT p.full_name FROM public.hp_personnel p WHERE p.id=new.personnel_id));ELSE new.details:=new.details||jsonb_build_object('full_name',old.details->>'full_name');END IF;
   IF new.status='approved' THEN
    IF btrim(coalesce(new.details->>'approval_reference',''))='' OR btrim(coalesce(new.details->>'approved_by_name',''))='' OR coalesce(new.details->>'approval_date','')='' THEN RAISE EXCEPTION 'Actual approval reference, date and approver required' USING ERRCODE='23514';END IF;
    FOR m IN SELECT generate_series(date_trunc('month',new.date_from),date_trunc('month',new.date_to),interval '1 month')::date LOOP
     IF NOT EXISTS(SELECT 1 FROM public.hp_work_calendars c WHERE c.facility_code=new.facility_code AND c.month_start=m AND c.verified) THEN RAISE EXCEPTION 'Verify all affected monthly calendars first' USING ERRCODE='23514';END IF;
    END LOOP;
   END IF;
   SELECT coalesce(jsonb_agg(x.value ORDER BY x.n),'[]') INTO new.audit FROM jsonb_array_elements(new.audit) WITH ORDINALITY x(value,n) WHERE x.n>jsonb_array_length(new.audit)-49;
   new.audit:=new.audit||jsonb_build_array(jsonb_build_object('at',now(),'actor',actor,'revision',new.revision,'status',new.status,'action',CASE WHEN TG_OP='INSERT' THEN 'create' ELSE 'update' END));
  END IF;
 END IF;
 new.updated_at:=now();RETURN new;
END $$;
