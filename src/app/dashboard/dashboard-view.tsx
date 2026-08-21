"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Metrics = {
  totalRegistered: number;
  totalCheckedIn: number;
  checkInRate: number;
  perEvent: { event: string; attendees: number }[];
};

export default function DashboardView({ sheetUrl }: { sheetUrl: string }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/metrics");
      if (!res.ok) return;
      const data = await res.json();
      if (!cancelled) setMetrics(data);
    }
    load();
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

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
          className="inline-flex items-center gap-1.5 text-sm text-surface/70 hover:text-surface transition-colors"
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
          <h2 className="text-lg mb-4">Attendees per event</h2>
          <div className="divide-y divide-border">
            {metrics.perEvent.map(({ event, attendees }) => (
              <div key={event} className="flex items-center justify-between py-3">
                <span className="font-medium text-foreground">{event}</span>
                <span className="text-lg font-heading font-semibold text-olive-darker">
                  {attendees}
                </span>
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
