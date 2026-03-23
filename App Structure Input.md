


# **Spécification Fonctionnelle**

  

## **Application basée sur la méthode R90**

  

Auteur de la méthode : **Nick Littlehales**

Concept de l’application : **Sleep Enabler (et non Sleep Tracker)**

---

# **1. Objectif de l’application**

  

L’application aide l’utilisateur à :

- stabiliser son rythme circadien
    
- organiser sa journée selon les cycles naturels du corps
    
- améliorer l’énergie et la récupération
    
- améliorer la qualité du sommeil
    

  

Contrairement à la plupart des applications de sommeil, cette application **ne mesure pas principalement le sommeil**.

  

Elle aide l’utilisateur à **créer les conditions pour mieux dormir**.

---

# **2. Principe central : ARP**

  

Le système repose sur un point fixe :

  

**ARP – Anchor Reset Point**

  

C’est **l’heure de réveil**.

  

Cette heure doit être **la même tous les jours**.

  

Pourquoi ?

  

Parce que l’exposition à la lumière après le réveil synchronise l’horloge biologique (rythme circadien).

  

Si l’heure de réveil est stable, le corps ajuste naturellement :

- la production de mélatonine
    
- la fatigue
    
- les cycles de sommeil
    

  

Dans l’application :

```
ARP = WakeUpTime
```

Exemple :

```
ARP = 06:30
```

Toutes les autres fonctions sont calculées à partir de ce point.

---

# **3. Structure de la méthode R90**

  

La méthode comporte **cinq éléments principaux**.

---

# **3.1 Cycles de 90 minutes**

  

Le corps fonctionne selon des **cycles ultradiens d’environ 90 minutes**.

  

Ces cycles existent :

- pendant le sommeil
    
- pendant la concentration
    
- pendant l’énergie mentale
    

  

Dans l’application :

```
CycleLength = 90 minutes
```

La journée est divisée en cycles de 90 minutes.

---

# **3.2 Calcul de la fenêtre de sommeil**

  

L’heure de sommeil est calculée **en remontant à partir de l’ARP**.

  

L’utilisateur peut choisir le nombre de cycles de sommeil :

```
4 cycles = 6h
5 cycles = 7h30
6 cycles = 9h
```

Exemple :

```
ARP = 06:30
SleepCycles = 5
```

Calcul :

```
SleepTime = ARP – (SleepCycles × 90 minutes)
```

Résultat :

```
SleepTime = 23:00
```

L’utilisateur commence idéalement sa préparation au sommeil environ **30 minutes avant**.

---

# **3.3 Flexibilité du système**

  

La méthode R90 **n’exige pas une heure de coucher rigide**.

  

Si l’utilisateur manque l’heure idéale (par exemple sortie tardive), il peut simplement choisir **le cycle suivant**.

  

Exemple :

```
Cycle idéal : 23:00
Cycle suivant : 00:30
```

Le système accepte des nuits plus courtes occasionnellement.

  

L’important est **l’équilibre sur plusieurs jours**.

---

# **3.4 MRM – Micro Reset Moment**

  

Chaque cycle de 90 minutes inclut une courte pause appelée :

  

**MRM – Micro Reset Moment**

  

Durée :

```
2 à 5 minutes
```

Objectif :

- réduire le stress
    
- reposer le système nerveux
    
- améliorer la concentration
    

  

Exemples d’activités :

- respiration lente
    
- fermer les yeux
    
- regarder au loin
    
- étirement rapide
    

---

# **3.5 CRP – Controlled Recovery Period**

  

Chaque jour inclut une période de récupération plus longue.

  

Nom :

  

**CRP – Controlled Recovery Period**

  

Durée :

```
20 minutes
```

Important :

  

Ce n’est **pas une sieste**.

  

Le but est la récupération mentale.

  

Exemples :

- méditation
    
- relaxation
    
- marche lente
    
- exercice respiratoire
    

---

