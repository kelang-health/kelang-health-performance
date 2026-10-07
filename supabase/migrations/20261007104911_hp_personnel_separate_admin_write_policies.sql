-- Preserve the existing read policies and ADMIN predicate; avoid duplicate SELECT evaluation.
drop policy hp_personnel_admin_write on public.hp_personnel;
create policy hp_personnel_admin_insert on public.hp_personnel for insert to authenticated with check(hp_private.is_admin());
create policy hp_personnel_admin_update on public.hp_personnel for update to authenticated using(hp_private.is_admin()) with check(hp_private.is_admin());
create policy hp_personnel_admin_delete on public.hp_personnel for delete to authenticated using(hp_private.is_admin());
drop policy hp_personnel_account_write on public.hp_personnel_accounts;
create policy hp_personnel_account_insert on public.hp_personnel_accounts for insert to authenticated with check(hp_private.is_admin());
create policy hp_personnel_account_update on public.hp_personnel_accounts for update to authenticated using(hp_private.is_admin()) with check(hp_private.is_admin());
create policy hp_personnel_account_delete on public.hp_personnel_accounts for delete to authenticated using(hp_private.is_admin());
