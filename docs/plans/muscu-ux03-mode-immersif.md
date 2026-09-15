# Plan d'implémentation — MUSCU-UX03 (mode immersif de la séance)

Spec : [docs/specs/functional/us/muscu-ux03-mode-immersif.md](../specs/functional/us/muscu-ux03-mode-immersif.md) ·
Maquettes : [design/muscu-ux03-mode-immersif/](../../design/muscu-ux03-mode-immersif/) ·
Branche : `feature/muscu-ux03-mode-immersif` dans le worktree `.claude/worktrees/muscu-immersif`.

## Principe d'ordonnancement

1. **La logique pure d'abord** (`packages/shared`, TDD strict) : verdict, records en direct, disques,
   chaleur, fantôme, défi, gabarits du coach. Ces briques n'ont besoin d'aucun écran, se testent en
   Vitest, et c'est là que vivent les règles de la spec.
2. **Puis le socle du mode** : préférences, choix, bascule. À la fin du lot 1, l'app a deux modes —
   l'immersif n'étant encore qu'une copie sombre de l'écran classique.
3. **Puis un moment à la fois** : effort, repos, retours, fin. Chaque lot laisse l'app **utilisable**
   et recettable ; aucun lot ne dépend d'un lot ultérieur.
4. **Le fil et le classique en dernier** : notifications et pastille de record, qui touchent le mode
   classique et méritent d'être posés sur une base stable.

**Aucune migration, aucune sync rule, aucune dépendance native** (spec §9) : rien à déployer, rien à
coller dans PowerSync, recettable sur un build de la branche.

## Lot 0 — Préférences et réglages (MO, socle)

| Fichier | Nature |
|---|---|
| `apps/mobile/src/stores/session-mode-store.ts` | **neuf** — mode (`classic` / `immersive`), `chosen`, patron `motion-store` (`secureStorage`, hydratation, défaut) |
| `apps/mobile/src/stores/immersive-prefs-store.ts` | **neuf** — coach (`motivant`/`sobre`/`muet`), tempo, respiration, fantôme, veille, poids de barre, notification de repos (par mode) |
| `apps/mobile/src/app/settings-session.tsx` | **neuf** — écran Réglages › Séance (spec §6). Route **à plat** : le dépôt n'a pas de dossier `settings/` (`nutrition-profile.tsx`, `workout-summary.tsx`…) |
| `apps/mobile/src/app/settings.tsx` | ligne d'entrée vers l'écran |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | `workoutMode.*`, `settingsSession.*` |

Tests : `stores/__tests__/session-mode-store.test.ts`, `immersive-prefs-store.test.ts` (hydratation,
valeur illisible → défaut, persistance appelée).

## Lot 1 — Briques pures (`packages/shared`, TDD)

