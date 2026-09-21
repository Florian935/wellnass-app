# Plan — EFFORT-01 · Les meilleurs efforts d'une sortie

Spec : [effort01-meilleurs-efforts-sortie.md](../specs/functional/us/effort01-meilleurs-efforts-sortie.md) ·
Maquette : <https://claude.ai/artifact/Fp7sCrnKZ3YbVink6RBt5U> (planches 1, 3, 10) ·
Analyse : [analyse-strava-2026-09.md](../product/analyse-strava-2026-09.md) §7.2 et §7.4.

Travail **directement sur `dev`** (décision Florian, cf. FANT-01 / CARDIO-UX02).

## Ordre de build

1. **Le moteur pur** — `packages/shared`, en TDD, sans aucun I/O. C'est là que vit la difficulté.
2. **La migration** — table, colonne marqueur, contrainte élargie. Poussée le jour même.
   ⚠️ **Sync rules PowerSync à redéployer**.
3. **L'écriture** — repository, à la fin d'une course, dans la même transaction que le palmarès.
4. **Le rattrapage** — une passe idempotente sur l'historique.
5. **Les écrans** — la liste des efforts, puis les médailles sur la carte.

L'ordre est contraint : 5 a besoin de 3, qui a besoin de 2, qui a besoin de 1. Et **4 doit être
livré avec 3** — sans rattrapage, tous les rangs affichés sont faux (spec R19).

---

## Étape 1 — le moteur pur (TDD)

`packages/shared/src/pace-records.ts` — **on étend, on ne réécrit pas**. `computeRunRecords` et
`bestSegmentTimeFromSamples` sont utilisés par le palmarès, la célébration et la prédiction : leur
signature actuelle doit continuer de marcher.

**1.1 — `bestSegmentWindow(cum, t, meters)` → `{ seconds, startIdx, endIdx, startFrac } | null`**
Même balayage que `bestSegmentTimeFromSamples`, mais on **retient les bornes** de la fenêtre gagnante
au lieu de les jeter (spec C2). `bestSegmentTimeFromSamples` devient un mince appel dessus qui ne
rend que `seconds` — **zéro changement de comportement**, et les tests existants doivent passer
**sans être touchés** : c'est le test de non-régression de cette étape.

*Tests* : fenêtre au début / au milieu / à la fin de la trace · trace exactement de la distance
cible · trace plus courte → `null` · égalité de temps entre deux fenêtres → la **première** gagne ·
les cas `NaN` déjà couverts le 04/08/2026 restent verts.

**1.2 — Les trois distances neuves**
`RecordDistanceKey` gagne `'400m' | 'halfmile' | 'mile'`, `RUNNING_RECORD_DISTANCES` ses trois
entrées, **dans l'ordre croissant** (spec R1).
🔴 *Garde* : un test vérifie que `PREDICTION_SOURCE` vaut toujours `'5k'` et que
`resolveRacePredictions` rend exactement les mêmes cibles qu'avant (spec R4). Élargir un type union
est précisément le genre de changement qui déplace une valeur par défaut sans qu'on le voie.

**1.3 — `computeRunEfforts(points)` → `RunEffort[]`**
Pour chaque distance atteignable : `bestSegmentWindow`, puis le **point milieu** interpolé entre
`startIdx` et `endIdx` (spec R10), et le filtre de bruit — allure < 2:00 /km ⇒ **rien écrit**
(spec R17).

*Tests* : sortie de 2 km → 4 efforts (400 m, demi-mile, 1 km, mile) · sortie de 300 m → `[]` ·
sortie sans point → `[]` · le point milieu tombe **sur** la trace · un segment aberrant à 1:10 /km
est écarté.

**1.4 — `rankEfforts(efforts, distanceKey)` → rang et écart**
Module **pur** : reçoit la liste, rend `{ rank, gapSeconds }`. Tri par temps croissant, **égalité →
le plus ancien devant** (spec R6). Le rang n'est jamais persisté (spec R7).

