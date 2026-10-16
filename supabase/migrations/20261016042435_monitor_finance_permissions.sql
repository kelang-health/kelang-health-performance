-- MONITOR may have a nullable assignment: read all spending, write no unit.
ALTER TABLE public.hp_user_facilities DROP CONSTRAINT hp_user_facilities_pkey;
ALTER TABLE public.hp_user_facilities ALTER COLUMN facility_code DROP NOT NULL;
ALTER TABLE public.hp_user_facilities ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY;
ALTER TABLE public.hp_user_facilities ADD CONSTRAINT hp_user_facilities_user_unit_key UNIQUE NULLS NOT DISTINCT(user_id,facility_code);
ALTER TABLE public.hp_user_facilities DROP CONSTRAINT hp_user_facilities_role_check;
ALTER TABLE public.hp_user_facilities ADD CONSTRAINT hp_user_facilities_role_check CHECK(role IN ('STAFF','MONITOR','ADMIN'));
ALTER TABLE public.hp_user_facilities ADD CONSTRAINT hp_user_facilities_scope_check CHECK(facility_code IS NOT NULL OR role='MONITOR');
CREATE FUNCTION hp_private.spending_view(code text) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT hp_private.session_valid() AND EXISTS(SELECT 1 FROM public.hp_user_facilities p WHERE p.user_id=(SELECT auth.uid()) AND (p.role IN ('ADMIN','MONITOR') OR p.role='STAFF' AND p.facility_code=code));
$$;
CREATE FUNCTION hp_private.spending_manager(code text) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT hp_private.session_valid() AND EXISTS(SELECT 1 FROM public.hp_user_facilities p WHERE p.user_id=(SELECT auth.uid()) AND (p.role='ADMIN' OR p.role IN ('STAFF','MONITOR') AND p.facility_code=code));
$$;
REVOKE ALL ON FUNCTION hp_private.spending_view(text),hp_private.spending_manager(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION hp_private.spending_view(text),hp_private.spending_manager(text) TO authenticated,service_role;
-- Keep MONITOR from gaining writes in unrelated modules through the legacy helper.
CREATE OR REPLACE FUNCTION hp_private.can_edit(code text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT hp_private.session_valid() AND EXISTS(SELECT 1 FROM public.hp_user_facilities p WHERE p.user_id=(SELECT auth.uid()) AND (p.role='ADMIN' OR p.role='STAFF' AND p.facility_code=code));
$$;
ALTER POLICY spending_read ON public.hp_spending_reports USING(hp_private.spending_view(facility_code));
ALTER POLICY spending_insert ON public.hp_spending_reports WITH CHECK(hp_private.spending_manager(facility_code) AND (period>0 OR (SELECT hp_private.is_admin())));
ALTER POLICY spending_update ON public.hp_spending_reports USING(hp_private.spending_manager(facility_code) AND (period>0 OR (SELECT hp_private.is_admin()))) WITH CHECK(hp_private.spending_manager(facility_code) AND (period>0 OR (SELECT hp_private.is_admin())));
CREATE OR REPLACE FUNCTION public.hp_spending_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE p public.hp_spending_reports; item jsonb; grp jsonb; k text; v jsonb; allowed text[]:='{}'; ids text[]:='{}'; amount numeric; annual numeric; spent numeric; manager boolean;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Use recoverable deletion' USING ERRCODE='42501'; END IF;
 manager:=coalesce(hp_private.is_admin(),false);
 IF auth.uid() IS NOT NULL AND NOT hp_private.spending_manager(new.facility_code) THEN RAISE EXCEPTION 'Unit permission denied' USING ERRCODE='42501';END IF;
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

