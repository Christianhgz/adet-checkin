import { cookies } from "next/headers";
import { DASHBOARD_COOKIE, dashboardToken } from "@/lib/auth";
import DashboardLogin from "./dashboard-login";
import DashboardView from "./dashboard-view";

export default async function DashboardPage() {
  const store = await cookies();
  const authed = store.get(DASHBOARD_COOKIE)?.value === dashboardToken();

  if (!authed) return <DashboardLogin />;

  const sheetUrl = `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit`;
  return <DashboardView sheetUrl={sheetUrl} />;
}
