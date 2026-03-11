# R90 Logic Map — v0.1

**Version:** 0.1
**Date:** 2026-02-17
**Status:** Template — Requires Nick validation session (Week 1 call)

---

## 1. Definitions

| Term | Definition | Status |
|---|---|---|
| Anchor Time | The user's fixed wake-up time. Non-negotiable. All cycles calculate backward from this. | CONFIRMED |
| Cycle | A 90-minute sleep block. The fundamental unit of sleep in R90. | CONFIRMED |
| Ideal Night | 5 cycles (7.5 hours) — the default target per night. | TODO_NICK: Is 5 always the default, or does it vary by chronotype? |
| Weekly Target | 35 cycles/week. Missed cycles can be recovered across the week. | CONFIRMED |
| PRC | Post-sleep Recovery Controlled period. A daytime recovery window (30 or 90 min). | CONFIRMED |
| Down-Period | 60-90 min buffer before the first sleep cycle. Used to clear adrenaline and transition. | TODO_NICK: Is it always 90 min, or does it vary by event type? |
| Pre-Sleep Routine | A checklist of wind-down activities before the down-period. | CONFIRMED |
| Chronotype | AMer (early bird), PMer (night owl), or Neither. Affects anchor time selection. | CONFIRMED |
| Sleep Surface | Bed/mattress setup. Audited separately via Recovery Room feature. | CONFIRMED |
| Readiness Zone | Green (full reserves) / Yellow (normal, PRC useful) / Orange (recovery priority). | CONFIRMED |

## 2. Inputs

| Input | Source | Required | Notes |
|---|---|---|---|
| Anchor Time | User setup | Yes | Set once, rarely changed |
| Chronotype | User questionnaire | Yes | AMer / PMer / Neither |
| Ideal Cycles/Night | Derived or user override | Yes | Default: 5 (TODO_NICK: confirm) |
| Calendar Events | Google/Apple/Outlook calendar | Optional | Read-only; used for conflict detection |
| Travel Plans | User input or calendar | Optional | Departure/arrival times, timezone delta |
| Late Event End Time | User input or detected | Optional | Triggers down-period protocol |
| Wearable Signals | HealthKit / Whoop / Oura | Optional | Never shown raw; translated to zone |
| Current Time | System | Yes | Determines "now" context |
| Cycle History | Local storage | Yes | Running count for weekly target |

## 3. Outputs

| Output | Description | Where Shown |
|---|---|---|
| Next Best Action | Single most important action right now | Home screen widget |
| Day Plan | Timeline of blocks: wake, cycles, PRC windows, pre-sleep, down-period | Navigator view |
| R-Lo Message | Contextual companion message (calm, actionable) | Home screen |
| Readiness Zone | Green / Yellow / Orange indicator | Home screen |
| Weekly Cycle Count | X / 35 cycles completed | Scoreboard |
| Conflict Alerts | When calendar events overlap with recovery windows | Navigator view |

## 4. Rules

### 4.1 Cycle Calculation

| Rule # | Rule | Status |
|---|---|---|
| R001 | Bedtime = Anchor Time - (number_of_cycles × 90 min) | CONFIRMED |
| R002 | Default cycles per night = 5 (bedtime = anchor - 7h30) | TODO_NICK: Confirm default; does chronotype affect this? |
| R003 | Minimum useful night = 3 cycles (4h30) | TODO_NICK: Confirm minimum |
| R004 | If bedtime is missed, recalculate to next available cycle start (drop 1 cycle) | CONFIRMED |
| R005 | Never recommend fewer than 2 cycles in a single sleep window | TODO_NICK: Confirm floor |
| R006 | Cycles count toward weekly target regardless of which night they occur | CONFIRMED |

### 4.2 Down-Period & Pre-Sleep

| Rule # | Rule | Status |
|---|---|---|
| R010 | Down-period starts 90 min before first cycle | TODO_NICK: Always 90, or 60 for some? |
| R011 | Pre-sleep routine starts 30 min before down-period | TODO_NICK: Confirm timing |
| R012 | During down-period: no screens, dim lights, light activity only | CONFIRMED |
| R013 | After a late event, adrenaline clearance = 90 min before first available cycle | CONFIRMED |
| R014 | Late-event protocol: accept delayed start, don't force early sleep | CONFIRMED |

