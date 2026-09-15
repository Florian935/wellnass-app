/**
 * US DASH-01 — le bilan de la semaine raconté en cartes (BILAN-01 sur l'accueil).
 *
 * `computeWeeklyReview` produit déjà tout ce qu'il faut ; il manquait une **mise en récit** : un ordre
 * (le chiffre → le record → la régularité → l'assiette → la suite) et la règle qui retire une carte
 * quand elle n'a rien à dire. Chaque carte ne porte que des nombres : la mise en forme et la langue
 * appartiennent à l'UI.
 */

import type { PercentChange } from './comparison';
import type { ReviewDecision, WeeklyReview } from './weekly-review';

export type StoryCard =
  | {
      kind: 'volume';
      workouts: number;
      runs: number;
      tonnageKg: number;
      distanceM: number;
      /** Évolution du tonnage si la muscu a tourné, sinon de la distance. */
      change: PercentChange | null;
    }
  | { kind: 'records'; count: number }
  | { kind: 'regularity'; activeDays: number; change: PercentChange | null }
  | { kind: 'nutrition'; daysInTarget: number; loggedDays: number }
  | { kind: 'decision'; decision: ReviewDecision };

export function buildWeeklyStory(review: WeeklyReview): StoryCard[] {
  if (review.isEmpty) return [];
  const { current, changes } = review;
  const cards: StoryCard[] = [];

  if (current.workouts + current.runs > 0) {
    cards.push({
      kind: 'volume',
      workouts: current.workouts,
      runs: current.runs,
      tonnageKg: current.tonnageKg,
      distanceM: current.distanceM,
      change: current.workouts > 0 ? changes.tonnage : changes.distance,
    });
  }

  if (review.recordsBeaten > 0) cards.push({ kind: 'records', count: review.recordsBeaten });

  if (current.activeDays > 0) {
    cards.push({ kind: 'regularity', activeDays: current.activeDays, change: changes.activeDays });
  }

  if (current.loggedDays > 0 && current.daysInTarget !== null) {
    cards.push({ kind: 'nutrition', daysInTarget: current.daysInTarget, loggedDays: current.loggedDays });
  }

  if (review.decision !== null) cards.push({ kind: 'decision', decision: review.decision });

  return cards;
}
