-- 0006_close_crosswalk_contact_phone.sql
-- The Close call-sync resolves the live call by the DIALED NUMBER: Close does not reliably stamp
-- lead_id/contact_id on activity.call webhooks, and "personal number" bridge legs carry the
-- operator's own number with no lead at all. contact_phone holds the digits-normalized best phone
-- pushed to each Close contact (= what Close dials = the webhook's remote_phone), so the offline
-- /api/v1/close/active-call derive matches remote_phone -> contact_phone -> domain.
--
-- Populated by core-x pipelines/gtm/sync_close_crosswalk_to_hqx.py (which also applies this ALTER
-- idempotently). Recorded here to keep the public.close_crosswalk schema-as-code complete.

ALTER TABLE public.close_crosswalk ADD COLUMN IF NOT EXISTS contact_phone text;
CREATE INDEX IF NOT EXISTS close_crosswalk_phone_idx ON public.close_crosswalk (contact_phone);
