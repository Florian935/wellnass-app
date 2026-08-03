/**
 * Export RGPD (US CONF-01) — complétude de la liste des tables et branches d'orchestration.
 *
 * Fin du lot 3 de [strategie-tests.md](../../../../../docs/specs/technical/strategie-tests.md).
 *
 * **Le test qui compte ici est celui de complétude.** Une table de données personnelles ajoutée au
 * schéma mais oubliée dans `EXPORT_TABLES` ne provoque aucune erreur : l'export « réussit », le
 * fichier se télécharge, et il manque simplement des données. Ce n'est pas une finition oubliée,
 * c'est un manquement au droit à la portabilité — et rien dans l'app ne le signale.
 *
 * C'est exactement ce qui s'était produit : `session_intervals` (US RUN-F2c) n'avait jamais été
 * ajoutée, donc un programme fractionné personnel s'exportait avec ses séances mais **sans leur
 * contenu**. Trouvé en écrivant ce fichier, corrigé dans la foulée.
 *
 * Le reste couvre les trois issues de l'orchestration (`ok` / `unavailable` / `failed`), qui
 * produisent chacune un message différent à l'écran.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { AppSchema } from '@/powersync/schema';
import { powerSync } from '@/powersync/system';

const mockTrack = jest.fn(async () => undefined);

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

jest.mock('@/lib/analytics', () => ({
  ANALYTICS_EVENTS: { dataExported: 'data_exported' },
  track: (...args: unknown[]) => mockTrack(...(args as [])),
}));

import { EXPORT_EXCLUSIONS, EXPORT_TABLES, exportUserData } from '../data-export';

const getAll = powerSync.getAll as jest.Mock;
const writeAsStringAsync = FileSystem.writeAsStringAsync as jest.Mock;
const isAvailableAsync = Sharing.isAvailableAsync as jest.Mock;
const shareAsync = Sharing.shareAsync as jest.Mock;

/** i18n minimal : renvoie la clé, suffisant pour vérifier qu'un titre est bien transmis. */
const t = ((key: string) => key) as never;

const USER_ID = 'user-1';

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  getAll.mockResolvedValue([]);
  isAvailableAsync.mockResolvedValue(true);
  writeAsStringAsync.mockResolvedValue(undefined);
  shareAsync.mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

// ---------------------------------------------------------------------------
// Complétude — le garde-fou RGPD
// ---------------------------------------------------------------------------

