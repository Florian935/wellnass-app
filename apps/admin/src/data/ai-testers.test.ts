/**
 * Back-office — la liste des testeurs de l'IA (US ACCES-IA, spec §14 critères 13 et 14).
 *
 * La sécurité vit côté serveur (fonctions `security definer`, `can_manage_users()`, RLS sans
 * politique) ; on ne la teste pas ici, on ne pourrait pas. Ce qu'on teste, c'est ce que le client fait
 * autour :
 *
 *  - il passe **toujours** par les fonctions SQL, jamais par une écriture directe ni par un `ilike` —
 *    `*`, `_` et `%` sont permis dans un e-mail, et un motif pourrait viser un autre compte ;
 *  - il ne journalise **que ce qui a été écrit** ;
 *  - 🔴 l'entrée d'audit ne contient **l'e-mail nulle part** : `audit_log` est en ajout seul et survit à
 *    la suppression du compte (spec D12).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSupabaseMock } from '../test-utils/supabase-mock';

const mock = createSupabaseMock();

vi.mock('../lib/supabase', () => ({ supabase: mock.client }));

const { addAiTester, addAiTesterByEmail, getAiTester, listAiTesters, readAiAccessMode, removeAiTester } =
  await import('./ai-testers');

const USER_ID = '88888888-8888-4888-8888-888888888888';
const EMAIL = 'Jeanne.Martin@exemple.fr';

const rpc = mock.client.rpc;
const invoke = mock.client.functions.invoke;

/** Les insertions dans le journal d'audit, telles qu'émises. */
const auditRows = () => mock.queriesOn('audit_log', 'insert').flatMap((q) => q.rows ?? []);

beforeEach(() => {
  mock.reset();
  rpc.mockReset();
  rpc.mockResolvedValue({ data: null, error: null });
  invoke.mockReset();
  invoke.mockResolvedValue({ data: null, error: null });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('listAiTesters / getAiTester', () => {
  it('lit la vue protégée, la plus récente d’abord', async () => {
    mock.setResponse('admin_ai_testers.select', { data: [{ user_id: USER_ID }] });

    const { rows, error } = await listAiTesters();

    expect(error).toBeNull();
    expect(rows).toEqual([{ user_id: USER_ID }]);
    expect(mock.hasFilter(mock.lastQuery('admin_ai_testers', 'select'), 'order', 'created_at', { ascending: false })).toBe(true);
    // Jamais la table elle-même : elle est invisible pour la clé anon.
    expect(mock.queriesOn('ai_testers')).toHaveLength(0);
  });

  it('une erreur rend une liste vide, sans lever', async () => {
    mock.setResponse('admin_ai_testers.select', { error: { message: 'boom' } });
    const { rows, error } = await listAiTesters();
    expect(rows).toEqual([]);
    expect(error).toEqual({ message: 'boom' });
  });

  it('la fiche lit la ligne du compte, ou rien', async () => {
    mock.setResponse('admin_ai_testers.select', { data: null });
    const { tester } = await getAiTester(USER_ID);
    expect(tester).toBeNull();
    expect(mock.hasFilter(mock.lastQuery('admin_ai_testers', 'select'), 'eq', 'user_id', USER_ID)).toBe(true);
  });
});

describe('addAiTesterByEmail', () => {
  it('ajouté : passe par la fonction SQL, journalise l’identifiant du compte — et aucun e-mail', async () => {
    rpc.mockResolvedValueOnce({ data: [{ outcome: 'added', target_user_id: USER_ID }], error: null });

    const result = await addAiTesterByEmail(`  ${EMAIL} `);

    expect(result).toEqual({ outcome: 'added', error: null });
    // Espaces retirés côté client ; la casse est ignorée côté serveur, par égalité.
    expect(rpc).toHaveBeenCalledWith('grant_ai_tester_by_email', { target_email: EMAIL });
    expect(mock.queriesOn('ai_testers')).toHaveLength(0);
    expect(mock.queriesOn('admin_users')).toHaveLength(0);

    const [entry] = auditRows();
    expect(entry).toMatchObject({ action: 'ai_tester.grant', target_table: 'auth.users', target_id: USER_ID });
    expect(entry?.target_label).toBeNull();
    // 🔴 Spec D12 — l'e-mail ne doit apparaître nulle part dans l'entrée, sous aucune casse.
    expect(JSON.stringify(entry).toLowerCase()).not.toContain(EMAIL.toLowerCase());
  });

  it('un e-mail à jokers part tel quel à l’égalité serveur, jamais en motif', async () => {
    rpc.mockResolvedValueOnce({ data: [{ outcome: 'not_found', target_user_id: null }], error: null });

    await addAiTesterByEmail('a*b_c%@exemple.fr');

    expect(rpc).toHaveBeenCalledWith('grant_ai_tester_by_email', { target_email: 'a*b_c%@exemple.fr' });
    expect(mock.queries.some((q) => q.filters.some(([method]) => method === 'ilike' || method === 'like'))).toBe(false);
  });

  it.each(['already', 'not_found'] as const)('« %s » : rien n’est journalisé', async (outcome) => {
    rpc.mockResolvedValueOnce({ data: [{ outcome, target_user_id: outcome === 'already' ? USER_ID : null }], error: null });

    const result = await addAiTesterByEmail(EMAIL);

    expect(result).toEqual({ outcome, error: null });
    expect(auditRows()).toHaveLength(0);
  });

  it.each(['', '   '])('saisie vide (« %s ») : rien n’est appelé', async (raw) => {
    const result = await addAiTesterByEmail(raw);
    expect(result).toEqual({ outcome: null, error: null });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('refus du serveur (non autorisé) : l’erreur remonte, rien n’est journalisé', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'non autorisé' } });
    const result = await addAiTesterByEmail(EMAIL);
    expect(result.outcome).toBeNull();
    expect(result.error).toEqual({ message: 'non autorisé' });
    expect(auditRows()).toHaveLength(0);
  });

  it('réponse inattendue : pas d’ajout prétendu, pas d’audit', async () => {
    rpc.mockResolvedValueOnce({ data: [{ outcome: 'bizarre', target_user_id: USER_ID }], error: null });
    const result = await addAiTesterByEmail(EMAIL);
    expect(result.outcome).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(auditRows()).toHaveLength(0);
  });
});

