# US MR-06 — Widget « Temps d'entraînement » (dashboard)

_Spec fonctionnelle. Statut : en validation (brainstorming Florian, 16/07/2026). Branche :
`feature/mr06-temps-entrainement` (depuis `dev`). Analyse **MR-06** du
[catalogue](../../product/analyses-donnees.md), Phase A, **inter-piliers** (muscu ↔ course)._

## 1. Contexte & objectif

Le dashboard expose déjà des widgets **par pilier** : « Volume muscu semaine » (tonnage) et
« Résumé running semaine » (distance + séances). Il manque une lecture **transverse** de la **charge
en temps** — le premier indicateur inter-piliers concret, dans l'esprit « les piliers se parlent »
(différenciateur produit). MR-06 ajoute un widget **« Temps d'entraînement »** : le **temps total**
consacré à l'entraînement (muscu + course) sur la semaine, avec la **ventilation** par pilier.

Objectif : donner d'un coup d'œil « combien de temps je me suis entraîné cette semaine, et comment il
se répartit entre muscu et course ».

## 2. Périmètre

- **Inclus** :
  - Nouveau widget dashboard **`training-time`** (registre `@wellness/shared/dashboard.ts`), gating
    **transverse** `['strength', 'running']` (affiché si **muscu OU course** actif).
  - Logique **pure** `computeTrainingTime(...)` dans `@wellness/shared` (testée).
  - Hook `useTrainingTime()` (dashboard-repository) + composant `TrainingTimeCard`.
  - Rendu : ajout de `TrainingTimeCard` au registre id→composant **`WIDGET_COMPONENTS`**
    ([dashboard-widgets.tsx](../../../apps/mobile/src/components/dashboard-widgets.tsx)) — `(tabs)/index.tsx`
    rend génériquement via `<DashboardWidget id … size … />`, il n'y a pas de case par widget. `WIDGET_COMPONENTS`
    est typé `Record<DashboardWidgetId, …>` → le **typecheck imposera** d'ajouter l'entrée (pas d'oubli
    silencieux possible). Gérer les tailles `full`/`compact`.
  - i18n FR + EN (parité).
- **Exclu (YAGNI)** :
  - Toggle de période (semaine **seule** — décision Florian ; pas de bascule 7 j / 30 j).
  - Courbe/historique du temps (widget = chiffre + ventilation, pas de graphe).
  - Nutrition (aucune notion de durée) — le widget reste muscu + course.
  - Objectif de temps hebdo / comparaison N-1 (hors périmètre ; META-06 traite les deltas ailleurs).
- **Maquette** : écartée (widget aligné sur les widgets dashboard existants ; UI mineure — précédents
  1.15, 4.7/4.18). À confirmer à la validation.

## 3. Règles métier / calcul

### 3.1 Fenêtre temporelle
**Semaine ISO courante, lundi → dimanche** (calée lundi), pour **coïncider avec les widgets voisins** :
- `muscle-volume` → `useMuscleVolumeThisWeek` → `startOfWeekLocalUtc` (lundi), borne sur `finished_at`.
- `running-week` → `useRunStats('week')` → `aggregateRunStats(..., 'week')` → `startOfWeek` (lundi).

⚠️ **Ne PAS** utiliser « 7 j glissants » (`daysAgo(7)`) : c'est le comportement de `deficit-volume`
(une **alerte**, pas un widget « semaine » visible). Avec 7 j glissants, la ventilation course de MR-06
ne se réconcilierait pas avec « Résumé running semaine » → incohérence perçue. Réutiliser l'utilitaire
de début de semaine **déjà existant** (`startOfWeek` / `startOfWeekLocalUtc`).

### 3.2 Sources & agrégation
- **Muscu** : séances terminées de la semaine — `workouts` `status = 'completed'`, `finished_at` dans
  la semaine ISO courante, `duration_seconds` non nul. Somme des `duration_seconds`.
- **Course** : `runs` `status = 'completed'`, `finished_at` dans la semaine, `duration_seconds` non nul.
  Somme des `duration_seconds`.
- **Borne sur `finished_at`** (jour de fin), comme les widgets voisins — **pas** `started_at` (réservé à
  `deficit-volume`).
- **Composition plutôt que SQL brut** : réutiliser les hooks existants `useWorkoutHistory`
  (`workout-repository`, déjà `status='completed'`, expose `durationSeconds`/`finishedAt`) et
  `useRunHistory` (`run-repository`, idem), filtrer sur la fenêtre semaine, puis sommer — conforme à la
  philosophie « composer les hooks » du `dashboard-repository` (cf. `useStreakData`/`useIsTrainingDay`).
  Éviter une nouvelle requête `useQuery` dédiée si la composition suffit.
