-- A fixed service subdivision replaces the editable "status" field.
-- Internal status remains for cadet exams and the dismissal archive.
begin;
select pg_catalog.set_config('fso.personnel_reason','Миграция курсантов в Академию',true);
update public.fso_members set department='Академия'
 where status='cadet' and department is null;
select pg_catalog.set_config('fso.personnel_reason','',true);

alter table public.fso_members
 drop constraint if exists fso_members_subdivision_status_check;
alter table public.fso_members
 add constraint fso_members_subdivision_status_check
 check (
   (status in ('dismissed','archived') and (department is null or department in ('АС','Академия','УЛО')))
   or (status='cadet' and department='Академия')
   or (status='active' and department in ('АС','УЛО'))
 );

create or replace function public.fso_transfer_department(
 p_member uuid, p_department text, p_reason text
) returns jsonb language plpgsql security definer set search_path = ''
as $fn$
declare actor uuid; old_record public.fso_members%rowtype;
 new_department text := pg_catalog.btrim(coalesce(p_department,''));
 note text := pg_catalog.btrim(coalesce(p_reason,''));
 new_status text;
begin
 actor := fso_private.require_personnel_manager();
 if new_department not in ('АС','Академия','УЛО') or new_department = '' then
   raise exception 'Выберите подразделение: АС, Академия или УЛО';
 end if;
 if char_length(note) not between 5 and 2000 then
   raise exception 'Укажите основание перевода от 5 до 2000 символов';
 end if;
 select * into old_record from public.fso_members where id=p_member for update;
 if not found then raise exception 'Сотрудник не найден'; end if;
 if old_record.status not in ('active','cadet') then
   raise exception 'Перевод доступен только действующему составу';
 end if;
 if old_record.department is not distinct from new_department then
   raise exception 'Укажите другое подразделение';
 end if;
 new_status := case when new_department='Академия' then 'cadet' else 'active' end;
 perform pg_catalog.set_config('fso.personnel_reason',note,true);
 update public.fso_members
  set department=new_department,status=new_status where id=p_member;
 perform pg_catalog.set_config('fso.personnel_reason','',true);
 return pg_catalog.jsonb_build_object(
  'member_id',p_member,'department',new_department,
  'status',new_status,'performed_by',actor);
end
$fn$;
revoke all on function public.fso_transfer_department(uuid,text,text) from public,anon;
grant execute on function public.fso_transfer_department(uuid,text,text) to authenticated;

-- Personnel edit and subdivision transfer are a single transaction.
create or replace function public.fso_member_subdivision_save(
 p_member uuid,p_employee_number text,p_first_name text,p_last_name text,
 p_discord text,p_joined_on date,p_department text,p_reason text
) returns jsonb language plpgsql security definer set search_path = ''
as $fn$
declare actor uuid; existing public.fso_members%rowtype;
 chosen text:=pg_catalog.btrim(coalesce(p_department,''));
 note text:=pg_catalog.btrim(coalesce(p_reason,''));
 new_status text;
begin
 actor:=fso_private.require_personnel_manager();
 if chosen not in ('АС','Академия','УЛО') or chosen='' then
   raise exception 'Выберите подразделение: АС, Академия или УЛО';
 end if;
 if p_employee_number !~ '^[0-9]{1,12}$' then
   raise exception 'Некорректный служебный ID';
 end if;
 if length(pg_catalog.btrim(coalesce(p_first_name,'')))=0
    or length(pg_catalog.btrim(coalesce(p_last_name,'')))=0 then
   raise exception 'Укажите имя и фамилию';
 end if;
 if p_joined_on is null then raise exception 'Укажите дату вступления'; end if;
 select * into existing from public.fso_members where id=p_member for update;
 if not found then raise exception 'Личное дело не найдено'; end if;
 if existing.status not in ('active','cadet') then
   raise exception 'Редактирование уволенного сотрудника запрещено';
 end if;
 if existing.department is distinct from chosen
    and char_length(note) not between 5 and 2000 then
   raise exception 'Для перевода укажите основание от 5 до 2000 символов';
 end if;
 new_status:=case when chosen='Академия' then 'cadet' else 'active' end;
 if existing.department is distinct from chosen then
   perform pg_catalog.set_config('fso.personnel_reason',note,true);
 end if;
 update public.fso_members set
   employee_number=pg_catalog.btrim(p_employee_number),
   first_name=pg_catalog.btrim(p_first_name),
   last_name=pg_catalog.btrim(p_last_name),
   discord=coalesce(p_discord,''),
   joined_on=p_joined_on,
   department=chosen,
   status=new_status
 where id=p_member;
 perform pg_catalog.set_config('fso.personnel_reason','',true);
 return pg_catalog.jsonb_build_object(
   'member_id',p_member,'department',chosen,'status',new_status,'performed_by',actor);
end
$fn$;
revoke all on function public.fso_member_subdivision_save(uuid,text,text,text,text,date,text,text)
 from public,anon;
grant execute on function public.fso_member_subdivision_save(uuid,text,text,text,text,date,text,text)
 to authenticated;

-- Dismissal plus blacklist entry must succeed or fail atomically.
create or replace function public.fso_dismiss_member_blacklist(
 p_member uuid,p_reason text,p_evidence jsonb default '[]'::jsonb
) returns jsonb language plpgsql security invoker set search_path = ''
as $fn$
declare dismissal jsonb; blacklist_entry jsonb;
begin
 dismissal:=fso_private.dismiss_member(p_member,p_reason,p_evidence);
 blacklist_entry:=fso_private.blacklist_add(p_member,p_reason);
 return pg_catalog.jsonb_build_object(
  'member_id',p_member,'status','dismissed',
  'blacklist_id',blacklist_entry->>'id');
end
$fn$;
revoke all on function public.fso_dismiss_member_blacklist(uuid,text,jsonb) from public,anon;
grant execute on function public.fso_dismiss_member_blacklist(uuid,text,jsonb) to authenticated;
commit;
