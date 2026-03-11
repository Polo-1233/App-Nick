# Product Architecture Roadmap — R90 Digital Navigator

**Version:** 2.0 (Strategic Pivot)
**Date:** 2026-02-17
**Scope:** 10 weeks, single full-stack developer
**North Star:** Vision Produit Complète — Version Stratégique Optimisée

---

## 1. Current State vs. Target Architecture

### What Exists (MVP)

| Layer | Component | Status |
|-------|-----------|--------|
| Engine | `packages/core` — cycles, readiness, conflicts, actions, rlo, planner | ✅ 17 scenarios, deterministic |
| Types | `packages/types` — full type system | ✅ Stable |
| Storage | AsyncStorage with versioned keys | ✅ Profile, week history, CRP records |
| UI | Single-screen app: ReadinessIndicator, RLoCard, NextActionCard, CRPCard, TimelineView | ✅ Functional |
| Calendar | expo-calendar integration, conflict detection | ✅ Permission handling, real events |
| Onboarding | Anchor time + chronotype picker | ✅ 2 fields |
| Tests | 17 scenarios via tsx runner | ✅ All passing |

### What Changes

| Current | Becomes | Why |
|---------|---------|-----|
| R-Lo (mascot character) | **Airloop** (discrete expert guide) | Calm, non-caricatural, animates only on interaction |
| Single home screen | **3-tab navigation** (Home / Calendar / Profile) | Cognitive separation of concerns |
| RLoCard chat bubble | **Global Airloop Chat** accessible from all pages | Chat = interface, Engine = logic, AI = interpretation |
| Streaks/badges roadmap | **Removed entirely** | Anti-gamification: no childish scoring |
| Free forever model | **Event-triggered premium** | Paywall after 3 days, first major conflict, or advanced recalculation |
| Static onboarding | **Immersive Airloop onboarding** | 3 questions max, <2 min, Airloop splash |

### What Survives Intact

- `packages/core/*` — the sovereign engine (80/20 rule: engine is never overridden)
- `packages/types/*` — type system (extended, not replaced)
- `packages/tests/*` — scenario harness (extended)
- `apps/mobile/lib/storage.ts` — persistence layer (extended)
- `apps/mobile/lib/calendar.ts` — calendar integration
- `apps/mobile/lib/use-day-plan.ts` — data hook (refactored)
- `ReadinessIndicator` — stays on Home tab
- `TimelineView` — moves to Calendar tab
- `CRPCard` — stays on Home tab
- `PostEventSheet` — stays, gets event-type selector
- Core scheduling logic: cycles, readiness, conflicts, actions

---

## 2. Five-Layer Architecture

### Layer 1: Engine (packages/core) — SOVEREIGN

The R90 calculation engine. Pure TypeScript, zero dependencies, fully deterministic.
**AI never overrides this layer.** All outputs are authoritative.

| Module | Current | V1 Changes |
|--------|---------|------------|
| `cycles.ts` | ✅ Complete | None |
| `readiness.ts` | ✅ Complete | None |
| `conflicts.ts` | ✅ Complete | None |
| `actions.ts` | ✅ Complete | Minor: add action types for chat prompts |
| `planner.ts` | ✅ Complete | Extend: accept conflict resolution choice |
| `rlo.ts` | Rename | → `airloop-messages.ts`: same logic, new persona |
| `rules.ts` | ✅ Complete | None |
| `time-utils.ts` | ✅ Complete | None |
| NEW: `premium-gates.ts` | — | Event-trigger logic for premium features |

**Key principle:** Airloop reads engine output. Airloop never writes engine input.

### Layer 2: Intelligence (AI interpretation layer) — V1.5/V2

The AI sits between the engine and the user. It interprets engine outputs into natural language. It does NOT compute sleep schedules.

