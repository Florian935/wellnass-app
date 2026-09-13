/**
 * US DASH-01 (§7.1) — le **seul** chemin de l'app vers un modèle : la fonction Edge `ai-assist`.
 *
 * L'app n'a aucune clé de fournisseur (elle serait publique dans l'APK) et ne connaît qu'un nom de
 * fonction. Tout ce qui protège — JWT, consentement, quota, taille — vit côté serveur ; ce module
 * ne fait que poser l'appel et **traduire les erreurs en codes** que l'UI sait dire.
 *
 * ⚠️ Aucune donnée affichée ne sort d'ici telle quelle : le texte du modèle est validé par zod
 * (`parseAiJson`, `@wellness/shared`) chez l'appelant, et les calories sont calculées depuis le
 * catalogue local (R5). Un modèle ne produit jamais un nombre affiché.
 */

import { supabase } from '@/lib/supabase';

const FUNCTION_NAME = 'ai-assist';

/** Les échecs que l'UI sait formuler. Tout le reste devient `failed`. */
export type AiErrorCode =
  | 'consent-required'
  | 'quota-exceeded'
  | 'offline'
  | 'unavailable'
  | 'refused'
  | 'failed';

export type AiResult =
  | { ok: true; text: string; used: number; quota: number }
  | { ok: false; code: AiErrorCode };

type PhotoRequest = {
  kind: 'photo';
  imageBase64: string;
  imageMediaType?: 'image/jpeg' | 'image/png' | 'image/webp';
};
type AskRequest = { kind: 'ask'; prompt: string };

/** Traduit la réponse du serveur en code d'UI — la fonction Edge renvoie des codes stables. */
function codeFromServer(error: string | undefined, status: number | undefined): AiErrorCode {
  switch (error) {
    case 'consent_required':
      return 'consent-required';
    case 'quota_exceeded':
      return 'quota-exceeded';
    case 'ai_unavailable':
      return 'unavailable';
    case 'refused':
      return 'refused';
    default:
      return status === 401 ? 'unavailable' : 'failed';
  }
}

export async function callAiAssist(request: PhotoRequest | AskRequest): Promise<AiResult> {
  try {
    const { data, error } = await supabase.functions.invoke<{
      text?: string;
      used?: number;
      quota?: number;
      error?: string;
    }>(FUNCTION_NAME, { body: request });

    if (error) {
      // `FunctionsHttpError` porte la réponse ; les autres cas sont réseau ou relais.
      const response = (error as { context?: Response }).context;
      if (response && typeof response.json === 'function') {
        try {
          const payload = (await response.json()) as { error?: string };
          return { ok: false, code: codeFromServer(payload.error, response.status) };
        } catch {
          return { ok: false, code: 'failed' };
        }
      }
      // Pas de réponse HTTP du tout : on est hors ligne, ou la fonction n'est pas déployée.
      return { ok: false, code: 'offline' };
    }

    if (!data?.text) return { ok: false, code: codeFromServer(data?.error, undefined) };
    return { ok: true, text: data.text, used: data.used ?? 0, quota: data.quota ?? 0 };
  } catch {
    return { ok: false, code: 'offline' };
  }
}
