# Plan — RUN-F2c · Blocs fractionné / intervalles (roadmap 5.9)

Spec : [runf2c-blocs-fractionne.md](../specs/functional/us/runf2c-blocs-fractionne.md) ·
branche `feature/runf2c-blocs-fractionne` · roadmap **5.9**.

⚠️ **La plus grosse des 4 US de la famille RUN-F2** — nouvelle table, 2 éditeurs (mobile + admin),
affichage lecture seule à 2 endroits. Découpage en 8 étapes pour rester incrémental.

## Étape 0 — Migration + schéma + sync rules *(≈ 40 min)*

```sql
create table public.session_intervals (
  id                      uuid primary key,
  session_id              uuid not null references public.sessions (id) on delete cascade,
  owner_id                uuid references auth.users (id) on delete cascade,
  order_index             integer not null default 0,
  reps                    integer not null default 1,
  fast_distance_m         integer,
  fast_duration_seconds   integer,
  fast_pace_pct_vma       integer,
  recovery_distance_m     integer,
  recovery_duration_seconds integer,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz
);
create index on public.session_intervals (session_id);
```
Mêmes conventions que `exercise_plans` (pas de CHECK applicatif dupliqué en SQL — cohérent avec
`hasRunningSessionTarget`, spec §1). RLS : dupliquer exactement les policies d'`exercise_plans`
(owner-scopé + éditorial `owner_id is null`).

`apps/mobile/src/powersync/schema.ts` : nouvelle `const session_intervals = new Table({...})`,
même liste de colonnes, ajoutée au registre des tables (comme `exercise_plans`).

⚠️ **`docs/specs/technical/powersync-sync-rules.yaml` — étape manuelle non déployée
automatiquement (leçon déjà notée dans CLAUDE.md).** Contrairement à RUN-F1b/RUN-F2a/RUN-F2b (qui
ajoutaient des colonnes à des tables déjà publiées), `session_intervals` est une **table neuve** :
elle a besoin de ses **deux** propres lignes de règle, copiées du patron `exercise_plans` (une pour
`owner_id = bucket.user_id`, une pour `owner_id is null`, éditorial) :
```yaml
- select * from session_intervals where owner_id = bucket.user_id and deleted_at is null
- select * from session_intervals where owner_id is null and deleted_at is null
```
**Coller ce fichier dans le dashboard PowerSync et déployer avant toute recette** — sans ça, les
lignes existeraient en base mais ne synchroniseraient jamais vers l'app.

## Étape 1 — Fonction pure + Zod, testées d'abord *(≈ 30 min)*

`packages/shared/src/running-paces.ts` :
```ts
/**
 * Allure à un pourcentage de VMA (US RUN-F2c). Un pourcentage plus bas donne une allure plus
 * LENTE (chiffre s/km plus grand) — courir à 95 % de sa vitesse maximale, pas 95 % de son allure.
 */
export function paceAtVmaPercent(vmaPaceSPerKm: number, pct: number): number {
  return vmaPaceSPerKm / (pct / 100);
}
```
**Tests, écrits d'abord** (`running-paces.test.ts`) :
- `paceAtVmaPercent(285, 95)` ≈ 300 (reproduit une valeur déjà connue de `sessionTargetPace`,
  vérifié en relecture de spec — `derivedVmaPace(300) = 285`, et `285/0.95 = 300`).
- `paceAtVmaPercent(240, 80)` = 300 (80 % plus lent que 95 %, sens vérifié).
- `pct = 100` → renvoie `vmaPaceSPerKm` inchangé.

`packages/shared/src/program.ts` : nouveau `sessionIntervalRowSchema` (miroir de
`exercisePlanRowSchema`) :
```ts
export const sessionIntervalRowSchema = contentOwnerSyncFieldsSchema.extend({
  sessionId: uuidSchema,
  orderIndex: z.number().int().min(0),
  reps: z.number().int().min(1),
  fastDistanceM: z.number().int().positive().nullable(),
  fastDurationSeconds: z.number().int().positive().nullable(),
  fastPacePctVma: z.number().int().positive().nullable(),
  recoveryDistanceM: z.number().int().positive().nullable(),
  recoveryDurationSeconds: z.number().int().positive().nullable(),
});
export type SessionIntervalRow = z.infer<typeof sessionIntervalRowSchema>;
```
(Schéma de référence/documentation, même statut que `exercisePlanRowSchema` — pas un `.parse()`
actif en frontière repository, cohérent avec le patron existant.)