### 4.3 PRC (Daytime Recovery)

| Rule # | Rule | Status |
|---|---|---|
| R020 | PRC window = midday ± 2 hours (roughly 1-3 PM) | TODO_NICK: Exact window? |
| R021 | PRC can be 30 min (power nap) or 90 min (full cycle) | CONFIRMED |
| R022 | PRC is recommended when previous night < 5 cycles | CONFIRMED |
| R023 | PRC counts as partial cycle recovery (TODO: how much?) | TODO_NICK: Does 30-min PRC = 0.5 cycle? 90-min = 1 cycle? |
| R024 | Second PRC window: early evening ~5-7 PM (if needed) | TODO_NICK: Confirm second window exists |
| R025 | No PRC within 3 hours of planned bedtime | TODO_NICK: Confirm buffer |

### 4.4 Calendar Conflict Resolution

| Rule # | Rule | Status |
|---|---|---|
| R030 | If calendar event overlaps with pre-sleep window, offer 2 options: shortened routine or delayed cycle | CONFIRMED |
| R031 | Anchor time is NEVER moved to accommodate calendar events | CONFIRMED |
| R032 | If event ends past ideal bedtime, recalculate to next cycle boundary | CONFIRMED |
| R033 | R-Lo presents options, never demands. User always chooses. | CONFIRMED |

### 4.5 Weekly Recovery

| Rule # | Rule | Status |
|---|---|---|
| R040 | Weekly target = 35 cycles (5 × 7) | CONFIRMED |
| R041 | If below 28 cycles by Thursday, flag recovery priority for remaining nights | TODO_NICK: Confirm threshold |
| R042 | "One bad night doesn't define your week" — never alarm on single-night deficit | CONFIRMED |
| R043 | Recovery framing: "You're at X/35. Two good nights and you're back on track." | CONFIRMED |

### 4.6 Readiness Zone

| Rule # | Rule | Status |
|---|---|---|
| R050 | Green: last 3 nights averaged ≥ 4.5 cycles AND no wearable red flags | TODO_NICK: Confirm criteria |
| R051 | Yellow: last 3 nights averaged 3-4.5 cycles OR mild wearable signal | TODO_NICK: Confirm criteria |
| R052 | Orange: last 3 nights averaged < 3 cycles OR strong wearable signal | TODO_NICK: Confirm criteria |
| R053 | Zone is NEVER shown as a number. Only Green/Yellow/Orange + R-Lo message. | CONFIRMED |

### 4.7 R-Lo Message Selection

| Rule # | Rule | Status |
|---|---|---|
| R060 | Morning message based on: last night's cycles + weekly progress + zone | CONFIRMED |
| R061 | Midday message: PRC reminder if applicable | CONFIRMED |
| R062 | Evening message: pre-sleep routine prompt | CONFIRMED |
| R063 | Post-late-event message: down-period protocol guidance | CONFIRMED |
| R064 | Tone: calm, pragmatic, never anxious. See PROJECT_CHARTER.md tone table. | CONFIRMED |
| R065 | Never use words: score, grade, poor, bad, fail | CONFIRMED |

## 5. Edge Cases

| Case | Expected Behavior | Status |
|---|---|---|
| User sets anchor at 4:00 AM | Valid. Calculate backward. Warn if < 3 cycles. | CONFIRMED |
| User has no calendar connected | All features work; conflict detection disabled | CONFIRMED |
| User misses anchor by 2 hours | R-Lo: "Late start, no stress. Here's your adjusted day." Recalculate PRC. | CONFIRMED |
| User has back-to-back travel days | Travel mode (future feature). For now: manual anchor adjustment. | TODO_NICK: Priority? |
| Night shift worker | Anchor time can be set to any hour. System is time-agnostic. | TODO_NICK: Any special rules for night shift? |
| User wakes up mid-cycle | Do not count as full cycle. R-Lo: "Short night. PRC will help." | TODO_NICK: How to count partial cycles? |

