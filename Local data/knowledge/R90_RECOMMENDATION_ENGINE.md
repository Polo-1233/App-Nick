# R90 Recommendation Engine

Defines what the app can recommend, when, and why.
Each recommendation maps to one or more user states (R90_USER_STATES.md) and is powered by validated decision rules (R90_DECISION_ENGINE.md).

**Design principle:** Recommendations must always target the structural root cause, not the surface symptom.
The intervention hierarchy is: MRM → CRP → nocturnal cycles → sleep restriction. Never skip levels.

**Duplication policy:** This file defines *what* to recommend and *when*. *How* to communicate it is in R90_COACHING_OUTPUTS.md. *Which feature surfaces it* is in R90_APP_FEATURE_MAPPING.md.

---

## Recommendation Catalogue

| ID | Recommendation Name | Priority | Trigger State(s) |
|----|--------------------|---------|--------------------|
| REC-01 | ARP Commitment | CRITICAL | US-04, US-12 |
| REC-02 | Sleep Onset Scheduling | HIGH | US-02, US-03, US-04 |
| REC-03 | CRP Scheduling | HIGH | US-02, US-03, US-06 |
| REC-04 | MRM Introduction | HIGH | US-12, US-03 |
| REC-05 | MRM Daily Reminders | MEDIUM | US-01, US-02, US-03 |
| REC-06 | Post-Sleep Routine Reinforcement | HIGH | US-12, US-04 |
| REC-07 | Morning Light Activation | HIGH | US-12, US-08, US-11 |
| REC-08 | Phase 3 Wind-Down Protocol | HIGH | US-08, US-07 |
| REC-09 | Evening Light Correction | HIGH | US-08, US-11 |
| REC-10 | Bedroom Temperature Correction | MEDIUM | US-11 |
| REC-11 | Environment Audit | MEDIUM | US-11, US-12 |
| REC-12 | Chronotype Schedule Adjustment | MEDIUM | US-05, US-14 |
| REC-13 | Cycle Count Reframe | MEDIUM | US-07, US-12 |
| REC-14 | Weekly Balance Review | MEDIUM | US-02, US-03 |
| REC-15 | 15-Minute Rule Activation | HIGH | US-07 |
| REC-16 | 2–3am Waking Protocol | HIGH | US-07 |
| REC-17 | Caffeine Timing Correction | MEDIUM | US-10 |
| REC-18 | Tracker Usage Calibration | HIGH | US-09 |
| REC-19 | Sleep Restriction Protocol | LOW | US-03 (persistent) |
| REC-20 | Framework Reset | CRITICAL | US-12 |
| REC-21 | Social Jet Lag Acknowledgement | MEDIUM | US-05 |
| REC-22 | Post-Disruption Rebalancing | MEDIUM | US-06 |
| REC-23 | Pre-Event Arousal Protocol | HIGH | US-15 |
| REC-24 | Illness Recovery Mode | MEDIUM | US-16 |
| REC-25 | Controlled Recovery Day | MEDIUM | US-02, US-03 |
| REC-26 | Travel Environment Setup | LOW | US-06 (travel disruption) |

---

## Detailed Recommendation Definitions

---

### REC-01 — ARP Commitment

**Trigger Conditions**
- Wake time variance > 30 minutes across the last 7 days (US-04)
- User has not yet committed to an ARP (US-12 / onboarding)

**Priority:** CRITICAL — no other recommendation is generated until ARP is set

**Output Type:** Onboarding gate / blocking prompt

**Linked Rules / Principles**
- DR-018, DR-023, RULE-ARP-01

**Goal**
Establish the fixed wake time that anchors all 16 daily cycles. Without it, sleep onset calculations, CRP timing, and phase allocations are unreliable.

**User-Facing Purpose**
"Before we can build your recovery plan, we need one fixed number: your wake time. This is the master clock. Everything else — when to sleep, when to rest — follows from it. Pick a time you can commit to every day, including weekends."

**Engine Logic**
```
IF wake_time_variance > 30min OR arp_committed = false
  THEN block_full_schedule = true
  THEN prompt: ARP commitment input
  THEN recalculate all phase boundaries from committed ARP
```

