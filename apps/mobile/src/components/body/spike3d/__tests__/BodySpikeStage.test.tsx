/**
 * Spike 3D — le repli de la scène. **Tests jetables, comme le spike.**
 *
 * Les quatre cas sont repris de `lab/__tests__/lab-stage.test.tsx`, et pour une raison précise :
 * ils sont nés d'un défaut constaté sur le premier APK du Labo, où la 3D n'apparaissait pas **et
 * rien ne le disait**. Un spike dont l'écran reste vide sans message ne mesure rien du tout — il
 * ferait conclure « la 3D ne marche pas » là où la vraie réponse serait « le canvas faisait zéro
 * pixel ». C'est exactement l'erreur de diagnostic qu'on veut s'interdire ici.
 *
 * La règle : **le silence est un échec**.
 */

import React from 'react';
import { act, render, screen } from '@testing-library/react-native';

import { BodySpikeStage } from '../BodySpikeStage';
import { bodySpikeState, neutralSpikeInput } from '../body-spike-state';

let emettreStatut: ((s: { ok: boolean; reason?: string }) => void) | null = null;
jest.mock('../BodySpikeScene3D.dom', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ onStatus }: { onStatus: (s: { ok: boolean; reason?: string }) => void }) => {
      emettreStatut = onStatus;
      return <Text testID="spike-3d">3d</Text>;
    },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const ETAT = bodySpikeState(neutralSpikeInput());

const afficher = async () => {
  await render(<BodySpikeStage state={ETAT} onStats={jest.fn()} />);
};

const avancer = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  emettreStatut = null;
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('repli de la scène du spike', () => {
  it('ouvre sur la 3D', async () => {
    await afficher();

    expect(screen.getByTestId('spike-3d')).toBeTruthy();
    expect(screen.queryByTestId('spike-fallback')).toBeNull();
  });

  it('bascule sur un message quand la scène déclare un échec, et DIT pourquoi', async () => {
    await afficher();

    await act(async () => emettreStatut!({ ok: false, reason: 'webgl' }));

    // La raison est affichée telle quelle : sur un spike, « webgl » ou « taille:0x0 » est
    // précisément l'information qu'on cherche. La masquer derrière un joli message reviendrait à
    // reproduire le défaut qu'on instrumente.
    expect(screen.getByTestId('spike-fallback')).toBeTruthy();
    expect(screen.getByText(/webgl/)).toBeTruthy();
  });

  it('🔴 bascule aussi quand la scène ne dit RIEN — le silence est un échec', async () => {
    await afficher();

    await avancer(5000);

    expect(screen.getByTestId('spike-fallback')).toBeTruthy();
    expect(screen.getByText(/silence/i)).toBeTruthy();
  });

  it('🔴 une scène qui a répondu OK n’est PAS repliée par le chien de garde', async () => {
    await afficher();

    await act(async () => emettreStatut!({ ok: true }));
    await avancer(20000);

    expect(screen.getByTestId('spike-3d')).toBeTruthy();
    expect(screen.queryByTestId('spike-fallback')).toBeNull();
  });
});
