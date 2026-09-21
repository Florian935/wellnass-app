/**
 * US EFFORT-01 — repository du **journal des efforts** (table `run_efforts`).
 * Réf. : docs/specs/functional/us/effort01-meilleurs-efforts-sortie.md
 *
 * ⚠️ **À ne pas confondre avec `running-record-repository`**, qui gère le **palmarès**
 * (`running_pace_records` : une ligne par distance, le meilleur temps, cinq distances). Ici on
 * garde **tous** les passages, sur **huit** distances — c'est ce qui permet de dire « 2ᵉ meilleur
 * temps », ce dont le palmarès est structurellement incapable (index unique par distance).
 *
 * Trois responsabilités :
 *  1. **Lecture réactive** (`useRunEfforts`) : les efforts d'une course, chacun avec son **rang** et
 *     son **écart au record**.
 *  2. **Écriture à la clôture** (`storeRunEffortsFromPoints`) : appelée par
 *     `detectAndStoreRunRecords`, **depuis la même trace déjà décodée** — décoder deux fois 3 000
 *     points pour écrire deux tables serait payer le calcul le plus cher de l'écran en double.
 *  3. **Rattrapage** (`backfillRunEfforts`) : rejoue le calcul sur l'historique, par lots.
 *
 * 🔴 **Le rang n'est jamais stocké** (spec R7). Il est dérivé à chaque lecture par `rankEfforts`,
 * la brique pure et testée de `@wellness/shared` — un effort classé 2ᵉ devient 3ᵉ à la course
 * suivante **sans que sa propre ligne ait bougé**. Stocker un rang, c'est stocker une valeur que
 * l'écriture d'une autre ligne rend fausse.
 *
 * Règles offline-first (docs/specs/technical/offline-sync.md) : UUID côté client, timestamps UTC,
 * soft delete, écriture immédiate en SQLite. PowerSync ne réplique que les lignes de l'utilisateur
 * courant (bucket par JWT) : en lecture, `deleted_at IS NULL` suffit.
 */

import { useQuery } from '@powersync/react';
import {
  computeRunEfforts,
  decodeTrack,
  pickMapMedals,
  rankEfforts,
  RUNNING_RECORD_DISTANCES,
  type GpsPoint,
  type RecordDistanceKey,
} from '@wellness/shared';

import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields, nowUtc, patch } from './_sql';

// ---------------------------------------------------------------------------
// Types de domaine exposés à l'UI
// ---------------------------------------------------------------------------

/** Un effort, classé — tel que l'écran le consomme. */
export type RankedRunEffort = {
  id: string;
  runId: string;
  distanceKey: RecordDistanceKey;
  distanceMeters: number;
  timeSeconds: number;
  startIndex: number;
  endIndex: number;
  midLat: number | null;
  midLng: number | null;
  achievedAt: string;
  /** 1 = record personnel. Dérivé, jamais stocké (spec R7). */
  rank: number;
  /** Secondes qui séparent cet effort du meilleur temps de la distance. `0` pour un record. */
  gapSeconds: number;
};

/** Ligne brute SQLite (colonnes snake_case). */
type RunEffortDbRow = {
  id: string;
  run_id: string;
  distance_key: string;
  time_seconds: number;
  start_index: number;
  end_index: number;
  mid_lat: number | null;
  mid_lng: number | null;
  achieved_at: string;
};

// ---------------------------------------------------------------------------
// Requêtes (littérales — donc balayées par `sql-prepare-sweep`)
// ---------------------------------------------------------------------------

/**
 * **Tout** le journal de l'utilisateur courant.
 *
 * Volontairement sans clause sur la distance ni sur la course : le rang d'un effort se calcule
 * contre **tous** les autres efforts de sa distance, donc une requête restreinte à une course ne
 * suffirait pas. La filtrer par `distance_key IN (…)` imposerait une chaîne **interpolée**, que
 * `sql-prepare-sweep` ne sait pas préparer — et c'est précisément la classe de bug qu'il attrape.
 *
 * Volume : 8 distances × nombre de courses GPS. Un coureur à 200 sorties par an tient dans
 * ~1 600 lignes — sans commune mesure avec le décodage de trace que cet écran fait déjà.
 */
const SELECT_ALL_EFFORTS = `
  SELECT id, run_id, distance_key, time_seconds, start_index, end_index, mid_lat, mid_lng, achieved_at
  FROM run_efforts
  WHERE deleted_at IS NULL
`;

/** Les courses terminées que le rattrapage n'a pas encore traitées (spec R19/R20). */
const SELECT_RUNS_TO_BACKFILL = `
  SELECT id, source, gps_track, finished_at
  FROM runs
  WHERE status = 'completed' AND efforts_computed_at IS NULL AND deleted_at IS NULL
  ORDER BY started_at DESC
`;

