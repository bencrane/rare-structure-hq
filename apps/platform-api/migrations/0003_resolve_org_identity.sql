-- 0003_resolve_org_identity.sql
--
-- Read-only identity resolver for the BFF `/api/v1/me` endpoint.
--
-- The `business.*` schema (organizations / users / organization_memberships) is NOT
-- exposed to PostgREST — only `public` and `graphql_public` are. Rather than expose a
-- shared-project schema (project-wide blast radius, RLS currently off on those tables),
-- the BFF reaches the identity tables through this single `public` SECURITY DEFINER
-- function, called via the existing supabase-js client: db().rpc('resolve_org_identity').
--
-- It only READS business.* — never writes — so single-writer ownership of the identity
-- tables (the provisioning path) is preserved. EXECUTE is granted to service_role only;
-- the BFF holds the service-role key server-side and never exposes it to the browser.

create or replace function public.resolve_org_identity(p_auth_user_id uuid)
returns table (
  org_id        uuid,
  org_name      text,
  org_slug      text,
  org_domain    text,
  org_role      text,
  platform_role text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id                  as org_id,
    o.name                as org_name,
    o.slug                as org_slug,
    o.metadata ->> 'domain' as org_domain,
    m.org_role            as org_role,
    u.platform_role       as platform_role
  from business.users u
  join business.organization_memberships m
    on m.user_id = u.id
   and m.status = 'active'
  join business.organizations o
    on o.id = m.organization_id
   and o.deleted_at is null
  where u.auth_user_id = p_auth_user_id
  order by m.created_at asc
  limit 1
$$;

revoke all on function public.resolve_org_identity(uuid) from public, anon, authenticated;
grant execute on function public.resolve_org_identity(uuid) to service_role;
