-- Additive schema: existing equipment-sharing tables are untouched.
create schema if not exists hp_private;
revoke all on schema hp_private from public;
grant usage on schema hp_private to authenticated;
create table public.hp_facilities (
 facility_code text primary key check(facility_code ~ '^[0-9]{5}$'), facility_name text not null,
 short_name text not null, area_unit boolean not null, service_unit boolean not null,
 active boolean not null default true, display_order integer not null
);
create table public.hp_user_facilities (
 user_id uuid not null references auth.users(id), facility_code text not null references public.hp_facilities,
 role text not null check(role in ('STAFF','ADMIN')), primary key(user_id,facility_code)
);
create index hp_user_facilities_code_idx on public.hp_user_facilities(facility_code);
-- Internal trusted permission lookup avoids recursive permission-table RLS.
create function hp_private.can_edit(code text) returns boolean language sql stable security definer
set search_path = '' as $$
 select auth.uid() is not null and exists(select 1 from public.hp_user_facilities p
 where p.user_id=(select auth.uid()) and (p.role='ADMIN' or p.facility_code=code));
$$;
create function hp_private.is_admin() returns boolean language sql stable security definer
set search_path = '' as $$
 select auth.uid() is not null and exists(select 1 from public.hp_user_facilities p
 where p.user_id=(select auth.uid()) and p.role='ADMIN');
$$;
revoke all on function hp_private.can_edit(text), hp_private.is_admin() from public,anon;
grant execute on function hp_private.can_edit(text), hp_private.is_admin() to authenticated;
create table public.hp_facility_profiles (
 facility_code text primary key references public.hp_facilities, address text, notes text,
 raw_data jsonb not null default '{}', source_updated_at timestamptz, updated_at timestamptz not null default now()
);
create table public.hp_population (
 id uuid primary key default gen_random_uuid(), facility_code text not null references public.hp_facilities,
 fiscal_year integer not null, population integer check(population>=0), male integer check(male>=0), female integer check(female>=0),
 households integer check(households>=0), communities integer check(communities>=0), raw_data jsonb not null default '{}',
 source_updated_at timestamptz, updated_at timestamptz not null default now(), unique(facility_code,fiscal_year)
);
create table public.hp_staff (
 id uuid primary key default gen_random_uuid(), facility_code text not null references public.hp_facilities,
 fiscal_year integer not null, profession text not null, staff_count integer check(staff_count>=0), support_count integer check(support_count>=0),
 raw_data jsonb not null default '{}', updated_at timestamptz not null default now(), unique(facility_code,fiscal_year,profession)
);
create table public.hp_volunteers (
 id uuid primary key default gen_random_uuid(), facility_code text not null references public.hp_facilities,
 fiscal_year integer not null, volunteer_count integer check(volunteer_count>=0), raw_data jsonb not null default '{}',
 updated_at timestamptz not null default now(), unique(facility_code,fiscal_year)
);
create table public.hp_budget_monthly (
 id uuid primary key default gen_random_uuid(), source_key text unique, facility_code text not null references public.hp_facilities,
 fiscal_year integer not null, period date, kind text not null default 'annual_plan' check(kind in ('annual_plan','monthly_plan')),
 amount numeric(16,2) check(amount>=0), review_status text not null default 'accepted' check(review_status in ('accepted','pending','rejected')),
 raw_data jsonb not null default '{}', updated_at timestamptz not null default now()
);
create table public.hp_finance_monthly (
 id uuid primary key default gen_random_uuid(), source_key text unique, facility_code text not null references public.hp_facilities,
 fiscal_year integer not null, period date not null, amount numeric(16,2) check(amount>=0),
 review_status text not null default 'accepted' check(review_status in ('accepted','pending','rejected')),
 raw_data jsonb not null default '{}', updated_at timestamptz not null default now()
);
create table public.hp_ncd_monthly (
 id uuid primary key default gen_random_uuid(), source_key text unique, facility_code text not null references public.hp_facilities,
 fiscal_year integer not null, period date not null, disease text not null, case_type text not null check(case_type in ('รายเก่า','รายใหม่')),
 case_count integer check(case_count>=0), raw_data jsonb not null default '{}', updated_at timestamptz not null default now()
);
create table public.hp_cd_monthly (
 id uuid primary key default gen_random_uuid(), source_key text unique, facility_code text not null references public.hp_facilities,
 fiscal_year integer not null, period date not null, disease text not null, case_count integer check(case_count>=0),
 raw_data jsonb not null default '{}', updated_at timestamptz not null default now()
);
create table public.hp_service_stats (
 id uuid primary key default gen_random_uuid(), facility_code text not null references public.hp_facilities,
 fiscal_year integer not null, period date not null, service_name text not null, visit_count integer check(visit_count>=0),
 updated_at timestamptz not null default now(), unique(facility_code,period,service_name)
);
create table public.hp_settings (
 setting_key text primary key, category text not null, value jsonb not null, updated_at timestamptz not null default now()
);
create table public.hp_import_records (
 source_key text primary key, sheet_name text not null, facility_code text references public.hp_facilities,
 raw_data jsonb not null, imported_at timestamptz not null default now()
);
create table public.hp_data_quality (
 id uuid primary key default gen_random_uuid(), source_key text unique, facility_code text references public.hp_facilities,
 issue_type text not null, detail text not null, resolved boolean not null default false, updated_at timestamptz not null default now()
);
create table public.hp_audit_logs (
 id uuid primary key default gen_random_uuid(), user_id uuid, table_name text not null, facility_code text,
 operation text not null, old_data jsonb, new_data jsonb, created_at timestamptz not null default now()
);
create index hp_audit_logs_user_idx on public.hp_audit_logs(user_id);
create index hp_audit_logs_facility_idx on public.hp_audit_logs(facility_code);
create function hp_private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare before_row jsonb; after_row jsonb;
begin
 if TG_OP <> 'INSERT' then before_row=to_jsonb(OLD); end if;
 if TG_OP <> 'DELETE' then NEW.updated_at=now(); after_row=to_jsonb(NEW); end if;
 insert into public.hp_audit_logs(user_id,table_name,facility_code,operation,old_data,new_data)
 values(auth.uid(),TG_TABLE_NAME,coalesce(after_row->>'facility_code',before_row->>'facility_code'),TG_OP,before_row,after_row);
 if TG_OP='DELETE' then return OLD; end if; return NEW;