**Notes**
The engine should never allow ARP to be set as "variable" or "depends on the day." If the user cannot commit, surface the explanation — circadian biology, not discipline, is the reason.

---

### REC-02 — Sleep Onset Scheduling

**Trigger Conditions**
- ARP is committed (REC-01 complete)
- User needs to know what time to go to bed
- Sleep onset time is currently estimated by feel or habit (US-12)
- Short night occurred and the user wants to adjust (US-02, US-03)

**Priority:** HIGH

**Output Type:** Calculated time display + rationale

**Linked Rules / Principles**
- DR-011, RULE-ONSET-01, P-027

**Goal**
Give the user a precise, calculated sleep onset time based on their ARP and target cycle count. Replace "I try to get 8 hours" with "I sleep at 23:00 to hit 5 cycles by 06:30."

**User-Facing Purpose**
"Your sleep onset time isn't a guess — it's a calculation. Count back from your wake time in 90-minute steps. For your ARP of [X], sleeping at [Y] gives you [N] complete cycles."

**Engine Logic**
```
sleep_onset = ARP − (target_cycles × 90 min)
target_cycles = user_input (default: 5)
display: "Sleep by [time] for [N] complete cycles"
```

**Additional Output**
Display a miss-bus fallback: "If you miss [Y], wait until [Y + 90min] before trying."

**Notes**
The app should display 2–3 valid onset times (e.g., 23:00 for 5 cycles, 00:30 for 4 cycles) so the user can choose based on realistic schedule, rather than anchoring on a single "perfect" time that creates anxiety if missed.

---

### REC-03 — CRP Scheduling

**Trigger Conditions**
- Previous night: fewer than 4 nocturnal cycles (US-02, US-03)
- Weekly cycle balance is below target by mid-week
- User has Phase 2 availability (midday–18:00)
- Post-disruption recovery period active (US-06)

**Priority:** HIGH

**Output Type:** Scheduled time slot + activity guidance

**Linked Rules / Principles**
- DR-021, DR-005, P-037, RULE-CYCLES-01, RULE-CRP-01

**Goal**
Add one recovery cycle to the weekly tally and reduce bedtime pressure following a short night. CRP prevents the anxiety spiral that occurs when a user tries to "go to bed earlier" to compensate.

**User-Facing Purpose**
"Last night was shorter than your target. Today's plan includes a CRP — a 30-minute Controlled Reset Period — at [time]. You don't need to sleep. Lie down, close your eyes, let your mind go quiet. It counts as a full cycle."

**Engine Logic**
```
IF previous_night_cycles < 4 AND crp_available = true
  THEN schedule_crp = true
  crp_time = midday (or earliest available Phase 2 slot)
  crp_duration = 30 min
  cycle_credit = +1
```

**Output Types**
- Schedule block on day plan
- Reminder notification at CRP time
- Activity suggestions: guided breathing, eyes closed, light music, eye mask

**Notes**
- CRP does not require sleep — mental disengagement is sufficient (P-055)
- Do not call it a "nap" — use "CRP" or "Controlled Reset Period" (BP-018)
- If the user refuses CRP due to stigma, surface REC-13 (cycle reframe) and address the stigma directly

---

### REC-04 — MRM Introduction

**Trigger Conditions**
- User is in onboarding (US-12)
- MRM practice is not yet established
- User has never heard of MRM

**Priority:** HIGH (foundational layer)

**Output Type:** Education card + first MRM prompt

**Linked Rules / Principles**
- DR-025, DR-022, P-042, RULE-INTV-01

**Goal**
Establish the lightest layer of the recovery architecture. MRMs are the non-optional foundation — before CRP, before environment changes, before any product.

**User-Facing Purpose**
"Every 90 minutes, your recovery plan includes a 3–5 minute Micro Reset Moment. No screens, no inputs, no tasks. Just vacant mindspace. This is not optional — it's the floor of your recovery system. Even at minimum, it measurably improves your sleep onset and deep sleep access."

**Engine Logic**
```
IF mrm_established = false
  THEN introduce_mrm_concept = true
  THEN schedule first MRM prompt at cycle 2 boundary (ARP + 90 min + 90 min)
  target: 7 MRMs across Phases 1–3
```

