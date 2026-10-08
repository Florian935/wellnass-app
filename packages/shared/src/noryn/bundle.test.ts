import { describe, expect, it } from 'vitest';
// Le script vit à la racine (`npm run noryn:deploy`) ; on teste **le même** build que celui qui part
// en production.
import { buildNorynBundle, loadBundle } from '../../../../scripts/noryn-context-bundle.mjs';
import { OWNER, fakeDb, twoUserTables } from './noryn.testkit';

const TOKEN = 'jeton-synthetique-0123456789';

describe('le bundle de noryn-context (D2)', () => {
  it('embarque tout : plus aucun import ni require, zod compris', async () => {
    const text = await buildNorynBundle();
    expect(text).not.toMatch(/^\s*import\s/m);
    expect(text).not.toMatch(/\brequire\(/);
    expect(text).toContain('createNorynHandler');
  });

  it('tient seul : chargé à part, il refuse sans jeton et sert la journée avec', async () => {
    const bundle = await loadBundle(await buildNorynBundle());
    const secrets: Record<string, string> = {
      NORYN_TOKEN_SHA256: await bundle.webSha256Hex(TOKEN),
      NORYN_OWNER_USER_ID: OWNER,
    };
    const handler = bundle.createNorynHandler({
      env: (name: string) => secrets[name],
      client: fakeDb(twoUserTables()).client,
      now: () => new Date('2026-10-08T12:00:00Z'),
      log: () => {},
    });
    const request = (authorization: string | null) => ({
      method: 'GET',
      url: 'https://projet.supabase.co/functions/v1/noryn-context/context/day?date=2026-10-08',
      headers: { get: (name: string) => (name.toLowerCase() === 'authorization' ? authorization : null) },
    });

    expect((await handler(request(null))).status).toBe(401);
    const res = await handler(request(`Bearer ${TOKEN}`));
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).steps).toEqual({ count: 6400, daily_target: 10000 });
  });
});
