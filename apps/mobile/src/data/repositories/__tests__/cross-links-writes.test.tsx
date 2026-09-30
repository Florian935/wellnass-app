/**
 * US LIENS-01 / LABO-04 — les écritures de fond du registre des liens (`useCrossLinksWrites`).
 *
 * C'est le chemin le plus risqué du chantier (revue du 30/09/2026) : il écrit **sans geste de
 * l'utilisateur**, à chaque changement du registre, dans une table synchronisée. Chaque garde a son
 * test, parce que chacune empêche une écriture fausse qui partirait sur le cloud :
 *  1. rien tant que les lectures qui décident d'un état n'ont pas toutes répondu (`writeReady`) ;
 *  2. rien avant la première synchro (`hasSynced`) — sinon un appareil neuf, base vide, écraserait
 *     l'état réel écrit par l'autre avec des « à découvrir » ;
 *  3. rien sans session ;
 *  4. une ligne neuve est **insérée**, une ligne existante **mise à jour** (même identifiant) ;
 *  5. rien si la ligne dit déjà l'état calculé ;
 *  6. 🔴 **par front** : une ligne changée par un autre appareil, alors que le calcul local n'a pas
 *     bougé, n'est pas réécrite (sinon deux appareils se la renvoient à l'infini) ;
 *  7. une expérience dont la fenêtre est passée est close **avec son verdict** (LABO-04) ;
 *  8. un échec d'écriture est tracé, jamais avalé en silence, et ne casse rien.
 */

import { act, renderHook } from '@testing-library/react-native';
import { useStatus } from '@powersync/react';
import { stableUuid, type CrossLink, type CrossLinkState } from '@wellness/shared';

import { useCrossLinksWrites, type CrossLinksValue } from '../cross-links-repository';
import { insertWithSyncFields, patch } from '../_sql';
import { finishLabExperiment } from '../lab-experiment-repository';

jest.mock('@powersync/react', () => ({ useQuery: jest.fn(() => ({ data: [], isLoading: false })), useStatus: jest.fn() }));
jest.mock('@/hooks/useTodayKey', () => ({ useTodayKey: jest.fn(() => '2026-09-24') }));

const session = { current: { user: { id: 'user-1' } } as { user: { id: string } } | null };
jest.mock('@/stores/auth-store', () => {
  const useAuthStore = (selector: (s: { session: unknown }) => unknown) => selector({ session: session.current });
  useAuthStore.getState = () => ({ session: session.current });
  return { useAuthStore };
});
jest.mock('../_sql', () => ({
  insertWithSyncFields: jest.fn(async () => 'id'),
  patch: jest.fn(async () => undefined),
}));
jest.mock('../lab-experiment-repository', () => ({
  LAB_WRITE_READY: true,
  finishLabExperiment: jest.fn(async () => undefined),
}));

// Le calcul (`useComputeCrossLinks`) n'est pas monté ici : ses dépendances sont doublées à vide pour
// que l'import du module ne tire ni i18n ni la base.
jest.mock('@/data/guidance', () => ({}));
jest.mock('@/stores/dismissed-rules-store', () => ({ useDismissedRules: jest.fn() }));
jest.mock('../activity-repository', () => ({}));
jest.mock('../dashboard-repository', () => ({}));
jest.mock('../lab-repository', () => ({}));
jest.mock('../menstrual-cycle-repository', () => ({}));
jest.mock('../nutrition-repository', () => ({}));
jest.mock('../profile-repository', () => ({}));
jest.mock('../real-life-repository', () => ({}));
jest.mock('../running-profile-repository', () => ({}));
jest.mock('../settings-repository', () => ({}));
jest.mock('../strength-repository', () => ({}));
jest.mock('../weekly-review-repository', () => ({}));

const mockStatus = useStatus as jest.Mock;
const MON = '2026-09-21';

const lien = (id: CrossLink['id'], state: CrossLinkState) => ({ id, state }) as unknown as CrossLink;

type Over = Partial<Omit<CrossLinksValue, 'core'>> & { experiments?: unknown[] };

const valeur = ({ experiments = [], ...over }: Over = {}): CrossLinksValue =>
  ({
    links: [lien('sports', 'adjust'), lien('recovery', 'holds')],
    learning: [],
    core: { experiments },
    weeks: [],
    goalConflict: null,
    cycleTrackingEnabled: false,
    isLoading: false,
    writeReady: true,
    ...over,
  }) as unknown as CrossLinksValue;

/** Laisse l'écriture asynchrone du `useEffect` se terminer. */
const flush = () => act(async () => {});

const monter = async (value: CrossLinksValue) => {
  const hook = await renderHook(({ v }: { v: CrossLinksValue }) => useCrossLinksWrites(v), { initialProps: { v: value } });
  await flush();
  return hook;
};

beforeEach(() => {
  jest.clearAllMocks();
  session.current = { user: { id: 'user-1' } };
  mockStatus.mockReturnValue({ hasSynced: true });
});

describe('les gardes', () => {
  it('🔴 rien tant que toutes les lectures n’ont pas répondu', async () => {
    await monter(valeur({ writeReady: false }));
    expect(insertWithSyncFields).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });

  it('🔴 rien avant la première synchro (appareil neuf, base encore vide)', async () => {
    mockStatus.mockReturnValue({ hasSynced: false });
    await monter(valeur());
    expect(insertWithSyncFields).not.toHaveBeenCalled();
  });

  it('rien sans session', async () => {
    session.current = null;
    await monter(valeur());
    expect(insertWithSyncFields).not.toHaveBeenCalled();
  });
});

