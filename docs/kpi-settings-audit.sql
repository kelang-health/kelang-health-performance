-- Uses existing ADMIN-only settings policies; no HDC dataset is stored here.
create trigger hp_settings_audit before insert or update or delete on public.hp_settings
for each row execute function hp_private.audit_change();
