/**
 * Profil général (`app/profile.tsx`) — le **vrai** écran, monté.
 *
 * Écran à **0 %** avant ce fichier (47 instructions). Il porte deux mécanismes subtils, dont chacun
 * corrige un défaut qu'aucun typage n'attrape :
 *
 *  1. **La garde anti-dérive.** En unités impériales, le poids stocké en kg est converti en livres
 *     pour l'affichage, puis reconverti en kg à l'enregistrement. Le simple fait d'ouvrir l'écran et
 *     de le sauver ferait donc **glisser le poids** à chaque passage, par arrondis successifs. La
 *     parade : mémoriser la **chaîne affichée au montage** dans une ref, et si elle n'a pas changé,
 *     réécrire la valeur **stockée** plutôt que la valeur reconvertie. Testé ici parce que rien
 *     d'autre ne peut le voir — la dérive est de l'ordre du gramme par ouverture.
 *  2. **Un champ invalide BLOQUE, un champ vide EFFACE.** Ce n'est pas la même chose : « abc » dans
 *     le poids est une faute de frappe qu'on ne doit pas transformer en effacement silencieux, alors
 *     que vider le poids cible est un geste délibéré (« je n'ai plus d'objectif »).
 *
 * Le formulaire n'est monté **qu'après** la résolution du profil : `useQuery` renvoie `null` au
 * premier rendu, et `useState` figerait les champs sur des valeurs vides — profil affiché vide
 * alors qu'il est plein en base.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import ProfileScreen from '../profile';
import { setWeightTarget, upsertProfile, useProfile } from '@/data/repositories/profile-repository';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/profile-repository', () => ({
  useProfile: jest.fn(),
  upsertProfile: jest.fn(),
  setWeightTarget: jest.fn(),
}));

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
          accessibilityLabel={`opt-${String(o)}`}
          accessibilityState={{ selected: o === value }}
          onPress={() => onChange(o)}
        >
          <Text>{label(o)}</Text>
        </Pressable>
      )),
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
    colors: { text: '#33291f', textMuted: '#96856f', background: '#fffaf2', danger: '#b23b2e' },
  }),
}));

/**
 * `useUnits` est piloté depuis le test : c'est lui qui porte la conversion, donc la dérive. Le
 * système impérial est simulé avec un facteur **volontairement non rond** (2,20462) — un facteur
 * entier masquerait exactement le défaut qu'on cherche.
 */
jest.mock('@/hooks/useUnits', () => ({ useUnits: jest.fn() }));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockProfile = useProfile as jest.Mock;
const mockUpsert = upsertProfile as jest.Mock;
const mockSetTarget = setWeightTarget as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;
const mockUnits = jest.requireMock('@/hooks/useUnits').useUnits as jest.Mock;

const back = jest.fn();

const LB_PAR_KG = 2.20462;

/** Unités métriques : l'affichage est la valeur stockée, aucune conversion. */
const unitesMetriques = () => ({
  system: 'metric' as const,
  weightSymbol: 'kg',
  weightInputValue: (kg: number | null | undefined) => (kg == null ? '' : String(kg)),
  parseWeightToKg: (v: string) => {
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
  },
  heightPartsFromCm: (cm: number | null | undefined) => ({ a: cm == null ? '' : String(cm), b: '' }),
  heightPartsToCm: (a: string) => {
    const n = Number(a);
    return Number.isFinite(n) && n > 0 ? n : null;
  },
});

/** Unités impériales : aller-retour kg ↔ lb avec arrondi d'affichage — c'est là que ça dérive. */
const unitesImperiales = () => ({
  system: 'imperial' as const,
  weightSymbol: 'lb',
  weightInputValue: (kg: number | null | undefined) =>
    kg == null ? '' : String(Math.round(kg * LB_PAR_KG)),
  parseWeightToKg: (v: string) => {
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n / LB_PAR_KG : null;
  },
  heightPartsFromCm: (cm: number | null | undefined) =>
    cm == null ? { a: '', b: '' } : { a: String(Math.floor(cm / 30.48)), b: '0' },
  heightPartsToCm: (a: string, b: string) => {
    const ft = Number(a);
    const inch = Number(b);
    if (!Number.isFinite(ft) || !Number.isFinite(inch) || (ft <= 0 && inch <= 0)) return null;
    return ft * 30.48 + inch * 2.54;
  },
});

