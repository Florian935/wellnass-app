import { describe, expect, it, vi } from 'vitest';
import { handleNorynRequest, type NorynHandlerDeps, type NorynHttpRequest } from './handler';
import { NOW, OTHER_MARKERS, OWNER, emptySnapshot, fakeDb, twoUserTables } from './noryn.testkit';
import { webSha256Hex } from './index';
import { createNorynSource, type NorynSource } from './source';

const TOKEN = 'jeton-synthetique-0123456789';
const BASE = 'https://projet.supabase.co/functions/v1/noryn-context';

const request = (path: string, init: { method?: string; authorization?: string | null } = {}): NorynHttpRequest => {
  const authorization = init.authorization === undefined ? `Bearer ${TOKEN}` : init.authorization;
  return {
    method: init.method ?? 'GET',
    url: `${BASE}${path}`,
    headers: { get: (name) => (name.toLowerCase() === 'authorization' ? authorization : null) },
  };
};

async function deps(over: Partial<NorynHandlerDeps> = {}): Promise<NorynHandlerDeps> {
  return {
    tokenHash: await webSha256Hex(TOKEN),
    ownerId: OWNER,
    now: NOW,
    sha256Hex: webSha256Hex,
    source: createNorynSource(fakeDb(twoUserTables()).client),
    log: () => {},
    ...over,
  };
}

const call = async (req: NorynHttpRequest, over: Partial<NorynHandlerDeps> = {}) =>
  handleNorynRequest(req, await deps(over));

const DAY = '/context/day?date=2026-10-08';

describe('handleNorynRequest — accès (R1, R2)', () => {
  it('sans Authorization → 401, même secret absent', async () => {
    for (const tokenHash of [await webSha256Hex(TOKEN), undefined]) {
      const res = await call(request(DAY, { authorization: null }), { tokenHash });
      expect(res.status).toBe(401);
      expect(JSON.parse(res.body)).toEqual({ error: 'unauthorized' });
      expect(res.headers['WWW-Authenticate']).toBe('Bearer');
    }
  });

  it('Authorization mal formé → 401', async () => {
    expect((await call(request(DAY, { authorization: `Basic ${TOKEN}` }))).status).toBe(401);
    expect((await call(request(DAY, { authorization: 'Bearer court' }))).status).toBe(401);
  });

  it('mauvais jeton, JWT d’utilisateur → 401', async () => {
    expect((await call(request(DAY, { authorization: 'Bearer un-autre-jeton-0123456789' }))).status).toBe(401);
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMTExIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQifQ.c2lnbmF0dXJl';
    const res = await call(request(DAY, { authorization: `Bearer ${jwt}` }));
    expect(res.status).toBe(401);
    expect(res.headers['WWW-Authenticate']).toBe('Bearer');
  });

  it('jeton bien formé mais empreinte absente ou mal formée → 503, jamais 200', async () => {
    expect((await call(request(DAY), { tokenHash: undefined })).status).toBe(503);
    expect((await call(request(DAY), { tokenHash: 'abc' })).status).toBe(503);
  });

  it('empreinte posée en majuscules : acceptée', async () => {
    expect((await call(request(DAY), { tokenHash: (await webSha256Hex(TOKEN)).toUpperCase() })).status).toBe(200);
  });

  it('bon jeton, propriétaire absent ou mal formé → 503', async () => {
    expect((await call(request(DAY), { ownerId: undefined })).status).toBe(503);
    expect((await call(request(DAY), { ownerId: 'florian' })).status).toBe(503);
  });

  it('sans jeton, POST → 401 : le jeton passe avant la méthode', async () => {
    expect((await call(request(DAY, { method: 'POST', authorization: null }))).status).toBe(401);
  });

  it('bon jeton, POST / HEAD / OPTIONS → 405 avec Allow: GET', async () => {
    for (const method of ['POST', 'HEAD', 'OPTIONS']) {
      const res = await call(request(DAY, { method }));
      expect(res.status).toBe(405);
      expect(res.headers.Allow).toBe('GET');
      expect(JSON.parse(res.body)).toEqual({ error: 'method_not_allowed' });
    }
  });

  it('chemin inconnu → 404 ; paramètres invalides → 400', async () => {
    expect((await call(request('/context/today'))).status).toBe(404);
    const bad = await call(request('/context/day?date=2026-10-08&x=1'));
    expect(bad.status).toBe(400);
    expect(JSON.parse(bad.body)).toEqual({ error: 'bad_request' });
  });
});

