/**
 * Carte « maintenant » de l'accueil (`components/dashboard/NowCard`, US ACCUEIL-01).
 *
 * Remplace le test de `TodaySessionCard`, supprimé avec le widget qu'il couvrait. Le partage des
 * responsabilités a changé et le test s'en trouve simplifié :
 *
 *  - **la décision** (quelle action pour quels faits) est vérifiée dans `now-action.test.ts`, sur
 *    une fonction pure, sans arbre React ni base — dont la table de priorité elle-même ;
 *  - **le rendu** est vérifié ici : chaque `kind` produit-il le bon texte et la bonne action ?
 *
 * Deux exigences comptent plus que les autres, parce que leur violation ne casse aucun test
 * ailleurs et se voit immédiatement à l'écran :
 *  1. la carte **ne rend jamais `null`** — elle est épinglée, et une carte épinglée qui disparaît
 *     réintroduit le trou de mise en page que la grille a mis quatre tentatives à corriger ;
 *  2. l'état « journée faite » **ne propose aucun bouton** : c'est un compte rendu, pas une
 *     injonction.
 *
 * US ACCUEIL-07 — la décision arrive **par props** (l'écran calcule `useNowAction` une fois) ; les
 * repas se peignent un par un, à leur heure ; « rien de prévu » ne propose plus un programme à tout
 * le monde.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { MealSlot, NowAction } from '@wellness/shared';

import { NowCard } from '../NowCard';
import { startWorkoutFromSession } from '@/data/repositories/workout-repository';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('@/data/repositories/workout-repository', () => ({
  startWorkoutFromSession: jest.fn(),
}));
jest.mock('@/hooks/useTodayKey', () => ({ useTodayKey: () => '2026-09-09' }));
jest.mock('@/hooks/useActionLock', () => ({
  // Le verrou réel dédoublonne les appuis ; ici on veut juste que l'action passe.
  useActionLock: () => (fn: () => Promise<void>) => fn(),
}));
jest.mock('@/components/AccentHalo', () => ({ AccentHalo: () => null }));

const mockStart = startWorkoutFromSession as jest.Mock;
const push = jest.fn();
(useRouter as jest.Mock).mockReturnValue({ push });

async function renderCard(
  action: NowAction,
  { isLoading = false, kcalRemaining = null }: { isLoading?: boolean; kcalRemaining?: number | null } = {},
) {
  return render(
    <NowCard
      action={action}
      isLoading={isLoading}
      kcalRemaining={kcalRemaining}
      formatKcal={(n) => `${n}`}
    />,
  );
}

const training = {
  pillar: 'strength' as const,
  name: 'Push — Pecs / Épaules',
  // Stocké en HH:MM:SS en base : la carte doit tronquer, pas afficher les secondes.
  scheduledTime: '18:30:00',
  exerciseCount: 6,
  targetDistanceM: null,
  targetDurationSeconds: null,
  programName: 'PPL',
  plannedSessionId: 'ps-1',
  sessionId: 's-1',
};

const slot = (over: Partial<MealSlot> = {}): MealSlot => ({
  key: 'dinner',
  label: null,
  hour: 20,
  learned: true,
  logged: false,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue({ push });
  mockStart.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Séance planifiée
// ---------------------------------------------------------------------------
describe('séance planifiée du jour', () => {
  it('affiche le nom de la séance et son HEURE, sans les secondes', async () => {
    // L'heure est stockée depuis HORAIRE-01 et n'était affichée nulle part. La maquette validée
    // l'annonçait pourtant (« SÉANCE DU JOUR · 18:30 ») depuis l'origine.
    await renderCard({ kind: 'session-today', training });

    expect(screen.getByText('Push — Pecs / Épaules')).toBeTruthy();
    expect(screen.getByText(/18:30/)).toBeTruthy();
    // La base stocke `HH:MM:SS` : sans troncature, la carte annoncerait « 18:30:00 ».
    expect(screen.queryByText(/18:30:00/)).toBeNull();
  });

  it('🔴 affiche le NOMBRE D’EXERCICES et le programme sous le titre', async () => {
    // Défaut vu en recette le 10/09/2026 : la carte n'affichait que le nom du programme. Le hook
    // de collecte portait un champ `detail` pré-formaté qu'il remplissait à `null`, faute d'accès
    // à i18n — la mise en forme est désormais dans ce composant, qui a `t()`.
    await renderCard({ kind: 'session-today', training });

    expect(screen.getByText(/home\.today\.exercises.*6|6 exercices/)).toBeTruthy();
    expect(screen.getByText(/PPL/)).toBeTruthy();
  });

  it('n’invente aucun détail quand la séance n’en porte pas', async () => {
    await renderCard({
      kind: 'session-today',
      training: { ...training, exerciseCount: null, programName: null },
    });

    expect(screen.getByText('Push — Pecs / Épaules')).toBeTruthy();
    expect(screen.queryByText(/exercice/i)).toBeNull();
  });

  it('démarre la séance de musculation au tap', async () => {
    await renderCard({ kind: 'session-today', training });

    fireEvent.press(screen.getByText('Démarrer la séance'));
    expect(mockStart).toHaveBeenCalledWith('s-1', { plannedSessionId: 'ps-1' });
  });

  it('route vers la course, et non vers une séance de muscu, pour un entraînement running', async () => {
    // Le défaut central que cette US corrige : le widget d'avant appelait
    // `useTodaySession('strength')` avec le pilier EN DUR.
    await renderCard({
      kind: 'session-today',
      training: { ...training, pillar: 'running', name: 'Sortie longue', plannedSessionId: 'ps-9' },
    });

    fireEvent.press(screen.getByText('Démarrer la course'));
    expect(mockStart).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith({
      pathname: '/run',
      params: { plannedSessionId: 'ps-9' },
    });
  });

  it('se passe de l’heure quand l’occurrence n’en porte pas', async () => {
    await renderCard({ kind: 'session-today', training: { ...training, scheduledTime: null } });
    expect(screen.getByText('Push — Pecs / Épaules')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Ce qui tourne déjà
// ---------------------------------------------------------------------------
describe('activité en cours', () => {
  it('propose de reprendre une séance, sans jamais en démarrer une autre', async () => {
    await renderCard({ kind: 'workout-active', workoutId: 'w-1' });

    fireEvent.press(screen.getByText('Reprendre la séance'));
    expect(push).toHaveBeenCalledWith('/workout');
    // On ne recrée pas une séance par-dessus celle qui tourne.
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('propose de reprendre une course en cours', async () => {
    await renderCard({ kind: 'run-active' });

    fireEvent.press(screen.getByText('Reprendre la course'));
    expect(push).toHaveBeenCalledWith('/run/active');
  });
});

// ---------------------------------------------------------------------------
// Les repas — un par un, à leur heure (ACCUEIL-07)
// ---------------------------------------------------------------------------
describe('repas', () => {
  it('ouvre le sélecteur sur LE BON REPAS, avec la date du jour', async () => {
    // `meal: 'breakfast'` était codé en dur dans le widget nutrition : à 20 h, un appui ouvrait
    // le petit-déjeuner.
    await renderCard({ kind: 'meal-due', meal: slot() });

    fireEvent.press(screen.getByText('Ajouter mon dîner'));
    expect(push).toHaveBeenCalledWith({
      pathname: '/food-picker',
      params: { date: '2026-09-09', meal: 'dinner' },
    });
  });

  it('nomme le repas et annonce son heure HABITUELLE', async () => {
    await renderCard({ kind: 'meal-due', meal: slot({ hour: 20.25 }) });
    expect(screen.getByText('Dîner')).toBeTruthy();
    expect(screen.getByText(/d'habitude vers 20:15/i)).toBeTruthy();
  });

  it('sans historique, ne prétend pas à une habitude', async () => {
    await renderCard({ kind: 'meal-due', meal: slot({ key: 'lunch', hour: 12.5, learned: false }) });
    expect(screen.queryByText(/d'habitude/i)).toBeNull();
    expect(screen.getByText(/vers 12:30/i)).toBeTruthy();
    expect(screen.getByText('Ajouter mon déjeuner')).toBeTruthy();
  });

  it('🔴 dit les kcal restantes, plus « Ta journée n’est pas complète » pour tout le monde', async () => {
    await renderCard({ kind: 'meal-due', meal: slot() }, { kcalRemaining: 1450 });
    expect(screen.getByText(/1450 kcal/)).toBeTruthy();
  });

  it('annonce le prochain repas, et permet de le noter en avance', async () => {
    await renderCard({ kind: 'meal-next', meal: slot({ key: 'lunch', hour: 12.5 }) });
    expect(screen.getByText(/Prochain repas · vers 12:30/i)).toBeTruthy();
    fireEvent.press(screen.getByText('Ajouter mon déjeuner'));
    expect(push).toHaveBeenCalledWith({
      pathname: '/food-picker',
      params: { date: '2026-09-09', meal: 'lunch' },
    });
  });

  it('propose de rattraper un repas manqué', async () => {
    await renderCard({ kind: 'meal-missed', meal: slot({ key: 'breakfast', hour: 8 }) });
    expect(screen.getByText('Petit-déjeuner')).toBeTruthy();
    expect(screen.getByText(/pas encore noté/i)).toBeTruthy();
  });

  it('un repas personnalisé porte SON libellé, jamais une clé technique', async () => {
    await renderCard({ kind: 'meal-due', meal: slot({ key: 'meal-2', label: 'Brunch' }) });
    expect(screen.getByText('Brunch')).toBeTruthy();
    expect(screen.queryByText(/meal-2/)).toBeNull();
  });
});

describe('autres saisies', () => {
  it('mène à la saisie de pesée', async () => {
    await renderCard({ kind: 'weigh-in-due' });
    fireEvent.press(screen.getByText('Enregistrer ma pesée'));
    // US NUTRI-UX03 (Q8) — la pesée est dans l'onglet Poids de Stats, pas sur Régularité.
    expect(push).toHaveBeenCalledWith('/nutrition-stats?tab=weight');
  });

  it('mène au check-in de bien-être', async () => {
    await renderCard({ kind: 'wellbeing-due' });
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
    await renderCard({
      kind: 'day-done',
      tally: { strengthSessions: 1, runs: 0, mealsLogged: 3, streak: 13 },
    });

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(/13/)).toBeTruthy();
  });

  it('n’affiche que ce qui a réellement eu lieu', async () => {
    await renderCard({
      kind: 'day-done',
      tally: { strengthSessions: 0, runs: 2, mealsLogged: 0, streak: 3 },
    });
    // Deux courses, aucune séance de muscu : la carte ne doit pas inventer de séance.
    expect(screen.queryByText(/séance/i)).toBeNull();
  });
});

describe('rien de prévu (constat 2)', () => {
  it('ne rend JAMAIS null, même sans rien à dire', async () => {
    const vue = await renderCard({ kind: 'idle', moment: 'morning', suggestion: 'activity' });
    expect(vue.toJSON()).not.toBeNull();
  });

  it('🔴 un jour de repos propose une activité, pas un programme', async () => {
    await renderCard({ kind: 'idle', moment: 'afternoon', suggestion: 'activity' });
    expect(screen.getByText('Jour de repos')).toBeTruthy();
    expect(screen.queryByText(/programme/i)).toBeNull();
    fireEvent.press(screen.getByText('Noter une activité'));
    expect(push).toHaveBeenCalledWith('/activity');
  });

  it('propose de trouver un programme — à la musculation sans programme seulement', async () => {
    await renderCard({ kind: 'idle', moment: 'morning', suggestion: 'program' });
    fireEvent.press(screen.getByText('Trouver mon programme'));
    expect(push).toHaveBeenCalledWith('/programs');
  });

  it('nutrition seule, rien de noté : le premier repas', async () => {
    await renderCard({ kind: 'idle', moment: 'morning', suggestion: 'meal' });
    fireEvent.press(screen.getByText('Ajouter un repas'));
    expect(push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/food-picker' }));
  });

  it('rend quelque chose même pendant le chargement', async () => {
    // Pas de `return null` : la carte est épinglée, sa cellule ne doit pas apparaître après coup.
    const vue = await renderCard(
      { kind: 'idle', moment: 'morning', suggestion: 'activity' },
      { isLoading: true },
    );
    expect(vue.toJSON()).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// US ACCUEIL-08 — la carte entre dans le fil « Ta journée »
// ---------------------------------------------------------------------------
describe('US ACCUEIL-08 — le sur-titre dit QUAND', () => {
  const at = (hour: number, itemHour: number | null, itemTimeKnown = true) =>
    render(
      <NowCard
        action={{ kind: 'session-today', training }}
        isLoading={false}
        hour={hour}
        itemHour={itemHour}
        itemTimeKnown={itemTimeKnown}
        kcalRemaining={null}
        formatKcal={(n) => `${n}`}
      />,
    );

  it('« À 18:30 · dans 5 h 20 » : l’heure du geste et le temps qui reste', async () => {
    await at(13 + 10 / 60, 18.5);
    expect(screen.getByText(/À 18:30 · dans 5 h 20/)).toBeTruthy();
  });

  it('« Maintenant » dès qu’il reste moins d’un quart d’heure', async () => {
    await at(18.3, 18.5);
    expect(screen.getByText(/^Maintenant/)).toBeTruthy();
  });

  it('🔴 une séance SANS heure ne promet aucun horaire : « Aujourd’hui »', async () => {
    // Le fil la range à 18 h faute de mieux ; annoncer « À 18:00 » serait inventer un rendez-vous.
    await at(9, 18, false);
    expect(screen.getByText(/^Aujourd'hui/)).toBeTruthy();
    expect(screen.queryByText(/18:00/)).toBeNull();
  });
});

describe('US ACCUEIL-08 — les trois gestes que seul le fil connaît', () => {
  it('le check-in du matin se fait DANS la carte, d’un visage', async () => {
    const onPick = jest.fn();
    await render(
      <NowCard
        action={{ kind: 'checkin-due' }}
        isLoading={false}
        hour={8}
        itemHour={7.5}
        kcalRemaining={null}
        formatKcal={(n) => `${n}`}
        checkin={{ onPick, saving: false }}
      />,
    );

    expect(screen.getByText('Comment tu te sens ce matin ?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('checkin-face-4'));
    expect(onPick).toHaveBeenCalledWith(4);
    // Les visages SONT le geste : pas de second bouton pour faire la même chose.
    expect(screen.queryByText(/Faire mon point/)).toBeNull();
  });

  it('la marche suggérée dit combien de pas manquent et ouvre leur suivi', async () => {
    await render(
      <NowCard
        action={{ kind: 'walk-idea', stepsLeft: 3800 }}
        isLoading={false}
        hour={17.5}
        itemHour={17.5}
        kcalRemaining={null}
        formatKcal={(n) => `${n}`}
      />,
    );

    expect(screen.getByText('Une marche ?')).toBeTruthy();
    expect(screen.getByText(/3800 pas/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Voir mes pas'));
    expect(push).toHaveBeenCalledWith('/steps');
  });

  it('🔴 la série en jeu remplace l’action par les vraies sorties — sans astuce', async () => {
    const onWalk = jest.fn();
    await render(
      <NowCard
        action={{ kind: 'wellbeing-due' }}
        isLoading={false}
        hour={21}
        kcalRemaining={null}
        formatKcal={(n) => `${n}`}
        tip={{ key: 'home.tips.proteinGap', params: { grams: 30 }, tag: 'nutrition' }}
        rescue={{
          streak: 12,
          hoursLeft: 3,
          options: [{ kind: 'walk', stepsLeft: 1800, minutes: 15 }, { kind: 'activity' }, { kind: 'joker' }],
          onWalk,
          onActivity: jest.fn(),
          onJoker: jest.fn(),
          busy: false,
          formatSteps: (n) => `${n}`,
        }}
      />,
    );

    expect(screen.getByText(/12 jours en jeu/)).toBeTruthy();
    expect(screen.getByText('Encore 3 heures pour la garder')).toBeTruthy();
    expect(screen.queryByText('Faire mon point du soir')).toBeNull();
    expect(screen.queryByTestId('now-card-tip')).toBeNull();
    await fireEvent.press(screen.getByTestId('streak-rescue-walk'));
    expect(onWalk).toHaveBeenCalled();
  });
});

describe('US ACCUEIL-08 — l’astuce croisée', () => {
  it('se pose sous le geste, avec les deux piliers qui se parlent', async () => {
    await render(
      <NowCard
        action={{ kind: 'meal-due', meal: slot({ key: 'lunch', hour: 12.5 }) }}
        isLoading={false}
        hour={12.5}
        itemHour={12.5}
        kcalRemaining={1200}
        formatKcal={(n) => `${n}`}
        tip={{ key: 'home.tips.beforeStrengthNamed', params: { name: 'Jambes' }, tag: 'strength-nutrition' }}
      />,
    );

    expect(screen.getByTestId('now-card-tip')).toBeTruthy();
    expect(screen.getByText('Muscu × Nutrition')).toBeTruthy();
    expect(screen.getByText('Jambes ce soir : un bon féculent à ce repas.')).toBeTruthy();
  });
});

describe('US ACCUEIL-08 — l’heure vient de l’écran', () => {
  it('🔴 « Ajouter un repas » ouvre le repas de l’heure PASSÉE EN PROP (pas une horloge figée)', async () => {
    // Avant : `new Date()` lu dans le composant. L'écran passe désormais son horloge réactive.
    await render(
      <NowCard
        action={{ kind: 'idle', moment: 'morning', suggestion: 'meal' }}
        isLoading={false}
        hour={8}
        kcalRemaining={null}
        formatKcal={(n) => `${n}`}
      />,
    );
    await fireEvent.press(screen.getByText('Ajouter un repas'));
    expect(push).toHaveBeenCalledWith({ pathname: '/food-picker', params: { date: '2026-09-09', meal: 'breakfast' } });
  });
});