| Fichier | Contenu | Tests |
|---|---|---|
| `src/workout-verdict.ts` | `computeSetVerdict({ current, reference, referenceFinishedAt, now, unit })` → `{ kind, deltaKg, deltaReps, dayLabelKind }` (spec §5.3), y compris durée, première référence, échauffement. ⚠️ **Ne réutilise pas `compareExercisePerformance`** (`workout-comparison.ts`, qui compare la **meilleure** série) : ce sont deux mesures différentes, la spec §5.3 le dit et chacune garde son libellé | table de cas : supérieur, plus de reps, égal, en dessous, durée, sans référence, jour nommé vs date (référence à 3 j / à 20 j) |
| `src/live-records.ts` | `evaluateLiveRecord({ set, bests, hadHistory })` → `null | { type, value, previous }` ; réutilise l'éligibilité de `computeWorkoutRecords` ; `applyLiveRecord` met à jour les meilleures valeurs de la séance | éligibilité (échauffement, durée, valeurs nulles), priorité `max_weight` > `estimated_1rm`, pas de record sans passé, dé-validation |
| `src/barbell.ts` | `computePlates({ totalKg, barKg, unit })` → `{ perSide: number[], remainder }` | 82,5/20 → 25+5+1,25 ; sous la barre ; reste non chargeable ; livres |
| `src/session-heat.ts` | `computeSessionHeat(sets, exercisesMuscles)` → `Record<FineMuscle, number>` (0,2 plein / 0,1 réduit, plafond 1) + `hottestMuscles` | cumul, plafond, exclusion échauffement |
| `src/ghost.ts` | `computeGhost({ doneSets, references })` → `{ you, ghost, delta, points }` et `computeFinalChallenge({ remaining, weight, plannedReps, lastFeel })` | avance/retard, rangs manquants, défi affiché ou non |
| `src/coach-script.ts` | `pickCoachLine(event, payload, character)` → clé i18n + variables (aucun texte en dur) | une clé par événement, variante sobre, silence en muet |
| `src/set-feel.ts` | `FEELS`, `feelToRpe` (**6/7/9/10** — « Solide » à 7, jamais 8 : `sessionStruggled` coupe la progression dès 8), `rpeToFeel` | aller-retour, valeur hors liste, **et un test qui fixe le seuil** : `feelToRpe('solide') < 8` |
| `src/index.ts` | exports | — |

## Lot 2 — L'écran immersif : scène, pont, plan de séance

