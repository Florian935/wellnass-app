# Plan d'implémentation — CARDIO-UX03 (hub Course en trois onglets)

Spec : [docs/specs/functional/us/cardio-ux03-hub-onglets.md](../specs/functional/us/cardio-ux03-hub-onglets.md) ·
Maquette : [design/cardio-ux03-hub-onglets/](../../design/cardio-ux03-hub-onglets/) ·
Branche : `feature/cardio-ux03-hub-onglets` (worktree `.expo/claude-worktrees/cardio-ux03`).

Ce que le plan ne touche pas :
- **aucune migration, aucune table, aucune sync rule PowerSync, aucune dépendance native** ;
- **l'accueil**, sauf la destination de la carte de record récent (D7) ;
- **aucun fichier de la muscu ni de la nutrition** : `components/strength/`, `strength-section-store`,
  `hub-section.ts` et leurs voisins sont lus, jamais modifiés. Deux fonctions pures agnostiques du
  pilier sont **importées** telles quelles (`history-calendar.ts`, `resolveProgramProgress`).

Ce qu'il ajoute : trois requêtes SQL de lecture, une colonne à `SELECT_HISTORY`, une préférence locale,
et des chaînes i18n en FR et EN (test de parité existant).

Chaque étape se termine au vert : `npm run lint`, `npm run typecheck`, `npm run test`,
`npm run agents:check`, code de sortie lu **sans pipe**. TDD : le test d'abord, rouge, puis le code.
Références `R*` et `D*` : la spec. Un `/commit` par étape (rebase sur `origin/dev` avant chaque push :
une session Nutrition travaille en parallèle sur les mêmes fichiers de suivi).

## Étape 0 — Cadrage (ce commit)

Spec, plan, maquette (`design/cardio-ux03-hub-onglets/` + toile), ligne **5.44** de la roadmap,
BACKLOG (CARDIO-04 absorbé en partie), `etape: code` (lot en une vague, validé sur la toile).

## Étape 1 — Briques pures (`packages/shared`, Vitest)

| Fichier | Contenu | Tests |
|---|---|---|
| `src/run-hub-section.ts` | `RUN_HUB_SECTIONS = ['run','history','progress']`, `isRunHubSection`, `resolveRunHubSection({ param, remembered })` (D1). | Chaque priorité ; paramètre invalide ou tableau ignoré. |
| `src/run-last-time.ts` | `pickRunLastTime(runs, { sessionId, sessionType })` (R3) → `{ runId, match: 'session' \| 'type' } \| null`. `lastTimeReps(rows)` (R4) → pastilles `{ rep, kind: 'time' \| 'pace', seconds \| null, state: 'in' \| 'out' \| 'none' }`, **phases rapides du segment `work` seulement** ; `repsInRange(reps)` → « X sur Y ». | Même séance prioritaire, repli sur le type, course libre jamais retenue, course non terminée ignorée, aucune ; répétitions en distance / en durée, sans réalisé, sans plage, hors plage, récupérations, échauffement, éducatifs et retour au calme écartés ; « X sur Y » sans « 0 sur 0 ». |
| `src/run-history.ts` | `runDayKey(run)` (fin, sinon début, jour local) ; `runMonthSummary(runs, recordRunIds)` (R9) ; `runTypeSummaries(runs)` (R10) → par type, du plus récent au plus ancien, avec le nombre et la dernière sortie ; `RUN_FREE_TYPE`. | Mois vide, sorties sans distance ni durée, record compté par course, clé libre, tri par dernière sortie. |
| `src/race-objective.ts` | `raceObjective({ targetTimeSeconds, raceDistanceM, records })` (R11) → `{ targetSeconds, compareSeconds, compareKind: 'record' \| 'estimate' } \| null`. | Sans objectif ; record exact à la distance ; estimation Riegel depuis le 5 km ; aucune source ; distance inconnue. |

Exports dans `src/index.ts`.

## Étape 2 — Données et préférences (`apps/mobile/src`)

| Fichier | Changement | Tests |
|---|---|---|
| `data/repositories/run-repository.ts` | `SELECT_HISTORY` ramène `ps.session_id` ; `RunHistoryItem.sessionId`. | Test-garde existant : toujours sans `gps_track` ; colonne présente. |
| `data/repositories/planned-session-repository.ts` | `SELECT_PLANNED_RUNNING_DAYS` + `usePlannedRunningDays(from, to)` : statut `planned`, pilier `running`, bornes incluses. | Statut, pilier, bornes (SQL). |
| `data/repositories/run-hub-repository.ts` (nouveau) | `useRunProgram(programId)` : avancement (`SELECT_RUN_PROGRAM_PROGRESS`, même forme que la muscu), échéance (`target_date`, `target_time_seconds`, `event_name`) et distance de course (séance de type `course`). | SQL : filtres `deleted_at`, propriétaire, programme. |
| `stores/run-section-store.ts` (nouveau) | Onglet affiché, en mémoire, non persisté. | Défaut `null`, `setSection`. |
| `stores/run-start-mode-store.ts` (nouveau) | Dernier mode de départ (`gps` / `manual`) dans `secureStorage` ; `hydrate`, `setSource`. | Défaut GPS, lecture, écriture, valeur corrompue. |

## Étape 3 — Écran de départ et détail d'une sortie

