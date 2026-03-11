# R90 App Feature Mapping

Maps the R90 intelligence system to concrete application features.
Each feature is defined by its data requirements, the user states it detects, the recommendations it surfaces, and the decision engine logic that powers it.

**Design principle:** Features are delivery vehicles for intelligence — not decorative UI. Each feature must have a clear answer to: "What decision does this help the user make or execute?"

**Reading guide:**
- User states → `R90_USER_STATES.md`
- Recommendation logic → `R90_RECOMMENDATION_ENGINE.md`
- Communication tone → `R90_COACHING_OUTPUTS.md`
- Decision rules → `R90_DECISION_ENGINE.md`

---

## Feature Overview

| Feature ID | Feature Name | Primary Function | Intelligence Dependency |
|-----------|--------------|-----------------|------------------------|
| F-01 | Onboarding | Establish baseline | ARP, chronotype, cycle target |
| F-02 | Home Screen | Daily orientation | State detection, today's plan |
| F-03 | Day Plan | 16-cycle map | Phase allocation, MRM/CRP slots |
| F-04 | Sleep Log | Cycle tracking | Actual vs target, weekly balance |
| F-05 | CRP Tracker | Recovery cycle management | CRP scheduling and credit |
| F-06 | MRM Reminders | Micro-recovery | 90-min boundary notifications |
| F-07 | Wind-Down | Phase 3 activation | Pre-sleep environment protocol |
| F-08 | Wake-Up Routine | Post-ARP activation | Post-sleep sequence |
| F-09 | Recovery Insights | Weekly review | Cycle balance, state trends |
| F-10 | Chronotype Profile | Biology-to-schedule alignment | Chronotype, schedule recommendations |
| F-11 | Environment Audit | Bedroom optimisation | Environmental friction detection |
| F-12 | Daily Check-In | State detection | Risk pattern monitoring |
| F-13 | Post-Event Protocol | Disruption recovery | Post-disruption rebalancing |

---

## Detailed Feature Definitions

---

### F-01 — Onboarding

**Primary Function**
Establish the user's structural baseline. Collect the minimum required inputs to generate a valid R90 schedule. Block the user from the full app until the non-negotiable foundation is in place.

**User States It Addresses**
- US-12 (Framework Gap) — primary state for all new users
- US-14 (In-Betweener Fog) — requires careful chronotype guidance

**Recommendations It Surfaces**
- REC-01 (ARP Commitment) — blocking gate; must complete before proceeding
- REC-20 (Framework Reset) — used for returning users with lost structure
- REC-04 (MRM Introduction) — first education layer
- REC-13 (Cycle Count Reframe) — replace hours metric from day one

**Decision Engine Logic**
```
Step 1: Collect target_wake_time → commit as ARP
Step 2: Collect chronotype (AMer / PMer / In-betweener / Unsure)
Step 3: Collect typical_night_cycles (default: 5)
Step 4: Calculate sleep_onset = ARP − (cycles × 90 min)
Step 5: Introduce MRM concept
Step 6: Ask about CRP availability (Phase 2 schedule space)
Step 7: Ask about existing sleep issues (maps to risk state check)
Step 8: Generate Day 1 plan
```

**What the User Understands After Onboarding**
- Their ARP (and why it never changes)
- Their sleep onset time (calculated, not guessed)
- What a cycle is (replaces "hours" in their vocabulary)
- What CRP and MRM mean and when they happen
- Their chronotype and what it means for their schedule

**Data Required**
- `target_wake_time` (REQUIRED)
- `chronotype` (REQUIRED)
- `typical_night_cycles` (default 5 if not specified)
- `crp_available` (optional; inferred if skipped)
- `schedule_consistency` (REQUIRED — to detect US-04)
- `known_sleep_issue` (optional; triggers risk state pre-assessment)
- `tracker_in_use` (optional; activates US-09 monitoring)

**What Remains Unclear**
- Formal diagnostic profiling tool not yet available — OQ-013 (requires PPT-002)
- In-betweener classification criteria are informal until PPT-002 is processed
- The onboarding cannot yet diagnose partner/family scheduling conflicts (AUD-009 pending)

---

### F-02 — Home Screen

**Primary Function**
Daily orientation at a glance. Surface the user's current state, today's key numbers, and the single most important action for the day. This is not a dashboard of metrics — it is a coaching briefing.

