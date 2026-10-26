/**
 * Ce que porte le ciel de l'accueil (`HomeSky`, US ACCUEIL-08).
 *
 * « Écouter mon brief » reprend le contrat de la carte du brief qu'il remplace (`MorningBriefCard`,
 * supprimée) : ce qui est lu est exactement ce qui est écrit — aucune IA, aucun réseau —, un second
 * appui ARRÊTE la lecture, et la voix ne survit pas à l'écran. La composition du brief elle-même
 * (trois phrases au plus, phrase douce en période « vie réelle ») est testée sur la brique pure,
 * `morning-brief.test.ts`.
 */
import '@/i18n';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Speech from 'expo-speech';
import type { BriefFacts } from '@wellness/shared';
import { ComebackCard, FirstStepsCard, ListenBriefButton, LiveBanner } from '../HomeSky';

jest.mock('@/hooks/useAppReducedMotion', () => ({ useAppReducedMotion: jest.fn(() => false) }));
jest.mock('@/lib/haptics', () => ({ hapticConfirm: jest.fn(), hapticSelect: jest.fn(), hapticMilestone: jest.fn() }));

const speak = Speech.speak as jest.Mock;
const stop = Speech.stop as jest.Mock;

const FAITS: BriefFacts = {
  verdict: 'push',
  todaySession: { title: 'Push A', time: '18:30' },
  nearRecord: { exerciseName: 'Squat', gapKind: 'kg', gap: 2.5 },
  proteinGapG: 40,
  streak: 12,
  realLifeActive: false,
};

beforeEach(() => jest.clearAllMocks());

describe('Écouter mon brief', () => {
  const lead = ['Bonjour Florian', 'Jambes ce soir à 18 h.'];

  it('lit la salutation, la phrase du jour, PUIS le brief — dans la langue de l’app', async () => {
    await render(<ListenBriefButton facts={FAITS} lead={lead} speechLanguage="fr-FR" />);
    await fireEvent.press(screen.getByTestId('home-listen-brief'));

    // Deux phrases de tête + les trois du brief (BRIEF_MAX_SENTENCES).
    expect(speak).toHaveBeenCalledTimes(5);
    expect(speak.mock.calls[0]?.[0]).toBe('Bonjour Florian');
    expect(speak.mock.calls[1]?.[0]).toBe('Jambes ce soir à 18 h.');
    expect(speak.mock.calls[0]?.[1]).toMatchObject({ language: 'fr-FR' });
  });

  it('🔴 un second appui ARRÊTE la lecture au lieu de la relancer', async () => {
    await render(<ListenBriefButton facts={FAITS} lead={lead} speechLanguage="fr-FR" />);
    await fireEvent.press(screen.getByTestId('home-listen-brief'));
    expect(screen.getByTestId('home-listen-brief').props.accessibilityState).toMatchObject({ selected: true });

    await fireEvent.press(screen.getByTestId('home-listen-brief'));
    expect(stop).toHaveBeenCalled();
    expect(speak).toHaveBeenCalledTimes(5);
    expect(screen.getByTestId('home-listen-brief').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('revient au repos quand la dernière phrase est dite', async () => {
    await render(<ListenBriefButton facts={FAITS} lead={lead} speechLanguage="fr-FR" />);
    await fireEvent.press(screen.getByTestId('home-listen-brief'));
    await act(async () => {
      speak.mock.calls.at(-1)?.[1]?.onDone?.();
    });
    expect(screen.getByTestId('home-listen-brief').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('🔴 la voix ne survit pas à l’écran', async () => {
    const { unmount } = await render(<ListenBriefButton facts={FAITS} lead={lead} speechLanguage="fr-FR" />);
    await unmount();
    expect(stop).toHaveBeenCalled();
  });
});

describe('la séance en cours', () => {
  it('rouge fonte pour la muscu, et « Reprendre » y ramène', async () => {
    const onResume = jest.fn();
    await render(<LiveBanner pillar="strength" title="Jambes" onResume={onResume} />);
    expect(screen.getByText('Jambes')).toBeTruthy();
    expect(screen.getByTestId('home-live-banner')).toHaveStyle({ backgroundColor: '#8e1b1b' });
    await fireEvent.press(screen.getByLabelText('Reprendre la séance'));
    expect(onResume).toHaveBeenCalled();
  });

  it('bleu pour une course', async () => {
    await render(<LiveBanner pillar="running" title="Footing" onResume={jest.fn()} />);
    expect(screen.getByTestId('home-live-banner')).toHaveStyle({ backgroundColor: '#1d4586' });
    expect(screen.getByLabelText('Reprendre la course')).toBeTruthy();
  });
});

describe('le retour', () => {
  const base = { days: 9, bestStreak: 21, gentleUntil: null, normalChosen: false, onGentle: jest.fn(), onNormal: jest.fn() };

  it('accueille sans réclamer, et propose les deux reprises', async () => {
    const onGentle = jest.fn();
    const onNormal = jest.fn();
    await render(<ComebackCard {...base} onGentle={onGentle} onNormal={onNormal} />);
    await fireEvent.press(screen.getByTestId('home-gentle-restart'));
    await fireEvent.press(screen.getByTestId('home-normal-plan'));
    expect(onGentle).toHaveBeenCalled();
    expect(onNormal).toHaveBeenCalled();
  });

  it('🔴 une fois la reprise choisie, la carte le CONFIRME au lieu de reposer la question', async () => {
    await render(<ComebackCard {...base} gentleUntil="1 novembre" />);
    expect(screen.queryByTestId('home-gentle-restart')).toBeNull();
    expect(screen.getByText(/1 novembre/)).toBeTruthy();
  });

  it('« Mon plan normal » choisi : plus de boutons non plus', async () => {
    await render(<ComebackCard {...base} normalChosen />);
    expect(screen.queryByTestId('home-normal-plan')).toBeNull();
  });
});

describe('le premier jour', () => {
  it('le parcours des sept jours, à la place des cadrans', async () => {
    const onCta = jest.fn();
    await render(<FirstStepsCard title="Ta première séance" description="Vingt minutes." ctaLabel="C’est parti" onCta={onCta} />);
    expect(screen.getByText('Premiers pas · jour 1 sur 7')).toBeTruthy();
    expect(screen.getByText('Ta première séance')).toBeTruthy();
    await fireEvent.press(screen.getByText('C’est parti'));
    expect(onCta).toHaveBeenCalled();
  });
});
