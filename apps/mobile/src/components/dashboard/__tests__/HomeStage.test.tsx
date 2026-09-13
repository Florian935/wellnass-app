/**
 * US DASH-01 — la scène de l'accueil, testée sur son **contrat** : un moment à la fois, et ce que
 * chacun montre. Les quatre moments couvrent des heures très différentes de la journée : c'est le
 * seul endroit où l'on peut vérifier qu'ils ne se mélangent pas.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { HomeStage, type HomeScene } from '../HomeStage';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ scheme: 'light', colors: { background: '#fffaf2' } }),
}));

const afficher = async (scene: HomeScene) => {
  await render(<HomeStage scene={scene} greeting="Ta séance t'attend" dateLabel="lundi 14 septembre" />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

beforeEach(() => jest.clearAllMocks());

describe('le matin', () => {
  it('pose UNE question — l’énergie, en cinq pastilles', async () => {
    const onCheckin = jest.fn();
    await afficher({ kind: 'morning', checkinDone: false, verdict: null, onCheckin, saving: false });

    expect(screen.getByText('wellbeing.checkinPrompt')).toBeTruthy();
    const pastilles = screen.getAllByRole('radio');
    expect(pastilles).toHaveLength(5);

    await taper(pastilles[3]!);
    expect(onCheckin).toHaveBeenCalledWith(4);
  });

  it('check-in fait : la scène dit le verdict du jour, sans reposer la question', async () => {
    await afficher({
      kind: 'morning',
      checkinDone: true,
      verdict: 'push',
      onCheckin: jest.fn(),
      saving: false,
    });

    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByText('home.readiness.verdict.push.title')).toBeTruthy();
  });

  it('🔴 pendant l’enregistrement, les pastilles ne répondent plus', async () => {
    // Sans ça, cinq appuis rapides écrivent cinq fois la même journée.
    const onCheckin = jest.fn();
    await afficher({ kind: 'morning', checkinDone: false, verdict: null, onCheckin, saving: true });

    await taper(screen.getAllByRole('radio')[0]!);
    expect(onCheckin).not.toHaveBeenCalled();
  });
});

describe('le soir, série en danger', () => {
  const soir: HomeScene = {
    kind: 'evening-at-risk',
    streak: 12,
    hoursLeft: 3,
    jokersRemaining: 1,
    onSave: jest.fn(),
  };

  it('la série, le temps restant, et le joker comme filet', async () => {
    await afficher(soir);

    expect(
      screen.getByTestId('home-streak', { includeHiddenElements: true }).props.defaultValue,
    ).toBe('12');
    expect(screen.getByText('stage.home.timeLeft:{"count":3}')).toBeTruthy();
    expect(screen.getByText('stage.home.jokerLeft:{"count":1}')).toBeTruthy();
  });

  it('🔴 sans joker restant, la scène le dit — elle n’en invente pas un', async () => {
    await afficher({ ...soir, jokersRemaining: 0 });

    expect(screen.getByText('stage.home.jokerNone')).toBeTruthy();
  });
});

describe('le retour', () => {
  it('accueille et propose deux reprises, sans reproche', async () => {
    const onGentle = jest.fn();
    const onNormal = jest.fn();
    await afficher({ kind: 'comeback', bestStreak: 21, onGentle, onNormal });

    expect(screen.getByText('stage.home.comeback')).toBeTruthy();
    expect(screen.getByText('stage.home.bestStreak:{"count":21}')).toBeTruthy();

    await taper(screen.getByLabelText('stage.home.gentleRestart'));
    await taper(screen.getByLabelText('stage.home.normalPlan'));
    expect(onGentle).toHaveBeenCalledTimes(1);
    expect(onNormal).toHaveBeenCalledTimes(1);
  });
});

describe('la journée', () => {
  it('un anneau par pilier actif, chacun nommé', async () => {
    await afficher({
      kind: 'day',
      streak: 4,
      verdict: 'ok',
      rings: [
        { key: 'strength', progress: 0.5, color: '#6b0028', label: 'Muscu 2 sur 4' },
        { key: 'nutrition', progress: 0.71, color: '#52703a', label: 'Nutrition : 5 jours' },
      ],
    });

    expect(screen.getByLabelText('Muscu 2 sur 4, Nutrition : 5 jours')).toBeTruthy();
    expect(screen.getByText('home.readiness.verdict.ok.title')).toBeTruthy();
  });

  it('🔴 série à zéro : une invitation, pas un « 0 »', async () => {
    // Un grand zéro en tête d'accueil se lit comme un reproche (R8).
    await afficher({ kind: 'day', streak: 0, verdict: null, rings: [] });

    expect(screen.queryByTestId('home-streak', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByText('home.streak.empty')).toBeTruthy();
  });
});
