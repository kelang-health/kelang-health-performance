-- Separate write policies avoid evaluating an ALL policy on public SELECTs.
drop policy facilities_admin on public.hp_facilities;
create policy facilities_admin_insert on public.hp_facilities for insert to authenticated with check(hp_private.is_admin());
create policy facilities_admin_update on public.hp_facilities for update to authenticated using(hp_private.is_admin()) with check(hp_private.is_admin());
create policy facilities_admin_delete on public.hp_facilities for delete to authenticated using(hp_private.is_admin());
drop policy permissions_admin on public.hp_user_facilities;
create policy permissions_admin_insert on public.hp_user_facilities for insert to authenticated with check(hp_private.is_admin());
create policy permissions_admin_update on public.hp_user_facilities for update to authenticated using(hp_private.is_admin()) with check(hp_private.is_admin());
create policy permissions_admin_delete on public.hp_user_facilities for delete to authenticated using(hp_private.is_admin());
do $$ declare t text;begin
 foreach t in array array['hp_settings','hp_import_records'] loop
  execute format('drop policy admin_write on public.%I',t);
  execute format('create policy admin_insert on public.%I for insert to authenticated with check(hp_private.is_admin())',t);
  execute format('create policy admin_update on public.%I for update to authenticated using(hp_private.is_admin()) with check(hp_private.is_admin())',t);
  execute format('create policy admin_delete on public.%I for delete to authenticated using(hp_private.is_admin())',t);
 end loop;
end $$;
-- Existing UNIQUE indexes already cover facility_code, fiscal_year.
drop index public.hp_population_facility_year_idx;
drop index public.hp_staff_facility_year_idx;
drop index public.hp_volunteers_facility_year_idx;
