/**
 * Feuille de saisie des mensurations (`components/measurements/MeasurementSheet`, US MESUR-01).
 *
 * Composant à **0 %** avant ce fichier. Une feuille de saisie de six champs facultatifs, où la
 * quasi-totalité de la logique sert à **décider ce qui part en écriture** — et surtout ce qui n'y
 * part pas.
 *
 * Quatre règles, dont une née d'une recette device :
 *
 *  1. **Seules les mesures MODIFIÉES sont écrites.** Réécrire les six à chaque ouverture
 *     empilerait des relevés identiques et rendrait toute courbe de progression illisible.
 *  2. **Vider un champ RETIRE la mesure de cette date** — c'est le seul moyen de corriger une
 *     saisie erronée, et ça ne doit toucher que cette mesure-là.
 *  3. **Une saisie illisible bloque l'enregistrement** au lieu d'effacer silencieusement : un
 *     `parse` qui rend `null` est indistinguable d'un champ vidé, donc d'une suppression.
 *  4. **🔴 Une valeur hors bornes bloque AUSSI, côté écran.** Sans ce contrôle, la valeur se parse,
 *     le bouton reste actif, l'écriture échoue au dépôt et l'utilisateur lit « réessaie » — un
 *     conseil faux, puisque réessayer avec la même valeur échouera toujours. Constaté en recette
 *     device le 31/07/2026.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { MeasurementSheet } from '../MeasurementSheet';
import { saveMeasurements } from '@/data/repositories/body-measurement-repository';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/body-measurement-repository', () => ({
  saveMeasurements: jest.fn(),
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
      background: '#f7eede',
      border: '#ece0cd',
      danger: '#b23b2e',
      success: '#7c8a5b',
      warnText: '#b5761f',
    },
  }),
}));

jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    circumferenceSymbol: 'cm',
    toCircumferenceValue: (cm: number) => cm,
    formatCircumference: (cm: number | null | undefined) => (cm == null ? '—' : `${cm} cm`),
    // La vraie règle : virgule acceptée, saisie illisible → `null`, arrondi au dixième.
    parseCircumferenceToCm: (text: string) => {
      const n = Number(text.trim().replace(',', '.'));
      if (text.trim() === '' || !Number.isFinite(n) || n <= 0) return null;
      return Math.round(n * 10) / 10;
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockSave = saveMeasurements as jest.Mock;
const onClose = jest.fn();

/** Le champ d'une mesure, retrouvé par son libellé d'accessibilité. */
const champ = (kind: string) =>
  screen.getByLabelText(`measurements.a11yField:{"kind":"measurements.kinds.${kind}","unit":"cm"}`);

const saisir = async (kind: string, valeur: string) => {
  await act(async () => {
    fireEvent.changeText(champ(kind), valeur);
  });
};

const enregistrer = async () => {
  await act(async () => {
    fireEvent.press(screen.getByText('measurements.save'));
  });
};

const bouton = () => screen.getByLabelText('measurements.save');

/** Dernier relevé connu. */
const releve = (valueCm: number) => ({ logDate: '2026-08-01', valueCm });

const afficher = (latest: Record<string, { logDate: string; valueCm: number }> = {}) =>
  render(<MeasurementSheet visible onClose={onClose} latest={latest as never} />);

