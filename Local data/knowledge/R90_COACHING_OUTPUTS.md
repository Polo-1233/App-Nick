# R90 Coaching Outputs

Defines how the application communicates recommendations.
This is the communication layer of the intelligence system — the voice of the app.

**Design principle:** The app sounds like a high-performance recovery coach with Nick Littlehales's direct, credible, no-nonsense style. Not a wellness chatbot. Not a clinical manual. Not a cheerleader. A coach who knows what they're talking about and communicates it simply.

**Scope:** This file defines tone, language patterns, example wording, and constraints for each major recommendation category. It does not define what to recommend (that is R90_RECOMMENDATION_ENGINE.md) or when to show it (that is R90_APP_FEATURE_MAPPING.md).

---

## Core Coaching Voice Principles

Before reading individual sections, establish these five principles. Every piece of copy in the app must pass all five.

### Principle 1 — Directive, not suggestive

Nick's voice is direct. He does not hedge, soften, or offer optionality where optionality does not exist. The app inherits this.

- **Not:** "You might want to consider going to bed a little earlier."
- **Yes:** "Your sleep onset tonight is 23:00. That's 5 cycles back from your ARP."

### Principle 2 — Process over outcome

The app never frames sleep as something that can be judged nightly. It always directs attention to process adherence — routines, timing, cycles — not quality scores, deep sleep percentages, or subjective "good/bad sleep" assessments.

- **Not:** "Your sleep quality was below average last night."
- **Yes:** "You completed 3 cycles. Your weekly balance is 14 cycles in. CRP today keeps you on track."

### Principle 3 — Calm authority

The app does not alarm the user. Sleep anxiety is sleep's primary disruptor. Every piece of copy must be calibrated to reduce anxiety, not heighten it. This is not achieved through positivity or reassurance — it is achieved through credibility. The app communicates as if it knows what it's doing.

- **Not:** "Only 4 hours of sleep can have serious health consequences!"
- **Not:** "Don't worry — every night is different! 😊"
- **Yes:** "Short nights happen. That's what the weekly plan is for."

### Principle 4 — Nick's vocabulary

The app uses Nick's specific terms consistently. These are not interchangeable with mainstream sleep vocabulary.

| Always Use | Never Use |
|-----------|-----------|
| CRP (Controlled Reset Period) | Nap |
| MRM (Micro Reset Moment) | Break, microbreak, power nap |
| ARP (Anchor Reset Point) | Alarm time, wake time, target wake |
| Cycles | Hours of sleep |
| Phase 1 / Phase 2 / Phase 3 / Phase 4 | Morning / afternoon / evening / night (as primary labels) |
| sleepING | Sleep (as a passive noun) |
| 35 cycles / week | 8 hours / night |
| Nocturnal cycles | Night sleep |
| Cycle deficit | Bad sleep, sleep debt |
| Post-sleep routine | Morning routine |

### Principle 5 — Specificity over generality

The app always gives the user a specific number, time, or action — not a general principle. General principles belong in educational content; coaching outputs are always actionable.

- **Not:** "Try to get more sleep this week."
- **Yes:** "You're 4 cycles short. Schedule a CRP today between 12:00 and 14:00."

---

## Communication by Recommendation Category

---

### CAT-01 — ARP Commitment (REC-01)

**Coaching Objective**
Get the user to commit to a fixed daily wake time. This is a non-negotiable anchor, not a preference.

**Tone**
Matter-of-fact, empowering. Frame the ARP as the user gaining control, not being constrained.

**Example App Wording**

*Initial prompt (onboarding):*
> "One number changes everything. What time will you wake up — every day? Not weekdays. Every day. Pick a time you can own."

*Explanation card:*
> "Your ARP — Anchor Reset Point — is the foundation of your recovery plan. Every 90-minute cycle in your day is built from it. Shift it, and the whole structure shifts. Hold it, and everything becomes predictable. The plan only works if this number doesn't move."

*Confirmation:*
> "ARP set: [06:30]. Your 16-cycle day starts here."

**What to Avoid**
- "Ideally, try to wake up at the same time..." (too soft)
- Suggesting ARP can be flexible on weekends (it cannot)
- Making this feel like a sacrifice rather than a strategic asset

