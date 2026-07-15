# US MUSC-04 (clôture) — Courbe : métrique 1RM estimé + période « tout »

_Spec fonctionnelle. Statut : validée (brainstorming Florian, 15/07/2026). Branche :
`feature/musc04-courbe-1rm-periode-tout` (depuis `dev`). Catalogue : **MUSC-04** — pilier Musculation,
Phase A (déterministe, offline). Ferme le delta vs spec 6.2._

## 1. Contexte

L'écran `/progress` (onglet Muscu → « Progression ») implémente **déjà** MUSC-04 à ~80 % :
sélecteur d'exercice (`ExercisePicker`), records par exercice, et **courbe de progression**
(`ProgressLineChart`) avec toggles métrique (`max_weight` / `volume`) et période (`30d` / `90d` /
`1y`). Le catalogue le marque ⏳ à tort — le code existe (US 3.21 / 6.2).

**Delta pour clore MUSC-04 vs la spec 6.2** (« charge max, volume total, **estimation 1RM** » +
« 4 sem / 3 mois / 1 an / **tout** ») :
1. Ajouter la métrique **« 1RM estimé »** à la courbe.
2. Ajouter la période **« tout »**.
3. i18n FR/EN des nouvelles valeurs.

## 2. Périmètre

- **Inclus** : nouvelle métrique `estimated_1rm` et nouvelle période `all` dans
  `useExerciseProgression` (records-repository) ; les deux toggles de `/progress` ; i18n.
- **Exclu** : filtres d'historique par programme/groupe (spec 6.1, distincts) ; MUSC-05
  (déséquilibre par groupe) ; toute migration ou nouveau stockage ; nouvel écran (on étend
  l'existant).
- **Maquette** : **écartée** (extension d'un écran existant, une option de plus par toggle).

## 3. Métrique « 1RM estimé » — sémantique

Décision (Florian, 15/07/2026) : **meilleur 1RM estimé par séance** (courbe dense, cohérente avec la
métrique `volume` qui est aussi par séance ; montre aussi les baisses — fatigue, deload).

- Pour chaque **séance terminée** (`workouts.status = 'completed'`) contenant l'exercice sélectionné,
  sur la période : considérer les séries **validées, non-échauffement, `reps` et `weight_kg` non nuls**
  (même filtre que la métrique `volume`).
- Point de la séance = **max de `estimate1RM(weightKg, reps)`** sur ces séries.
  `estimate1RM` = fonction pure **déjà implémentée et testée** dans `@wellness/shared`
  (`records.ts`, Epley : `weightKg × (1 + reps/30)`, garde reps ≤ 1 → `weightKg`).
  ⚠️ **Ne pas réécrire Epley en SQL** (risque de divergence) : le calcul se fait **en JS** à partir
  des séries qualifiantes remontées par la requête, en réutilisant `estimate1RM`.
- Date du point = `workouts.finished_at`. Tri chronologique.
- Unité = **charge** (kg) → même rendu que `max_weight` (via `units.toWeightValue` / `weightSymbol`).

> _Contraste assumé avec la métrique `max_weight`, qui reste basée sur les records
> `personal_records` (paliers). Les deux métriques existantes sont déjà hétérogènes
> (record vs par-séance) ; le 1RM par séance s'aligne sur `volume`._

## 4. Période « tout »

- Nouvelle valeur `'all'` du type `ProgressionPeriod`.
- Borne basse = date très ancienne (depuis le tout premier point ; ex. epoch `1970-01-01T00:00:00Z`).
  La fonction de borne (`periodLowerBound`) gère `'all'` sans planter (pas d'entrée dans `PERIOD_DAYS`).
- Toggle période de `/progress` : 4 puces `30d` / `90d` / `1y` / `all`.

## 5. UI (`/progress`)

- `METRIC_OPTIONS` → `['max_weight', 'volume', 'estimated_1rm']` (3 options dans le `Segment`).
- `PERIOD_OPTIONS` → `['30d', '90d', '1y', 'all']` (4 puces `periodChip`).
- Rendu de la courbe inchangé (`ProgressLineChart`, mapping `units.toWeightValue`) : le 1RM est une
  charge, donc l'axe et l'unité sont identiques à `max_weight`.
- Empty state courbe inchangé (message + CTA « démarrer une séance ») si 0 point.
- Titres de courbe : `progress.curve.metricLabel.estimated_1rm`.

## 6. i18n (FR + EN, parité)

Nouvelles clés dans le namespace `progress.curve` :
- `metric.estimated_1rm` (libellé court du toggle) — FR « 1RM estimé » / EN « Est. 1RM ».
- `metricLabel.estimated_1rm` (titre de la courbe) — FR « 1RM estimé » / EN « Estimated 1RM ».
- `period.all` — FR « Tout » / EN « All ».
Aucune chaîne en dur. Réutiliser le libellé du chip record `progress.records.type.estimated_1rm`
existant pour rester cohérent.

## 7. Cas limites

- Exercice sans série qualifiante sur la période → **0 point** → empty state (comme aujourd'hui).
- Séries avec `reps ≤ 1` → `estimate1RM` renvoie `weightKg` (pas de bonus Epley) : géré par la
  fonction pure.
- Période `all` sur un historique vide → empty state.
- **Offline** : 100 % local (PowerSync/SQLite) ; `isLoading` géré comme pour les métriques existantes.
- Non-régression : `max_weight` et `volume` **strictement inchangées** (mêmes requêtes, mêmes bornes).

## 8. Tests

- **Shared (Vitest)** : `estimate1RM` déjà couvert. Si l'agrégation « max 1RM par séance » est
  extraite dans un helper pur (recommandé), l'ajouter avec tests (plusieurs séries d'une séance →
  max ; séance sans série qualifiante → exclue ; reps ≤ 1). Sinon, aggregation inline testée via revue.
- **Mobile** : typecheck / lint verts ; rendu des 3 métriques + 4 périodes vérifié à la recette device.

## 9. Definition of Done

- Courbe `/progress` : 3 métriques (charge max / volume / **1RM estimé par séance**) et 4 périodes
  (30 j / 90 j / 1 an / **tout**) ; `max_weight` et `volume` inchangées.
- Logique 1RM réutilisant `estimate1RM` (pas d'Epley en SQL) ; i18n FR/EN à parité ; typecheck / lint /
  tests verts. **Pas de migration, pas de checkpoint 🔴** (100 % client).
- Catalogue **MUSC-04 → ✅** (statut corrigé). Reste **recette device** (Florian) : dérouler les 3
  métriques × 4 périodes sur un exercice avec historique, vérifier empty states et non-régression.
