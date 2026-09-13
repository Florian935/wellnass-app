/**
 * US DASH-01 — la scène du pilier Course, testée sur son **contrat** : cinq états exclusifs, jamais
 * deux à la fois, et un geste principal par état. Rien sur la trace animée (R1 : le mouvement ne
 * porte aucune information).
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { RunStage, type RunScene } from '../RunStage';

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

const afficher = async (scene: RunScene, overrides: Record<string, unknown> = {}) => {
  await render(
    <RunStage
      scene={scene}
      weekDistanceLabel="18,4 km"
      weekSessionsLabel="2 / 3 faites"
      onPrimary={noop}
      onSecondary={noop}
      onProfile={noop}
      onHistory={noop}
      {...overrides}
    />,
  );
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

const AUJOURD_HUI: Extract<RunScene, { kind: 'today' }> = {
  kind: 'today',
  typeLabel: 'Fractionné (VMA)',
  segments: ['6 × 400 m', 'récup 200 m'],
  volumeLabel: '8,2 km',
  estimatedMinutes: 48,
  paceLabel: '4:35 /km',
  scheduledTime: '18:30:00',
  countdown: { kind: 'in', hours: 3 },
  instructions: 'Échauffement 15 min, puis les fractions.',
};

beforeEach(() => jest.clearAllMocks());

describe('la séance du jour', () => {
  it('annonce son type, sa structure et ses repères', async () => {
    await afficher(AUJOURD_HUI);

    expect(screen.getByText('Fractionné (VMA)')).toBeTruthy();
    expect(screen.getByText('6 × 400 m')).toBeTruthy();
    expect(screen.getByText('8,2 km')).toBeTruthy();
    expect(screen.getByText('running.hub.minutes:{"count":48}')).toBeTruthy();
    expect(screen.getByText('4:35 /km')).toBeTruthy();
  });

  it('l’heure prévue et son compte à rebours (HORAIRE-01)', async () => {
    await afficher(AUJOURD_HUI);

    // L'heure telle qu'elle a été saisie, sans les secondes de la base.
    expect(screen.getByText('18:30')).toBeTruthy();
    expect(screen.getByText('stage.running.countdownIn:{"count":3}')).toBeTruthy();
  });

  it('🔴 sans heure saisie, aucun compte à rebours inventé', async () => {
    await afficher({ ...AUJOURD_HUI, scheduledTime: null, countdown: null });

    expect(screen.queryByText(/stage\.running\.countdown/)).toBeNull();
  });

  it('le geste principal démarre la séance', async () => {
    const onPrimary = jest.fn();
    await afficher(AUJOURD_HUI, { onPrimary });

    await taper(screen.getByLabelText('stage.running.primary.today'));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });
});

describe('l’arrivée', () => {
  const arrivee: Extract<RunScene, { kind: 'arrival' }> = {
    kind: 'arrival',
    distanceKm: 10.42,
    distanceUnit: 'km',
    paceLabel: '5:02 /km',
    durationLabel: '52 min',
    prediction10kLabel: '47:30',
    prediction10kIsNew: false,
  };

  it('la distance est rendue à sa valeur d’arrivée', async () => {
    await afficher(arrivee);

    expect(
      screen.getByTestId('run-arrival-distance', { includeHiddenElements: true }).props.defaultValue,
    ).toBe('10,42');
    expect(screen.getByText('stage.running.arrivalMeta:{"duration":"52 min","pace":"5:02 /km"}')).toBeTruthy();
  });

  it('dit l’estimation 10 km, et dit quand elle vient de cette sortie', async () => {
    await afficher({ ...arrivee, prediction10kIsNew: true });

    expect(screen.getByText('stage.running.predictionNew:{"time":"47:30"}')).toBeTruthy();
  });

  it('🔴 sans record de 5 km, aucune estimation', async () => {
    // La formule de Riegel n'a rien pour partir : mieux vaut se taire qu'estimer au hasard.
    await afficher({ ...arrivee, prediction10kLabel: null });

    expect(screen.queryByText(/stage\.running\.prediction/)).toBeNull();
  });
});

describe('les autres états', () => {
  it('une course en cours prime sur tout le reste', async () => {
    await afficher({ kind: 'resume', distanceLabel: '3,1 km', durationLabel: '17 min' });

    expect(screen.getByText('3,1 km')).toBeTruthy();
    expect(screen.getByText('stage.running.eyebrow.resume')).toBeTruthy();
    expect(screen.getByLabelText('stage.running.primary.resume')).toBeTruthy();
  });

  it('un jour de repos annonce la prochaine séance', async () => {
    await afficher({ kind: 'rest', doneToday: false, nextLabel: 'Prochaine séance le 16/08' });

    expect(screen.getByText('running.hub.restTitle')).toBeTruthy();
    expect(screen.getByText('Prochaine séance le 16/08')).toBeTruthy();
  });

  it('séance faite aujourd’hui : le titre le dit', async () => {
    await afficher({ kind: 'rest', doneToday: true, nextLabel: null });

    expect(screen.getByText('running.hub.doneTodayTitle')).toBeTruthy();
    expect(screen.getByText('running.hub.nothingPlanned')).toBeTruthy();
  });

  it('sans programme, la scène propose d’en choisir un', async () => {
    const onPrimary = jest.fn();
    await afficher({ kind: 'onboarding' }, { onPrimary });

    expect(screen.getByText('running.hub.onboardingTitle')).toBeTruthy();
    await taper(screen.getByLabelText('stage.running.primary.onboarding'));
    expect(onPrimary).toHaveBeenCalled();
  });
});

describe('les accès', () => {
  it('la semaine est rappelée en une ligne', async () => {
    await afficher({ kind: 'onboarding' });

    expect(
      screen.getByText('stage.running.weekLine:{"distance":"18,4 km","sessions":"2 / 3 faites"}'),
    ).toBeTruthy();
  });

  it('le profil et l’historique sont à un tap', async () => {
    const onProfile = jest.fn();
    const onHistory = jest.fn();
    await afficher({ kind: 'onboarding' }, { onProfile, onHistory });

    await taper(screen.getByLabelText('running.profile.title'));
    await taper(screen.getByLabelText('running.history.title'));

    expect(onProfile).toHaveBeenCalledTimes(1);
    expect(onHistory).toHaveBeenCalledTimes(1);
  });
});
