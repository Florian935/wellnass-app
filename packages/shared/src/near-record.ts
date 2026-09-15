/**
 * US DASH-01 — le record « à portée » (MUSC-09 remonté sur le hub muscu).
 *
 * MUSC-09 sait, pour chaque exercice, le record de chaque plage de répétitions. Il manquait la
 * question qui donne envie d'aller à la salle : **de combien je suis loin, aujourd'hui ?** Cette
 * fonction compare la meilleure série récente au record de la même plage et ne garde que ce qui est
 * réellement atteignable — un écart de 30 kg n'est pas une motivation, c'est une information.
 */

export type LiftSet = { weightKg: number; reps: number };

export type NearRecordInput = {
  exerciseId: string;
  /** Meilleure série récente dans la plage du record, ou `null`. */
  recent: LiftSet | null;
  /** Record de la même plage de répétitions, ou `null`. */
  record: LiftSet | null;
};

export type NearRecord = {
  exerciseId: string;
  /** `kg` : même nombre de répétitions, charge à gagner · `reps` : même charge · `beaten` : fait. */
  gapKind: 'kg' | 'reps' | 'beaten';
  gap: number;
  /** Proportion du record déjà atteinte (1 = égalé ou battu). */
  ratio: number;
};

/** Charge : au-delà de 15 % d'écart, le record n'est plus « à portée ». */
export const NEAR_RECORD_MAX_GAP = 0.15;
/** Même charge : au plus 2 répétitions d'écart. */
export const NEAR_RECORD_MAX_REPS = 2;
const QUARTER_KG = 0.25;

export function nearRecords(
  inputs: ReadonlyArray<NearRecordInput>,
  opts: { limit?: number; maxGap?: number } = {},
): NearRecord[] {
  const limit = opts.limit ?? 3;
  const maxGap = opts.maxGap ?? NEAR_RECORD_MAX_GAP;
  const found: NearRecord[] = [];

  for (const { exerciseId, recent, record } of inputs) {
    if (!recent || !record || record.weightKg <= 0 || record.reps <= 0) continue;

    const beaten =
      recent.weightKg > record.weightKg ||
      (recent.weightKg === record.weightKg && recent.reps >= record.reps);
    if (beaten) {
      found.push({ exerciseId, gapKind: 'beaten', gap: 0, ratio: 1 });
      continue;
    }

    if (recent.weightKg === record.weightKg) {
      const ratio = recent.reps / record.reps;
      // En répétitions, le pourcentage trompe : 4 sur 5 fait 20 % d'écart, mais une répétition reste
      // à portée. On compte donc des répétitions, pas un ratio.
      const gap = record.reps - recent.reps;
      if (gap <= NEAR_RECORD_MAX_REPS) found.push({ exerciseId, gapKind: 'reps', gap, ratio });
      continue;
    }

    const ratio = recent.weightKg / record.weightKg;
    if (1 - ratio > maxGap) continue;
    const gap = Math.round((record.weightKg - recent.weightKg) / QUARTER_KG) * QUARTER_KG;
    found.push({ exerciseId, gapKind: 'kg', gap, ratio });
  }

  return found.sort((a, b) => b.ratio - a.ratio).slice(0, limit);
}
