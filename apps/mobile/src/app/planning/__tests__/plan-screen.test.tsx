/**
 * Planification d'un programme (`app/planning/plan.tsx`) — le **vrai** écran, monté.
 *
 * Écran à **0 %** avant ce fichier (86 instructions). C'est le seul endroit de l'app qui **génère
 * des séances en masse** : durée × nombre de séances, soit couramment plusieurs dizaines de lignes
 * en une pression. Les garde-fous testés ici sont donc ceux d'une écriture irréversible en pratique.
 *
 *  1. **Rien ne part tant que TOUTES les séances n'ont pas de jour.** Une séance sans jour ne serait
 *     simplement pas planifiée : l'utilisateur croirait avoir posé son programme entier et
 *     découvrirait le trou trois semaines plus tard.
 *  2. **Activer un second programme demande quoi faire de l'ancien** — supprimer ses séances futures
 *     ou les garder. Trancher à sa place produirait soit une perte silencieuse, soit un planning
 *     illisible où deux programmes se superposent.
 *  3. **Le défaut de départ est LUNDI PROCHAIN**, pas aujourd'hui : planifier une semaine déjà
 *     entamée poserait des séances sur des jours passés, immédiatement « manquées ».
 *  4. **« Programme introuvable » n'est pas un cul-de-sac.** Cet écran n'a pas d'en-tête de
 *     navigation (`headerShown: false`) : sans bouton de retour explicite, l'utilisateur est coincé.
 *     Constaté le 30/07/2026.
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import PlanScreen from '../plan';
import { useActiveProgram, useProgramDetail } from '@/data/repositories/program-repository';
import { planProgram } from '@/data/repositories/planned-session-repository';
import { useRunnerProfile } from '@/data/repositories/running-profile-repository';
import { useLocalSearchParams, useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/program-repository', () => ({
  useProgramDetail: jest.fn(),
  useActiveProgram: jest.fn(() => ({ program: null })),
}));
jest.mock('@/data/repositories/planned-session-repository', () => ({ planProgram: jest.fn() }));
jest.mock('@/data/repositories/running-profile-repository', () => ({
  useRunnerProfile: jest.fn(() => ({ runnerProfile: null })),
}));
jest.mock('@/running/interval-summary', () => ({
  formatIntervalBlockSummary: (_t: unknown, block: { id: string }) => `bloc-${block.id}`,
}));

jest.mock('@/components/Screen', () => {
  const { View } = require('react-native');
  return { Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/ScreenHeader', () => {
  const { Text, View } = require('react-native');
  return {
    ScreenHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
      <View>
        <Text>{title}</Text>
        {subtitle ? <Text>{subtitle}</Text> : null}
      </View>
    ),
  };
});
jest.mock('@/components/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({
      label,
      onPress,
      disabled,
    }: {
      label: string;
      onPress: () => void;
      disabled?: boolean;
    }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={onPress}
      >
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});
jest.mock('@/components/TextField', () => {
  const { TextInput } = require('react-native');
  return {
    TextField: ({
      label,
      value,
      onChangeText,
    }: {
      label: string;
      value: string;
      onChangeText: (v: string) => void;
    }) => <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} />,
  };
});

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(() => ({ id: 'prog-1' })),
}));

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
      border: '#ece0cd',
      accent: '#c0562f',
      accentText: '#ffffff',
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

const mockDetail = useProgramDetail as jest.Mock;
const mockActive = useActiveProgram as jest.Mock;
const mockPlan = planProgram as jest.Mock;
const mockRunner = useRunnerProfile as jest.Mock;
const mockParams = useLocalSearchParams as unknown as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const replace = jest.fn();
const back = jest.fn();

/** « Aujourd'hui » : mercredi 12/08/2026. Lundi prochain = 17/08. */
const AUJOURDHUI = '2026-08-12';
const LUNDI_PROCHAIN = '17/08/2026';

const seance = (overrides: Record<string, unknown> = {}) => ({
  id: 's-1',
  name: null,
  sessionType: null,
  targetDistanceM: null,
  targetDurationSeconds: null,
  orderIndex: 0,
  intervals: [],
  ...overrides,
});

