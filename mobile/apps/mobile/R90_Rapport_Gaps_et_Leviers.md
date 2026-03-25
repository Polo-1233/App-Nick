# Rapport de Gaps & Leviers — R90 Navigator
## Croisement App Actuelle × Analyse Concurrentielle

*Mars 2026 — Thomas Labarrière*

---

# MÉTHODE

Ce rapport croise l'inventaire complet des features actuellement implémentées dans le codebase React Native (Expo 54) de R90 Navigator avec les 15 patterns et recommandations issus de l'analyse concurrentielle de 15 apps (RISE, Calm, Headspace, Duolingo, Strava, Noom, etc.). Pour chaque pattern identifié, le statut est : ✅ Implémenté, 🟡 Partiellement implémenté, ou ❌ Absent.

---

# SYNTHÈSE EXÉCUTIVE

| Catégorie | Implémenté | Partiel | Absent | Score |
|-----------|-----------|---------|--------|-------|
| Onboarding | 5/8 | 2/8 | 1/8 | 75% |
| Home & Daily Loop | 6/8 | 1/8 | 1/8 | 81% |
| Gamification | 4/10 | 3/10 | 3/10 | 55% |
| Rétention | 4/9 | 3/9 | 2/9 | 61% |
| Monétisation | 3/8 | 2/8 | 3/8 | 50% |
| UX/Design | 5/8 | 1/8 | 2/8 | 69% |
| Contenu | 3/7 | 2/7 | 2/7 | 57% |
| Social & Communauté | 0/6 | 0/6 | 6/6 | 0% |
| **GLOBAL** | **30/64** | **14/64** | **20/64** | **58%** |

**Verdict** : L'app a un core solide (méthodologie R90, daily loop, R-Lo, gamification de base) mais manque de leviers critiques en monétisation, social/communauté, et contenu frais. Les gains les plus rapides sont sur le paywall, le partage, et le widget.

---

# PARTIE 1 — ONBOARDING

## ✅ Ce qui est déjà bien fait

**Value-First Onboarding** (Pattern Headspace/Duolingo)
L'onboarding démarre par le "myth des 8h" (Step 0) comme hook éducatif, suivi d'une visualisation des cycles. L'utilisateur reçoit de la valeur (compréhension de la méthode R90) avant de créer un compte. Le plan personnalisé est montré AVANT le paywall via `OnboardingPlanOverlay`. C'est exactement le pattern recommandé.

**Social Proof d'Expert** (Pattern Peloton/Noom)
Step 2 cite Nick Littlehales, Man United, Team Sky, Ronaldo, Olympics. L'autorité est établie tôt dans le flow.

**Personnalisation progressive** (Pattern Noom/Flo)
3 données collectées progressivement : chronotype (Step 4), anchor time (Step 5), nombre de cycles (Step 6). Le résultat ("voilà ton rythme") est le aha moment.

**Aha Moment clair**
Le rhythm preview live à Step 5 montre en temps réel comment la journée se structure quand l'utilisateur déplace le wake time. C'est un aha moment fort.

## 🟡 Partiellement implémenté

**Onboarding long éducatif** (Pattern Noom 77 écrans, Flo 55 écrans)
L'onboarding actuel fait 7 steps — c'est court vs les leaders en conversion. Noom a prouvé que chaque question supplémentaire bien designée AUGMENTE la conversion (77 écrans en 2025 vs 26 en 2020). L'investissement en temps crée du sunk cost cognitif.

> **LEVIER** : Ajouter 5-8 écrans éducatifs entre les steps actuels. Exemples : quiz "Sais-tu combien d'heures tu dors vraiment ?" (comme Noom), écran sur l'impact du sommeil sur la performance (stats), écran "Tes résultats" avec le profil de sommeil (comme l'effet Barnum de Noom). Objectif : 12-15 écrans total, ~3-4 minutes.