beforeEach(() => {
  jest.clearAllMocks();
  mockSave.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Montage et pré-remplissage
// ---------------------------------------------------------------------------

describe('montage', () => {
  it('🔴 ne monte RIEN tant que la feuille est fermée', async () => {
    await render(<MeasurementSheet visible={false} onClose={onClose} latest={{}} />);

    expect(screen.queryByText('measurements.sheetTitle')).toBeNull();
  });

  it('un tap sur le fond ferme la feuille', async () => {
    await afficher();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('measurements.closeSheet'));
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('🔴 pré-remplit chaque champ avec le DERNIER relevé connu', async () => {
    await afficher({ waist: releve(82), arm: releve(35) });

    // On mesure rarement du premier coup : repartir de la valeur connue montre l'écart en direct,
    // au lieu d'obliger à retrouver le relevé précédent ailleurs.
    expect(champ('waist').props.value).toBe('82');
    expect(champ('arm').props.value).toBe('35');
  });

  it('une mesure jamais relevée reste vide', async () => {
    await afficher({ waist: releve(82) });

    expect(champ('arm').props.value).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Écart affiché
// ---------------------------------------------------------------------------

describe('écart avec le dernier relevé', () => {
  it('🔴 est porté par le SIGNE, pas seulement par la couleur', async () => {
    await afficher({ waist: releve(82) });

    await saisir('waist', '80');
    expect(screen.getByText('-2')).toBeTruthy();

    await saisir('waist', '84');
    // Le « + » explicite : un daltonien lit l'écart, pas la teinte.
    expect(screen.getByText('+2')).toBeTruthy();
  });

  it('🔴 aucun écart affiché quand la valeur n’a pas bougé', async () => {
    await afficher({ waist: releve(82) });

    // « 0 » n'apprend rien et attire l'œil sur un non-événement.
    expect(screen.queryByText('0')).toBeNull();
  });

  it('aucun écart sans relevé précédent', async () => {
    await afficher();

    await saisir('waist', '80');

    expect(screen.queryByText(/^[+-]/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Ce qui part en écriture
// ---------------------------------------------------------------------------

describe('ce qui part en écriture', () => {
  it('🔴 le bouton est désactivé tant que rien n’a bougé', async () => {
    await afficher({ waist: releve(82) });

    // Rouvrir la feuille et la refermer ne doit rien écrire.
    expect(bouton().props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('🔴 n’écrit QUE les mesures modifiées', async () => {
    await afficher({ waist: releve(82), arm: releve(35), thigh: releve(58) });

    await saisir('waist', '80');
    await enregistrer();

    // Réécrire les six à chaque ouverture empilerait des relevés identiques et rendrait toute
    // courbe de progression illisible.
    expect(mockSave).toHaveBeenCalledWith(expect.any(String), { waist: 80 });
  });

  it('🔴 vider un champ RETIRE la mesure de cette date', async () => {
    await afficher({ waist: releve(82), arm: releve(35) });

    await saisir('waist', '');
    await enregistrer();

    // `null` = retrait. C'est le seul moyen de corriger une saisie erronée, et il ne doit toucher
    // que cette mesure : `arm` n'apparaît pas dans le patch.
    expect(mockSave).toHaveBeenCalledWith(expect.any(String), { waist: null });
  });

  it('revenir à la valeur initiale annule la modification', async () => {
    await afficher({ waist: releve(82) });

    await saisir('waist', '80');
    await saisir('waist', '82');

    // Sinon on écrirait un relevé identique au précédent, juste parce que le champ a été touché.
    expect(bouton().props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('accepte la virgule décimale et arrondit au dixième', async () => {
    await afficher();

    await saisir('waist', '82,46');
    await enregistrer();

    // La colonne est `numeric(5,1)` : transporter plus de précision ne sert à rien, et le clavier
    // français produit une virgule.
    expect(mockSave).toHaveBeenCalledWith(expect.any(String), { waist: 82.5 });
  });

  it('écrit plusieurs mesures en une fois', async () => {
    await afficher();

    await saisir('waist', '80');
    await saisir('arm', '35');
    await enregistrer();

    expect(mockSave).toHaveBeenCalledWith(expect.any(String), { waist: 80, arm: 35 });
  });
});

// ---------------------------------------------------------------------------
// Refus de saisie
// ---------------------------------------------------------------------------

describe('refus de saisie', () => {
  it('🔴 une saisie illisible BLOQUE au lieu d’effacer silencieusement', async () => {
    await afficher({ waist: releve(82) });

    await saisir('waist', 'abc');

    // Un `parse` qui rend `null` est indistinguable d'un champ vidé, donc d'une suppression :
    // enregistrer effacerait la mesure au lieu de signaler la faute de frappe.
    expect(bouton().props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByText('measurements.invalidValue')).toBeTruthy();
  });

  it('🔴 une valeur hors bornes bloque AUSSI, et le dit avec les bornes', async () => {
    await afficher();

    await saisir('waist', '500');

    // Recette device du 31/07/2026 : sans ce contrôle, la valeur se parse, le bouton reste actif,
    // l'écriture échoue au dépôt et l'utilisateur lit « réessaie » — un conseil faux, puisque
    // réessayer avec la même valeur échouera toujours.
    expect(bouton().props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByText(/measurements\.outOfRange/)).toBeTruthy();
  });

  it('🔴 « illisible » prime sur « hors bornes » — un seul message à la fois', async () => {
    await afficher();

    await saisir('waist', 'abc');
    await saisir('arm', '500');

    // Deux bandeaux rouges empilés pour un formulaire de six champs noient l'information utile.
    expect(screen.getByText('measurements.invalidValue')).toBeTruthy();
    expect(screen.queryByText(/measurements\.outOfRange/)).toBeNull();
  });

  it('🔴 un champ VIDE n’est pas une saisie illisible', async () => {
    await afficher({ waist: releve(82) });

    await saisir('waist', '');

    // Sans cette distinction, la suppression d'une mesure serait impossible.
    expect(screen.queryByText('measurements.invalidValue')).toBeNull();
    expect(bouton().props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('corriger la saisie débloque l’enregistrement', async () => {
    await afficher();

    await saisir('waist', '500');
    await saisir('waist', '80');

    expect(screen.queryByText(/measurements\.outOfRange/)).toBeNull();
    expect(bouton().props.accessibilityState).toMatchObject({ disabled: false });
  });
});

// ---------------------------------------------------------------------------
// Enregistrement
// ---------------------------------------------------------------------------

describe('enregistrement', () => {
  it('ferme la feuille après un enregistrement réussi', async () => {
    await afficher();

    await saisir('waist', '80');
    await enregistrer();

    expect(onClose).toHaveBeenCalled();
  });

  it('🔴 un échec NE ferme PAS la feuille, et le dit', async () => {
    mockSave.mockRejectedValue(new Error('hors ligne'));
    await afficher();

    await saisir('waist', '80');
    await enregistrer();

    // Fermer perdrait six champs de saisie sans dire pourquoi.
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('measurements.saveError')).toBeTruthy();
  });

  it('🔴 après un échec, on peut réessayer', async () => {
    mockSave.mockRejectedValueOnce(new Error('hors ligne'));
    await afficher();

    await saisir('waist', '80');
    await enregistrer();
    await enregistrer();

    // Le drapeau d'enregistrement doit être relâché dans tous les cas, sinon le bouton reste en
    // attente pour toujours et la seule issue est de fermer la feuille.
    expect(mockSave).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalled();
  });
});
