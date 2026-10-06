alter table public.hp_user_facilities add column updated_at timestamptz not null default now();
create trigger audit_change before insert or update or delete on public.hp_user_facilities
for each row execute function hp_private.audit_change();
create index hp_data_quality_facility_idx on public.hp_data_quality(facility_code);
create index hp_import_records_facility_idx on public.hp_import_records(facility_code);
