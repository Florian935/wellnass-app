---
id: NORYN-01
titre: "Noryn lit la journée et la semaine — deux synthèses Wellness en lecture seule"
roadmap: [9.17]
catalogue: []
etape: recette
branche: feature/noryn01-noryn-context
maj: 08/10/2026
---

# US NORYN-01 — Noryn lit la journée et la semaine

> **Demande** : Florian, 08/10/2026 — « Noryn veut lire, en lecture seule, deux synthèses de mes
> données Wellness ; le contrat est déjà figé côté Noryn ».
> **Contrat qui fait foi** : dépôt Noryn, `docs/08-WELLNESS-CONTRACT.md`, section « Concrete v1
> contract (TASK-013) », lu le 08/10/2026 sur la branche `agent/claude/TASK-013` (commit `dd55d3b`,
> **non fusionnée** ; sa tête est passée à `942378d` le même jour, sans aucun changement du contrat, du
> brief ni des schémas). Brief : `docs/project/integrations/wellness-noryn-brief.md`, même branche.
> Schémas de référence : `packages/contracts/src/wellness-source.ts` (Noryn).
> **Plan** : [docs/plans/noryn01-noryn-context.md](../../../plans/noryn01-noryn-context.md).
> **Maquette** : sans objet — aucune interface (le brief le prévoit, §4).
> **Relue** le 08/10/2026 par un agent de revue : 3 bloquants et 7 constats importants, intégrés (§16).
> ✅ **Spec et plan validés par Florian le 08/10/2026** : décisions **D1 à D9** retenues telles que
> proposées (§2).
> 🛠️ **Codée le 08/10/2026** (écarts au plan — des moyens, pas des règles — en fin de plan). En recette :
> [RECETTES.md](../../../../RECETTES.md) §92, précédée des gestes humains (secrets, migration,
> déploiement). Aucune migration poussée, aucun appel au projet Supabase par un agent.

## 0. Le besoin

**Noryn** est l'orchestrateur personnel de Florian : agenda, santé et finances, pour décider quoi faire
maintenant. Il ne gère pas la santé. Il veut **lire** deux synthèses, sans jamais rien écrire :

- **la journée** (`GET context/day?date=AAAA-MM-JJ`) : pas, calories et protéines, eau, check-in du
  matin, verdict de forme, « intensité en veille », séances prévues ;
- **la semaine** (`GET context/week?start=<lundi>`) : pas jour par jour, sommeil moyen, séances
  prévues et faites.

Wellness calcule, Noryn ne recalcule rien. Florian a choisi le 08/10/2026 ce qui se partage (brief §2) :
**jamais** l'humeur, le stress, le cycle, les douleurs, le poids, les mensurations, les repas et
aliments, l'alcool, le café, la sieste, les fringales, les notes, le motif de la veille, les séries,
charges, allures, distances, traces GPS, records, ni aucun texte de Prisme.

Le point qui rend l'affaire délicate : l'app est **hors ligne d'abord**. Les calculs tournent sur le
téléphone, les données n'arrivent dans Supabase qu'à la synchro PowerSync, les pas ne sont lus dans
Health Connect qu'au premier plan (au plus une fois par heure, `STEPS_IMPORT_THROTTLE_HOURS = 1`). Une
réponse calculée maintenant peut décrire un téléphone vu il y a six heures : c'est tout le rôle de
`synced_at`.

## 1. Ce que dit le code — écarts avec le brief (vérifié le 08/10/2026 sur `dev`, `2c96d7c`)

