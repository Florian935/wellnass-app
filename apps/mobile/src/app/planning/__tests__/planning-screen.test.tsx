/**
 * Planning hebdomadaire (`app/planning/index.tsx`) — le **vrai** écran, monté.
 *
 * Le plus gros écran encore à **0 %** (189 instructions). Il concentre trois choses qu'aucun
 * repository ne voit :
 *
 *  1. **Le glisser-déposer d'une séance (US MUSC-F9).** Le geste lui-même est de la recette, mais
 *     ce qu'il déclenche est du code JS ordinaire, et il est testé ici en pilotant les rappels du
 *     `Gesture.Pan` : mesure des zones **au début du geste** (pas au montage — sinon le dépôt vise
 *     faux dès qu'on a fait défiler), cible calculée par `findDropTarget`, et surtout **R3 : déposer
 *     sur son propre jour n'écrit rien**. Sans cette garde, chaque geste avorté produirait une
 *     écriture et un toast mensonger.
 *  2. **Le statut « manqué » est CALCULÉ, jamais stocké** (`isMissed`) : une séance `planned` dont la
 *     date est passée. Le stocker demanderait un travail de fond quotidien, et l'app serait fausse
 *     dès qu'elle reste fermée deux jours.
 *  3. **Une seule séance active à la fois.** Démarrer depuis le planning alors qu'une séance est
 *     déjà ouverte doit **reprendre** l'existante, pas en créer une seconde — l'app n'en affiche
 *     qu'une, la seconde deviendrait un enregistrement fantôme.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import PlanningScreen from '../index';
import {
  markPlannedSessionDone,
  reschedulePlannedSession,
  skipPlannedSession,
  useMissedSessions,
  useSessionConflicts,
  useWeekPainSignals,
  useWeekPlan,
  setPlannedSessionTime,
} from '@/data/repositories/planned-session-repository';
import { useRunnerProfile } from '@/data/repositories/running-profile-repository';
import {
  startWorkoutFromSession,
  useActiveWorkout,
} from '@/data/repositories/workout-repository';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/planned-session-repository', () => ({
  useWeekPlan: jest.fn(),
  useMissedSessions: jest.fn(),
  useSessionConflicts: jest.fn(() => ({ conflicts: [] })),
  useWeekPainSignals: jest.fn(() => new Map()),
  reschedulePlannedSession: jest.fn(),
  skipPlannedSession: jest.fn(),
  markPlannedSessionDone: jest.fn(),
  // US HORAIRE-01 — pose / retrait de l'heure d'une occurrence.
  setPlannedSessionTime: jest.fn(),
}));
jest.mock('@/data/repositories/running-profile-repository', () => ({
  useRunnerProfile: jest.fn(() => ({ runnerProfile: null })),
}));
jest.mock('@/data/repositories/workout-repository', () => ({
  useActiveWorkout: jest.fn(() => ({ workout: null })),
  startWorkoutFromSession: jest.fn(),
}));

/**
 * Le geste n'est pas rejouable hors device, mais **ses rappels sont du JS ordinaire**. Le builder
 * mémorise `onStart` / `onUpdate` / `onEnd` et les expose via `__gestes`, ce qui permet de rejouer
 * un glissement complet sans toucher au natif. Un `Gesture.Pan` est créé **par rendu de ligne** :
 * les derniers de la liste correspondent donc au dernier rendu (voir `gestesDuDernierRendu`).
 */
/**
 * ⚠️ **`View` est remplacée par une version MESURABLE.** Le glisser-déposer repose sur
 * `ref.measureInWindow`, une API native : sous Jest, une `ref` de composant hôte vaut `null`
 * (react-test-renderer), et RNTL 14 a **supprimé `createNodeMock`, le levier historique**. Sans ce
 * mock, `measureZones` résout sept zones de hauteur 0, `findDropTarget` renvoie toujours `null`, et
 * **tous** les tests de dépôt passent au vert sans rien prouver — y compris ceux censés vérifier
 * qu'on n'écrit PAS. C'est le piège du §3 : un test vert parce que le code testé ne s'exécute pas.
 *
 * La géométrie posée ici est délibérément simple : le jour d'index `i` occupe `[i·100, i·100+100[`.
 */
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  const React = require('react');
  const ViewMesurable = React.forwardRef(
    (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({
        measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => {
          const i = (globalThis as { __mesures?: number }).__mesures ?? 0;
          (globalThis as { __mesures?: number }).__mesures = i + 1;
          cb(0, (i % 7) * 100, 320, 100);
        },
      }));
      return React.createElement(RN.View, props);
    },
  );
  ViewMesurable.displayName = 'ViewMesurable';
  return new Proxy(RN, {
    get: (cible, prop) => (prop === 'View' ? ViewMesurable : Reflect.get(cible, prop)),
  });
});

jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  const gestes: Record<string, ((...args: unknown[]) => void) | boolean>[] = [];
  const creerPan = () => {
    const rappels: Record<string, ((...args: unknown[]) => void) | boolean> = {};
    const builder = {
      enabled: (v: boolean) => {
        rappels.enabled = v;
        return builder;
      },
      activateAfterLongPress: () => builder,
      onStart: (fn: () => void) => {
        rappels.onStart = fn;
        return builder;
      },
      onUpdate: (fn: (e: unknown) => void) => {
        rappels.onUpdate = fn;
        return builder;
      },
      onEnd: (fn: (e: unknown) => void) => {
        rappels.onEnd = fn;
        return builder;
      },
      onFinalize: (fn: () => void) => {
        rappels.onFinalize = fn;
        return builder;
      },
    };
    gestes.push(rappels);
    return builder;
  };
  return {
    __gestes: gestes,
    Gesture: { Pan: creerPan },
    GestureDetector: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    runOnJS: (fn: unknown) => fn,
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Medium: 'medium', Light: 'light' },
}));

jest.mock('@/components/Screen', () => {
  const { View } = require('react-native');
  return { Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/ScreenHeader', () => {
  const { Text } = require('react-native');
  return { ScreenHeader: ({ title }: { title: string }) => <Text>{title}</Text> };
});
jest.mock('@/components/EmptyState', () => {
  const { Text, View } = require('react-native');
  return {
    EmptyState: ({ message }: { message: string }) => (
      <View>
        <Text>{message}</Text>
      </View>
    ),
  };
});
jest.mock('@/components/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});
/** Les deux bannières ont leurs propres tests : sondes ici, pour prouver le rattachement au jour. */
jest.mock('@/components/planning/SessionConflictBanner', () => {
  const { Pressable, Text } = require('react-native');
  return {
    SessionConflictBanner: ({
      conflict,
      onSwap,
    }: {
      conflict: { runSessionId: string; runDayKey: string };
      onSwap: (t: string) => void;
    }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`conflit-${conflict.runSessionId}`}
        onPress={() => onSwap('2026-08-14')}
      >
        <Text>conflit-{conflict.runDayKey}</Text>
      </Pressable>
    ),
  };
});
jest.mock('@/components/planning/PainSignalBanner', () => {
  const { Text } = require('react-native');
  return {
    PainSignalBanner: ({ signal }: { signal: { id: string } }) => <Text>douleur-{signal.id}</Text>,
  };
});

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      background: '#fffaf2',
      surface: '#fffaf2',
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      accent: '#c0562f',
    },
  }),
}));

jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    formatDistance: (km: number) => `${km} km`,
    formatPace: (s: number) => `${s}s`,
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const { __gestes: gestes } = jest.requireMock('react-native-gesture-handler') as {
  __gestes: Record<string, ((...args: never[]) => void) | boolean>[];
};

const mockWeekPlan = useWeekPlan as jest.Mock;
const mockMissed = useMissedSessions as jest.Mock;
const mockConflicts = useSessionConflicts as jest.Mock;
const mockPain = useWeekPainSignals as jest.Mock;
const mockReschedule = reschedulePlannedSession as jest.Mock;
const mockSkip = skipPlannedSession as jest.Mock;
const mockDone = markPlannedSessionDone as jest.Mock;
const mockRunner = useRunnerProfile as jest.Mock;
const mockActive = useActiveWorkout as jest.Mock;
const mockStart = startWorkoutFromSession as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();

/**
 * Semaine de référence : **lundi 10/08/2026**, « aujourd'hui » mercredi 12/08.
 * L'horloge est figée — le statut « manqué » se calcule par comparaison à aujourd'hui, un test
 * qui lit l'heure réelle changerait de verdict chaque jour.
 */
