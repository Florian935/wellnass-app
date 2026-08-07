/**
 * US ALLURE-01 — la requête de polarisation, exécutée sur **du vrai SQLite**.
 *
 * Le moteur est testé à 100 % dans `@wellness/shared` ; ce qu'il ne peut pas prouver, c'est **ce qu'on
 * lui donne à manger**.
 *
 * Deux propriétés portent tout ici, et aucune n'est du calcul :
 *  - 🔴 **`SELECT_HISTORY` ne doit PAS gagner `gps_track`.** C'est la tentation évidente — l'historique
 *    ramène déjà les courses, pourquoi une seconde requête ? Parce que `SELECT_HISTORY` n'a **aucune
 *    borne de date** et alimente les statistiques, la tendance d'allure et l'accueil : y ajouter la
 *    trace ferait charger **les traces GPS de toutes les courses de l'utilisateur** pour tous ces
 *    consommateurs, alors qu'un seul en a besoin. La régression serait **invisible en recette** et
 *    s'aggraverait avec l'historique. Un test garde cette porte fermée ;
 *  - **la fenêtre et les filtres** : une course hors fenêtre, non terminée, supprimée ou **sans trace**
 *    ne doit pas entrer. La dernière compte : une course saisie à la main n'a rien à analyser, et
 *    l'exclure en SQL évite de la compter comme « course ignorée » côté moteur.
 */

import { SELECT_HISTORY_FOR_TEST, SELECT_RUNS_WITH_TRACK_SINCE } from '../run-repository';
import { resetTestDb, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

const ME = 'user-1';
const WINDOW_START = '2026-07-10T00:00:00Z';
const IN_WINDOW = '2026-07-20T10:00:00Z';
const BEFORE_WINDOW = '2026-05-01T10:00:00Z';

/** Une trace encodée quelconque — le contenu importe peu, seule sa présence est testée ici. */
const TRACK = 'encoded-track';

function seedRun(opts: {
  id: string;
  gpsTrack?: string | null;
  finishedAt?: string;
  status?: string;
  source?: string;
}) {
  seed('runs', [
    {
      id: opts.id,
      user_id: ME,
      source: opts.source ?? 'gps',
      status: opts.status ?? 'completed',
      started_at: opts.finishedAt ?? IN_WINDOW,
      finished_at: opts.finishedAt ?? IN_WINDOW,
      gps_track: opts.gpsTrack === undefined ? TRACK : opts.gpsTrack,
      distance_m: 10000,
      duration_seconds: 3000,
    },
  ]);
}

const tracks = () =>
  testPowerSync.getAll<{ gps_track: string | null }>(SELECT_RUNS_WITH_TRACK_SINCE, [WINDOW_START]);

beforeEach(() => {
  resetTestDb();
});

describe('SELECT_RUNS_WITH_TRACK_SINCE — la fenêtre et les filtres', () => {
  it('remonte la trace d’une course terminée dans la fenêtre', async () => {
    seedRun({ id: 'r1' });
    expect(await tracks()).toEqual([{ gps_track: TRACK }]);
  });

  it('exclut une course antérieure à la fenêtre', async () => {
    seedRun({ id: 'vieille', finishedAt: BEFORE_WINDOW });
    expect(await tracks()).toEqual([]);
  });

  it('exclut une course non terminée', async () => {
    seedRun({ id: 'encours', status: 'active' });
    expect(await tracks()).toEqual([]);
  });

  it('🔴 exclut une course SANS trace — saisie à la main, rien à analyser (R7)', async () => {
    // L'exclure en SQL plutôt que côté moteur évite de la compter comme « course ignorée », ce qui
    // ferait mentir le `runCount` affiché.
    seedRun({ id: 'manuelle', source: 'manual', gpsTrack: null });
    expect(await tracks()).toEqual([]);
  });

  it('exclut une course supprimée', async () => {
    seedRun({ id: 'r1' });
    await testPowerSync.execute(
      `UPDATE runs SET deleted_at = '2026-07-21T00:00:00Z' WHERE id = 'r1'`,
    );
    expect(await tracks()).toEqual([]);
  });

  it('rend les courses du plus ancien au plus récent', async () => {
    seedRun({ id: 'recente', gpsTrack: 'b', finishedAt: '2026-07-25T10:00:00Z' });
    seedRun({ id: 'ancienne', gpsTrack: 'a', finishedAt: '2026-07-12T10:00:00Z' });
    expect((await tracks()).map((r) => r.gps_track)).toEqual(['a', 'b']);
  });

  it('ne ramène QUE la trace — rien d’autre à décoder ni à transporter', async () => {
    seedRun({ id: 'r1' });
    expect(Object.keys((await tracks())[0]!)).toEqual(['gps_track']);
  });
});

describe('🔴 SELECT_HISTORY reste sans trace GPS', () => {
  it('ne ramène PAS gps_track — sinon toutes les traces seraient chargées partout', async () => {
    // Le test qui garde la porte fermée. `SELECT_HISTORY` n'a aucune borne de date et alimente les
    // stats, la tendance d'allure et l'accueil : une trace ajoutée ici se paierait sur chacun d'eux,
    // sans qu'aucun test fonctionnel ne le voie.
    seedRun({ id: 'r1' });
    const rows = await testPowerSync.getAll<Record<string, unknown>>(SELECT_HISTORY_FOR_TEST);
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]!)).not.toContain('gps_track');
  });

  it('n’a pas non plus de borne de date — c’est précisément pourquoi elle doit rester légère', async () => {
    seedRun({ id: 'ancienne', finishedAt: '2020-01-01T10:00:00Z' });
    const rows = await testPowerSync.getAll<Record<string, unknown>>(SELECT_HISTORY_FOR_TEST);
    expect(rows).toHaveLength(1);
  });
});
