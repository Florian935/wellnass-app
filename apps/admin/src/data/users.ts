import { supabase } from '../lib/supabase';
import type { Database } from '@wellness/shared';

/**
 * Couche data de la consultation des utilisateurs (US 8.8a). Lecture seule via la
 * vue `public.admin_users` (protégée par `can_manage_users()` côté serveur ; clé anon).
 * Aucune écriture, aucun logAudit (la consultation n'écrit rien).
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
