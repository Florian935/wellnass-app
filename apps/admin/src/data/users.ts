import { supabase } from '../lib/supabase';
import type { Database } from '@wellness/shared';
import { logAudit } from './audit';

/**
 * Couche data des utilisateurs (back-office). Consultation (US 8.8a) : lecture seule via la
 * vue `public.admin_users` (protégée par `can_manage_users()` côté serveur ; clé anon) — aucune
 * écriture, aucun logAudit. Bannissement (US 8.8b) : écriture via RPC `SECURITY DEFINER`
 * (`ban_user`/`unban_user`) + `logAudit` best-effort ; historique lu dans `user_bans`.
 */
export type AdminUserRow = Database['public']['Views']['admin_users']['Row'];

// ⚠️ Toutes les colonnes d'une VUE sont typées `T | null` par `db:types` (Postgres ne prouve pas le
// non-null à travers une vue). Donc `id`, `email`, `created_at`, `active_pillars` (Json | null), etc.
// sont TOUS nullables → les écrans doivent guarder chaque valeur.

export const USERS_PAGE_SIZE = 25;

/** Liste paginée + recherche par e-mail (ilike). Tri par inscription décroissante. */
export async function listUsers(opts?: {
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: AdminUserRow[]; count: number; error: unknown }> {
  const page = opts?.page ?? 0;
  const pageSize = opts?.pageSize ?? USERS_PAGE_SIZE;
  const term = (opts?.search ?? '').trim();

  let query = supabase
    .from('admin_users')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (term) query = query.ilike('email', `%${term}%`);

  const from = page * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, count, error } = await query;
  if (error) return { rows: [], count: 0, error };
  return { rows: data ?? [], count: count ?? 0, error: null };
}

/** Détail d'un compte (par id). `null` si absent ou non visible (vue protégée). */
export async function getUser(
  id: string,
): Promise<{ user: AdminUserRow | null; error: unknown }> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return { user: null, error };
  return { user: data ?? null, error: null };
}

// ─── Bannissement (US 8.8b) ───────────────────────────────────────────────────

/** Une ligne de l'historique de modération (append-only). */
export type UserBanRow = Database['public']['Tables']['user_bans']['Row'];

/**
 * Bannit un compte via la RPC `ban_user` (SECURITY DEFINER : garde-fous habilitation /
 * anti-self / anti-admin / motif côté serveur). `logAudit` best-effort après succès.
 */
export async function banUser(
  targetUserId: string,
  reason: string,
): Promise<{ error: unknown }> {
  const { error } = await supabase.rpc('ban_user', {
    target_user_id: targetUserId,
    reason,
  });
  if (error) return { error };
  await logAudit({
    action: 'user.ban',
    targetTable: 'auth.users',
    targetId: targetUserId,
    details: { reason },
  });
  return { error: null };
}

/** Débannit un compte via la RPC `unban_user` (habilitation côté serveur). */
export async function unbanUser(targetUserId: string): Promise<{ error: unknown }> {
  const { error } = await supabase.rpc('unban_user', { target_user_id: targetUserId });
  if (error) return { error };
  await logAudit({
    action: 'user.unban',
    targetTable: 'auth.users',
    targetId: targetUserId,
  });
  return { error: null };
}

/** Historique de modération d'un compte, du plus récent au plus ancien. */
export async function listUserBans(
  targetUserId: string,
): Promise<{ rows: UserBanRow[]; error: unknown }> {
  const { data, error } = await supabase
    .from('user_bans')
    .select('*')
    .eq('target_user_id', targetUserId)
    .order('created_at', { ascending: false });
  if (error) return { rows: [], error };
  return { rows: data ?? [], error: null };
}
