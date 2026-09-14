"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Attendee = {
  userId: string;
  firstName: string;
  lastName: string;
  checkedIn: boolean;
  checkedInAt: string | null;
};

export default function CheckInView({ slug, label }: { slug: string; label: string }) {
  const [query, setQuery] = useState("");
  const [roster, setRoster] = useState<Attendee[] | null>(null);
  const [rosterError, setRosterError] = useState(false);
  const [selected, setSelected] = useState<Attendee | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [checkedInAt, setCheckedInAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function loadRoster() {
    setRosterError(false);
    return fetch(`/api/events/${slug}/attendees`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        setRoster(data.attendees ?? []);
      })
      .catch(() => {
        setRosterError(true);
        setRoster((prev) => prev ?? []);
      });
  }

  useEffect(() => {
    loadRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!selected) loadRoster();
    }, 20000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  async function selectAttendee(match: Attendee) {
    setSelected(match);
    setCheckedInAt(null);
    setError("");
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/events/${slug}/attendee-status?userId=${encodeURIComponent(match.userId)}`);
      if (res.ok) {
        const fresh: Attendee = await res.json();
        setSelected((prev) => (prev && prev.userId === fresh.userId ? fresh : prev));
      }
    } catch {
      // Fall back to the (possibly slightly stale) search result.
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

  async function handleConfirm() {
    if (!selected || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/events/${slug}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selected.userId }),
      });
      let data: { error?: string; alreadyCheckedIn?: boolean; checkedInAt?: string };
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setCheckedInAt(data.checkedInAt ?? new Date().toISOString());
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
    setCheckedInAt(null);
    setError("");
    setSubmitting(false);
    setStatusLoading(false);
  }

  const ready = roster !== null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md bg-surface rounded-3xl shadow-sm border border-border p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl">{label}</h1>
          <p className="text-base text-foreground-muted">Find your name to check in</p>
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
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Loading attendee list…
            </div>
          )}

          {rosterError && (
            <div className="flex items-center justify-between gap-2 mt-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span>Couldn&apos;t load the attendee list. Please try again.</span>
              <button type="button" onClick={loadRoster} className="shrink-0 font-medium underline hover:no-underline">
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
                  {m.checkedIn && <span className="ml-2 text-xs text-olive font-medium">Already checked in</span>}
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
            href={`/events/${slug}/dashboard`}
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

            {statusLoading && (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-foreground-muted">
                <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin text-olive" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Checking status…
              </div>
            )}

            {!statusLoading && !checkedInAt && selected.checkedIn && (
              <div className="text-center space-y-4 pt-4">
                <p className="text-xl font-semibold text-foreground">
                  {selected.firstName} {selected.lastName} is already checked in
                </p>
                {selected.checkedInAt && (
                  <p className="text-sm text-foreground-muted">
                    {new Date(selected.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>
            )}

            {!statusLoading && !checkedInAt && !selected.checkedIn && (
              <div className="space-y-5 pt-4">
                <div className="text-center">
                  <p className="text-foreground-muted text-sm">Confirm this is you:</p>
                  <p className="text-xl font-semibold text-foreground mt-1">
                    {selected.firstName} {selected.lastName}
                  </p>
                </div>

                {error && <p className="text-sm text-red-600 text-center">{error}</p>}

                <button
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="w-full rounded-lg bg-primary text-primary-foreground py-3 font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Checking in..." : "Confirm check-in"}
                </button>
              </div>
            )}

            {checkedInAt && (
              <div className="text-center space-y-4 pt-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-olive-darker">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 text-cream" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl font-semibold text-foreground">You&apos;re checked in, {selected.firstName}!</p>
                  <p className="text-sm text-foreground-muted mt-1">
                    {new Date(checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
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
