# AI Architecture Specification

> R90 Digital Navigator — Sleep Recovery App
> Version: 1.0 (V1 Scope)
> Last updated: 2026-02-17

---

## 1. System Boundaries

The R90 Digital Navigator follows a strict boundary model that separates deterministic logic, local intelligence, and future server capabilities. Privacy is a hard constraint, not a preference.

### What Runs Where

- **On-device (V1)**: The deterministic rule engine (`@r90/core`) handles all current logic — R-Lo message selection (`rlo.ts`), next action computation (`actions.ts`), readiness zone calculation (`readiness.ts`), cycle window generation, and conflict detection. A local telemetry buffer collects structured events into AsyncStorage for future analysis. Streak calculations, anchor adherence tracking, and all day plan generation remain purely local. No network calls. No server dependency.

- **On-device (V2)**: A lightweight pattern detector runs on accumulated local data. Examples: "You tend to sleep better after a 90-min CRP on Tuesdays," or "Your anchor adherence drops on weekends." A small on-device ML model (e.g., TensorFlow Lite or ONNX Runtime Mobile) provides CRP timing suggestions and personalized cycle targets. All inference runs locally — the model is downloaded once and executed on-device.

- **Server (V2+)**: A telemetry aggregation service receives anonymized, opt-in data from Research-tier users. A model training pipeline runs offline on aggregated data. An A/B test assignment service controls feature rollout. A personalized model serving endpoint delivers updated model weights to Connected-tier users. The server never performs real-time inference on behalf of a single user — it trains and distributes models.

- **Never on server**: Raw calendar event titles or descriptions. Exact sleep/wake times. Location data. Device sensor data. Names, emails, or any PII. Only anonymized behavioral patterns (e.g., "user-hash-abc tends toward 4-cycle nights on weekdays") ever leave the device, and only with explicit Research-tier consent.

### Boundary Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER DEVICE                                 │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    @r90/core (V1 — NOW)                       │  │
│  │                                                               │  │
│  │  rlo.ts ──── Deterministic R-Lo messages                      │  │
│  │  actions.ts ── Next action computation                        │  │
│  │  readiness.ts ── Zone calculation (3-night avg)               │  │
│  │  cycles.ts ── Cycle window generation                         │  │
│  │  conflicts.ts ── Calendar conflict detection                  │  │
│  │                                                               │  │
│  │  All logic is rule-based. No ML. No network.                  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                  Telemetry Buffer (V1)                         │  │
│  │                                                               │  │
│  │  AsyncStorage[@r90:telemetry:v1]                              │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                    │  │
│  │  │ Event 1  │  │ Event 2  │  │ Event N  │  30-day rolling    │  │
│  │  └──────────┘  └──────────┘  └──────────┘                    │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              Local Pattern Detector (V2)                       │  │
│  │                                                               │  │
│  │  On-device ML model (TFLite / ONNX)                           │  │
│  │  Reads: NightRecordV2[], TelemetryEvent[], UserProfile        │  │
│  │  Outputs: PersonalizationOutput                               │  │
│  │  Fallback: deterministic @r90/core if confidence < threshold  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ PRIVACY BOUNDARY ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│         Only anonymized patterns cross this line (opt-in)           │
│                              │                                      │
└──────────────────────────────┼──────────────────────────────────────┘
                               │  Research/Connected tier only
                               │  Explicit user consent required
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        SERVER (V2+)                                  │
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────────┐  │
│  │   Telemetry     │  │  Training        │  │  Model Serving    │  │
│  │   Aggregation   │──│  Pipeline        │──│  (weights only)   │  │
│  │                 │  │                  │  │                   │  │
│  │  Anonymized     │  │  Offline batch   │  │  Updated models   │  │
│  │  patterns only  │  │  training        │  │  pushed to device │  │
│  └─────────────────┘  └─────────────────┘  └───────────────────┘  │
│                                                                     │
│  ┌─────────────────┐                                               │
│  │  A/B Test       │  Feature flags, experiment assignment          │
│  │  Assignment     │                                               │
│  └─────────────────┘                                               │
│                                                                     │
│  NEVER STORED: calendar titles, exact times, PII, location          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Contracts

All types defined below will live in `packages/types/src/index.ts` alongside existing types (`UserProfile`, `NightRecord`, `CalendarEvent`, `CycleWindow`, `DayPlan`, `RuleContext`, etc.).

