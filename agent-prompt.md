# R90 Navigator — Agent IA Personnalisé : Roadmap complète

Tu es Nick Dev, agent de développement pour R90 Navigator.
Travaille de manière autonome, step par step, dans l'ordre strict.
Ne saute aucune étape. TypeScript doit compiler clean après chaque phase (sauf erreur pre-existing expo-intent-launcher).
Committe après chaque phase complète avec un message de commit clair.
Push sur origin main après chaque commit.

---

## CONTEXTE CRITIQUE

**Paths:**
- App root: `/Users/thomas/Projects/Nick/App/`
- Mobile app: `/Users/thomas/Projects/Nick/App/mobile/apps/mobile`
- nick_brain: `/Users/thomas/Projects/Nick/App/nick_brain`
- Backend handlers: `nick_brain/backend/handlers/`
- Backend services: `nick_brain/backend/services/`
- Backend DB: `nick_brain/backend/db/`
- Backend routes déclarées dans: `nick_brain/backend/server.ts`

**Stack:**
- React Native (Expo) + TypeScript
- Backend Node.js (nick_brain) sur Railway — deploy auto via git push
- Supabase (PostgreSQL + Auth)
- OpenAI GPT-4o via API
- RevenueCat (iOS)

**Design palette (ne pas changer):**
- bg: `#0B1220`, card: `#1A2436`, surface2: `#243046`
- accent: `#F5A623`, accentBlue: `#4DA3FF`, success: `#3DDC97`
- text: `#E6EDF7`, sub: `#9FB0C5`, muted: `#6B7F99`
- border: `rgba(255,255,255,0.06)`

**Règles absolues:**
- Zero `console.log` en production (utiliser `console.error` pour les erreurs uniquement)
- TypeScript compile clean (sauf `lib/alarm.ts` expo-intent-launcher pre-existing)
- `trash` > `rm`
- Jamais de logique R90 inventée — engine est source de vérité
- Jamais de modifications de PROJECT_CONTEXT.md
- Commentaires en anglais dans le code

**Patterns existants à respecter:**
- Routes dans `server.ts` : `{ method, path, handler }` array
- Handlers signature: `(req, res, auth, query) => Promise<void>`
- `sendJson(res, 200, data)` et `sendError(res, 400, msg, code)` pour les réponses
- `readBody<T>(req)` pour lire le body
- `auth.client` = Supabase client authentifié, `auth.userId` = users.id (pas auth_user_id)
- API mobile: `request(method, path, body?)` retourne `ApiResponse<T>`
- `ApiResponse<T>` = `{ ok: boolean; data?: T; error?: string }`

**Ce qui existe déjà (ne pas réécrire):**
- Phase 1 complète: lifestyle profile + life events (commit 0d63844)
- Calendrier Apple + Google déjà intégrés dans `apps/mobile/lib/calendar.ts` et `google-calendar.ts`
- Push notifications via expo-notifications déjà configuré dans `lib/notifications.ts`
- Chat service avec fake-stream XHR dans `nick_brain/backend/services/chat-service.ts`
- NEVER use `res.body.getReader()` in React Native — XHR onprogress is used
- `buildStructuredContext()` dans `chat-service.ts` avec sections [USER_PROFILE], [SLEEP_PLAN], [WEEKLY_RECOVERY], [RECENT_SLEEP_HISTORY], [CURRENT_STATE], [LIFESTYLE], [LIFE_EVENTS]

---

## ÉTAPE 0 — Auto-migration runner

**Objectif:** Runner qui s'exécute au démarrage Railway et applique automatiquement toutes les migrations Supabase non encore exécutées.

**Implémentation:**

