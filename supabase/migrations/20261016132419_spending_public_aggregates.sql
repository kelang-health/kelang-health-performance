-- Public reporting tables contain only approved plan totals / confirmed monthly totals.
-- Detailed plans, draft amounts and staff notes remain in the private source table.
CREATE FUNCTION hp_private.publish_spending_totals() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE amount numeric; dt date; provenance jsonb;
BEGIN
 IF new.fiscal_year<2570 THEN RETURN new;END IF;
 IF auth.uid() IS NOT NULL AND NOT hp_private.spending_manager(new.facility_code) THEN RAISE EXCEPTION 'Spending permission denied' USING ERRCODE='42501';END IF;
 provenance:=jsonb_build_object('source','spending_tracker','report_id',new.id,'revision',new.revision);
 IF new.period=0 THEN
  INSERT INTO public.hp_budget_monthly(source_key,facility_code,fiscal_year,period,kind,amount,review_status,raw_data)
  VALUES('spending-plan-'||new.id,new.facility_code,new.fiscal_year,NULL,'annual_plan',(new.payload->>'annual')::numeric,'accepted',provenance)
  ON CONFLICT(source_key) DO UPDATE SET amount=excluded.amount,review_status='accepted',raw_data=excluded.raw_data;
 ELSIF new.status='confirmed' THEN
  SELECT coalesce(sum(value::text::numeric),0) INTO amount FROM jsonb_each(new.payload->'amounts');
  dt:=make_date(new.fiscal_year-CASE WHEN new.period>=10 THEN 544 ELSE 543 END,new.period,1);
  INSERT INTO public.hp_finance_monthly(source_key,facility_code,fiscal_year,period,amount,review_status,raw_data)
  VALUES('spending-month-'||new.id,new.facility_code,new.fiscal_year,dt,amount,'accepted',provenance)
  ON CONFLICT(source_key) DO UPDATE SET amount=excluded.amount,review_status='accepted',raw_data=excluded.raw_data;
 ELSE
  UPDATE public.hp_finance_monthly SET review_status=CASE WHEN new.status='deleted' THEN 'rejected' ELSE 'pending' END,raw_data=provenance
  WHERE source_key='spending-month-'||new.id;
 END IF;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION hp_private.publish_spending_totals() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER spending_public_totals AFTER INSERT OR UPDATE ON public.hp_spending_reports FOR EACH ROW EXECUTE FUNCTION hp_private.publish_spending_totals();

CREATE FUNCTION public.hp_derived_finance_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF current_user NOT IN ('postgres','service_role','supabase_admin') AND
 ((TG_OP<>'INSERT' AND old.fiscal_year>=2570) OR (TG_OP<>'DELETE' AND new.fiscal_year>=2570)) THEN
  RAISE EXCEPTION 'ปี 2570 เป็นต้นไป กรุณาบันทึกผ่านติดตามแผนใช้เงิน ยอดรวมในหน้านี้คำนวณอัตโนมัติ' USING ERRCODE='42501';
 END IF;
 IF TG_OP='DELETE' THEN RETURN old;END IF;RETURN new;
END $$;
REVOKE ALL ON FUNCTION public.hp_derived_finance_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER derived_budget_guard BEFORE INSERT OR UPDATE OR DELETE ON public.hp_budget_monthly FOR EACH ROW EXECUTE FUNCTION public.hp_derived_finance_guard();
CREATE TRIGGER derived_finance_guard BEFORE INSERT OR UPDATE OR DELETE ON public.hp_finance_monthly FOR EACH ROW EXECUTE FUNCTION public.hp_derived_finance_guard();

INSERT INTO public.hp_budget_monthly(source_key,facility_code,fiscal_year,period,kind,amount,review_status,raw_data)
SELECT 'spending-plan-'||id,facility_code,fiscal_year,NULL,'annual_plan',(payload->>'annual')::numeric,'accepted',jsonb_build_object('source','spending_tracker','report_id',id,'revision',revision)
FROM public.hp_spending_reports WHERE period=0 AND fiscal_year>=2570
ON CONFLICT(source_key) DO UPDATE SET amount=excluded.amount,review_status='accepted',raw_data=excluded.raw_data;
INSERT INTO public.hp_finance_monthly(source_key,facility_code,fiscal_year,period,amount,review_status,raw_data)
SELECT 'spending-month-'||r.id,r.facility_code,r.fiscal_year,make_date(r.fiscal_year-CASE WHEN r.period>=10 THEN 544 ELSE 543 END,r.period,1),
 (SELECT coalesce(sum(value::text::numeric),0) FROM jsonb_each(r.payload->'amounts')),'accepted',jsonb_build_object('source','spending_tracker','report_id',r.id,'revision',r.revision)
FROM public.hp_spending_reports r WHERE r.period>0 AND r.fiscal_year>=2570 AND r.status='confirmed'
ON CONFLICT(source_key) DO UPDATE SET amount=excluded.amount,review_status='accepted',raw_data=excluded.raw_data;
