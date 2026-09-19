/**
 * US NARR-01 — le bloc de résumé, vu depuis l'écran.
 *
 * Ce qui compte ici n'est pas l'apparence : c'est que **le refus se voie**. Un garde-fou qui rejette
 * un texte sans le dire produirait un bouton qui « ne fait rien » — la pire lecture possible, et
 * celle qui empêcherait d'observer la fréquence des rejets.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { LabNarration } from '../LabNarration';
import { narrateDossier } from '@/lib/ai/narrate';
import type { NarrationDossier } from '@wellness/shared';

jest.mock('@/lib/ai/narrate', () => ({ narrateDossier: jest.fn() }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'fr' },
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: { text: '#33291f', textMuted: '#786a59', surface: '#fffaf2', border: '#ece0cd' },
  }),
}));

const mockNarrate = narrateDossier as jest.Mock;

const DOSSIER: NarrationDossier = {
  headline: 'Développé couché : 80 kg depuis 4 semaines',
  facts: [{ label: 'Assiette × Muscu', detail: '210 g contre 318 g', values: [210, 318] }],
  cleared: [],
  missing: [],
  experiment: null,
};

const presser = async () => {
  await act(async () => {
    fireEvent.press(screen.getByTestId('lab-narrate'));
  });
};

beforeEach(() => jest.clearAllMocks());

describe('LabNarration', () => {
  it('🔴 ne demande rien tant qu’on ne le demande pas', async () => {
    await render(<LabNarration dossier={DOSSIER} />);

    // Le quota Gemini est partagé par tout le projet : un résumé à l'ouverture de l'écran le
    // brûlerait pour un texte que personne n'a réclamé.
    expect(mockNarrate).not.toHaveBeenCalled();
    expect(screen.getByText('lab.why.narrate.cta')).toBeTruthy();
  });

  it('affiche le résumé, sa provenance et sa limite', async () => {
    mockNarrate.mockResolvedValue({ ok: true, text: 'Tes glucides chutent les jours de push.' });

    await render(<LabNarration dossier={DOSSIER} />);
    await presser();

    expect(screen.getByText('Tes glucides chutent les jours de push.')).toBeTruthy();
    expect(screen.getByText('lab.why.narrate.source')).toBeTruthy();
    // « Le résumé lit le dossier ; il ne le remplace pas » : la limite est écrite à l'écran, pas
    // seulement dans la spec.
    expect(screen.getByText('lab.why.narrate.limit')).toBeTruthy();
  });

  it('🔴 dit le refus quand le garde-fou a rejeté un chiffre inventé', async () => {
    mockNarrate.mockResolvedValue({ ok: false, code: 'rejected' });

    await render(<LabNarration dossier={DOSSIER} />);
    await presser();

    expect(screen.getByText('lab.why.narrate.rejected')).toBeTruthy();
  });

  it('réutilise les messages d’IA-LAB-01 pour les pannes du serveur', async () => {
    mockNarrate.mockResolvedValue({ ok: false, code: 'quota-exceeded' });

    await render(<LabNarration dossier={DOSSIER} />);
    await presser();

    // Deux phrases pour une même panne divergeraient à la première retouche.
    expect(screen.getByText('aiLab.errors.quota-exceeded')).toBeTruthy();
  });

  it('un échec inattendu ne casse pas l’écran', async () => {
    mockNarrate.mockRejectedValue(new Error('boom'));

    await render(<LabNarration dossier={DOSSIER} />);
    await presser();

    expect(screen.getByTestId('lab-narrate-error')).toBeTruthy();
  });
});
