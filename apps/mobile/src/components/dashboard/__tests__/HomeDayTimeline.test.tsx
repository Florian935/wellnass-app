/**
 * « Ta journée », le fil du jour (`HomeDayTimeline`, US ACCUEIL-08).
 *
 * L'ORDRE des gestes, ce qui est dû, fait ou manqué et l'action du moment sont décidés par
 * `buildDayTimeline` (`day-timeline.test.ts`). Ici, la mise en page que la toile a validée :
 *  - ce qui est fait se **replie** dès deux gestes, et se déplie au toucher ;
 *  - la carte du moment se pose **à la place** du geste qu'elle porte ;
 *  - la suite tient en **trois lignes**, puis « n plus tard » ;
 *  - un repas ou une pesée à venir porte un « + » ; une séance, non (elle se démarre de la carte).
 */
import '@/i18n';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { DayTimeline, MealSlot, TimelineItem } from '@wellness/shared';
import { HomeDayTimeline } from '../HomeDayTimeline';

jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    formatWeight: (kg: number) => `${kg} kg`,
    formatDistance: (km: number) => `${km} km`,
  }),
}));

const meal = (key: string, hour: number, logged = false): MealSlot => ({
  key,
  label: null,
  hour,
  learned: true,
  logged,
});

const item = (over: Partial<TimelineItem> & Pick<TimelineItem, 'id' | 'kind' | 'hour'>): TimelineItem => ({
  pillar: 'home',
  timeKnown: true,
  done: false,
  suggested: false,
  live: false,
  missed: false,
  ...over,
});

const session = {
  pillar: 'strength' as const,
  name: 'Jambes',
  scheduledTime: '18:30:00',
  exerciseCount: 6,
  targetDistanceM: null,
  targetDurationSeconds: null,
  programName: 'PPL',
  plannedSessionId: 'ps-1',
  sessionId: 's-1',
};

const ITEMS: TimelineItem[] = [
  item({ id: 'checkin', kind: 'checkin', hour: 7.5, pillar: 'wellbeing', done: true }),
  item({ id: 'weigh', kind: 'weigh', hour: 8, done: true }),
  item({ id: 'meal:breakfast', kind: 'meal', hour: 8.25, pillar: 'nutrition', done: true, meal: meal('breakfast', 8.25, true) }),
  item({ id: 'meal:lunch', kind: 'meal', hour: 12.5, pillar: 'nutrition', meal: meal('lunch', 12.5) }),
  item({ id: 'training:ps-1', kind: 'training', hour: 18.5, pillar: 'strength', training: session }),
  item({ id: 'meal:dinner', kind: 'meal', hour: 20, pillar: 'nutrition', meal: meal('dinner', 20) }),
  item({ id: 'evening', kind: 'evening', hour: 21.5, pillar: 'wellbeing' }),
];

const timeline = (over: Partial<DayTimeline> = {}): DayTimeline => ({
  items: ITEMS,
  now: { kind: 'meal-due', meal: meal('lunch', 12.5) },
  nowItemId: 'meal:lunch',
  progress: { done: 3, total: 7 },
  dayDone: false,
  ...over,
});

const onQuick = jest.fn();
const onPlanning = jest.fn();

const show = (tl: DayTimeline = timeline(), nowFirst = false) =>
  render(
    <HomeDayTimeline
      timeline={tl}
      nowCard={<Text>CARTE DU MOMENT</Text>}
      nowFirst={nowFirst}
      mealTotals={new Map([['breakfast', { kcal: 420, proteinG: 24 }]])}
      checkinEnergy={4}
      weightKgToday={78.4}
      formatKcal={(n) => `${n}`}
      onPlanning={onPlanning}
      onQuick={onQuick}
    />,
  );

/** Les lignes du fil, dans l'ordre de l'écran. */
const rows = () =>
  screen
    .queryAllByTestId(/^fil-(?!quick-)/)
    .map((node) => String(node.props.testID).replace(/^fil-/, ''));

beforeEach(() => jest.clearAllMocks());

