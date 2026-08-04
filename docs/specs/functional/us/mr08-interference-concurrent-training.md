---
id: MR-08
titre: "Interférence concurrent training"
roadmap: []
catalogue: [MR-08]
etape: recette
branche: feature/mr08-interference-concurrent-training
maj: 04/08/2026
---

# US MR-08 — Interférence concurrent training

> **Spec fonctionnelle — ✅ validée par Florian le 04/08/2026** (« Fais ce qu'il te semble le plus
> logique » — D1 tranchée conformément à la recommandation : seuils ACWR 1,3/0,8 réutilisés tels
> quels). **Code livré (TDD) le 04/08/2026** — reste la recette device (§11).
>
> **US d'analyse — aucune ligne roadmap.** Comme [NUTR-18](nutr18-bilan-calorique-hebdo.md)/
> [MUSC-20](musc20-regularite-entrainement.md), cette US vit **uniquement** dans le
> [catalogue d'analyses](../../product/analyses-donnees.md).

## 0. Ce que ça signale

Le « concurrent training » (endurance + force en parallèle) est un arbitrage classique :
au-delà d'un certain volume de course, la récupération et la progression en muscu peuvent en
pâtir (et inversement, un gros bloc muscu peut plomber la course). MR-08 détecte le symptôme le
plus visible de cet arbitrage : **un pilier qui monte nettement pendant que l'autre chute
nettement, sur la même fenêtre**. Ce n'est pas une alerte de sécurité (comme META-19/TRI-12) —
c'est un **constat factuel** qui peut expliquer une stagnation muscu ou une baisse de forme en
course, sans jugement sur le choix de l'utilisateur (peut-être volontaire, ex. bloc de prépa
marathon).

## 1. Décision de cadrage — ✅ TRANCHÉE par Florian le 04/08/2026

| # | Question | Recommandation | Pourquoi |
|---|---|---|---|
| **D1** | Quel seuil « nettement au-dessus »/« nettement en dessous » ? | **Réutiliser exactement les seuils ACWR déjà en place** : ratio (moyenne aiguë 7 j) / (moyenne chronique 28 j) **> 1,3** = en hausse, **< 0,8** = en chute — calculé **séparément par pilier** sur `volumeKg` (muscu) et `distanceM` (course), pas sur la charge sRPE combinée | Ces deux chiffres (1,3 / 0,8) sont déjà validés dans l'app (META-19, RUN-18, méthode de Foster) — les réutiliser tels quels évite d'inventer un 3ᵉ seuil non sourcé pour un phénomène voisin. Les fenêtres 7j/28j aussi déjà en place (`ACUTE_WINDOW_DAYS`/`CHRONIC_WINDOW_DAYS`) |

**Pourquoi ce n'est pas un doublon de META-19/MR-10** (déjà vigilant après la collision MR-10 →
absorbée par META-19, MR-23 → absorbée par TRI-03) : META-19 combine les deux piliers en **une**
charge sRPE unique (RPE × durée) et alerte sur le **total**. MR-08 compare **deux séries
distinctes dans leurs unités natives** (kg pour la muscu, mètres pour la course) et ne signale
que si elles **divergent en sens opposé** — un scénario que la charge combinée de META-19 ne peut
pas voir (une charge combinée stable peut cacher un fort transfert course↔muscu en interne).

## 2. Surfaçage (ADR-007, obligatoire pour toute US d'analyse)

**Tier 2 — Insight contextuel, conditionnel.** Widget dashboard, rendu `null` hors divergence —
même patron que `ActivityLevelSuggestionCard` (ton `"card"`, **pas** `"warn"` : ce n'est pas une
alerte de sécurité). **Pas** une section sur `/progress` ou `running-history` : les deux écrans
sont **déjà au-dessus** de leur seuil de repli ADR-007 (5 sections et 6 sections respectivement) —
y ajouter une section de plus contredirait la mise en garde déjà actée deux fois cette semaine
(MUSC-20 D4, NUTR-18 §0). Un insight qui ne parle que lors d'une vraie divergence reste dans le
budget Tier 2, comme `training-load`/`activity-level-suggestion`.

**Condition d'affichage** : `strength` **et** `running` actifs (les deux nécessaires — la
comparaison n'a pas de sens à moitié, même garde que `training-load`) **et** une des deux
directions de divergence détectée (§4, R2).

## 3. Ce qui existe déjà et qu'on réutilise

