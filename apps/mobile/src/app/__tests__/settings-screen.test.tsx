/**
 * Réglages (`app/settings.tsx`) — le **vrai** écran, monté.
 *
 * Écran à **0 %** avant ce fichier (130 instructions). L'essentiel n'y est que du câblage — un
 * interrupteur, une écriture — mais **trois endroits décident vraiment**, et les trois ont déjà
 * produit un défaut :
 *
 *  1. **La provenance de l'heure d'un rappel programmé** (US NUTR-F1). Une heure qui bouge sans
 *     explication est un bug perçu : l'écran doit répondre à « pourquoi 13 h ? » sans qu'on nous
 *     écrive. Trois états — apprise, apprise et décalée hors « Ne pas déranger », pas encore assez
 *     d'historique.
 *  2. **L'avertissement DND**, qui ne dépend PAS du mode d'apprentissage mais du fait que l'heure
 *     effective soit apprise. Une heure de **repli** (apprentissage actif, historique insuffisant)
 *     se comporte comme une heure manuelle : elle n'est pas rabattue, donc elle ne partira pas.
 *     C'est exactement le défaut corrigé — l'écran affichait « 23:00 en attendant » pour un rappel
 *     qui n'allait jamais arriver.
 *  3. **L'export RGPD avant la première synchro** : l'avertissement n'est pas décoratif, il dit que
 *     l'export ne contiendra que ce qui est déjà local.
 *
 * Le reste est vérifié pour ce qu'il porte de règles produit : les piliers actifs masquent les
 * profils correspondants (décision H), et les trois réglages de **donnée de santé** (cycle, douleur,
 * collisions) sont **désactivés par défaut**, y compris quand les réglages ne sont pas encore
 * chargés — un `undefined` qui retomberait sur `true` activerait un suivi sensible tout seul.
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { defaultNotificationPrefs, type NotificationPrefs } from '@wellness/shared';

import SettingsScreen from '../settings';
import { togglePillar, updateSettings, useSettings } from '@/data/repositories/settings-repository';
import { upsertProfile, useProfile } from '@/data/repositories/profile-repository';
import {
  updateNotificationPrefs,
  useNotificationPrefs,
} from '@/data/repositories/notification-repository';
import {
  useMealDeadline,
  useSessionDeadline,
  useWeighInDeadline,
} from '@/data/repositories/reminder-habits-repository';
import { exportUserData } from '@/lib/data-export';
import { track } from '@/lib/analytics';
import { useStatus } from '@powersync/react';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/settings-repository', () => ({
  useSettings: jest.fn(),
  updateSettings: jest.fn(),
  togglePillar: jest.fn(),
}));
jest.mock('@/data/repositories/profile-repository', () => ({
  useProfile: jest.fn(() => ({ profile: null })),
  upsertProfile: jest.fn(),
}));
jest.mock('@/data/repositories/notification-repository', () => ({
  useNotificationPrefs: jest.fn(),
  updateNotificationPrefs: jest.fn(),
}));
jest.mock('@/data/repositories/reminder-habits-repository', () => ({
  useMealDeadline: jest.fn(),
  useWeighInDeadline: jest.fn(),
  useSessionDeadline: jest.fn(),
}));
jest.mock('@/lib/data-export', () => ({ exportUserData: jest.fn() }));
jest.mock('@/lib/notifications', () => ({
  ensurePermissionAndChannel: jest.fn(() => Promise.resolve(true)),
}));
jest.mock('@/lib/analytics', () => ({
  track: jest.fn(() => Promise.resolve()),
  ANALYTICS_EVENTS: { pillarActivated: 'pillar_activated' },
}));
jest.mock('@/i18n', () => ({ getAppLanguage: () => 'fr' }));
jest.mock('@powersync/react', () => ({ useStatus: jest.fn() }));

/** Les deux sections de santé ont leurs propres tests : sondes, pour vérifier ce qu'on leur passe. */
jest.mock('@/components/HealthConnectSection', () => {
  const { Text } = require('react-native');
  return {
    HealthConnectSection: ({ enabled }: { enabled: boolean }) => <Text>hc:{String(enabled)}</Text>,
  };
});
jest.mock('@/components/CycleTrackingSection', () => {
  const { Text } = require('react-native');
  return {
    CycleTrackingSection: ({
      enabled,
      healthConnectEnabled,
    }: {
      enabled: boolean;
      healthConnectEnabled: boolean;
    }) => (
      <Text>
        cycle:{String(enabled)}/{String(healthConnectEnabled)}
      </Text>
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
jest.mock('@/components/Segment', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Segment: <T,>({
      options,
      value,
      onChange,
      label,
    }: {
      options: readonly T[];
      value: T;
      onChange: (v: T) => void;
      label: (o: T) => string;
    }) =>
      options.map((o) => (
        <Pressable
          key={String(o)}
          accessibilityRole="button"
          accessibilityLabel={`segment-${String(o)}`}
          accessibilityState={{ selected: o === value }}
          onPress={() => onChange(o)}
        >
          <Text>{label(o)}</Text>
        </Pressable>
      )),
  };
});

jest.mock('@/stores/auth-store', () => {
  const etat = {
    session: { user: { id: 'u-1', email: 'moi@example.com' } },
    signOut: jest.fn(() => Promise.resolve()),
  };
  return { useAuthStore: (selecteur: (s: typeof etat) => unknown) => selecteur(etat) };
});

jest.mock('@/stores/menu-accent-store', () => {
  const etat = {
    enabled: false,
    colors: { home: '#c0562f', strength: '#6b0028', running: '#2f6fc0', nutrition: '#7c8a5b' },
    setEnabled: jest.fn(),
    setColor: jest.fn(),
    reset: jest.fn(),
  };
  return {
    useMenuAccent: (selecteur: (s: typeof etat) => unknown) => selecteur(etat),
    MENU_KEYS: ['home', 'strength', 'running', 'nutrition'],
    MENU_COLOR_SWATCHES: ['#c0562f', '#6b0028'],
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

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockSettings = useSettings as jest.Mock;
const mockUpdate = updateSettings as jest.Mock;
const mockToggle = togglePillar as jest.Mock;
const mockProfile = useProfile as jest.Mock;
const mockUpsert = upsertProfile as jest.Mock;
const mockPrefs = useNotificationPrefs as jest.Mock;
const mockPatch = updateNotificationPrefs as jest.Mock;
const mockMeal = useMealDeadline as jest.Mock;
const mockWeighIn = useWeighInDeadline as jest.Mock;
const mockSession = useSessionDeadline as jest.Mock;
const mockExport = exportUserData as jest.Mock;
const mockTrack = track as jest.Mock;
const mockStatus = useStatus as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();
const replace = jest.fn();

const prefs = (overrides: Partial<NotificationPrefs> = {}): NotificationPrefs => ({
  ...defaultNotificationPrefs(),
  ...overrides,
});

/** Échéance neutre : heure manuelle, non apprise. */
const echeance = (hour: number, overrides: Record<string, unknown> = {}) => ({
  hour,
  learned: false,
  shifted: false,
  isLoading: false,
  ...overrides,
});

const afficher = async ({
  settings = {},
  notifications = prefs(),
  repas = echeance(13),
  hasSynced = true,
}: {
  settings?: Record<string, unknown> | null;
  notifications?: NotificationPrefs;
  repas?: Record<string, unknown>;
  hasSynced?: boolean;
} = {}) => {
  mockSettings.mockReturnValue({ settings });
  mockPrefs.mockReturnValue(notifications);
  mockMeal.mockReturnValue(repas);
  mockStatus.mockReturnValue({ connected: true, hasSynced });
  await render(<SettingsScreen />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

const basculer = async (label: string, valeur: boolean) => {
  await act(async () => {
    fireEvent(screen.getByLabelText(label), 'valueChange', valeur);
  });
};

let boutonsAlerte: { text?: string; onPress?: () => void }[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  boutonsAlerte = [];
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, boutons) => {
    boutonsAlerte = (boutons ?? []) as typeof boutonsAlerte;
  });
  mockUseRouter.mockReturnValue({ push, replace });
  mockProfile.mockReturnValue({ profile: null });
  mockWeighIn.mockReturnValue(echeance(10));
  mockSession.mockReturnValue(echeance(18));
  mockToggle.mockResolvedValue({ activated: true });
  mockUpdate.mockResolvedValue(undefined);
  mockUpsert.mockResolvedValue(undefined);
  mockExport.mockResolvedValue({ ok: true });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Piliers actifs (décision H)
// ---------------------------------------------------------------------------

describe('piliers actifs', () => {
  it('🔴 les profils des piliers INACTIFS ne sont pas proposés', async () => {
    await afficher({ settings: { activePillars: ['strength'] } });

    // Décision H : l'intégration ne s'impose pas. Un « profil coureur » pour qui n'a pas activé
    // le pilier est un réglage sans objet.
    expect(screen.queryByLabelText('settings.profile.running')).toBeNull();
    expect(screen.queryByLabelText('settings.profile.nutrition')).toBeNull();
    expect(screen.getByLabelText('settings.profile.edit')).toBeTruthy();
  });

  it('les profils apparaissent quand leur pilier est actif', async () => {
    await afficher({ settings: { activePillars: ['strength', 'running', 'nutrition'] } });

    expect(screen.getByLabelText('settings.profile.running')).toBeTruthy();
    expect(screen.getByLabelText('settings.profile.nutrition')).toBeTruthy();
  });

  it('activer un pilier est tracé, le désactiver ne l’est pas', async () => {
    await afficher({ settings: { activePillars: ['strength'] } });

    await basculer('pillars.running', true);
    expect(mockToggle).toHaveBeenCalledWith('running');
    expect(mockTrack).toHaveBeenCalledWith('pillar_activated', { pillar: 'running' });

    mockToggle.mockResolvedValue({ activated: false });
    await basculer('pillars.strength', false);

    // Mesurer l'adoption, pas l'abandon : un événement « désactivé » n'alimente aucune décision
    // produit et alourdirait la collecte, qui est opt-out.
    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it('🔴 les trois écrans de suivi restent atteignables depuis ici', async () => {
    await afficher();

    // Défaut trouvé en recette le 01/08/2026 : ces écrans n'étaient atteignables que par leur
    // widget d'accueil. Le dégonflage du Tier 0 les aurait rendus invisibles — trois écrans
    // livrés, inatteignables, sans que rien n'échoue.
    await taper(screen.getByLabelText('settings.tracking.goals'));
    expect(push).toHaveBeenCalledWith('/goals');
    await taper(screen.getByLabelText('settings.tracking.wellbeing'));
    expect(push).toHaveBeenCalledWith('/wellbeing');
    await taper(screen.getByLabelText('settings.tracking.review'));
    expect(push).toHaveBeenCalledWith('/review');
  });
});

// ---------------------------------------------------------------------------
// Données de santé : le défaut est TOUJOURS « éteint »
// ---------------------------------------------------------------------------

describe('réglages sensibles', () => {
  it.each([
    ['settings.conflicts.toggle'],
    ['pain.settings.label'],
  ])('🔴 %s est éteint quand les réglages ne sont pas encore chargés', async (label) => {
    await afficher({ settings: null });

    // `?? false` et non `?? true` : pendant le chargement, un opt-in de donnée de santé qui
    // s'affiche « activé » se lit comme un consentement qu'on n'a jamais donné.
    expect(screen.getByLabelText(label).props.value).toBe(false);
  });

  it('🔴 le suivi du cycle reçoit « éteint » par défaut, synchro comprise', async () => {
    await afficher({ settings: null });

    expect(screen.getByText('cycle:false/false')).toBeTruthy();
  });

  it('🔴 les statistiques d’usage, elles, sont ACTIVES par défaut (opt-out)', async () => {
    await afficher({ settings: null });

    // Seule exception, et elle est assumée : mesure anonyme, opt-out documenté (US 9.10). Le
    // contraste avec les réglages de santé ci-dessus est le cœur du modèle de consentement.
    expect(screen.getByLabelText('settings.analytics.toggle').props.value).toBe(true);
  });

  it('le journal de douleur n’expose son écran QUE s’il est activé', async () => {
    await afficher({ settings: { painJournalEnabled: false } });
    expect(screen.queryByLabelText('pain.title')).toBeNull();

    await afficher({ settings: { painJournalEnabled: true } });
    expect(screen.getByLabelText('pain.title')).toBeTruthy();
  });

  it('activer le détecteur de collisions écrit le réglage', async () => {
    await afficher({ settings: { sessionConflictsEnabled: false } });

    await basculer('settings.conflicts.toggle', true);

    expect(mockUpdate).toHaveBeenCalledWith({ sessionConflictsEnabled: true });
  });
});

// ---------------------------------------------------------------------------
// Rappels programmés — provenance de l'heure
// ---------------------------------------------------------------------------

describe('provenance de l’heure d’un rappel', () => {
  it('🔴 une heure APPRISE est annoncée comme telle', async () => {
    await afficher({
      notifications: prefs({ mealReminder: true, learnedHour: true }),
      repas: echeance(13, { learned: true }),
    });

    // « Pourquoi 13 h ? » doit trouver sa réponse à l'écran : une heure qui bouge sans explication
    // est un bug perçu.
    expect(
      screen.getByText('settings.notifications.learnedHourValue:{"hour":"13:00"}'),
    ).toBeTruthy();
  });

  it('🔴 une heure apprise puis DÉCALÉE le dit distinctement', async () => {
    await afficher({
      notifications: prefs({ mealReminder: true, learnedHour: true }),
      repas: echeance(21, { learned: true, shifted: true }),
    });

    // Le décalage hors « Ne pas déranger » explique un écart avec l'habitude constatée : sans ce
    // libellé propre, l'heure semble simplement fausse.
    expect(
      screen.getByText('settings.notifications.learnedHourShifted:{"hour":"21:00"}'),
    ).toBeTruthy();
  });

  it('🔴 un historique insuffisant annonce l’heure de REPLI', async () => {
    await afficher({
      notifications: prefs({ mealReminder: true, learnedHour: true }),
      repas: echeance(13, { learned: false }),
    });

    expect(
      screen.getByText('settings.notifications.learnedHourPending:{"hour":"13:00"}'),
    ).toBeTruthy();
  });

  it('aucune provenance en mode MANUEL', async () => {
    await afficher({
      notifications: prefs({ mealReminder: true, learnedHour: false }),
      repas: echeance(13),
    });

    // L'heure vient de l'utilisateur : la lui expliquer serait absurde.
    expect(screen.queryByText(/learnedHour(Value|Pending|Shifted)/)).toBeNull();
  });

  it('🔴 aucune explication tant que le rappel est ÉTEINT', async () => {
    await afficher({
      notifications: prefs({ mealReminder: false, learnedHour: true }),
      repas: echeance(13, { learned: true }),
    });

    // Expliquer l'heure d'un rappel qui ne partira pas ajoute du bruit à une section déjà dense.
    expect(screen.queryByText(/learnedHourValue/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Rappels programmés — avertissement « Ne pas déranger »
// ---------------------------------------------------------------------------

describe('avertissement « ne pas déranger »', () => {
  it('🔴 une heure MANUELLE dans la fenêtre DND est signalée', async () => {
    await afficher({
      notifications: prefs({ mealReminder: true, learnedHour: false, dndEnabled: true }),
      repas: echeance(23),
    });

    // Une heure réglée à la main n'est jamais réécrite (décision D6) : on respecte le choix, mais
    // on ne laisse pas l'utilisateur attendre un rappel qui ne partira jamais.
    expect(screen.getByText('⚠️ settings.notifications.manualHourInDnd')).toBeTruthy();
  });

  it('🔴 une heure APPRISE dans la même fenêtre n’est PAS signalée', async () => {
    await afficher({
      notifications: prefs({ mealReminder: true, learnedHour: true, dndEnabled: true }),
      repas: echeance(23, { learned: true }),
    });

    // Une heure apprise a déjà été rabattue hors DND : l'avertir serait faux.
    expect(screen.queryByText(/manualHourInDnd/)).toBeNull();
  });

  it('🔴 une heure de REPLI dans la fenêtre EST signalée, apprentissage actif ou non', async () => {
    await afficher({
      notifications: prefs({ mealReminder: true, learnedHour: true, dndEnabled: true }),
      repas: echeance(23, { learned: false }),
    });

    // C'est le défaut corrigé : l'écran affichait « 23:00 en attendant » pour un rappel qui
    // n'allait jamais arriver. Une heure de repli n'est pas rabattue — elle se comporte comme
    // une heure manuelle, et se signale comme telle.
    expect(screen.getByText(/learnedHourPending/)).toBeTruthy();
    expect(screen.getByText('⚠️ settings.notifications.manualHourInDnd')).toBeTruthy();
  });

  it('DND éteint : aucune heure n’est signalée', async () => {
    await afficher({
      notifications: prefs({ mealReminder: true, learnedHour: false, dndEnabled: false }),
      repas: echeance(23),
    });

    expect(screen.queryByText(/manualHourInDnd/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Sélecteur d'heure
// ---------------------------------------------------------------------------

describe('sélecteur d’heure', () => {
  /**
   * Rang du sélecteur de l'heure du rappel streak, dans l'ordre d'affichage : pesée, repas,
   * séance, **streak**, bilan hebdo, début DND, fin DND. Les sept portent le même libellé
   * d'accessibilité — c'est le rang qui les distingue, et c'est aussi ce qui rend ce test
   * sensible à une réorganisation de la section : voulu, cet ordre est chronologique.
   */
  const RANG_STREAK = 3;

  it('incrémente l’heure du rappel streak', async () => {
    await afficher({ notifications: prefs({ streakDanger: true, reminderHour: 20 }) });

    await taper(screen.getAllByLabelText('settings.notifications.increaseHour')[RANG_STREAK]!);
    expect(mockPatch).toHaveBeenLastCalledWith(expect.anything(), { reminderHour: 21 });
  });

  it('🔴 la boucle est modulo 24 : 23 h + 1 = 0 h', async () => {
    await afficher({ notifications: prefs({ streakDanger: true, reminderHour: 23 }) });

    await taper(screen.getAllByLabelText('settings.notifications.increaseHour')[RANG_STREAK]!);

    // Sans le modulo, « 24:00 » serait écrit en base — une heure qu'aucun planificateur ne sait
    // interpréter, et le rappel disparaîtrait sans erreur.
    expect(mockPatch).toHaveBeenLastCalledWith(expect.anything(), { reminderHour: 0 });
  });

  it('🔴 0 h − 1 = 23 h', async () => {
    await afficher({ notifications: prefs({ streakDanger: true, reminderHour: 0 }) });

    await taper(screen.getAllByLabelText('settings.notifications.decreaseHour')[RANG_STREAK]!);

    expect(mockPatch).toHaveBeenLastCalledWith(expect.anything(), { reminderHour: 23 });
  });

  it('🔴 le sélecteur reste VISIBLE mais grisé quand l’apprentissage pilote l’heure', async () => {
    await afficher({
      notifications: prefs({ mealReminder: true, learnedHour: true }),
      repas: echeance(13, { learned: true }),
    });

    // Le masquer priverait l'utilisateur de la valeur de repli qui s'appliquerait s'il coupait
    // l'apprentissage — la question « et si je désactive ? » n'aurait plus de réponse à l'écran.
    const steppers = screen.getAllByLabelText('settings.notifications.increaseHour');
    expect(steppers.some((b) => b.props.accessibilityState?.disabled === true)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Export RGPD
// ---------------------------------------------------------------------------

describe('export des données', () => {
  it('🔴 avant la première synchro, l’export AVERTIT avant de partir', async () => {
    await afficher({ hasSynced: false });

    await taper(screen.getByLabelText('settings.dataExport.button'));

    // L'export ne contient que ce qui est déjà local : sans cet avertissement, un utilisateur
    // exerçant son droit d'accès repartirait avec un fichier incomplet sans le savoir.
    expect(mockExport).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalled();
  });

  it('confirmer malgré l’avertissement exporte', async () => {
    await afficher({ hasSynced: false });

    await taper(screen.getByLabelText('settings.dataExport.button'));
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'settings.dataExport.button')?.onPress?.();
    });

    expect(mockExport).toHaveBeenCalledWith('u-1', false, expect.any(Function));
  });

  it('annuler n’exporte rien', async () => {
    await afficher({ hasSynced: false });

    await taper(screen.getByLabelText('settings.dataExport.button'));
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'common.cancel')?.onPress?.();
    });

    expect(mockExport).not.toHaveBeenCalled();
  });

  it('synchro faite : l’export part directement', async () => {
    await afficher({ hasSynced: true });

    await taper(screen.getByLabelText('settings.dataExport.button'));

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockExport).toHaveBeenCalledWith('u-1', true, expect.any(Function));
  });

  it('🔴 un échec d’export est ANNONCÉ', async () => {
    mockExport.mockResolvedValue({ error: 'unavailable' });
    await afficher();

    await taper(screen.getByLabelText('settings.dataExport.button'));

    // Un export silencieusement raté est le pire cas : l'utilisateur croit avoir ses données.
    expect(Alert.alert).toHaveBeenCalledWith('account.export.errorUnavailable');
  });
});

// ---------------------------------------------------------------------------
// Réglages simples
// ---------------------------------------------------------------------------

describe('réglages simples', () => {
  it.each([
    ['segment-dark', { theme: 'dark' }],
    ['segment-imperial', { units: 'imperial' }],
    ['segment-rir', { intensityScale: 'rir' }],
    ['segment-en', { language: 'en' }],
  ])('%s écrit %o', async (label, patch) => {
    await afficher();

    await taper(screen.getByLabelText(label));

    expect(mockUpdate).toHaveBeenCalledWith(patch);
  });

  it('le niveau d’affichage de séance est écrit sur le PROFIL, pas les réglages', async () => {
    await afficher();

    await taper(screen.getByText('workout.displayLevel.levels.detailed.label'));

    // C'est une préférence liée à la pratique, pas à l'appareil : elle suit l'utilisateur.
    expect(mockUpsert).toHaveBeenCalledWith({ workoutDisplayLevel: 'detailed' });
  });

  it('🔴 les couleurs de menu sont masquées tant qu’elles sont désactivées', async () => {
    await afficher();

    // Quatre lignes de pastilles pour une option éteinte allongeraient un écran déjà long.
    expect(screen.queryByLabelText('settings.menuColors.reset')).toBeNull();
  });

  it('relancer l’onboarding efface le drapeau ET redirige', async () => {
    await afficher();

    await taper(screen.getByLabelText('settings.profile.relaunchOnboarding'));

    // `replace` : laisser les réglages sous l'onboarding permettrait d'en sortir par le retour,
    // à mi-parcours.
    expect(mockUpsert).toHaveBeenCalledWith({ onboardingCompletedAt: null });
    expect(replace).toHaveBeenCalledWith('/(onboarding)/intro');
  });

  it('l’adresse du compte connecté est affichée', async () => {
    await afficher();

    expect(screen.getByText('moi@example.com')).toBeTruthy();
  });
});
