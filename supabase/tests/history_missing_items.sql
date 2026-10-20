-- Exercise the real protected table; all fixture users, edits and audit entries roll back.
BEGIN;
CREATE TEMP TABLE item_actors(label text,uid uuid,sid uuid);
INSERT INTO item_actors SELECT label,gen_random_uuid(),gen_random_uuid() FROM unnest(ARRAY['staff','admin','monitor','reader']) label;
INSERT INTO auth.users(id,aud,role,email) SELECT uid,'authenticated','authenticated','item-test-'||uid||'@example.invalid' FROM item_actors;
INSERT INTO auth.sessions(id,user_id,created_at,updated_at) SELECT sid,uid,now(),now() FROM item_actors;
INSERT INTO hp_private.session_activity(session_id,user_id) SELECT sid,uid FROM item_actors;
INSERT INTO public.hp_user_facilities(user_id,facility_code,role) SELECT uid,CASE WHEN label='reader' THEN NULL ELSE '06116' END,CASE WHEN label='admin' THEN 'ADMIN' WHEN label IN ('monitor','reader') THEN 'MONITOR' ELSE 'STAFF' END FROM item_actors;
GRANT SELECT ON item_actors TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',(SELECT jsonb_build_object('sub',uid,'session_id',sid,'role','authenticated')::text FROM item_actors WHERE label='admin'),true);
UPDATE public.hp_spending_history SET status='draft',reason='เปิดแก้ใน transaction ทดสอบ',revision=revision+1 WHERE facility_code='06116' AND fiscal_year IN (2568,2569) AND status='confirmed';
SELECT set_config('request.jwt.claims',(SELECT jsonb_build_object('sub',uid,'session_id',sid,'role','authenticated')::text FROM item_actors WHERE label='staff'),true);
DO $$DECLARE r public.hp_spending_history;g jsonb;p jsonb;bad jsonb;n integer;y integer;BEGIN
 FOR y IN 2568..2569 LOOP
 SELECT * INTO STRICT r FROM public.hp_spending_history WHERE facility_code='06116' AND fiscal_year=y;
 -- Preserve original IDs and source, reset amounts only inside this transaction.
 SELECT jsonb_build_object('groups',jsonb_agg(jsonb_set(jsonb_set(jsonb_set(b.value,'{amount}','0'),'{note}','"ตรวจสอบยอดจากหลักฐานแล้ว"'),'{details}',(SELECT coalesce(jsonb_agg(jsonb_set(d,'{amount}','0')),'[]') FROM jsonb_array_elements(b.value->'details') d)))) INTO p FROM jsonb_array_elements(r.payload->'groups') b;
 g:=p->'groups'->0;
 p:=jsonb_set(p,'{groups,0,details}',(g->'details')||jsonb_build_array(jsonb_build_object('id','m_0123456789abcdef01234567','label','รายการที่ตกหล่น <test>','amount',12.50,'commitment',0,'planned',null)));
 p:=jsonb_set(p,'{groups,0,amount}','12.50');
 UPDATE public.hp_spending_history SET payload=p,revision=r.revision+1 WHERE id=r.id;
 SELECT * INTO STRICT r FROM public.hp_spending_history WHERE id=r.id;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r.payload->'groups'->0->'details') d WHERE d->>'id'='m_0123456789abcdef01234567') THEN RAISE EXCEPTION 'Append missing';END IF;
 p:=jsonb_set(r.payload,'{groups,0,details,0,label}','"ชื่อรายการแก้ไขแล้ว"');
 UPDATE public.hp_spending_history SET payload=p,revision=r.revision+1 WHERE id=r.id;
 SELECT * INTO STRICT r FROM public.hp_spending_history WHERE id=r.id;
 bad:=jsonb_set(r.payload,'{groups,0,details}',(r.payload->'groups'->0->'details')-0);
 BEGIN UPDATE public.hp_spending_history SET payload=bad,revision=r.revision+1 WHERE id=r.id;RAISE EXCEPTION 'Existing detail removal accepted';EXCEPTION WHEN check_violation THEN NULL;END;
 bad:=jsonb_set(r.payload,'{groups,0,details}',(r.payload->'groups'->0->'details')||jsonb_build_array(jsonb_build_object('id','forged','label','bad id','amount',0)));
 BEGIN UPDATE public.hp_spending_history SET payload=bad,revision=r.revision+1 WHERE id=r.id;RAISE EXCEPTION 'Forged ID accepted';EXCEPTION WHEN check_violation THEN NULL;END;
 BEGIN UPDATE public.hp_spending_history SET source='{}',revision=r.revision+1 WHERE id=r.id;RAISE EXCEPTION 'Source edit accepted';EXCEPTION WHEN check_violation THEN NULL;END;
 UPDATE public.hp_spending_history SET status='confirmed',coverage_start=make_date(y-544,10,1),coverage_end=make_date(y-543,9,30),review_note='ตรวจสอบและยืนยันข้อมูลทดสอบแล้ว',revision=r.revision+1 WHERE id=r.id;
 SELECT * INTO STRICT r FROM public.hp_spending_history WHERE id=r.id;
 BEGIN UPDATE public.hp_spending_history SET payload=jsonb_set(payload,'{groups,0,amount}','99'),revision=r.revision+1 WHERE id=r.id;RAISE EXCEPTION 'Confirmed edit accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN UPDATE public.hp_spending_history SET status='draft',reason='Staff tries unlock',revision=r.revision+1 WHERE id=r.id;RAISE EXCEPTION 'Staff unlock accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 UPDATE public.hp_spending_history SET revision=revision+1 WHERE facility_code='06117' AND fiscal_year=y;GET DIAGNOSTICS n=ROW_COUNT;IF n<>0 THEN RAISE EXCEPTION 'Cross-unit write accepted';END IF;
 END LOOP;
END$$;
SELECT set_config('request.jwt.claims',(SELECT jsonb_build_object('sub',uid,'session_id',sid,'role','authenticated')::text FROM item_actors WHERE label='admin'),true);
UPDATE public.hp_spending_history SET status='draft',reason='ADMIN ปลดล็อกเพื่อแก้รายการ',revision=revision+1 WHERE facility_code='06116' AND fiscal_year IN (2568,2569);
SELECT set_config('request.jwt.claims',(SELECT jsonb_build_object('sub',uid,'session_id',sid,'role','authenticated')::text FROM item_actors WHERE label='staff'),true);
UPDATE public.hp_spending_history SET review_note='STAFF บันทึกแก้ไขหลัง ADMIN ปลดล็อก',revision=revision+1 WHERE facility_code='06116' AND fiscal_year IN (2568,2569);
RESET ROLE;
DO $$BEGIN IF (SELECT count(*) FROM public.hp_audit_logs a JOIN item_actors t ON t.uid=a.user_id WHERE table_name='hp_spending_history' AND operation='UPDATE')<10 THEN RAISE EXCEPTION 'Audit missing';END IF;END$$;
SELECT 'PASS: FY2568/2569 own append/rename/save/confirm, cross-unit and locked edits blocked, ADMIN unlock, source and audit preserved' as result;
ROLLBACK;
