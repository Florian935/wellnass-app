import { supabase } from '../lib/supabase';
import type { Database } from '@wellness/shared';

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

  const roles = (data ?? []).map((r) => r.role as AdminRole);
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
 * Postgres ne peut pas inférer l'index comme arbitre. On fait donc
 * **update-puis-insert** : si une ligne (active ou révoquée) existe déjà pour
 * `(user_id, role)`, on la réactive ; sinon on insère.
 */
export async function grantRole(
  userId: string,
  role: AdminRole,
): Promise<{ error: unknown }> {
  const existing = await supabase
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', role)
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    return { error: existing.error };
  }

  if (existing.data) {
    const { error } = await supabase
      .from('user_roles')
      .update({ deleted_at: null })
      .eq('id', existing.data.id);
    return { error };
  }

  const { error } = await supabase
    .from('user_roles')
    .insert({ user_id: userId, role });
  return { error };
}

/** Révoque une attribution (soft-delete : `deleted_at = now`). */
export async function revokeRole(id: string): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('user_roles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  return { error };
}
