import { describe, expect, it } from 'vitest';
import { parseNorynRequest } from './request';

const BASE = 'https://projet.supabase.co/functions/v1/noryn-context';
const get = (path: string) => parseNorynRequest({ method: 'GET', url: `${BASE}${path}` });

describe('parseNorynRequest — routes', () => {
  it('lit la journée et la semaine', () => {
    expect(get('/context/day?date=2026-10-08')).toEqual({ kind: 'day', date: '2026-10-08' });
    expect(get('/context/week?start=2026-10-05')).toEqual({ kind: 'week', start: '2026-10-05' });
  });

  it('accepte le chemin vu de l’intérieur de la fonction (sans /functions/v1)', () => {
    expect(parseNorynRequest({ method: 'GET', url: 'http://localhost/noryn-context/context/day?date=2026-10-08' })).toEqual({
      kind: 'day',
      date: '2026-10-08',
    });
  });

  it('ignore un fragment', () => {
    expect(get('/context/day?date=2026-10-08#x')).toEqual({ kind: 'day', date: '2026-10-08' });
  });

  it('405 pour toute autre méthode que GET', () => {
    for (const method of ['POST', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']) {
      expect(parseNorynRequest({ method, url: `${BASE}/context/day?date=2026-10-08` })).toEqual({
        status: 405,
        error: 'method_not_allowed',
      });
    }
  });

  it('404 pour un chemin voisin ou inconnu', () => {
    for (const path of ['/context/days?date=2026-10-08', '/context/day/?date=2026-10-08', '/context/today', '', '/']) {
      expect(get(path)).toEqual({ status: 404, error: 'not_found' });
    }
    expect(parseNorynRequest({ method: 'GET', url: 'https://projet.supabase.co/functions/v1/autre/context/day' })).toEqual({
      status: 404,
      error: 'not_found',
    });
  });
});

describe('parseNorynRequest — paramètres (exactement un)', () => {
  const bad = { status: 400, error: 'bad_request' };

  it.each([
    '/context/day',
    '/context/day?',
    '/context/day?date=',
    '/context/day?date=2026-02-30',
    '/context/day?date=08/10/2026',
    '/context/day?date=2026-10-08&date=2026-10-09',
    '/context/day?date=2026-10-08&x=1',
    '/context/day?date=2026-10-08&',
    '/context/day?start=2026-10-05',
    '/context/day?date',
    '/context/day?date=%E0%A4%A',
    '/context/week?start=2026-10-06',
    '/context/week?date=2026-10-05',
  ])('400 pour %s', (path) => {
    expect(get(path)).toEqual(bad);
  });

  it('décode un paramètre encodé', () => {
    expect(get('/context/day?%64ate=2026%2D10%2D08')).toEqual({ kind: 'day', date: '2026-10-08' });
  });
});
