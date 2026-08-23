"use client";

import Image from "next/image";
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

type Match = {
  userId: string;
  firstName: string;
  lastName: string;
  events: string[];
  checkedIn: boolean;
  checkedInAt: string | null;
  slots: Record<string, string>;
};

type CheckInResult = {
  alreadyCheckedIn: boolean;
  checkedInAt: string;
  selections: Record<string, string>;
};

export default function CheckInPage() {
  const [dayConfig, setDayConfig] = useState<DayConfig | null>(null);
  const [query, setQuery] = useState("");
  const [roster, setRoster] = useState<Match[] | null>(null);
  const [rosterError, setRosterError] = useState(false);
  const [selected, setSelected] = useState<Match | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);

  function loadRoster() {
    setRosterError(false);
    return Promise.all([fetch("/api/day-config"), fetch("/api/attendees")])
      .then(async ([dayRes, attendeesRes]) => {
        if (!dayRes.ok || !attendeesRes.ok) throw new Error("Failed to load");
        const dayData = await dayRes.json();
        const attendeesData = await attendeesRes.json();
        setDayConfig(dayData);
        setRoster(attendeesData.attendees ?? []);
      })
      .catch(() => {
        setRosterError(true);
        setRoster((prev) => prev ?? []);
      });
  }

  useEffect(() => {
    loadRoster();
  }, []);

  async function selectAttendee(match: Match) {
    setSelected(match);
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/attendee-status?userId=${encodeURIComponent(match.userId)}`);
      if (res.ok) {
        const fresh = await res.json();
        setSelected((prev) => (prev && prev.userId === fresh.userId ? { ...prev, ...fresh } : prev));
      }
    } catch {
      // Network hiccup — fall back to the (possibly slightly stale) search
      // result rather than blocking the attendee entirely.
    } finally {
      setStatusLoading(false);
    }
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!roster || q.length < 2) return [];
    return roster
      .filter((a) => `${a.firstName} ${a.lastName}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [roster, query]);

  // Every option, across every session, keyed by name — a name is unique
  // within a day even though Saturday repeats the same options in each
  // session (same capacity each time) and Sunday's options never repeat.
  const optionInfo = useMemo(() => {
    const map = new Map<string, SessionOption>();
    if (!dayConfig) return map;
    for (const session of dayConfig.sessions) {
      for (const option of session.options) {
        map.set(option.name, option);
      }
    }
    return map;
  }, [dayConfig]);

  const takenCounts = useMemo(() => {
    const map = new Map<string, number>();
    if (!roster || !dayConfig) return map;
    for (const a of roster) {
      if (!a.checkedIn) continue;
      for (const session of dayConfig.sessions) {
        const event = a.slots[session.slot];
        if (event) map.set(`${session.slot}|${event}`, (map.get(`${session.slot}|${event}`) ?? 0) + 1);
      }
    }
    return map;
  }, [roster, dayConfig]);

  function isFull(slot: string, optionName: string) {
    const taken = takenCounts.get(`${slot}|${optionName}`) ?? 0;
    const capacity = optionInfo.get(optionName)?.capacity ?? Infinity;
    return taken >= capacity;
  }

  function pickOption(slot: string, optionName: string) {
    setSelections((prev) => {
      const next = { ...prev };
      // An option can only live in one session's slot at a time — clear it
      // from wherever it currently is (matters for Saturday, where the same
      // 4 options are offered in every session).
      for (const s of Object.keys(next)) {
        if (next[s] === optionName) delete next[s];
      }
      if (prev[slot] !== optionName) {
        next[slot] = optionName;
      }
      return next;
    });
  }

  function skipSession(slot: string) {
    setSelections((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  }

  function toggleExpand(slot: string) {
    setExpandedSession((prev) => (prev === slot ? null : slot));
  }

  async function handleConfirm() {
    if (!selected || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selected.userId, selections }),
      });
      let data: { error?: string; alreadyCheckedIn?: boolean; checkedInAt?: string; selections?: Record<string, string> };
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setResult({
        alreadyCheckedIn: data.alreadyCheckedIn ?? false,
        checkedInAt: data.checkedInAt ?? new Date().toISOString(),
        selections: data.selections ?? {},
      });
      loadRoster();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function closeModal() {
    setQuery("");
    setSelected(null);
    setSelections({});
    setExpandedSession(null);
    setResult(null);
    setError("");
    setSubmitting(false);
    setStatusLoading(false);
  }

  const requiredSessions = dayConfig?.sessions.filter((s) => s.required) ?? [];
  const optionalSessions = dayConfig?.sessions.filter((s) => !s.required) ?? [];
  const requiredFilled = requiredSessions.every((s) => selections[s.slot]);
  const ready = roster !== null && dayConfig !== null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md bg-surface rounded-3xl shadow-sm border border-border p-8 space-y-6">
        <div className="text-center space-y-2">
          <Image
            src="/adet-logo-green.svg"
            alt="ADET logo"
            width={160}
            height={113}
            className="h-24 w-auto mx-auto"
            priority
          />
          <h1 className="text-3xl">check-in</h1>
          <p className="text-base text-foreground-muted">
            {dayConfig ? `${dayConfig.label} — find your name to check in` : "Find your name to check in"}
          </p>
        </div>

        <div className="relative">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={!ready}
            placeholder={ready ? "Type your first or last name" : "Loading attendee list…"}
            className="w-full rounded-lg border border-border bg-background px-4 py-3 pr-10 text-base text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-olive disabled:opacity-60"
          />

          {query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full text-foreground-muted hover:bg-cream-dark hover:text-foreground transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}

          {!ready && !rosterError && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-foreground-muted">
              <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin text-olive" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeOpacity="0.25"
                />
                <path
                  d="M21 12a9 9 0 0 0-9-9"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              Loading attendee list…
            </div>
          )}

          {rosterError && (
            <div className="flex items-center justify-between gap-2 mt-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span>Couldn&apos;t load the attendee list. Please try again.</span>
              <button
                type="button"
                onClick={loadRoster}
                className="shrink-0 font-medium underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}

          {ready && !rosterError && query.trim().length >= 2 && (
            <div className="absolute left-0 right-0 top-full mt-2 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg z-20">
              {matches.map((m) => (
                <button
                  key={m.userId}
                  onClick={() => selectAttendee(m)}
                  className="w-full text-left px-4 py-3 hover:bg-cream-dark transition-colors border-b border-border last:border-b-0"
                >
                  <span className="font-medium text-foreground">
                    {m.firstName} {m.lastName}
                  </span>
                  {m.checkedIn && (
                    <span className="ml-2 text-xs text-olive font-medium">Already checked in</span>
                  )}
                </button>
              ))}
              {matches.length === 0 && (
                <p className="text-sm text-foreground-muted text-center py-4 px-4">
                  No matches. Check the spelling, or ask a staff member for help.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="text-center">
          <Link
            href="/dashboard"
            className="text-sm underline underline-offset-2 text-foreground-muted/60 hover:text-foreground-muted transition-colors"
          >
            Admin dashboard
          </Link>
        </div>
      </div>

      {selected && dayConfig && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-olive-darker/40 backdrop-blur-sm px-4 py-8"
          onClick={closeModal}
        >
          <div
            className="relative w-full max-w-md max-h-full overflow-y-auto bg-surface rounded-3xl shadow-lg border border-border p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeModal}
              aria-label="Close"
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-foreground-muted hover:bg-cream-dark hover:text-foreground transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>

            {statusLoading && (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-foreground-muted">
                <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin text-olive" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                  <path
                    d="M21 12a9 9 0 0 0-9-9"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
                Checking status…
              </div>
            )}

            {!statusLoading && !result && selected.checkedIn && (
              <div className="text-center space-y-4 pt-4">
                <p className="text-xl font-semibold text-foreground">
                  {selected.firstName} {selected.lastName} is already checked in
                </p>
                <div className="text-left space-y-1.5">
                  {dayConfig.sessions.map((session) => {
                    const event = selected.slots[session.slot];
                    const location = event ? optionInfo.get(event)?.location : undefined;
                    return (
                      <p key={session.slot} className="text-sm text-foreground-muted">
                        <span className="font-medium text-foreground">{session.slot}:</span>{" "}
                        {event
                          ? `${event}${location ? ` — ${location}` : ""}`
                          : session.required
                            ? "—"
                            : "Skipped"}
                      </p>
                    );
                  })}
                </div>
                {selected.checkedInAt && (
                  <p className="text-sm text-foreground-muted">
                    {new Date(selected.checkedInAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
            )}

            {!statusLoading && !result && !selected.checkedIn && (
              <div className="space-y-5 pt-4">
                <div className="text-center">
                  <p className="text-foreground-muted text-sm">Confirm this is you:</p>
                  <p className="text-xl font-semibold text-foreground mt-1">
                    {selected.firstName} {selected.lastName}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground mb-3">
                    {optionalSessions.length === 0
                      ? `Pick one seminar for each of the ${dayConfig.sessions.length} sessions`
                      : `Pick one seminar for each required session — ${optionalSessions
                          .map((s) => s.slot)
                          .join(", ")} is optional and can be skipped`}
                  </p>
                  <div className="space-y-3">
                    {dayConfig.sessions.map((session) => {
                      const picked = selections[session.slot];
                      const sessionDone = Boolean(picked);
                      const expanded = expandedSession === session.slot || sessionDone;
                      return (
                        <div
                          key={session.slot}
                          className={`rounded-lg border transition-colors ${
                            sessionDone ? "border-olive bg-cream-dark" : "border-border"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleExpand(session.slot)}
                            className="w-full flex items-center gap-3 p-3 text-left"
                          >
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                                sessionDone ? "bg-olive border-olive" : "border-border"
                              }`}
                            >
                              {sessionDone && (
                                <svg
                                  viewBox="0 0 24 24"
                                  className="h-3.5 w-3.5 text-cream"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth={3}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </span>
                            <span className="flex-1">
                              <span className="block font-medium text-foreground">
                                {session.slot}
                                {!session.required && (
                                  <span className="ml-1.5 text-xs font-normal text-foreground-muted">
                                    (optional)
                                  </span>
                                )}
                              </span>
                              <span className="block text-xs text-foreground-muted">
                                {picked
                                  ? `${picked}${
                                      optionInfo.get(picked)?.location
                                        ? ` — ${optionInfo.get(picked)?.location}`
                                        : ""
                                    }`
                                  : session.required
                                    ? "Required"
                                    : "Optional — tap to select or skip"}
                              </span>
                            </span>
                          </button>

                          {expanded && (
                            <div className="space-y-2 px-3 pb-3">
                              {session.options.map((option) => {
                                const checked = picked === option.name;
                                const takenElsewhere =
                                  Object.values(selections).includes(option.name) && !checked;
                                const full = isFull(session.slot, option.name);
                                const disabled = !checked && (takenElsewhere || full);
                                return (
                                  <button
                                    key={option.name}
                                    type="button"
                                    onClick={() => pickOption(session.slot, option.name)}
                                    disabled={disabled}
                                    aria-pressed={checked}
                                    className={`w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                                      checked
                                        ? "border-olive bg-olive text-primary-foreground"
                                        : disabled
                                          ? "border-border opacity-50 cursor-not-allowed text-foreground-muted"
                                          : "border-border text-foreground hover:border-olive"
                                    }`}
                                  >
                                    <span className="font-medium">{option.name}</span>
                                    <span className="text-xs shrink-0">
                                      {full && !checked ? "Full" : option.location}
                                    </span>
                                  </button>
                                );
                              })}
                              {!session.required && (
                                <button
                                  type="button"
                                  onClick={() => skipSession(session.slot)}
                                  className="text-xs text-foreground-muted underline hover:text-foreground"
                                >
                                  Skip this session
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {error && <p className="text-sm text-red-600 text-center">{error}</p>}

                <button
                  onClick={handleConfirm}
                  disabled={submitting || !requiredFilled}
                  className="w-full rounded-lg bg-primary text-primary-foreground py-3 font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Checking in..." : "Confirm check-in"}
                </button>
              </div>
            )}

            {result && (
              <div className="text-center space-y-4 pt-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-olive-darker">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-6 w-6 text-cream"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl font-semibold text-foreground">
                    {result.alreadyCheckedIn
                      ? `Welcome back, ${selected.firstName}!`
                      : `You're checked in, ${selected.firstName}!`}
                  </p>
                  <p className="text-sm text-foreground-muted mt-1">
                    {new Date(result.checkedInAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="text-left space-y-1.5">
                  {dayConfig.sessions.map((session) => {
                    const event = result.selections[session.slot];
                    const location = event ? optionInfo.get(event)?.location : undefined;
                    return (
                      <p key={session.slot} className="text-sm text-foreground-muted">
                        <span className="font-medium text-foreground">{session.slot}:</span>{" "}
                        {event
                          ? `${event}${location ? ` — ${location}` : ""}`
                          : session.required
                            ? "—"
                            : "Skipped"}
                      </p>
                    );
                  })}
                </div>
                <p className="text-xs text-foreground-muted">Click the × above to close</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