| # | Le brief affirme | Le code dit | Conséquence |
|---|---|---|---|
| E1 | `synced_at` ≈ `max(updated_at)` des lignes qui alimentent les synthèses | `updated_at` est écrit **par l'horloge du téléphone** (`_sql.ts` : `nowUtc()` à chaque insertion et mise à jour) et remonte tel quel (`connector.ts` : `upsert` du `PUT`, `update` du `PATCH`). Le déclencheur serveur `set_updated_at` ne réécrit qu'à l'`UPDATE`, et **n'existe pas** sur `daily_steps`, `daily_wellbeing`, `real_life_periods`, `activities` | `max(updated_at)` **est** un horodatage du téléphone : interdit par le contrat. Il faut un reçu serveur → **D3** (migration) |
| E2 | `computeEffectiveTargetForDay` donne « la cible du jour telle que l'app l'affiche » | Cette fonction n'est que le **dernier pas** (base + bonus). La cible affichée est **composée dans un hook** (`useDayCalorieTarget`, `dashboard-repository.ts:424`) : TDEE ou socle hors sport selon le mode, objectif ramené au maintien en période « vie réelle », surcharge manuelle, bonus selon le mode avec la dépense des courses (poids) et la dépense réelle du jour (`useDayEnergy`) | Pas de cible serveur sans extraire cette composition → **D1** |
| E3 | (implicite) la cible de protéines vient du même calcul | Elle vient d'**un autre hook**, `useDayNutritionTargets` : macros manuelles, sinon `trainingDayMacroGrams({ targetBase, effectiveTarget, objective })` | Idem **D1**. Et voir E4 |
| E4 | — | ⚠️ **Écart interne à l'app, découvert ici** : en mode `activities` (DEPENSE-00), `useDayNutritionTargets` calcule la base des macros avec `tdee(...)` alors que `useDayCalorieTarget` prend `sportFreeTdee(...)`. Les protéines (et le bonus de glucides) sont donc calculés sur une autre base que la cible calorique affichée à côté | Hors périmètre ; à arbitrer **avant** de servir `protein_target_g` (D1), sinon Noryn reproduirait le défaut |
| E5 | `computeReadiness` donne « le verdict s'il est affiché » | `computeReadiness` ne fait que **combiner** trois composantes déjà classées. Le verdict affiché est composé dans `useReadiness()` (`dashboard-repository.ts:1567`) : ACWR 7/28 j sur les séances des piliers actifs et les autres activités, apports de 7 j contre la cible de base (donc E2), énergie et stress des 3 derniers check-ins, nuit et « malade » si le pilier Bien-être est allumé. **Aujourd'hui seulement** | Même chantier que E2 → **D1** |
| E6 | Objectif d'eau : `water_target_ml` | La colonne est dans **`nutrition_profiles`** (pas `profiles`) ; défaut `DEFAULT_WATER_TARGET_ML = 2000` (`hydration.ts`) | Précision. Bornes en base (1–10 000) = bornes du contrat ✅ |
| E7 | `intensity_on_hold` : `sick` du jour **ou** une période « vie réelle » ; « le motif : malade, vacances, voyage » | `real_life_periods` ne stocke **aucun motif** (`started_on`, `ends_on`). VIE-01 baisse **les cibles**, pas l'intensité (sa D1 : « les cibles, pas le programme »). « L'intensité en veille », dans l'app, c'est la règle 1 de BIEN-04 : **malade** → séance proposée au lendemain, pilier Bien-être allumé | → **D4** |
| E8 | `planned_sessions` filtrées par utilisateur | La colonne est **`owner_id`** (pas `user_id`), la date `scheduled_date`, l'heure `scheduled_time` (`HH:MM:SS`) | Précision |
| E9 | `sessions.session_type` ∈ six valeurs | La contrainte `CHECK` a été **supprimée** (RUN-F4, volontairement) : la base peut contenir une valeur qu'une version donnée ne connaît pas. `SESSION_TYPES` connaît aussi `course_libre`, hors programme | Valeur inconnue, vide ou `course_libre` → intensité `null`, aucune étiquette (R14) |
| E10 | Course : « la durée prévue si elle est connue » | L'app a `estimateRunMinutes` (`running-hub.ts:107`) : durée cible, sinon volume ÷ allure de référence × 1,15. Le **volume** est calculé **dans l'écran** (`(tabs)/running.tsx:173`), à partir des blocs de `session_intervals` | Extraire ce calcul dans `packages/shared` (refactor sans changement, plan étape 2) |
| E11 | `heavy_lower` : « le seuil de séries jambes de COLLIS-01 » | ✅ `isHeavyLegSession` + `LEG_SETS_CONFLICT_THRESHOLD = 8` (`session-conflicts.ts`). L'agrégation des séries par muscle est une requête SQL du mobile (`SELECT_PLANNED_MUSCLE_SETS`), qui **garde** les exercices archivés et écarte ceux sans muscle principal — alors que la carte du hub (durée estimée) **écarte** les exercices archivés | Le serveur refait la **somme** (pas la règle), avec les filtres de chacune des deux requêtes (§4.2) |
| E12 | `upper_body` | **Aucune définition** dans l'app | → **D7** |
| E13 | Pas suivis : « `health_connect_enabled` ? » | ✅ `user_settings.health_connect_enabled` (opt-in, défaut éteint) est la **seule** source des pas (PAS-01) | → **D5** |
| E14 | `recovery` à `null` si le pilier Bien-être est éteint ? | Le check-in **reste au socle pour tous** (BIEN-02, D1) ; la qualité de nuit et l'envie n'existent que dans la feuille du matin, pilier allumé | → **D5** |
| E15 | Une Edge Function avec `--use-api` peut-elle importer `packages/shared` ? | Voir §7 : la CLI **téléverse** les fichiers du dépôt importés par chemin relatif, **mais** les imports sans extension de `packages/shared` (`from './pillar'`) ne sont pas suivis | Import direct impossible tel quel → **D2** |
| E16 | `ai-assist` écrit `user_settings.updated_at` | ✅ (`index.ts`, `update({ ...patch, updated_at: new Date().toISOString() })`, clé `service_role`) | Confirmé ; le reçu de D3 l'exclut par construction |

Ce que le brief affirme et qui est **exact** : `daily_steps(steps, log_date, deleted_at)`,
`profiles.daily_step_goal` et `DEFAULT_STEP_GOAL = 8000` (bornes en base 1 000–50 000 = celles du
contrat), `food_entries(kcal, protein_g)`, `water_entries.volume_ml`,
`daily_wellbeing(sleep_minutes 0–840, sleep_quality, energy, motivation 1–5, sick)` (bornes en base =
bornes du contrat), `programs.pillar ∈ {strength, running}`, `planned_sessions.status ∈ {planned, done,
skipped}`, `workouts`/`runs.status ∈ {active, completed, cancelled}`, `estimateSessionMinutes`, le patron
`ai-assist` (Deno, secrets, `npx supabase functions deploy … --use-api`).

## 2. Décisions — validées par Florian le 08/10/2026

