-- One persistent table: period 0 stores the source plan; periods 1..12 store monthly reports.
CREATE TABLE public.hp_spending_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 facility_code text NOT NULL REFERENCES public.hp_facilities(facility_code),
 fiscal_year integer NOT NULL CHECK(fiscal_year BETWEEN 2500 AND 2700),
 period integer NOT NULL CHECK(period BETWEEN 0 AND 12),
 status text NOT NULL CHECK(status IN ('plan','draft','confirmed','deleted')),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=700000),
 reason text NOT NULL DEFAULT '' CHECK(length(reason)<=1000),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 updated_by uuid,confirmed_by uuid,confirmed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(facility_code,fiscal_year,period),
 CHECK((period=0 AND status='plan') OR (period>0 AND status<>'plan'))
);
ALTER TABLE public.hp_spending_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hp_spending_reports FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.hp_spending_reports TO authenticated;
GRANT ALL ON public.hp_spending_reports TO service_role;
CREATE POLICY spending_read ON public.hp_spending_reports FOR SELECT TO authenticated
 USING(hp_private.leave_manager(facility_code));
CREATE POLICY spending_insert ON public.hp_spending_reports FOR INSERT TO authenticated
 WITH CHECK(hp_private.leave_manager(facility_code) AND (period>0 OR (SELECT hp_private.is_admin())));
CREATE POLICY spending_update ON public.hp_spending_reports FOR UPDATE TO authenticated
 USING(hp_private.leave_manager(facility_code) AND (period>0 OR (SELECT hp_private.is_admin())))
 WITH CHECK(hp_private.leave_manager(facility_code) AND (period>0 OR (SELECT hp_private.is_admin())));

