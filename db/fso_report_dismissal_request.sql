-- A dismissal report is a request, not an automatic personnel dismissal.
-- Existing historical reinstatement requests remain in the archive unchanged.
CREATE OR REPLACE FUNCTION fso_private.submit_service_request(p_member uuid, p_kind text, p_statement text, p_from date, p_to date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 actor uuid := (select auth.uid());
 staff record;
 new_id uuid;
 self_absence boolean := p_kind in ('leave','inactivity','dayoff');
begin
 if actor is null then raise exception 'Требуется авторизация' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('leave','inactivity','dayoff','promotion','transfer','dismissal','other') then
  raise exception 'Неизвестный вид рапорта'; end if;
 select id,user_id,status into staff from public.fso_members where id=p_member;
 if not found then raise exception 'Личное дело не найдено'; end if;
 if self_absence then
  if staff.user_id is distinct from actor or not fso_private.has_role(array['admin','hr','examiner','employee','cadet']::text[]) then
   raise exception 'Отпуск и неактивность оформляет только сам сотрудник из своего кабинета' using errcode='42501';
  end if;
  if staff.status not in ('active','cadet') then raise exception 'Подать заявку может только действующий сотрудник'; end if;
  if p_from is null or p_to is null or p_from>p_to then raise exception 'Укажите корректный период отсутствия'; end if;
  if p_from<current_date then raise exception 'Дата начала не может быть в прошлом'; end if;
  if p_kind='dayoff' and p_from<>p_to then raise exception 'Отгул оформляется на один день';end if;
 else
  if not (fso_private.has_role(array['admin','hr']::text[]) or
    (staff.user_id=actor and fso_private.has_role(array['admin','hr','examiner','employee','cadet']::text[]))) then
   raise exception 'Нет прав на подачу рапорта' using errcode='42501';
  end if;
  if staff.status not in ('active','cadet') then
   raise exception 'Рапорт подаётся только в отношении действующего сотрудника'; end if;
  p_from:=null;p_to:=null;
 end if;
 if length(pg_catalog.btrim(coalesce(p_statement,''))) not between 10 and 3000 then
  raise exception 'Текст рапорта должен содержать от 10 до 3000 символов'; end if;
 if self_absence then
  perform pg_catalog.pg_advisory_xact_lock(735024,1);
  if exists(select 1 from public.fso_service_leaves l
   where l.member_id=p_member and l.status='approved'
   and l.date_from<=p_to and l.date_to>=p_from) then
   raise exception 'На эти даты уже одобрен другой период отсутствия'; end if;
  if exists(select 1 from public.fso_service_requests r
    where r.member_id=p_member and r.status='pending' and r.kind in ('leave','inactivity','dayoff')
    and r.date_from<=p_to and r.date_to>=p_from) then
   raise exception 'Заявка на этот период уже ожидает рассмотрения'; end if;
 end if;
 insert into public.fso_service_requests(member_id,kind,statement,date_from,date_to,submitted_by)
 values(p_member,p_kind,pg_catalog.btrim(p_statement),p_from,p_to,actor)
 returning id into new_id;
 insert into public.fso_service_events(member_id,event_type,actor_id,new_value,reason)
 values(p_member,'request_submitted',actor,
  pg_catalog.jsonb_build_object('id',new_id,'kind',p_kind,'date_from',p_from,'date_to',p_to),
  pg_catalog.btrim(p_statement));
 return new_id;
end $function$