### 2.1 Telemetry Event Schema

Structured events capture user actions without leaking sensitive content. Every event is self-contained and privacy-safe by construction.

```typescript
interface TelemetryEvent {
  id: string;                    // UUID v4, generated on-device
  timestamp: string;             // ISO 8601 (e.g., "2026-02-17T22:30:00.000Z")
  eventType: TelemetryEventType;
  payload: Record<string, unknown>; // event-specific data (see per-event docs below)
  sessionId: string;             // UUID v4, generated per app open
  appVersion: string;            // semver from app.json (e.g., "1.2.0")
  profileHash: string;           // SHA-256 of anonymized user identifier, NOT raw profile
}

type TelemetryEventType =
  | "app_open"                   // payload: {}
  | "day_plan_generated"         // payload: { zone, cycleCount, conflictCount }
  | "night_logged"               // payload: { cyclesCompleted, anchorDeviation, dayOfWeek }
  | "crp_completed"              // payload: { duration, zone, dayOfWeek }
  | "crp_skipped"                // payload: { zone, dayOfWeek }
  | "conflict_shown"             // payload: { conflictCount } (NOT event titles)
  | "conflict_acknowledged"      // payload: { conflictIndex }
  | "conflict_option_selected"   // payload: { optionType } (e.g., "shift_bedtime", "reduce_cycles")
  | "post_event_triggered"       // payload: { eventType } (physical/mental/social, NOT title)
  | "post_event_confirmed"       // payload: { eventType }
  | "pre_sleep_reminder_shown"   // payload: { minutesBeforeBedtime }
  | "anchor_hit"                 // payload: { deviationMinutes } — woke within +/-30min of anchor
  | "anchor_missed"              // payload: { deviationMinutes }
  | "streak_achieved"            // payload: { streakLength, streakType }
  | "onboarding_completed"       // payload: { chronotype, idealCycles, anchorTime }
  | "settings_changed";          // payload: { changedField } (field name only, NOT value)
```

**Per-event payload contracts** (enforced at the telemetry logger level):

| Event Type | Payload Fields | Notes |
|---|---|---|
| `app_open` | `{}` | Session start marker |
| `day_plan_generated` | `{ zone: ReadinessZone, cycleCount: number, conflictCount: number }` | No event titles |
| `night_logged` | `{ cyclesCompleted: number, anchorDeviation: number, dayOfWeek: number }` | Deviation in minutes, not absolute time |
| `crp_completed` | `{ duration: 30 \| 90, zone: ReadinessZone, dayOfWeek: number }` | Zone at time of CRP |
| `crp_skipped` | `{ zone: ReadinessZone, dayOfWeek: number }` | User was offered CRP but declined |
| `conflict_shown` | `{ conflictCount: number }` | Count only |
| `conflict_option_selected` | `{ optionType: string }` | The strategy chosen, not the conflict |
| `anchor_hit` | `{ deviationMinutes: number }` | Always 0-30 |
| `anchor_missed` | `{ deviationMinutes: number }` | Always >30 |
| `streak_achieved` | `{ streakLength: number, streakType: string }` | e.g., "anchor_streak", "cycle_streak" |
| `settings_changed` | `{ changedField: string }` | e.g., "anchorTime", "chronotype" |

### 2.2 Sleep Log Schema (Extended)

Extends the existing `NightRecord` from `packages/types/src/index.ts` with fields needed for pattern analysis and ML features. The base `NightRecord` remains unchanged for backward compatibility.

```typescript
interface NightRecordV2 extends NightRecord {
  // CRP effectiveness tracking
  preCRPZone?: ReadinessZone;    // zone before CRP was taken (for before/after analysis)
  postCRPZone?: ReadinessZone;   // zone after CRP completion

  // Late event context (privacy-safe — no titles, no descriptions)
  hadLateEvent?: boolean;        // was there a calendar event ending after 21:00?
  eventEndTime?: MinuteOfDay;    // what time did the late event end?
  eventType?: "physical" | "mental" | "social"; // user-categorized, not inferred

  // Behavioral metrics
  anchorDeviation?: number;      // signed minutes: positive = woke late, negative = woke early
  conflictCount?: number;        // how many conflicts existed in the day plan
  dayOfWeek?: number;            // 0 = Sunday, 6 = Saturday (derived from date)
}
```

