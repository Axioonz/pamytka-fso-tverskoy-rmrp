-- FSO leadership workflow schema. Applied in Supabase on 2026-11-03.
-- Security: RLS on all public tables, reads are scoped to leadership or linked member;
-- writes go through protected functions requiring confirmed roles.
create table if not exists public.fso_service_events (
 id bigint generated always as identity primary key,
 member_id uuid not null references public.fso_members(id) on delete cascade,
 event_type text not null check (event_type in (
 'joined','rank_changed','position_changed','status_changed','request_submitted',
 'request_approved','request_rejected','leave_approved','leave_finished','leave_cancelled','account_linked')),
 actor_id uuid references auth.users(id) on delete set null,
 old_value jsonb not null default '{}'::jsonb,
 new_value jsonb not null default '{}'::jsonb,
 reason text,
 occurred_at timestamptz not null default now()
);
create index if not exists fso_service_events_member_time on public.fso_service_events(member_id,occurred_at desc);
create table if not exists public.fso_service_requests (
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references public.fso_members(id) on delete cascade,
 kind text not null check (kind in ('leave','promotion','transfer','reinstatement','other')),
 statement text not null check(length(btrim(statement)) between 10 and 3000),
 date_from date,date_to date,
 submitted_by uuid not null references auth.users(id),
 submitted_at timestamptz not null default now(),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,review_note text,
 check ((date_from is null and date_to is null) or (date_from is not null and date_to is not null and date_from<=date_to)),
 check (kind<>'leave' or (date_from is not null and date_to is not null))
);
create index if not exists fso_service_requests_member on public.fso_service_requests(member_id,submitted_at desc);
create index if not exists fso_service_requests_pending on public.fso_service_requests(status,submitted_at desc);
create table if not exists public.fso_service_leaves (
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references public.fso_members(id) on delete cascade,
 request_id uuid references public.fso_service_requests(id) on delete set null,
 date_from date not null,
 date_to date not null check(date_to>=date_from),
 reason text not null check(length(btrim(reason)) between 5 and 3000),
 status text not null default 'approved' check(status in ('approved','completed','cancelled')),
 approved_by uuid not null references auth.users(id),
 approved_at timestamptz not null default now(),
 closed_by uuid references auth.users(id),
 closed_at timestamptz,closure_reason text
);
create index if not exists fso_service_leaves_member on public.fso_service_leaves(member_id,date_to desc);
create unique index if not exists fso_service_leaves_request_unique on public.fso_service_leaves(request_id) where request_id is not null;
alter table public.fso_service_events enable row level security;
alter table public.fso_service_requests enable row level security;
alter table public.fso_service_leaves enable row level security;
revoke all on public.fso_service_events,public.fso_service_requests,public.fso_service_leaves from public,anon;
grant select on public.fso_service_events,public.fso_service_requests,public.fso_service_leaves to authenticated;
drop policy if exists fso_service_events_read on public.fso_service_events;
create policy fso_service_events_read on public.fso_service_events for select to authenticated
 using (fso_private.has_role(array['admin','hr','examiner']::text[]) or exists(
 select 1 from public.fso_members m where m.id=member_id and m.user_id=(select auth.uid())));
drop policy if exists fso_service_requests_read on public.fso_service_requests;
create policy fso_service_requests_read on public.fso_service_requests for select to authenticated
 using (fso_private.has_role(array['admin','hr','examiner']::text[]) or exists(
 select 1 from public.fso_members m where m.id=member_id and m.user_id=(select auth.uid())));
drop policy if exists fso_service_leaves_read on public.fso_service_leaves;
create policy fso_service_leaves_read on public.fso_service_leaves for select to authenticated
 using (fso_private.has_role(array['admin','hr','examiner']::text[]) or exists(
 select 1 from public.fso_members m where m.id=member_id and m.user_id=(select auth.uid())));

CREATE OR REPLACE FUNCTION fso_private.require_personnel_manager()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid := (select auth.uid());
begin
 if actor is null or not fso_private.has_role(array['admin','hr']::text[]) then
  raise exception 'Недостаточно кадровых полномочий' using errcode='42501';
 end if;
 return actor;
end $function$;

