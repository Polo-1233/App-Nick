# R90 User States

Defines the recovery situations the app must be able to detect, classify, and respond to.
Each state drives a different set of recommendations from the R90_RECOMMENDATION_ENGINE.

**Design principle:** States are not diagnostic labels — they are recovery situations.
A user can occupy multiple states simultaneously. The engine should surface the highest-priority active state.

**Sources:** Derived exclusively from validated entries in R90_DECISION_ENGINE.md, R90_DECISION_RULES.md, R90_BEHAVIOURAL_PATTERNS.md, R90_CORE_PRINCIPLES.md.

---

## State Classification Guide

| State ID | State Name | Severity | Action Required |
|----------|------------|----------|----------------|
| US-01 | Aligned | None | Maintenance |
| US-02 | Mild Cycle Deficit | Low | CRP + monitoring |
| US-03 | Significant Cycle Deficit | Medium | CRP + ARP review |
| US-04 | ARP Instability | Medium | Anchor reset |
| US-05 | Chronotype Conflict | Medium | Schedule realignment |
| US-06 | Post-Disruption Recovery | Low–Medium | Managed rebalancing |
| US-07 | Sleep Anxiety Loop | High | Process refocus |
| US-08 | Electronic Insomnia | Medium | Phase 3 correction |
| US-09 | Ortho-Insomnia | High | Tracker management |
| US-10 | Stimulant Compensation | Medium–High | Structural audit |
| US-11 | Environmental Friction | Medium | Environment audit |
| US-12 | Framework Gap | Medium | Onboarding / reset |
| US-13 | Sleep Noise Exposure | Medium | Information detox |
| US-14 | In-Betweener Fog | Low–Medium | Chronotype calibration |
| US-15 | Pre-Event High Arousal | Low–Medium | Arousal management |
| US-16 | Illness / Injury Recovery | Medium | Polyphasic recovery mode |
| US-17 | Shift Work / Multishift | Medium–High | ARP recalculation + shift-specific CRP |

---

## Detailed State Definitions

---

### US-01 — Aligned

**Definition**
The user's R90 framework is structurally in place and functioning. ARP is fixed, weekly cycle target is being met, MRMs and CRPs are embedded in the day, and no risk patterns are active.

**Main Triggers**
- 7-day weekly cycle total ≥ 33
- ARP consistent across all 7 days (variance ≤ 15 min)
- At least 4 nocturnal cycles per night on average
- MRM practice active (≥ 4/day reported)
- No risk pattern flags active

**Observable Signals**
- User reports feeling recovered most mornings
- Sleep onset latency ≤ 15 minutes consistently
- No reported 2–3am waking or difficulty returning to sleep
- Stimulant use stable and not escalating

**Related Rules / Principles**
- DR-018 (fixed ARP), DR-020 (weekly accounting), DR-025 (MRM baseline), P-036 (35/week target)

**Confidence:** HIGH

**App Behaviour in This State**
Maintenance mode. Confirm the plan, celebrate the consistency. Surface weekly cycle summary. Introduce new depth (e.g., chronotype optimisation, light therapy refinement) rather than structural correction.

---

### US-02 — Mild Cycle Deficit

**Definition**
The user is tracking slightly below the 35-cycle weekly target but the deficit is manageable within the current week with CRP. No structural breakdown — this is normal variation.

**Main Triggers**
- Weekly cycle balance: 28–34 (up to 7 cycles behind target)
- Short night(s) this week (3–4 nocturnal cycles on 1–2 nights)
- CRP not yet scheduled to compensate

**Observable Signals**
- User reports one or two nights below target
- Daytime energy below normal but not severely impaired
- Stimulant use unchanged from baseline

**Related Rules / Principles**
- DR-020 (weekly accounting), DR-021 (CRP as compensatory mechanism), P-036, P-037

**Confidence:** HIGH

**App Behaviour in This State**
Trigger a CRP recommendation for the next available Phase 2 slot. Frame it as weekly rebalancing, not a "bad sleep" correction. Language: calm, actionable, no alarm.

**Notes**
The boundary between US-02 and US-03 (significant deficit) is set at 7 cycles behind by day 5 — matching the engine's intervention threshold (RULE-CYCLES-02). This threshold is inferred; exact values require DOC-007 validation.

---

### US-03 — Significant Cycle Deficit

**Definition**
The user is more than 7 cycles behind the weekly target by the middle of the week (day 4–5), or has had 3+ consecutive nights at fewer than 4 cycles. Normal CRP coverage is insufficient to recover the deficit within the week.

