import { supabase } from '../lib/supabase';
import { AI_ACCESS_MODES, type AiAccessMode, type Database } from '@wellness/shared';
import { logAudit } from './audit';

/**
 * Couche data des testeurs de l'IA (US ACCES-IA). Réf. : docs/specs/functional/us/acces-ia-testeurs.md.
 *
 * - **Lecture** par la vue `admin_ai_testers` (protégée par `can_manage_users()` côté serveur).
 * - **Écriture** par trois fonctions SQL `security definer` — jamais d'écriture directe : la table est
 *   invisible pour la clé anon, `added_by` est posé par le serveur, et l'e-mail se compare **par
 *   égalité** côté serveur (un `ilike` lirait `*`, `_` et `%` comme des jokers et pourrait viser un
 *   autre compte).
 * - **Journal d'audit** best-effort, et seulement quand quelque chose a été écrit. 🔴 La cible est
 *   l'**identifiant** du compte, **jamais son e-mail** : `audit_log` est en ajout seul et survit à la
 *   suppression du compte — un e-mail y resterait à vie (spec D12).
 */

export type AiTesterRow = Database['public']['Views']['admin_ai_testers']['Row'];

/** Issue d'un ajout : `null` quand rien n'a été tenté (saisie vide). */
export type AddAiTesterOutcome = 'added' | 'already' | 'not_found';

export type RemoveAiTesterOutcome = 'removed' | 'absent';

/** Testeurs actifs, du plus récent au plus ancien. Tolérant aux erreurs. */
export async function listAiTesters(): Promise<{ rows: AiTesterRow[]; error: unknown }> {
  const { data, error } = await supabase
    .from('admin_ai_testers')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return { rows: [], error };
  return { rows: data ?? [], error: null };
}

/** La ligne de testeur actif d'un compte, ou `null` (fiche utilisateur). */
export async function getAiTester(
  userId: string,
): Promise<{ tester: AiTesterRow | null; error: unknown }> {
  const { data, error } = await supabase
    .from('admin_ai_testers')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { tester: null, error };
  return { tester: data ?? null, error: null };
}

/** Journalise un ajout ou un retrait — identifiant du compte seul (spec D12). */
async function auditTester(action: 'ai_tester.grant' | 'ai_tester.revoke', userId: string) {
  await logAudit({ action, targetTable: 'auth.users', targetId: userId });
}

/**
 * Ajoute aux testeurs le compte de cet e-mail (écran « Testeurs IA »). Casse et espaces ignorés ;
 * une saisie vide n'appelle rien.
 */
export async function addAiTesterByEmail(
  email: string,
): Promise<{ outcome: AddAiTesterOutcome | null; error: unknown }> {
  const wanted = email.trim();
  if (wanted.length === 0) return { outcome: null, error: null };

  const { data, error } = await supabase.rpc('grant_ai_tester_by_email', { target_email: wanted });
  if (error) return { outcome: null, error };

  const row = Array.isArray(data) ? data[0] : undefined;
  const outcome = row?.outcome;
  if (outcome === 'not_found' || outcome === 'already') return { outcome, error: null };
  if (outcome === 'added' && row?.target_user_id) {
    await auditTester('ai_tester.grant', row.target_user_id);
    return { outcome, error: null };
  }
  // Une réponse que le serveur n'est pas censé rendre : on ne prétend pas que l'ajout a eu lieu.
  return { outcome: null, error: new Error(`grant_ai_tester_by_email : réponse inattendue (${String(outcome)})`) };
}

/** Ajoute un compte aux testeurs par son identifiant (fiche utilisateur). */
export async function addAiTester(
  userId: string,
): Promise<{ outcome: Exclude<AddAiTesterOutcome, 'not_found'> | null; error: unknown }> {
  const { data, error } = await supabase.rpc('grant_ai_tester', { target_user_id: userId });
  if (error) return { outcome: null, error };
  if (data === 'already') return { outcome: data, error: null };
  if (data === 'added') {
    await auditTester('ai_tester.grant', userId);
    return { outcome: data, error: null };
  }
  return { outcome: null, error: new Error(`grant_ai_tester : réponse inattendue (${String(data)})`) };
}

/** Retire un compte des testeurs (soft delete côté serveur). Son accord n'est pas touché. */
export async function removeAiTester(
  userId: string,
): Promise<{ outcome: RemoveAiTesterOutcome | null; error: unknown }> {
  const { data, error } = await supabase.rpc('revoke_ai_tester', { target_user_id: userId });
  if (error) return { outcome: null, error };
  if (data === 'absent') return { outcome: data, error: null };
  if (data === 'removed') {
    await auditTester('ai_tester.revoke', userId);
    return { outcome: data, error: null };
  }
  return { outcome: null, error: new Error(`revoke_ai_tester : réponse inattendue (${String(data)})`) };
}

/**
 * Le mode réellement en service (`AI_ACCESS`), lu dans la réponse de `status` de la fonction
 * `ai-assist` pour le compte de l'administrateur (spec D5). `null` si la fonction ne répond pas ou n'est
 * pas encore redéployée (pas de champ `access`) — l'écran dit alors « mode inconnu ».
 */
export async function readAiAccessMode(): Promise<AiAccessMode | null> {
  try {
    const { data, error } = await supabase.functions.invoke<{ access?: unknown }>('ai-assist', {
      body: { kind: 'status' },
    });
    if (error) return null;
    const access = data?.access;
    return (AI_ACCESS_MODES as readonly unknown[]).includes(access) ? (access as AiAccessMode) : null;
  } catch {
    return null;
  }
}
