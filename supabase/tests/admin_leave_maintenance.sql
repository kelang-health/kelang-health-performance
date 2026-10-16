-- All identities, reports and audit records below are rolled back.
BEGIN;
CREATE TEMP TABLE spending_test_actors(label text,uid uuid,sid uuid);
INSERT INTO spending_test_actors SELECT x,gen_random_uuid(),gen_random_uuid() FROM unnest(ARRAY['admin','staff','other','unassigned']) x;
INSERT INTO auth.users(id,aud,role,email) SELECT uid,'authenticated','authenticated','spending-test-'||uid||'@example.invalid' FROM spending_test_actors;
INSERT INTO auth.sessions(id,user_id,created_at,updated_at) SELECT sid,uid,now(),now() FROM spending_test_actors;
INSERT INTO hp_private.session_activity(session_id,user_id) SELECT sid,uid FROM spending_test_actors;
INSERT INTO public.hp_user_facilities(user_id,facility_code,role) SELECT uid,CASE WHEN label='other' THEN '06117' ELSE '06116' END,CASE WHEN label='admin' THEN 'ADMIN' ELSE 'STAFF' END FROM spending_test_actors WHERE label<>'unassigned';
CREATE TEMP TABLE spending_test_results(name text);
GRANT SELECT ON spending_test_actors TO authenticated;
GRANT ALL ON spending_test_results TO authenticated;

CREATE TEMP TABLE leave_test_person AS SELECT id,facility_code FROM public.hp_personnel WHERE active AND facility_code='06116' LIMIT 1;
GRANT SELECT ON leave_test_person TO authenticated;
INSERT INTO public.hp_work_calendars(facility_code,month_start) VALUES('06116','2099-10-01');
UPDATE public.hp_work_calendars SET verified=true,revision=2 WHERE facility_code='06116' AND month_start='2099-10-01';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',(SELECT jsonb_build_object('sub',uid,'session_id',sid,'role','authenticated')::text FROM spending_test_actors WHERE label='staff'),true);
INSERT INTO public.hp_leave_requests(personnel_id,facility_code,fiscal_year,leave_type,date_from,date_to,details,source_key)
SELECT id,facility_code,2643,'SICK','2099-10-01','2099-10-01','{"note":"test","submission_channel":"paper"}','admin-maintenance-rollback' FROM leave_test_person;
SELECT set_config('request.jwt.claims',(SELECT jsonb_build_object('sub',uid,'session_id',sid,'role','authenticated')::text FROM spending_test_actors WHERE label='admin'),true);
UPDATE public.hp_leave_requests SET status='approved',details=details||'{"approval_reference":"TEST","approved_by_name":"Test","approval_date":"2099-10-01"}',revision=2 WHERE source_key='admin-maintenance-rollback';
UPDATE public.hp_leave_requests SET details=details||'{"note":"admin corrected approved record"}',revision=3 WHERE source_key='admin-maintenance-rollback';
DO $$DECLARE n int;BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.hp_leave_requests WHERE source_key='admin-maintenance-rollback' AND status='approved' AND revision=3) THEN RAISE EXCEPTION 'ADMIN approved edit failed';END IF;
 DELETE FROM public.hp_leave_requests WHERE source_key='admin-maintenance-rollback';GET DIAGNOSTICS n=ROW_COUNT;IF n<>0 THEN RAISE EXCEPTION 'ADMIN deleted approved leave';END IF;
 INSERT INTO spending_test_results VALUES('ADMIN edits approved record; cannot delete before cancellation');
END$$;
UPDATE public.hp_leave_requests SET status='cancelled',revision=4 WHERE source_key='admin-maintenance-rollback';
UPDATE public.hp_leave_requests SET details=details||'{"note":"admin corrected cancellation"}',revision=5 WHERE source_key='admin-maintenance-rollback';
SELECT set_config('request.jwt.claims',(SELECT jsonb_build_object('sub',uid,'session_id',sid,'role','authenticated')::text FROM spending_test_actors WHERE label='staff'),true);
DO $$DECLARE n int;BEGIN
 BEGIN UPDATE public.hp_leave_requests SET details=details||'{"note":"staff closed edit"}',revision=6 WHERE source_key='admin-maintenance-rollback';RAISE EXCEPTION 'Staff changed closed leave';EXCEPTION WHEN check_violation THEN NULL;END;
 DELETE FROM public.hp_leave_requests WHERE source_key='admin-maintenance-rollback';GET DIAGNOSTICS n=ROW_COUNT;IF n<>0 THEN RAISE EXCEPTION 'Staff deleted cancelled leave';END IF;
 INSERT INTO spending_test_results VALUES('STAFF cannot edit closed or delete cancelled leave');
END$$;
SELECT set_config('request.jwt.claims',(SELECT jsonb_build_object('sub',uid,'session_id',sid,'role','authenticated')::text FROM spending_test_actors WHERE label='admin'),true);
DO $$DECLARE n int;BEGIN
 DELETE FROM public.hp_leave_requests WHERE source_key='admin-maintenance-rollback' AND revision=4;GET DIAGNOSTICS n=ROW_COUNT;IF n<>0 THEN RAISE EXCEPTION 'Stale revision deleted';END IF;
 DELETE FROM public.hp_leave_requests WHERE source_key='admin-maintenance-rollback' AND revision=5 AND status='cancelled';GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'ADMIN cancelled delete failed';END IF;
 INSERT INTO spending_test_results VALUES('revision condition prevents stale deletion; ADMIN deletes cancelled leave');
END$$;
RESET ROLE;
DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM public.hp_audit_logs WHERE table_name='hp_leave_requests' AND operation='DELETE' AND old_data->>'source_key'='admin-maintenance-rollback' AND old_data->>'status'='cancelled') THEN RAISE EXCEPTION 'Deletion audit missing';END IF;END$$;
INSERT INTO spending_test_results VALUES('old cancelled record preserved in audit');
SELECT jsonb_agg(name) passed FROM spending_test_results;
ROLLBACK;
