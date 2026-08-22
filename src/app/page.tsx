"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type DayConfig = {
  day: string;
  label: string;
  events: string[];
  timeSlots: string[];
  eventInfo: Record<string, { location: string; capacity: number }>;
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
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!roster || q.length < 2) return [];
    return roster
      .filter((a) => `${a.firstName} ${a.lastName}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [roster, query]);

  const takenCounts = useMemo(() => {
    const map = new Map<string, number>();
    if (!roster || !dayConfig) return map;
    for (const a of roster) {
      if (!a.checkedIn) continue;
      for (const slot of dayConfig.timeSlots) {
        const event = a.slots[slot];
        if (event) map.set(`${slot}|${event}`, (map.get(`${slot}|${event}`) ?? 0) + 1);
      }
    }
    return map;
  }, [roster, dayConfig]);

  function isFull(slot: string, event: string) {
    if (!dayConfig) return false;
    const taken = takenCounts.get(`${slot}|${event}`) ?? 0;
    return taken >= dayConfig.eventInfo[event].capacity;
  }

  function slotForEvent(event: string): string | undefined {
    return dayConfig?.timeSlots.find((slot) => selections[slot] === event);
  }

  function shortSlotLabel(slot: string): string {
    return slot.split(" – ")[0] + " PM";
  }

  function pickSlot(event: string, slot: string) {
    if (!dayConfig) return;
    setSelections((prev) => {
      const next = { ...prev };
      for (const s of dayConfig.timeSlots) {
        if (next[s] === event) delete next[s];
      }
      if (prev[slot] !== event) {
        next[slot] = event;
      }
      return next;
    });
  }

  function toggleExpand(event: string) {
    setExpandedEvent((prev) => (prev === event ? null : event));
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
    setExpandedEvent(null);
    setResult(null);
    setError("");
    setSubmitting(false);
  }

  const allSlotsFilled = dayConfig?.timeSlots.every((slot) => selections[slot]) ?? false;
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
                  onClick={() => setSelected(m)}
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

            {!result && selected.checkedIn && (
              <div className="text-center space-y-4 pt-4">
                <p className="text-xl font-semibold text-foreground">
                  {selected.firstName} {selected.lastName} is already checked in
                </p>
                <div className="text-left space-y-1.5">
                  {dayConfig.timeSlots.map((slot) => (
                    <p key={slot} className="text-sm text-foreground-muted">
                      <span className="font-medium text-foreground">{slot}:</span>{" "}
                      {selected.slots[slot] ?? "—"}
                    </p>
                  ))}
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

            {!result && !selected.checkedIn && (
              <div className="space-y-5 pt-4">
                <div className="text-center">
                  <p className="text-foreground-muted text-sm">Confirm this is you:</p>
                  <p className="text-xl font-semibold text-foreground mt-1">
                    {selected.firstName} {selected.lastName}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground mb-3">
                    Pick {dayConfig.timeSlots.length} of the {dayConfig.events.length} sessions, each in
                    a different time slot
                  </p>
                  <div className="space-y-3">
                    {dayConfig.events.map((event) => {
                      const info = dayConfig.eventInfo[event];
                      const selectedSlot = slotForEvent(event);
                      const eventChosen = selectedSlot !== undefined;
                      const expanded = expandedEvent === event || eventChosen;
                      return (
                        <div
                          key={event}
                          className={`rounded-lg border transition-colors ${
                            eventChosen ? "border-olive bg-cream-dark" : "border-border"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleExpand(event)}
                            className="w-full flex items-center gap-3 p-3 text-left"
                          >
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                                eventChosen ? "bg-olive border-olive" : "border-border"
                              }`}
                            >
                              {eventChosen && (
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
                              <span className="block font-medium text-foreground">{event}</span>
                              <span className="block text-xs text-foreground-muted">
                                {info.location}
                                {eventChosen && selectedSlot ? ` · ${shortSlotLabel(selectedSlot)}` : ""}
                              </span>
                            </span>
                          </button>

                          {expanded && (
                            <div className="grid grid-cols-3 gap-2 px-3 pb-3">
                              {dayConfig.timeSlots.map((slot) => {
                                const checked = selections[slot] === event;
                                const takenByOtherEvent =
                                  selections[slot] !== undefined && selections[slot] !== event;
                                const full = isFull(slot, event);
                                const disabled = !checked && (takenByOtherEvent || full);
                                return (
                                  <button
                                    key={slot}
                                    type="button"
                                    onClick={() => pickSlot(event, slot)}
                                    disabled={disabled}
                                    aria-pressed={checked}
                                    className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                                      checked
                                        ? "border-olive bg-olive text-primary-foreground"
                                        : disabled
                                          ? "border-border opacity-50 cursor-not-allowed text-foreground-muted"
                                          : "border-border text-foreground hover:border-olive"
                                    }`}
                                  >
                                    {full && !checked ? "Full" : shortSlotLabel(slot)}
                                  </button>
                                );
                              })}
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
                  disabled={submitting || !allSlotsFilled}
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
                  {dayConfig.timeSlots.map((slot) => (
                    <p key={slot} className="text-sm text-foreground-muted">
                      <span className="font-medium text-foreground">{slot}:</span>{" "}
                      {result.selections[slot] ?? "—"}
                    </p>
                  ))}
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
