export type DayId = "saturday" | "sunday";

export type DayConfig = {
  id: DayId;
  label: string;
  sheetName: string;
  events: readonly string[];
  timeSlots: readonly string[];
  eventInfo: Record<string, { location: string; capacity: number }>;
};

export const USERS_SHEET_NAME = "userdata";
export const CONFIG_SHEET_NAME = "config";

const TIME_SLOTS = ["2:00 – 2:40 PM", "2:45 – 3:25 PM", "3:30 – 4:10 PM"] as const;

export const DAYS: Record<DayId, DayConfig> = {
  saturday: {
    id: "saturday",
    label: "Saturday",
    sheetName: "saturday",
    events: [
      "Graphic Design for Local Churches (Canva)",
      "Mobile Photography for Church Use",
      "Social Media Training",
      "Using AI for Church Content",
    ],
    timeSlots: TIME_SLOTS,
    eventInfo: {
      "Graphic Design for Local Churches (Canva)": { location: "Conference Room", capacity: 20 },
      "Mobile Photography for Church Use": { location: "Lobby", capacity: 25 },
      "Social Media Training": { location: "Studio", capacity: 18 },
      "Using AI for Church Content": { location: "Main Auditorium", capacity: 50 },
    },
  },
  sunday: {
    id: "sunday",
    label: "Sunday",
    sheetName: "sunday",
    events: [
      "Does Your Church Need Livestream?",
      "Sound System for Churches",
      "Website Training",
      "Church Online Reputation",
      "Video Editing with CapCut",
    ],
    timeSlots: TIME_SLOTS,
    // PLACEHOLDER locations/capacities — replace with real values before Sunday.
    eventInfo: {
      "Does Your Church Need Livestream?": { location: "TBD", capacity: 20 },
      "Sound System for Churches": { location: "TBD", capacity: 20 },
      "Website Training": { location: "TBD", capacity: 20 },
      "Church Online Reputation": { location: "TBD", capacity: 20 },
      "Video Editing with CapCut": { location: "TBD", capacity: 20 },
    },
  },
};
