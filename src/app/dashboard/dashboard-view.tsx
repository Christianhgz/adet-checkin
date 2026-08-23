"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SessionOption = {
  name: string;
  location: string;
  capacity: number;
};

type Session = {
  slot: string;
  required: boolean;
  options: SessionOption[];
};

type DayConfig = {
  day: string;
  label: string;
  sessions: Session[];
};

type Metrics = {
  totalRegistered: number;
  totalCheckedIn: number;
  checkInRate: number;
  perEvent: { event: string; attendees: number }[];
};

type SlotAvailability = {
  slot: string;
  event: string;
  location: string;
  capacity: number;
  taken: number;
  full: boolean;
};

type AttendeeDetail = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  checkedIn: boolean;
  checkedInAt: string | null;
  slots: Record<string, string>;
};

export default function DashboardView({ sheetUrl }: { sheetUrl: string }) {
  const [dayConfig, setDayConfig] = useState<DayConfig | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [availability, setAvailability] = useState<SlotAvailability[] | null>(null);
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [roster, setRoster] = useState<AttendeeDetail[] | null>(null);
  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [expandedListEvent, setExpandedListEvent] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "status" | "time">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: "name" | "status" | "time") {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  }

  async function loadAll() {
    try {
      const [dayRes, metricsRes, availabilityRes, attendeesRes] = await Promise.all([
        fetch("/api/day-config"),
        fetch("/api/metrics"),
        fetch("/api/availability"),
        fetch("/api/dashboard/attendees"),
      ]);
      if (dayRes.ok) {
        const data = await dayRes.json();
        setDayConfig(data);
        const slots = (data.sessions as Session[]).map((s) => s.slot);
        setActiveSlot((prev) => (prev && slots.includes(prev) ? prev : slots[0]));
      }
      if (metricsRes.ok) setMetrics(await metricsRes.json());
      if (availabilityRes.ok) {
        const data = await availabilityRes.json();
        setAvailability(data.availability);
      }
      if (attendeesRes.ok) {
        const data = await attendeesRes.json();
        setRoster(data.attendees);
      }
    } catch {
      // Network hiccup or a transient server error — the periodic refresh
      // (or the next manual switch) will retry; nothing to surface here.
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (cancelled) return;
      await loadAll();
    }
    load();
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  async function handleSwitchDay() {
    if (!dayConfig || switching) return;
    const nextDay = dayConfig.day === "saturday" ? "sunday" : "saturday";
    setSwitching(true);
    try {
      await fetch("/api/dashboard/active-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day: nextDay }),
      });
      setSelectedUserId(null);
      setQuery("");
      setExpandedListEvent(null);
      await loadAll();
    } finally {
      setSwitching(false);
    }
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!roster || q.length < 2) return [];
    return roster
      .filter((a) => `${a.firstName} ${a.lastName}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [roster, query]);

  const selectedAttendee = useMemo(
    () => roster?.find((a) => a.userId === selectedUserId) ?? null,
    [roster, selectedUserId],
  );

  const sortedRoster = useMemo(() => {
    if (!roster) return [];
    const dir = sortDir === "asc" ? 1 : -1;
    const byName = (a: AttendeeDetail, b: AttendeeDetail) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);

    const list = [...roster];
    if (sortBy === "name") {
      list.sort((a, b) => dir * byName(a, b));
    } else if (sortBy === "status") {
      list.sort((a, b) => {
        if (a.checkedIn === b.checkedIn) return byName(a, b);
        return dir * (a.checkedIn ? -1 : 1);
      });
    } else {
      list.sort((a, b) => {
        if (!a.checkedInAt && !b.checkedInAt) return byName(a, b);
        if (!a.checkedInAt) return 1;
        if (!b.checkedInAt) return -1;
        return dir * (new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime());
      });
    }
    return list;
  }, [roster, sortBy, sortDir]);

  if (!metrics || !dayConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center text-surface">
        Loading metrics…
      </div>
    );
  }

  const otherDayLabel = dayConfig.day === "saturday" ? "Sunday" : "Saturday";

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

        <div className="bg-surface rounded-3xl shadow-sm border border-border p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-foreground-muted">
            Currently showing: <span className="font-semibold text-foreground">{dayConfig.label}</span>
          </p>
          <button
            onClick={handleSwitchDay}
            disabled={switching}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {switching ? "Switching…" : `Switch to ${otherDayLabel}`}
          </button>
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
            {dayConfig.sessions.map((session) => (
              <button
                key={session.slot}
                type="button"
                onClick={() => setActiveSlot(session.slot)}
                className={`flex-1 rounded-lg px-2 py-2 text-sm font-medium transition-colors ${
                  activeSlot === session.slot
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-foreground-muted hover:text-foreground"
                }`}
              >
                {session.slot}
                {!session.required && (
                  <span className="block text-[10px] font-normal opacity-80">optional</span>
                )}
              </button>
            ))}
          </div>

          <div className="divide-y divide-border">
            {(dayConfig.sessions.find((s) => s.slot === activeSlot)?.options ?? []).map((opt) => {
              const event = opt.name;
              const info = availability?.find((a) => a.slot === activeSlot && a.event === event);
              const expanded = expandedListEvent === event;
              const attendeesHere = (roster ?? [])
                .filter((a) => a.checkedIn && activeSlot && a.slots[activeSlot] === event)
                .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
              return (
                <div key={event} className="py-3">
                  <button
                    type="button"
                    onClick={() => setExpandedListEvent(expanded ? null : event)}
                    className="w-full flex items-center justify-between gap-3 text-left"
                  >
                    <div>
                      <p className="font-medium text-foreground">{event}</p>
                      {info && <p className="text-xs text-foreground-muted">{info.location}</p>}
                    </div>
                    <span className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-lg font-heading font-semibold ${
                          info?.full ? "text-red-600" : "text-olive-darker"
                        }`}
                      >
                        {info ? `${info.taken}/${info.capacity}` : "—"}
                      </span>
                      <svg
                        viewBox="0 0 24 24"
                        className={`h-4 w-4 text-foreground-muted transition-transform ${
                          expanded ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </button>

                  {expanded && (
                    <div className="mt-3 rounded-lg border border-border divide-y divide-border overflow-hidden">
                      {attendeesHere.length === 0 ? (
                        <p className="text-sm text-foreground-muted text-center py-4 px-4">
                          No one checked in for this session yet.
                        </p>
                      ) : (
                        attendeesHere.map((a) => (
                          <div key={a.userId} className="px-4 py-2 text-sm text-foreground">
                            {a.firstName} {a.lastName}
                          </div>
                        ))
                      )}
                    </div>
                  )}
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
                setSelectedUserId(null);
              }}
              placeholder="Search by name…"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-olive"
            />
            {query.trim().length >= 2 && !selectedAttendee && (
              <div className="mt-2 rounded-lg border border-border overflow-hidden">
                {matches.map((a) => (
                  <button
                    key={a.userId}
                    onClick={() => setSelectedUserId(a.userId)}
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
                    setSelectedUserId(null);
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
                {dayConfig.sessions.map((session) => (
                  <p key={session.slot} className="text-sm text-foreground-muted">
                    <span className="font-medium text-foreground">{session.slot}:</span>{" "}
                    {selectedAttendee.slots[session.slot] ??
                      (session.required ? "—" : "Skipped")}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-surface rounded-3xl shadow-sm border border-border p-6">
          <h2 className="text-lg mb-1">All attendees</h2>
          <p className="text-sm text-foreground-muted mb-4">
            {sortedRoster.filter((a) => a.checkedIn).length} of {sortedRoster.length} checked in
          </p>

          <div className="flex gap-2 mb-4">
            {(
              [
                ["name", "Name"],
                ["status", "Status"],
                ["time", "Check-in time"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleSort(key)}
                className={`flex-1 flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-sm font-medium transition-colors ${
                  sortBy === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-foreground-muted hover:text-foreground"
                }`}
              >
                {label}
                {sortBy === key && (
                  <svg
                    viewBox="0 0 24 24"
                    className={`h-3.5 w-3.5 transition-transform ${sortDir === "desc" ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 15l6-6 6 6" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          <div className="max-h-96 overflow-y-auto rounded-lg border border-border divide-y divide-border">
            {sortedRoster.map((a) => (
              <div
                key={a.userId}
                className={`flex items-center justify-between px-4 py-2.5 ${
                  a.checkedIn ? "bg-cream-dark" : ""
                }`}
              >
                <span className="text-sm text-foreground">
                  {a.firstName} {a.lastName}
                </span>
                {a.checkedIn ? (
                  <span className="text-xs text-olive font-medium">
                    Checked in
                    {a.checkedInAt &&
                      ` · ${new Date(a.checkedInAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`}
                  </span>
                ) : (
                  <span className="text-xs text-foreground-muted">Not checked in</span>
                )}
              </div>
            ))}
          </div>
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
