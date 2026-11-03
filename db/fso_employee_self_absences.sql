-- Migration applied to fso-rmrp-portal on 2026-11-03.
-- Absences and inactivity requests originate from the owner of the linked
-- personnel file. Managers can approve/reject, not create a period directly.
-- Apply after db/fso_leadership_workflows.sql.

alter table public.fso_service_requests drop constraint if exists fso_service_requests_kind_check;
alter table public.fso_service_requests add constraint fso_service_requests_kind_check
 check(kind in ('leave','inactivity','promotion','transfer','reinstatement','other'));
alter table public.fso_service_requests drop constraint if exists fso_service_requests_check1;
alter table public.fso_service_requests add constraint fso_service_requests_check1
 check(kind not in ('leave','inactivity') or (date_from is not null and date_to is not null));

CREATE OR REPLACE FUNCTION fso_private.review_service_request(p_id uuid, p_decision text, p_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid; item public.fso_service_requests%rowtype; current_status text;
begin
 actor:=fso_private.require_personnel_manager();
 if p_decision not in ('approved','rejected') then raise exception 'Некорректное решение'; end if;
 if p_decision='rejected' and length(pg_catalog.btrim(coalesce(p_note,'')))<5 then
  raise exception 'Укажите причину отказа'; end if;
 perform pg_catalog.pg_advisory_xact_lock(735024,1);
 select * into item from public.fso_service_requests where id=p_id for update;
 if not found or item.status<>'pending' then
  raise exception 'Заявка уже рассмотрена или не найдена'; end if;
 if item.kind in ('leave','inactivity') and p_decision='approved' then
  select status into current_status from public.fso_members where id=item.member_id for update;
  if current_status not in ('active','cadet') or current_status is null then
   raise exception 'Уволенному сотруднику нельзя одобрить отсутствие'; end if;
  if item.date_from is null or item.date_to is null or item.date_from>item.date_to then
   raise exception 'Период в заявке недействителен'; end if;
  if item.date_to<current_date then
   raise exception 'Срок отсутствия уже истёк'; end if;
  if exists(select 1 from public.fso_service_leaves l where l.member_id=item.member_id
   and l.status='approved' and l.date_from<=item.date_to and l.date_to>=item.date_from) then
   raise exception 'На эти даты уже оформлен другой отпуск или неактивность'; end if;
  insert into public.fso_service_leaves(member_id,request_id,kind,date_from,date_to,reason,approved_by)
  values(item.member_id,item.id,item.kind,item.date_from,item.date_to,item.statement,actor);
  insert into public.fso_service_events(member_id,event_type,actor_id,new_value,reason)
  values(item.member_id,
   case when item.kind='inactivity' then 'absence_approved' else 'leave_approved' end,
   actor,pg_catalog.jsonb_build_object('kind',item.kind,'date_from',item.date_from,
    'date_to',item.date_to,'request_id',item.id),
   coalesce(nullif(pg_catalog.btrim(p_note),''),'Одобрено руководством'));
 end if;
 update public.fso_service_requests set status=p_decision,reviewed_by=actor,reviewed_at=now(),
   review_note=nullif(pg_catalog.btrim(p_note),'') where id=p_id;
 insert into public.fso_service_events(member_id,event_type,actor_id,new_value,reason)
 values(item.member_id,
  case when p_decision='approved' then 'request_approved' else 'request_rejected' end,
  actor,pg_catalog.jsonb_build_object('request_id',p_id,'kind',item.kind),
  coalesce(nullif(pg_catalog.btrim(p_note),''),'Решение руководства'));
 return pg_catalog.jsonb_build_object('id',p_id,'status',p_decision);
end $function$;

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
 self_absence boolean := p_kind in ('leave','inactivity');
begin
 if actor is null then raise exception 'Требуется авторизация' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('leave','inactivity','promotion','transfer','reinstatement','other') then
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
 else
  if not (fso_private.has_role(array['admin','hr']::text[]) or
    (staff.user_id=actor and fso_private.has_role(array['admin','hr','examiner','employee','cadet']::text[]))) then
   raise exception 'Нет прав на подачу рапорта' using errcode='42501';
  end if;
  if staff.status not in ('active','cadet') and not
    (p_kind='reinstatement' and fso_private.has_role(array['admin','hr']::text[])) then
   raise exception 'Для уволенного сотрудника рапорт оформляет руководство'; end if;
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
    where r.member_id=p_member and r.status='pending' and r.kind in ('leave','inactivity')
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
end $function$;

-- Retire both privileged direct-create endpoints; existing leave data is kept.
revoke all on function public.fso_leave_create(uuid,date,date,text) from public,anon,authenticated;
revoke all on function fso_private.create_service_leave(uuid,date,date,text) from public,anon,authenticated;
revoke all on function public.fso_absence_create(uuid,date,date,text,text) from public,anon,authenticated;
revoke all on function fso_private.create_service_absence(uuid,date,date,text,text) from public,anon,authenticated;
