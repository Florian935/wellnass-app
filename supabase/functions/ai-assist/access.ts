/**
 * US ACCES-IA — la règle de la bêta fermée de l'IA, **copie serveur**.
 * Réf. : docs/specs/functional/us/acces-ia-testeurs.md (D1, D3, D4, R2, R4, R5).
 *
 * 🔴 **Ne pas modifier ici d'abord.** La source est `packages/shared/src/ai-access.ts`, testée ; la
 * fonction Edge ne partage pas le bundle de l'app, d'où cette copie. `ai-access.test.ts` compare les deux
 * fichiers au caractère près sous le repère ci-dessous : une copie qui dérive fait échouer la CI.
 * Après toute modification : `npx supabase functions deploy ai-assist --use-api`.
 */

// ─── règle ACCES-IA (copie vérifiée par packages/shared/src/ai-access.test.ts) ───

/** Les deux modes de l'interrupteur serveur `AI_ACCESS`. */
export const AI_ACCESS_MODES = ['testers', 'open'] as const;
export type AiAccessMode = (typeof AI_ACCESS_MODES)[number];

/**
 * D1 / R2 — seule « open » ouvre, casse et espaces ignorés. Absent, vide ou mal écrit : `testers`.
 * C'est une protection de coût : un oubli doit fermer, jamais ouvrir.
 */
export function parseAiAccess(raw: string | null | undefined): AiAccessMode {
  return typeof raw === 'string' && raw.trim().toLowerCase() === 'open' ? 'open' : 'testers';
}

/**
 * R4 — le verrou laisse-t-il passer cet appel ?
 *
 * Ouverts à tous : `status` (c'est lui qui dit « bêta fermée »), et le **retrait** d'un accord
 * (`consent` avec `grant === false` — retirer doit rester aussi simple que donner). Tout le reste, types
 * inconnus compris, exige d'être testeur en mode `testers` : un type d'appel ajouté plus tard naît fermé.
 */
export function aiAccessAllows(
  request: { kind: string; grant?: unknown },
  mode: AiAccessMode,
  isTester: boolean,
): boolean {
  if (mode === 'open' || isTester) return true;
  if (request.kind === 'status') return true;
  return request.kind === 'consent' && request.grant === false;
}

/**
 * Le verdict du verrou pour un appel, tel que la fonction Edge l'applique (spec R3, R4, D16). C'est ici,
 * et non dans `index.ts`, que se combinent le mode, la liste et le type d'appel : la fonction Deno n'a
 * pas de runner de test, ce fichier si.
 *
 * - `unavailable` : la liste des testeurs est illisible. On ferme, mais en « indisponible », jamais en
 *   « bêta fermée » (D16) — `status` compris : l'app reste alors sur « inconnu ».
 * - `closed` : refus `ai_closed`, avant le fournisseur et avant le quota.
 * - `pass` : l'appel continue. `closed` dit ce que `status` (ou la réponse d'un accord) doit annoncer ;
 *   `statusReadable: false` quand la liste est illisible — seul un retrait d'accord passe alors, et sa
 *   réponse ne doit pas prétendre « bêta fermée » à un testeur.
 */
export type AiGateVerdict =
  | { verdict: 'pass'; closed: boolean; statusReadable: boolean }
  | { verdict: 'closed' }
  | { verdict: 'unavailable' };

/** `tester` : le compte est-il dans la liste ? `'error'` si elle n'a pas pu être lue. */
export function aiGate(
  request: { kind: string; grant?: unknown },
  mode: AiAccessMode,
  tester: boolean | 'error',
): AiGateVerdict {
  if (mode === 'testers' && tester === 'error') {
    if (request.kind !== 'status' && aiAccessAllows(request, mode, false)) {
      return { verdict: 'pass', closed: true, statusReadable: false };
    }
    return { verdict: 'unavailable' };
  }
  const isTester = tester === true;
  if (!aiAccessAllows(request, mode, isTester)) return { verdict: 'closed' };
  return { verdict: 'pass', closed: !aiAccessAllows({ kind: 'narrate' }, mode, isTester), statusReadable: true };
}

/** Pourquoi Prisme n'est pas disponible, du point de vue du fournisseur configuré. */
export type PrismeProviderState = 'ok' | 'provider' | 'unconfigured';

/**
 * D4 / R5 — la raison que `status` donne, dans cet ordre : bêta fermée, âge, fournisseur. À un
 * non-testeur, on ne dit rien d'autre : « réservé aux 18 ans et plus » serait encore quelque chose de
 * Prisme. `null` = Prisme disponible.
 */
export function prismeStatusReason(input: {
  closed: boolean;
  minor: boolean;
  provider: PrismeProviderState;
}): 'closed' | 'age' | 'provider' | 'unconfigured' | null {
  if (input.closed) return 'closed';
  if (input.minor) return 'age';
  return input.provider === 'ok' ? null : input.provider;
}
