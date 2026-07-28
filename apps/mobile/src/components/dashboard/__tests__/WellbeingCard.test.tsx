/**
 * US BIEN-01 — smoke test du widget de bien-être.
 *
 * Ce qui est vérifié, c'est le **contrat produit** de la spec : aucun état muet, une invitation quand
 * rien n'est saisi, et un affichage qui distingue un indicateur **non renseigné** (saisie partielle,
 * décision D3) d'une valeur — jamais un 0 qui laisserait croire à « très mauvais ».
 *
 * Même stratégie de mock que `StepsCard.test.tsx` : repositories, i18n, thème et icônes isolés pour
 * ne dépendre ni de PowerSync ni du natif.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

import { WellbeingCard } from '../WellbeingCard';
import {
  useTodayWellbeing,
  useWellbeingRows,
} from '@/data/repositories/daily-wellbeing-repository';

jest.mock('@/data/repositories/daily-wellbeing-repository', () => ({
  useTodayWellbeing: jest.fn(() => ({ entry: null, isLoading: false })),
  useWellbeingRows: jest.fn(() => ({ rows: [], isLoading: false })),
}));

// La feuille de saisie n'est pas l'objet de ce test : on la neutralise pour ne pas monter
// `useUnits`/`useSettings` (qui dépendent de PowerSync).
jest.mock('@/components/wellbeing/WellbeingCheckinSheet', () => ({
  WellbeingCheckinSheet: () => null,
}));

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    // Les clés sont renvoyées en sentinelle pour être cherchées dans l'arbre.
    t: (k: string) => k,
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: jest.fn(() => ({
    scheme: 'light',
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      background: '#f7eede',
      surface: '#fffaf2',
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      track: '#ece0cd',
      accent: '#c0562f',
      accentText: '#ffffff',
      success: '#7c8a5b',
      danger: '#b23b2e',
      warn: '#fbf1dd',
      warnBorder: '#b5761f',
      warnText: '#b5761f',
      panel: '#2b2018',
      panelMuted: '#8f8272',
    },
  })),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const mockToday = (entry: Record<string, unknown> | null) =>
  (useTodayWellbeing as jest.Mock).mockReturnValue({ entry, isLoading: false });

const mockRows = (rows: Record<string, unknown>[]) =>
  (useWellbeingRows as jest.Mock).mockReturnValue({ rows, isLoading: false });

const entry = (mood: number | null, energy: number | null, stress: number | null) => ({
  id: 'row-1',
  logDate: '2026-07-28',
  mood,
  energy,
  stress,
});

describe('WellbeingCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockToday(null);
    mockRows([]);
  });

  it('invite au check-in quand rien n’est saisi, plutôt que d’afficher une carte morte', async () => {
    const { getByText } = await render(<WellbeingCard size="wide" />);
    expect(getByText('wellbeing.checkinPrompt')).toBeTruthy();
    expect(getByText('wellbeing.checkinHint')).toBeTruthy();
  });

  it('affiche les 3 indicateurs du jour en forme rectangle', async () => {
    mockToday(entry(4, 3, 1));
    const { getByText } = await render(<WellbeingCard size="wide" />);
    expect(getByText('wellbeing.levels.mood.4')).toBeTruthy();
    expect(getByText('wellbeing.levels.energy.3')).toBeTruthy();
    expect(getByText('wellbeing.levels.stress.1')).toBeTruthy();
  });

  it('montre un tiret — et non un 0 — pour un indicateur non renseigné (décision D3)', async () => {
    mockToday(entry(null, 4, null));
    const { getByText, queryByText, getAllByText } = await render(<WellbeingCard size="wide" />);

    expect(getByText('wellbeing.levels.energy.4')).toBeTruthy();
    // Humeur ET stress sont nuls : deux tirets, un par indicateur manquant.
    expect(getAllByText('—')).toHaveLength(2);
    // Aucun niveau d'humeur ne doit être rendu, en particulier pas le plus bas — un 0/1 ferait
    // lire « très mauvais » là où l'utilisateur n'a simplement rien dit.
    expect(queryByText('wellbeing.levels.mood.1')).toBeNull();
  });

  it('rend un état court en forme petit carré', async () => {
    mockToday(entry(4, 3, 1));
    const { getByText } = await render(<WellbeingCard size="small" />);
    expect(getByText('wellbeing.checkinDone')).toBeTruthy();
  });

  it('ne trace pas de tendance avec un seul jour de données', async () => {
    mockToday(entry(4, 3, 1));
    mockRows([entry(4, 3, 1)]);
    const { queryAllByText } = await render(<WellbeingCard size="large" />);
    // Le libellé de la tendance n'apparaît qu'avec la sparkline (≥ 2 points) ; ici seuls les
    // libellés du trio sont présents.
    expect(queryAllByText('wellbeing.indicators.mood')).toHaveLength(1);
  });

  it('ne rend rien pendant le chargement', async () => {
    (useTodayWellbeing as jest.Mock).mockReturnValue({ entry: null, isLoading: true });
    const { toJSON } = await render(<WellbeingCard size="wide" />);
    expect(toJSON()).toBeNull();
  });
});