const profil = (overrides: Record<string, unknown> = {}) => ({
  firstName: 'Damien',
  sex: 'male' as const,
  birthDate: '1990-03-15',
  weightKg: 80,
  heightCm: 180,
  targetWeightKg: 75,
  mainGoal: 'health' as const,
  ...overrides,
});

const afficher = async ({
  profile = profil() as Record<string, unknown> | null,
  isLoading = false,
  imperial = false,
} = {}) => {
  mockProfile.mockReturnValue({ profile, isLoading });
  mockUnits.mockReturnValue(imperial ? unitesImperiales() : unitesMetriques());
  await render(<ProfileScreen />);
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

const enregistrer = async () => {
  await taper(screen.getByLabelText('profile.save'));
};

const CHAMP = {
  prenom: 'onboarding.infos.firstName',
  jour: 'auth.signUp.day',
  mois: 'auth.signUp.month',
  annee: 'auth.signUp.year',
  poidsKg: 'onboarding.infos.weight (kg)',
  poidsLb: 'onboarding.infos.weight (lb)',
  tailleCm: 'onboarding.infos.height (cm)',
  pieds: 'onboarding.infos.heightFeet (ft)',
  pouces: 'onboarding.infos.heightInches (in)',
  cibleKg: 'profile.targetWeight (kg)',
  cibleLb: 'profile.targetWeight (lb)',
} as const;

const ecrit = () => mockUpsert.mock.calls[0]![0] as Record<string, unknown>;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ back });
  mockUpsert.mockResolvedValue(undefined);
  mockSetTarget.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Chargement
// ---------------------------------------------------------------------------

describe('chargement', () => {
  it('🔴 le formulaire n’est monté qu’APRÈS résolution du profil', async () => {
    await afficher({ profile: null, isLoading: true });

    // `useQuery` renvoie `null` au premier rendu : monter le formulaire tout de suite figerait
    // `useState` sur des valeurs vides, et l'écran afficherait un profil vide alors qu'il est
    // plein en base — puis l'enregistrerait vide.
    expect(screen.queryByLabelText(CHAMP.prenom)).toBeNull();
  });

  it('un profil absent donne un formulaire vierge, pas un écran cassé', async () => {
    await afficher({ profile: null });

    // Premier passage après l'onboarding : les champs existent, ils sont juste vides.
    expect(screen.getByLabelText(CHAMP.prenom).props.value).toBe('');
    expect(screen.getByLabelText('opt-unspecified').props.accessibilityState.selected).toBe(true);
  });

  it('les valeurs existantes pré-remplissent les champs', async () => {
    await afficher();

    expect(screen.getByLabelText(CHAMP.prenom).props.value).toBe('Damien');
    expect(screen.getByLabelText(CHAMP.poidsKg).props.value).toBe('80');
    expect(screen.getByLabelText('opt-male').props.accessibilityState.selected).toBe(true);
  });

  it('🔴 la date de naissance est éclatée en trois champs, zéros conservés', async () => {
    await afficher({ profile: profil({ birthDate: '1990-03-05' }) });

    // « 3 » et « 5 » au lieu de « 03 » et « 05 » réécriraient une date différente au premier
    // enregistrement, sans que l'utilisateur touche à rien.
    expect(screen.getByLabelText(CHAMP.jour).props.value).toBe('05');
    expect(screen.getByLabelText(CHAMP.mois).props.value).toBe('03');
    expect(screen.getByLabelText(CHAMP.annee).props.value).toBe('1990');
  });
});

// ---------------------------------------------------------------------------
// La garde anti-dérive
// ---------------------------------------------------------------------------