**Notes**
MRM content examples: eyes closed rest, brief outdoor walk without headphones, window-gazing, slow breathing. Explicit exclusions: scrolling, passive media, email breaks.

---

### REC-05 — MRM Daily Reminders

**Trigger Conditions**
- MRM practice established (REC-04 complete)
- Active in any waking state — including US-01 (aligned)
- Each 90-minute waking cycle boundary

**Priority:** MEDIUM (ongoing; should not feel urgent)

**Output Type:** Gentle notification at cycle boundary

**Linked Rules / Principles**
- DR-022, DR-025, P-042

**Goal**
Maintain the polyphasic recovery rhythm throughout the waking day. Prevent MRM practice from degrading in stable periods.

**User-Facing Purpose**
"Time for a reset. 3–5 minutes. Eyes closed. Nothing required."

**Notes**
Notification timing: at the boundary of each 90-minute cycle during Phases 1–3. For ARP 06:30: cycle boundaries at 08:00, 09:30, 11:00, 12:30, 14:00, 15:30, 17:00. The CRP slot (if scheduled) replaces the MRM at that cycle — not in addition to it.

---

### REC-06 — Post-Sleep Routine Reinforcement

**Trigger Conditions**
- ARP reached (wake event detected or self-reported)
- User in onboarding (US-12) or framework reset (US-04)
- Post-sleep routine not yet established

**Priority:** HIGH

**Output Type:** Sequenced checklist prompt (first 90-minute block after ARP)

**Linked Rules / Principles**
- DR-012, DR-013, DR-027, DR-038, RULE-POST-01

**Goal**
Activate the post-sleep sequence in the correct order, unhurried. This is more impactful than any pre-sleep routine. It sets the serotonin/cortisol response that determines melatonin onset ~12 hours later.

**User-Facing Purpose**
Sequence prompt:
1. Bladder
2. Daylight / light activation (see REC-07)
3. Hydration
4. Food
5. Mental challenge (something that engages focus)
6. Exercise or movement
7. Bowels

"The sequence matters. The pace matters. This is how your day gets built from the inside out."

**Notes**
The routine should feel enabling, not like a checklist to fail. The app should present it as a natural unfolding, not a to-do list with checkboxes.

---

### REC-07 — Morning Light Activation

**Trigger Conditions**
- Within first 90-minute block after ARP (always)
- Part of post-sleep routine (REC-06)
- Particularly critical for users in US-08 (Electronic Insomnia), US-11 (Environmental Friction)

**Priority:** HIGH

**Output Type:** Specific lux-level guidance + method alternatives

**Linked Rules / Principles**
- DR-013, DR-038, DR-027, P-060

**Goal**
Deliver 10,000 Lux exposure within the first 90-minute block after ARP. This triggers the serotonin/cortisol spike, resets the circadian clock, and determines when melatonin will rise approximately 12 hours later.

**User-Facing Purpose**
"Get outside — or use your light therapy device — as soon as possible after you wake. You're aiming for 10,000 Lux. This is the signal your biology needs to know the day has started. It also sets when you'll naturally feel sleepy tonight."

**Engine Logic**
```
IF outdoor_access = available → recommend outdoor exposure (>100,000 Lux)
IF outdoor_access = unavailable → recommend 10,000 Lux therapy device
IF DWS installed → confirm DWS has triggered; recommend supplementing with outdoor or device
```

**Output Variants**
- Outdoor: "Step outside. Even 10 minutes counts. Bright morning light is your strongest daily reset."
- Indoor (device): "Use your light therapy device for 20–30 minutes during breakfast or your morning routine."
- No device: "Sit by your largest window. Supplement with outdoor time as soon as possible."

---

### REC-08 — Phase 3 Wind-Down Protocol

**Trigger Conditions**
- Phase 3 boundary reached (approximately [ARP + 8 × 90 min] before sleep onset)
- User is in US-08 (Electronic Insomnia)
- Sleep onset latency has been > 30 minutes consistently

**Priority:** HIGH

**Output Type:** Phase boundary notification + protocol checklist

**Linked Rules / Principles**
- DR-028, DR-029, DR-030, BP-020, BP-024