- `computeTrainingTime({ strengthSeconds, runningSeconds })` (deux totaux agrégés en amont, ou deux
  listes) → `{ totalSeconds, strengthSeconds, runningSeconds }`. Fonction **pure**, testée (somme,
  robustesse aux valeurs nulles/négatives ignorées, totaux à 0).
- **Séances non terminées** (`active`/`cancelled`) et `duration_seconds` nul → **exclues**.

### 3.3 Gating piliers (transverse)
- `WIDGET_PILLARS['training-time'] = ['strength', 'running']` → `isWidgetAllowed` (déjà en place) rend
  le widget visible si **au moins un** des deux piliers est actif (même mécanique que `record-recent`).
- **Ventilation adaptée** : n'afficher la ligne d'un pilier que s'il est **actif**. Si un seul des deux
  est actif, le widget montre le total (= ce pilier) sans ventilation trompeuse de l'autre.
- Hooks appelés **inconditionnellement** (règle des hooks) ; le gating n'intervient qu'au retour
  (même pattern que `useDeficitVolumeAlert` / `useMostRecentRecord`).

### 3.4 Affichage
- **Total** en heures/minutes : format court « `Xh YY` » (ex. « 4h 30 »), « 0h 00 » si rien. ⚠️
  `formatDurationHms` (run-stats) rend « 1 h 5 min 30 s » (inadapté) → **nouveau helper pur
  `formatHoursMinutes(totalSeconds)`** (shared, testé) : minutes **arrondies à la minute inférieure**
  (`floor`), **zéro-paddées sur 2 chiffres** (`YY`). La chaîne « Xh YY » est **composée en JS** (pas via
  interpolation i18n).
- **Ventilation** : « muscu `Xh YY` · course `Xh YY` » (uniquement les piliers actifs).
- **Empty state** : aucune séance/course sur 7 j → total « 0h 00 » + libellé neutre (ex. « Aucune
  séance cette semaine »), pas de graphique vide (principe 2.10).
- Variante **compacte** (une ligne) cohérente avec les autres widgets (`DashboardCardCompact`).

## 4. i18n (FR + EN, parité)

Namespace `home.trainingTime.*` : `title` (« Temps d'entraînement » / « Training time »),
`breakdownStrength` (« muscu » / « strength »), `breakdownRunning` (« course » / « running »),
`empty` (« Aucune séance cette semaine » / « No session this week »). **Le format d'heures « Xh YY »
n'est PAS une clé i18n** : il est composé en JS par `formatHoursMinutes` (les libellés autour, eux,
sont i18n). Si une valeur devait être interpolée dans une clé, utiliser la **double accolade i18next**
(`{{h}}`), jamais `{h}`. Parité FR/EN vérifiée (0 clé orpheline + compteur équilibré).

## 5. Cas limites

- **Un seul pilier actif** → widget visible, total = ce pilier, pas de ventilation de l'autre.
- **Aucun des deux actif** (nutrition seule) → widget **filtré** (absent), conforme au registre.
- **Séance/course en cours** (`active`) ou `duration_seconds` nul → non comptée.
- **Aucune donnée 7 j** → « 0h 00 » + empty state.
- **Offline** : lectures locales PowerSync (`useQuery`), aucune dépendance réseau ; réactif.
- **Personnalisation** : le widget hérite du système existant (masquable, déplaçable, compact) — ajout
  au registre → forward-compat gère les layouts déjà stockés (widget ajouté en fin, visible).

## 6. Tests

- **Shared (Vitest)** : `computeTrainingTime` + `formatHoursMinutes` (padding, arrondi, 0h 00). **Mise à
  jour obligatoire de `dashboard.test.ts`** (l'ajout de l'ID casse des assertions de comptage) :
  « 8 widgets » → 9 (`toEqual([...ids])`, `toHaveLength(8)` → 9 aux lignes ~16/45/47/98/104/133/149/203/204),
  ordres `[0..7]` → `[0..8]` ; **ajouter** une assertion `WIDGET_PILLARS['training-time']`.
- **Mobile** : `typecheck` + `lint` verts ; rendu vérifié en recette device.

## 7. Definition of Done

- Widget `training-time` au registre dashboard (gating `['strength','running']`), logique pure
  `computeTrainingTime` testée, hook `useTrainingTime` (gating + 7 j glissants), composant
  `TrainingTimeCard` (total + ventilation + empty + variante compacte), rendu dans l'accueil.
- i18n FR/EN à parité ; typecheck/lint/tests verts. **100 % client, offline, aucune migration.**
- Catalogue : MR-06 → ✅.
- Reste : **recette device** (temps total + ventilation muscu/course ; gating 1 pilier / 2 piliers /
  nutrition seule ; empty ; compact) + relecture Damien.
