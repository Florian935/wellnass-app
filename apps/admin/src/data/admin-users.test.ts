/**
 * Back-office — utilisateurs, rôles et journal d'audit.
 *
 * Fin du lot 4 de [strategie-tests.md](../../../../docs/specs/technical/strategie-tests.md).
 *
 * Ce trio porte les opérations les plus **sensibles** du back-office : bannir un compte, donner
 * ou retirer un rôle d'administration. La sécurité elle-même est côté serveur (RPC
 * `SECURITY DEFINER`, RLS, index partiels) — ce n'est pas ce qu'on teste ici, et on ne pourrait
 * pas. Ce qu'on teste, c'est **ce que le client fait autour** :
 *
 *  - il passe bien par la RPC et **jamais** par une écriture directe (une écriture directe
 *    contournerait les garde-fous anti-self / anti-admin du serveur) ;
 *  - il **ne journalise rien** quand l'opération a échoué — une trace d'audit mensongère sur un
 *    bannissement est pire que pas de trace ;
 *  - `grantRole` distingue **trois** cas là où un `upsert` naïf n'en verrait que deux (déjà actif,
 *    à réactiver, à créer). L'unicité repose sur un **index partiel** que supabase-js ne sait pas
 *    désigner comme arbitre de conflit : la logique est donc côté client, et elle doit être juste.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSupabaseMock } from '../test-utils/supabase-mock';

const mock = createSupabaseMock();

vi.mock('../lib/supabase', () => ({ supabase: mock.client }));

const { banUser, listUsers, parseActivePillars, unbanUser } = await import('./users');
const { fetchMyRoles, grantRole, revokeRole } = await import('./roles');
const { listAudit, logAudit } = await import('./audit');

/** UUID valides — `auditEntrySchema` valide `targetId` (cf. `foods.test.ts`). */
const USER_ID = '66666666-6666-4666-8666-666666666666';
const ROLE_ROW_ID = '77777777-7777-4777-8777-777777777777';

