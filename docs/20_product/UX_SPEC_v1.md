# UX Specification — v1

**Version:** 1.0
**Date:** 2026-02-17
**Purpose:** Define the exact data contract between core engine and UI layer.

---

## Overview

The mobile UI consumes a single `DayPlan` object produced by the core engine (`buildDayPlan()`). This document specifies:

1. **What fields the UI relies on** (critical for MVP)
2. **How those fields should be displayed**
3. **Which fields are experimental vs. confirmed** (method validation status)

---

## DayPlan Schema

### TypeScript Interface

```typescript
interface DayPlan {
  date: DateString;                    // ISO date (e.g., "2026-02-17")
  blocks: TimeBlock[];                 // Timeline of day blocks
  nextAction: NextAction;              // Single most important action right now
  rloMessage: RLoMessage;              // R-Lo companion message
  readiness: ReadinessState;           // Weekly recovery state
  cycleWindow: CycleWindow;            // Tonight's sleep plan
  conflicts: Conflict[];               // Calendar conflicts detected
  zoneStatus: "confirmed" | "experimental";  // Method validation status
}
```

---

## Field-by-Field Specification

### 1. `blocks: TimeBlock[]`

**Purpose:** Timeline of the day, sorted anchor-relative (day starts at user's anchor time, not midnight).

**Structure:**
```typescript
interface TimeBlock {
  start: MinuteOfDay;    // 0-1439 (minutes since midnight)
  end: MinuteOfDay;      // 0-1439
  type: BlockType;       // "wake" | "sleep_cycle" | "pre_sleep" | "crp" | "calendar_event" | "down_period" | "free"
  label: string;         // Display label (e.g., "Sleep Cycle 1", "CRP — 30 min")
}
```

**UI Display:**
- Vertical timeline with dot + line connector
- Color-coded by block type (see TimelineView.tsx)
- Duration calculated: `((end - start + 1440) % 1440)` minutes (handles midnight wraparound)
- Blocks ordered chronologically from anchor time forward

**Critical Blocks:**
- `wake`: User's anchor time + morning routine
- `pre_sleep`: 90-minute wind-down before bedtime
- `sleep_cycle`: Each 90-minute sleep cycle (bedtime → wake)
- `crp`: Controlled Recovery Period (appears only when zone is yellow/orange)
- `calendar_event`: User's calendar events (read-only from device calendar)

**CRP Block Rules:**
- **When zone = green:** No CRP block
- **When zone = yellow:** Midday CRP (13:00-15:00, 30 min) OR evening CRP (17:00-19:00, 30 min) if midday blocked
- **When zone = orange:** Midday CRP (13:00-15:00, 90 min) OR evening CRP (17:00-19:00, 30 min) if midday blocked

---

### 2. `nextAction: NextAction`

**Purpose:** The single most important action the user should take right now.

**Structure:**
```typescript
interface NextAction {
  type: ActionType;           // "start_pre_sleep" | "go_to_sleep" | "take_crp" | "crp_reminder" | etc.
  title: string;              // Short title (e.g., "Pre-sleep routine")
  description: string;        // 1-2 sentence description
  scheduledAt?: MinuteOfDay;  // Optional: when this action should happen
  ruleId: string;             // Traces back to R90 rule (e.g., "R010")
}
```

**UI Display:**
- Card with title + description
- Icon based on `type`
- Time indicator if `scheduledAt` is present
- Tappable to mark action complete (future feature)

**Action Priority Waterfall:**
1. Morning (within 2h of anchor) → morning action
2. Midday CRP window (13:00-15:00, zone ≠ green) → CRP reminder
3. Pre-sleep approaching (< 2h) → pre-sleep prompt
4. During pre-sleep window → wind-down action
5. Bedtime → go to sleep
6. Default → general guidance

---

### 3. `rloMessage: RLoMessage`

**Purpose:** Contextual companion message from R-Lo character.

**Structure:**
```typescript
interface RLoMessage {
  moment: RLoMoment;   // "morning" | "midday" | "evening" | "post_event" | "general"
  text: string;        // Message text (1-2 sentences, calm tone)
  ruleId: string;      // Traces to R90 rule
  tone: "calm" | "encouraging" | "pragmatic";
}
```

**UI Display:**
- Bubble/card at top of home screen
- R-Lo avatar icon
- Text in conversational style (never: score, grade, poor, bad, fail)
- Tone determines visual treatment (color, icon)

**Message Selection:**
- Time-aware: `moment` determined by time since anchor (not fixed clock times)
- Zone-aware: message content varies by green/yellow/orange
- Context-aware: post-event protocol triggers specific message

---

### 4. `readiness: ReadinessState`

**Purpose:** Weekly recovery state and cycle tracking.

**Structure:**
```typescript
interface ReadinessState {
  zone: ReadinessZone;      // "green" | "yellow" | "orange"
  recentCycles: number[];   // Last 3 nights (e.g., [5, 4, 3])
  weeklyTotal: number;      // Total cycles this week (e.g., 28)
  weeklyTarget: number;     // Target cycles (default: 35)
}
```

**UI Display:**
- Zone as color indicator (green/yellow/orange dot or badge)
- Never show zone as number or percentage
- Weekly progress: "X/35 cycles" text
- Zone NEVER labeled as "score" or "rating"

**Zone Computation (EXPERIMENTAL):**
```
Green:  avg(last 3 nights) ≥ 4.5 cycles
Yellow: avg(last 3 nights) ≥ 3.0 cycles
Orange: avg(last 3 nights) < 3.0 cycles
```

**⚠️ Status:** These thresholds are **EXPERIMENTAL** — not book-confirmed. See zoneStatus field.

---

### 5. `cycleWindow: CycleWindow`

**Purpose:** Tonight's sleep plan (bedtime, wake time, cycle count).

**Structure:**
```typescript
interface CycleWindow {
  bedtime: MinuteOfDay;          // Tonight's bedtime
  wakeTime: MinuteOfDay;         // Tomorrow's wake time (anchor)
  cycleCount: number;            // Number of 90-min cycles planned (2-6)
  preSleepStart: MinuteOfDay;    // When pre-sleep routine starts (bedtime - 90)
  downPeriodStart?: MinuteOfDay; // Optional: post-event protocol only
}
```

**UI Display:**
- Used primarily in timeline blocks
- May show summary: "5 cycles tonight (23:00 → 06:30)"
- `downPeriodStart` only relevant for post-event scenarios (not MVP)

---

### 6. `conflicts: Conflict[]`

**Purpose:** Calendar events that overlap with recovery windows.

**Structure:**
```typescript
interface Conflict {
  event: CalendarEvent;
  overlapsWith: BlockType;         // "pre_sleep" | "sleep_cycle" | "down_period"
  severity: "minor" | "major";
  description: string;             // e.g., "Dinner overlaps with pre-sleep routine"
}
```

**UI Display:**
- Warning badge on timeline
- Conflict resolution sheet (future feature: present 2 options)
- Count shown in summary: "1 conflict detected"

---

### 7. `zoneStatus: "confirmed" | "experimental"` ⭐ NEW FIELD

**Purpose:** Indicate whether readiness zone thresholds are method-validated or experimental.

**Values:**
- `"confirmed"`: Zone thresholds validated by Nick (can ship without disclaimer)
- `"experimental"`: Zone thresholds are provisional/invented (show disclaimer)

**Current Status:** **ALWAYS `"experimental"`** until Nick validates thresholds (rules R050-R052).

**UI Display:**
- Small caption under ReadinessIndicator: "Experimental thresholds"
- Tooltip/info icon explaining: "These zone thresholds are being validated with Nick. They're based on R90 principles but not yet book-confirmed."
- Optional: gray dot instead of full color when experimental

**Why Experimental:**
The green/yellow/orange thresholds (avg ≥ 4.5, ≥ 3.0, < 3.0) were **invented for MVP** to have a working UI. Nick's book describes **weekly thinking** and avoiding single-night panic, but does NOT specify numeric thresholds for daily zone assignment.

**Validation Path:**
1. MVP ships with `zoneStatus: "experimental"` and UI disclaimer
2. Nick call validates or adjusts thresholds (Q: "Green at avg ≥ 4.5 cycles — does that match your intent?")
3. Post-validation: update rules.ts (R050-R052 → CONFIRMED), set `zoneStatus: "confirmed"`, remove UI disclaimer

---

## Data Flow

```
User Profile + Week History + Calendar Events + Now
                    ↓
          buildDayPlan() (core/planner.ts)
                    ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
calculateCycle  computeReadiness  detectConflicts
    ↓               ↓               ↓
 CycleWindow   ReadinessState   Conflict[]
    ↓               ↓               ↓
         buildBlocks() (with CRP if zone ≠ green)
                    ↓
            TimeBlock[] (sorted)
                    ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
selectNextAction  generateRLo  (add zoneStatus)
    ↓               ↓               ↓
            DayPlan (returned)
                    ↓
          useDayPlan() hook
                    ↓
         HomeScreen (React Native)
```

---

## Experimental Fields — User Transparency

The following DayPlan fields are based on **EXPERIMENTAL** rules (not book-confirmed):

| Field | Why Experimental | Validation Needed |
|-------|------------------|-------------------|
| `readiness.zone` | Thresholds (4.5, 3.0) invented for MVP | Nick must validate thresholds (R050-R052) |
| `zoneStatus` | Always "experimental" until Nick confirms | Nick call validates zone logic |

**UI Treatment:**
- Show zone color but add "Experimental" label
- Info icon with explanation: "These thresholds are provisional. We're validating them with Nick to ensure they match the R90 method."
- Do NOT hide the zone — it's useful for testing and feedback, just transparently label it

---

## Phase C UI Implementation Checklist

Before building Phase C UI:

- [ ] Verify `DayPlan` has all 7 fields above
- [ ] Add `zoneStatus` field to DayPlan type and planner output
- [ ] Update ReadinessIndicator to show "Experimental" label when `zoneStatus === "experimental"`
- [ ] Ensure TimelineView correctly handles midnight-spanning blocks
- [ ] Verify NextActionCard displays `type`, `title`, `description`, `scheduledAt`
- [ ] Verify RLoCard displays `text` with appropriate tone styling
- [ ] Test with 3 fixtures: green zone, yellow zone (CRP), orange zone (CRP + calendar conflict)

---

*This spec is the contract between core engine and UI. Any deviation must update this doc first.*
