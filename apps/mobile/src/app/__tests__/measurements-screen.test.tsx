/**
 * Historique des mensurations (`app/measurements.tsx`, US MESUR-01) — le **vrai** écran, monté.
 *
 * Écran à **0 %** avant ce fichier (45 instructions). Les calculs sont purs et vivent dans
 * `@wellness/shared` (`measurementSeries`, `measurementDeltas`) : ce qui se teste ici, ce sont les
 * **trois choix de lecture** posés en tête du fichier, plus tout ce qui touche aux **unités** — car
 * une mensuration est stockée en centimètres et affichée en pouces le cas échéant.
 *
 *  1. **Une courbe à la fois.** Six séries superposées sur un téléphone sont illisibles.
 *  2. **Un point n'est pas une tendance** : on le dit, plutôt que de tracer une ligne plate.
 *  3. **Le premier relevé n'a pas de delta « 0 »** : rien à comparer n'est pas la même information
 *     qu'aucun changement — d'où le tiret, et un libellé parlé distinct.
 *
 * Et une règle d'accessibilité qui n'est pas décorative : **le signe est dans le texte**
 * (`−` / `+` / `=`), la couleur ne porte jamais seule le sens. Un écran qui ne distinguerait la
 * baisse de la hausse que par du vert et de l'ambre serait illisible pour un daltonien — sur
 * l'information même qu'on vient chercher.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import MeasurementsScreen from '../measurements';
import {
  useLatestMeasurements,
  useMeasurements,
} from '@/data/repositories/body-measurement-repository';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/body-measurement-repository', () => ({
  useMeasurements: jest.fn(() => ({ rows: [] })),
  useLatestMeasurements: jest.fn(() => ({ latest: {} })),
}));

/** La feuille de saisie a ses propres tests (21) : sonde d'ouverture. */
jest.mock('@/components/measurements/MeasurementSheet', () => {
  const { Text } = require('react-native');
  return {
    MeasurementSheet: ({ visible }: { visible: boolean }) =>
      visible ? <Text>feuille-ouverte</Text> : null,
  };
});

jest.mock('@/components/charts/ProgressLineChart', () => {
  const { Text } = require('react-native');
  return {
    ProgressLineChart: ({
      data,
      title,
      unit,
    }: {
      data: { label: string; value: number }[];
      title: string;
      unit: string;
    }) => (
      <Text>
        courbe[{title}|{unit}]:{data.map((d) => `${d.label}=${d.value}`).join(',')}
      </Text>
    ),
  };
});
jest.mock('@/components/Screen', () => {
  const { View } = require('react-native');
  return { Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/ScreenHeader', () => {
  const { Text } = require('react-native');
  return { ScreenHeader: ({ title }: { title: string }) => <Text>{title}</Text> };
});
jest.mock('@/components/Card', () => {
  const { View } = require('react-native');
  return { Card: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
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
      border: '#ece0cd',
      accent: '#c0562f',
      success: '#7c8a5b',
      warnText: '#8a6a1f',
    },
  }),
}));

/** Unités pilotées : métriques par défaut, impériales à la demande (facteur non rond). */
jest.mock('@/hooks/useUnits', () => ({ useUnits: jest.fn() }));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockRows = useMeasurements as jest.Mock;
const mockLatest = useLatestMeasurements as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;
const mockUnits = jest.requireMock('@/hooks/useUnits').useUnits as jest.Mock;

const push = jest.fn();

const CM_PAR_POUCE = 2.54;

const unitesMetriques = () => ({
  circumferenceSymbol: 'cm',
  toCircumferenceValue: (cm: number) => cm,
  formatCircumference: (cm: number) => `${cm} cm`,
  formatAxisNumber: (n: number) => String(n),
});

const unitesImperiales = () => ({
  circumferenceSymbol: 'in',
  toCircumferenceValue: (cm: number) => Math.round((cm / CM_PAR_POUCE) * 10) / 10,
  formatCircumference: (cm: number) => `${Math.round((cm / CM_PAR_POUCE) * 10) / 10} in`,
  formatAxisNumber: (n: number) => String(n),
});

const releve = (logDate: string, valueCm: number, kind = 'waist') => ({
  logDate,
  kind,
  valueCm,
  deletedAt: null,
});

