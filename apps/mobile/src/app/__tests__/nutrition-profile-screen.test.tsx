/**
 * Profil nutritionnel (`app/nutrition-profile.tsx`) — le **vrai** écran, monté.
 *
 * Écran à **0 %** avant ce fichier (76 instructions). C'est **l'écran qui fixe la cible** : tout ce
 * qu'il écrit se répercute sur le journal, le bilan du jour, le planning repas et les suggestions
 * de macros. Une erreur ici n'est jamais visible ici — elle se voit dans un objectif qui a bougé
 * sans raison, à un autre endroit de l'app.
 *
 *  1. **Aucun bouton « enregistrer ».** Chaque choix écrit immédiatement (offline-first) : un
 *     formulaire à valider ferait perdre la saisie de qui referme l'écran, ce que la modale de
 *     navigation rend trivial.
 *  2. **Manuel bat calculé, et le retour au calculé est un geste explicite.** Une calorie ou une
 *     macro saisie fige la cible ; le bouton « recalculer » est le seul moyen de rendre la main au
 *     TDEE — sans lui, on ne pourrait jamais défaire une saisie.
 *  3. **Un profil incomplet ne produit AUCUNE cible.** Sans poids, taille ni âge, `tdee` renvoie
 *     `null` : l'écran propose de compléter le profil au lieu d'afficher un objectif inventé, que
 *     l'utilisateur suivrait.
 *  4. **Toucher une seule macro les fige toutes les trois.** C'est le comportement réel — les trois
 *     partent ensemble à l'écriture — et il est délibéré : une répartition à moitié manuelle
 *     donnerait un total qui ne correspond à aucun objectif.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import NutritionProfileScreen from '../nutrition-profile';
import { upsertNutritionProfile, useNutritionProfile } from '@/data/repositories/nutrition-repository';
import { useProfile } from '@/data/repositories/profile-repository';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/nutrition-repository', () => ({
  useNutritionProfile: jest.fn(() => ({ nutritionProfile: null })),
  upsertNutritionProfile: jest.fn(),
}));
jest.mock('@/data/repositories/profile-repository', () => ({
  useProfile: jest.fn(() => ({ profile: null })),
}));

jest.mock('@/stores/tracked-micros', () => {
  const etat = { tracked: [] as string[], toggle: jest.fn() };
  return {
    useTrackedMicros: (selecteur: (s: typeof etat) => unknown) => selecteur(etat),
    __etat: etat,
  };
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
jest.mock('@/components/TextField', () => {
  const { TextInput } = require('react-native');
  return {
    TextField: ({
      label,
      value,
      onChangeText,
      placeholder,
    }: {
      label: string;
      value: string;
      onChangeText: (v: string) => void;
      placeholder?: string;
    }) => (
      <TextInput
        accessibilityLabel={label}
        value={value}
        placeholder={placeholder}
        onChangeText={onChangeText}
      />
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
          accessibilityLabel={`seg-${String(o)}`}
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
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      background: '#fffaf2',
      surface: '#fffaf2',
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      accent: '#c0562f',
      accentText: '#ffffff',
      success: '#7c8a5b',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockNutritionProfile = useNutritionProfile as jest.Mock;
const mockProfile = useProfile as jest.Mock;
const mockUpsert = upsertNutritionProfile as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;
const etatMicros = jest.requireMock('@/stores/tracked-micros').__etat as {
  tracked: string[];
  toggle: jest.Mock;
};

const push = jest.fn();
const back = jest.fn();

/** Profil complet : sans poids, taille ni âge, `tdee` renvoie `null` et rien n'est calculable. */
const PROFIL = {
  sex: 'male' as const,
  weightKg: 80,
  heightCm: 180,
  birthDate: '1990-01-01',
  mainGoal: 'health' as const,
};

const afficher = async ({
  profile = PROFIL as Record<string, unknown> | null,
  nutritionProfile = null as Record<string, unknown> | null,
  micros = [] as string[],
} = {}) => {
  mockProfile.mockReturnValue({ profile });
  mockNutritionProfile.mockReturnValue({ nutritionProfile });
  etatMicros.tracked = micros;
  await render(<NutritionProfileScreen />);
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

/** Une option de liste verticale (objectif, niveau d'activité), retrouvée par son libellé. */
const option = (cle: string) => screen.getByText(cle).parent!;

const CHAMP = {
  manuel: 'nutrition.calories.manual',
  bonus: 'nutrition.calories.trainingBonus',
  grammes: 'nutrition.macros.grams',
  allergenes: 'nutrition.restrictions.allergens',
} as const;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push, back });
  mockUpsert.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Profil incomplet
// ---------------------------------------------------------------------------

