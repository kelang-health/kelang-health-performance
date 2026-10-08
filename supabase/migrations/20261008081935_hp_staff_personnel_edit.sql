-- STAFF may maintain personnel only in assigned units. ADMIN-only delete/account policies stay intact.
create policy hp_personnel_staff_insert on public.hp_personnel for insert to authenticated
with check (structure_role in ('member','unit_head') and active and exists (
 select 1 from public.hp_user_facilities a where a.user_id=(select auth.uid()) and a.role='STAFF' and a.facility_code=hp_personnel.facility_code
));
create policy hp_personnel_staff_update on public.hp_personnel for update to authenticated
using (structure_role in ('member','unit_head') and exists (
 select 1 from public.hp_user_facilities a where a.user_id=(select auth.uid()) and a.role='STAFF' and a.facility_code=hp_personnel.facility_code
))
with check (structure_role in ('member','unit_head') and exists (
 select 1 from public.hp_user_facilities a where a.user_id=(select auth.uid()) and a.role='STAFF' and a.facility_code=hp_personnel.facility_code
));

-- Invoker trigger prevents API clients from moving rows or overwriting system/photo fields.
create function hp_private.guard_staff_personnel_fields() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if current_user='authenticated' and not hp_private.is_admin() then
  if TG_OP='UPDATE' then
   if (to_jsonb(new)-array['full_name','position_name','position_level','employment_type','structure_role','display_order','published','updated_at'])
      is distinct from (to_jsonb(old)-array['full_name','position_name','position_level','employment_type','structure_role','display_order','published','updated_at'])
   then raise exception 'STAFF cannot change unit or protected personnel fields' using errcode='42501';end if;
  elsif new.source_key is not null or new.photo_updated_at is not null or new.photo_bytes is not null or not new.active then
   raise exception 'STAFF cannot set protected personnel fields' using errcode='42501';
  end if;
 end if;
 return new;
end;
$$;
revoke all on function hp_private.guard_staff_personnel_fields() from public,anon,authenticated;
create trigger hp_personnel_staff_fields before insert or update on public.hp_personnel
for each row execute function hp_private.guard_staff_personnel_fields();
