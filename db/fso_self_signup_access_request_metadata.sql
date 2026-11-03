-- Applied to project fso-rmrp-portal on 2026-11-03.
-- Registered users never receive an elevated role from user_metadata.
-- This RPC lists metadata for admins only; authorisation remains in fso_profiles.
create or replace function fso_private.access_list_users()
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare result jsonb;
begin
 if (select auth.uid()) is null or not fso_private.has_role(array['admin']::text[]) then
  raise exception 'Доступ к управлению пользователями запрещён' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'user_id',u.id,'email',u.email,'confirmed',u.email_confirmed_at is not null,
  'created_at',u.created_at,'last_sign_in_at',u.last_sign_in_at,
  'role',coalesce(p.role,'employee'),'has_profile',p.user_id is not null,
  'display_name',coalesce(nullif(pg_catalog.btrim(p.display_name),''),
    pg_catalog.left(coalesce(u.raw_user_meta_data->>'display_name',''),120),''),
  'discord',pg_catalog.left(coalesce(u.raw_user_meta_data->>'discord',''),100),
  'self_registered',coalesce(u.raw_user_meta_data->>'signup_source'='cabinet',false)
 ) order by u.created_at desc),'[]'::jsonb) into result
 from (
  select id,email,email_confirmed_at,created_at,last_sign_in_at,raw_user_meta_data
  from auth.users where email is not null order by created_at desc limit 500
 ) u left join public.fso_profiles p on p.user_id=u.id;
 return result;
end
$function$;