| # | Question | Proposition | Pourquoi | Alternative |
|---|---|---|---|---|
| **D1** | Comment servir les **cibles** (kcal, protéines) et le **verdict de forme** sans dupliquer les formules ? | **En deux temps.** NORYN-01 livre tout le contrat avec `energy_target_kcal`, `protein_target_g` et `readiness` à **`null`** — le contrat l'autorise (« `null` when Wellness cannot compute them », « `null` when it does not show one »). **NORYN-02** (au [BACKLOG](../../../../BACKLOG.md), P2) extrait d'abord la **composition** de `useDayCalorieTarget`, `useDayNutritionTargets`, `useDayEnergy` et `useReadiness` en fonctions pures de `packages/shared`, sans changement de calcul, les hooks n'y gardant que leurs lectures ; la fonction les appelle ensuite. | Les formules sont déjà partagées ; ce qui ne l'est pas, c'est **leur assemblage** (quelles entrées, quel repli, quelle base), qui vit dans quatre hooks. Le réécrire côté serveur serait exactement la duplication interdite. L'extraire touche les hooks les plus centraux de l'app (`useDayCalorieTarget` est appelé par sept écrans et hooks, dont `useNutritionSummary` qui nourrit l'accueil et le score de forme) et bute sur l'écart E4 à trancher d'abord. | **B** : tout dans NORYN-01 — US deux fois plus grosse, et une recette de non-régression de tout le pilier Nutrition et de la carte de forme. |
| **D2** | Comment la fonction utilise-t-elle `packages/shared` ? | Un **bundle esbuild** d'un point d'entrée `packages/shared/src/noryn/index.ts` (ses dépendances de `shared` et `zod` comprises) vers `supabase/functions/noryn-context/core.bundle.js`, **construit au déploiement** par une commande unique `npm run noryn:deploy` (build puis `npx supabase functions deploy noryn-context --use-api`). Le fichier généré est **ignoré par git**. Un test Vitest construit le bundle en mémoire et l'exécute sous Node : le build ne peut pas casser en silence. | Constat §7 : l'import direct échoue. Le bundle part **de la même source** que l'app : aucune formule recopiée. Construit au déploiement, il ne peut pas être périmé ; un clone neuf sans build échoue au déploiement (fichier absent), il ne déploie rien de faux. | **B** : bundle versionné + test de fraîcheur en CI — sûr aussi, mais chaque modification d'un fichier de `shared` du graphe (bientôt la moitié du paquet avec NORYN-02) rougit la CI tant qu'on n'a pas régénéré. **C** : `deno.json` pointant sur `packages/shared/src/` + « sloppy imports » — non vérifiable sans un déploiement d'essai. |
| **D3** | Comment calculer `synced_at` ? | Un **reçu de synchro** posé par la base : table `sync_receipts (user_id, received_at)` et un déclencheur `AFTER INSERT OR UPDATE OR DELETE` sur les tables qui alimentent les synthèses. Il n'écrit **que** si `auth.uid()` est **le propriétaire de la ligne** — donc une écriture du téléphone remontée par PowerSync avec le JWT de Florian — et prend `now()` du **serveur**. La fonction lit ce reçu et le **borne à `generated_at`**. Détail §6. | Seule voie qui tient les trois règles du contrat : jamais `now()`, jamais une écriture du serveur (`service_role`, éditeur SQL, `ai-assist` : `auth.uid()` nul ou autre), jamais l'horloge du téléphone (E1). | Sans migration : `max(updated_at)`, qui **viole** le contrat (E1) — à remonter à Noryn si D3 est refusée. |
| **D4** | Que veut dire `intensity_on_hold` ? | **`true` si le check-in du jour porte « malade » et que le pilier Bien-être est allumé** — exactement la règle 1 de BIEN-04 (« malade met l'intensité en veille »). Les périodes « vie réelle » **ne comptent pas**. Les **douleurs** non plus. | VIE-01 abaisse ce qui est demandé (séances de la semaine, déficit) sans rien dire de l'intensité, et ne sait pas si la période est une maladie ou des vacances : une semaine de vacances sportives deviendrait « pas d'effort intense ». La douleur, elle, décide **séance par séance et zone par zone** (`session-adaptation.ts` : arrêt si bloquante, report d'une séance intense qui sollicite la zone, journal des douleurs allumé) : un genou douloureux reporte la sortie longue, pas la séance de haut du corps. En faire un « jour en veille » bloquerait trop. | Ajouter les périodes « vie réelle » (proposition du brief) ; ajouter la douleur bloquante du jour. |
| **D5** | Quand un domaine est-il « non suivi » (`null`) ? | **Pas** : suivis si `user_settings.health_connect_enabled`. **Nutrition** et **eau** : suivies si le pilier Nutrition est actif (`resolveActivePillars`). **Récupération** et **sommeil de la semaine** : **toujours suivis** (le check-in est au socle). **Séances** : toujours (le planning unifié montre tous les piliers). | Chaque domaine suit la règle d'affichage de l'app : un pilier éteint est masqué (décision H), le check-in ne l'est jamais. Pilier Bien-être éteint, la qualité de nuit et l'envie arrivent simplement à `null` (« non répondu »). | `recovery` à `null` pilier Bien-être éteint (brief). |
| **D6** | Intensité d'une séance de **muscu** ? | **`null`** en v1. | L'app ne type pas l'intensité d'une séance de muscu. BIEN-04 la **suppose** intense par prudence (« rien ne la type facile ») : une hypothèse de conseil, pas une information. | `high` pour toutes, comme BIEN-04. |
| **D7** | Étiquette `upper_body` ? | **Non émise** en v1. | Aucune définition dans l'app (E12) ; en inventer une, c'est une règle métier nouvelle sans usage dans Wellness. Le contrat la permet sans l'imposer, et l'ajouter plus tard ne le change pas. | Une règle neuve, par exemple « aucune série jambes et au moins une série chiffrée ». |
| **D8** | Que répondre hors fenêtre ? | **400** `{"error":"out_of_window"}` hors de **J−8…J+15** (heure de Paris) : la fenêtre du contrat, J−7…J+14, **plus un jour de marge de chaque côté** ; même règle pour une semaine qui ne recoupe pas cet intervalle. | Le contrat autorise le refus hors fenêtre ; c'est la minimisation. La marge vient de la relecture : Noryn calcule sa fenêtre sur **son** horloge avant l'appel (`servedWindow`) ; une demande pour J−7 partie à 23 h 59 min 59 s et reçue après minuit à Paris deviendrait J−8 ici, et le contrat dit « must answer ». | Fenêtre stricte ; ou répondre à toute date. |
| **D9** | Le reçu de synchro (D3) vaut-il pour **tous** les comptes ? | **Oui** : le déclencheur pose le reçu de **chaque** utilisateur qui écrit ses propres lignes. La fonction ne lit que celui de Florian. | Le limiter à Florian demanderait de stocker son UUID **dans la base** : par une migration, il serait versionné dans git (interdit) ; par un `insert` dans l'éditeur SQL, c'est le geste manuel que CLAUDE.md proscrit. Le reçu n'apprend rien de neuf : `updated_at` porte déjà, sur chaque ligne de chaque compte, l'heure de la dernière écriture. Il est lisible par la seule `service_role` et part avec le compte (`on delete cascade`). Coût : un point de sauvegarde et un `upsert` d'une ligne par écriture synchronisée. | Limiter à Florian via une petite table de configuration remplie à la main. |

**Décisions dérivées** (pas d'arbitrage attendu, mais à relire) :

| # | Proposition |
|---|---|
| DD1 | Le code testable vit dans `packages/shared/src/noryn/`, **non exporté** par `packages/shared/src/index.ts` : il n'entre pas dans le bundle de l'app (Metro suit les imports), mais il est couvert par Vitest et par les seuils de couverture du paquet (100 % instructions, fonctions, lignes). La fonction Deno n'est qu'une coquille (secrets, client Supabase, `Deno.serve`). |
| DD2 | Le gestionnaire HTTP est **pur** : il reçoit `{ method, url, headers }` et rend `{ status, headers, body }`. L'horloge, l'empreinte SHA-256 et la source de données sont **injectées**. Aucun `Request`/`Response` ni API Deno dans `shared`. |
| DD3 | Tout ce qui sort est validé par un **schéma zod strict** recopié du contrat (`contract.ts`) avant d'être envoyé : une réponse hors contrat devient une erreur, jamais un 200. |
| DD4 | **Échec fermé** partout : secret absent ou mal formé, erreur de base, ligne d'un autre propriétaire, réponse invalide → jamais 200. |
| DD5 | Les instants sortent en `toISOString()` (millisecondes, `Z`). Le reçu Postgres (microsecondes, décalage `+00:00`) est **tronqué** à la milliseconde par le texte, **avant** d'être lu en date (ne pas dépendre de ce qu'un moteur accepte) : toujours vers le passé, le sens prudent. |
| DD6 | Une **valeur mesurée** hors des bornes du contrat est rendue `null`, jamais rognée (sauf `done`, plafonné à 50 : au-delà, ce sont des doublons). Les **objectifs**, qui ne peuvent pas être `null`, suivent la normalisation de l'app : `normalizeStepGoal` pour les pas, `DEFAULT_WATER_TARGET_ML` si l'objectif d'eau est absent ou hors 1–10 000. Les bornes en base sont aujourd'hui **égales** à celles du contrat : ces cas ne devraient jamais arriver. |
| DD7 | `esbuild` devient une `devDependency` **exacte** de `packages/shared` (`0.21.5`, déjà dans le lockfile) : même version, même bundle. |

