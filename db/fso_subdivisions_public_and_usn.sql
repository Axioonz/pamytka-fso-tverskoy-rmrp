-- УСН: четвёртое подразделение и публичная информация об отделах.
-- Частные материалы по-прежнему доступны только через защищённые RPC.
begin;

alter table public.fso_members drop constraint if exists fso_members_subdivision_status_check;
alter table public.fso_members add constraint fso_members_subdivision_status_check check (
 (status in ('dismissed','archived') and (department is null or department in ('АС','УЛО','УСН','Академия')))
 or (status='cadet' and department='Академия')
 or (status='active' and department in ('АС','УЛО','УСН'))
);

alter table fso_private.subdivision_pages drop constraint if exists subdivision_pages_department_check;
alter table fso_private.subdivision_pages add constraint subdivision_pages_department_check
 check (department in ('АС','УЛО','УСН','Академия'));
alter table fso_private.subdivision_pages
 add column if not exists public_description text not null default '';
alter table fso_private.subdivision_pages
 add constraint subdivision_public_description_length check (char_length(public_description)<=3000);
insert into fso_private.subdivision_pages(department) values ('УСН') on conflict (department) do nothing;
update fso_private.subdivision_pages set public_description='Служебный порядок и требования подразделения АС. Подробности о задачах отдела и правилах службы публикует руководство.' where department='АС' and public_description='';
update fso_private.subdivision_pages set public_description='Правила службы и организация работы подразделения УЛО. Подробности о его задачах публикует руководство.' where department='УЛО' and public_description='';
update fso_private.subdivision_pages set public_description='Подготовка курсантов. Здесь размещается общая информация об обучении и деятельности Академии.' where department='Академия' and public_description='';
update fso_private.subdivision_pages set public_description='Информация о работе УСН. Назначение подразделения и условия службы уточняются руководством.' where department='УСН' and public_description='';

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
 if new_department not in ('АС','Академия','УЛО','УСН') or new_department = '' then
   raise exception 'Выберите подразделение: АС, Академия, УЛО или УСН';
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
 if chosen not in ('АС','Академия','УЛО','УСН') or chosen='' then
   raise exception 'Выберите подразделение: АС, Академия, УЛО или УСН';
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

create or replace function fso_private.subdivision_directory()
returns jsonb
language plpgsql security definer set search_path to ''
as $function$
declare
 actor uuid:=(select auth.uid());
 is_manager boolean;
 result jsonb;
begin
 if actor is null then raise exception 'Требуется авторизация' using errcode='42501'; end if;
 if not fso_private.has_role(array['admin','hr','examiner','employee','cadet']::text[]) then
  raise exception 'Нет доступа к служебным материалам' using errcode='42501';
 end if;
 is_manager:=fso_private.has_role(array['admin','hr']::text[]);
 select coalesce(jsonb_agg(
  jsonb_build_object(
   'department',pg.department,
   'essentials',pg.essentials,
   'promotion_rules',pg.promotion_rules,
   'uniform_rules',pg.uniform_rules,
   'service_contacts',pg.service_contacts,
   'updated_at',pg.updated_at,
   'announcements',coalesce((
    select jsonb_agg(jsonb_build_object(
     'id',n.id,'title',n.title,'body',n.body,
     'published_at',n.published_at,'author',coalesce(
      (select nullif(btrim(p.display_name),'') from public.fso_profiles p where p.user_id=n.published_by),
      'Руководство'
     )
    ) order by n.published_at desc)
    from (select a.id,a.title,a.body,a.published_at,a.published_by
     from fso_private.subdivision_announcements a
     where a.department=pg.department
     order by a.published_at desc limit 30) n
   ),'[]'::jsonb)
  )
  order by array_position(array['АС','УЛО','УСН','Академия']::text[],pg.department)
 ),'[]'::jsonb) into result
 from fso_private.subdivision_pages pg
 where is_manager or exists (
  select 1 from public.fso_members m
  where m.user_id=actor and m.status in ('active','cadet')
    and m.department=pg.department
 );
 return result;
