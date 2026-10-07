create unique index hp_staff_documents_person_annual_unique on public.hp_staff_documents(personnel_id,fiscal_year) where form_code='chor11_annual';
create unique index hp_staff_documents_person_monthly_unique on public.hp_staff_documents(personnel_id,period_month) where form_code='chor11_monthly';
alter table public.hp_staff_documents add constraint hp_staff_documents_template_version_check check(template_version='2569.1');
drop policy hp_staff_documents_delete on public.hp_staff_documents;
create policy hp_staff_documents_delete on public.hp_staff_documents for delete to authenticated using ((select auth.uid())=owner_user_id and form_code='chor11_annual');
create or replace function public.hp_staff_documents_guard_identity() returns trigger language plpgsql set search_path='' as $$
declare k text; v jsonb; allowed text[]; p record;
begin
 if TG_OP='UPDATE' and (new.owner_user_id is distinct from old.owner_user_id or new.personnel_id is distinct from old.personnel_id or new.facility_code is distinct from old.facility_code or new.form_code is distinct from old.form_code) then raise exception 'Document identity is immutable' using errcode='42501'; end if;
 allowed:=array['full_name','position_name','position_level','employment_type','facility_name','request_date','monthly_rate','note','compensation_category','work_date_from','work_date_to'];
 if new.form_code='chor11_annual' then allowed:=allowed||array['written_at','service_years','service_months','service_days','license_type','license_number','contact_address'];
 else allowed:=allowed||array['period_month','work_days','leave_days','total_amount']; end if;
 for k,v in select * from jsonb_each(new.form_data) loop
  if not(k=any(allowed)) or jsonb_typeof(v) not in ('string','number') then raise exception 'Unsupported document field: %',k using errcode='23514'; end if;
  if k=any(array['monthly_rate','total_amount','work_days','leave_days','service_years','service_months','service_days']) and (jsonb_typeof(v)<>'number' or v::text::numeric<0) then raise exception 'Invalid numeric field: %',k using errcode='23514'; end if;
  if jsonb_typeof(v)='string' and length(v#>>'{}')>1000 then raise exception 'Document field too long' using errcode='23514'; end if;
 end loop;
 if new.status='ready' and (coalesce(new.form_data->>'request_date','')='' or not(new.form_data?'monthly_rate') or (new.form_code='chor11_monthly' and not(new.form_data?'total_amount'))) then raise exception 'Required document fields missing' using errcode='23514'; end if;
 if coalesce(new.form_data->>'request_date','')<>'' then perform (new.form_data->>'request_date')::date; end if;
 if coalesce(new.form_data->>'work_date_from','')<>'' then perform (new.form_data->>'work_date_from')::date; end if;
 if coalesce(new.form_data->>'work_date_to','')<>'' then perform (new.form_data->>'work_date_to')::date; end if;
 if coalesce(new.form_data->>'work_date_from','')<>'' and coalesce(new.form_data->>'work_date_to','')<>'' and (new.form_data->>'work_date_from')::date>(new.form_data->>'work_date_to')::date then raise exception 'Invalid work period' using errcode='23514'; end if;
 if coalesce(new.form_data->>'service_months','0')::numeric>11 or coalesce(new.form_data->>'service_days','0')::numeric>31 or coalesce(new.form_data->>'service_years','0')::numeric>60 or coalesce(new.form_data->>'work_days','0')::numeric>31 or coalesce(new.form_data->>'leave_days','0')::numeric>31 then raise exception 'Invalid duration' using errcode='23514'; end if;
 if new.form_code='chor11_monthly' and new.form_data?'period_month' and new.form_data->>'period_month'<>new.period_month::text then raise exception 'Period does not match document' using errcode='23514'; end if;
 select x.full_name,x.position_name,x.position_level,x.employment_type,coalesce(f.facility_name,x.facility_code) facility_name into p from public.hp_personnel x left join public.hp_facilities f on f.facility_code=x.facility_code where x.id=new.personnel_id and x.facility_code=new.facility_code;
 if not found then raise exception 'Personnel identity unavailable' using errcode='42501'; end if;
 new.form_data:=new.form_data||jsonb_build_object('full_name',p.full_name,'position_name',coalesce(p.position_name,''),'position_level',coalesce(p.position_level,''),'employment_type',coalesce(p.employment_type,''),'facility_name',p.facility_name,'compensation_category','LUMP_SUM_ALLOWANCE');
 new.updated_at:=now(); return new;
end $$;
drop trigger hp_staff_documents_guard_identity_trigger on public.hp_staff_documents;
create trigger hp_staff_documents_guard_identity_trigger before insert or update on public.hp_staff_documents for each row execute function public.hp_staff_documents_guard_identity();
