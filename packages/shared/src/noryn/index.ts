/**
 * US NORYN-01 — point d'entrée du **bundle** de la fonction `noryn-context`.
 *
 * ⚠️ **Pas exporté par `packages/shared/src/index.ts`**, volontairement : rien de ce dossier n'entre
 * dans l'app (Metro suit les imports). Il est embarqué dans la fonction par esbuild
 * (`npm run noryn:deploy`, décision D2) : la CLI Supabase avec `--use-api` ne suit pas les imports
 * sans extension de `packages/shared`, et le bundle part **de la même source** que l'app — aucune
 * formule recopiée.
 */

import { handleNorynRequest, type NorynHttpRequest, type NorynHttpResponse } from './handler';
import { createNorynSource, type NorynDbClient } from './source';

export type { NorynDbClient, NorynHttpRequest, NorynHttpResponse };

type WebCrypto = { subtle: { digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer> } };
type Encoder = new () => { encode(text: string): Uint8Array };

/** Empreinte SHA-256 en hexadécimal minuscule, par WebCrypto (Deno, comme Node ≥ 20). */
export async function webSha256Hex(text: string): Promise<string> {
  const platform = globalThis as unknown as { crypto: WebCrypto; TextEncoder: Encoder };
  const digest = await platform.crypto.subtle.digest('SHA-256', new platform.TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Le gestionnaire prêt à brancher sur `Deno.serve`. Les secrets sont relus **à chaque requête** :
 * retirer `NORYN_TOKEN_SHA256` coupe l'accès sans attendre un redémarrage.
 */
export function createNorynHandler(options: {
  env: (name: string) => string | undefined;
  client: NorynDbClient | null;
  sha256Hex?: (text: string) => Promise<string>;
  now?: () => Date;
  log: (code: string) => void;
}): (req: NorynHttpRequest) => Promise<NorynHttpResponse> {
  const source = createNorynSource(options.client);
  const now = options.now ?? (() => new Date());
  return (req) =>
    handleNorynRequest(req, {
      tokenHash: options.env('NORYN_TOKEN_SHA256'),
      ownerId: options.env('NORYN_OWNER_USER_ID'),
      now: now(),
      sha256Hex: options.sha256Hex ?? webSha256Hex,
      source,
      log: options.log,
    });
}