beforeEach(() => {
  mock.reset();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// parseActivePillars
// ---------------------------------------------------------------------------

describe('parseActivePillars', () => {
  it('accepte un tableau natif (jsonb array)', () => {
    expect(parseActivePillars(['strength', 'running'])).toEqual(['strength', 'running']);
  });

  it('accepte une CHAÎNE JSON — c’est la forme que produit le mobile', () => {
    // Le mobile sérialise avec `JSON.stringify` dans une colonne PowerSync `text` ; à la synchro
    // la chaîne atterrit telle quelle dans le `jsonb`. L'admin affichait « — » pour tout le monde
    // avant que ce cas soit géré.
    expect(parseActivePillars('["strength","nutrition"]')).toEqual(['strength', 'nutrition']);
  });

  it('renvoie [] sur une valeur absente, illisible ou d’un autre type', () => {
    expect(parseActivePillars(null)).toEqual([]);
    expect(parseActivePillars('pas du json')).toEqual([]);
    expect(parseActivePillars(42)).toEqual([]);
    expect(parseActivePillars({ strength: true })).toEqual([]);
  });

  it('écarte les entrées non textuelles d’un tableau mixte', () => {
    expect(parseActivePillars(['strength', 3, null, 'running'])).toEqual(['strength', 'running']);
  });
});

// ---------------------------------------------------------------------------
// Liste des comptes
// ---------------------------------------------------------------------------

describe('listUsers', () => {
  it('lit la vue protégée, triée par inscription décroissante, avec le compte total', async () => {
    mock.setResponse('admin_users.select', { data: [{ id: USER_ID }] });

    const { rows, error } = await listUsers();

    expect(error).toBeNull();
    expect(rows).toHaveLength(1);
    const query = mock.lastQuery('admin_users', 'select');
    expect(mock.hasFilter(query, 'order', 'created_at', { ascending: false })).toBe(true);
  });

  it('pagine par tranches de 25 par défaut', async () => {
    await listUsers({ page: 2 });

    expect(mock.lastQuery('admin_users')?.filters).toContainEqual(['range', 50, 74]);
  });

  it('respecte une taille de page explicite', async () => {
    await listUsers({ page: 1, pageSize: 10 });

    expect(mock.lastQuery('admin_users')?.filters).toContainEqual(['range', 10, 19]);
  });

  it('filtre par e-mail en recherche partielle, en ignorant les espaces autour', async () => {
    await listUsers({ search: '  dupont ' });

    expect(mock.lastQuery('admin_users')?.filters).toContainEqual([
      'ilike',
      'email',
      '%dupont%',
    ]);
  });

  it('n’ajoute aucun filtre pour une recherche vide', async () => {
    await listUsers({ search: '   ' });

    const filters = mock.lastQuery('admin_users')?.filters ?? [];
    expect(filters.some((f) => f[0] === 'ilike')).toBe(false);
  });

  it('renvoie une liste vide et l’erreur, jamais des lignes partielles', async () => {
    mock.setResponse('admin_users.select', { error: new Error('rls') });

    expect(await listUsers()).toMatchObject({ rows: [], count: 0 });
  });
});

// ---------------------------------------------------------------------------
// Bannissement
// ---------------------------------------------------------------------------

describe('banUser / unbanUser', () => {
  it('passe par la RPC et jamais par une écriture directe', async () => {
    await banUser(USER_ID, 'spam');

    expect(mock.client.rpc).toHaveBeenCalledWith('ban_user', {
      target_user_id: USER_ID,
      reason: 'spam',
    });
    // Une écriture directe contournerait les garde-fous anti-self / anti-admin du serveur.
    expect(mock.queriesOn('user_bans', 'insert')).toHaveLength(0);
  });

  it('journalise le bannissement avec son motif', async () => {
    await banUser(USER_ID, 'spam');

    expect(mock.lastQuery('audit_log', 'insert')?.rows?.[0]).toMatchObject({
      action: 'user.ban',
      target_id: USER_ID,
      details: { reason: 'spam' },
    });
  });

  it('ne journalise RIEN si la RPC a refusé', async () => {
    mock.client.rpc.mockResolvedValueOnce({ data: null, error: new Error('interdit') });

    expect((await banUser(USER_ID, 'spam')).error).toBeInstanceOf(Error);
    // Une trace d'audit mensongère sur un bannissement est pire que pas de trace.
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });

  it('débannit par RPC et journalise', async () => {
    await unbanUser(USER_ID);

    expect(mock.client.rpc).toHaveBeenCalledWith('unban_user', { target_user_id: USER_ID });
    expect(mock.lastQuery('audit_log', 'insert')?.rows?.[0]).toMatchObject({
      action: 'user.unban',
      target_id: USER_ID,
    });
  });

  it('ne journalise pas un débannissement refusé', async () => {
    mock.client.rpc.mockResolvedValueOnce({ data: null, error: new Error('interdit') });

    expect((await unbanUser(USER_ID)).error).toBeInstanceOf(Error);
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rôles
// ---------------------------------------------------------------------------

describe('fetchMyRoles', () => {
  it('ne garde que les rôles connus — un rôle ajouté en SQL ne passe pas en douce', async () => {
    mock.setResponse('user_roles.select', {
      data: [{ role: 'super_admin' }, { role: 'role_inconnu' }, { role: 'moderator' }],
    });

    expect((await fetchMyRoles(USER_ID)).roles).toEqual(['super_admin', 'moderator']);
  });

  it('ignore les attributions révoquées', async () => {
    await fetchMyRoles(USER_ID);

    expect(mock.hasFilter(mock.lastQuery('user_roles', 'select'), 'is', 'deleted_at', null)).toBe(
      true,
    );
  });

  it('renvoie [] sans lever si la table est absente ou la lecture refusée', async () => {
    mock.setResponse('user_roles.select', { error: new Error('relation absente') });

    // Le gate d'accès traitera l'erreur comme « non-admin » : il ne doit surtout pas planter.
    const result = await fetchMyRoles(USER_ID);
    expect(result.roles).toEqual([]);
    expect(result.error).toBeInstanceOf(Error);
  });
});

describe('grantRole', () => {
  it('ne réécrit rien quand le rôle est déjà actif', async () => {
    mock.setResponse('user_roles.select', { data: { id: ROLE_ROW_ID } });

    const result = await grantRole(USER_ID, 'moderator');

    expect(result).toEqual({ error: null, alreadyActive: true });
    expect(mock.queriesOn('user_roles', 'update')).toHaveLength(0);
    expect(mock.queriesOn('user_roles', 'insert')).toHaveLength(0);
    // Rien n'est écrit, donc rien n'est journalisé.
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });

  it('RÉACTIVE une attribution révoquée au lieu d’en créer une seconde', async () => {
    // 1ʳᵉ lecture : aucune active. 2ᵉ lecture : une révoquée.
    mock.setResponse('user_roles.select', { data: null }, { data: { id: ROLE_ROW_ID } });

    const result = await grantRole(USER_ID, 'moderator');

    expect(result).toMatchObject({ error: null, id: ROLE_ROW_ID });
    expect(mock.lastQuery('user_roles', 'update')?.rows?.[0]).toEqual({ deleted_at: null });
    // L'unicité repose sur un index PARTIEL que supabase-js ne peut pas désigner en `onConflict` :
    // un insert produirait un doublon ou une violation, d'où la réactivation explicite.
    expect(mock.queriesOn('user_roles', 'insert')).toHaveLength(0);
  });

  it('insère une attribution neuve quand rien n’existe', async () => {
    mock.setResponse('user_roles.select', { data: null }, { data: null });
    mock.setResponse('user_roles.insert', { data: { id: ROLE_ROW_ID } });

    const result = await grantRole(USER_ID, 'content_editor');

    expect(result).toMatchObject({ error: null, id: ROLE_ROW_ID });
    expect(mock.lastQuery('user_roles', 'insert')?.rows?.[0]).toEqual({
      user_id: USER_ID,
      role: 'content_editor',
    });
  });

  it('journalise l’attribution avec le rôle et sa cible', async () => {
    mock.setResponse('user_roles.select', { data: null }, { data: null });
    mock.setResponse('user_roles.insert', { data: { id: ROLE_ROW_ID } });

    await grantRole(USER_ID, 'content_editor');

    expect(mock.lastQuery('audit_log', 'insert')?.rows?.[0]).toMatchObject({
      action: 'role.grant',
      target_id: ROLE_ROW_ID,
      target_label: `content_editor → ${USER_ID}`,
      details: { role: 'content_editor', targetUserId: USER_ID },
    });
  });

  it('s’arrête sans rien écrire si la première lecture échoue', async () => {
    mock.setResponse('user_roles.select', { error: new Error('rls') });

    expect((await grantRole(USER_ID, 'moderator')).error).toBeInstanceOf(Error);
    expect(mock.queriesOn('user_roles', 'insert')).toHaveLength(0);
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });

  it('ne journalise pas si l’insertion échoue', async () => {
    mock.setResponse('user_roles.select', { data: null }, { data: null });
    mock.setResponse('user_roles.insert', { error: new Error('rls') });

    expect((await grantRole(USER_ID, 'moderator')).error).toBeInstanceOf(Error);
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });
});

describe('revokeRole', () => {
  it('révoque en soft delete, jamais en suppression dure', async () => {
    await revokeRole(ROLE_ROW_ID);

    const update = mock.lastQuery('user_roles', 'update');
    expect(update?.rows?.[0]?.deleted_at).toEqual(expect.any(String));
    expect(mock.hasFilter(update, 'eq', 'id', ROLE_ROW_ID)).toBe(true);
    expect(mock.queriesOn('user_roles', 'delete')).toHaveLength(0);
  });

  it('journalise avec le rôle et la cible quand ils sont fournis', async () => {
    await revokeRole(ROLE_ROW_ID, { role: 'moderator', userId: USER_ID });

    expect(mock.lastQuery('audit_log', 'insert')?.rows?.[0]).toMatchObject({
      action: 'role.revoke',
      target_id: ROLE_ROW_ID,
      target_label: `moderator → ${USER_ID}`,
    });
  });

  it('ne journalise pas une révocation refusée', async () => {
    mock.setResponse('user_roles.update', { error: new Error('rls') });

    expect((await revokeRole(ROLE_ROW_ID)).error).toBeInstanceOf(Error);
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Journal d'audit
// ---------------------------------------------------------------------------

describe('logAudit', () => {
  it('capte l’acteur depuis la session', async () => {
    await logAudit({ action: 'food.import', targetTable: 'foods', targetId: null });

    expect(mock.lastQuery('audit_log', 'insert')?.rows?.[0]).toMatchObject({
      actor_id: 'admin-1',
      action: 'food.import',
    });
  });

  it('refuse une entrée invalide sans rien écrire', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { error } = await logAudit({ action: 'action.inexistante' } as never);

    expect(error).toBeTruthy();
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });

  it('ignore un `targetId` non-UUID plutôt que d’écrire une ligne bancale', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // ⚠️ Comportement à connaître : `logAudit` est best-effort, donc un id mal formé ne fait pas
    // échouer l'action métier — l'entrée d'audit disparaît simplement. C'est ce qui rend les
    // fixtures de test trompeuses si elles n'utilisent pas de vrais UUID.
    const { error } = await logAudit({
      action: 'food.archive',
      targetTable: 'foods',
      targetId: 'pas-un-uuid',
    });

    expect(error).toBeTruthy();
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });

  it('ne lève JAMAIS, même si l’insertion échoue', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mock.setResponse('audit_log.insert', { error: new Error('rls') });

    // L'action métier ne doit pas casser parce que l'audit a échoué.
    await expect(
      logAudit({ action: 'food.archive', targetTable: 'foods', targetId: USER_ID }),
    ).resolves.toMatchObject({ error: expect.any(Error) });
  });

  it('ne lève pas non plus si la session est inaccessible', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mock.client.auth.getUser.mockRejectedValueOnce(new Error('session corrompue'));

    await expect(
      logAudit({ action: 'food.archive', targetTable: 'foods', targetId: USER_ID }),
    ).resolves.toMatchObject({ error: expect.any(Error) });
  });
});

describe('listAudit', () => {
  it('trie du plus récent au plus ancien et borne à 50 par défaut', async () => {
    await listAudit();

    const query = mock.lastQuery('audit_log', 'select');
    expect(mock.hasFilter(query, 'order', 'created_at', { ascending: false })).toBe(true);
    expect(mock.hasFilter(query, 'limit', 50)).toBe(true);
  });

  it('applique chaque filtre fourni, et eux seuls', async () => {
    await listAudit({
      actorId: USER_ID,
      action: 'food.import',
      from: '2026-08-01',
      to: '2026-08-03',
      before: '2026-08-02',
      limit: 10,
    });

    const filters = mock.lastQuery('audit_log', 'select')?.filters ?? [];
    expect(filters).toContainEqual(['eq', 'actor_id', USER_ID]);
    expect(filters).toContainEqual(['eq', 'action', 'food.import']);
    expect(filters).toContainEqual(['gte', 'created_at', '2026-08-01']);
    expect(filters).toContainEqual(['lte', 'created_at', '2026-08-03']);
    expect(filters).toContainEqual(['lt', 'created_at', '2026-08-02']);
    expect(filters).toContainEqual(['limit', 10]);
  });

  it('n’ajoute aucun filtre quand rien n’est demandé', async () => {
    await listAudit();

    const filters = mock.lastQuery('audit_log', 'select')?.filters ?? [];
    expect(filters.filter((f) => f[0] === 'eq')).toHaveLength(0);
  });

  it('renvoie une liste vide et l’erreur en cas de refus', async () => {
    mock.setResponse('audit_log.select', { error: new Error('rls') });

    expect(await listAudit()).toMatchObject({ rows: [] });
  });
});