const afficher = async ({
  rows = [] as unknown[],
  imperial = false,
}: { rows?: unknown[]; imperial?: boolean } = {}) => {
  mockRows.mockReturnValue({ rows });
  mockUnits.mockReturnValue(imperial ? unitesImperiales() : unitesMetriques());
  await render(<MeasurementsScreen />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

/** Le contenu de la courbe, ou `null` si elle n'est pas rendue. */
const courbe = () => screen.queryByText(/^courbe\[/)?.children.join('') ?? null;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-08-14T10:00:00'));
  mockUseRouter.mockReturnValue({ push });
  mockLatest.mockReturnValue({ latest: {} });
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// État vide
// ---------------------------------------------------------------------------

describe('aucune mensuration', () => {
  it('🔴 sans relevé, l’écran se réduit à l’invitation à mesurer', async () => {
    await afficher();

    // Sélecteurs de mesure, fenêtres, courbe vide et tableau vide sur un écran neuf : cinq blocs
    // qui ne disent rien, là où une seule phrase suffit.
    expect(screen.getByText('measurements.emptyHistory')).toBeTruthy();
    expect(screen.queryByText('measurements.kinds.waist')).toBeNull();
    expect(courbe()).toBeNull();
  });

  it('la saisie reste accessible, elle', async () => {
    await afficher();

    // C'est précisément ce qu'on vient faire : le bouton ne doit pas dépendre de l'existence de
    // données.
    await taper(screen.getByLabelText('measurements.cta'));
    expect(screen.getByText('feuille-ouverte')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Sélection de mesure
// ---------------------------------------------------------------------------

describe('sélection de la mesure', () => {
  it('🔴 les SIX mesures sont proposées, tour de taille par défaut', async () => {
    // Deux points : la courbe n'est rendue qu'à partir de là, et c'est son titre qui prouve la
    // mesure active.
    await afficher({ rows: [releve('2026-08-01', 82), releve('2026-08-08', 81)] });

    // Le tour de taille est la mesure la plus suivie : ouvrir sur une autre obligerait à cliquer
    // à chaque visite.
    for (const kind of ['waist', 'chest', 'hips', 'arm', 'thigh', 'calf']) {
      expect(screen.getByText(`measurements.kinds.${kind}`)).toBeTruthy();
    }
    expect(courbe()).toContain('measurements.kinds.waist');
  });

  it('🔴 UNE courbe à la fois — changer de mesure change la série', async () => {
    await afficher({
      rows: [
        releve('2026-08-01', 82, 'waist'),
        releve('2026-08-08', 81, 'waist'),
        releve('2026-08-01', 38, 'arm'),
        releve('2026-08-08', 39, 'arm'),
      ],
    });

    expect(courbe()).toContain('01/08=82');

    await taper(screen.getByText('measurements.kinds.arm'));

    // Six séries superposées sur un téléphone sont illisibles : c'est le choix de lecture nᵒ 1,
    // et il implique que la série suive vraiment l'onglet.
    expect(courbe()).toContain('01/08=38');
    expect(courbe()).not.toContain('=82');
  });

  it('🔴 le tableau de relevés suit AUSSI la mesure choisie', async () => {
    await afficher({
      rows: [releve('2026-08-01', 82, 'waist'), releve('2026-08-01', 38, 'arm')],
    });

    await taper(screen.getByText('measurements.kinds.arm'));

    // Un tableau resté sur le tour de taille sous une courbe de bras serait une confusion
    // silencieuse — deux chiffres justes qui ne parlent pas de la même chose.
    expect(screen.getByText('38 cm')).toBeTruthy();
    expect(screen.queryByText('82 cm')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Fenêtre temporelle
// ---------------------------------------------------------------------------

describe('fenêtre temporelle', () => {
  it('ouvre sur trois mois', async () => {
    await afficher({ rows: [releve('2026-08-01', 82), releve('2026-08-08', 81)] });

    const troisMois = screen.getByText('measurements.windowThreeMonths').parent;
    expect(troisMois?.props.accessibilityState?.selected).toBe(true);
  });

  it('🔴 la fenêtre COUPE la courbe, pas le tableau', async () => {
    await afficher({
      rows: [
        releve('2025-01-01', 90), // hors des 3 mois
        releve('2026-08-01', 82),
        releve('2026-08-08', 81),
      ],
    });

    // La courbe est une lecture de tendance récente ; le tableau est l'historique complet, où
    // l'on va justement chercher le point de départ.
    expect(courbe()).not.toContain('01/01');
    expect(screen.getByText('90 cm')).toBeTruthy();
  });

  it('« tout » ramène l’historique entier dans la courbe', async () => {
    await afficher({
      rows: [releve('2025-01-01', 90), releve('2026-08-01', 82), releve('2026-08-08', 81)],
    });

    await taper(screen.getByText('measurements.windowAll'));

    expect(courbe()).toContain('01/01=90');
  });
});

// ---------------------------------------------------------------------------
// Courbe
// ---------------------------------------------------------------------------

describe('courbe', () => {
  it('🔴 UN point n’est pas une tendance', async () => {
    await afficher({ rows: [releve('2026-08-01', 82)] });

    // Une ligne plate à un point suggère une stabilité qu'on n'a pas mesurée.
    expect(courbe()).toBeNull();
    expect(screen.getByText('measurements.notEnoughForCurve')).toBeTruthy();
  });

  it('deux points suffisent', async () => {
    await afficher({ rows: [releve('2026-08-01', 82), releve('2026-08-08', 81)] });

    expect(courbe()).toContain('01/08=82,08/08=81');
  });

  it('🔴 les libellés d’axe sont ABRÉGÉS en JJ/MM', async () => {
    await afficher({ rows: [releve('2026-08-01', 82), releve('2026-08-08', 81)] });

    // Une date complète par point rendrait l'axe illisible sur un écran de téléphone ; la date
    // entière va dans l'infobulle.
    expect(courbe()).toContain('01/08=');
    expect(courbe()).not.toContain('2026-08-01');
  });

  it('🔴 la courbe est tracée dans l’unité AFFICHÉE', async () => {
    await afficher({
      rows: [releve('2026-08-01', 82), releve('2026-08-08', 81)],
      imperial: true,
    });

    // Un axe en centimètres sous des relevés en pouces serait un graphique faux : 82 cm ≈ 32,3 in.
    expect(courbe()).toContain('|in]');
    expect(courbe()).toContain('01/08=32.3');
  });
});

// ---------------------------------------------------------------------------
// Relevés et deltas
// ---------------------------------------------------------------------------

describe('relevés', () => {
  it('🔴 le PREMIER relevé n’a pas de delta « 0 »', async () => {
    await afficher({ rows: [releve('2026-08-01', 82)] });

    // Rien à comparer n'est pas la même information qu'aucun changement : le tiret le dit.
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText('+0')).toBeNull();
  });

  it('🔴 une baisse et une hausse portent leur SIGNE dans le texte', async () => {
    await afficher({
      rows: [releve('2026-08-01', 82), releve('2026-08-08', 81), releve('2026-08-15', 83)],
    });

    // La couleur ne porte jamais seule le sens : un écran qui ne distinguerait baisse et hausse
    // que par du vert et de l'ambre serait illisible pour un daltonien — sur l'information même
    // qu'on vient chercher.
    expect(screen.getByText('−1')).toBeTruthy();
    expect(screen.getByText('+2')).toBeTruthy();
  });

  it('🔴 un relevé IDENTIQUE affiche « = », pas « +0 »', async () => {
    await afficher({ rows: [releve('2026-08-01', 82), releve('2026-08-08', 82)] });

    expect(screen.getByText('=')).toBeTruthy();
  });

  it('🔴 le delta est CONVERTI dans l’unité affichée', async () => {
    await afficher({
      rows: [releve('2026-08-01', 82), releve('2026-08-08', 80.46)],
      imperial: true,
    });

    // −1,54 cm vaut −0,6 in : afficher « −1,5 » à côté de valeurs en pouces donnerait un écart
    // trois fois trop grand.
    expect(screen.getByText('−0.6')).toBeTruthy();
  });

  it('🔴 chaque ligne est annoncée EN ENTIER aux lecteurs d’écran', async () => {
    await afficher({ rows: [releve('2026-08-01', 82), releve('2026-08-08', 81)] });

    // Date, valeur et sens de l'écart dans un seul libellé : trois nœuds séparés feraient perdre
    // l'association d'une ligne à l'autre, et le signe « − » seul ne se prononce pas.
    expect(
      screen.getByLabelText(/measurements\.a11yDeltaDown.*"value":"1 cm"/),
    ).toBeTruthy();
  });

  it('le premier relevé est annoncé comme tel', async () => {
    await afficher({ rows: [releve('2026-08-01', 82)] });

    expect(screen.getByLabelText(/measurements\.noDelta/)).toBeTruthy();
  });

  it('un relevé stable est annoncé comme stable', async () => {
    await afficher({ rows: [releve('2026-08-01', 82), releve('2026-08-08', 82)] });

    expect(screen.getByLabelText(/measurements\.a11yDeltaFlat/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Renvoi vers la courbe de poids
// ---------------------------------------------------------------------------

describe('courbe de poids', () => {
  it('🔴 le poids N’EST PAS re-courbé ici : on y renvoie', async () => {
    await afficher({ rows: [releve('2026-08-01', 82)] });

    await taper(screen.getByText('measurements.seeWeightCurve'));

    // Elle existe côté Stats nutrition (roadmap 4.30) : en maintenir deux les ferait diverger.
    expect(push).toHaveBeenCalledWith('/nutrition-stats');
  });

  it('le renvoi n’apparaît pas sur un écran vide', async () => {
    await afficher();

    expect(screen.queryByText('measurements.seeWeightCurve')).toBeNull();
  });
});