describe('ce qui est fait se replie', () => {
  it('🔴 trois gestes faits tiennent en UNE ligne, qui les nomme', async () => {
    await show();
    expect(screen.getByText('3 gestes déjà faits')).toBeTruthy();
    expect(screen.getByText('check-in · pesée · petit-déjeuner')).toBeTruthy();
    expect(rows()).not.toContain('checkin');
  });

  it('se déplie au toucher : chaque geste fait dit ce qu’il a donné', async () => {
    await show();
    await fireEvent.press(screen.getByLabelText('Voir les 3 gestes déjà faits'));
    expect(rows().slice(0, 3)).toEqual(['checkin', 'weigh', 'meal:breakfast']);
    expect(screen.getByText('Énergie 4/5 · Bonne')).toBeTruthy();
    expect(screen.getByText('78.4 kg')).toBeTruthy();
    expect(screen.getByText('420 kcal · 24 g de protéines')).toBeTruthy();
  });

  it('un seul geste fait ne se replie pas : la ligne ne gagnerait rien', async () => {
    const one = ITEMS.map((it) => (it.id === 'weigh' || it.id === 'meal:breakfast' ? { ...it, done: false } : it));
    await show(timeline({ items: one, nowItemId: 'weigh' }));
    expect(screen.queryByText(/déjà fait/)).toBeNull();
    expect(rows()[0]).toBe('checkin');
  });
});

describe('la carte du moment', () => {
  it('🔴 se pose À LA PLACE du geste qu’elle porte, dans l’ordre des heures', async () => {
    await show();
    expect(rows()).toEqual(['now', 'training:ps-1', 'meal:dinner', 'evening']);
    expect(screen.getByText('CARTE DU MOMENT')).toBeTruthy();
  });

  it('série en jeu (`nowFirst`) : en tête de la suite, et le geste porté reste une ligne', async () => {
    await show(timeline({ nowItemId: 'evening' }), true);
    expect(rows()).toEqual(['now', 'meal:lunch', 'training:ps-1', 'meal:dinner']);
  });

  it('sans geste porté (journée faite, repli) : en bout de fil', async () => {
    await show(timeline({ nowItemId: null }));
    expect(rows().at(-1)).toBe('now');
  });
});

describe('la suite', () => {
  it('🔴 trois lignes, puis « n plus tard » — qui se déplie', async () => {
    const many = [
      ...ITEMS,
      item({ id: 'meal:snack', kind: 'meal', hour: 16.5, pillar: 'nutrition', meal: meal('snack', 16.5) }),
      item({ id: 'walk', kind: 'walk', hour: 17.5, suggested: true, stepsLeft: 3800 }),
    ].sort((a, b) => a.hour - b.hour);
    await show(timeline({ items: many }));

    expect(rows()).toEqual(['now', 'meal:snack', 'walk', 'training:ps-1']);
    expect(screen.getByText('2 plus tard')).toBeTruthy();
    expect(screen.getByText('dîner · point du soir')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Voir la suite de la journée'));
    expect(rows()).toEqual(['now', 'meal:snack', 'walk', 'training:ps-1', 'meal:dinner', 'evening']);
  });

  it('une marche suggérée porte l’étiquette « idée » et les pas qui manquent', async () => {
    const withWalk = [...ITEMS, item({ id: 'walk', kind: 'walk', hour: 17.5, suggested: true, stepsLeft: 3800 })].sort(
      (a, b) => a.hour - b.hour,
    );
    await show(timeline({ items: withWalk }));
    expect(screen.getByText('idée')).toBeTruthy();
    expect(screen.getByText('Encore 3800 pas pour ton objectif')).toBeTruthy();
  });

  it('une séance sans heure ne promet pas d’horaire', async () => {
    const noTime = ITEMS.map((it) => (it.kind === 'training' ? { ...it, timeKnown: false } : it));
    await show(timeline({ items: noTime }));
    expect(screen.getByText('Musculation · 6 exercices · sans heure')).toBeTruthy();
  });
});

describe('les gestes', () => {
  it('le « + » d’un repas à venir le note tout de suite', async () => {
    await show();
    await fireEvent.press(screen.getByTestId('fil-quick-meal:dinner'));
    expect(onQuick).toHaveBeenCalledWith(expect.objectContaining({ id: 'meal:dinner' }));
  });

  it('🔴 une séance n’a pas de « + » : elle se démarre de la carte, avec son aperçu', async () => {
    await show();
    expect(screen.queryByTestId('fil-quick-training:ps-1')).toBeNull();
  });

  it('« 3/7 faits » ouvre le planning', async () => {
    await show();
    await fireEvent.press(screen.getByText('3/7 faits'));
    expect(onPlanning).toHaveBeenCalled();
  });
});