**Daily Reminder Prompt** (Pattern Calm — 40% d'opt-in = 3x rétention)
Les notifications sont implémentées mais le prompt de rappel quotidien n'apparaît pas pendant l'onboarding. Calm demande à l'utilisateur de choisir son rappel quotidien APRÈS la première méditation et obtient 40% d'opt-in, drivant 3x la rétention.

> **LEVIER** : Après la morning confirmation du premier jour, proposer de choisir l'heure du rappel matinal ("À quelle heure veux-tu que R-Lo te réveille demain ?"). Intégrer dans `contextual-permissions.ts`.

## ❌ Absent

**Commitment Pact** (Pattern Headway)
Headway demande à l'utilisateur de signer un "engagement personnel" avant de voir le prix. C'est un prime psychologique qui augmente la conversion.

> **LEVIER** : Ajouter un écran "Mon engagement R90" juste avant le paywall. L'utilisateur sélectionne son objectif ("Dormir mieux", "Plus d'énergie", "Performer comme un athlète") et tape un bouton "Je m'engage." Engagement public = motivation accrue. Fichier cible : `onboarding.tsx`, ajouter un step entre la génération du plan et le paywall.

---

# PARTIE 2 — HOME SCREEN & DAILY LOOP

## ✅ Ce qui est déjà bien fait

**Pertinence toute la journée** (Pattern RISE — seule app pertinente matin→soir)
Le `action-state.ts` est un state machine sophistiqué qui détecte la phase du jour (morning, MRM, CRP, wind-down, sleep) et affiche l'ActionCard correspondante. C'est LE différenciateur de R90 vs toute la concurrence. 4-5 touchpoints quotidiens vs 1-2 pour Sleep Cycle/Pillow.

**R-Lo contextuel** (Pattern Calm Daily Calm, Peloton instructeur)
`rlo-message.ts` génère des messages comportementaux uniques basés sur le streak, le niveau, l'historique de wind-down. Les messages de milestones Nick ("7 days. Same protocols as Premier League players.") sont excellents.

**Ambient Background circadien**
Le gradient d'arrière-plan change selon l'heure du jour et le wake time de l'utilisateur. Aucun concurrent ne fait ça.

**Non-punitive Missed Cycle**
La notification N5 dit explicitement "No stress" et recadre positivement. 3 notifications ont été retirées car "pressuring." C'est exactement le pattern recommandé (anti-Duolingo culpabilisant).

## 🟡 Partiellement implémenté

**"Quoi faire maintenant" ultra-clair** (Pattern Duolingo — prochaine leçon toujours visible)
L'ActionCard est bien le CTA principal, mais il n'y a pas de countdown visible vers le prochain événement (ex: "CRP dans 2h14") sur le home screen en mode passif. RISE montre un timer permanent vers la fenêtre de mélatonine.

> **LEVIER** : Ajouter un countdown subtil sous l'ActionCard quand le prochain événement est > 30 min. "MRM dans 47 min" ou "Wind-down dans 3h". Fichier cible : `ActionCard.tsx`, utiliser les données de `action-state.ts` qui calcule déjà `nextEvent`.

## ❌ Absent

**Widget iOS** (Pattern RISE, Headspace, Duolingo)
Pas de widget trouvé dans le codebase. RISE montre la dette de sommeil sur le widget. Headspace montre du contenu contextuel par heure. Duolingo montre le streak.

> **LEVIER PRIORITAIRE** : Créer un widget iOS natif (Swift, via expo-widget ou target Xcode) montrant :
> - **Small** : Prochain événement R90 + countdown ("CRP in 45 min")
> - **Medium** : Timeline condensée du jour avec position actuelle + streak
> - **Large** : Timeline + R-Lo message du jour
>
> Impact estimé : +15-20% d'engagement passif (l'utilisateur voit R90 sans ouvrir l'app). Fichiers cibles : créer `/ios/R90Widget/` target dans Xcode.

---

# PARTIE 3 — GAMIFICATION

## ✅ Ce qui est déjà bien fait

**Streak avec grâce** (Pattern Duolingo Streak Freeze)
Le Rhythm Flow a une "grace rule" : le streak ne reset qu'après 2 jours manqués (pas 1). C'est mieux que le hard reset de Headway. Conforme à la recommandation "Rhythm Shield."

**Niveaux qui ne descendent jamais** (Pattern unique R90)
Le Rhythm Depth a un "soft decay" sur 3 semaines mais ne retombe jamais à 0 et le niveau ne descend jamais. C'est un différenciateur vs toute la concurrence. Aucune app analysée ne fait ça.

**Points d'action** (Pattern Duolingo XP)
Le système de Rhythm Points (ARP=5, MRM=2, CRP=5, wind-down=3) existe et est visible dans StreakDetail.

**Milestone celebrations** (Pattern Peloton badges)
Les milestones à 3, 7, 14, 30, 60, 100 jours sont détectés et célébrés avec le mascot en mode "celebration."

## 🟡 Partiellement implémenté

**Badges/Achievements** (Pattern Duolingo — +13% achats, +116% ajouts amis)
Les milestones existent mais il n'y a PAS de système de badges visuel persistant. Duolingo a 10+ types de badges. Calm a un Trophy Case. Headspace a des badges par milestone.

> **LEVIER** : Créer un système de badges visuels stockés dans le profil. Suggestions :
> - "First Week" (7 jours de streak)
> - "Cycle Master" (35 cycles en une semaine)
> - "Night Owl to Morning Lark" (changement de chronotype réussi)
> - "Recovery Pro" (30 CRP complétés)
> - "Wind-Down Warrior" (30 wind-downs consécutifs)
> - "R90 Certified" (niveau Calibrated atteint)
> - "Elite Rhythm" (niveau Embodied)
> - "Nick's Inner Circle" (niveau Integrated)
>
> Fichiers cibles : créer `lib/badges.ts` + composant `BadgeCase.tsx` dans le profil.

**Progression visible en permanence** (Pattern Duolingo streak 3-4x la taille normale)
Le streak et le niveau sont visibles en header du HomeScreen mais pas très proéminents. Duolingo rend le streak IMPOSSIBLE à ignorer.

> **LEVIER** : Rendre le streak + niveau plus visuellement proéminents sur le home. Animation bounce quand le streak augmente (déjà partiellement implémenté). Ajouter une micro-animation au Rhythm Depth quand il progresse.

**Weekly Recap enrichi** (Pattern Strava Year in Review, Blinkist Year in a Blink)
Le WeeklyRecap existe (dimanche/lundi) mais son contenu n'est pas détaillé dans le code. Blinkist fait un "Year in a Blink" personnalisé qui réengage 15% des utilisateurs dormants.

> **LEVIER** : Enrichir le WeeklyRecap avec des stats partageables : "Cette semaine : X cycles, Y MRMs, streak de Z jours, niveau [Nom]." Ajouter un bouton "Partager mon recap." Fichier cible : `WeeklyRecap.tsx`.

## ❌ Absent

**Challenges hebdomadaires** (Pattern SleepScore, Duolingo quests, Peloton challenges)
Aucun système de challenges trouvé. Duolingo propose 3 quests quotidiennes. SleepScore a des challenges de 7 jours (Exercice, Caféine, etc.). Peloton a des challenges mensuels.

> **LEVIER** : Ajouter des "R90 Challenges" hebdomadaires alignés avec les KSPIs :
> - "Semaine Rythme" : Confirmer ARP 7/7 jours
> - "Semaine Récupération" : Compléter 5 CRP
> - "Semaine Wind-Down" : 5 wind-downs complets avec contenu audio
> - "Semaine Cycle Parfait" : Atteindre 35 cycles
>
> Fichier cible : créer `lib/challenges.ts` + composant `WeeklyChallenge.tsx`.

**Leaderboards locaux/segmentés** (Pattern Strava segments, Duolingo leagues de 30)
Aucune fonctionnalité de compétition sociale. Strava a prouvé que les leaderboards locaux (pas globaux) drivent l'engagement de haute valeur.

> **LEVIER (V2)** : Préparer l'infrastructure pour des "R90 Teams" (entreprises, équipes sportives, groupes d'amis). Leaderboards hebdomadaires sur le Rhythm Score. Groupes de 10-30 (atteignabilité perçue). Le B2B de Nick avec les équipes sportives rend ce canal naturel.

