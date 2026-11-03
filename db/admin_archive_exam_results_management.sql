-- FSO administrative archive and exam operations.
-- Applied in Supabase migration admin_archive_exam_results_management on 2026-11-03.
-- Confirmed admin authorization is rechecked inside fso_private functions.

CREATE OR REPLACE FUNCTION fso_private.admin_archive_delete(p_member uuid, p_all boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=(select auth.uid()); ids uuid[]; total integer; nassign integer; nattempt integer;
begin
 if actor is null or not fso_private.has_role(array['admin']::text[]) then
  raise exception 'Архив может удалять только администратор' using errcode='42501'; end if;
 if (p_all is distinct from true and p_member is null) or (p_all is true and p_member is not null) then
  raise exception 'Выберите одну запись или полную очистку архива'; end if;
 perform pg_catalog.pg_advisory_xact_lock(735023,9);
 if p_all is true then
  select pg_catalog.array_agg(id) into ids from public.fso_members where status in ('archived','dismissed');
 else
  select pg_catalog.array_agg(id) into ids from public.fso_members
    where id=p_member and status in ('archived','dismissed');
 end if;
 if ids is null then
  if p_all is true then
   return pg_catalog.jsonb_build_object('deleted_members',0,'deleted_assignments',0,'deleted_attempts',0);
  end if;
  raise exception 'Сотрудник не найден в архиве';
 end if;
 if exists (select 1 from public.fso_blacklist where member_id=any(ids) and removed_at is null) then
  raise exception 'Очистка заблокирована. В архиве есть сотрудник с действующим чёрным списком. Сначала снимите ограничение.';
 end if;
 select count(*) into total from public.fso_members where id=any(ids);
 select count(*) into nassign from public.fso_exam_assignments where member_id=any(ids);
 select count(*) into nattempt from public.fso_exam_attempts t
  join public.fso_exam_assignments a on a.id=t.assignment_id where a.member_id=any(ids);
 delete from public.fso_exam_attempts t where t.assignment_id in
  (select id from public.fso_exam_assignments where member_id=any(ids));
 delete from public.fso_exam_assignments where member_id=any(ids);
 delete from public.fso_disciplinary_audit where member_id=any(ids);
 delete from public.fso_disciplinary_actions where member_id=any(ids);
 delete from public.fso_blacklist where member_id=any(ids);
 delete from public.fso_members where id=any(ids) and status in ('archived','dismissed');
 if p_all is true then
  insert into public.fso_activity_audit(actor_id,entity_type,entity_id,action,before_data)
   values(actor,'member','archive','member.archive_cleared',pg_catalog.jsonb_build_object('members',total,'assignments',nassign,'attempts',nattempt));
 end if;
 return pg_catalog.jsonb_build_object('deleted_members',total,'deleted_assignments',nassign,'deleted_attempts',nattempt);
end $function$
;

CREATE OR REPLACE FUNCTION fso_private.admin_assignment_delete(p_assignment uuid, p_mode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=(select auth.uid()); row_data record; nattempt integer;
begin
 if actor is null or not fso_private.has_role(array['admin']::text[]) then
  raise exception 'Удалять результаты может только администратор' using errcode='42501'; end if;
 if p_assignment is null or p_mode not in ('results','assignment') then
  raise exception 'Выберите назначение и действие'; end if;
 perform pg_catalog.pg_advisory_xact_lock(735023,9);
 select id,member_id,exam_id,status into row_data from public.fso_exam_assignments where id=p_assignment for update;
 if not found then raise exception 'Назначение не найдено'; end if;
 if exists(select 1 from public.fso_exam_attempts where assignment_id=p_assignment and completed_at is null) then
  raise exception 'У сотрудника сейчас идёт экзамен. Дождитесь завершения попытки'; end if;
 select count(*) into nattempt from public.fso_exam_attempts where assignment_id=p_assignment;
 if p_mode='results' and nattempt=0 then raise exception 'У этого назначения пока нет результатов'; end if;
 delete from public.fso_exam_attempts where assignment_id=p_assignment;
 if p_mode='assignment' then
  delete from public.fso_exam_assignments where id=p_assignment;
 else
  update public.fso_exam_assignments set status='assigned' where id=p_assignment;
  insert into public.fso_activity_audit(actor_id,entity_type,entity_id,member_id,action,before_data,after_data)
   values(actor,'assignment',p_assignment::text,row_data.member_id,'assignment.results_cleared',
    pg_catalog.jsonb_build_object('attempts',nattempt,'exam_id',row_data.exam_id,'status',row_data.status),
    pg_catalog.jsonb_build_object('attempts',0,'status','assigned'));
 end if;
 return pg_catalog.jsonb_build_object('deleted_attempts',nattempt,'assignment_deleted',p_mode='assignment');
end $function$
;

CREATE OR REPLACE FUNCTION fso_private.admin_exam_delete(p_exam uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=(select auth.uid()); title_text text; nassign integer; nattempt integer;
begin
 if actor is null or not fso_private.has_role(array['admin']::text[]) then
  raise exception 'Экзамены может удалять только администратор' using errcode='42501'; end if;
 if p_exam is null then raise exception 'Выберите экзамен'; end if;
 perform pg_catalog.pg_advisory_xact_lock(735023,9);
 select title into title_text from public.fso_exams where id=p_exam for update;
 if not found then raise exception 'Экзамен не найден'; end if;
 if exists(select 1 from public.fso_exam_attempts t join public.fso_exam_assignments a on a.id=t.assignment_id where a.exam_id=p_exam and t.completed_at is null) then
  raise exception 'Экзамен нельзя удалить, пока есть незавершённая попытка'; end if;
 select count(*) into nassign from public.fso_exam_assignments where exam_id=p_exam;
 select count(*) into nattempt from public.fso_exam_attempts t join public.fso_exam_assignments a on a.id=t.assignment_id where a.exam_id=p_exam;
 delete from public.fso_exam_attempts t where t.assignment_id in (select id from public.fso_exam_assignments where exam_id=p_exam);
 delete from public.fso_exam_assignments where exam_id=p_exam;
 delete from public.fso_exams where id=p_exam;
 return pg_catalog.jsonb_build_object('deleted_exams',1,'title',title_text,'deleted_assignments',nassign,'deleted_attempts',nattempt);
end $function$
;

CREATE OR REPLACE FUNCTION fso_private.exam_staff_directory()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare data jsonb;
begin
 if (select auth.uid()) is null or not fso_private.has_role(array['admin','examiner']::text[]) then
  raise exception 'Недостаточно прав' using errcode='42501'; end if;
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'user_id',u.id,
  'display_name',coalesce(nullif(pg_catalog.btrim(p.display_name),''),
    (select nullif(pg_catalog.btrim(m.first_name||' '||m.last_name),'')
      from public.fso_members m where m.user_id=u.id order by m.created_at desc limit 1),
    pg_catalog.split_part(u.email,'@',1),'Неизвестный')
  )),'[]'::jsonb) into data
 from auth.users u left join public.fso_profiles p on p.user_id=u.id
 where u.id in (
  select created_by from public.fso_exams where created_by is not null
  union select issued_by from public.fso_exam_assignments where issued_by is not null
 );
 return data;