Créer `nick_brain/backend/db/migrate.ts`:
- Utilise `SUPABASE_DB_URL` env var (connection string postgres directe)
- Si disponible: installe et utilise `postgres` npm package pour exécuter le SQL raw
- Si absent: log les migrations non appliquées et continue (non-bloquant)
- Table `schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ)` créée si absente
- Lit tous les fichiers `*.sql` dans `backend/db/migrations/` triés par nom
- Pour chaque fichier: vérifie si version (nom du fichier sans .sql) existe dans schema_migrations
- Si non: exécute le SQL, puis INSERT dans schema_migrations
- Log proprement: `[migrate] Applied: 005_calendar_events` ou `[migrate] Already applied: 004_rich_profile`

Appeler `runMigrations()` au démarrage dans `server.ts` avant de commencer à écouter.

Note: ajouter `postgres` (npm package "postgres" = postgres.js) dans package.json de nick_brain si pas déjà présent. Check d'abord avec `cat nick_brain/package.json`.

---

## PHASE 2 — Agent Calendrier

**Objectif:** R-Lo connaît le planning réel de l'utilisateur. Il adapte les conseils selon les événements des 48h suivantes.

### P2-S1 — Backend: table calendar_events + migration 005

Créer `nick_brain/backend/db/migrations/005_calendar_events.sql`.

Table `calendar_events`:
- id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- external_id TEXT NOT NULL (ID natif du calendrier source)
- title TEXT NOT NULL
- start_time TIMESTAMPTZ NOT NULL
- end_time TIMESTAMPTZ NOT NULL
- all_day BOOLEAN DEFAULT FALSE
- source TEXT NOT NULL CHECK (source IN ('apple', 'google', 'manual'))
- event_type_hint TEXT DEFAULT 'other' CHECK (event_type_hint IN ('travel', 'meeting', 'important', 'social', 'health', 'other'))
- synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
- UNIQUE(user_id, external_id, source)

Index sur (user_id, start_time). RLS activé. Policy "calendar_events_own".
Utiliser le pattern DO $$ IF NOT EXISTS $$ pour la policy (comme migration 003/004).

Table `notification_log` dans le même fichier (réutilisée en Phase 4):
- id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- trigger_type TEXT NOT NULL
- sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
- expires_at TIMESTAMPTZ NOT NULL

Index sur (user_id, trigger_type, sent_at DESC). RLS + policy.

Ajouter dans `queries.ts`: interface `CalendarEventRow` et fonction `fetchUpcomingCalendarEvents(client, userId, hoursAhead=48)`.
Ajouter dans `mutations.ts`: `upsertCalendarEvents(client, userId, events[])` — upsert en batch.

### P2-S2 — Backend: classifieur d'événements + handler

Créer `nick_brain/backend/services/calendar-classifier.ts`:
- Fonction `classifyCalendarEvent(title: string): string`
- Détection par mots-clés (case-insensitive):
  - travel: flight, vol, airport, aéroport, train, hotel, trip, voyage, départ, arrival
  - meeting: call, meeting, réunion, standup, sync, interview, review, demo
  - important: exam, launch, deadline, conference, keynote, pitch, présentation
  - social: dinner, dîner, birthday, wedding, party, fête, celebration
  - health: doctor, médecin, dentist, gym, sport, yoga, run, workout
  - other: default

Créer `nick_brain/backend/handlers/calendar-context-handler.ts`:
- `POST /calendar/sync`: reçoit array d'events, classifie avec classifyCalendarEvent(), upsert en batch. Body: `{ events: Array<{ external_id, title, start_time, end_time, all_day, source }> }`. Limite 200 events max.
- `GET /calendar/upcoming?hours=48`: retourne events dans la fenêtre temporelle.

Ajouter les 2 routes dans `server.ts`.

### P2-S3 — Backend: injection [CALENDAR_EVENTS] dans chat-service

Dans `buildStructuredContext()` de `chat-service.ts`:
- Appeler `fetchUpcomingCalendarEvents(client, userId, 48)` en parallèle avec les autres queries (Promise.all)
- Étendre l'interface `StructuredContext` avec `calendar_events: Array<{ type, title, start_time, is_today, is_tomorrow }>`
- Dans `formatContextSections()`, ajouter section `[CALENDAR_EVENTS]`:
  ```
  [CALENDAR_EVENTS]
  meeting: "Standup" — today 09:00
  travel: "Flight to London" — tomorrow 06:30 ⚠️ EARLY WAKE
  important: "Product launch" — today 14:00 ⚠️ HIGH STAKES TODAY
  ```
