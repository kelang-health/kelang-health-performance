DROP POLICY settings_public_reporting_read ON public.hp_settings;
CREATE POLICY settings_public_reporting_read ON public.hp_settings FOR SELECT TO anon USING (category IN ('money','ncd','cd','kpi_publication','display'));
CREATE POLICY settings_authenticated_reporting_read ON public.hp_settings FOR SELECT TO authenticated USING (category IN ('money','ncd','cd','kpi_publication','display') OR (select hp_private.is_admin()));
