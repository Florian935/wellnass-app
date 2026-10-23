/**
 * US CLAV-01 — l'état du clavier : son cadre d'après les métriques, et son état initial.
 *
 * Le montage du hook (abonnement → `setState` → rendu) n'est pas testé ici, pour la raison écrite en
 * tête de `keyboard-event-names.test.ts` : sous RNTL v14, une mise à jour déclenchée depuis un
 * abonnement natif simulé ne se propage pas au rendu. La règle est testée ; le comportement réel
 * se vérifie sur device.
 */

import { Keyboard } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import { frameFromMetrics, useKeyboardFrame } from '../useKeyboardFrame';

describe('frameFromMetrics', () => {
  it('des métriques d’un clavier ouvert → visible, hauteur et bord haut', () => {
    expect(frameFromMetrics({ screenX: 0, screenY: 600, width: 412, height: 290 })).toEqual({
      visible: true,
      height: 290,
      screenY: 600,
    });
  });

  it('aucune métrique, ou une hauteur nulle (clavier flottant, physique) → fermé', () => {
    expect(frameFromMetrics(null)).toEqual({ visible: false, height: 0, screenY: 0 });
    expect(frameFromMetrics({ screenX: 0, screenY: 914, width: 412, height: 0 })).toEqual({
      visible: false,
      height: 0,
      screenY: 0,
    });
  });
});

describe('useKeyboardFrame — état initial', () => {
  afterEach(() => jest.restoreAllMocks());

  it('🔴 un conteneur monté clavier déjà ouvert le voit tout de suite (feuille ouverte pendant la frappe)', async () => {
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
    jest
      .spyOn(Keyboard, 'metrics')
      .mockReturnValue({ screenX: 0, screenY: 600, width: 412, height: 290 });
    const { result } = await renderHook(() => useKeyboardFrame());
    expect(result.current).toEqual({ visible: true, height: 290, screenY: 600 });
  });

  it('clavier fermé au montage → fermé', async () => {
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
    const { result } = await renderHook(() => useKeyboardFrame());
    expect(result.current.visible).toBe(false);
  });
});