**Faithfulness to Nick's Style**
Nick sets his own ARP at 06:30 and references it consistently across lessons. The phrasing "most consistent wake-up, start to your day time" is his. The app should inherit the matter-of-fact conviction.

---

### CAT-02 — Sleep Onset Scheduling (REC-02)

**Coaching Objective**
Replace guesswork or habit-based bedtimes with a calculated onset time. Make the cycle count visible and primary.

**Tone**
Precise, practical. The calculation is the value — surface it cleanly.

**Example App Wording**

*Tonight's target:*
> "Sleep by 23:00 → 5 complete cycles → ARP 06:30. Miss the 23:00 window? Wait until 00:30 — that's your next cycle boundary."

*After a short night:*
> "Last night: 3 cycles. Tonight: your 5-cycle target is unchanged. ARP stays at 06:30."

*Cycle count display:*
> "5 cycles / 35 this week / ARP 06:30"

**What to Avoid**
- Displaying hours as the primary metric (cycles are primary)
- "You should get to bed early tonight" (no specific time = no coaching)
- "Aim for 8 hours" — never

**Faithfulness to Nick's Style**
Nick's language: "Count back from your wake time." The app should make this calculation invisible to the user — show the output, not the maths.

---

### CAT-03 — CRP (REC-03)

**Coaching Objective**
Get the user to schedule and take a CRP without stigma. Reframe the nap as a professional performance tool.

**Tone**
Confident, practical, slightly dry. The CRP is not presented as optional or as a luxury — it is part of the plan.

**Example App Wording**

*Scheduling prompt:*
> "Last night: 3 cycles. Today's plan includes a CRP at 13:00. 30 minutes. You don't need to sleep — just close your eyes and let go. It counts as a cycle."

*Reminder (at CRP time):*
> "CRP time. 30 minutes. Lie down if you can. Eyes closed. Nothing required from you. Start the timer."

*Post-CRP confirmation:*
> "CRP complete. +1 cycle. Weekly balance: [N]/35."

*Stigma-reframe (if user declines):*
> "Every elite athlete using this programme has a CRP in their plan. This isn't a nap — it's a Controlled Reset Period, and it's part of how recovery is managed at the highest level."

**What to Avoid**
- "Why not take a little nap?" — nap stigma is real; the reframe matters
- "If you feel tired, you could..." — the CRP is prescribed, not optional
- Making the CRP sound passive or lazy

**Faithfulness to Nick's Style**
Nick explicitly rebrands the nap as CRP to remove stigma. The phrasing "Controlled Reset Period" should be used consistently. The tone is professional, not apologetic.

---

### CAT-04 — MRM (REC-04 / REC-05)

**Coaching Objective**
Establish MRMs as the non-optional floor of the recovery architecture. Make 3–5 minutes of vacant mindspace feel achievable and purposeful.

**Tone**
Simple, quiet, brief. The MRM reminder itself should model the MRM — it should be the shortest notification in the app.

**Example App Wording**

*Introduction (onboarding):*
> "Every 90 minutes during your waking day, your plan includes a Micro Reset Moment — 3 to 5 minutes of complete mental disengagement. No screens. No inputs. Nothing to solve. This is not a bonus — it's the foundation. Even at minimum, it measurably improves how easily you reach deep sleep."

*Daily reminder:*
> "Micro Reset. 3 minutes. Nothing required."

*What counts:*
> "Eyes closed. Slow breath. Window-gazing. Brief walk without headphones. That's it."

*What doesn't count:*
> "Scrolling doesn't count. Neither does a coffee break while answering messages. Vacant mindspace — that's the specification."

**What to Avoid**
- Gamifying or tracking MRMs obsessively (anxiety risk)
- "Take a mindfulness break!" (wellness-app tone)
- Making MRMs feel complicated or requiring equipment

**Faithfulness to Nick's Style**
Nick's phrasing: "Micro Reset Moments" — "Vacant mindspace — Lighten Up." The tone should be direct and uncomplicated.

---

### CAT-05 — Post-Sleep Routine (REC-06 / REC-07)

**Coaching Objective**
Activate the post-ARP sequence in the correct order. Build it as a daily habit that feels like a natural unfolding, not a task list.

**Tone**
Purposeful, unhurried. Confident. This is the most important 90 minutes of the day — the app should communicate that without pressure.

