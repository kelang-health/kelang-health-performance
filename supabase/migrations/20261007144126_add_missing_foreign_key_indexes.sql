SET lock_timeout='5s';
CREATE INDEX IF NOT EXISTS free_fk_01_satisfaction_responses ON "line_hub"."satisfaction_responses" (instrument_version);
CREATE INDEX IF NOT EXISTS free_fk_02_hp_unit_public_info ON "public"."hp_unit_public_info" (reviewed_by);
