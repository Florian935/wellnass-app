/**
 * US NARR-01 — le branchement : invite → appel → **verdict**.
 *
 * Les règles du garde-fou sont testées dans `@wellness/shared` ; ce qui se joue ici, c'est qu'elles
 * soient **réellement appliquées à la réponse du serveur**. Un garde-fou écrit mais non branché
 * serait le pire des deux mondes : la spec promettrait une vérification que le code ne ferait pas.
 */
import { narrateDossier } from '../narrate';
import { callAiAssist } from '../ai-client';
import type { NarrationDossier } from '@wellness/shared';

jest.mock('../ai-client', () => ({ callAiAssist: jest.fn() }));

const mockCall = callAiAssist as jest.Mock;

const DOSSIER: NarrationDossier = {
  headline: 'Développé couché : 80 kg depuis 4 semaines',
  facts: [
    {
      label: 'Assiette × Muscu',
      detail: 'Glucides 210 g les jours de push, 318 g les autres',
      values: [210, 318],
    },
  ],
  cleared: ['Volume pectoraux'],
  missing: [],
  experiment: 'Push le mercredi',
};

beforeEach(() => jest.clearAllMocks());

describe('narrateDossier', () => {
  it('rend le texte quand tous ses chiffres viennent du dossier', async () => {
    mockCall.mockResolvedValue({
      ok: true,
      text: 'Tu manges 210 g de glucides les jours de push contre 318 g les autres jours.',
      used: 1,
      quota: 20,
      provider: 'gemini',
      model: 'x',
    });

    await expect(narrateDossier(DOSSIER, 'fr')).resolves.toEqual({
      ok: true,
      text: 'Tu manges 210 g de glucides les jours de push contre 318 g les autres jours.',
    });
  });

  it('🔴 rejette un texte qui invente un chiffre — le cœur de l’US', async () => {
    mockCall.mockResolvedValue({
      ok: true,
      text: 'Tes glucides chutent de 62 % les jours de push, ce qui explique ton plateau.',
      used: 1,
      quota: 20,
      provider: 'gemini',
      model: 'x',
    });

    await expect(narrateDossier(DOSSIER, 'fr')).resolves.toEqual({ ok: false, code: 'rejected' });
  });

  it('🔴 ne réessaie PAS après un rejet', async () => {
    mockCall.mockResolvedValue({ ok: true, text: 'Chute de 62 % sur tes glucides du jour de push.', used: 1, quota: 20, provider: 'g', model: 'x' });

    await narrateDossier(DOSSIER, 'fr');

    // Redemander masquerait la fréquence du défaut — or c'est ce qu'on veut pouvoir observer
    // avant d'ouvrir cette surface à tout le monde (spec D3).
    expect(mockCall).toHaveBeenCalledTimes(1);
  });

  it('traite une réponse tronquée comme inexploitable', async () => {
    mockCall.mockResolvedValue({ ok: true, text: 'Tes glu', used: 1, quota: 20, provider: 'g', model: 'x' });

    await expect(narrateDossier(DOSSIER, 'fr')).resolves.toEqual({ ok: false, code: 'invalid' });
  });

  it('laisse passer les codes du serveur tels quels', async () => {
    mockCall.mockResolvedValue({ ok: false, code: 'quota-exceeded' });

    await expect(narrateDossier(DOSSIER, 'fr')).resolves.toEqual({
      ok: false,
      code: 'quota-exceeded',
    });
  });

  it('🔴 envoie le dossier ENTIER, écartés compris', async () => {
    mockCall.mockResolvedValue({ ok: true, text: 'Rien de notable dans tes données cette fois-ci.', used: 1, quota: 20, provider: 'g', model: 'x' });

    await narrateDossier(DOSSIER, 'fr');

    const sent = mockCall.mock.calls[0][0];
    expect(sent.kind).toBe('coach');
    // Taire les pistes écartées ferait raconter une histoire plus simple que la réalité.
    expect(sent.context).toContain('Volume pectoraux');
    expect(sent.context).toContain('Push le mercredi');
    expect(sent.question).toContain('QUE les chiffres');
  });

  it('demande l’anglais quand l’app est en anglais', async () => {
    mockCall.mockResolvedValue({ ok: true, text: 'You eat 210 g of carbs on push days, versus 318 g.', used: 1, quota: 20, provider: 'g', model: 'x' });

    await narrateDossier(DOSSIER, 'en');

    expect(mockCall.mock.calls[0][0].question).toContain('ONLY the numbers');
  });
});
