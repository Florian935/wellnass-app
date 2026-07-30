/**
 * CelebrationCard.test.tsx — conteneur animé de célébration (US MUSC-F8, décision D13).
 *
 * Vérifie :
 *  1. Le rendu des enfants (le conteneur ne filtre rien).
 *  2. Le respect de « réduire les animations » : quand `AccessibilityInfo.isReduceMotionEnabled`
 *     résout `true`, la valeur animée doit atteindre son état final SANS passer par
 *     `Animated.timing` (vérifié en espionnant `Animated.timing`, qui ne doit pas être appelé).
 */
import React from 'react';
import { AccessibilityInfo, Animated, Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { CelebrationCard } from '../CelebrationCard';

describe('CelebrationCard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rend ses enfants', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const { getByText } = await render(
      <CelebrationCard>
        <Text>Contenu</Text>
      </CelebrationCard>,
    );
    expect(getByText('Contenu')).toBeTruthy();
  });

  it('anime avec Animated.timing quand « réduire les animations » est désactivé', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const timingSpy = jest.spyOn(Animated, 'timing');
    await render(
      <CelebrationCard>
        <Text>Contenu</Text>
      </CelebrationCard>,
    );
    await waitFor(() => expect(timingSpy).toHaveBeenCalled());
  });

  it('saute l’animation quand « réduire les animations » est activé', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const timingSpy = jest.spyOn(Animated, 'timing');
    const { getByText } = await render(
      <CelebrationCard>
        <Text>Contenu</Text>
      </CelebrationCard>,
    );
    await waitFor(() => expect(getByText('Contenu')).toBeTruthy());
    expect(timingSpy).not.toHaveBeenCalled();
  });
});