describe('handleNorynRequest — fenêtre (D8 : J−8 … J+15)', () => {
  it.each(['2026-09-30', '2026-10-01', '2026-10-08', '2026-10-22', '2026-10-23'])('%s → 200', async (date) => {
    expect((await call(request(`/context/day?date=${date}`))).status).toBe(200);
  });

  it.each(['2026-09-29', '2026-10-24'])('%s → 400 out_of_window', async (date) => {
    const res = await call(request(`/context/day?date=${date}`));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body)).toEqual({ error: 'out_of_window' });
  });

  it('semaine recoupant la fenêtre → 200 ; hors fenêtre → 400', async () => {
    expect((await call(request('/context/week?start=2026-10-05'))).status).toBe(200);
    expect((await call(request('/context/week?start=2026-10-19'))).status).toBe(200);
    expect((await call(request('/context/week?start=2026-10-26'))).status).toBe(400);
    expect((await call(request('/context/week?start=2026-09-21'))).status).toBe(400);
  });

  it('« aujourd’hui » se lit à Paris : à 00 h 30 le 09/10 à Paris (22 h 30 UTC la veille), J+15 = 24/10', async () => {
    const now = new Date('2026-10-08T22:30:00Z');
    expect((await call(request('/context/day?date=2026-10-24'), { now })).status).toBe(200);
  });
});

describe('handleNorynRequest — réponses', () => {
  it('200 : JSON du contrat, no-store, aucun en-tête CORS', async () => {
    const res = await call(request(DAY));
    expect(res.status).toBe(200);
    expect(res.headers['Content-Type']).toBe('application/json');
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(Object.keys(res.headers).some((h) => h.toLowerCase().startsWith('access-control'))).toBe(false);
    const day = JSON.parse(res.body);
    expect(day.date).toBe('2026-10-08');
    expect(day.steps).toEqual({ count: 6400, daily_target: 10000 });
  });

  it('la semaine passe aussi', async () => {
    const res = await call(request('/context/week?start=2026-10-05'));
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).training.done).toEqual({ strength: 1, running: 1 });
  });

  it('toutes les réponses d’erreur sont du JSON no-store', async () => {
    for (const res of [
      await call(request(DAY, { authorization: null })),
      await call(request(DAY), { tokenHash: undefined }),
      await call(request(DAY, { method: 'POST' })),
      await call(request('/x')),
    ]) {
      expect(res.headers['Content-Type']).toBe('application/json');
      expect(res.headers['Cache-Control']).toBe('no-store');
      expect(() => JSON.parse(res.body)).not.toThrow();
    }
  });

  it('isolation de bout en bout : rien de l’autre compte', async () => {
    for (const path of [DAY, '/context/week?start=2026-10-05']) {
      const res = await call(request(path));
      for (const marker of OTHER_MARKERS) expect(res.body).not.toContain(marker);
    }
  });

  it('jamais synchronisé de bout en bout : aucune valeur, aucune séance', async () => {
    const tables = { ...twoUserTables(), sync_receipts: [] };
    const res = await call(request(DAY), { source: createNorynSource(fakeDb(tables).client) });
    const day = JSON.parse(res.body);
    expect(res.status).toBe(200);
    expect(day.synced_at).toBeNull();
    expect(day.steps.count).toBeNull();
    expect(day.training).toEqual([]);
  });
});