## Étape 2 — Repository mobile : lecture + CRUD *(≈ 1 h)*

`apps/mobile/src/data/repositories/program-repository.ts` :
- `IntervalBlockItem` (type de domaine, camelCase, miroir de `PlanItem`).
- `SessionDetail.intervals: IntervalBlockItem[]` (nouveau champ, à côté de `plans`).
- `SELECT_INTERVALS_FOR_PROGRAM` (miroir de `SELECT_PLANS_FOR_PROGRAM`, sans jointure exercice
  — pas de nom à résoudre).
- `rowToIntervalItem` + extension de `buildSessionDetails` (même boucle de regroupement par
  `session_id` que pour `plans`).
- `addIntervalBlock(sessionId, input)` / `updateIntervalBlock(blockId, input)` /
  `removeIntervalBlock(blockId)` — miroir exact d'`addExercisePlan`/`updateExercisePlan`/
  `removeExercisePlan`, `order_index` via `nextOrderIndex('session_intervals', 'session_id', ...)`.
- `removeSession` : ajouter la cascade `session_intervals` (même boucle `SELECT id ... WHERE
  session_id = ? AND deleted_at IS NULL` → `softDelete` que pour `exercise_plans`, ligne ~658).
- `duplicateProgram` : ajouter une **5ᵉ étape** copiant `session_intervals` par `sessionIdMap`,
  même patron que la copie des `exercise_plans` (lignes ~772-803) — **sans cette étape, dupliquer
  un programme avec des séances fractionné perdrait silencieusement leurs blocs**, trouvé en
  lisant le code réel de duplication, pas dans la spec initiale.

## Étape 3 — Éditeur mobile *(≈ 1 h)*

`apps/mobile/src/components/running/IntervalBlockEditor.tsx` (nouveau, miroir de
`ExercisePlanEditor.tsx`) : état local (reps, distance/durée rapide via toggle comme
`RunningSessionEditor`, %VMA, distance/durée récup via toggle + case « sans récup »), commit au
blur via `updateIntervalBlock`, suppression via `removeIntervalBlock`.

