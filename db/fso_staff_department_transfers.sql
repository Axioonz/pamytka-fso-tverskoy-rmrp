-- Кадровые решения: перевод в отдел с основанием и историей изменений.
-- Применено к Supabase через миграцию add_staff_department_transfer_decision_20261107.

alter table public.fso_members add column if not exists department text;
alter table public.fso_members
  add constraint fso_members_department_valid
  check (department is null or (char_length(pg_catalog.btrim(department)) between 2 and 120 and department = pg_catalog.btrim(department)));

alter table public.fso_service_events drop constraint fso_service_events_event_type_check;
alter table public.fso_service_events
  add constraint fso_service_events_event_type_check check (event_type in (
    'joined','rank_changed','position_changed','department_changed','status_changed',
    'request_submitted','request_approved','request_rejected',
    'leave_approved','leave_finished','leave_cancelled','account_linked',
    'absence_approved','absence_finished','absence_cancelled',
    'dayoff_approved','dayoff_finished','dayoff_cancelled'
  ));

create or replace function fso_private.guard_department_modifications()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if old.department is distinct from new.department and
     coalesce(nullif(pg_catalog.current_setting('fso.personnel_reason',true),''),'') = '' then
    raise exception 'Перевод в отдел оформляется через кадровое решение с основанием'
      using errcode = '42501';
  end if;
  return new;
end
$function$;

create trigger fso_guard_department_modifications
  before update of department on public.fso_members
  for each row execute function fso_private.guard_department_modifications();

create or replace function fso_private.log_department_change()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if old.department is distinct from new.department then
    insert into public.fso_service_events
      (member_id,event_type,actor_id,old_value,new_value,reason)
    values
      (new.id,'department_changed',(select auth.uid()),
       pg_catalog.jsonb_build_object('department',old.department),
       pg_catalog.jsonb_build_object('department',new.department),
       coalesce(nullif(pg_catalog.current_setting('fso.personnel_reason',true),''),
                'Изменение отдела'));
  end if;
  return new;
end
$function$;

create trigger fso_service_history_department
  after update of department on public.fso_members
  for each row execute function fso_private.log_department_change();

create or replace function public.fso_transfer_department(
  p_member uuid, p_department text, p_reason text
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  actor uuid;
  old_record public.fso_members%rowtype;
  new_department text;
  note text;
begin
  actor := fso_private.require_personnel_manager();
  new_department := pg_catalog.btrim(coalesce(p_department,''));
  note := pg_catalog.btrim(coalesce(p_reason,''));
  if char_length(new_department) not between 2 and 120 then
    raise exception 'Укажите отдел от 2 до 120 символов';
  end if;
  if char_length(note) not between 5 and 2000 then
    raise exception 'Укажите основание перевода от 5 до 2000 символов';
  end if;
  select * into old_record from public.fso_members where id = p_member for update;
  if not found then raise exception 'Сотрудник не найден'; end if;
  if old_record.status not in ('active','cadet') then
    raise exception 'Перевод доступен только действующему составу';
  end if;
  if old_record.department is not distinct from new_department then
    raise exception 'Укажите другой отдел';
  end if;
  perform pg_catalog.set_config('fso.personnel_reason',note,true);
  update public.fso_members set department = new_department where id = p_member;
  perform pg_catalog.set_config('fso.personnel_reason','',true);
  return pg_catalog.jsonb_build_object(
    'member_id',p_member,'department',new_department,'performed_by',actor);
end
$function$;

revoke all on function public.fso_transfer_department(uuid,text,text) from public, anon;
grant execute on function public.fso_transfer_department(uuid,text,text) to authenticated;