**Migration note**: Existing `NightRecord` objects in AsyncStorage (`@r90:nights`) remain valid `NightRecordV2` instances because all new fields are optional. The storage layer (`apps/mobile/lib/storage.ts`) will populate new fields going forward without requiring a data migration.

### 2.3 Model Input Schema

The `PersonalizationInput` aggregates the context a model needs to produce personalized recommendations. In V1, this type exists only as a contract — no model consumes it yet.

```typescript
interface PersonalizationInput {
  recentNights: NightRecordV2[];   // last 14 nights (sliding window)
  profile: UserProfile;           // chronotype, anchorTime, idealCyclesPerNight, weeklyTarget
  currentZone: ReadinessZone;     // today's readiness zone from readiness.ts
  dayOfWeek: number;              // 0-6 (Sunday-Saturday)
  calendarLoad: number;           // number of calendar events today (count only, no details)
  streaks: StreakState;           // current streak state from the streak engine
}
```

**Design decisions**:
- `recentNights` is capped at 14 to bound model input size and recency bias.
- `calendarLoad` is a count, not a list — calendar event details never reach the model.
- `profile` is included because chronotype and anchor time significantly affect optimal recommendations.
- `streaks` provides motivational context (a user on a 7-day streak should get different messaging than one who just broke a streak).

### 2.4 Model Output Schema

The model output is always optional. Every field has a deterministic fallback. The `confidence` score gates whether personalized output is used or discarded in favor of the rule engine.

```typescript
interface PersonalizationOutput {
  suggestedCycles: number;            // personalized cycle target for tonight (3-6 range)
  crpRecommendation: CRPRecommendation | null; // null = no CRP suggested
  rloMessageOverride?: string;        // personalized R-Lo message; undefined = use deterministic rlo.ts
  confidence: number;                 // 0.0 to 1.0; below 0.6 threshold → fallback to deterministic
}

interface CRPRecommendation {
  duration: 30 | 90;                  // CRP length in minutes (matches existing CRP types)
  suggestedTime: MinuteOfDay;         // when to start the CRP
  reason: string;                     // human-readable explanation shown to user
                                      // e.g., "You recover better with afternoon CRPs on weekdays"
                                      // e.g., "A 90-min CRP after late matches helps your next anchor"
}
```

**Confidence threshold behavior**:

| Confidence | Behavior |
|---|---|
| >= 0.8 | Use personalized output with high confidence indicator |
| 0.6 - 0.8 | Use personalized output, no confidence indicator |
| < 0.6 | Discard personalized output entirely, use deterministic `@r90/core` |
| N/A (V1) | Always deterministic — `PersonalizationOutput` is never generated |

---

## 3. Logging & Telemetry Plan (Privacy-First)

### 3.1 What We Log

All telemetry is structured, schema-validated, and privacy-safe by design.

**Structured telemetry events** (per the `TelemetryEvent` schema in section 2.1):
- App lifecycle: open, session duration, session count
- Day plan generation metadata: readiness zone, cycle count, conflict count (never event titles)
- CRP interactions: completion, skip, duration chosen, zone at time of CRP
- Anchor adherence: hit/miss classification, deviation in signed minutes
- Streak data: length, type, achieved/broken
- Night logging: cycles completed, anchor deviation, day of week
- Conflict interactions: count shown, option selected (strategy type, not event details)
- Settings changes: which field changed (not the old or new value)
- Onboarding completion: chronotype selected, cycle count, anchor time

**Derived metrics** (computed locally from raw events):
- Weekly anchor hit rate (percentage of nights within +/-30min)
- CRP completion rate by day of week
- Average cycles completed vs. target
- Zone distribution over 7/14/30 day windows
- Session frequency and timing patterns

### 3.2 What We NEVER Log

This is a hard constraint, enforced at the telemetry logger level in `apps/mobile/lib/telemetry.ts`. These items are blocked by code, not just by policy.

- **Calendar event titles or descriptions** — only conflict counts and user-selected resolution strategies
- **Exact sleep or wake times** — only deviations from the planned anchor/bedtime (signed minutes)
- **Location data** — not requested, not accessed, not stored
- **Device sensor data** — no accelerometer, gyroscope, or microphone data unless the user explicitly grants wearable integration (V2+)
- **PII** — no name, email, phone number, or account identifiers. The `profileHash` is a one-way SHA-256 hash that cannot be reversed to identify a user
- **Free-text input** — if any future feature allows user notes, those notes stay local and are never included in telemetry
- **Raw `UserProfile` data** — telemetry uses `profileHash`, not the profile itself. Chronotype is logged only during onboarding (as a categorical value, not linked to identity)

