-- Phase 1: private unit leave register; sparse monthly calendars and annual quotas.
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
CREATE FUNCTION hp_private.leave_manager(code text) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT hp_private.session_valid() AND EXISTS(SELECT 1 FROM public.hp_user_facilities f WHERE f.user_id=(SELECT auth.uid()) AND (f.role='ADMIN' OR (f.role='STAFF' AND f.facility_code=code)));
$$;
CREATE FUNCTION hp_private.leave_subject(pid uuid,code text) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT hp_private.session_valid() AND (hp_private.leave_manager(code) OR EXISTS(SELECT 1 FROM public.hp_personnel_accounts a JOIN public.hp_personnel p ON p.id=a.personnel_id WHERE a.user_id=(SELECT auth.uid()) AND a.personnel_id=pid AND p.facility_code=code));
$$;
REVOKE ALL ON FUNCTION hp_private.leave_manager(text),hp_private.leave_subject(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION hp_private.leave_manager(text),hp_private.leave_subject(uuid,text) TO authenticated,service_role;
CREATE TABLE public.hp_work_calendars (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),facility_code text NOT NULL REFERENCES public.hp_facilities(facility_code),
 month_start date NOT NULL CHECK(extract(day FROM month_start)=1),overrides jsonb NOT NULL DEFAULT '{}',verified boolean NOT NULL DEFAULT false,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),verified_by uuid,verified_at timestamptz,
 origin_instance text NOT NULL DEFAULT 'cloud:txjuiaiwffsxfcrxpkvd',source_key text,
 updated_by uuid,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(facility_code,month_start),UNIQUE(origin_instance,source_key),CHECK(jsonb_typeof(overrides)='object' AND octet_length(overrides::text)<=12000)
);
CREATE TABLE public.hp_leave_entitlements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),personnel_id uuid NOT NULL REFERENCES public.hp_personnel(id),facility_code text NOT NULL REFERENCES public.hp_facilities(facility_code),
 fiscal_year int NOT NULL CHECK(fiscal_year BETWEEN 2500 AND 2700),quotas jsonb NOT NULL DEFAULT '{}',note text NOT NULL DEFAULT '' CHECK(length(note)<=500),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),origin_instance text NOT NULL DEFAULT 'cloud:txjuiaiwffsxfcrxpkvd',source_key text,
 updated_by uuid,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(personnel_id,fiscal_year),UNIQUE(origin_instance,source_key),CHECK(jsonb_typeof(quotas)='object' AND octet_length(quotas::text)<=1000)
);
CREATE TABLE public.hp_leave_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),personnel_id uuid NOT NULL REFERENCES public.hp_personnel(id),facility_code text NOT NULL REFERENCES public.hp_facilities(facility_code),
 fiscal_year int NOT NULL CHECK(fiscal_year BETWEEN 2500 AND 2700),leave_type text NOT NULL CHECK(leave_type IN ('SICK','PERSONAL','VACATION','MATERNITY','ORDINATION','OFFICIAL','OTHER')),
 date_from date NOT NULL,date_to date NOT NULL,portion text NOT NULL DEFAULT 'full' CHECK(portion IN ('full','half_am','half_pm')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelled')),
 details jsonb NOT NULL DEFAULT '{}',revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 created_by uuid,decided_by uuid,decided_at timestamptz,audit jsonb NOT NULL DEFAULT '[]',
 origin_instance text NOT NULL DEFAULT 'cloud:txjuiaiwffsxfcrxpkvd',source_key text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(origin_instance,source_key),CHECK(date_to>=date_from AND date_to-date_from<=366),CHECK(portion='full' OR date_from=date_to),
 CHECK(date_from>=make_date(fiscal_year-544,10,1) AND date_to<=make_date(fiscal_year-543,9,30)),
 CHECK(jsonb_typeof(details)='object' AND octet_length(details::text)<=20000),CHECK(jsonb_typeof(audit)='array' AND jsonb_array_length(audit)<=50),
 EXCLUDE USING gist (personnel_id WITH =, daterange(date_from,date_to,'[]') WITH &&) WHERE (status IN ('pending','approved'))
);
CREATE INDEX hp_leave_requests_person_year ON public.hp_leave_requests(personnel_id,fiscal_year,date_from);
CREATE INDEX hp_leave_requests_unit_year ON public.hp_leave_requests(facility_code,fiscal_year);
CREATE INDEX hp_leave_entitlements_unit_idx ON public.hp_leave_entitlements(facility_code);
ALTER TABLE public.hp_work_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hp_leave_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hp_leave_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hp_work_calendars,public.hp_leave_entitlements,public.hp_leave_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.hp_work_calendars,public.hp_leave_entitlements,public.hp_leave_requests TO authenticated;
GRANT ALL ON public.hp_work_calendars,public.hp_leave_entitlements,public.hp_leave_requests TO service_role;
CREATE POLICY calendar_read ON public.hp_work_calendars FOR SELECT TO authenticated USING (hp_private.session_valid() AND (hp_private.leave_manager(facility_code) OR EXISTS(SELECT 1 FROM public.hp_personnel_accounts a JOIN public.hp_personnel p ON p.id=a.personnel_id WHERE a.user_id=(SELECT auth.uid()) AND p.facility_code=hp_work_calendars.facility_code)));
CREATE POLICY calendar_insert ON public.hp_work_calendars FOR INSERT TO authenticated WITH CHECK(hp_private.leave_manager(facility_code));
CREATE POLICY calendar_update ON public.hp_work_calendars FOR UPDATE TO authenticated USING(hp_private.leave_manager(facility_code)) WITH CHECK(hp_private.leave_manager(facility_code));
CREATE POLICY quota_read ON public.hp_leave_entitlements FOR SELECT TO authenticated USING(hp_private.leave_subject(personnel_id,facility_code));
CREATE POLICY quota_insert ON public.hp_leave_entitlements FOR INSERT TO authenticated WITH CHECK(hp_private.leave_manager(facility_code));
CREATE POLICY quota_update ON public.hp_leave_entitlements FOR UPDATE TO authenticated USING(hp_private.leave_manager(facility_code)) WITH CHECK(hp_private.leave_manager(facility_code));
CREATE POLICY leave_read ON public.hp_leave_requests FOR SELECT TO authenticated USING(hp_private.leave_subject(personnel_id,facility_code));
CREATE POLICY leave_insert ON public.hp_leave_requests FOR INSERT TO authenticated WITH CHECK(hp_private.leave_subject(personnel_id,facility_code));
CREATE POLICY leave_update ON public.hp_leave_requests FOR UPDATE TO authenticated USING(hp_private.leave_subject(personnel_id,facility_code)) WITH CHECK(hp_private.leave_subject(personnel_id,facility_code));
CREATE FUNCTION public.hp_leave_data_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
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
  IF new.month_start<date '1957-10-01' OR new.month_start>date '2157-09-01' THEN RAISE EXCEPTION 'Invalid calendar year' USING ERRCODE='23514';END IF;
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
   allowed:=ARRAY['note','reference_no','submission_channel','written_date','written_at','addressee','form_employment_type','form_position_name','form_position_level','form_work_unit','form_section','form_division','contact_address','contact_phone','delegate_name','decision_note','approval_reference','approval_date','approved_by_name'];
   FOR k,v IN SELECT * FROM jsonb_each(new.details) LOOP
    IF NOT(k=ANY(allowed)) OR jsonb_typeof(v)<>'string' OR length(v#>>'{}')>1000 THEN RAISE EXCEPTION 'Invalid leave detail: %',k USING ERRCODE='23514';END IF;
   END LOOP;
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
    IF old.status='approved' AND (new.status<>'cancelled' OR NOT manager OR new.details IS DISTINCT FROM old.details OR new.leave_type<>old.leave_type OR new.date_from<>old.date_from OR new.date_to<>old.date_to OR new.portion<>old.portion) THEN RAISE EXCEPTION 'Approved leave can only be cancelled by manager' USING ERRCODE='42501';END IF;
    IF changed AND new.status IN ('approved','rejected') AND NOT manager THEN RAISE EXCEPTION 'Only unit manager may record approval outcome' USING ERRCODE='42501';END IF;
    IF changed AND (new.leave_type<>old.leave_type OR new.date_from<>old.date_from OR new.date_to<>old.date_to OR new.portion<>old.portion) THEN RAISE EXCEPTION 'Save pending edits before recording outcome' USING ERRCODE='23514';END IF;
    IF changed THEN new.decided_by:=actor;new.decided_at:=now();END IF;
   END IF;
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
CREATE TRIGGER hp_calendar_guard BEFORE INSERT OR UPDATE ON public.hp_work_calendars FOR EACH ROW EXECUTE FUNCTION public.hp_leave_data_guard();
CREATE TRIGGER hp_leave_quota_guard BEFORE INSERT OR UPDATE ON public.hp_leave_entitlements FOR EACH ROW EXECUTE FUNCTION public.hp_leave_data_guard();
CREATE TRIGGER hp_leave_request_guard BEFORE INSERT OR UPDATE ON public.hp_leave_requests FOR EACH ROW EXECUTE FUNCTION public.hp_leave_data_guard();
