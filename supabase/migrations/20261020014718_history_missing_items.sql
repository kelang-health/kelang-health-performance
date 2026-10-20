-- Append manual details in owned drafts; preserve original source and confirmed locks.
CREATE OR REPLACE FUNCTION hp_private.history_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE g jsonb; d jsonb; previous_g jsonb; previous_d jsonb; v jsonb; n numeric; subtotal numeric; item_count integer; ids text[]:='{}'; dids text[]; missing boolean;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'History cannot be deleted' USING ERRCODE='42501';END IF;
 IF current_user NOT IN ('postgres','service_role','supabase_admin') AND NOT hp_private.spending_manager(new.facility_code) THEN RAISE EXCEPTION 'Unit permission required' USING ERRCODE='42501';END IF;
 IF TG_OP='UPDATE' THEN
  IF (new.id,new.facility_code,new.fiscal_year,new.created_at,new.source) IS DISTINCT FROM (old.id,old.facility_code,old.fiscal_year,old.created_at,old.source) THEN RAISE EXCEPTION 'History identity/source is immutable' USING ERRCODE='23514';END IF;
  IF new.revision<>old.revision+1 THEN RAISE EXCEPTION 'Stale history revision' USING ERRCODE='40001';END IF;
  IF old.status='confirmed' THEN
   IF NOT hp_private.is_admin() OR new.status<>'draft' OR new.payload<>old.payload OR (new.coverage_start,new.coverage_end,new.review_note) IS DISTINCT FROM (old.coverage_start,old.coverage_end,old.review_note) OR length(trim(new.reason))<5 THEN RAISE EXCEPTION 'ADMIN must reopen with reason before editing' USING ERRCODE='42501';END IF;
  END IF;
 ELSE
  IF new.revision<>1 OR new.status<>'draft' THEN RAISE EXCEPTION 'New history starts as draft' USING ERRCODE='23514';END IF;
 END IF;
 IF jsonb_typeof(new.payload->'groups') IS DISTINCT FROM 'array' OR jsonb_array_length(new.payload->'groups')<>11 THEN RAISE EXCEPTION 'Expected 11 categories' USING ERRCODE='23514';END IF;
 FOR g IN SELECT value FROM jsonb_array_elements(new.payload->'groups') LOOP
  IF NOT coalesce(g->>'id' ~ '^([1-9]|10|11)$',false) OR g->>'id'=ANY(ids) OR length(coalesce(g->>'label','')) NOT BETWEEN 1 AND 500 OR length(coalesce(g->>'note',''))>2000 OR jsonb_typeof(g->'details') IS DISTINCT FROM 'array' OR jsonb_array_length(g->'details')>250 THEN RAISE EXCEPTION 'Invalid category' USING ERRCODE='23514';END IF;
  ids:=array_append(ids,g->>'id');dids:='{}';subtotal:=0;item_count:=0;missing:=false;
  IF TG_OP='UPDATE' THEN
   SELECT value INTO previous_g FROM jsonb_array_elements(old.payload->'groups') WHERE value->>'id'=g->>'id';
   IF g->>'label' IS DISTINCT FROM previous_g->>'label' OR (new.fiscal_year NOT IN (2568,2569) AND jsonb_array_length(g->'details')<>jsonb_array_length(previous_g->'details')) THEN RAISE EXCEPTION 'Category structure is immutable' USING ERRCODE='23514';END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(previous_g->'details') old_d WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(g->'details') new_d WHERE new_d->>'id'=old_d->>'id')) THEN RAISE EXCEPTION 'Existing details cannot be removed or moved' USING ERRCODE='23514';END IF;
  END IF;
  FOR d IN SELECT value FROM jsonb_array_elements(g->'details') LOOP
   IF NOT coalesce(d->>'id' ~ '^[a-zA-Z0-9_-]{1,30}$',false) OR d->>'id'=ANY(dids) OR length(trim(coalesce(d->>'label',''))) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid detail' USING ERRCODE='23514';END IF;
   dids:=array_append(dids,d->>'id');
   IF TG_OP='UPDATE' THEN
    SELECT value INTO previous_d FROM jsonb_array_elements(previous_g->'details') WHERE value->>'id'=d->>'id';
    IF previous_d IS NULL THEN
     IF new.fiscal_year NOT IN (2568,2569) OR NOT coalesce(d->>'id' ~ '^m_[a-f0-9]{24}$',false) THEN RAISE EXCEPTION 'New manual details allowed only in FY2568/2569' USING ERRCODE='23514';END IF;
    ELSIF new.fiscal_year NOT IN (2568,2569) AND d->>'label' IS DISTINCT FROM previous_d->>'label' THEN RAISE EXCEPTION 'Detail structure is immutable' USING ERRCODE='23514';END IF;
   END IF;
   IF d->'amount' IS NULL OR d->'amount'='null'::jsonb THEN missing:=true;ELSE subtotal:=subtotal+(d->>'amount')::numeric;item_count:=item_count+1;END IF;
   FOR v IN SELECT value FROM jsonb_each(d) WHERE key IN ('amount','commitment','planned') LOOP
    IF v<>'null'::jsonb THEN
     IF jsonb_typeof(v)<>'number' THEN RAISE EXCEPTION 'Amount must be numeric' USING ERRCODE='23514';END IF;
     n:=v::text::numeric;IF n<0 OR n>999999999.99 OR n<>round(n,2) THEN RAISE EXCEPTION 'Invalid amount' USING ERRCODE='23514';END IF;
    END IF;
   END LOOP;
  END LOOP;
  FOR v IN SELECT value FROM jsonb_each(g) WHERE key IN ('amount','commitment','planned') LOOP
   IF v<>'null'::jsonb THEN
    IF jsonb_typeof(v)<>'number' THEN RAISE EXCEPTION 'Amount must be numeric' USING ERRCODE='23514';END IF;
    n:=v::text::numeric;IF n<0 OR n>999999999.99 OR n<>round(n,2) THEN RAISE EXCEPTION 'Invalid amount' USING ERRCODE='23514';END IF;
   END IF;
  END LOOP;
  IF new.status='confirmed' THEN
   IF g->'amount' IS NULL OR g->'amount'='null'::jsonb THEN RAISE EXCEPTION 'Confirm every category, including explicit zero' USING ERRCODE='23514';END IF;
   IF jsonb_array_length(g->'details')>0 AND (missing OR item_count=0 OR subtotal<>(g->>'amount')::numeric) AND length(trim(coalesce(g->>'note','')))<5 THEN RAISE EXCEPTION 'Explain incomplete details or category difference' USING ERRCODE='23514';END IF;
  END IF;
 END LOOP;
 IF new.status='confirmed' THEN
  IF new.coverage_start IS NULL OR new.coverage_end IS NULL THEN RAISE EXCEPTION 'Coverage dates required' USING ERRCODE='23514';END IF;
  IF jsonb_array_length(coalesce(new.source->'issues','[]'::jsonb))>0 AND length(trim(new.review_note))<10 THEN RAISE EXCEPTION 'Explain source issues before confirmation' USING ERRCODE='23514';END IF;
 END IF;
 new.updated_at:=now();new.updated_by:=auth.uid();
 new.confirmed_by:=CASE WHEN new.status='confirmed' THEN auth.uid() END;
 new.confirmed_at:=CASE WHEN new.status='confirmed' THEN now() END;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION hp_private.history_guard() FROM PUBLIC,anon,authenticated;