### 3.3 Local-First Architecture

The telemetry system is built local-first. Data lives on the device unless the user explicitly opts in to sharing.

**V1 (Current scope)**:
- All telemetry is stored on-device in AsyncStorage under the key `@r90:telemetry:v1`
- Storage format: JSON array of `TelemetryEvent` objects, ordered by timestamp
- Buffer limit: 30 calendar days of events, auto-trimmed on each `app_open` event
- Trimming strategy: drop events older than 30 days, starting from the oldest
- Estimated storage: ~50 events/day x 30 days x ~200 bytes/event = ~300KB (well within AsyncStorage limits)
- No network calls. No upload endpoints. No server communication.
- Telemetry is readable by the local pattern detector but not exported

**V2 (Future scope)**:
- Opt-in upload to a server endpoint (explicit consent dialog, Research tier)
- Upload is batched (daily), not real-time
- Data is anonymized before upload: `profileHash` replaces any user identifier, exact times are converted to deviations, calendar data is stripped to counts only
- Upload payload is the same `TelemetryEvent[]` format, just transmitted over HTTPS
- Local buffer continues to function independently of upload status
- Users can revoke Research tier consent at any time; server data is deleted within 30 days of revocation

**Storage key map**:

| Key | Contents | Retention |
|---|---|---|
| `@r90:telemetry:v1` | `TelemetryEvent[]` | 30 days, auto-trimmed |
| `@r90:nights` | `NightRecordV2[]` (backward-compatible) | Indefinite (user data) |
| `@r90:consent` | `{ tier: "basic" \| "research" \| "connected", updatedAt: string }` | Indefinite |
| `@r90:session` | `{ sessionId: string, startedAt: string }` | Until app close |

### 3.4 Consent Model

Three tiers, each requiring explicit user action to enable. The default is the most restrictive tier.

**Tier 1 — Basic (default)**:
- Enabled automatically on app install. No consent dialog needed.
- All telemetry stays on-device in AsyncStorage.
- Used for: local streak calculations, personal insights ("Your anchor hit rate this week: 71%"), and future on-device pattern detection.
- Data never leaves the device. Period.
- User sees: "Your sleep data stays on your device."

**Tier 2 — Research (opt-in, V2)**:
- Requires explicit consent dialog with clear explanation of what is shared and what is not.
- Consent dialog text must include: what data is shared (anonymized patterns), what is never shared (calendar titles, exact times, PII), how to revoke, and data retention policy.
- Anonymized telemetry patterns are uploaded daily to the aggregation server.
- Used for: improving the personalization model for all users, understanding population-level sleep patterns.
- User sees: "Help improve R90 for everyone. Your anonymized sleep patterns (never calendar details or personal info) will be used to train better recommendations."
- Revocation: immediate stop of uploads, server data deleted within 30 days.

**Tier 3 — Connected (opt-in, V2+)**:
- Requires Research tier as a prerequisite.
- Enables real-time model serving: the device periodically fetches updated personalization model weights from the server.
- Also enables A/B test participation for new features.
- Used for: receiving the latest personalized model trained on aggregated data, faster model improvements.
- User sees: "Get personalized recommendations powered by our latest models. Requires an internet connection for periodic updates."
- Revocation: falls back to last downloaded model weights, then to deterministic engine.

**Consent state machine**:

```
┌─────────┐   opt-in    ┌──────────┐   opt-in    ┌───────────┐
│  Basic  │────────────▶│ Research │────────────▶│ Connected │
│(default)│             │          │             │           │
└─────────┘◀────────────└──────────┘◀────────────└───────────┘
              revoke                    revoke
```

Downgrade is always immediate. Upgrade requires consent dialog.

---

## 4. Training Pipeline Outline

### 4.1 Data Collection

- **Source**: Opt-in telemetry from Research-tier and Connected-tier users only. Basic-tier data never leaves the device.
- **Volume target**: 50 active users x 30 days = 1,500 `NightRecordV2` records minimum before any model training begins. This threshold ensures statistical significance for the primary patterns (CRP effectiveness, anchor adherence by day of week).
- **Collection format**: `NightRecordV2[]` paired with `TelemetryEvent[]` streams, linked by `profileHash` (anonymized).
- **Collection cadence**: Daily batch uploads from Research-tier devices, compressed and transmitted over HTTPS.
- **Data quality gates**: Records missing `cyclesCompleted` or `anchorDeviation` are excluded from training sets. Partial records (e.g., night logged but CRP fields empty) are included with appropriate null handling.