## 3. Ce que fait la fonctionnalité

Une Edge Function Supabase **`noryn-context`**, appelée de serveur à serveur par Noryn :

- `GET …/functions/v1/noryn-context/context/day?date=AAAA-MM-JJ` ;
- `GET …/functions/v1/noryn-context/context/week?start=AAAA-MM-JJ` (un lundi).

Elle s'authentifie par **le seul jeton de Noryn** (`verify_jwt = false`), lit les données du **seul
propriétaire** désigné par un secret avec la clé `service_role`, compose la réponse avec les briques
pures de `packages/shared`, la valide contre le contrat, et répond. Elle **n'écrit rien**.

Une **migration** ajoute le reçu de synchro (D3). **Aucune** sync rule PowerSync, **aucune** colonne
synchronisée, **aucun** écran, **aucune** chaîne affichée : l'app elle-même ne change pas, à deux
refactors sans effet visible près (plan étape 2).

## 4. Correspondance, champ par champ

### 4.1 `context/day`

| Champ | Source | Règle |
|---|---|---|
| `date` | la requête | recopiée |
| `generated_at` | horloge du serveur | `toISOString()` |
| `synced_at` | `sync_receipts.received_at` du propriétaire | `min(reçu, generated_at)`, `null` sans reçu (§6) |
| `steps` | — | `null` si `health_connect_enabled` est faux ou absent (D5) |
| `steps.count` | `daily_steps.steps`, `log_date = date`, `deleted_at` nul | `null` sans ligne ; plus grand total si plusieurs lignes (règle 7 de PAS-01) |
| `steps.daily_target` | `normalizeStepGoal(profiles.daily_step_goal)` | comme l'app (`daily-steps-repository.ts`) : défaut 8 000, borné 1 000–50 000 |
| `nutrition` | — | `null` si le pilier Nutrition est inactif (D5) |
| `nutrition.energy_kcal`, `protein_g` | Σ `food_entries.kcal`, Σ `protein_g` du jour, `deleted_at` nul | arrondis à l'entier ; **les deux** `null` sans entrée, ou si l'un sort des bornes |
| `nutrition.energy_target_kcal`, `protein_target_g` | — | **`null`** (D1) |
| `hydration` | — | `null` si le pilier Nutrition est inactif (D5) |
| `hydration.volume_ml` | Σ `water_entries.volume_ml` du jour | `null` sans entrée |
| `hydration.target_ml` | `nutrition_profiles.water_target_ml ?? DEFAULT_WATER_TARGET_ML` | comme `HydrationCard` ; repli sur le défaut hors 1–10 000 (DD6) |
| `recovery` | `daily_wellbeing` du jour | toujours un objet (D5) ; `sleep_minutes`, `sleep_quality`, `energy`, `motivation`, chacun `null` si absent. **Rien d'autre de la ligne n'est lu** |
| `readiness` | — | **`null`** (D1) |
| `intensity_on_hold` | `daily_wellbeing.sick` du jour **et** `user_settings.wellbeing_pillar_enabled` | booléen seul (D4) |
| `training` | séances planifiées du jour | §4.2, 6 au plus |

### 4.2 Une séance

Source : `planned_sessions` du propriétaire (`owner_id`), `deleted_at` nul, jointes à `sessions` et
`programs` **non supprimées** — la même jointure que la vue semaine de l'app (`SELECT_PLANNED_BETWEEN`) :
une séance planifiée dont la séance ou le programme a disparu n'est pas montrée.

| Champ | Règle |
|---|---|
| `id` | `planned_sessions.id` en minuscules ; **écartée** si ce n'est pas un UUID canonique (jamais corrigée) |
| `date` | `scheduled_date` |
| `start_time` | `scheduled_time` ramené à `HH:MM` ; `null` s'il est vide ou mal formé |
| `kind` | `programs.pillar` (`strength` / `running`) ; une autre valeur écarte la séance |
| `status` | `planned` / `done` / `skipped` ; une autre valeur écarte la séance |
| `intensity` | course : `recuperation`, `endurance` → `low` ; `sortie_longue` → `moderate` ; `isIntenseSessionType` (`fractionne`, `test`, `course`) → `high` ; inconnu, vide ou `course_libre` → `null`. Muscu : `null` (D6) |
| `estimated_minutes` | muscu : `estimateSessionMinutes` sur les `exercise_plans` de la séance **non supprimés**, dont l'exercice est **non supprimé**, dans l'ordre de `order_index` — exactement les lignes de la carte du jour du hub (`strength-hub-repository.ts`). Course : `estimateRunMinutes({ targetDurationSeconds, totalDistanceM, refPaceSPerKm })` avec le volume des blocs (`session_intervals` non supprimés) ou la distance cible, et `running_profiles.ref_5k_pace_s_per_km`. `null` hors 1–600 |
| `tags` | course : `endurance`, `recuperation` → `easy_run` ; `sortie_longue` → `long_run` ; `fractionne` → `intervals` ; `test`, `course` → `race_effort`. Muscu : `heavy_lower` si `isHeavyLegSession` sur la somme des `target_sets` par `exercises.muscle_primary`, avec les filtres **de COLLIS-01** (`SELECT_PLANNED_MUSCLE_SETS`) : plans non supprimés, exercices **archivés compris**, muscle principal renseigné. `upper_body` jamais (D7) |

> Les deux requêtes de l'app ne filtrent pas les exercices de la même façon (E11). Le serveur
> reproduit **chacune** telle quelle, plutôt que d'en choisir une : la durée doit égaler celle du hub,
> l'étiquette doit égaler le détecteur de collisions. Un test fige chaque règle.