## 6. Scenarios

| # | Scenario | Anchor | Cycles Target | Events | Expected Output |
|---|---|---|---|---|---|
| S01 | Normal weeknight, no events | 06:30 | 5 | None | Bedtime 23:00, pre-sleep 21:30 |
| S02 | Late dinner at 21:00, ends 22:30 | 06:30 | 5→4 | Dinner 21:00-22:30 | Offer: 4 cycles at 00:00 or 3 cycles at 01:30 |
| S03 | Short night (3 cycles) | 06:30 | 3 (actual) | None | PRC recommended at 13:00. "28/35 cycles — two good nights to catch up." |
| S04 | Perfect week so far (Mon-Thu = 20 cycles) | 06:30 | 5 | None | Green zone. "On track. 20/35 with three nights to go." |
| S05 | Bad week (Mon-Thu = 12 cycles) | 06:30 | 5 | None | Yellow zone. "Recovery priority tonight. Full 5 cycles." |
| S06 | Post-match scenario, event ends 22:00 | 06:30 | 4 | Match ends 22:00 | Down-period until 23:30. First cycle 23:30. 4 cycles. Wake 06:30. |
| S07 | Post-match scenario, event ends 00:00 | 06:30 | 3 | Match ends 00:00 | Down-period until 01:30. 3 cycles. Wake 06:00 (adjusted) or 06:30 (2 cycles). |
| S08 | User anchor = 05:00 (early chronotype) | 05:00 | 5 | None | Bedtime 21:30, pre-sleep 20:00 |
| S09 | User anchor = 08:00 (late chronotype) | 08:00 | 5 | None | Bedtime 00:30, pre-sleep 23:00 |
| S10 | Calendar conflict: meeting at 06:00 | 06:30 | 5 | Meeting 06:00 | Suggest temporary anchor shift to 05:30 for this day. TODO_NICK: Or keep 06:30 and be late? |
| S11 | PRC day after short night | 06:30 | — | Meeting 13:00-14:00 | PRC window blocked. Offer: 30-min PRC at 11:30 or 90-min PRC at 14:30 |
| S12 | Weekend recovery | 06:30 | 5 | No obligations | Green zone? Extra cycle option. R-Lo: "Want a 6-cycle night? Bedtime 21:30." |
| S13 | Travel: flight lands 23:00 local | 06:30 | 3 | Flight arrival 23:00 | Down-period post-travel. First cycle 00:30. 4 cycles to 06:30. |
| S14 | Consecutive short nights (2 + 2 + 2) | 06:30 | 5 | None | Orange zone. Strongly recommend full 5 cycles + PRC. |

## 7. Open Questions for Nick

| # | Question | Context | Priority |
|---|---|---|---|
| Q01 | Is 5 cycles/night always the default, or should it vary by chronotype? | Rules R002 | High |
| Q02 | What is the minimum acceptable cycles in one night? (We assume 2) | Rule R005 | High |
| Q03 | Is the down-period always 90 minutes, or can it be 60 in some cases? | Rules R010, R013 | High |
| Q04 | How should PRC count toward weekly target? (30 min = 0.5 cycle? 90 min = 1?) | Rule R023 | High |
| Q05 | Does a second PRC window (5-7 PM) exist in R90? | Rule R024 | Medium |
| Q06 | What's the exact PRC timing window? (We assumed 1-3 PM) | Rule R020 | Medium |
| Q07 | How to handle partial cycles (user wakes mid-cycle)? | Edge case | Medium |
| Q08 | Night shift workers: any special rules beyond flexible anchor? | Edge case | Medium |
| Q09 | When calendar conflicts with anchor time, should we ever suggest temporary shift? | Scenario S10 | Medium |
| Q10 | Recovery Room Audit: is it MVP or Phase 2? | Product scope | Low |
| Q11 | Travel Mode: priority for MVP? | Product scope | Low |
| Q12 | Post-event protocol: does event TYPE matter (physical vs. mental)? | Down-period | High |
| Q13 | Buffer between PRC and bedtime — is 3 hours correct? | Rule R025 | Medium |