| Module | Version | Description |
|--------|---------|-------------|
| `airloop-interpreter.ts` | V1 | Template-based message generation (current rlo.ts, renamed) |
| `telemetry.ts` | V1.5 | Local event buffer for pattern detection |
| `pattern-detector.ts` | V2 | On-device heuristics (consecutive short nights, weekend patterns) |
| `llm-bridge.ts` | V2+ | Optional cloud AI for conversational depth |

**V1 intelligence = deterministic templates.** No ML, no cloud calls. The "AI" is the message selection logic already in `rlo.ts`, rebranded as Airloop interpretation.

### Layer 3: Experience (UI/UX layer)

The user-facing experience. Minimalistic, cognitively light.

| Component | Tab | Version | Description |
|-----------|-----|---------|-------------|
| **Home tab** | Home | V1 | Readiness zone, next action, Airloop message, CRP card |
| **Calendar tab** | Calendar | V1 | Timeline blocks, conflict cards with Airloop explanations |
| **Profile tab** | Profile | V1 | Cycles/week chart, history, settings, integrations |
| **Airloop Presence** | All | V1 | Subtle bottom-of-screen presence, animates on interaction |
| **Airloop Chat** | Global | V1 | Slide-up chat panel, pre-built prompts, engine-backed responses |
| **Onboarding** | — | V1 | Airloop splash → 3 questions → Home |
| **PostEventSheet** | Home | V1 | Late event protocol with event-type selector |

### Layer 4: Integration

| Integration | Version | Description |
|-------------|---------|-------------|
| expo-calendar | ✅ V1 | Already working |
| Apple Health / HealthKit | V2 | Sleep data import, step count |
| Health Connect (Android) | V2 | Android equivalent |
| Whoop API | V2+ | Recovery score import |
| Push notifications (local) | V1.5 | expo-notifications, anchor/CRP/bedtime reminders |

### Layer 5: Premium Architecture

**Principle:** Premium is event-triggered, not installation-based. The user hits the paywall naturally, at the moment the app proves its value.

| Trigger Event | What Unlocks | Implementation |
|---------------|-------------|----------------|
| Day 3 of usage | Advanced weekly insights in Profile tab | Storage: track `firstOpenDate` |
| First major conflict detected | Conflict resolution options (Option A / Option B) | Gate in `ConflictSheet` → upgrade prompt |
| Manual recalculation request | "Recalculate my plan" in chat | Gate in Airloop Chat handler |
| Post-event protocol (2nd use) | Full late-event analysis | Gate in `PostEventSheet` |

**V1 implementation:** All premium features are built and functional. A `PremiumGate` component wraps premium-only UI. The gate checks trigger conditions and shows an upgrade prompt. No payment integration in V1 — just the gate logic and a "Coming soon" message.

---

## 3. V1 / V1.5 / V2 Separation

### V1 — Core Experience (Weeks 1-10)

Everything needed for a private beta that demonstrates the full product concept.

**Engine:**
- [x] Cycle calculation, readiness, conflicts, actions (already done)
- [ ] Rename rlo → airloop-messages, update persona
- [ ] `premium-gates.ts` — trigger condition evaluation
- [ ] Conflict resolution: wire `generateConflictOptions()` to UI

**Experience:**
- [ ] 3-tab navigation (Home / Calendar / Profile)
- [ ] Home tab: readiness, next action, Airloop message, CRP card
- [ ] Calendar tab: timeline blocks, conflict cards with resolution picker
- [ ] Profile tab: weekly cycles chart, night history, settings
- [ ] Airloop Chat: slide-up panel with pre-built prompts
- [ ] Airloop Presence: subtle animation at bottom of screen
- [ ] Redesigned onboarding: Airloop splash + 3 questions
- [ ] PostEventSheet: event-type selector (Physical / Mental / Social)
- [ ] Premium gates: trigger detection + upgrade prompt UI

**Integration:**
- [x] Calendar integration (already done)
- [ ] TestFlight deployment