**Main Triggers**
- Weekly cycle balance: < 28 by end of day 5
- Three or more consecutive nights at 3 cycles or fewer
- ARP maintained but sleep onset chronically delayed

**Observable Signals**
- User reports persistent fatigue, cognitive fog, or impaired decision-making
- Stimulant reliance increasing
- Motivation to follow the plan declining

**Related Rules / Principles**
- RULE-CYCLES-02, DR-020, DR-021, DR-023, P-036, BP-001 (normalised underperformance)

**Confidence:** MEDIUM
*(Threshold of 7-cycle deficit is inferred from the engine logic, not explicitly confirmed by a processed source)*

**App Behaviour in This State**
Escalate beyond CRP recommendation. Audit structural causes: Is ARP being maintained? Are MRMs in place? Is Phase 3 being disrupted? Surface the weekly balance clearly. Do not suggest more sleep — suggest structural correction first.

**Notes**
If deficit is recurrent across multiple weeks, consider sleep restriction protocol (RULE-SR-01) and escalate to US-07 assessment.

---

### US-04 — ARP Instability

**Definition**
The user's wake time is inconsistent — varying by more than 30 minutes across days, particularly between weekdays and weekends. The circadian anchor is not established, making all downstream cycle calculations unreliable.

**Main Triggers**
- Wake time variation > 30 minutes across any 7-day window
- Weekend "lie-ins" of 60+ minutes beyond weekday wake time
- User has not yet committed to a fixed ARP

**Observable Signals**
- User reports difficulty waking at consistent times
- "Catching up on sleep" on weekends is normalised
- Onset anxiety on Sunday nights is common

**Related Rules / Principles**
- DR-018 (fix wake time — never change it), DR-023 (ARP as non-negotiable foundation), RULE-ARP-01, BP-004

**Confidence:** HIGH

**App Behaviour in This State**
Block full schedule generation until ARP is committed. This is the first requirement of onboarding, and it cannot be skipped. Frame as empowering, not restrictive: "Your wake time is the control lever — once it's fixed, everything else gets easier."

**Notes**
Weekend lie-ins are a common ARP-destabilising pattern. The app should surface the science (circadian anchor) without moralising about it.

---

### US-05 — Chronotype Conflict (Social Jet Lag)

**Definition**
The user's biological chronotype is in conflict with their imposed schedule. Most commonly: a PMer (70% of population) operating on an AMer-structured timetable (early ARP, morning-heavy demands). The misalignment is social or occupational in origin, not the user's choice.

**Main Triggers**
- Chronotype = PMer AND ARP ≤ 06:30
- User reports not feeling "properly awake" before 09:00–10:00
- Stimulant reliance in the morning
- Peak energy/alertness reported in the evening

**Observable Signals**
- Morning cognitive performance notably below afternoon performance
- Stimulant consumption concentrated before midday
- User expresses acceptance of the pattern as "just how I am"
- Weekend ARP is naturally later than weekday ARP by 2+ hours

**Related Rules / Principles**
- RULE-ARP-02, RULE-CHRONO-02, RULE-CHRONO-03, DR-015, DR-017, BP-014, BP-029

**Confidence:** HIGH

**App Behaviour in This State**
Name Social Jet Lag explicitly. Do not attempt to "fix" the chronotype or shift the ARP without the user's agency. Instead: protect the afternoon cognitive window for high-priority tasks, ensure CRP is fully utilised, adjust performance expectations for morning hours.

**Notes**
If the ARP is negotiable (freelance, flexible employer), the app should surface the option to shift it. If not negotiable, the app manages within the mismatch.

---

### US-06 — Post-Disruption Recovery

**Definition**
The user has experienced a specific identifiable disruption event — travel, illness, late social event, or shift change — that has temporarily degraded their cycle total. The framework is intact; this is a contained recovery situation, not a structural failure.

**Main Triggers**
- User logs or reports a disruption event
- 1–3 short nights following a specific identified cause
- ARP was maintained or is being reinstated

**Observable Signals**
- Cycle deficit is time-bounded and traceable to a known event
- No risk pattern flags active
- User is motivated to recover

**Related Rules / Principles**
- DR-020 (weekly accounting), DR-021 (CRP compensation), DR-043 (do not shift ARP after disruption), RULE-ARP-03

**Confidence:** HIGH

