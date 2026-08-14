/**
 * Scan de code-barres (`app/food-scan.tsx`) — le **vrai** écran, monté.
 *
 * Écran à **0 %** avant ce fichier (59 instructions), et **il portait lui aussi le défaut du lien
 * direct** (`params.date ?? ''`) : c'est le chemin le plus exposé, celui qu'on ouvre en raccourci,
 * donc sans paramètres. Corrigé le 14/08/2026 avec `meal-quick-entry`.
 *
 * La caméra ne se monte pas hors device — c'est de la recette. Ce qui se teste, et qui porte tout
 * le risque, c'est la **machine à états** derrière elle :
 *
 *  1. **Un code n'est résolu QU'UNE FOIS.** La caméra rappelle en continu tant qu'un code est
 *     visible : sans verrou, un seul produit devant l'objectif déclencherait des dizaines
 *     d'imports OpenFoodFacts et autant de lignes `foods` en double.
 *  2. **Le local avant le réseau.** Un produit déjà importé ne repart pas chez OpenFoodFacts —
 *     c'est ce qui rend le scan utilisable hors ligne sur ses propres produits.
 *  3. **Trois échecs, trois messages.** « Réseau indisponible », « code inconnu » et « fiche
 *     incomplète » demandent trois gestes différents : réessayer, créer l'aliment, ou compléter.
 *     Un message unique ferait recommencer le scan indéfiniment dans deux cas sur trois.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import FoodScanScreen from '../food-scan';
import { findFoodByBarcode, importOpenFoodFactsFood } from '@/data/repositories/food-repository';
import { addFoodEntry } from '@/data/repositories/journal-repository';
import { fetchOpenFoodFactsByBarcode } from '@/lib/openfoodfacts';
import { useCameraPermissions } from 'expo-camera';
import { useTodayKey } from '@/hooks/useTodayKey';
import { useLocalSearchParams, useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/food-repository', () => ({
  findFoodByBarcode: jest.fn(),
  importOpenFoodFactsFood: jest.fn(),
}));
jest.mock('@/data/repositories/journal-repository', () => ({ addFoodEntry: jest.fn() }));
jest.mock('@/lib/openfoodfacts', () => ({ fetchOpenFoodFactsByBarcode: jest.fn() }));
jest.mock('@/hooks/useTodayKey', () => ({ useTodayKey: jest.fn(() => '2026-08-14') }));

/**
 * La caméra est native : elle ne se monte pas ici. La sonde expose son rappel de scan sous forme
 * de bouton, ce qui permet de rejouer la machine à états — y compris les rappels **répétés** que
 * la vraie caméra produit tant qu'un code reste dans le cadre.
 */
jest.mock('expo-camera', () => {
  const { Pressable, Text } = require('react-native');
  const CameraView = ({
    onBarcodeScanned,
  }: {
    onBarcodeScanned?: (r: { data: string }) => void;
  }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="scanner"
      accessibilityState={{ disabled: !onBarcodeScanned }}
      onPress={() => onBarcodeScanned?.({ data: '3017620422003' })}
    >
      <Text>camera</Text>
    </Pressable>
  );
  CameraView.displayName = 'CameraView';
  return { CameraView, useCameraPermissions: jest.fn() };
});

