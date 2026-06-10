/**
 * BookingProfile — the booking-meeting-profile page. Opened from a Pipeline row; shows the
 * cal.com-derived booking we have today (prospect, company, meeting window, status). The
 * richer dossier intelligence + originate land once enrichment is wired — this page is the
 * surface that will populate. Authors no geometry — composes CockpitPage.
 */
import { ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import type { BookingDetail } from "@rare-structure-hq/shared";
import { Badge, Text } from "@rare-structure-hq/ui";

import { CockpitPage, DataRow, Panel, Section } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import { getBooking } from "@/pipeline/api";

const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const SLOT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

function fullName(b: BookingDetail): string {
  const n = [b.firstName, b.lastName].filter(Boolean).join(" ").trim();
  return n || "—";
}

function statusTone(status: string): "info" | "warn" | "success" {
  if (/cancel/i.test(status)) return "warn";
  return status === "booked" ? "info" : "success";
}

function dayOf(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : DAY.format(d);
}

function meetingWindow(b: BookingDetail): string {
  if (!b.startTime) return "—";
  const start = new Date(b.startTime);
  if (Number.isNaN(start.getTime())) return "—";
  if (!b.endTime) return SLOT.format(start);
  const end = new Date(b.endTime);
  return Number.isNaN(end.getTime())
    ? SLOT.format(start)
    : `${SLOT.format(start)} – ${TIME.format(end)}`;
}

export default function BookingProfile() {
  const { bookingId = "" } = useParams();
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!token || !bookingId) return;
    setPhase("loading");
    setError(null);
    getBooking(token, bookingId)
      .then((data) => {
        setBooking(data);
        setPhase("ready");
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Failed to load booking";
        if (/\b404\b/.test(msg)) {
          setPhase("notfound");
        } else {
          setError(msg);
          setPhase("error");
        }
      });
  }, [token, bookingId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const back = (
    <Link to="/app/pipeline" className={backCls}>
      <ChevronLeft className="size-3.5" />
      Pipeline
    </Link>
  );

  if (phase === "loading") {
    return (
      <CockpitPage title="Booking" description="Loading…">
        {back}
      </CockpitPage>
    );
  }
  if (phase === "notfound") {
    return (
      <CockpitPage title="Booking not found" description="This booking no longer exists.">
        {back}
      </CockpitPage>
    );
  }
  if (phase === "error" || !booking) {
    return (
      <CockpitPage title="Booking" description="Couldn’t load this booking.">
        {back}
        <Panel>
          <Text size="mono-xs" mono color="subtle" className="break-words">
            {error}
          </Text>
        </Panel>
      </CockpitPage>
    );
  }

  const b = booking;
  return (
    <CockpitPage
      title={b.companyName || fullName(b)}
      description="Booking captured from cal.com. Enrichment will populate the full dossier."
      actions={<Badge tone={statusTone(b.status)}>{b.status}</Badge>}
    >
      {back}

      <Section label="Prospect">
        <Panel>
          <DataRow label="Name" value={fullName(b)} />
          <DataRow label="Title" value={b.title ?? "—"} />
          <DataRow label="Email" value={b.email ?? "—"} />
        </Panel>
      </Section>

      <Section label="Company">
        <Panel>
          <DataRow label="Company" value={b.companyName ?? "—"} />
          <DataRow label="Domain" value={b.domain ?? "—"} />
        </Panel>
      </Section>

      <Section label="Meeting">
        <Panel>
          <DataRow label="When" value={meetingWindow(b)} />
          <DataRow label="Booked" value={dayOf(b.bookedAt ?? b.createdAt)} />
        </Panel>
      </Section>
    </CockpitPage>
  );
}

const backCls =
  "inline-flex w-fit items-center gap-1.5 font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.12em] transition-colors hover:text-[color:var(--color-text-accent)]";
