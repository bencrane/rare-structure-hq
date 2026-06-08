-- 0001_proposals.sql — proposal records for the one-click instantiate flow.
--
-- Applied once to the hq-rare-structure-hq Supabase Postgres via RSH_DB_URL_POOLED.
-- platform-api reads/writes with the SERVICE-ROLE key (RLS bypassed); there are
-- deliberately NO anon/auth policies, so the table is unreachable from the browser.
--
-- `headline` snapshots the shell digest at create time (term rows the client sees);
-- `field_values` is the full data payload bound into the Anvil cast at sign time.

create table if not exists public.proposals (
  ref                 text primary key,
  template_id         text        not null,
  client_name         text        not null,
  client_email        text,
  client_title        text,
  field_values        jsonb       not null default '{}'::jsonb,
  headline            jsonb       not null default '[]'::jsonb,
  exec_summary        text        not null default '',
  template_label      text        not null default '',
  status              text        not null default 'created'
                        check (status in ('created', 'sent', 'signed', 'paid')),
  etch_packet_eid     text,
  document_group_eid  text,
  signer_eid          text,
  created_by          text,
  created_at          timestamptz not null default now(),
  sent_at             timestamptz,
  signed_at           timestamptz,
  paid_at             timestamptz
);

-- Webhook lookups resolve a record from the Anvil signer/packet eid.
create index if not exists proposals_signer_eid_idx on public.proposals (signer_eid);
create index if not exists proposals_packet_eid_idx on public.proposals (etch_packet_eid);
create index if not exists proposals_created_by_idx on public.proposals (created_by);

alter table public.proposals enable row level security;
-- No policies on purpose: the service-role key bypasses RLS; anon/auth get nothing.
