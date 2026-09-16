/**
 * US LABO-01 — écritures du repository des expériences du Labo.
 *
 * Le tirage des semaines (`drawExperimentSchedule`) est déjà couvert sous Vitest ; ce qui est
 * vérifié ici est la **plomberie**, et surtout le point qui invaliderait le protocole s'il cédait :
 * l'ordre des semaines est tiré **une fois, à l'écriture**, et enregistré. Le retirer à chaque
 * lecture changerait le protocole en cours de route — exactement ce que l'expérience doit empêcher.
 */

import { drawExperimentSchedule, LAB_EXPERIMENT_WEEKS } from '@wellness/shared';

import { deleteLabExperiment, startLabExperiment, stopLabExperiment } from '../lab-experiment-repository';
import { insertWithSyncFields, patch, softDelete } from '../_sql';

jest.mock('@powersync/react', () => ({ useQuery: jest.fn(() => ({ data: [], isLoading: false })) }));

jest.mock('../_sql', () => ({
  insertWithSyncFields: jest.fn(async () => 'exp-1'),
  patch: jest.fn(async () => undefined),
  softDelete: jest.fn(async () => undefined),
}));

const session = { session: { user: { id: 'user-1' } } as { user: { id: string } } | null };
jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => session },
}));

beforeEach(() => {
  jest.clearAllMocks();
  session.session = { user: { id: 'user-1' } };
});

describe('startLabExperiment', () => {
  it('écrit le modèle, le lundi de départ, le statut et l’ordre TIRÉ des semaines', async () => {
    const id = await startLabExperiment('legs48h', '2026-09-21', 0.42);

    expect(id).toBe('exp-1');
    expect(insertWithSyncFields).toHaveBeenCalledWith('lab_experiments', {
      user_id: 'user-1',
      kind: 'legs48h',
      start_date: '2026-09-21',
      schedule: JSON.stringify(drawExperimentSchedule(0.42)),
      status: 'running',
    });
  });

  it('🔴 l’ordre enregistré compte bien 4 semaines, moitié « essai », moitié « habitude »', async () => {
    await startLabExperiment('carbsHardDays', '2026-09-21', 0.9);

    const written = (insertWithSyncFields as jest.Mock).mock.calls[0]![1] as { schedule: string };
    const schedule = JSON.parse(written.schedule) as string[];

    // Un protocole déséquilibré (3 semaines d'essai contre 1) ne permettrait pas de comparer :
    // le verdict porterait sur une seule semaine « habitude », donc sur rien.
    expect(schedule).toHaveLength(LAB_EXPERIMENT_WEEKS);
    expect(schedule.filter((arm) => arm === 'test')).toHaveLength(LAB_EXPERIMENT_WEEKS / 2);
    expect(schedule.filter((arm) => arm === 'usual')).toHaveLength(LAB_EXPERIMENT_WEEKS / 2);
  });

  it('🔴 lève sans session plutôt que d’écrire une ligne sans propriétaire', async () => {
    session.session = null;

    // Une ligne sans `user_id` ne remonterait dans aucun bucket PowerSync : elle serait perdue en
    // silence, et l'utilisateur croirait son expérience lancée.
    await expect(startLabExperiment('earlierBedtime', '2026-09-21', 0.1)).rejects.toThrow(/session/i);
    expect(insertWithSyncFields).not.toHaveBeenCalled();
  });
});

describe('arrêt et suppression', () => {
  it('arrêter marque « stopped » sans effacer la ligne', async () => {
    await stopLabExperiment('exp-9');

    // L'expérience arrêtée reste visible dans les acquis : c'est ce qui explique l'absence de verdict.
    expect(patch).toHaveBeenCalledWith('lab_experiments', 'exp-9', { status: 'stopped' });
    expect(softDelete).not.toHaveBeenCalled();
  });

  it('supprimer passe par le soft delete, comme toute la couche data', async () => {
    await deleteLabExperiment('exp-9');

    expect(softDelete).toHaveBeenCalledWith('lab_experiments', 'exp-9');
  });
});
