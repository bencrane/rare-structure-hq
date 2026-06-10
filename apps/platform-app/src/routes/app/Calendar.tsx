/**
 * Calendar — the operator cockpit tab behind the "let me check my calendar"
 * close. A packed, navigable week with a one-tap anonymize toggle for turning
 * the screen to a prospect. Authors no geometry — composes the app-local
 * CalendarInstrument (which owns the grid geometry), so `no-route-geometry`
 * passes on the top-level element.
 */
import { CalendarInstrument } from "@/app/calendar/CalendarInstrument";

export default function Calendar() {
  return <CalendarInstrument />;
}
