# Plan d'implémentation — MUSCU-UX07 (hub Musculation en trois onglets)

Spec : [docs/specs/functional/us/muscu-ux07-hub-trois-onglets.md](../specs/functional/us/muscu-ux07-hub-trois-onglets.md) ·
Maquette : [design/muscu-ux07-hub-trois-onglets/](../../design/muscu-ux07-hub-trois-onglets/) ·
Branche : `feature/muscu-ux07-hub-trois-onglets`.

Ce que le plan ne touche pas :
- **aucune migration, aucune table, aucune sync rule PowerSync, aucune dépendance native** ;
- **l'accueil** (D5).

Ce qu'il ajoute : trois requêtes SQL de lecture, et des chaînes i18n en FR et EN (test de parité
existant).

Chaque étape se termine au vert : `npm run lint`, `npm run typecheck`, `npm run test`, code de sortie
lu **sans pipe**. TDD : le test d'abord, rouge, puis le code. Références `R*` et `D*` : la spec.

## Étape 1 — Briques pures (`packages/shared`, Vitest)

| Fichier | Contenu | Tests |
|---|---|---|
| `src/last-performance.ts` | `summarizeLastPerformance(sets)` → forme structurée de R3 : `uniform` (une charge, reps[]), `mixed`, `bodyweight`, `loaded`, `assisted`, `duration`, `loadedDuration`, `heterogeneous` (types mêlés), `none` ; troncature à cinq séries + reste. `commonWorkoutDate(rows)` pour l'en-tête « LA DERNIÈRE FOIS · date » (date commune, sinon `null`). | Charge uniforme, charges mixtes, poids du corps, lest, assistance, durée, durée lestée, PdC + lest mêlés, série sans charge, série sans reps, dropset, six séries, liste vide, décimales. |
| `src/history-calendar.ts` | `buildMonthGrid({ year, month, workouts, plannedDayKeys, todayKey })` → semaines × 7 cellules, lundi en premier, cases des mois voisins vides ; `monthSummary(workouts)` (séances, tonnes, records) ; `monthRange(firstWorkoutDayKey \| null, todayKey)` ; `shiftMonth`. | Mois qui commence un lundi / un dimanche, 28 à 31 jours, février bissextile (2028), prévu dans le passé ignoré, record prioritaire, deux séances le même jour, aujourd'hui, bornes (dont « aucune séance » = mois courant seul). |
| `src/hub-section.ts` | `HUB_SECTIONS` ; `resolveHubSection({ param, remembered })` (D3 : paramètre > mémoire > `train`). | Chaque priorité, paramètre invalide ignoré. |
| `src/session-target.ts` | `resolveSessionTarget({ targetSets, targetReps, targetWeightKg })` → parties (séries × reps texte, « 1 série » si vide, charge prévue). | « 4 × 8-12 », « 3 × AMRAP », séries seules, `targetSets` null, charge prévue. |

Exports dans `src/index.ts`.

## Étape 2 — Données (`apps/mobile/src/data/repositories`)

