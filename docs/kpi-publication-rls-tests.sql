begin;
select set_config('hp.test_admin',(select id::text from public.profiles where active and role='ADMIN' order by id limit 1),true);
select set_config('hp.test_staff',(select id::text from public.profiles where active and role='ADMIN' order by id offset 1 limit 1),true);
delete from public.hp_user_facilities where user_id=current_setting('hp.test_staff')::uuid;
insert into public.hp_user_facilities(user_id,facility_code,role) values(current_setting('hp.test_staff')::uuid,'06116','STAFF');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('hp.test_admin'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.hp_settings(setting_key,category,value) values('kpi_publication:2569:__RLS_TEST','kpi_publication','{"mode":"hide"}');
update public.hp_settings set value='{"mode":"show"}' where setting_key='kpi_publication:2569:__RLS_TEST';
do $$ begin
 if not exists(select 1 from public.hp_audit_logs where table_name='hp_settings' and new_data->>'setting_key'='kpi_publication:2569:__RLS_TEST' and operation='UPDATE') then raise exception 'Missing publication audit'; end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('hp.test_staff'),'role','authenticated')::text,true);
do $$ declare affected int; begin
 update public.hp_settings set value='{"mode":"hide"}' where setting_key='kpi_publication:2569:__RLS_TEST';get diagnostics affected=row_count;
 if affected<>0 then raise exception 'STAFF modified KPI publication';end if;
 begin
  insert into public.hp_settings(setting_key,category,value) values('kpi_publication:2569:__STAFF_TEST','kpi_publication','{}');
  raise exception 'STAFF inserted KPI publication';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$ declare affected int;begin
 if not exists(select 1 from public.hp_settings where setting_key='kpi_publication:2569:__RLS_TEST') then raise exception 'Public cannot read publication';end if;
 begin
  update public.hp_settings set value='{"mode":"hide"}' where setting_key='kpi_publication:2569:__RLS_TEST';get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Public modified KPI publication';end if;
 exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
