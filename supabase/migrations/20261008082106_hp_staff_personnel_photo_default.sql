create or replace function hp_private.guard_staff_personnel_fields() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if current_user='authenticated' and not hp_private.is_admin() then
  if TG_OP='UPDATE' then
   if (to_jsonb(new)-array['full_name','position_name','position_level','employment_type','structure_role','display_order','published','updated_at'])
      is distinct from (to_jsonb(old)-array['full_name','position_name','position_level','employment_type','structure_role','display_order','published','updated_at'])
   then raise exception 'STAFF cannot change unit or protected personnel fields' using errcode='42501';end if;
  elsif new.source_key is not null or new.photo_updated_at is not null or coalesce(new.photo_bytes,0)<>0 or not new.active then
   raise exception 'STAFF cannot set protected personnel fields' using errcode='42501';
  end if;
 end if;
 return new;
end;
$$;

