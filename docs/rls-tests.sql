begin;
-- Reuse real subjects only inside a rolled-back transaction; no test user remains.
select set_config('hp.test_admin',(select id::text from public.profiles where active and role='ADMIN' order by id limit 1),true);
select set_config('hp.test_staff',(select id::text from public.profiles where active and role='ADMIN' order by id offset 1 limit 1),true);
delete from public.hp_user_facilities where user_id=current_setting('hp.test_staff')::uuid;
insert into public.hp_user_facilities(user_id,facility_code,role) values(current_setting('hp.test_staff')::uuid,'06116','STAFF');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('hp.test_staff'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare affected integer; begin
 if not hp_private.can_edit('06116') or hp_private.can_edit('06117') then raise exception 'STAFF permission predicate failed'; end if;
 update public.hp_finance_monthly set amount=amount where facility_code='06116';get diagnostics affected=row_count;
 if affected=0 then raise exception 'STAFF cannot edit assigned facility';end if;
 update public.hp_finance_monthly set amount=amount where facility_code='06117';get diagnostics affected=row_count;
 if affected<>0 then raise exception 'STAFF edited another facility';end if;
 begin
  update public.hp_finance_monthly set facility_code='06117' where facility_code='06116';
  raise exception 'WITH CHECK failed to block reassignment';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.hp_user_facilities(user_id,facility_code,role) values(current_setting('hp.test_staff')::uuid,'06117','ADMIN');
  raise exception 'STAFF escalated to ADMIN';
 exception when insufficient_privilege then null; end;
 perform public.hp_save_profile('06116',2569,'{"population":9049,"male":4206,"female":4843,"households":4287,"communities":16,"staff_count":7,"support_count":6,"volunteer_count":261}');
 begin
  perform public.hp_save_profile('06117',2569,'{}');
  raise exception 'STAFF RPC edited another facility';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('hp.test_admin'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare editable integer; begin
 select count(*) into editable from public.hp_facilities where hp_private.can_edit(facility_code);
 if editable<>8 then raise exception 'ADMIN cannot edit 8 facilities';end if;
 update public.hp_finance_monthly set amount=amount where facility_code='06117';
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$ declare visible integer;begin
 select count(*) into visible from public.hp_facilities;if visible<>8 then raise exception 'Public cannot read facilities';end if;
 begin
  update public.hp_finance_monthly set amount=0;
  raise exception 'PUBLIC edited finance';
 exception when insufficient_privilege then null;end;
 begin
  perform public.hp_save_profile('06116',2569,'{}');
  raise exception 'PUBLIC called profile save';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: STAFF own edit, other denied, reassignment denied, escalation denied, atomic profile RPC, ADMIN 8 units, PUBLIC read-only' as result;
rollback;
