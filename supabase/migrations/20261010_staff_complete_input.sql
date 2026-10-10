create or replace function public.hp_staff_documents_guard_identity() returns trigger language plpgsql set search_path='' as $$
declare k text; v jsonb; allowed text[]; p record; history_row jsonb; history_key text; history_value jsonb;
begin
 if TG_OP='UPDATE' and (new.owner_user_id is distinct from old.owner_user_id or new.personnel_id is distinct from old.personnel_id or new.facility_code is distinct from old.facility_code or new.form_code is distinct from old.form_code) then raise exception 'Document identity is immutable' using errcode='42501'; end if;
 allowed:=array['applicant_first_name','applicant_last_name','service_as_of','full_name','position_name','position_level','employment_type','facility_name','request_date','monthly_rate','note','compensation_category','work_date_from','work_date_to','bureau','unit_moo','unit_subdistrict','unit_district','unit_province','level_name','service_years','service_months','service_days'];
 if new.form_code='chor11_annual' then allowed:=allowed||array['written_at','service_years','service_months','service_days','license_type','license_number','contact_address','address_no','road','address_subdistrict','address_district','address_province','postcode','license_other','license_issue_date','no_professional_license','duration_years','duration_months','duration_hours','total_amount','amount_in_words'];
 else allowed:=allowed||array['training_status','training_years','training_months','training_regional_selected','training_regional_facility','training_regional_province','training_regional_from_date','training_regional_to_date','training_district_selected','training_district_facility','training_district_province','training_district_from_date','training_district_to_date','period_month','work_days','leave_days','total_amount','service_history','calendar_work_days','certificate_verified','head_name','head_position','director_name','director_position']; end if;
 for k,v in select * from jsonb_each(new.form_data) loop
  if not(k=any(allowed)) or jsonb_typeof(v) not in ('string','number') then raise exception 'Unsupported document field: %',k using errcode='23514'; end if;
  if k=any(array['training_status','training_years','training_months','training_regional_selected','training_district_selected','monthly_rate','total_amount','work_days','leave_days','service_years','service_months','service_days','calendar_work_days','certificate_verified','no_professional_license','duration_years','duration_months','duration_hours']) and (jsonb_typeof(v)<>'number' or v::text::numeric<0) then raise exception 'Invalid numeric field: %',k using errcode='23514'; end if;
  if jsonb_typeof(v)='string' and length(v#>>'{}')>1000 then raise exception 'Document field too long' using errcode='23514'; end if;
 end loop;
 if new.status='ready' and (coalesce(new.form_data->>'request_date','')='' or not(new.form_data?'monthly_rate') or (new.form_code='chor11_monthly' and not(new.form_data?'total_amount'))) then raise exception 'Required document fields missing' using errcode='23514'; end if;
 if coalesce(new.form_data->>'request_date','')<>'' then perform (new.form_data->>'request_date')::date; end if;
 if coalesce(new.form_data->>'work_date_from','')<>'' then perform (new.form_data->>'work_date_from')::date; end if;
 if coalesce(new.form_data->>'work_date_to','')<>'' then perform (new.form_data->>'work_date_to')::date; end if;
 if coalesce(new.form_data->>'work_date_from','')<>'' and coalesce(new.form_data->>'work_date_to','')<>'' and (new.form_data->>'work_date_from')::date>(new.form_data->>'work_date_to')::date then raise exception 'Invalid work period' using errcode='23514'; end if;
 if coalesce(new.form_data->>'service_months','0')::numeric>11 or coalesce(new.form_data->>'service_days','0')::numeric>31 or coalesce(new.form_data->>'service_years','0')::numeric>60 or coalesce(new.form_data->>'work_days','0')::numeric>31 or coalesce(new.form_data->>'leave_days','0')::numeric>31 then raise exception 'Invalid duration' using errcode='23514'; end if;
 if new.form_code='chor11_monthly' and new.form_data?'period_month' and new.form_data->>'period_month'<>new.period_month::text then raise exception 'Period does not match document' using errcode='23514'; end if;

 if new.form_data?'service_history' and (jsonb_typeof((new.form_data->>'service_history')::jsonb)<>'array' or jsonb_array_length((new.form_data->>'service_history')::jsonb)>12) then raise exception 'Invalid service history' using errcode='23514'; end if;
 if new.form_data?'service_history' then
  for history_row in select value from jsonb_array_elements((new.form_data->>'service_history')::jsonb) loop
   if jsonb_typeof(history_row)<>'object' then raise exception 'Invalid history row' using errcode='23514'; end if;
   for history_key,history_value in select * from jsonb_each(history_row) loop
    if not(history_key=any(array['facility_name','province','level_name','start_date','end_date','duration_years','duration_months','duration_days'])) or jsonb_typeof(history_value) not in ('string','number') then raise exception 'Unsupported history field' using errcode='23514'; end if;
    if history_key like 'duration_%' and (jsonb_typeof(history_value)<>'number' or history_value::text::numeric<0 or history_value::text::numeric>60) then raise exception 'Invalid history duration' using errcode='23514'; end if;
    if history_key in ('start_date','end_date') and coalesce(history_value#>>'{}','')<>'' then perform (history_value#>>'{}')::date; end if;
   end loop;
  end loop;
 end if;
 if coalesce(new.form_data->>'certificate_verified','0')::numeric not in (0,1) or coalesce(new.form_data->>'no_professional_license','0')::numeric not in (0,1) or coalesce(new.form_data->>'calendar_work_days','0')::numeric>31 then raise exception 'Invalid certificate field' using errcode='23514'; end if;
 if coalesce(new.form_data->>'certificate_verified','0')::numeric=1 and (not(new.form_data?'calendar_work_days') or not(new.form_data?'work_days') or not(new.form_data?'leave_days') or (new.form_data->>'work_days')::numeric+(new.form_data->>'leave_days')::numeric>(new.form_data->>'calendar_work_days')::numeric) then raise exception 'Certificate days require verification' using errcode='23514'; end if;
 if coalesce(new.form_data->>'license_issue_date','')<>'' then perform (new.form_data->>'license_issue_date')::date; end if;

 if coalesce(new.form_data->>'training_status','0')::numeric not in (0,1,2) or coalesce(new.form_data->>'training_regional_selected','0')::numeric not in (0,1) or coalesce(new.form_data->>'training_district_selected','0')::numeric not in (0,1) or coalesce(new.form_data->>'training_months','0')::numeric>11 then raise exception 'Invalid training field' using errcode='23514'; end if;
 foreach k in array array['service_as_of','training_regional_from_date','training_regional_to_date','training_district_from_date','training_district_to_date'] loop
  if coalesce(new.form_data->>k,'')<>'' then perform (new.form_data->>k)::date; end if;
 end loop;
 if coalesce(new.form_data->>'service_as_of','')<>'' and (new.form_data->>'service_as_of')::date <> (date_trunc('month',(new.form_data->>'service_as_of')::date)+interval '1 month - 1 day')::date then raise exception 'Service cutoff must be month end' using errcode='23514'; end if;
 foreach k in array array['regional','district'] loop
  if coalesce(new.form_data->>('training_'||k||'_from_date'),'')<>'' and coalesce(new.form_data->>('training_'||k||'_to_date'),'')<>'' and (new.form_data->>('training_'||k||'_from_date'))::date>(new.form_data->>('training_'||k||'_to_date'))::date then raise exception 'Invalid training period' using errcode='23514'; end if;
 end loop;
 select x.full_name,x.position_name,x.position_level,x.employment_type,coalesce(f.facility_name,x.facility_code) facility_name into p from public.hp_personnel x left join public.hp_facilities f on f.facility_code=x.facility_code where x.id=new.personnel_id and x.facility_code=new.facility_code;
 if not found then raise exception 'Personnel identity unavailable' using errcode='42501'; end if;
 new.form_data:=new.form_data||jsonb_build_object('full_name',p.full_name,'position_name',coalesce(p.position_name,''),'position_level',coalesce(p.position_level,''),'employment_type',coalesce(p.employment_type,''),'facility_name',p.facility_name,'compensation_category','LUMP_SUM_ALLOWANCE');
 new.updated_at:=now(); return new;
end $$;