| Fichier | Nature |
|---|---|
| `apps/mobile/src/app/workout.tsx` | **porte l'état éphémère de séance** (série courante, dérogation de focus, échéance et repli du repos, état d'édition, menus) et aiguille vers `ClassicWorkout` ou `ImmersiveWorkout`, tous deux **présentationnels**. ⚠️ C'est ce qui rend la bascule de mode sans perte (R-MO-4) : les neuf `useState` d'aujourd'hui vivent dans le parent, sinon le démontage les efface |
| `apps/mobile/src/components/workout/classic/` | déplacement des composants actuels, sans modification de comportement. ⚠️ Casse les imports de `CurrentSetCard.level.test.tsx`, `WorkoutLevelPreview.test.tsx` et `app/__tests__/workout-screen.test.tsx` : à mettre à jour dans le même lot |
| `apps/mobile/src/components/workout/immersive/ImmersiveWorkout.tsx` | machine d'états (`ready` / `effort` / `dial` / `rest` / `allDone`), palette `dark` locale |
| `.../immersive/SessionHeader.tsx` | chrono, ruban segmenté, pastille du fantôme |
| `.../immersive/Stage.tsx` | surtitre, nom, pastilles, repères par niveau, enjeu, puces |
| `.../immersive/ActionDeck.tsx` | aperçu « Ensuite », champs − / +, « Lancer la série », « Valider directement » |
| `.../immersive/SessionPlanSheet.tsx` | plan de séance (toutes les fonctions d'`ExerciseList`) |
| `.../workout/SessionMenuSheet.tsx` | ligne « Mode d'affichage » (les deux modes) |
| `apps/mobile/src/components/strength/StrengthNowCard.tsx` | sélecteur de mode (état `today`) |
| `.../strength/SessionModeSheet.tsx` | **neuf** — feuille du premier lancement |

Tests (Jest) : aiguillage selon le mode, bascule en séance conservant l'état, rendu du ruban,
visibilité par niveau (tableau spec §4.4), plan de séance (dé-valider, supprimer, + Série, aller à).

## Lot 3 — Effort, cadran, ressenti, ajustement (EF, CA, AJ, BC)

| Fichier | Nature |
|---|---|
| `.../immersive/BarbellLoad.tsx` | disques dessinés (`computePlates`), impact au changement de charge |
| `.../immersive/EffortScreen.tsx` | plein écran, tempo (Reanimated, jetons `theme/motion.ts`), compteur tactile, temps sous tension, compte à rebours pour les séries à la durée |
| `.../immersive/RepDial.tsx` | cadran (geste vertical, crans, `hapticSelect`), ressenti, validation |
| `.../immersive/AdjustCard.tsx` | proposition d'ajustement (accepter / garder) |
| `apps/mobile/src/hooks/useExerciseEquipment.ts` | équipement de l'exercice courant (lecture locale) |

Tests : cadran pré-réglé (comptées / objectif), crans, ressenti → `rpe`, proposition seulement dans
les cas de la spec §5.8, barre absente hors `barbell`.

## Lot 4 — Le repos vivant (RP, FA, CO)

| Fichier | Nature |
|---|---|
| `.../workout/RestOverlay.tsx` | variante immersive : respiration, « Prépare-toi », tics T−3→T−1, barre réduite au-dessus du pont |
| `.../immersive/BreathGuide.tsx` | disque de respiration (coupable, `useAppReducedMotion`) |
| `.../immersive/SleepOverlay.tsx` | veille après 20 s, réveil au toucher et à T−5 |
| `.../immersive/GhostCard.tsx` | écart, courbe toi / fantôme (`react-native-svg`) |
| `.../immersive/BodyHeatCard.tsx` | `BodyMap` chauffé + légende textuelle |
| `apps/mobile/src/components/body/BodyMap.tsx` | **évolution** : prop `heat` (0 → 1 par muscle) et couleurs reçues en prop, en plus de `full` / `reduced`. Les **trois** points de montage existants (fiche exercice, aperçu de séance, bilan hebdo) ne changent pas d'appel ni de rendu |
| `apps/mobile/src/data/repositories/workout-repository.ts` | `useSessionReferences(workoutId)` — dernières performances de **tous** les exercices de la séance (une requête, pas une par exercice), **avec `workouts.finished_at`** (absent de `SELECT_LAST_PERFORMANCE`, indispensable au jour nommé du verdict) |
| `apps/mobile/src/data/repositories/exercise-repository.ts` | `useSessionMuscles(exerciseIds)` — muscles primaires / secondaires / fins des exercices de la séance, pour `computeSessionHeat` (`WorkoutEntry` ne porte que l'id et le nom) |

Tests : minuterie et tics (temps simulé), veille (inactivité simulée), fantôme (valeurs de la spec),
chaleur (pectoraux sur développé couché), absence de fantôme sans historique.

## Lot 5 — Les retours (VE, RL, EB, DS, BR)

| Fichier | Nature |
|---|---|
| `.../immersive/VerdictChip.tsx`, `RecordTakeover.tsx`, `ExerciseDoneCard.tsx` | retours de la spec §5.3, §5.4, §5.12 |
| `apps/mobile/src/hooks/useLiveRecords.ts` | meilleures valeurs au lancement + évaluation par validation |
| `apps/mobile/src/app/workout-brief.tsx` | **neuf** — entrée en séance ; « C'est parti » crée la séance |
| `apps/mobile/src/app/(tabs)/strength.tsx`, `planning/index.tsx`, `programs/[id].tsx`, `components/dashboard/NowCard.tsx`, `app/templates/[id].tsx` | passage par le brief en mode immersif — **les cinq** points de démarrage, `NowCard` (accueil général) compris |
| `apps/mobile/src/data/repositories/session-repository.ts` | lecture du contenu de la séance **avant** de la créer : exercices, séries prévues, muscles, charges prévues (enjeu du jour) |

Tests : un seul plein écran de record par séance, pastille pour les suivants, pas de record sans
passé, brief sauté à la reprise et en séance libre.

## Lot 6 — La fin (FI, PA)

| Fichier | Nature |
|---|---|
| `.../immersive/SessionClosing.tsx` | cérémonie (compteurs, corps, fantôme, réplique), puis `/workout-summary` |
| `apps/mobile/src/components/share/ShareCard.tsx` | variante `workout` avec schéma corporel |
| `apps/mobile/src/data/repositories/dashboard-repository.ts` | `useDayCalorieTarget(dayKey)` existe et renvoie déjà `{ target, effectiveTarget, trainingBonus, isTrainingDay }` **en appliquant la décision H** (`resolveActivePillars`) ; le bonus glucides se dérive avec `trainingDayMacroGrams` (`packages/shared/src/nutrition.ts`). Rien à écrire côté nutrition |

Tests : cérémonie jouée pendant la clôture, relais affiché seulement si pilier actif et bonus non nul,
carte de partage sans donnée de santé.

## Lot 7 — Le coach vocal (VO)

| Fichier | Nature |
|---|---|
| `apps/mobile/src/lib/coach-voice.ts` | file d'une seule réplique, `expo-speech`, langue applicative, respect du caractère et du mode muet |
| `.../immersive/CoachCaption.tsx` | légende écrite (toujours), onde animée pendant la parole |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | `coach.*` — jeux **motivant** et **sobre** |

Tests : muet ne parle pas mais affiche, une réplique en coupe une autre, aucune parole pendant
l'effort hors consigne, langue suivie.

## Lot 8 — Le fil et le classique (NO, RC)

| Fichier | Nature |
|---|---|
| `apps/mobile/src/lib/notifications.ts` | **quatre évolutions** : canal **« Séance »** (le canal est codé en dur aujourd'hui), `sticky` + `dismissNotificationAsync` pour la notification continue (présents dans l'`expo-notifications` du SDK 57, non exposés par le module), `setNotificationHandler` **conditionnel** (il affiche tout sans condition — marqueur dans `content.data`), et le rappel de fin de repos (planifié / annulé / replanifié) |
| `apps/mobile/src/data/repositories/notification-repository.ts` | branchement sur le cycle de repos |
| `.../workout/RestOverlay.tsx` | **pastille de record en mode classique** (4 s, `hapticMilestone`), en tête du repos **et** dans la barre réduite — la carte de série est recouverte par le repos dès la validation, une pastille posée dessus serait invisible |
| `apps/mobile/src/data/repositories/notification-repository.ts` | exemption explicite du quota de 3 notifications immédiates par jour (`notification-quota-store`) pour les notifications de séance |

Tests : rappel planifié au lancement du repos, annulé par « Passer », replanifié par « +15 s »,
absent si le réglage est coupé ; handler conditionnel (rien au premier plan) ; quota non consommé ;
pastille classique sur record, absente sans historique.

## Lot 9 — Les cas limites de la spec §7

Un test par cas, là où il vit : exercice **remplacé** en cours (records et fantôme relus), **retour
d'arrière-plan** pendant l'effort (temps sous tension juste) et pendant le repos (échéance juste),
**synthèse vocale indisponible** (légendes seules, sans erreur), **unités en livres** (barre, verdicts,
défi), **deux validations rapprochées** (une seule réplique, un seul plein écran de record), **bascule
de mode** pendant l'effort ou le cadran (retour à l'état « prêt », rien de validé), séries `dropset` et
`failure` (mêmes tempo et cadran qu'une série normale).

## Vérification finale

1. `npm run typecheck` (3 workspaces) — 0 erreur.
2. `npm run lint` — 0 erreur.
3. `npm run test` **en entier, après la toute dernière retouche** (base de départ : 119 fichiers /
   2 642 tests en `shared`, 171 suites / 2 859 tests en mobile).
4. `node scripts/check-i18n-parity.mjs` — parité FR/EN.
5. `node scripts/etat.mjs` — ETAT régénéré.
6. **RECETTES.md** : recopier les 46 critères de la spec §12 dans une section neuve (§62).
7. Roadmap : ligne **3.61** passée à ✅ / 🟡 selon le réel, compteurs et journal de réconciliation.
8. Dire explicitement ce qui **n'a pas** été fait (coach IA, sons, temps sous tension stocké,
   décompte à la seconde dans la notification).