*Tests* : rang 1 avec écart 0 · égalité stricte → l'ancien reste 1ᵉʳ · liste d'un seul élément ·
insertion d'un meilleur temps → l'ancien 1ᵉʳ devient 2ᵉ.

**1.5 — `pickMapMedals(rankedEfforts)` → au plus 2**
Rang ≤ 3 seulement (R12), rang croissant puis distance décroissante (R11). La règle de proximité
(R13) est **écran**, pas moteur : elle dépend du zoom — elle vit à l'étape 5.

*Tests* : aucun effort dans le top 3 → `[]` · cinq candidats → 2 · égalité de rang → la plus longue
distance passe devant.

---

## Étape 2 — migration

`npm run db:new effort01_run_efforts` puis :
- `create table public.run_efforts` (spec §4), index unique `(run_id, distance_key) where deleted_at is null`,
  index de lecture `(user_id, distance_key, time_seconds) where deleted_at is null` — c'est la requête du rang ;
- `alter table public.runs add column efforts_computed_at timestamptz` ;
- ~~contrainte `distance_key` de `running_pace_records` élargie~~ — **retiré le 20/09/2026**
  (spec **R9 bis / D8**) : le palmarès garde ses cinq distances, le journal en couvre huit. Aucune
  table existante n'est donc modifiée, hors la colonne marqueur ci-dessus ;
- RLS : les trois politiques habituelles `user_id = auth.uid()` ;
- `alter publication powersync add table public.run_efforts`.

Puis `npm run db:push:dry`, `npm run db:push`, `npm run db:types`, et **cocher**
[supabase/MIGRATIONS.md](../../supabase/MIGRATIONS.md).

🔴 **Deux étapes manuelles qui ne doivent pas tenir à la mémoire de quelqu'un :**
1. **Coller [powersync-sync-rules.yaml](../specs/technical/powersync-sync-rules.yaml) dans le
   dashboard PowerSync et redéployer** — `run_efforts` est synchronisée. Déjà oublié une fois.
2. Ajouter la table au **schéma PowerSync local** (`apps/mobile/src/powersync/schema.ts`) : un bloc
   `new Table({…})` **et** son enregistrement dans le `new Schema({…})` final — oublier le second
   est l'erreur classique. Plus `efforts_computed_at: column.text` sur la table `runs` existante.
   C'est la panne silencieuse de CYCLE-01 (31/07) et de `daily_step_goal` (03/08) : la colonne
   existe en base, reste invisible côté client, et l'écriture est avalée sans un message.

> **Ce qui rattrape l'oubli** : [`sql-prepare-sweep.test.ts`](../../apps/mobile/src/data/repositories/__tests__/sql-prepare-sweep.test.ts).
> Il lit le source de **chaque** repository, en extrait toute chaîne littérale commençant par un
> verbe SQL, et demande à SQLite de la **préparer** contre le schéma PowerSync local — préparer
> suffit, c'est là que tables, colonnes et alias sont résolus. Une table fantôme ne passe pas. Né de
> la recette MUSCU-UX01 (11/09), où deux des sept défauts étaient cette même panne (`e.name` sur
> `exercises`, `w2.owner_id` sur `workouts`).
>
> ⚠️ **Sa limite, et elle nous concerne** : les requêtes **interpolées** (`${...}`) sont hors de
> portée — leur texte final n'existe qu'à l'exécution. Le SQL du rattrapage (étape 4) risque d'être
> construit ainsi : dans ce cas il faut **en plus** un test de repository sur
> [`sqlite-harness`](../../apps/mobile/src/test-utils/sqlite-harness.ts), qui exécute le SQL pour de
> bon. Écrire les requêtes en **littéral** partout où c'est possible les fait couvrir gratuitement.

---

## Étape 3 — l'écriture

`apps/mobile/src/data/repositories/running-record-repository.ts` — `evaluateRunRecords` calcule déjà
`computeRunRecords(points)` à la fin d'une course. On **ajoute** l'écriture du journal **dans la même
transaction, depuis le même décodage de trace** (spec R9, D3) : un seul `decodeTrack`, deux écritures.

