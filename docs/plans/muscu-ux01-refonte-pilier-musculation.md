# US MUSCU-UX01 — Refonte UX du pilier Musculation — Plan d'implémentation

**Goal:** Remettre le pilier muscu autour du geste plutôt que des données disponibles — hub à deux
zones plafonné, barre d'action collante en séance, entrée dans un programme sans friction, résumé
et historique qui montrent la séance, progression en trois onglets.

**Spec :** [muscu-ux01-refonte-pilier-musculation.md](../specs/functional/us/muscu-ux01-refonte-pilier-musculation.md)
(validée par Florian le 10/09/2026, avec le PDF et les 19 planches du canvas).
**Audit :** [audit-ux-2026-09.md](../refonte-muscu/audit-ux-2026-09.md).
**Maquettes :** [design/refonte-muscu-2026-09/](../../design/refonte-muscu-2026-09/).

**Branche :** `feature/muscu-refonte-ux`, depuis `dev`, dans le **worktree**
`.claude/worktrees/muscu-refonte`.

> **Parallélisation.** Une autre session travaille sur `feature/accueil-refonte` et a déjà modifié
> `packages/shared/src/widgets.ts` (ajout de la forme `row`, refonte de `HOME_WIDGET_IDS`),
> `components/widgets/WidgetGrid.tsx` (prop `sizeFor`, géométrie extraite dans `grid-geometry`) et
> `(tabs)/index.tsx`. Le worktree isole les deux chantiers.
>
> **Zones de contact au merge, à traiter avec soin :**
> - `packages/shared/src/widgets.ts` — eux : `WidgetSize`, `HOME_WIDGET_IDS`, `MAX_HOME_WIDGETS`.
>   Nous : `STRENGTH_WIDGET_IDS`, `MAX_STRENGTH_WIDGETS`, `defaultSize.strength`. Régions
>   distinctes du même fichier ; conflit textuel possible, sémantique nulle.
> - `WidgetGrid.tsx` — **aucun contact** : `isActive` est un prop qui existe déjà, on ne fait que
>   le passer depuis `strength.tsx`.
> - Si la forme `row` est mergée avant nous, vérifier qu'aucun `switch` exhaustif sur `WidgetSize`
>   côté muscu ne la laisse de côté.