### 4.2 Labeling Strategy

The model uses a combination of explicit labels and self-supervised pattern extraction. No manual labeling is required.

**Primary label — "Good Recovery"**:
- Definition: User is in the **green** `ReadinessZone` AND `anchorDeviation` is <= 15 minutes (absolute value).
- This label is automatically derived from `NightRecordV2` data. No human annotator needed.
- Used to train: "What conditions predict good recovery?" (CRP timing, cycle count, day of week, calendar load).

**Secondary labels**:

| Label | Definition | Used For |
|---|---|---|
| CRP effectiveness | Zone improvement: `postCRPZone` is better than `preCRPZone` | "When do CRPs actually help this user?" |
| Streak maintenance | `streakLength` increased day-over-day | "What patterns sustain streaks?" |
| Post-event recovery | Green zone the morning after `hadLateEvent === true` | "How well does this user recover from late events?" |
| Anchor consistency | `anchorDeviation` <= 15min for 5+ consecutive nights | "What drives consistent anchor adherence?" |

**Self-supervised patterns**:
- Temporal sequences in `TelemetryEvent` streams reveal behavioral patterns without explicit labels.
- Example: "Users who complete CRPs between 13:00-15:00 on weekdays have 23% higher next-morning green zone rates."
- Example: "Users who open the app within 30 minutes of their `preSleepStart` have 15% better anchor adherence."
- These patterns emerge from aggregation across Research-tier users and require no manual labeling.

### 4.3 Evaluation Metrics

| Metric | Target | Description | Measurement Method |
|---|---|---|---|
| CRP recommendation accuracy | >70% | User follows CRP suggestion and zone improves | Compare `preCRPZone` to `postCRPZone` when `crp_completed` follows a recommendation |
| Anchor adherence improvement | +10% over 30 days | Users hit anchor more consistently after personalization | Compare 30-day anchor hit rate before/after model activation |
| Cycle target accuracy | +/-0.5 cycles | Suggested cycles match user's actual completed cycles | Mean absolute error between `suggestedCycles` and `cyclesCompleted` |
| R-Lo engagement | >3 opens/week | Users actively engage with personalized R-Lo messages | Count `app_open` events per week for users receiving personalized messages |
| Fallback rate | <20% | Personalized output is used (confidence >= 0.6) at least 80% of the time | Percentage of `day_plan_generated` events where model confidence >= threshold |
| Privacy compliance | 100% | Zero PII in server-side data | Automated audit: scan all uploaded telemetry for regex patterns matching emails, names, timestamps (not deviations) |

### 4.4 Model Iteration Loop

```
┌──────────┐    ┌───────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Collect  │───▶│ Aggregate │───▶│  Train   │───▶│ Evaluate │───▶│  Deploy  │───▶│ Monitor  │
│          │    │           │    │          │    │          │    │          │    │          │
│ On-device│    │  Server   │    │  Server  │    │  Server  │    │  OTA to  │    │ Server + │
│ telemetry│    │  batch    │    │  offline │    │  metrics │    │  device  │    │  device  │
└──────────┘    └───────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
     │                                                                                │
     │                                                                                │
     └────────── V1: STOP HERE (collect + local store only) ──────────────────────────┘
```

**V1 scope**: Collect telemetry events and `NightRecordV2` data into local AsyncStorage. No aggregation, no training, no deployment. The data plumbing is built so that when V2 begins, the training pipeline has historical data to work with from day one.

**V2 scope**: Aggregate + Train + Evaluate. Initial model trained on first batch of Research-tier data. Evaluated offline against held-out test sets. Not deployed until all evaluation metrics are met.

**V2+ scope**: Full loop. Deploy models OTA to Connected-tier devices. Monitor real-world performance via telemetry. Retrain on a cadence (initially monthly, moving to weekly as data volume grows).

---

## 5. Fallback Behavior

The deterministic rule engine in `@r90/core` is not a temporary solution being replaced by AI. It is the permanent foundation. AI personalization is an overlay — an enhancement applied when the model is confident, removed transparently when it is not.

### Fallback Rules by Feature