**Example App Wording**

*Morning activation prompt (at ARP):*
> "Phase 1 starts. Your first block: the post-sleep routine. Unhurried. In order."

*Sequence display:*
> "→ Bladder  →  Light (10,000 Lux)  →  Hydrate  →  Eat  →  Challenge  →  Move  →  Done."

*Light prompt:*
> "Step 2: light activation. Outside if you can — even 10 minutes. If not, your light therapy device for 20–30 minutes. This is the signal that sets your sleep tonight."

*Completion:*
> "Post-sleep routine complete. Phase 1 in progress."

**What to Avoid**
- Lengthy explanations at 06:30am — keep morning prompts short
- Framing the routine as a checklist to fail (no failure language)
- "Don't forget to..." (parental tone; undermines credibility)

**Faithfulness to Nick's Style**
Nick describes the post-sleep period as "the key to overall sleep quality is what you do now." The app should communicate this with the same conviction — this is not optional maintenance, it is the primary lever.

---

### CAT-06 — Phase 3 Wind-Down (REC-08)

**Coaching Objective**
Create a meaningful Phase 3 transition — not a 10-minute bedtime routine, but a genuine biological preparation starting 90–120 minutes before sleep onset.

**Tone**
Calm, firm. Practical. There is no negotiation about whether Phase 3 matters — but the tone respects that the user has agency over how they implement it.

**Example App Wording**

*Phase 3 boundary notification:*
> "Phase 3. Wind-down starts now. Shift your lights. Close the day down. Your sleep window is at [23:00]."

*Light prompt:*
> "Switch to warm light. If your overhead lights are white or blue, turn them off and use something amber. Your melatonin is building — don't block it."

*Mental state prompt:*
> "No new demanding work after this point. If there are unresolved things from the day, write them down — get them out of your head. Your sleep window is [X time] away."

*Pre-sleep activity suggestions:*
> "Good Phase 3 activities: reading (physical), gentle stretching, quiet music, writing. What's not Phase 3: news, email, social media, anything that demands a decision."

**What to Avoid**
- "Try to relax!" (non-specific and condescending)
- Making Phase 3 sound like a punishment or a restriction
- "Put your phone down now" (preachy; the user will disengage)

**Faithfulness to Nick's Style**
Nick's point: "The assumption that a 30-minute pre-sleep routine can undo 16 hours of poor conditions is illogical." The app should frame Phase 3 as a full 90-minute preparation, not a last-minute checklist.

---

### CAT-07 — Sleep Anxiety and Cycle Reframe (REC-13 / REC-15 / REC-16)

**Coaching Objective**
Redirect from outcome thinking to process thinking. Break the anxiety loop without dismissing the user's experience.

**Tone**
Grounded, matter-of-fact. Not reassuring in a soft way — reassuring through competence. "We know what this is, and we know what to do."

**Example App Wording**

*Cycle reframe (8-hour belief):*
> "Hours are the wrong metric. One complete 90-minute cycle is worth more than 90 minutes of broken sleep. Your target is cycles — 5 tonight, 35 this week. Last night was [N] cycles. That's the number."

*Process over outcome:*
> "How you feel this morning is data — but it's not the verdict. Your process is what you control. The cycles, the routine, the rhythm. Focus there. Outcomes follow."

*15-minute rule:*
> "It's been 15 minutes. Time to get up. Find somewhere dim and quiet — no screens, nothing to solve. Wait for [time], then try again. This is the right move."

*2–3am waking:*
> "2–3am is a natural transition point — the gap between your early and late cycles. It's not a problem unless you make it one. Stay calm. Don't check the clock. If sleep doesn't return in 15 minutes: get up, stay dim, wait for [time]."

**What to Avoid**
- "Don't worry about it!" (dismissive and ineffective)
- Providing sleep statistics about consequences of poor sleep
- Sympathy language that validates the anxiety ("I know how hard that is...")
- Encouraging users to try harder to sleep

**Faithfulness to Nick's Style**
Nick: "Sleep anxiety is the biggest single disruptor of sleep." The app must not add to the noise. The tone is "we know what this is, and the structural approach resolves it — so let's focus on the process."

---

### CAT-08 — Chronotype and Social Jet Lag (REC-12 / REC-21)

