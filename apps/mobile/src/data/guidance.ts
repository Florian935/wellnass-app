/**
 * Le pont entre le profil stocké et la couche de politique pure (`@wellness/shared/guidance`).
 *
 * US GUID-01. Une seule raison d'exister : que personne n'ait à réécrire à la main
 * `{ regime: profile?.guidanceRegime, strength: ..., cardio: ..., nutrition: ... }` dans chaque
 * écran. C'est exactement le genre de recopie qui finit désynchronisée — le dépôt a déjà connu ça
 * avec `settings?.activePillars ?? [...PILLARS]`, recopié une dizaine de fois dont une version
 * fausse (`weekly-review-repository.ts`), corrigé par `resolveActivePillars`.
 */

import {
  dispositionFor,
  effectiveRegime,
  type DecisionKind,
  type Disposition,
  type GuidanceRegime,
  type GuidanceSource,
  type Pillar,
} from '@wellness/shared';
import { upsertProfile, useProfile, type Profile } from '@/data/repositories/profile-repository';

/** Les colonnes de surcharge, par pilier. `running` ↔ `cardio` : le nom de colonne diffère. */
const OVERRIDE_COLUMN = {
  strength: 'guidanceStrength',
  running: 'guidanceCardio',
  nutrition: 'guidanceNutrition',
} as const satisfies Record<Pillar, keyof Profile>;

/** La forme attendue par la couche pure, extraite d'un profil (éventuellement absent). */
export function guidanceSourceOf(profile: Profile | null | undefined): GuidanceSource {
  return {
    regime: profile?.guidanceRegime ?? null,
    strength: profile?.guidanceStrength ?? null,
    cardio: profile?.guidanceCardio ?? null,
    nutrition: profile?.guidanceNutrition ?? null,
  };
}

/**
 * Le régime appliqué à un pilier, et de quoi en changer.
 *
 * ⚠️ `setRegime` écrit la **surcharge du pilier**, jamais le régime global : changer son guidage
 * depuis l'écran Nutrition ne doit pas modifier en silence celui de la Musculation.
 */
export function useGuidance(pillar: Pillar): {
  source: GuidanceSource;
  regime: GuidanceRegime;
  setRegime: (regime: GuidanceRegime) => void;
  /** Que fait-on de cette décision, sous ce régime ? */
  disposition: (kind: DecisionKind) => Disposition;
} {
  const { profile } = useProfile();
  const source = guidanceSourceOf(profile);
  const regime = effectiveRegime(source, pillar);

  return {
    source,
    regime,
    setRegime: (next) => {
      void upsertProfile({ [OVERRIDE_COLUMN[pillar]]: next });
    },
    disposition: (kind) => dispositionFor(kind, regime),
  };
}