describe('garde anti-dérive', () => {
  it('🔴 en IMPÉRIAL, ouvrir puis enregistrer NE CHANGE PAS le poids stocké', async () => {
    await afficher({ profile: profil({ weightKg: 80 }), imperial: true });

    await enregistrer();

    // Sans la ref, 80 kg → « 176 lb » → 79,83 kg : le poids glisserait à chaque ouverture de
    // l'écran, sans que personne ne touche au champ. La dérive est de l'ordre du gramme par
    // passage — invisible sur un écran, ruineuse sur une courbe de poids.
    expect(ecrit()).toMatchObject({ weightKg: 80 });
  });

  it('🔴 la même garde protège la TAILLE', async () => {
    await afficher({ profile: profil({ heightCm: 180 }), imperial: true });

    await enregistrer();

    expect(ecrit()).toMatchObject({ heightCm: 180 });
  });

  it('🔴 une valeur RÉELLEMENT modifiée est bien convertie', async () => {
    await afficher({ profile: profil({ weightKg: 80 }), imperial: true });

    await saisir(CHAMP.poidsLb, '180');
    await enregistrer();

    // La garde ne doit pas figer la valeur : elle ne s'applique que si la chaîne affichée est
    // restée identique.
    expect(ecrit().weightKg).toBeCloseTo(180 / LB_PAR_KG, 5);
  });

  it('en métrique, la valeur inchangée reste elle-même', async () => {
    await afficher({ profile: profil({ weightKg: 80 }) });

    await enregistrer();

    expect(ecrit()).toMatchObject({ weightKg: 80, heightCm: 180 });
  });

  it('🔴 le poids cible n’est réécrit QUE s’il a changé', async () => {
    await afficher({ profile: profil({ targetWeightKg: 75 }), imperial: true });

    await enregistrer();

    // Même dérive, même parade — et ici l'écriture passe par un autre repository, donc la garde
    // se lit à l'appel : pas d'appel du tout si rien n'a bougé.
    expect(mockSetTarget).not.toHaveBeenCalled();
  });

  it('un poids cible modifié est enregistré', async () => {
    await afficher({ profile: profil({ targetWeightKg: 75 }) });

    await saisir(CHAMP.cibleKg, '72');
    await enregistrer();

    expect(mockSetTarget).toHaveBeenCalledWith(72);
  });

  it('🔴 un poids cible VIDÉ est effacé, pas ignoré', async () => {
    await afficher({ profile: profil({ targetWeightKg: 75 }) });

    await saisir(CHAMP.cibleKg, '');
    await enregistrer();

    // « Je n'ai plus d'objectif de poids » est un geste délibéré : sans ce `null`, on ne pourrait
    // jamais retirer une cible une fois posée.
    expect(mockSetTarget).toHaveBeenCalledWith(null);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('validation', () => {
  it.each([
    ['le poids', CHAMP.poidsKg],
    ['la taille', CHAMP.tailleCm],
    ['le poids cible', CHAMP.cibleKg],
  ])('🔴 %s illisible BLOQUE l’enregistrement et le dit', async (_champ, label) => {
    await afficher();

    await saisir(label, 'abc');

    // Une faute de frappe ne doit pas devenir un effacement silencieux : l'écran refuse et
    // l'annonce, plutôt que d'écraser une valeur juste par `null`.
    expect(screen.getByLabelText('profile.save').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('profile.invalidNumber')).toBeTruthy();
  });

  it('🔴 un champ VIDE, lui, reste autorisé', async () => {
    await afficher();

    await saisir(CHAMP.cibleKg, '');

    // Vider est un geste ; saisir n'importe quoi est une erreur. Confondre les deux empêcherait
    // de retirer un objectif.
    expect(screen.getByLabelText('profile.save').props.accessibilityState.disabled).toBe(false);
    expect(screen.queryByText('profile.invalidNumber')).toBeNull();
  });

  it('🔴 la garde tient AUSSI côté fonction, pas seulement sur le bouton', async () => {
    await afficher();

    await saisir(CHAMP.poidsKg, 'abc');
    await enregistrer();

    // Le bouton désactivé est une commodité d'interface ; la garde dans `onSave` est ce qui
    // protège réellement la base si l'appui passe malgré tout.
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('un poids valide lève le blocage', async () => {
    await afficher();

    await saisir(CHAMP.poidsKg, 'abc');
    await saisir(CHAMP.poidsKg, '82');

    expect(screen.getByLabelText('profile.save').props.accessibilityState.disabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Enregistrement
// ---------------------------------------------------------------------------

describe('enregistrement', () => {
  it('le prénom est détouré', async () => {
    await afficher();

    await saisir(CHAMP.prenom, '  Damien  ');
    await enregistrer();

    expect(ecrit()).toMatchObject({ firstName: 'Damien' });
  });

  it('la date est recomposée en ISO', async () => {
    await afficher({ profile: null });

    await saisir(CHAMP.jour, '5');
    await saisir(CHAMP.mois, '3');
    await saisir(CHAMP.annee, '1990');
    await enregistrer();

    // `toIsoDate` est pure et prise telle quelle : c'est elle qui rembourre les zéros, et le
    // faire ici en double finirait par diverger.
    expect(ecrit()).toMatchObject({ birthDate: '1990-03-05' });
  });

  it('🔴 une date incomplète ne bloque pas, elle vaut « non renseignée »', async () => {
    await afficher({ profile: null });

    await saisir(CHAMP.prenom, 'Damien');
    await enregistrer();

    // La date de naissance n'est requise que pour le calcul du TDEE : la rendre obligatoire ici
    // empêcherait d'enregistrer un prénom.
    expect(mockUpsert).toHaveBeenCalled();
    expect(ecrit().birthDate).toBeNull();
  });

  it('le sexe et l’objectif sont transmis', async () => {
    await afficher();

    await taper(screen.getByLabelText('opt-female'));
    await taper(screen.getByLabelText('opt-muscle'));
    await enregistrer();

    expect(ecrit()).toMatchObject({ sex: 'female', mainGoal: 'muscle' });
  });

  it('🔴 sans objectif choisi, l’affichage retombe sur « santé » sans l’ÉCRIRE', async () => {
    await afficher({ profile: profil({ mainGoal: null }) });

    // Le segment doit montrer quelque chose ; écrire ce repli ferait croire à un choix que
    // l'utilisateur n'a pas fait, et changerait ses objectifs nutritionnels par ricochet.
    expect(screen.getByLabelText('opt-health').props.accessibilityState.selected).toBe(true);

    await enregistrer();
    expect(ecrit()).toMatchObject({ mainGoal: null });
  });

  it('l’écran se referme après enregistrement', async () => {
    await afficher();

    await enregistrer();

    expect(back).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Unités
// ---------------------------------------------------------------------------

describe('unités', () => {
  it('🔴 en impérial, la taille se saisit en DEUX champs', async () => {
    await afficher({ imperial: true });

    // Une taille en pouces seuls (« 71 ») n'est pas la façon dont on énonce sa taille : les
    // pieds et les pouces sont deux champs, comme sur une balance américaine.
    expect(screen.getByLabelText(CHAMP.pieds)).toBeTruthy();
    expect(screen.getByLabelText(CHAMP.pouces)).toBeTruthy();
    expect(screen.queryByLabelText(CHAMP.tailleCm)).toBeNull();
  });

  it('en métrique, un seul champ de taille', async () => {
    await afficher();

    expect(screen.getByLabelText(CHAMP.tailleCm)).toBeTruthy();
    expect(screen.queryByLabelText(CHAMP.pieds)).toBeNull();
  });

  it('🔴 le symbole d’unité est dans le LIBELLÉ du champ', async () => {
    await afficher({ imperial: true });

    // Sans lui, « 176 » est ambigu : c'est la seule chose qui distingue une saisie en livres
    // d'une saisie en kilos, et l'erreur est d'un facteur 2,2.
    expect(screen.getByLabelText(CHAMP.poidsLb)).toBeTruthy();
    expect(screen.getByLabelText(CHAMP.cibleLb)).toBeTruthy();
  });
});
