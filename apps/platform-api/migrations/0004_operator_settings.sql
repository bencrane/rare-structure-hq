-- 0004_operator_settings.sql
--
-- Per-operator cockpit settings, keyed by the operator's Supabase auth user id (the JWT `sub`
-- the BFF validates via JWKS). Currently holds one setting: the originate `render_mode` toggle
-- surfaced in the Settings tab —
--   'through-docraptor'   (default) — render the agreement PDF via DocRaptor → Documenso envelope
--   'direct-to-documenso'           — the no-DocRaptor pathway (wired separately)
--
-- Lives in `public` so the BFF's service-role supabase-js client can read/write it directly
-- (`db().from('operator_settings')`); `business.*` is not PostgREST-exposed. RLS is enabled with
-- NO policies and zero grants to anon/authenticated, so the table is reachable ONLY via the
-- service-role key (which bypasses RLS) held server-side by the BFF.

create table if not exists public.operator_settings (
  auth_user_id uuid        primary key,
  render_mode  text        not null default 'through-docraptor'
    check (render_mode in ('through-docraptor', 'direct-to-documenso')),
  updated_at   timestamptz not null default now()
);

alter table public.operator_settings enable row level security;

revoke all on public.operator_settings from anon, authenticated;
grant  all on public.operator_settings to   service_role;
