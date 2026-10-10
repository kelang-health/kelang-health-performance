-- Keep existing personnel unique indexes: one form per subject and period.
drop index public.hp_staff_documents_annual_uq;
drop index public.hp_staff_documents_monthly_uq;
