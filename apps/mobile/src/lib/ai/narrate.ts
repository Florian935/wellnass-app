/**
 * US NARR-01 — demander au modèle de raconter un dossier d'enquête, puis **vérifier ce qu'il rend**.
 *
 * Ce module ne contient aucune règle : elles vivent toutes dans `@wellness/shared/ai-narration`,
 * pures et testées. Ici on branche trois choses — l'invite, l'appel, le verdict — et on traduit le
 * résultat en un code que l'écran sait dire.
 *
 * ⚠️ **Aucune route serveur nouvelle** : on passe par le type `coach` de la fonction Edge
 * `ai-assist`, déployé depuis IA-LAB-01. Son invite système impose déjà « N'utilise QUE les chiffres
 * du bloc DONNÉES » ; le verdict ci-dessous vérifie qu'elle a été suivie.
 */

import {
  buildNarrationPrompt,
  checkNarration,
  dossierNumbers,
  type NarrationDossier,
} from '@wellness/shared';

import { callAiAssist, type AiErrorCode } from './ai-client';

/** Ce que l'écran doit savoir dire. `rejected` et `invalid` viennent du garde-fou, pas du serveur. */
export type NarrationOutcome =
  | { ok: true; text: string }
  | { ok: false; code: AiErrorCode | 'rejected' | 'invalid' };

/**
 * Raconte un dossier, ou explique pourquoi on ne le fera pas.
 *
 * 🔴 Un résumé qui cite un chiffre absent du dossier est **jeté**, pas corrigé et pas redemandé.
 * Réessayer automatiquement masquerait la fréquence du défaut — or c'est précisément ce qu'on veut
 * pouvoir observer avant d'ouvrir cette surface à tout le monde (spec D3).
 */
export async function narrateDossier(
  dossier: NarrationDossier,
  lang: 'fr' | 'en',
): Promise<NarrationOutcome> {
  const { context, question } = buildNarrationPrompt(dossier, lang);

  const response = await callAiAssist({ kind: 'coach', context, question });
  if (!response.ok) return { ok: false, code: response.code };

  const verdict = checkNarration(response.text, dossierNumbers(dossier));
  if (verdict.ok) return { ok: true, text: verdict.text };

  return { ok: false, code: verdict.reason === 'unknownNumber' ? 'rejected' : 'invalid' };
}