**User States It Addresses**
All states — the home screen adapts its primary message based on active state.

**Primary Display Elements**
1. **ARP confirmation** — "Your day starts at [06:30]"
2. **Tonight's sleep onset** — calculated cycle target: "Sleep at 23:00 → 5 cycles"
3. **Weekly cycle balance** — "[N] / 35 this week"
4. **Active recommendation** — highest-priority action (never more than one primary)
5. **Phase indicator** — which of the 4 phases the user is currently in

**State-Adaptive Behaviour**

| Active State | Home Screen Primary Message |
|-------------|---------------------------|
| US-01 (Aligned) | Weekly balance confirmation + today's schedule |
| US-02 (Mild Deficit) | "CRP today at [time] — adds 1 cycle to your balance" |
| US-03 (Significant Deficit) | "4 cycles short this week. Let's look at the plan." |
| US-04 (ARP Instability) | "Your ARP needs to be fixed — this is your starting point" |
| US-07 (Sleep Anxiety Loop) | Process message only — no quality metrics displayed |
| US-09 (Ortho-Insomnia) | Tracker data suppressed; process metrics only |
| US-06 (Post-Disruption) | "Recovery plan: [N] CRPs this week. ARP held." |

**Recommendations It Surfaces**
- REC-02 (Sleep Onset) — nightly
- REC-03 (CRP) — when deficit triggered
- REC-14 (Weekly Balance) — end of week summary
- Primary state alert (if any active risk state)

**Data Required**
- `arp` (committed)
- `target_cycles`
- `previous_night_cycles` (from sleep log or self-report)
- `weekly_cycle_balance` (running total)
- `active_user_states` (computed from check-in and log data)

**What Remains Unclear**
- How actively the app should surface risk states on the home screen vs. a dedicated insights view (product decision)
- Whether phase indicator should use clock-based phases or relative phases from ARP (minor calibration question)

---

### F-03 — Day Plan

**Primary Function**
Show the user their full 16-cycle day, with MRM and CRP slots placed, phase boundaries visible, and tonight's sleep onset confirmed. The day plan is the operational view of the R90 system.

**User States It Addresses**
- US-01, US-02, US-03 — planning and cycle tracking
- US-05 (Chronotype Conflict) — schedule shows peak window protection
- US-08 (Electronic Insomnia) — Phase 3 boundary is clearly marked

**Display Structure**
```
Phase 1 (ARP → Midday)     [cycles 1–4]
  ▸ 06:30  ARP — Post-sleep routine
  ▸ 08:00  MRM #1 (3–5 min)
  ▸ 09:30  MRM #2
  ▸ 11:00  MRM #3

Phase 2 (Midday → Eve)     [cycles 5–8]
  ▸ 12:30  MRM #4
  ▸ 13:00  CRP [if scheduled] — 30 min
  ▸ 14:30  MRM #5 [or post-CRP cycle boundary]
  ▸ 16:00  MRM #6

Phase 3 (Eve → Sleep)      [cycles 8–12]
  ▸ 17:30  MRM #7
  ▸ 21:00  Phase 3 begins — wind-down
  ▸ 23:00  Sleep onset

Phase 4 (Nocturnal)        [cycles 12–16]
  ▸ 23:00 → 06:30  5 nocturnal cycles
```

**Chronotype Adaptation**
- PMer: all Phase boundaries shift +1–2h; peak cognitive window marked in Phase 2–3
- AMer: standard layout; Phase 3 flagged earlier
- Phase 3 boundary is always a hard visual marker — this is the key behavioural boundary the user must see

**Recommendations It Surfaces**
- REC-05 (MRM reminders) — at each cycle boundary
- REC-03 (CRP slot) — if scheduled
- REC-08 (Phase 3 Wind-Down) — at Phase 3 boundary notification
- REC-02 (Sleep Onset) — displayed at Phase 4 boundary

**Data Required**
- `arp` (to anchor all timings)
- `chronotype` (for phase shifting)
- `crp_scheduled` (to show CRP block)
- `target_sleep_onset` (Phase 4 start)

**What Remains Unclear**
- Whether to show all 16 cycles explicitly or abstract to 4 phases — UX decision
- Shift work / irregular schedule handling is not yet supported (DOC-004 pending)

---

### F-04 — Sleep Log