**Goal**
Prepare the biological conditions for sleep onset by the time the target sleep window arrives. Light, temperature, and mental state must transition in Phase 3 — not in the 15 minutes before lying down.

**User-Facing Purpose**
"Phase 3 starts now. This is your body's preparation time — it's not optional. Shift your lights to warm/amber. No new demanding work. Let the day settle. By the time you lie down, your biology should already be moving toward sleep."

**Protocol Elements**
1. Light shift: move to amber, warm, or dim lighting. Remove or cover blue/white sources.
2. Temperature: adjust bedroom or personal temperature downward relative to body temperature.
3. Mental: no new cognitively demanding tasks; allow the day's unresolved thoughts to be written down or acknowledged.
4. Activity: light stretching, gentle walk, reading (physical book), quiet music — all valid.
5. Screens: off or Night Mode at minimum; front-camera-off blue-light filter is not sufficient.

---

### REC-09 — Evening Light Correction

**Trigger Conditions**
- User reports bright/white light environment in Phase 3 (US-08, US-11)
- Sleep onset latency correlates with evening screen use
- Bedroom environment audit identifies blue/white light sources

**Priority:** HIGH

**Output Type:** Specific behavioural instruction + product suggestion (where framework is established)

**Linked Rules / Principles**
- DR-028, BP-024

**Goal**
Remove melatonin suppression by transitioning to warm-spectrum light as the evening progresses. Melatonin production cannot compete with blue-spectrum light.

**User-Facing Purpose**
"The light in your environment right now is telling your brain it's midday. Switch to amber, yellow, or red light as you move through your evening. This isn't about dimming — it's about spectrum. Blue and white light, even dim, suppresses your melatonin."

**Product Trigger Conditions**
Only after framework (ARP, MRM, CRP) is established AND light behaviour has not changed with instruction alone: recommend smart bulbs (warm-spectrum), salt lamps, or dedicated bedside amber lights. Never as the first recommendation.

---

### REC-10 — Bedroom Temperature Correction

**Trigger Conditions**
- User reports sleeping hot (US-11)
- Bedroom temperature described as "warm" or "stuffy"
- User uses heavy bedding year-round

**Priority:** MEDIUM

**Output Type:** Behavioural instruction

**Linked Rules / Principles**
- DR-029, BP-023

**Goal**
Establish the body-to-room temperature differential that signals sleep onset. The body needs to be slightly warmer than the room — the differential triggers the onset signal.

**User-Facing Purpose**
"Your bedroom should be a couple of degrees cooler than your body. If you're too warm, you're fighting your own sleep onset signal. Try: lower the room temperature, reduce the duvet weight, or take a brief warm shower before bed (your body temperature drops as you cool down — and that drop is the signal)."

**Individual Duvet Trigger**
If the user has a sleep partner AND reports temperature conflicts: recommend individual duvets (DR-033) — different thermal needs require individual solutions, not compromise.

---

### REC-11 — Environment Audit

**Trigger Conditions**
- User is in US-11 (Environmental Friction) or US-12 (Framework Gap)
- User has tried multiple products without improvement
- Environmental questionnaire not yet completed

**Priority:** MEDIUM

**Output Type:** Guided questionnaire → prioritised action list

**Linked Rules / Principles**
- DR-041 (mental strip), DR-039 (blackout + DWS pair), DR-032 (mattress check), BP-032

**Goal**
Surface and prioritise the environmental barriers before recommending any products. The mental strip exercise: empty the room mentally, then only return things that serve recovery.

**User-Facing Purpose**
"Before you buy anything, let's audit what you already have. We'll go through your bedroom item by item — not to judge it, but to find what's working against you. Most people find the quick wins here before they need to spend anything."

**Questionnaire Triggers (in order)**
1. TV in bedroom? → stimulation item; recommend removal or at minimum no use in Phase 3
2. Work equipment in bedroom? → stimulation item
3. Primary evening light source? → classify as blue/white vs amber/warm
4. Blackout provision? → if yes: DWS also installed? Apply DR-039 paired rule
5. Room temperature? → apply DR-029
6. Mattress surface? → guide through DR-032 hands-width gap test
7. Sleep partner? → assess individual duvet need (DR-033)

