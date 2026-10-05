/**
 * US PRISME-01 — le chemin app de Prisme : raconter un bilan, lire un repas, accorder ou retirer
 * l'accord. Le client (`ai-client`) est bouchonné ; le garde-fou et les dossiers sont les VRAIS, de
 * `@wellness/shared` — c'est leur verdict qu'on veut voir arriver à l'écran.
 */
import type { BilanDossier, PrismeStatus } from '@wellness/shared';

import { askMeal, grantPrismeConsent, refreshPrismeStatus, revokePrismeConsent, tellBilan } from '../prisme';
import { callAiAssist, callPrismeService } from '../ai-client';
import { updateSettings } from '@/data/repositories/settings-repository';
import { track } from '@/lib/analytics';
import { usePrismeStore } from '@/stores/prisme-store';

jest.mock('../ai-client', () => ({ callAiAssist: jest.fn(), callPrismeService: jest.fn() }));
jest.mock('@/data/repositories/settings-repository', () => ({ updateSettings: jest.fn(async () => undefined) }));
jest.mock('@/lib/analytics', () => ({
  track: jest.fn(async () => undefined),
  ANALYTICS_EVENTS: { prismeTold: 'prisme_told', prismeRejected: 'prisme_rejected', prismeMealAsked: 'prisme_meal_asked' },
}));

const ai = callAiAssist as jest.Mock;
const service = callPrismeService as jest.Mock;

const DOSSIER: BilanDossier = {
  headline: 'Ta journée du vendredi 2 octobre',
  facts: [{ label: 'Séance de musculation', detail: '52 min, 8420 kg', values: [52, 8420] }],
  decision: null,
  realLife: false,
};

const reply = (text: string) => ({ ok: true, text, used: 1, quota: 6, provider: 'groq', model: 'openai/gpt-oss-120b' });

const STATUS: PrismeStatus = {
  available: true,
  reason: null,
  provider: { id: 'groq', label: 'Groq', country: 'US', trains: false, retentionDays: 30 },
  consent: { at: '2026-10-03T19:00:00.000Z', provider: 'groq' },
  remaining: { narrate: 5, meal_text: 6 },
};

beforeEach(() => {
  jest.clearAllMocks();
  usePrismeStore.setState({ status: null, devSimulateInvented: false });
});

describe('tellBilan — raconter, puis vérifier', () => {
  it('rend un texte vérifié contre le dossier, et compte le geste par fournisseur et surface', async () => {
    ai.mockResolvedValue(reply('Bonne séance de musculation ce soir : 52 min et 8 420 kg soulevés.'));

    const outcome = await tellBilan(DOSSIER, 'evening', 'fr');

    expect(outcome).toEqual({ ok: true, text: 'Bonne séance de musculation ce soir : 52 min et 8 420 kg soulevés.' });
    const sent = ai.mock.calls[0]![0];
    expect(sent.kind).toBe('narrate');
    expect(sent.context).toContain('Ta journée du vendredi 2 octobre');
    expect(track).toHaveBeenCalledWith('prisme_told', { provider: 'groq', surface: 'evening' });
  });

  it('🔴 jette un texte qui cite un chiffre absent du dossier, et compte le refus', async () => {
    ai.mockResolvedValue(reply('Bonne séance : 52 min, 8 420 kg, et 73 kg sur la balance ce matin.'));

    await expect(tellBilan(DOSSIER, 'evening', 'fr')).resolves.toEqual({ ok: false, code: 'rejected' });
    expect(track).toHaveBeenCalledWith('prisme_rejected', { provider: 'groq', surface: 'evening' });
  });

  it('jette une réponse inexploitable (trop courte)', async () => {
    ai.mockResolvedValue(reply('Ok.'));

    await expect(tellBilan(DOSSIER, 'week', 'fr')).resolves.toEqual({ ok: false, code: 'invalid' });
  });

  it('🔴 lit les milliers à l’anglaise en anglais (R3)', async () => {
    ai.mockResolvedValue(reply('Good session tonight: 52 minutes and 8,420 kg lifted.'));

    await expect(tellBilan(DOSSIER, 'evening', 'en')).resolves.toMatchObject({ ok: true });
  });

  it('🔴 en anglais, le dossier se relit aussi en anglais : « 12,480 kg » n’autorise pas un « 12 » inventé (R3)', async () => {
    const english: BilanDossier = {
      headline: 'Your day, Friday',
      facts: [{ label: 'Strength session', detail: '12,480 kg lifted', values: [12480] }],
      decision: null,
      realLife: false,
    };
    ai.mockResolvedValue(reply('Good session: 12 kg more than last week.'));

    await expect(tellBilan(english, 'evening', 'en')).resolves.toEqual({ ok: false, code: 'rejected' });
  });

  it('accord refusé par le serveur : on relit le statut, pour rouvrir la feuille avec le bon fournisseur', async () => {
    ai.mockResolvedValue({ ok: false, code: 'consent-required' });
    service.mockResolvedValue({ ok: true, status: STATUS });

    await expect(tellBilan(DOSSIER, 'evening', 'fr')).resolves.toEqual({ ok: false, code: 'consent-required' });
    expect(service).toHaveBeenCalledWith({ kind: 'status' });
    expect(usePrismeStore.getState().status).toEqual(STATUS);
  });

  it('les autres échecs du serveur passent tels quels (hors ligne, quota)', async () => {
    ai.mockResolvedValue({ ok: false, code: 'offline' });
    await expect(tellBilan(DOSSIER, 'evening', 'fr')).resolves.toEqual({ ok: false, code: 'offline' });
    expect(service).not.toHaveBeenCalled();
  });

  it('en développement, « simuler un chiffre inventé » fait voir le refus (critère de recette 8)', async () => {
    usePrismeStore.setState({ devSimulateInvented: true });
    ai.mockResolvedValue(reply('Bonne séance de musculation ce soir : 52 min et 8 420 kg soulevés.'));

    await expect(tellBilan(DOSSIER, 'evening', 'fr')).resolves.toEqual({ ok: false, code: 'rejected' });
  });
});