**XP visible et gratifiant** (Pattern Duolingo — XP visibles immédiatement)
Les Rhythm Points existent techniquement mais ne sont visibles que dans le StreakDetail modal. Duolingo montre les XP en animation immédiate après chaque action.

> **LEVIER** : Montrer un toast "+5 points" animé après chaque action récompensée. Le `RhythmPointsToast` existe déjà comme composant — vérifier qu'il est effectivement affiché à chaque gain de points dans les flows MRM, CRP, wind-down, morning confirmation.

---

# PARTIE 4 — RÉTENTION

## ✅ Ce qui est déjà bien fait

**Multi-touchpoint quotidien** (Pattern RISE)
L'app est pertinente 4-5 fois par jour (morning, MRM×3, CRP, wind-down, goodnight). C'est un avantage structurel massif.

**R-Lo comme driver de rétention** (Pattern Calm Daily Calm, Peloton instructeur)
Les messages comportementaux de R-Lo réagissent aux données réelles (streak, depth, wind-down history). Les messages Nick à 7/14/30 jours sont bien conçus.

**Non-punitive design** (Pattern Calm, Headspace, Noom)
La grace rule (2 jours), les niveaux qui ne descendent jamais, la notification "No stress" — tout est cohérent avec la philosophie non-punitive recommandée.

