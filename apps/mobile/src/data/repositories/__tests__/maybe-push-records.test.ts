/**
 * maybePushRecords.test.ts — push de record agrégé (US MUSC-F8, décisions D10/D11/D14).
 *
 * Vérifie les règles trouvées manquantes en revue critique avant livraison :
 *  - `recordPush: false` → aucun envoi ;
 *  - permission refusée → aucun envoi ET quota inchangé (l'ordre des vérifications compte, B3) ;
 *  - au plafond → aucun envoi ;
 *  - `presentNow` renvoyant `false` → quota NON incrémenté (D14, contrat booléen) ;
 *  - sous le plafond avec succès → 1 envoi + quota incrémenté ;
 *  - tableau vide → sortie immédiate, aucun appel aux étapes suivantes.
 */
import { maybePushRecords } from '../notification-repository';
import { getNotificationPrefs, getUnitSystem } from '../settings-repository';
import { ensurePermissionAndChannel, presentNow } from '@/lib/notifications';
import { useNotificationQuota } from '@/stores/notification-quota-store';
import { defaultNotificationPrefs, localDayKey } from '@wellness/shared';
import type { BeatenRecord } from '../records-repository';

jest.mock('../settings-repository', () => ({
  getNotificationPrefs: jest.fn(),
  getUnitSystem: jest.fn(),
}));

jest.mock('@/lib/notifications', () => ({
  ensurePermissionAndChannel: jest.fn(),
  presentNow: jest.fn(),
  RECORD_PUSH_PREFIX: 'record-push-',
}));

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));

function record(exerciseId: string, exerciseName = 'Squat'): BeatenRecord {
  return {
    exerciseId,
    exerciseName,
    type: 'max_weight',
    value: 100,
    reps: 5,
    weightKg: 100,
    achievedAt: '2026-07-30T18:00:00.000Z',
  };
}

const mockGetNotificationPrefs = getNotificationPrefs as jest.Mock;
const mockGetUnitSystem = getUnitSystem as jest.Mock;
const mockEnsurePermission = ensurePermissionAndChannel as jest.Mock;
const mockPresentNow = presentNow as jest.Mock;

describe('maybePushRecords', () => {
  const todayKey = localDayKey(new Date());

  beforeEach(() => {
    jest.clearAllMocks();
    useNotificationQuota.setState({ dayKey: null, count: 0, hydrated: true });
    mockGetNotificationPrefs.mockResolvedValue(defaultNotificationPrefs());
    mockGetUnitSystem.mockResolvedValue('metric');
    mockEnsurePermission.mockResolvedValue(true);
    mockPresentNow.mockResolvedValue(true);
  });

  it('ne fait rien pour un tableau vide — sortie avant toute vérification', async () => {
    await maybePushRecords('w1', []);
    expect(mockGetNotificationPrefs).not.toHaveBeenCalled();
    expect(mockPresentNow).not.toHaveBeenCalled();
  });

  it('recordPush désactivé → aucun envoi', async () => {
    mockGetNotificationPrefs.mockResolvedValue({ ...defaultNotificationPrefs(), recordPush: false });
    await maybePushRecords('w1', [record('e1')]);
    expect(mockPresentNow).not.toHaveBeenCalled();
  });

  it('permission refusée → aucun envoi ET aucune unité de quota consommée', async () => {
    mockEnsurePermission.mockResolvedValue(false);
    await maybePushRecords('w1', [record('e1')]);
    expect(mockPresentNow).not.toHaveBeenCalled();
    expect(useNotificationQuota.getState().countFor(todayKey)).toBe(0);
  });

  it('au plafond (3/3) → aucun envoi', async () => {
    useNotificationQuota.setState({ dayKey: todayKey, count: 3, hydrated: true });
    await maybePushRecords('w1', [record('e1')]);
    expect(mockPresentNow).not.toHaveBeenCalled();
  });

  it('sous le plafond (2/3), succès → 1 envoi et quota incrémenté à 3', async () => {
    useNotificationQuota.setState({ dayKey: todayKey, count: 2, hydrated: true });
    await maybePushRecords('w1', [record('e1')]);
    expect(mockPresentNow).toHaveBeenCalledTimes(1);
    expect(useNotificationQuota.getState().countFor(todayKey)).toBe(3);
  });

  it('presentNow renvoyant false → quota NON incrémenté (D14)', async () => {
    mockPresentNow.mockResolvedValue(false);
    await maybePushRecords('w1', [record('e1')]);
    expect(useNotificationQuota.getState().countFor(todayKey)).toBe(0);
  });

  it('identifiant construit à partir du workoutId (D10 — pas un id stable)', async () => {
    await maybePushRecords('w-abc-123', [record('e1')]);
    expect(mockPresentNow).toHaveBeenCalledWith(
      'record-push-w-abc-123',
      expect.objectContaining({ title: expect.any(String), body: expect.any(String) }),
    );
  });
});
