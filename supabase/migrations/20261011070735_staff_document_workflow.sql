-- Existing document rows stay drafts. No new tables or paid services.
ALTER TABLE public.hp_staff_documents
 ADD COLUMN revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
 ADD COLUMN preview_opened_at timestamptz,
 ADD COLUMN confirmed_at timestamptz,
 ADD COLUMN confirmed_by uuid,
 ADD COLUMN render_version text,
 ADD COLUMN issue_history jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(issue_history)='array' AND jsonb_array_length(issue_history)<=10),
 ADD COLUMN issue_count integer GENERATED ALWAYS AS (jsonb_array_length(issue_history)) STORED;
CREATE OR REPLACE FUNCTION public.hp_staff_documents_guard_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare k text; v jsonb; allowed text[]; p record; history_row jsonb; history_key text; history_value jsonb;
begin
 if TG_OP='UPDATE' and (to_jsonb(new)-array['preview_opened_at','printed_at','updated_at'])=(to_jsonb(old)-array['preview_opened_at','printed_at','updated_at']) then new.updated_at:=old.updated_at; return new; end if;
 if TG_OP='UPDATE' and (new.owner_user_id is distinct from old.owner_user_id or new.personnel_id is distinct from old.personnel_id or new.facility_code is distinct from old.facility_code or new.form_code is distinct from old.form_code) then raise exception 'Document identity is immutable' using errcode='42501'; end if;
 allowed:=array['applicant_first_name','applicant_last_name','service_as_of','full_name','position_name','position_level','employment_type','facility_name','request_date','monthly_rate','note','compensation_category','work_date_from','work_date_to','bureau','unit_moo','unit_subdistrict','unit_district','unit_province','level_name','service_years','service_months','service_days'];
 if new.form_code='chor11_annual' then allowed:=allowed||array['written_at','service_years','service_months','service_days','license_type','license_number','contact_address','address_no','road','address_subdistrict','address_district','address_province','postcode','license_other','license_issue_date','no_professional_license','duration_years','duration_months','duration_hours','total_amount','amount_in_words'];
 else allowed:=allowed||array['training_status','training_years','training_months','training_regional_selected','training_regional_facility','training_regional_province','training_regional_from_date','training_regional_to_date','training_district_selected','training_district_facility','training_district_province','training_district_from_date','training_district_to_date','period_month','work_days','leave_days','total_amount','service_history','history_print_names','calendar_work_days','certificate_verified','head_name','head_position','director_name','director_position']; end if;
 for k,v in select * from jsonb_each(new.form_data) loop
  if not(k=any(allowed)) or jsonb_typeof(v) not in ('string','number') then raise exception 'Unsupported document field: %',k using errcode='23514'; end if;
  if k=any(array['training_status','training_years','training_months','training_regional_selected','training_district_selected','monthly_rate','total_amount','work_days','leave_days','service_years','service_months','service_days','calendar_work_days','certificate_verified','no_professional_license','duration_years','duration_months','duration_hours']) and (jsonb_typeof(v)<>'number' or v::text::numeric<0) then raise exception 'Invalid numeric field: %',k using errcode='23514'; end if;
  if jsonb_typeof(v)='string' and length(v#>>'{}')>(case when k='service_history' then 10000 else 1000 end) then raise exception 'Document field too long' using errcode='23514'; end if;
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
 if new.form_code='chor11_monthly' then
  if (coalesce(new.form_data->>'service_as_of','')<>'' and (new.form_data->>'service_as_of')::date<>(date_trunc('month',new.period_month)+interval '1 month - 1 day')::date) or ((new.form_data?'service_years' or new.form_data?'service_months' or new.form_data?'service_days' or (new.form_data?'service_history' and jsonb_array_length((new.form_data->>'service_history')::jsonb)>0)) and coalesce(new.form_data->>'service_as_of','')='') then raise exception 'Service snapshot must match the billing month end' using errcode='23514'; end if;
  if coalesce(new.form_data->>'work_date_to','')<>'' and (new.form_data->>'work_date_to')::date<>(date_trunc('month',new.period_month)+interval '1 month - 1 day')::date then raise exception 'Work cutoff must match billing month end' using errcode='23514'; end if;
  if coalesce(new.form_data->>'work_date_from','')<>'' and (new.form_data->>'work_date_from')::date>(date_trunc('month',new.period_month)+interval '1 month - 1 day')::date then raise exception 'Work starts after billing month' using errcode='23514'; end if;
  if new.form_data?'service_history' then
   for history_row in select value from jsonb_array_elements((new.form_data->>'service_history')::jsonb) loop
    if (coalesce(history_row->>'start_date','')<>'' and (history_row->>'start_date')::date>(date_trunc('month',new.period_month)+interval '1 month - 1 day')::date) or (coalesce(history_row->>'end_date','')<>'' and (history_row->>'end_date')::date>(date_trunc('month',new.period_month)+interval '1 month - 1 day')::date) or (coalesce(history_row->>'start_date','')<>'' and coalesce(history_row->>'end_date','')<>'' and (history_row->>'start_date')::date>(history_row->>'end_date')::date) then raise exception 'History dates do not match billing period' using errcode='23514'; end if;
   end loop;
  end if;
  if new.form_data?'history_print_names' then
   if jsonb_typeof((new.form_data->>'history_print_names')::jsonb)<>'array' or jsonb_array_length((new.form_data->>'history_print_names')::jsonb)>12 or jsonb_array_length((new.form_data->>'history_print_names')::jsonb)>jsonb_array_length(coalesce(nullif(new.form_data->>'service_history',''),'[]')::jsonb) then raise exception 'Invalid history print names' using errcode='23514'; end if;
   for history_value in select value from jsonb_array_elements((new.form_data->>'history_print_names')::jsonb) loop
    if jsonb_typeof(history_value)<>'string' or length(history_value#>>'{}')>60 then raise exception 'Invalid history print name' using errcode='23514'; end if;
   end loop;
  end if;
 end if;
 if TG_OP='UPDATE' and old.status='ready' and new.status='ready' then new.updated_at:=old.updated_at; return new; end if;
 select x.full_name,x.position_name,x.position_level,x.employment_type,coalesce(f.facility_name,x.facility_code) facility_name into p from public.hp_personnel x left join public.hp_facilities f on f.facility_code=x.facility_code where x.id=new.personnel_id and x.facility_code=new.facility_code;
 if not found then raise exception 'Personnel identity unavailable' using errcode='42501'; end if;
 new.form_data:=new.form_data||jsonb_build_object('full_name',p.full_name,'position_name',coalesce(p.position_name,''),'position_level',coalesce(p.position_level,''),'employment_type',coalesce(p.employment_type,''),'facility_name',p.facility_name,'compensation_category','LUMP_SUM_ALLOWANCE');
 new.updated_at:=now(); return new;
end $function$;

CREATE OR REPLACE FUNCTION public.hp_staff_document_workflow_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE changed boolean; f jsonb; k text; required text[]; h jsonb; is_manager boolean;
BEGIN
 IF TG_OP='DELETE' THEN
  IF old.issue_count>0 THEN RAISE EXCEPTION 'Confirmed document history cannot be deleted' USING ERRCODE='23514'; END IF;
  RETURN old;
 END IF;
 IF TG_OP='INSERT' THEN
  IF new.revision<>1 OR new.issue_history<>'[]'::jsonb THEN RAISE EXCEPTION 'Invalid initial document revision' USING ERRCODE='23514'; END IF;
 ELSE
  IF new.issue_history IS DISTINCT FROM old.issue_history THEN RAISE EXCEPTION 'Issued history is immutable' USING ERRCODE='42501'; END IF;
  changed:=new.form_data IS DISTINCT FROM old.form_data OR new.status IS DISTINCT FROM old.status OR new.fiscal_year IS DISTINCT FROM old.fiscal_year OR new.period_month IS DISTINCT FROM old.period_month OR new.template_version IS DISTINCT FROM old.template_version;
  IF (changed AND new.revision<>old.revision+1) OR (NOT changed AND new.revision NOT IN (old.revision,old.revision+1)) THEN RAISE EXCEPTION 'Document revision conflict: reload before saving' USING ERRCODE='40001'; END IF;
  IF old.status='ready' AND new.status='ready' AND changed THEN RAISE EXCEPTION 'Save a new draft before confirming changed content' USING ERRCODE='23514'; END IF;
  IF old.status='ready' AND new.status='ready' THEN
   new.confirmed_at:=old.confirmed_at;new.confirmed_by:=old.confirmed_by;new.render_version:=old.render_version;RETURN new;
  END IF;
 END IF;
 new.confirmed_at:=NULL;new.confirmed_by:=NULL;new.render_version:=NULL;
 IF new.status<>'ready' THEN RETURN new; END IF;
 SELECT EXISTS(SELECT 1 FROM public.hp_user_facilities u WHERE u.user_id=auth.uid() AND (u.role='ADMIN' OR (u.role='STAFF' AND u.facility_code=new.facility_code))) INTO is_manager;
 IF NOT is_manager THEN RAISE EXCEPTION 'Only ADMIN or unit STAFF may confirm documents' USING ERRCODE='42501'; END IF;
 f:=new.form_data;
 required:=ARRAY['full_name','position_name','facility_name','request_date','work_date_from','work_date_to','monthly_rate','total_amount','service_as_of','service_years','service_months','service_days','unit_province','level_name'];
 IF new.form_code='chor11_monthly' THEN
  required:=required||ARRAY['applicant_first_name','applicant_last_name','calendar_work_days','work_days','leave_days','head_name','head_position','director_name','director_position'];
  IF coalesce(f->>'certificate_verified','0')<>'1' THEN RAISE EXCEPTION 'Working days need verification' USING ERRCODE='23514'; END IF;
  IF f->>'position_name' ~ '^(นายแพทย์|แพทย์หญิง|แพทย์(?!แผนไทย|แผนจีน)|น\.?พ\.|พ\.?ญ\.)' AND coalesce(f->>'training_status','0') NOT IN ('1','2') THEN RAISE EXCEPTION 'Doctor training needs verification' USING ERRCODE='23514'; END IF;
  IF jsonb_array_length(coalesce(nullif(f->>'service_history',''),'[]')::jsonb)=0 THEN RAISE EXCEPTION 'Service history required' USING ERRCODE='23514'; END IF;
  FOR h IN SELECT value FROM jsonb_array_elements((f->>'service_history')::jsonb) LOOP
   FOREACH k IN ARRAY ARRAY['facility_name','province','level_name','start_date','end_date','duration_years','duration_months','duration_days'] LOOP
    IF coalesce(btrim(h->>k),'')='' THEN RAISE EXCEPTION 'Incomplete service history: %',k USING ERRCODE='23514'; END IF;
   END LOOP;
  END LOOP;
 ELSE
  required:=required||ARRAY['written_at','bureau','unit_moo','unit_subdistrict','unit_district','address_no','address_subdistrict','address_district','address_province','postcode','duration_years','duration_months','duration_hours','amount_in_words'];
  IF coalesce(f->>'no_professional_license','0')<>'1' THEN required:=required||ARRAY['license_type','license_number','license_issue_date']; END IF;
 END IF;
 FOREACH k IN ARRAY required LOOP
  IF coalesce(btrim(f->>k),'')='' THEN RAISE EXCEPTION 'Required ready field: %',k USING ERRCODE='23514'; END IF;
 END LOOP;
 IF jsonb_array_length(new.issue_history)>=10 THEN RAISE EXCEPTION 'Maximum 10 confirmed copies; contact administrator to archive' USING ERRCODE='23514'; END IF;
 new.confirmed_at:=now();new.confirmed_by:=auth.uid();new.render_version:='1.74';
 new.issue_history:=new.issue_history||jsonb_build_array(jsonb_build_object('form_code',new.form_code,'template_version',new.template_version,'fiscal_year',new.fiscal_year,'period_month',new.period_month,'form_data',new.form_data,'revision',new.revision,'render_version',new.render_version,'confirmed_at',new.confirmed_at,'confirmed_by',new.confirmed_by));
 RETURN new;
END $$;
CREATE TRIGGER zz_hp_staff_document_workflow BEFORE INSERT OR UPDATE OR DELETE ON public.hp_staff_documents FOR EACH ROW EXECUTE FUNCTION public.hp_staff_document_workflow_guard();
