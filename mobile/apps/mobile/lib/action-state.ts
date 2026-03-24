/**
 * action-state.ts — R90 Action Card State Machine
 *
 * Pure function — no network, no React.
 * Answers: "What should the user do RIGHT NOW?"
 *
 * Inputs:
 *   nowMin   — current time in minutes since midnight
 *   wakeMin  — anchor time (ARP) in minutes since midnight
 *
 * Derived R90 rhythm:
 *   Cycle duration : 90 min
 *   MRM           : at minute 80 of each cycle (10 min before next)
 *   CRP window    : wakeMin + 7h (default, once/day)
 *   Bedtime       : wakeMin - (idealCycles * 90) wrapped to previous night
 *   Wind-down     : bedtime - 60 min
 */

export type ActionState =
  | 'morning'        // just woke up — confirm wake
  | 'pre_mrm'        // 10–15 min before MRM
  | 'mrm_active'     // during MRM window (5 min)
  | 'post_mrm'       // right after MRM (20 min)
  | 'pre_crp'        // 30–60 min before CRP
  | 'crp_active'     // during CRP (20 min)
  | 'pre_winddown'   // 45 min before wind-down
  | 'winddown'       // wind-down window (60 min)
  | 'sleep_window'   // ideal sleep time
  | 'missed_sleep'   // missed ideal window, next cycle available
  | 'night'          // sleeping — nothing to do
  | 'on_track';      // default between events