**Product Sequence**
No product recommendation is generated until the audit is complete and non-product interventions are in place. Product sequence when warranted: (1) light solutions, (2) temperature solutions, (3) mattress layer, (4) DWS, (5) nose-breathing aids.

---

### REC-12 — Chronotype Schedule Adjustment

**Trigger Conditions**
- Chronotype = PMer AND schedule conflicts detected (US-05)
- Chronotype = In-betweener (US-14)
- User reports low morning performance and high evening performance inconsistently

**Priority:** MEDIUM

**Output Type:** Schedule optimisation suggestions + task timing guidance

**Linked Rules / Principles**
- DR-015, DR-016, DR-017, RULE-CHRONO-01, RULE-CHRONO-02, RULE-CHRONO-03

**Goal**
Align the user's schedule to their chronotype as much as possible. Where full alignment is impossible, protect the peak performance window for highest-priority tasks.

**User-Facing Purpose**
"Your biology has a peak window. For you, that's [afternoon/morning]. Your best cognitive work, biggest decisions, and most demanding training should land there. What's currently in that window? Let's look at what we can move."

**PMer-Specific Outputs**
- Delay high-priority cognitive tasks to afternoon (post-14:00) where possible
- Flag morning meetings/calls as lower-output windows
- Recommend against late evening exercise (after 19:00 for AMers; 20:30 for PMers)
- Acknowledge Social Jet Lag explicitly if ARP is forced early (REC-21)

---

### REC-13 — Cycle Count Reframe

**Trigger Conditions**
- User references "8 hours" as their sleep target (US-07, US-12)
- User expresses distress about a specific night's hour count
- User compares their sleep to an hours-based norm

**Priority:** MEDIUM

**Output Type:** Education message (single use; do not repeat excessively)

**Linked Rules / Principles**
- DR-019, BP-017, RULE-CYCLES-03

**Goal**
Replace the hours metric permanently with the cycle metric. This is the single most common and counterproductive sleep belief in Nick's methodology.

**User-Facing Purpose**
"Hours are the wrong measure. What matters is complete 90-minute cycles. A 4.5-hour night with 3 complete cycles is better than a 5-hour night with an incomplete 4th. Your target: 5 cycles a night, 35 cycles a week. Tonight was [N] cycles — that's your number."

**Notes**
After initial introduction, the app should never again display hours as a primary metric. All sleep displays use cycles. Hours can appear in parentheses as a reference for the first 2 weeks, then removed.

---

### REC-14 — Weekly Balance Review