| Brique | Où | Usage ici |
|---|---|---|
| `ACUTE_WINDOW_DAYS` (7), `CHRONIC_WINDOW_DAYS` (28), `ACWR_RISK_THRESHOLD` (1,3), `ACWR_LOW_THRESHOLD` (0,8) | `packages/shared/src/training-time.ts` (constantes de module, privées) | Réutilisées **telles quelles** dans le même fichier (D1) — pas de nouvel export, pas de nouveau chiffre |
| `useWorkoutHistory()` (`workouts[].volumeKg`, déjà calculé par requête SQL) | `workout-repository.ts` | Tonnage muscu, déjà chargé ailleurs sur le dashboard, aucune nouvelle requête |
| `useRunHistory()` (`runs[].distanceM`) | `run-repository.ts` | Distance course, déjà chargée ailleurs sur le dashboard |
| `useWindowStartKey(days)` | `dashboard-repository.ts` (`useTodayKey.ts`) | Même patron que `useTrainingLoadAlert` pour bornes 7j/28j |
| Patron widget conditionnel Tier 2 (`{ show }`, gating tout-ou-rien dans le hook) | `useTrainingLoadAlert`, `useActivityLevelSuggestion` | Structure identique reprise pour `useConcurrentTrainingInterference` |
| Patron carte 3 formes, ton `"card"` | `ActivityLevelSuggestionCard.tsx` | Structure et style de carte repris à l'identique |

**Aucune donnée nouvelle, aucune migration.**

## 4. Les règles

**R1 — Deux ratios indépendants, un par pilier**, sur les mêmes fenêtres que l'ACWR (spec D1) :
- `runRatio` = (Σ `distanceM` des courses des 7 derniers jours ÷ 7) ÷ (Σ `distanceM` des courses
  des 28 derniers jours ÷ 28).
- `strengthRatio` = (Σ `volumeKg` des séances muscu des 7 derniers jours ÷ 7) ÷ (Σ `volumeKg` des
  séances muscu des 28 derniers jours ÷ 28).

**R2 — Divergence = un ratio en zone haute (> 1,3) pendant que l'autre est en zone basse
(< 0,8).** Deux directions possibles, mutuellement exclusives :
- `runningUpStrengthDown` — `runRatio > 1,3` **et** `strengthRatio < 0,8`.
- `strengthUpRunningDown` — `strengthRatio > 1,3` **et** `runRatio < 0,8`.

Si aucune des deux conditions n'est vraie (y compris si les deux ratios sont en hausse, ou les
deux en baisse, ou l'un des deux en zone saine) → rien à afficher.

**R3 — Historique minimal.** Si la somme chronique (28 j) d'un des deux piliers est nulle
(aucune séance/course sur 28 j), aucune divergence n'est évaluée pour ce pilier → widget masqué.
Même garde que `computeAcwr` (`chronicTotal <= 0 → null`), pas de nouvelle convention.

**R4 — Bidirectionnelle**, comme RN-03 (D2 de cette US-là) : les deux sens sont traités de façon
symétrique, seul le libellé du message change (§6).

**R5 — Ton factuel, aucun jugement.** Même exigence que RN-03 R7/TRI-12/META-19 : un constat
chiffré (« ton volume de course est nettement au-dessus de ta moyenne des 4 dernières semaines,
pendant que ton tonnage muscu est nettement en dessous »), jamais une injonction à changer de
comportement — l'arbitrage peut être volontaire (bloc de prépa).

## 5. Périmètre

**Dans le périmètre :**
1. `computeConcurrentTrainingInterference` (packages/shared, `training-time.ts`, aux côtés de
   `computeAcwr`).
2. Hook `useConcurrentTrainingInterference` (`dashboard-repository.ts`), gating
   `['strength', 'running']`.
3. Widget `ConcurrentTrainingInterferenceCard`, 3 formes, enregistré dans `WIDGET_REGISTRY.home`
   et `dashboard-widgets.tsx`.
4. `isWidgetActive` (`(tabs)/index.tsx`) mis à jour pour ce nouveau widget conditionnel — **fait
   dès l'implémentation**, pas laissé à la revue de code (défaut déjà rencontré 3 fois cette
   semaine : `readiness`, `activity-level-suggestion`, et de nouveau ici si oublié).
5. i18n FR + EN.