const programme = (overrides: Record<string, unknown> = {}) => ({
  id: 'prog-1',
  name: 'Full body 3×',
  pillar: 'strength' as const,
  durationWeeks: null,
  sessions: [seance()],
  ...overrides,
});

const afficher = async (detail: unknown = programme(), isLoading = false) => {
  mockDetail.mockReturnValue({ detail, isLoading });
  await render(<PlanScreen />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

const saisir = async (label: string, valeur: string) => {
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText(label), valeur);
  });
};

/** Affecte le jour `jour` (0 = lundi) à la `n`-ième séance affichée. */
const affecterJour = async (n: number, jour: number) => {
  const pastilles = screen.getAllByText(
    `common.weekday.${['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][jour]}`,
  );
  await taper(pastilles[n]!);
};

/** Le bouton d'action, dont le libellé change avec la validité de la durée. */
const boutonPlanifier = () => {
  const compte = screen.queryByLabelText(/planning\.generatedCount/);
  return compte ?? screen.getByLabelText('planning.planCta');
};

let boutonsAlerte: { text?: string; style?: string; onPress?: () => void }[] = [];
let titreAlerte: string | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date(`${AUJOURDHUI}T10:00:00`));
  boutonsAlerte = [];
  titreAlerte = undefined;
  jest.spyOn(Alert, 'alert').mockImplementation((titre, _m, boutons) => {
    titreAlerte = titre;
    boutonsAlerte = (boutons ?? []) as typeof boutonsAlerte;
  });
  mockParams.mockReturnValue({ id: 'prog-1' });
  mockUseRouter.mockReturnValue({ replace, back });
  mockActive.mockReturnValue({ program: null });
  mockRunner.mockReturnValue({ runnerProfile: null });
  mockPlan.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// États d'écran
// ---------------------------------------------------------------------------

