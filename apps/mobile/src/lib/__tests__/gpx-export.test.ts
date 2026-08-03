/**
 * Export GPX d'une course (US 5.33) — les quatre issues de l'orchestration.
 *
 * Fin du lot 3 de [strategie-tests.md](../../../../../docs/specs/technical/strategie-tests.md).
 *
 * La logique pure (`buildGpx`, `gpxFileName`, `decodeTrack`) est testée dans `@wellness/shared` ;
 * ce module ne fait que l'enchaîner avec le système de fichiers et la feuille de partage. Ce qui
 * mérite un test, c'est que **chacune des quatre issues soit la bonne** : elles produisent quatre
 * messages différents à l'écran, et confondre « trace vide » avec « échec » enverrait l'utilisateur
 * chercher une panne là où il n'a simplement rien à exporter.
 *
 * Le cas le plus vicieux est la **date de départ corrompue** : sans sa garde, `toISOString()` sur
 * un `NaN` lève, l'export part dans le `catch` générique, et l'utilisateur voit « échec » sans
 * qu'aucun retry ne puisse aboutir.
 */

import { appendToTrack, encodeSegment } from '@wellness/shared';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

import { exportRunAsGpx } from '../gpx-export';
import type { RunDetail } from '@/data/repositories/run-repository';

const writeAsStringAsync = FileSystem.writeAsStringAsync as jest.Mock;
const isAvailableAsync = Sharing.isAvailableAsync as jest.Mock;
const shareAsync = Sharing.shareAsync as jest.Mock;

/** i18n minimal : renvoie la clé, suffisant pour vérifier qu'un libellé est bien transmis. */
const t = ((key: string) => key) as never;

/**
 * Trace à deux points, construite avec **les vraies fonctions d'encodage** de `@wellness/shared`.
 *
 * Écrire le format à la main serait une double erreur : il est versionné et compressé (ce n'est
 * pas du JSON), et une trace fabriquée à côté de l'encodeur cesserait d'être représentative au
 * premier changement de format — le test continuerait de passer en testant autre chose.
 */
const TRACK = appendToTrack(
  '',
  // `t` est en **secondes** depuis le départ (cf. `GpsPoint`), pas en millisecondes.
  encodeSegment([
    { lat: 48.85, lng: 2.35, t: 0 },
    { lat: 48.86, lng: 2.36, t: 60 },
  ]),
);

/** Course GPS terminée, avec sa trace. */
const run = (over?: Partial<RunDetail>): RunDetail =>
  ({
    id: 'run-1',
    startedAt: '2026-08-03T08:00:00.000Z',
    gpsTrack: TRACK,
    ...over,
  }) as RunDetail;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  isAvailableAsync.mockResolvedValue(true);
  writeAsStringAsync.mockResolvedValue(undefined);
  shareAsync.mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('exportRunAsGpx', () => {
  it('écrit le GPX dans le cache et ouvre la feuille de partage', async () => {
    expect(await exportRunAsGpx(run(), t)).toEqual({ ok: true });

    const [uri, contenu] = writeAsStringAsync.mock.calls[0] ?? [];
    expect(uri).toMatch(/^file:\/\/\/cache\/.+\.gpx$/);
    expect(contenu).toContain('<gpx');
    expect(shareAsync).toHaveBeenCalledWith(
      uri,
      expect.objectContaining({ mimeType: 'application/gpx+xml' }),
    );
  });

  it('donne au fichier un nom daté et lisible — c’est celui que verra Strava', async () => {
    await exportRunAsGpx(run(), t);

    const uri = writeAsStringAsync.mock.calls[0]?.[0] as string;
    expect(uri).toMatch(/course-\d{4}-\d{2}-\d{2}-\d{4}\.gpx$/);
  });

  it('produit le même fichier pour la même course — un ré-export écrase au lieu d’empiler', async () => {
    await exportRunAsGpx(run(), t);
    const premier = writeAsStringAsync.mock.calls[0]?.[0];

    jest.clearAllMocks();
    await exportRunAsGpx(run(), t);

    expect(writeAsStringAsync.mock.calls[0]?.[0]).toBe(premier);
  });

  it('donne des fichiers distincts à deux courses différentes', async () => {
    await exportRunAsGpx(run(), t);
    await exportRunAsGpx(run({ startedAt: '2026-08-04T10:30:00.000Z' }), t);

    const [a, b] = writeAsStringAsync.mock.calls.map((c) => c[0]);
    expect(a).not.toBe(b);
  });

  it('renvoie « empty » sur une course SANS trace, sans rien écrire', async () => {
    expect(await exportRunAsGpx(run({ gpsTrack: null }), t)).toEqual({ error: 'empty' });

    // « Rien à exporter » n'est pas une panne : confondre les deux enverrait l'utilisateur
    // chercher un problème inexistant.
    expect(writeAsStringAsync).not.toHaveBeenCalled();
    expect(shareAsync).not.toHaveBeenCalled();
  });

  it('renvoie « empty » sur une trace vide', async () => {
    expect(await exportRunAsGpx(run({ gpsTrack: '' }), t)).toEqual({ error: 'empty' });
  });

  it('renvoie « failed » sur une date de départ corrompue, AVANT toute conversion', async () => {
    // Sans cette garde, `toISOString()` sur un NaN lève et l'export part dans le catch générique :
    // même résultat visible, mais aucun retry ne peut aboutir et rien ne dit pourquoi.
    expect(await exportRunAsGpx(run({ startedAt: 'pas-une-date' }), t)).toEqual({
      error: 'failed',
    });
    expect(writeAsStringAsync).not.toHaveBeenCalled();
  });

  it('renvoie « unavailable » quand le partage n’existe pas sur l’appareil', async () => {
    isAvailableAsync.mockResolvedValue(false);

    expect(await exportRunAsGpx(run(), t)).toEqual({ error: 'unavailable' });
    // Le fichier a bien été écrit : c'est le partage seul qui manque.
    expect(writeAsStringAsync).toHaveBeenCalled();
    expect(shareAsync).not.toHaveBeenCalled();
  });

  it('renvoie « failed » si l’écriture du fichier échoue', async () => {
    writeAsStringAsync.mockRejectedValue(new Error('disque plein'));

    expect(await exportRunAsGpx(run(), t)).toEqual({ error: 'failed' });
    expect(shareAsync).not.toHaveBeenCalled();
  });

  it('ne lève jamais, même si la feuille de partage échoue', async () => {
    shareAsync.mockRejectedValue(new Error('activité introuvable'));

    await expect(exportRunAsGpx(run(), t)).resolves.toEqual({ error: 'failed' });
  });
});
