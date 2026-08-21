"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Metrics = {
  totalRegistered: number;
  totalCheckedIn: number;
  checkInRate: number;
  perEvent: { event: string; registered: number; checkedIn: number }[];
  checkInsOverTime: { time: string; count: number }[];
};

export default function DashboardView() {
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
      <div className="min-h-screen flex items-center justify-center text-cream">
        Loading metrics…
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl text-cream">Event check-in dashboard</h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Registered" value={metrics.totalRegistered} />
          <StatCard label="Checked in" value={metrics.totalCheckedIn} />
          <StatCard label="Check-in rate" value={`${Math.round(metrics.checkInRate * 100)}%`} />
        </div>

        <div className="bg-surface rounded-3xl shadow-sm border border-border p-6">
          <h2 className="text-lg mb-4">Attendance by session</h2>
          {metrics.perEvent.length === 0 ? (
            <p className="text-sm text-foreground-muted">
              No session data yet — fill in the event-1..event-4 columns in the sheet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metrics.perEvent}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-cream-darker)" />
                <XAxis dataKey="event" tick={{ fontSize: 12, fill: "var(--color-olive-dark)" }} />
                <YAxis allowDecimals={false} tick={{ fill: "var(--color-olive-dark)" }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface, #fff)",
                    border: "1px solid var(--color-cream-darker)",
                    borderRadius: 8,
                    fontFamily: "var(--font-karla)",
                  }}
                />
                <Legend wrapperStyle={{ fontFamily: "var(--font-karla)", fontSize: 14 }} />
                <Bar dataKey="registered" fill="var(--color-cream-darker)" name="Registered" radius={[4, 4, 0, 0]} />
                <Bar dataKey="checkedIn" fill="var(--color-olive-darker)" name="Checked in" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-surface rounded-3xl shadow-sm border border-border p-6">
          <h2 className="text-lg mb-4">Check-ins over time</h2>
          {metrics.checkInsOverTime.length === 0 ? (
            <p className="text-sm text-foreground-muted">No check-ins yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={metrics.checkInsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-cream-darker)" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: "var(--color-olive-dark)" }}
                  tickFormatter={(t) =>
                    new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  }
                />
                <YAxis allowDecimals={false} tick={{ fill: "var(--color-olive-dark)" }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface, #fff)",
                    border: "1px solid var(--color-cream-darker)",
                    borderRadius: 8,
                    fontFamily: "var(--font-karla)",
                  }}
                  labelFormatter={(t) =>
                    typeof t === "string" || typeof t === "number"
                      ? new Date(t).toLocaleTimeString()
                      : ""
                  }
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="var(--color-olive-darker)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
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
