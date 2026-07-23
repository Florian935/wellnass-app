/**
 * Repository de la demande de suppression de compte (US CONF-02).
 *
 * `account_deletion_requests` est **hors PowerSync** : accès direct au client
 * Supabase (réseau), pas de base locale ni d'offline-first ici. La RLS
 * (`user_id = auth.uid()`) restreint déjà la lecture/écriture à l'utilisateur
 * courant ; pas de filtre `user_id` explicite nécessaire côté requête.
 */

import { supabase } from '@/lib/supabase';

/** Demande de suppression pending de l'utilisateur courant, ou null. Lecture réseau (RLS user_id=auth.uid()). */
export async function fetchPendingDeletion(): Promise<{ scheduledAt: string } | null> {
  const { data, error } = await supabase
    .from('account_deletion_requests')
    .select('scheduled_at')
    .eq('status', 'pending')
    .maybeSingle();
  if (error) throw error;
  return data ? { scheduledAt: data.scheduled_at } : null;
}

/** Programme la suppression du compte → renvoie la date d'échéance (ISO). */
export async function requestAccountDeletion(): Promise<string> {
  const { data, error } = await supabase.rpc('request_account_deletion');
  if (error) throw error;
  return data as string;
}

/** Annule la suppression pending (no-op côté serveur si échue/inexistante). */
export async function cancelAccountDeletion(): Promise<void> {
  const { error } = await supabase.rpc('cancel_account_deletion');
  if (error) throw error;
}
