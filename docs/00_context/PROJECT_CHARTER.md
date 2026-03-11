# R90 Digital Navigator — Project Charter

**Version:** 0.2
**Date:** 2026-02-17
**Status:** Draft — Awaiting Nick Validation
**Changelog:** v0.2 — Corrected PRC/CRP terminology, aligned definitions with source book, added explicit pre-sleep model.

---

## Goal

Build a mobile companion that translates Nick Littlehales' R90 sleep/recovery methodology into a calm, actionable daily execution system. The app guides users through cycle-based planning, calendar-aware scheduling, and simple next-best-action prompts — all delivered through R-Lo, a trusted recovery companion character.

## Non-Goals

- **Not a sleep tracker.** We do not score sleep or show anxiety-inducing metrics.
- **Not a medical device.** No diagnosis, no treatment claims, no clinical language.
- **Not a data dashboard.** Wearable data is INPUT only; never shown as raw numbers.
- **Not a chatbot.** R-Lo follows deterministic rules, not free-form conversation (LLM optional later behind strict guardrails).
- **Not a sleep hygiene lecture.** We execute, not educate. Guidance is embedded in actions.

## Product Principles

1. **Cycles, not hours.** The user thinks in 90-minute cycles and weekly targets (35 cycles), never in "8 hours."
2. **One action at a time.** The UI always surfaces the single most important thing to do NOW.
3. **Calm over clever.** Tone is warm, pragmatic, anti-anxiety. One bad night is not a crisis.
4. **Life-first.** The system adapts to the user's real schedule, not the other way around.
5. **Trust through consistency.** R-Lo shows up at predictable moments with reliable guidance.
6. **Invisible intelligence.** Wearable/health data is translated into plain-language actions.
7. **Nick is the authority.** Every rule must trace back to the R90 methodology. When in doubt, mark TODO_NICK.

## Tone & Voice

| Do | Don't |
|---|---|
| "3 cycles last night — that's one in seven, no big deal." | "Your sleep score is 62. Below average." |
| "Your body's asking for rest. PRC at 1 PM?" | "HRV below baseline. Recovery: Poor." |
| "You're at 28/35 cycles this week." | "Sleep debt: 4 hours." |
| Speak like a calm, experienced coach | Speak like a clinical report |

## Guardrails

- Never display raw HRV, recovery %, sleep stage breakdowns, or comparisons to "average."
- Never use words: "score," "grade," "rating," "poor," "bad," "fail" about sleep.
- Never recommend medication or supplements.
- Never diagnose or claim to treat conditions.
- All rules must be tagged CONFIRMED or TODO_NICK. Only CONFIRMED rules ship to users.
- R-Lo messages must pass tone review (calm, pragmatic, anti-anxiety).

## MVP Scope (Phase 1 — ~10 Weeks)

- Core logic engine (cycle calculation, day planning, conflict detection)
- R-Lo companion messaging (deterministic, rule-based)
- Calendar integration (read-only: detect conflicts, propose options)
- Mobile app shell (home screen: R-Lo message + next action + timeline)
- No auth, no backend, no subscription, no public launch

## Key Definitions

| Term | Definition |
|---|---|
| **Anchor Time** | Fixed wake-up time; the non-negotiable foundation of the R90 system |
| **Cycle** | 90-minute sleep block |
| **Weekly Target** | 35 cycles per week (5 cycles x 7 nights, adjustable) |
| **PRC / CRP** | Controlled Recovery Period (daytime 90-min or 30-min recovery window). Book uses "Période de Récupération Contrôlée." Single canonical term: **CRP**. |
| **Pre-Sleep Routine** | 90-minute wind-down period before bedtime (per Nick's book: screens off, dim lights, mental decompression). This IS the wind-down — not a separate concept from "down-period." |
| **Down-Period Protocol** | Specifically for post-event scenarios: 60-90 min adrenaline clearance after a late event before first available cycle. NOT a nightly routine — triggered only by late events. |
| **R-Lo** | Recovery companion character — the "Duo" of sleep recovery |
| **Readiness Zone** | Green/Yellow/Orange indicator (never a numeric score) |
