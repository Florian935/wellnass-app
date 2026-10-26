/**
 * « Ta semaine » (`WeekStrip`, US ACCUEIL-08) — une seule carte pour la semaine, là où l'accueil la
 * disait trois fois (anneaux, Régularité, « La suite »).
 *
 * Les marques (fait, prévu, noté) et les comptes sont décidés par `buildWeekStrip`
 * (`home-sections.test.ts`). Ici : une colonne par jour, une pastille par pilier ACTIF, aujourd'hui
 * repérable, chaque jour lisible en entier par un lecteur d'écran (la couleur ne porte pas seule le
 * sens), et la série en pastille — en jours ou en semaines selon l'unité choisie (SERIE-01), jamais
 * les deux.
 */
import '@/i18n';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { WeekStrip as WeekStripData } from '@wellness/shared';
import { WeekStrip } from '../WeekStrip';

// Les offres de la série ont leur propre test (`StreakOffers.test.tsx`).
jest.mock('@/components/dashboard/StreakOffers', () => ({ StreakOffers: () => null }));

const STRIP: WeekStripData = {
  days: [
    { key: '2026-10-19', weekday: 1, dayOfMonth: 19, isToday: false, paused: false, marks: { strength: 'done', nutrition: 'done' } },
    { key: '2026-10-20', weekday: 2, dayOfMonth: 20, isToday: false, paused: false, marks: { strength: 'idle', nutrition: 'logged' } },
    { key: '2026-10-21', weekday: 3, dayOfMonth: 21, isToday: false, paused: false, marks: { strength: 'done', nutrition: 'done' } },
    { key: '2026-10-22', weekday: 4, dayOfMonth: 22, isToday: true, paused: false, marks: { strength: 'planned', nutrition: 'idle' } },
    { key: '2026-10-23', weekday: 5, dayOfMonth: 23, isToday: false, paused: false, marks: { strength: 'idle', nutrition: 'idle' } },
    { key: '2026-10-24', weekday: 6, dayOfMonth: 24, isToday: false, paused: false, marks: { strength: 'planned', nutrition: 'idle' } },
    { key: '2026-10-25', weekday: 7, dayOfMonth: 25, isToday: false, paused: false, marks: { strength: 'idle', nutrition: 'idle' } },
  ],
  sessionsDone: 2,
  sessionsTotal: 4,
  daysInTarget: 2,
  loggedDays: 3,
};

const onReview = jest.fn();

const show = (over: Partial<Parameters<typeof WeekStrip>[0]> = {}) =>
  render(
    <WeekStrip
      strip={STRIP}
      pillars={['strength', 'nutrition']}
      streak={{ kind: 'running', days: 12 }}
      offers={{ dailyCurrent: 12, weeklyCurrent: 2, restorableGap: null, offerSwitch: false }}
      onReview={onReview}
      {...over}
    />,
  );

beforeEach(() => jest.clearAllMocks());

it('sept jours, du lundi au dimanche', async () => {
  await show();
  for (const n of ['19', '20', '21', '22', '23', '24', '25']) expect(screen.getByText(n)).toBeTruthy();
});

it('🔴 chaque jour se lit EN ENTIER : la couleur ne porte pas seule le sens', async () => {
  await show();
  expect(screen.getByLabelText('L 19, séance faite, repas dans ta cible')).toBeTruthy();
  expect(screen.getByLabelText('M 20, pas de séance, repas notés hors cible')).toBeTruthy();
  expect(screen.getByLabelText('J 22, séance prévue, pas de repas noté')).toBeTruthy();
});

it('🔴 une pastille par pilier ACTIF seulement (décision H)', async () => {
  await show({ pillars: ['nutrition'] });
  expect(screen.getByLabelText('L 19, repas dans ta cible')).toBeTruthy();
  expect(screen.queryByText('Muscu')).toBeNull();
  // Sans pilier d'entraînement, la semaine ne compte pas de séances.
  expect(screen.queryByText(/séances sur/)).toBeNull();
  expect(screen.getByText('2 jours dans ta cible')).toBeTruthy();
});

it('« 2 séances sur 4 · 2 jours dans ta cible », et le Bilan', async () => {
  await show();
  expect(screen.getByText('2 séances sur 4 · 2 jours dans ta cible')).toBeTruthy();
  await fireEvent.press(screen.getByText('Ton bilan'));
  expect(onReview).toHaveBeenCalled();
});

it('une semaine encore vide le dit, sans « 0 sur 0 »', async () => {
  await show({ strip: { ...STRIP, sessionsDone: 0, sessionsTotal: 0, daysInTarget: 0, loggedDays: 0 } });
  expect(screen.getByText("Ta semaine commence : rien de noté pour l'instant.")).toBeTruthy();
  expect(screen.queryByText(/0 sur 0/)).toBeNull();
});

describe('la série en pastille', () => {
  it('en jours', async () => {
    await show();
    expect(screen.getByText('12 jours')).toBeTruthy();
  });

  it('🔴 en semaines quand c’est l’unité choisie — et le compte hebdomadaire seul', async () => {
    await show({ streak: { kind: 'weeks', weeks: 4 } });
    expect(screen.getByText('4 semaines')).toBeTruthy();
    expect(screen.queryByText(/jours?$/)).toBeNull();
  });

  it('en jeu le soir', async () => {
    await show({ streak: { kind: 'at-risk', days: 12 } });
    expect(screen.getByText('12 jours · en jeu')).toBeTruthy();
  });

  it('pas encore de série : elle commence, sans « 0 jour »', async () => {
    await show({ streak: { kind: 'start' } });
    expect(screen.getByText('Ta série commence')).toBeTruthy();
    expect(screen.queryByText(/^0 /)).toBeNull();
  });
});