**Trigger Conditions**
- End of each 7-day window (Sunday or day 7 of user's week)
- Weekly cycle total calculated and ready to surface

**Priority:** MEDIUM

**Output Type:** Summary card — weekly total vs 35-cycle target + next week framing

**Linked Rules / Principles**
- DR-020, P-036, RULE-CYCLES-02

**Goal**
Reinforce the weekly rather than nightly perspective. Normalise deficits as data, not failures. Set up the following week.

**User-Facing Purpose**
"This week: [N] cycles out of 35. [Framing based on total: achieved / 3 cycles short / 7+ cycles short]. Next week: your ARP stays at [X]. [CRP recommendation if deficit was ≥ 3]."

**Framing by Total**
- 33–35+: "Strong week. Process adherence is your edge — keep it."
- 28–32: "Solid week. A couple of short nights — your CRP kept you balanced. Watch the [specific deficit day] pattern."
- < 28: "Tough week. Let's identify what drove the shortfall and make sure next week's CRP slots are protected."

---

### REC-15 — 15-Minute Rule Activation

**Trigger Conditions**
- User reports lying awake for > 15 minutes without sleep onset (US-07)
- Sleep onset latency consistently > 15 minutes across multiple nights

**Priority:** HIGH

**Output Type:** In-moment protocol instruction + rationale

**Linked Rules / Principles**
- DR-037, RULE-ONSET-03, BP-013

**Goal**
Break the bed-equals-wakefulness association before it consolidates into a pattern.

**User-Facing Purpose**
"If sleep hasn't come in 15 minutes: get up. Don't lie there and wait — that trains your brain to associate the bed with wakefulness. Go somewhere quiet and dim. No screens. No tasks. Wait for the next 90-minute boundary — [time] — then try again. This works."

**Engine Logic**
```
IF sleep_onset_latency > 15 min (self-reported or logged)
  THEN activate_15_min_rule = true
  THEN calculate next cycle boundary = reported_bed_time + next 90min increment
  THEN display: "Try again at [time]"
```

---

### REC-16 — 2–3am Waking Protocol

**Trigger Conditions**
- User reports waking at approximately 2–3am and being unable to return to sleep
- Reported on 2+ occasions

**Priority:** HIGH

**Output Type:** Educational + in-moment instruction

**Linked Rules / Principles**
- DR-042, RULE-WAKE-01, BP-031

**Goal**
Prevent a natural polyphasic transition from being catastrophised into a sleep disorder. The 2–3am waking is a biological heritage, not a malfunction.

**User-Facing Purpose**
"Waking at 2–3am is normal — it's the transition between your early and late sleep cycles. The problem isn't the waking. The problem is what you do next. Don't check the clock. Don't calculate how many hours you have left. If you can't return to sleep in 15 minutes: get up, stay dim, wait for the next cycle boundary."

---

### REC-17 — Caffeine Timing Correction

**Trigger Conditions**
- Stimulant use reported after 14:00 (US-10)
- User reports difficulty with sleep onset AND consumes caffeine in the afternoon/evening
- Escalating stimulant use detected

**Priority:** MEDIUM

**Output Type:** Behavioural instruction + structural audit prompt

**Linked Rules / Principles**
- DR-016, RISK-003 (Decision Engine), BP-022

**Goal**
Reduce the sleep-disrupting impact of late stimulant use as an immediate harm-reduction step, while surfacing the upstream structural cause.

**User-Facing Purpose**
"Caffeine consumed after 14:00 is still in your system at bedtime. Cut the timing back to 14:00 as a first step — but note: this is a workaround, not a solution. The reason you need caffeine in the afternoon is the gap we're fixing with your cycle plan and CRP."

**Engine Logic**
```
IF stimulant_timing > 14:00 AND sleep_onset_latency > 20min
  THEN recommend: no stimulants after 14:00
  THEN surface_structural_audit: identify missing cycles, CRP, MRMs
  DO NOT: treat caffeine timing as the primary fix
```

---

### REC-18 — Tracker Usage Calibration

**Trigger Conditions**
- Tracker in use AND US-09 (Ortho-Insomnia) active
- User language centres on tracker metrics rather than felt recovery
- Sleep reported as worsening since beginning tracker use

**Priority:** HIGH

**Output Type:** Reframe guidance → staged tracker protocol

**Linked Rules / Principles**
- DR-044, RISK-002 (Decision Engine), BP-030

**Goal**
Remove tracker data as a source of anxiety without dismissing the tracker entirely.

**Stage 1 Output**
"Your tracker is a guide — not a verdict. Check weekly averages, not nightly scores. How you feel and how many cycles you completed matter more than any algorithm's interpretation of your sleep stages."

**Stage 2 Output** (if anxiety persists after 2 weeks)
"We're going tracker-free for 2 weeks. Your R90 plan doesn't change — ARP, cycles, CRP, MRMs all stay in place. You'll log cycles by feel. At the end of 2 weeks, we'll review whether the tracker adds value for you."

**Notes**
The R90 app should never surface raw tracker data as a headline metric. If tracker integration exists, weekly averages only. Nightly scores should be hidden by default.

---

### REC-19 — Sleep Restriction Protocol

**Trigger Conditions**
- US-03 (significant deficit) persisting for 5+ consecutive nights without structural cause resolution
- Fragmented sleep pattern (multiple wakings, short cycles) not resolved by structural adherence
- User has established ARP, MRM, and CRP — framework is in place

**Priority:** LOW (therapeutic; not routine)

**Output Type:** Structured protocol with defined period and review

**Linked Rules / Principles**
- DR-045, RULE-SR-01

**Goal**
Consolidate fragmented cycles by increasing biological sleep pressure through deliberate cycle delay.

**User-Facing Purpose**
"For the next [N] days, we're going to delay your sleep onset by one cycle — from [X] to [Y]. This builds more biological pressure for deeper sleep, consolidates your cycles, and resets the pattern. Your ARP stays the same. You compensate with CRP."

**Caution**
This protocol requires monitoring. It should not be auto-triggered by the app — it requires user context, confirmation, and a defined review period (typically 7–14 days). Flag for coach review if available.

---

### REC-20 — Framework Reset

**Trigger Conditions**
- User is in US-12 (Framework Gap) — isolated products, no structural foundation
- User returns after a break with lost habits
- User has multiple states active but no baseline structure in place

**Priority:** CRITICAL

**Output Type:** Guided re-onboarding sequence

**Linked Rules / Principles**
- DR-026, RULE-INTV-01, BP-021

**Goal**
Establish the structural foundation before any intervention can be effective.

**Sequence**
1. Commit ARP (REC-01)
2. Calculate sleep onset (REC-02)
3. Introduce MRM (REC-04)
4. Introduce CRP if schedule allows (REC-03)
5. Run environment audit (REC-11)
6. Pause all other interventions until step 4 is established

**User-Facing Purpose**
"Before we add anything, let's build the foundation. Everything you've tried before may have been working against an unstable base — that's not your fault, it's the sequence. We start with the anchor, then the rhythm, then the rest."

---

### REC-21 — Social Jet Lag Acknowledgement

**Trigger Conditions**
- US-05 active (Chronotype Conflict confirmed)
- User has never been informed about Social Jet Lag
- PMer on forced-early ARP

**Priority:** MEDIUM (education; one-time, early in journey)

**Output Type:** Education card

**Linked Rules / Principles**
- DR-017, BP-029, RULE-ARP-02

**Goal**
Name the condition, reduce self-blame, and establish realistic expectations for the schedule.

**User-Facing Purpose**
"What you're experiencing has a name: Social Jet Lag. It's not a discipline problem — it's your biology being forced to run on someone else's clock. 70% of people are evening-type (PMers) pushed into morning-type schedules. We can't fight your biology, but we can work with it — and stop expecting morning performance you're not wired to produce."

---

### REC-22 — Post-Disruption Rebalancing

**Trigger Conditions**
- US-06 active (Post-Disruption Recovery)
- Identified event causing deficit: travel, illness, social occasion, shift change

**Priority:** MEDIUM

**Output Type:** Short rebalancing plan (3–5 days)

**Linked Rules / Principles**
- DR-043, RULE-ARP-03, DR-021

**Goal**
Contain the disruption and recover within the current or following week without shifting the ARP.

**User-Facing Purpose**
"[Event] put you [N] cycles short. Here's the rebalancing plan: ARP stays at [X]. Add a CRP on [day(s)]. No earlier bedtimes, no lie-ins — they'll make it harder, not easier. In [N] days, your balance will be restored."

---

### REC-23 — Pre-Event Arousal Protocol

**Trigger Conditions**
- US-15 active (Pre-Event High Arousal)
- User reports difficulty sleeping due to anticipation of upcoming event
- Context: high-stakes event within 24–48 hours

**Priority:** HIGH

**Output Type:** Single coaching message + adjusted day plan

**Linked Rules / Principles**
- DR-067, P-128, AUD-009

**Goal**
Redirect from forced sleep to natural onset strategy; front-load daytime recovery; reduce pre-event sleep anxiety.

**User-Facing Purpose**
"The harder you try to force sleep tonight, the more awake you'll stay — your body is primed for tomorrow. Instead: maximise today's recovery windows. Schedule a CRP this afternoon. Keep the evening calm and chilled — don't try to be in bed early. Natural sleep will come when it comes. Even 2 cycles before your ARP is enough. Your preparation was in the week leading up to this, not tonight."

**Engine Logic (pseudocode)**
```
IF user.state == US-15:
  suppress: "go to bed earlier" recommendation
  suppress: deficit warnings
  push: CRP in Phase 2 today (if not yet done)
  push: chilled evening guidance (no forced bedtime)
  push: ARP hold reminder for tomorrow
  message: pre-event arousal normalisation copy
```

---

### REC-24 — Illness Recovery Mode

**Trigger Conditions**
- US-16 active (Illness / Injury Recovery)
- User self-reports illness or injury
- Cycle deficit present with illness as identified cause

**Priority:** MEDIUM

**Output Type:** Mode switch message + adjusted weekly target

**Linked Rules / Principles**
- DR-068, P-129, DR-055, P-109, AUD-009

**Goal**
Suspend normal cycle targets; shift to polyphasic recovery maximisation; prevent deficit-related anxiety during illness.

**User-Facing Purpose**
"While you're unwell, your recovery system shifts into a different mode. The goal isn't hitting 35 cycles — it's maximising every rest opportunity. Use your midday and early-evening windows for longer CRPs. Focus on your environment: fresh air, nose breathing, cool clean space. Rest as much as you need. Your ARP stays in place so the framework recovers quickly once you're well."

**Engine Logic (pseudocode)**
```
IF user.state == US-16:
  suppress: cycle deficit warnings
  suspend: normal weekly targets
  push: extended CRP guidance (up to 90 min if nocturnal < 3 cycles — DR-055)
  push: environment optimisation (airflow, nasal breathing)
  push: "hold ARP — framework reinstates when well"
  medical_disclaimer: true
```

---

### REC-25 — Controlled Recovery Day

**Trigger Conditions**
- User has had a hard week (< 28 cycles) AND has a flexible day available
- User logs or signals a recovery/rest day
- No obligation forcing early departure from bedroom

**Priority:** MEDIUM

**Output Type:** Structured day plan (single day)

**Linked Rules / Principles**
- DR-066, P-127, P-130, AUD-009

**Goal**
Deliver structured extra recovery without drifting past ARP or disrupting circadian rhythm.

**User-Facing Purpose**
"Recovery days work best when they're structured, not when you drift. Here's the plan: wake at your normal [ARP], complete your Cycle 1 routine in a chilled gear — no rushing, no full activation. Then return to bed with an alarm set for 2 extra cycles (3 hours). Or: stay up and schedule 2 × 90-minute recovery blocks at midday. Either way — you're in control of the recovery, not at its mercy."

**Engine Logic (pseudocode)**
```
IF recovery_day_flagged AND weekly_cycles < 28:
  option_A: return_to_bed after Cycle 1 (1–2 cycles, alarm set)
  option_B: 2x 90-min midday CRPs in 12:00–16:00 window
  constraint: ARP must not be skipped
  constraint: do not recommend unstructured lie-in
```

---

### REC-26 — Travel Environment Setup

**Trigger Conditions**
- User flags upcoming travel or stay in a hotel/temporary environment
- US-06 active with travel as the identified disruption cause

**Priority:** LOW

**Output Type:** Short pre-travel checklist

**Linked Rules / Principles**
- DR-070, DR-071, P-131, P-132, AUD-010

**Goal**
Replicate key sleep environment conditions in any temporary sleep location; minimise the familiarisation deficit.

**User-Facing Purpose**
"Before you travel: pack your sensory kit — a familiar pillow spray or scent, earphones for your usual sounds. At the hotel: check the mattress — if it pushes you away, ask for an extra duvet to layer on top. Set the room to cool. Blackout if you can. Your brain needs the same cues wherever you sleep."

**Engine Logic (pseudocode)**
```
IF travel_flagged:
  push: sensory kit reminder (scent + sound)
  push: hotel mattress adaptation (extra duvet request)
  push: room temperature and light control checklist
  link: familiarisation principle
```

---

## Recommendation Priority Rules

When multiple recommendations are triggered simultaneously:

1. **CRITICAL** recommendations execute first and may block others (REC-01, REC-20)
2. **Anxiety states** (US-07, US-09) suppress structural scheduling recommendations until addressed
3. **Framework must be established** before environmental or product recommendations are generated
4. **Never stack more than 3 active recommendations** per session — prioritise by state severity

## Sources

All recommendations derived from:
- `knowledge/R90_DECISION_ENGINE.md` (all rule sections)
- `knowledge/R90_DECISION_RULES.md` (DR-001–DR-045)
- `knowledge/R90_CORE_PRINCIPLES.md` (P-017–P-077)
- `knowledge/R90_BEHAVIOURAL_PATTERNS.md` (BP-001–BP-032)
