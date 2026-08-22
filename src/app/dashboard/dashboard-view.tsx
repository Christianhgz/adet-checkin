"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EVENTS, EventName, TIME_SLOTS, TimeSlot } from "@/lib/events";

type Metrics = {
  totalRegistered: number;
  totalCheckedIn: number;
  checkInRate: number;
  perEvent: { event: string; attendees: number }[];
};

type SlotAvailability = {
  slot: TimeSlot;
  event: EventName;
  location: string;
  capacity: number;
  taken: number;
  full: boolean;
};

type AttendeeDetail = {
  row: number;
  firstName: string;
  lastName: string;
  email: string;
  checkedIn: boolean;
  checkedInAt: string | null;
  slots: Partial<Record<TimeSlot, EventName>>;
};

export default function DashboardView({ sheetUrl }: { sheetUrl: string }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [availability, setAvailability] = useState<SlotAvailability[] | null>(null);
  const [activeSlot, setActiveSlot] = useState<TimeSlot>(TIME_SLOTS[0]);
  const [roster, setRoster] = useState<AttendeeDetail[] | null>(null);
  const [query, setQuery] = useState("");
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [metricsRes, availabilityRes, attendeesRes] = await Promise.all([
        fetch("/api/metrics"),
        fetch("/api/availability"),
        fetch("/api/dashboard/attendees"),
      ]);
      if (metricsRes.ok) {
        const data = await metricsRes.json();
        if (!cancelled) setMetrics(data);
      }
      if (availabilityRes.ok) {
        const data = await availabilityRes.json();
        if (!cancelled) setAvailability(data.availability);
      }
      if (attendeesRes.ok) {
        const data = await attendeesRes.json();
        if (!cancelled) setRoster(data.attendees);
      }
    }
    load();
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!roster || q.length < 2) return [];
    return roster
      .filter((a) => `${a.firstName} ${a.lastName}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [roster, query]);

  const selectedAttendee = useMemo(
    () => roster?.find((a) => a.row === selectedRow) ?? null,
    [roster, selectedRow],
  );

  if (!metrics) {
    return (
      <div className="min-h-screen flex items-center justify-center text-surface">
        Loading metrics…
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-base underline underline-offset-2 text-surface/70 hover:text-surface transition-colors"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to check-in
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl text-surface">Event check-in dashboard</h1>
          <a
            href={sheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 font-medium hover:bg-primary-hover transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"
              />
            </svg>
            Open Google Sheet
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Registered" value={metrics.totalRegistered} />
          <StatCard label="Checked in" value={metrics.totalCheckedIn} />
          <StatCard label="Check-in rate" value={`${Math.round(metrics.checkInRate * 100)}%`} />
        </div>

        <div className="bg-surface rounded-3xl shadow-sm border border-border p-6">
          <h2 className="text-lg mb-1">Attendees per event</h2>
          <p className="text-sm text-foreground-muted mb-4">
            {metrics.perEvent.map(({ event, attendees }, i) => (
              <span key={event}>
                {i > 0 && " · "}
                {event}: {attendees}
              </span>
            ))}
          </p>

          <div className="flex gap-2 mb-4">
            {TIME_SLOTS.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setActiveSlot(slot)}
                className={`flex-1 rounded-lg px-2 py-2 text-sm font-medium transition-colors ${
                  activeSlot === slot
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-foreground-muted hover:text-foreground"
                }`}
              >
                {slot}
              </button>
            ))}
          </div>

          <div className="divide-y divide-border">
            {EVENTS.map((event) => {
              const info = availability?.find((a) => a.slot === activeSlot && a.event === event);
              return (
                <div key={event} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-foreground">{event}</p>
                    {info && <p className="text-xs text-foreground-muted">{info.location}</p>}
                  </div>
                  <span
                    className={`text-lg font-heading font-semibold ${
                      info?.full ? "text-red-600" : "text-olive-darker"
                    }`}
                  >
                    {info ? `${info.taken}/${info.capacity}` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-surface rounded-3xl shadow-sm border border-border p-6">
          <h2 className="text-lg mb-4">Look up an attendee</h2>

          <div className="relative">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedRow(null);
              }}
              placeholder="Search by name…"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-olive"
            />
            {query.trim().length >= 2 && !selectedAttendee && (
              <div className="mt-2 rounded-lg border border-border overflow-hidden">
                {matches.map((a) => (
                  <button
                    key={a.row}
                    onClick={() => setSelectedRow(a.row)}
                    className="w-full text-left px-4 py-3 hover:bg-cream-dark transition-colors border-b border-border last:border-b-0"
                  >
                    <span className="font-medium text-foreground">
                      {a.firstName} {a.lastName}
                    </span>
                    {a.checkedIn && (
                      <span className="ml-2 text-xs text-olive font-medium">Checked in</span>
                    )}
                  </button>
                ))}
                {matches.length === 0 && (
                  <p className="text-sm text-foreground-muted text-center py-4 px-4">No matches.</p>
                )}
              </div>
            )}
          </div>

          {selectedAttendee && (
            <div className="mt-4 rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">
                    {selectedAttendee.firstName} {selectedAttendee.lastName}
                  </p>
                  <p className="text-sm text-foreground-muted">{selectedAttendee.email}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedRow(null);
                    setQuery("");
                  }}
                  className="shrink-0 text-sm text-foreground-muted underline hover:text-foreground"
                >
                  Clear
                </button>
              </div>

              <p className="text-sm">
                {selectedAttendee.checkedIn ? (
                  <span className="text-olive font-medium">
                    Checked in
                    {selectedAttendee.checkedInAt &&
                      ` at ${new Date(selectedAttendee.checkedInAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`}
                  </span>
                ) : (
                  <span className="text-foreground-muted">Not checked in</span>
                )}
              </p>

              <div className="space-y-1.5">
                {TIME_SLOTS.map((slot) => (
                  <p key={slot} className="text-sm text-foreground-muted">
                    <span className="font-medium text-foreground">{slot}:</span>{" "}
                    {selectedAttendee.slots[slot] ?? "—"}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface rounded-3xl shadow-sm border border-border p-6">
      <p className="text-sm text-foreground-muted">{label}</p>
      <p className="text-3xl font-heading font-semibold text-olive-darker">{value}</p>
    </div>
  );
}