describe('addAiTester (fiche utilisateur)', () => {
  it('ajouté : fonction SQL par identifiant, audit `ai_tester.grant`', async () => {
    rpc.mockResolvedValueOnce({ data: 'added', error: null });

    expect(await addAiTester(USER_ID)).toEqual({ outcome: 'added', error: null });
    expect(rpc).toHaveBeenCalledWith('grant_ai_tester', { target_user_id: USER_ID });
    expect(auditRows()).toEqual([expect.objectContaining({ action: 'ai_tester.grant', target_id: USER_ID })]);
  });

  it('déjà testeur : rien n’est journalisé', async () => {
    rpc.mockResolvedValueOnce({ data: 'already', error: null });
    expect(await addAiTester(USER_ID)).toEqual({ outcome: 'already', error: null });
    expect(auditRows()).toHaveLength(0);
  });

  it('erreur ou réponse inattendue : pas d’audit', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'non autorisé' } });
    expect((await addAiTester(USER_ID)).outcome).toBeNull();
    rpc.mockResolvedValueOnce({ data: 'oui', error: null });
    expect((await addAiTester(USER_ID)).error).toBeInstanceOf(Error);
    expect(auditRows()).toHaveLength(0);
  });
});

describe('removeAiTester', () => {
  it('retiré : fonction SQL, audit `ai_tester.revoke` par identifiant', async () => {
    rpc.mockResolvedValueOnce({ data: 'removed', error: null });

    expect(await removeAiTester(USER_ID)).toEqual({ outcome: 'removed', error: null });
    expect(rpc).toHaveBeenCalledWith('revoke_ai_tester', { target_user_id: USER_ID });
    expect(mock.queriesOn('ai_testers')).toHaveLength(0);
    expect(auditRows()).toEqual([
      expect.objectContaining({ action: 'ai_tester.revoke', target_table: 'auth.users', target_id: USER_ID, target_label: null }),
    ]);
  });

  it('déjà retiré (« absent ») : rien n’est journalisé', async () => {
    rpc.mockResolvedValueOnce({ data: 'absent', error: null });
    expect(await removeAiTester(USER_ID)).toEqual({ outcome: 'absent', error: null });
    expect(auditRows()).toHaveLength(0);
  });

  it('erreur ou réponse inattendue : pas d’audit', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'non autorisé' } });
    expect((await removeAiTester(USER_ID)).outcome).toBeNull();
    rpc.mockResolvedValueOnce({ data: 'non', error: null });
    expect((await removeAiTester(USER_ID)).error).toBeInstanceOf(Error);
    expect(auditRows()).toHaveLength(0);
  });
});

describe('readAiAccessMode — le mode lu dans `status` (spec D5)', () => {
  it('demande le statut à `ai-assist` et rend son `access`', async () => {
    invoke.mockResolvedValueOnce({ data: { available: false, reason: 'closed', access: 'testers' }, error: null });

    expect(await readAiAccessMode()).toBe('testers');
    expect(invoke).toHaveBeenCalledWith('ai-assist', { body: { kind: 'status' } });
  });

  it('`open` est rendu tel quel', async () => {
    invoke.mockResolvedValueOnce({ data: { access: 'open' }, error: null });
    expect(await readAiAccessMode()).toBe('open');
  });

  it('fonction pas encore redéployée (pas de champ `access`) → inconnu', async () => {
    invoke.mockResolvedValueOnce({ data: { available: true }, error: null });
    expect(await readAiAccessMode()).toBeNull();
  });

  it('valeur inconnue, erreur ou exception → inconnu', async () => {
    invoke.mockResolvedValueOnce({ data: { access: 'ouvert' }, error: null });
    expect(await readAiAccessMode()).toBeNull();
    invoke.mockResolvedValueOnce({ data: null, error: { message: 'réseau' } });
    expect(await readAiAccessMode()).toBeNull();
    invoke.mockRejectedValueOnce(new Error('hors ligne'));
    expect(await readAiAccessMode()).toBeNull();
  });
});
