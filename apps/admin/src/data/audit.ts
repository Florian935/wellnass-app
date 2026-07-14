import { supabase } from '../lib/supabase';
import { auditEntrySchema, type AuditEntryInput, type Database, type Json } from '@wellness/shared';

export type AuditLogRow = Database['public']['Tables']['audit_log']['Row'];

/**
 * Journalise une action admin. BEST-EFFORT : ne lève jamais, ne bloque pas l'action métier.
 * Capte l'acteur depuis la session (clé anon). Un échec (validation/session/réseau/RLS) → warn + { error }.
 */
export async function logAudit(entry: AuditEntryInput): Promise<{ error: unknown }> {
  const parsed = auditEntrySchema.safeParse(entry);
  if (!parsed.success) {
    console.warn('[audit] entrée invalide, non journalisée', parsed.error);
    return { error: parsed.error };
  }
  const { data: userData } = await supabase.auth.getUser();
  const actor = userData?.user;
  const { error } = await supabase.from('audit_log').insert({
    actor_id: actor?.id ?? null,
    actor_email: actor?.email ?? null,
    action: parsed.data.action,
    target_table: parsed.data.targetTable ?? null,
    target_id: parsed.data.targetId ?? null,
    target_label: parsed.data.targetLabel ?? null,
    // `details` est un Record<string, unknown> côté schéma (contrat pur, sans dépendance à
    // Supabase) ; l'appelant garantit un contenu sérialisable en JSON. Cast vers le type
    // généré `Json` (récursif) pour satisfaire l'Insert — pas de perte de garde runtime,
    // la validation Zod a déjà eu lieu au-dessus.
    details: (parsed.data.details ?? {}) as Json,
  });
  if (error) console.warn('[audit] échec insert, action non tracée', error);
  return { error };
}

export type AuditFilters = {
  actorId?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  before?: string;
};

/** Liste paginée (curseur created_at desc). super_admin only (RLS). Tolérant aux erreurs. */
export async function listAudit(
  f: AuditFilters = {},
): Promise<{ rows: AuditLogRow[]; error: unknown }> {
  let q = supabase.from('audit_log').select('*').order('created_at', { ascending: false });
  if (f.actorId) q = q.eq('actor_id', f.actorId);
  if (f.action) q = q.eq('action', f.action);
  if (f.from) q = q.gte('created_at', f.from);
  if (f.to) q = q.lte('created_at', f.to);
  if (f.before) q = q.lt('created_at', f.before);
  q = q.limit(f.limit ?? 50);
  const { data, error } = await q;
  if (error) return { rows: [], error };
  return { rows: data ?? [], error: null };
}
