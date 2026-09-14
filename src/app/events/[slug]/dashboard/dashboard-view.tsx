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

export default function DashboardView({
  slug,
  label,
  sheetUrl,
}: {
  slug: string;
  label: string;
  sheetUrl: string | null;
}) {
  const [roster, setRoster] = useState<Attendee[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");

  async function load() {
    try {
      const res = await fetch(`/api/events/${slug}/dashboard/attendees`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setRoster(data.attendees ?? []);
      setError(false);
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!roster) return [];
    const q = query.trim().toLowerCase();
    const list = q ? roster.filter((a) => `${a.firstName} ${a.lastName}`.toLowerCase().includes(q)) : roster;
    return [...list].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  }, [roster, query]);

  const totalRegistered = roster?.length ?? 0;
  const totalCheckedIn = roster?.filter((a) => a.checkedIn).length ?? 0;
  const rate = totalRegistered > 0 ? Math.round((totalCheckedIn / totalRegistered) * 100) : 0;

  if (!roster && !error) {
    return <div className="min-h-screen flex items-center justify-center text-surface">Loading…</div>;
  }

  return (
    <div className="min-h-screen px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <Link
          href={`/events/${slug}`}
          className="inline-flex items-center gap-1.5 text-base underline underline-offset-2 text-surface/70 hover:text-surface transition-colors"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to check-in
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl text-surface">{label} — dashboard</h1>
          {sheetUrl && (
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
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Couldn&apos;t load attendees. Retrying in the background…
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Registered" value={totalRegistered} />
          <StatCard label="Checked in" value={totalCheckedIn} />
          <StatCard label="Check-in rate" value={`${rate}%`} />
        </div>

        <div className="bg-surface rounded-3xl shadow-sm border border-border p-6 space-y-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-olive"
          />
          <div className="divide-y divide-border">
            {filtered.map((a) => (
              <div key={a.userId} className="flex items-center justify-between py-3">
                <span className="font-medium text-foreground">
                  {a.firstName} {a.lastName}
                </span>
                {a.checkedIn ? (
                  <span className="text-sm text-olive font-medium">
                    Checked in
                    {a.checkedInAt &&
                      ` — ${new Date(a.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                  </span>
                ) : (
                  <span className="text-sm text-foreground-muted">Not checked in</span>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-foreground-muted text-center py-4">No attendees match.</p>
            )}
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