describe('profil incomplet', () => {
  it('🔴 sans données corporelles, AUCUNE cible n’est affichée', async () => {
    await afficher({ profile: null });

    // `tdee` renvoie `null` : inventer un objectif serait pire que ne rien dire, puisque
    // l'utilisateur le suivrait.
    expect(screen.getByText('nutrition.calories.incomplete')).toBeTruthy();
    expect(screen.queryByLabelText(CHAMP.manuel)).toBeNull();
  });

  it('l’écran renvoie vers le profil général pour le compléter', async () => {
    await afficher({ profile: null });

    await taper(screen.getByLabelText('nutrition.calories.completeProfile'));

    // Le poids et la taille vivent sur le profil général : sans ce raccourci, l'utilisateur devrait
    // deviner où aller les saisir.
    expect(push).toHaveBeenCalledWith('/profile');
  });

  it('🔴 sans cible, AUCUNE macro n’est proposée non plus', async () => {
    await afficher({ profile: null });

    // Les grammes dérivent des calories : les afficher sans cible donnerait des chiffres sans base.
    expect(screen.queryByLabelText(CHAMP.grammes)).toBeNull();
  });

  it('les réglages qui ne dépendent pas du corps restent accessibles', async () => {
    await afficher({ profile: null });

    // Objectif, restrictions et micros suivis n'ont pas besoin du TDEE : les masquer aussi
    // ferait d'un profil incomplet un écran vide.
    expect(screen.getByText('nutrition.objective.options.maintain')).toBeTruthy();
    expect(screen.getByText('nutrition.restrictions.options.vegan')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Objectif et activité
// ---------------------------------------------------------------------------

describe('objectif et activité', () => {
  it('🔴 l’objectif nutritionnel est DÉRIVÉ de l’objectif d’entraînement à la première ouverture', async () => {
    await afficher({ profile: { ...PROFIL, mainGoal: 'muscle' } });

    // `objectiveFromGoal` est pure et prise telle quelle : quelqu'un qui a dit « prendre du muscle »
    // n'a pas à le redire ici. Le proposer vierge ferait repartir de « maintien », à contresens.
    expect(option('nutrition.objective.options.bulk').props.accessibilityState.selected).toBe(true);
  });

  it('un objectif nutritionnel explicite prime sur la dérivation', async () => {
    await afficher({
      profile: { ...PROFIL, mainGoal: 'muscle' },
      nutritionProfile: { objective: 'cut' },
    });

    expect(option('nutrition.objective.options.cut').props.accessibilityState.selected).toBe(true);
  });

  it('changer d’objectif écrit immédiatement', async () => {
    await afficher();

    await taper(option('nutrition.objective.options.weightloss'));

    // Aucun bouton « enregistrer » : une modale se referme d'un geste, et une saisie non validée
    // serait perdue sans que rien ne prévienne.
    expect(mockUpsert).toHaveBeenCalledWith({ objective: 'weightloss' });
  });

  it('🔴 le niveau d’activité affiche SON FACTEUR, virgule française', async () => {
    await afficher();

    // « Modéré » ne dit rien ; « ×1,55 » permet de comprendre pourquoi la cible bouge de 300 kcal
    // quand on change de ligne.
    expect(screen.getByText('×1,55')).toBeTruthy();
  });

  it('le niveau par défaut est « modéré »', async () => {
    await afficher();

    expect(option('nutrition.activity.options.moderate').props.accessibilityState.selected).toBe(true);
  });

  it('changer de niveau d’activité écrit immédiatement', async () => {
    await afficher();

    await taper(option('nutrition.activity.options.sedentary'));

    expect(mockUpsert).toHaveBeenCalledWith({ activityLevel: 'sedentary' });
  });
});

// ---------------------------------------------------------------------------
// Calories
// ---------------------------------------------------------------------------

describe('calories', () => {
  it('le TDEE et la cible sont affichés séparément', async () => {
    await afficher();

    // Deux nombres distincts : le TDEE est ce qu'on dépense, la cible ce qu'on vise. Les confondre
    // rendrait incompréhensible un déficit ou un surplus.
    expect(screen.getByText('nutrition.calories.tdee')).toBeTruthy();
    expect(screen.getByText('nutrition.calories.target')).toBeTruthy();
  });

  it('🔴 la cible AUTOMATIQUE sert de placeholder au champ manuel', async () => {
    await afficher();

    // Le champ vide n'est pas « zéro calorie » : il montre ce qui s'appliquerait, ce qui évite de
    // saisir un chiffre par précaution.
    const champ = screen.getByLabelText(CHAMP.manuel);
    expect(champ.props.value).toBe('');
    expect(Number(champ.props.placeholder)).toBeGreaterThan(1000);
  });

  it('saisir une cible manuelle l’écrit', async () => {
    await afficher();

    await saisir(CHAMP.manuel, '2200');

    expect(mockUpsert).toHaveBeenCalledWith({ manualCalories: 2200 });
  });

  it.each(['', '0', '-500', 'abc'])('🔴 une cible manuelle « %s » vaut « aucune »', async (valeur) => {
    await afficher({ nutritionProfile: { manualCalories: 2200 } });

    await saisir(CHAMP.manuel, valeur);

    // `null` et non `0` : c'est ce qui rend la main au calcul automatique. Écrire `0` figerait une
    // cible à zéro calorie, que rien dans l'app ne saurait interpréter.
    expect(mockUpsert).toHaveBeenCalledWith({ manualCalories: null });
  });

  it('🔴 « recalculer » n’apparaît QUE si une cible manuelle est posée', async () => {
    await afficher();
    expect(screen.queryByLabelText('nutrition.calories.recompute')).toBeNull();

    await afficher({ nutritionProfile: { manualCalories: 2200 } });

    // Sans ce bouton, on ne pourrait jamais défaire une saisie manuelle : vider le champ suffit,
    // mais encore faut-il le savoir.
    expect(screen.getByLabelText('nutrition.calories.recompute')).toBeTruthy();
  });

  it('« recalculer » rend la main au calcul automatique', async () => {
    await afficher({ nutritionProfile: { manualCalories: 2200 } });

    await taper(screen.getByLabelText('nutrition.calories.recompute'));

    expect(mockUpsert).toHaveBeenCalledWith({ manualCalories: null });
  });
});

// ---------------------------------------------------------------------------
// Bonus jour d'entraînement
// ---------------------------------------------------------------------------

describe('bonus jour d’entraînement', () => {
  it('le mode par défaut est le FORFAIT', async () => {
    await afficher();

    // Le mode auto dérive le bonus d'une course enregistrée : inutile pour qui ne court pas, et
    // silencieux pour qui n'a pas encore couru.
    expect(screen.getByLabelText('seg-fixed').props.accessibilityState.selected).toBe(true);
  });

  it('basculer en mode auto écrit le réglage', async () => {
    await afficher();

    await taper(screen.getByLabelText('seg-auto'));

    expect(mockUpsert).toHaveBeenCalledWith({ trainingBonusMode: 'auto' });
  });

  it('🔴 un bonus de 0 s’affiche VIDE, pas « 0 »', async () => {
    await afficher({ nutritionProfile: { trainingDayBonus: 0 } });

    // Un « 0 » dans le champ se lit comme une valeur choisie ; le vide, avec son placeholder,
    // dit « désactivé ».
    expect(screen.getByLabelText(CHAMP.bonus).props.value).toBe('');
  });

  it.each([
    ['300', 300],
    ['', 0],
    ['-100', 0],
    ['abc', 0],
    ['250,6', 251],
  ])('bonus « %s » → %i', async (saisie, attendu) => {
    await afficher();

    await saisir(CHAMP.bonus, saisie);

    // Tout ce qui n'est pas un entier positif désactive le bonus. Un bonus négatif abaisserait la
    // cible les jours de séance — l'inverse de ce que le réglage promet.
    expect(mockUpsert).toHaveBeenCalledWith({ trainingDayBonus: attendu });
  });

  it('la marge d’adhérence par défaut est 10 %', async () => {
    await afficher();

    expect(screen.getByLabelText('seg-10').props.accessibilityState.selected).toBe(true);
  });

  it('🔴 la marge est écrite comme un NOMBRE, pas une chaîne', async () => {
    await afficher();

    await taper(screen.getByLabelText('seg-15'));

    // Le segment porte des chaînes (contrainte du composant) : sans `parseInt`, la base recevrait
    // « 15 » et toute comparaison numérique en aval deviendrait fausse.
    expect(mockUpsert).toHaveBeenCalledWith({ adherenceMarginPct: 15 });
  });
});

// ---------------------------------------------------------------------------
// Macros
// ---------------------------------------------------------------------------

describe('macros', () => {
  it('les trois macros sont dérivées de la cible et de l’objectif', async () => {
    await afficher();

    const champs = screen.getAllByLabelText(CHAMP.grammes);
    expect(champs).toHaveLength(3);
    expect(Number(champs[0]!.props.value)).toBeGreaterThan(0);
  });

  it('🔴 toucher UNE macro les fige TOUTES LES TROIS', async () => {
    await afficher();

    const champs = screen.getAllByLabelText(CHAMP.grammes);
    await act(async () => {
      fireEvent.changeText(champs[0]!, '200');
    });

    // Comportement délibéré : une répartition à moitié manuelle donnerait un total qui ne
    // correspond ni à l'objectif calculé ni au choix de l'utilisateur.
    const ecrit = mockUpsert.mock.calls[0]![0] as Record<string, number>;
    expect(ecrit.manualProteinG).toBe(200);
    expect(ecrit.manualCarbsG).toBeGreaterThan(0);
    expect(ecrit.manualFatG).toBeGreaterThan(0);
  });

  it('🔴 une macro vidée vaut ZÉRO, pas « non renseignée »', async () => {
    await afficher({ nutritionProfile: { manualProteinG: 180, manualCarbsG: 200, manualFatG: 60 } });

    const champs = screen.getAllByLabelText(CHAMP.grammes);
    await act(async () => {
      fireEvent.changeText(champs[2]!, '');
    });

    // Ici, contrairement à l'aliment perso, `0` est le bon choix : une répartition manuelle est un
    // tout, et « pas de lipides » est un régime que certains suivent délibérément.
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ manualFatG: 0, manualProteinG: 180 }),
    );
  });

  it('🔴 les pourcentages affichés suivent les grammes MANUELS', async () => {
    await afficher({
      nutritionProfile: { manualProteinG: 100, manualCarbsG: 100, manualFatG: 0 },
    });

    // `macroRatiosFromGrams` est pure et prise telle quelle : afficher les ratios de l'objectif
    // par-dessus une répartition manuelle montrerait des pourcentages qui ne correspondent à
    // aucun des grammes saisis.
    expect(screen.getByText('0 %')).toBeTruthy();
  });

  it('« réinitialiser » n’apparaît QUE si une macro est manuelle', async () => {
    await afficher();
    expect(screen.queryByLabelText('nutrition.macros.reset')).toBeNull();

    await afficher({ nutritionProfile: { manualProteinG: 180 } });
    expect(screen.getByLabelText('nutrition.macros.reset')).toBeTruthy();
  });

  it('« réinitialiser » efface les TROIS macros manuelles', async () => {
    await afficher({ nutritionProfile: { manualProteinG: 180 } });

    await taper(screen.getByLabelText('nutrition.macros.reset'));

    // N'en effacer qu'une laisserait la répartition en mode manuel, avec deux valeurs figées que
    // rien n'expliquerait.
    expect(mockUpsert).toHaveBeenCalledWith({
      manualProteinG: null,
      manualCarbsG: null,
      manualFatG: null,
    });
  });
});

// ---------------------------------------------------------------------------
// Restrictions, allergènes et micros
// ---------------------------------------------------------------------------

describe('restrictions et allergènes', () => {
  it('une restriction se coche et s’écrit', async () => {
    await afficher();

    await taper(screen.getByText('nutrition.restrictions.options.vegan').parent!);

    expect(mockUpsert).toHaveBeenCalledWith({ restrictions: ['vegan'] });
  });

  it('🔴 recocher une restriction la RETIRE, sans toucher aux autres', async () => {
    await afficher({ nutritionProfile: { restrictions: ['vegan', 'halal'] } });

    await taper(screen.getByText('nutrition.restrictions.options.vegan').parent!);

    // Remplacer la liste entière ferait perdre les autres choix à chaque décochage.
    expect(mockUpsert).toHaveBeenCalledWith({ restrictions: ['halal'] });
  });

  it('🔴 les allergènes sont découpés sur la virgule, détourés et vidés des blancs', async () => {
    await afficher();

    await saisir(CHAMP.allergenes, ' arachide ,, gluten , ');

    // Une entrée vide entre deux virgules produirait un allergène « » qui filtrerait tout — ou
    // rien, selon l'implémentation en aval. Les deux sont mauvais.
    expect(mockUpsert).toHaveBeenCalledWith({ allergens: ['arachide', 'gluten'] });
  });

  it('les allergènes existants sont affichés en liste lisible', async () => {
    await afficher({ nutritionProfile: { allergens: ['arachide', 'gluten'] } });

    expect(screen.getByLabelText(CHAMP.allergenes).props.value).toBe('arachide, gluten');
  });

  it('un micronutriment suivi est marqué et se bascule', async () => {
    await afficher({ micros: ['sodium_mg'] });

    const puce = screen.getByText('nutrition.micros.labels.sodium_mg').parent!;
    expect(puce.props.accessibilityState.selected).toBe(true);

    await taper(puce);
    // Préférence **locale** : elle ne passe pas par le profil synchronisé, parce qu'elle décrit ce
    // qu'on veut voir sur cet appareil, pas un fait nutritionnel.
    expect(etatMicros.toggle).toHaveBeenCalledWith('sodium_mg');
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('« terminé » referme l’écran', async () => {
    await afficher();

    await taper(screen.getByLabelText('nutrition.done'));

    expect(back).toHaveBeenCalled();
  });
});
