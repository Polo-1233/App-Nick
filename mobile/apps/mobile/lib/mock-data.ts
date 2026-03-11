/**
 * Mock data for MVP development.
 *
 * Simulates the outputs of the core engine until we wire up real data.
 */

import type {
  UserProfile,
  NightRecord,
  CalendarEvent,
  DayPlan,
  ReadinessZone,
} from "@r90/types";

// Legacy exports removed - now using ACTIVE_FIXTURE (see end of file)

/** Get current minute of day */
export function getCurrentMinute(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/** Format MinuteOfDay to display string */
export function formatTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Zone colors */
export const ZONE_COLORS: Record<ReadinessZone, string> = {
  green: "#22C55E",
  yellow: "#EAB308",
  orange: "#F97316",
};

export const ZONE_BG_COLORS: Record<ReadinessZone, string> = {
  green: "#052E16",
  yellow: "#422006",
  orange: "#431407",
};

// ==========================================
// MVP DEBUG FIXTURES (remove before ship)
// ==========================================

/** Fixture 1: Normal profile (green zone, no conflicts) */
export const FIXTURE_NORMAL = {
  profile: {
    anchorTime: 390, // 06:30
    chronotype: "Neither" as const,
    idealCyclesPerNight: 5,
    weeklyTarget: 35,
  },
  weekHistory: [
    { date: "2026-02-14", cyclesCompleted: 5, anchorTime: 390 },
    { date: "2026-02-15", cyclesCompleted: 5, anchorTime: 390 },
    { date: "2026-02-16", cyclesCompleted: 5, anchorTime: 390 },
  ],
  calendarEvents: [
    { id: "standup", title: "Team Standup", start: 570, end: 600, date: "2026-02-17" }, // 09:30-10:00
  ],
};

/** Fixture 2: PMer profile (anchor 08:00, bedtime crosses midnight) */
export const FIXTURE_PMER = {
  profile: {
    anchorTime: 480, // 08:00
    chronotype: "PMer" as const,
    idealCyclesPerNight: 5,
    weeklyTarget: 35,
  },
  weekHistory: [
    { date: "2026-02-14", cyclesCompleted: 4, anchorTime: 480 },
    { date: "2026-02-15", cyclesCompleted: 5, anchorTime: 480 },
    { date: "2026-02-16", cyclesCompleted: 4, anchorTime: 480 },
  ],
  calendarEvents: [
    { id: "gym", title: "Evening Gym", start: 1140, end: 1200, date: "2026-02-17" }, // 19:00-20:00
  ],
};

/** Fixture 3: CRP fallback profile (orange zone, midday CRP blocked) */
export const FIXTURE_CRP_FALLBACK = {
  profile: {
    anchorTime: 390, // 06:30
    chronotype: "Neither" as const,
    idealCyclesPerNight: 5,
    weeklyTarget: 35,
  },
  weekHistory: [
    { date: "2026-02-14", cyclesCompleted: 2, anchorTime: 390 },
    { date: "2026-02-15", cyclesCompleted: 3, anchorTime: 390 },
    { date: "2026-02-16", cyclesCompleted: 2, anchorTime: 390 },
  ],
  calendarEvents: [
    { id: "lunch", title: "Lunch Meeting", start: 780, end: 900, date: "2026-02-17" }, // 13:00-15:00 (blocks midday CRP)
    { id: "dinner", title: "Dinner", start: 1260, end: 1350, date: "2026-02-17" }, // 21:00-22:30 (conflicts with pre-sleep)
  ],
};

/** Current active fixture (change this to switch fixtures) */
// MVP debug toggle: set to FIXTURE_NORMAL | FIXTURE_PMER | FIXTURE_CRP_FALLBACK
export const ACTIVE_FIXTURE = FIXTURE_NORMAL;

// Legacy exports (kept for backward compatibility during transition)
export const MOCK_PROFILE = ACTIVE_FIXTURE.profile;
export const MOCK_WEEK_HISTORY = ACTIVE_FIXTURE.weekHistory;
export const MOCK_CALENDAR_EVENTS = ACTIVE_FIXTURE.calendarEvents;
