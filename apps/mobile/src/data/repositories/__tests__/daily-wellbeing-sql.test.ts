/**
 * US BIEN-03 / BIEN-06 — le check-in du pilier Bien-être, sur **du vrai SQLite**.
 *
 * Le pilier ajoute treize colonnes à `daily_wellbeing` (qualité de nuit, envie, quatre étiquettes,
 * quatre modules, la source de la nuit et ses bornes). Chacune doit exister dans le **schéma PowerSync
 * local** : sinon l'écriture est rejetée, et — panne du 31/07/2026 — le check-in se ferme comme s'il
 * avait été enregistré. Le test mocké (`daily-wellbeing-write.test.ts`) vérifie les colonnes envoyées ;
 * celui-ci vérifie qu'elles **arrivent**, et qu'elles se relisent à l'identique.
 */

import { getWellbeingForDay, saveWellbeing, upsertImportedNights } from '../daily-wellbeing-repository';
import { resetTestDb, rowsOf } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

function dayKeyAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const TODAY = dayKeyAgo(0);

beforeEach(() => {
  resetTestDb();
});

describe('check-in du pilier — aller-retour complet', () => {
  it('le matin puis le soir s’écrivent sur UNE ligne, et tout se relit', async () => {
    // Le matin : la nuit, sa qualité, l'énergie, l'envie.
    await saveWellbeing(TODAY, { sleepMinutes: 412, sleepQuality: 2, energy: 3, motivation: 2 });
    // Le soir : humeur, stress, étiquettes, modules.
    await saveWellbeing(TODAY, { mood: 4, stress: 4, sick: false, busyDay: true, lateNight: false, travel: true, alcoholDrinks: 2, lateCaffeine: true, napMinutes: 20, cravings: 3 });

    expect(rowsOf('daily_wellbeing')).toHaveLength(1);
    expect(await getWellbeingForDay(TODAY)).toEqual(
      expect.objectContaining({
        logDate: TODAY,
        sleepMinutes: 412,
        sleepQuality: 2,
        energy: 3,
        motivation: 2,
        mood: 4,
        stress: 4,
        sick: false,
        busyDay: true,
        lateNight: false,
        travel: true,
        alcoholDrinks: 2,
        lateCaffeine: true,
        napMinutes: 20,
        cravings: 3,
        sleepSource: 'manual',
        sleepStartAt: null,
        sleepEndAt: null,
      }),
    );
  });

  it('une ligne d’avant le pilier (colonnes nouvelles à NULL) se relit « non renseigné », pas « faux »', async () => {
    await saveWellbeing(TODAY, { mood: 3 });

    const entry = await getWellbeingForDay(TODAY);
    expect(entry).toEqual(expect.objectContaining({ mood: 3, sleepQuality: null, motivation: null, alcoholDrinks: null, lateCaffeine: null, napMinutes: null, sleepSource: null }));
    // Les étiquettes, elles, se lisent « non coché » — c'est leur sens.
    expect(entry?.sick).toBe(false);
  });
});

describe('nuit lue dans Health Connect — sur le vrai schéma', () => {
  const night = (dayKey: string, minutes: number) => ({ dayKey, minutes, startAt: '2026-09-30T21:40:00.000Z', endAt: '2026-10-01T05:10:00.000Z' });

  it('écrit la nuit, sa source et ses bornes', async () => {
    expect(await upsertImportedNights([night(TODAY, 450)], TODAY)).toBe(1);

    expect(await getWellbeingForDay(TODAY)).toEqual(
      expect.objectContaining({ sleepMinutes: 450, sleepSource: 'health_connect', sleepStartAt: '2026-09-30T21:40:00.000Z', sleepEndAt: '2026-10-01T05:10:00.000Z' }),
    );
  });

  it('🔴 une nuit corrigée à la main reste celle de l’utilisateur', async () => {
    await upsertImportedNights([night(TODAY, 450)], TODAY);
    await saveWellbeing(TODAY, { sleepMinutes: 380 });

    expect(await upsertImportedNights([night(TODAY, 470)], TODAY)).toBe(0);
    expect(await getWellbeingForDay(TODAY)).toEqual(expect.objectContaining({ sleepMinutes: 380, sleepSource: 'manual' }));
  });

  it('🔴 deux imports lancés en même temps ne créent qu’UNE ligne par matin', async () => {
    // Le retour de l'écran de permission lance l'import pendant que le réglage en lance un autre.
    // Deux lignes pour un jour : acceptées par SQLite, rejetées par l'index unique de Postgres — et
    // la file d'envoi de PowerSync, sérialisée, se figerait pour toutes les tables.
    await Promise.all([upsertImportedNights([night(TODAY, 450)], TODAY), upsertImportedNights([night(TODAY, 450)], TODAY)]);

    expect(rowsOf('daily_wellbeing')).toHaveLength(1);
  });

  it('🔴 un check-in validé pendant un import ne double pas la ligne du jour', async () => {
    await Promise.all([upsertImportedNights([night(TODAY, 450)], TODAY), saveWellbeing(TODAY, { energy: 4 })]);

    expect(rowsOf('daily_wellbeing')).toHaveLength(1);
    expect(await getWellbeingForDay(TODAY)).toEqual(expect.objectContaining({ sleepMinutes: 450, energy: 4 }));
  });

  it('une écriture refusée (hors fenêtre) ne bloque pas les suivantes', async () => {
    await expect(saveWellbeing(dayKeyAgo(9), { mood: 3 })).rejects.toThrow(/hors fenêtre/);
    expect(await saveWellbeing(TODAY, { mood: 3 })).toBe(true);
  });

  it('le check-in du matin fait APRÈS la lecture garde la nuit lue', async () => {
    await upsertImportedNights([night(TODAY, 450)], TODAY);

    // Le check-in du matin ne repose pas la question de la nuit quand elle a été lue : il n'envoie
    // donc pas `sleepMinutes`, et la nuit reste « health_connect ».
    await saveWellbeing(TODAY, { energy: 4, sleepQuality: 3 });

    expect(rowsOf('daily_wellbeing')).toHaveLength(1);
    expect(await getWellbeingForDay(TODAY)).toEqual(expect.objectContaining({ sleepMinutes: 450, sleepSource: 'health_connect', energy: 4, sleepQuality: 3 }));
  });
});
