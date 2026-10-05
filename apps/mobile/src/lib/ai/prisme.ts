/**
 * US PRISME-01 — le chemin app de **Prisme** : raconter un bilan, lire un repas, accorder ou retirer
 * l'accord. Réf. : docs/specs/functional/us/prisme01-prisme-raconte.md.
 *
 * Ce module ne contient aucune règle : le garde-fou, les invites et la lecture d'un repas vivent dans
 * `@wellness/shared`, purs et testés. Ici on branche l'appel, le verdict et la mesure, et on traduit le
 * résultat en un code que l'écran sait dire.
 *
 * 🔴 **Un texte qui cite un chiffre absent du dossier est jeté**, pas corrigé ni redemandé (R2) :
 * réessayer masquerait la fréquence du défaut, qui est le premier critère pour juger un fournisseur.
 * Le refus est donc **compté** (`prisme_rejected`, par fournisseur et par surface).
 */

import {
  BILAN_MAX_CHARS,
  MEAL_TEXT_MAX_CHARS,
  bilanNumbers,
  buildBilanPrompt,
  checkNarration,
  parseMealTextResult,
  type BilanDossier,
  type MealPhotoItem,
} from '@wellness/shared';

import { updateSettings } from '@/data/repositories/settings-repository';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics';
import { usePrismeStore } from '@/stores/prisme-store';

import { callAiAssist, callPrismeService, type AiErrorCode, type PrismeServiceResult } from './ai-client';

export type PrismeLang = 'fr' | 'en';
export type PrismeSurface = 'evening' | 'week' | 'meal';

/** Ce que l'écran doit savoir dire. `rejected` et `invalid` viennent du garde-fou, pas du serveur. */
export type PrismeOutcome = { ok: true; text: string } | { ok: false; code: AiErrorCode | 'rejected' | 'invalid' };

export type PrismeMealOutcome =
  | { ok: true; items: MealPhotoItem[]; truncated: boolean }
  | { ok: false; code: AiErrorCode | 'invalid' };

/**
 * Développement seulement (critère de recette 8) : un nombre qu'aucun dossier ne porte, ajouté au
 * texte du modèle pour voir le garde-fou le jeter sur un vrai téléphone.
 */
const SIMULATED_INVENTION = ' (9 999 kg)';

/** Relit le statut. Un échec (hors ligne) **garde** le dernier statut connu (DD7). */
export async function refreshPrismeStatus(): Promise<PrismeServiceResult> {
  const result = await callPrismeService({ kind: 'status' });
  if (result.ok) usePrismeStore.getState().setStatus(result.status);
  return result;
}

/** Après un refus `consent_required` : relire le statut, pour rouvrir la feuille au bon fournisseur. */
async function afterServerFailure(code: AiErrorCode): Promise<void> {
  if (code === 'consent-required') await refreshPrismeStatus();
}

/**
 * Raconte un bilan (soir ou semaine), puis **vérifie** chaque nombre du texte contre le dossier.
 */
export async function tellBilan(
  dossier: BilanDossier,
  usage: 'evening' | 'week',
  lang: PrismeLang,
): Promise<PrismeOutcome> {
  const { context, question } = buildBilanPrompt(dossier, lang, usage);
  const response = await callAiAssist({ kind: 'narrate', context, question });
  if (!response.ok) {
    await afterServerFailure(response.code);
    return { ok: false, code: response.code };
  }

  const text = __DEV__ && usePrismeStore.getState().devSimulateInvented ? `${response.text}${SIMULATED_INVENTION}` : response.text;
  const verdict = checkNarration(text, bilanNumbers(dossier, lang), { lang, maxChars: BILAN_MAX_CHARS });
  const measure = { provider: response.provider, surface: usage };

  if (verdict.ok) {
    void track(ANALYTICS_EVENTS.prismeTold, measure);
    return { ok: true, text: verdict.text };
  }
  if (verdict.reason === 'unknownNumber') {
    void track(ANALYTICS_EVENTS.prismeRejected, measure);
    return { ok: false, code: 'rejected' };
  }
  return { ok: false, code: 'invalid' };
}

/**
 * Lit la partie non reconnue d'une phrase de repas (R10) : 300 caractères au plus, rien d'autre.
 * Rend des aliments et des grammes — les calories sont calculées par l'app (R9).
 */
export async function askMeal(text: string, lang: PrismeLang): Promise<PrismeMealOutcome> {
  const sent = text.trim().slice(0, MEAL_TEXT_MAX_CHARS);
  if (sent.length === 0) return { ok: false, code: 'invalid' };

  const response = await callAiAssist({ kind: 'meal_text', text: sent, lang });
  if (!response.ok) {
    await afterServerFailure(response.code);
    return { ok: false, code: response.code };
  }

  void track(ANALYTICS_EVENTS.prismeMealAsked, { provider: response.provider, surface: 'meal' satisfies PrismeSurface });
  const parsed = parseMealTextResult(response.text);
  return parsed ? { ok: true, ...parsed } : { ok: false, code: 'invalid' };
}

/**
 * Accorde l'accord **par le serveur** (DD3), puis le recopie en local : l'écran le sait tout de
 * suite, sans attendre que PowerSync redescende la ligne. Un refus n'écrit rien.
 */
export async function grantPrismeConsent(adult: boolean): Promise<PrismeServiceResult> {
  const result = await callPrismeService({ kind: 'consent', grant: true, adult });
  if (!result.ok) return result;
  usePrismeStore.getState().setStatus(result.status);
  await updateSettings({
    prismeConsentAt: result.status.consent.at,
    prismeConsentProvider: result.status.consent.provider,
  });
  return result;
}

/**
 * Retire l'accord **en local**, même hors ligne : l'app cesse d'appeler tout de suite, et le retrait
 * remonte au serveur avec la prochaine synchronisation.
 */
export async function revokePrismeConsent(): Promise<void> {
  usePrismeStore.getState().clearConsent();
  await updateSettings({ prismeConsentAt: null, prismeConsentProvider: null });
}
