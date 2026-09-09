/**
 * Carte « maintenant » de l'accueil (`components/dashboard/NowCard`, US ACCUEIL-01).
 *
 * Remplace le test de `TodaySessionCard`, supprimé avec le widget qu'il couvrait. Le partage des
 * responsabilités a changé et le test s'en trouve simplifié :
 *
 *  - **la décision** (quelle action pour quels faits) est vérifiée dans `now-action.test.ts`, sur
 *    une fonction pure, sans arbre React ni base — 19 cas, dont la table de priorité elle-même ;
 *  - **le rendu** est vérifié ici : chaque `kind` produit-il le bon texte et la bonne action ?
 *
 * Deux exigences comptent plus que les autres, parce que leur violation ne casse aucun test
 * ailleurs et se voit immédiatement à l'écran :
 *  1. la carte **ne rend jamais `null`** — elle est épinglée, et une carte épinglée qui disparaît
 *     réintroduit le trou de mise en page que la grille a mis quatre tentatives à corriger ;
 *  2. l'état « journée faite » **ne propose aucun bouton** : c'est un compte rendu, pas une
 *     injonction.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { NowAction } from '@wellness/shared';

import { NowCard } from '../NowCard';
import { useNowAction } from '@/hooks/useNowAction';
import { startWorkoutFromSession } from '@/data/repositories/workout-repository';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('@/hooks/useNowAction', () => ({ useNowAction: jest.fn() }));
jest.mock('@/data/repositories/workout-repository', () => ({
  startWorkoutFromSession: jest.fn(),
}));
jest.mock('@/hooks/useTodayKey', () => ({ useTodayKey: () => '2026-09-09' }));
jest.mock('@/hooks/useActionLock', () => ({
  // Le verrou réel dédoublonne les appuis ; ici on veut juste que l'action passe.
  useActionLock: () => (fn: () => Promise<void>) => fn(),
}));
jest.mock('@/components/AccentHalo', () => ({ AccentHalo: () => null }));

const mockUseNowAction = useNowAction as jest.Mock;
const mockStart = startWorkoutFromSession as jest.Mock;
const push = jest.fn();
(useRouter as jest.Mock).mockReturnValue({ push });

function givenAction(action: NowAction, isLoading = false) {
  mockUseNowAction.mockReturnValue({ action, isLoading });
}

const training = {
  pillar: 'strength' as const,
  name: 'Push — Pecs / Épaules',
  scheduledTime: '18:30',
  detail: '6 exercices',
  programName: 'PPL',
  plannedSessionId: 'ps-1',
  sessionId: 's-1',
};

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue({ push });
  mockStart.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Séance planifiée
// ---------------------------------------------------------------------------
describe('séance planifiée du jour', () => {
  it('affiche le nom de la séance et son HEURE', async () => {
    // L'heure est stockée depuis HORAIRE-01 et n'était affichée nulle part. La maquette validée
    // l'annonçait pourtant (« SÉANCE DU JOUR · 18:30 ») depuis l'origine.
    givenAction({ kind: 'session-today', training });
    await render(<NowCard />);

    expect(screen.getByText('Push — Pecs / Épaules')).toBeTruthy();
    expect(screen.getByText(/18:30/)).toBeTruthy();
  });

  it('démarre la séance de musculation au tap', async () => {
    givenAction({ kind: 'session-today', training });
    await render(<NowCard />);

    fireEvent.press(screen.getByText('Démarrer la séance'));
    expect(mockStart).toHaveBeenCalledWith('s-1', { plannedSessionId: 'ps-1' });
  });

  it('route vers la course, et non vers une séance de muscu, pour un entraînement running', async () => {
    // Le défaut central que cette US corrige : le widget d'avant appelait
    // `useTodaySession('strength')` avec le pilier EN DUR.
    givenAction({
      kind: 'session-today',
      training: { ...training, pillar: 'running', name: 'Sortie longue', plannedSessionId: 'ps-9' },
    });
    await render(<NowCard />);

    fireEvent.press(screen.getByText('Démarrer la course'));
    expect(mockStart).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith({
      pathname: '/run',
      params: { plannedSessionId: 'ps-9' },
    });
  });

  it('se passe de l’heure quand l’occurrence n’en porte pas', async () => {
    givenAction({ kind: 'session-today', training: { ...training, scheduledTime: null } });
    await render(<NowCard />);
    expect(screen.getByText('Push — Pecs / Épaules')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Ce qui tourne déjà
// ---------------------------------------------------------------------------
describe('activité en cours', () => {
  it('propose de reprendre une séance, sans jamais en démarrer une autre', async () => {
    givenAction({ kind: 'workout-active', workoutId: 'w-1' });
    await render(<NowCard />);

    fireEvent.press(screen.getByText('Reprendre la séance'));
    expect(push).toHaveBeenCalledWith('/workout');
    // On ne recrée pas une séance par-dessus celle qui tourne.
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('propose de reprendre une course en cours', async () => {
    givenAction({ kind: 'run-active' });
    await render(<NowCard />);

    fireEvent.press(screen.getByText('Reprendre la course'));
    expect(push).toHaveBeenCalledWith('/run/active');
  });
});

// ---------------------------------------------------------------------------
// Saisies dues
// ---------------------------------------------------------------------------
describe('saisies dues', () => {
  it('ouvre le sélecteur sur LE BON REPAS, avec la date du jour', async () => {
    // `meal: 'breakfast'` était codé en dur dans le widget nutrition : à 20 h, un appui ouvrait
    // le petit-déjeuner.
    givenAction({ kind: 'meal-due', meal: 'dinner', deadlineHour: 20 });
    await render(<NowCard />);

    fireEvent.press(screen.getByText('Ajouter mon dîner'));
    expect(push).toHaveBeenCalledWith({
      pathname: '/food-picker',
      params: { date: '2026-09-09', meal: 'dinner' },
    });
  });

  it('annonce l’heure APPRISE quand elle est connue', async () => {
    // C'est l'information que l'app calculait déjà pour ses notifications sans jamais la montrer.
    givenAction({ kind: 'meal-due', meal: 'dinner', deadlineHour: 20 });
    await render(<NowCard />);
    expect(screen.getByText(/20/)).toBeTruthy();
  });

  it('reste correcte sans heure apprise', async () => {
    givenAction({ kind: 'meal-due', meal: 'lunch', deadlineHour: null });
    await render(<NowCard />);
    expect(screen.getByText('Ajouter mon déjeuner')).toBeTruthy();
  });

  it('mène à la saisie de pesée', async () => {
    givenAction({ kind: 'weigh-in-due' });
    await render(<NowCard />);
    fireEvent.press(screen.getByText('Enregistrer ma pesée'));
    expect(push).toHaveBeenCalledWith('/nutrition-stats');
  });

  it('mène au check-in de bien-être', async () => {
    givenAction({ kind: 'wellbeing-due' });
    await render(<NowCard />);
    fireEvent.press(screen.getByText('Faire mon point du soir'));
    expect(push).toHaveBeenCalledWith('/wellbeing');
  });
});

// ---------------------------------------------------------------------------
// Compte rendu et repli
// ---------------------------------------------------------------------------
describe('journée faite', () => {
  it('rend compte SANS proposer d’action', async () => {
    // Un bouton ici transformerait un compte rendu en injonction.
    givenAction({
      kind: 'day-done',
      tally: { strengthSessions: 1, runs: 0, mealLogged: true, streak: 13 },
    });
    await render(<NowCard />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(/13/)).toBeTruthy();
  });

  it('n’affiche que ce qui a réellement eu lieu', async () => {
    givenAction({
      kind: 'day-done',
      tally: { strengthSessions: 0, runs: 2, mealLogged: false, streak: 3 },
    });
    await render(<NowCard />);
    // Deux courses, aucune séance de muscu : la carte ne doit pas inventer de séance.
    expect(screen.queryByText(/séance/i)).toBeNull();
  });
});

describe('repli', () => {
  it('ne rend JAMAIS null, même sans rien à dire', async () => {
    givenAction({ kind: 'idle', moment: 'morning' });
    const vue = await render(<NowCard />);
    expect(vue.toJSON()).not.toBeNull();
  });

  it('propose de créer un programme quand il n’y a rien à faire', async () => {
    givenAction({ kind: 'idle', moment: 'morning' });
    await render(<NowCard />);
    fireEvent.press(screen.getByText('Créer un programme'));
    expect(push).toHaveBeenCalledWith('/programs');
  });

  it('rend quelque chose même pendant le chargement', async () => {
    // Pas de `return null` : la carte est épinglée, sa cellule ne doit pas apparaître après coup.
    givenAction({ kind: 'idle', moment: 'morning' }, true);
    const vue = await render(<NowCard />);
    expect(vue.toJSON()).not.toBeNull();
  });
});
