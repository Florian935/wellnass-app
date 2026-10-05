/**
 * US PRISME-01 — quand une entrée Prisme est-elle visible ? (spec DD7, R13)
 *
 * Visible si le dernier statut connu dit « disponible » ; sans statut (hors ligne au démarrage), si un
 * accord local existe. Jamais pour un compte de moins de 18 ans. Et le statut n'est demandé qu'une
 * fois par session.
 */
import { renderHook } from '@testing-library/react-native';
import type { PrismeStatus } from '@wellness/shared';

import { usePrismeVisibility } from '../usePrismeVisibility';
import { refreshPrismeStatus } from '@/lib/ai/prisme';
import { usePrismeStore } from '@/stores/prisme-store';

jest.mock('@/lib/ai/prisme', () => ({ refreshPrismeStatus: jest.fn(async () => ({ ok: false, code: 'offline' })) }));

const mockSettings = { prismeConsentAt: null as string | null };
jest.mock('@/data/repositories/settings-repository', () => ({
  useSettings: () => ({ settings: mockSettings, isLoading: false }),
}));
let mockBirthDate: string | null = null;
jest.mock('@/data/repositories/profile-repository', () => ({
  useProfile: () => ({ profile: { birthDate: mockBirthDate }, isLoading: false }),
}));
jest.mock('@/hooks/useTodayKey', () => ({ useTodayKey: () => '2026-10-03' }));

const STATUS: PrismeStatus = {
  available: true,
  reason: null,
  provider: { id: 'groq', label: 'Groq', country: 'US', trains: false, retentionDays: 30 },
  consent: { at: null, provider: null },
  remaining: { narrate: 6, meal_text: 6 },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSettings.prismeConsentAt = null;
  mockBirthDate = null;
  usePrismeStore.setState({ status: null, statusRequested: false });
});

describe('usePrismeVisibility', () => {
  it('demande le statut une seule fois par session', async () => {
    const first = await renderHook(() => usePrismeVisibility());
    await renderHook(() => usePrismeVisibility());
    first.unmount();

    expect(refreshPrismeStatus).toHaveBeenCalledTimes(1);
  });

  it('statut « disponible » : visible, même sans accord (le geste ouvrira la feuille)', async () => {
    usePrismeStore.setState({ status: STATUS, statusRequested: true });

    const { result } = await renderHook(() => usePrismeVisibility());

    expect(result.current.visible).toBe(true);
  });

  it('🔴 statut « indisponible » (fournisseur non autorisé) : rien de Prisme', async () => {
    usePrismeStore.setState({ status: { ...STATUS, available: false, reason: 'provider', provider: null }, statusRequested: true });
    mockSettings.prismeConsentAt = '2026-10-03T19:00:00.000Z';

    const { result } = await renderHook(() => usePrismeVisibility());

    expect(result.current.visible).toBe(false);
  });

  it('statut inconnu (hors ligne au démarrage) : l’accord local fait foi', async () => {
    usePrismeStore.setState({ status: null, statusRequested: true });

    const off = await renderHook(() => usePrismeVisibility());
    expect(off.result.current.visible).toBe(false);

    mockSettings.prismeConsentAt = '2026-10-03T19:00:00.000Z';
    const on = await renderHook(() => usePrismeVisibility());
    expect(on.result.current.visible).toBe(true);
  });

  it('🔴 moins de 18 ans d’après la date de naissance : rien de Prisme, quoi que dise le statut (R13)', async () => {
    usePrismeStore.setState({ status: STATUS, statusRequested: true });
    mockBirthDate = '2010-05-01';

    const { result } = await renderHook(() => usePrismeVisibility());

    expect(result.current.visible).toBe(false);
    expect(result.current.minor).toBe(true);
  });

  it('dix-huit ans le jour même : majeur', async () => {
    usePrismeStore.setState({ status: STATUS, statusRequested: true });
    mockBirthDate = '2008-10-03';

    const { result } = await renderHook(() => usePrismeVisibility());

    expect(result.current.minor).toBe(false);
    expect(result.current.visible).toBe(true);
  });
});
