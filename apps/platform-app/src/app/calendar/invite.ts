/**
 * scheduleInvite — the booking side-effect seam.
 *
 * Right now it SIMULATES sending a calendar invitation so the live "book them on
 * the call" flow feels complete with no backend. This is the single function that
 * becomes real later:
 *
 *   operator-initiated booking
 *     → platform-api (BFF)
 *     → trigger.dev task (retry + idempotency)
 *     → Google Calendar `events.insert` with attendees + conferenceData (Meet)
 *       and `sendUpdates: "all"` (Google sends the invite email natively),
 *       OR a cal.com booking against the operator's connected calendar.
 *
 * Recommendation when wired: drive the operator-initiated path through the Google
 * Calendar API on one connected account (a single refresh token in Doppler), NOT
 * cal.com. cal.com's model is event-type + availability — excellent for inbound
 * self-booking (keep it there; it already feeds corex.bookings), but awkward for
 * "drop an arbitrary 4:00p hold and invite this person." Google's API does the
 * arbitrary-event + native-invite job directly.
 */
import type { CalEvent } from "./data";

export interface InviteResult {
  ok: boolean;
  detail: string;
}

export async function scheduleInvite(ev: CalEvent): Promise<InviteResult> {
  // Simulated latency so the toast/transition reads like a real network round-trip.
  await new Promise((resolve) => setTimeout(resolve, 650));

  if (!ev.attendeeEmail) {
    return {
      ok: false,
      detail: "Saved to your calendar — add an attendee email to send an invite.",
    };
  }
  // …real wiring replaces everything above the return with the BFF call.
  return { ok: true, detail: `Invitation queued for ${ev.attendeeEmail}` };
}