**App Behaviour in This State**
Acknowledge the disruption, confirm the ARP is held, schedule CRP(s) for recovery. Frame explicitly as "your system handled a disruption — now we rebalance." This state should not escalate to anxiety. Clear timeline: typical recovery within 2–3 days with CRP.

**Notes**
This state is distinct from US-03 (significant deficit) in that there is a known, bounded cause. The coaching tone is different: reassurance rather than audit.

---

### US-07 — Sleep Anxiety Loop

**Definition**
The user is caught in a self-reinforcing cycle where worry about sleep quality or duration is itself degrading sleep. This is identified by Nick as sleep's primary disruptor. The anxiety is the mechanism, not a symptom of another problem.

**Main Triggers**
- User reports worrying about sleep "before or while trying to sleep"
- Onset latency > 30 minutes on multiple consecutive nights without a clear environmental cause
- User monitors or checks the clock during the night
- User describes going to bed early to "accumulate hours" (BP-019)

**Observable Signals**
- Language centred on outcomes: "I only got X hours," "I never sleep properly," "I can't sleep"
- Sleep quality perceived as consistently poor despite no strong structural issue
- Pre-sleep anxiety or racing thoughts reported
- CRP attempts may feel unsuccessful due to inability to switch off

**Related Rules / Principles**
- DR-014 (process over outcome), RULE-ONSET-03, DR-037 (15-minute rule), BP-013 (anxiety loop), P-034

**Confidence:** HIGH

**App Behaviour in This State**
Redirect entirely from outcome tracking to process adherence. Remove quality scores from the interface temporarily. Introduce the 15-minute rule. Reinforce MRM practice as the primary lever (each MRM measurably improves sleep onset ease). Do not add tracker features or new sleep interventions — this would worsen the loop.

**Critical:** This is the highest-priority behavioural state. Unaddressed sleep anxiety overrides structural improvements.

---

### US-08 — Electronic Insomnia

**Definition**
The user's screen and device use extends into the melatonin window (Phase 3 / ~21:00 for AMers, ~22:30 for PMers), suppressing melatonin production and actively delaying sleep onset. Nick classifies this as a distinct modern pathology — not ordinary insomnia.

**Main Triggers**
- User reports screen use (phone, TV, gaming) in the 90 minutes before sleep onset
- Sleep onset consistently later than the target calculated from ARP
- User describes being "wired" at bedtime

**Observable Signals**
- Sleep onset latency > 30 minutes regularly
- User reports difficulty "switching off" after screen use
- The delay correlates with evenings of heavier screen use
- No other structural issue (ARP is stable, MRMs are in place)

**Related Rules / Principles**
- DR-028 (evening light shift to amber/warm), DR-030 (Phase 3 download), BP-020, BP-024

**Confidence:** HIGH

**App Behaviour in This State**
Activate Phase 3 wind-down protocol. Prompt the shift to amber/warm light at the Phase 3 boundary. Recommend a structured pre-sleep activity replacing screen time (journaling, physical book, gentle stretching). Frame as "you are currently fighting your own melatonin production."

---

### US-09 — Ortho-Insomnia

**Definition**
The user is using a sleep tracker and has developed anxiety specifically about the tracker data — creating a paradox where the measurement tool is now a sleep disruptor. Distinct from general sleep anxiety (US-07) in that the tracker is the specific trigger.

**Main Triggers**
- Tracker is in use AND user reports anxiety about tracker data
- User checks tracker data first thing after waking
- User describes "bad nights" primarily in terms of tracker metrics (deep sleep %, HRV, score)
- Sleep perceived as worsening since beginning tracker use

**Observable Signals**
- Language centred on tracker metrics rather than felt recovery
- User describes performance anxiety about upcoming nights based on previous night's data
- Sleep worsening despite consistent R90 structural adherence

**Related Rules / Principles**
- DR-044 (tracker as guide not verdict), RULE (Section 7 RISK-002 in Decision Engine), BP-030

**Confidence:** HIGH

**App Behaviour in This State**
Step 1: Name ortho-insomnia explicitly and normalise it as a known, named condition. Step 2: Shift to weekly averages only — remove nightly score display. Step 3: If anxiety persists with tracker in use, recommend a defined tracker-free period (e.g., 2 weeks). The R90 app should not rely on tracker data as a primary input — felt recovery and cycle adherence are the primary signals.

---

### US-10 — Stimulant Compensation

**Definition**
The user is using increasing amounts of caffeine, energy drinks, or stimulant supplements to maintain daytime function — masking an underlying structural recovery deficit rather than resolving it.