const AUJOURDHUI = '2026-08-12';

const seance = (overrides: Record<string, unknown> = {}) => ({
  id: 'ps-1',
  programId: 'p-1',
  sessionId: 's-1',
  scheduledDate: AUJOURDHUI,
  status: 'planned' as const,
  weekIndex: 0,
  sessionName: 'Haut du corps',
  sessionType: null,
  targetDistanceM: null,
  targetDurationSeconds: null,
  orderIndex: 0,
  pillar: 'strength' as const,
  exerciseCount: 5,
  ...overrides,
});

/**
 * Compteur d'appels à `measureInWindow`, tenu par la `View` mesurable (voir le mock plus haut).
 * `measureZones` mesure les 7 jours **dans l'ordre**, donc le k-ième appel décrit le k-ième jour.
 */
const nbMesures = () => (globalThis as { __mesures?: number }).__mesures ?? 0;

const afficher = async ({
  items = [seance()],
  missed = [],
}: { items?: unknown[]; missed?: unknown[] } = {}) => {
  mockWeekPlan.mockReturnValue({ items });
  mockMissed.mockReturnValue({ items: missed });
  (globalThis as { __mesures?: number }).__mesures = 0;
  await render(<PlanningScreen />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

/** Ouvre la feuille d'actions de la séance nommée. */
const ouvrirFeuille = async (nom: string) => {
  await taper(screen.getByLabelText(nom));
};

/** Les gestes créés par le DERNIER rendu (un `Gesture.Pan` par ligne, dans l'ordre d'affichage). */
const gestesDuDernierRendu = (nbLignes: number) => gestes.slice(-nbLignes);

/** Rejoue un glissement complet : appui long, déplacement, dépôt à `yFinal`. */
const glisser = async (geste: (typeof gestes)[number], yFinal: number) => {
  await act(async () => {
    (geste.onStart as () => void)();
  });
  await act(async () => {
    (geste.onUpdate as (e: unknown) => void)({ translationX: 0, translationY: 40, absoluteY: yFinal });
  });
  await act(async () => {
    (geste.onEnd as (e: unknown) => void)({ absoluteY: yFinal });
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  gestes.length = 0;
  jest.useFakeTimers();
  jest.setSystemTime(new Date(`${AUJOURDHUI}T10:00:00`));
  mockUseRouter.mockReturnValue({ push });
  mockConflicts.mockReturnValue({ conflicts: [] });
  mockPain.mockReturnValue(new Map());
  mockRunner.mockReturnValue({ runnerProfile: null });
  mockActive.mockReturnValue({ workout: null });
  mockReschedule.mockResolvedValue(undefined);
  mockSkip.mockResolvedValue(undefined);
  mockDone.mockResolvedValue(undefined);
  mockStart.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Semaine affichée
// ---------------------------------------------------------------------------

describe('semaine affichée', () => {
  it('ouvre sur la semaine COURANTE, du lundi au dimanche', async () => {
    await afficher();

    // Ouvrir sur le lundi de la semaine en cours, et non sur aujourd'hui : un planning qui commence
    // un mercredi rend les deux jours passés invisibles.
    expect(screen.getByText(`planning.weekOf:{"date":"10/08/2026"}`)).toBeTruthy();
    expect(screen.getByText('common.weekday.mon · 10/08/2026')).toBeTruthy();
    expect(screen.getByText('common.weekday.sun · 16/08/2026')).toBeTruthy();
  });

  it('🔴 les flèches déplacent la semaine de SEPT jours', async () => {
    await afficher();

    await taper(screen.getByLabelText('planning.nextWeek'));
    expect(screen.getByText('planning.weekOf:{"date":"17/08/2026"}')).toBeTruthy();

    await taper(screen.getByLabelText('planning.prevWeek'));
    await taper(screen.getByLabelText('planning.prevWeek'));

    // La semaine est la maille : avancer d'un jour décalerait la grille lundi→dimanche.
    expect(screen.getByText('planning.weekOf:{"date":"03/08/2026"}')).toBeTruthy();
  });

  it('🔴 changer de semaine REDEMANDE le plan de cette semaine', async () => {
    await afficher();

    await taper(screen.getByLabelText('planning.nextWeek'));

    // Sans ce paramètre, l'écran afficherait la semaine suivante avec les séances de la courante.
    expect(mockWeekPlan).toHaveBeenLastCalledWith('2026-08-17');
  });

  it('un jour sans séance est marqué « repos », pas laissé vide', async () => {
    await afficher();

    // Six jours de repos sur sept : un blanc se lirait comme un défaut de chargement.
    expect(screen.getAllByText('planning.restDay')).toHaveLength(6);
  });

  it('le planning entièrement vide affiche un état vide, sans indice de geste', async () => {
    await afficher({ items: [], missed: [] });

    expect(screen.getByText('planning.empty')).toBeTruthy();
    // Inviter à glisser une carte quand il n'y en a aucune serait une consigne sans objet.
    expect(screen.queryByText('planning.dragHint')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Lignes de séance
// ---------------------------------------------------------------------------

describe('ligne de séance', () => {
  it('une séance muscu affiche son nom et son nombre d’exercices', async () => {
    await afficher({ items: [seance({ sessionName: 'Haut du corps', exerciseCount: 5 })] });

    expect(screen.getByLabelText('Haut du corps')).toBeTruthy();
    expect(screen.getByText('workout.exerciseCount:{"count":5}')).toBeTruthy();
  });

  it('🔴 une séance muscu SANS nom retombe sur son rang, 1-indexé', async () => {
    await afficher({ items: [seance({ sessionName: '   ', orderIndex: 2 })] });

    // `orderIndex + 1` : afficher « Séance 2 » pour la troisième serait un décalage permanent.
    expect(screen.getByText('programs.detail.sessionFallback:{"index":3}')).toBeTruthy();
  });

  it('une séance running affiche son type, sa cible et son allure', async () => {
    mockRunner.mockReturnValue({ runnerProfile: { ref5kPaceSPerKm: 300 } });
    await afficher({
      items: [
        seance({ pillar: 'running', sessionType: 'endurance', targetDistanceM: 8000 }),
      ],
    });

    expect(screen.getByLabelText('running.sessionType.endurance')).toBeTruthy();
    expect(screen.getByText('8 km')).toBeTruthy();
    expect(screen.getByText(/^\d+s – \d+s$/)).toBeTruthy();
  });

  it('🔴 sans profil coureur, l’allure est remplacée par une invite', async () => {
    await afficher({ items: [seance({ pillar: 'running', sessionType: 'endurance' })] });

    expect(screen.getByText('planning.noProfileHint')).toBeTruthy();
  });

  it('🔴 le nombre d’exercices n’apparaît PAS sur une séance running', async () => {
    await afficher({ items: [seance({ pillar: 'running', exerciseCount: 5 })] });

    // Une course n'a pas d'exercices : le champ existe en base pour la muscu, l'afficher ici
    // donnerait « 5 exercices » sur une sortie longue.
    expect(screen.queryByText(/exerciseCount/)).toBeNull();
  });

  it('la cible en durée est arrondie à la minute, la distance prime', async () => {
    await afficher({
      items: [
        seance({
          pillar: 'running',
          targetDistanceM: 8000,
          targetDurationSeconds: 1800,
        }),
      ],
    });

    expect(screen.getByText('8 km')).toBeTruthy();
    expect(screen.queryByText('30 min')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Statuts
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// US HORAIRE-01 — heure de la séance (roadmap 2.4)
// ---------------------------------------------------------------------------

describe('HORAIRE-01 — heure de la séance', () => {
  it('n’affiche aucune heure quand la séance n’en a pas', async () => {
    await afficher({ items: [seance()] });

    // « Pas d'heure » est l'état normal (D1), pas un trou à signaler dans la liste : la ligne reste
    // muette, et c'est la feuille d'actions qui offre d'en poser une.
    expect(screen.queryByText('18:30')).toBeNull();
  });

  it('affiche l’heure en HH:MM, jamais le HH:MM:SS de la base', async () => {
    await afficher({ items: [seance({ scheduledTime: '18:30:00' })] });

    // R8 : la base rend un `time` en `HH:MM:SS`. L'afficher tel quel donnerait « 18:30:00 ».
    expect(screen.getByText('18:30')).toBeTruthy();
    expect(screen.queryByText('18:30:00')).toBeNull();
  });

  it('🔴 survit à une séance dont le champ d’heure est ABSENT', async () => {
    // Le type annonce `string | null`, mais une ligne construite sans le champ rend `undefined` —
    // et `undefined !== null` est vrai. Un garde écrit `!== null` faisait lever `.slice` sur
    // 43 tests d'écran. Une valeur absente est absente, quelle que soit sa forme.
    const sansChamp = seance();
    delete (sansChamp as Record<string, unknown>).scheduledTime;

    await afficher({ items: [sansChamp] });

    expect(screen.getByLabelText('Haut du corps')).toBeTruthy();
  });

  it('propose de définir une heure depuis la feuille d’actions', async () => {
    await afficher({ items: [seance()] });
    await ouvrirFeuille('Haut du corps');

    expect(screen.getByText('planning.timeSet')).toBeTruthy();
    // Pas de stepper tant qu'aucune heure n'existe : un sélecteur affiché sans valeur laisserait
    // croire qu'une heure est déjà posée.
    expect(screen.queryByText('planning.timeClear')).toBeNull();
  });

  it('🔴 pose 18:00 au premier appui, et n’ouvre pas un sélecteur vide', async () => {
    await afficher({ items: [seance()] });
    await ouvrirFeuille('Haut du corps');

    await taper(screen.getByText('planning.timeSet'));

    // 18 h 00 plutôt que minuit : partir de minuit obligerait presque tout le monde à remonter de
    // dix-huit crans.
    expect(setPlannedSessionTime).toHaveBeenCalledWith('ps-1', '18:00');
  });

  it('🔴 offre de RETIRER l’heure quand il y en a une (D7)', async () => {
    await afficher({ items: [seance({ scheduledTime: '18:30:00' })] });
    await ouvrirFeuille('Haut du corps');

    // Sans cette action, poser une heure serait irréversible et le régime d'échéance apprise
    // inatteignable une fois qu'on en est sorti.
    expect(screen.getByText('planning.timeClear')).toBeTruthy();
    expect(screen.queryByText('planning.timeSet')).toBeNull();
  });

  it('🔴 retirer l’heure écrit `null`, pas une chaîne vide', async () => {
    await afficher({ items: [seance({ scheduledTime: '18:30:00' })] });
    await ouvrirFeuille('Haut du corps');

    await taper(screen.getByText('planning.timeClear'));

    expect(setPlannedSessionTime).toHaveBeenCalledWith('ps-1', null);
  });

  it('avance l’heure de cinq minutes au tap sur « + »', async () => {
    await afficher({ items: [seance({ scheduledTime: '18:30:00' })] });
    await ouvrirFeuille('Haut du corps');

    await taper(screen.getByLabelText('planning.increaseMinute'));

    expect(setPlannedSessionTime).toHaveBeenCalledWith('ps-1', '18:35');
  });

  it('🔴 les minutes BOUCLENT sans changer l’heure', async () => {
    await afficher({ items: [seance({ scheduledTime: '18:55:00' })] });
    await ouvrirFeuille('Haut du corps');

    await taper(screen.getByLabelText('planning.increaseMinute'));

    // Le stepper des minutes ne touche pas les heures : 18:55 + 5 donne 18:00, pas 19:00. C'est
    // délibéré — deux commandes indépendantes valent mieux qu'un report implicite.
    expect(setPlannedSessionTime).toHaveBeenCalledWith('ps-1', '18:00');
  });

  it('les heures bouclent aussi (23 → 00)', async () => {
    await afficher({ items: [seance({ scheduledTime: '23:15:00' })] });
    await ouvrirFeuille('Haut du corps');

    await taper(screen.getByLabelText('planning.increaseHour'));

    expect(setPlannedSessionTime).toHaveBeenCalledWith('ps-1', '00:15');
  });

  it('affiche l’avertissement de précision (conséquence de D5)', async () => {
    await afficher({ items: [seance()] });
    await ouvrirFeuille('Haut du corps');

    // Sans lui, un rappel arrivé à 17 h 50 pour 18 h passe pour un bug.
    expect(screen.getByText('planning.timeHint')).toBeTruthy();
  });

  it('🔴 n’offre pas de régler l’heure d’une séance déjà faite', async () => {
    await afficher({ items: [seance({ status: 'done', scheduledTime: '18:30:00' })] });
    await ouvrirFeuille('Haut du corps');

    // Une séance faite ne se convoque plus : offrir le réglage serait une impasse.
    expect(screen.queryByText('planning.timeLabel')).toBeNull();
  });
});

describe('statuts', () => {
  it('🔴 « manqué » est CALCULÉ : planifiée + date passée', async () => {
    await afficher({ items: [seance({ scheduledDate: '2026-08-10', status: 'planned' })] });

    // Jamais stocké : le stocker demanderait un travail de fond quotidien, et l'app serait fausse
    // dès qu'elle reste fermée deux jours.
    expect(screen.getByText('planning.statusMissed')).toBeTruthy();
  });

  it('🔴 une séance FAITE dans le passé n’est pas « manquée »', async () => {
    await afficher({ items: [seance({ scheduledDate: '2026-08-10', status: 'done' })] });

    expect(screen.getByText('planning.statusDone')).toBeTruthy();
    expect(screen.queryByText('planning.statusMissed')).toBeNull();
  });

  it('une séance planifiée AUJOURD’HUI n’est pas encore manquée', async () => {
    await afficher({ items: [seance({ scheduledDate: AUJOURDHUI })] });

    // Le jour n'est pas fini : la marquer manquée le matin serait un reproche anticipé.
    expect(screen.queryByText('planning.statusMissed')).toBeNull();
  });

  it('une séance à venir n’affiche aucun statut', async () => {
    await afficher({ items: [seance({ scheduledDate: '2026-08-15' })] });

    expect(screen.queryByText(/planning\.status/)).toBeNull();
  });

  it('une séance sautée est barrée et annoncée', async () => {
    await afficher({ items: [seance({ status: 'skipped' })] });

    expect(screen.getByText('planning.statusSkipped')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Bannière des séances manquées
// ---------------------------------------------------------------------------

describe('séances manquées', () => {
  it('la bannière compte les séances et affiche leur date', async () => {
    await afficher({
      items: [],
      missed: [
        seance({ id: 'm-1', scheduledDate: '2026-08-05' }),
        seance({ id: 'm-2', scheduledDate: '2026-08-06' }),
      ],
    });

    expect(screen.getByText('planning.missedCount:{"count":2}')).toBeTruthy();
    // La date est indispensable hors grille : « Haut du corps » manqué, mais quand ?
    expect(screen.getByText('05/08/2026')).toBeTruthy();
  });

  it('aucune bannière quand rien n’est manqué', async () => {
    await afficher();

    expect(screen.queryByText('planning.missedTitle')).toBeNull();
  });

  it('🔴 des séances manquées suffisent à sortir de l’état vide', async () => {
    await afficher({ items: [], missed: [seance({ id: 'm-1' })] });

    // Une semaine sans séance mais avec des retards n'est pas un planning vide : afficher
    // « rien de prévu » masquerait précisément ce qu'il reste à faire.
    expect(screen.queryByText('planning.empty')).toBeNull();
    expect(screen.getByText('planning.missedTitle')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Coordination et bannières
// ---------------------------------------------------------------------------

describe('coordination du jour', () => {
  it('🔴 l’indicateur apparaît à partir de DEUX séances le même jour', async () => {
    await afficher({
      items: [seance({ id: 'a' }), seance({ id: 'b' })],
    });

    expect(screen.getByText('planning.multipleSameDay:{"count":2}')).toBeTruthy();
  });

  it('🔴 les séances SAUTÉES ne comptent pas dans l’indicateur', async () => {
    await afficher({
      items: [seance({ id: 'a' }), seance({ id: 'b', status: 'skipped' })],
    });

    // Compter une séance sautée avertirait d'une double charge que l'utilisateur a justement
    // décidé de ne pas porter.
    expect(screen.queryByText(/multipleSameDay/)).toBeNull();
  });

  it('une séance faite compte, elle : la charge a bien eu lieu', async () => {
    await afficher({
      items: [seance({ id: 'a' }), seance({ id: 'b', status: 'done' })],
    });

    expect(screen.getByText('planning.multipleSameDay:{"count":2}')).toBeTruthy();
  });

  it('🔴 une bannière de conflit se rattache au JOUR de la course', async () => {
    mockConflicts.mockReturnValue({
      conflicts: [{ runSessionId: 'r-1', runDayKey: '2026-08-13' }],
    });
    await afficher();

    expect(screen.getByText('conflit-2026-08-13')).toBeTruthy();
  });

  it('échanger depuis la bannière de conflit replanifie la COURSE', async () => {
    mockConflicts.mockReturnValue({
      conflicts: [{ runSessionId: 'r-1', runDayKey: '2026-08-13' }],
    });
    await afficher();

    await taper(screen.getByLabelText('conflit-r-1'));

    // C'est la course qu'on déplace, pas la séance de muscu : l'ordre muscu → course est ce que
    // l'utilisateur a planifié, le conflit vient de leur proximité.
    expect(mockReschedule).toHaveBeenCalledWith('r-1', '2026-08-14');
  });

  it('un signal de douleur s’affiche sur SA séance', async () => {
    mockPain.mockReturnValue(new Map([['ps-1', { id: 'sig-1' }]]));
    await afficher();

    expect(screen.getByText('douleur-sig-1')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Feuille d'actions
// ---------------------------------------------------------------------------

describe('feuille d’actions', () => {
  it('marquer comme faite ferme la feuille et écrit', async () => {
    await afficher();

    await ouvrirFeuille('Haut du corps');
    await taper(screen.getByLabelText('planning.markDoneQuick'));

    expect(mockDone).toHaveBeenCalledWith('ps-1');
    // La feuille se ferme AVANT l'écriture : offline-first optimiste, l'utilisateur n'attend pas.
    expect(screen.queryByLabelText('planning.markDoneQuick')).toBeNull();
  });

  it('sauter une séance ferme la feuille et écrit', async () => {
    await afficher();

    await ouvrirFeuille('Haut du corps');
    await taper(screen.getByLabelText('planning.skip'));

    expect(mockSkip).toHaveBeenCalledWith('ps-1');
  });

  it.each([
    ['planning.rescheduleToday', AUJOURDHUI],
    ['planning.rescheduleTomorrow', '2026-08-13'],
    ['planning.reschedulePlus7', '2026-08-19'],
  ])('%s replanifie au %s', async (label, cible) => {
    await afficher();

    await ouvrirFeuille('Haut du corps');
    await taper(screen.getByLabelText(label));

    // Les trois raccourcis partent d'AUJOURD'HUI, pas de la date de la séance : « demain » d'une
    // séance manquée la semaine dernière doit tomber demain, pas mardi dernier.
    expect(mockReschedule).toHaveBeenCalledWith('ps-1', cible);
  });

  it('🔴 « démarrer » n’est proposé que sur une séance MUSCU planifiée', async () => {
    await afficher({ items: [seance({ pillar: 'running' })] });

    await ouvrirFeuille('Haut du corps');

    // Une course se démarre depuis l'écran running (GPS, capteurs) : un bouton ici mènerait à un
    // enregistrement de musculation pour une sortie.
    expect(screen.queryByLabelText('planning.start')).toBeNull();
    expect(screen.getByLabelText('planning.markDoneQuick')).toBeTruthy();
  });

  it('🔴 ni sur une séance DÉJÀ faite', async () => {
    await afficher({ items: [seance({ status: 'done' })] });

    await ouvrirFeuille('Haut du corps');

    expect(screen.queryByLabelText('planning.start')).toBeNull();
  });

  it('démarrer crée la séance en la RATTACHANT à la planification', async () => {
    await afficher();

    await ouvrirFeuille('Haut du corps');
    await taper(screen.getByLabelText('planning.start'));

    // `plannedSessionId` : sans lui, la séance réalisée ne serait jamais reliée à la case du
    // planning, qui resterait « planifiée » pour toujours.
    expect(mockStart).toHaveBeenCalledWith('s-1', { plannedSessionId: 'ps-1' });
    expect(push).toHaveBeenCalledWith('/workout');
  });

  it('🔴 une séance DÉJÀ active est REPRISE, pas doublée', async () => {
    mockActive.mockReturnValue({ workout: { id: 'w-en-cours' } });
    await afficher();

    await ouvrirFeuille('Haut du corps');
    await taper(screen.getByLabelText('workout.resume'));

    // L'app n'affiche qu'une séance active : en créer une seconde produirait un enregistrement
    // fantôme que rien ne rouvrirait jamais.
    expect(mockStart).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/workout');
  });

  it('un échec de démarrage ne navigue pas', async () => {
    mockStart.mockRejectedValue(new Error('hors ligne'));
    await afficher();

    await ouvrirFeuille('Haut du corps');
    await taper(screen.getByLabelText('planning.start'));

    expect(push).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Glisser-déposer (US MUSC-F9)
// ---------------------------------------------------------------------------

describe('glisser-déposer', () => {
  it('🔴 déposer sur un AUTRE jour replanifie et confirme', async () => {
    await afficher();

    // La séance est mercredi (index 2) ; on la dépose sur vendredi (index 4 → y ∈ [400, 500[).
    await glisser(gestesDuDernierRendu(1)[0]!, 450);

    expect(mockReschedule).toHaveBeenCalledWith('ps-1', '2026-08-14');
    expect(screen.getByText('planning.movedTo:{"date":"14/08/2026"}')).toBeTruthy();
  });

  it('🔴 déposer sur SON PROPRE jour n’écrit RIEN (R3)', async () => {
    await afficher();

    // Mercredi = index 2 → y ∈ [200, 300[.
    await glisser(gestesDuDernierRendu(1)[0]!, 250);

    // Sans cette garde, chaque geste avorté produirait une écriture et un toast mensonger.
    expect(mockReschedule).not.toHaveBeenCalled();
    expect(screen.queryByText(/planning\.movedTo/)).toBeNull();
  });

  it('🔴 déposer HORS des zones n’écrit rien', async () => {
    await afficher();

    // Au-delà du dimanche (index 6 → jusqu'à 700) : aucune zone ne contient ce point.
    await glisser(gestesDuDernierRendu(1)[0]!, 2000);

    expect(mockReschedule).not.toHaveBeenCalled();
  });

  it('🔴 les zones sont mesurées AU DÉBUT du geste, pas au montage', async () => {
    await afficher();

    const geste = gestesDuDernierRendu(1)[0]!;
    // Aucune mesure tant que le geste n'a pas commencé.
    expect(nbMesures()).toBe(0);

    await act(async () => {
      (geste.onStart as () => void)();
    });

    // Sept zones mesurées à l'instant du geste : mesurer au montage viserait faux dès que
    // l'utilisateur a fait défiler l'écran.
    expect(nbMesures()).toBe(7);
  });

  it('🔴 une séance FAITE n’est pas saisissable (R1)', async () => {
    await afficher({ items: [seance({ status: 'done' })] });

    // `enabled(canDrag)` : déplacer une séance déjà réalisée n'a pas de sens, sa date est un fait.
    expect(gestesDuDernierRendu(1)[0]!.enabled).toBe(false);
  });

  it('une séance planifiée l’est', async () => {
    await afficher();

    expect(gestesDuDernierRendu(1)[0]!.enabled).toBe(true);
  });

  it('🔴 les séances de la bannière « manquées » ne sont PAS saisissables', async () => {
    await afficher({ items: [], missed: [seance({ id: 'm-1' })] });

    // Hors périmètre de MUSC-F9 : la bannière n'est pas une zone de dépôt, un glissement depuis
    // elle n'aurait aucune cible de départ.
    expect(gestesDuDernierRendu(1)[0]!.enabled).toBe(false);
  });

  it('le toast disparaît de lui-même', async () => {
    await afficher();

    await glisser(gestesDuDernierRendu(1)[0]!, 450);
    expect(screen.getByText(/planning\.movedTo/)).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(2500);
    });

    // Un toast permanent finirait par décrire un déplacement fait dix minutes plus tôt.
    expect(screen.queryByText(/planning\.movedTo/)).toBeNull();
  });

  it('🔴 un échec d’écriture ne fait PAS revenir la carte', async () => {
    mockReschedule.mockRejectedValue(new Error('hors ligne'));
    await afficher();

    await glisser(gestesDuDernierRendu(1)[0]!, 450);

    // Écriture optimiste : la base locale est la vérité, la synchro repartira. Annuler l'affichage
    // sur un échec réseau ferait sauter la carte devant l'utilisateur pour rien.
    expect(screen.getByText(/planning\.movedTo/)).toBeTruthy();
  });
});