- Flag ⚠️ EARLY WAKE si event start_time < 08:00 le lendemain
- Flag ⚠️ HIGH STAKES TODAY si event type important/travel aujourd'hui

### P2-S4 — Mobile: sync calendrier → backend au démarrage

Créer `apps/mobile/lib/calendar-sync.ts`:
- Fonction async `syncCalendarToBackend(): Promise<void>`
- Vérifie last sync via AsyncStorage key `@r90:lastCalendarSync`
- Si < 30 min depuis dernier sync → return early
- Lit events 7 prochains jours via lib calendrier existante (import depuis `./calendar`)
- Normalise au format attendu: `{ external_id, title, start_time (ISO), end_time (ISO), all_day, source: 'apple' }`
- Si Google Calendar connecté (via `./google-calendar`), inclut aussi ces events avec `source: 'google'`
- POST /calendar/sync avec le tableau
- Met à jour @r90:lastCalendarSync avec Date.now()
- Silencieux — try/catch global, jamais de throw

Appeler `void syncCalendarToBackend()` dans `app/_layout.tsx` après que l'authentification est établie (chercher le bon endroit dans le useEffect d'auth).

### P2-S5 — Mobile: route API + banner contextuel dans HomeScreen

Ajouter dans `apps/mobile/lib/api.ts`:
- `getUpcomingEvents(hours?: number)` → GET /calendar/upcoming?hours=X

Dans `HomeScreen.tsx`:
- Au chargement, appeler `getUpcomingEvents(24)`
- Si event de type travel ou important dans les 24h → afficher banner sous le header:
  - Travel: `"✈️ [title] — [when]. Your bedtime tonight is critical."`
  - Important: `"⭐ [title] — [when]. R-Lo has advice for you."`
- Tap banner → focus input chat + pré-remplir message contextuel (ex: "J'ai [event] demain, comment optimiser ma nuit ?")
- Banner dismissible: stocker ID dans AsyncStorage `@r90:dismissedBanners` (array de strings)
- Max 1 banner (le plus prioritaire: travel > important)
- Design banner: card #1A2436, bord gauche 3px accentBlue, padding 12px, texte 13px

---

## PHASE 3 — Mémoire Long Terme

**Objectif:** R-Lo se souvient des 4 dernières semaines. Il détecte les patterns.

### P3-S1 — Backend: table weekly_summaries + migration 006

Créer `nick_brain/backend/db/migrations/006_weekly_summaries.sql`.

Table `weekly_summaries`:
- id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- week_start DATE NOT NULL
- week_end DATE NOT NULL
- avg_cycles DECIMAL(4,2)
- total_cycles INT
- target_cycles INT
- on_track BOOLEAN
- deficit INT
- mood_avg DECIMAL(3,2)
- stress_avg DECIMAL(3,2)
- notable_events JSONB DEFAULT '[]'::jsonb
- patterns_detected JSONB DEFAULT '[]'::jsonb
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
- UNIQUE(user_id, week_start)

Table `weekly_reports` dans le même fichier:
- id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- week_start DATE NOT NULL
- content TEXT NOT NULL
- generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
- UNIQUE(user_id, week_start)

Index, RLS, policies pour les deux tables.

Ajouter dans `queries.ts`: `WeeklySummaryRow`, `WeeklyReportRow`, `fetchWeeklySummaries(client, userId, limit=4)`, `fetchLatestWeeklyReport(client, userId)`.

### P3-S2 — Backend: calculateur + détecteur de patterns

