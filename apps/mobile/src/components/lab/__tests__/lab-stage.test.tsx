/**
 * US LABO-01 — la scène du Labo et son **repli**.
 *
 * Ce qui est testé ici est né d'un défaut constaté sur le premier APK (16/09/2026) : la 3D
 * n'apparaissait pas, **et rien ne le disait**. La cause était dans la page (un canvas de zéro
 * pixel), mais ce qui l'a rendue invisible était ici : R8 ne couvrait que les cas où la scène
 * **dit** `ok: false` — WebGL absent, contexte perdu, bibliothèque en échec. Le cas où elle ne dit
 * *rien* laissait le statut optimiste, donc une bande vide, indéfiniment.
 *
 * La règle qu'on fige : **le silence est un échec**. Passé le délai, on replie en 2D.
 */

import React from 'react';
import { act, render, screen } from '@testing-library/react-native';

import { LabStage } from '../LabStage';
import type { LabSceneState } from '../scene/scene-state';

/** La vraie scène vit dans une WebView (WebGL) : on expose juste son `onStatus` aux tests. */
let emettreStatut: ((s: { ok: boolean; reason?: string }) => void) | null = null;
jest.mock('../scene/LabScene3D.dom', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ onStatus }: { onStatus: (s: { ok: boolean; reason?: string }) => void }) => {
      emettreStatut = onStatus;
      return <Text testID="scene-3d">3d</Text>;
    },
  };
});

jest.mock('../scene/LabScene2D', () => {
  const { Text } = require('react-native');
  return { LabScene2D: () => <Text testID="scene-2d">2d</Text> };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: ({ children }: { children?: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/stage/PillarStage', () => ({
  useStageTheme: () => ({ surfaces: ['#fff', '#eee'], gradient: ['#fff', '#eee'], inkMuted: '#888' }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'fr' }, t: (k: string) => k }),
}));

const ETAT = {
  mode: 'week',
  pillars: { muscu: true, course: true, nutrition: true },
  values: { fq: 4, km: 30, fr: 1, pr: 1.6, kc: 0, gl: 0, so: 7.5, fuel: 80, guard: false },
  reality: null,
  crossings: [],
  focus: null,
  selected: null,
  labels: { brand: 'FITTRIO', plate: 'SÉANCE', trackBig: '18', trackSmall: 'SUR 30 KM', days: [] },
  reducedMotion: false,
} as unknown as LabSceneState;

// `act` de RNTL est asynchrone : l'appeler sans `await` entrelace les portees et fait echouer
// les quatre tests d'un coup.
const afficher = async () => {
  await render(<LabStage state={ETAT} caption="lab.stage.week" onPick={jest.fn()} onLand={jest.fn()} />);
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

describe('repli de la scène', () => {
  it('ouvre sur la 3D — c’est la décision de Florian du 15/09 (3D dès le premier écran)', async () => {
    await afficher();

    expect(screen.getByTestId('scene-3d')).toBeTruthy();
    expect(screen.queryByTestId('scene-2d')).toBeNull();
  });

  it('bascule en 2D quand la scène déclare un échec, et le DIT', async () => {
    await afficher();

    await act(async () => emettreStatut!({ ok: false, reason: 'webgl' }));

    expect(screen.getByTestId('scene-2d')).toBeTruthy();
    expect(screen.getByText('lab.stage.fallback')).toBeTruthy();
  });

  it('🔴 bascule aussi quand la scène ne dit RIEN — le silence est un échec', async () => {
    await afficher();

    // WebView qui ne monte pas, bundle DOM introuvable, JS mort avant le premier `onStatus` :
    // sans ce filet, le statut restait optimiste et l'utilisateur regardait une bande vide sans
    // le moindre message. C'est exactement ce qu'a montré le premier APK.
    await avancer(5000);

    expect(screen.getByTestId('scene-2d')).toBeTruthy();
    expect(screen.getByText('lab.stage.fallback')).toBeTruthy();
  });

  it('🔴 une scène qui a répondu OK n’est PAS repliée par le chien de garde', async () => {
    await afficher();

    await act(async () => emettreStatut!({ ok: true }));
    await avancer(20000);

    // Sinon la 3D disparaîtrait au bout de cinq secondes chez tout le monde — le remède serait
    // pire que le mal.
    expect(screen.getByTestId('scene-3d')).toBeTruthy();
    expect(screen.queryByTestId('scene-2d')).toBeNull();
  });
});