`RunningSessionEditor.tsx` : quand `sessionType === 'fractionne'`, monte
`session.intervals.map((block) => <IntervalBlockEditor key={block.id} block={block} />)` sous les
champs existants, + bouton « Ajouter un bloc » (`addIntervalBlock(session.id, { reps: 1 })`, valeurs
par défaut minimales, l'utilisateur complète ensuite). Pas de réordonnancement (spec R6).

## Étape 4 — Repository admin *(≈ 45 min)*

`apps/admin/src/data/programs.ts` : `AdminSessionInterval` (type), `IntervalBlockInput`,
`addIntervalBlock`/`updateIntervalBlock`/`removeIntervalBlock`/`reorderIntervalBlocks` — miroirs
exacts des fonctions `exercise_plans` (lignes 855-936), écriture Supabase directe scopée
`owner_id IS NULL` (édition éditoriale).

## Étape 5 — Éditeur admin (UI) *(≈ 1 h)*

`apps/admin/src/screens/ProgramEditScreen.tsx`, branche `isRunning` de `SessionCard` : ajouter,
**quand `sessionType === 'fractionne'`**, un bouton d'ajout + `SortableList` des blocs (même
patron que la liste d'exercices muscu, `getId`/`onReorder`/`renderItem`), avec `IntervalBlockRow`
(nouveau composant présentation, champs inline) portant `onUpdate`/`onRemove`. Point de vigilance
relevé en relecture : cette branche est aujourd'hui un simple bloc de champs sans liste
(`if/else` avec la branche muscu) — c'est une intégration nouvelle, pas un ajout à côté d'un
mécanisme déjà présent dans cette branche précise.

## Étape 6 — Affichage lecture seule *(≈ 45 min)*

- `apps/mobile/src/app/running-programs/[id].tsx` (`RunningSessionCard`) : sous les chips
  type/cible/allure existants, si `session.intervals.length > 0`, liste des résumés de bloc
  (i18n `running.intervals.blockSummary`, gabarit selon présence %VMA/récup).
- `apps/mobile/src/app/planning/plan.tsx` (`PlanSessionCard`) : même ajout.
- Aucun changement si `intervals` est vide (comportement actuel inchangé).

## Étape 7 — i18n *(≈ 30 min)*

`running.intervals.*` (spec §6) — trancher les gabarits `blockSummary` exacts selon les 4
combinaisons possibles (avec/sans %VMA × avec/sans récup) : probablement 2 clés de base
(`blockSummaryWithRecovery`/`blockSummaryNoRecovery`) chacune avec une variante `_withPace`/
`_noPace` gérée par une chaîne optionnelle composée en JS plutôt que 4 clés i18n séparées — à
trancher à l'implémentation selon ce qui reste le plus lisible.

## Étape 8 — Solde *(≈ 20 min)*

Roadmap **5.9 → ✅** (statut passe de 🟡 à ✅). CHANGELOG + `etat.mjs` via `/commit`. BACKLOG.md :
retirer la ligne RUN-F2c.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `supabase/migrations/<horodatage>_runf2c_session_intervals.sql` (+ `MIGRATIONS.md`) | nouvelle table |
| `docs/specs/technical/powersync-sync-rules.yaml` | 2 nouvelles règles (**déploiement manuel dashboard**) |
| `apps/mobile/src/powersync/schema.ts` | nouvelle table locale |
| `packages/shared/src/running-paces.ts` (+ `.test.ts`) | `paceAtVmaPercent` |
| `packages/shared/src/program.ts` | `sessionIntervalRowSchema` |
| `apps/mobile/src/data/repositories/program-repository.ts` | `IntervalBlockItem`, CRUD, `buildSessionDetails`, cascade `removeSession`/`duplicateProgram` |
| `apps/mobile/src/components/running/IntervalBlockEditor.tsx` (nouveau) | éditeur mobile d'un bloc |
| `apps/mobile/src/components/running/RunningSessionEditor.tsx` | liste de blocs + ajout |
| `apps/admin/src/data/programs.ts` | CRUD admin `session_intervals` |
| `apps/admin/src/screens/ProgramEditScreen.tsx` | `SortableList` de blocs, branche `isRunning` |
| `apps/mobile/src/app/running-programs/[id].tsx` | affichage lecture seule |
| `apps/mobile/src/app/planning/plan.tsx` | affichage lecture seule |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | `running.intervals.*` |

## Migration / sync rules

**1 migration** (nouvelle table). **⚠️ 2 sync rules à déployer manuellement sur le dashboard
PowerSync** — contrairement aux 3 US précédentes de la famille RUN-F2, celle-ci en a réellement
besoin (table neuve, pas une colonne sur une table déjà publiée).

## Dépendances

Aucun paquet nouveau → **recettable sur l'APK existant** une fois les sync rules déployées.

## Risques

- 🔴 **Sync rules oubliées** : le risque le plus concret de cette US précisément — déjà arrivé une
  fois sur ce projet (CYCLE-01, cité par CLAUDE.md). Sans le déploiement dashboard, les blocs créés
  resteraient invisibles après resynchro, symptôme trompeur (« ça marchait en local puis a
  disparu »). Étape 0 à cocher explicitement en recette, pas seulement en développement.
- 🟠 **Duplication de programme** : cascade à ajouter explicitement (étape 2) — sans elle, aucune
  erreur visible, juste une perte silencieuse de contenu à la duplication d'un programme
  fractionné. Trouvé en lisant le code réel, pas dans la spec initiale.
- 🟢 **Aucun risque sur les autres types de séance** (`endurance`, `sortie_longue`,
  `recuperation`) : `intervals` reste vide pour eux, aucun changement de comportement.
- 🟢 **Aucun risque sur le tracker/la tâche de fond** : ni le suivi live ni RUN-F2a/RUN-F2b ne
  sont touchés — cette US s'arrête à la planification et à l'affichage, le guidage pendant la
  course reste RUN-F2d (hors périmètre, spec §4).
- 🟡 **Ampleur** : la plus grosse des 4 US de la famille — prévoir de vérifier le quality gate
  après chaque étape plutôt qu'une seule fois à la fin, pour isoler rapidement une régression.
