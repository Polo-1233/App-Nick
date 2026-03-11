# Dependency Graph

**Version:** 1.0
**Date:** 2026-02-17
**Purpose:** What blocks what. What can parallelize.

---

## Phase Dependencies

```
Phase A ──────────────────────────────────────────────────────────┐
(Method Finalisation)                                             │
  3-4h, Low Risk                                                  │
                                                                  │
Phase B ──────────────────────────────────────────────────────────┤
(Core Engine)                                                     │
  14-18h, High Risk                                               │
  DEPENDS ON: Phase A (doc alignment)                             │
                                                                  │
         ┌────── Phase C ──────────┐                              │
         │ (UX Finalisation)       │                              │
         │ 16-20h, Medium Risk     │                              │
         │ DEPENDS ON: Phase B     │                              │
         │                         │                              │
         │    ┌── Phase D ─────┐   │   ← C1-C4 and D1-D2 can    │
         │    │ (Integration)  │   │     run in parallel          │
         │    │ 10-14h, Medium │   │                              │
         │    │ DEPENDS ON:    │   │                              │
         │    │  Phase B       │   │                              │
         │    │  Phase C (C1)  │   │                              │
         │    └────────────────┘   │                              │
         └─────────────────────────┘                              │
                      │                                           │
              Phase E ─┘                                          │
              (Testing)                                           │
              8-12h, Medium Risk                                  │
              DEPENDS ON: Phases B, C, D                          │
                      │                                           │
              Phase F ─┘                                          │
              (Deployment)                                        │
              4-6h, Low-Medium Risk                               │
              DEPENDS ON: Phase E                                 │
```

## Critical Path

The critical path (longest sequential chain determining minimum time to completion):

```
A → B1 (pre-sleep fix) → B2 (midnight wraparound) → B3 (CRP) → C3 (real data) → D (calendar) → E (testing) → F (deploy)
```

**Critical path length:** ~45–58 hours elapsed

Items NOT on critical path (can parallelize or absorb delay):
- A6 (R-Lo persona doc)
- B4 (PRC/CRP rename) — independent of B1–B3
- B5 (code cleanup) — independent of B1–B3
- C1 (storage layer) — can start during Phase B
- C2 (onboarding) — can start during Phase B
- C4 (night logging) — independent of calendar integration
- F1–F2 (EAS config) — can start during Phase E

## Task-Level Dependencies Within Phases

### Phase B Internal Dependencies

```
B1.1 (types) ──→ B1.2 (cycles) ──→ B1.3 (planner)
                      │          ──→ B1.4 (conflicts)
                      │          ──→ B1.5 (actions)
                      │
                      └──→ B1.6 (scenarios) ──→ B1.7 (test run)

B2.1 (overlaps fix) ← depends on B1.4 (conflicts already updated)
B2.2-B2.4 (actions wraparound) ← independent, can start immediately
B2.5 (TimelineView) ← independent
B2.6 (planner sort) ← independent
B2.7 (PMer scenario) ← depends on B2.1-B2.6

B3.1 (CRP in planner) ← depends on B1.3 (planner already updated)
B3.2 (evening CRP) ← depends on B3.1
B3.3-B3.4 (CRP scenarios) ← depends on B3.1

B4.1-B4.5 (PRC→CRP rename) ← fully independent, can run in parallel with B1-B3
B5.1-B5.10 (cleanup) ← mostly independent, some depend on B1 completion
```

### Phase C Internal Dependencies

```
C1.1-C1.2 (storage) ← independent, can start during Phase B
C2.1-C2.3 (onboarding) ← depends on C1
C3.1-C3.3 (real data) ← depends on C1, C2
C4.1-C4.3 (night log) ← depends on C1 only
C5.1-C5.5 (CRP/post-event UI) ← depends on B3 (CRP in engine) and C1
C6.1-C6.2 (timeline fixes) ← depends on B2.5, B4.4
```

### Cross-Phase Dependencies

| Task | Depends On | Reason |
|---|---|---|
| B1.6 (update scenarios) | B1.2–B1.5 | Scenarios must match new engine behavior |
| B2.1 (overlaps fix) | B1.4 (conflicts update) | Pre-sleep model change affects what overlaps detects |
| B3.1 (CRP in planner) | B1.3 (planner update) | Planner must have correct block structure first |
| C3.1 (real data hook) | C1.1 (storage) + B complete | Need storage to load profile; need correct engine |
| C5.1 (CRP card) | B3.1 (CRP blocks) | UI needs CRP blocks from engine |
| C5.4 (post-event wire) | B1.2 (cycles fix) | Post-event uses updated cycle calculation |
| D2 (calendar fetch) | D1 (expo-calendar) | Need package installed |
| D5 (calendar in hook) | D2 + C3.1 | Hook must exist and calendar must work |
| D6 (conflict sheet) | B1.4 (conflicts fix) | Conflict logic must be correct |
| E3-E4 (full-day tests) | Phases B–D complete | Can't test incomplete app |
| F3 (EAS build) | Phase E (testing) | Don't build until tested |

## Parallelization Opportunities

### What CAN run in parallel:

1. **Phase A** and **B4 + B5** (cleanup tasks independent of method corrections)
2. **C1 (storage)** and **late Phase B tasks** (B3, B4, B5)
3. **C2 (onboarding)** and **C4 (night logging)** (both depend on C1, not each other)
4. **C5 (CRP UI)** and **D1-D2 (calendar setup)** (independent)
5. **F1-F2 (EAS config)** and **E1-E6 (testing)** (build config doesn't depend on test results)

### What CANNOT run in parallel:

1. **B1 (pre-sleep fix)** must complete before **B2 (wraparound)** and **B3 (CRP)**
2. **Phase B** must complete before **C3 (real data)** and **D5-D7 (calendar in app)**
3. **Phase D** must complete before **E3 (full-day test)**
4. **Phase E** must complete before **F3 (build for TestFlight)**

## Optimized Execution Order (Single Developer)

```
Week 1:  A (all) → B1 (pre-sleep) → B2 (wraparound)
Week 2:  B3 (CRP) + B4 (rename) + B5 (cleanup) → C1 (storage)
Week 3:  C2 (onboarding) + C4 (night log) → C3 (real data) + C5 (CRP/post-event UI)
Week 4:  D (calendar integration) → C6 (timeline fixes)
Week 5:  E (testing) → F (deployment)
```

**Optimistic:** 4 weeks at ~15 hrs/week = 60 hours
**Realistic:** 5 weeks at ~14 hrs/week = 70 hours
**Conservative:** 6 weeks at ~13 hrs/week = 78 hours

---

*The single highest-risk dependency is Phase B. If the pre-sleep model fix cascades into unexpected failures, it delays everything downstream.*