Ordre : heure (sans heure en dernier), puis `sessions.order_index`, puis `id`. Au-delà de 6 séances le
même jour, les suivantes ne sont pas envoyées (le contrat n'a aucun moyen de le signaler).

Le contenu lié (`programs`, `sessions`, `exercise_plans`, `session_intervals`, `exercises`) est lu par
identifiants, avec le filtre `owner_id` **nul (bibliothèque) ou égal au propriétaire** dans la requête
même — puis réduit à ce que **le téléphone a en local**, puisque c'est là que les requêtes de l'app
joignent (règles de synchro PowerSync) : de la bibliothèque, les programmes et exercices **publiés**
seulement, exercices **archivés compris** (ADMIN-01) ; de ses propres lignes, les non supprimées.
*(Précision trouvée en codant, le 08/10/2026.)* Une séance planifiée qui pointe vers du contenu d'un autre compte est donc **écartée** — c'est
possible : la RLS d'insertion de `planned_sessions` ne vérifie que `owner_id`, pas `session_id`.

### 4.3 `context/week`

| Champ | Règle |
|---|---|
| `start` | le lundi demandé |
| `steps` | même suivi que la journée ; `days` = les 7 dates dans l'ordre, `count` `null` sans ligne (jours à venir compris) |
| `sleep` | toujours un objet (D5) ; `nights` = nombre de jours dont `sleep_minutes` est renseigné ; `average_minutes` = leur moyenne arrondie, `null` si `nights` vaut 0 |
| `training.sessions` | les séances de la semaine, §4.2, 6 par jour au plus |
| `training.done.strength` | `workouts` du propriétaire, `status = 'completed'`, `deleted_at` nul, dont le **jour à Paris** de `finished_at` est dans la semaine — planifiées ou libres |
| `training.done.running` | idem sur `runs` (toutes sources). Les « autres activités » ne comptent pas |

### 4.4 Jamais synchronisé

`synced_at` nul ⇒ pas, consommation, eau, check-in, `readiness` à `null` ; `intensity_on_hold` faux ;
aucune séance ; `done` à 0 ; `nights` à 0. Les objectifs (`daily_target`, `target_ml`) restent donnés,
et un domaine non suivi reste `null`.

## 5. Règles métier

**Accès**

- **R1 — Ordre des contrôles**, chacun avant le suivant :
  1. `Authorization` absent ou mal formé → **401** `{"error":"unauthorized"}` + `WWW-Authenticate:
     Bearer` — avant toute autre vérification, comme le demande le brief §4.2 ;
  2. empreinte du jeton (`NORYN_TOKEN_SHA256`) absente ou mal formée → **503** (jamais 200) ;
  3. jeton faux → **401** (même corps, même en-tête) ;
  4. propriétaire (`NORYN_OWNER_USER_ID`) absent ou pas un UUID → **503** ;
  5. méthode autre que `GET` → **405** + `Allow: GET` ;
  6. chemin autre que `…/noryn-context/context/day` ou `…/context/week` → **404** ;
  7. paramètres : exactement un, `date` (jour) ou `start` (semaine), présent une fois, une vraie date
     `AAAA-MM-JJ`, un lundi pour `start` → sinon **400** `{"error":"bad_request"}` ;
  8. hors fenêtre → **400** `{"error":"out_of_window"}` (D8) ;
  9. erreur de lecture en base, ligne **du propriétaire** qui ne serait pas à lui (filtre ignoré) →
     **503** `{"error":"unavailable"}` ;
  10. réponse hors contrat ou de plus de 64 Kio → **500** `{"error":"unavailable"}`.
- **R2 — Le jeton** : `Bearer <jeton>`, schéma insensible à la casse, jeton de 16 à 4 096 caractères
  ASCII visibles (la borne de Noryn). On compare l'**empreinte SHA-256** (hexadécimal minuscule) du
  jeton présenté à l'empreinte stockée — ramenée en minuscules, qu'elle ait été posée en majuscules ou
  non — **à temps constant** (deux chaînes de 64 caractères, sans sortie anticipée). Un JWT
  d'utilisateur, une clé `apikey`, un jeton vide : 401.
- **R3 — Sans JWT Supabase** : `verify_jwt = false` pour cette seule fonction
  (`[functions.noryn-context]` dans `supabase/config.toml`, lu par `functions deploy`). `ai-assist` ne
  change pas.
- **R4 — Réponses** : toujours `Content-Type: application/json`, `Cache-Control: no-store`, **aucun**
  en-tête CORS, aucune redirection, corps JSON même en erreur, sans détail.

**Isolation**

- **R5** — Le propriétaire vient **uniquement** du secret `NORYN_OWNER_USER_ID`. La requête ne porte
  rien d'autre que `date` ou `start` ; aucun en-tête n'est lu à part `Authorization`.
- **R6** — Toute lecture d'une table de l'utilisateur filtre `user_id` (ou `owner_id`) **égal au
  propriétaire** et `deleted_at` nul (sauf les exercices de `heavy_lower`, §4.2). Le contenu lié est
  lu par identifiants, filtré dans la requête (bibliothèque ou propriétaire).
- **R7 — Double barrière**, avant de composer :
  - une ligne **d'une table de l'utilisateur** dont le propriétaire n'est pas Florian — le signe d'un
    filtre oublié — fait **échouer** la requête (503) : **rien** n'est envoyé ;
  - une ligne de **contenu lié** qui n'est ni de la bibliothèque ni à Florian est **écartée**, comme
    elle est absente du téléphone : une séance ou un programme étrangers écartent la séance planifiée
    qui les référence ; un plan, un exercice ou un bloc étranger est ignoré seul (§4.2).
- **R7 bis — Propriétaire inconnu** : un secret au format UUID mais sans profil ni réglages (UUID mal
  saisi) → **503** `unknown_owner`, jamais un « jamais synchronisé » indiscernable de l'état normal.

**Minimisation**

- **R8** — Chaque requête nomme ses colonnes ; **jamais** `select('*')`. Les colonnes lues sont une
  **liste blanche par table**, figée dans le code ; un test-garde compare chaque sélection, nom exact
  par nom exact, à cette liste. En v1, on ne lit ni `mood`, ni `stress`, ni les colonnes des modules
  (`alcohol_drinks`, `late_caffeine`, `nap_minutes`, `cravings`), ni les étiquettes autres que `sick`,
  ni les heures de coucher et de lever, ni aucun `name`, `notes`, `description`, `instructions`,
  `meal_type`, `food_id`, `micronutrients`, `weight_kg`, `gps_track`, `distance_m` réalisée, allure
  réalisée. Et chaque synthèse ne lit que ce qu'elle sert : la semaine ne lit ni repas, ni eau, et du
  check-in la seule durée de la nuit. NORYN-02 élargira la liste (le stress et le poids entrent dans le calcul du verdict et des
  cibles) : la règle qui ne bouge pas est **R9**.
- **R9** — La réponse ne contient que les champs du contrat (schéma strict, DD3) ; un champ en plus
  est une erreur, pas un 200.
- **R10 — Journaux** : la fonction n'écrit dans son journal ni corps, ni en-tête, ni date demandée,
  ni identifiant. En cas d'erreur, un code fixe (`noryn-context: db_error`…) et rien d'autre. ⚠️ La
  **plateforme** Supabase journalise de son côté l'URL de chaque appel, donc `?date=…` : une date, pas
  une donnée de santé, et hors de notre main.

**Fraîcheur, temps, bornes**

- **R11** — `generated_at` est l'horloge du serveur ; `synced_at` vient du reçu (§6), jamais de
  `now()`, borné à `generated_at`.
- **R12 — Fuseau** : « aujourd'hui », la fenêtre et le jour d'un instant (`finished_at`) se calculent
  à l'heure de **Paris** (`Intl`, changements d'heure compris). Les `log_date` et `scheduled_date` sont
  des dates civiles du téléphone, prises telles quelles (exact tant que le téléphone est à l'heure de
  Paris, brief §4.5).
