import { google, sheets_v4 } from "googleapis";
import { SimpleEventConfig, simpleEventSheetId } from "./events";

// Deliberately its own small client/retry pair rather than importing from
// sheets.ts — this keeps every simple-event code path fully isolated from
// ADET's, so nothing built here can ever affect ADET's live data or vice
// versa. A few duplicated lines is a fair trade for that isolation.

let client: sheets_v4.Sheets | null = null;

function getClient(): sheets_v4.Sheets {
  if (client) return client;
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  client = google.sheets({ version: "v4", auth });
  return client;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status =
        (err as { code?: number; response?: { status?: number } })?.response?.status ??
        (err as { code?: number })?.code;
      const retryable = status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
      if (!retryable || i === attempts - 1) throw err;
      const delay = 250 * 2 ** i + Math.random() * 250;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
}

export type SimpleAttendee = {
  userId: string;
  firstName: string;
  lastName: string;
  checkedIn: boolean;
  checkedInAt: string | null;
};

export type SimpleCheckInOutcome =
  | { status: "not_found" }
  | { status: "already"; checkedInAt: string }
  | { status: "checked_in"; checkedInAt: string };

function parseRow(row: string[]): SimpleAttendee {
  const [userId, firstName, lastName, checkedInAt] = row;
  const at = (checkedInAt ?? "").trim();
  return {
    userId: (userId ?? "").trim(),
    firstName: (firstName ?? "").trim(),
    lastName: (lastName ?? "").trim(),
    checkedIn: Boolean(at),
    checkedInAt: at || null,
  };
}

// Sheet layout: A user-id | B first-name | C last-name | D checked-in-at
// (blank until checked in). No separate boolean column — "checked in" is
// simply "has a timestamp" — there's no multi-day/session state to track.
async function fetchRows(event: SimpleEventConfig): Promise<string[][]> {
  const sheets = getClient();
  const res = await withRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: simpleEventSheetId(event),
      range: `${event.sheetName}!A2:D`,
    }),
  );
  return (res.data.values ?? []) as string[][];
}

export async function getRoster(event: SimpleEventConfig): Promise<SimpleAttendee[]> {
  const rows = await fetchRows(event);
  return rows.filter((r) => (r[0] ?? "").trim()).map(parseRow);
}

export async function getAttendeeStatus(
  event: SimpleEventConfig,
  userId: string,
): Promise<SimpleAttendee | null> {
  const roster = await getRoster(event);
  return roster.find((a) => a.userId === userId) ?? null;
}

// Single fresh read + a single targeted single-cell write — never a bulk
// sweep across rows.
export async function checkIn(event: SimpleEventConfig, userId: string): Promise<SimpleCheckInOutcome> {
  const sheets = getClient();
  const rows = await fetchRows(event);
  const rowIndex = rows.findIndex((r) => (r[0] ?? "").trim() === userId);
  if (rowIndex === -1) return { status: "not_found" };

  const existing = (rows[rowIndex][3] ?? "").trim();
  if (existing) return { status: "already", checkedInAt: existing };

  const checkedInAt = new Date().toISOString();
  const sheetRow = rowIndex + 2; // +1 for 0-index, +1 for header row
  await withRetry(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: simpleEventSheetId(event),
      range: `${event.sheetName}!D${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [[checkedInAt]] },
    }),
  );
  return { status: "checked_in", checkedInAt };
}
