/**
 * US ACCES-IA — le récit d'un dossier du Labo (NARR-01) et du Conseil (CONS-01) n'est proposé qu'avec
 * l'accord au Labo IA **et** un accès confirmé (spec §4.1, §14 critère 11). Un seul crochet pour les
 * deux appelants : `lab.tsx` et `CouncilSheet`.
 */
import { renderHook } from '@testing-library/react-native';

import { useLabNarrationAllowed } from '../useLabNarrationAllowed';

const mockSettings = { aiConsentAt: null as string | null };
jest.mock('@/data/repositories/settings-repository', () => ({
  useSettings: () => ({ settings: mockSettings, isLoading: false }),
}));

let mockAccess: 'allowed' | 'closed' | 'unknown' = 'allowed';
jest.mock('@/hooks/useAiAccess', () => ({
  useAiAccess: () => ({ access: mockAccess, mode: 'testers', status: null }),
}));

beforeEach(() => {
  mockSettings.aiConsentAt = '2026-09-15T10:00:00.000Z';
  mockAccess = 'allowed';
});

describe('useLabNarrationAllowed', () => {
  it('accord au Labo IA et accès confirmé : proposé', async () => {
    const { result } = await renderHook(() => useLabNarrationAllowed());
    expect(result.current).toBe(true);
  });

  it('sans accord au Labo IA : jamais', async () => {
    mockSettings.aiConsentAt = null;
    const { result } = await renderHook(() => useLabNarrationAllowed());
    expect(result.current).toBe(false);
  });

  it.each(['closed', 'unknown'] as const)('🔴 accès « %s » : pas de récit, même avec l’accord', async (access) => {
    // « inconnu » aussi : l'accord au labo s'écrit en local, et un bouton qui partirait vers un refus
    // « bêta fermée » serait un bouton mort.
    mockAccess = access;
    const { result } = await renderHook(() => useLabNarrationAllowed());
    expect(result.current).toBe(false);
  });
});
