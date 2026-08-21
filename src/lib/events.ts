export const EVENTS = [
  "Graphic Design for Local Churches (Canva)",
  "Mobile Photography for Church Use",
  "Social Media Training",
  "Using AI for Church Content",
] as const;

export type EventName = (typeof EVENTS)[number];

export const TIME_SLOTS = ["2:00 – 2:40 PM", "2:45 – 3:25 PM", "3:30 – 4:10 PM"] as const;

export type TimeSlot = (typeof TIME_SLOTS)[number];

// One fixed room per event, used across all 3 time slots. The number is the
// room's max occupancy per slot (not a running total across the whole day).
export const EVENT_INFO: Record<EventName, { location: string; capacity: number }> = {
  "Graphic Design for Local Churches (Canva)": { location: "Conference Room", capacity: 20 },
  "Mobile Photography for Church Use": { location: "Lobby", capacity: 25 },
  "Social Media Training": { location: "Studio", capacity: 18 },
  "Using AI for Church Content": { location: "Main Auditorium", capacity: 50 },
};
