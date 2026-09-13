/**
 * US DASH-01 — la scène du pilier Musculation, testée sur son **contrat** : cinq états exclusifs,
 * le record à portée, et ce que la scène refuse de dire. La silhouette n'est pas testée : elle ne
 * porte aucune information (R1), et son impact ne joue qu'une fois à l'arrivée (D6).
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StrengthStage, type StrengthScene } from '../StrengthStage';

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

const noop = jest.fn();

const afficher = async (scene: StrengthScene, overrides: Record<string, unknown> = {}) => {
  await render(
    <StrengthStage
      scene={scene}
      muscles={['chest', 'arms']}
      nearRecord={null}
      weekLabel="Semaine 3 sur 8"
      onPrimary={noop}
      onSecondary={noop}
      onPlanning={noop}
      onDirectory={noop}
      {...overrides}
    />,
  );
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

const SEANCE: Extract<StrengthScene, { kind: 'today' }> = {
  kind: 'today',
  name: 'Haut du corps',
  orderIndex: 0,
  programName: 'Full body 3×',
  exerciseCount: 5,
  estimatedMinutes: 55,
  previewExercises: ['Développé couché', 'Rowing', 'Squat'],
};

beforeEach(() => jest.clearAllMocks());

describe('la séance du jour', () => {
  it('annonce son nom, son contenu et ce qu’il reste d’exercices', async () => {
    await afficher(SEANCE);

    expect(screen.getByText('Haut du corps')).toBeTruthy();
    expect(screen.getByText('Développé couché')).toBeTruthy();
    // Trois noms ne disent pas s'il en reste cinq : le reste est compté.
    expect(screen.getByText('strengthHub.today.more:{"count":2}')).toBeTruthy();
  });

  it('🔴 sans nom, retombe sur le rang de la séance, 1-indexé', async () => {
    // `orderIndex` est 0-based en base : « Séance 0 » se lirait comme un bug.
    await afficher({ ...SEANCE, name: null, orderIndex: 2 });

    expect(screen.getByText('programs.detail.sessionFallback:{"index":3}')).toBeTruthy();
  });

  it('le geste principal démarre la séance, et se coupe pendant le démarrage', async () => {
    const onPrimary = jest.fn();
    await afficher(SEANCE, { onPrimary, busy: true });

    await taper(screen.getByLabelText('stage.strength.primary.today'));
    expect(onPrimary).not.toHaveBeenCalled();
  });
});

describe('après la séance', () => {
  const apres: Extract<StrengthScene, { kind: 'after-session' }> = {
    kind: 'after-session',
    name: 'Push A',
    tonnageKg: 4820,
    exerciseCount: 6,
    recordsBeaten: 2,
  };

  it('le tonnage est rendu à sa valeur d’arrivée, et les records comptés', async () => {
    await afficher(apres);

    expect(
      screen.getByTestId('strength-tonnage', { includeHiddenElements: true }).props.defaultValue,
      // Espace fine insécable : le séparateur de milliers français que rend `Intl`, pas un espace.
    ).toBe('4 820');
    expect(screen.getByText('stage.strength.recordsBeaten:{"count":2}')).toBeTruthy();
  });

  it('🔴 aucun record battu : la scène n’en invente pas', async () => {
    await afficher({ ...apres, recordsBeaten: 0 });

    expect(screen.queryByText(/stage\.strength\.recordsBeaten/)).toBeNull();
  });
});

describe('les autres états', () => {
  it('une séance en cours montre son avancement', async () => {
    await afficher({ kind: 'resume', doneSets: 7, totalSets: 18 });

    expect(screen.getByText('workout.resumeTitle')).toBeTruthy();
    expect(screen.getByText('stage.strength.setsProgress:{"done":7,"total":18}')).toBeTruthy();
  });

  it('un jour de repos dit la prochaine séance', async () => {
    await afficher({ kind: 'rest', doneToday: false, nextLabel: 'Prochaine le 16/09' });

    expect(screen.getByText('strengthHub.rest.title')).toBeTruthy();
    expect(screen.getByText('Prochaine le 16/09')).toBeTruthy();
  });

  it('sans programme, la scène propose d’en choisir un', async () => {
    await afficher({ kind: 'onboarding' });

    expect(screen.getByText('strengthHub.onboarding.title')).toBeTruthy();
    expect(screen.getByLabelText('stage.strength.primary.onboarding')).toBeTruthy();
  });
});

describe('le record à portée', () => {
  it('remplace le repère de semaine quand il existe', async () => {
    await afficher(SEANCE, {
      nearRecord: { exerciseName: 'Squat', gapKind: 'kg', gap: 2.5 },
    });

    expect(
      screen.getByText('stage.strength.near.kg:{"exercise":"Squat","gap":2.5}'),
    ).toBeTruthy();
    // Une seule ligne sous la séance : le record prime, c'est lui qui donne envie d'y aller.
    expect(screen.queryByText('Semaine 3 sur 8')).toBeNull();
  });

  it('sans record à portée, la semaine reprend sa place', async () => {
    await afficher(SEANCE);

    expect(screen.getByText('Semaine 3 sur 8')).toBeTruthy();
  });
});

describe('les accès', () => {
  it('le planning et l’annuaire sont à un tap', async () => {
    const onPlanning = jest.fn();
    const onDirectory = jest.fn();
    await afficher(SEANCE, { onPlanning, onDirectory });

    await taper(screen.getByLabelText('planning.title'));
    await taper(screen.getByLabelText('strengthHub.directory'));

    expect(onPlanning).toHaveBeenCalledTimes(1);
    expect(onDirectory).toHaveBeenCalledTimes(1);
  });
});
