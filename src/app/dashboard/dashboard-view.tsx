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
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading metrics…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-2xl font-semibold text-slate-900">Event check-in dashboard</h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Registered" value={metrics.totalRegistered} />
          <StatCard label="Checked in" value={metrics.totalCheckedIn} />
          <StatCard label="Check-in rate" value={`${Math.round(metrics.checkInRate * 100)}%`} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <h2 className="text-lg font-medium text-slate-900 mb-4">Attendance by session</h2>
          {metrics.perEvent.length === 0 ? (
            <p className="text-sm text-slate-500">
              No session data yet — fill in the event-1..event-4 columns in the sheet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metrics.perEvent}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="event" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="registered" fill="#94a3b8" name="Registered" />
                <Bar dataKey="checkedIn" fill="#0f172a" name="Checked in" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <h2 className="text-lg font-medium text-slate-900 mb-4">Check-ins over time</h2>
          {metrics.checkInsOverTime.length === 0 ? (
            <p className="text-sm text-slate-500">No check-ins yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={metrics.checkInsOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(t) =>
                    new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  }
                />
                <YAxis allowDecimals={false} />
                <Tooltip
                  labelFormatter={(t) =>
                    typeof t === "string" || typeof t === "number"
                      ? new Date(t).toLocaleTimeString()
                      : ""
                  }
                />
                <Line type="monotone" dataKey="count" stroke="#0f172a" strokeWidth={2} dot={false} />
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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-3xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