> **Invariants :**
> - **Offline-first** : toutes les mutations passent par les repositories existants (écriture
>   locale d'abord). **Aucune migration**, aucune table, **aucune mise à jour des sync rules**.
> - **i18n** parité FR/EN, aucune chaîne en dur, aucun libellé orphelin.
> - **Pas de nouvelle dépendance native** : `expo-haptics` est **déjà** au projet (utilisé par
>   `planning/index.tsx`) → pas de rebuild.
> - Le **niveau d'affichage ne pilote jamais la barre collante** (règle R4-1 de la spec).
> - À chaque tâche : `npm run typecheck` + `npm run test` verts avant de passer à la suivante.

---

## Task 1 — Briques pures (`packages/shared`) + tests

- [ ] `strength-planning.ts` : `spreadSessionsOverWeek(n)` (règle R2-1) — répartition des séances
      sur 7 jours en maximisant l'écart minimal.
- [ ] `strength-hub.ts` : `resolveHubState(input)` (règle R3-1) — priorité A > B > C > D, retourne
      un état discriminé.
- [ ] `workout-comparison.ts` : `compareExercisePerformance(current, previous)` (règle R5-1) —
      écart charge puis reps, `null` si pas de référence.
- [ ] `workout-feeling.ts` : échelle de ressenti à cinq niveaux nommés + conversion depuis/vers le
      RPE stocké (réutilise le patron d'`useIntensity` : la donnée en base ne change pas de nature).
- [ ] `widgets.ts` : `STRENGTH_WIDGET_IDS` ramené à 3, `MAX_STRENGTH_WIDGETS = 3`, `defaultSize`
      ajusté, et **le test qui casse si le registre grossit**.
- [ ] Tests Vitest pour chaque brique.

## Task 2 — Correctifs isolés (R1)

- [ ] `/progress` : les quatre `router.push('/workout')` des états vides pointent vers `/(tabs)/strength`.
- [ ] `history/index.tsx` : afficher `volumeKg` (déjà chargé).
- [ ] `workout.tsx` : « Mettre en pause » → « Quitter et reprendre plus tard ».
- [ ] `RestOverlay.tsx` : `STRENGTH_COLOR` en dur → `colors.panel` du thème.

## Task 3 — Entrée dans un programme (R2)

- [ ] `programs/[id].tsx` : bouton unique « Suivre ce programme » ; duplication implicite puis
      navigation vers l'assistant de **la copie** ; information après coup.
- [ ] `planning/plan.tsx` : début par défaut **aujourd'hui** (3 choix), jours pré-affectés via
      `spreadSessionsOverWeek`, `canPlan` vrai à l'ouverture, atterrissage sur `/(tabs)/strength`.
- [ ] Vérifier la **non-régression running** : `plan.tsx` est pilier-agnostique.

## Task 4 — Hub muscu (R3)

- [ ] `components/strength/StrengthNowCard.tsx` : les quatre états, hors grille.
- [ ] `components/strength/ProgramProgressBar.tsx` : semaine X/Y + séances faites.
- [ ] `components/strength/SuggestedPrograms.tsx` : trois programmes filtrés sur le profil.
- [ ] `data/repositories/` : le hook qui alimente `resolveHubState` et la progression programme.
- [ ] `(tabs)/strength.tsx` : deux zones, `isActive` passé à `WidgetGrid`, ligne d'annuaire en pied.
- [ ] `strength-widgets.ts` : registre à 3 ; `strength-records` et `strength-training-time`
      déplacés vers `/progress`.

## Task 5 — Séance en cours (R4) — le gros

- [ ] `components/workout/SetActionBar.tsx` : barre collante, unités selon `setType` (R4), steppers.
- [ ] `components/workout/SessionMenuSheet.tsx` : niveau d'affichage, repos, réorganiser, quitter.
- [ ] `CurrentSetCard.tsx` → devient le **contexte** scrollable : plus de champs de saisie, plus de
      réglage de repos, plus de bouton valider.
- [ ] `ExerciseList.tsx` : tap dissocié (nom = focus, chevron = dépli).
- [ ] `RestOverlay.tsx` : annonce de la série suivante + réglage « toujours N s sur cet exercice ».
- [ ] `workout.tsx` : recomposition, avancement `n/N` en barre haute, haptique à la validation,
      barre qui devient « Terminer la séance » quand tout est validé.

## Task 6 — Résumé (R5)

- [ ] `components/workout/SummaryExerciseList.tsx` : détail par exercice + écart.
- [ ] `workout-summary.tsx` : bande de stats, ressenti nommé, réordonnancement.
- [ ] `workout-repository.ts` : le hook qui fournit le détail par exercice de la séance close.

## Task 7 — Historique (R6)

- [ ] `workout-repository.ts` : nom de séance dans `WorkoutHistoryItem`, `deleteWorkout` (soft
      delete + records + détachement de l'occurrence), filtres programme/muscle.
- [ ] `history/index.tsx` : lignes enrichies, groupement par mois, filtres, suppression confirmée.

## Task 8 — Progression (R7)

- [ ] `progress/index.tsx` éclaté en trois onglets ; les sections existantes deviennent des
      composants réutilisés tels quels autant que possible.
- [ ] Accueil des deux widgets déplacés du hub (records, temps d'entraînement).

## Task 9 — i18n, tests, recette

- [ ] Parité FR/EN de toutes les chaînes touchées ; suppression des clés orphelines.
- [ ] `npm run typecheck` + `npm run lint` + `npm run test` verts.
- [ ] Section de recette dans [RECETTES.md](../../RECETTES.md).
- [ ] Roadmap : ligne 3.59 et compteurs.
