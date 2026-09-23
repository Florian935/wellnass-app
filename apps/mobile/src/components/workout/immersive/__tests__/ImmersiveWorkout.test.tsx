/**
 * US MUSCU-UX03 — le rendu **immersif** de la séance. Fichier à **1 %** pour 905 lignes.
 *
 * Ce composant ne lit ni n'écrit aucune donnée : tout passe par le `runtime`. C'est ce qui rend le
 * mode basculable en pleine séance sans rien perdre (R-MO-4) — et c'est aussi ce qui le rend
 * testable avec une simple fixture, sans base ni navigation.
 *
 * Ce qu'on vérifie, c'est sa **machine à moments** et ses règles d'affichage, parce qu'aucune n'est
 * évidente et qu'aucune ne produit d'erreur quand elle se trompe :
 *
 * - 🔴 **Le repos reprend la main sur l'effort et le cadran.** Ils appartiennent à la série qui
 *   vient d'être validée : les laisser à l'écran par-dessus un repos qui a démarré ferait taper
 *   des répétitions dans le vide. La remise à zéro se fait **pendant le rendu**, pas dans un effet
 *   — un effet provoquerait un rendu de plus, pendant lequel l'écran d'effort resterait visible.
 * - 🔴 **La cérémonie de clôture suit `runtime.closing`, jamais le bouton.** Depuis MUSCU-FIX02
 *   (23/09/2026), c'est l'écran de séance qui la décide : « Terminer » vit aussi dans le menu ⋮, et
 *   seule l'ancienne phase interne de ce rendu la déclenchait — depuis le menu, la séance se
 *   fermait sans cérémonie. Une séance sans série validée ne se fête toujours pas : c'est
 *   `workout.tsx` qui ne pose alors pas `closing` (verrouillé dans `workout-screen.test.tsx`).
 * - **Le fantôme ne s'affiche qu'à trois conditions réunies** — réglage actif, référence existante,
 *   et au moins une série faite. Sans la troisième, la pastille annonce « +0 kg » au premier écran.
 * - **L'enjeu du record est muet en mode simplifié** : c'est tout l'objet du niveau d'affichage.
 * - **Le pont est toujours au même endroit qu'en classique** (R4-1), y compris le chemin court
 *   « valider sans passer par l'effort ».
 */

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ImmersiveWorkout } from '../ImmersiveWorkout';
import { makeRuntime, seedEntry, type RuntimeOverrides } from '@/test-utils/immersive-runtime';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}|${JSON.stringify(vars)}` : key,
    i18n: { language: 'fr' },
  }),
}));

// Les moments plein écran passent en **sondes** : on veut savoir lequel est monté et avec quoi,
// pas re-tester leur rendu, qui a ses propres fichiers.
jest.mock('../EffortScreen', () => {
  const { Text } = require('react-native');
  return { EffortScreen: () => <Text>SONDE_EFFORT</Text> };
});
jest.mock('../RepDial', () => {
  const { Text } = require('react-native');
  return { RepDial: () => <Text>SONDE_CADRAN</Text> };
});
jest.mock('../ImmersiveRest', () => {
  const { Text } = require('react-native');
  return { ImmersiveRest: () => <Text>SONDE_REPOS</Text> };
});
jest.mock('../SessionClosing', () => {
  const { Text } = require('react-native');
  return { SessionClosing: () => <Text>SONDE_CLOTURE</Text> };
});
jest.mock('../SessionPlanSheet', () => {
  const { Text } = require('react-native');
  return { SessionPlanSheet: ({ visible }: { visible: boolean }) =>
    visible ? <Text>SONDE_PLAN</Text> : null };
});
jest.mock('@/components/workout/SetOptions', () => {
  const { Text } = require('react-native');
  return { SetOptions: () => <Text>SONDE_OPTIONS</Text> };
});
jest.mock('@/hooks/useKeyboardHeight', () => ({ useKeyboardHeight: () => 0 }));

const mount = async (over: RuntimeOverrides = {}) =>
  render(<ImmersiveWorkout runtime={makeRuntime(over)} />);

/**
 * Cherche dans l'arbre rendu le premier nœud portant `accessibilityRole` donné.
 *
 * ⚠️ `getByRole` ne le trouverait pas : RNTL ne résout les rôles que sur les éléments réellement
 * exposés, et une `View` sans `accessible` ne l'est pas. On lit donc l'arbre directement — ce qui
 * vérifie bien ce que le composant **écrit**, à défaut de ce que TalkBack en ferait.
 */
function nodeWithRole(role: string): { accessibilityValue?: unknown } | null {
  const walk = (node: unknown): { accessibilityValue?: unknown } | null => {
    if (!node || typeof node !== 'object') return null;
    const n = node as { props?: Record<string, unknown>; children?: unknown[] };
    if (n.props?.accessibilityRole === role) return n.props as { accessibilityValue?: unknown };
    for (const child of n.children ?? []) {
      const hit = walk(child);
      if (hit) return hit;
    }
    return null;
  };
  return walk(screen.toJSON());
}

/** Lance la série courante : c'est l'entrée du moment « effort ». */
const lancer = async () => {
  await act(async () => fireEvent.press(screen.getByText('immersive.deck.launch')));
};

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// La machine à moments
// ---------------------------------------------------------------------------

describe('les moments', () => {
  it('ouvre sur la scène, pas sur un moment plein écran', async () => {
    await mount();

    expect(screen.getByText('immersive.deck.launch')).toBeTruthy();
    expect(screen.queryByText('SONDE_EFFORT')).toBeNull();
  });

  it('passe à l’effort quand on lance la série', async () => {
    await mount();

    await lancer();

    expect(screen.getByText('SONDE_EFFORT')).toBeTruthy();
  });

  it('affiche le repos plein écran quand il est actif et déplié', async () => {
    await mount({ rest: { active: true, collapsed: false, secondsLeft: 60 } });

    expect(screen.getByText('SONDE_REPOS')).toBeTruthy();
  });

  it('laisse la scène visible quand le repos est replié (spec §5.9)', async () => {
    await mount({ rest: { active: true, collapsed: true, secondsLeft: 60 } });

    expect(screen.queryByText('SONDE_REPOS')).toBeNull();
    expect(screen.getByText('immersive.deck.launch')).toBeTruthy();
  });

  it('🔴 le repos qui démarre reprend la main sur l’effort en cours', async () => {
    const { rerender } = await mount();
    await lancer();
    expect(screen.getByText('SONDE_EFFORT')).toBeTruthy();

    // La série vient d'être validée ailleurs : le repos démarre.
    await act(async () =>
      rerender(
        <ImmersiveWorkout
          runtime={makeRuntime({ rest: { active: true, collapsed: false, secondsLeft: 90 } })}
        />,
      ),
    );

    expect(screen.queryByText('SONDE_EFFORT')).toBeNull();
    expect(screen.getByText('SONDE_REPOS')).toBeTruthy();
  });

  it('revient sur la scène, et non sur l’effort, une fois le repos terminé', async () => {
    const { rerender } = await mount();
    await lancer();
    await act(async () =>
      rerender(
        <ImmersiveWorkout
          runtime={makeRuntime({ rest: { active: true, collapsed: false, secondsLeft: 90 } })}
        />,
      ),
    );
    await act(async () => rerender(<ImmersiveWorkout runtime={makeRuntime()} />));

    expect(screen.queryByText('SONDE_EFFORT')).toBeNull();
    expect(screen.getByText('immersive.deck.launch')).toBeTruthy();
  });

  it('ouvre le plan au montage quand on arrive du brief par « Modifier »', async () => {
    await mount({ openPlanOnMount: true });

    expect(screen.getByText('SONDE_PLAN')).toBeTruthy();
  });

  it('garde le plan fermé au montage ordinaire', async () => {
    await mount();

    expect(screen.queryByText('SONDE_PLAN')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// La clôture
// ---------------------------------------------------------------------------

describe('la clôture', () => {
  /** Toutes les séries faites : le pont devient la clôture (spec §4.3). */
  const tout_fait = {
    entries: [seedEntry('ex-1', 'Développé couché', [{ done: true }, { done: true }])],
    current: null,
    doneSets: 2,
    totalSets: 2,
  };

  it('remplace le pont par la clôture quand tout est validé', async () => {
    await mount(tout_fait);

    expect(screen.getByText('workout.sessionDone')).toBeTruthy();
    expect(screen.getByText('workout.finishSession')).toBeTruthy();
  });

  it('joue la cérémonie dès que l’écran de séance clôt la séance', async () => {
    await mount({ ...tout_fait, closing: true });

    expect(screen.getByText('SONDE_CLOTURE')).toBeTruthy();
  });

  it('🔴 la cérémonie prime sur tout moment en cours — le repos compris', async () => {
    // Clôture depuis le menu ⋮ pendant un repos : la cérémonie doit prendre l'écran.
    await mount({ ...tout_fait, closing: true, rest: { active: true, collapsed: false } });

    expect(screen.getByText('SONDE_CLOTURE')).toBeTruthy();
  });

  it('🔴 le bouton seul ne joue pas la cérémonie : il demande la clôture, l’écran de séance décide', async () => {
    // Sans série validée, `workout.tsx` ouvre une confirmation puis part au bilan sans poser
    // `closing` : il n'y a rien à fêter. Ce rendu ne doit donc jamais se fêter tout seul.
    const onFinish = jest.fn();
    await mount({
      entries: [seedEntry('ex-1', 'Développé couché', [{ done: false }])],
      current: null,
      doneSets: 0,
      totalSets: 1,
      onFinish,
    });

    await act(async () => fireEvent.press(screen.getByText('workout.finishSession')));

    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('SONDE_CLOTURE')).toBeNull();
  });

  it('appelle onFinish dans les deux cas — c’est lui qui ouvre la confirmation', async () => {
    const onFinish = jest.fn();
    await mount({ ...tout_fait, doneSets: 0, onFinish });

    await act(async () => fireEvent.press(screen.getByText('workout.finishSession')));

    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('permet d’ajouter une série depuis l’écran de fin plutôt que de forcer la clôture', async () => {
    const onAddSet = jest.fn();
    await mount({ ...tout_fait, onAddSet });

    await act(async () => fireEvent.press(screen.getByText('workout.addSet')));

    expect(onAddSet).toHaveBeenCalledWith('ex-1');
  });
});

// ---------------------------------------------------------------------------
// L'en-tête
// ---------------------------------------------------------------------------

describe('l’en-tête', () => {
  it('affiche le chrono de séance', async () => {
    await mount({ elapsed: '42:07' });

    expect(screen.getByText('42:07')).toBeTruthy();
  });

  it('chiffre la progression du ruban dans ses attributs d’accessibilité', async () => {
    await mount({ doneSets: 1, totalSets: 4 });

    // ⚠️ `getByRole('progressbar')` ne le trouve PAS, et c'est une information en soi : RNTL ne
    // résout les rôles que sur les éléments réellement exposés, et une `View` sans
    // `accessible` ne l'est pas. Le ruban porte donc son rôle sans que TalkBack l'annonce comme
    // une unité. **Le même motif existe sur quatre composants du dépôt** (`workout.tsx`,
    // `StrengthNowCard`, `ReportPrimitives`, ici) : c'est une convention, pas un oubli local, et
    // la trancher demande un device — à verser à la recette d'accessibilité (CONF-07) plutôt
    // qu'à corriger au jugé dans un lot de tests.
    expect(nodeWithRole('progressbar')?.accessibilityValue).toMatchObject({ min: 0, max: 4, now: 1 });
  });

  it('ne rend aucun ruban pour une séance sans exercice', async () => {
    await mount({ entries: [], current: null, totalSets: 0, doneSets: 0 });

    expect(nodeWithRole('progressbar')).toBeNull();
  });

  it('quitte la séance par la croix', async () => {
    const onLeave = jest.fn();
    await mount({ onLeave });

    await act(async () => fireEvent.press(screen.getByLabelText('workout.leave.later')));

    expect(onLeave).toHaveBeenCalled();
  });

  it('ouvre le menu de séance', async () => {
    const onOpenMenu = jest.fn();
    await mount({ onOpenMenu });

    await act(async () => fireEvent.press(screen.getByLabelText('workout.menu.title')));

    expect(onOpenMenu).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Le fantôme
// ---------------------------------------------------------------------------

describe('le fantôme', () => {
  const avecReference = {
    entries: [seedEntry('ex-1', 'Développé couché', [{ done: true, reps: 10, weightKg: 60 }, {}])],
    doneSets: 1,
    references: {
      'ex-1': { sets: [{ rank: 0, setType: 'normal', reps: 10, weightKg: 50 }], workoutDate: '2026-09-15' },
    },
  };

  it('affiche la pastille d’avance quand les trois conditions sont réunies', async () => {
    await mount(avecReference);

    expect(screen.queryByText(/immersive\.ghost\.pill/)).toBeTruthy();
  });

  it('🔴 ne l’affiche pas avant la première série faite : elle dirait « +0 kg »', async () => {
    await mount({ ...avecReference, doneSets: 0 });

    expect(screen.queryByText(/immersive\.ghost\.pill/)).toBeNull();
  });

  it('ne l’affiche pas quand le réglage est éteint', async () => {
    await mount({
      ...avecReference,
      prefs: { ghost: false, coach: 'sobre', sleep: false, voice: false, haptics: false },
    });

    expect(screen.queryByText(/immersive\.ghost\.pill/)).toBeNull();
  });

  it('ne l’affiche pas sans référence : il n’y a rien à comparer', async () => {
    await mount({ ...avecReference, references: {} });

    expect(screen.queryByText(/immersive\.ghost\.pill/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// La scène
// ---------------------------------------------------------------------------

describe('la scène', () => {
  it('nomme l’exercice courant', async () => {
    await mount();

    expect(screen.getByText('Développé couché')).toBeTruthy();
  });

  it('situe l’exercice dans la séance', async () => {
    await mount({
      entries: [
        seedEntry('ex-1', 'Développé couché', [{}]),
        seedEntry('ex-2', 'Rowing', [{}]),
        seedEntry('ex-3', 'Curl', [{}]),
      ],
    });

    expect(screen.getByText(/immersive\.stage\.exerciseIndex/)).toBeTruthy();
  });

  it('annonce la dernière série de la séance', async () => {
    await mount();

    // Une seule entrée, la série courante est la dernière : c'est le moment le plus fort.
    const entries = [seedEntry('ex-1', 'Développé couché', [{}])];
    await mount({ entries, current: { entry: entries[0]!, rang: 0, set: entries[0]!.sets[0]! } });

    expect(screen.getByText('immersive.stage.lastSet')).toBeTruthy();
  });

  it('dit la réplique du coach à la dernière série', async () => {
    const speak = jest.fn();
    const entries = [seedEntry('ex-1', 'Développé couché', [{}])];
    await mount({ entries, current: { entry: entries[0]!, rang: 0, set: entries[0]!.sets[0]! }, speak });

    expect(speak).toHaveBeenCalled();
  });

  it('affiche les repères disponibles, et seulement eux', async () => {
    await mount({ lastPerfLabel: '60 kg × 10', plannedLabel: null, suggestionLabel: null });

    expect(screen.getByText('60 kg × 10')).toBeTruthy();
    expect(screen.queryByText('workout.plannedShort')).toBeNull();
  });

  it('🔴 tait l’enjeu du record en mode simplifié', async () => {
    await mount({
      level: 'simplified',
      displayWeightKg: 90,
      bests: { 'ex-1': { maxWeightKg: 82.5, estimated1RmKg: 100, bestVolumeKg: 4000 } },
    });

    expect(screen.queryByText(/immersive\.stage\.stake/)).toBeNull();
  });

  it('annonce l’enjeu quand la charge saisie dépasse le record', async () => {
    await mount({
      level: 'normal',
      displayWeightKg: 90,
      bests: { 'ex-1': { maxWeightKg: 82.5, estimated1RmKg: 100, bestVolumeKg: 4000 } },
    });

    expect(screen.getByText(/immersive\.stage\.stake/)).toBeTruthy();
  });

  it('n’annonce aucun enjeu sous le record', async () => {
    await mount({
      displayWeightKg: 60,
      bests: { 'ex-1': { maxWeightKg: 82.5, estimated1RmKg: 100, bestVolumeKg: 4000 } },
    });

    expect(screen.queryByText(/immersive\.stage\.stake/)).toBeNull();
  });

  it('ajoute une série à l’exercice courant depuis la frise', async () => {
    const onAddSet = jest.fn();
    await mount({ onAddSet });

    await act(async () => fireEvent.press(screen.getByLabelText('workout.addSet')));

    expect(onAddSet).toHaveBeenCalledWith('ex-1');
  });

  it('affiche l’état vide d’une séance sans exercice', async () => {
    await mount({ entries: [], current: null, totalSets: 0, doneSets: 0, setChips: [] });

    expect(screen.getByText('workout.empty')).toBeTruthy();
  });

  it('🔴 la séance vide porte le geste suivant : ajouter un exercice', async () => {
    // Recette du 23/09/2026 : l'écran disait « ajoute un premier exercice » sans rien pour le
    // faire — la seule issue était le menu ⋮. Le classique avait sa barre depuis MUSCU-FIX01.
    const onAddExercise = jest.fn();
    await mount({ entries: [], current: null, totalSets: 0, doneSets: 0, setChips: [], onAddExercise });

    await act(async () => fireEvent.press(screen.getByTestId('immersive-add-exercise')));

    expect(onAddExercise).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Le pont — R4-1
// ---------------------------------------------------------------------------

describe('le pont', () => {
  it('annonce la série suivante du même exercice', async () => {
    await mount();

    expect(screen.getByText(/immersive\.deck\.nextSet/)).toBeTruthy();
  });

  it('annonce l’exercice suivant quand la série courante est la dernière du sien', async () => {
    const entries = [seedEntry('ex-1', 'Développé', [{}]), seedEntry('ex-2', 'Rowing', [{}])];
    await mount({ entries, current: { entry: entries[0]!, rang: 0, set: entries[0]!.sets[0]! } });

    expect(screen.getByText(/Rowing/)).toBeTruthy();
  });

  it('offre le chemin court : valider sans passer par l’effort', async () => {
    const onValidate = jest.fn();
    await mount({ onValidate });

    await act(async () => fireEvent.press(screen.getByText('immersive.deck.validateDirectly')));

    expect(onValidate).toHaveBeenCalledTimes(1);
  });

  it('propose d’enchaîner quand la série ouvre un superset', async () => {
    await mount({ chainsToSuperset: true });

    expect(screen.getByText('workout.validateAndChain')).toBeTruthy();
  });

  it('dit la consigne technique au lancement, quand il y en a une', async () => {
    const speak = jest.fn();
    await mount({ cue: 'Omoplates serrées', speak });
    speak.mockClear();

    await lancer();

    expect(speak).toHaveBeenCalled();
  });

  it('🔴 se tait au lancement quand la fiche n’a aucune consigne', async () => {
    const speak = jest.fn();
    const entries = [seedEntry('ex-1', 'Développé', [{}, {}])];
    await mount({ entries, cue: null, speak });
    speak.mockClear();

    await lancer();

    expect(speak).not.toHaveBeenCalled();
  });

  it('ouvre le plan depuis le pont', async () => {
    await mount();

    await act(async () => fireEvent.press(screen.getByText(/immersive\.deck\.nextSet/)));

    expect(screen.getByText('SONDE_PLAN')).toBeTruthy();
  });
});