**Main Triggers**
- Stimulant use escalating in quantity or frequency over recent weeks
- Stimulant use extending past 15:00 (disrupts sleep onset for AMers at 22:30–23:00)
- User cannot function in the morning without a stimulant
- Withdrawal effects (headache, inability to focus) on stimulant-free days

**Observable Signals**
- User describes "needing" coffee/energy drink to start the day
- Multiple stimulant doses per day, timing creeping later
- Sleep onset latency increasing
- Often co-occurring with US-05 (chronotype conflict) or US-03 (significant deficit)

**Related Rules / Principles**
- RULE (Section 7, RISK-003), DR-016, BP-022, BP-014

**Confidence:** HIGH

**App Behaviour in This State**
Do not address stimulant use in isolation. Identify and surface the upstream structural gap first: insufficient cycles, no CRP, no MRMs, chronotype mismatch. Frame stimulants as camouflage — they mask the signal without improving recovery. As structural adherence improves, stimulant need naturally reduces. Advise: no stimulants after 14:00 as an immediate harm-reduction step.

---

### US-11 — Environmental Friction

**Definition**
The user's physical sleep environment is undermining recovery through one or more confirmed barriers: excess heat, inappropriate light, overstimulating décor, absence of blackout provision, or unfamiliar/uncomfortable environment.

**Main Triggers**
- Bedroom temperature reported as warm or variable
- No blackout provision OR blackout without a DWS
- Blue/white light sources active in Phase 3
- TV or work equipment present in the bedroom
- Mattress causing discomfort in the foetal position (hands-width gap test failed)

**Observable Signals**
- User reports waking during the night with no obvious cause
- User feels too hot during the night
- Room is described as "full of stuff" or used for activities other than sleep
- User reports sleeping better in a hotel or different environment (inconsistently — may indicate unfamiliar environment effect)

**Related Rules / Principles**
- DR-029 (temperature differential), DR-028 (evening light), DR-039 (blackout+DWS pair), DR-041 (mental strip), DR-032 (mattress check), BP-023, BP-024, BP-032

**Confidence:** HIGH

**App Behaviour in This State**
Guide through the environment audit (mental strip exercise) before recommending any products. Prioritise: (1) temperature, (2) light, (3) bedroom function, (4) products. Do not recommend new products until items 1–3 are addressed.

---

### US-12 — Framework Gap

**Definition**
The user is applying isolated sleep interventions (apps, trackers, supplements, mattress upgrades, meditation) without the structural R90 framework in place. The framework — ARP, 16-cycle day, CRP, MRM — has not been established as the foundation.

**Main Triggers**
- User has tried multiple interventions without a structured framework
- ARP is not fixed
- CRP and MRM are not part of the user's routine
- User presents with a collection of sleep products but still reports poor sleep

**Observable Signals**
- User lists previous interventions that "didn't work"
- No consistent wake time
- Sleep treated as purely nocturnal — day recovery not addressed
- User language focuses on products, apps, or supplements rather than routine

**Related Rules / Principles**
- DR-026 (framework before products), RULE-INTV-01, BP-021 (intervention scatter)

**Confidence:** HIGH

**App Behaviour in This State**
This is an onboarding / reset state. The app must establish the structural foundation before any other recommendation. Priority order: (1) ARP commitment, (2) cycle target and sleep onset calculation, (3) MRM introduction, (4) CRP introduction, (5) environment audit. No product recommendations until step 4.

---

### US-13 — Sleep Noise Exposure

**Definition**
The user is consuming high volumes of sleep-related content (articles, social media, podcasts, advice) — driven by sleep anxiety — which is increasing fear rather than improving recovery. Device Dipping is the mechanism.

**Main Triggers**
- User describes searching for sleep solutions online when unable to sleep
- User mentions alarming sleep statistics or consequences they have read about
- User is aware of multiple conflicting sleep advice systems
- Anxiety about sleep increases after consuming sleep content

**Observable Signals**
- User brings external information about "why sleep is critical" or "what happens if you don't sleep"
- User reports trying information found online without coherent structure
- Anxiety loop co-occurring with information gathering

**Related Rules / Principles**
- RISK-006 (Decision Engine), BP-028 (Sleep Noise loop), BP-021 (intervention scatter)

**Confidence:** MEDIUM
*(Pattern confirmed; detection mechanism relies on self-report or in-app behaviour)*

