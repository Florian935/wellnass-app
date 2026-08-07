/**
 * Repository des suggestions de substitution d'exercice (US MUSC-F14).
 *
 * Le classement vit dans `@wellness/shared` (`exercise-substitution.ts`, 13 tests) : ici, uniquement
 * la lecture des candidats et l'assemblage.
 *
 * ── Une requête dédiée, et pourquoi ──────────────────────────────────────────────────────────────
 * `useExercises` ne remonte pas `muscles_secondary` (il ne sert qu'à la fiche détaillée). Plutôt que
 * d'alourdir une requête utilisée par tous les écrans de sélection, on en écrit une, bornée au
 * **groupe musculaire de la source** — donc naturellement courte.
 *
 * ⚠️ La jointure de traduction **ne filtre pas `deleted_at`** (même correctif qu'ADMIN-01), mais
 * `exercises` **le filtre bien** : on ne suggère jamais un exercice archivé. La nuance compte —
 * afficher le nom d'un exercice archivé dans un historique est nécessaire, le **proposer** ne l'est
 * pas.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useQuery } from '@powersync/react';
import {
  rankSubstitutions,
  type MuscleGroup,
  type Substitution,
  type SubstitutionSource,
} from '@wellness/shared';

import { parseJsonColumn } from '@wellness/shared';
import { useExerciseVariants } from './exercise-variant-repository';

type CandidateDbRow = {
  id: string;
  muscle_primary: string;
  equipment: string | null;
  muscles_secondary: string | null;
  name: string | null;
};

/**
 * Candidats : même groupe musculaire que la source, **ou** variante déclarée (quel que soit leur
 * groupe — si un humain a lié deux exercices, on ne remet pas cette information en cause).
 *
 * Les exercices archivés sont exclus (`e.deleted_at IS NULL`).
 */
// `export` **uniquement pour les tests** : le hook ci-dessous est le seul consommateur. La requête
// mêle un `json_each` (liste de variantes passée en JSON), un repli de langue et l'exclusion des
// exercices archivés — trois choses qu'un mock ne vérifie pas. Voir §3.3 de strategie-tests.md.
export const SELECT_CANDIDATES = `
  SELECT e.id, e.muscle_primary, e.equipment, e.muscles_secondary,
         COALESCE(tl.name, tfr.name) AS name
  FROM exercises e
  LEFT JOIN exercise_translations tl  ON tl.exercise_id = e.id AND tl.lang = ?
  LEFT JOIN exercise_translations tfr ON tfr.exercise_id = e.id AND tfr.lang = 'fr'
  WHERE e.deleted_at IS NULL
    AND (e.muscle_primary = ? OR e.id IN (SELECT value FROM json_each(?)))
`;

function isMuscleArray(value: unknown): value is MuscleGroup[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/**
 * Suggestions de remplacement pour `source`.
 *
 * Rend une liste **vide** quand rien de pertinent n'existe : l'UI n'affiche alors aucune section,
 * plutôt qu'une section vide ou une suggestion hors sujet.
 */
export function useSubstitutions(
  source: SubstitutionSource | null,
  excludeIds: readonly string[] = [],
): { substitutions: Substitution[]; isLoading: boolean } {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';

  const { variants, isLoading: variantsLoading } = useExerciseVariants(source?.id ?? '');
  const declaredVariantIds = useMemo(() => variants.map((v) => v.otherId), [variants]);

  const { data, isLoading: candidatesLoading } = useQuery<CandidateDbRow>(SELECT_CANDIDATES, [
    lang,
    source?.muscle ?? '',
    JSON.stringify(declaredVariantIds),
  ]);

  // `excludeIds` est un tableau recréé à chaque rendu par l'appelant. On dépend de son **contenu**
  // sérialisé plutôt que de sa référence, sinon le classement repartirait à chaque rendu. La clé est
  // calculée ici, hors du `useMemo` : le React Compiler n'accepte que des expressions simples dans
  // une liste de dépendances.
  const excludeKey = excludeIds.join(',');

  const substitutions = useMemo(() => {
    if (source === null) return [];
    const candidates = data
      // Un exercice sans traduction n'est pas affichable : on ne propose pas une ligne vide.
      .filter((row): row is CandidateDbRow & { name: string } => row.name !== null)
      .map((row) => ({
        id: row.id,
        name: row.name,
        muscle: row.muscle_primary as MuscleGroup,
        equipment: row.equipment,
        musclesSecondary: parseJsonColumn<MuscleGroup[]>(row.muscles_secondary, [], isMuscleArray),
      }));

    return rankSubstitutions({ source, candidates, declaredVariantIds, excludeIds });
    // `excludeIds` est volontairement absent : c'est `excludeKey` qui porte son contenu (voir plus haut).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, data, declaredVariantIds, excludeKey]);

  return { substitutions, isLoading: variantsLoading || candidatesLoading };
}
