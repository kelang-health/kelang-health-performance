create function public.hp_save_profile(code text, year integer, fields jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if not hp_private.can_edit(code) then raise exception 'ไม่ได้รับสิทธิ์แก้ไขหน่วยบริการนี้' using errcode='42501'; end if;
 insert into public.hp_facility_profiles(facility_code,address,notes,source_updated_at)
 values(code,fields->>'address',fields->>'notes',now())
 on conflict(facility_code) do update set address=excluded.address,notes=excluded.notes,source_updated_at=excluded.source_updated_at;
 insert into public.hp_population(facility_code,fiscal_year,population,male,female,households,communities,source_updated_at)
 values(code,year,(fields->>'population')::integer,(fields->>'male')::integer,(fields->>'female')::integer,(fields->>'households')::integer,(fields->>'communities')::integer,now())
 on conflict(facility_code,fiscal_year) do update set population=excluded.population,male=excluded.male,female=excluded.female,households=excluded.households,communities=excluded.communities,source_updated_at=excluded.source_updated_at;
 insert into public.hp_staff(facility_code,fiscal_year,profession,staff_count,support_count)
 values(code,year,'รวมบุคลากร',(fields->>'staff_count')::integer,(fields->>'support_count')::integer)
 on conflict(facility_code,fiscal_year,profession) do update set staff_count=excluded.staff_count,support_count=excluded.support_count;
 insert into public.hp_volunteers(facility_code,fiscal_year,volunteer_count)
 values(code,year,(fields->>'volunteer_count')::integer)
 on conflict(facility_code,fiscal_year) do update set volunteer_count=excluded.volunteer_count;
 return jsonb_build_object('success',true);
end; $$;
revoke all on function public.hp_save_profile(text,integer,jsonb) from public,anon;
grant execute on function public.hp_save_profile(text,integer,jsonb) to authenticated;