**App Behaviour in This State**
Reduce information inputs — one coherent system, not multiple competing frameworks. Name Device Dipping explicitly. Redirect to process adherence within R90 only. The app itself must not contribute to Sleep Noise: no alarming statistics, no fear-based copy, no outcome metrics that heighten anxiety.

---

### US-14 — In-Betweener Fog

**Definition**
The user's natural chronotype is unclear — they cannot clearly identify as AMer or PMer because stimulant use, lifestyle habits, and schedule pressure have blurred the biological signal. They function on an unclear rhythm driven by social obligations and caffeine.

**Main Triggers**
- Chronotype self-report = "I don't know" or "It depends"
- Heavy stimulant use throughout the day with no clear peak performance window
- Wake time driven entirely by obligations, not biology
- Energy pattern flat or erratic rather than having a clear morning or evening peak

**Observable Signals**
- User cannot identify when they feel "most alert" without removing caffeine from the equation
- Sleep need and readiness feel unpredictable
- Performance feels broadly flat and below potential across the whole day

**Related Rules / Principles**
- DR-017, P-017, P-018, BP-014

**Confidence:** HIGH
*(OQ-021 now CLOSED: in-betweener = "wired and tired all the time / like a dolphin" — DOC-007. No formal diagnostic exists by design; classification is by self-reflection. Many self-identified in-betweeners are suppressed PMers — PPT-002.)*

**App Behaviour in This State**
Start with AMer baseline schedule. Monitor self-reported peak windows over 2–4 weeks without relying on stimulants to mask the signal. Gradually refine. Flag stimulant timing as confounding. Do not force classification — allow the biology to reveal itself as the structural framework stabilises. After 2–4 weeks, probe whether the in-betweener label reflects true chronotype or occupational constraint (if the latter, treat as PMer).

**Notes**
OQ-021 CLOSED: In-betweener has a formal description but no formal scoring diagnostic — this is by design in the R90 system. The coaching prompt "if you had complete control of your schedule, what time would you naturally wake?" is the primary classification tool.

---

### US-15 — Pre-Event High Arousal

**Definition**
The user has a high-stakes event, competition, or performance situation within the next 24–48 hours. Elevated adrenaline and cortisol make forced sleep onset counterproductive. Attempting to force sleep in this state typically produces anxiety rather than sleep. The R90 response is to lean into structured daytime recovery rather than fighting biology.

**Main Triggers**
- User flags an upcoming high-stakes event (sporting, professional, personal)
- Reported difficulty sleeping due to anticipation or excitement rather than worry
- Onset latency elevated in context of known upcoming event
- User explicitly names anxiety about not sleeping before the event

**Observable Signals**
- Sleep difficulty is context-specific and time-bounded (the event is identifiable)
- User description: "I can't sleep because of X tomorrow"
- No chronic anxiety pattern — this is situational arousal, not US-07

**Related Rules / Principles**
- DR-067 (pre-event arousal rule), P-128, P-127

**Confidence:** HIGH — Source: AUD-009

**App Behaviour in This State**
Do NOT recommend earlier bedtime. Do NOT frame the situation as a deficit. Instead: (1) Validate that forced sleep before high-arousal events is counterproductive. (2) Recommend maximising CRP and midday recovery in the preceding 24 hours. (3) Advise chilled-state activity in the evening — stay active but calm. (4) Reassure that natural onset will occur; 2 cycles before ARP is sufficient for the event. (5) Hold ARP firm the next morning regardless of sleep count.

**Notes**
Distinct from US-07 (Sleep Anxiety Loop): US-15 is event-specific, time-bounded, and resolves after the event. US-07 is chronic and self-referential. The coaching tone is entirely different: US-15 = "this is normal, here's how high performers use it"; US-07 = "let's defocus from outcome."

---

### US-16 — Illness / Injury Recovery

**Definition**
The user is experiencing illness (cold, flu, infection) or physical injury that is actively disrupting their sleep quality and/or requiring increased recovery. In this state, the normal cycle targets are suspended; the priority shifts to maximising total recovery across both nocturnal and daytime slots.

**Main Triggers**
- User reports illness or injury
- Sleep quality reported as poor despite adequate time in bed (illness disrupting cycles)
- Prolonged disruption pattern without a clear scheduling/environmental/anxiety cause

**Observable Signals**
- User references feeling unwell, congested, in pain, or physically incapacitated
- Cycle count reduced despite ARP maintained
- User reports daytime fatigue inconsistent with recent nocturnal totals

**Related Rules / Principles**
- DR-068 (illness mode rule), P-129, P-109 (extended CRP), AUD-009

