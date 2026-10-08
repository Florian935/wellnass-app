/**
 * US NORYN-01 — la requête : méthode, chemin, **exactement un** paramètre (R1, étapes 5 à 7).
 *
 * L'URL est lue à la main : `packages/shared` n'a pas les types `URL` du DOM, et la règle est assez
 * étroite pour ne rien laisser passer d'ambigu (paramètre répété, en trop, vide, mal encodé → 400).
 * La fenêtre de dates, elle, dépend d'« aujourd'hui » : c'est le gestionnaire qui la contrôle.
 */

import { isMondayKey, isValidDayKey } from './paris-date';

export type NorynRoute = { kind: 'day'; date: string } | { kind: 'week'; start: string };
export type NorynRequestError = {
  status: 400 | 404 | 405;
  error: 'bad_request' | 'not_found' | 'method_not_allowed';
};

/** Vu de l'extérieur (`/functions/v1/noryn-context/…`) comme de l'intérieur de la fonction. */
const PATH = /^(?:\/functions\/v1)?\/noryn-context\/context\/(day|week)$/;
const BAD_REQUEST: NorynRequestError = { status: 400, error: 'bad_request' };

function decode(text: string): string | null {
  try {
    return decodeURIComponent(text);
  } catch {
    return null;
  }
}

/** L'unique paramètre `name=valeur`, décodé — ou `null` s'il n'y en a pas exactement un. */
function singleParam(query: string | undefined): { name: string; value: string } | null {
  if (query === undefined || query === '') return null;
  const segments = query.split('&');
  if (segments.length !== 1) return null;
  const segment = segments[0] as string;
  const equal = segment.indexOf('=');
  if (equal < 0) return null;
  const name = decode(segment.slice(0, equal));
  const value = decode(segment.slice(equal + 1));
  return name === null || value === null ? null : { name, value };
}

export function parseNorynRequest(req: { method: string; url: string }): NorynRoute | NorynRequestError {
  if (req.method !== 'GET') return { status: 405, error: 'method_not_allowed' };

  const withoutFragment = req.url.split('#')[0] as string;
  const [beforeQuery, query] = withoutFragment.split(/\?(.*)/s) as [string, string | undefined];
  const path = beforeQuery.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '');
  const match = PATH.exec(path);
  if (match === null) return { status: 404, error: 'not_found' };

  const param = singleParam(query);
  if (match[1] === 'day') {
    if (param === null || param.name !== 'date' || !isValidDayKey(param.value)) return BAD_REQUEST;
    return { kind: 'day', date: param.value };
  }
  if (param === null || param.name !== 'start' || !isValidDayKey(param.value) || !isMondayKey(param.value)) {
    return BAD_REQUEST;
  }
  return { kind: 'week', start: param.value };
}
