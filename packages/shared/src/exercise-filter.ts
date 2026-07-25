import type { Equipment, MuscleGroup } from './exercise';

/**
 * Construit la clause SQL (paramétrée) et les params correspondants pour filtrer
 * `exercises` par groupe musculaire et/ou matériel. OU au sein d'une facette
 * (IN), ET entre facettes (clauses concaténées). Tableau vide ou absent =
 * facette non contraignante.
 */
export function buildExerciseFilterClause(
  muscles?: readonly MuscleGroup[],
  equipment?: readonly Equipment[],
): { clause: string; params: string[] } {
  const parts: string[] = [];
  const params: string[] = [];

  if (muscles && muscles.length > 0) {
    parts.push(`e.muscle_primary IN (${muscles.map(() => '?').join(',')})`);
    params.push(...muscles);
  }
  if (equipment && equipment.length > 0) {
    parts.push(`e.equipment IN (${equipment.map(() => '?').join(',')})`);
    params.push(...equipment);
  }

  if (parts.length === 0) return { clause: '', params: [] };
  return { clause: `AND ${parts.join(' AND ')}`, params };
}