- **R13 — Fenêtre** : une date entre J−8 et J+15 (J = aujourd'hui à Paris) — la fenêtre du contrat
  plus un jour de marge (D8) ; une semaine dont les 7 jours recoupent cet intervalle.
- **R14** — Un type de séance inconnu de cette version (E9) ne fait pas échouer la réponse : intensité
  `null`, aucune étiquette.

## 6. `synced_at` — le reçu de synchro

**Le constat (E1)** : sur ce projet, `updated_at` est l'heure du téléphone au moment de l'écriture
locale. À l'insertion, c'est elle qui arrive en base ; à la mise à jour, le déclencheur
`set_updated_at` la remplace par `now()` du serveur — mais pas partout. `max(updated_at)` mélange donc
les deux horloges, et un téléphone en avance ferait croire à Noryn que des données anciennes sont
fraîches : le cas que le contrat interdit.

**La proposition (D3)** — une migration `noryn01_sync_receipts` :

- table `public.sync_receipts (user_id uuid primary key references auth.users on delete cascade,
  received_at timestamptz not null)`, **RLS activée sans aucune politique** : invisible pour `anon` et
  `authenticated`. `grant select` **explicite** à `service_role` : depuis le changement de la plateforme
  (`config.toml`, définitif le 30/10/2026), une table neuve de `public` n'est plus exposée d'office aux
  rôles de l'API — sans ce droit, la fonction répondrait 503 en permanence ;
- deux fonctions de déclencheur (`security definer`, `search_path` vide, `lock_timeout` court) — l'une
  pour les tables à `user_id`, l'autre pour celles à `owner_id` — qui lisent **la seule colonne
  propriétaire** (`new` ou `old` selon l'opération), sans sérialiser la ligne (une trace GPS ou des
  micronutriments n'ont rien à faire là). Attachées `AFTER INSERT OR UPDATE OR DELETE … FOR EACH ROW`
  sur : `daily_steps`, `food_entries`, `water_entries`, `daily_wellbeing`, `planned_sessions`,
  `workouts`, `runs`, `profiles`, `nutrition_profiles`, `user_settings`, `running_profiles`,
  `programs`, `sessions`, `exercise_plans`, `session_intervals`, `exercises` — et, pour que NORYN-02
  n'ait pas à y revenir, `activities`, `body_weight_entries`, `real_life_periods` ;
- elles n'écrivent que si `auth.uid()` n'est pas nul **et** égal au propriétaire de la ligne : upsert
  `received_at = greatest(ancien, now())`. Pour **chaque** compte qui écrit ses lignes (D9) ;
- 🔴 **elles ne peuvent jamais faire échouer l'écriture qui les déclenche** : **tout** leur corps, la
  lecture de `auth.uid()` comprise, est dans un bloc `exception when others then` qui ne fait rien, et
  le `lock_timeout` change une attente de verrou en erreur rattrapée. Un déclencheur en erreur
  bloquerait **toute** la file d'envoi PowerSync du téléphone (la leçon des CHECK supprimés par
  RUN-F4) ;
- **pas de sync rule** (la table n'est pas synchronisée) et **pas d'ajout à la publication
  `powersync`**.

Ce que le reçu compte et ne compte pas :

| Écriture | `auth.uid()` | Comptée |
|---|---|---|
| Synchro PowerSync du téléphone de Florian | Florian = propriétaire | ✅ |
| `ai-assist` (consentement Prisme) | nul (`service_role`) | ❌ |
| Script joué dans l'éditeur SQL | nul | ❌ |
| Back-office : contenu de bibliothèque | Florian, mais `owner_id` nul | ❌ |
| Un autre utilisateur | autre | ❌ (pas son reçu, et RLS l'empêche d'écrire chez Florian) |

**Limites assumées** :

- une synchro sans rien à envoyer ne laisse aucune trace (le reçu vieillit : sens prudent) ;
- le reçu est **un seul** instant pour tous les domaines : un verre d'eau synchronisé le fait avancer
  alors que les pas datent du dernier import Health Connect (au premier plan, au plus une fois par
  heure). Le contrat n'a qu'un `synced_at` ; c'est son approximation, pas un défaut de la nôtre ;
- une file PowerSync bloquée par une opération en échec (roadmap 9.4) peut avoir envoyé une partie
  des lignes ;
- au déploiement, **aucun reçu n'existe** : Noryn voit « jamais synchronisé » jusqu'à la première
  écriture du téléphone (un verre d'eau suffit).

## 7. Partager `packages/shared` avec la fonction

Vérifié le 08/10/2026 dans le code de la CLI installée (`supabase` 2.109.1, binaire
`@supabase/cli-windows-x64`), sans aucun appel au projet :

- avec `--use-api`, la CLI parcourt les `import` depuis le point d'entrée et téléverse chaque fichier
  local atteint, **à condition qu'il soit sous la racine du dépôt git** (le dossier qui contient
  `.git`) : `packages/shared` est donc **téléversable** ;
- mais elle lit chaque chemin **littéralement** : `from './pillar'` vise un fichier `pillar`, qui
  n'existe pas (c'est `pillar.ts`). Elle passe avec un simple avertissement, le fichier n'est pas
  envoyé, et l'empaquetage côté serveur échouerait. Or **tous** les imports internes de
  `packages/shared` sont sans extension ;
- `zod` est un nom nu : il faudrait en plus une table d'imports (`deno.json`).

D'où **D2** : esbuild résout les imports à la manière du reste du monorepo et produit **un seul
fichier** ESM, importé par la fonction avec son extension (`./core.bundle.js`), que la CLI téléverse
normalement. Les formules restent écrites une fois, dans `packages/shared`.

## 8. Cas limites

| Cas | Comportement |
|---|---|
| Jamais synchronisé | §4.4 |
| Pilier Nutrition éteint | `nutrition` et `hydration` `null` |
| Health Connect éteint | `steps` `null` |
| Health Connect allumé, aucune ligne ce jour-là (permission refusée, rien lu) | `count` `null` — le serveur ne voit pas les permissions, seulement les lignes |
| Aucune ligne `user_settings` | piliers par défaut (`resolveActivePillars`), Health Connect et pilier Bien-être éteints |
| `active_pillars` corrompu | décodé comme l'app (`parseJsonColumn` + garde de tableau de piliers), repli sur tous les piliers |
| Jour sans check-in | `recovery` = quatre `null` ; `intensity_on_hold` faux |
| « Malade » coché, pilier Bien-être éteint | `intensity_on_hold` faux (D4) |
| Date future (J+1…J+14) | pas, repas, eau, check-in `null` ; les séances planifiées sortent |
| Séance sans heure | `start_time` `null`, rangée en dernier |
| 7 séances le même jour | les 6 premières |
| Séance de muscu sans série chiffrée | `estimated_minutes` `null`, pas de `heavy_lower` |
| Course sans durée, sans volume ou sans allure de référence | `estimated_minutes` `null` |
| Type de course inconnu, vide ou `course_libre` (E9) | intensité `null`, aucune étiquette |
| Séance planifiée dont le programme est supprimé | absente |
| Séance planifiée qui pointe vers le contenu d'un autre compte | écartée (§4.2) |
| Exercice archivé dans une séance de muscu | compte pour `heavy_lower`, pas pour la durée (§4.2) |
| Course finie le lundi 26/10/2026 à 00 h 30 à Paris (= dimanche 25/10, 23 h 30 UTC) | jour à Paris 26/10 : compte pour la semaine du **26/10**, pas pour celle du 19/10 |
| Course finie le lundi 30/03/2026 à 00 h 30 à Paris, heure d'été (= dimanche 29/03, 22 h 30 UTC) | compte pour la semaine du **30/03** |
| Course finie le 25/10/2026 à 00 h 30 à Paris, encore en heure d'été (= 24/10, 22 h 30 UTC) | jour à Paris 25/10 |
| Requête à 00 h 30 le 25/10 à Paris (22 h 30 UTC la veille) | « aujourd'hui » = 25/10 |
| Reçu plus récent que `generated_at` | borné |
| Plusieurs lignes `daily_steps` pour un jour | la plus grande |
| `scheduled_time` mal formé | `start_time` `null` |
| Base indisponible, délai dépassé | 503 ; Noryn abandonne de lui-même après 10 s |
| `POST`, `HEAD`, `OPTIONS` | 401 sans jeton, 405 avec |
| `?date=…&date=…`, `?date=…&x=1`, `?start=` un mercredi | 400 |

## 9. i18n

**Sans objet**, et c'est vérifié : aucune chaîne n'est affichée par l'app ni par la fonction. Les
réponses sont des identifiants de contrat (`strength`, `easy_run`…) et des codes d'erreur techniques
(`unauthorized`, `out_of_window`…), non traduits par nature ; Noryn compose ses propres libellés.

## 10. Comportement offline

L'app ne change pas. Téléphone hors ligne : rien n'arrive en base, le reçu ne bouge pas, Noryn affiche
« synchronisé il y a … » puis tient la réponse pour ancienne au-delà de 24 h. Au retour du réseau, la
file PowerSync se vide et chaque envoi met le reçu à jour. Le déclencheur ne peut jamais bloquer cette
file (§6).

## 11. Serveur, secrets, déploiement — gestes humains

- **Secrets** (posés par Florian, jamais dans git ni dans un journal) : `NORYN_TOKEN_SHA256`
  (empreinte SHA-256 du jeton, 64 hexadécimaux, ramenés en minuscules par la fonction),
  `NORYN_OWNER_USER_ID` (UUID du compte de Florian). `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis d'office aux Edge Functions.
- **Migration** : `npm run db:push`, puis `npm run db:types`, puis cocher le registre
  [supabase/MIGRATIONS.md](../../../../supabase/MIGRATIONS.md).
- **Déploiement** : `npm run noryn:deploy` — refuse un arbre non commité, construit le bundle, lance
  `npx supabase functions deploy noryn-context --use-api`, puis efface le bundle.
- Le jeton se génère hors de git (brief §7) et se pose côté Noryn en secret Fly à la livraison de
  TASK-014.
- ⚠️ **À confirmer en recette** : qu'avec `verify_jwt = false` la passerelle n'exige ni JWT ni `apikey`
  (c'est le fonctionnement documenté des webhooks, mais rien ne peut le prouver sans le projet).

## 12. Confidentialité et Play

Les données transmises viennent en partie de **Health Connect** (pas) et sont des données de santé.
Elles partent vers **le service de Florian, à sa demande, pour son seul compte** : la fonction ne lit
qu'un compte, fixé par secret, et aucune donnée d'un autre utilisateur ne sort.

**Ce qui change pour les autres utilisateurs** (D9) : le reçu de synchro est posé pour **chaque**
compte — l'heure de sa dernière écriture synchronisée, sur une ligne. C'est une donnée technique que
`updated_at` porte déjà sur chacune de ses lignes ; elle n'est lisible que par la `service_role`, part
avec le compte, et n'entre pas dans l'export local des données (`data-export.ts`, qui lit la base du
téléphone). **À vérifier par Florian** (brief §4.7, déjà noté pour LANCE-00) : faut-il mentionner la
transmission à son propre service, et ce reçu, dans la politique de confidentialité et la section
« Sécurité des données » ?

## 13. Écarts à remonter côté Noryn

Aucun point du contrat n'est impossible. Trois remarques pour le brief et le contrat :

1. **`synced_at`** : l'approximation suggérée (`max(updated_at)`) n'est **pas** utilisable dans
   Wellness (E1) ; tenir la règle demande une migration (D3). Le contrat n'a pas à changer, le brief si.
2. **Au déploiement**, Wellness répondra « jamais synchronisé » (aucune séance, aucune valeur) jusqu'à
   la première écriture du téléphone : à prévoir dans la vérification `source.status = fresh` du
   brief §7.
3. **Cibles et verdict** à `null` tant que NORYN-02 n'est pas livrée (D1-A) : `missing` côté Noryn,
   jamais `0`. Et le motif de la veille ne peut pas être « vacances » ou « voyage » : il n'y a que
   « malade » (D4).

Mineur : la troncature au-delà de 6 séances par jour est silencieuse (le contrat n'a pas de champ pour
la signaler) ; aucun cas réel attendu.

## 14. Hors périmètre

Cibles et verdict de forme (NORYN-02, si D1-A) ; l'écart E4 (protéines en mode `activities`) ;
`/training/upcoming` (abandonné par le contrat v1) ; toute écriture depuis Noryn ; webhooks ; réglage
ou écran dans l'app ; tout autre utilisateur que Florian ; limitation de débit (un mauvais jeton est
refusé avant toute lecture en base).

## 15. Critères de recette

Préparation (Florian) : secrets posés, migration poussée, fonction déployée, un **second compte de
test** avec des données aux mêmes dates (pas, repas, check-in, séances).

1. Sans `Authorization` → 401 `{"error":"unauthorized"}`, en-tête `WWW-Authenticate: Bearer`.
2. Mauvais jeton → 401. JWT d'utilisateur de l'app (le sien) → 401. Seulement `apikey` → 401.
3. Secret `NORYN_TOKEN_SHA256` retiré puis fonction rappelée : avec le jeton → 503 (jamais 200),
   sans jeton → 401 ; secret remis.
4. Bon jeton, `POST` → 405. Bon jeton, `?date=` d'hier → 200.
5. La passerelle laisse passer sans `apikey` (R3 / §11).
6. En-têtes : `application/json`, `Cache-Control: no-store`, aucun `Access-Control-*`.
7. `?date=` à J−8 et J+15 → 200 (marge, D8) ; à J−9 ou J+16 → 400 `out_of_window` ; `?start=` un
   mardi → 400.
8. Jour : les pas, kcal, protéines, eau et check-in du matin égalent ce qu'affiche l'app ce jour-là ;
   cibles et `readiness` à `null` (D1-A).
9. Les séances du jour et de la semaine sont celles du planning (heure, pilier, statut) ; une sortie
   longue porte `long_run` et `moderate` ; une séance de jambes chargée porte `heavy_lower`.
10. La durée estimée d'une séance de muscu égale celle de la carte du hub ; celle de la course du jour,
    celle du hub Course.
11. `done` de la semaine = séances de muscu et courses terminées de la semaine.
12. Cocher « malade » au check-in du matin (pilier Bien-être allumé) → `intensity_on_hold` vrai ;
    pilier éteint → faux.
13. Pilier Nutrition éteint → `nutrition` et `hydration` `null`. Health Connect éteint → `steps` `null`.
14. Ajouter un verre d'eau, synchroniser → `synced_at` avance, à l'heure du serveur, jamais après
    `generated_at`.
15. Mode avion, ajouter un repas, attendre, rappeler la fonction → `synced_at` ne bouge pas ; réseau
    revenu → il avance.
16. Mettre l'horloge du téléphone 2 h en avance, ajouter un verre, synchroniser → `synced_at` reste à
    l'heure du serveur.
17. **Isolation** : aucune valeur, aucun identifiant du second compte n'apparaît, quel que soit le jour.
18. Aucune trace de l'humeur, du stress, du poids, des repas, des notes ou du motif dans les réponses ;
    les lignes écrites **par la fonction** dans ses journaux ne contiennent ni jeton, ni date, ni corps
    (la plateforme journalise l'URL de son côté, R10).
19. *(voir aussi 21)* La synchro du téléphone n'est jamais bloquée par le reçu (écritures de toutes les tables
    concernées, dont une suppression).
20. Les réponses du jour et de la semaine passent les schémas de Noryn
    (`WellnessDayWireSchema`, `WellnessWeekWireSchema`) ; comparaison de forme avec le serveur de
    fixtures de Noryn (brief §6).
21. `NORYN_OWNER_USER_ID` posé avec un UUID qui n'est pas le tien → **503** (journal
    `noryn-context: unknown_owner`) ; remis à ton UUID → 200.

## 16. Ce que la relecture a changé (08/10/2026)

Relecture par un agent de revue, avec vérification dans le code et dans le dépôt Noryn (lecture seule).
Les faits du §1 (E1 à E16) sont confirmés, à une imprécision près (le nombre d'appelants de
`useDayCalorieTarget`, corrigé).

- 🔴 **Le reçu de synchro vaut pour tous les comptes**, ce que la spec taisait : décision **D9**
  ajoutée, §12 corrigé.
- 🔴 **Un exemple de changement d'heure était faux** (§8) : remplacé par des cas qui tombent un autre
  jour en UTC et à Paris, en bord de semaine — les seuls qui prouvent qu'on calcule à Paris.
- 🔴 **Le SQL du plan initialisait `auth.uid()` hors du bloc protégé** : une erreur à cet endroit aurait
  fait échouer une écriture PowerSync. Tout le corps est désormais protégé (§6, plan étape 1).
- 🟠 `grant select` à `service_role` ajouté (sinon 503 permanent après le 30/10/2026) ; deux fonctions
  de déclencheur qui lisent la seule colonne propriétaire, `lock_timeout`, table `exercises` ajoutée.
- 🟠 `heavy_lower` et la durée estimée reprennent **chacune** les filtres de sa requête d'origine
  (exercices archivés comptés pour l'une, pas pour l'autre).
- 🟠 D4 dit pourquoi la douleur n'entre pas dans `intensity_on_hold`.
- 🟠 R7 distingue la ligne de l'utilisateur étrangère (échec, 503) du contenu lié étranger (écarté).
- 🟠 D8 : un jour de marge à la fenêtre, pour ne pas refuser une demande légitime à minuit.
- 🟠 Les objectifs (pas, eau) suivent la normalisation de l'app (`normalizeStepGoal`) : ils ne peuvent
  pas être `null`.
- 🟡 R1 : un `Authorization` absent donne 401 avant tout, même secret manquant ; empreinte ramenée en
  minuscules ; R8 en liste blanche par table ; `course_libre` nommé ; limite du reçu unique ; journaux
  de la plateforme ; troncature explicite des microsecondes.
