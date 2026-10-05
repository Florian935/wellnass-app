/**
 * US DASH-01 (§7.1), étendu par IA-LAB-01 — le client de `ai-assist`, testé sur ce qui compte pour
 * l'UI : **quel code d'erreur** elle reçoit. C'est lui qui décide si l'écran dit « active
 * l'assistant », « limite du jour atteinte », « la clé n'est pas la bonne » ou « tu es hors ligne »
 * — quatre messages qui n'appellent pas le même geste.
 */
import { callAiAssist, callPrismeService } from '../ai-client';
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

// ───────────────────────────────────────────────────────────────────────────────────────────────
// US PRISME-01 — Prisme : bilans, repas décrit, statut et accord
// ───────────────────────────────────────────────────────────────────────────────────────────────

const STATUS = {
  available: true,
  reason: null,
  provider: { id: 'groq', label: 'Groq', country: 'US', trains: false, retentionDays: 30 },
  consent: { at: null, provider: null },
  remaining: { narrate: 6, meal_text: 6 },
};

describe('Prisme — les appels au modèle', () => {
  it('un bilan raconté rend son texte, comme un appel du labo', async () => {
    invoke.mockResolvedValue({ data: { text: 'Bonne séance.', used: 1, quota: 6, provider: 'groq', model: 'm' }, error: null });

    await expect(callAiAssist({ kind: 'narrate', context: 'BILAN', question: 'Raconte.' })).resolves.toMatchObject({
      ok: true,
      text: 'Bonne séance.',
      provider: 'groq',
    });
    expect(invoke).toHaveBeenCalledWith('ai-assist', {
      body: { kind: 'narrate', context: 'BILAN', question: 'Raconte.' },
    });
  });

  it('🔴 un compte de moins de 18 ans reçoit un code à lui (R13)', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(403, { error: 'not_allowed', reason: 'age' }) });

    await expect(callAiAssist({ kind: 'meal_text', text: 'poulet', lang: 'fr' })).resolves.toEqual({
      ok: false,
      code: 'not-allowed',
    });
  });
});

describe('callPrismeService — le statut et l’accord (DD3, DD6)', () => {
  it('rend le statut validé', async () => {
    invoke.mockResolvedValue({ data: STATUS, error: null });

    await expect(callPrismeService({ kind: 'status' })).resolves.toEqual({ ok: true, status: STATUS });
  });

  it('🔴 refuse un statut qui annoncerait un fournisseur qui entraîne', async () => {
    invoke.mockResolvedValue({ data: { ...STATUS, provider: { ...STATUS.provider, trains: true } }, error: null });

    await expect(callPrismeService({ kind: 'status' })).resolves.toEqual({ ok: false, code: 'failed' });
  });

  it('accorder sans date de naissance ni confirmation : « 18 ans ou plus » est exigé (DD15)', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(400, { error: 'adult_required' }) });

    await expect(callPrismeService({ kind: 'consent', grant: true, adult: false })).resolves.toEqual({
      ok: false,
      code: 'adult-required',
    });
  });

  it('accorder avant la première synchro des réglages : un code à lui', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(409, { error: 'settings_missing' }) });

    await expect(callPrismeService({ kind: 'consent', grant: true, adult: true })).resolves.toEqual({
      ok: false,
      code: 'settings-missing',
    });
  });

  it('hors ligne : « hors ligne », comme le reste', async () => {
    invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsFetchError' } });

    await expect(callPrismeService({ kind: 'status' })).resolves.toEqual({ ok: false, code: 'offline' });
  });

  it('une exception du relais devient « hors ligne »', async () => {
    invoke.mockRejectedValue(new Error('boom'));

    await expect(callPrismeService({ kind: 'status' })).resolves.toEqual({ ok: false, code: 'offline' });
  });
});