end $function$;

create or replace function fso_private.subdivision_save(
 p_department text,p_essentials text,p_promotion text,
 p_uniform text,p_contacts text
) returns jsonb
language plpgsql security definer set search_path to ''
as $function$
declare editor uuid;
begin
 editor:=fso_private.require_personnel_manager();
 if p_department is null or p_department not in ('АС','УЛО','Академия','УСН') then
  raise exception 'Неизвестное подразделение';
 end if;
 if char_length(coalesce(p_essentials,''))>8000
 or char_length(coalesce(p_promotion,''))>8000
 or char_length(coalesce(p_uniform,''))>8000
 or char_length(coalesce(p_contacts,''))>8000 then
  raise exception 'Превышена максимальная длина раздела';
 end if;
 update fso_private.subdivision_pages
 set essentials=btrim(coalesce(p_essentials,'')),
     promotion_rules=btrim(coalesce(p_promotion,'')),
     uniform_rules=btrim(coalesce(p_uniform,'')),
     service_contacts=btrim(coalesce(p_contacts,'')),
     updated_by=editor,updated_at=now()
 where department=p_department;
 if not found then raise exception 'Подразделение не найдено'; end if;
 return jsonb_build_object('department',p_department,'updated',true);
end $function$;

create or replace function fso_private.subdivision_announcement_publish(
 p_department text,p_title text,p_body text
) returns uuid
language plpgsql security definer set search_path to ''
as $function$
declare editor uuid; new_id uuid;
begin
 editor:=fso_private.require_personnel_manager();
 if p_department is null or p_department not in ('АС','УЛО','Академия','УСН') then
  raise exception 'Неизвестное подразделение';
 end if;
 if char_length(btrim(coalesce(p_title,''))) not between 4 and 180
 or char_length(btrim(coalesce(p_body,''))) not between 10 and 6000 then
  raise exception 'Название от 4 до 180 символов, текст от 10 до 6000 символов';
 end if;
 insert into fso_private.subdivision_announcements(department,title,body,published_by)
 values(p_department,btrim(p_title),btrim(p_body),editor)
 returning id into new_id;
 return new_id;
end $function$;

-- Публичный RPC читает ТОЛЬКО разрешённые поля, без служебных материалов.
create or replace function public.fso_subdivisions_public()
returns jsonb
language sql stable security definer set search_path to ''
as $function$
 select coalesce(
  jsonb_agg(jsonb_build_object(
    'department',p.department,'description',p.public_description
  ) order by array_position(array['АС','УЛО','УСН','Академия']::text[],p.department)),
  '[]'::jsonb
 )
 from fso_private.subdivision_pages p
$function$;

create or replace function public.fso_subdivision_public_save(p_department text,p_description text)
returns boolean
language plpgsql security definer set search_path to ''
as $function$
begin
 perform fso_private.require_personnel_manager();
 if p_department not in ('АС','УЛО','УСН','Академия') or p_department is null then
  raise exception 'Неизвестное подразделение';
 end if;
 if char_length(coalesce(p_description,''))>3000 then
  raise exception 'Описание не должно превышать 3000 символов';
 end if;
 update fso_private.subdivision_pages
 set public_description=pg_catalog.btrim(coalesce(p_description,'')),
     updated_by=(select auth.uid()),updated_at=now()
 where department=p_department;
 if not found then raise exception 'Подразделение не найдено'; end if;
 return true;
end $function$;

revoke all on function public.fso_subdivisions_public() from public,anon,authenticated;
grant execute on function public.fso_subdivisions_public() to anon,authenticated;
revoke all on function public.fso_subdivision_public_save(text,text) from public,anon,authenticated;
grant execute on function public.fso_subdivision_public_save(text,text) to authenticated;
commit;
