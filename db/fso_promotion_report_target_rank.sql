-- Store the requested military rank separately from the report's evidence.
-- Existing promotion reports are retained with NULL target_rank.
alter table public.fso_service_requests
 add column if not exists target_rank text;

alter table public.fso_service_requests
 drop constraint if exists fso_service_requests_target_rank_check;
alter table public.fso_service_requests
 add constraint fso_service_requests_target_rank_check
 check (target_rank is null or
        (kind='promotion' and target_rank in ('Рядовой','Ефрейтор','Младший сержант','Сержант','Старший сержант','Старшина','Прапорщик','Старший прапорщик','Младший лейтенант','Лейтенант','Старший лейтенант','Капитан','Майор','Подполковник','Полковник','Генерал-майор')));

-- Validate the selected rank and reuse the existing permissions and audit trail
-- of the regular report-submission function.
create or replace function fso_private.submit_promotion_request(
 p_member uuid,p_statement text,p_target_rank text
) returns uuid
language plpgsql security definer set search_path to ''
as $function$
declare
 current_rank text;
 current_status text;
 ranks text[]:=array['Рядовой','Ефрейтор','Младший сержант','Сержант','Старший сержант','Старшина','Прапорщик','Старший прапорщик','Младший лейтенант','Лейтенант','Старший лейтенант','Капитан','Майор','Подполковник','Полковник','Генерал-майор'];
 request_id uuid;
begin
 select m.rank,m.status into current_rank,current_status
 from public.fso_members m where m.id=p_member;
 if not found then raise exception 'Личное дело не найдено'; end if;
 if current_status not in ('active','cadet') then
  raise exception 'Рапорт на повышение доступен только действующему составу';
 end if;
 if p_target_rank is null or pg_catalog.array_position(ranks,p_target_rank) is null then
  raise exception 'Выберите корректное воинское звание';
 end if;
 if pg_catalog.array_position(ranks,current_rank) is null then
  raise exception 'Текущее воинское звание сотрудника не установлено';
 end if;
 if pg_catalog.array_position(ranks,p_target_rank)<=pg_catalog.array_position(ranks,current_rank) then
  raise exception 'Укажите воинское звание выше текущего';
 end if;
 request_id:=fso_private.submit_service_request(
  p_member,'promotion',p_statement,null,null);
 update public.fso_service_requests
 set target_rank=p_target_rank where id=request_id;
 return request_id;
end
$function$;

revoke all on function fso_private.submit_promotion_request(uuid,text,text)
 from public,anon;
grant execute on function fso_private.submit_promotion_request(uuid,text,text)
 to authenticated;

create or replace function public.fso_promotion_request_submit(
 p_member uuid,p_statement text,p_target_rank text
) returns uuid language sql set search_path to ''
as $function$
 select fso_private.submit_promotion_request(p_member,p_statement,p_target_rank)
$function$;

revoke all on function public.fso_promotion_request_submit(uuid,text,text)
 from public,anon;
grant execute on function public.fso_promotion_request_submit(uuid,text,text)
 to authenticated;