# **4. Logique de l’application**

  

## **Input principal**

  

L’utilisateur fournit :

```
WakeUpTime
```

Exemple :

```
06:30
```

---

# **4.1 Calcul des cycles journaliers**

```
CycleLength = 90 minutes
Start = WakeUpTime
```

Exemple :

```
06:30 – 08:00
08:00 – 09:30
09:30 – 11:00
11:00 – 12:30
12:30 – 14:00
14:00 – 15:30
15:30 – 17:00
17:00 – 18:30
18:30 – 20:00
20:00 – 21:30
21:30 – 23:00
```

---

# **4.2 MRM dans chaque cycle**

  

Un rappel MRM est déclenché environ :

```
80 minutes après le début du cycle
```

Exemple :

  

Cycle :

```
06:30 – 08:00
```

MRM :

```
07:50
```

---

# **4.3 CRP**

  

La CRP est placée environ :

```
ARP + 7 heures
```

Exemple :

```
06:30 + 7h = 13:30
```

L’utilisateur peut ajuster cette heure.

---

# **5. Écrans principaux**

  

## **Home Screen**

  

Affiche :

```
ARP (Wake-Up Anchor)
Sleep Window
Next MRM
CRP Time
Current Cycle
```

Exemple :

```
Wake-Up
06:30

Sleep Window
23:00

Next MRM
07:50

CRP
13:30
```

---

# **6. R-Lo – Assistant de l’application**

  

L’application inclut un assistant :

  

**R-Lo**

  

C’est un petit robot amical avec une tête représentant la Terre.

  

Il symbolise les **cycles naturels et les rythmes de la planète**.

  

Fonctions possibles :

- messages d’encouragement
    
- conseils courts
    
- rappel des pauses
    
- explication de la méthode
    

---

# **7. Philosophie de l’application**

  

L’application doit rester :

- simple
    
- claire
    
- non intrusive
    
- basée sur les rythmes naturels
    

  

Elle doit éviter :

- trop de données
    
- anxiété liée au sommeil
    
- complexité inutile
    

  

L’objectif est d’aider l’utilisateur à **trouver un rythme durable**.

---

# **8. Adaptation et apprentissage**

  

L’application peut apprendre du comportement de l’utilisateur.

  

Exemples :

- feedback d’énergie
    
- régularité des cycles
    
- utilisation des pauses
    

  

Cela permet d’ajuster :

- le moment des MRM
    
- le moment du CRP
    
- les recommandations.
    

---

# **9. Contenu de l’application**

  

L’application peut inclure une section de contenu appelée :

  

**Coach Insights**

  

Contenu possible :

- courtes vidéos de Nick Littlehales
    
- explications simples de la science du sommeil
    
- conseils pratiques
    

---

# **10. Bibliothèque de contenu**

  

## **Wind Down**

  

Contenu pour la préparation au sommeil :

- Sleep Stories
    
- méditations guidées
    
- exercices de respiration
    

---

## **MRM Library**

  

Contenu court pour les pauses :

- respiration 2 minutes
    
- relaxation rapide
    
- étirement
    
- repos visuel
    

---

## **CRP Library**

  

Contenu plus long :

- méditation 20 minutes
    
- relaxation guidée
    
- NSDR
    

---

# **11. Programmes**

  

L’application peut proposer des programmes progressifs.

  

Exemple :

  

**7 Day Sleep Reset**

  

Jour 1

  

stabiliser l’ARP

  

Jour 2

  

exposition à la lumière

  

Jour 3

  

introduction des MRM

  

Jour 4

  

première CRP

  

Jour 5

  

routine du soir

---

# **12. Extensions futures**

  

Fonctionnalités possibles plus tard :

- gestion du jet lag
    
- travail en horaires décalés
    
- intégration Apple Health
    
- analyse des cycles d’énergie
    

  

Ces fonctions sont plus complexes et peuvent être ajoutées dans une version future.

---

