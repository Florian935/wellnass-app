/**
 * Spike 3D — l'état qui traverse le pont du composant DOM.
 *
 * ⚠️ **Code de spike, fait pour être supprimé.** Voir
 * [spike-3d-corps.md](../../../../../docs/specs/technical/spike-3d-corps.md).
 *
 * Tout passe par la frontière d'un composant DOM (WebView) : l'état doit donc être **sérialisable**
 * — des nombres, des chaînes, des tableaux, rien d'autre. Une fonction ou un `undefined` la
 * traverse **sans erreur et sans valeur**, et la scène affiche alors un corps muet qu'on ne peut
 * pas diagnostiquer. Les fonctions de ce fichier sont pures et testées : le moteur ne décide de
 * rien, il reçoit.
 */

/** Les 7 proportions de [CORPS-02](../../../../../docs/specs/functional/us/corps02-morphologie.md), dans `[-2, +2]`. */
export const BODY_SPIKE_PROPORTIONS = [
  'shoulders',
  'chest',
  'waist',
  'hips',
  'arms',
  'thighs',
  'calves',
] as const;

/** Les 7 intentions de CORPS-02, dans `[0, 4]`. */
export const BODY_SPIKE_GOALS = [
  'shoulders',
  'chest',
  'back',
  'arms',
  'glutes',
  'thighs',
  'calves',
] as const;

export type BodySpikeProportion = (typeof BODY_SPIKE_PROPORTIONS)[number];
export type BodySpikeGoal = (typeof BODY_SPIKE_GOALS)[number];

/** Maillage unique portant les 14 morphs, ou découpe en trois maillages de ≤ 8. */
export type BodySpikeVariant = 'single' | 'split';

export type BodySpikeInput = {
  variant: BodySpikeVariant;
  reducedMotion: boolean;
  proportions: Partial<Record<BodySpikeProportion, number>>;
  goals: Partial<Record<BodySpikeGoal, number>>;
};

export type BodySpikeInfluence = {
  /** Nom exact de la cible de morph dans le `.glb`. */
  name: string;
  /** Influence normalisée : `[-1, 1]` pour une proportion, `[0, 1]` pour une intention. */
  value: number;
};

export type BodySpikeState = {
  variant: BodySpikeVariant;
  reducedMotion: boolean;
  influences: BodySpikeInfluence[];
  /** Combien d'influences l'utilisateur demande réellement (non nulles). */
  requested: number;
};

export function neutralSpikeInput(): BodySpikeInput {
  return { variant: 'single', reducedMotion: false, proportions: {}, goals: {} };
}

const borner = (valeur: number, min: number, max: number) =>
  Math.max(min, Math.min(max, valeur));

/**
 * Traduit les 14 paramètres applicatifs en influences de morph.
 *
 * 🔴 **Décision structurante : une proportion signée = UNE cible de morph, avec une influence
 * négative** — et non deux cibles opposées. three applique les influences négatives sans réserve,
 * et le choix inverse ferait passer les proportions de 7 à 14 cibles, donc le total de 14 à 21.
 * Or le plafond que ce spike mesure est à **8 influences simultanées par maillage** : doubler les
 * cibles ne ferait qu'atteindre le mur plus vite, pour une déformation strictement équivalente.
 * Le prix à payer est côté modèle : la cible doit être sculptée de façon à rester crédible dans
 * les deux sens, ce qu'une paire de cibles distinctes aurait permis d'éviter.
 *
 * ⚠️ Les valeurs hors plage sont **bornées ici**, jamais transmises telles quelles. Le moteur ne
 * valide rien : une influence de 4,5 traverserait le pont et déformerait le corps sans erreur.
 */
export function bodySpikeState(input: BodySpikeInput): BodySpikeState {
  const influences: BodySpikeInfluence[] = [
    ...BODY_SPIKE_PROPORTIONS.map((zone) => ({
      name: `prop_${zone}`,
      value: borner(input.proportions[zone] ?? 0, -2, 2) / 2,
    })),
    ...BODY_SPIKE_GOALS.map((zone) => ({
      name: `goal_${zone}`,
      value: borner(input.goals[zone] ?? 0, 0, 4) / 4,
    })),
  ];

  return {
    variant: input.variant,
    reducedMotion: input.reducedMotion,
    influences,
    requested: influences.filter((influence) => influence.value !== 0).length,
  };
}
