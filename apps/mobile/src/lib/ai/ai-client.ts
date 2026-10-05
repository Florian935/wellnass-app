/**
 * US DASH-01 (§7.1), rouvert par IA-LAB-01 — le **seul** chemin de l'app vers un modèle : la
 * fonction Edge `ai-assist`.
 *
 * L'app n'a aucune clé de fournisseur (elle serait publique dans l'APK) et ne connaît qu'un nom de
 * fonction. Tout ce qui protège — JWT, consentement, quota, taille — vit côté serveur ; ce module
 * ne fait que poser l'appel et **traduire les erreurs en codes** que l'UI sait dire.
 *
 * ⚠️ Aucune donnée affichée hors du labo ne sort d'ici telle quelle : pour `photo` et `ask`, le
 * texte du modèle est validé par zod (`parseAiJson`, `@wellness/shared`) chez l'appelant, et les
 * calories sont calculées depuis le catalogue local (R5). Un modèle ne produit jamais un nombre
 * affiché. `coach` fait exception **et c'est tout son objet** : le labo affiche la sortie brute,
 * parce que c'est elle qu'on évalue.
 */

import { prismeStatusSchema, type PrismeStatus } from '@wellness/shared';

import { supabase } from '@/lib/supabase';

const FUNCTION_NAME = 'ai-assist';

/**
 * Les échecs que l'UI sait formuler. Tout le reste devient `failed`.
 *
 * US PRISME-01 — `not-allowed` (compte de moins de 18 ans, R13), `adult-required` (la feuille d'accord
 * doit faire confirmer « 18 ans ou plus », DD15), `settings-missing` (accord demandé avant la première
 * synchro des réglages).
 */
export type AiErrorCode =
  | 'consent-required'
  | 'quota-exceeded'
  | 'offline'
  | 'unavailable'
  | 'refused'
  | 'misconfigured'
  | 'not-allowed'
  | 'adult-required'
  | 'settings-missing'
  | 'failed';

export type AiResult =
  | { ok: true; text: string; used: number; quota: number; provider: string; model: string }
  /** `detail` n'est rempli que pour `misconfigured` — voir `classifyHttpError` côté fonction. */
  | { ok: false; code: AiErrorCode; detail?: string };

type PhotoRequest = {
  kind: 'photo';
  imageBase64: string;
  imageMediaType?: 'image/jpeg' | 'image/png' | 'image/webp';
};
type AskRequest = { kind: 'ask'; prompt: string };
/** IA-LAB-01 : le contexte agrégé (`buildAiContext`) et une question libre. */
type CoachRequest = { kind: 'coach'; context: string; question: string };
/** PRISME-01 : un bilan (dossier en liste blanche) et sa consigne (`buildBilanPrompt`). */
type NarrateRequest = { kind: 'narrate'; context: string; question: string };
/** PRISME-01 : la partie non reconnue d'une phrase de repas, et la langue de l'app. */
type MealTextRequest = { kind: 'meal_text'; text: string; lang: 'fr' | 'en' };

export type AiRequest = PhotoRequest | AskRequest | CoachRequest | NarrateRequest | MealTextRequest;

/** PRISME-01 — le statut, et l'accord (accordé par le serveur, DD3). */
export type PrismeServiceRequest = { kind: 'status' } | { kind: 'consent'; grant: boolean; adult?: boolean };
export type PrismeServiceResult = { ok: true; status: PrismeStatus } | { ok: false; code: AiErrorCode };

type ServerPayload = {
  text?: string;
  used?: number;
  quota?: number;
  provider?: string;
  model?: string;
  error?: string;
  detail?: string;
};

/** Traduit la réponse du serveur en code d'UI — la fonction Edge renvoie des codes stables. */
function codeFromServer(error: string | undefined, status: number | undefined): AiErrorCode {
  switch (error) {
    case 'consent_required':
      return 'consent-required';
    case 'quota_exceeded':
      return 'quota-exceeded';
    case 'ai_unavailable':
      return 'unavailable';
    case 'ai_misconfigured':
      return 'misconfigured';
    case 'refused':
      return 'refused';
    case 'not_allowed':
      return 'not-allowed';
    case 'adult_required':
      return 'adult-required';
    case 'settings_missing':
      return 'settings-missing';
    default:
      return status === 401 ? 'unavailable' : 'failed';
  }
}

/** Lit l'erreur d'un `FunctionsHttpError`, ou conclut « hors ligne » s'il n'y a pas de réponse HTTP. */
async function codeFromInvokeError(error: unknown): Promise<{ code: AiErrorCode; detail?: string }> {
  const response = (error as { context?: Response }).context;
  if (response && typeof response.json === 'function') {
    try {
      const payload = (await response.json()) as ServerPayload;
      const code = codeFromServer(payload.error, response.status);
      return payload.detail ? { code, detail: payload.detail } : { code };
    } catch {
      return { code: 'failed' };
    }
  }
  return { code: 'offline' };
}

/**
 * US PRISME-01 — le statut de Prisme, ou l'accord. La réponse est **validée** par le schéma partagé :
 * un statut qui annoncerait un fournisseur qui entraîne ses modèles est refusé ici, plutôt que de
 * nourrir un texte d'accord faux (spec R6).
 */
export async function callPrismeService(request: PrismeServiceRequest): Promise<PrismeServiceResult> {
  try {
    const { data, error } = await supabase.functions.invoke<unknown>(FUNCTION_NAME, { body: request });
    if (error) return { ok: false, code: (await codeFromInvokeError(error)).code };
    const parsed = prismeStatusSchema.safeParse(data);
    return parsed.success ? { ok: true, status: parsed.data } : { ok: false, code: 'failed' };
  } catch {
    return { ok: false, code: 'offline' };
  }
}

export async function callAiAssist(request: AiRequest): Promise<AiResult> {
  try {
    const { data, error } = await supabase.functions.invoke<ServerPayload>(FUNCTION_NAME, {
      body: request,
    });

    if (error) {
      // `FunctionsHttpError` porte la réponse ; sans réponse HTTP du tout, on est hors ligne (ou la
      // fonction n'est pas déployée).
      const { code, detail } = await codeFromInvokeError(error);
      return detail ? { ok: false, code, detail } : { ok: false, code };
    }

    if (!data?.text) return { ok: false, code: codeFromServer(data?.error, undefined) };
    return {
      ok: true,
      text: data.text,
      used: data.used ?? 0,
      quota: data.quota ?? 0,
      provider: data.provider ?? 'inconnu',
      model: data.model ?? 'inconnu',
    };
  } catch {
    return { ok: false, code: 'offline' };
  }
}
