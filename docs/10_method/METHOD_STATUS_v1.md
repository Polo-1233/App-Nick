# Method Status — v1

**Version:** 1.0
**Date:** 2026-02-17
**Purpose:** Track validation status of every R90 rule implemented in the codebase.

---

## Rule Classification System

We use three statuses to mark how confident we are in each rule's alignment with Nick's R90 methodology:

### CONFIRMED
**Criteria:** Rule has direct grounding in Nick's book ("L'art de mieux dormir") with chapter citation, OR has been explicitly validated by Nick in a call/email.

**Examples:**
- R001: "Bedtime = Anchor - (cycles × 90)" — core R90 principle, ch. 3
- R020: "CRP window 13:00-15:00" — book ch. 5 explicitly states "entre 13h et 15h"

**Shipping:** CONFIRMED rules can ship to users.

---

### TODO_NICK
**Criteria:** Rule is plausible from R90 principles but lacks direct book citation, OR was inferred from Product Vision document (MetaLab interpretation, not Nick's words), OR has explicit book contradiction that needs clarification.

**Examples:**
- R002: "Default 5 cycles/night" — book says "pour une personne standard" but doesn't specify if chronotype affects default
- R013: "90-min adrenaline clearance" — from Product Vision only, not in book
- R041: "Below 28 by Thursday" — book says 28-30 acceptable for WEEK, not day-specific rule

**Shipping:** TODO_NICK rules should NOT ship until Nick validates them. Can be used in MVP with clear "Experimental" labels.

---

### ASSUMPTION (not yet implemented as status)
**Criteria:** Rule is an engineering decision or default behavior, not part of R90 method itself.

**Examples (if we add this status):**
- "Default to green zone on first app launch" — UX decision, no method basis
- "Sort blocks by anchor-relative time" — implementation detail

**Note:** Currently we use CONFIRMED/TODO_NICK only. ASSUMPTION may be added in future if needed for clarity.

---

## Full Rule Status Table

| Rule ID | Description | Status | Source / Validation Note |
|---------|-------------|--------|-------------------------|
| **Cycle Calculation** ||||
| R001 | Bedtime = Anchor - (cycles × 90) | CONFIRMED | Book ch. 3 (core R90 principle) |
| R002 | Default 5 cycles/night | TODO_NICK | Book: "pour une personne standard" — does chronotype affect default? |
| R003 | Minimum useful night = 3 cycles | TODO_NICK | Book: "juste trois cycles, même si là, vous poussez" — but is 3 the floor? |
| R004 | Missed bedtime → drop 1 cycle | CONFIRMED | Book ch. 3 (cycle boundary logic) |
| R005 | Never recommend < 2 cycles | TODO_NICK | Inferred from Jess example (Saturday = 2 cycles), not explicit |
| R006 | Cycles count toward weekly total regardless of night | CONFIRMED | Book ch. 3 (weekly thinking) |
| **Pre-Sleep & Down-Period** ||||
| R010 | Down-period 90 min before first cycle | TODO_NICK | Conflated with pre-sleep in v0.1; book says 90-min pre-sleep, not separate down-period |
| R011 | Pre-sleep 30 min before down-period | TODO_NICK | Deprecated model (30+90=120); book says single 90-min pre-sleep |
| R012 | During down-period: no screens, dim lights | CONFIRMED | Book ch. 4 (pre-sleep routine content) |
| R013 | Post-event adrenaline clearance = 90 min | TODO_NICK | Product Vision only, not in book |
| R014 | Late-event: accept delayed start, don't force sleep | CONFIRMED | Book ch. 3 (missed bedtime logic applies) |
| **CRP** ||||
| R020 | Midday CRP window = 13:00-15:00 | CONFIRMED | Book ch. 5: "entre 13h et 15h" |
| R021 | CRP can be 30 min or 90 min | CONFIRMED | Book ch. 5: "trente minutes... ou... quatre-vingt-dix minutes" |
| R022 | CRP recommended when previous night < 5 cycles | CONFIRMED | Book ch. 5 (recovery logic) |
| R023 | CRP counts toward weekly total | TODO_NICK | Book says it "counts" but doesn't specify 30-min = 0.5 or 1 cycle |
| R024 | Evening CRP window = 17:00-19:00, 30 min only | CONFIRMED | Book ch. 5: "aux alentours de 17h-19h" |
| R025 | Evening CRP must be 30 min (90 interferes) | CONFIRMED | Book ch. 5: "risquerait d'interférer avec notre sommeil nocturne" |
| **Calendar Conflicts** ||||
| R030 | Pre-sleep overlap → offer 2 options | TODO_NICK | Product Vision pattern, not explicit in book |
| R031 | Anchor time NEVER moves for events | CONFIRMED | Book ch. 3 (anchor is non-negotiable) |
| R032 | Event ends past bedtime → next cycle boundary | CONFIRMED | Book ch. 3 (cycle boundary logic) |
| R033 | R-Lo presents options, never demands | TODO_NICK | Product Vision (R-Lo persona), not in book |
| **Weekly Recovery** ||||
| R040 | Weekly target = 35 cycles | CONFIRMED | Book ch. 3: "cinq cycles par nuit × sept jours" |
| R041 | Below 28 by Thursday → flag recovery | TODO_NICK | Book says 28-30 acceptable for WEEK, not day-specific threshold |
| R042 | One bad night doesn't define week | CONFIRMED | Book ch. 3 (weekly thinking vs. nightly perfection) |
| R043 | Recovery framing: "X/35, two good nights..." | TODO_NICK | Message pattern from Product Vision, not book quote |
| **Readiness Zone** ||||
| R050 | Green: avg ≥ 4.5 cycles (last 3 nights) | TODO_NICK | Threshold invented for MVP, no book basis |
| R051 | Yellow: avg 3-4.5 cycles (last 3 nights) | TODO_NICK | Threshold invented for MVP, no book basis |
| R052 | Orange: avg < 3 cycles (last 3 nights) | TODO_NICK | Threshold invented for MVP, no book basis |
| R053 | Zone NEVER shown as number | CONFIRMED | Product Vision principle (anti-anxiety) |
| **R-Lo Messages** ||||
| R060 | Morning message: cycles + progress + zone | TODO_NICK | Product Vision message structure, not book |
| R061 | Midday message: CRP reminder | TODO_NICK | Product Vision message structure, not book |
| R062 | Evening message: pre-sleep prompt | TODO_NICK | Product Vision message structure, not book |
| R063 | Post-event message: down-period guidance | TODO_NICK | Product Vision message structure, not book |
| R064 | Tone: calm, pragmatic, never anxious | CONFIRMED | Product Vision + PROJECT_CHARTER (core principle) |
| R065 | Forbidden words: score, grade, poor, bad, fail | CONFIRMED | Product Vision + PROJECT_CHARTER (core principle) |

---

## Summary Counts

| Status | Count | % of Total |
|--------|-------|-----------|
| CONFIRMED | 18 | 50% |
| TODO_NICK | 18 | 50% |
| **Total** | **36** | **100%** |

---

## No Accidental Confirmations — Pre-Ship Checklist

Before any rule ships to users as CONFIRMED, verify:

- [ ] **Book citation exists**: Rule description or source note references specific book chapter
- [ ] **OR Nick explicitly validated**: Email/call notes confirm Nick approved this rule
- [ ] **No Product Vision assumptions**: Rule didn't come solely from MetaLab's interpretation doc
- [ ] **No "seems reasonable" confirmations**: Inference from R90 principles ≠ confirmation

**Examples of rules that MUST stay TODO_NICK until validated:**
- Readiness zone thresholds (R050-R052) — entirely invented
- R-Lo message structures (R060-R063) — Product Vision design, not method
- Day-specific recovery thresholds (R041) — book doesn't specify Thursday

**Golden rule:** When in doubt, downgrade to TODO_NICK. Better to ask Nick than misrepresent his method.

---

## Next Steps

1. **Pre-Nick validation call:** Prepare doc with all 18 TODO_NICK questions grouped by priority
2. **Post-validation:** Update this table with Nick's answers, flip status to CONFIRMED where appropriate
3. **Continuous update:** Any new rule added to `rules.ts` must have corresponding entry in this table

---

*Last updated: Phase B completion (2026-02-17)*