**Confidence:** HIGH — Source: AUD-009

**App Behaviour in This State**
(1) Suspend normal cycle targets — do not display deficit warnings during active illness. (2) Shift recommendations to polyphasic recovery: maximise CRP slots (extend to 90 min if nocturnal is severely disrupted — DR-055). (3) Prompt environment optimisation: airflow, cleanliness, nasal breathing (BP-027). (4) Set expectation: "while you're recovering, the goal is total rest — not hitting 35 cycles." (5) Reinstate normal targets when user self-reports as well.

**Notes**
Injury without illness may have different profile — pain management and environment optimisation take priority over schedule. Illness with high fever or respiratory symptoms should be flagged with a disclaimer directing to medical advice (consistent with Nick's medical disclaimer in DOC-007 and PPT-002).

---

### US-17 — Shift Work / Multishift

**Definition**
The user works a shift pattern that displaces their sleep window from the conventional Phase 4 nocturnal position (22:30–06:30). This includes fixed night shifts, rotating shifts, and irregular schedules. The circadian mismatch between occupational demands and biological rhythm requires a different ARP, a different sleep window, and shift-specific CRP placement.

**Main Triggers**
- User reports working nights, early mornings, or rotating shift patterns
- Reported sleep time falls in morning or daytime hours (rather than 22:00–07:00 window)
- User describes ARP confusion — different wake times on different days based on shift

**Observable Signals**
- Sleep window reported outside standard Phase 3/4 boundary (before 21:00 or after 06:00)
- User reports difficulty sleeping in daylight hours
- Stimulant use concentrated in overnight hours (caffeine at 02:00–04:00)
- Social jet lag described specifically in relation to shift rotation, not chronotype

**Related Rules / Principles**
- DR-078 (ARP selection — ARP 1 vs ARP 2), DR-079 (shift CRP placement), P-162–P-165

**Confidence:** HIGH — Source: IMG-016, IMG-017

**App Behaviour in This State**
(1) Ask user to specify shift type: day, night, or rotating. (2) Assign ARP accordingly: day shift → ARP 1 = 06:00; night shift → ARP 2 = 18:00. (3) Recalculate full 16-cycle wheel from the applicable ARP. (4) Set CRP at appropriate position: day shift C16 (16:30), night shift C7 (03:00). (5) For rotating shifts: treat each rotation as a temporary ARP change — do not shift ARP permanently until rotation is stable for 7+ days. (6) Warn: daytime sleep requires complete blackout and environmental noise control — environmental friction is highest in this state (co-occurs with US-11).

**Notes**
Night shift workers face compounded difficulty: their sleep window is in Phase 1/2 (biologically active hours), meaning the circadian rhythm and homeostatic pressure are NOT aligned during sleep. Blackout blinds, DWS at ARP, and strict noise management are critical. CRP during the shift is the primary resilience tool.

---

## State Co-occurrence Matrix

Some states frequently co-occur. The engine should check for combinations:

| Primary State | Commonly Co-occurring States |
|--------------|------------------------------|
| US-05 (Chronotype Conflict) | US-10 (Stimulant Compensation), US-03 (Significant Deficit), US-07 (Sleep Anxiety Loop), US-12 (Framework Gap) |
| US-07 (Sleep Anxiety Loop) | US-09 (Ortho-Insomnia), US-13 (Sleep Noise) |
| US-12 (Framework Gap) | US-11 (Environmental Friction), US-10 (Stimulant Compensation) |
| US-04 (ARP Instability) | US-03 (Significant Deficit), US-05 (Chronotype Conflict) |
| US-08 (Electronic Insomnia) | US-07 (Sleep Anxiety Loop), US-03 (Significant Deficit) |

When multiple states co-occur, the engine prioritises by action urgency:
1. US-07 / US-09 (anxiety states) — address first; structural improvements are blocked by anxiety
2. US-04 (ARP instability) — fix anchor before any other scheduling work
3. US-12 (framework gap) — establish structure before adding interventions
4. All others — address in parallel or sequence based on user capacity

---

## Sources

All states derived from:
- `knowledge/R90_DECISION_ENGINE.md` (Section 7, Risk Detection)
- `knowledge/R90_DECISION_RULES.md` (DR-011–DR-045)
- `knowledge/R90_BEHAVIOURAL_PATTERNS.md` (BP-001–BP-032)
- `knowledge/R90_CORE_PRINCIPLES.md` (P-017–P-077)