**Éducation progressive par niveau** (Pattern Noom leçons CBT)
Le Rhythm Depth débloque progressivement du contenu par niveau (Aware → Integrated). C'est exactement le pattern Noom de "leçons quotidiennes débloquées par progression."

## 🟡 Partiellement implémenté

**Daily Fresh Content** (Pattern Calm Daily Calm — driver de rétention #1, 3x rétention)
Le content rotation (`getNextContent()` dans `rhythm-depth.ts`) évite les répétitions mais ce n'est PAS du contenu frais quotidien. C'est de la rotation de contenu existant. Le Daily Calm de Calm est une NOUVELLE méditation CHAQUE matin.

> **LEVIER CRITIQUE** : Créer un "Daily R90 Insight" — un contenu frais quotidien. Options :
> 1. **R-Lo Daily Insight** (IA) : Un tip contextuel de 2-3 phrases généré par l'IA basé sur le profil/semaine de l'utilisateur. Peu de coût de production. Livrable rapidement.
> 2. **Nick's Minute** (premium) : 60 secondes audio de Nick sur un aspect du sommeil. 30 enregistrements = 1 mois de contenu. Coût de production modéré mais impact de rétention massif.
> 3. **Coach Insight du jour** (texte) : Un insight éducatif issu des 7 KSPIs débloqué quotidiennement. Peut être pré-écrit en batch.
>
> Fichier cible : ajouter `dailyInsight` dans `coach-insights.ts` ou `rlo-message.ts`.

**Sunk Cost progressif** (Pattern Strava historique d'activités, Duolingo streak + arbre)
L'accumulation de données existe (sleep history, streak, points, niveau) mais n'est pas assez visible. Strava montre l'historique complet d'activités. Duolingo montre l'arbre de compétences qui "se remplit."

> **LEVIER** : Rendre l'historique de sommeil plus visuel et gratifiant. Un calendrier type GitHub contribution graph (vert = aligned, gris = manqué) sur la page Insights ou Profil. Chaque semaine verte ajoute du "poids" à l'historique. Fichier cible : enrichir `InsightsScreen.tsx`.

**Flux de réengagement par paliers** (Pattern Headspace Early/Medium/Late/Long Lapse)
Les notifications de missed cycle existent mais il n'y a PAS de stratégie de réengagement pour les utilisateurs inactifs 3+ jours. Headspace fait : Early Lapse (7-14j) = rappel doux + nouveau contenu. Medium (15-30j) = reconnaissance de progrès. Late (30-60j) = réductions. Long (60+j) = réductions majeures.

> **LEVIER** : Implémenter un flux de winback par paliers :
> - 3 jours : Push R-Lo "Your rhythm is still there. Tap to pick up where you left off."
> - 7 jours : Push + email "Your sleep data from last week shows..."
> - 14 jours : Push + contenu nouveau mis en avant
> - 30+ jours : Offre de réengagement (discount si applicable)
>
> Fichier cible : créer `lib/winback.ts` + logique dans `proactive-notifications.ts`.

## ❌ Absent

**Moments screenshot partageables** (Pattern Strava cartes, Duolingo milestones, Peloton badges)
AUCUN mécanisme de partage trouvé dans le codebase. Les level-ups et milestones sont purement internes. Duolingo a prouvé que les badges partageables augmentent les ajouts d'amis de 116%.

> **LEVIER PRIORITAIRE** : Ajouter un bouton "Partager" sur :
> 1. Level-up modal → Carte visuelle "I'm now [Level] on R90 🌙" avec branding
> 2. Weekly Recap → Image résumé de la semaine
> 3. Milestone streaks (7, 30, 100 jours) → "100 days of R90 rhythm 🔥"
>
> Utiliser `react-native-share` ou `expo-sharing`. Créer un composant `ShareCard.tsx` qui génère une image attrayante. Fichier cible : `components/ShareCard.tsx` + intégration dans `HomeScreen.tsx` (level-up), `WeeklyRecap.tsx`, `StreakDetail.tsx`.

**Identity reinforcement explicite** (Pattern Strava "I'm a runner", Duolingo "200-day streak")
Le système de niveaux CRÉE une identité (Aware → Integrated) mais elle n'est pas verbalisée ni renforcée. R-Lo ne dit jamais "Tu es maintenant Calibrated — tu rejoins les 5% qui maîtrisent leur rythme."

> **LEVIER** : Ajouter des messages R-Lo d'identité après chaque level-up et à intervalles réguliers :
> - "You're Attuned now. You sleep with more intention than 90% of people."
> - "Calibrated means your rhythm is becoming second nature. Like the athletes Nick coaches."
> - "Embodied. Your body knows the rhythm before your mind does."
>
> Fichier cible : enrichir `rlo-mood.ts` avec des messages post-level-up orientés identité.

---

# PARTIE 5 — MONÉTISATION & PAYWALL

## ✅ Ce qui est déjà bien fait

**Plan personnalisé avant paywall** (Pattern Noom, Flo)
L'`OnboardingPlanOverlay` montre la génération puis la révélation du plan AVANT le paywall. L'utilisateur voit sa journée R90 personnalisée puis est invité à s'abonner. C'est le bon ordre.

**RevenueCat intégré** (infrastructure)
L'infrastructure de monétisation est en place : RevenueCat, monthly/yearly/lifetime, premium gating, customer center.

**Honnêteté du trial** (Pattern Blinkist)
Le paywall montre "Free for 7 days, then [prix]" — c'est un début de timeline honnête.

## 🟡 Partiellement implémenté

**Timeline Honest Paywall** (Pattern Blinkist — +23% sign-ups, -55% plaintes, +4% rétention)
Le paywall montre le prix après trial MAIS ne montre PAS la timeline visuelle complète de Blinkist : (1) Trial commence → (2) Rappel 2 jours avant → (3) Facturation à [DATE].

> **LEVIER PRIORITAIRE** : Refaire le paywall avec une timeline visuelle en 3 étapes :
> ```
> Jour 0: ✅ Essai gratuit — accès complet
> Jour 5: 🔔 On t'envoie un rappel
> Jour 7: 💳 Ton abonnement commence ($X.XX/mois)
> ```
> Blinkist a vu +1,200% d'opt-in notifications et +23% de sign-ups avec ce pattern. Le messaging "We'll remind you 2 days before" réduit l'anxiété du trial.
>
> Fichier cible : `app/subscription.tsx` (refonte du composant paywall).

**Social Proof sur le paywall** (Pattern Noom témoignages, Calm célébrités, Flo carousel)
Le paywall liste 4 bénéfices mais n'a AUCUN témoignage, AUCUNE stat utilisateur, AUCUN social proof. Noom montre des témoignages émotionnels. Flo a un carousel de reviews. Calm met en avant ses narrateurs célébrités.

> **LEVIER** : Ajouter au paywall :
> 1. Un chiffre social ("Join 10,000+ users who improved their sleep rhythm")
> 2. 2-3 témoignages courts en carousel ("I finally wake up without an alarm. — Sarah, 3 months")
> 3. La mention Nick Littlehales ("Created by the sleep coach of Cristiano Ronaldo")
>
> Fichier cible : `app/subscription.tsx`.

## ❌ Absent

**Paywall émotionnel avec ancrage de prix** (Pattern Noom — ancrage vs thérapeute $100/h)
Noom compare son prix au coût d'un thérapeute privé. R90 Navigator ne fait aucun ancrage de prix.

> **LEVIER** : Ajouter un ancrage contextuel : "Less than the cost of one bad night's sleep" ou "For the price of a coffee a week, sleep like the world's best athletes." Calculer et afficher le prix par jour ("$0.22/day").
>
> Fichier cible : `app/subscription.tsx`.

**Stratégie de reconquête/discount escaladant** (Pattern Blinkist — Jour 3=50%, Jour 6=60%, Jour 7=75%)
Aucune stratégie de reconquête pour les utilisateurs qui refusent le paywall. Blinkist a un système de discounts escaladants sur 7 jours.

> **LEVIER** : Après refus du paywall initial :
> - Jour 3 : Push "Your rhythm plan is still saved. Start your free trial."
> - Jour 7 : Push + 20% discount "Special offer: try R90 Premium for [prix réduit]"
> - Jour 14 : Email + 40% discount annuel uniquement (drive LTV)
>
> Fichier cible : créer `lib/reconquest.ts` + logique dans `proactive-notifications.ts`.

**Paywall contextuel** (Pattern Calm — paywall dynamique selon le contenu tenté)
Le paywall actuel est systématique (post-onboarding). Il n'y a pas de paywall contextuel quand l'utilisateur tape sur du contenu premium verrouillé. Calm change le texte du paywall selon le contenu que l'utilisateur a essayé d'accéder.

> **LEVIER** : Quand l'utilisateur tape sur un contenu verrouillé (sleep story premium, CRP avancé), montrer un mini-paywall contextuel avec le contenu en arrière-plan : "Unlock [nom du contenu] with R90 Premium." Le composant `PremiumGate` existe déjà (`use-premium-gate.ts`) — enrichir son UX avec un overlay contextuel plutôt qu'une redirection vers la page subscription.
>
> Fichier cible : enrichir `PremiumGate` dans tous les points de contact contenu.

---

# PARTIE 6 — UX & DESIGN

## ✅ Ce qui est déjà bien fait

**Dark mode natif** : Thème dark par défaut + light + system. Essentiel pour une app sommeil.

**Mascotte émotionnelle** : R-Lo avec 8 émotions (celebration, encourageant, rassurante, inquiet, etc.). C'est plus riche que le Duo owl de Duolingo (5-6 émotions principales).

**Haptic feedback** : Implémenté via `utils/haptics.ts` (light, success, custom).

**Animations contextuelles** : 3 variantes d'animation audio (breathing circle, ondulation, star particles). Transitions douces.

**Navigation tabs claire** : 4 tabs (Home, Planning, Coach, Profile) — clean et standard.

## 🟡 Partiellement implémenté

**Guided tours** (Pattern Headspace progressive disclosure)
Le HomeOrientationGuide (3 steps spotlight) et les FeatureDiscovery tooltips existent. Mais les tooltips ne couvrent que les features du home. Les écrans Planning, Insights et Profile n'ont pas de tour guidé.

> **LEVIER** : Étendre les tooltips à Planning ("Here's your weekly cycle target"), Insights ("Track your rhythm consistency"), Profile ("Customize your chronotype and settings"). Fichier cible : enrichir `onboarding-guide.ts`.

## ❌ Absent

**Apple Watch** (Pattern Sleep Cycle standalone, Pillow native, Calm watchOS)
Aucun code watchOS trouvé. Pas de target Xcode watchOS. Sleep Cycle a une app standalone. Pillow est native Watch. Calm a des exercices de respiration au poignet.

> **LEVIER (V2)** : Créer une app Apple Watch minimaliste :
> - Complication : Prochain événement R90 + countdown
> - App : Morning confirmation (tap pour confirmer ARP). MRM rapide (2 min breathing au poignet). Wind-down reminder.
> - Intégration : Lecture des données de sommeil HK pour calcul automatique des cycles effectués.
>
> Impact : Réduit la friction du morning confirmation à 0 (tap au poignet vs ouvrir l'app). Cible : créer target watchOS dans le projet Xcode.

**Sons d'ambiance optionnels dans l'app** (Pattern Calm, BetterSleep)
Les sons existent dans le wind-down et les players mais il n'y a pas de son d'ambiance dans l'app elle-même (un "breathing sound" subtil sur le home, un son doux quand on confirme ARP). Calm a des sons de notification apaisants.

> **LEVIER MINEUR** : Ajouter des micro-sons optionnels : son doux au morning confirmation, son d'ambiance subtil optionnel sur le home screen pendant le wind-down window. Paramétrable dans Settings. Fichier cible : `utils/haptics.ts` → `utils/haptics-and-sounds.ts`.

---

# PARTIE 7 — CONTENU & ÉDUCATION

## ✅ Ce qui est déjà bien fait

**Contenu audio diversifié** : MRM (3 breathing, 2 movement, 2 sensory), CRP (3 meditation, 1 NSDR, 1 relaxation), Wind-down (7 sleep stories, soundscapes, breathing). Total ~20 items.

**Rotation intelligente** : `getNextContent()` sélectionne le moins récemment joué. Pas de répétition ennuyeuse.

**Déblocage progressif par niveau** : Chaque niveau débloque du contenu additionnel.

## 🟡 Partiellement implémenté

**Volume de contenu** (Pattern Calm 500+ stories, BetterSleep 300+ sons)
~20 items audio est très en-dessous des leaders. Calm a 500+ Sleep Stories. BetterSleep a 300+ sons. MAIS la stratégie "qualité > quantité" est cohérente pour un lancement.

> **LEVIER** : Planifier un pipeline de contenu :
> - Court terme (3 mois) : +10 sleep stories, +5 sessions NSDR, +3 soundscapes = ~40 items total
> - Moyen terme (6 mois) : +20 stories, +10 NSDR, +10 soundscapes = ~80 items
> - Long terme : R-Lo peut générer du contenu personnalisé par IA (insight du jour, breathing guidé adapté)
>
> Fichier cible : étendre `content-registry.ts`.

**Contenu de Nick Littlehales** (Pattern Peloton instructeur, Calm Tamara Levitt)
Nick est mentionné dans l'onboarding et les messages R-Lo mais il n'y a pas de contenu AUDIO de Nick dans la bibliothèque. Peloton retient par la voix de l'instructeur. Calm par la voix de Tamara Levitt.

> **LEVIER CRITIQUE** : Enregistrer du contenu audio avec Nick :
> - 7 "Coach Insights" audio (1 min chacun) sur chaque KSPI — débloqués par niveau
> - 3-5 Sleep Stories racontées par Nick (anecdotes de Man United, récits de voyages avec les équipes)
> - 1 message d'intro audio pour chaque niveau atteint
>
> Impact : La voix de Nick crée un lien émotionnel irremplaçable. C'est l'asset de rétention le plus sous-exploité de l'app.

## ❌ Absent

**Micro-learning éducatif structuré** (Pattern Noom 3 articles/jour, Headway flashcards)
Le contenu éducatif est dispersé dans les messages R-Lo et les tooltips mais il n'y a PAS de "leçon du jour" structurée sur la science du sommeil. Noom sert 3 articles par jour basés sur la psychologie comportementale. Headway utilise des flashcards à répétition espacée.

> **LEVIER** : Créer un "R90 Learn" avec des micro-leçons de 2 minutes :
> - Semaine 1-2 : Basics (cycles, chronotype, dette de sommeil)
> - Semaine 3-4 : Intermédiaire (timing caféine, lumière, exercice)
> - Semaine 5+ : Avancé (environnement, interventions, technique R90)
> - Format : 3 écrans/leçon (fait → explication → action)
> - Déblocage : 1 leçon/jour, aligné avec le niveau Rhythm Depth
>
> Fichier cible : créer `lib/learn.ts` + écran `app/learn.tsx` + tab optionnelle ou section dans Coach.

**Contenu communautaire ou UGC** (Pattern Strava)
Aucun contenu généré par les utilisateurs. Strava vit de l'UGC (activités, segments, kudos).

> **LEVIER (V3)** : Considérer des "Sleep Tips" partagés par la communauté, des témoignages de transformation, des astuces de wind-down. Pas prioritaire pour V1.

---

# PARTIE 8 — SOCIAL & COMMUNAUTÉ

## ❌ Entièrement absent

C'est le gap le PLUS important de l'app. Aucune fonctionnalité sociale n'existe :

| Feature sociale | Duolingo | Strava | Peloton | R90 Navigator |
|----------------|----------|--------|---------|---------------|
| Profil d'amis | ✅ | ✅ | ✅ | ❌ |
| Feed d'activité | ❌ | ✅ | ✅ | ❌ |
| Kudos/Likes | ❌ | ✅ | ✅ | ❌ |
| Leaderboards | ✅ | ✅ | ✅ | ❌ |
| Challenges de groupe | ✅ | ✅ | ✅ | ❌ |
| Partage externe | ✅ | ✅ | ✅ | ❌ |
| Invitations/Referral | ✅ | ✅ | ✅ | ❌ |

> **LEVIERS PAR PRIORITÉ** :
>
> **P1 — Partage externe (quick win)** : Bouton "Share" sur level-ups, milestones, weekly recaps. Génère une image brandée. Zéro infrastructure backend.
>
> **P2 — Referral basique** : "Invite a friend to try R90" avec lien de referral. Le parrain gagne 1 semaine de premium gratuit. Le filleul obtient 14 jours de trial au lieu de 7.
>
> **P3 — Challenges de groupe** : "Start a 7-day R90 Challenge" avec 2-5 amis. Leaderboard privé sur le Rhythm Score. Push quotidien "Sarah a confirmé son ARP. Toi aussi ?"
>
> **P4 — Teams/Entreprises (B2B)** : Dashboard pour coachs sportifs/managers. Rhythm Score agrégé par équipe. Le canal B2B de Nick rend ça naturel.

---

# MATRICE DES LEVIERS — PRIORISATION

| # | Levier | Impact | Effort | Priorité | Référence |
|---|--------|--------|--------|----------|-----------|
| 1 | **Timeline Honest Paywall** | 🔴 Critique | Faible | P0 | Blinkist +23% sign-ups |
| 2 | **Social proof sur paywall** (témoignages + stats) | 🔴 Critique | Faible | P0 | Noom, Flo, Calm |
| 3 | **Bouton Partage** (level-up, recap, milestones) | 🔴 Élevé | Faible | P0 | Strava, Duolingo +116% amis |
| 4 | **Daily R90 Insight** (contenu frais quotidien) | 🔴 Élevé | Moyen | P1 | Calm Daily Calm 3x rétention |
| 5 | **Contenu audio de Nick** (Coach Insights, stories) | 🔴 Élevé | Moyen | P1 | Peloton, Calm Tamara Levitt |
| 6 | **Widget iOS** (prochain événement + countdown) | 🟠 Élevé | Moyen | P1 | RISE, Headspace, Duolingo |
| 7 | **Ancrage de prix** sur paywall ($0.22/jour) | 🟠 Modéré | Faible | P1 | Noom |
| 8 | **Badges visuels** dans le profil | 🟠 Modéré | Moyen | P1 | Duolingo, Calm Trophy Case |
| 9 | **Countdown prochain événement** sur home | 🟠 Modéré | Faible | P1 | RISE planning énergétique |
| 10 | **Messages d'identité R-Lo** post-level-up | 🟠 Modéré | Faible | P1 | Strava, Duolingo |
| 11 | **Flux de winback** par paliers (3j/7j/14j/30j) | 🟠 Modéré | Moyen | P2 | Headspace, Blinkist |
| 12 | **Challenges hebdomadaires** R90 | 🟠 Modéré | Moyen | P2 | Duolingo quests, SleepScore |
| 13 | **Onboarding enrichi** (+5-8 écrans éducatifs) | 🟡 Modéré | Moyen | P2 | Noom 77 écrans, Flo |
| 14 | **Paywall contextuel** sur contenu verrouillé | 🟡 Modéré | Faible | P2 | Calm paywalls dynamiques |
| 15 | **Micro-learning "R90 Learn"** | 🟡 Modéré | Élevé | P2 | Noom, Headway |
| 16 | **Stratégie de reconquête discount** | 🟡 Modéré | Moyen | P2 | Blinkist escaladant |
| 17 | **Calendrier contribution graph** (historique visuel) | 🟡 Faible | Moyen | P3 | Strava, GitHub |
| 18 | **Referral program** | 🟡 Modéré | Moyen | P3 | Duolingo, Strava |
| 19 | **Apple Watch app** | 🟡 Élevé | Élevé | P3 | Sleep Cycle, Pillow, Calm |
| 20 | **Challenges de groupe / Teams** | 🟡 Élevé | Élevé | V2 | Strava, Duolingo leagues |

---

# QUICK WINS — Implémentables en < 1 semaine

1. **Refonte paywall** : Timeline visuelle 3 étapes + social proof + ancrage prix/jour → `subscription.tsx`
2. **Bouton Partage** : Composant `ShareCard.tsx` + intégration level-up/recap/milestone → `expo-sharing`
3. **Countdown prochain événement** : Texte sous ActionCard "CRP in 2h14" → `ActionCard.tsx`
4. **Messages identité R-Lo** : 5 messages post-level-up → `rlo-mood.ts`
5. **XP toast visible** : Vérifier que `RhythmPointsToast` s'affiche à chaque action → tous les players

---

*Ce rapport est basé sur l'analyse du codebase React Native (Expo 54) au 25 mars 2026 et l'analyse concurrentielle de 15 apps (RISE, Calm, Headspace, Sleep Cycle, BetterSleep, Pillow, SleepScore, Duolingo, Strava, Noom, Peloton, Headway, Blinkist, Flo).*