end $function$
;

CREATE OR REPLACE FUNCTION public.fso_admin_archive_delete(p_member uuid DEFAULT NULL::uuid, p_all boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$select fso_private.admin_archive_delete(p_member,p_all)$function$
;

CREATE OR REPLACE FUNCTION public.fso_admin_assignment_delete(p_assignment uuid, p_mode text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$select fso_private.admin_assignment_delete(p_assignment,p_mode)$function$
;

CREATE OR REPLACE FUNCTION public.fso_admin_exam_delete(p_exam uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$select fso_private.admin_exam_delete(p_exam)$function$
;

CREATE OR REPLACE FUNCTION public.fso_exam_staff_directory()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$select fso_private.exam_staff_directory()$function$
;
revoke all on function fso_private.admin_archive_delete(p_member uuid, p_all boolean) from public,anon;
grant execute on function fso_private.admin_archive_delete(p_member uuid, p_all boolean) to authenticated;
revoke all on function fso_private.admin_assignment_delete(p_assignment uuid, p_mode text) from public,anon;
grant execute on function fso_private.admin_assignment_delete(p_assignment uuid, p_mode text) to authenticated;
revoke all on function fso_private.admin_exam_delete(p_exam uuid) from public,anon;
grant execute on function fso_private.admin_exam_delete(p_exam uuid) to authenticated;
revoke all on function fso_private.exam_staff_directory() from public,anon;
grant execute on function fso_private.exam_staff_directory() to authenticated;
revoke all on function public.fso_admin_archive_delete(p_member uuid DEFAULT NULL::uuid, p_all boolean DEFAULT false) from public,anon;
grant execute on function public.fso_admin_archive_delete(p_member uuid DEFAULT NULL::uuid, p_all boolean DEFAULT false) to authenticated;
revoke all on function public.fso_admin_assignment_delete(p_assignment uuid, p_mode text) from public,anon;
grant execute on function public.fso_admin_assignment_delete(p_assignment uuid, p_mode text) to authenticated;
revoke all on function public.fso_admin_exam_delete(p_exam uuid) from public,anon;
grant execute on function public.fso_admin_exam_delete(p_exam uuid) to authenticated;
revoke all on function public.fso_exam_staff_directory() from public,anon;
grant execute on function public.fso_exam_staff_directory() to authenticated;
