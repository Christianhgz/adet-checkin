// Registry for "simple" check-in events — separate, small events (find your
// name, mark present) that live alongside the main ADET check-in flow. Each
// one gets its own Google Sheet for full data isolation, so nothing here can
// ever collide with or put ADET's attendee data at risk.

export type SimpleEventConfig = {
  slug: string;
  label: string;
  // Name of the env var holding this event's spreadsheet ID (not the ID
  // itself) — keeps real sheet IDs out of source and lets each deploy target
  // its own sheet.
  sheetIdEnvVar: string;
  sheetName: string;
};

export const SIMPLE_EVENTS: Record<string, SimpleEventConfig> = {
  yar: {
    slug: "yar",
    label: "Young Adults Retreat",
    sheetIdEnvVar: "GOOGLE_SHEET_ID_YAR",
    sheetName: "attendees",
  },
};

export function getSimpleEvent(slug: string): SimpleEventConfig | undefined {
  return SIMPLE_EVENTS[slug];
}

export function simpleEventSheetId(event: SimpleEventConfig): string {
  const id = process.env[event.sheetIdEnvVar];
  if (!id) {
    throw new Error(`Missing env var ${event.sheetIdEnvVar} for event "${event.slug}"`);
  }
  return id;
}
