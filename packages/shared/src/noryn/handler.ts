/**
 * US NORYN-01 — le gestionnaire de `noryn-context` : une requête entre, une réponse sort, et
 * **rien d'autre** — pas d'API de plateforme, pas d'horloge lue, pas de journal du contenu.
 *
 * L'ordre des contrôles est celui de la spec (R1) ; chaque étape échoue **fermé** (DD4) : un secret
 * absent, une base en panne, une ligne d'un autre compte ou une réponse hors contrat ne donnent
 * jamais un 200. Les réponses sont toujours du JSON `no-store`, sans en-tête CORS (appel de serveur
 * à serveur), sans détail sur la cause.
 *
 * Taille : le contrat plafonne une réponse (42 séances au plus, champs bornés) bien en dessous des
 * 64 Kio que Noryn accepte — un test le vérifie sur la semaine la plus chargée possible.
 */

import { normalizeOwnerId, normalizeTokenHash, parseBearer, sameHash } from './auth';
import { norynDaySchema, norynWeekSchema } from './contract';
import { buildNorynDay } from './day';
import { addDayKeys, inServedWindow, parisDayKey, weekOverlapsServedWindow } from './paris-date';
import { parseNorynRequest } from './request';
import { NorynSourceError, type NorynSource } from './source';
import { buildNorynWeek } from './week';

export type NorynHttpRequest = {
  method: string;
  url: string;
  headers: { get(name: string): string | null };
};

export type NorynHttpResponse = { status: number; headers: Record<string, string>; body: string };

export type NorynHandlerDeps = {
  /** Secret `NORYN_TOKEN_SHA256`, tel quel. */
  tokenHash: string | undefined;
  /** Secret `NORYN_OWNER_USER_ID`, tel quel. */
  ownerId: string | undefined;
  now: Date;
  sha256Hex: (text: string) => Promise<string>;
  source: NorynSource;
  /** Reçoit un **code fixe** et rien d'autre (R10). */
  log: (code: string) => void;
};

function json(status: number, body: unknown, extra: Record<string, string> = {}): NorynHttpResponse {
  return {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
    body: JSON.stringify(body),
  };
}

const unauthorized = () => json(401, { error: 'unauthorized' }, { 'WWW-Authenticate': 'Bearer' });
const unavailable = (status: 500 | 503) => json(status, { error: 'unavailable' });

export async function handleNorynRequest(req: NorynHttpRequest, deps: NorynHandlerDeps): Promise<NorynHttpResponse> {
  try {
    // 1-3. Le jeton de Noryn, avant toute autre vérification.
    const token = parseBearer(req.headers.get('authorization'));
    if (token === null) return unauthorized();
    const expected = normalizeTokenHash(deps.tokenHash);
    if (expected === null) {
      deps.log('missing_token_hash');
      return unavailable(503);
    }
    if (!sameHash(await deps.sha256Hex(token), expected)) return unauthorized();

    // 4. Le propriétaire : le secret, jamais la requête.
    const owner = normalizeOwnerId(deps.ownerId);
    if (owner === null) {
      deps.log('missing_owner');
      return unavailable(503);
    }

    // 5-7. Méthode, chemin, paramètre.
    const route = parseNorynRequest(req);
    if ('error' in route) {
      return json(route.status, { error: route.error }, route.status === 405 ? { Allow: 'GET' } : {});
    }

    // 8. La fenêtre, autour d'aujourd'hui à Paris (D8).
    const today = parisDayKey(deps.now);
    const served =
      route.kind === 'day' ? inServedWindow(route.date, today) : weekOverlapsServedWindow(route.start, today);
    if (!served) return json(400, { error: 'out_of_window' });

    // 9. La lecture, au seul propriétaire.
    const from = route.kind === 'day' ? route.date : route.start;
    const to = route.kind === 'day' ? route.date : addDayKeys(route.start, 6);
    let snapshot;
    try {
      snapshot = await deps.source.load(owner, { from, to, scope: route.kind });
    } catch (error) {
      deps.log(error instanceof NorynSourceError ? error.code : 'db_error');
      return unavailable(503);
    }

    // 10. La synthèse, validée contre le contrat avant de partir (DD3).
    let payload;
    try {
      payload =
        route.kind === 'day'
          ? buildNorynDay(snapshot, { date: route.date, now: deps.now })
          : buildNorynWeek(snapshot, { start: route.start, now: deps.now });
    } catch {
      deps.log('build_error');
      return unavailable(500);
    }
    const schema = route.kind === 'day' ? norynDaySchema : norynWeekSchema;
    if (!schema.safeParse(payload).success) {
      deps.log('contract_error');
      return unavailable(500);
    }
    return json(200, payload);
  } catch {
    deps.log('unexpected_error');
    return unavailable(500);
  }
}
