import { useNotificationQuota } from '../notification-quota-store';
import { canScheduleMore, defaultNotificationPrefs } from '@wellness/shared';

/** Réinitialise le store entre les tests (Zustand ne le fait pas tout seul). */
function resetStore() {
  useNotificationQuota.setState({ dayKey: null, count: 0, hydrated: false });
}

describe('notification-quota-store', () => {
  beforeEach(() => {
    resetStore();
  });

  it('démarre à 0, pour aucun jour', () => {
    expect(useNotificationQuota.getState().countFor('2026-07-30')).toBe(0);
  });

  it('incrémente pour le jour courant à chaque succès', () => {
    const { recordSuccess } = useNotificationQuota.getState();
    recordSuccess('2026-07-30');
    recordSuccess('2026-07-30');
    expect(useNotificationQuota.getState().countFor('2026-07-30')).toBe(2);
  });

  it('réinitialise au changement de jour', () => {
    const { recordSuccess } = useNotificationQuota.getState();
    recordSuccess('2026-07-30');
    recordSuccess('2026-07-30');
    recordSuccess('2026-07-31');
    expect(useNotificationQuota.getState().countFor('2026-07-31')).toBe(1);
  });

  it("countFor d'un autre jour que celui stocké renvoie 0, sans consommer le compteur", () => {
    useNotificationQuota.getState().recordSuccess('2026-07-30');
    expect(useNotificationQuota.getState().countFor('2026-07-29')).toBe(0);
    // Le jour stocké n'est pas altéré par une lecture d'un autre jour.
    expect(useNotificationQuota.getState().countFor('2026-07-30')).toBe(1);
  });

  it('hydrate est idempotent (ne recharge pas si déjà hydraté)', async () => {
    useNotificationQuota.setState({ hydrated: true, dayKey: '2026-07-30', count: 5 });
    await useNotificationQuota.getState().hydrate();
    expect(useNotificationQuota.getState().count).toBe(5);
  });

  it('canScheduleMore respecte les bornes du plafond par défaut (3)', () => {
    const prefs = defaultNotificationPrefs();
    expect(canScheduleMore(2, prefs)).toBe(true);
    expect(canScheduleMore(3, prefs)).toBe(false);
  });
});