export interface ActionCardState {
  state:         ActionState;
  title:         string;
  subtitle:      string;
  cta:           string | null;
  ctaColor:      'accent' | 'gold' | 'green';
  nextEventIn:   number | null;  // minutes until next event (for countdown)
  nextEventTime: number | null;  // absolute time in minutes (for display)
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CYCLE       = 90;
const MRM_OFFSET  = 80;   // MRM fires 80 min into each cycle
const MRM_WINDOW  = 5;    // MRM active for 5 min
const MRM_POST    = 20;   // post-MRM state lasts 20 min
const PRE_MRM     = 15;   // show PRE_MRM 15 min before
const CRP_OFFSET  = 7 * 60; // CRP at wake + 7h
const CRP_WINDOW  = 20;   // CRP lasts 20 min
const PRE_CRP     = 60;   // show PRE_CRP 60 min before
const WINDDOWN_BEFORE = 60; // wind-down 60 min before bedtime
const PRE_WINDDOWN    = 45; // show PRE_WINDDOWN 45 min before wind-down
const MORNING_WINDOW  = 30; // confirm wake for 30 min

// ─── Helper: wrap minutes to [0, 1440) ────────────────────────────────────────
function wrap(m: number): number {
  return ((m % 1440) + 1440) % 1440;
}

// ─── Helper: minutes until a future time ──────────────────────────────────────
function minUntil(target: number, now: number): number {
  const diff = wrap(target) - now;
  return diff > 0 ? diff : diff + 1440;
}

// ─── Helper: is now within [start, start+duration) ? ─────────────────────────
function inWindow(now: number, start: number, duration: number): boolean {
  const s = wrap(start);
  const e = wrap(start + duration);
  if (s <= e) return now >= s && now < e;
  // Wraps midnight
  return now >= s || now < e;
}

// ─── Format minutes as HH:MM ─────────────────────────────────────────────────
function fmt(m: number): string {
  const n = wrap(m);
  const h = Math.floor(n / 60);
  const min = n % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// ─── State Machine ────────────────────────────────────────────────────────────

export function getCurrentActionState(
  nowMin:       number,
  wakeMin:      number,
  idealCycles:  number = 5,
): ActionCardState {

  // Derived times
  const bedtimeMin   = wrap(wakeMin - idealCycles * CYCLE); // previous night's bedtime
  const crpTime      = wrap(wakeMin + CRP_OFFSET);
  const winddownTime = wrap(bedtimeMin - WINDDOWN_BEFORE);  // tonight's wind-down
  const nextBedtime  = bedtimeMin > wakeMin                // tonight
    ? bedtimeMin
    : wrap(bedtimeMin + 1440 - (wakeMin > bedtimeMin ? 0 : 1440));

  // Tonight's times (forward from now)
  const tonightBedtime   = wrap(wakeMin + idealCycles * CYCLE); // forward: wake + cycles
  const tonightWinddown  = wrap(tonightBedtime - WINDDOWN_BEFORE);

  // ── 1. MORNING — first 30 min after wake ────────────────────────────────
  if (inWindow(nowMin, wakeMin, MORNING_WINDOW)) {
    return {
      state:         'morning',
      title:         'Confirm your wake time',
      subtitle:      `Start your rhythm for today — ${fmt(wakeMin)}`,
      cta:           `Confirm → ${fmt(wakeMin)}`,
      ctaColor:      'gold',
      nextEventIn:   null,
      nextEventTime: null,
    };
  }

  // ── 2. MRM windows (each cycle after morning window) ────────────────────
  // MRMs occur at wakeMin + 80, +170, +260, +350, +440 (every 90 min)
  for (let c = 0; c < idealCycles; c++) {
    const mrmTime = wrap(wakeMin + c * CYCLE + MRM_OFFSET);

    // MRM active
    if (inWindow(nowMin, mrmTime, MRM_WINDOW)) {
      const nextCycleStart = wrap(mrmTime + (CYCLE - MRM_OFFSET));
      return {
        state:         'mrm_active',
        title:         'Micro Reset now',
        subtitle:      '2-min breathing pause. Clear your mind.',
        cta:           'Start reset',
        ctaColor:      'accent',
        nextEventIn:   CYCLE - MRM_OFFSET,
        nextEventTime: nextCycleStart,
      };
    }

    // Post-MRM
    if (inWindow(nowMin, mrmTime + MRM_WINDOW, MRM_POST)) {
      const nextMrmTime = wrap(wakeMin + (c + 1) * CYCLE + MRM_OFFSET);
      const nextIn      = minUntil(nextMrmTime, nowMin);
      return {
        state:         'post_mrm',
        title:         'Back to focus',
        subtitle:      `Next reset in ${nextIn} min`,
        cta:           null,
        ctaColor:      'accent',
        nextEventIn:   nextIn,
        nextEventTime: nextMrmTime,
      };
    }

    // Pre-MRM
    const preStart = wrap(mrmTime - PRE_MRM);
    if (inWindow(nowMin, preStart, PRE_MRM)) {
      const inMin = minUntil(mrmTime, nowMin);
      return {
        state:         'pre_mrm',
        title:         `Micro Reset in ${inMin} min`,
        subtitle:      'Prepare to pause and reset.',
        cta:           'Get ready',
        ctaColor:      'accent',
        nextEventIn:   inMin,
        nextEventTime: mrmTime,
      };
    }
  }

  // ── 3. CRP window ────────────────────────────────────────────────────────

  // CRP active
  if (inWindow(nowMin, crpTime, CRP_WINDOW)) {
    return {
      state:         'crp_active',
      title:         'Recovery time',
      subtitle:      '20 min mental recovery — not a nap.',
      cta:           'Start recovery',
      ctaColor:      'gold',
      nextEventIn:   CRP_WINDOW - (nowMin - crpTime),
      nextEventTime: wrap(crpTime + CRP_WINDOW),
    };
  }

  // Pre-CRP
  if (inWindow(nowMin, wrap(crpTime - PRE_CRP), PRE_CRP)) {
    const inMin = minUntil(crpTime, nowMin);
    return {
      state:         'pre_crp',
      title:         `Recovery in ${inMin} min`,
      subtitle:      '20-min recovery period coming — plan for it.',
      cta:           'Plan it',
      ctaColor:      'gold',
      nextEventIn:   inMin,
      nextEventTime: crpTime,
    };
  }

  // ── 4. Wind-down ─────────────────────────────────────────────────────────

  // Wind-down active (60 min window)
  if (inWindow(nowMin, tonightWinddown, WINDDOWN_BEFORE)) {
    const inMin = minUntil(tonightBedtime, nowMin);
    return {
      state:         'winddown',
      title:         'Wind-down time',
      subtitle:      `Sleep window in ${inMin} min. Step away from screens.`,
      cta:           'Start wind-down',
      ctaColor:      'accent',
      nextEventIn:   inMin,
      nextEventTime: tonightBedtime,
    };
  }

  // Pre-wind-down
  if (inWindow(nowMin, wrap(tonightWinddown - PRE_WINDDOWN), PRE_WINDDOWN)) {
    const inMin = minUntil(tonightWinddown, nowMin);
    return {
      state:         'pre_winddown',
      title:         `Wind-down in ${inMin} min`,
      subtitle:      'Prepare your next sleep cycle.',
      cta:           'Get ready',
      ctaColor:      'accent',
      nextEventIn:   inMin,
      nextEventTime: tonightWinddown,
    };
  }

  // ── 5. Sleep window ───────────────────────────────────────────────────────

  if (inWindow(nowMin, tonightBedtime, CYCLE)) {
    // First 15 min = ideal window
    const elapsed = nowMin - tonightBedtime;
    if (elapsed < 15) {
      return {
        state:         'sleep_window',
        title:         'Sleep window open',
        subtitle:      `Go now for ${idealCycles} full cycles. Wake ${fmt(wakeMin)}.`,
        cta:           'Good night',
        ctaColor:      'accent',
        nextEventIn:   null,
        nextEventTime: wakeMin,
      };
    }
    // Missed window — propose next cycle
    const nextCycleTime = wrap(tonightBedtime + CYCLE);
    const inMin         = minUntil(nextCycleTime, nowMin);
    const remainCycles  = idealCycles - 1;
    return {
      state:         'missed_sleep',
      title:         `Next cycle at ${fmt(nextCycleTime)}`,
      subtitle:      `${remainCycles} cycles — still a great night.`,
      cta:           'Adapt',
      ctaColor:      'accent',
      nextEventIn:   inMin,
      nextEventTime: nextCycleTime,
    };
  }

  // ── 6. Night (sleeping) ───────────────────────────────────────────────────
  // Between bedtime+90 and wakeMin
  const afterSleep = wrap(tonightBedtime + CYCLE);
  const sleepUntil = wrap(wakeMin + 1440); // next morning

  if (inWindow(nowMin, afterSleep, 1440 - CYCLE - WINDDOWN_BEFORE - PRE_WINDDOWN - MORNING_WINDOW)) {
    return {
      state:         'night',
      title:         'Good night',
      subtitle:      `Next wake: ${fmt(wakeMin)}`,
      cta:           null,
      ctaColor:      'accent',
      nextEventIn:   minUntil(wakeMin, nowMin),
      nextEventTime: wakeMin,
    };
  }

  // ── 7. Default — on track ─────────────────────────────────────────────────

  // Find next event to show countdown
  const nextMrmTime = wrap(wakeMin + MRM_OFFSET); // first MRM of day
  const nextIn      = minUntil(crpTime, nowMin) < minUntil(nextMrmTime, nowMin)
    ? minUntil(crpTime, nowMin)
    : minUntil(nextMrmTime, nowMin);

  return {
    state:         'on_track',
    title:         'Your rhythm is on track',
    subtitle:      nextIn < 120 ? `Next event in ${nextIn} min` : 'Stay consistent today.',
    cta:           null,
    ctaColor:      'green',
    nextEventIn:   nextIn,
    nextEventTime: null,
  };
}
