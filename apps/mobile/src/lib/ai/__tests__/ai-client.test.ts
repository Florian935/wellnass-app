/**
 * US DASH-01 (§7.1) — le client de `ai-assist`, testé sur ce qui compte pour l'UI : **quel code
 * d'erreur** elle reçoit. C'est lui qui décide si l'écran dit « active l'assistant », « limite du
 * jour atteinte » ou « ta photo est gardée » — trois messages très différents pour l'utilisateur.
 */
import { callAiAssist } from '../ai-client';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

const invoke = supabase.functions.invoke as jest.Mock;

/** Une erreur `FunctionsHttpError` telle que supabase-js la rend : la réponse est dans `context`. */
const httpError = (status: number, body: Record<string, unknown>) => ({
  name: 'FunctionsHttpError',
  context: { status, json: async () => body } as unknown as Response,
});

beforeEach(() => jest.clearAllMocks());

describe('le chemin heureux', () => {
  it('rend le texte du modèle et l’état du quota', async () => {
    invoke.mockResolvedValue({ data: { text: '{"items":[]}', used: 3, quota: 10 }, error: null });

    await expect(callAiAssist({ kind: 'photo', imageBase64: 'abc' })).resolves.toEqual({
      ok: true,
      text: '{"items":[]}',
      used: 3,
      quota: 10,
    });
  });
});

describe('les refus du serveur', () => {
  it('🔴 sans consentement, le code le DIT — l’écran renvoie vers les réglages', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(403, { error: 'consent_required' }) });

    await expect(callAiAssist({ kind: 'ask', prompt: 'x' })).resolves.toEqual({
      ok: false,
      code: 'consent-required',
    });
  });

  it('🔴 quota dépassé : un code distinct de l’échec', async () => {
    // « Limite du jour atteinte » et « l'analyse a échoué » n'appellent pas le même geste.
    invoke.mockResolvedValue({ data: null, error: httpError(429, { error: 'quota_exceeded' }) });

    await expect(callAiAssist({ kind: 'photo', imageBase64: 'abc' })).resolves.toEqual({
      ok: false,
      code: 'quota-exceeded',
    });
  });

  it('le secret absent côté serveur devient « indisponible », pas « échec »', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(503, { error: 'ai_unavailable' }) });

    await expect(callAiAssist({ kind: 'ask', prompt: 'x' })).resolves.toEqual({
      ok: false,
      code: 'unavailable',
    });
  });
});

describe('le réseau', () => {
  it('🔴 sans réponse HTTP, c’est « hors ligne » — la photo sera gardée', async () => {
    invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsFetchError' } });

    await expect(callAiAssist({ kind: 'photo', imageBase64: 'abc' })).resolves.toEqual({
      ok: false,
      code: 'offline',
    });
  });

  it('une exception du relais ne remonte jamais telle quelle', async () => {
    invoke.mockRejectedValue(new Error('boom'));

    await expect(callAiAssist({ kind: 'ask', prompt: 'x' })).resolves.toEqual({
      ok: false,
      code: 'offline',
    });
  });

  it('🔴 une réponse sans texte est un échec, pas un succès vide', async () => {
    invoke.mockResolvedValue({ data: { text: '' }, error: null });

    await expect(callAiAssist({ kind: 'ask', prompt: 'x' })).resolves.toEqual({
      ok: false,
      code: 'failed',
    });
  });
});
