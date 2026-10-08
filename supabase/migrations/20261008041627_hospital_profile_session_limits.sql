-- HP-specific limits work on Free and do not change other applications' Auth sessions.
create table hp_private.session_activity (
 session_id uuid primary key references auth.sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 last_seen timestamptz not null default now()
);
create index hp_session_activity_user_idx on hp_private.session_activity(user_id);
alter table hp_private.session_activity enable row level security;
revoke all on hp_private.session_activity from public,anon,authenticated;

create function hp_private.session_valid() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists (
  select 1 from auth.sessions s
  join auth.users u on u.id=s.user_id
  join hp_private.session_activity a on a.session_id=s.id and a.user_id=s.user_id
  where s.id=nullif(auth.jwt()->>'session_id','')::uuid and s.user_id=auth.uid()
   and s.created_at>now()-interval '8 hours'
   and (s.not_after is null or s.not_after>now())
   and (u.banned_until is null or u.banned_until<=now())
   and a.last_seen>now()-interval '30 minutes'
 );
$$;
revoke all on function hp_private.session_valid() from public,anon;
grant execute on function hp_private.session_valid() to authenticated,service_role;

create function public.hp_check_session() returns boolean
language sql stable security invoker set search_path='' as $$
 select hp_private.session_valid();
$$;
revoke all on function public.hp_check_session() from public,anon;
grant execute on function public.hp_check_session() to authenticated;

create function public.hp_touch_session() returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 v_uid uuid:=auth.uid();v_sid uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
 v_started timestamptz;v_last timestamptz;v_now timestamptz:=now();
begin
 if v_uid is null or v_sid is null then raise exception 'HP_SESSION_EXPIRED' using errcode='42501';end if;
 select s.created_at into v_started from auth.sessions s join auth.users u on u.id=s.user_id
 where s.id=v_sid and s.user_id=v_uid and s.created_at>v_now-interval '8 hours'
 and (s.not_after is null or s.not_after>v_now)
 and (u.banned_until is null or u.banned_until<=v_now);
 if not found then raise exception 'HP_SESSION_EXPIRED' using errcode='42501';end if;
 select last_seen into v_last from hp_private.session_activity where session_id=v_sid and user_id=v_uid for update;
 if found then
  if v_last<=v_now-interval '30 minutes' then raise exception 'HP_SESSION_EXPIRED' using errcode='42501';end if;
  update hp_private.session_activity set last_seen=v_now where session_id=v_sid and user_id=v_uid;
 else
  -- Old/unregistered sessions must sign in again; refresh cannot restart the clock.
  if v_started<=v_now-interval '30 minutes' then raise exception 'HP_SESSION_EXPIRED' using errcode='42501';end if;
  insert into hp_private.session_activity(session_id,user_id,last_seen) values(v_sid,v_uid,v_now)
  on conflict(session_id) do nothing;
 end if;
 return jsonb_build_object('started_at',v_started,'maximum_until',v_started+interval '8 hours','idle_until',v_now+interval '30 minutes');
end;
$$;
revoke all on function public.hp_touch_session() from public,anon;
grant execute on function public.hp_touch_session() to authenticated;

create or replace function hp_private.is_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select hp_private.session_valid() and exists(select 1 from public.hp_user_facilities p
 where p.user_id=(select auth.uid()) and p.role='ADMIN');
$$;
create or replace function hp_private.can_edit(code text) returns boolean
language sql stable security definer set search_path='' as $$
 select hp_private.session_valid() and exists(select 1 from public.hp_user_facilities p
 where p.user_id=(select auth.uid()) and (p.role='ADMIN' or p.facility_code=code));
$$;

do $$ declare t text;begin
 for t in select tablename from pg_tables where schemaname='public' and tablename like 'hp\_%' escape '\' loop
  execute format('create policy hp_session_insert_guard on public.%I as restrictive for insert to authenticated with check ((select hp_private.session_valid()))',t);
  execute format('create policy hp_session_update_guard on public.%I as restrictive for update to authenticated using ((select hp_private.session_valid())) with check ((select hp_private.session_valid()))',t);
  execute format('create policy hp_session_delete_guard on public.%I as restrictive for delete to authenticated using ((select hp_private.session_valid()))',t);
 end loop;
 foreach t in array array['hp_user_facilities','hp_personnel_accounts','hp_staff_documents','hp_import_records','hp_audit_logs'] loop
  execute format('create policy hp_session_private_read_guard on public.%I as restrictive for select to authenticated using ((select hp_private.session_valid()))',t);
 end loop;
end $$;
create policy hp_session_personnel_read_guard on public.hp_personnel as restrictive for select to authenticated
using ((active and published) or (select hp_private.session_valid()));
create policy hp_session_photo_insert_guard on storage.objects as restrictive for insert to authenticated
with check (bucket_id<>'hp-personnel' or (select hp_private.session_valid()));
create policy hp_session_photo_update_guard on storage.objects as restrictive for update to authenticated
using (bucket_id<>'hp-personnel' or (select hp_private.session_valid()))
with check (bucket_id<>'hp-personnel' or (select hp_private.session_valid()));
create policy hp_session_photo_delete_guard on storage.objects as restrictive for delete to authenticated
using (bucket_id<>'hp-personnel' or (select hp_private.session_valid()));
