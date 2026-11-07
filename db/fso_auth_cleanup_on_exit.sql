-- Preserve service history while allowing permanent Auth account deletion.
begin;
alter table public.fso_service_requests alter column submitted_by drop not null;
alter table public.fso_service_leaves alter column approved_by drop not null;
alter table public.fso_post_assignments alter column user_id drop not null;

do $migration$
declare row record;
begin
 for row in
  select c.conrelid::regclass as table_name,c.conname,
         a.attname as column_name,c.confdeltype
  from pg_constraint c
  join pg_class cl on cl.oid=c.conrelid
  join pg_namespace n on n.oid=cl.relnamespace
  join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
  where c.contype='f' and c.confrelid='auth.users'::regclass
    and n.nspname in ('public','fso_private')
    and array_length(c.conkey,1)=1
    and c.conrelid not in ('public.fso_members'::regclass,'public.fso_profiles'::regclass)
    and c.confdeltype<>'n'
 loop
  execute format('alter table %s drop constraint %I',row.table_name,row.conname);
  execute format('alter table %s add constraint %I foreign key (%I) references auth.users(id) on delete set null',
                 row.table_name,row.conname,row.column_name);
 end loop;
end
$migration$;

-- A dismissed employee is locked out even if Auth deletion has to be retried.
create or replace function fso_private.dismiss_member(
  p_member uuid,p_reason text,p_evidence jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare actor uuid; member_status text; linked_user uuid;
        proof_list jsonb:=coalesce(p_evidence,'[]'::jsonb);
begin
 actor:=fso_private.require_discipline_manager();
 if length(pg_catalog.btrim(coalesce(p_reason,''))) < 5 or length(p_reason)>4000 then
  raise exception 'Укажите причину увольнения (от 5 до 4000 символов)';
 end if;
 if pg_catalog.jsonb_typeof(proof_list)<>'array' or pg_catalog.jsonb_array_length(proof_list)>15 then
  raise exception 'Доказательства должны быть списком до 15 ссылок';
 end if;
 if pg_catalog.jsonb_array_length(proof_list)>0 then
  perform fso_private.validate_discipline_evidence(proof_list);
 end if;
 select status,user_id into member_status,linked_user
 from public.fso_members where id=p_member for update;
 if not found then raise exception 'Сотрудник не найден';end if;
 if member_status in ('dismissed','archived') then raise exception 'Сотрудник уже уволен';end if;
 if linked_user=actor then raise exception 'Нельзя удалять собственный административный доступ через увольнение';end if;

 perform pg_catalog.set_config('fso.dismiss_authorized','yes',true);
 update public.fso_members set status='dismissed',dismissed_on=current_date where id=p_member;
 perform pg_catalog.set_config('fso.dismiss_authorized','no',true);
 if linked_user is not null then
  update public.fso_profiles set role='employee_pending',updated_at=now()
   where user_id=linked_user;
 end if;
 insert into public.fso_disciplinary_audit(member_id,performed_by,event,details)
 values(p_member,actor,'dismissed',pg_catalog.jsonb_build_object(
  'reason',pg_catalog.btrim(p_reason),'evidence',proof_list,'basis','management_decision'));
 return pg_catalog.jsonb_build_object('member_id',p_member,'status','dismissed');
end
$function$;
revoke all on function fso_private.dismiss_member(uuid,text,jsonb) from public,anon;
grant execute on function fso_private.dismiss_member(uuid,text,jsonb) to authenticated;

-- Lock any lingering linked account when a dismissed employee is blacklisted.
create or replace function fso_private.blacklist_lock_account()
returns trigger language plpgsql security definer set search_path to ''
as $function$
declare uid uuid;
begin
 select m.user_id into uid from public.fso_members m where m.id=new.member_id;
 if uid is not null then
  update public.fso_profiles set role='employee_pending',updated_at=now() where user_id=uid;
 end if;
 return new;
end
$function$;
drop trigger if exists fso_blacklist_lock_account on public.fso_blacklist;
create trigger fso_blacklist_lock_account after insert on public.fso_blacklist
for each row execute function fso_private.blacklist_lock_account();
commit;