describe('askMeal — la partie non reconnue d’une phrase de repas', () => {
  it('rend les aliments et les grammes, et n’envoie que 300 caractères au plus', async () => {
    ai.mockResolvedValue(reply('{"items":[{"name":"Riz blanc cuit","grams":150,"confidence":0.6}]}'));

    const result = await askMeal(`  poke bowl saumon avocat ${'x'.repeat(400)}`, 'fr');

    expect(result).toEqual({ ok: true, items: [{ name: 'Riz blanc cuit', grams: 150, confidence: 0.6 }], truncated: false });
    const sent = ai.mock.calls[0]![0];
    expect(sent).toMatchObject({ kind: 'meal_text', lang: 'fr' });
    expect(sent.text.startsWith('poke bowl saumon avocat')).toBe(true);
    expect(sent.text.length).toBeLessThanOrEqual(300);
    expect(track).toHaveBeenCalledWith('prisme_meal_asked', { provider: 'groq', surface: 'meal' });
  });

  it('une réponse illisible est « inexploitable », jamais un repas vide', async () => {
    ai.mockResolvedValue(reply('désolé'));

    await expect(askMeal('poke bowl', 'fr')).resolves.toEqual({ ok: false, code: 'invalid' });
  });

  it('un texte vide ne part pas', async () => {
    await expect(askMeal('   ', 'fr')).resolves.toEqual({ ok: false, code: 'invalid' });
    expect(ai).not.toHaveBeenCalled();
  });

  it('un échec du serveur passe tel quel', async () => {
    ai.mockResolvedValue({ ok: false, code: 'quota-exceeded' });

    await expect(askMeal('poke bowl', 'fr')).resolves.toEqual({ ok: false, code: 'quota-exceeded' });
  });
});

describe('l’accord (DD3)', () => {
  it('🔴 accordé par le serveur, puis recopié en local pour que l’écran le sache tout de suite', async () => {
    service.mockResolvedValue({ ok: true, status: STATUS });

    await expect(grantPrismeConsent(true)).resolves.toEqual({ ok: true, status: STATUS });
    expect(service).toHaveBeenCalledWith({ kind: 'consent', grant: true, adult: true });
    expect(updateSettings).toHaveBeenCalledWith({
      prismeConsentAt: '2026-10-03T19:00:00.000Z',
      prismeConsentProvider: 'groq',
    });
    expect(usePrismeStore.getState().status).toEqual(STATUS);
  });

  it('un refus du serveur n’écrit rien en local', async () => {
    service.mockResolvedValue({ ok: false, code: 'adult-required' });

    await expect(grantPrismeConsent(false)).resolves.toEqual({ ok: false, code: 'adult-required' });
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('🔴 le retrait s’écrit en local, même hors ligne, et efface l’instant ET le destinataire', async () => {
    usePrismeStore.setState({ status: STATUS });

    await revokePrismeConsent();

    expect(updateSettings).toHaveBeenCalledWith({ prismeConsentAt: null, prismeConsentProvider: null });
    expect(service).not.toHaveBeenCalled();
    expect(usePrismeStore.getState().status?.consent).toEqual({ at: null, provider: null });
  });

  it('refreshPrismeStatus garde le dernier statut connu', async () => {
    service.mockResolvedValue({ ok: true, status: STATUS });

    await refreshPrismeStatus();

    expect(usePrismeStore.getState().status).toEqual(STATUS);
  });

  it('un statut illisible ou hors ligne ne remplace pas le dernier connu', async () => {
    usePrismeStore.setState({ status: STATUS });
    service.mockResolvedValue({ ok: false, code: 'offline' });

    await refreshPrismeStatus();

    expect(usePrismeStore.getState().status).toEqual(STATUS);
  });
});