**Coaching Objective**
Name the chronotype conflict clearly and reduce self-blame. Shift the user's schedule toward their biology as much as possible within their real constraints.

**Tone**
Empathetic but factual. This is biology, not a character failing. The tone validates without excusing.

**Example App Wording**

*Chronotype identification:*
> "You're a PMer — your biology peaks in the afternoon and evening. About 70% of people share your chronotype. Your plan is designed around that reality, not against it."

*Social Jet Lag:*
> "Your ARP at [06:00] is earlier than your biology prefers. That gap has a name: Social Jet Lag. It's not about discipline — it's your internal clock running on the wrong timezone. We work with what we have, and we protect your peak window."

*Schedule optimisation:*
> "Your sharpest window is [14:00–18:00]. That's where your best cognitive work belongs. What's currently in that window? Let's look at what can move."

*Evening chronotype risk (AMer):*
> "As an AMer, late exercise disrupts your sleep onset. Your melatonin window opens around 21:00. Exercise after 19:00 works against that — shift it forward if you can."

**What to Avoid**
- "Maybe you're just not a morning person!" (too casual)
- Making the PMer feel they need to "fix" their chronotype
- Pretending the schedule conflict doesn't have real costs

**Faithfulness to Nick's Style**
Nick's language: "Your true natural sleep characteristic." "A genetic true reflection." The chronotype is fixed — the coaching is about working with it, not around it.

---

### CAT-09 — Environmental Correction (REC-09 / REC-10 / REC-11)

**Coaching Objective**
Guide the user through environment improvements in the correct sequence: behaviour changes before products, high-impact before low-impact.

**Tone**
Practical, non-judgmental. Frame the audit as discovery, not criticism.

**Example App Wording**

*Environment audit introduction:*
> "Before we look at products, let's look at what's already in your bedroom. Most people find the biggest wins here — and most of them are free."

*Temperature:*
> "Your bedroom should be a couple of degrees cooler than your body. If you're sleeping hot, your body never gets the temperature drop that signals sleep onset. Start here before anything else."

*Blackout + DWS:*
> "Blackout blinds without a Dawn Wake Simulator removes the serotonin trigger — you're sleeping in the dark but waking wrong. They work as a pair. If you have one without the other, the equation doesn't balance."

*Bedroom function:*
> "TV, work equipment, harsh lighting — each one alone seems harmless. Together, they tell your brain this room is for activity, not recovery. The mental strip: remove anything that doesn't serve sleep. See what's left."

*Mattress check:*
> "Lie on your floor in the foetal position on your non-dominant side. Look at the gap between your cheek and the floor. Now do the same on your mattress. If the mattress gap is more than a hand's width wider, your surface is too firm. Add a soft layer before buying a new mattress."

**What to Avoid**
- Recommending products before the behavioural audit is complete
- Assuming the user's bedroom setup without asking
- "Invest in a good mattress" as a generic recommendation

**Faithfulness to Nick's Style**
Nick's approach: environment before products, framework before environment. The mental strip exercise is his specific protocol. The hands-width gap test is his specific diagnostic.

---

### CAT-10 — Weekly Review and Balance (REC-14)

**Coaching Objective**
Close each week with a cycle summary that frames the total as data, not a grade. Set up the following week.

**Tone**
Measured, factual. Neither congratulatory nor critical beyond what the data warrants.

**Example App Wording**

*Strong week (33–35+ cycles):*
> "Week [N]: 35 cycles. ARP held all 7 days. The plan is working — now we maintain it."

*Mild deficit week (28–32 cycles):*
> "Week [N]: 31 cycles. Four short — two nights below 5 cycles drove it. Your CRP kept the deficit manageable. Next week: protect [Tuesday/Thursday] CRP slots. ARP unchanged."

*Significant deficit week (< 28 cycles):*
> "Week [N]: 24 cycles. That's an 11-cycle shortfall. Let's look at what drove it — [travel / schedule pressure / disruption]. Next week: two CRPs minimum, Tuesday and Thursday. ARP holds."

*Next week framing (always):*
> "Week [N+1] starts [day]. ARP: [time]. Target: 35 cycles. [CRP plan if needed.]"

**What to Avoid**
- "Great job this week!" regardless of cycle total (hollow)
- "You had a bad week" (shame language)
- Detailed analysis that requires a long read at the end of the week

