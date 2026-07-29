/**
 * US ADMIN-01 — décompte des usages d'un contenu éditorial avant archivage (roadmap 8.11).
 *
 * Passe par la fonction SQL `editorial_usage_counts` (`security definer`, admins uniquement) et
 * **pas** par des `count(*)` directs : le back-office est un client authentifié comme un utilisateur
 * normal, donc soumis à la RLS. Un `count(*)` sur `workout_sets` ne verrait que **les séries de
 * l'admin lui-même** et afficherait un décompte faux — plus dangereux que pas de décompte, puisqu'il
 * donnerait confiance.
 *
 * La mise en forme est dans `@wellness/shared` (`summarizeUsage`, testée) : ici, un appel réseau.
 */

import {
  USAGE_UNAVAILABLE,
  summarizeUsage,
  type EditorialKind,
  type UsageSummary,
} from '@wellness/shared';

import { supabase } from '../lib/supabase';

/**
 * Compte les références vivantes à un contenu éditorial.
 *
 * En cas d'échec (réseau, rôle insuffisant), renvoie `USAGE_UNAVAILABLE` — **jamais un zéro** :
 * l'UI doit avertir qu'elle n'a pas pu vérifier, pas rassurer à tort.
 */
export async function fetchUsageSummary(
  kind: EditorialKind,
  id: string,
): Promise<UsageSummary> {
  const { data, error } = await supabase.rpc('editorial_usage_counts', {
    p_kind: kind,
    p_id: id,
  });

  if (error || data == null) return USAGE_UNAVAILABLE;

  return summarizeUsage(kind, data as Record<string, unknown>);
}
