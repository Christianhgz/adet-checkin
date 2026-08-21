"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { EVENTS, REQUIRED_EVENT_COUNT } from "@/lib/events";

type Match = {
  row: number;
  firstName: string;
  lastName: string;
  events: string[];
  checkedIn: boolean;
  checkedInAt: string | null;
};

type CheckInResult = {
  alreadyCheckedIn: boolean;
  checkedInAt: string;
  events: string[];
};

export default function CheckInPage() {
  const [query, setQuery] = useState("");
  const [roster, setRoster] = useState<Match[] | null>(null);
  const [selected, setSelected] = useState<Match | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function loadRoster() {
    return fetch("/api/attendees")
      .then((res) => res.json())
      .then((data) => setRoster(data.attendees ?? []))
      .catch(() => setRoster((prev) => prev ?? []));
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

  function toggleEvent(name: string) {
    setSelectedEvents((prev) => {
      if (prev.includes(name)) return prev.filter((e) => e !== name);
      if (prev.length >= REQUIRED_EVENT_COUNT) return prev;
      return [...prev, name];
    });
  }

  async function handleConfirm() {
    if (!selected) return;
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ row: selected.row, events: selectedEvents }),
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
      events: data.events,
    });
    loadRoster();
  }

  function reset() {
    setQuery("");
    setSelected(null);
    setSelectedEvents([]);
    setResult(null);
    setError("");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md h-[640px] bg-surface rounded-3xl shadow-sm border border-border p-8 flex flex-col overflow-hidden">
        <div className="text-center space-y-2 shrink-0">
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

        <div className="flex-1 min-h-0 mt-6">
          {!selected && !result && (
            <div className="h-full flex flex-col gap-3">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={roster === null}
                placeholder={roster === null ? "Loading attendee list…" : "Type your first or last name"}
                className="w-full shrink-0 rounded-lg border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-olive disabled:opacity-60"
              />
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
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                {matches.map((m) => (
                  <button
                    key={m.row}
                    onClick={() => setSelected(m)}
                    className="w-full text-left rounded-lg border border-border px-4 py-3 hover:border-olive transition-colors"
                  >
                    <span className="font-medium text-foreground">
                      {m.firstName} {m.lastName}
                    </span>
                    {m.checkedIn && (
                      <span className="ml-2 text-xs text-olive font-medium">Already checked in</span>
                    )}
                  </button>
                ))}
                {query.trim().length >= 2 && matches.length === 0 && (
                  <p className="text-sm text-foreground-muted text-center py-4">
                    No matches. Check the spelling, or ask a staff member for help.
                  </p>
                )}
              </div>
            </div>
          )}

          {selected && !result && selected.checkedIn && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
              <div>
                <p className="text-xl font-semibold text-foreground">
                  {selected.firstName} {selected.lastName} is already checked in
                </p>
                {selected.events.length > 0 && (
                  <p className="text-sm text-foreground-muted mt-2">
                    Events: {selected.events.join(", ")}
                  </p>
                )}
                {selected.checkedInAt && (
                  <p className="text-sm text-foreground-muted mt-1">
                    {new Date(selected.checkedInAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
              <button onClick={reset} className="text-sm text-foreground-muted underline hover:text-olive">
                Check in someone else
              </button>
            </div>
          )}

          {selected && !result && !selected.checkedIn && (
            <div className="h-full flex flex-col">
              <div className="text-center shrink-0">
                <p className="text-foreground-muted text-sm">Confirm this is you:</p>
                <p className="text-xl font-semibold text-foreground mt-1">
                  {selected.firstName} {selected.lastName}
                </p>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto mt-5">
                <p className="text-sm font-medium text-foreground">
                  Select exactly {REQUIRED_EVENT_COUNT} of {EVENTS.length} events
                </p>
                <p className="text-xs text-foreground-muted mb-2">
                  {selectedEvents.length} of {REQUIRED_EVENT_COUNT} selected
                </p>
                <div className="space-y-2">
                  {EVENTS.map((name) => {
                    const checked = selectedEvents.includes(name);
                    const atCap = !checked && selectedEvents.length >= REQUIRED_EVENT_COUNT;
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggleEvent(name)}
                        disabled={atCap}
                        aria-pressed={checked}
                        className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                          checked
                            ? "border-olive bg-cream-dark"
                            : atCap
                              ? "border-border opacity-50 cursor-not-allowed"
                              : "border-border hover:border-olive"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                            checked ? "bg-olive border-olive" : "border-border"
                          }`}
                        >
                          {checked && (
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
                        <span className="font-medium text-foreground">{name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && <p className="text-sm text-red-600 text-center shrink-0 mt-3">{error}</p>}

              <div className="flex gap-3 shrink-0 mt-4">
                <button
                  onClick={() => {
                    setSelected(null);
                    setSelectedEvents([]);
                    setError("");
                  }}
                  className="flex-1 rounded-lg border border-border py-3 font-medium text-foreground-muted hover:border-olive transition-colors"
                >
                  Not me
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={submitting || selectedEvents.length !== REQUIRED_EVENT_COUNT}
                  className="flex-1 rounded-lg bg-primary text-primary-foreground py-3 font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Checking in..." : "Confirm check-in"}
                </button>
              </div>
            </div>
          )}

          {result && selected && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
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
                {result.events.length > 0 && (
                  <p className="text-sm text-foreground-muted mt-2">
                    Events: {result.events.join(", ")}
                  </p>
                )}
              </div>
              <button onClick={reset} className="text-sm text-foreground-muted underline hover:text-olive">
                Check in someone else
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