### V1.5 — Intelligence + Notifications (Post-beta, ~4 weeks)

**Intelligence:**
- Telemetry event buffer (local, 30-day)
- 10 instrumented events (app_open, night_logged, crp_completed, etc.)
- Basic pattern detection (consecutive short nights, weekend recovery)

**Experience:**
- Push notifications (local): anchor, CRP, pre-sleep reminders
- Notification settings in Profile tab
- Night log improvements: actual wake time, actual bedtime fields

**Premium:**
- Payment integration (RevenueCat or similar)
- Restore purchases flow

### V2 — Wearable Intelligence + Travel (Future)

**Intelligence:**
- On-device pattern detector with 14-day sliding window
- Optional cloud AI bridge for conversational depth
- Personalized CRP timing based on usage patterns

**Integration:**
- Apple Health / HealthKit import
- Health Connect (Android)
- Whoop API integration

**Experience:**
- Travel Mode (pre-departure shifting, light exposure recommendations)
- Recovery Room Audit (7-step guided questionnaire)
- Badge system (Beginner → Legend progression) — if validated as non-childish
- Data export (JSON via Share sheet)

---

## 4. Dependency Graph

```
WEEK 1: TestFlight + Device Testing
   │
   ├── WEEK 2: 3-Tab Navigation + Airloop Rename
   │      │
   │      ├── WEEK 3: Home Tab (readiness, action, CRP, Airloop message)
   │      │      │
   │      │      └── WEEK 5: Airloop Chat (global slide-up panel)
   │      │             │
   │      │             └── WEEK 7: Premium Gates
   │      │
   │      ├── WEEK 4: Calendar Tab (timeline, conflicts, resolution)
   │      │
   │      └── WEEK 6: Profile Tab (weekly chart, history, settings)
   │
   │
   WEEK 8: Onboarding Redesign + PostEvent Improvements
      │
      WEEK 9: Beta Testing + Bug Fixes
         │
         WEEK 10: V1 RC + Documentation
```

**Parallel tracks (Weeks 3-4):** Home tab and Calendar tab can be built simultaneously since they share no components. Profile tab (Week 6) depends on settings patterns established in the navigation refactor.

**Critical path:** Week 2 (navigation) → Week 5 (chat) → Week 7 (premium gates). The chat architecture must be solid before premium gates can wrap it.

---

## 5. Ten-Week Development Plan

### Week 1 — TestFlight + Device Testing

**Objective:** Get current MVP on real devices. Validate before restructuring.

| Deliverable | Acceptance Criteria | Effort |
|-------------|-------------------|--------|
| Execute full-day test (06:30 default profile) | All TESTING_PROTOCOL.md checks pass | 4h |
| Execute full-day test (08:00 PMer profile) | Midnight-crossing correct, no crashes | 4h |
| Fix bugs found during testing | Zero crash bugs | 2-4h |
| Create `eas.json` with preview profile | EAS Build succeeds | 1h |
| Configure `app.json` (v0.1.0, icons, splash) | App icon visible on device | 1h |
| EAS Build + TestFlight submission | App installable via TestFlight | 2h |

**Files:** `eas.json` (new), `app.json`, `docs/RELEASE_NOTES_v0.1.md` (new)
**Risk:** Apple Developer provisioning (1-2h if first time)
**Blocker:** None

---

### Week 2 — 3-Tab Navigation + Airloop Rename

**Objective:** Restructure from single screen to 3-tab layout. Rename R-Lo → Airloop everywhere.

