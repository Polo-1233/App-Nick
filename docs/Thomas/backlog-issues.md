# V1 Backlog — GitHub Issues

**Version:** 1.0
**Date:** 2026-02-17
**Convention:** Estimates: S = 1-2h, M = 3-5h, L = 6-10h. Risk: Low/Med/High.

---

## Epic 1: TestFlight Deployment (Phase F)

### Issue #1: Create EAS Build configuration
**Description:** Create `eas.json` with `preview` and `production` profiles for iOS builds. Configure `app.json` with correct `bundleIdentifier`, version `0.1.0`, and build number.
**Acceptance Criteria:**
- `npx eas build --profile preview --platform ios` succeeds
- `eas.json` exists with preview + production profiles
- `app.json` has `ios.buildNumber: "1"`
**Estimate:** S | **Risk:** Low

### Issue #2: Configure app icon and splash screen
**Description:** Add app icon (1024×1024) and splash screen to `assets/`. Update `app.json` with `icon`, `splash`, and `adaptiveIcon` fields. Dark theme (#0A0A0A background).
**Acceptance Criteria:**
- App icon visible on device home screen
- Splash screen shows during cold start
- No white flash on launch (dark background)
**Estimate:** M | **Risk:** Low

### Issue #3: Submit first build to TestFlight
**Description:** Run EAS Build, wait for completion, submit to TestFlight via `eas submit --platform ios`. Invite Nick as first tester.
**Acceptance Criteria:**
- App installable via TestFlight link
- At least 1 external tester invited and confirmed install
**Estimate:** S | **Risk:** Med (Apple review may flag calendar permission)

### Issue #4: Write release notes v0.1.0
**Description:** Create `docs/RELEASE_NOTES_v0.1.md` documenting: features included, known limitations, TODO_NICK items requiring feedback, instructions for testers.
**Acceptance Criteria:**
- Document exists with all sections
- Known limitations list matches ARCHITECTURE_STATE.md tech debt section
**Estimate:** S | **Risk:** Low

---

## Epic 2: Conflict Resolution

### Issue #5: Wire `generateConflictOptions()` into ConflictSheet
**Description:** Currently `ConflictSheet.tsx` shows conflict info but no resolution options. Call `generateConflictOptions()` from `@r90/core` for each conflict and display 2 option cards (A and B) with labels and descriptions.
**Acceptance Criteria:**
- Each conflict card shows 2 tappable options
- Option labels come from `ConflictOption.label`
- Option descriptions come from `ConflictOption.description`
**Estimate:** M | **Risk:** Med (edge cases in option generation)

### Issue #6: Apply conflict resolution to day plan
**Description:** When user selects a conflict option, apply `ConflictOption.adjustedPlan` (a `CycleWindow`) to the current day plan. Update timeline, R-Lo message, and next action.
**Files:** `lib/use-day-plan.ts` — add `applyConflictOption(option: ConflictOption)` method.
**Acceptance Criteria:**
- Selecting Option A recalculates timeline with adjusted CycleWindow
- Selecting Option B recalculates timeline with that option's CycleWindow
- R-Lo message reflects the adjustment ("Adjusted for tonight. {cycleCount} cycles.")
- Timeline visually updates immediately
**Estimate:** M | **Risk:** Med

### Issue #7: Handle multi-conflict scenarios
**Description:** When multiple conflicts exist (e.g., dinner + late meeting), ConflictSheet should let user resolve them one at a time. After resolving conflict 1, re-run detection against adjusted plan to see if conflict 2 is still present.
**Acceptance Criteria:**
- Conflicts displayed in severity order (major first)
- After resolving one, remaining conflicts re-evaluated
- If adjusted plan resolves all, sheet closes
**Estimate:** M | **Risk:** Med

---

## Epic 3: Day Plan Lifecycle

### Issue #8: Auto-refresh day plan on app foreground
**Description:** When app returns from background, re-run `buildDayPlan()` with current time. Use `AppState` listener in `useDayPlan()`. Respect `hasFetched` ref to avoid double-fetch — but DO refresh when returning from background.
**Files:** `lib/use-day-plan.ts`
**Acceptance Criteria:**
- `AppState` change to "active" triggers plan refresh
- `now` parameter updates to current time
- Stale "Next action" card updates without user interaction
- No duplicate fetches (ref guard still works for initial load)
**Estimate:** M | **Risk:** Low

### Issue #9: Post-event confirm updates live day plan
**Description:** When user taps "Update Sleep Plan" in PostEventSheet, the adjusted CycleWindow should replace the current plan's cycleWindow and re-render timeline.
**Files:** `components/PostEventSheet.tsx`, `lib/use-day-plan.ts`
**Acceptance Criteria:**
- Timeline shows new sleep blocks after post-event confirmation
- R-Lo message updates to post-event context
- New bedtime/wake time reflected in NextActionCard
**Estimate:** S | **Risk:** Low

### Issue #10: CRP completion increments weekly cycle count
**Description:** After `saveCRPRecord()`, add 1 to the weekly cycle total. Requires Nick confirmation on A03 (CRP accounting). Ship as 1-cycle increment, mark as experimental.
**Files:** `components/CRPCard.tsx`, `packages/core/src/readiness.ts`
**Acceptance Criteria:**
- Completing a CRP increases `readiness.weeklyTotal` by 1
- Readiness zone may change (e.g., yellow → green if crossing threshold)
- Feature flagged with `zoneStatus: "experimental"` until Nick confirms
**Estimate:** S | **Risk:** Med (pending Nick validation)

---

## Epic 4: Settings & Profile Management

### Issue #11: Create settings screen
**Description:** New route `app/settings.tsx` with: anchor time editor (reuse DateTimePicker from onboarding), chronotype selector, app version display.
**Acceptance Criteria:**
- User can change anchor time and chronotype
- Changes saved to AsyncStorage via `saveProfile()`
- Day plan refreshes after profile change
- Current values pre-populated from stored profile
**Estimate:** M | **Risk:** Low

### Issue #12: Add navigation to settings
**Description:** Add a gear icon or "Settings" button to the home screen header. Route to `/settings`. Consider adding a simple tab bar (Home, Weekly, Settings) or keeping it as a stack push.
**Files:** `app/index.tsx`, `app/_layout.tsx`
**Acceptance Criteria:**
- Settings reachable from home screen in ≤1 tap
- Back navigation returns to home
**Estimate:** S | **Risk:** Low

### Issue #13: Reset data / clear storage
**Description:** Add "Reset All Data" button in settings with a confirmation dialog ("This will delete your profile, history, and all records. Are you sure?"). Calls `clearAllStorage()` then navigates to onboarding.
**Files:** `app/settings.tsx`, `lib/storage.ts`
**Acceptance Criteria:**
- Confirmation dialog prevents accidental deletion
- After reset, app redirects to onboarding
- All AsyncStorage keys cleared
**Estimate:** S | **Risk:** Low

### Issue #14: Data export as JSON
**Description:** Add "Export My Data" button in settings. Collects profile, weekHistory, CRPRecords, telemetry (if any) into a single JSON object. Opens native Share sheet via `expo-sharing`.
**Files:** `app/settings.tsx`, `lib/storage.ts` (add `exportAllData()`)
**Acceptance Criteria:**
- Tapping "Export" generates JSON and opens Share sheet
- JSON includes all user data with human-readable structure
- Works on iOS (Share sheet) and Android (Share intent)
**Estimate:** M | **Risk:** Low

---

## Epic 5: Streaks

### Issue #15: Define StreakState type
**Description:** Add `StreakState` interface to `packages/types/src/index.ts`:
```typescript
interface StreakState {
  anchorStreak: number;
  idealNightStreak: number;
  crpStreak: number;
  longestAnchorStreak: number;
}
```
**Estimate:** S | **Risk:** Low

### Issue #16: Implement streak calculation engine
**Description:** Create `packages/core/src/streaks.ts` with `calculateStreaks(weekHistory, crpRecords, profile) → StreakState`. Anchor streak: consecutive days with `|actualWakeTime - anchorTime| ≤ 30`. Ideal night: consecutive nights with `cyclesCompleted >= idealCyclesPerNight`. CRP streak: consecutive yellow/orange days with a CRP record.
**Acceptance Criteria:**
- Anchor streak breaks when deviation > 30 min
- Ideal night streak breaks when cycles < target
- CRP streak only counts days where CRP was needed (yellow/orange zone)
- Edge case: first day → streak of 0 (not 1)
**Estimate:** M | **Risk:** Med (edge cases in streak reset logic)

### Issue #17: Persist streaks in AsyncStorage
**Description:** Add `@r90:streaks:v1` storage key. Recalculate and save after each night log and CRP completion.
**Files:** `lib/storage.ts`
**Acceptance Criteria:**
- Streaks persist across app restarts
- Recalculated (not just incremented) to prevent drift
**Estimate:** S | **Risk:** Low

### Issue #18: Display streaks on home screen
**Description:** Create `components/StreakBadge.tsx` — a small inline badge showing current streaks. Display below readiness indicator. Show most relevant streak (longest active one) with fire emoji: "🔥 7-day anchor streak".
**Acceptance Criteria:**
- Only shows if at least one streak ≥ 2 days
- Tapping opens a detail view or tooltip with all 3 streaks
- Doesn't clutter the home screen when no active streaks
**Estimate:** M | **Risk:** Low

### Issue #19: Add streak scenarios to test suite
**Description:** Add scenarios S21-S23 to `packages/tests/src/scenarios.ts` covering: anchor streak calculation, streak reset on miss, CRP streak with mixed zones.
**Estimate:** S | **Risk:** Low

---

## Epic 6: Weekly View

### Issue #20: Create weekly view screen
**Description:** New route `app/weekly.tsx` with a 7-day grid showing: cycle count per night (bar or number), zone color per day, weekly total (X/35), CRP days marked. Uses `loadWeekHistory()` and `loadCRPRecords()`.
**Acceptance Criteria:**
- Shows last 7 days (Mon-Sun or rolling)
- Each day shows cycle count and zone color
- Total shows as "X/35 cycles this week"
- Days with CRP show a small CRP indicator
- Empty days (no log) show a dash
**Estimate:** L | **Risk:** Low

### Issue #21: Create WeeklyGrid component
**Description:** `components/WeeklyGrid.tsx` — a 7-column grid. Each column is a day with: day label (Mon, Tue…), cycle count bar (height proportional to cycles, 0-6 range), zone color fill, CRP dot if applicable.
**Acceptance Criteria:**
- Responsive layout (works on iPhone SE and iPhone 15 Pro Max)
- Bar height scales with cycle count
- Zone colors: green #22C55E, yellow #EAB308, orange #F97316
- Accessible (adequate contrast, labels)
**Estimate:** M | **Risk:** Low

### Issue #22: Navigate to weekly view from home screen
**Description:** Make the readiness indicator (`ReadinessIndicator.tsx`) tappable. Tapping "28/35" navigates to `/weekly`.
**Files:** `components/ReadinessIndicator.tsx`, `app/index.tsx`
**Acceptance Criteria:**
- Tapping readiness indicator navigates to weekly view
- Visual affordance (subtle chevron or underline) indicates tappable
**Estimate:** S | **Risk:** Low

---

## Epic 7: Push Notifications (Local)

### Issue #23: Install and configure expo-notifications
**Description:** Add `expo-notifications` to `apps/mobile/package.json`. Configure in `app.json` plugins. Request permission on app launch (after onboarding). Handle denial gracefully.
**Acceptance Criteria:**
- Permission request appears after first day plan load
- If denied, app continues normally (no crash, no repeated prompts)
- iOS and Android permissions configured in app.json
**Estimate:** M | **Risk:** Med (iOS permission handling)

### Issue #24: Create notification scheduler module
**Description:** `apps/mobile/lib/notifications.ts` with: `scheduleAnchorReminder(anchorTime)`, `schedulePreSleepReminder(preSleepStart)`, `scheduleCRPReminder(zone)`, `cancelAll()`, `rescheduleAll(profile, dayPlan)`.
**Acceptance Criteria:**
- Notifications scheduled as local notifications (no server)
- Each notification has a unique identifier for cancellation
- `rescheduleAll()` cancels existing and re-creates from current plan
**Estimate:** M | **Risk:** Low

### Issue #25: Anchor time daily notification
**Description:** Schedule recurring daily notification at anchor time. Content: "Good morning. {zone} zone today." Badge count: 0.
**Acceptance Criteria:**
- Fires at anchor time every day
- Content includes current readiness zone
- Tapping notification opens app to home screen
**Estimate:** S | **Risk:** Low

### Issue #26: Pre-sleep reminder notification
**Description:** Schedule notification at `preSleepStart` time. Content: "Pre-sleep routine starts now. Dim lights, no screens."
**Acceptance Criteria:**
- Fires at preSleepStart (90 min before bedtime)
- Rescheduled when profile changes
**Estimate:** S | **Risk:** Low

### Issue #27: CRP reminder notification (zone-dependent)
**Description:** If zone is yellow or orange, schedule notification at 13:00: "CRP window is open. Even 30 minutes would help." Skip if zone is green.
**Acceptance Criteria:**
- Only fires when zone is yellow or orange
- Does not fire on green zone days
- Fires at 13:00 (midday CRP window)
**Estimate:** S | **Risk:** Low

### Issue #28: Notification toggle in settings
**Description:** Add toggles in `app/settings.tsx` for each notification type: anchor reminder, pre-sleep, CRP. Persisted in AsyncStorage. Default: all on.
**Acceptance Criteria:**
- Each toggle independently enables/disables its notification type
- Changes take effect immediately (cancel/reschedule)
- Settings persist across app restarts
**Estimate:** M | **Risk:** Low

---

## Epic 8: AI Data Contracts & Telemetry

### Issue #29: Define TelemetryEvent type
**Description:** Add `TelemetryEvent` and `TelemetryEventType` to `packages/types/src/index.ts` per `ai-architecture-spec.md` Section 2.1.
**Estimate:** S | **Risk:** Low

### Issue #30: Define NightRecordV2 type
**Description:** Extend `NightRecord` with V2 fields: `dayOfWeek`, `anchorDeviation`, `hadLateEvent`, `eventType`, `conflictCount`, `preCRPZone`, `postCRPZone`.
**Files:** `packages/types/src/index.ts`
**Estimate:** S | **Risk:** Low

### Issue #31: Define PersonalizationInput and PersonalizationOutput types
**Description:** Add ML model I/O contracts per `ai-architecture-spec.md` Section 2.3-2.4. These are type definitions only — no implementation.
**Estimate:** S | **Risk:** Low

### Issue #32: Create telemetry logger module
**Description:** `apps/mobile/lib/telemetry.ts` with: `logEvent(type, payload)`, `getEventBuffer()`, `trimBuffer(maxDays)`. Buffer stored in AsyncStorage under `@r90:telemetry:v1`. Auto-trim to 30 days on app open.
**Acceptance Criteria:**
- `logEvent()` appends to buffer with timestamp, sessionId, appVersion
- Buffer auto-trims entries older than 30 days
- `getEventBuffer()` returns all events for export
- No performance impact (async writes, no blocking)
**Estimate:** M | **Risk:** Low

### Issue #33: Instrument app_open event
**Description:** Log `app_open` telemetry event when home screen mounts (once per session). Include: `zone`, `weeklyTotal`, `streakCount`.
**Files:** `app/index.tsx`
**Estimate:** S | **Risk:** Low

### Issue #34: Instrument night_logged event
**Description:** Log `night_logged` when user saves a night record. Include: `cyclesCompleted`, `anchorDeviation`, `dayOfWeek`, `hadLateEvent`.
**Files:** `app/log-night.tsx`
**Estimate:** S | **Risk:** Low

### Issue #35: Instrument crp_completed and crp_skipped events
**Description:** Log `crp_completed` when CRP is marked done. Log `crp_skipped` when CRP card is dismissed without completion (requires adding a dismiss action to CRPCard).
**Files:** `components/CRPCard.tsx`
**Estimate:** S | **Risk:** Low

### Issue #36: Instrument conflict events
**Description:** Log `conflict_shown` when ConflictSheet opens, `conflict_acknowledged` when dismissed, `conflict_option_selected` when user picks an option (with option index).
**Files:** `components/ConflictSheet.tsx`
**Estimate:** S | **Risk:** Low

### Issue #37: Instrument post-event events
**Description:** Log `post_event_triggered` when PostEventSheet opens, `post_event_confirmed` when user confirms (with `eventEndMinutes`, `eventType`).
**Files:** `components/PostEventSheet.tsx`
**Estimate:** S | **Risk:** Low

### Issue #38: Extend night logging to capture V2 fields
**Description:** When saving a NightRecord, compute and store: `dayOfWeek` (from date), `anchorDeviation` (from actualWakeTime if provided), `conflictCount` (from today's plan).
**Files:** `app/log-night.tsx`, `lib/storage.ts`
**Estimate:** S | **Risk:** Low

---

## Epic 9: Post-Event Improvements

### Issue #39: Add event type selector to PostEventSheet
**Description:** Before the time picker, show 3 options: "Physical" (match, gym), "Mental" (work event, presentation), "Social" (dinner, party). Store as `eventType` field.
**Files:** `components/PostEventSheet.tsx`
**Acceptance Criteria:**
- 3 tappable option pills with icons
- Selected option stored with the post-event record
- Selection affects telemetry logging
**Estimate:** M | **Risk:** Low

### Issue #40: Next-day follow-up R-Lo message
**Description:** If the user triggered post-event protocol yesterday, morning R-Lo message should reference it: "Late night yesterday. How did you recover? Log last night."
**Files:** `packages/core/src/rlo.ts`
**Acceptance Criteria:**
- Requires a flag or telemetry check for "post-event used yesterday"
- Message only shows if no night record for yesterday exists
- Falls back to normal morning message if night already logged
**Estimate:** M | **Risk:** Low

---

## Epic 10: R-Lo Message Polish

### Issue #41: Add nighttime R-Lo moment
**Description:** Add `"nighttime"` to `RLoMoment` type. If app opened within 30 min of bedtime: "Anchor at {time}. See you tomorrow." If during pre-sleep window: "Pre-sleep time. Dim lights, no screens, decompress."
**Files:** `packages/types/src/index.ts`, `packages/core/src/rlo.ts`
**Estimate:** M | **Risk:** Low

### Issue #42: Weekend recovery message
**Description:** If green zone + weekend (Sat/Sun) + no calendar events: "No obligations today. Extra cycle if you want, or stick with your routine." Requires `dayOfWeek` in RuleContext.
**Files:** `packages/core/src/rlo.ts`, `packages/types/src/index.ts` (add `dayOfWeek` to `RuleContext`)
**Estimate:** S | **Risk:** Low

### Issue #43: Consecutive short nights warning
**Description:** If 3+ consecutive nights with cyclesCompleted < 4: "Tough stretch. Tonight matters more than usual. I've cleared the evening for you." Replace generic message only in orange zone.
**Files:** `packages/core/src/rlo.ts`
**Estimate:** S | **Risk:** Low

### Issue #44: Add 3 new test scenarios (S18-S20)
**Description:** S18: Post-event follow-up morning message. S19: Weekend recovery message (green zone + Saturday). S20: Consecutive short nights warning (3× < 4 cycles).
**Files:** `packages/tests/src/scenarios.ts`
**Estimate:** M | **Risk:** Low

---

## Epic 11: UI Polish & Reliability

### Issue #45: Loading skeleton for home screen
**Description:** Replace "Setting up your day..." text with a skeleton loader (animated placeholder matching timeline layout). Use `react-native-reanimated` or simple opacity animation.
**Files:** `app/index.tsx`, `components/SkeletonLoader.tsx` (new)
**Estimate:** M | **Risk:** Low

### Issue #46: Empty state for weekly view
**Description:** When `weekHistory` is empty (first week), show a friendly prompt: "Log your first night to start tracking your week." with a button linking to `/log-night`.
**Files:** `app/weekly.tsx`
**Estimate:** S | **Risk:** Low

### Issue #47: Empty state for home screen (no profile)
**Description:** If `needsOnboarding` is true but redirect hasn't fired yet, show a brief "Welcome" state instead of a loading spinner. Edge case: ensure no flash of home screen content before redirect.
**Files:** `app/index.tsx`
**Estimate:** S | **Risk:** Low

### Issue #48: Haptic feedback on key actions
**Description:** Add light haptic feedback (`expo-haptics`) on: CRP mark completed, streak milestone (new record), conflict option selected, onboarding confirm.
**Files:** Various components
**Estimate:** S | **Risk:** Low

### Issue #49: Pull-to-refresh on home screen
**Description:** Wrap home screen ScrollView with RefreshControl. Pull triggers `refreshPlan()` in `useDayPlan`.
**Files:** `app/index.tsx`, `lib/use-day-plan.ts`
**Estimate:** S | **Risk:** Low

---

## Epic 12: Privacy & Consent

### Issue #50: Create consent/privacy screen
**Description:** Add a "Privacy" section in settings showing 3 tiers: Basic (local only, default), Research (opt-in, anonymized, V2), Connected (V2+ placeholder, disabled). Only Basic is functional in V1. Others show "Coming in a future update."
**Files:** `app/settings.tsx`
**Acceptance Criteria:**
- Basic tier toggle is on by default and cannot be disabled (always on)
- Research tier has a toggle but shows consent dialog when enabled
- Connected tier is grayed out with "Coming soon" label
**Estimate:** M | **Risk:** Low

### Issue #51: Implement profileHash for anonymization
**Description:** Generate a stable, anonymous hash from the user profile (SHA-256 of `anchorTime + chronotype + installDate`). Used in telemetry events instead of any PII.
**Files:** `lib/telemetry.ts`
**Estimate:** S | **Risk:** Low

---

## Epic 13: Testing & Quality

### Issue #52: Execute E3 manual test (default profile)
**Description:** Follow `docs/TESTING_PROTOCOL.md` E3 steps on a physical device or simulator. Record results in the protocol document.
**Estimate:** L | **Risk:** Med (may surface bugs)

### Issue #53: Execute E4 manual test (PMer profile)
**Description:** Follow TESTING_PROTOCOL.md E4 steps. Verify midnight-crossing behavior, timeline rendering, R-Lo evening messages.
**Estimate:** L | **Risk:** Med

### Issue #54: Performance profiling
**Description:** Measure: cold start time (target < 2s), `buildDayPlan()` execution time (target < 100ms), AsyncStorage read latency. Use `console.time()` instrumentation.
**Acceptance Criteria:**
- Cold start < 2s on iPhone 12 or equivalent
- `buildDayPlan()` < 100ms with 7 nights history and 10 calendar events
- No jank in timeline scrolling (60fps)
**Estimate:** M | **Risk:** Low

### Issue #55: Add 3 edge-case scenarios (S21-S23)
**Description:** S21: Profile with anchor 00:00 (midnight anchor). S22: 7 consecutive 2-cycle nights (deep orange). S23: 14 calendar events in one day (stress test).
**Files:** `packages/tests/src/scenarios.ts`
**Estimate:** M | **Risk:** Low

---

## Epic 14: Documentation & Release

### Issue #56: V1 release notes
**Description:** Create `docs/RELEASE_NOTES_v1.0.md` with: new features (streaks, weekly view, notifications, conflict resolution), known limitations, TODO_NICK items, tester instructions.
**Estimate:** S | **Risk:** Low

### Issue #57: Update ARCHITECTURE_STATE.md for V1
**Description:** Add modules: streaks.ts, notifications.ts, telemetry.ts. Update data flow diagram. Mark new tech debt items.
**Estimate:** S | **Risk:** Low

### Issue #58: Prepare Nick validation agenda
**Description:** Create `docs/NICK_VALIDATION_AGENDA.md` listing all TODO_NICK items: A03 (CRP accounting), A04 (zone thresholds), A05 (minimum cycles), A10 (chronotype effect). Include proposed answers and what changes depending on Nick's response.
**Estimate:** M | **Risk:** Low

### Issue #59: V2 planning kickoff document
**Description:** Create `docs/V2_PRIORITIES.md` with high-level roadmap for Phase 2: wearable integration (HealthKit, Whoop API), badge system, travel mode, LLM-powered R-Lo, backend/cloud sync. Include rough effort estimates and dependency analysis.
**Estimate:** M | **Risk:** Low

### Issue #60: Update README for V1 state
**Description:** Reflect V1 features, updated architecture, new modules. Add "Notifications" and "Telemetry" sections. Update status table.
**Estimate:** S | **Risk:** Low

---

## Summary

| Epic | Issues | Total Effort |
|------|--------|-------------|
| 1. TestFlight Deployment | #1-#4 | S+M+S+S = ~7h |
| 2. Conflict Resolution | #5-#7 | M+M+M = ~12h |
| 3. Day Plan Lifecycle | #8-#10 | M+S+S = ~7h |
| 4. Settings & Profile | #11-#14 | M+S+S+M = ~10h |
| 5. Streaks | #15-#19 | S+M+S+M+S = ~10h |
| 6. Weekly View | #20-#22 | L+M+S = ~12h |
| 7. Push Notifications | #23-#28 | M+M+S+S+S+M = ~14h |
| 8. AI Data & Telemetry | #29-#38 | 7×S+M = ~12h |
| 9. Post-Event Improvements | #39-#40 | M+M = ~8h |
| 10. R-Lo Message Polish | #41-#44 | M+S+S+M = ~8h |
| 11. UI Polish & Reliability | #45-#49 | M+S+S+S+S = ~8h |
| 12. Privacy & Consent | #50-#51 | M+S = ~5h |
| 13. Testing & Quality | #52-#55 | L+L+M+M = ~20h |
| 14. Documentation | #56-#60 | S+S+M+M+S = ~10h |
| **TOTAL** | **60 issues** | **~143h (~18 dev-days)** |
