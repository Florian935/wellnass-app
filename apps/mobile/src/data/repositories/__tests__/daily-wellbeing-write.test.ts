/**
 * US BIEN-01 — écritures du repository du check-in de bien-être.
 *
 * Les **règles** (échelle valide, check-in vide, fenêtre de rattrapage) sont déjà couvertes par
 * `wellbeing.ts` dans `@wellness/shared` ; ce qui est testé ici est la **plomberie** : les bonnes
 * colonnes à l'insertion, le bon `id` au patch, le refus d'un check-in vide, et surtout le fait
 * qu'un second enregistrement le même jour **met à jour** au lieu de créer un doublon — le scénario
 * que la spec veut voir en recette (critère 2), vérifié ici sans device.
 */

import { saveWellbeing, upsertImportedNights } from '../daily-wellbeing-repository';
import { insertWithSyncFields, patch } from '../_sql';
import { powerSync } from '@/powersync/system';

jest.mock('@/powersync/system', () => ({
  powerSync: { getAll: jest.fn(), getOptional: jest.fn() },
}));

jest.mock('../_sql', () => ({
  insertWithSyncFields: jest.fn(async () => 'new-id'),
  patch: jest.fn(async () => undefined),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

const getOptional = powerSync.getOptional as jest.Mock;

/** Clé du jour courant, calculée comme le repository (localDayKey sur maintenant). */
function todayKey(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Jour à J-n, dans le même référentiel local. */
function dayKeyAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

describe('saveWellbeing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getOptional.mockResolvedValue(null);
  });

  it('insère un check-in complet avec le propriétaire et les 3 indicateurs', async () => {
    const written = await saveWellbeing(todayKey(), { mood: 4, energy: 3, stress: 1 });

    expect(written).toBe(true);
    expect(insertWithSyncFields).toHaveBeenCalledWith('daily_wellbeing', {
      user_id: 'user-1',
      log_date: todayKey(),
      mood: 4,
      energy: 3,
      stress: 1,
      sleep_minutes: null,
    });
    expect(patch).not.toHaveBeenCalled();
  });

  it('accepte un check-in partiel : les indicateurs absents partent à null (décision D3)', async () => {
    await saveWellbeing(todayKey(), { energy: 3 });

    expect(insertWithSyncFields).toHaveBeenCalledWith('daily_wellbeing', {
      user_id: 'user-1',
      log_date: todayKey(),
      mood: null,
      energy: 3,
      stress: null,
      sleep_minutes: null,
    });
  });

  it('MET À JOUR la ligne du jour au lieu de créer un doublon', async () => {
    getOptional.mockResolvedValue({ id: 'row-1' });

    const written = await saveWellbeing(todayKey(), { mood: 5, energy: 4, stress: 2 });

    expect(written).toBe(true);
    expect(patch).toHaveBeenCalledWith('daily_wellbeing', 'row-1', { mood: 5, energy: 4, stress: 2 });
    expect(insertWithSyncFields).not.toHaveBeenCalled();
  });

  it('🔴 une mise à jour PARTIELLE n’efface pas ce qu’elle ne porte pas', async () => {
    getOptional.mockResolvedValue({ id: 'row-1' });

    // Le widget « énergie » de l'accueil envoie ce seul champ. Avant correctif, les trois autres
    // colonnes repartaient à `null` : la nuit saisie au réveil était effacée au premier tap depuis
    // l'accueil, sans le moindre signal — et avec elle l'anneau des nuits, la proposition « nuit
    // courte » et l'adhérence d'une expérience de sommeil en cours.
    await saveWellbeing(todayKey(), { energy: 4 });

    expect(patch).toHaveBeenCalledWith('daily_wellbeing', 'row-1', { energy: 4 });
  });

  it('effacer volontairement reste possible : une clé présente à null remet la colonne à null', async () => {
    getOptional.mockResolvedValue({ id: 'row-1' });

    // C'est ce qu'envoie la feuille de check-in quand on retape un niveau déjà choisi pour le retirer.
    await saveWellbeing(todayKey(), { mood: null, energy: 3, stress: null });

    expect(patch).toHaveBeenCalledWith('daily_wellbeing', 'row-1', { mood: null, energy: 3, stress: null });
  });

  it('US LABO-01 : écrit la nuit, seule ou avec les indicateurs, et écarte une durée impossible', async () => {
    await saveWellbeing(todayKey(), { sleepMinutes: 405 });
    expect(insertWithSyncFields).toHaveBeenCalledWith('daily_wellbeing', {
      user_id: 'user-1',
      log_date: todayKey(),
      mood: null,
      energy: null,
      stress: null,
      sleep_minutes: 405,
      // US BIEN-06 : une nuit saisie à la main est marquée comme telle — une lecture Health Connect
      // ne l'écrasera jamais.
      sleep_source: 'manual',
    });

    getOptional.mockResolvedValue({ id: 'row-1' });
    await saveWellbeing(todayKey(), { energy: 2, sleepMinutes: 2000 });
    expect(patch).toHaveBeenCalledWith('daily_wellbeing', 'row-1', {
      energy: 2,
      sleep_minutes: null,
      sleep_source: null,
      sleep_start_at: null,
      sleep_end_at: null,
    });
  });

  it('US BIEN-03 : écrit la qualité de nuit, l’envie, les étiquettes et les modules', async () => {
    await saveWellbeing(todayKey(), { sleepQuality: 2, motivation: 4, sick: true, travel: false, alcoholDrinks: 2, lateCaffeine: true, napMinutes: 20, cravings: 3 });
    expect(insertWithSyncFields).toHaveBeenCalledWith('daily_wellbeing', {
      user_id: 'user-1',
      log_date: todayKey(),
      mood: null,
      energy: null,
      stress: null,
      sleep_minutes: null,
      sleep_quality: 2,
      motivation: 4,
      cravings: 3,
      sick: 1,
      travel: 0,
      alcohol_drinks: 2,
      late_caffeine: 1,
      nap_minutes: 20,
    });
  });

  it('US BIEN-03 : sur une ligne existante, décocher « malade » s’écrit — même sans autre champ', async () => {
    getOptional.mockResolvedValue({ id: 'row-1' });
    const written = await saveWellbeing(todayKey(), { sick: false });
    expect(written).toBe(true);
    expect(patch).toHaveBeenCalledWith('daily_wellbeing', 'row-1', { sick: 0 });
  });

  it('US BIEN-03 : une étiquette décochée seule ne CRÉE pas de ligne', async () => {
    expect(await saveWellbeing(todayKey(), { sick: false })).toBe(false);
    expect(insertWithSyncFields).not.toHaveBeenCalled();
  });

  it('n’écrit rien pour un check-in vide plutôt que de créer une ligne inutile', async () => {
    const written = await saveWellbeing(todayKey(), {});

    expect(written).toBe(false);
    expect(insertWithSyncFields).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });

  it('traite une valeur hors échelle comme absente, et refuse donc le check-in', async () => {
    const written = await saveWellbeing(todayKey(), { mood: 9 });

    expect(written).toBe(false);
    expect(insertWithSyncFields).not.toHaveBeenCalled();
  });

  it('accepte le rattrapage jusqu’à J-6', async () => {
    await saveWellbeing(dayKeyAgo(6), { mood: 3 });
    expect(insertWithSyncFields).toHaveBeenCalled();
  });

  it('refuse J-7 et le futur, en levant plutôt qu’en échouant en silence', async () => {
    await expect(saveWellbeing(dayKeyAgo(7), { mood: 3 })).rejects.toThrow(/hors fenêtre/);
    await expect(saveWellbeing(dayKeyAgo(-1), { mood: 3 })).rejects.toThrow(/hors fenêtre/);
    expect(insertWithSyncFields).not.toHaveBeenCalled();
  });
});

/**
 * US BIEN-06 — la nuit lue dans Health Connect (décision D3 du 01/10/2026).
 *
 * La règle qui compte ici : **une nuit saisie à la main n'est jamais écrasée**. Une montre qui se
 * trompe (sieste comptée, montre retirée à 4 h) ne doit pas réécrire ce que l'utilisateur a corrigé.
 */
describe('upsertImportedNights', () => {
  const night = (dayKey: string, minutes = 432) => ({ dayKey, minutes, startAt: `${dayKey}T00:10:00.000Z`, endAt: `${dayKey}T07:22:00.000Z` });

  beforeEach(() => {
    jest.clearAllMocks();
    getOptional.mockResolvedValue(null);
  });

  it('crée la ligne du matin quand rien n’existe, marquée « health_connect »', async () => {
    const written = await upsertImportedNights([night(todayKey())], todayKey());

    expect(written).toBe(1);
    expect(insertWithSyncFields).toHaveBeenCalledWith('daily_wellbeing', {
      user_id: 'user-1',
      log_date: todayKey(),
      mood: null,
      energy: null,
      stress: null,
      sleep_minutes: 432,
      sleep_source: 'health_connect',
      sleep_start_at: `${todayKey()}T00:10:00.000Z`,
      sleep_end_at: `${todayKey()}T07:22:00.000Z`,
    });
  });

  it('complète un check-in du matin sans nuit : la ligne existante est patchée, pas doublée', async () => {
    getOptional.mockResolvedValue({ id: 'row-1', mood: 3, energy: 4, stress: 2, sleep_minutes: null, sleep_source: null });

    expect(await upsertImportedNights([night(todayKey())], todayKey())).toBe(1);
    expect(insertWithSyncFields).not.toHaveBeenCalled();
    expect(patch).toHaveBeenCalledWith('daily_wellbeing', 'row-1', expect.objectContaining({ sleep_minutes: 432, sleep_source: 'health_connect' }));
  });

  it('🔴 n’écrase JAMAIS une nuit saisie à la main', async () => {
    getOptional.mockResolvedValue({ id: 'row-1', sleep_minutes: 400, sleep_source: 'manual' });

    expect(await upsertImportedNights([night(todayKey(), 510)], todayKey())).toBe(0);
    expect(patch).not.toHaveBeenCalled();
    expect(insertWithSyncFields).not.toHaveBeenCalled();
  });

  it('met à jour une nuit déjà lue quand la montre l’a corrigée', async () => {
    getOptional.mockResolvedValue({ id: 'row-1', sleep_minutes: 380, sleep_source: 'health_connect', sleep_start_at: `${todayKey()}T00:10:00.000Z` });

    expect(await upsertImportedNights([night(todayKey(), 432)], todayKey())).toBe(1);
    expect(patch).toHaveBeenCalledWith('daily_wellbeing', 'row-1', expect.objectContaining({ sleep_minutes: 432 }));
  });

  it('ne réécrit pas une nuit identique (aucune synchro pour rien)', async () => {
    getOptional.mockResolvedValue({ id: 'row-1', sleep_minutes: 432, sleep_source: 'health_connect', sleep_start_at: `${todayKey()}T00:10:00.000Z` });

    expect(await upsertImportedNights([night(todayKey())], todayKey())).toBe(0);
    expect(patch).not.toHaveBeenCalled();
  });

  it('ignore les matins hors de la fenêtre de saisie (J-7 et au-delà) : l’historique ne bouge pas', async () => {
    const written = await upsertImportedNights([night(dayKeyAgo(9)), night(dayKeyAgo(7)), night(dayKeyAgo(6))], todayKey());

    expect(written).toBe(1);
    expect(insertWithSyncFields).toHaveBeenCalledTimes(1);
    expect(insertWithSyncFields).toHaveBeenCalledWith('daily_wellbeing', expect.objectContaining({ log_date: dayKeyAgo(6) }));
  });
});
