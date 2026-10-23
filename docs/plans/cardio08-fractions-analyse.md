# Plan — CARDIO-08 · « X sur Y dans la plage » sans l'échauffement, dans l'analyse

Spec : [cardio08-fractions-analyse.md](../specs/functional/us/cardio08-fractions-analyse.md) · 23/10/2026 · branche
`fix/cardio08-fractions-analyse` (worktree `.expo/claude-worktrees/cardio-08`, créé depuis `origin/dev` à
`d604dec2` ; poussé par `git fetch origin` → `git rebase origin/dev` → `git push origin HEAD:dev`, jamais de
`git checkout dev`, jamais de force).

✅ **Validé par Florian le 23/10/2026** avec la spec, D1 à D4 telles que proposées. Écrit sur les propositions de la spec : **D1** (filtre dans `summarizeIntervalSeries`), **D2** (libellés des
lignes hors corps de séance), **D3** (seul le commentaire de `run-last-time.ts` est retouché), **D4** (un test
de comparaison plutôt qu'un prédicat partagé). Autre réponse : **D2 refusée** supprime l'étape 3 et le critère
A6, et laisse `fr.json`/`en.json` intacts ; **D3 refusée** laisse le commentaire, l'écart va au CHANGELOG ;
**D1 refusée** (filtre chez l'appelant) déplace la ligne de l'étape 2 dans `analysis.tsx` et retourne A1 et A3
contre l'appel filtré — la fonction partagée garde alors son défaut, documenté.

**Aucune migration, aucune sync rule, aucun `db:types`, aucune dépendance native, aucun déploiement**
(spec §7). Aucune action sur le cloud : le jeu de vérification se joue par Florian ou Damien, dans le SQL Editor,
s'ils le demandent. `run-last-time.ts` : commentaire seulement (D3), aucune ligne de code.

## Ordre de build

Un lot, cinq étapes de travail derrière une porte de validation. Chaque étape de code laisse
`npm run typecheck`, `npm run lint` et `npm run test` verts (code de sortie lu **sans pipe**), sauf l'étape 1
dont le rouge est le but.

| # | Étape | Fichiers | Tests |
|---|---|---|---|
| 0 | **Relecture** de la spec et du plan par un agent de revue — faite le 23/10/2026 | spec §10 | — |
| ⛔ | **Validation par Florian ou Damien** (D1 à D4, régime de recette) — **faite le 23/10/2026**. `etape: validation` → `code` | front-matter | — |
| 1 | **Le filet rouge** : les tests qui échouent d'abord | `run-interval-results.test.ts`, `run-analysis-screen.test.tsx` | A1, A2, A3, A5 (et A6 si D2) **rouges** ; le reste vert |
| 2 | **Le correctif** (D1) | `run-interval-results.ts` | A1 → A5 verts ; les 7 tests existants **sans retouche** (A4) |
| 3 | **Les libellés** (D2) | `run/analysis.tsx`, `i18n/locales/{fr,en}.json` | A6 vert ; parité des locales |
| 4 | **Docs et jeu de vérification** | `run-last-time.ts` (commentaire, D3), spec CARDIO-UX03, spec et plan CARDIO-08, roadmap, CHANGELOG ; jeu SQL dans le scratchpad (non commité) | — |
| 5 | **Vérification entière**, puis `/commit` | ETAT.md (régénéré) | suite complète |

**Préalable d'environnement** : `npm install` dans le worktree (Node 24, `v24.13.1` constaté). Aucun fichier
de `C:\wellness-app` n'est touché.

**Déjà fait à l'entrée dans le pipeline** : la ligne CARDIO-08 quitte `BACKLOG.md` (règle du backlog) ; ETAT.md
régénéré.

## Étape 1 — le filet rouge

### 1.1 `packages/shared/src/run-interval-results.test.ts` (Vitest)

Un helper `sortieDeReference()` construit la sortie du §5 de la spec **par le chemin du tracker** :
`expandIntervalPhases` sur quatre blocs — échauffement `kind: 'warmup'`, 900 s, plage 340–370 ; gammes
`kind: 'drills'`, 3 × 80 m, sans plage, **sans récupération** ; corps `kind: 'work'`, 6 × 400 m, plage 230–240,
récupération 200 m ; retour au calme `kind: 'cooldown'`, 600 s, plage 360–390 — puis `buildIntervalDraft`
phase par phase avec les réalisés du §5 (distance, durée). 17 phases, indices 0 à 16.

Un `describe('CARDIO-08 — le corps de séance seul')` :

| Test | Fixture | Attendu | Avant le correctif |
|---|---|---|---|
| **A1** 🔴 « ni l'échauffement, ni les gammes, ni le retour au calme, ni un segment de récupération ne sont des fractions » | `row()` littérales : une ligne `fast` par nature `warmup`, `drills`, `cooldown`, `recovery`, **chacune avec une plage et dans sa plage** (sinon le compte ne bougerait pas) ; plus deux fractions `work`, une dans la plage, une hors plage | `fastCount` 2, `inRangeCount` 1, `ratedCount` 2, moyenne des deux fractions seules | `fastCount` 6, 5 sur 6 |
| **A2** 🔴 « la sortie de référence : 5 sur 6, 3:58, ± 6 » | `sortieDeReference()` | `inRangeCount` 5, `ratedCount` 6, `Math.round(avg)` 238, `Math.round(sd)` 6, `fastCount` 6 | 6 sur 8, 261, 61, 11 |
| **A3** 🔴 « dit le même chiffre que le hub » | `it.each` : la sortie du §5 et chaque cas du §4 de la spec — arrêt après l'échauffement (avec plage), fractions sans plage, rattrapage à réalisé nul, deux blocs groupés (lot D), segment `recovery` **avec plage**, sortie RUN-F2c sans `kind`, allure sur une borne, échauffement hors plage. Toutes construites par `expandIntervalPhases` → `buildIntervalDraft` | `ratedCount === 0 ? null : { done: inRangeCount, total: ratedCount }` **égal** à `repsInRange(lastTimeReps(rows))` | rouge sur la sortie du §5, l'arrêt après l'échauffement, le segment récupération et l'échauffement hors plage |

A3 importe `lastTimeReps` et `repsInRange` de `./run-last-time` : lecture seule, aucune modification.

### 1.2 `apps/mobile/src/app/run/__tests__/run-analysis-screen.test.tsx` (Jest)

Dans le `describe('fraction par fraction …')` existant, la même sortie construite par les mêmes fonctions
de `@wellness/shared` (helper recopié : les deux espaces de travail ne partagent pas de fixtures de test
aujourd'hui).

- **A5** 🔴 l'en-tête affiche `running.realise.inRange:{"done":5,"total":6}` (avant : `{"done":6,"total":8}`).
  La ligne sous le tableau est **un seul** `Text` aux enfants concaténés ; trois lignes du tableau affichent
  aussi « 3:58 » (gamme 3, fractions 3 et 5), donc `getByText('3:58')` ne prouverait rien. On cible la ligne
  par une regex échappée : `/running\.realise\.avgPace : 3:58/` et `/regularityValue:\{"value":6\}/` (avant :
  `4:21` et `{"value":61}`).
- **A6** 🔴 *(D2)* le libellé d'une ligne hors corps de séance a la forme `${t(clé)} ${row.rep}` quand
  `totalReps > 1`, `t(clé)` sinon :
  - `running.realise.segmentRow.warmup`, `running.realise.segmentRow.drills 2`,
    `running.realise.segmentRow.cooldown` sont affichés ;
  - les lignes « Fraction » se comptent par une regex **ancrée** (l'en-tête de colonne vaut exactement
    `running.realise.rep`) : `getAllByText(/^running\.realise\.rep \d+$/)` en rend **6** (avant : 11) ;
  - l'`accessibilityLabel` de la première ligne est `running.segmentKind.warmup`, celui d'une ligne « Récup »
    `running.segmentKind.recovery`.

**Sortie de l'étape** : la liste exacte des tests rouges, copiée dans les écarts au plan — elle doit être A1,
A2, les cas d'A3 annoncés, A5, A6, et rien d'autre.

## Étape 2 — le correctif (D1)

`summarizeIntervalSeries`, [run-interval-results.ts:129](../../packages/shared/src/run-interval-results.ts#L129) :

```ts
const fast = rows.filter((r) => r.phaseKind === 'fast' && r.segmentKind === 'work');
```

Le commentaire de la fonction gagne le second filtre et sa raison (l'échauffement développé en phase rapide
par RUN-F4 lot B, renvoi à CARDIO-08). La doc d'`IntervalSeriesSummary` suit : `fastCount` = « fractions du
corps de séance » ; `slowestRep` / `fastestRep` = « rang dans les fractions **mesurables** du corps de
séance » (comportement existant, sans lecteur). Rien d'autre ne change dans la fonction.

**Sortie** : A1, A2, A3, A5 verts ; les 7 tests `summarizeIntervalSeries` existants verts **sans retouche**
(tous en `segmentKind: 'work'`, c'est A4) ; « affiche la régularité et le compte dans la plage » vert ; A6
encore rouge si D2.

## Étape 3 — les libellés (D2)

`run/analysis.tsx`, dans le `map` des lignes (l. 320-358) :

- une fonction locale `rowLabel(row)` :
  - `phaseKind === 'recovery'` ou `segmentKind === 'recovery'` → `running.realise.recoveryRow` ;
  - `segmentKind` ∈ `warmup`, `drills`, `cooldown` → `running.realise.segmentRow.<kind>`, suivi du rang si
    `totalReps > 1` ;
  - sinon (`work`, ou une nature inconnue : `segment_kind` n'a aucune contrainte en base) → « Fraction n »,
    comme aujourd'hui ;
- l'`accessibilityLabel` de la cellule pour toute ligne qui n'est pas une fraction, « Récup » comprise :
  `running.segmentKind.<kind>` (+ rang) ;
- la couleur « hors plage » ne change pas (spec D2).

`fr.json` / `en.json` : `running.realise.segmentRow` = `{ warmup, drills, cooldown }` (spec §6). Le test de
parité des locales (`i18n/__tests__/locale-parity.test.ts`) couvre l'oubli d'une langue.

**Sortie** : A6 vert, suite verte.

## Étape 4 — docs et jeu de vérification

- **D3** : `run-last-time.ts`, commentaire l. 75-79 — « `summarizeIntervalSeries`, qui ne filtrait que le type
  de phase, les comptait comme des fractions (corrigé par CARDIO-08) ». Aucune ligne de code.
- Spec CARDIO-UX03, l. 247 et 475 : l'écart « connu, non corrigé » renvoie à CARDIO-08.
- Spec CARDIO-08 : bandeau « codée », écarts au plan en fin de ce plan.
- Roadmap 5.44 : remarque « CARDIO-08 (23/10/2026) : l'analyse compte comme le hub » ; journal des
  réconciliations ; **compteurs inchangés** (5.44 reste ✅, aucune ligne neuve).
- CHANGELOG : une entrée par commit (via `/commit`).

### Le jeu de données de vérification

Sur le modèle de `cible01-recette-donnees.sql` : la sortie du §5, terminée il y a 5 minutes, réalisée pour une
séance « Fractionné » d'un **programme personnel brouillon** (inactif). Le tracker n'écrit de fractions que pour
une séance à blocs : une course libre porteuse de fractions serait un état que l'app ne produit jamais, et la
carte titrerait « Course libre » au-dessus d'un fractionné.

- **Identifiants fixes** `ca2d1008-0000-4000-8000-…` (préfixe propre à l'US : ne croise aucun des quatre autres
  chantiers du jour) ; UUID du compte à renseigner, jamais commité.
- **Lignes** : `programs` (`pillar 'running'`, brouillon inactif) ; `sessions` (`session_type 'fractionne'`,
  « 6 × 400 m ») ; `planned_sessions` du jour en `done` ; `runs` (`status 'completed'`, `finished_at` = `now() -
  interval '5 minutes'`, `started_at` = `finished_at` − 2 575 s, `duration_seconds` 2575, `distance_m`
  7790, `avg_pace_s_per_km` 330.6 — sinon la méta de la carte affiche « — », `planned_session_id`) ; 17
  `run_intervals` (`user_id` du compte — la sync rule filtre dessus —, `phase_index` 0 à 16, `segment_kind`,
  triplets distance / durée / allure **cohérents**, plages en entiers).
- **Garde** — le script refuse de jouer si, hors de ses propres identifiants :
  - une course `active` non supprimée existe (le hub passe en « Reprendre », `resolveRunHubState`) ;
  - une course `completed` non supprimée a fini **aujourd'hui à Paris** (`(finished_at at time zone
    'Europe/Paris')::date`) — la carte prendrait la plus récente ;
  - une séance de course `planned` existe aujourd'hui, avec **exactement** la requête de `useTodayRunSession`
    (`run-repository.ts:446-458` : `owner_id`, `status 'planned'`, `scheduled_date` du jour, séance et
    programme non supprimés, `pillar 'running'`, **sans** filtre de programme actif).
- **Préalables écrits en tête** : pilier Course activé ; ne pas jouer entre minuit et minuit cinq.
- **Nettoyage** par le préfixe, dans l'ordre des clés étrangères ; rejouable le même jour.
- Rejoué d'abord sur un Postgres jetable dans le scratchpad si `initdb` est disponible.

Régime de recette (décision de Florian du 23/10/2026, « recette à la demande ») : **rien n'est commité pour
la recette**. Le script est écrit et rejoué dans le scratchpad, et se donne dans la conversation si la
vérification est demandée. Pas de section RECETTES (le §100 réservé est caduc) ; l'US passe à
`etape: close` dans le commit qui livre le code complet.

## Étape 5 — vérification et livraison

1. `npm run typecheck`, `npm run lint`, `npm run test` à la racine — **suite entière**, code de sortie lu sans
   pipe, après la toute dernière retouche (tests-gardes du dépôt compris).
2. `node scripts/etat.mjs`, puis `node scripts/etat.mjs --check`.
3. `/commit` : front-matter (`code` → `close`), roadmap, CHANGELOG, ETAT. Puis
   `git fetch origin`, `git rebase origin/dev`, `git push origin HEAD:dev`. Conflit sur CHANGELOG, roadmap,
   BACKLOG, ETAT ou les locales : garder les deux côtés, recompter le Récapitulatif depuis le réel, régénérer
   ETAT.

## Risques

- **Conflits de fusion** avec les quatre autres chantiers du jour sur CHANGELOG, roadmap, BACKLOG, ETAT — et,
  avec D2, sur `fr.json`/`en.json`. Résolus en gardant les deux côtés ; la parité des locales le vérifie.

## Écarts au plan

*(à tenir pendant l'implémentation)*