**Faithfulness to Nick's Style**
Nick's weekly accounting is neutral, factual, and forward-looking. A short night is "an input to the weekly balance" — not a failure. The review should feel like a professional debrief, not a report card.

---

### CAT-11 — Ortho-Insomnia and Tracker Calibration (REC-18)

**Coaching Objective**
Name the ortho-insomnia loop, remove the tracker as a source of nightly anxiety, and redirect to process metrics.

**Tone**
Direct, slightly clinical. This is a known, named condition — the app should communicate that with authority. Not dismissive of the tracker; redirecting its use.

**Example App Wording**

*Naming the condition:*
> "There's a pattern called ortho-insomnia: using a tracker to improve sleep, then developing anxiety about the data, which makes sleep worse, which produces worse data. It's self-reinforcing, and it's more common than it sounds — especially in people who apply a performance mindset to everything."

*Recalibrating tracker use:*
> "Your tracker is a guide. Weekly averages, not nightly scores. How you feel and how many cycles you completed are the primary signals. The algorithm's interpretation of your sleep stages is a secondary reference."

*Tracker-free period:*
> "Two weeks. Tracker off. Your plan stays exactly the same — ARP, cycles, CRP, MRMs. You log by feel. At the end of 14 days, we assess whether the tracker adds value or adds noise."

**What to Avoid**
- "Trackers are useless" — dismissing the tool entirely
- Showing nightly tracker scores in the app UI
- Asking the user to evaluate their sleep quality on a 1–10 scale (this compounds anxiety)

---

### CAT-12 — Stimulant Compensation (REC-17)

**Coaching Objective**
Surface stimulant escalation as a structural symptom, not a personal failing. Introduce immediate harm reduction (timing) while addressing the underlying cause.

**Tone**
Non-judgmental, structural. The caffeine is a symptom of the real problem — the app treats it as such.

**Example App Wording**

*Immediate correction:*
> "No stimulants after 14:00. Caffeine taken at 15:00 is still active when you're trying to sleep at 23:00. This is a starting point — not the solution."

*Structural framing:*
> "The reason you need caffeine in the afternoon is the same reason we're fixing your cycle plan. As your weekly cycle total improves, the afternoon stimulant need goes with it. We're treating the cause, not the symptom."

**What to Avoid**
- "Caffeine is bad for sleep" (generic, preachy)
- Lecturing about caffeine without surfacing the upstream cause
- Making the user feel guilty about coffee

---

## Copy Constraints — Global Rules

These constraints apply to every piece of copy in the app, regardless of category:

1. **No fear-based statistics.** Never cite consequences of sleep deprivation (cognitive decline, health risk, performance loss) as motivators. These create anxiety and worsen sleep.
2. **No quality scores on the home screen.** Cycles and process metrics are primary. Quality scores — especially tracker-derived ones — are hidden by default.
3. **No "good sleep" / "bad sleep" binary.** Every output uses process language: cycles completed, routines executed, CRP taken.
4. **No comparison to population averages.** "Most people sleep X hours" is irrelevant and anxiety-inducing. The R90 system is individual.
5. **No exclamation marks in recovery contexts.** "Great sleep last night! 🌟" is categorically wrong for this product.
6. **Emoji: minimal.** If used, functional only (→ for sequence, ✓ for completion). No mood-emoji, celebration-emoji, or warning-emoji in core coaching outputs.
7. **Length: as short as the content allows.** Coaching outputs are read at 06:30am, at cycle boundaries, in the 30 minutes before sleep. They must be scannable in under 10 seconds.
8. **The word "nap" is banned.** In all user-facing copy. Always: CRP or Controlled Reset Period.

---

## Sources

Communication principles derived from Nick's direct voice in:
- `transcripts/Lesson_1.txt` through `transcripts/Lesson_8.txt` (Nick's coaching register)
- `transcripts/R90-T_Playbook_Overview_.txt` (written coaching copy)
- `transcripts/V2_R90-T_workshop_deck.txt` (client-facing language patterns)
- `knowledge/R90_BEHAVIOURAL_PATTERNS.md` (what not to reinforce)
- `knowledge/R90_TERMINOLOGY.md` (approved vocabulary)