CREATE OR REPLACE FUNCTION fso_private.service_member_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid := (select auth.uid()); note text:=nullif(pg_catalog.current_setting('fso.personnel_reason',true),'');
begin
 if tg_op='INSERT' then
  insert into public.fso_service_events(member_id,event_type,actor_id,new_value,reason,occurred_at)
  values(new.id,'joined',actor,pg_catalog.jsonb_build_object('joined_on',new.joined_on,'rank',new.rank,'position',new.position),
  'Данные приёма из личного дела',new.created_at);
  return new;
 end if;
 if old.rank is distinct from new.rank then
  insert into public.fso_service_events(member_id,event_type,actor_id,old_value,new_value,reason)
  values(new.id,'rank_changed',actor,pg_catalog.jsonb_build_object('rank',old.rank),
   pg_catalog.jsonb_build_object('rank',new.rank),coalesce(note,'Изменено в личном деле'));
 end if;
 if old.position is distinct from new.position then
  insert into public.fso_service_events(member_id,event_type,actor_id,old_value,new_value,reason)
  values(new.id,'position_changed',actor,pg_catalog.jsonb_build_object('position',old.position),
   pg_catalog.jsonb_build_object('position',new.position),coalesce(note,'Изменено в личном деле'));
 end if;
 if old.status is distinct from new.status then
  insert into public.fso_service_events(member_id,event_type,actor_id,old_value,new_value,reason)
  values(new.id,'status_changed',actor,pg_catalog.jsonb_build_object('status',old.status),
   pg_catalog.jsonb_build_object('status',new.status),'Изменение статуса службы');
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION fso_private.guard_personnel_modifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if old.rank is distinct from new.rank or old.position is distinct from new.position then
  if coalesce(nullif(pg_catalog.current_setting('fso.personnel_reason',true),''),'')='' then
   raise exception 'Для изменения звания или должности оформите кадровое решение с основанием'
    using errcode='42501';
  end if;
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION fso_private.personnel_decision(p_member uuid, p_rank text, p_position text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid; old_record public.fso_members%rowtype; new_rank text; new_position text;
begin
 actor:=fso_private.require_personnel_manager();
 if length(pg_catalog.btrim(coalesce(p_reason,'')))<5 or length(p_reason)>2000 then
  raise exception 'Укажите основание решения от 5 до 2000 символов'; end if;
 select * into old_record from public.fso_members where id=p_member for update;
 if not found then raise exception 'Сотрудник не найден'; end if;
 if old_record.status not in ('active','cadet') then raise exception 'Кадровые решения доступны только действующему составу'; end if;
 new_rank:=coalesce(nullif(pg_catalog.btrim(p_rank),''),old_record.rank);
 new_position:=coalesce(p_position,old_record.position);
 if length(new_position)>200 then raise exception 'Слишком длинная должность'; end if;
 if new_rank not in ('Генерал-майор','Полковник','Подполковник','Майор','Капитан',
 'Старший лейтенант','Лейтенант','Младший лейтенант','Старший прапорщик',
 'Прапорщик','Старшина','Старший сержант','Сержант','Младший сержант','Ефрейтор','Рядовой') then
  raise exception 'Укажите звание из утверждённого списка'; end if;
 if old_record.rank is not distinct from new_rank and old_record.position is not distinct from new_position then
  raise exception 'Новое звание или должность не отличаются от текущих'; end if;
 perform pg_catalog.set_config('fso.personnel_reason',pg_catalog.btrim(p_reason),true);
 update public.fso_members set rank=new_rank,position=new_position where id=p_member;
 perform pg_catalog.set_config('fso.personnel_reason','',true);
 return pg_catalog.jsonb_build_object('member_id',p_member,'rank',new_rank,'position',new_position,'performed_by',actor);
end $function$;

CREATE OR REPLACE FUNCTION fso_private.submit_service_request(p_member uuid, p_kind text, p_statement text, p_from date, p_to date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=(select auth.uid()); record_member record; new_id uuid;
begin
 if actor is null then raise exception 'Требуется авторизация' using errcode='42501'; end if;
 select id,user_id,status into record_member from public.fso_members where id=p_member;
 if not found then raise exception 'Личное дело не найдено'; end if;
 if not (fso_private.has_role(array['admin','hr']::text[]) or
   (record_member.user_id=actor and fso_private.has_role(array['employee','cadet','examiner']::text[]))) then
  raise exception 'Нет прав на подачу рапорта' using errcode='42501'; end if;
 if record_member.status not in ('active','cadet') and not
    (p_kind='reinstatement' and fso_private.has_role(array['admin','hr']::text[])) then
  raise exception 'Рапорт для уволенного сотрудника может оформить только руководство'; end if;
 if p_kind not in ('leave','promotion','transfer','reinstatement','other') then raise exception 'Неизвестный вид рапорта'; end if;
 if length(pg_catalog.btrim(coalesce(p_statement,''))) not between 10 and 3000 then
  raise exception 'Текст рапорта должен содержать от 10 до 3000 символов'; end if;
 if p_kind='leave' and (p_from is null or p_to is null or p_from>p_to) then
  raise exception 'Укажите корректный период отпуска'; end if;
 if p_kind<>'leave' then p_from:=null; p_to:=null; end if;
 insert into public.fso_service_requests(member_id,kind,statement,date_from,date_to,submitted_by)
 values(p_member,p_kind,pg_catalog.btrim(p_statement),p_from,p_to,actor) returning id into new_id;
 insert into public.fso_service_events(member_id,event_type,actor_id,new_value,reason)
 values(p_member,'request_submitted',actor,pg_catalog.jsonb_build_object('id',new_id,'kind',p_kind),pg_catalog.btrim(p_statement));
 return new_id;
end $function$;

CREATE OR REPLACE FUNCTION fso_private.review_service_request(p_id uuid, p_decision text, p_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid; item public.fso_service_requests%rowtype;
begin
 actor:=fso_private.require_personnel_manager();
 if p_decision not in ('approved','rejected') then raise exception 'Решение должно быть одобрено или отказано'; end if;
 if p_decision='rejected' and length(pg_catalog.btrim(coalesce(p_note,'')))<5 then raise exception 'Укажите причину отказа'; end if;
 perform pg_catalog.pg_advisory_xact_lock(735024,1);
 select * into item from public.fso_service_requests where id=p_id for update;
 if not found or item.status<>'pending' then raise exception 'Рапорт уже рассмотрен или не найден'; end if;
 if item.kind='leave' and p_decision='approved' then
  if exists(select 1 from public.fso_service_leaves l
    where l.member_id=item.member_id and l.status='approved'
    and l.date_from<=item.date_to and l.date_to>=item.date_from) then
   raise exception 'На выбранные даты у сотрудника уже имеется отпуск'; end if;
  insert into public.fso_service_leaves(member_id,request_id,date_from,date_to,reason,approved_by)
  values(item.member_id,item.id,item.date_from,item.date_to,item.statement,actor);
  insert into public.fso_service_events(member_id,event_type,actor_id,new_value,reason)
  values(item.member_id,'leave_approved',actor,
    pg_catalog.jsonb_build_object('date_from',item.date_from,'date_to',item.date_to,'request_id',item.id),
    coalesce(nullif(pg_catalog.btrim(p_note),''),'Отпуск по одобренному рапорту'));
 end if;
 update public.fso_service_requests set status=p_decision,reviewed_by=actor,reviewed_at=now(),
   review_note=nullif(pg_catalog.btrim(p_note),'') where id=p_id;
 insert into public.fso_service_events(member_id,event_type,actor_id,new_value,reason)
 values(item.member_id,case when p_decision='approved' then 'request_approved' else 'request_rejected' end,
  actor,pg_catalog.jsonb_build_object('request_id',p_id,'kind',item.kind),coalesce(nullif(pg_catalog.btrim(p_note),''),'Решение руководства'));
 return pg_catalog.jsonb_build_object('id',p_id,'status',p_decision);
end $function$;

CREATE OR REPLACE FUNCTION fso_private.create_service_leave(p_member uuid, p_from date, p_to date, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid; record_status text; new_id uuid;
begin
 actor:=fso_private.require_personnel_manager();
 if p_from is null or p_to is null or p_from>p_to then raise exception 'Некорректный период отпуска'; end if;
 if length(pg_catalog.btrim(coalesce(p_reason,''))) not between 5 and 3000 then raise exception 'Укажите причину отпуска'; end if;
 select status into record_status from public.fso_members where id=p_member for update;
 if not found or record_status not in ('active','cadet') then raise exception 'Сотрудник не состоит в действующем составе'; end if;
 perform pg_catalog.pg_advisory_xact_lock(735024,1);
 if exists(select 1 from public.fso_service_leaves l where l.member_id=p_member and l.status='approved'
   and l.date_from<=p_to and l.date_to>=p_from) then raise exception 'На эти даты уже оформлен отпуск'; end if;
 insert into public.fso_service_leaves(member_id,date_from,date_to,reason,approved_by)
 values(p_member,p_from,p_to,pg_catalog.btrim(p_reason),actor) returning id into new_id;
 insert into public.fso_service_events(member_id,event_type,actor_id,new_value,reason)
 values(p_member,'leave_approved',actor,pg_catalog.jsonb_build_object('date_from',p_from,'date_to',p_to,'leave_id',new_id),
 pg_catalog.btrim(p_reason));
 return new_id;
end $function$;

CREATE OR REPLACE FUNCTION fso_private.close_service_leave(p_leave uuid, p_action text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid; item public.fso_service_leaves%rowtype;
begin
 actor:=fso_private.require_personnel_manager();
 if p_action not in ('completed','cancelled') then raise exception 'Некорректное действие'; end if;
 perform pg_catalog.pg_advisory_xact_lock(735024,1);
 select * into item from public.fso_service_leaves where id=p_leave for update;
 if not found or item.status<>'approved' then raise exception 'Отпуск уже закрыт или не найден'; end if;
 if p_action='completed' and item.date_to>=current_date then
  raise exception 'Срок отпуска ещё не закончился'; end if;
 if p_action='cancelled' and length(pg_catalog.btrim(coalesce(p_reason,'')))<5 then
  raise exception 'Укажите основание отмены'; end if;
 update public.fso_service_leaves set status=p_action,closed_by=actor,closed_at=now(),
 closure_reason=nullif(pg_catalog.btrim(p_reason),'') where id=p_leave;
 insert into public.fso_service_events(member_id,event_type,actor_id,new_value,reason)
 values(item.member_id,case when p_action='completed' then 'leave_finished' else 'leave_cancelled' end,
 actor,pg_catalog.jsonb_build_object('leave_id',p_leave,'date_from',item.date_from,'date_to',item.date_to),
 coalesce(nullif(pg_catalog.btrim(p_reason),''),'Подтверждено возвращение'));
 return pg_catalog.jsonb_build_object('leave_id',p_leave,'status',p_action);
end $function$;

CREATE OR REPLACE FUNCTION fso_private.link_member_account(p_member uuid, p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid; target uuid; old_target uuid; record_status text;
begin
 actor:= (select auth.uid());
 if actor is null or not fso_private.has_role(array['admin']::text[]) then
  raise exception 'Связать аккаунт может только администратор' using errcode='42501'; end if;
 select user_id,status into old_target,record_status from public.fso_members where id=p_member for update;
 if not found or record_status not in ('active','cadet') then raise exception 'Нужен действующий сотрудник'; end if;
 if nullif(pg_catalog.btrim(coalesce(p_email,'')),'') is not null then
  select u.id into target from auth.users u join public.fso_profiles p on p.user_id=u.id
    where lower(u.email)=lower(pg_catalog.btrim(p_email)) and u.email_confirmed_at is not null;
  if target is null then raise exception 'Пользователь не найден. Сначала подтвердите почту и выдайте доступ.'; end if;
 end if;
 update public.fso_members set user_id=target where id=p_member;
 insert into public.fso_service_events(member_id,event_type,actor_id,old_value,new_value,reason)
 values(p_member,'account_linked',actor,pg_catalog.jsonb_build_object('user_id',old_target),
  pg_catalog.jsonb_build_object('user_id',target),'Связь личного дела с аккаунтом');
 return pg_catalog.jsonb_build_object('member_id',p_member,'user_id',target);
end $function$;

CREATE OR REPLACE FUNCTION public.fso_personnel_decision(p_member uuid, p_rank text, p_position text, p_reason text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select fso_private.personnel_decision(p_member,p_rank,p_position,p_reason) $function$;

CREATE OR REPLACE FUNCTION public.fso_request_submit(p_member uuid, p_kind text, p_statement text, p_from date, p_to date)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select fso_private.submit_service_request(p_member,p_kind,p_statement,p_from,p_to) $function$;

CREATE OR REPLACE FUNCTION public.fso_request_review(p_id uuid, p_decision text, p_note text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select fso_private.review_service_request(p_id,p_decision,p_note) $function$;

CREATE OR REPLACE FUNCTION public.fso_leave_create(p_member uuid, p_from date, p_to date, p_reason text)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select fso_private.create_service_leave(p_member,p_from,p_to,p_reason) $function$;

CREATE OR REPLACE FUNCTION public.fso_leave_close(p_leave uuid, p_action text, p_reason text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select fso_private.close_service_leave(p_leave,p_action,p_reason) $function$;

CREATE OR REPLACE FUNCTION public.fso_member_account_link(p_member uuid, p_email text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select fso_private.link_member_account(p_member,p_email) $function$;


drop trigger if exists fso_service_history_members on public.fso_members;
create trigger fso_service_history_members after insert or update of rank,position,status
 on public.fso_members for each row execute function fso_private.service_member_audit();
drop trigger if exists fso_guard_personnel_modifications on public.fso_members;
create trigger fso_guard_personnel_modifications before update of rank,position
 on public.fso_members for each row execute function fso_private.guard_personnel_modifications();
revoke all on function fso_private.close_service_leave(p_leave uuid, p_action text, p_reason text) from public,anon;
grant execute on function fso_private.close_service_leave(p_leave uuid, p_action text, p_reason text) to authenticated;
revoke all on function fso_private.create_service_leave(p_member uuid, p_from date, p_to date, p_reason text) from public,anon;
grant execute on function fso_private.create_service_leave(p_member uuid, p_from date, p_to date, p_reason text) to authenticated;
revoke all on function fso_private.link_member_account(p_member uuid, p_email text) from public,anon;
grant execute on function fso_private.link_member_account(p_member uuid, p_email text) to authenticated;
revoke all on function fso_private.personnel_decision(p_member uuid, p_rank text, p_position text, p_reason text) from public,anon;
grant execute on function fso_private.personnel_decision(p_member uuid, p_rank text, p_position text, p_reason text) to authenticated;
revoke all on function fso_private.review_service_request(p_id uuid, p_decision text, p_note text) from public,anon;
grant execute on function fso_private.review_service_request(p_id uuid, p_decision text, p_note text) to authenticated;
revoke all on function fso_private.submit_service_request(p_member uuid, p_kind text, p_statement text, p_from date, p_to date) from public,anon;
grant execute on function fso_private.submit_service_request(p_member uuid, p_kind text, p_statement text, p_from date, p_to date) to authenticated;
revoke all on function public.fso_leave_close(p_leave uuid, p_action text, p_reason text) from public,anon;
grant execute on function public.fso_leave_close(p_leave uuid, p_action text, p_reason text) to authenticated;
revoke all on function public.fso_leave_create(p_member uuid, p_from date, p_to date, p_reason text) from public,anon;
grant execute on function public.fso_leave_create(p_member uuid, p_from date, p_to date, p_reason text) to authenticated;
revoke all on function public.fso_member_account_link(p_member uuid, p_email text) from public,anon;
grant execute on function public.fso_member_account_link(p_member uuid, p_email text) to authenticated;
revoke all on function public.fso_personnel_decision(p_member uuid, p_rank text, p_position text, p_reason text) from public,anon;
grant execute on function public.fso_personnel_decision(p_member uuid, p_rank text, p_position text, p_reason text) to authenticated;
revoke all on function public.fso_request_review(p_id uuid, p_decision text, p_note text) from public,anon;
grant execute on function public.fso_request_review(p_id uuid, p_decision text, p_note text) to authenticated;
revoke all on function public.fso_request_submit(p_member uuid, p_kind text, p_statement text, p_from date, p_to date) from public,anon;
grant execute on function public.fso_request_submit(p_member uuid, p_kind text, p_statement text, p_from date, p_to date) to authenticated;
