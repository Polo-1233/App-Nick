/**
 * Rules registry — maps rule IDs to the R90 Logic Map document.
 *
 * Each rule has an ID, description, status (CONFIRMED/TODO_NICK),
 * and a category that matches the Logic Map sections.
 *
 * This file serves as the code-side mirror of /docs/10_method/R90_LOGIC_MAP_v0.1.md
 */

import type { RuleStatus } from "@r90/types";

export interface RuleEntry {
  id: string;
  description: string;
  status: RuleStatus;
  category: string;
  nickQuestion?: string;
}

export const RULES_REGISTRY: RuleEntry[] = [
  // --- 4.1 Cycle Calculation ---
  {
    id: "R001",
    description: "Bedtime = Anchor Time - (number_of_cycles x 90 min)",
    status: "CONFIRMED",
    category: "cycle_calculation",
  },
  {
    id: "R002",
    description: "Default cycles per night = 5 (bedtime = anchor - 7h30)",
    status: "TODO_NICK",
    category: "cycle_calculation",
    nickQuestion: "Is 5 always the default, or does it vary by chronotype?",
  },
  {
    id: "R003",
    description: "Minimum useful night = 3 cycles (4h30)",
    status: "TODO_NICK",
    category: "cycle_calculation",
    nickQuestion: "Confirm minimum cycles per night.",
  },
  {
    id: "R004",
    description: "If bedtime missed, recalculate to next available cycle start (drop 1 cycle)",
    status: "CONFIRMED",
    category: "cycle_calculation",
  },
  {
    id: "R005",
    description: "Never recommend fewer than 2 cycles in a single sleep window",
    status: "TODO_NICK",
    category: "cycle_calculation",
    nickQuestion: "Confirm absolute floor for cycles.",
  },
  {
    id: "R006",
    description: "Cycles count toward weekly target regardless of which night they occur",
    status: "CONFIRMED",
    category: "cycle_calculation",
  },

  // --- 4.2 Down-Period & Pre-Sleep ---
  {
    id: "R010",
    description: "Down-period starts 90 min before first cycle",
    status: "TODO_NICK",
    category: "down_period",
    nickQuestion: "Always 90 min, or 60 for some situations?",
  },
  {
    id: "R011",
    description: "Pre-sleep routine starts 30 min before down-period",
    status: "TODO_NICK",
    category: "down_period",
    nickQuestion: "Confirm timing.",
  },
  {
    id: "R012",
    description: "During down-period: no screens, dim lights, light activity only",
    status: "CONFIRMED",
    category: "down_period",
  },
  {
    id: "R013",
    description: "After late event, adrenaline clearance = 90 min before first available cycle",
    status: "TODO_NICK", // TODO: Confirm adrenaline clearance timing (Product Vision only, not in book)
    category: "down_period",
    nickQuestion: "Confirm 90-min adrenaline clearance applies universally.",
  },
  {
    id: "R014",
    description: "Late-event protocol: accept delayed start, don't force early sleep",
    status: "CONFIRMED",
    category: "down_period",
  },

  // --- 4.3 CRP (Controlled Recovery Period) ---
  {
    id: "R020",
    description: "CRP window = 13:00-15:00 (book-confirmed ch. 5)",
    status: "CONFIRMED",
    category: "crp",
  },
  {
    id: "R021",
    description: "CRP can be 30 min or 90 min",
    status: "CONFIRMED",
    category: "crp",
  },
  {
    id: "R022",
    description: "CRP recommended when previous night < 5 cycles",
    status: "CONFIRMED",
    category: "crp",
  },
  {
    id: "R023",
    description: "CRP counts toward weekly total",
    status: "TODO_NICK",
    category: "crp",
    nickQuestion: "30-min CRP = 0.5 cycle or 1 cycle? 90-min = 1 cycle?",
  },
  {
    id: "R024",
    description: "Second CRP window: 17:00-19:00, 30 min only (book-confirmed ch. 5)",
    status: "CONFIRMED",
    category: "crp",
  },
  {
    id: "R025",
    description: "Evening CRP must be 30 min only (90 min interferes with night sleep)",
    status: "CONFIRMED",
    category: "crp",
  },

  // --- 4.4 Calendar Conflicts ---
  {
    id: "R030",
    description: "If event overlaps with pre-sleep, offer 2 options: shortened routine or delayed cycle",
    status: "TODO_NICK", // TODO: Product Vision pattern, not explicit in book
    category: "conflicts",
    nickQuestion: "Confirm conflict resolution pattern (2 options: shortened routine vs delayed cycle).",
  },
  {
    id: "R031",
    description: "Anchor time is NEVER moved to accommodate calendar events",
    status: "CONFIRMED", // Book ch. 3: anchor is non-negotiable
    category: "conflicts",
  },
  {
    id: "R032",
    description: "If event ends past ideal bedtime, recalculate to next cycle boundary",
    status: "CONFIRMED", // Book ch. 3: cycle boundary logic
    category: "conflicts",
  },
  {
    id: "R033",
    description: "R-Lo presents options, never demands. User always chooses.",
    status: "TODO_NICK", // TODO: R-Lo persona from Product Vision, not in book
    category: "conflicts",
    nickQuestion: "Confirm R-Lo should present options, never demands.",
  },

  // --- 4.5 Weekly Recovery ---
  {
    id: "R040",
    description: "Weekly target = 35 cycles (5 x 7)",
    status: "CONFIRMED",
    category: "weekly",
  },
  {
    id: "R041",
    description: "If below 28 cycles by Thursday, flag recovery priority",
    status: "TODO_NICK", // TODO: Book says 28-30 acceptable for the WEEK, not by specific day
    category: "weekly",
    nickQuestion: "Confirm day-specific threshold (book mentions weekly minimum, not by-Thursday rule).",
  },
  {
    id: "R042",
    description: "One bad night doesn't define your week — never alarm on single-night deficit",
    status: "CONFIRMED",
    category: "weekly",
  },
  {
    id: "R043",
    description: "Recovery framing: 'You're at X/35. Two good nights and you're back on track.'",
    status: "TODO_NICK", // TODO: Message pattern from Product Vision, not book quote
    category: "weekly",
    nickQuestion: "Confirm recovery message framing pattern.",
  },

  // --- 4.6 Readiness Zone ---
  {
    id: "R050",
    description: "Green: last 3 nights avg >= 4.5 cycles AND no wearable red flags",
    status: "TODO_NICK",
    category: "readiness",
    nickQuestion: "Confirm criteria.",
  },
  {
    id: "R051",
    description: "Yellow: last 3 nights avg 3-4.5 cycles OR mild wearable signal",
    status: "TODO_NICK",
    category: "readiness",
    nickQuestion: "Confirm criteria.",
  },
  {
    id: "R052",
    description: "Orange: last 3 nights avg < 3 cycles OR strong wearable signal",
    status: "TODO_NICK",
    category: "readiness",
    nickQuestion: "Confirm criteria.",
  },
  {
    id: "R053",
    description: "Zone is NEVER shown as a number. Only Green/Yellow/Orange + R-Lo message.",
    status: "CONFIRMED",
    category: "readiness",
  },

  // --- 4.7 R-Lo Messages ---
  {
    id: "R060",
    description: "Morning message based on: last night cycles + weekly progress + zone",
    status: "TODO_NICK", // TODO: Message structure from Product Vision, not book
    category: "rlo",
    nickQuestion: "Confirm morning message structure (cycles + progress + zone).",
  },
  {
    id: "R061",
    description: "Midday message: CRP reminder if applicable",
    status: "TODO_NICK", // TODO: Message structure from Product Vision, not book
    category: "rlo",
    nickQuestion: "Confirm midday CRP reminder message pattern.",
  },
  {
    id: "R062",
    description: "Evening message: pre-sleep routine prompt",
    status: "TODO_NICK", // TODO: Message structure from Product Vision, not book
    category: "rlo",
    nickQuestion: "Confirm evening pre-sleep prompt pattern.",
  },
  {
    id: "R063",
    description: "Post-late-event message: down-period protocol guidance",
    status: "TODO_NICK", // TODO: Message structure from Product Vision, not book
    category: "rlo",
    nickQuestion: "Confirm post-event message pattern.",
  },
  {
    id: "R064",
    description: "Tone: calm, pragmatic, never anxious",
    status: "CONFIRMED", // Product Vision + PROJECT_CHARTER core principle
    category: "rlo",
  },
  {
    id: "R065",
    description: "Never use words: score, grade, poor, bad, fail",
    status: "CONFIRMED", // Product Vision + PROJECT_CHARTER core principle
    category: "rlo",
  },
];

/** Get all rules that need Nick's validation. */
export function getTodoNickRules(): RuleEntry[] {
  return RULES_REGISTRY.filter((r) => r.status === "TODO_NICK");
}

/** Get a rule by ID. */
export function getRule(id: string): RuleEntry | undefined {
  return RULES_REGISTRY.find((r) => r.id === id);
}

/** Get rules by category. */
export function getRulesByCategory(category: string): RuleEntry[] {
  return RULES_REGISTRY.filter((r) => r.category === category);
}
