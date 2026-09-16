/**
 * US LABO-01 (roadmap 7.30) — les expériences sur soi du Labo : table `lab_experiments`.
 *
 * Toute la règle (tirage des semaines, adhérence, verdict scellé) vit dans `@wellness/shared`
 * (`lab-experiments.ts`, testée sous Vitest). Ici : des entrées/sorties SQL, rien d'autre.
 *
 * ⚠️ **Le tirage se fait à l'écriture, une seule fois**, et l'ordre est enregistré : retirer au sort
 * à chaque lecture changerait le protocole en cours de route — c'est exactement ce que l'expérience
 * est censée empêcher.
 */

import { useQuery } from '@powersync/react';
import {
  LAB_EXPERIMENT_KINDS,
  LAB_EXPERIMENT_WEEKS,
  drawExperimentSchedule,
  parseJsonColumn,
  type LabExperimentArm,
  type LabExperimentKind,
  type LabExperimentRecord,
} from '@wellness/shared';

import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields, patch, softDelete } from './_sql';

/**
 * **Interrupteur d'écriture, lié au schéma distant.** ✅ Levé le 16/09/2026.
 *
 * Patron `ADAPTATION_WRITE_READY` (CARDIO-UX01), et pour la même raison, qui n'est pas cosmétique :
 * écrire une colonne ou une table que le serveur ne connaît pas encore met en file une opération que
 * le cloud **rejette**, et PowerSync **sérialise** la file de synchro — donc c'est la remontée de
 * **toutes** les tables qui se fige, pas seulement celle-ci.
 *
 * Le risque est ici plus large que l'onglet Labo : la **note de nuit** vit dans le check-in de
 * bien-être (BIEN-01), un écran **partagé**. N'importe qui installant le prochain build et tapant
 * « + » sur sa nuit — sans jamais ouvrir le Labo — bloquerait sa synchro. Tant que ce drapeau est à
 * `false`, le champ « Nuit » n'est pas rendu et les expériences ne peuvent pas être lancées — c'est
 * ce qu'il était entre l'écriture du code (15/09) et le push de la migration (16/09).
 *
 * ✅ **Migrations poussées sur le cloud le 16/09/2026** (`npx supabase db push --include-all` par
 * Florian ; colonne et table confirmées dans `database.types.ts` après `npm run db:types`, et sync
 * rule déployée dans le dashboard PowerSync). Le drapeau est donc à `true` : le champ « Nuit » est
 * rendu et les expériences peuvent être lancées.
 *
 * ⚠️ `--include-all` a été nécessaire : ces deux migrations sont horodatées **avant** celles de
 * DEPENSE-01, déjà appliquées. Sans conséquence — les deux jeux sont strictement additifs et
 * disjoints (`daily_wellbeing` + `lab_experiments` d'un côté, `activities` + cibles d'énergie de
 * l'autre), donc l'ordre d'application ne change rien au résultat.
 *
 * Il reste comme **garde-fou documentaire** plutôt que d'être supprimé (même choix que
 * `ADAPTATION_WRITE_READY`) : il nomme la dépendance entre ce code et un schéma distant, et donne un
 * point de retour immédiat si la migration devait être annulée.
 */
export const LAB_WRITE_READY = true;

type LabExperimentDbRow = {
  id: string;
  kind: string;
  start_date: string;
  schedule: string | null;
  status: string;
};

const SELECT_EXPERIMENTS = `
  SELECT id, kind, start_date, schedule, status
  FROM lab_experiments
  WHERE deleted_at IS NULL
  ORDER BY start_date DESC
`;

/** Un ordre de semaines valide : exactement `LAB_EXPERIMENT_WEEKS` bras connus. */
function isSchedule(value: unknown): value is LabExperimentArm[] {
  return (
    Array.isArray(value) &&
    value.length === LAB_EXPERIMENT_WEEKS &&
    value.every((arm) => arm === 'test' || arm === 'usual')
  );
}

/** Une ligne dont le modèle ou l'ordre est inconnu est ignorée plutôt que devinée. */
function toRecord(row: LabExperimentDbRow): LabExperimentRecord | null {
  const kind = LAB_EXPERIMENT_KINDS.find((k) => k === row.kind);
  const schedule = parseJsonColumn<LabExperimentArm[] | null>(row.schedule, null, (v): v is LabExperimentArm[] => isSchedule(v));
  if (!kind || schedule === null) return null;
  return {
    id: row.id,
    kind,
    startKey: row.start_date,
    schedule,
    status: row.status === 'stopped' ? 'stopped' : row.status === 'finished' ? 'finished' : 'running',
  };
}

/** Les expériences de l'utilisateur, de la plus récente à la plus ancienne. */
export function useLabExperiments(): { experiments: LabExperimentRecord[]; isLoading: boolean } {
  const { data, isLoading } = useQuery<LabExperimentDbRow>(SELECT_EXPERIMENTS, []);
  const experiments = data
    .map(toRecord)
    .filter((record): record is LabExperimentRecord => record !== null);
  return { experiments, isLoading };
}

/**
 * Démarre une expérience le `startKey` donné (un lundi, calculé par l'appelant — jamais d'horloge
 * ici). `random` est injecté pour que le tirage soit testable.
 */
export async function startLabExperiment(
  kind: LabExperimentKind,
  startKey: string,
  random: number = Math.random(),
): Promise<string> {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) throw new Error('Aucune session active : impossible de lancer une expérience.');
  return insertWithSyncFields('lab_experiments', {
    user_id: userId,
    kind,
    start_date: startKey,
    schedule: JSON.stringify(drawExperimentSchedule(random)),
    status: 'running',
  });
}

/** Arrête une expérience en cours : elle ne rendra pas de verdict (et le dit). */
export async function stopLabExperiment(id: string): Promise<void> {
  await patch('lab_experiments', id, { status: 'stopped' });
}

/**
 * Clôt une expérience dont les 4 semaines sont passées : elle garde son verdict, et **libère son
 * modèle**. Sans ce geste, l'index unique de la base (`where status = 'running'`) garderait la ligne
 * vivante à vie : le bouton « lancer l'expérience » resterait bloqué sur « déjà en cours », et une
 * relance depuis un autre appareil serait rejetée à l'upload — donc toute la file PowerSync avec.
 */
export async function finishLabExperiment(id: string): Promise<void> {
  await patch('lab_experiments', id, { status: 'finished' });
}

/** Supprime une expérience (soft delete) — sert au ménage, pas au parcours normal. */
export async function deleteLabExperiment(id: string): Promise<void> {
  await softDelete('lab_experiments', id);
}