Créer `nick_brain/backend/services/weekly-summary-service.ts`:
- Fonction `calculateWeeklySummary(client: AppClient, userId: string, weekStart: string): Promise<void>`
- weekStart = YYYY-MM-DD (lundi de la semaine)
- weekEnd = weekStart + 6 jours
- Agrège depuis sleep_logs (avg cycles, total cycles), daily_logs (mood_avg si mood_score présent, stress_avg si stress_score présent), user_profiles (cycle_target), life_events (events de la semaine)
- on_track = avg_cycles >= cycle_target * 0.8
- deficit = max(0, target_cycles - total_cycles) où target_cycles = cycle_target * 7
- Upsert dans weekly_summaries

Créer `nick_brain/backend/services/pattern-detector.ts`:
- Fonction `detectPatterns(summaries: WeeklySummaryRow[]): string[]`
- Summaries en ordre chronologique (du plus ancien au plus récent)
- Patterns à détecter (max 5 retournés par priorité):
  - Amélioration: avg_cycles augmente sur 3 semaines consécutives → "Sleep improving steadily (+X avg cycles over 3 weeks)"
  - Dégradation: avg_cycles baisse 2+ semaines → "Sleep trending down — recovery focus needed"
  - Corrélation stress: stress_avg > 3.5 ET avg_cycles < cycle_target → "High stress weeks correlate with poor sleep quality"
  - Meilleure semaine: "Best week: [date] (X avg cycles)"
  - Déficit accumulé: sum(deficit) > 10 → "Accumulated sleep debt: X cycles over 4 weeks"

### P3-S3 — Backend: trigger auto calcul + routes résumés

Dans le handler `POST /logs/sleep` existant (chercher le fichier qui gère cette route):
- Après sauvegarde → `setImmediate(() => { calculateWeeklySummary(...semaine précédente...) })`
- Fire-and-forget, ne pas bloquer la réponse

Créer `nick_brain/backend/handlers/summary-handler.ts`:
- `POST /summaries/calculate`: déclenche calcul semaine en cours (body: optionnel `{ week_start }`)
- `GET /summaries/recent?limit=4`: retourne les N derniers résumés

Créer `nick_brain/backend/handlers/report-handler.ts`:
- `POST /reports/generate`: génère rapport via OpenAI. Prompt système + contexte utilisateur (4 semaines de summaries + patterns). Retourne ~400 tokens. 3 sections: Weekly overview / Strengths / 2 concrete recommendations. Stocke dans weekly_reports.
- `GET /reports/weekly/latest`: retourne le dernier rapport ou null

Ajouter les 4 routes dans `server.ts`.

### P3-S4 — Backend: injection [LONG_TERM_PATTERNS] dans chat-service + rerouting rapport

Dans `buildStructuredContext()`:
- Appeler `fetchWeeklySummaries(client, userId, 4)` en parallèle (Promise.all)
- Appeler `detectPatterns(summaries)`
- Étendre `StructuredContext` + ajouter section `[LONG_TERM_PATTERNS]`:
  ```
  [LONG_TERM_PATTERNS]
  4-week avg: 4.2 cycles/night
  on_track_rate: 3/4 weeks
  patterns:
  - Sleep improving steadily (+0.3 avg cycles over 3 weeks)
  - High stress weeks correlate with poor sleep quality
  ```

