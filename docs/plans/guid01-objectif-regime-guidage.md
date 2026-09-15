# Plan d'implémentation — GUID-01

Spec : [guid01-objectif-regime-guidage.md](../specs/functional/us/guid01-objectif-regime-guidage.md).
Branche : `feature/guid01-objectif-regime-guidage`, depuis `origin/dev`.

Ordre imposé par les dépendances : **le socle pur d'abord** (testable sans device), la base ensuite,
l'interface en dernier. Chaque étape laisse `npm run typecheck` et `npm run test` verts.

---

## Étape 1 — Le socle pur (`packages/shared`)

Rien d'autre ne peut commencer : tout le reste importe ces fonctions.

| Fichier | Contenu |
|---|---|
| `src/guidance.ts` *(neuf)* | `GUIDANCE_REGIMES`, `guidanceRegimeSchema`, `DECISION_KINDS`, `SAFETY_DECISIONS`, `dispositionFor(kind, regime)`, `effectiveRegime`, `hasChosenRegime`, `displayLevelForRegime` |
| `src/goal-defaults.ts` *(neuf)* | `pillarDefaults(goal)` — la matrice §3.1 ; `TRAINING_LEVELS`, `TRAINING_FOCUSES` |
| `src/goal-conflicts.ts` *(neuf)* | `detectGoalConflicts(input)` → `GoalConflict[]`, avec `id` stable par règle |
| `src/nutrition.ts` | `objectiveFromGoal` devient un adaptateur sur `pillarDefaults` — **signature inchangée**, les 8 appelants ne bougent pas |
| `src/profile.ts` | 8 champs au `profileRowSchema`, tous `.nullable().default(null)` |
| `src/index.ts` | 3 exports |

**Tests Vitest** (`*.test.ts` à côté) : la table de dispositions × 3 régimes ; les 3 signaux de
sécurité jamais `silent` **et** jamais `apply` ; l'héritage global → pilier ; `hasChosen` faux tant
que rien n'est écrit ; les 4 objectifs × 3 piliers de `pillarDefaults` ; chaque règle de conflit dans
les deux sens (déclenchée / non déclenchée) ; non-régression de `objectiveFromGoal` sur les 4 valeurs
+ `null`.

> ⚠️ **Le test qui compte** : `performance` et `health` doivent produire des `pillarDefaults`
> **différents**. C'est le constat 2 de l'analyse transformé en filet.

---

## Étape 2 — Base de données

1. `npm run db:new guid01_guidance_regime_and_training_context`
2. SQL : 8 colonnes additives sur `profiles`, `check` sur les énumérations,
   `weekly_availability between 1 and 7`, commentaires de colonne.
3. `npm run db:push:dry` puis `npm run db:push`
4. `npm run db:types`
5. Cocher dans [supabase/MIGRATIONS.md](../../supabase/MIGRATIONS.md)

✅ **Aucune sync rule à redéployer** — `profiles` est déjà publiée en `select *`.

🔴 **Dans la même étape, sinon la migration ne sert à rien** :
- `apps/mobile/src/powersync/schema.ts` → les 8 colonnes dans `profiles`
- `apps/mobile/src/data/repositories/profile-repository.ts` → `ProfileInput`, `ProfileDbRow`,
  `rowToProfile`, `inputToColumns`

C'est le trio qu'on a déjà oublié deux fois (CYCLE-01, `daily_step_goal`). Un test de garde vérifie
que toute clé de `ProfileInput` a sa colonne dans `inputToColumns`.

---

## Étape 3 — Onboarding

| Fichier | Action |
|---|---|
| `(onboarding)/goal.tsx` | conséquences sous chaque option · question de discipline conditionnelle · chips d'échéance |
| `(onboarding)/guidance.tsx` *(neuf)* | l'écran des 3 régimes, avec aperçu et clause de sécurité ; écrit `guidance_regime` **et** `workoutDisplayLevel` déduit |
| `(onboarding)/displayLevel.tsx` | **supprimé** du parcours (le réglage survit dans `settings.tsx`) |
| `(onboarding)/summary.tsx` | ligne Guidage avec mention de repli · carte sombre « Ta première action » |

Le chaînage `goal → guidance → activity|summary` reprend exactement la logique conditionnelle
existante de `displayLevel.tsx` (le pilier nutrition décide de l'étape 5).

---

## Étape 4 — Musculation : contexte et suggestions

| Fichier | Action |
|---|---|
| `components/strength/TrainingContextSheet.tsx` *(neuf)* | 2 questions, ouverte quand `training_level` est `null` |
| `components/strength/SuggestedPrograms.tsx` | `training_level` d'abord, `workoutDisplayLevel` en dernier repli ; biais d'objectif ; filtre de disponibilité **qui ne vide jamais la liste** |
| `app/strength-profile.tsx` *(neuf)* | régime + contexte ; route dans `_layout.tsx` ; lien dans `settings.tsx` à côté des deux autres profils |

---

## Étape 5 — Le régime dans les autres piliers

`nutrition-profile.tsx` et `running-profile.tsx` reçoivent le même sélecteur segmenté + la mention
« déduit ». Composant partagé `components/guidance/GuidanceSelector.tsx` pour ne pas l'écrire trois
fois.

---

## Étape 6 — Les dispositions appliquées

| Point | Changement |
|---|---|
| `planned-session-repository.ts` | `useSessionConflicts` respecte la disposition. `sessionConflictsEnabled` reste **maître** : éteint, rien ne se produit quel que soit le régime |
| la carte de collision | `apply` → déplacement + annonce + annulation · `propose` → deux boutons · `silent` → rien |
| cible glucidique (MN-04) | `apply` → ajustée · sinon inchangé |
| récapitulatif (`guided`) | « poser le programme » = `duplicateProgram` **puis** `activateProgram` — un éditorial ne s'active pas directement (RLS) |

---

## Étape 7 — Les contradictions

`components/dashboard/GoalConflictCard.tsx` + entrée au registre de widgets. Rejet par règle en
préférence locale (store Zustand persistant, patron `useTrackedMicros`). Jamais affiché en
`autonomous`. Un seul conflit à la fois (plafond ADR-007).

---

## Étape 8 — i18n, vérifications, suivi

1. ~90 clés dans `fr.json` **et** `en.json` — un test de parité des clés existe déjà dans le dépôt.
2. `npm run typecheck` · `npm run lint` · `npm run test` — **lire le code de sortie sans pipe**
   (un `| tail` en aval renvoie 0 même si un test échoue).
3. `RECETTES.md` : les 12 critères de la spec §10.
4. Roadmap : créer la ligne **1.30**, mettre à jour les compteurs, journal de réconciliation.
5. `/commit` : CHANGELOG, front-matter `etape: recette`, ETAT.md, push.

---

## Risques identifiés

| Risque | Parade |
|---|---|
| **Le trio migration / schema.ts / repository** oublié → écriture silencieusement perdue | Étape 2 indivisible + test de garde sur `inputToColumns` |
| **Régression sur les 8 appelants** de `objectiveFromGoal` | Signature inchangée + test de non-régression sur les 5 entrées |
| Le régime **contourne** un interrupteur utilisateur | `sessionConflictsEnabled` testé maître explicitement |
| Un filtre de disponibilité **vide la liste** des programmes | Repli testé : filtre ignoré si résultat vide |
| Le ton FR/EN du mode `guided` | 3 règles de rédaction en spec §7 ; relecture humaine en recette (critère 11) |
| Diff volumineux, revue difficile | Ordre socle → base → UI ; chaque étape verte isolément |