**R-Lo messages** (`packages/core/src/rlo.ts`):
- When AI is unavailable (always in V1, or confidence < 0.6 in V2+): Use the current deterministic R-Lo message engine. Messages are selected based on `RuleContext` — current time relative to anchor, readiness zone, streak state, and day plan phase.
- When AI is available: `rloMessageOverride` from `PersonalizationOutput` replaces the deterministic message. If `rloMessageOverride` is `undefined`, the deterministic message is used.
- The user never sees a blank or error state. There is always a message.

**CRP recommendations** (`packages/core/src/actions.ts`):
- When AI is unavailable: Use the current zone-based logic. Yellow zone suggests a 30-minute CRP. Orange/red zone suggests a 90-minute CRP. Default timing is midday, 13:00-15:00 range.
- When AI is available: `crpRecommendation` from `PersonalizationOutput` overrides the default. The `reason` field provides a personalized explanation (e.g., "You recover better with afternoon CRPs on weekdays").
- If `crpRecommendation` is `null`, no CRP is suggested (model determined one is not needed).

**Cycle suggestions**:
- When AI is unavailable: Use `profile.idealCyclesPerNight` from `UserProfile` (default: 5 cycles).
- When AI is available: `suggestedCycles` from `PersonalizationOutput` overrides the profile default. Clamped to the 3-6 range to prevent unreasonable suggestions.

**Pattern insights** (the "we've noticed..." messages):
- When AI is unavailable (V1): Show nothing. No pattern messages are displayed. The user sees only deterministic R-Lo messages and standard next actions.
- When AI is available (V2+): Pattern insights appear as a distinct UI element (not mixed into R-Lo messages) only when the model has >= 14 nights of data and confidence >= 0.8 for the specific pattern.
- Example pattern: "We've noticed you recover better with a 90-min CRP after late matches" — this requires at least 3 instances of the pattern in the user's history.

**Readiness zone** (`packages/core/src/readiness.ts`):
- When AI is unavailable: Use the current 3-night weighted average calculation. Zone boundaries remain static (green/yellow/orange/red thresholds).
- When AI is available (V2+): Wearable data (Whoop/Oura/Apple Watch) can adjust zone boundaries based on physiological data. The adjustment is additive — wearable data shifts the zone calculation, it does not replace it.
- Wearable integration is entirely V2+ and requires explicit user permission per data source.

### Fallback Decision Flow

```
PersonalizationOutput available?
├── NO (V1, or model not loaded, or error)
│   └── Use @r90/core deterministic engine for everything
│       ├── rlo.ts → R-Lo message
│       ├── actions.ts → Next action + CRP
│       ├── readiness.ts → Zone
│       └── No pattern insights shown
│
└── YES
    └── Check confidence score
        ├── confidence < 0.6
        │   └── Discard PersonalizationOutput → use deterministic
        ├── confidence 0.6-0.8
        │   └── Use PersonalizationOutput (no confidence badge)
        └── confidence >= 0.8
            └── Use PersonalizationOutput (high confidence badge)
```

The deterministic engine is always warm. It does not need to be initialized or loaded. There is zero latency cost to falling back. From the user's perspective, the app works identically whether AI is active or not — it just gets smarter over time.

---

## 6. Implementation Plan for V1

V1 builds the data plumbing and type contracts. No models are trained. No personalization is served. The goal is to start collecting structured telemetry so that V2 has historical data from day one.

### Task Breakdown

