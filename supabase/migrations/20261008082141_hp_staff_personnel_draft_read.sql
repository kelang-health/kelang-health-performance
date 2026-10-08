create policy hp_personnel_staff_read on public.hp_personnel for select to authenticated
using (structure_role in ('member','unit_head') and exists (
 select 1 from public.hp_user_facilities a where a.user_id=(select auth.uid()) and a.role='STAFF' and a.facility_code=hp_personnel.facility_code
));