**Hors périmètre, explicitement :**
- Toute action suggérée (« réduis ta course », « ajoute une séance muscu ») — R5, constat seul.
- Le cas « les deux piliers montent » ou « les deux baissent » — pas une divergence, hors
  définition de cette US (R2).
- La charge sRPE combinée — déjà couverte par META-19, pas dupliquée ici (§1).
- Toute section sur `/progress` ou `running-history` — Tier 2 dashboard uniquement (§2).

## 6. i18n (FR + EN)

Nouvelle famille `home.concurrentTrainingInterference.*` :
- `eyebrow` — « Muscu & course » / « Strength & running ».
- `title` — « Un pilier prend le pas sur l'autre » / « One pillar is taking over the other »
  (statique, ne varie pas selon la direction — même patron que RN-03).
- `runningLabel` — « volume de course » / « running volume ».
- `strengthLabel` — « tonnage muscu » / « strength tonnage ».
- `message` (interpolée) — « Ton {{up}} est nettement au-dessus de ta moyenne des 4 dernières
  semaines, pendant que ton {{down}} est nettement en dessous. » / « Your {{up}} is well above
  your 4-week average, while your {{down}} is well below. » — `{{up}}`/`{{down}}` interpolent
  `runningLabel`/`strengthLabel` selon la direction (R4), résolus côté composant.
- `hint` — « Peut expliquer une stagnation sur l'un des deux — pas forcément un problème si c'est
  voulu. » / « May explain a plateau on one side — not necessarily an issue if intentional. ».

## 7. Comportement offline

**Total.** Lecture PowerSync locale (`workouts`, `runs`, déjà synchronisées), calcul pur. Aucun
réseau, aucune écriture.

## 8. Accessibilité

Bloc `accessible` unique par forme de widget (titre + message + hint), même patron que les
autres cartes Tier 2 du dashboard (`ActivityLevelSuggestionCard`, `TrainingLoadAlertCard`).

## 9. Cas limites

| Situation | Comportement attendu |
|---|---|
| `runRatio` et `strengthRatio` tous deux > 1,3 (les deux montent) | Rien à afficher (R2 — pas une divergence) |
| `runRatio` et `strengthRatio` tous deux < 0,8 (les deux chutent) | Rien à afficher (R2) |
| Un ratio en zone haute, l'autre en zone saine (0,8-1,3, pas franchement bas) | Rien à afficher — pas une vraie « chute » (R2) |
| Aucune course sur 28 j, muscu active | Widget masqué (R3, pas de baseline course) |
| Aucune séance muscu sur 28 j, course active | Widget masqué (R3, symétrique) |
| `strength` ou `running` inactif | Widget masqué (gating, §2) |
| Compte neuf, aucun historique dans les deux piliers | Widget masqué (R3 des deux côtés) |
| Mode avion | Fonctionne normalement (lecture locale seule) |

## 10. Definition of Done

- [x] D1 arbitrée par Florian le 04/08/2026.
- [x] `computeConcurrentTrainingInterference` testée (packages/shared, 8 tests) : les deux
      directions, le cas « les deux montent »/« les deux baissent » (pas de divergence), zone
      saine, historique insuffisant par pilier (R3), seuils exacts 1,3/0,8.
- [x] Hook + widget conditionnel Tier 2, gating `['strength', 'running']`, 3 formes, i18n FR + EN.
- [x] `isWidgetActive` mis à jour dans le même incrément (pas en revue) — vérifié explicitement en
      revue de code cette fois, correctement fait.
- [x] `npm run lint`, `npm run typecheck`, `npm run test` verts (663 tests mobile + 1496 shared +
      admin, tous workspaces).
- [x] Aucune ligne roadmap à toucher (US d'analyse, catalogue seul).

## 11. Critères d'acceptation (recette device)

1. Volume de course en forte hausse (>1,3× moyenne 4 sem) et tonnage muscu en forte baisse
   (<0,8× moyenne 4 sem) → widget visible, message cohérent (sens « course en hausse »).
2. Situation inverse (muscu en hausse, course en baisse) → widget visible, message inversé.
3. Les deux piliers stables ou évoluant dans le même sens → aucun widget.
4. Un des deux piliers sans historique sur 28 j → aucun widget.
5. `strength` ou `running` désactivé → aucun widget, quelle que soit la divergence calculée.
6. Mode avion : fonctionne normalement.
7. En EN : message grammatical, sens cohérent avec la direction détectée.
8. TalkBack énonce le widget comme un bloc cohérent.