| Fichier | Changement | Tests |
|---|---|---|
| `app/run/index.tsx` | Titre et sous-titre selon le contexte (séance du jour, Recourir, course libre) ; pastilles de la séance ; mode initial = dernier mode (Recourir : GPS) ; `setSource` au démarrage réel (R6) ; paramètre `ghostRunId` présélectionné, vérifié par `useRunGhost` (repli « Course libre » si le profil ne se construit pas) ; **fantôme posé en GPS seulement** (R5, correctif) ; libellé du bouton. | `run-start-screen.test.tsx` : titres, fantôme présélectionné et posé au départ, mode retenu relu, mode retenu écrit (y compris le repli sans GPS). |
| `components/running/GhostPicker.tsx` | Prop `pinned` : une sortie présélectionnée, listée en tête même hors des candidats proches. | Test du composant. |
| `app/run/analysis.tsx` | En tête : type, « séance du programme » / « course libre », date · heure · terrain, quatre chiffres ; « Recourir cette sortie » (GPS) ; `share=1` ouvre la carte une fois chargée. | `run-analysis-screen.test.tsx` : en-tête, Recourir présent / absent, `share=1`. |

## Étape 4 — Le hub (`components/running/`, `app/`)

| Fichier | Rôle |
|---|---|
| `components/running/RunHeader.tsx` | En-tête compact : `PillarStage` + `FlowTrace` en filigrane, titre, icônes Planning / Profil / Programmes, trois onglets (`tablist`). |
| `components/running/RunMomentCard.tsx` | La carte du moment, cinq états (§4.2-1). Remplace `RunStage`. |
| `components/running/RunLastTime.tsx` | « La dernière fois » (§4.2.1) : lit la course (`useRunIntervals`), pastilles ou résumé. |
| `components/running/RunRow.tsx` | Une sortie en une ligne : pavé date, type, records, chiffres, terrain · ressenti, Recourir (libellé ou icône). |
| `components/running/RecentRuns.tsx` | Les trois dernières sorties + « Tout l'historique ». |
| `components/running/RunProgramCard.tsx` | Ton programme (D8). |
| `components/running/RunResumeLine.tsx` | « Course en cours · Reprendre ». |
| `components/running/RunHistoryCalendar.tsx` | Le calendrier du mois (R8, R9). |
| `components/running/sections/RunSection.tsx` · `RunHistorySection.tsx` · `RunProgressSection.tsx` | Les trois onglets. |
| `app/(tabs)/running.tsx` | Réécrit : onglet (D1), `useScrollToTop`, données, routes. |
| `app/running-stats/index.tsx` + `_layout.tsx` | « Toutes tes stats » : l'ancien historique moins la liste ; un record ouvre `/run/analysis`. |
| `app/running-history/index.tsx` | Redirection vers `/(tabs)/running?section=history` (déclare son pilier pour le test-garde). |
| `app/_layout.tsx` | Déclare `running-stats`. |
| `components/running/PaceProgressCard.tsx` et consorts | Appelés avec `/running-stats` au lieu de `/running-history` (les cartes reçoivent déjà leur cible en prop). |
| `components/dashboard/RecordRecentCard.tsx` | Un record de course ouvre « Toutes tes stats » (D7). |
| `packages/shared/src/widget-destinations.ts` | Le widget « Ma semaine » retiré de l'accueil pointe vers `/running-stats`. |
| Suppressions | `RunStage.tsx` (+ test), `RunDirectorySheet.tsx`, clés i18n qu'ils étaient seuls à lire. |

Tests (Jest) :
- `app/(tabs)/__tests__/running-screen.test.tsx`, réécrit : onglets (froid, paramètre lu puis effacé,
  mémoire, paramètre inconnu) ; carte du moment par état et ses gestes ; plus de « Voir le détail »
  ni d'annuaire ; dernières sorties, Recourir, « Tout l'historique » ; pendant une course, Reprendre
  seul et ligne Reprendre dans Historique et Progrès ; Progrès : les cartes et « Toutes tes stats »,
  ou un seul message ; le dénominateur de la semaine (garde de CARDIO-UX02, conservée).
- `components/running/__tests__/RunLastTime.test.tsx`, `RunHistorySection.test.tsx`,
  `RunProgramCard.test.tsx`, `RunHeader.test.tsx`.
- `app/running-stats/__tests__/running-stats-screen.test.tsx` : l'ancien test de l'historique, moins
  la liste ; un record ouvre l'analyse.
- `app/__tests__/pillar-identity.test.ts` : ajoute `running-stats`.
- `app/__tests__/route-declarations.test.ts` : inchangé, doit rester vert (nouvelle route déclarée).

Fin d'étape : RECETTES §87 (critères du §10 de la spec) ; §59 et §79 : critères « hub » marqués
remplacés par §87 (Q10) ; roadmap 5.44 ✅ ; `etape: recette`.

## Risques

- **Deux sessions sur les mêmes fichiers de suivi** (CHANGELOG, roadmap, RECETTES, ETAT, fr/en.json) :
  rebase avant chaque push, compteurs recomptés sur le réel, ETAT régénéré, jamais de push forcé.
- **`fr.json` / `en.json`** : ajouts regroupés sous `runningHub.*` et `runningStats.*` pour limiter
  les conflits avec NUTRI-UX03.
- **Suppression de clés i18n** : ne retirer une clé qu'après un `grep` sur tout `apps/` et
  `packages/` (les cartes de Progrès lisent encore `stage.running.splits.*` et consorts).
