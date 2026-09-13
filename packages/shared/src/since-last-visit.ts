/**
 * US DASH-01 — « Depuis ta dernière visite » (spec §4.5).
 *
 * Un instantané **local** est pris à chaque visite de l'accueil ; à la suivante, on ne montre que ce
 * qui a réellement bougé. Aucun « 0 » affiché : une ligne qui ne dit rien n'a pas sa place (ADR-007).
 *
 * ── Pourquoi l'instantané n'est pas remplacé à chaque visite ─────────────────────────────────────
 * Si on le remplaçait à chaque ouverture, revenir deux minutes plus tard effacerait les écarts qu'on
 * venait de lire. Il n'est donc remplacé qu'au-delà de `SNAPSHOT_MIN_AGE_HOURS` : les écarts du matin
 * restent visibles toute la matinée.
 */

export type VisitSnapshot = {
  /** Horodatage ISO de la prise d'instantané. */
  takenAt: string;
  weightKg: number | null;
  /** Nombre total de records détenus (muscu + course) à cet instant. */
  recordsCount: number;
  /** Meilleure prédiction 10 km en secondes, ou `null`. */
  prediction10kSeconds: number | null;
};

export type SinceLastVisitItem =
  | { kind: 'weight'; deltaKg: number }
  | { kind: 'records'; count: number }
  | { kind: 'prediction10k'; deltaSeconds: number };

export const SNAPSHOT_MIN_AGE_HOURS = 6;
/** En dessous, un écart de poids est du bruit de balance. */
const WEIGHT_NOISE_KG = 0.1;

export function computeSinceLastVisit(
  prev: VisitSnapshot | null,
  now: VisitSnapshot,
): SinceLastVisitItem[] {
  if (prev === null) return [];
  const items: SinceLastVisitItem[] = [];

  if (prev.weightKg !== null && now.weightKg !== null) {
    const delta = Math.round((now.weightKg - prev.weightKg) * 10) / 10;
    if (Math.abs(delta) >= WEIGHT_NOISE_KG) items.push({ kind: 'weight', deltaKg: delta });
  }

  const newRecords = now.recordsCount - prev.recordsCount;
  if (newRecords > 0) items.push({ kind: 'records', count: newRecords });

  if (prev.prediction10kSeconds !== null && now.prediction10kSeconds !== null) {
    const delta = Math.round(now.prediction10kSeconds - prev.prediction10kSeconds);
    if (delta !== 0) items.push({ kind: 'prediction10k', deltaSeconds: delta });
  }

  return items;
}

export function shouldReplaceSnapshot(prev: VisitSnapshot | null, nowIso: string): boolean {
  if (prev === null) return true;
  const taken = Date.parse(prev.takenAt);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(taken) || !Number.isFinite(now)) return true;
  return now - taken >= SNAPSHOT_MIN_AGE_HOURS * 3_600_000;
}