| Fichier | Changement | Tests (`__tests__/*-sql.test.ts`) |
|---|---|---|
| `strength-hub-repository.ts` | `SELECT_TODAY_PLAN` ramène `e.id AS exercise_id`. **R9** : `todaySession` ne garde que les lignes de la première occurrence (`planned_session_id` de la 1ʳᵉ ligne) — corrige `exerciseCount` qui additionnait deux séances. Expose `todayExercises` (id, nom, ordre) et `weekIndex`. État « en cours » : nom de la séance via `sessions` (sinon `null` → « Séance libre »). | Colonne présente ; deux occurrences le même jour → une seule comptée. |
| `session-preview-repository.ts` (nouveau) | `SELECT_SESSION_PREVIEW` + `useSessionPreview(sessionId)` : **tous** les `exercise_plans` non supprimés de la séance, `LEFT JOIN exercises` (un exercice archivé garde son nom), `target_sets`, `target_reps`, `target_weight_kg`, ordre du plan — la même source que `startWorkoutFromSession`. | Pas de filtre `e.deleted_at` ; ordre ; `deleted_at` du plan respecté. |
| `workout-repository.ts` | `useWorkoutHistory` : `WorkoutHistoryItem.firstExercises` (les deux premiers exercices travaillés, dans l'ordre) pour D9. `SELECT_EXERCISES_LAST_DONE` + `useExercisesLastDone()` (R7) : une requête agrégée, nom avec repli langue courante → FR → toute langue. | Filtres `deleted_at`, `done = 1`, `set_type <> 'warmup'`, séance terminée, propriétaire ; deux premiers exercices. |
| `planned-session-repository.ts` | `SELECT_PLANNED_STRENGTH_DAYS` + `usePlannedStrengthDays(fromKey, toKey)` : statut `planned` seulement, pilier strength, bornes incluses. | Statut, pilier, bornes. |

## Étape 3 — Une seule suggestion pour la séance et le hub (R11)

Le calcul **sort** de `app/workout.tsx` au lieu d'être recopié. Cette étape passe **seule** dans un
commit, tests de la séance au vert, avant toute modification du hub.

| Fichier | Changement |
|---|---|
| `hooks/useProgressionSuggestion.ts` (nouveau) | `useProgressionSuggestion(exerciseId, rang, { programId, weekIndex })` : `useLastPerformance` + `usePreviousStruggled` + `usePriorWeekAdherence` + `computeProgressionSuggestion`. Renvoie `{ lastPerf, suggestion }`. |
| `lib/suggestion-label.ts` (nouveau) | `suggestionLabel(t, units, suggestion, { short })` : libellés longs `workout.suggestion.*` (séance, aperçu) ou courts `strengthHub.lastTime.tip.*` (carte). `proposeLoad` (arrondi selon équipement, barre, unités) déplacé ici. |
| `app/workout.tsx` | Utilise les deux. **Aucun changement de comportement.** |

Tests :
- `hooks/__tests__/useProgressionSuggestion.test.ts` : la sortie sur un jeu de données est identique à
  l'ancien calcul inline.
- `lib/__tests__/suggestion-label.test.ts` : les cinq cas, en court et en long.

## Étape 4 — Composants (`apps/mobile/src/components/strength/`)

| Composant | Rôle | Remplace / réutilise |
|---|---|---|
| `StrengthHeader.tsx` | En-tête compact : titre, icônes Planning / Bibliothèque, `HubSectionTabs`. Dégradé `stageTheme('strength')`, pas de matière (D6). | Remplace `StrengthStage.tsx` (supprimé avec son test). |
| `HubSectionTabs.tsx` | Trois segments, `accessibilityRole="tablist"` / `"tab"` + `accessibilityState.selected`. Non collé (D2). | — |
| `MomentCard.tsx` | La carte du moment, cinq états, tableau « après » du §4.2-1. « Partager » ouvre `ShareCardSheet` avec les mêmes données que `workout-summary` (constructeur extrait si besoin). | Contenu repris de `StrengthStage`, sans silhouette ni ligne « record à portée ». |
| `ResumeLine.tsx` | « Séance en cours · Reprendre », en tête d'Historique et de Progrès (D3). | — |
| `LastTimeList.tsx` + `LastTimeRow.tsx` | Trois lignes ; chacune appelle `useProgressionSuggestion(id, 0, …)`, formate R3 avec `useUnits`, pastille courte. En-tête avec date commune ou date par ligne. | — |
| `ModeLine.tsx` | « Mode classique · Changer » → `SessionModeSheet` variante `change` (D4). | Remplace `ModeSelector` interne à `StrengthStage`. |
| `components/workout/immersive/SessionModeSheet.tsx` | Prop `purpose: 'start' \| 'change'` : en `change`, mode courant présélectionné, bouton `workoutMode.changeCta`, pas de case « retenir ». `start` inchangé (R-MO-3). | Test de la feuille complété. |
| `WorkoutRow.tsx` | Ligne partagée hub / historique : pavé date, nom (D9 : « Séance libre » + deux premiers exercices), durée · tonnage, records, Refaire. | Remplace les lignes de `app/history/index.tsx`. |
| `RecentWorkouts.tsx` | Trois dernières séances + « Tout l'historique ». | Logique `repeatable` sortie de `strength.tsx`. |
| `OtherActions.tsx` | Tuiles Séance libre (avec `askMode`, R-MO-3) et Mes templates (`/templates`). | `FreeSessionSheet.tsx` n'a plus d'appelant : **supprimé** avec son test. |
| `ProgramCard.tsx` | `StrengthWeekCard` + `ProgramProgressBar` dans une carte. | Réutilise les deux. |
| `HistoryCalendar.tsx` | `buildMonthGrid`, flèches bornées, résumé en deux clés, légende, libellés TalkBack. | — |
| `ExerciseLastDoneList.tsx` | Recherche (sans accents) + liste R7. | — |
| `hooks/useRedo.ts` | R4 : séance active → `Alert.alert` (Reprendre / Annuler), rien de créé ; sinon `startWorkoutFromWorkout` puis `/workout`, sous `useActionLock`. Utilisé par le hub, l'historique et le détail. | Remplace `onRepeatWorkout`. |
| `hooks/useStartTodaySession.ts` | Démarrer la séance du jour : `askMode` (R-MO-3), brief immersif, verrou. Utilisé par la carte et l'aperçu. | Logique sortie de `strength.tsx`. |

Tests Jest (`components/strength/__tests__/`) :

| Test | Vérifie |
|---|---|
| `HubSectionTabs` | Rôles et état sélectionné. |
| `MomentCard` | Les cinq états, leurs gestes, la priorité R2 (séance libre du matin + séance prévue → « Démarrer »). |
| `LastTimeRow` | Les formats R3, « Première fois », pas de pastille sans suggestion. |
| `WorkoutRow` | Libellé d'une séance libre (D9), `aria` de Refaire. |
| `RecentWorkouts` et `OtherActions` | Masqués pendant une séance. |
| `HistoryCalendar` | Appui sur un jour à une séance ou à deux ; bornes ; accords au singulier ; libellés TalkBack. |
| `ExerciseLastDoneList` | Recherche sans accents ; tri. |
| `useRedo` | Alerte si séance active, rien de créé. |
| `SessionModeSheet` | Variante `change`. |

## Étape 5 — Écrans

| Fichier | Changement |
|---|---|
| `stores/strength-section-store.ts` (nouveau) | Zustand en mémoire : `section`, `setSection`. |
| `components/stage/StageScrollView.tsx` | Accepte une prop facultative `scrollRef` vers son `ScrollView`, sans rien changer d'autre. Les trois autres écrans à scène n'en passent pas. `stage.test.tsx` doit rester vert. |
| `app/(tabs)/strength.tsx` | Réécrit : `StrengthHeader` + une section parmi trois. Garde `useMenuFocus`, `TrainingContextSheet` (GUID-01), `DirectorySheet`, `SessionModeSheet`. D3 : `resolveHubSection`, paramètre `section` effacé après lecture (`router.setParams({ section: undefined })`). D2 : `useScrollToTop(ref)`. |
| `components/strength/sections/TrainSection.tsx` | §4.2, R8. |
| `components/strength/sections/HistorySection.tsx` | §4.3 : `ResumeLine`, calendrier, « Séances · Par exercice ». Reprend `dateOf`, la suppression par appui long et sa confirmation depuis `app/history/index.tsx`. |
| `components/strength/sections/ProgressSection.tsx` | §4.4 : `ResumeLine`, cartes existantes déplacées telles quelles, lien `/progress`, message sans séance. |
| `app/session-preview.tsx` (nouveau) | §4.5, paramètres `sessionId` et `plannedSessionId`, source `useSessionPreview`, libellés longs, Démarrer via `useStartTodaySession`. |
| `app/history/index.tsx` | Devient une redirection vers `/(tabs)/strength?section=history` (D7). |
| `app/history/_layout.tsx` | Vérifier que « retour » depuis `[id]` ne repasse pas par l'index (pas d'`initialRouteName` sur l'index) ; test de navigation. |
| `app/history/[id].tsx` | Bouton collé « Refaire cette séance » via `useRedo` (§4.6), absent sans exercice travaillé. |

Suppressions, chacune après recherche d'usages :
- `StrengthStage.tsx` et son test ;
- `stage/matter/ImpactSilhouette.tsx` ;
- `FreeSessionSheet.tsx` et son test.

`silhouette-paths.ts` reste.

## Étape 6 — i18n

`fr.json` et `en.json` : les clés du §7 de la spec. Les clés qui n'ont plus d'usage
(`stage.strength.primary.*`, `stage.strength.secondary.*`, `stage.strength.eyebrow.*`,
`stage.strength.near.*`, `strengthHub.onboarding.freeHint`…) sont retirées **après** recherche dans
le code, des deux fichiers à la fois (parité).

## Étape 7 — Tests d'écran et tests-gardes

| Test | Vérifie |
|---|---|
| `app/(tabs)/__tests__/strength-screen.test.tsx` (réécrit) | Trois onglets ; S'entraîner à froid ; paramètre `section` lu puis effacé ; mémoire d'onglet ; « Voir le détail » absent ; « Voir les N exercices » ouvre `/session-preview` ; R8 pendant une séance. |
| `app/__tests__/session-preview.test.tsx` (nouveau) | Liste complète (exercice archivé compris), objectifs, charge prévue, « Première fois », Démarrer. |
| `app/history/__tests__/history-screen.test.tsx` (réécrit) | La redirection. Le contenu testé passe dans les tests de `HistorySection`. |
| `app/history/__tests__/workout-detail-screen.test.tsx` | « Refaire cette séance » présent / absent ; alerte pendant une séance. |
| Tests-gardes du dépôt | Parité i18n, contrastes, `stage.test.tsx` (pas de bandeau collé), `widgets.test.ts` (`MAX_HOME_WIDGETS` inchangé), `QuickActions` inchangé. |

## Étape 8 — Suivi (au fil des commits, via `/commit`)

- Front-matter de la spec : `code` au premier commit de code, `recette` à la fin.
- Roadmap : ligne **3.65**, ⬜ → 🟡 → ✅, compteurs, journal des réconciliations.
- RECETTES.md : section MUSCU-UX07 reprenant le §10 de la spec.
- CHANGELOG et ETAT.md régénérés par `/commit`.

## Ordre de build et risques

L'ordre est 1 → 2 → 3 → 4 → 5 → 6 → 7.

| Risque | Parade |
|---|---|
| Régression de l'écran de séance en extrayant la suggestion | Étape 3 isolée dans son commit ; tests existants non modifiés ; test d'équivalence |
| Pastille du hub différente de la séance | Même hook, même semaine de programme, même arrondi (R11) ; critère de recette |
| Liens vers `/history` cassés | Redirection (D7) + test ; recherche de tous les `'/history'` avant de finir |
| Paramètre `section` qui se réapplique à chaque retour | Effacé après lecture (D3) ; test |
| `scrollRef` sur `StageScrollView` qui dérange les autres piliers | Prop optionnelle ; `stage.test.tsx` et tests des trois autres hubs au vert |
| Performance de « Par exercice » et des deux premiers exercices sur un gros historique | Requêtes agrégées ; recette sur le compte de Florian, le plus chargé |
| Orphelins après suppression (`FreeSessionSheet`, `ImpactSilhouette`, clés i18n) | Recherche d'usages avant chaque suppression ; lint |
| Réintroduire un bandeau collé | Sélecteur non collé (D2) ; `stage.test.tsx` en garde |

## Estimation

Environ 5 jours de développement, hors recette sur device.

## Réalisé (25/09/2026)

Livré en trois commits sur la branche, poussés sur `dev` :

1. Étapes 1-2 : briques pures et requêtes.
2. Étape 3 : la suggestion sort de `workout.tsx`, seule dans son commit.
3. Étapes 4 à 7 : les écrans.

Ajouts par rapport au plan :
- `hooks/useModeGate.ts` : la question du premier mode (R-MO-3), sortie du hub pour servir aussi l'aperçu ;
- `useLastDoneDates` : la date d'en-tête de « la dernière fois » ;
- `hasActiveWorkout` : R4 lu au moment de l'appui ;
- `useSessionName` : le titre de l'aperçu ;
- `hooks/useLastPerfFormat.ts` : les charges sans zéro inutile, la date courte, les tonnes ;
- le paramètre `share=1` de `workout-summary`.

Détail dans le §11 de la spec et dans le CHANGELOG.