CREATE FUNCTION public.hp_spending_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE p public.hp_spending_reports; item jsonb; grp jsonb; k text; v jsonb; allowed text[]:='{}'; ids text[]:='{}'; amount numeric; annual numeric; spent numeric; manager boolean;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Use recoverable deletion' USING ERRCODE='42501'; END IF;
 manager:=coalesce(hp_private.is_admin(),false);
 IF auth.uid() IS NOT NULL AND NOT hp_private.leave_manager(new.facility_code) THEN RAISE EXCEPTION 'Unit permission denied' USING ERRCODE='42501';END IF;
 -- Serialize confirmations per unit/year without requiring STAFF to UPDATE the plan row.
 PERFORM pg_advisory_xact_lock(hashtextextended('hp_spending:'||new.facility_code||':'||new.fiscal_year,0));
 IF TG_OP='INSERT' THEN
  IF new.revision<>1 THEN RAISE EXCEPTION 'Invalid initial revision' USING ERRCODE='23514'; END IF;
  new.created_at:=now();
 ELSE
  IF new.id<>old.id OR new.facility_code<>old.facility_code OR new.fiscal_year<>old.fiscal_year OR new.period<>old.period OR new.created_at<>old.created_at THEN RAISE EXCEPTION 'Report identity is immutable' USING ERRCODE='42501'; END IF;
  IF new.revision<>old.revision+1 THEN RAISE EXCEPTION 'Revision conflict: reload before saving' USING ERRCODE='40001'; END IF;
  IF old.status='confirmed' THEN
   IF NOT manager OR new.status<>'draft' OR new.payload IS DISTINCT FROM old.payload OR length(trim(new.reason))=0 THEN RAISE EXCEPTION 'ADMIN must reopen confirmed month with reason first' USING ERRCODE='42501'; END IF;
  END IF;
  IF new.period=0 AND EXISTS(SELECT 1 FROM public.hp_spending_reports r WHERE r.facility_code=old.facility_code AND r.fiscal_year=old.fiscal_year AND r.period>0) THEN RAISE EXCEPTION 'Plan with reports cannot be overwritten' USING ERRCODE='23514'; END IF;
 END IF;
 IF new.period=0 THEN
  IF auth.uid() IS NOT NULL AND NOT manager THEN RAISE EXCEPTION 'Only ADMIN can maintain plans' USING ERRCODE='42501';END IF;
  IF jsonb_typeof(new.payload->'groups') IS DISTINCT FROM 'array' OR jsonb_array_length(new.payload->'groups')<>11 OR jsonb_typeof(new.payload->'annual') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Invalid source plan' USING ERRCODE='23514';END IF;
  FOR grp IN SELECT value FROM jsonb_array_elements(new.payload->'groups') LOOP
   IF jsonb_typeof(grp->'rows') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid plan rows';END IF;
   FOR item IN SELECT value FROM jsonb_array_elements(grp->'rows') LOOP
    IF coalesce(item->>'id','')='' OR item->>'id'=ANY(ids) THEN RAISE EXCEPTION 'Invalid or duplicate plan item';END IF;
    ids:=array_append(ids,item->>'id');
   END LOOP;
  END LOOP;
 ELSE
  SELECT * INTO p FROM public.hp_spending_reports WHERE facility_code=new.facility_code AND fiscal_year=new.fiscal_year AND period=0;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source plan is unavailable' USING ERRCODE='23514'; END IF;
  IF jsonb_typeof(new.payload->'amounts') IS DISTINCT FROM 'object' OR jsonb_typeof(new.payload->'note') IS DISTINCT FROM 'string' OR length(new.payload->>'note')>2000 THEN RAISE EXCEPTION 'Invalid monthly payload' USING ERRCODE='23514'; END IF;
  IF new.payload->>'plan_id' IS DISTINCT FROM p.id::text OR (new.payload->>'plan_revision')::bigint IS DISTINCT FROM p.revision THEN RAISE EXCEPTION 'Plan changed: reload' USING ERRCODE='40001';END IF;
  FOR item IN SELECT r.value FROM jsonb_array_elements(p.payload->'groups') g CROSS JOIN LATERAL jsonb_array_elements(g.value->'rows') r WHERE r.value->>'input'='true' LOOP allowed:=array_append(allowed,item->>'id');END LOOP;
  FOR k,v IN SELECT * FROM jsonb_each(new.payload->'amounts') LOOP
   IF NOT(k=ANY(allowed)) OR jsonb_typeof(v)<>'number' THEN RAISE EXCEPTION 'Invalid amount or unknown item' USING ERRCODE='23514'; END IF;
   amount:=v::text::numeric;
   IF amount<0 OR amount>999999999.99 OR amount<>round(amount,2) THEN RAISE EXCEPTION 'Invalid amount precision/range' USING ERRCODE='23514'; END IF;
  END LOOP;
  IF new.status='confirmed' THEN
   IF (SELECT count(*) FROM jsonb_object_keys(new.payload->'amounts'))<>cardinality(allowed) THEN RAISE EXCEPTION 'Fill every item; use zero for no spending' USING ERRCODE='23514';END IF;
   SELECT coalesce(sum(value::text::numeric),0) INTO amount FROM jsonb_each(new.payload->'amounts');
   SELECT coalesce(sum(v.value::text::numeric),0) INTO spent FROM public.hp_spending_reports r CROSS JOIN LATERAL jsonb_each(r.payload->'amounts') v WHERE r.facility_code=new.facility_code AND r.fiscal_year=new.fiscal_year AND r.period<>new.period AND r.status='confirmed' AND (CASE WHEN r.period>=10 THEN r.period-10 ELSE r.period+2 END)<=(CASE WHEN new.period>=10 THEN new.period-10 ELSE new.period+2 END);
   annual:=(p.payload->>'annual')::numeric;
   IF spent+amount>annual AND length(trim(new.payload->>'note'))=0 THEN RAISE EXCEPTION 'Over plan requires a note' USING ERRCODE='23514';END IF;
  END IF;
  IF new.status='deleted' AND length(trim(new.reason))=0 THEN RAISE EXCEPTION 'Deletion requires a reason' USING ERRCODE='23514'; END IF;
 END IF;
 new.updated_by:=auth.uid();new.updated_at:=now();
 new.confirmed_by:=CASE WHEN new.status='confirmed' THEN auth.uid() END;
 new.confirmed_at:=CASE WHEN new.status='confirmed' THEN now() END;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION public.hp_spending_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER spending_guard BEFORE INSERT OR UPDATE OR DELETE ON public.hp_spending_reports FOR EACH ROW EXECUTE FUNCTION public.hp_spending_guard();
CREATE TRIGGER spending_audit AFTER INSERT OR UPDATE ON public.hp_spending_reports FOR EACH ROW EXECUTE FUNCTION hp_private.audit_change();
COMMENT ON TABLE public.hp_spending_reports IS 'Private annual detailed plans (period=0) and one monthly report per facility/FY/month. Deleted reports remain recoverable; changes use hp_audit_logs.';
