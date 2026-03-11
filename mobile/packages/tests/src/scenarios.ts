/**
 * R90 Scenario definitions.
 *
 * Each scenario maps to the R90_LOGIC_MAP_v0.1.md scenarios table.
 * Inputs are fed into the engine; outputs are asserted.
 */

import type { Scenario } from "@r90/types";

const DEFAULT_PROFILE = {
  anchorTime: 390, // 06:30
  chronotype: "Neither" as const,
  idealCyclesPerNight: 5,
  weeklyTarget: 35,
};

const EARLY_PROFILE = {
  ...DEFAULT_PROFILE,
  anchorTime: 300, // 05:00
  chronotype: "AMer" as const,
};

const LATE_PROFILE = {
  ...DEFAULT_PROFILE,
  anchorTime: 480, // 08:00
  chronotype: "PMer" as const,
};

function nightRecord(date: string, cycles: number) {
  return { date, cyclesCompleted: cycles, anchorTime: 390 };
}

export const SCENARIOS: Scenario[] = [
  // S01: Normal weeknight, no events
  {
    input: {
      id: "S01",
      name: "Normal weeknight, no events",
      profile: DEFAULT_PROFILE,
      currentTime: 600, // 10:00
      weekHistory: [],
      calendarEvents: [],
    },
    expected: {
      cycleWindow: {
        bedtime: 1380, // 23:00
        wakeTime: 390, // 06:30
        cycleCount: 5,
        preSleepStart: 1290, // 21:30 (90 min before bedtime)
      },
      readinessZone: "green", // no data = fresh start
      conflictCount: 0,
      hasCRPBlock: false, // Green zone → no CRP block
    },
  },

  // S02: Late dinner overlaps pre-sleep
  {
    input: {
      id: "S02",
      name: "Late dinner 21:00-22:30, conflicts with pre-sleep",
      profile: DEFAULT_PROFILE,
      currentTime: 1200, // 20:00
      weekHistory: [nightRecord("2026-02-16", 5)],
      calendarEvents: [
        { id: "dinner", title: "Dinner", start: 1260, end: 1350, date: "2026-02-17" },
      ],
    },
    expected: {
      conflictCount: 1, // dinner 21:00-22:30 overlaps pre-sleep 21:30-23:00
      readinessZone: "green", // single 5-cycle night
      hasCRPBlock: false, // green zone
    },
  },

  // S03: Short night, PRC recommended
  {
    input: {
      id: "S03",
      name: "Short night (3 cycles), PRC recommended",
      profile: DEFAULT_PROFILE,
      currentTime: 480, // 08:00 morning
      weekHistory: [
        nightRecord("2026-02-14", 5),
        nightRecord("2026-02-15", 5),
        nightRecord("2026-02-16", 3),
      ],
      calendarEvents: [],
    },
    expected: {
      readinessZone: "yellow", // avg (5+5+3)/3 = 4.33
    },
  },

  // S04: Perfect week so far (Mon-Thu = 20 cycles)
  {
    input: {
      id: "S04",
      name: "Perfect week Mon-Thu = 20 cycles",
      profile: DEFAULT_PROFILE,
      currentTime: 600,
      weekHistory: [
        nightRecord("2026-02-13", 5),
        nightRecord("2026-02-14", 5),
        nightRecord("2026-02-15", 5),
        nightRecord("2026-02-16", 5),
      ],
      calendarEvents: [],
    },
    expected: {
      readinessZone: "green", // avg 5
      weeklyTotal: 20,
      hasCRPBlock: false, // Green zone → no CRP needed
    },
  },

  // S05: Bad week (Mon-Thu = 12 cycles)
  {
    input: {
      id: "S05",
      name: "Bad week Mon-Thu = 12 cycles",
      profile: DEFAULT_PROFILE,
      currentTime: 600,
      weekHistory: [
        nightRecord("2026-02-13", 3),
        nightRecord("2026-02-14", 3),
        nightRecord("2026-02-15", 3),
        nightRecord("2026-02-16", 3),
      ],
      calendarEvents: [],
    },
    expected: {
      readinessZone: "yellow", // avg 3
      weeklyTotal: 12,
    },
  },

  // S06: Post-match, event ends 22:00 — adrenaline clearance drops to 4 cycles
  {
    input: {
      id: "S06",
      name: "Post-match, event ends 22:00",
      profile: DEFAULT_PROFILE,
      currentTime: 1320, // 22:00
      weekHistory: [nightRecord("2026-02-16", 5)],
      calendarEvents: [],
      lateEventEndTime: 1320, // 22:00
    },
    expected: {
      readinessZone: "green", // single 5-cycle night in history
      // earliestBedtime = 22:00 + 90min = 23:30 (1410)
      // 5-cycle bedtime = 23:00 (1380) — not reachable; drop to 4 cycles
      cycleWindow: { bedtime: 30, wakeTime: 390, cycleCount: 4 },
    },
  },

  // S07: Post-match, event ends midnight — adrenaline clearance drops to 3 cycles
  {
    input: {
      id: "S07",
      name: "Post-match, event ends midnight",
      profile: DEFAULT_PROFILE,
      currentTime: 0, // midnight
      weekHistory: [nightRecord("2026-02-16", 5)],
      calendarEvents: [],
      lateEventEndTime: 0, // midnight
    },
    expected: {
      readinessZone: "green",
      // earliestBedtime = 00:00 + 90min = 01:30 (90)
      // 4-cycle bedtime = 00:30 (30) — not reachable; drop to 3 cycles
      cycleWindow: { bedtime: 120, wakeTime: 390, cycleCount: 3 },
    },
  },

  // S08: Early chronotype anchor = 05:00
  {
    input: {
      id: "S08",
      name: "Early chronotype, anchor 05:00",
      profile: EARLY_PROFILE,
      currentTime: 360, // 06:00
      weekHistory: [],
      calendarEvents: [],
    },
    expected: {
      cycleWindow: {
        bedtime: 1290, // 21:30
        wakeTime: 300, // 05:00
        cycleCount: 5,
        preSleepStart: 1200, // 20:00 (90 min before bedtime)
      },
    },
  },

  // S09: Late chronotype anchor = 08:00
  {
    input: {
      id: "S09",
      name: "Late chronotype, anchor 08:00",
      profile: LATE_PROFILE,
      currentTime: 540, // 09:00
      weekHistory: [],
      calendarEvents: [],
    },
    expected: {
      cycleWindow: {
        bedtime: 30, // 00:30
        wakeTime: 480, // 08:00
        cycleCount: 5,
        preSleepStart: 1380, // 23:00 (90 min before 00:30, wraps midnight)
      },
    },
  },

  // S10: Calendar conflict with early morning meeting
  {
    input: {
      id: "S10",
      name: "Early meeting at 06:00 overlaps final sleep cycle",
      profile: DEFAULT_PROFILE,
      currentTime: 600,
      weekHistory: [],
      calendarEvents: [
        { id: "meeting", title: "Early Meeting", start: 360, end: 420, date: "2026-02-17" },
      ],
    },
    expected: {
      conflictCount: 1, // meeting 06:00-07:00 overlaps final sleep cycle (05:00-06:30)
    },
  },

  // S11: PRC window blocked by meeting
  {
    input: {
      id: "S11",
      name: "PRC window blocked by 13:00 meeting",
      profile: DEFAULT_PROFILE,
      currentTime: 720, // midday
      weekHistory: [
        nightRecord("2026-02-14", 4),
        nightRecord("2026-02-15", 3),
        nightRecord("2026-02-16", 3),
      ],
      calendarEvents: [
        { id: "mtg", title: "Team Meeting", start: 780, end: 840, date: "2026-02-17" },
      ],
    },
    expected: {
      readinessZone: "yellow", // avg 3.33
    },
  },

  // S12: Weekend recovery
  {
    input: {
      id: "S12",
      name: "Weekend, no obligations, green zone",
      profile: DEFAULT_PROFILE,
      currentTime: 420, // 07:00
      weekHistory: [
        nightRecord("2026-02-11", 5),
        nightRecord("2026-02-12", 5),
        nightRecord("2026-02-13", 5),
        nightRecord("2026-02-14", 5),
        nightRecord("2026-02-15", 5),
      ],
      calendarEvents: [],
    },
    expected: {
      readinessZone: "green",
      weeklyTotal: 25,
    },
  },

  // S13: Consecutive short nights
  {
    input: {
      id: "S13",
      name: "Two consecutive short nights (3+3)",
      profile: DEFAULT_PROFILE,
      currentTime: 420,
      weekHistory: [
        nightRecord("2026-02-14", 5),
        nightRecord("2026-02-15", 3),
        nightRecord("2026-02-16", 3),
      ],
      calendarEvents: [],
    },
    expected: {
      readinessZone: "yellow", // avg (5+3+3)/3 = 3.67
    },
  },

  // S14: Very bad recent nights
  {
    input: {
      id: "S14",
      name: "Three consecutive short nights (2+2+2)",
      profile: DEFAULT_PROFILE,
      currentTime: 420,
      weekHistory: [
        nightRecord("2026-02-14", 2),
        nightRecord("2026-02-15", 2),
        nightRecord("2026-02-16", 2),
      ],
      calendarEvents: [],
    },
    expected: {
      readinessZone: "orange", // avg 2
    },
  },

  // S15: PMer with midnight-crossing bedtime (wraparound test)
  {
    input: {
      id: "S15",
      name: "PMer anchor 08:00, bedtime crosses midnight",
      profile: LATE_PROFILE,
      currentTime: 1320, // 22:00 evening
      weekHistory: [],
      calendarEvents: [
        { id: "gym", title: "Gym", start: 1140, end: 1200, date: "2026-02-17" }, // 19:00-20:00
      ],
    },
    expected: {
      cycleWindow: {
        bedtime: 30, // 00:30
        wakeTime: 480, // 08:00
        cycleCount: 5,
        preSleepStart: 1380, // 23:00
      },
      conflictCount: 0, // gym ends before pre-sleep starts
      readinessZone: "green",
    },
  },

  // S16: Yellow zone triggers midday CRP block
  {
    input: {
      id: "S16",
      name: "Yellow zone: midday CRP recommended",
      profile: DEFAULT_PROFILE,
      currentTime: 600, // 10:00
      weekHistory: [
        nightRecord("2026-02-14", 4),
        nightRecord("2026-02-15", 3),
        nightRecord("2026-02-16", 3),
      ],
      calendarEvents: [],
    },
    expected: {
      readinessZone: "yellow", // avg 3.33
      hasCRPBlock: true, // Yellow zone → CRP block should appear
    },
  },

  // S17: Orange zone, midday blocked → evening CRP
  {
    input: {
      id: "S17",
      name: "Orange zone: midday CRP blocked, evening fallback",
      profile: DEFAULT_PROFILE,
      currentTime: 600,
      weekHistory: [
        nightRecord("2026-02-14", 2),
        nightRecord("2026-02-15", 2),
        nightRecord("2026-02-16", 3),
      ],
      calendarEvents: [
        { id: "lunch", title: "Lunch Meeting", start: 780, end: 840, date: "2026-02-17" }, // 13:00-14:00
      ],
    },
    expected: {
      readinessZone: "orange", // avg 2.33
      hasCRPBlock: true, // Orange zone + midday blocked → evening CRP fallback
    },
  },

  // ── Week 9 additions ─────────────────────────────────────────────────────

  // S18: Post-event protocol — event 22:00, drops to 4 cycles
  {
    input: {
      id: "S18",
      name: "Post-event 22:00: adrenaline clearance → 4-cycle window",
      profile: DEFAULT_PROFILE,
      currentTime: 1320,
      weekHistory: [],
      calendarEvents: [],
      lateEventEndTime: 1320, // 22:00
    },
    expected: {
      // earliestBedtime = 22:00 + 90min = 23:30 (1410)
      // 5-cycle bedtime = 23:00 (1380) — not reachable from 23:30
      // 4-cycle bedtime = 00:30 (30) — reachable: normalized(30) > normalized(1410) from anchor 06:30
      cycleWindow: {
        bedtime:    30,  // 00:30
        wakeTime:   390, // 06:30
        cycleCount: 4,
      },
    },
  },

  // S19: Post-event protocol — event midnight, drops to 3 cycles
  {
    input: {
      id: "S19",
      name: "Post-event midnight: adrenaline clearance → 3-cycle window",
      profile: DEFAULT_PROFILE,
      currentTime: 0,
      weekHistory: [],
      calendarEvents: [],
      lateEventEndTime: 0, // 00:00
    },
    expected: {
      // earliestBedtime = 00:00 + 90min = 01:30 (90)
      // 4-cycle bedtime = 00:30 (30) — not reachable from 01:30
      // 3-cycle bedtime = 02:00 (120) — reachable
      cycleWindow: {
        bedtime:    120, // 02:00
        wakeTime:   390, // 06:30
        cycleCount: 3,
      },
    },
  },

  // S20: Two calendar events → 2 conflicts
  {
    input: {
      id: "S20",
      name: "Two events: dinner + early meeting → 2 conflicts",
      profile: DEFAULT_PROFILE,
      currentTime: 600,
      weekHistory: [],
      calendarEvents: [
        { id: "dinner", title: "Dinner",        start: 1260, end: 1350, date: "2026-02-17" }, // 21:00-22:30 → pre_sleep
        { id: "meeting", title: "Early Meeting", start: 360,  end: 420,  date: "2026-02-17" }, // 06:00-07:00 → sleep_cycle
      ],
    },
    expected: {
      conflictCount: 2,
    },
  },

  // S21: 4-cycle ideal profile — different window
  {
    input: {
      id: "S21",
      name: "4-cycle ideal: bedtime 00:30, pre-sleep 23:00",
      profile: { ...DEFAULT_PROFILE, idealCyclesPerNight: 4 },
      currentTime: 600,
      weekHistory: [],
      calendarEvents: [],
    },
    expected: {
      // bedtime = 06:30 - 4×90min = 06:30 - 6h = 00:30
      // preSleepStart = 00:30 - 90min = 23:00
      cycleWindow: {
        bedtime:       30,   // 00:30
        wakeTime:      390,  // 06:30
        cycleCount:    4,
        preSleepStart: 1380, // 23:00
      },
    },
  },

  // S22: Full week — 7 nights × 5 cycles = 35 weekly total
  {
    input: {
      id: "S22",
      name: "Full week 35 cycles — green zone, target reached",
      profile: DEFAULT_PROFILE,
      currentTime: 420,
      weekHistory: [
        nightRecord("2026-02-10", 5),
        nightRecord("2026-02-11", 5),
        nightRecord("2026-02-12", 5),
        nightRecord("2026-02-13", 5),
        nightRecord("2026-02-14", 5),
        nightRecord("2026-02-15", 5),
        nightRecord("2026-02-16", 5),
      ],
      calendarEvents: [],
    },
    expected: {
      readinessZone: "green", // last-3 avg = 5
      weeklyTotal: 35,
    },
  },

  // S23: nextActionType — morning + orange zone → take_crp
  {
    input: {
      id: "S23",
      name: "Morning orange zone → nextAction take_crp",
      profile: DEFAULT_PROFILE,
      currentTime: 420, // 07:00 — within 2h of anchor 06:30
      weekHistory: [
        nightRecord("2026-02-14", 2),
        nightRecord("2026-02-15", 2),
        nightRecord("2026-02-16", 2),
      ],
      calendarEvents: [],
    },
    expected: {
      readinessZone: "orange",   // avg = 2
      nextActionType: "take_crp", // morningAction → orange zone path
    },
  },

  // S24: nextActionType — midday yellow → crp_reminder
  {
    input: {
      id: "S24",
      name: "Midday yellow zone → nextAction crp_reminder",
      profile: DEFAULT_PROFILE,
      currentTime: 800, // 13:20 — in CRP window 13:00-15:00
      weekHistory: [
        nightRecord("2026-02-14", 4),
        nightRecord("2026-02-15", 3),
        nightRecord("2026-02-16", 3),
      ],
      calendarEvents: [],
    },
    expected: {
      readinessZone: "yellow",      // avg = 3.33
      nextActionType: "crp_reminder", // midday branch fires for non-green zone
    },
  },

  // S25: nextActionType — during pre-sleep window → start_pre_sleep
  {
    input: {
      id: "S25",
      name: "During pre-sleep window → nextAction start_pre_sleep",
      profile: DEFAULT_PROFILE,
      currentTime: 1300, // 21:40 — inside pre-sleep 21:30-23:00
      weekHistory: [nightRecord("2026-02-16", 5)],
      calendarEvents: [],
    },
    expected: {
      readinessZone: "green",
      nextActionType: "start_pre_sleep", // isTimeBetween(1300, 1290, 1380) → true
    },
  },

  // S26: morningAction regression — must read weekHistory[0] (newest), not [length-1]
  //
  // weekHistory is sorted newest-first by saveNightRecord().
  // history[0] = most recent night (5 cycles, yesterday)
  // history[1] = older night (3 cycles, day before)
  //
  // Bug: weekHistory[weekHistory.length-1] = history[1] → "3 cycles last night" (WRONG)
  // Fix: weekHistory[0]                   = history[0] → "5 cycles last night" (CORRECT)
  {
    input: {
      id: "S26",
      name: "Morning action: 2-night history — title shows most recent night (5), not oldest (3)",
      profile: DEFAULT_PROFILE,
      currentTime: 420, // 07:00 — within 2 h of anchor 06:30
      weekHistory: [
        nightRecord("2026-02-16", 5), // most recent — index 0
        nightRecord("2026-02-15", 3), // older       — index 1
      ],
      calendarEvents: [],
    },
    expected: {
      readinessZone: "yellow",          // avg(5, 3) = 4.0 → below 4.5 threshold
      nextActionType: "general_guidance",
      nextActionTitleContains: "5 cycles", // NOT "3 cycles" — regression guard
    },
  },
];
