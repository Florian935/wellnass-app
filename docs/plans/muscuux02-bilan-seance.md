# Plan — MUSCU-UX02 · Bilan de séance

Spec : [muscuux02-bilan-seance.md](../specs/functional/us/muscuux02-bilan-seance.md) ·
Maquettes : [design/recap-seance-muscu/](../../design/recap-seance-muscu/) ·
Branche : `feature/muscu-ux02-bilan-seance`

## Ordre de build

Du pur vers l'écran : chaque étape est testable seule, et la dernière ne fait que brancher.

### Étape 1 — Calculs purs (`packages/shared`, Vitest)

| Fichier | Contenu | Tests |
|---|---|---|
| `session-muscle-split.ts` | `computeSessionMuscleSplit` — séries / volume / séries dures par groupe musculaire de **cette** séance | groupes triés, échauffements exclus, RPE absent ≠ dur, `null` si vide |
| `rep-ranges.ts` | `computeRepRangeSplit` — force 1-5 / hypertrophie 6-12 / endurance 13+, **pondéré volume**, via `sharesOf` | somme = 100, plage vide absente, séries à la durée ignorées |
| `session-comparison.ts` | `computeSessionComparison` — médiane des 5 dernières séances de même titre (courante exclue) | `null` sous 3 références, médiane et non moyenne, delta signé |
| `workout-report.ts` | `workoutReportVisibility(level)` · `computeSessionVerdict` · `computeWorkoutReport` (assemble tout) | matrice de visibilité, les 5 cas de verdict dans l'ordre, sRPE `null` sans ressenti |

Réutilisés tels quels, **non modifiés** : `computeVolume`, `computeTrainingDensity`,
`estimate1RM`, `sessionBestEstimated1RM`, `sessionRelativeIntensity`, `bestKnownOneRm`,
`computeSetTypeMix`, `computeExecutionCompliance`, `compareExercisePerformance`, `sharesOf`,
`MUSCLE_GROUPS`.

Export depuis `packages/shared/src/index.ts`.

### Étape 2 — Base

1. `npm run db:new muscuux02_summary_display_level` → `alter table profiles add column
   summary_display_level text default 'normal' check (...)`.
2. `npm run db:push:dry` puis `npm run db:push`.
3. `npm run db:types`.
4. Cocher dans [supabase/MIGRATIONS.md](../../supabase/MIGRATIONS.md).
5. ⚠️ Ajouter `summary_display_level: column.text` dans
   [powersync/schema.ts](../../apps/mobile/src/powersync/schema.ts) — sans quoi l'écriture échoue
   en silence.
6. `profile-repository.ts` : champ dans le type, le mapping de lecture et l'écriture.

> Pas de sync rules à redéployer : `profiles` est déjà une table synchronisée, on n'ajoute qu'une
> colonne.

### Étape 3 — Données mobile

`data/repositories/workout-report-repository.ts` → `useWorkoutReport(workoutId)` :
**une** passe de requêtes (séance, séries + exercices, records de la séance, 1RM connus, séances de
référence, plan si programme), puis un `useMemo` sur `computeWorkoutReport`.

Remplace les appels dispersés — aujourd'hui `useWorkoutRecords` ×3 et `useWorkoutDetail` ×2.

### Étape 4 — Composants (`components/workout/report/`)

`WorkoutReport.tsx` (orchestrateur, lit la visibilité) + un fichier par bloc :
`LevelSwitcher` · `VerdictCard` · `StatBand` · `SecondaryStats` · `HabitComparison` ·
`MuscleSplit` · `ProgramCompliance` · `ExerciseList` (condensé ↔ déplié) · `RelativeIntensity` ·
`RepRanges` · `SetTypes` · `RecordList` · `SessionWeight` · `FeelingSection` (déplacé depuis
`workout-summary.tsx`) · `CollapsibleBlock` (enveloppe des blocs lourds, R6/D6).

Tokens repris des maquettes, eux-mêmes relevés du thème réel — aucune couleur nouvelle.

### Étape 5 — Branchement des deux routes

- `workout-summary.tsx` → `<WorkoutReport workoutId={id} context="post-session" />` ; garde
  l'enregistrement comme modèle et le partage.
- `history/[id].tsx` → `<WorkoutReport workoutId={id} context="history" />` ; **supprime** son
  `MetaRow` / `ExerciseCard` / `SetRow` / `RecordRow` locaux (le défaut « 8/10 » disparaît avec).

### Étape 6 — i18n

Clés sous `workout.report.*` dans `fr.json` et `en.json` : libellés de niveaux, titres de blocs,
5 phrases de verdict, groupes musculaires, plages de reps, unités, a11y.

### Étape 7 — Réglages

Entrée « Niveau du bilan de séance » dans `settings.tsx`, à côté de celle de la séance, même
composant de liste.

### Étape 8 — Vérification

`npm run typecheck` · `npm run lint` · `npm run test` (⚠️ lire le code de sortie **sans pipe**) ·
`npx expo export --platform web` comme smoke-test de bundling.

## Risques

| Risque | Parade |
|---|---|
| Écran très long en Avancé | `CollapsibleBlock` : blocs lourds repliés, chiffre-clé sur l'en-tête |
| Régression sur l'historique (écran réécrit) | Ses tests existants sont conservés et adaptés, pas supprimés |
| Colonne oubliée dans le schéma PowerSync | Étape 2.5, explicite — piège déjà rencontré deux fois |
| Perf du niveau Avancé | Une passe de requêtes + `useMemo` sur `(workoutId, level)` |

## Hors périmètre

Temps de repos réel (D3, reste au backlog) · ratio pousser/tirer (D4) · contexte nutritionnel du
record (D5) · tendance historique de la densité.
