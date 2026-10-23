/**
 * US ACCES-IA — l'accès de ce compte à l'IA, en trois états (spec D15, §14 critère 7).
 *
 * Hors ligne, « bêta fermée » ne se sait pas : l'état `unknown` est un état à part entière, que chaque
 * surface traite à sa façon (§4.1). Et tant qu'il dure, le statut est redemandé — au montage d'un écran,
 * une seule requête à la fois, jamais en boucle ; une fois connu, plus jamais dans la session.
 */
import { renderHook } from '@testing-library/react-native';
import type { PrismeStatus } from '@wellness/shared';

import { STATUS_REQUEST_TIMEOUT_MS, aiAccessStateOf, useAiAccess } from '../useAiAccess';
import { refreshPrismeStatus } from '@/lib/ai/prisme';
import { usePrismeStore } from '@/stores/prisme-store';

jest.mock('@/lib/ai/prisme', () => ({ refreshPrismeStatus: jest.fn() }));

const refresh = refreshPrismeStatus as jest.Mock;

const OPEN: PrismeStatus = {
  available: true,
  reason: null,
  provider: { id: 'mistral', label: 'Mistral AI', country: 'FR', trains: false, retentionDays: 30 },
  consent: { at: null, provider: null },
  remaining: { narrate: 6, meal_text: 6 },
  access: 'testers',
};
const CLOSED: PrismeStatus = { ...OPEN, available: false, reason: 'closed', provider: null };

beforeEach(() => {
  jest.clearAllMocks();
  refresh.mockResolvedValue({ ok: false, code: 'offline' });
  usePrismeStore.getState().reset();
});

describe('aiAccessStateOf', () => {
  it('pas de statut → inconnu ; « bêta fermée » → fermé ; tout autre statut → autorisé', () => {
    expect(aiAccessStateOf(null)).toBe('unknown');
    expect(aiAccessStateOf(CLOSED)).toBe('closed');
    expect(aiAccessStateOf(OPEN)).toBe('allowed');
    // Prisme indisponible pour une autre raison (fournisseur, âge) n'est pas « fermé » : le Labo IA,
    // lui, reste accessible au testeur.
    expect(aiAccessStateOf({ ...OPEN, available: false, reason: 'provider', provider: null })).toBe('allowed');
    expect(aiAccessStateOf({ ...OPEN, available: false, reason: 'age', provider: null })).toBe('allowed');
  });
});

describe('useAiAccess', () => {
  it('rend l’état et le mode de l’interrupteur serveur', async () => {
    usePrismeStore.setState({ status: CLOSED });

    const { result } = await renderHook(() => useAiAccess());

    expect(result.current.access).toBe('closed');
    expect(result.current.mode).toBe('testers');
  });

  it('statut connu : aucune nouvelle demande dans la session', async () => {
    usePrismeStore.setState({ status: OPEN });

    await renderHook(() => useAiAccess());
    await renderHook(() => useAiAccess());

    expect(refresh).not.toHaveBeenCalled();
  });

  it('deux écrans montés ensemble, statut inconnu : une seule requête en vol', async () => {
    jest.useFakeTimers();
    try {
      refresh.mockReturnValue(new Promise(() => {}));

      const first = await renderHook(() => useAiAccess());
      await renderHook(() => useAiAccess());

      expect(refresh).toHaveBeenCalledTimes(1);
      expect(usePrismeStore.getState().statusLoading).toBe(true);
      expect(first.result.current.loading).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('une demande qui pend libère le drapeau au bout du délai : l’écran suivant redemande (D15)', async () => {
    jest.useFakeTimers();
    try {
      refresh.mockReturnValue(new Promise(() => {}));

      await renderHook(() => useAiAccess());
      expect(usePrismeStore.getState().statusLoading).toBe(true);

      jest.advanceTimersByTime(STATUS_REQUEST_TIMEOUT_MS);
      expect(usePrismeStore.getState().statusLoading).toBe(false);

      await renderHook(() => useAiAccess());
      expect(refresh).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('🔴 D17 — une demande partie avant un changement de compte ne touche pas au drapeau du suivant', async () => {
    let finishA: (value: unknown) => void = () => undefined;
    refresh.mockReturnValueOnce(new Promise((resolve) => (finishA = resolve)));
    refresh.mockReturnValueOnce(new Promise(() => {}));
    jest.useFakeTimers();
    try {
      await renderHook(() => useAiAccess()); // compte A : demande en vol
      usePrismeStore.getState().reset(); // déconnexion
      await renderHook(() => useAiAccess()); // compte B : sa propre demande
      expect(usePrismeStore.getState().statusLoading).toBe(true);

      finishA({ ok: false, code: 'offline' });
      await Promise.resolve();
      await Promise.resolve();

      // La fin de la demande de A ne libère pas celle de B.
      expect(usePrismeStore.getState().statusLoading).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('demande en échec (hors ligne) : l’état reste inconnu, et l’écran suivant redemande', async () => {
    const first = await renderHook(() => useAiAccess());
    expect(first.result.current.access).toBe('unknown');
    expect(usePrismeStore.getState().statusLoading).toBe(false);

    await renderHook(() => useAiAccess());

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('pas de boucle : un même écran ne redemande pas à chaque rendu', async () => {
    const view = await renderHook(() => useAiAccess());
    await view.rerender({});
    await view.rerender({});

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('remise à zéro (déconnexion) : statut, demande et textes effacés', () => {
    usePrismeStore.setState({ status: OPEN, statusLoading: true, texts: { 'evening:2026-10-23': { text: 'x', fingerprint: 'y' } } });

    const before = usePrismeStore.getState().epoch;
    usePrismeStore.getState().reset();

    expect(usePrismeStore.getState()).toMatchObject({ status: null, statusLoading: false, texts: {} });
    expect(usePrismeStore.getState().epoch).toBe(before + 1);
  });
});
