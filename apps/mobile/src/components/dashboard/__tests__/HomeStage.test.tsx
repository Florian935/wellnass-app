/**
 * US DASH-01 — la scène de l'accueil, testée sur son **contrat** : un moment à la fois, et ce que
 * chacun montre. Les quatre moments couvrent des heures très différentes de la journée : c'est le
 * seul endroit où l'on peut vérifier qu'ils ne se mélangent pas.
 *
 * US ACCUEIL-07 — la salutation et la phrase du jour en tête, les visages du check-in, les vrais
 * gestes pour sauver la série, et la reprise en douceur qui ne mène plus nulle part.
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
  await render(
    <HomeStage
      scene={scene}
      greeting="Bonjour Florian"
      sentence="Il te reste 1 450 kcal aujourd'hui."
      dateLabel="lundi 14 septembre"
      glowMoment="jour"
    />,
  );
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

beforeEach(() => jest.clearAllMocks());

describe('l’en-tête (constat 6)', () => {
  it('🔴 la salutation est le titre, la phrase du jour la suit — deux textes distincts', async () => {
    await afficher({ kind: 'day', streak: 4, verdict: null, rings: [] });

    expect(screen.getByRole('header').props.children).toBe('Bonjour Florian');
    expect(screen.getByText("Il te reste 1 450 kcal aujourd'hui.")).toBeTruthy();
  });

  it('pose les lueurs d’Aurore sous le contenu', async () => {
    await afficher({ kind: 'day', streak: 4, verdict: null, rings: [] });
    expect(screen.getByTestId('aurora-glows')).toBeTruthy();
  });
});

describe('le matin', () => {
  it('pose UNE question — l’énergie, en cinq visages', async () => {
    const onCheckin = jest.fn();
    await afficher({ kind: 'morning', checkinDone: false, verdict: null, onCheckin, saving: false });

    expect(screen.getByText('home.checkin.title')).toBeTruthy();
    const pastilles = screen.getAllByRole('radio');
    expect(pastilles).toHaveLength(5);

    await taper(pastilles[3]!);
    expect(onCheckin).toHaveBeenCalledWith(4);
  });

  it('🔴 chaque visage porte son mot à l’écran — plus « 1 2 3 4 5 » (constat 9)', async () => {
    await afficher({ kind: 'morning', checkinDone: false, verdict: null, onCheckin: jest.fn(), saving: false });

    for (const level of [1, 2, 3, 4, 5]) {
      expect(screen.getByText(`wellbeing.levels.energy.${level}`)).toBeTruthy();
    }
    expect(screen.queryByText('1')).toBeNull();
    // L'indication annonce ce qui est demandé : l'énergie, pas « humeur, énergie, stress ».
    expect(screen.getByText('home.checkin.hint')).toBeTruthy();
    expect(screen.queryByText('wellbeing.checkinHint')).toBeNull();
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

describe('le soir, série en danger (constat 5)', () => {
  const handlers = { onWalk: jest.fn(), onActivity: jest.fn(), onJoker: jest.fn() };
  const soir: HomeScene = {
    kind: 'evening-at-risk',
    streak: 12,
    hoursLeft: 3,
    rescue: [{ kind: 'walk', stepsLeft: 1900, minutes: 20 }, { kind: 'activity' }, { kind: 'joker' }],
    ...handlers,
    busy: false,
    formatSteps: (n: number) => `${n}`,
  };

  it('la série, le temps restant, et les trois vrais gestes', async () => {
    await afficher(soir);

    expect(
      screen.getByTestId('home-streak', { includeHiddenElements: true }).props.defaultValue,
    ).toBe('12');
    expect(screen.getByText('stage.home.timeLeft:{"count":3}')).toBeTruthy();
    expect(screen.getByText('stage.home.rescue.walk:{"minutes":20}')).toBeTruthy();
    expect(screen.getByText('stage.home.rescue.walkSub:{"steps":"1900"}')).toBeTruthy();

    await taper(screen.getByTestId('streak-rescue-walk'));
    await taper(screen.getByTestId('streak-rescue-activity'));
    await taper(screen.getByTestId('streak-rescue-joker'));
    expect(handlers.onWalk).toHaveBeenCalledTimes(1);
    expect(handlers.onActivity).toHaveBeenCalledTimes(1);
    expect(handlers.onJoker).toHaveBeenCalledTimes(1);
  });

  it('🔴 plus de « Sauver ma série » qui ouvrait le planning', async () => {
    await afficher(soir);
    expect(screen.queryByText('stage.home.saveStreak')).toBeNull();
  });

  it('n’affiche que les sorties proposées — sans joker, pas de joker', async () => {
    await afficher({ ...soir, rescue: [{ kind: 'activity' }] });
    expect(screen.queryByTestId('streak-rescue-joker')).toBeNull();
    expect(screen.queryByTestId('streak-rescue-walk')).toBeNull();
    expect(screen.getByTestId('streak-rescue-activity')).toBeTruthy();
  });
});

describe('le retour', () => {
  const retour = {
    kind: 'comeback' as const,
    days: 9,
    bestStreak: 21,
    gentleUntil: null,
    normalChosen: false,
  };

  it('accueille et propose deux reprises, sans reproche', async () => {
    const onGentle = jest.fn();
    const onNormal = jest.fn();
    await afficher({ ...retour, onGentle, onNormal });

    expect(screen.getByText('stage.home.comebackLine:{"count":9}')).toBeTruthy();
    expect(screen.getByText('stage.home.bestStreak:{"count":21}')).toBeTruthy();

    await taper(screen.getByLabelText('stage.home.gentleRestart'));
    await taper(screen.getByLabelText('stage.home.normalPlan'));
    expect(onGentle).toHaveBeenCalledTimes(1);
    expect(onNormal).toHaveBeenCalledTimes(1);
  });

  it('🔴 VIE-02 : une fois la période démarrée, la scène dit jusqu’à quand — sur place', async () => {
    await afficher({ ...retour, gentleUntil: '1 novembre', onGentle: jest.fn(), onNormal: jest.fn() });

    expect(screen.getByText('stage.home.gentleDone:{"date":"1 novembre"}')).toBeTruthy();
    // La question n'est plus posée : on ne propose pas deux fois de reprendre.
    expect(screen.queryByLabelText('stage.home.gentleRestart')).toBeNull();
  });

  it('« Mon plan normal » choisi : la scène le confirme et ne repose pas la question', async () => {
    await afficher({ ...retour, normalChosen: true, onGentle: jest.fn(), onNormal: jest.fn() });

    expect(screen.getByText('stage.home.normalDone')).toBeTruthy();
    expect(screen.queryByLabelText('stage.home.normalPlan')).toBeNull();
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
