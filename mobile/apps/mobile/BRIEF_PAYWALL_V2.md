# Brief Dev — Paywall V2
## R90 Navigator — Mars 2026

---

## CONTEXTE

Ce brief décrit les améliorations à apporter au système de paywall de R90 Navigator. Il couvre deux composants distincts :

1. **Le Paywall Principal** (`app/subscription.tsx`) — l'écran plein format affiché post-onboarding et depuis le profil
2. **Le Paywall Contextuel** (`components/PremiumGate.tsx`) — le modal affiché quand l'utilisateur tape sur du contenu premium

Le paywall principal est déjà bien structuré (timeline Blinkist, authority Nick, testimonials, toggle monthly/yearly). Les modifications sont des ajustements ciblés pour maximiser la conversion. Le paywall contextuel, en revanche, nécessite une refonte complète.

---

## PARTIE 1 — PAYWALL PRINCIPAL (`subscription.tsx`)

### Ce qui fonctionne déjà (ne pas toucher)

- La structure en 9 sections (Header → Authority → Social proof → Testimonials → Benefits → Toggle → Pricing → Timeline → CTA)
- La TrialTimeline en 3 étapes (Today / Day 5 / Day 7) — c'est le pattern Blinkist
- L'authority bar Nick Littlehales avec badge doré
- Le carousel de témoignages avec étoiles
- Le toggle Monthly/Yearly avec pill "Save 33%"
- Le CTA "Start free trial" avec sous-texte "7 days free — no charge today"

### Modification 1 — Ajouter l'ancrage "prix par jour"

**Quoi** : Afficher le prix ramené au quotidien sous la carte Yearly pour recadrer la perception de prix.

**Pourquoi** : Noom et RISE utilisent l'ancrage de prix pour réduire la friction. $79.99/an semble cher. $0.22/jour ne semble rien. Le cerveau traite le prix quotidien comme un micro-coût acceptable.

**Où** : Dans la carte Yearly, sous la ligne `planYearlyTotal`.

**Implémentation** :
```
Carte Yearly actuelle :
  Yearly
  $6.66 / mo
  $79.99 / year
  Save 33% vs monthly

Carte Yearly modifiée :
  Yearly                    [Best value]
  $6.66 / mo
  $79.99 / year
  That's just $0.22/day        ← AJOUTER
  Save 33% vs monthly
```

Le texte "$0.22/day" doit être en `color: C.success` (vert) pour attirer l'oeil. Style `fontSize: 12, fontWeight: '600'`. Calcul : `(79.99 / 365).toFixed(2)`.

### Modification 2 — Ajouter une ligne de comparaison contextuelle

**Quoi** : Une phrase d'ancrage sous les pricing cards qui compare le coût à quelque chose de concret et quotidien.

**Pourquoi** : Noom compare son prix à un thérapeute ($100/h). L'ancrage à un référent familier réduit la douleur perçue du prix.

**Où** : Entre la section Pricing cards et la TrialTimeline.

**Contenu** :
```
Less than a coffee a week — for the method used by Cristiano Ronaldo.
```

**Style** : `fontSize: 13, color: C.sub, textAlign: 'center', fontStyle: 'italic', marginBottom: 20`. Pas de background, pas de card — juste une phrase sobre.

### Modification 3 — Enrichir le social proof avec un chiffre de résultats

**Quoi** : Ajouter un stat de résultat sous le compteur "10,000+ users".

**Pourquoi** : BetterSleep affiche "91% slept better after 1 week". Flo montre ses stats de précision. Un chiffre de résultat convertit plus qu'un chiffre d'adoption.

**Où** : Sous la ligne `socialProof` existante (ligne ~298-301).

**Contenu** :
```
Actuel :
  👥 Join 10,000+ users who improved their sleep rhythm

Modifié :
  👥 Join 10,000+ users who improved their sleep rhythm
  ⚡ 83% report more energy within their first week         ← AJOUTER
```

**Style** : Même style que `socialProof`, avec `icon: 'flash'` et `color: C.accent` (doré) au lieu de `C.blue`.

### Modification 4 — CTA avec rappel de la personnalisation

**Quoi** : Personnaliser le texte du CTA en rappelant le choix de l'utilisateur.

**Pourquoi** : L'utilisateur vient de compléter un onboarding où il a choisi son chronotype et son anchor time. Le CTA devrait rappeler que le plan est fait POUR LUI. Noom fait ça avec "Reserve YOUR personalized plan."

**Où** : Modifier le texte du CTA (lignes 385-386).

**Contenu** :
```
Actuel :
  Start free trial
  7 days free — no charge today

Modifié :
  Try your [Chronotype] rhythm plan free    ← ex: "Try your AMer rhythm plan free"
  7 days free — cancel anytime
```

**Implémentation** : Récupérer le chronotype depuis le storage/context (`storage.getChronotype()`). Si pas disponible, fallback sur "Try your rhythm plan free".

### Modification 5 — Ajouter un "X" plus visible et la mention légale Apple

