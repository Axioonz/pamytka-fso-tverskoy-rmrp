-- Fix staff account creation after PostgREST 42501 on 2026-11-03.
-- The public fso_staff_account_* SQL wrappers invoke non-exposed fso_private
-- functions as service_role. Grant access exclusively to the server role.
-- Anonymous and regular authenticated users retain no EXECUTE on the helpers.

grant usage on schema fso_private to service_role;
grant execute on function fso_private.staff_account_bind(uuid,uuid,uuid,text) to service_role;
grant execute on function fso_private.staff_account_activate(uuid) to service_role;
grant execute on function fso_private.staff_account_reset(uuid,uuid) to service_role;

-- Verify with the following read-only query.
-- select
--  has_schema_privilege('service_role','fso_private','USAGE') as schema_usage,
--  has_function_privilege('service_role','fso_private.staff_account_bind(uuid,uuid,uuid,text)','EXECUTE') as can_bind,
--  has_function_privilege('authenticated','fso_private.staff_account_bind(uuid,uuid,uuid,text)','EXECUTE') as browser_cannot_bind;
