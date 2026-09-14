import crypto from "crypto";

// Same shared DASHBOARD_PASSWORD as the ADET dashboard (one admin manages
// both), but a distinct, event-scoped cookie so a logged-in session on one
// dashboard never grants or interferes with the other.
export function eventDashboardCookie(slug: string): string {
  return `event_${slug}_dashboard_session`;
}

export function eventDashboardToken(): string {
  return crypto
    .createHash("sha256")
    .update(process.env.DASHBOARD_PASSWORD ?? "")
    .digest("hex");
}
