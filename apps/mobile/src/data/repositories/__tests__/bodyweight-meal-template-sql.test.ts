/**
 * Pesées, repas types et profil coureur — écritures sur **du vrai SQLite**.
 *
 * Trois repositories courts, réunis parce qu'ils partagent la même famille d'invariants : ce qui
 * est **une ligne par jour**, ce qui est **un instantané**, et ce qui **remplace** au lieu de
 * s'empiler.
 *
 *  - **Une pesée par jour.** Se repeser le soir doit corriger la valeur du matin, pas créer une
 *    seconde ligne — sinon la courbe de poids affiche deux points le même jour et la progression
 *    vers l'objectif se calcule sur un historique faux. Et c'est cette table qui **ancre le poids
 *    de départ** (NUTR-11) : une ligne en trop décale la référence de toute la progression.
 *  - **Un repas type est un instantané**, comme une entrée de journal ou un ingrédient de recette.
 *    Le réappliquer trois lundis de suite doit produire trois repas identiques — pas trois
 *    références qui évolueraient ensemble.
 *  - **Réappliquer AJOUTE**, ça ne remplace pas. Un repas type appliqué sur un déjeuner déjà
 *    rempli complète la liste ; l'inverse effacerait ce que l'utilisateur venait de saisir.
 */

import { getLatestWeightKg, logWeight } from '../bodyweight-repository';
import {
  applyTemplate,
  deleteMealTemplate,
  saveMealAsTemplate,
} from '../meal-template-repository';
import { upsertRunnerProfile } from '../running-profile-repository';
import { resetTestDb, rowsOf, seed } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

jest.mock('@/lib/analytics', () => ({
  ANALYTICS_EVENTS: { foodLogged: 'food_logged' },
  track: jest.fn(async () => undefined),
}));

type WeightRow = { id: string; user_id: string; log_date: string; weight_kg: number };
type TemplateRow = { id: string; user_id: string; name: string };
type TemplateItemRow = { id: string; template_id: string; name: string; kcal: number };
type EntryRow = {
  log_date: string;
  meal_type: string;
  order_index: number;
  name: string;
  kcal: number;
};
type RunnerProfileRow = {
  id: string;
  user_id: string;
  weekly_frequency: number | null;
  ref_5k_pace_s_per_km: number | null;
};

const weights = (d = false) => rowsOf<WeightRow>('body_weight_entries', d);
const templates = (d = false) => rowsOf<TemplateRow>('meal_templates', d);
const items = (d = false) => rowsOf<TemplateItemRow>('meal_template_items', d);
const entries = () => rowsOf<EntryRow>('food_entries');
const runnerProfiles = (d = false) => rowsOf<RunnerProfileRow>('running_profiles', d);

/** Item de repas type. */
const snap = (name: string, kcal: number) => ({
  foodId: null,
  name,
  quantityG: 100,
  kcal,
  proteinG: 5,
  carbsG: 20,
  fatG: 2,
  micronutrients: {},
});

