# Plan — FANT-01 · Le Fantôme

Spec : [fant01-fantome-course.md](../specs/functional/us/fant01-fantome-course.md) · 18/09/2026 ·
travail direct sur `dev` (décision Florian).

## Ordre de build

Du pur vers l'écran, en cinq incréments commitables séparément. Chaque étape est verte avant la
suivante.

| # | Étape | Fichiers | Tests |
|---|---|---|---|
| 1 | **Moteur pur** : profil du fantôme, écart, statut | `packages/shared/src/run-ghost.ts` (+ export dans `index.ts`) | `run-ghost.test.ts` — Vitest, 100 % lignes/branches visé |
| 2 | **Migration** : `runs.ghost_run_id` | `supabase/migrations/<horodatage>_fant01_ghost_run_id.sql`, `supabase/MIGRATIONS.md`, `database.types.ts` régénérés | aucun (schéma) |
| 3 | **Données** : candidats + écriture du choix | `apps/mobile/src/data/repositories/run-repository.ts` | tests SQL du repository (patron `records-sql.test.ts`) |
| 4 | **Écrans** : choix au départ, bande en course, ligne au résumé | `run/index.tsx`, `run/active.tsx`, `run/summary.tsx`, `components/running/GhostBand.tsx` | tests d'écran (patron `run-summary-screen.test.tsx`) |
| 5 | **Voix** : annonces d'écart et de dépassement | `apps/mobile/src/running/ghost-guidance.ts` | tests du hook + de la décision pure |

⚠️ **Nom du module** : `run-ghost.ts`, pas `ghost.ts` — ce nom est déjà pris par le fantôme
**musculation** de MUSCU-UX03 (comparaison de tonnage). Deux fantômes, deux piliers, deux modules.

## Étape 1 — le moteur pur (TDD)

API visée :

```ts
export type GhostSample = { t: number; d: number };        // temps net (s), distance cumulée (m)
export type GhostProfile = { samples: GhostSample[]; totalDistanceM: number; totalSeconds: number };
export type GhostStatus = 'ahead' | 'behind' | 'level' | 'finished';
export type GhostGap = { meters: number; status: GhostStatus; seconds: number | null };

export const GHOST_PAUSE_GAP_S = 60;   // R3
export const GHOST_LEVEL_M = 5;        // tolérance du « coude à coude »
export const GHOST_MAX_START_DISTANCE_M = 300;  // R2
export const GHOST_MIN_DISTANCE_M = 500;        // R2

export function buildGhostProfile(points: ReadonlyArray<GpsPoint>): GhostProfile | null;
export function ghostDistanceAt(profile: GhostProfile, netSeconds: number): number;
export function ghostGap(input: {
  profile: GhostProfile; runnerDistanceM: number; netSeconds: number; avgPaceSPerKm: number | null;
}): GhostGap;
export function isGhostCandidate(input: {
  distanceM: number | null; points: ReadonlyArray<GpsPoint>; startLat: number; startLng: number;
}): boolean;
```

Cas de test (au moins) :

1. profil `null` si moins de 2 points ;
2. temps net : un trou de 90 s ne compte pas, un trou de 30 s compte (R3) ;
3. distance interpolée entre deux échantillons ; bornes exactes aux extrémités ;
4. avant le premier échantillon → 0 ; après le dernier → distance totale (jamais d'extrapolation) ;
5. `ghostGap` : devant / derrière / coude à coude selon `GHOST_LEVEL_M` ;
6. `finished` dès que `netSeconds > totalSeconds`, écart figé à la valeur finale (R5) ;
7. `seconds` à `null` sans allure moyenne, sinon conversion cohérente (R4) ;
8. `isGhostCandidate` : départ à 299 m accepté, 301 m refusé, distance < 500 m refusée, trace à
   1 point refusée.

## Étape 2 — migration

```sql
alter table public.runs add column if not exists ghost_run_id uuid null references public.runs (id) on delete set null;
```

`on delete set null` et non cascade : supprimer la course fantôme ne doit pas emporter la course qui
l'a affrontée (R9). Additive et nullable → **aucun rejeu**, aucune donnée touchée. `runs` est **déjà**
dans la publication PowerSync : **aucune sync rule à redéployer** (piège connu du dépôt).
Après `npm run db:push` : `npm run db:types`, puis cocher la ligne dans
[MIGRATIONS.md](../../supabase/MIGRATIONS.md).

## Étape 3 — données

- `useGhostCandidates(startLat, startLng)` : lit les courses terminées avec trace des 90 derniers
  jours (patron `SELECT_RUNS_WITH_TRACK_SINCE`, déjà en place), décode, filtre par `isGhostCandidate`,
  trie par date décroissante, rend les 3 premières + le reste à la demande.
- `setRunGhost(runId, ghostRunId)` : écriture unique au démarrage.
- `useRunGhost(runId)` : la course fantôme d'une course (résumé), avec son profil décodé.

⚠️ Décodage **hors rendu** : `decodeTrack` sur 3 candidats à chaque frame coûterait cher — décodage
dans le hook, mémoïsé par identifiant de course.

## Étape 4 — écrans

- `run/index.tsx` : une ligne repliée « Courir contre un fantôme » ; ouvre une feuille de sélection.
- `GhostBand.tsx` : la bande de l'écran de suivi (écart, date, statut), accessible d'un bloc.
- `run/active.tsx` : branche la bande sous les stats secondaires ; ne rend **rien** sans fantôme.
- `run/summary.tsx` : une ligne « Contre ton fantôme du {{date}} ».

## Étape 5 — voix

`ghost-guidance.ts`, calqué sur `pace-guidance.ts` : la décision (`shouldAnnounceGhost`) vit dans
`run-ghost.ts` (pure, testée), le hook tient l'état et appelle `Speech.speak`. Anti-répétition 60 s,
initialisation depuis l'écart courant au montage (R7).

## i18n

Clés `running.ghost.*` (FR + EN) listées dans la spec §7, ajoutées aux deux locales dans la même
étape que l'écran qui les consomme — jamais de clé orpheline.

## Ce que le plan ne fait pas

Pas de fantôme sur la carte, pas de rejeu, pas de fantôme d'un autre utilisateur, pas de comparaison
phase par phase sur un fractionné (spec §2).