jest.mock('@/components/QuantityPanel', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    QuantityPanel: ({
      target,
      onCancel,
      onConfirm,
    }: {
      target: { name: string };
      onCancel: () => void;
      onConfirm: (g: number) => void;
    }) => (
      <View>
        <Text>quantite:{target.name}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="confirmer-150" onPress={() => onConfirm(150)}>
          <Text>confirmer</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="annuler-quantite" onPress={onCancel}>
          <Text>annuler</Text>
        </Pressable>
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

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: { text: '#33291f', textMuted: '#96856f', background: '#fffaf2', accent: '#c0562f' },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockFindLocal = findFoodByBarcode as jest.Mock;
const mockImport = importOpenFoodFactsFood as jest.Mock;
const mockAddEntry = addFoodEntry as jest.Mock;
const mockFetchOff = fetchOpenFoodFactsByBarcode as jest.Mock;
const mockPermissions = useCameraPermissions as jest.Mock;
const mockToday = useTodayKey as jest.Mock;
const mockParams = useLocalSearchParams as unknown as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const back = jest.fn();
const replace = jest.fn();
const dismissAll = jest.fn();
const requestPermission = jest.fn();

const CODE = '3017620422003';

const produitOff = (overrides: Record<string, unknown> = {}) => ({
  name: 'Pâte à tartiner',
  barcode: CODE,
  kcalPer100g: 539,
  proteinPer100g: 6.3,
  carbsPer100g: 57.5,
  fatPer100g: 30.9,
  sugarsPer100g: 56.3,
  saturatedFatPer100g: 10.6,
  fiberPer100g: null,
  micronutrients: { sodium_mg: 42 },
  ...overrides,
});

const afficher = async ({
  granted = true,
  permission = {} as Record<string, unknown> | null,
  params = { date: '2026-08-10', meal: 'lunch' } as Record<string, string>,
} = {}) => {
  mockPermissions.mockReturnValue([
    permission === null ? null : { granted, ...permission },
    requestPermission,
  ]);
  mockParams.mockReturnValue(params);
  await render(<FoodScanScreen />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

/** Rejoue un scan (un rappel de la caméra). */
const scanner = async () => {
  await taper(screen.getByLabelText('scanner'));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ back, replace, dismissAll });
  mockToday.mockReturnValue('2026-08-14');
  mockFindLocal.mockResolvedValue(null);
  mockFetchOff.mockResolvedValue({ kind: 'notFound' });
  mockImport.mockResolvedValue('f-importe');
  mockAddEntry.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Permission caméra
// ---------------------------------------------------------------------------

describe('permission caméra', () => {
  it('🔴 tant que la permission est INCONNUE, on n’affiche ni caméra ni refus', async () => {
    await afficher({ permission: null });

    // `permission === null` = état non encore résolu. Afficher « autorisez la caméra » à ce
    // moment-là accuserait l'utilisateur d'un refus qu'il n'a pas donné.
    expect(screen.queryByText('scan.permission.message')).toBeNull();
    expect(screen.queryByLabelText('scanner')).toBeNull();
  });

  it('un refus explique et propose de l’accorder', async () => {
    await afficher({ granted: false });

    expect(screen.getByText('scan.permission.message')).toBeTruthy();
    await taper(screen.getByLabelText('scan.permission.grant'));
    expect(requestPermission).toHaveBeenCalled();
  });

  it('🔴 un refus laisse une SORTIE', async () => {
    await afficher({ granted: false });

    // Sans ce bouton, refuser la caméra enfermerait l'utilisateur sur un écran inutilisable.
    await taper(screen.getByLabelText('common.cancel'));
    expect(back).toHaveBeenCalled();
  });

  it('permission accordée : la caméra est montée', async () => {
    await afficher();

    expect(screen.getByLabelText('scanner')).toBeTruthy();
    expect(screen.getByText('scan.hint')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Résolution d'un code
// ---------------------------------------------------------------------------

describe('résolution', () => {
  it('🔴 le LOCAL est consulté avant le réseau', async () => {
    mockFindLocal.mockResolvedValue({ id: 'f-local', name: 'Déjà connu', kcalPer100g: 100, portions: [] });
    await afficher();

    await scanner();

    // C'est ce qui rend le scan utilisable hors ligne sur ses propres produits — et ce qui évite
    // de réimporter une fiche qu'on a déjà.
    expect(mockFetchOff).not.toHaveBeenCalled();
    expect(mockImport).not.toHaveBeenCalled();
    expect(screen.getByText('quantite:Déjà connu')).toBeTruthy();
  });

  it('un produit inconnu localement est cherché puis importé', async () => {
    mockFetchOff.mockResolvedValue({ kind: 'found', food: produitOff() });
    await afficher();

    await scanner();

    expect(mockFetchOff).toHaveBeenCalledWith(CODE, 'fr');
    expect(mockImport).toHaveBeenCalledWith(expect.objectContaining({ barcode: CODE }));
    expect(screen.getByText('quantite:Pâte à tartiner')).toBeTruthy();
  });

  it('🔴 un même code n’est résolu QU’UNE FOIS', async () => {
    mockFindLocal.mockReturnValue(new Promise(() => {})); // reste en résolution
    await afficher();

    await scanner();
    await scanner();
    await scanner();

    // La caméra rappelle en continu tant qu'un code est visible : sans le verrou `lockedCode`,
    // un seul produit devant l'objectif déclencherait des dizaines d'imports et autant de lignes
    // `foods` en double.
    expect(mockFindLocal).toHaveBeenCalledTimes(1);
  });

  it('🔴 pendant la résolution, la caméra ne rappelle plus', async () => {
    mockFindLocal.mockReturnValue(new Promise(() => {}));
    await afficher();

    await scanner();

    // `onBarcodeScanned` passe à `undefined` hors phase de scan : le verrou seul ne suffirait pas
    // si un AUTRE code entrait dans le cadre pendant la requête réseau.
    expect(screen.getByLabelText('scanner').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('scan.resolving')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Échecs
// ---------------------------------------------------------------------------

describe('échecs', () => {
  it.each([
    ['networkError', 'scan.error.network'],
    ['incomplete', 'scan.error.incomplete'],
  ])('🔴 un échec « %s » a son PROPRE message', async (kind, cle) => {
    mockFetchOff.mockResolvedValue({ kind });
    await afficher();

    await scanner();

    // Trois causes, trois gestes : réessayer (réseau), compléter (fiche incomplète), créer
    // l'aliment (code inconnu). Un message unique ferait recommencer le scan indéfiniment dans
    // deux cas sur trois.
    expect(screen.getByText(cle)).toBeTruthy();
  });

  it('🔴 un code inconnu est RAPPELÉ dans le message', async () => {
    mockFetchOff.mockResolvedValue({ kind: 'notFound' });
    await afficher();

    await scanner();

    // Le code permet de chercher le produit ailleurs, ou de comprendre qu'on a scanné le
    // code-barres de l'emballage plutôt que celui du produit.
    expect(screen.getByText(`scan.error.unknownCode:{"code":"${CODE}"}`)).toBeTruthy();
  });

  it('🔴 « rescanner » LIBÈRE le verrou du code précédent', async () => {
    mockFetchOff.mockResolvedValue({ kind: 'notFound' });
    await afficher();

    await scanner();
    await taper(screen.getByLabelText('scan.rescan'));
    await scanner();

    // Sans la remise à `null`, rescanner le même produit ne ferait rien — et l'utilisateur
    // conclurait que le bouton est cassé.
    expect(mockFetchOff).toHaveBeenCalledTimes(2);
  });

  it('🔴 créer l’aliment REMPLACE l’écran de scan, en transmettant jour et repas', async () => {
    mockFetchOff.mockResolvedValue({ kind: 'notFound' });
    await afficher({ params: { date: '2026-08-10', meal: 'dinner' } });

    await scanner();
    await taper(screen.getByLabelText('journal.createFood'));

    // `replace` : revenir sur la caméra après avoir créé l'aliment rescannerait le même code
    // introuvable. Et sans les paramètres, l'aliment créé atterrirait au petit-déjeuner du jour.
    expect(replace).toHaveBeenCalledWith({
      pathname: '/food-custom',
      params: { date: '2026-08-10', meal: 'dinner' },
    });
  });
});

// ---------------------------------------------------------------------------
// Ajout au journal
// ---------------------------------------------------------------------------

describe('ajout au journal', () => {
  const scannerProduit = async () => {
    mockFetchOff.mockResolvedValue({ kind: 'found', food: produitOff() });
    await scanner();
  };

  it('🔴 sans `date`, l’entrée est rattachée à AUJOURD’HUI, jamais à rien', async () => {
    await afficher({ params: {} });

    await scannerProduit();
    await taper(screen.getByLabelText('confirmer-150'));

    // Le scan est le chemin le plus exposé au lien direct : c'est celui qu'on ouvre en raccourci,
    // donc sans paramètres. Même défaut que `food-picker`, corrigé le 01/08/2026 — le correctif
    // n'avait pas suivi ici.
    expect(mockAddEntry).toHaveBeenCalledWith('2026-08-14', 'breakfast', expect.anything());
  });

  it('🔴 le snapshot ET les micronutriments sont mis à l’échelle', async () => {
    await afficher();

    await scannerProduit();
    await taper(screen.getByLabelText('confirmer-150'));

    // Les micros suivent la même règle de trois que les macros : les laisser pour 100 g
    // gonflerait la couverture micro de toute journée où le produit apparaît.
    const entree = mockAddEntry.mock.calls[0]![2] as Record<string, unknown>;
    expect(entree).toMatchObject({ foodId: 'f-importe', quantityG: 150, kcal: 809 });
    expect(entree.micronutrients).toEqual({ sodium_mg: 63 });
  });

  it('🔴 l’ajout referme TOUTE la pile modale', async () => {
    await afficher();

    await scannerProduit();
    await taper(screen.getByLabelText('confirmer-150'));

    // `dismissAll` et non `back` : on est arrivé par food-picker → scan. Un simple retour
    // ramènerait sur le sélecteur d'aliment, alors que l'ajout est fait.
    expect(dismissAll).toHaveBeenCalled();
  });

  it('annuler la quantité REPART en scan', async () => {
    await afficher();

    await scannerProduit();
    await taper(screen.getByLabelText('annuler-quantite'));

    expect(mockAddEntry).not.toHaveBeenCalled();
    expect(screen.getByLabelText('scanner')).toBeTruthy();
  });

  it('🔴 annuler libère aussi le verrou', async () => {
    await afficher();

    await scannerProduit();
    await taper(screen.getByLabelText('annuler-quantite'));
    await scanner();

    // Se raviser puis rescanner le même produit est un geste banal : le verrou doit tomber avec
    // le panneau de quantité.
    expect(mockFetchOff).toHaveBeenCalledTimes(2);
  });
});