beforeEach(() => {
  resetTestDb();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Pesées
// ---------------------------------------------------------------------------

describe('logWeight', () => {
  it('enregistre la pesée du jour au nom de l’utilisateur', async () => {
    await logWeight('2026-08-01', 78.4);

    expect(weights()).toEqual([
      expect.objectContaining({ user_id: 'user-1', log_date: '2026-08-01', weight_kg: 78.4 }),
    ]);
  });

  it('🔴 CORRIGE la pesée du jour au lieu d’en créer une seconde', async () => {
    await logWeight('2026-08-01', 78.4);

    await logWeight('2026-08-01', 77.9);

    // Deux lignes le même jour afficheraient deux points sur la courbe, et fausseraient l'ancrage
    // du poids de départ (NUTR-11) — donc toute la progression vers l'objectif.
    expect(weights()).toHaveLength(1);
    expect(weights()[0]?.weight_kg).toBe(77.9);
  });

  it('garde une ligne par jour distinct', async () => {
    await logWeight('2026-08-01', 78.4);
    await logWeight('2026-08-02', 78.1);

    expect(weights()).toHaveLength(2);
  });

  it('ne ressuscite pas une pesée supprimée : elle en crée une neuve', async () => {
    seed('body_weight_entries', [
      {
        user_id: 'user-1',
        log_date: '2026-08-01',
        weight_kg: 99,
        deleted_at: new Date().toISOString(),
      },
    ]);

    await logWeight('2026-08-01', 78.4);

    expect(weights()).toHaveLength(1);
    expect(weights()[0]?.weight_kg).toBe(78.4);
  });
});

describe('getLatestWeightKg', () => {
  it('retourne la pesée la plus RÉCENTE par date, pas la dernière écrite', async () => {
    await logWeight('2026-08-05', 77.5);
    await logWeight('2026-08-01', 79); // saisie rétroactive, écrite après

    // C'est cette valeur qui ancre le poids de départ : prendre la dernière **écrite** donnerait
    // 79 kg alors que l'utilisateur pèse 77,5.
    expect(await getLatestWeightKg()).toBe(77.5);
  });

  it('ignore les pesées supprimées', async () => {
    await logWeight('2026-08-01', 79);
    seed('body_weight_entries', [
      {
        user_id: 'user-1',
        log_date: '2026-08-10',
        weight_kg: 70,
        deleted_at: new Date().toISOString(),
      },
    ]);

    expect(await getLatestWeightKg()).toBe(79);
  });

  it('renvoie null sans aucune pesée', async () => {
    expect(await getLatestWeightKg()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Repas types
// ---------------------------------------------------------------------------

describe('saveMealAsTemplate', () => {
  it('crée le modèle et ses items, nom rogné', async () => {
    const id = await saveMealAsTemplate('  Petit-déj  ', [snap('Flocons', 350), snap('Lait', 90)]);

    expect(templates()).toEqual([
      expect.objectContaining({ id, user_id: 'user-1', name: 'Petit-déj' }),
    ]);
    expect(items().map((i) => i.name)).toEqual(['Flocons', 'Lait']);
  });

  it('accepte un modèle vide plutôt que d’échouer', async () => {
    const id = await saveMealAsTemplate('Vide', []);

    expect(templates().find((t) => t.id === id)).toBeDefined();
    expect(items()).toHaveLength(0);
  });
});

describe('applyTemplate', () => {
  /** Un repas type à deux items. */
  const seedTemplate = () =>
    saveMealAsTemplate('Petit-déj', [snap('Flocons', 350), snap('Lait', 90)]);

  it('ajoute tous les items au repas visé', async () => {
    const templateId = await seedTemplate();

    await applyTemplate(templateId, '2026-08-01', 'breakfast');

    expect(entries().map((e) => e.name).sort()).toEqual(['Flocons', 'Lait']);
    expect(entries().every((e) => e.log_date === '2026-08-01')).toBe(true);
    expect(entries().every((e) => e.meal_type === 'breakfast')).toBe(true);
  });

  it('🔴 AJOUTE au repas existant — il ne le remplace pas', async () => {
    const templateId = await seedTemplate();
    seed('food_entries', [
      {
        user_id: 'user-1',
        log_date: '2026-08-01',
        meal_type: 'breakfast',
        order_index: 0,
        name: 'Café',
        quantity_g: 200,
        kcal: 5,
      },
    ]);

    await applyTemplate(templateId, '2026-08-01', 'breakfast');

    // Remplacer effacerait ce que l'utilisateur venait de saisir, sans confirmation.
    expect(entries()).toHaveLength(3);
    expect(entries().map((e) => e.name)).toContain('Café');
  });

  it('numérote à la suite du repas existant', async () => {
    const templateId = await seedTemplate();
    seed('food_entries', [
      {
        user_id: 'user-1',
        log_date: '2026-08-01',
        meal_type: 'breakfast',
        order_index: 0,
        name: 'Café',
        quantity_g: 200,
        kcal: 5,
      },
    ]);

    await applyTemplate(templateId, '2026-08-01', 'breakfast');

    expect(entries().map((e) => e.order_index).sort()).toEqual([0, 1, 2]);
  });

  it('copie un INSTANTANÉ — réappliquer deux fois donne deux repas indépendants', async () => {
    const templateId = await seedTemplate();
    await applyTemplate(templateId, '2026-08-01', 'breakfast');

    await applyTemplate(templateId, '2026-08-08', 'breakfast');

    // Chaque application est un repas à part entière : modifier l'un ne doit pas toucher l'autre.
    expect(entries().filter((e) => e.log_date === '2026-08-01')).toHaveLength(2);
    expect(entries().filter((e) => e.log_date === '2026-08-08')).toHaveLength(2);
  });

  it('ne recopie pas un item supprimé du modèle', async () => {
    const templateId = await seedTemplate();
    seed('meal_template_items', [
      {
        template_id: templateId,
        user_id: 'user-1',
        name: 'Retiré',
        quantity_g: 100,
        kcal: 200,
        deleted_at: new Date().toISOString(),
      },
    ]);

    await applyTemplate(templateId, '2026-08-01', 'breakfast');

    expect(entries()).toHaveLength(2);
  });

  it('ne fait rien pour un modèle inconnu', async () => {
    await expect(applyTemplate('inconnu', '2026-08-01', 'breakfast')).resolves.toBeUndefined();
    expect(entries()).toHaveLength(0);
  });
});

describe('deleteMealTemplate', () => {
  it('supprime le modèle en douceur, sans toucher aux repas déjà appliqués', async () => {
    const templateId = await saveMealAsTemplate('Petit-déj', [snap('Flocons', 350)]);
    await applyTemplate(templateId, '2026-08-01', 'breakfast');

    await deleteMealTemplate(templateId);

    expect(templates()).toHaveLength(0);
    expect(templates(true)).toHaveLength(1);
    // Le repas du 1ᵉʳ août reste au journal : c'est un fait, pas une référence.
    expect(entries()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Profil coureur
// ---------------------------------------------------------------------------

describe('upsertRunnerProfile', () => {
  it('crée la ligne au nom de l’utilisateur courant', async () => {
    await upsertRunnerProfile({ weeklyFrequency: 3 });

    expect(runnerProfiles()).toEqual([
      expect.objectContaining({ user_id: 'user-1', weekly_frequency: 3 }),
    ]);
  });

  it('met à jour sans créer de doublon', async () => {
    await upsertRunnerProfile({ weeklyFrequency: 3 });

    await upsertRunnerProfile({ weeklyFrequency: 4 });

    expect(runnerProfiles()).toHaveLength(1);
    expect(runnerProfiles()[0]?.weekly_frequency).toBe(4);
  });

  it('n’écrit QUE les clés fournies', async () => {
    await upsertRunnerProfile({ weeklyFrequency: 3, ref5kPaceSPerKm: 300 });

    await upsertRunnerProfile({ ref5kPaceSPerKm: 290 });

    // L'allure de référence est mise à jour par la détection de records : elle ne doit pas
    // écraser la fréquence hebdomadaire saisie à la main au passage.
    expect(runnerProfiles()[0]).toMatchObject({ weekly_frequency: 3, ref_5k_pace_s_per_km: 290 });
  });

  it('ne ressuscite pas un profil supprimé : il en crée un neuf', async () => {
    seed('running_profiles', [
      { user_id: 'user-1', weekly_frequency: 9, deleted_at: new Date().toISOString() },
    ]);

    await upsertRunnerProfile({ weeklyFrequency: 3 });

    expect(runnerProfiles()).toHaveLength(1);
    expect(runnerProfiles()[0]?.weekly_frequency).toBe(3);
  });
});
