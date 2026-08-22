import { NextResponse } from "next/server";

// Turns an unexpected error (Sheets API quota/network failures, etc.) into a
// clean JSON response instead of letting Next.js return a bare, bodyless 500.
// Quota/rate-limit errors get a 503 with a message the client can show and
// let the user retry, rather than a generic failure.
export function apiErrorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const isTransient = /quota|rate limit|429|503|502|504|ECONNRESET|ETIMEDOUT/i.test(message);
  console.error("[api]", message);
  return NextResponse.json(
    {
      error: isTransient
        ? "The server is busy right now — please try again in a few seconds."
        : "Something went wrong. Please try again.",
    },
    { status: isTransient ? 503 : 500 },
  );
}