| Deliverable | Acceptance Criteria | Effort |
|-------------|-------------------|--------|
| Expo Router tab layout (`app/(tabs)/_layout.tsx`) | Bottom tabs: Home / Calendar / Profile | 4h |
| Move home screen content to `app/(tabs)/index.tsx` | Existing functionality preserved | 2h |
| Create `app/(tabs)/calendar.tsx` (placeholder) | Tab navigable, shows "Calendar" | 1h |
| Create `app/(tabs)/profile.tsx` (placeholder) | Tab navigable, shows "Profile" | 1h |
| Rename `rlo.ts` → `airloop-messages.ts` in `packages/core` | All imports updated, tests pass | 2h |
| Update `RLoCard.tsx` → `AirloopCard.tsx` | "R-Lo" → "Airloop" in UI text | 1h |
| Update types: `RLoMessage` → `AirloopMessage`, `RLoMoment` → `AirloopMoment` | All references updated | 2h |
| Airloop persona adjustment in messages | Remove any mascot-like language, ensure calm expert tone | 2h |

**Files:**
- `app/(tabs)/_layout.tsx` (new) — tab navigator with dark theme
- `app/(tabs)/index.tsx` (new) — home tab (moved from `app/index.tsx`)
- `app/(tabs)/calendar.tsx` (new) — placeholder
- `app/(tabs)/profile.tsx` (new) — placeholder
- `app/_layout.tsx` — updated: wrap tabs, keep onboarding redirect
- `packages/core/src/airloop-messages.ts` (renamed from `rlo.ts`)
- `packages/core/src/index.ts` — update exports
- `packages/types/src/index.ts` — rename types
- `components/AirloopCard.tsx` (renamed from `RLoCard.tsx`)

**Risk:** Expo Router tab layout may need `expo-router` v4 patterns. Already on v6.
**Blocker:** None

---

### Week 3 — Home Tab Build-Out

**Objective:** Complete the Home tab with all V1 components in the new layout.

| Deliverable | Acceptance Criteria | Effort |
|-------------|-------------------|--------|
| Home tab layout: readiness → Airloop message → next action → CRP | Vertical scroll, dark theme, proper spacing | 4h |
| Airloop Presence component (bottom of screen) | Subtle animated dot/wave, static by default, pulses on new message | 4h |
| "Late Event?" button opens PostEventSheet | Same behavior as current | 1h |
| "Log Last Night" navigates to log-night screen | Same behavior as current | 1h |
| Day plan auto-refresh on app foreground | `AppState` listener triggers `useDayPlan` re-run | 2h |
| Remove timeline from Home (moved to Calendar) | Home is clean: zone + message + action + CRP only | 1h |

**Files:**
- `app/(tabs)/index.tsx` — restructured Home layout
- `components/AirloopPresence.tsx` (new) — subtle bottom presence
- `lib/use-day-plan.ts` — add `refreshPlan()`, `AppState` listener

**Risk:** AirloopPresence animation performance on low-end devices
**Blocker:** Week 2 (tab navigation must exist)

---

### Week 4 — Calendar Tab + Conflict Resolution

**Objective:** Build the Calendar tab with timeline and actionable conflict resolution.

| Deliverable | Acceptance Criteria | Effort |
|-------------|-------------------|--------|
| Calendar tab: full-day timeline view | TimelineView component, all blocks rendered | 3h |
| Conflict cards inline with timeline | Each conflict shows event name, overlap type, Airloop explanation | 4h |
| Conflict resolution picker (Option A / Option B) | `generateConflictOptions()` wired to UI, user taps one, plan updates | 5h |
| Wire conflict choice back to day plan | Selecting option recalculates timeline immediately | 3h |

**Files:**
- `app/(tabs)/calendar.tsx` — full Calendar tab
- `components/ConflictCard.tsx` (new) — inline conflict with resolution options
- `components/TimelineView.tsx` — adapted for Calendar tab context
- `lib/use-day-plan.ts` — expose `applyConflictOption()`
- `packages/core/src/conflicts.ts` — verify option generation edge cases

**Risk:** Multi-conflict scenarios (two conflicts same evening) need UI for sequential resolution
**Blocker:** Week 2 (tab navigation). Partially parallel with Week 3.

---

### Week 5 — Airloop Chat