describe('complétude de l’export', () => {
  /** Noms des tables déclarées au schéma PowerSync de l'app. */
  const schemaTables = Object.keys(
    (AppSchema as unknown as { tables?: Record<string, unknown> }).tables ??
      (AppSchema as unknown as Record<string, unknown>),
  );

  it('couvre TOUTES les tables du schéma, ou les exclut explicitement', () => {
    const exported = new Set(EXPORT_TABLES.map((e) => e.table));
    const oublies = schemaTables.filter(
      (table) => !exported.has(table) && !(table in EXPORT_EXCLUSIONS),
    );

    // Si ce test rougit après l'ajout d'une table : soit elle contient des données personnelles et
    // doit rejoindre `EXPORT_TABLES`, soit non et il faut le DIRE dans `EXPORT_EXCLUSIONS` avec la
    // raison. Le silence n'est pas une option — l'export réussirait en omettant les données.
    expect(oublies).toEqual([]);
  });

  it('n’exporte aucune table absente du schéma', () => {
    const inconnues = EXPORT_TABLES.map((e) => e.table).filter((t2) => !schemaTables.includes(t2));

    // Une table renommée en migration sans mise à jour d'ici ferait échouer l'export en entier.
    expect(inconnues).toEqual([]);
  });

  it('n’exclut que des tables qui existent — pas d’exclusion périmée', () => {
    const fantomes = Object.keys(EXPORT_EXCLUSIONS).filter((t2) => !schemaTables.includes(t2));

    expect(fantomes).toEqual([]);
  });

  it('exporte les blocs fractionné avec le reste d’un programme personnel (US RUN-F2c)', () => {
    // Non-régression de l'oubli trouvé le 03/08/2026 : `sessions` et `exercise_plans` étaient
    // exportés, `session_intervals` non — le contenu d'un programme fractionné disparaissait.
    expect(EXPORT_TABLES).toContainEqual({ table: 'session_intervals', col: 'owner_id' });
  });

  it('ne liste aucune table deux fois', () => {
    const noms = EXPORT_TABLES.map((e) => e.table);

    expect(new Set(noms).size).toBe(noms.length);
  });

  it('documente chaque exclusion par une raison non vide', () => {
    for (const [table, raison] of Object.entries(EXPORT_EXCLUSIONS)) {
      expect(raison.trim().length).toBeGreaterThan(0);
      expect(table).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

describe('lecture des données', () => {
  it('interroge chaque table déclarée, filtrée sur le propriétaire et hors supprimées', async () => {
    await exportUserData(USER_ID, true, t);

    expect(getAll).toHaveBeenCalledTimes(EXPORT_TABLES.length);
    for (const { table, col } of EXPORT_TABLES) {
      expect(getAll).toHaveBeenCalledWith(
        `SELECT * FROM ${table} WHERE ${col} = ? AND deleted_at IS NULL`,
        [USER_ID],
      );
    }
  });

  it('n’exporte que les données de CET utilisateur', async () => {
    await exportUserData(USER_ID, true, t);

    expect(getAll.mock.calls.every((c) => c[1]?.[0] === USER_ID)).toBe(true);
  });

  it('écrit une enveloppe JSON lisible portant l’utilisateur et l’état de synchro', async () => {
    await exportUserData(USER_ID, false, t);

    const [uri, contenu] = writeAsStringAsync.mock.calls[0] ?? [];
    expect(uri).toMatch(/^file:\/\/\/cache\/.+\.json$/);
    const envelope = JSON.parse(contenu as string);
    expect(envelope).toMatchObject({ userId: USER_ID, syncComplete: false });
  });

  it('signale une synchro incomplète — l’export peut ne pas tout contenir', async () => {
    await exportUserData(USER_ID, false, t);
    const incomplet = JSON.parse(writeAsStringAsync.mock.calls[0]?.[1] as string);

    jest.clearAllMocks();
    await exportUserData(USER_ID, true, t);
    const complet = JSON.parse(writeAsStringAsync.mock.calls[0]?.[1] as string);

    expect(incomplet.syncComplete).toBe(false);
    expect(complet.syncComplete).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Issues de l'orchestration
// ---------------------------------------------------------------------------

describe('issues', () => {
  it('ouvre la feuille de partage et journalise en cas de succès', async () => {
    expect(await exportUserData(USER_ID, true, t)).toEqual({ ok: true });

    expect(shareAsync).toHaveBeenCalledWith(
      expect.stringContaining('file:///cache/'),
      expect.objectContaining({ mimeType: 'application/json' }),
    );
    expect(mockTrack).toHaveBeenCalled();
  });

  it('renvoie « unavailable » quand le partage n’existe pas sur l’appareil', async () => {
    isAvailableAsync.mockResolvedValue(false);

    expect(await exportUserData(USER_ID, true, t)).toEqual({ error: 'unavailable' });
    expect(shareAsync).not.toHaveBeenCalled();
    // Rien n'a été partagé : ne pas compter un export réussi.
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('renvoie « failed » si une lecture échoue, sans rien écrire', async () => {
    getAll.mockRejectedValue(new Error('base verrouillée'));

    expect(await exportUserData(USER_ID, true, t)).toEqual({ error: 'failed' });
    expect(writeAsStringAsync).not.toHaveBeenCalled();
  });

  it('renvoie « failed » si l’écriture du fichier échoue', async () => {
    writeAsStringAsync.mockRejectedValue(new Error('disque plein'));

    expect(await exportUserData(USER_ID, true, t)).toEqual({ error: 'failed' });
    expect(shareAsync).not.toHaveBeenCalled();
  });

  it('ne lève jamais — l’écran doit pouvoir afficher un message', async () => {
    shareAsync.mockRejectedValue(new Error('annulé par le système'));

    await expect(exportUserData(USER_ID, true, t)).resolves.toEqual({ error: 'failed' });
  });
});
