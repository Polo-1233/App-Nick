/**
 * R90 Digital Navigator — Shared Types
 *
 * Single source of truth for all types across core engine, tests, and mobile app.
 */

// --- Time & Scheduling ---

/** 24-hour time string, e.g. "06:30" */
export type TimeString = string;

/** ISO date string, e.g. "2026-02-17" */
export type DateString = string;

/** ISO datetime string */
export type DateTimeString = string;

/** Minutes since midnight (0-1439). Internal representation for calculations. */
export type MinuteOfDay = number;

export interface TimeBlock {
  start: MinuteOfDay;
  end: MinuteOfDay;
  type: BlockType;
  label: string;
}

export type BlockType =
  | "sleep_cycle"
  | "pre_sleep"
  | "down_period"
  | "crp"
  | "wake"
  | "calendar_event"
  | "free";

// --- User Profile ---

export type Chronotype = "AMer" | "PMer" | "Neither";

export interface UserProfile {
  anchorTime: MinuteOfDay; // e.g. 390 = 06:30
  chronotype: Chronotype;
  idealCyclesPerNight: number; // default: 5 (TODO_NICK: Q01)
  weeklyTarget: number; // default: 35
}

// --- Cycle Data ---

export interface CycleWindow {
  bedtime: MinuteOfDay;
  wakeTime: MinuteOfDay;
  cycleCount: number;
  preSleepStart: MinuteOfDay;
  downPeriodStart?: MinuteOfDay; // Optional: only present for post-event protocol
}

export interface NightRecord {
  date: DateString;
  cyclesCompleted: number;
  anchorTime: MinuteOfDay;
  actualWakeTime?: MinuteOfDay;
  actualBedtime?: MinuteOfDay;
}

// --- Calendar ---

export interface CalendarEvent {
  id:         string;
  title:      string;
  start:      MinuteOfDay;
  end:        MinuteOfDay;
  date:       DateString;
  /** Source metadata — optional, populated when available */
  sourceName?:  string;   // e.g. "iCloud", "Google", "Exchange"
  calendarName?: string;  // e.g. "Work", "Personal"
  color?:       string;   // hex color from the calendar
}

export interface Conflict {
  event: CalendarEvent;
  overlapsWith: BlockType;
  severity: "minor" | "major";
  description: string;
}

export interface ConflictOption {
  label: string;
  description: string;
  adjustedPlan: CycleWindow;
}

// --- Readiness ---

export type ReadinessZone = "green" | "yellow" | "orange";

export interface ReadinessState {
  zone: ReadinessZone;
  recentCycles: number[]; // last 3 nights
  weeklyTotal: number;
  weeklyTarget: number;
}

// --- Actions ---

export type ActionType =
  | "start_pre_sleep"
  | "go_to_sleep"
  | "wake_up"
  | "take_crp"
  | "crp_reminder"
  | "anchor_reminder"
  | "adjust_schedule"
  | "late_event_protocol"
  | "general_guidance";

export interface NextAction {
  type: ActionType;
  title: string;
  description: string;
  scheduledAt?: MinuteOfDay;
  ruleId: string; // traces back to R90_LOGIC_MAP
}

// --- R-Lo Messages ---

export type RLoMoment = "morning" | "midday" | "evening" | "post_event" | "general";

export interface RLoMessage {
  moment: RLoMoment;
  text: string;
  ruleId: string;
  tone: "calm" | "encouraging" | "pragmatic";
}

// --- Day Plan ---

export interface DayPlan {
  date: DateString;
  blocks: TimeBlock[];
  nextAction: NextAction;
  rloMessage: RLoMessage;
  readiness: ReadinessState;
  cycleWindow: CycleWindow;
  conflicts: Conflict[];
  zoneStatus: "confirmed" | "experimental"; // Method validation status (experimental until Nick confirms R050-R052)
}

// --- Rules Engine ---

export type RuleStatus = "CONFIRMED" | "TODO_NICK";

export interface RuleContext {
  now: MinuteOfDay;
  profile: UserProfile;
  todayPlan: CycleWindow;
  weekHistory: NightRecord[];
  calendarEvents: CalendarEvent[];
  readiness: ReadinessState;
}

// --- Scenario Testing ---

export interface ScenarioInput {
  id: string;
  name: string;
  profile: UserProfile;
  currentTime: MinuteOfDay;
  weekHistory: NightRecord[];
  calendarEvents: CalendarEvent[];
  lateEventEndTime?: MinuteOfDay;
}

export interface ScenarioExpectation {
  cycleWindow?: Partial<CycleWindow>;
  readinessZone?: ReadinessZone;
  nextActionType?: ActionType;
  /** Asserts dayPlan.nextAction.title contains the given substring. */
  nextActionTitleContains?: string;
  rloMessageContains?: string;
  conflictCount?: number;
  weeklyTotal?: number;
  hasCRPBlock?: boolean; // Assert whether DayPlan contains a CRP block
}

export interface Scenario {
  input: ScenarioInput;
  expected: ScenarioExpectation;
}