**Objective:** Build the global chat interface. Chat = interface, Engine = logic, Airloop = interpretation.

| Deliverable | Acceptance Criteria | Effort |
|-------------|-------------------|--------|
| Chat slide-up panel (accessible from all tabs) | FAB button on all tabs, slides up modal chat | 4h |
| Pre-built prompt buttons | "How's my week?", "Explain my plan", "What if I sleep late?", "Recalculate" | 3h |
| Engine-backed responses | Each prompt triggers engine functions, Airloop formats the response | 5h |
| Chat history (session-only, not persisted) | Messages scroll, user prompts + Airloop responses | 2h |
| "Recalculate" prompt rebuilds day plan | Calls `buildDayPlan()` with current time, updates all tabs | 2h |

**Architecture:**
```
User taps prompt → ChatHandler maps to engine call → Engine returns data →
AirloopInterpreter formats response → Chat displays message
```

**Files:**
- `components/AirloopChat.tsx` (new) — slide-up chat panel
- `components/ChatBubble.tsx` (new) — message bubble component
- `lib/airloop-chat-handler.ts` (new) — maps prompts to engine calls
- `lib/airloop-interpreter.ts` (new) — formats engine output as Airloop messages
- `app/(tabs)/_layout.tsx` — add chat FAB overlay

**Risk:** Chat must not re-trigger calendar permission requests. Use cached day plan.
**Blocker:** Week 2 (navigation). Week 3 (Airloop persona must be established).

---

### Week 6 — Profile Tab + Settings

**Objective:** Build Profile tab with weekly overview, history, and settings.

| Deliverable | Acceptance Criteria | Effort |
|-------------|-------------------|--------|
| Weekly cycles display | Current week: X/35 cycles, 7-day mini chart | 4h |
| Night history list | Last 7 nights: date, cycles, anchor deviation | 3h |
| Settings section | Edit anchor time, chronotype; app version | 3h |
| Reset data option | "Delete all my data" with confirmation dialog | 2h |
| CRP history display | Recent CRP completions with dates | 2h |

**Files:**
- `app/(tabs)/profile.tsx` — full Profile tab
- `components/WeeklyCycleChart.tsx` (new) — mini bar chart for 7 days
- `components/NightHistoryList.tsx` (new) — scrollable night records
- `lib/storage.ts` — add `exportAllData()` helper (for future use)

**Risk:** Weekly chart needs careful design for variable cycle counts (0-6 range)
**Blocker:** Week 2 (tab navigation)

---

### Week 7 — Premium Gates + PostEvent Improvements

**Objective:** Implement event-triggered premium architecture and improve late event protocol.

| Deliverable | Acceptance Criteria | Effort |
|-------------|-------------------|--------|
| `PremiumGate` component | Wraps premium UI, checks trigger conditions, shows upgrade prompt | 4h |
| `premium-gates.ts` in `packages/core` | `evaluatePremiumTrigger(usage)` → `{ triggered, reason }` | 3h |
| Premium usage tracking in storage | `@r90:usage:v1`: firstOpenDate, conflictCount, recalcCount, postEventCount | 2h |
| Gate: conflict resolution (after 1st free use) | 2nd conflict resolution shows premium prompt | 2h |
| Gate: "Recalculate" in chat (after 1st free use) | 2nd recalculation shows premium prompt | 1h |
| PostEventSheet: event-type selector | Physical / Mental / Social picker before time entry | 2h |
| PostEventSheet: wire confirmation to day plan | Tapping "Update Sleep Plan" recalculates and updates Home + Calendar | 2h |

**Files:**
- `components/PremiumGate.tsx` (new) — wrapper with upgrade prompt
- `packages/core/src/premium-gates.ts` (new) — trigger evaluation logic
- `lib/storage.ts` — add usage tracking keys
- `lib/use-premium.ts` (new) — hook for premium state
- `components/PostEventSheet.tsx` — event-type selector, plan update

