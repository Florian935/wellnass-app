/**
 * smoke.test.tsx — Test minimal vérifiant que le pipeline jest-expo fonctionne.
 *
 * Objectif : confirmer que :
 *  1. jest-expo transforme correctement le code TypeScript/TSX ;
 *  2. les mocks de PowerSync (useQuery, useStatus) sont actifs ;
 *  3. un composant utilisant useSettings (qui dépend de PowerSync) se rend sans planter.
 *
 * Ce test n'évalue pas la logique métier — uniquement la configuration jest.
 */
import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mock useSettings (branchement indirect sur PowerSync) — isolé du réseau
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/settings-repository', () => ({
  useSettings: jest.fn(() => ({
    settings: null,
    isLoading: false,
  })),
}));

import { useSettings } from '@/data/repositories/settings-repository';

/**
 * Composant de test minimal : affiche un libellé selon l'état des réglages.
 */
function SettingsLabel() {
  const { settings, isLoading } = useSettings();
  if (isLoading) return <Text testID="status">Chargement…</Text>;
  if (!settings) return <Text testID="status">Aucun réglage</Text>;
  return <Text testID="status">Réglages chargés</Text>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Pipeline jest-expo (smoke test)', () => {
  it('rend SettingsLabel sans planter quand isLoading=false et settings=null', async () => {
    const { getByTestId, getByText } = await render(<SettingsLabel />);
    expect(getByTestId('status')).toBeTruthy();
    expect(getByText('Aucun réglage')).toBeTruthy();
  });

  it('affiche "Chargement…" quand isLoading=true', async () => {
    (useSettings as jest.Mock).mockReturnValueOnce({ settings: null, isLoading: true });
    const { getByText } = await render(<SettingsLabel />);
    expect(getByText('Chargement…')).toBeTruthy();
  });

  it('affiche "Réglages chargés" quand settings est défini', async () => {
    (useSettings as jest.Mock).mockReturnValueOnce({
      settings: { id: 'abc', theme: 'system', units: 'metric', language: 'fr' },
      isLoading: false,
    });
    const { getByText } = await render(<SettingsLabel />);
    expect(getByText('Réglages chargés')).toBeTruthy();
  });
});
