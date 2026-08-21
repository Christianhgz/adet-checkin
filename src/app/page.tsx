"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Match = {
  row: number;
  firstName: string;
  lastName: string;
  events: string[];
  checkedIn: boolean;
};

type CheckInResult = {
  alreadyCheckedIn: boolean;
  checkedInAt: string;
};

export default function CheckInPage() {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [selected, setSelected] = useState<Match | null>(null);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (selected || result) return;
    if (query.trim().length < 2) {
      setMatches([]);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/attendees/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        const data = await res.json();
        setMatches(data.matches ?? []);
      } catch {
        // request was aborted by a newer keystroke; ignore
      }
    }, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, selected, result]);

  async function handleConfirm() {
    if (!selected) return;
    setSubmitting(true);
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ row: selected.row }),
    });
    setSubmitting(false);
    if (!res.ok) return;
    const data = await res.json();
    setResult({ alreadyCheckedIn: data.alreadyCheckedIn, checkedInAt: data.checkedInAt });
  }

  function reset() {
    setQuery("");
    setMatches([]);
    setSelected(null);
    setResult(null);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md bg-surface rounded-3xl shadow-sm border border-border p-8 space-y-6">
        <div className="text-center space-y-2">
          <Image
            src="/adet-logo-green.svg"
            alt="ADET logo"
            width={160}
            height={113}
            className="h-16 w-auto mx-auto"
            priority
          />
          <h1 className="text-3xl">ADET check-in</h1>
          <p className="text-base text-foreground-muted">Find your name to check in</p>
        </div>

        {!selected && !result && (
          <>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type your first or last name"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-olive"
            />
            <div className="space-y-2">
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
          </>
        )}

        {selected && !result && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-foreground-muted text-sm">Confirm this is you:</p>
              <p className="text-xl font-semibold text-foreground mt-1">
                {selected.firstName} {selected.lastName}
              </p>
              {selected.events.length > 0 && (
                <p className="text-sm text-foreground-muted mt-2">
                  Registered for: {selected.events.join(", ")}
                </p>
              )}
              {selected.checkedIn && (
                <p className="text-sm text-olive font-medium mt-2">You&apos;re already checked in.</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setSelected(null)}
                className="flex-1 rounded-lg border border-border py-3 font-medium text-foreground-muted hover:border-olive transition-colors"
              >
                Not me
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="flex-1 rounded-lg bg-primary text-primary-foreground py-3 font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {submitting ? "Checking in..." : "Confirm check-in"}
              </button>
            </div>
          </div>
        )}

        {result && selected && (
          <div className="text-center space-y-4">
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
            <button onClick={reset} className="text-sm text-foreground-muted underline hover:text-olive">
              Check in someone else
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