**Risk:** Premium gate UX must not feel punitive. "Unlock advanced features" not "pay to continue."
**Blocker:** Week 5 (chat must exist for recalculate gate)

---

### Week 8 — Onboarding Redesign + Polish

**Objective:** Immersive Airloop-first onboarding. UI polish pass.

| Deliverable | Acceptance Criteria | Effort |
|-------------|-------------------|--------|
| Airloop splash screen (2-3 seconds) | Airloop icon/animation + "Your recovery companion" | 3h |
| Redesigned onboarding flow | 3 screens max: wake time → chronotype → "Let's go" | 4h |
| Onboarding Airloop messages | Airloop "speaks" during onboarding: "When do you usually wake up?" | 2h |
| UI polish: loading states | Skeleton screens for async operations | 3h |
| UI polish: empty states | First launch prompts (no night data, no calendar) | 2h |
| Haptic feedback | Light haptic on CRP completion, conflict resolution, chat send | 1h |

**Files:**
- `app/onboarding.tsx` — redesigned flow
- `components/AirloopSplash.tsx` (new) — animated splash
- `components/OnboardingStep.tsx` (new) — reusable step with Airloop message
- `components/SkeletonLoader.tsx` (new) — loading placeholders

**Risk:** Airloop animation complexity. Keep it simple: opacity fade + subtle scale.
**Blocker:** None (onboarding is independent)

---

### Week 9 — Beta Testing + Bug Fixes

**Objective:** TestFlight v0.2.0 with full V1 feature set. Collect feedback, fix bugs.

| Deliverable | Acceptance Criteria | Effort |
|-------------|-------------------|--------|
| TestFlight build v0.2.0 | All Weeks 2-8 features included | 2h |
| Invite 5-10 beta testers | TestFlight invites sent | 1h |
| Feedback collection system | GitHub Issues or shared form | 1h |
| Bug triage + P0/P1 fixes | All critical bugs fixed | 8-12h |
| Performance profiling | Cold start < 2s, plan build < 100ms | 3h |
| Extend scenario suite | 20+ scenarios covering new features | 2h |

**Files:** Various (bug fixes)
**Risk:** Tab navigation performance, chat panel memory usage
**Blocker:** All Weeks 2-8 features complete

---

### Week 10 — V1 RC + Documentation

**Objective:** Ship V1 Release Candidate. Complete documentation.

| Deliverable | Acceptance Criteria | Effort |
|-------------|-------------------|--------|
| V1 RC build (v1.0.0-rc.1) | All features working, all tests pass | 2h |
| TestFlight submission | RC installable | 1h |
| `docs/RELEASE_NOTES_v1.0.md` | Features, limitations, premium status | 2h |
| Update README.md | V1 architecture, getting started | 1h |
| Update ARCHITECTURE_STATE.md | Reflects 3-tab, Airloop, premium | 1h |
| V1.5 planning document | Priorities: notifications, telemetry, payment | 2h |
| Nick validation preparation | TODO_NICK items list for confirmation call | 1h |

**Files:** Various docs
**Risk:** Low — documentation and packaging
**Blocker:** Week 9 bugs resolved

---

## 6. Architectural Risks

### Risk 1: Airloop Chat Scope Creep (HIGH)

**Risk:** The chat module could expand into a general-purpose chatbot, violating engine sovereignty.
**Mitigation:** V1 chat is ONLY pre-built prompts. No free-text input. Every prompt maps to exactly one engine function call. The `ChatHandler` is a finite switch statement, not an AI router.
**Escalation:** If users request free-text, defer to V2 with LLM bridge. Never let AI override engine output.

### Risk 2: Premium Gate Friction (HIGH)

**Risk:** Event-triggered premium may frustrate users at the worst moment (during a conflict they need resolved).
**Mitigation:** First use of every premium feature is always free. Gate only activates on 2nd+ use. Upgrade prompt is dismissible with a "Remind me later" option. Core functionality (readiness, next action, Airloop messages) is NEVER gated.
**Validation:** A/B test gate timing with beta testers in Week 9.

