-- Keep aggregate reports available; never expose source payloads to browser roles.
DO $migration$
DECLARE r record; columns_sql text;
BEGIN
 FOR r IN SELECT c.table_name FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.column_name='raw_data'
   AND c.table_name IN ('hp_facility_profiles','hp_population','hp_staff','hp_volunteers','hp_budget_monthly','hp_finance_monthly','hp_ncd_monthly','hp_cd_monthly')
 LOOP
  SELECT string_agg(quote_ident(column_name),',' ORDER BY ordinal_position) INTO columns_sql
   FROM information_schema.columns WHERE table_schema='public' AND table_name=r.table_name AND column_name<>'raw_data';
  EXECUTE format('REVOKE SELECT ON TABLE public.%I FROM PUBLIC, anon, authenticated',r.table_name);
  EXECUTE format('REVOKE SELECT (raw_data) ON TABLE public.%I FROM PUBLIC, anon, authenticated',r.table_name);
  EXECUTE format('GRANT SELECT (%s) ON TABLE public.%I TO anon, authenticated',columns_sql,r.table_name);
 END LOOP;
END;
$migration$;
REVOKE SELECT ON public.hp_import_records FROM PUBLIC, anon;
DROP POLICY IF EXISTS public_read ON public.hp_import_records;
CREATE POLICY import_records_admin_read ON public.hp_import_records
 FOR SELECT TO authenticated USING ((select hp_private.is_admin()));
DROP POLICY IF EXISTS public_read ON public.hp_settings;
CREATE POLICY settings_public_reporting_read ON public.hp_settings
 FOR SELECT TO anon, authenticated
 USING (category IN ('money','ncd','cd','kpi_publication','display') OR (select hp_private.is_admin()));
NOTIFY pgrst, 'reload schema';
