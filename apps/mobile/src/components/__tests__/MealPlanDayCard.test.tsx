/**
 * MealPlanDayCard.test.tsx — une journée du planning repas (US REPAS-01, roadmap 4.27).
 *
 * Niveau 3 de [strategie-tests.md](../../../../../docs/specs/technical/strategie-tests.md) : les
 * **états** de l'écran, ceux qu'un test de logique pure ne voit pas.
 *
 * Ce qui est vérifié, et pourquoi :
 *  - les cases sont les repas **configurés** (R4), donc une config personnalisée doit se retrouver
 *    à l'écran — coder 4 repas en dur ferait régresser l'US 4.15, sans qu'aucun test pur le voie ;
 *  - sans profil nutritionnel, la ligne d'objectif **disparaît** au lieu d'afficher « / 0 kcal »,
 *    qui se lirait comme un dépassement permanent ;
 *  - une entrée dont le repas a été supprimé des réglages reste visible dans « Autre » (R10) ;
 *  - le bouton de portage au journal n'apparaît pas deux fois sur une entrée déjà portée (R3).
 */

import { fireEvent, render } from '@testing-library/react-native';
import type { MealConfigItem, PlannedMealEntry } from '@wellness/shared';
import { MealPlanDayCard } from '../nutrition/MealPlanDayCard';

jest.mock('@/theme/useTheme', () => ({
  useTheme: jest.fn(() => ({
    scheme: 'light',
    colors: {
      text: '#33291f',
      textMuted: '#786a59',
      background: '#f7eede',
      surface: '#fffaf2',
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      borderStrong: '#90897d',
      accent: '#b14f2b',
      accentText: '#ffffff',
      success: '#66714b',
      track: '#eadcc6',
      warn: '#f7ead6',
      warnBorder: '#e9cfa0',
      warnText: '#8a6419',
    },
  })),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

// `t` renvoie la clé (+ ses paramètres) : les assertions portent sur la clé appelée, pas sur une
// traduction qui pourrait changer sans que le comportement bouge.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key} ${JSON.stringify(opts)}` : key,
  }),
}));

function entry(over: Partial<PlannedMealEntry> = {}): PlannedMealEntry {
  return {
    id: 'e1',
    planDate: '2026-08-04',
    mealKey: 'lunch',
    orderIndex: 0,
    sourceType: 'recipe',
    recipeId: 'r1',
    templateId: null,
    servings: 2,
    label: 'Poulet riz',
    kcal: 400,
    proteinG: 30,
    carbsG: 40,
    fatG: 10,
    consumedAt: null,
    ...over,
  };
}

const CONFIG: MealConfigItem[] = [
  { key: 'breakfast', label: null },
  { key: 'lunch', label: null },
  { key: 'dinner', label: null },
];

const LABELS = { breakfast: 'Petit-déj', lunch: 'Déjeuner', dinner: 'Dîner' };

/**
 * ⚠️ `render` est **asynchrone** dans ce dépôt (les effets doivent tourner) : sans `await`, le
 * spread ne récupère aucune fonction de requête et tous les tests échouent sur
 * « getAllByLabelText is not a function ».
 */
async function setup(over: Partial<Parameters<typeof MealPlanDayCard>[0]> = {}) {
  const props = {
    dayKey: '2026-08-04',
    dayLabel: 'Mardi 4',
    isToday: false,
    entries: [entry()],
    mealConfig: CONFIG,
    mealLabels: LABELS,
    targetKcal: 2350,
    trainingBonusKcal: 0,
    onAdd: jest.fn(),
    onConsume: jest.fn(),
    onUndoConsume: jest.fn(),
    onRemove: jest.fn(),
    ...over,
  };
  return { props, ...(await render(<MealPlanDayCard {...props} />)) };
}

