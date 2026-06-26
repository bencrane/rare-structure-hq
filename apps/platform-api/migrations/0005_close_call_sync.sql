-- 0005_close_call_sync.sql
-- Close.com → Insights call-sync state (Phase 2 of the dialer<->briefing wiring).
--
-- House pattern (matches 0001_proposals / 0004_operator_settings): public schema, RLS
-- ENABLED with ZERO policies, granted to service_role only. The BFF mediates all access on
-- the service-role key; anon/authenticated get nothing and the browser never reads these
-- tables directly.
--
-- Transport is deliberately BFF-mediated (Postgres LISTEN/NOTIFY -> BFF SSE -> Insights tab),
-- NOT browser PostgREST/Realtime. So these tables are intentionally NOT granted to
-- authenticated and NOT added to the supabase_realtime publication.

-- ── live "now dialing" pointer — exactly one row per operator (last-write-wins) ──────────
create table if not exists public.active_call_signal (
  auth_user_id        uuid        primary key,   -- the operator (== auth.uid(), per operator_settings)
  close_call_id       text,
  close_lead_id       text,
  close_contact_id    text,
  normalized_domain   text,                      -- briefing anchor (== Close lead custom 'company_domain')
  resolved_contact_id text,                      -- active/people.contact_id passthrough
  company_name        text,                      -- denormalized header (instant render before briefing fetch)
  contact_name        text,
  contact_title       text,
  remote_phone        text,
  direction           text,
  status              text        not null default 'dialing'
                        check (status in ('dialing', 'answered', 'completed')),
  started_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.active_call_signal enable row level security;
revoke all on public.active_call_signal from anon, authenticated;
grant  all on public.active_call_signal to   service_role;

-- ── lead/contact -> identity crosswalk (the webhook resolves an incoming call against this) ─
-- Contact-grain (close_contact_id unique); a lead's contacts all share its normalized_domain.
-- Mirrored from the core-x Lance ledger active/close_sfnet_leads by the crosswalk sync job.
create table if not exists public.close_crosswalk (
  close_contact_id    text        primary key,
  close_lead_id       text        not null,
  normalized_domain   text,
  resolved_contact_id text,                      -- active/people.contact_id
  sfnet_company_id    text,
  sfnet_person_id     text,
  company_name        text,
  pushed_at           timestamptz
);

create index if not exists close_crosswalk_lead_idx   on public.close_crosswalk (close_lead_id);
create index if not exists close_crosswalk_domain_idx on public.close_crosswalk (normalized_domain);

alter table public.close_crosswalk enable row level security;
revoke all on public.close_crosswalk from anon, authenticated;
grant  all on public.close_crosswalk to   service_role;
