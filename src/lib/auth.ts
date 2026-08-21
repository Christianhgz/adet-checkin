import crypto from "crypto";

export const DASHBOARD_COOKIE = "adet_dashboard_session";

export function dashboardToken(): string {
  return crypto
    .createHash("sha256")
    .update(process.env.DASHBOARD_PASSWORD ?? "")
    .digest("hex");
}