describe('handleNorynRequest — échec fermé', () => {
  it('base en panne → 503, journal réduit à un code', async () => {
    const log = vi.fn();
    const source = createNorynSource(fakeDb(twoUserTables(), { failOn: 'daily_steps' }).client);
    const res = await call(request(DAY), { source, log });
    expect(res.status).toBe(503);
    expect(JSON.parse(res.body)).toEqual({ error: 'unavailable' });
    expect(log).toHaveBeenCalledWith('db_error');
  });

  it('filtre oublié (ligne d’un autre compte) → 503, rien n’est envoyé', async () => {
    const log = vi.fn();
    const source = createNorynSource(fakeDb(twoUserTables(), { ignoreOwnerFilter: true }).client);
    const res = await call(request(DAY), { source, log });
    expect(res.status).toBe(503);
    for (const marker of OTHER_MARKERS) expect(res.body).not.toContain(marker);
    expect(log).toHaveBeenCalledWith('foreign_row');
  });

  it('erreur inattendue de la source → 503', async () => {
    const log = vi.fn();
    const source: NorynSource = { load: () => Promise.reject(new Error('boom')) };
    expect((await call(request(DAY), { source, log })).status).toBe(503);
    expect(log).toHaveBeenCalledWith('db_error');
  });

  it('reçu illisible → 500, jamais une fraîcheur inventée', async () => {
    const log = vi.fn();
    const source: NorynSource = { load: async () => emptySnapshot({ receivedAt: 'hier' }) };
    const res = await call(request(DAY), { source, log });
    expect(res.status).toBe(500);
    expect(log).toHaveBeenCalledWith('build_error');
  });

  it('réponse hors contrat → 500, jamais un 200 (ici : la même séance deux fois)', async () => {
    const log = vi.fn();
    const twice = {
      owner_id: OWNER,
      id: '5b0c2f9e-8d1a-4c3e-9f6b-000000000001',
      scheduled_date: '2026-10-08',
      scheduled_time: null,
      status: 'planned',
      session_id: 's1',
      program_id: 'p1',
    };
    const source: NorynSource = {
      load: async () =>
        emptySnapshot({
          planned: [twice, twice],
          sessions: [
            { owner_id: null, id: 's1', session_type: 'endurance', order_index: 0, target_duration_seconds: 1800, target_distance_m: null },
          ],
          programs: [{ owner_id: null, id: 'p1', pillar: 'running', status: 'published' }],
        }),
    };
    const res = await call(request(DAY), { source, log });
    expect(res.status).toBe(500);
    expect(JSON.parse(res.body)).toEqual({ error: 'unavailable' });
    expect(log).toHaveBeenCalledWith('contract_error');
  });

  it('empreinte impossible à calculer → 500', async () => {
    const log = vi.fn();
    const res = await call(request(DAY), { sha256Hex: () => Promise.reject(new Error('pas de WebCrypto')), log });
    expect(res.status).toBe(500);
    expect(log).toHaveBeenCalledWith('unexpected_error');
  });
});

describe('handleNorynRequest — taille', () => {
  it('la semaine la plus chargée que le contrat permet reste loin des 64 Kio', async () => {
    const keys = ['05', '06', '07', '08', '09', '10', '11'];
    const planned = keys.flatMap((d, day) =>
      Array.from({ length: 6 }, (_, n) => ({
        owner_id: OWNER,
        id: `5b0c2f9e-8d1a-4c3e-9f6b-0000000000${day}${n}`,
        scheduled_date: `2026-10-${d}`,
        scheduled_time: '18:30:00',
        status: 'planned',
        session_id: 's1',
        program_id: 'p1',
      })),
    );
    const source: NorynSource = {
      load: async () =>
        emptySnapshot({
          planned,
          sessions: [
            { owner_id: null, id: 's1', session_type: 'sortie_longue', order_index: 0, target_duration_seconds: 5400, target_distance_m: null },
          ],
          programs: [{ owner_id: null, id: 'p1', pillar: 'running', status: 'published' }],
        }),
    };
    const res = await call(request('/context/week?start=2026-10-05'), { source });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).training.sessions).toHaveLength(42);
    expect(res.body.length).toBeLessThan(16 * 1024);
  });

  it('propriétaire au format UUID mais inconnu (secret mal saisi) → 503 unknown_owner, pas « jamais synchronisé »', async () => {
    const log = vi.fn();
    const res = await call(request(DAY), { ownerId: '33333333-3333-4333-8333-333333333333', log });
    expect(res.status).toBe(503);
    expect(log).toHaveBeenCalledWith('unknown_owner');
  });
});