/** Une course, pour le rattrapage unitaire. */
const SELECT_RUN_FOR_EFFORTS = `
  SELECT id, source, status, gps_track, finished_at, efforts_computed_at
  FROM runs
  WHERE id = ? AND deleted_at IS NULL
`;

/** Les efforts d'une course, pour la suppression logique. */
const SELECT_EFFORT_IDS_FOR_RUN = `
  SELECT id FROM run_efforts WHERE run_id = ? AND deleted_at IS NULL
`;

// ---------------------------------------------------------------------------
// Mapping et tri
// ---------------------------------------------------------------------------

function metersOf(key: RecordDistanceKey): number {
  return RUNNING_RECORD_DISTANCES.find((d) => d.key === key)?.meters ?? 0;
}

/** Index canonique d'une distance ; une clé inconnue part en fin de liste plutôt que de disparaître. */
function orderIndex(key: RecordDistanceKey): number {
  const idx = RUNNING_RECORD_DISTANCES.findIndex((d) => d.key === key);
  return idx === -1 ? RUNNING_RECORD_DISTANCES.length : idx;
}

// ---------------------------------------------------------------------------
// Lecture réactive
// ---------------------------------------------------------------------------

/**
 * Les efforts d'une course, classés, et les deux médailles à poser sur la carte.
 *
 * `isLoading` ne dépend que de la résolution de la requête locale (SQLite), jamais de la synchro
 * réseau — offline-first, ADR-001 / décision B.
 */
export function useRunEfforts(runId: string | null | undefined): {
  efforts: RankedRunEffort[];
  medals: RankedRunEffort[];
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery<RunEffortDbRow>(SELECT_ALL_EFFORTS);

  if (!runId) return { efforts: [], medals: [], isLoading };

  // Un seau par distance : le rang se calcule au sein d'une distance, jamais entre distances.
  const byDistance = new Map<string, RunEffortDbRow[]>();
  for (const row of data) {
    const bucket = byDistance.get(row.distance_key);
    if (bucket) bucket.push(row);
    else byDistance.set(row.distance_key, [row]);
  }

  const efforts: RankedRunEffort[] = [];
  for (const [distanceKey, rows] of byDistance) {
    // `rankEfforts` porte la règle — tri par temps, **égalité → le plus ancien devant** — et elle
    // est testée là-bas. La réécrire en SQL la dupliquerait, et c'est ce genre de duplication qui
    // finit par diverger sans que rien ne le signale.
    const ranked = rankEfforts(
      rows.map((r) => ({ row: r, timeSeconds: r.time_seconds, achievedAt: r.achieved_at })),
    );
    for (const entry of ranked) {
      if (entry.row.run_id !== runId) continue;
      const key = distanceKey as RecordDistanceKey;
      efforts.push({
        id: entry.row.id,
        runId: entry.row.run_id,
        distanceKey: key,
        distanceMeters: metersOf(key),
        timeSeconds: entry.row.time_seconds,
        startIndex: entry.row.start_index,
        endIndex: entry.row.end_index,
        midLat: entry.row.mid_lat,
        midLng: entry.row.mid_lng,
        achievedAt: entry.row.achieved_at,
        rank: entry.rank,
        gapSeconds: entry.gapSeconds,
      });
    }
  }

  efforts.sort((a, b) => orderIndex(a.distanceKey) - orderIndex(b.distanceKey));

  // Une médaille sans position ne peut pas se poser : on ne la propose même pas.
  const medals = pickMapMedals(efforts.filter((e) => e.midLat != null && e.midLng != null));

  return { efforts, medals, isLoading };
}

// ---------------------------------------------------------------------------
// Écritures
// ---------------------------------------------------------------------------

/** Identifiant de l'utilisateur de la session courante (lève si déconnecté). */
function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) {
    throw new Error("Aucune session active : impossible d'écrire un effort de course.");
  }
  return userId;
}

/**
 * Écrit le journal d'une course **à partir d'une trace déjà décodée**, puis marque la course
 * comme traitée.
 *
 * 🔴 **La course est marquée même quand elle ne produit aucun effort** (tapis, trace trop courte,
 * saisie manuelle — spec R20). Sans ça, le rattrapage la reprendrait à chaque démarrage de l'app,
 * pour rien, indéfiniment.
 *
 * `points` vide est donc un appel **légitime**, pas un cas d'erreur.
 *
 * @returns le nombre d'efforts écrits.
 */
