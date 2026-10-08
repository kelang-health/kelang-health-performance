alter table public.hp_unit_public_info add column contact_message text not null default ''
constraint hp_unit_contact_message_length check (char_length(contact_message)<=500);
comment on column public.hp_unit_public_info.contact_message is 'Short public contact introduction and HTTPS social links; one existing row per unit, maximum 500 characters.';