**Quoi** : Le bouton close actuel est un petit X en `C.sub` (gris) en haut à droite. C'est correct pour la conversion mais Apple peut rejeter si le dismiss n'est pas assez visible.

**Pourquoi** : Apple exige que le bouton de fermeture du paywall soit "clearly visible". Plusieurs apps ont été rejetées pour des boutons close trop discrets.

**Où** : `closeBtn` style (ligne 413).

**Contenu** : Augmenter la taille du hitSlop à 16 et s'assurer que le bouton a un contraste suffisant. Ajouter les liens Terms & Privacy en footer (requis par Apple et Google).

```
Footer modifié :
  Free for 7 days, then $79.99/year. Cancel anytime before Day 7.
  Terms of Use · Privacy Policy · Restore purchase       ← AJOUTER liens
```

---

## PARTIE 2 — PAYWALL CONTEXTUEL (`PremiumGate.tsx`) — REFONTE COMPLÈTE

### Problème actuel

Le `PremiumGate.tsx` est un placeholder V1 :
- Le bouton "Get Premium" ne déclenche PAS l'achat (il fait `onClose`)
- Le texte est générique ("requires R-Lo Premium")
- Les features listées sont hardcodées et non contextuelles
- Aucun lien vers le paywall principal ou le flow d'achat
- Le design est déconnecté du paywall principal (couleurs différentes)

### Refonte proposée

Le paywall contextuel doit être un **mini-paywall bottom-sheet** qui apparaît quand l'utilisateur tape sur du contenu verrouillé. Il doit montrer un aperçu du contenu verrouillé en arrière-plan et proposer soit le trial, soit la navigation vers le paywall complet.

**Comportement** : L'utilisateur tape sur une sleep story premium → le contenu commence à se charger (titre visible, artwork visible) → un bottom sheet slide up avec le mini-paywall → l'utilisateur peut soit "Start free trial" directement, soit "See all plans", soit dismiss.

**Structure du nouveau composant** :

```
┌─────────────────────────────────────┐
│  [Contenu en arrière-plan, flouté]  │
│  Artwork de la sleep story          │
│  "Night Forest — Episode 4"         │
│                                     │
├─────────────────────────────────────┤  ← Bottom sheet
│  🔒  Premium content                │
│                                     │
│  Unlock [Night Forest] and 20+      │
│  sleep stories, guided recoveries   │
│  & unlimited R-Lo coaching.         │
│                                     │
│  ┌─────────────────────────────┐    │
│  │   Try free for 7 days       │    │  ← CTA principal (accent color)
│  │   Then $6.66/mo             │    │
│  └─────────────────────────────┘    │
│                                     │
│       See all plans                 │  ← Lien vers subscription.tsx
│                                     │
│            Not now                  │  ← Dismiss
└─────────────────────────────────────┘
```

**Props mises à jour** :

```typescript
interface Props {
  visible: boolean;
  onClose: () => void;
  // Nouveau : contexte du contenu qui a déclenché le gate
  contentTitle?: string;    // ex: "Night Forest"
  contentType?: 'story' | 'crp' | 'mrm' | 'insight' | 'chat' | 'generic';
}
```

**Texte dynamique selon `contentType`** :

| contentType | Texte |
|-------------|-------|
| `story` | "Unlock [title] and 20+ sleep stories" |
| `crp` | "Unlock [title] and all guided recovery sessions" |
| `mrm` | "Unlock [title] and advanced micro-recovery protocols" |
| `insight` | "Unlock detailed analytics and weekly rhythm insights" |
| `chat` | "Unlock unlimited R-Lo coaching and full chat history" |
| `generic` | "Unlock all premium features" |

**Intégration avec le flow d'achat** :

Le CTA "Try free for 7 days" doit :
1. Déclencher directement `purchasePackage` (plan yearly par défaut) via `purchases.ts`
2. En cas de succès → `refresh()` premium status → fermer le gate → laisser l'utilisateur accéder au contenu
3. En cas d'erreur → afficher l'alerte standard

Le lien "See all plans" doit :
1. Fermer le modal
2. `router.push('/subscription')` pour afficher le paywall complet

**Design** :