**Primary Function**
Capture the user's actual nocturnal cycle count and any notable events. Feed the weekly cycle balance calculation. Replace hours as the primary log metric.

**User States It Addresses**
- US-02, US-03 — deficit detection from log data
- US-07 (Sleep Anxiety) — log should never prompt quality anxiety
- US-09 (Ortho-Insomnia) — tracker data integration handled carefully

**Log Inputs**
- `cycles_completed` (primary — user reports how many complete cycles they completed, or this is calculated from sleep onset + wake time if logged)
- `sleep_onset_actual` (optional — "roughly when did you fall asleep?")
- `mid_night_wakings` (optional — "did you wake during the night?" yes/no; time if known)
- `onset_latency_flag` (optional — "did sleep come easily?" / "> 15 min?")
- `notes` (optional — free text)

**What the Log Does NOT Ask**
- "How was your sleep quality?" (anxiety-inducing, subjective)
- "How rested do you feel?" (not actionable)
- "What was your deep sleep percentage?" (do not surface tracker metrics as primary)

**Weekly Balance Calculation**
```
weekly_balance += cycles_completed_tonight
weekly_balance += crp_cycles_today (from F-05)
deficit = 35 − weekly_balance
```

**Recommendations It Surfaces**
- REC-03 (CRP) — if last night < 4 cycles
- REC-16 (2–3am protocol) — if mid-night waking reported
- REC-15 (15-minute rule) — if onset latency > 15 min reported

**Data Required**
- `arp` (to compute wake time and cycle count if sleep onset is logged)
- `target_cycles` (for comparison)
- `actual_sleep_onset` (optional; enables auto-calculation)

**What Remains Unclear**
- Wearable/tracker integration: if a tracker is connected, should it auto-populate `cycles_completed` or should the user self-report? Auto-population risks US-09 if tracker data is shown. Recommended approach: use tracker data as background signal only; surface self-report as primary.

---

### F-05 — CRP Tracker

**Primary Function**
Schedule, remind, and credit Controlled Reset Periods. Manage the CRP as a formal recovery cycle in the weekly tally.

**User States It Addresses**
- US-02, US-03 — deficit compensation
- US-06 (Post-Disruption) — planned recovery CRPs
- US-07 (Sleep Anxiety / evening pressure) — CRP reduces bedtime pressure

**Feature Flow**
1. CRP recommendation generated (from sleep log or manual trigger)
2. User selects or confirms CRP time (within Phase 2 window)
3. Timer activated at CRP time — 30-minute countdown
4. Post-CRP: user confirms completion → +1 cycle added to weekly tally
5. If CRP not taken: no penalty; offer reschedule for next available Phase 2 slot

**CRP Guidance (in-feature)**
> "30 minutes. Eyes closed. You don't need to sleep — just disconnect. Use the timer. When it finishes, you're done."

