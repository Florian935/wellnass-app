import { describe, expect, it } from 'vitest';
import { createNorynHandler, webSha256Hex } from './index';
import { OWNER, fakeDb, twoUserTables } from './noryn.testkit';

const TOKEN = 'jeton-synthetique-0123456789';

describe('webSha256Hex', () => {
  it('rend l’empreinte SHA-256 en hexadécimal minuscule (vecteurs de référence)', async () => {
    expect(await webSha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(await webSha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('createNorynHandler — le point d’entrée de la coquille Deno', () => {
  const request = (authorization: string | null) => ({
    method: 'GET',
    url: `https://projet.supabase.co/functions/v1/noryn-context/context/day?date=${new Date().toISOString().slice(0, 10)}`,
    headers: { get: (name: string) => (name.toLowerCase() === 'authorization' ? authorization : null) },
  });

  it('lit les secrets à chaque requête : retirer l’empreinte coupe l’accès sans redémarrage', async () => {
    const env: Record<string, string | undefined> = {
      NORYN_TOKEN_SHA256: await webSha256Hex(TOKEN),
      NORYN_OWNER_USER_ID: OWNER,
    };
    const codes: string[] = [];
    const handler = createNorynHandler({
      env: (name) => env[name],
      client: fakeDb(twoUserTables()).client,
      log: (code) => codes.push(code),
    });

    expect((await handler(request(`Bearer ${TOKEN}`))).status).toBe(200);
    env.NORYN_TOKEN_SHA256 = undefined;
    expect((await handler(request(`Bearer ${TOKEN}`))).status).toBe(503);
    expect((await handler(request(null))).status).toBe(401);
    expect(codes).toEqual(['missing_token_hash']);
  });

  it('sans client (URL ou clé de service absentes) : 503 db_error', async () => {
    const secrets: Record<string, string> = { NORYN_TOKEN_SHA256: 'f'.repeat(64), NORYN_OWNER_USER_ID: OWNER };
    const codes: string[] = [];
    const handler = createNorynHandler({
      env: (name) => secrets[name],
      client: null,
      sha256Hex: async () => 'f'.repeat(64),
      now: () => new Date('2026-10-08T12:00:00Z'),
      log: (code) => codes.push(code),
    });
    const res = await handler({ ...request(`Bearer ${TOKEN}`), url: 'https://p.supabase.co/functions/v1/noryn-context/context/day?date=2026-10-08' });
    expect(res.status).toBe(503);
    expect(codes).toEqual(['db_error']);
  });
});