- Utiliser les mêmes tokens de couleur que `subscription.tsx` (palette `C`)
- Background du bottom sheet : `C.card` (#141466)
- Bordure top du bottom sheet : `borderTopLeftRadius: 24, borderTopRightRadius: 24`
- Animation : slide up depuis le bas (utiliser `Animated.timing` ou le modal `animationType: 'slide'`)
- Le contenu en arrière-plan doit être visible mais flouté (utiliser `expo-blur` `BlurView` ou un overlay semi-transparent)

**Fichiers à modifier** :

1. `components/PremiumGate.tsx` — Réécrire complètement
2. Tous les points d'appel de `<PremiumGate>` — Passer les nouvelles props `contentTitle` et `contentType`
3. Ajouter `import { purchasePackage, getCurrentOffering } from '../lib/purchases'` dans PremiumGate

---

## PARTIE 3 — STRATÉGIE DE RECONQUÊTE POST-REFUS

### Problème actuel

Quand l'utilisateur ferme le paywall (principal ou contextuel), rien ne se passe ensuite. Pas de relance, pas de rappel, pas de discount progressif. L'utilisateur est perdu.

### Implémentation demandée

Créer un fichier `lib/reconquest.ts` qui gère la logique de reconquête :

```typescript
// lib/reconquest.ts

interface ReconquestState {
  paywallDismissedAt: string | null;  // ISO date du premier dismiss
  dismissCount: number;                // nombre de fois dismissed
  lastReconquestPush: string | null;  // dernière notif de reconquête
}

// Règles de reconquête :
//
// Jour 3 après dismiss :
//   Push : "Your rhythm plan is still saved. Start your free trial anytime."
//   Action : tap → ouvre /subscription
//
// Jour 7 après dismiss :
//   Push : "You've been building rhythm for a week.
//           Unlock your full R90 plan — free for 7 days."
//   Action : tap → ouvre /subscription
//
// Jour 14 après dismiss (si applicable) :
//   Push contextuel basé sur l'activité :
//   Si l'utilisateur a fait 3+ wind-downs gratuits :
//     "You've done [X] wind-downs this week. Imagine what the full library could do."
//   Si l'utilisateur a un streak actif :
//     "Your [X]-day streak shows commitment. Unlock premium to go deeper."
//
// Limites :
//   - Max 1 push de reconquête par semaine
//   - Stop après 3 tentatives (pas de harcèlement)
//   - Ne jamais envoyer pendant le wind-down ou la nuit
```

**Intégration** :

1. Quand le paywall est dismissed → appeler `markPaywallDismissed()` dans `reconquest.ts`
2. Au lancement de l'app → vérifier `shouldSendReconquest()`
3. Si oui → scheduler la notification via `notifications.ts`
4. Stocker l'état dans AsyncStorage via `storage.ts`

---

## PARTIE 4 — PAYWALL POST-ONBOARDING : AJUSTEMENTS DANS `OnboardingPlanOverlay`

### Contexte

Le flow actuel est : onboarding 7 steps → plan generation → plan reveal → paywall → login. C'est le bon ordre. Mais la transition plan reveal → paywall peut être améliorée.

### Ajustement demandé

Après la révélation du plan (l'utilisateur voit sa journée R90 personnalisée), ajouter un écran intermédiaire de **"Commitment Pact"** inspiré de Headway :

```
┌─────────────────────────────────────┐
│                                     │
│  Your R90 rhythm is ready.          │
│                                     │
│  What matters most to you?          │
│                                     │
│  ○ Wake up with real energy         │
│  ○ Stop feeling tired all day       │
│  ○ Perform like an elite athlete    │
│  ○ Finally fix my sleep for good    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │   I'm ready to start        │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

**Pourquoi** : L'utilisateur sélectionne son objectif personnel. Ce micro-engagement (1 tap) crée un "commitment bias" qui augmente la propension à payer sur l'écran suivant. Headway appelle ça le "Commitment Pact" et l'a trouvé efficace pour la conversion.

**L'objectif sélectionné peut aussi être réutilisé** :
- Dans le texte du CTA du paywall : "Start your [objectif] journey"
- Dans les messages R-Lo des premiers jours
- Stocker dans `storage.ts` comme `commitmentGoal`

---

## RÉSUMÉ DES FICHIERS À MODIFIER

| Fichier | Action | Priorité |
|---------|--------|----------|
| `app/subscription.tsx` | 5 modifications ciblées (ancrage prix/jour, comparaison, stat résultat, CTA personnalisé, footer légal) | P0 |
| `components/PremiumGate.tsx` | Refonte complète → mini-paywall bottom-sheet contextuel avec achat direct | P0 |
| `lib/reconquest.ts` | Créer — logique de reconquête post-dismiss | P1 |
| `lib/storage.ts` | Ajouter clés `reconquestState` et `commitmentGoal` | P1 |
| `components/OnboardingPlanOverlay.tsx` | Ajouter écran Commitment Pact avant le paywall | P1 |
| Points d'appel de PremiumGate | Passer `contentTitle` et `contentType` partout | P0 |

---

## CRITÈRES DE VALIDATION

1. Le paywall principal affiche le prix par jour ($0.22/day) sur la carte yearly
2. Le paywall contextuel déclenche réellement l'achat (plus de placeholder)
3. Le paywall contextuel affiche le nom du contenu qui a déclenché le gate
4. Les liens Terms/Privacy sont visibles en footer
5. Le CTA du paywall principal inclut le chronotype de l'utilisateur
6. Le système de reconquête envoie max 3 pushs sur 14 jours, jamais la nuit
7. L'écran Commitment Pact s'affiche entre plan reveal et paywall dans l'onboarding
8. Tout le flow est testable avec le sandbox RevenueCat