**Activity Suggestions (shown during CRP)**
- Lie down with eyes closed
- Eye mask if available
- Gentle ambient sound / silence
- No guided meditation with extensive content (that's cognitive load)
- Light breathing awareness

**Weekly CRP Credit Display**
```
This week: [N] nocturnal cycles + [M] CRP cycles = [N+M] / 35
```

**Data Required**
- `crp_available` (Phase 2 schedule space)
- `previous_night_cycles` (triggers recommendation)
- `weekly_cycle_balance` (updated after each CRP)

**What Remains Unclear**
- Maximum CRPs per week: unspecified in processed sources. The engine logic handles "CRP as needed" without a stated upper limit. Assume no more than 1 per day without PPT-002 confirmation.
- Whether there is a minimum gap between CRP and nocturnal sleep onset — inferred (Phase 2 only, i.e., not later than cycle 8), but not explicitly stated as a minimum gap rule.

---

### F-06 — MRM Reminders

**Primary Function**
Deliver gentle, brief notifications at each 90-minute waking cycle boundary. Maintain the micro-recovery rhythm that is the foundation of the polyphasic architecture.

**User States It Addresses**
All waking states — MRMs are active regardless of state.

**Notification Schedule**
Calculated from ARP:
```
mrm_times = [ARP + (n × 90min) for n in 2..8]
  Phase 1: cycles 2, 3, 4
  Phase 2: cycles 5, 7 (cycle 6 = CRP if scheduled)
  Phase 3: cycles 8, 9 (through wind-down start)
```

**Notification Copy**
Brief. Always. Maximum two lines.
> "Micro Reset. 3 minutes. Nothing required."

**User Control**
- Allow MRM notifications to be snoozed by one cycle (not turned off permanently)
- Allow user to log MRM as "taken" or "missed" for adherence tracking
- Do not gamify excessively — a streak counter may create anxiety if missed

**What Remains Unclear**
- Should the app allow MRM reminders to be customised in timing? The engine specifies every 90-minute boundary. User-specific customisation is a product decision.
- Integration with phone Do Not Disturb modes — technical consideration outside knowledge base scope.

---

### F-07 — Wind-Down (Phase 3)

**Primary Function**
Activate the Phase 3 transition protocol approximately 90 minutes before sleep onset. Guide the user through light, temperature, and mental preparation.

**User States It Addresses**
- US-08 (Electronic Insomnia) — primary activation trigger
- US-07 (Sleep Anxiety) — structured Phase 3 reduces onset anxiety
- US-11 (Environmental Friction) — temperature and light correction embedded

**Feature Activation**
Auto-triggered at Phase 3 boundary (= sleep onset − 90–120 min).
For sleep onset 23:00: Phase 3 notification at 21:00–21:30.

**Phase 3 Protocol (in sequence)**
1. **Light shift notification** — "Switch to warm/amber light now."
2. **Mental state prompt** (15 min later) — "No new demanding work. Download the day if needed."
3. **Temperature check** — "Bedroom: cooler than your body. Adjust if needed."
4. **Activity suggestion** — options list (reading, light stretch, quiet music)
5. **Sleep onset countdown** — quiet countdown appears as sleep onset approaches
6. **Final prompt** (at sleep onset time) — "Your sleep window is now. Lie down."

**Recommendations It Surfaces**
- REC-08 (Phase 3 Wind-Down)
- REC-09 (Evening Light Correction)
- REC-10 (Temperature Correction, if reported as an issue)

**What the Feature Does NOT Do**
- Does not play guided sleep meditations as primary content (cognitive load risk)
- Does not show news, performance data, or stimulating content
- Does not remind the user of tomorrow's schedule at Phase 3 time

**Data Required**
- `target_sleep_onset` (to calculate Phase 3 start)
- `bedroom_temperature` (for personalised temperature prompt)
- `evening_light_environment` (for personalised light prompt)

**What Remains Unclear**
- Specific pre-sleep personalisation additions beyond the core protocol are referenced in AUD-004 as "personalisable" — but the full list of additions is not yet in the knowledge base. The feature can be built with the confirmed core protocol and extended when PPT-002 is processed.

---

### F-08 — Wake-Up Routine

**Primary Function**
Activate the post-sleep sequence immediately after the ARP. Guide the user through the 7-step post-sleep routine in the first 90-minute block.

**User States It Addresses**
- All states — the wake-up routine is universal and foundational
- US-12 (Framework Gap) — establishing the routine is the primary goal
- US-08 (Electronic Insomnia) — morning light activation is the circadian counter-reset

**Feature Activation**
Triggered by: alarm/wake event at ARP, OR user manual trigger.

**Sequence Display**
Progressive checklist — each step reveals the next. Unhurried. No time pressure.

```
1. ▸ Bladder
2. ▸ Light — 10,000 Lux (outside / device)
3. ▸ Hydrate
4. ▸ Eat
5. ▸ Mental challenge
6. ▸ Movement / exercise
7. ▸ Bowels
```

**Light Step Intelligence**
```
IF morning_light_access = outdoor → "Step outside. Even 10 minutes."
IF morning_light_access = DWS → "Your DWS has done the first phase. Supplement with outdoor."
IF morning_light_access = indoor only → "Light therapy device, 20–30 min. Window seat if no device."
```

**Recommendations It Surfaces**
- REC-06 (Post-Sleep Routine Reinforcement)
- REC-07 (Morning Light Activation)

**Data Required**
- `arp` (timing anchor)
- `morning_light_access` (outdoor / indoor / DWS)
- `dws_installed` (for paired DWS + blackout rule)

**What Remains Unclear**
- "Mental challenge" in step 5 is not defined in specific terms in processed sources. The app should offer examples (crossword, brief reading, a problem to solve) without prescribing a single activity.
- Exercise timing and type in step 6 are not specified for the post-sleep block in detail — only that exercise is part of the sequence.

---

### F-09 — Recovery Insights

**Primary Function**
Weekly summary and trend view. Surface the cycle balance, state patterns, and next-week recommendations. This is the reflective layer — not a nightly metric dashboard.

**User States It Addresses**
- US-01 — maintenance and refinement
- US-02, US-03 — deficit patterns over time
- US-05, US-07 — state trend monitoring

**Display Elements**
1. **Weekly cycle total** — [N] / 35, with breakdown by day
2. **CRP cycles taken** — [M] CRPs this week = [M] additional cycles
3. **ARP consistency** — days held vs missed (binary: held / shifted)
4. **State trend** — which states were active this week (no scary labels; process framing)
5. **Next week setup** — ARP confirmed, CRP slots suggested if needed

**What Recovery Insights Does NOT Show**
- Sleep quality scores
- Deep sleep percentages
- Nightly tracker metrics as headlines
- Population comparisons

**Recommendations It Surfaces**
- REC-14 (Weekly Balance Review)
- REC-22 (Post-Disruption Rebalancing) if a disruption week is identified
- Chronotype refinement (REC-12) after 4+ weeks of data

**Data Required**
- `weekly_cycle_balance` (computed from sleep log + CRP log)
- `arp_consistency` (days with ARP held vs shifted)
- `active_states_this_week` (from daily check-in + log data)
- `crp_cycles_this_week`

**What Remains Unclear**
- Minimum data period for state trend detection — need at least 2 weeks of log data before trend language is valid
- Whether to show a chronotype confidence score — requires more source material (PPT-002)

---

### F-10 — Chronotype Profile

**Primary Function**
Surface the user's chronotype, its schedule implications, and specific optimisations for their daily plan. This is primarily an education and personalisation feature, not a dynamic feature.

**User States It Addresses**
- US-05 (Chronotype Conflict) — primary
- US-14 (In-Betweener Fog) — secondary

**Display Elements**
1. **Chronotype label** — AMer / PMer / In-betweener + brief biological explanation
2. **Peak performance window** — when to schedule cognitive demands and exercise
3. **Risk windows** — when to avoid demanding tasks and stimulants
4. **Schedule implications** — how the chronotype affects their specific ARP
5. **Social Jet Lag indicator** — if ARP conflicts with chronotype, flag and explain

**Chronotype Profile Content**

*PMer (70% of users):*
> "You're a PMer. Your pineal gland shifts to serotonin about 1–2 hours later than a morning type. Your peak cognitive window is roughly [15:00–19:00]. Your best sleep onset is around [00:30] or later. An ARP before [07:30] creates Social Jet Lag — a mismatch between your biology and your schedule."

*AMer (30% of users):*
> "You're an AMer. Your serotonin shift happens fast after sunrise. Your sharpest window is [08:00–12:00]. You fade earlier in the evening — protect your melatonin window from [21:00]. Late exercise and late eating work against your biology."

**Recommendations It Surfaces**
- REC-12 (Chronotype Schedule Adjustment)
- REC-21 (Social Jet Lag Acknowledgement) if conflict detected

**Data Required**
- `chronotype` (committed at onboarding)
- `arp` (for conflict detection)
- 2+ weeks of check-in data to refine in-betweener classification

**What Remains Unclear**
- Formal diagnostic criteria for chronotype classification are unresolved (OQ-013, OQ-021)
- The in-betweener category has no formal R90 diagnostic tool yet (requires PPT-002)
- Phase delay quantification (+1h vs +2h for PMers) is approximate — IMG-001 OCR source, not primary text

---

### F-11 — Environment Audit

**Primary Function**
Guide the user through a structured audit of their bedroom environment. Generate a prioritised action list. Sequence: behavioural changes before products, high-impact before low-impact.

**User States It Addresses**
- US-11 (Environmental Friction) — primary
- US-12 (Framework Gap) — environment is assessed after structural foundation

**Feature Flow**
Questionnaire → Analysis → Prioritised recommendations → (Optional) Product suggestions

**Questionnaire Items (in priority order)**
1. TV present in bedroom? (yes/no)
2. Work equipment in bedroom? (yes/no)
3. Primary light source in Phase 3? (overhead white / bedside warm / mixed / none)
4. Blackout provision? (yes/no) → if yes: DWS installed? (yes/no)
5. Room temperature at night? (hot / cool / comfortable / variable)
6. Sleeping with a partner? (yes/no) → if yes: different temperature preferences? (yes/no)
7. Mattress surface test completed? (guided through DR-032)

**Analysis Logic**
```
IF tv_in_bedroom = yes → priority: remove or cover during Phase 3
IF work_equipment_in_bedroom = yes → priority: remove or designate boundary
IF phase3_light = overhead_white → priority: REC-09 (evening light correction)
IF blackout = yes AND dws = no → priority: install DWS (DR-039 paired rule)
IF blackout = no → priority: blackout + DWS together
IF room_temperature = hot → priority: REC-10 (temperature correction)
IF partner = yes AND temperature_conflict = yes → recommend individual duvets (DR-033)
IF mattress_gap > hand_width → recommend soft layer addition before mattress replacement
```

**Product Recommendations (only after all behavioural items addressed)**
Sequence:
1. Light: warm-spectrum bulb or lamp (~£10–20)
2. Temperature: lighter duvet, room fan, or thermostat adjustment
3. Mattress layer: soft topper if gap test indicates
4. DWS (if blackout present): Dawn Wake Simulator
5. Nose breathing: if mouth breathing identified (DR-035)

**Data Required**
- Questionnaire responses (all optional but progressive — more answers = more precise output)
- `sleep_partner` (from onboarding or first check-in)

**What Remains Unclear**
- The knowledge base confirms the sequence (DR-041, DR-039, DR-032) but does not specify product brands or price points — these are operational decisions outside the knowledge base scope
- Air quality as a sleep factor is mentioned in AUD-007 but not fully developed in processed sources

---

### F-12 — Daily Check-In

**Primary Function**
Capture the minimum daily signals needed for state detection. Short, frictionless, maximum 3 inputs. Feeds the weekly balance, risk detection, and recommendation engine.

**User States It Addresses**
All states — check-in data is the primary source for state updates.

**Check-In Format**
Frequency: once daily, at a consistent time (recommend: first thing after post-sleep routine, or at a scheduled Phase 2 time)

**Questions (choose 2–3 max)**
1. "How many cycles did you complete last night?" [1 / 2 / 3 / 4 / 5 / 6+] — primary
2. "Did sleep come easily?" [Yes / No / >15 min] — risk detection
3. "Any disruptions?" [No / Woke during night / Travel / Illness / Other] — state classification

**Optional weekly add-on (once per week)**
4. "Stimulant use this week?" [Same as usual / More than usual / Less] — US-10 monitoring
5. "How are you using your tracker?" [Weekly average / Nightly / Not at all] — US-09 monitoring

**What the Check-In Does NOT Ask**
- "How do you feel?" (too subjective; anxiety-prone)
- "Rate your sleep quality 1–10" (classic anxiety trigger)
- Multiple questions every day (friction kills retention)

**Risk State Detection Logic**
```
IF onset_difficulty reported on 3+ consecutive check-ins
  THEN flag US-07 (Sleep Anxiety Loop)
  THEN activate REC-15 (15-minute rule)

IF mid_night_waking at 2–3am reported on 2+ occasions
  THEN activate REC-16 (2–3am protocol)

IF cycles < 4 on previous night
  THEN activate REC-03 (CRP) for today
```

**Data Required**
- `cycles_completed_last_night` (REQUIRED)
- `sleep_onset_latency_flag` (optional)
- `disruption_event` (optional)

---

### F-13 — Post-Event Protocol

**Primary Function**
Handle known disruption events (travel, late social event, illness, shift change) with a bounded recovery plan. Communicate that the framework handles disruptions — it does not break under them.

**User States It Addresses**
- US-06 (Post-Disruption Recovery) — primary

**Feature Activation**
- Manual trigger: user logs a disruption event
- Automatic trigger: sleep log shows 2+ consecutive nights < 3 cycles without a structural cause

**Protocol Output**
```
Event: [Travel / Social / Illness / Other]
Nights affected: [N]
Cycle deficit: [N] cycles
Recovery plan:
  - ARP: unchanged at [06:30] — do not shift for sleep-in compensation
  - Today: CRP at [time] — +1 cycle
  - [Day 2]: CRP at [time] if deficit persists
  - Normal plan resumes: [date]
```

**Coaching Copy (Post-Disruption)**
> "One disrupted night doesn't break the plan — it's an input to the weekly balance. Your ARP holds. Today's CRP adds a cycle back. In [N] days, you're balanced. The system handles this."

**Recommendations It Surfaces**
- REC-22 (Post-Disruption Rebalancing)
- REC-03 (CRP scheduling)
- REC-01 (ARP Commitment reaffirmation — no lie-in)

**Data Required**
- `disruption_event_type`
- `nights_affected`
- `weekly_cycle_balance` (current)
- `crp_available` (Phase 2 slots this week)

---

## Cross-Feature Data Flow

```
[Onboarding F-01]
  → Sets: arp, chronotype, target_cycles, crp_available, schedule_consistency

[Daily Check-In F-12]
  → Updates: cycles_completed, onset_latency, disruption_events
  → Feeds: weekly_cycle_balance, active_user_states

[Sleep Log F-04]
  → Updates: actual_sleep_onset, cycles_completed, mid_night_wakings
  → Feeds: weekly_cycle_balance, state detection

[CRP Tracker F-05]
  → Updates: crp_cycles_today
  → Feeds: weekly_cycle_balance

[State Engine]
  → Reads: all of the above
  → Outputs: active_user_states (US-01 through US-14)

[Recommendation Engine]
  → Reads: active_user_states
  → Outputs: active_recommendations (REC-01 through REC-22)

[Feature Display]
  → Home Screen (F-02), Day Plan (F-03), Wind-Down (F-07), etc.
  → Each feature reads its relevant subset of active_recommendations
```

---

## Implementation Readiness Assessment

| Feature | Engine Coverage | Data Defined | Coaching Copy | Gaps |
|---------|----------------|--------------|---------------|------|
| F-01 Onboarding | HIGH | HIGH | HIGH | Profiling tool (OQ-013) |
| F-02 Home Screen | HIGH | HIGH | HIGH | Minor UX decisions |
| F-03 Day Plan | HIGH | HIGH | MEDIUM | Shift work not supported |
| F-04 Sleep Log | HIGH | HIGH | HIGH | Tracker integration design |
| F-05 CRP Tracker | HIGH | HIGH | HIGH | Max CRP/week unspecified |
| F-06 MRM Reminders | HIGH | HIGH | HIGH | Customisation (UX decision) |
| F-07 Wind-Down | HIGH | MEDIUM | HIGH | Pre-sleep personalisation (AUD-004 gap) |
| F-08 Wake-Up Routine | HIGH | MEDIUM | HIGH | Exercise type/detail (minor) |
| F-09 Recovery Insights | HIGH | MEDIUM | HIGH | Trend detection needs 2-week minimum |
| F-10 Chronotype Profile | MEDIUM | MEDIUM | HIGH | Diagnostic tool missing (OQ-013, OQ-021) |
| F-11 Environment Audit | HIGH | HIGH | HIGH | Product specifics (operational) |
| F-12 Daily Check-In | HIGH | HIGH | HIGH | Risk threshold calibration |
| F-13 Post-Event Protocol | HIGH | HIGH | HIGH | Shift work / travel detail (DOC-004) |

---

## Features Not Yet Implementable

### Partner and Family Scheduling
No source has been processed covering multi-person scheduling (AUD-009 pending). The app cannot currently make recommendations for shared sleep environments beyond the individual duvet rule (DR-033).

### Travel and Timezone Protocols
DOC-004 (`05_sleep_travel_final.docx`) has not been processed. Travel-specific advice is limited to the post-disruption protocol (F-13), which handles generic disruption but not jet lag or timezone-crossing.

### Formal Chronotype Diagnostic
No validated R90 profiling instrument has been ingested. The chronotype assignment relies on self-report. PPT-002 likely contains the formal tool.

### KSPI 7 — Integration / Behaviour Change Layer
The seventh KSPI ("Your R90 in Play") represents the integration phase of coaching — how users sustain and adapt the system across life circumstances. No audio or document covering this specifically has been identified in processed sources.

---

## Sources

Feature logic derived from:
- `knowledge/R90_DECISION_ENGINE.md` (all sections)
- `knowledge/R90_USER_STATES.md` (state definitions)
- `knowledge/R90_RECOMMENDATION_ENGINE.md` (recommendation catalogue)
- `knowledge/R90_COACHING_OUTPUTS.md` (communication layer)
- `knowledge/R90_OPEN_QUESTIONS.md` (gap tracking)
