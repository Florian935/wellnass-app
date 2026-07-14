import { supabase } from '../lib/supabase';
import type { Database } from '@wellness/shared';
import { logAudit } from './audit';

/**
 * Couche data des rôles d'administration (US 8.9). Requêtes Supabase via
 * `supabase-js` (clé anon ; la RLS est la frontière). La table `user_roles`
 * est web/admin uniquement (hors PowerSync).
 */

/** Rôles d'administration (miroir du `check` SQL sur `user_roles.role`). */
export type AdminRole = 'super_admin' | 'content_editor' | 'moderator';

/** Liste ordonnée des rôles attribuables (pour le select du formulaire). */
export const ADMIN_ROLES: readonly AdminRole[] = [
  'super_admin',
  'content_editor',
  'moderator',
];

/** Une attribution de rôle telle que renvoyée par `listRoles()`. */
export type UserRoleRow = Database['public']['Tables']['user_roles']['Row'];

/**
 * Rôles actifs de l'utilisateur courant. Tolérant aux erreurs (table absente
 * avant l'apply cloud, réseau…) : renvoie `{ roles: [], error }` sans lever —
 * le gate traitera l'erreur comme « non-admin ».
 */
export async function fetchMyRoles(
  userId: string,
): Promise<{ roles: AdminRole[]; error: unknown }> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (error) {
    return { roles: [], error };
  }

  // Garde runtime : on ne garde que les rôles connus (un rôle ajouté au niveau
  // SQL avant la mise à jour du type ne « passe » pas silencieusement).
  const known = new Set<string>(ADMIN_ROLES);
  const roles = (data ?? [])
    .map((r) => r.role)
    .filter((role): role is AdminRole => known.has(role));
  return { roles, error: null };
}

/**
 * Toutes les attributions actives (le super_admin voit tout via RLS ; un
 * non-super_admin ne verrait que les siennes, mais l'écran est réservé au
 * super_admin).
 */
export async function listRoles(): Promise<{
  rows: UserRoleRow[];
  error: unknown;
}> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    return { rows: [], error };
  }
  return { rows: data ?? [], error: null };
}

/**
 * Attribue un rôle à un utilisateur (par `user_id`). Ré-active un rôle
 * soft-deleted le cas échéant.
 *
 * On n'utilise PAS `.upsert({ onConflict: 'user_id,role' })` : l'unicité repose
 * sur un **index partiel** (`WHERE deleted_at IS NULL`), or supabase-js ne
 * transmet que les colonnes du `onConflict` — pas le prédicat partiel — donc
 * Postgres ne peut pas inférer l'index comme arbitre.
 *
 * Trois cas, dans l'ordre : (1) une attribution **active** existe déjà →
 * `alreadyActive` (rien à écrire) ; (2) une attribution **révoquée** existe →
 * on la **réactive** (`deleted_at = null`) ; (3) sinon on **insère**.
 */
export async function grantRole(
  userId: string,
  role: AdminRole,
): Promise<{ error: unknown; alreadyActive?: boolean; id?: string }> {
  // (1) Déjà attribuée et active ? → rien à faire (pas de log : rien n'est écrit).
  const active = await supabase
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', role)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (active.error) return { error: active.error };
  if (active.data) return { error: null, alreadyActive: true };

  // (2) Attribution révoquée à réactiver ?
  const revoked = await supabase
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', role)
    .not('deleted_at', 'is', null)
    .limit(1)
    .maybeSingle();

  if (revoked.error) return { error: revoked.error };
  if (revoked.data) {
    const { error } = await supabase
      .from('user_roles')
      .update({ deleted_at: null })
      .eq('id', revoked.data.id);
    if (error) return { error };

    await logAudit({
      action: 'role.grant',
      targetTable: 'user_roles',
      targetId: revoked.data.id,
      targetLabel: `${role} → ${userId}`,
      details: { role, targetUserId: userId },
    });
    return { error: null, id: revoked.data.id };
  }

  // (3) Nouvelle attribution.
  // `.single()` est sûr : l'insert est réservé au super_admin (RLS user_roles_insert), qui peut
  // toujours relire la ligne qu'il vient de créer (user_roles_select) — la lecture RETURNING ne
  // renverra jamais 0 ligne ici. Ne pas transformer en `.maybeSingle()` sans revoir ces policies.
  const { data, error } = await supabase
    .from('user_roles')
    .insert({ user_id: userId, role })
    .select('id')
    .single();
  if (error) return { error };

  const grantedId = data?.id ?? null;
  await logAudit({
    action: 'role.grant',
    targetTable: 'user_roles',
    targetId: grantedId,
    targetLabel: `${role} → ${userId}`,
    details: { role, targetUserId: userId },
  });
  return { error: null, id: data?.id };
}

/** Révoque une attribution (soft-delete : `deleted_at = now`). */
export async function revokeRole(
  id: string,
  opts?: { role?: AdminRole; userId?: string },
): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('user_roles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { error };

  await logAudit({
    action: 'role.revoke',
    targetTable: 'user_roles',
    targetId: id,
    targetLabel: opts?.role && opts?.userId ? `${opts.role} → ${opts.userId}` : null,
    details: opts ? { role: opts.role, targetUserId: opts.userId } : {},
  });
  return { error: null };
}