describe('MealPlanDayCard', () => {
  it('affiche une case par repas configuré, dans l’ordre de la config', async () => {
    const { getByText } = await setup();
    expect(getByText('Petit-déj')).toBeTruthy();
    expect(getByText('Déjeuner')).toBeTruthy();
    expect(getByText('Dîner')).toBeTruthy();
  });

  it('respecte une config personnalisée (repas renommé, ajouté, supprimé)', async () => {
    // Régression possible : 4 repas en dur ferait disparaître « Pré-workout » et réapparaître
    // « Collation », que cet utilisateur a supprimée.
    const { getByText, queryByText } = await setup({
      mealConfig: [
        { key: 'breakfast', label: 'Réveil' },
        { key: 'pre-workout', label: 'Pré-workout' },
      ],
      mealLabels: { breakfast: 'Réveil', 'pre-workout': 'Pré-workout' },
      entries: [],
    });
    expect(getByText('Réveil')).toBeTruthy();
    expect(getByText('Pré-workout')).toBeTruthy();
    expect(queryByText('Collation')).toBeNull();
  });

  it('affiche le total planifié face à l’objectif', async () => {
    const { getByText } = await setup();
    expect(getByText('400')).toBeTruthy();
    expect(getByText('2350')).toBeTruthy();
  });

  it('masque la ligne d’objectif sans profil nutritionnel — jamais « / 0 kcal »', async () => {
    const { queryByText, getByText } = await setup({ targetKcal: null });
    expect(getByText(/mealPlan\.day\.plannedOnly/)).toBeTruthy();
    expect(queryByText('2350')).toBeNull();
  });

  it('annonce le bonus des jours d’entraînement quand il s’applique', async () => {
    const { getByText } = await setup({ trainingBonusKcal: 300, targetKcal: 2650 });
    expect(getByText(/mealPlan\.day\.trainingBonus/)).toBeTruthy();
  });

  it('ne mentionne pas l’entraînement quand aucun bonus ne s’applique', async () => {
    const { queryByText } = await setup({ trainingBonusKcal: 0 });
    expect(queryByText(/mealPlan\.day\.trainingBonus/)).toBeNull();
  });

  it('range une entrée orpheline dans « Autre » plutôt que de la masquer (R10)', async () => {
    const { getByText } = await setup({ entries: [entry({ mealKey: 'snack' })] });
    expect(getByText(/mealPlan\.day\.otherMeal/)).toBeTruthy();
    expect(getByText('Poulet riz')).toBeTruthy();
  });

  it('affiche le nombre de portions d’une recette', async () => {
    const { getByText } = await setup();
    expect(getByText(/mealPlan\.entry\.servings.*"count":2/)).toBeTruthy();
  });

  it('distingue un repas type d’une recette', async () => {
    const { getByText } = await setup({
      entries: [entry({ sourceType: 'template', recipeId: null, templateId: 't1' })],
    });
    expect(getByText(/mealPlan\.entry\.template/)).toBeTruthy();
  });

  it('marque une entrée déjà portée au journal', async () => {
    const { getByText } = await setup({
      entries: [entry({ consumedAt: '2026-08-04T12:00:00.000Z' })],
    });
    expect(getByText(/mealPlan\.entry\.consumed/)).toBeTruthy();
  });

  it('propose « J’ai mangé ça » sur une entrée non portée, et l’annulation sinon', async () => {
    const notConsumed = await setup();
    expect(notConsumed.getByLabelText(/mealPlan\.entry\.consumeA11y/)).toBeTruthy();

    const consumed = await setup({ entries: [entry({ consumedAt: '2026-08-04T12:00:00.000Z' })] });
    expect(consumed.getByLabelText(/mealPlan\.entry\.undoA11y/)).toBeTruthy();
  });

  it('appelle onConsume sur une entrée non portée', async () => {
    const { props, getByLabelText } = await setup();
    fireEvent.press(getByLabelText(/mealPlan\.entry\.consumeA11y/));
    expect(props.onConsume).toHaveBeenCalledTimes(1);
    expect(props.onUndoConsume).not.toHaveBeenCalled();
  });

  it('appelle onUndoConsume sur une entrée déjà portée', async () => {
    const { props, getByLabelText } = await setup({
      entries: [entry({ consumedAt: '2026-08-04T12:00:00.000Z' })],
    });
    fireEvent.press(getByLabelText(/mealPlan\.entry\.undoA11y/));
    expect(props.onUndoConsume).toHaveBeenCalledTimes(1);
    expect(props.onConsume).not.toHaveBeenCalled();
  });

  it('appelle onRemove avec l’entrée visée', async () => {
    const { props, getByLabelText } = await setup();
    fireEvent.press(getByLabelText(/mealPlan\.entry\.removeA11y/));
    expect(props.onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
  });

  it('appelle onAdd avec la clé du repas visé', async () => {
    const { props, getAllByLabelText } = await setup({ entries: [] });
    // Un bouton « Ajouter » par repas configuré : le second est le déjeuner.
    fireEvent.press(getAllByLabelText(/mealPlan\.day\.addToMealA11y/)[1]!);
    expect(props.onAdd).toHaveBeenCalledWith('lunch');
  });

  it('reste lisible sur une journée vide', async () => {
    const { getAllByLabelText, queryByText } = await setup({ entries: [] });
    expect(getAllByLabelText(/mealPlan\.day\.addToMealA11y/)).toHaveLength(3);
    expect(queryByText('Poulet riz')).toBeNull();
  });
});