end; $$;
revoke all on function hp_private.audit_change() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['hp_facility_profiles','hp_population','hp_staff','hp_volunteers','hp_budget_monthly','hp_finance_monthly','hp_ncd_monthly','hp_cd_monthly','hp_service_stats','hp_data_quality'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to anon, authenticated',t);
  execute format('grant insert, update, delete on public.%I to authenticated',t);
  execute format('create policy aggregate_read on public.%I for select to anon,authenticated using (true)',t);
  execute format('create policy assigned_insert on public.%I for insert to authenticated with check (hp_private.can_edit(facility_code))',t);
  execute format('create policy assigned_update on public.%I for update to authenticated using (hp_private.can_edit(facility_code)) with check (hp_private.can_edit(facility_code))',t);
  execute format('create policy assigned_delete on public.%I for delete to authenticated using (hp_private.can_edit(facility_code))',t);
  if t <> 'hp_facility_profiles' and t <> 'hp_data_quality' then
   execute format('create index %I on public.%I(facility_code,fiscal_year)',t||'_facility_year_idx',t);
  end if;
  execute format('create trigger audit_change before insert or update or delete on public.%I for each row execute function hp_private.audit_change()',t);
 end loop;
end $$;
alter table public.hp_facilities enable row level security;
revoke all on public.hp_facilities from anon,authenticated;
grant select on public.hp_facilities to anon,authenticated;
grant insert,update,delete on public.hp_facilities to authenticated;
create policy facilities_read on public.hp_facilities for select to anon,authenticated using(true);
create policy facilities_admin on public.hp_facilities for all to authenticated using(hp_private.is_admin()) with check(hp_private.is_admin());
alter table public.hp_user_facilities enable row level security;
revoke all on public.hp_user_facilities from anon,authenticated;
grant select,insert,update,delete on public.hp_user_facilities to authenticated;
create policy permissions_read on public.hp_user_facilities for select to authenticated using(user_id=(select auth.uid()) or hp_private.is_admin());
create policy permissions_admin on public.hp_user_facilities for all to authenticated using(hp_private.is_admin()) with check(hp_private.is_admin());
do $$ declare t text; begin
 foreach t in array array['hp_settings','hp_import_records'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to anon,authenticated',t);
  execute format('grant insert,update,delete on public.%I to authenticated',t);
  execute format('create policy public_read on public.%I for select to anon,authenticated using(true)',t);
  execute format('create policy admin_write on public.%I for all to authenticated using(hp_private.is_admin()) with check(hp_private.is_admin())',t);
 end loop;
end $$;
alter table public.hp_audit_logs enable row level security;
revoke all on public.hp_audit_logs from anon,authenticated;
grant select on public.hp_audit_logs to authenticated;
create policy audit_admin_read on public.hp_audit_logs for select to authenticated using(hp_private.is_admin());