describe('états d’écran', () => {
  it('un chargement n’affiche pas « introuvable »', async () => {
    await afficher(null, true);

    expect(screen.queryByText('programs.detail.notFoundMessage')).toBeNull();
  });

  it('🔴 « introuvable » offre un RETOUR — cet écran n’a pas d’en-tête de navigation', async () => {
    await afficher(null);

    // Constaté le 30/07/2026 : la pile `planning` est en `headerShown: false`. Sans ce bouton,
    // l'écran est un cul-de-sac dont on ne sort qu'en tuant l'app.
    expect(screen.getByText('programs.detail.notFoundMessage')).toBeTruthy();
    await taper(screen.getByLabelText('common.back'));
    expect(back).toHaveBeenCalled();
  });

  it('le nom du programme est rappelé en sous-titre', async () => {
    await afficher(programme({ name: 'Full body 3×' }));

    // On arrive ici depuis le détail : sans rappel, rien ne dit lequel on est en train de planifier.
    expect(screen.getByText('Full body 3×')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Durée
// ---------------------------------------------------------------------------

describe('durée', () => {
  it('la durée du programme pré-remplit le champ', async () => {
    await afficher(programme({ durationWeeks: 8 }));

    // La durée éditoriale est le point de départ le plus probable : la ressaisir serait du travail
    // pour rien dans le cas courant.
    expect(screen.getByLabelText('planning.durationWeeks').props.value).toBe('8');
  });

  it('🔴 le libellé du bouton annonce le NOMBRE de séances qui vont être créées', async () => {
    await afficher(
      programme({ durationWeeks: 4, sessions: [seance({ id: 'a' }), seance({ id: 'b' })] }),
    );

    // 2 séances × 4 semaines = 8. C'est le seul endroit qui dit l'ampleur de l'écriture avant de
    // la faire — et elle est irréversible en pratique.
    expect(screen.getByLabelText('planning.generatedCount:{"count":8}')).toBeTruthy();
  });

  it.each(['', '0', '-2', '3.5', 'abc'])('🔴 durée « %s » interdit la planification', async (saisie) => {
    await afficher(programme({ durationWeeks: 4 }));

    await saisir('planning.durationWeeks', saisie);
    await affecterJour(0, 0);

    // Une durée invalide produirait zéro séance, ou une boucle sur `NaN` : le bouton reste inerte
    // et retombe sur son libellé neutre.
    expect(screen.getByLabelText('planning.planCta').props.accessibilityState.disabled).toBe(true);
  });

  it('une durée saisie prime sur celle du programme', async () => {
    await afficher(programme({ durationWeeks: 4, sessions: [seance()] }));

    await saisir('planning.durationWeeks', '12');
    await affecterJour(0, 0);
    await taper(boutonPlanifier());

    expect(mockPlan).toHaveBeenCalledWith(
      'prog-1',
      expect.objectContaining({ durationWeeks: 12 }),
      expect.anything(),
    );
  });
});

// ---------------------------------------------------------------------------
// Semaine de départ
// ---------------------------------------------------------------------------

describe('semaine de départ', () => {
  it('🔴 le défaut est LUNDI PROCHAIN, pas la semaine en cours', async () => {
    await afficher();

    // Planifier une semaine déjà entamée poserait des séances sur des jours passés, comptées
    // « manquées » à l'instant même où le programme démarre.
    expect(screen.getByText(`planning.weekOf:{"date":"${LUNDI_PROCHAIN}"}`)).toBeTruthy();
  });

  it('les flèches déplacent la semaine de sept jours', async () => {
    await afficher();

    await taper(screen.getByLabelText('planning.nextWeek'));
    expect(screen.getByText('planning.weekOf:{"date":"24/08/2026"}')).toBeTruthy();

    await taper(screen.getByLabelText('planning.prevWeek'));
    await taper(screen.getByLabelText('planning.prevWeek'));
    expect(screen.getByText('planning.weekOf:{"date":"10/08/2026"}')).toBeTruthy();
  });

  it('la semaine choisie est transmise telle quelle', async () => {
    await afficher(programme({ durationWeeks: 4 }));

    await taper(screen.getByLabelText('planning.nextWeek'));
    await affecterJour(0, 0);
    await taper(boutonPlanifier());

    expect(mockPlan).toHaveBeenCalledWith(
      'prog-1',
      expect.objectContaining({ startDate: '2026-08-24' }),
      expect.anything(),
    );
  });
});

// ---------------------------------------------------------------------------
// Affectation des jours
// ---------------------------------------------------------------------------

describe('affectation des jours', () => {
  it('🔴 tant qu’UNE séance n’a pas de jour, rien ne part', async () => {
    await afficher(
      programme({ durationWeeks: 4, sessions: [seance({ id: 'a' }), seance({ id: 'b' })] }),
    );

    await affecterJour(0, 0);

    // Une séance sans jour ne serait simplement pas planifiée : l'utilisateur croirait avoir posé
    // son programme entier et découvrirait le trou trois semaines plus tard.
    expect(boutonPlanifier().props.accessibilityState.disabled).toBe(true);

    await affecterJour(1, 2);
    expect(boutonPlanifier().props.accessibilityState.disabled).toBe(false);
  });

  it('🔴 un programme SANS séance ne peut pas être planifié', async () => {
    await afficher(programme({ durationWeeks: 4, sessions: [] }));

    // `sessions.length > 0` : sans cette condition, `every` sur un tableau vide renvoie `true` et
    // l'écran proposerait de générer zéro séance.
    expect(boutonPlanifier().props.accessibilityState.disabled).toBe(true);
  });

  it('le jour retenu est annoncé comme sélectionné', async () => {
    await afficher();

    await affecterJour(0, 3);

    const jeudi = screen.getByText('common.weekday.thu').parent;
    expect(jeudi?.props.accessibilityState?.selected).toBe(true);
  });

  it('🔴 deux séances peuvent tomber le MÊME jour', async () => {
    await afficher(
      programme({ durationWeeks: 2, sessions: [seance({ id: 'a' }), seance({ id: 'b' })] }),
    );

    await affecterJour(0, 1);
    await affecterJour(1, 1);
    await taper(boutonPlanifier());

    // Deux séances le mardi est un choix légitime (haut/bas du corps) : l'interdire imposerait une
    // règle d'entraînement que l'app n'a pas à trancher.
    expect(mockPlan).toHaveBeenCalledWith(
      'prog-1',
      expect.objectContaining({ dayAssignments: { a: 1, b: 1 } }),
      expect.anything(),
    );
  });

  it('changer d’avis remplace le jour, sans en ajouter un second', async () => {
    await afficher(programme({ durationWeeks: 2 }));

    await affecterJour(0, 1);
    await affecterJour(0, 4);
    await taper(boutonPlanifier());

    expect(mockPlan).toHaveBeenCalledWith(
      'prog-1',
      expect.objectContaining({ dayAssignments: { 's-1': 4 } }),
      expect.anything(),
    );
  });
});

// ---------------------------------------------------------------------------
// Bascule d'un programme actif à un autre
// ---------------------------------------------------------------------------

describe('programme déjà actif', () => {
  const preparer = async () => {
    await afficher(programme({ durationWeeks: 2 }));
    await affecterJour(0, 0);
  };

  it('sans autre programme actif, la planification part DIRECTEMENT', async () => {
    await preparer();

    await taper(boutonPlanifier());

    // Aucune question à poser : il n'y a rien à arbitrer.
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockPlan).toHaveBeenCalledWith('prog-1', expect.anything(), {
      removePreviousFuture: false,
    });
  });

  it('🔴 un AUTRE programme actif ouvre un arbitrage à trois issues', async () => {
    mockActive.mockReturnValue({ program: { id: 'autre' } });
    await preparer();

    await taper(boutonPlanifier());

    // Trancher à sa place produirait soit une perte silencieuse de séances, soit un planning
    // illisible où deux programmes se superposent.
    expect(titreAlerte).toBe('planning.switchProgram.title');
    expect(boutonsAlerte.map((b) => b.text)).toEqual([
      'planning.switchProgram.remove',
      'planning.switchProgram.keep',
      'common.cancel',
    ]);
    expect(mockPlan).not.toHaveBeenCalled();
  });

  it('« remplacer » supprime les séances futures de l’ancien', async () => {
    mockActive.mockReturnValue({ program: { id: 'autre' } });
    await preparer();

    await taper(boutonPlanifier());
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'planning.switchProgram.remove')?.onPress?.();
    });

    expect(mockPlan).toHaveBeenCalledWith('prog-1', expect.anything(), {
      removePreviousFuture: true,
    });
  });

  it('« garder » laisse les deux programmes cohabiter', async () => {
    mockActive.mockReturnValue({ program: { id: 'autre' } });
    await preparer();

    await taper(boutonPlanifier());
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'planning.switchProgram.keep')?.onPress?.();
    });

    expect(mockPlan).toHaveBeenCalledWith('prog-1', expect.anything(), {
      removePreviousFuture: false,
    });
  });

  it('annuler n’écrit rien', async () => {
    mockActive.mockReturnValue({ program: { id: 'autre' } });
    await preparer();

    await taper(boutonPlanifier());
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'common.cancel')?.onPress?.();
    });

    expect(mockPlan).not.toHaveBeenCalled();
  });

  it('🔴 REPLANIFIER le programme DÉJÀ actif ne demande rien', async () => {
    mockActive.mockReturnValue({ program: { id: 'prog-1' } });
    await preparer();

    await taper(boutonPlanifier());

    // `activeProgram.id !== programId` : demander « veux-tu remplacer ? » pour le programme qu'on
    // est justement en train de replanifier serait une question sur soi-même.
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockPlan).toHaveBeenCalled();
  });

  it('🔴 l’arbitrage porte sur le pilier du programme PLANIFIÉ', async () => {
    await afficher(programme({ pillar: 'running', durationWeeks: 2 }));

    // Un programme de course actif n'entre pas en concurrence avec un programme de musculation :
    // interroger le mauvais pilier ferait surgir une question sans objet.
    expect(mockActive).toHaveBeenCalledWith('running');
  });
});

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------