### Risk 3: Tab Navigation Performance (MEDIUM)

**Risk:** Three tabs each with their own data requirements may cause slow tab switches or redundant re-renders.
**Mitigation:** Single `useDayPlan()` hook at tab layout level, passed down via React Context. All tabs read from the same DayPlan. No tab fetches its own data independently.
**Fallback:** If context causes re-render storms, switch to Zustand or a lightweight store.

### Risk 4: Airloop Persona Consistency (MEDIUM)

**Risk:** Renaming R-Lo to Airloop and adjusting personality may introduce tone inconsistencies across the ~20 message templates.
**Mitigation:** Create an `AIRLOOP_STYLE_GUIDE.md` before Week 2. All messages reviewed against it. Key rules: no emojis in messages (UI-only), no exclamation marks, no mascot language ("I'm proud of you"), always actionable.
**Validation:** Nick review of all Airloop messages before beta.

### Risk 5: Calendar Permission on Tab Switch (LOW)

**Risk:** Calendar tab might re-trigger permission requests on every switch.
**Mitigation:** Calendar data is fetched once on app load (already implemented with `useRef` guard in `useDayPlan`). Calendar tab reads cached data, never triggers its own fetch.

### Risk 6: Expo Router Tab Layout Complexity (LOW)

**Risk:** Moving from simple Stack to Tab layout may require restructuring file-based routing.
**Mitigation:** Expo Router v6 has well-documented tab patterns. The `app/(tabs)/` directory convention is standard. Onboarding stays outside the tab group.

### Risk 7: TODO_NICK Validation Backlog (MEDIUM)

**Risk:** 18 of 32 rules are still marked `TODO_NICK`. Shipping V1 without Nick validation means some thresholds may be wrong.
**Mitigation:** All TODO_NICK rules have reasonable defaults from the R90 book. UI shows "experimental" label on readiness. Prepare a focused validation call for Week 10 with a prioritized list of the 8 most impactful rules.

---

## 7. Architecture Decision Records

### ADR-001: Airloop Chat is Template-Based in V1

**Context:** The vision describes a global chat module. Building a real conversational AI requires LLM integration, prompt engineering, safety guardrails, and cloud infrastructure.
**Decision:** V1 chat uses pre-built prompts only. Each prompt maps to exactly one engine function. No free-text input. No LLM calls.
**Consequence:** Chat feels guided rather than conversational. This is acceptable for V1 because it maintains engine sovereignty and avoids the complexity/cost of LLM integration.

### ADR-002: Premium Gates are Client-Side in V1

**Context:** Event-triggered premium needs to track usage (days, conflict count, recalculation count).
**Decision:** All premium state is stored in AsyncStorage. No server. No payment processing. V1 gates show "Coming soon" on upgrade prompt.
**Consequence:** No revenue in V1. But the architecture is in place: `PremiumGate` component, `evaluatePremiumTrigger()` function, usage tracking storage. Payment integration is a V1.5 drop-in.

### ADR-003: Single DayPlan Context for All Tabs

**Context:** Three tabs need access to the same day plan data.
**Decision:** `useDayPlan()` runs at the tab layout level. A `DayPlanContext` provides the plan to all tabs. No tab fetches independently.
**Consequence:** Tab switches are instant (no loading). Plan updates (from conflict resolution or post-event) propagate to all tabs via context.

### ADR-004: Streaks and Badges Deferred to V2

**Context:** Previous roadmap had streaks in Week 3. New vision explicitly rejects "gamification enfantine."
**Decision:** No streak tracking, no badge system in V1. Weekly cycles chart in Profile tab provides progress visibility without gamification.
**Consequence:** Simplifies V1 scope significantly. If Nick later validates a non-childish badge system, it can be added in V2.

---

