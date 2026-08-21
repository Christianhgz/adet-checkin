"use client";

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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Event check-in</h1>
          <p className="text-sm text-slate-500">Find your name to check in</p>
        </div>

        {!selected && !result && (
          <>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type your first or last name"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <div className="space-y-2">
              {matches.map((m) => (
                <button
                  key={m.row}
                  onClick={() => setSelected(m)}
                  className="w-full text-left rounded-lg border border-slate-200 px-4 py-3 hover:border-slate-900 transition-colors"
                >
                  <span className="font-medium text-slate-900">
                    {m.firstName} {m.lastName}
                  </span>
                  {m.checkedIn && (
                    <span className="ml-2 text-xs text-emerald-600">Already checked in</span>
                  )}
                </button>
              ))}
              {query.trim().length >= 2 && matches.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">
                  No matches. Check the spelling, or ask a staff member for help.
                </p>
              )}
            </div>
          </>
        )}

        {selected && !result && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-slate-500 text-sm">Confirm this is you:</p>
              <p className="text-xl font-semibold text-slate-900 mt-1">
                {selected.firstName} {selected.lastName}
              </p>
              {selected.events.length > 0 && (
                <p className="text-sm text-slate-500 mt-2">
                  Registered for: {selected.events.join(", ")}
                </p>
              )}
              {selected.checkedIn && (
                <p className="text-sm text-emerald-600 mt-2">You&apos;re already checked in.</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setSelected(null)}
                className="flex-1 rounded-lg border border-slate-300 py-3 font-medium text-slate-700"
              >
                Not me
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="flex-1 rounded-lg bg-slate-900 text-white py-3 font-medium disabled:opacity-50"
              >
                {submitting ? "Checking in..." : "Confirm check-in"}
              </button>
            </div>
          </div>
        )}

        {result && selected && (
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6 text-emerald-600"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-900">
                {result.alreadyCheckedIn
                  ? `Welcome back, ${selected.firstName}!`
                  : `You're checked in, ${selected.firstName}!`}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {new Date(result.checkedInAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <button onClick={reset} className="text-sm text-slate-500 underline">
              Check in someone else
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
