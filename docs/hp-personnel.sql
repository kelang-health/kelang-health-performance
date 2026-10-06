create table public.hp_personnel (
 id uuid primary key default gen_random_uuid(), source_key text unique, full_name text not null check(length(full_name) between 1 and 200),
 position_name text not null default '' check(length(position_name)<=200), position_level text not null default '' check(length(position_level)<=100), employment_type text not null default '' check(length(employment_type)<=100),
 facility_code text references public.hp_facilities(facility_code), structure_role text not null default 'member' check(structure_role in ('director','head','unit_head','member')),
 display_order integer not null default 100, active boolean not null default true, published boolean not null default false,
 photo_updated_at timestamptz, photo_bytes integer not null default 0 check(photo_bytes between 0 and 131072), updated_at timestamptz not null default now(),
 check(facility_code is not null or structure_role in ('director','head'))
);
create unique index hp_personnel_leader_slot on public.hp_personnel(structure_role) where structure_role in ('director','head') and active;
create index hp_personnel_facility on public.hp_personnel(facility_code);
create table public.hp_personnel_accounts (
 personnel_id uuid primary key references public.hp_personnel(id) on delete cascade, user_id uuid unique not null references auth.users(id) on delete cascade,
 updated_at timestamptz not null default now()
);
create function hp_private.can_photo(person_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.hp_personnel p where p.id=person_id and p.active and
 (hp_private.is_admin() or hp_private.can_edit(p.facility_code) or exists(select 1 from public.hp_personnel_accounts a where a.personnel_id=p.id and a.user_id=(select auth.uid()))));
$$;
create function hp_private.can_read_photo(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.hp_personnel p where object_name=p.id::text||'.webp' and p.active and ((p.published) or hp_private.can_photo(p.id)));
$$;
create function hp_private.can_write_photo(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.hp_personnel p where object_name=p.id::text||'.webp' and hp_private.can_photo(p.id));
$$;
revoke all on function hp_private.can_photo(uuid),hp_private.can_read_photo(text),hp_private.can_write_photo(text) from public;
grant execute on function hp_private.can_photo(uuid),hp_private.can_read_photo(text),hp_private.can_write_photo(text) to anon,authenticated;
alter table public.hp_personnel enable row level security;
alter table public.hp_personnel_accounts enable row level security;
grant select on public.hp_personnel to anon,authenticated;
grant insert,update,delete on public.hp_personnel to authenticated;
grant select,insert,update,delete on public.hp_personnel_accounts to authenticated;
create function hp_private.can_view_person(person_id uuid) returns boolean language sql stable security definer set search_path='' as $ select exists(select 1 from public.hp_personnel p where p.id=person_id and ((p.active and p.published) or hp_private.is_admin() or hp_private.can_photo(p.id))); $;
revoke all on function hp_private.can_view_person(uuid) from public;
grant execute on function hp_private.can_view_person(uuid) to anon,authenticated;
create policy hp_personnel_read on public.hp_personnel for select to anon,authenticated using(hp_private.can_view_person(id));
create policy hp_personnel_admin_write on public.hp_personnel for all to authenticated using(hp_private.is_admin()) with check(hp_private.is_admin());
create policy hp_personnel_account_read on public.hp_personnel_accounts for select to authenticated using(user_id=(select auth.uid()) or hp_private.is_admin());
create policy hp_personnel_account_write on public.hp_personnel_accounts for all to authenticated using(hp_private.is_admin()) with check(hp_private.is_admin());
create trigger hp_personnel_audit before insert or update or delete on public.hp_personnel for each row execute function hp_private.audit_change();
create trigger hp_personnel_accounts_audit before insert or update or delete on public.hp_personnel_accounts for each row execute function hp_private.audit_change();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('hp-personnel','hp-personnel',false,131072,array['image/webp']);
create policy hp_photo_read on storage.objects for select to anon,authenticated using(bucket_id='hp-personnel' and hp_private.can_read_photo(name));
create policy hp_photo_insert on storage.objects for insert to authenticated with check(bucket_id='hp-personnel' and hp_private.can_write_photo(name));
create policy hp_photo_update on storage.objects for update to authenticated using(bucket_id='hp-personnel' and hp_private.can_write_photo(name)) with check(bucket_id='hp-personnel' and hp_private.can_write_photo(name));
create policy hp_photo_delete on storage.objects for delete to authenticated using(bucket_id='hp-personnel' and hp_private.can_write_photo(name));
create function hp_private.hp_photo_refresh(person_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare size_bytes integer;
begin
 if not hp_private.can_photo(person_id) then raise exception 'Photo permission denied' using errcode='42501'; end if;
 select (metadata->>'size')::integer into size_bytes from storage.objects where bucket_id='hp-personnel' and name=person_id::text||'.webp';
 if size_bytes is null or size_bytes>131072 then raise exception 'Photo is missing or too large'; end if;
 update public.hp_personnel set photo_updated_at=now(),photo_bytes=size_bytes where id=person_id;
end $$;
revoke all on function hp_private.hp_photo_refresh(uuid) from public,anon;
grant execute on function hp_private.hp_photo_refresh(uuid) to authenticated;
create function public.hp_photo_refresh(person_id uuid) returns void language sql security invoker set search_path='' as $ select hp_private.hp_photo_refresh(person_id); $;
revoke all on function public.hp_photo_refresh(uuid) from public,anon;
grant execute on function public.hp_photo_refresh(uuid) to authenticated;
