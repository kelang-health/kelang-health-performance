create function hp_private.enforce_hp_only_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if NEW.active and exists(select 1 from auth.users u where u.id=NEW.id and u.raw_app_meta_data->>'hp_only'='true') then
  raise exception 'Hospital Profile-only account cannot be activated in another system' using errcode='42501';
 end if;
 return NEW;
end $$;
revoke all on function hp_private.enforce_hp_only_profile() from public,anon,authenticated;
create trigger hp_only_profile_scope before insert or update of active on public.profiles
for each row execute function hp_private.enforce_hp_only_profile();
