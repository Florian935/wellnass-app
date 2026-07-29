/**
 * US MUSC-F14 — smoke test de la section « Suggestions ».
 *
 * Ce qui est vérifié est le **contrat de l'US** :
 *  - aucune suggestion → **aucune section** (pas de bloc vide) ;
 *  - une variante déclarée est **signalée comme telle** — c'est une donnée humaine, pas un calcul ;
 *  - la justification affichée reste **factuelle** (variante, matériel) : jamais une promesse sur la
 *    douleur ou l'articulation, que les données ne permettent pas de tenir (décision D1).
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import '@/i18n';

import { SubstitutionSection } from '../SubstitutionSection';
import type { Substitution } from '@wellness/shared';

jest.mock('@/theme/useTheme', () => ({
  useTheme: jest.fn(() => ({
    scheme: 'light',
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      background: '#f7eede',
      surface: '#fffaf2',
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      track: '#ece0cd',
      accent: '#c0562f',
      accentText: '#ffffff',
      success: '#7c8a5b',
      danger: '#b23b2e',
      warn: '#fbf1dd',
      warnBorder: '#b5761f',
      warnText: '#b5761f',
      panel: '#2b2018',
      panelMuted: '#8f8272',
    },
  })),
}));

const variant: Substitution = {
  id: 'v1',
  name: 'Développé incliné haltères',
  muscle: 'chest',
  equipment: 'dumbbell',
  isDeclaredVariant: true,
  differentEquipment: true,
  score: 1120,
};

const computed: Substitution = {
  id: 'c1',
  name: 'Développé machine',
  muscle: 'chest',
  equipment: 'machine',
  isDeclaredVariant: false,
  differentEquipment: true,
  score: 120,
};

describe('SubstitutionSection', () => {
  it('n’affiche RIEN quand il n’y a aucune suggestion — pas de section vide', async () => {
    const { toJSON } = await render(<SubstitutionSection substitutions={[]} onPick={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  it('affiche les suggestions avec leur nom', async () => {
    const { getByText } = await render(
      <SubstitutionSection substitutions={[variant, computed]} onPick={jest.fn()} />,
    );
    expect(getByText('Développé incliné haltères')).toBeTruthy();
    expect(getByText('Développé machine')).toBeTruthy();
  });

  it('signale une variante DÉCLARÉE — c’est une donnée humaine, pas un calcul', async () => {
    const { getByText } = await render(
      <SubstitutionSection substitutions={[variant]} onPick={jest.fn()} />,
    );
    expect(getByText('Variante')).toBeTruthy();
  });

  it('justifie une suggestion calculée par son MATÉRIEL, fait vérifiable', async () => {
    const { getByText } = await render(
      <SubstitutionSection substitutions={[computed]} onPick={jest.fn()} />,
    );
    expect(getByText('Machine guidée')).toBeTruthy();
  });

  it('ne promet RIEN sur la douleur ou l’articulation (D1)', async () => {
    // Les données ne le permettent pas : une telle promesse serait un conseil de santé inventé.
    const { toJSON } = await render(
      <SubstitutionSection substitutions={[variant, computed]} onPick={jest.fn()} />,
    );
    const rendered = JSON.stringify(toJSON()).toLowerCase();
    for (const forbidden of ['douleur', 'blessure', 'épaule', 'articulation', 'ménage']) {
      expect(rendered).not.toContain(forbidden);
    }
  });

  it('remonte la suggestion choisie', async () => {
    const onPick = jest.fn();
    const { getByText } = await render(
      <SubstitutionSection substitutions={[computed]} onPick={onPick} />,
    );
    fireEvent.press(getByText('Développé machine'));
    expect(onPick).toHaveBeenCalledWith(computed);
  });
});