describe('l’histoire de la semaine', () => {
  it('insère une ligne neuve par lien, sous un identifiant déterministe', async () => {
    await monter(valeur());

    expect(insertWithSyncFields).toHaveBeenCalledTimes(2);
    expect(insertWithSyncFields).toHaveBeenCalledWith('cross_link_weeks', {
      id: stableUuid(`user-1|${MON}|sports`),
      user_id: 'user-1',
      week_start: MON,
      link_id: 'sports',
      state: 'adjust',
    });
  });

  it('met à jour une ligne existante (même identifiant) plutôt que d’en créer une seconde', async () => {
    const id = stableUuid(`user-1|${MON}|sports`);
    await monter(valeur({ weeks: [{ id, linkId: 'sports', weekStart: MON, state: 'holds' }] }));

    expect(patch).toHaveBeenCalledWith('cross_link_weeks', id, { state: 'adjust' });
    expect(insertWithSyncFields).not.toHaveBeenCalledWith('cross_link_weeks', expect.objectContaining({ link_id: 'sports' }));
  });

  it('🔴 une ligne existante d’un autre identifiant est mise à jour, jamais doublée', async () => {
    // Une ligne écrite sous un autre identifiant (import, ancienne version) : la semaine du lien
    // existe déjà. En créer une seconde laisserait l'histoire lire l'une ou l'autre au hasard.
    await monter(valeur({ weeks: [{ id: 'ancienne', linkId: 'sports', weekStart: MON, state: 'holds' }] }));

    expect(patch).toHaveBeenCalledWith('cross_link_weeks', 'ancienne', { state: 'adjust' });
    expect(insertWithSyncFields).not.toHaveBeenCalledWith('cross_link_weeks', expect.objectContaining({ link_id: 'sports' }));
  });

  it('n’écrit rien quand la ligne dit déjà l’état calculé', async () => {
    await monter(
      valeur({
        weeks: [
          { id: 'a', linkId: 'sports', weekStart: MON, state: 'adjust' },
          { id: 'b', linkId: 'recovery', weekStart: MON, state: 'holds' },
        ],
      }),
    );
    expect(insertWithSyncFields).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });

  it('🔴 une ligne changée par un AUTRE appareil n’est pas réécrite si le calcul local n’a pas bougé', async () => {
    const synced = [
      { id: 'a', linkId: 'sports', weekStart: MON, state: 'adjust' },
      { id: 'b', linkId: 'recovery', weekStart: MON, state: 'holds' },
    ];
    const hook = await monter(valeur({ weeks: synced }));
    expect(patch).not.toHaveBeenCalled();

    // L'autre appareil (une règle rejetée chez lui seulement) écrit « ça tient » sur `sports`.
    await hook.rerender({ v: valeur({ weeks: [{ ...synced[0]!, state: 'holds' }, synced[1]!] }) });
    await flush();

    // Sans le déclenchement par front, cet appareil réécrirait « à régler », l'autre « ça tient »…
    expect(patch).not.toHaveBeenCalled();
  });

  it('le calcul local change : la ligne est réécrite', async () => {
    const synced = [
      { id: 'a', linkId: 'sports', weekStart: MON, state: 'adjust' },
      { id: 'b', linkId: 'recovery', weekStart: MON, state: 'holds' },
    ];
    const hook = await monter(valeur({ weeks: synced }));

    await hook.rerender({ v: valeur({ weeks: synced, links: [lien('sports', 'holds'), lien('recovery', 'holds')] }) });
    await flush();

    expect(patch).toHaveBeenCalledWith('cross_link_weeks', 'a', { state: 'holds' });
  });
});

describe('LABO-04 — les expériences terminées', () => {
  it('clôt une expérience dont la fenêtre est passée, AVEC son verdict du jour', async () => {
    const verdict = { status: 'effect', delta: -5, better: true, testCount: 4, usualCount: 4 };
    await monter(
      valeur({
        weeks: [
          { id: 'a', linkId: 'sports', weekStart: MON, state: 'adjust' },
          { id: 'b', linkId: 'recovery', weekStart: MON, state: 'holds' },
        ],
        experiments: [
          // Démarrée le 10/08 : ses quatre semaines sont passées le 24/09.
          { record: { id: 'e-1', kind: 'legs48h', startKey: '2026-08-10', schedule: ['test', 'usual', 'usual', 'test'], status: 'running' }, verdict },
          // Démarrée le 14/09 : encore en cours.
          { record: { id: 'e-2', kind: 'carbsHardDays', startKey: '2026-09-14', schedule: ['test', 'usual', 'usual', 'test'], status: 'running' }, verdict: { status: 'sealed', endKey: '2026-10-11' } },
        ],
      }),
    );

    expect(finishLabExperiment).toHaveBeenCalledTimes(1);
    expect(finishLabExperiment).toHaveBeenCalledWith('e-1', verdict);
  });
});

describe('les échecs', () => {
  it('🔴 un échec est tracé, jamais avalé en silence, et ne casse rien', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (insertWithSyncFields as jest.Mock).mockRejectedValueOnce(new Error('hors ligne'));

    await monter(valeur());

    expect(warn).toHaveBeenCalledWith('[cross-links] écriture de fond impossible', expect.any(Error));
    warn.mockRestore();
  });
});