describe('écriture', () => {
  const preparer = async () => {
    await afficher(programme({ durationWeeks: 2 }));
    await affecterJour(0, 0);
  };

  it('la réussite QUITTE vers le planning', async () => {
    await preparer();

    await taper(boutonPlanifier());

    // `replace` : revenir sur l'écran de planification après coup permettrait de tout regénérer
    // en double d'un seul appui.
    expect(replace).toHaveBeenCalledWith('/planning');
  });

  it('🔴 un échec est ANNONCÉ et rend la main', async () => {
    mockPlan.mockRejectedValue(new Error('hors ligne'));
    await preparer();

    await taper(boutonPlanifier());

    // Des dizaines de séances qui ne partent pas en silence, sur un écran qu'on quitte aussitôt :
    // l'utilisateur croirait son programme posé.
    expect(titreAlerte).toBe('planning.planErrorTitle');
    expect(replace).not.toHaveBeenCalled();
    expect(boutonPlanifier().props.accessibilityState.disabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cartes de séance
// ---------------------------------------------------------------------------

describe('cartes de séance', () => {
  it('une séance muscu sans nom retombe sur son RANG, 1-indexé', async () => {
    await afficher(programme({ sessions: [seance({ orderIndex: 2 })] }));

    expect(screen.getByText('programs.detail.sessionFallback:{"index":3}')).toBeTruthy();
  });

  it('une séance running sans nom retombe sur une LETTRE', async () => {
    await afficher(
      programme({ pillar: 'running', sessions: [seance({ id: 'a' }), seance({ id: 'b' })] }),
    );

    // Deux conventions distinctes, parce que les deux piliers nomment différemment : « Séance B »
    // côté course, « Séance 2 » côté muscu.
    expect(screen.getByText('running.program.sessionDefaultName:{"letter":"A"}')).toBeTruthy();
    expect(screen.getByText('running.program.sessionDefaultName:{"letter":"B"}')).toBeTruthy();
  });

  it('🔴 une séance MUSCU n’affiche ni type, ni cible, ni allure', async () => {
    await afficher(
      programme({
        pillar: 'strength',
        sessions: [
          seance({ sessionType: 'endurance', targetDistanceM: 5000, intervals: [{ id: 'b1' }] }),
        ],
      }),
    );

    // Ces colonnes existent en base pour le running : les afficher côté muscu donnerait « 5 km »
    // sur une séance de développé couché.
    expect(screen.queryByText('running.sessionType.endurance')).toBeNull();
    expect(screen.queryByText('5 km')).toBeNull();
    expect(screen.queryByText('bloc-b1')).toBeNull();
  });

  it('une séance running affiche type, cible, allure et blocs', async () => {
    mockRunner.mockReturnValue({ runnerProfile: { ref5kPaceSPerKm: 300 } });
    await afficher(
      programme({
        pillar: 'running',
        sessions: [
          seance({ sessionType: 'endurance', targetDistanceM: 8000, intervals: [{ id: 'b1' }] }),
        ],
      }),
    );

    expect(screen.getByText('running.sessionType.endurance')).toBeTruthy();
    expect(screen.getByText('8 km')).toBeTruthy();
    expect(screen.getByText(/^\d+s – \d+s$/)).toBeTruthy();
    expect(screen.getByText('bloc-b1')).toBeTruthy();
  });

  it('🔴 sans profil coureur, l’allure devient une invite', async () => {
    await afficher(
      programme({ pillar: 'running', sessions: [seance({ sessionType: 'endurance' })] }),
    );

    expect(screen.getByText('planning.noProfileHint')).toBeTruthy();
  });

  it('la cible en durée est arrondie à la minute, la distance prime', async () => {
    await afficher(
      programme({
        pillar: 'running',
        sessions: [seance({ targetDistanceM: 8000, targetDurationSeconds: 1800 })],
      }),
    );

    expect(screen.getByText('8 km')).toBeTruthy();
    expect(screen.queryByText('30 min')).toBeNull();
  });
});