export async function storeRunEffortsFromPoints(
  runId: string,
  points: readonly GpsPoint[],
  achievedAt: string,
): Promise<number> {
  const efforts = computeRunEfforts(points);
  const userId = currentUserId();

  for (const effort of efforts) {
    await insertWithSyncFields('run_efforts', {
      user_id: userId,
      run_id: runId,
      distance_key: effort.distanceKey,
      time_seconds: effort.timeSeconds,
      start_index: effort.startIndex,
      end_index: effort.endIndex,
      mid_lat: effort.midLat,
      mid_lng: effort.midLng,
      achieved_at: achievedAt,
    });
  }

  await patch('runs', runId, { efforts_computed_at: nowUtc() });
  return efforts.length;
}

/**
 * Écrit le journal d'une course depuis son identifiant — charge et décode la trace lui-même.
 *
 * Utilisé par le **rattrapage**. À la clôture d'une course, c'est `storeRunEffortsFromPoints` qui
 * est appelée, avec la trace que `detectAndStoreRunRecords` vient déjà de décoder.
 *
 * **Idempotent** (spec R20) : une course déjà marquée n'est pas retouchée.
 */
export async function storeRunEfforts(runId: string): Promise<number> {
  const run = await powerSync.getOptional<{
    id: string;
    source: string;
    status: string;
    gps_track: string | null;
    finished_at: string | null;
    efforts_computed_at: string | null;
  }>(SELECT_RUN_FOR_EFFORTS, [runId]);

  if (!run || run.status !== 'completed') return 0;
  if (run.efforts_computed_at) return 0;

  // Une course manuelle ou sans trace est traitée **et marquée** : zéro effort est un résultat,
  // pas un échec.
  const points =
    run.source === 'manual' || !run.gps_track ? [] : decodeTrack(run.gps_track);

  return storeRunEffortsFromPoints(runId, points, run.finished_at ?? nowUtc());
}

/** Supprime logiquement les efforts d'une course — appelé quand la course elle-même est supprimée. */
export async function softDeleteRunEfforts(runId: string): Promise<void> {
  const rows = await powerSync.getAll<{ id: string }>(SELECT_EFFORT_IDS_FOR_RUN, [runId]);
  for (const row of rows) {
    await patch('run_efforts', row.id, { deleted_at: nowUtc() });
  }
}

// ---------------------------------------------------------------------------
// Rattrapage de l'historique (spec R19/R20)
// ---------------------------------------------------------------------------

/**
 * Taille d'un lot. Décoder deux ans de traces d'un seul tenant gèlerait l'interface : une course
 * d'une heure fait ~3 000 points, et le décodage est le calcul le plus cher du pilier.
 */
export const EFFORT_BACKFILL_BATCH = 20;

/** Verrou d'exécution : deux rattrapages concurrents écriraient les mêmes lignes deux fois. */
let backfillRunning = false;

/**
 * Rejoue le calcul sur toutes les courses terminées jamais traitées.
 *
 * 🔴 **Obligatoire, pas confort.** Sans lui, le premier effort de chaque distance s'affiche
 * « 1ᵉʳ » à quelqu'un qui a déjà couru quarante fois : tous les rangs sont faux au lancement.
 * C'est exactement le piège découvert par IMPORT-01 sur `personal_records`, qui n'est pas dérivée
 * — un historique importé sans appel explicite n'aurait produit aucun record.
 *
 * Interruption (fermeture de l'app, erreur) : sans conséquence. Le marqueur
 * `runs.efforts_computed_at` est posé course par course, donc la reprise repart exactement là où
 * ça s'est arrêté.
 *
 * @returns le nombre de courses traitées.
 */
export async function backfillRunEfforts(): Promise<number> {
  if (backfillRunning) return 0;
  backfillRunning = true;
  try {
    const runs = await powerSync.getAll<{ id: string }>(SELECT_RUNS_TO_BACKFILL);
    let done = 0;
    for (let i = 0; i < runs.length; i += EFFORT_BACKFILL_BATCH) {
      const batch = runs.slice(i, i + EFFORT_BACKFILL_BATCH);
      for (const run of batch) {
        try {
          await storeRunEfforts(run.id);
          done += 1;
        } catch (err) {
          // Une course illisible ne doit pas emporter le rattrapage des autres. Elle reste non
          // marquée, donc reprise au prochain lancement.
          console.warn('[runEfforts] rattrapage échoué pour', run.id, err);
        }
      }
      // Rendre la main entre deux lots : l'interface doit rester vivante pendant le rattrapage.
      if (i + EFFORT_BACKFILL_BATCH < runs.length) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    return done;
  } finally {
    backfillRunning = false;
  }
}