## 8. File Impact Map

### New Files (V1)

| File | Week | Purpose |
|------|------|---------|
| `app/(tabs)/_layout.tsx` | 2 | Tab navigator |
| `app/(tabs)/index.tsx` | 2-3 | Home tab |
| `app/(tabs)/calendar.tsx` | 2,4 | Calendar tab |
| `app/(tabs)/profile.tsx` | 2,6 | Profile tab |
| `packages/core/src/airloop-messages.ts` | 2 | Renamed from rlo.ts |
| `packages/core/src/premium-gates.ts` | 7 | Premium trigger logic |
| `components/AirloopCard.tsx` | 2 | Renamed from RLoCard.tsx |
| `components/AirloopPresence.tsx` | 3 | Subtle bottom animation |
| `components/AirloopChat.tsx` | 5 | Slide-up chat panel |
| `components/ChatBubble.tsx` | 5 | Chat message bubble |
| `components/ConflictCard.tsx` | 4 | Inline conflict with options |
| `components/WeeklyCycleChart.tsx` | 6 | Mini bar chart |
| `components/NightHistoryList.tsx` | 6 | Night record list |
| `components/PremiumGate.tsx` | 7 | Premium wrapper |
| `components/AirloopSplash.tsx` | 8 | Onboarding splash |
| `components/OnboardingStep.tsx` | 8 | Onboarding step |
| `components/SkeletonLoader.tsx` | 8 | Loading placeholder |
| `lib/airloop-chat-handler.ts` | 5 | Maps prompts to engine |
| `lib/airloop-interpreter.ts` | 5 | Formats engine output |
| `lib/use-premium.ts` | 7 | Premium state hook |
| `docs/AIRLOOP_STYLE_GUIDE.md` | 2 | Persona guidelines |

### Modified Files (V1)

| File | Weeks | Changes |
|------|-------|---------|
| `app/_layout.tsx` | 2 | Wrap tabs, keep onboarding redirect |
| `app/onboarding.tsx` | 8 | Redesigned flow with Airloop |
| `packages/core/src/index.ts` | 2 | Update exports (rlo → airloop) |
| `packages/types/src/index.ts` | 2,7 | Rename RLo types, add premium types |
| `packages/tests/src/scenarios.ts` | 9 | Extend to 20+ scenarios |
| `lib/use-day-plan.ts` | 3,4 | Add refresh, conflict resolution, context provider |
| `lib/storage.ts` | 7 | Add usage tracking keys |
| `components/TimelineView.tsx` | 4 | Adapted for Calendar tab |
| `components/PostEventSheet.tsx` | 7 | Event-type selector, plan update |
| `components/CRPCard.tsx` | 3 | Adapted for Home tab layout |
| `components/ConflictSheet.tsx` | 4 | Replaced by ConflictCard (may be removed) |

### Deleted Files (V1)

| File | Week | Reason |
|------|------|--------|
| `app/index.tsx` | 2 | Replaced by `app/(tabs)/index.tsx` |
| `components/RLoCard.tsx` | 2 | Renamed to AirloopCard.tsx |
| `packages/core/src/rlo.ts` | 2 | Renamed to airloop-messages.ts |

---

## 9. Success Metrics (V1 Exit Criteria)

1. **Architecture:** 3-tab navigation with shared DayPlan context
2. **Airloop:** All messages pass persona audit (calm, expert, no mascot language)
3. **Chat:** Pre-built prompts work end-to-end (engine call → formatted response)
4. **Premium:** Gate triggers fire correctly on 2nd use of premium features
5. **Reliability:** Zero crash bugs in 7 days of beta testing
6. **Tests:** 20+ automated scenarios passing
7. **Performance:** Cold start < 2s, tab switch < 100ms, plan build < 100ms
8. **Coverage:** Tested on 3 profile types (default, AMer, PMer)
9. **Engine sovereignty:** No UI path can override engine calculations
