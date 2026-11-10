-- Department-specific internal materials.
-- Tables live in fso_private and are never exposed by the Data API.
create table if not exists fso_private.subdivision_pages (
 department text primary key check (department in ('АС','УЛО','Академия')),
 essentials text not null default '',
 promotion_rules text not null default '',
 uniform_rules text not null default '',
 service_contacts text not null default '',
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
create table if not exists fso_private.subdivision_announcements (
 id uuid primary key default gen_random_uuid(),
 department text not null references fso_private.subdivision_pages(department) on delete cascade,
 title text not null check (char_length(title) between 4 and 180),
 body text not null check (char_length(body) between 10 and 6000),
 published_by uuid references auth.users(id) on delete set null,
 published_at timestamptz not null default now()
);
create index if not exists subdivision_announcements_feed
 on fso_private.subdivision_announcements (department,published_at desc);
revoke all on fso_private.subdivision_pages from public,anon,authenticated;
revoke all on fso_private.subdivision_announcements from public,anon,authenticated;
insert into fso_private.subdivision_pages(department)
values ('АС'),('УЛО'),('Академия') on conflict (department) do nothing;

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
  order by array_position(array['АС','УЛО','Академия']::text[],pg.department)
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
 if p_department is null or p_department not in ('АС','УЛО','Академия') then
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
 if p_department is null or p_department not in ('АС','УЛО','Академия') then
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

create or replace function fso_private.subdivision_announcement_delete(p_id uuid)
returns boolean
language plpgsql security definer set search_path to ''
as $function$
begin
 perform fso_private.require_personnel_manager();
 delete from fso_private.subdivision_announcements where id=p_id;
 return found;
end $function$;

create or replace function public.fso_subdivisions_read()
returns jsonb language sql set search_path to ''
as $function$ select fso_private.subdivision_directory() $function$;

create or replace function public.fso_subdivision_save(
 p_department text,p_essentials text,p_promotion text,p_uniform text,p_contacts text
) returns jsonb language sql set search_path to ''
as $function$
 select fso_private.subdivision_save(p_department,p_essentials,p_promotion,p_uniform,p_contacts)
$function$;

create or replace function public.fso_subdivision_announcement_publish(
 p_department text,p_title text,p_body text
) returns uuid language sql set search_path to ''
as $function$
 select fso_private.subdivision_announcement_publish(p_department,p_title,p_body)
$function$;

create or replace function public.fso_subdivision_announcement_delete(p_id uuid)
returns boolean language sql set search_path to ''
as $function$
 select fso_private.subdivision_announcement_delete(p_id)
$function$;

revoke all on function public.fso_subdivisions_read() from public,anon;
revoke all on function public.fso_subdivision_save(text,text,text,text,text) from public,anon;
revoke all on function public.fso_subdivision_announcement_publish(text,text,text) from public,anon;
revoke all on function public.fso_subdivision_announcement_delete(uuid) from public,anon;
revoke all on function fso_private.subdivision_directory() from public,anon;
revoke all on function fso_private.subdivision_save(text,text,text,text,text) from public,anon;
revoke all on function fso_private.subdivision_announcement_publish(text,text,text) from public,anon;
revoke all on function fso_private.subdivision_announcement_delete(uuid) from public,anon;
grant execute on function public.fso_subdivisions_read() to authenticated;
grant execute on function public.fso_subdivision_save(text,text,text,text,text) to authenticated;
grant execute on function public.fso_subdivision_announcement_publish(text,text,text) to authenticated;
grant execute on function public.fso_subdivision_announcement_delete(uuid) to authenticated;
grant execute on function fso_private.subdivision_directory() to authenticated;
grant execute on function fso_private.subdivision_save(text,text,text,text,text) to authenticated;
grant execute on function fso_private.subdivision_announcement_publish(text,text,text) to authenticated;
grant execute on function fso_private.subdivision_announcement_delete(uuid) to authenticated;
