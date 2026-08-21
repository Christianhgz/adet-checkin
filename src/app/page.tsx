"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EVENT_INFO, EVENTS, EventName, TIME_SLOTS, TimeSlot } from "@/lib/events";

type Match = {
  row: number;
  firstName: string;
  lastName: string;
  events: string[];
  checkedIn: boolean;
  checkedInAt: string | null;
  slots: Partial<Record<TimeSlot, EventName>>;
};

type CheckInResult = {
  alreadyCheckedIn: boolean;
  checkedInAt: string;
  selections: Partial<Record<TimeSlot, EventName>>;
};

export default function CheckInPage() {
  const [query, setQuery] = useState("");
  const [roster, setRoster] = useState<Match[] | null>(null);
  const [rosterError, setRosterError] = useState(false);
  const [selected, setSelected] = useState<Match | null>(null);
  const [selections, setSelections] = useState<Partial<Record<TimeSlot, EventName>>>({});
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function loadRoster() {
    setRosterError(false);
    return fetch("/api/attendees")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load attendees");
        return res.json();
      })
      .then((data) => setRoster(data.attendees ?? []))
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
    if (!roster) return map;
    for (const a of roster) {
      if (!a.checkedIn) continue;
      for (const slot of TIME_SLOTS) {
        const event = a.slots[slot];
        if (event) map.set(`${slot}|${event}`, (map.get(`${slot}|${event}`) ?? 0) + 1);
      }
    }
    return map;
  }, [roster]);

  function isFull(slot: TimeSlot, event: EventName) {
    const taken = takenCounts.get(`${slot}|${event}`) ?? 0;
    return taken >= EVENT_INFO[event].capacity;
  }

  function pickEvent(slot: TimeSlot, event: EventName) {
    setSelections((prev) => {
      const next = { ...prev };
      if (next[slot] === event) {
        delete next[slot];
      } else {
        next[slot] = event;
      }
      return next;
    });
  }

  async function handleConfirm() {
    if (!selected) return;
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ row: selected.row, selections }),
    });
    setSubmitting(false);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }
    setResult({
      alreadyCheckedIn: data.alreadyCheckedIn,
      checkedInAt: data.checkedInAt,
      selections: data.selections,
    });
    loadRoster();
  }

  function closeModal() {
    setQuery("");
    setSelected(null);
    setSelections({});
    setResult(null);
    setError("");
  }

  const allSlotsFilled = TIME_SLOTS.every((slot) => selections[slot]);

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
          <p className="text-base text-foreground-muted">Find your name to check in</p>
        </div>

        <div className="relative">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={roster === null}
            placeholder={roster === null ? "Loading attendee list…" : "Type your first or last name"}
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

          {roster === null && (
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

          {roster !== null && !rosterError && query.trim().length >= 2 && (
            <div className="absolute left-0 right-0 top-full mt-2 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg z-20">
              {matches.map((m) => (
                <button
                  key={m.row}
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

      {selected && (
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
                  {TIME_SLOTS.map((slot) => (
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

                <div className="space-y-4">
                  {TIME_SLOTS.map((slot) => (
                    <div key={slot}>
                      <p className="text-sm font-medium text-foreground mb-2">{slot}</p>
                      <div className="space-y-2">
                        {EVENTS.map((event) => {
                          const checked = selections[slot] === event;
                          const usedElsewhere = TIME_SLOTS.some(
                            (s) => s !== slot && selections[s] === event,
                          );
                          const full = isFull(slot, event);
                          const disabled = !checked && (usedElsewhere || full);
                          const info = EVENT_INFO[event];
                          const taken = takenCounts.get(`${slot}|${event}`) ?? 0;
                          return (
                            <button
                              key={event}
                              type="button"
                              onClick={() => pickEvent(slot, event)}
                              disabled={disabled}
                              aria-pressed={checked}
                              className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                                checked
                                  ? "border-olive bg-cream-dark"
                                  : disabled
                                    ? "border-border opacity-50 cursor-not-allowed"
                                    : "border-border hover:border-olive"
                              }`}
                            >
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                  checked ? "bg-olive border-olive" : "border-border"
                                }`}
                              >
                                {checked && <span className="h-2 w-2 rounded-full bg-cream" />}
                              </span>
                              <span className="flex-1">
                                <span className="block font-medium text-foreground">{event}</span>
                                <span className="block text-xs text-foreground-muted">
                                  {info.location}
                                  {full && !checked ? " · Full" : ` · ${taken}/${info.capacity}`}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
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
                  {TIME_SLOTS.map((slot) => (
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