- `insertWithSyncFields('run_efforts', …)` par effort ;
- `runs.efforts_computed_at = now()` ;
- suppression d'une course → soft delete des efforts, au même endroit que le palmarès
  (`run-repository.ts` l. 1237-1264).

*Tests* : une course écrit palmarès **et** journal · une course sans trace n'écrit **rien** ·
rejouer l'évaluation sur la même course n'crée pas de doublon (index unique) · la suppression
emporte les efforts.

---

## Étape 4 — le rattrapage (spec R19, R20)

`apps/mobile/src/data/repositories/effort-backfill.ts`, appelé une fois au démarrage, **après** la
première synchro, en tâche de fond.

- sélectionne les courses `status='completed' and gps_track is not null and efforts_computed_at is null` ;
- les traite **par lots de 20**, avec une pause entre les lots : décoder deux ans de traces d'un coup
  gèlerait l'interface (c'est le coût caché identifié dans l'analyse, §C2) ;
- **idempotent** par `efforts_computed_at` ;
- aucune UI bloquante : si le rattrapage n'est pas fini, les rangs affichés portent la mention
  « calcul en cours ».

*Tests* : 45 courses → 3 lots · une course déjà traitée est **sautée** · une course sans trace est
marquée traitée sans écrire de ligne · interruption au milieu → reprise là où ça s'est arrêté.

---

## Étape 5 — les écrans

**5.1 — La carte** (`components/running/RouteMap.tsx`)
Marqueurs départ / arrivée / flèche de sens (spec R14) — utiles **même sans médaille**, donc livrés
d'abord et testables seuls. Puis les pastilles de médaille, avec la règle de proximité 44 px (R13),
calculée sur les coordonnées **écran** après projection, pas sur les coordonnées géographiques.

**5.2 — La liste des efforts** (`app/run/analysis.tsx`, nouveau bloc)
Reprend la planche 3 : le bandeau « aucun record aujourd'hui, et pourtant… », les deux compteurs,
puis la liste. Se **tait** s'il n'y a aucun effort (R15, R16) — une ligne honnête, pas un bloc vide.

⚠️ **Budget d'écran** : `analysis.tsx` porte déjà la carte, les splits, le réalisé par fraction et
les trois lectures d'ALLURE-01. Le bloc des efforts **remplace** la célébration isolée plutôt que de
s'ajouter à elle ([ADR-007](../adr/ADR-007-surfacage-analyses.md), INSIGHTS-02).

**5.3 — Le détail d'un effort** : feuille au tap d'une médaille (planche 10 du prototype).

*Tests* : rendu sans effort · rendu avec record · rendu avec rang 2 · deux médailles proches → une
seule · course manuelle → message d'absence.

---

## i18n

Clés `run.efforts.*` en FR **et** EN (spec §6).
🔴 **Le piège** : l'ordinal anglais change de suffixe (1st / 2nd / 3rd / 4th / 11th / 21st). Utiliser
`Intl.PluralRules` en `type: 'ordinal'` avec une clé par catégorie — **jamais** `n + 'th'`.
*Test* : 1, 2, 3, 4, 11, 12, 13, 21, 22 rendus correctement dans les deux langues.

---

## Vérification avant de déclarer fini

`npm run typecheck` · `npm run lint` · `npm run test` — **code de sortie lu sans pipe** (un `| tail`
renvoie 0 même sur un échec, cf. CLAUDE.md). Puis `node scripts/etat.mjs`.

## Ce que le plan ne fait pas

- Le **rejeu animé** du parcours (planche 2) — US séparée.
- Le **parcours / segment personnel** (planche 6) — c'est **S1**, le gros morceau de l'analyse.
- La **variante de partage transparente** — **PARTAGE-02**, US séparée, sans dépendance à celle-ci.
- La **fusion** palmarès / journal — dette notée dans la spec (D3), hors périmètre.
- La **cadence** et les **pas** — capteur de montre, donc Health Connect et une permission de plus
  dans la déclaration Play, qui ne se dépose qu'une fois.
