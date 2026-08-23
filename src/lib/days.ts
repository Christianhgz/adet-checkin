export type DayId = "saturday" | "sunday";

export function isDayId(value: unknown): value is DayId {
  return value === "saturday" || value === "sunday";
}

export type SessionOption = {
  name: string;
  location: string;
  capacity: number;
};

export type Session = {
  slot: string;
  required: boolean;
  options: SessionOption[];
};

export type DayConfig = {
  id: DayId;
  label: string;
  sheetName: string;
  sessions: Session[];
};

export const USERS_SHEET_NAME = "userdata";
export const CONFIG_SHEET_NAME = "config";

// All distinct seminar names across a day's sessions, in first-seen order.
// Used for the sheet's YES/NO columns and for "attendees per seminar"
// metrics — a seminar that only ever appears in one session still gets one
// entry here.
export function allSeminars(day: DayConfig): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const session of day.sessions) {
    for (const option of session.options) {
      if (!seen.has(option.name)) {
        seen.add(option.name);
        list.push(option.name);
      }
    }
  }
  return list;
}

export function findOption(day: DayConfig, name: string): SessionOption | undefined {
  for (const session of day.sessions) {
    const found = session.options.find((o) => o.name === name);
    if (found) return found;
  }
  return undefined;
}

const SATURDAY_OPTIONS: SessionOption[] = [
  { name: "Graphic Design for Local Churches (Canva)", location: "Conference Room", capacity: 20 },
  { name: "Mobile Photography for Church Use", location: "Lobby", capacity: 25 },
  { name: "Social Media Training", location: "Studio", capacity: 18 },
  { name: "Using AI for Church Content", location: "Main Auditorium", capacity: 50 },
];

export const DAYS: Record<DayId, DayConfig> = {
  saturday: {
    id: "saturday",
    label: "Saturday",
    sheetName: "saturday",
    // Same 4 options offered in every session (any event, any slot) — this
    // reproduces the original Saturday behavior under the shared model.
    sessions: [
      { slot: "2:00 – 2:40 PM", required: true, options: SATURDAY_OPTIONS },
      { slot: "2:45 – 3:25 PM", required: true, options: SATURDAY_OPTIONS },
      { slot: "3:30 – 4:10 PM", required: true, options: SATURDAY_OPTIONS },
    ],
  },
  sunday: {
    id: "sunday",
    label: "Sunday",
    sheetName: "sunday",
    // Each session has its own distinct seminar list. Sessions 1 and 2 are
    // mandatory; session 3 (the masterclasses) is optional and can be
    // skipped entirely. Room capacities reused from Saturday's known values
    // for the same physical rooms (Studio/Main Auditorium/Conference Room).
    sessions: [
      {
        slot: "10:00 – 11:00 AM",
        required: true,
        options: [
          { name: "Does Your Church Need Livestream?", location: "Studio", capacity: 18 },
          { name: "Sound System for Churches", location: "Main Auditorium", capacity: 50 },
          { name: "Website Training", location: "Conference Room", capacity: 20 },
        ],
      },
      {
        slot: "11:00 AM – 12:00 PM",
        required: true,
        // Raised from the rooms' physical 18/20 capacities to 30/30 — with
        // only 2 options this session, the physical caps capped attendance
        // at 38 total, short of the 60+ expected. Sunday-only, this session
        // and the next; session 1 and all of Saturday keep their real
        // room capacities.
        options: [
          { name: "Proclaim", location: "Studio", capacity: 30 },
          { name: "Video Editing with CapCut", location: "Conference Room", capacity: 30 },
        ],
      },
      {
        slot: "1:00 – 2:00 PM",
        required: false,
        options: [
          { name: "Masterclass: Graphic Design in Canva", location: "Conference Room", capacity: 30 },
          { name: "Masterclass: How to Improve Your Church Website", location: "Studio", capacity: 30 },
        ],
      },
    ],
  },
};
