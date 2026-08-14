/**
 * Historique du bien-être (`app/wellbeing.tsx`, US BIEN-01) — le **vrai** écran, monté.
 *
 * **Le dernier écran à 0 %.** Deux choix de lecture le rendent honnête, et ce sont eux qu'on teste :
 *
 *  1. **Une seule courbe à la fois** — trois séries superposées sur un téléphone sont illisibles.
 *  2. **Un jour non renseigné est un TROU**, jamais un zéro : il n'apparaît pas dans la courbe et
 *     s'affiche « — » dans le journal. Un 0 ferait plonger la courbe pour un jour où l'utilisateur
 *     n'a simplement rien dit — et transformerait un silence en mal-être.
 *
 * S'y ajoutent deux règles qui viennent de la recette :
 *
 *  - **Sans aucun jour enregistré, le check-in reste lançable.** Il s'ouvre normalement en tapant un
 *    jour du journal ; sans jour, l'écran était un **cul-de-sac** atteint par lien direct ou par le
 *    widget d'accueil (constaté le 30/07/2026 sur device).
 *  - **Un jour trop ancien n'est plus éditable** (`canEditDay`) : le bien-être se déclare à chaud,
 *    et rouvrir un mardi d'il y a trois semaines produirait une donnée reconstruite de mémoire.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import WellbeingScreen from '../wellbeing';
import { useWellbeingEntries } from '@/data/repositories/daily-wellbeing-repository';
import { useTodayKey } from '@/hooks/useTodayKey';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/daily-wellbeing-repository', () => ({
  useWellbeingEntries: jest.fn(() => ({ entries: [] })),
}));
jest.mock('@/hooks/useTodayKey', () => ({ useTodayKey: jest.fn(() => '2026-08-14') }));

/** La feuille de check-in a ses propres tests : sonde qui expose le jour visé. */
jest.mock('@/components/wellbeing/WellbeingCheckinSheet', () => {
  const { Text } = require('react-native');
  return {
    WellbeingCheckinSheet: ({
      visible,
      logDate,
      existing,
    }: {
      visible: boolean;
      logDate: string;
      existing: { id: string } | null;
    }) =>
      visible ? (
        <Text>
          checkin:{logDate}:{existing ? existing.id : 'neuf'}
        </Text>
      ) : null,
  };
});
jest.mock('@/components/wellbeing/WellbeingScale', () => ({
  WELLBEING_GLYPHS: {
    mood: { 1: 'M1', 2: 'M2', 3: 'M3', 4: 'M4', 5: 'M5' },
    energy: { 1: 'E1', 2: 'E2', 3: 'E3', 4: 'E4', 5: 'E5' },
    stress: { 1: 'S1', 2: 'S2', 3: 'S3', 4: 'S4', 5: 'S5' },
  },
  useLevelLabel: () => (id: string, level: number) => `${id}-${level}`,
}));

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
    Button: ({
      label,
      accessibilityLabel,
      onPress,
    }: {
      label: string;
      accessibilityLabel?: string;
      onPress: () => void;
    }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        onPress={onPress}
      >
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
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockEntries = useWellbeingEntries as jest.Mock;
const mockToday = useTodayKey as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();

const AUJOURDHUI = '2026-08-14';

const jour = (logDate: string, overrides: Record<string, unknown> = {}) => ({
  id: `w-${logDate}`,
  logDate,
  mood: 4,
  energy: 3,
  stress: 2,
  ...overrides,
});

const afficher = async (entries: unknown[] = []) => {
  mockEntries.mockReturnValue({ entries });
  await render(<WellbeingScreen />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

/** Le contenu de la courbe, ou `null` si elle n'est pas rendue. */
const courbe = () => screen.queryByText(/^courbe\[/)?.children.join('') ?? null;

/** Un onglet d'indicateur, par son libellé d'accessibilité. */
const onglet = (id: string) =>
  screen.getByLabelText(
    `wellbeing.a11yIndicatorTab:{"indicator":"wellbeing.indicators.${id}"}`,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push });
  mockToday.mockReturnValue(AUJOURDHUI);
});

// ---------------------------------------------------------------------------
// Écran vide — le cul-de-sac corrigé
// ---------------------------------------------------------------------------

describe('aucun jour enregistré', () => {
  it('🔴 le check-in reste LANÇABLE — sinon l’écran est un cul-de-sac', async () => {
    await afficher();

    // Constaté le 30/07/2026 sur device : le check-in s'ouvre normalement en tapant un jour du
    // journal. Sans jour, il n'y avait AUCUN moyen de le lancer — écran atteint par lien direct
    // ou par le widget d'accueil.
    expect(screen.getByLabelText('wellbeing.a11yOpenCheckin')).toBeTruthy();
    expect(screen.getByText('wellbeing.emptyHistory')).toBeTruthy();
  });

  it('le check-in s’ouvre sur AUJOURD’HUI, en création', async () => {
    await afficher();

    await taper(screen.getByLabelText('wellbeing.a11yOpenCheckin'));

    expect(screen.getByText(`checkin:${AUJOURDHUI}:neuf`)).toBeTruthy();
  });

  it('🔴 rien d’autre n’est affiché sur un écran vide', async () => {
    await afficher();

    // Sélecteurs, fenêtres, courbe vide et journal vide : quatre blocs qui ne disent rien là où
    // une phrase et un bouton suffisent.
    expect(screen.queryByText('wellbeing.indicators.mood')).toBeNull();
    expect(screen.queryByText('wellbeing.journal')).toBeNull();
    expect(courbe()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Sélection d'indicateur
// ---------------------------------------------------------------------------

describe('sélection de l’indicateur', () => {
  it('les trois indicateurs sont proposés, humeur par défaut', async () => {
    await afficher([jour('2026-08-12'), jour('2026-08-13')]);

    expect(onglet('mood').props.accessibilityState.selected).toBe(true);
    expect(onglet('energy').props.accessibilityState.selected).toBe(false);
    expect(courbe()).toContain('wellbeing.indicators.mood');
  });

  it('🔴 UNE courbe à la fois — changer d’indicateur change la série', async () => {
    await afficher([
      jour('2026-08-12', { mood: 4, energy: 2 }),
      jour('2026-08-13', { mood: 5, energy: 1 }),
    ]);

    expect(courbe()).toContain('12/08=4,13/08=5');

    await taper(onglet('energy'));

    // Trois séries superposées sur un écran de téléphone sont illisibles : c'est le choix de
    // lecture nᵒ 1, et il impose que la série suive vraiment l'onglet.
    expect(courbe()).toContain('12/08=2,13/08=1');
    expect(courbe()).toContain('wellbeing.indicators.energy');
  });

  it('🔴 les onglets sont annoncés comme des ONGLETS', async () => {
    await afficher([jour('2026-08-12'), jour('2026-08-13')]);

    // `accessibilityRole="tab"` + libellé explicite : trois boutons nus ne diraient pas qu'ils
    // s'excluent, ni lequel est actif.
    expect(onglet('mood').props.accessibilityRole).toBe('tab');
  });
});

// ---------------------------------------------------------------------------
// Courbe et moyenne
// ---------------------------------------------------------------------------

describe('courbe', () => {
  it('🔴 UN point n’est pas une tendance', async () => {
    await afficher([jour('2026-08-13')]);

    expect(courbe()).toBeNull();
    expect(screen.getByText('wellbeing.notEnoughForCurve')).toBeTruthy();
  });

  it('🔴 un jour NON RENSEIGNÉ est un trou dans la courbe, jamais un zéro', async () => {
    await afficher([
      jour('2026-08-11', { mood: 4 }),
      jour('2026-08-12', { mood: null }),
      jour('2026-08-13', { mood: 5 }),
    ]);

    // Un 0 ferait plonger la courbe pour un jour où l'utilisateur n'a rien dit — et
    // transformerait un silence en mal-être. `wellbeingSeries` est pure et prise telle quelle.
    expect(courbe()).toContain('11/08=4,13/08=5');
    expect(courbe()).not.toContain('=0');
  });

  it('l’échelle est rappelée dans l’unité', async () => {
    await afficher([jour('2026-08-12'), jour('2026-08-13')]);

    // « 4 » seul ne dit pas sur combien : la borne haute est ce qui rend la valeur lisible.
    expect(courbe()).toContain('|/ 5]');
  });

  it('🔴 la moyenne annonce SUR COMBIEN DE JOURS elle porte', async () => {
    await afficher([
      jour('2026-08-11', { mood: 4 }),
      jour('2026-08-12', { mood: null }),
      jour('2026-08-13', { mood: 5 }),
    ]);

    // Une moyenne sur deux jours et une moyenne sur trente ne valent pas la même chose : sans le
    // compte, on lirait la première comme une tendance.
    expect(screen.getByText(/wellbeing\.averageOver.*"count":2/)).toBeTruthy();
  });

  it('les libellés d’axe sont abrégés en JJ/MM', async () => {
    await afficher([jour('2026-08-12'), jour('2026-08-13')]);

    expect(courbe()).toContain('12/08=');
    expect(courbe()).not.toContain('2026-08-12');
  });
});

// ---------------------------------------------------------------------------
// Fenêtre
// ---------------------------------------------------------------------------

describe('fenêtre', () => {
  it('ouvre sur 30 jours', async () => {
    await afficher([jour('2026-08-12'), jour('2026-08-13')]);

    const trente = screen.getByText('wellbeing.windowDays:{"count":30}').parent;
    expect(trente?.props.accessibilityState?.selected).toBe(true);
  });

  it('🔴 la fenêtre COUPE la courbe, pas le journal', async () => {
    await afficher([
      jour('2026-01-01', { mood: 1 }),
      jour('2026-08-12', { mood: 4 }),
      jour('2026-08-13', { mood: 5 }),
    ]);

    // La courbe est une lecture de tendance récente ; le journal est l'historique complet, où
    // l'on va chercher un jour précis à corriger.
    expect(courbe()).not.toContain('01/01');
    expect(screen.getByLabelText(/2026-01-01|01\/01\/2026/)).toBeTruthy();
  });

  it('🔴 la dernière fenêtre est nommée « tout », pas « 365 jours »', async () => {
    await afficher([jour('2026-08-12'), jour('2026-08-13')]);

    // « 365 jours » se lit comme une fenêtre glissante ; l'intention est « tout mon historique ».
    expect(screen.getByText('wellbeing.windowAll')).toBeTruthy();
    expect(screen.queryByText(/"count":365/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

describe('journal', () => {
  it('chaque jour affiche ses trois glyphes', async () => {
    await afficher([jour('2026-08-13', { mood: 4, energy: 3, stress: 2 })]);

    // Trois indicateurs d'un coup d'œil : c'est ce qui permet de repérer un jour atypique sans
    // ouvrir chaque ligne.
    expect(screen.getByText('M4  E3  S2')).toBeTruthy();
  });

  it('🔴 un indicateur manquant affiche « — », pas un glyphe par défaut', async () => {
    await afficher([jour('2026-08-13', { mood: 4, energy: null, stress: 2 })]);

    // Un glyphe neutre se lirait comme une réponse donnée. Le tiret dit qu'il n'y en a pas eu.
    expect(screen.getByText('M4  —  S2')).toBeTruthy();
  });

  it('🔴 la ligne est annoncée EN TOUTES LETTRES aux lecteurs d’écran', async () => {
    await afficher([jour('2026-08-13', { mood: 4, energy: 3, stress: 2 })]);

    // Les glyphes ne se prononcent pas : sans ce libellé, un lecteur d'écran énoncerait une suite
    // de symboles.
    expect(screen.getByLabelText(/mood-4.*energy-3.*stress-2/)).toBeTruthy();
  });

  it('un jour entièrement vide est annoncé comme non renseigné', async () => {
    await afficher([jour('2026-08-13', { mood: null, energy: null, stress: null })]);

    expect(screen.getByLabelText(/wellbeing\.notLogged/)).toBeTruthy();
  });

  it('🔴 taper un jour RÉCENT rouvre le check-in SUR ce jour, en édition', async () => {
    await afficher([jour('2026-08-13')]);

    await taper(screen.getByLabelText(/13\/08\/2026|2026-08-13/));

    // `existing` transmis : sans lui, la feuille repartirait vierge et écraserait la saisie
    // précédente au lieu de la corriger.
    expect(screen.getByText('checkin:2026-08-13:w-2026-08-13')).toBeTruthy();
  });

  it('🔴 un jour TROP ANCIEN n’est plus éditable', async () => {
    await afficher([jour('2026-07-01')]);

    // `canEditDay` est pure et prise telle quelle : le bien-être se déclare à chaud, et rouvrir
    // un jour d'il y a six semaines produirait une donnée reconstruite de mémoire.
    const ligne = screen.getByLabelText(/01\/07\/2026|2026-07-01/);
    expect(ligne.props.accessibilityRole).toBeUndefined();

    await taper(ligne);
    expect(screen.queryByText(/^checkin:/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Courbe de poids
// ---------------------------------------------------------------------------

describe('courbe de poids', () => {
  it('🔴 le poids n’est PAS re-courbé ici : on y renvoie', async () => {
    await afficher([jour('2026-08-13')]);

    await taper(screen.getByText('wellbeing.weightSeeCurve'));

    // Elle existe déjà côté Stats nutrition (roadmap 4.30) : en maintenir deux les ferait
    // diverger — même arbitrage que sur l'écran des mensurations.
    expect(push).toHaveBeenCalledWith('/nutrition-stats');
  });
});