| Task | File(s) | Effort | Dependencies | Description |
|---|---|---|---|---|
| Define `TelemetryEvent` and `TelemetryEventType` types | `packages/types/src/index.ts` | S | None | Add the telemetry event interface and union type from section 2.1 |
| Define `NightRecordV2` type | `packages/types/src/index.ts` | S | None | Extend existing `NightRecord` with ML-relevant fields from section 2.2 |
| Define `PersonalizationInput` type | `packages/types/src/index.ts` | S | `NightRecordV2` | Add model input contract from section 2.3 (consumed in V2, defined now) |
| Define `PersonalizationOutput` and `CRPRecommendation` types | `packages/types/src/index.ts` | S | None | Add model output contract from section 2.4 (consumed in V2, defined now) |
| Define consent types | `packages/types/src/index.ts` | S | None | `ConsentTier = "basic" \| "research" \| "connected"` and `ConsentState` interface |
| Create telemetry logger module | `apps/mobile/lib/telemetry.ts` | M | `TelemetryEvent` type | Core module: `logEvent(type, payload)`, `getEvents(since)`, `trimEvents()`, `clearEvents()` |
| Implement AsyncStorage telemetry buffer | `apps/mobile/lib/telemetry.ts` | M | Telemetry logger | 30-day rolling buffer under `@r90:telemetry:v1`, auto-trim on `app_open` |
| Instrument `app_open` event | `apps/mobile/app/_layout.tsx` | S | Telemetry logger | Log on app foreground, generate `sessionId` |
| Instrument `day_plan_generated` event | `apps/mobile/app/(tabs)/index.tsx` or equivalent | S | Telemetry logger | Log zone, cycle count, conflict count when `DayPlan` is computed |
| Instrument `night_logged` event | `apps/mobile/app/log-night.tsx` | S | Telemetry logger | Log cycles, anchor deviation, day of week on night submission |
| Instrument CRP events (`crp_completed`, `crp_skipped`) | `apps/mobile/app/crp.tsx` or CRP-related components | S | Telemetry logger | Log duration, zone, day of week on CRP completion or skip |
| Instrument conflict events | `apps/mobile/components/` (conflict-related) | S | Telemetry logger | Log conflict shown, acknowledged, option selected |
| Instrument anchor events (`anchor_hit`, `anchor_missed`) | `apps/mobile/app/log-night.tsx` | S | Telemetry logger | Compute deviation from planned anchor on night log; classify hit/miss |
| Instrument `streak_achieved` event | `apps/mobile/` (streak-related) | S | Telemetry logger | Log when streak increments |
| Instrument `settings_changed` event | `apps/mobile/app/settings.tsx` | S | Telemetry logger | Log changed field name (not value) on profile updates |
| Add `anchorDeviation` calculation to night logging | `apps/mobile/app/log-night.tsx` | S | None | Compute signed difference between actual wake time and planned anchor; store in `NightRecordV2` |
| Extend `NightRecord` to `NightRecordV2` in storage | `apps/mobile/lib/storage.ts` | S | `NightRecordV2` type | Populate new optional fields (`dayOfWeek`, `anchorDeviation`, `conflictCount`) during night log save |
| Create consent settings UI (placeholder) | `apps/mobile/app/settings.tsx` | S | Consent types | Display current consent tier (always "Basic" in V1), disabled Research toggle with "Coming soon" |
| Add telemetry buffer size indicator to settings | `apps/mobile/app/settings.tsx` | S | Telemetry logger | Show "X events stored locally (Y days)" in settings for transparency |

### Effort Key

| Size | Estimated Hours | Description |
|---|---|---|
| S | 1-2 hours | Type definition, single-file change, simple UI addition |
| M | 3-5 hours | New module, multiple function implementations, storage integration |

### Total V1 Effort

- **Type definitions**: 5 tasks x S = ~8 hours
- **Telemetry infrastructure**: 2 tasks x M = ~8 hours
- **Instrumentation**: 9 tasks x S = ~14 hours
- **Storage + UI**: 3 tasks x S = ~5 hours

**Total: ~35 hours = ~3-4 developer-days**

### V1 Definition of Done

- [ ] All types from section 2 are exported from `packages/types/src/index.ts`
- [ ] `apps/mobile/lib/telemetry.ts` exists with `logEvent`, `getEvents`, `trimEvents` functions
- [ ] All `TelemetryEventType` values are instrumented in at least one code path
- [ ] `NightRecordV2` fields (`anchorDeviation`, `dayOfWeek`, `conflictCount`) are populated on night log
- [ ] Telemetry buffer auto-trims to 30 days on each `app_open`
- [ ] Settings screen shows consent tier (Basic) and telemetry buffer stats
- [ ] Zero telemetry data leaves the device (no network calls in telemetry module)
- [ ] All existing tests pass (no regressions in deterministic engine)
- [ ] No calendar event titles, exact times, or PII appear in any telemetry payload

### What V1 Does NOT Include

- No ML models (no TensorFlow Lite, no ONNX, no model inference)
- No server endpoints (no upload, no aggregation, no model serving)
- No personalized R-Lo messages (deterministic `rlo.ts` only)
- No pattern insights ("we've noticed..." messages)
- No wearable integrations (Whoop, Oura, Apple Watch)
- No A/B testing infrastructure
- No Research or Connected consent tiers (UI placeholder only)

V1 is pure instrumentation. It makes the app observable without changing its behavior.
