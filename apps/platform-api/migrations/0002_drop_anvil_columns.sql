-- 0002_drop_anvil_columns.sql — retire the dead Anvil e-sign columns from public.proposals.
--
-- Forward-only. This does NOT touch 0001 (which records what originally ran); it advances the
-- live schema. Applied to the hq-x Supabase Postgres (HQX_DB_URL_*) — the same project the BFF
-- reads via the service-role key.
--
-- WHY. The Anvil e-sign integration was fully removed from code in PR #45. The active execution
-- flow is DocRaptor → Documenso, owned entirely by core-x edge_api against
-- business.engagement_proposals (a DIFFERENT table). platform-api's only direct touch of
-- public.proposals is POST /api/v1/proposals/:ref/send, which reads
-- ref/client_name/client_email/template_label/status and writes status/sent_at — it never reads
-- or writes the Anvil eids. No edge_api code references these columns either. They are dead.
--
-- PRE-DROP VERIFICATION (live hq-x, before this ran): the three columns existed at positions
-- 11–13, with indexes proposals_signer_eid_idx and proposals_packet_eid_idx. The single
-- historical row (ref RS-r1TgWbc2n5SmTGzR88GCGx, status 'created', never sent) carried Anvil-era
-- eids — etch_packet_eid=PhglC3VefbK2NCzt47m8, document_group_eid=Y0i95ib5Yv9zf3vjoSCx,
-- signer_eid=YxAakmpFbglT6cMDV3Ud — referenced by no active path. Dropping discards that residue.
-- (proposals_created_by_idx on created_by is NOT Anvil and is retained.)

-- Drop the Anvil-only indexes explicitly (DROP COLUMN removes them implicitly, but be explicit
-- and idempotent so this is safe to re-run).
drop index if exists public.proposals_signer_eid_idx;
drop index if exists public.proposals_packet_eid_idx;

alter table public.proposals
  drop column if exists etch_packet_eid,
  drop column if exists document_group_eid,
  drop column if exists signer_eid;
