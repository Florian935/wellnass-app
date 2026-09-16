/**
 * US DASH-01 (§7.1), étendu par IA-LAB-01 — le client de `ai-assist`, testé sur ce qui compte pour
 * l'UI : **quel code d'erreur** elle reçoit. C'est lui qui décide si l'écran dit « active
 * l'assistant », « limite du jour atteinte », « la clé n'est pas la bonne » ou « tu es hors ligne »
 * — quatre messages qui n'appellent pas le même geste.
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
  it('rend le texte du modèle, l’état du quota et QUI a répondu', async () => {
    invoke.mockResolvedValue({
      data: {
        text: '{"items":[]}',
        used: 3,
        quota: 10,
        provider: 'gemini',
        model: 'gemini-flash-latest',
      },
      error: null,
    });

    await expect(callAiAssist({ kind: 'photo', imageBase64: 'abc' })).resolves.toEqual({
      ok: true,
      text: '{"items":[]}',
      used: 3,
      quota: 10,
      provider: 'gemini',
      model: 'gemini-flash-latest',
    });
  });

  it('🔴 le fournisseur remonte jusqu’à l’UI — comparer deux modèles sans le savoir n’a aucun sens', async () => {
    invoke.mockResolvedValue({
      data: { text: 'Analyse…', used: 1, quota: 20, provider: 'anthropic', model: 'claude-sonnet-5' },
      error: null,
    });

    const result = await callAiAssist({ kind: 'coach', context: 'POIDS — 75 kg', question: 'Alors ?' });

    expect(result).toMatchObject({ ok: true, provider: 'anthropic', model: 'claude-sonnet-5' });
  });

  it('retombe sur « inconnu » plutôt que sur `undefined` si le serveur ne dit pas qui a répondu', async () => {
    invoke.mockResolvedValue({ data: { text: 'ok' }, error: null });

    await expect(callAiAssist({ kind: 'ask', prompt: 'x' })).resolves.toEqual({
      ok: true,
      text: 'ok',
      used: 0,
      quota: 0,
      provider: 'inconnu',
      model: 'inconnu',
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

  it('un refus du modèle reste un refus, pas une panne', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(422, { error: 'refused' }) });

    await expect(callAiAssist({ kind: 'coach', context: '', question: 'x' })).resolves.toEqual({
      ok: false,
      code: 'refused',
    });
  });

  /**
   * 🔴 IA-LAB-01. Une faute de frappe dans `GEMINI_MODEL` produit un 404 du fournisseur. Sans ce
   * code **et** son détail, l'écran ne peut dire que « l'IA ne marche pas » — et la cause réelle
   * (un nom de modèle périmé) reste invisible depuis le téléphone.
   */
  it('🔴 une erreur de configuration remonte AVEC son détail, pour être diagnosticable', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(502, {
        error: 'ai_misconfigured',
        provider: 'gemini',
        detail: 'models/gemini-3-flash is not found',
      }),
    });

    await expect(callAiAssist({ kind: 'coach', context: '', question: 'x' })).resolves.toEqual({
      ok: false,
      code: 'misconfigured',
      detail: 'models/gemini-3-flash is not found',
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