Dans le chat handler (avant l'appel OpenAI), ajouter détection de mots-clés rapport:
- Si message contient 'bilan', 'rapport', 'weekly report', 'semaine', 'cette semaine' → fetch `fetchLatestWeeklyReport()`
- Si rapport existe et < 7 jours → streamer le contenu directement (pas d'appel OpenAI) avec intro "Here's your weekly report:"

### P3-S5 — Backend: cron rapport hebdomadaire

Créer `nick_brain/backend/services/weekly-report-cron.ts`:
- Fonction `scheduleWeeklyReport(supabaseAdminClient)`: lance setInterval toutes les heures
- Vérifie: est-ce lundi ? est-ce entre 07:00 et 09:00 UTC ?
- Si oui: récupère tous les user IDs actifs (users avec sleep_log dans les 7 derniers jours)
- Pour chaque user: vérifie si rapport de la semaine courante existe déjà dans weekly_reports
- Si absent: appelle POST /reports/generate en interne (ou appelle directement la fonction)
- Non-bloquant, errors silencieuses (console.error seulement)

Appeler `scheduleWeeklyReport()` dans `server.ts` au démarrage.

### P3-S6 — Mobile: section "Week in review" dans InsightsScreen + banner rapport

Ajouter dans `api.ts`:
- `getWeeklySummaries(limit?: number)` → GET /summaries/recent?limit=X
- `getLatestWeeklyReport()` → GET /reports/weekly/latest

Dans `InsightsScreen.tsx`:
- Section "This week" au-dessus du contenu existant
- Affiche: avg cycles avec comparaison semaine précédente (↑ vert / ↓ rouge), on_track badge, 1-2 patterns détectés depuis la dernière summary
- Loading state avec ActivityIndicator, empty state "No data yet" si < 7 jours de logs
- Fond card #1A2436, typographie cohérente avec le reste de l'app

Dans `HomeScreen.tsx` (étendre la logique P2-S5 des banners):
- Vérifier si c'est lundi ET rapport disponible (GET /reports/weekly/latest)
- Si oui → banner: "📊 Your weekly sleep report is ready. [Read]"
- Tap → Modal plein écran ScrollView avec contenu du rapport
- Modal: fond #0B1220, header "Weekly Report", close button, texte #E6EDF7 lineHeight 24

---

## PHASE 4 — Agent Proactif

**Objectif:** R-Lo surveille et prend des initiatives — notifications personnalisées, rapport hebdomadaire auto.

### P4-S1 — Backend: moteur de triggers proactifs

Créer `nick_brain/backend/services/trigger-engine.ts`:

Interface ProactiveTrigger:
```typescript
interface ProactiveTrigger {
  type: 'recovery_alert' | 'pre_event_coaching' | 'improvement_milestone' | 'weekly_deficit';
  priority: number;
  title: string;    // max 50 chars
  body: string;     // max 120 chars
  chat_context: string; // message pré-rempli pour le chat
  expires_at: string;   // ISO string
}
```

Fonction `checkProactiveTriggers(client, userId): Promise<ProactiveTrigger[]>`:
- recovery_alert (priority 1): 3+ nuits consécutives avec cycles_completed < 3 dans sleep_logs récents
- pre_event_coaching (priority 1): life_event ou calendar_event de type travel/important dans les 24h
- weekly_deficit (priority 2): déficit semaine courante > 8 cycles (depuis weekly_balances ou calcul manuel)
- improvement_milestone (priority 3): avg_cycles cette semaine > avg_cycles semaine précédente + 0.5
- Retourne trié par priorité

### P4-S2 — Backend: route GET /notifications/proactive

Ajouter dans `notification-handler.ts` (créer si non existant, ou ajouter à un handler existant):
- `GET /notifications/proactive`: appelle `checkProactiveTriggers()`, filtre les triggers déjà envoyés dans notification_log (même type, sent_at < expires_at), retourne le plus prioritaire ou `{ trigger: null }`
- Si trigger trouvé: INSERT dans notification_log, retourne le trigger
- `POST /notifications/dismiss`: body `{ trigger_type }`, INSERT dans notification_log avec expires_at = now() + 24h

Ajouter dans `server.ts`.

### P4-S3 — Mobile: polling proactif + push locale

Créer `apps/mobile/lib/proactive-notifications.ts`:
- Fonction `initProactiveNotifications(): void`
- Utilise AppState (expo `AppState`) pour détecter quand l'app revient au premier plan
- À chaque foreground: vérifie cooldown 2h (`@r90:lastProactiveCheck` AsyncStorage)
- Si > 2h: appelle `GET /notifications/proactive`
- Si trigger retourné: créer notification locale via expo-notifications
  - Titre et body du trigger
  - data: `{ trigger_type, chat_context }`
- Tap sur notif → `Notifications.addNotificationResponseReceivedListener` → stocker chat_context dans `@r90:pendingChatContext`, naviguer vers /(tabs)

Dans `app/_layout.tsx`: appeler `initProactiveNotifications()` après auth.
Dans `HomeScreen.tsx` au montage: vérifier `@r90:pendingChatContext`, si présent → pré-remplir input et clear AsyncStorage.

Ajouter dans `api.ts`: `getProactiveTrigger()` et `dismissTrigger(trigger_type: string)`.

### P4-S4 — Mobile: banner rapport hebdomadaire (extension P3-S6)

(Si P3-S6 a bien implémenté le banner rapport dans HomeScreen, cette step est déjà couverte. Sinon l'implémenter ici.)

Vérifier que:
- Le lundi matin, si rapport disponible → banner "📊 Your weekly sleep report is ready"
- Modal plein écran avec contenu
- Dismissible

### P4-S5 — Mobile: notification locale "rapport prêt"

Dans `proactive-notifications.ts`:
- Ajouter trigger supplémentaire: vérifier si rapport de la semaine disponible (`GET /reports/weekly/latest`)
- Si rapport < 24h et pas encore notifié → créer notification locale:
  - Titre: "Your weekly sleep report is ready"
  - Body: "R-Lo has analyzed your past week. Tap to read."
- Cooldown: 1 fois par semaine (stocker dans AsyncStorage `@r90:weeklyReportNotified`)

---

## PHASE 5 — Tool-Calling LLM

**Objectif:** Le LLM appelle dynamiquement les données au lieu de recevoir un bloc statique.

### P5-S1 — Backend: définitions des outils OpenAI

Créer `nick_brain/backend/services/tool-definitions.ts`:

Exporter `SLEEP_COACH_TOOLS` array au format OpenAI function calling:

```typescript
export const SLEEP_COACH_TOOLS = [
  {
    type: "function",
    function: {
      name: "query_sleep_history",
      description: "Get the user's sleep logs for the past N days. Returns cycles completed, wake time, sleep onset, and disruptions for each night.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Number of days to look back (1-30)", minimum: 1, maximum: 30 }
        },
        required: ["days"]
      }
    }
  },
  // ... 5 autres outils:
  // get_calendar_events(hours_ahead: number)
  // get_life_events(include_past: boolean)
  // get_weekly_balance() — no params
  // get_readiness_score() — no params, returns T7 readiness from engine
  // get_lifestyle_profile() — no params, returns stress/env/exercise/alcohol
];
```

### P5-S2 — Backend: exécuteur d'outils

Créer `nick_brain/backend/services/tool-executor.ts`:

```typescript
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  client: AppClient
): Promise<string>
```

Dispatcher:
- `query_sleep_history`: fetchSleepLogs(client, userId, days) → JSON string
- `get_calendar_events`: fetchUpcomingCalendarEvents(client, userId, hours_ahead) → JSON string
- `get_life_events`: fetchRecentLifeEvents(client, userId) → JSON string
- `get_weekly_balance`: depuis weekly_balances table → JSON string
- `get_readiness_score`: charger le contexte + runEngine → T7 readiness score → JSON string
- `get_lifestyle_profile`: fetch user_profiles lifestyle fields → JSON string

Timeout 3s via `Promise.race` avec timeout. En cas d'erreur: retourner `JSON.stringify({ error: "data temporarily unavailable" })`.
Ne pas throw, jamais de console.log.

### P5-S3 — Backend: refactor chat-service avec boucle tool-calling

Dans `nick_brain/backend/services/chat-service.ts`:

Modifier `streamChatResponse()`:
1. Réduire le contexte statique: garder seulement [USER_PROFILE] de base + [CURRENT_STATE] dans system prompt (les données détaillées viennent via tool calls)
2. Premier appel OpenAI: inclure `tools: SLEEP_COACH_TOOLS, tool_choice: "auto"`
3. Si response contient `tool_calls`:
   - Pour chaque tool_call: exécuter via `executeTool()`
   - Pendant l'exécution: envoyer `data: {"status":"thinking","tool":"<name>"}\n\n` toutes les 800ms
   - Ajouter résultats comme messages `role: "tool"` dans le contexte
   - Faire un second appel OpenAI avec les résultats
4. Max 3 itérations de boucle
5. Fallback si tool calling échoue: revenir au contexte statique complet (le comportement actuel)
6. Après obtention de la réponse finale: fake-stream mot-par-mot (18ms delay) comme avant

IMPORTANT: l'API OpenAI pour le streaming avec tools est différente. Utiliser non-streaming pour la boucle tool-calling, puis fake-stream la réponse finale. (Le comportement de fake-stream existant reste inchangé pour l'output final.)

### P5-S4 — Mobile: indicateur "R-Lo thinks" dans RLoChat

Dans `apps/mobile/components/RLoChat.tsx`:

Dans le handler XHR `onprogress` qui parse le stream:
- Parser les chunks: si chunk contient `"status":"thinking"` → activer état `isThinking = true`
- Si chunk contient `"delta"` → désactiver `isThinking`
- Ajouter dans le rendu: si `isThinking && streamingMessage === ""` → afficher bulle animée:
  - Texte: "R-Lo is checking your data…"
  - Fond: surface2 (#243046)
  - Texte: muted (#6B7F99)
  - 3 points animés (pulse avec Animated.loop + Animated.sequence)
  - Style cohérent avec les bulles R-Lo existantes

### P5-S5 — Backend: logging des tool calls

Dans `tool-executor.ts`, après chaque exécution d'outil:
- INSERT dans `tool_call_logs` (créer la table inline via migration si absente, ou ajouter à migration 006):
  - Colonnes: id, user_id, tool_name TEXT, duration_ms INT, success BOOLEAN, created_at
  - Fire-and-forget (ne pas await, ne pas bloquer)
- Ajouter route interne `GET /admin/tool-logs?limit=20` sans auth check (pour debug)

Table à ajouter dans `006_weekly_summaries.sql`:
```sql
CREATE TABLE IF NOT EXISTS tool_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  duration_ms INT,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tool_call_logs_user ON tool_call_logs(user_id, created_at DESC);
-- Pas de RLS sur cette table (logs internes uniquement)
```

---

## APRÈS CHAQUE PHASE

1. `cd /Users/thomas/Projects/Nick/App/nick_brain && npm run build` — doit être clean
2. `cd /Users/thomas/Projects/Nick/App/mobile/apps/mobile && npx tsc --noEmit` — clean sauf expo-intent-launcher
3. `cd /Users/thomas/Projects/Nick/App/mobile && git add -A && git commit -m "feat: Phase X — description" && git push origin main`

---

## ORDRE D'EXÉCUTION STRICT

1. Phase 0 — Auto-migration runner
2. Phase 2 — S1, S2, S3, S4, S5 dans l'ordre
3. Phase 3 — S1, S2, S3, S4, S5, S6 dans l'ordre
4. Phase 4 — S1, S2, S3, S4, S5 dans l'ordre
5. Phase 5 — S1, S2, S3, S4, S5 dans l'ordre

Ne jamais travailler sur deux phases en parallèle.
Toujours vérifier TypeScript avant de committer.
En cas de doute sur une décision d'architecture, choisir la solution la plus simple qui respecte les patterns existants.
Explore le code existant AVANT d'implémenter pour comprendre les patterns réels.

---

## NOTIFICATION FINALE

Quand TOUT est terminé (toutes les phases, TypeScript clean, commits pushés), exécuter:
```bash
openclaw system event --text "R90 Agent IA — Roadmap complète terminée (Phase 0 → 5). TypeScript clean. Commits pushés." --mode now
```
