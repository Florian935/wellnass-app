import { describe, expect, it } from 'vitest';

import {
  INSIGHT_FAMILIES,
  INSIGHT_ORDER,
  MAX_INSIGHTS,
  MAX_PER_FAMILY,
  NOTABLE_CHANGE_PCT,
  REAL_LIFE_MUTED_INSIGHTS,
  STALE_AFTER_DAYS,
  isMutedByRealLife,
  isStale,
  selectInsights,
  type InsightCandidate,
  type InsightFamily,
  type InsightId,
} from './insights';
import type { Pillar } from './pillar';

const TODAY = '2026-08-05';
const ALL_PILLARS: Pillar[] = ['strength', 'running', 'nutrition'];

function candidate(
  id: InsightId,
  family: InsightFamily,
  overrides: Partial<InsightCandidate> = {},
): InsightCandidate {
  return {
    id,
    family,
    metrics: { value: 1 },
    occurredOn: null,
    pillars: [],
    ...overrides,
  };
}

describe('constantes', () => {
  it('expose les 3 familles d’ADR-007', () => {
    expect(INSIGHT_FAMILIES).toEqual(['alert', 'change', 'celebration']);
  });

  it('déclare 12 identifiants, tous distincts', () => {
    // 12 depuis INSIGHTS-02 : +readiness, +concurrent_interference, +activity_level.
    expect(INSIGHT_ORDER).toHaveLength(12);
    expect(new Set(INSIGHT_ORDER).size).toBe(12);
  });

  it('place le garde-fou de surcharge en tête — rien ne passe devant le risque de blessure', () => {
    expect(INSIGHT_ORDER[0]).toBe('overtraining_guard');
  });

  it('fixe les plafonds d’ADR-007 §2 et le seuil de variation notable', () => {
    expect(MAX_INSIGHTS).toBe(3);
    expect(MAX_PER_FAMILY).toBe(2);
    expect(STALE_AFTER_DAYS).toBe(14);
    expect(NOTABLE_CHANGE_PCT).toBe(15);
  });
});

describe('isStale', () => {
  it('ne périme jamais un candidat non daté — un état n’a pas d’âge', () => {
    expect(isStale(null, TODAY)).toBe(false);
  });

  it('conserve un fait du jour même', () => {
    expect(isStale(TODAY, TODAY)).toBe(false);
  });

  it('conserve un fait de 14 jours pile — la borne est inclusive', () => {
    expect(isStale('2026-07-22', TODAY)).toBe(false);
  });

  it('écarte un fait de 15 jours', () => {
    expect(isStale('2026-07-21', TODAY)).toBe(true);
  });

  it('ne périme pas une date future', () => {
    expect(isStale('2026-09-01', TODAY)).toBe(false);
  });
});

describe('selectInsights — cas de base', () => {
  it('renvoie [] sans candidat : zéro est une réponse valable', () => {
    expect(selectInsights({ candidates: [], activePillars: ALL_PILLARS, todayKey: TODAY })).toEqual(
      [],
    );
  });

  it('retient un candidat unique et le range au rang 0', () => {
    const result = selectInsights({
      candidates: [candidate('training_load', 'alert')],
      activePillars: ALL_PILLARS,
      todayKey: TODAY,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('training_load');
    expect(result[0]!.rank).toBe(0);
  });

  it('plafonne à 3 cartes même avec 5 candidats de familles variées', () => {
    const result = selectInsights({
      candidates: [
        candidate('overtraining_guard', 'alert'),
        candidate('training_load', 'alert'),
        candidate('record_recent', 'celebration'),
        candidate('goal_achieved', 'celebration'),
        candidate('tonnage_change', 'change'),
      ],
      activePillars: ALL_PILLARS,
      todayKey: TODAY,
    });
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.rank)).toEqual([0, 1, 2]);
  });

  it('classe selon INSIGHT_ORDER, pas selon l’ordre d’entrée', () => {
    const result = selectInsights({
      candidates: [
        candidate('distance_change', 'change'),
        candidate('overtraining_guard', 'alert'),
        candidate('record_recent', 'celebration'),
      ],
      activePillars: ALL_PILLARS,
      todayKey: TODAY,
    });
    expect(result.map((r) => r.id)).toEqual([
      'overtraining_guard',
      'record_recent',
      'distance_change',
    ]);
  });

  it('est strictement déterministe — deux appels identiques donnent le même résultat', () => {
    const candidates = [
      candidate('tonnage_change', 'change'),
      candidate('deficit_volume', 'alert'),
      candidate('goal_achieved', 'celebration'),
    ];
    const first = selectInsights({ candidates, activePillars: ALL_PILLARS, todayKey: TODAY });
    const second = selectInsights({ candidates, activePillars: ALL_PILLARS, todayKey: TODAY });
    expect(first).toEqual(second);
  });
});

describe('selectInsights — quota par famille (R3)', () => {
  it('n’affiche que 2 cartes quand seules 4 alertes sont actives', () => {
    const result = selectInsights({
      candidates: [
        candidate('overtraining_guard', 'alert'),
        candidate('training_load', 'alert'),
        candidate('deficit_volume', 'alert'),
        candidate('tonnage_change', 'alert'),
      ],
      activePillars: ALL_PILLARS,
      todayKey: TODAY,
    });
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(['overtraining_guard', 'training_load']);
  });

  it('complète avec une autre famille plutôt qu’une 3ᵉ alerte', () => {
    const result = selectInsights({
      candidates: [
        candidate('overtraining_guard', 'alert'),
        candidate('training_load', 'alert'),
        candidate('deficit_volume', 'alert'),
        candidate('record_recent', 'celebration'),
      ],
      activePillars: ALL_PILLARS,
      todayKey: TODAY,
    });
    expect(result.map((r) => r.id)).toEqual([
      'overtraining_guard',
      'training_load',
      'record_recent',
    ]);
  });

  it('ne remplit pas artificiellement : une seule famille présente donne 1 carte', () => {
    const result = selectInsights({
      candidates: [candidate('record_recent', 'celebration')],
      activePillars: ALL_PILLARS,
      todayKey: TODAY,
    });
    expect(result).toHaveLength(1);
  });
});

describe('selectInsights — filtrage', () => {
  it('écarte un candidat dont le pilier est inactif (décision H)', () => {
    const result = selectInsights({
      candidates: [candidate('record_recent', 'celebration', { pillars: ['strength'] })],
      activePillars: ['running'],
      todayKey: TODAY,
    });
    expect(result).toEqual([]);
  });

  it('exige que TOUS les piliers requis soient actifs', () => {
    const result = selectInsights({
      candidates: [
        candidate('deficit_volume', 'alert', { pillars: ['strength', 'nutrition'] }),
      ],
      activePillars: ['strength'],
      todayKey: TODAY,
    });
    expect(result).toEqual([]);
  });

  it('retient un candidat sans exigence de pilier', () => {
    const result = selectInsights({
      candidates: [candidate('weekly_decision', 'change', { pillars: [] })],
      activePillars: [],
      todayKey: TODAY,
    });
    expect(result).toHaveLength(1);
  });

  it('écarte un candidat daté périmé', () => {
    const result = selectInsights({
      candidates: [candidate('record_recent', 'celebration', { occurredOn: '2026-06-01' })],
      activePillars: ALL_PILLARS,
      todayKey: TODAY,
    });
    expect(result).toEqual([]);
  });

  it('écarte un candidat sans aucun chiffre — R1 exige des metrics non vides', () => {
    const result = selectInsights({
      candidates: [candidate('training_load', 'alert', { metrics: {} })],
      activePillars: ALL_PILLARS,
      todayKey: TODAY,
    });
    expect(result).toEqual([]);
  });

  it('écarte un candidat portant un NaN plutôt que de l’afficher à 0', () => {
    const result = selectInsights({
      candidates: [candidate('training_load', 'alert', { metrics: { ratio: Number.NaN } })],
      activePillars: ALL_PILLARS,
      todayKey: TODAY,
    });
    expect(result).toEqual([]);
  });

  it('écarte un candidat portant un Infinity', () => {
    const result = selectInsights({
      candidates: [
        candidate('tonnage_change', 'change', { metrics: { pct: Number.POSITIVE_INFINITY } }),
      ],
      activePillars: ALL_PILLARS,
      todayKey: TODAY,
    });
    expect(result).toEqual([]);
  });

  it('écarte un candidat dont l’un des chiffres seulement est invalide', () => {
    const result = selectInsights({
      candidates: [
        candidate('deficit_volume', 'alert', { metrics: { deficitPct: 12, loggedDays: Number.NaN } }),
      ],
      activePillars: ALL_PILLARS,
      todayKey: TODAY,
    });
    expect(result).toEqual([]);
  });

  it('ignore un identifiant inconnu sans jeter', () => {
    const result = selectInsights({
      candidates: [candidate('inconnu' as InsightId, 'alert')],
      activePillars: ALL_PILLARS,
      todayKey: TODAY,
    });
    expect(result).toEqual([]);
  });

  it('conserve les candidats valides quand un invalide est mêlé au lot', () => {
    const result = selectInsights({
      candidates: [
        candidate('overtraining_guard', 'alert', { metrics: {} }),
        candidate('record_recent', 'celebration'),
      ],
      activePillars: ALL_PILLARS,
      todayKey: TODAY,
    });
    expect(result.map((r) => r.id)).toEqual(['record_recent']);
  });
});

describe('selectInsights — conservation de la charge utile', () => {
  it('transmet metrics et subject tels quels', () => {
    const result = selectInsights({
      candidates: [
        candidate('muscle_neglected', 'change', {
          metrics: { share: 7, evenShare: 17 },
          subject: 'back',
        }),
      ],
      activePillars: ALL_PILLARS,
      todayKey: TODAY,
    });
    expect(result[0]!.metrics).toEqual({ share: 7, evenShare: 17 });
    expect(result[0]!.subject).toBe('back');
  });

  it('ne modifie pas le tableau de candidats reçu', () => {
    const candidates = [
      candidate('distance_change', 'change'),
      candidate('overtraining_guard', 'alert'),
    ];
    selectInsights({ candidates, activePillars: ALL_PILLARS, todayKey: TODAY });
    expect(candidates.map((c) => c.id)).toEqual(['distance_change', 'overtraining_guard']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// US VIE-01 — ce qui se tait pendant une période « vie réelle » (R6)
// ─────────────────────────────────────────────────────────────────────────────

describe('mode vie réelle (US VIE-01)', () => {
  /** Ids retenus, période « vie réelle » active ou non. */
  function ids(candidates: InsightCandidate[], inRealLifePeriod: boolean): InsightId[] {
    return selectInsights({
      candidates, activePillars: ALL_PILLARS, todayKey: TODAY, inRealLifePeriod,
    }).map((s) => s.id);
  }

  it('sans période, la sélection est INCHANGÉE (le paramètre est additif)', () => {
    const candidates = [candidate('muscle_neglected', 'change')];
    expect(ids(candidates, false)).toEqual(['muscle_neglected']);
    // Et l'appel sans le paramètre du tout donne le même résultat.
    expect(
      selectInsights({ candidates, activePillars: ALL_PILLARS, todayKey: TODAY }).map((s) => s.id),
    ).toEqual(['muscle_neglected']);
  });

  it('REAL_LIFE_MUTED_INSIGHTS se taisent pendant une période', () => {
    for (const id of REAL_LIFE_MUTED_INSIGHTS) {
      expect(ids([candidate(id, 'alert')], true)).toEqual([]);
    }
  });

  it('les garde-fous de charge restent armés — ce n’est PAS un oubli', () => {
    // IDEAS.md : « ne pas laisser désactiver les garde-fous de sécurité ». Et ils se déclenchent sur
    // l'excès, donc les couper serait dangereux pour qui rattrape trop fort au retour.
    const armed: InsightId[] = [
      'overtraining_guard', 'training_load', 'readiness', 'concurrent_interference',
    ];
    for (const id of armed) {
      expect(ids([candidate(id, 'alert')], true)).toEqual([id]);
    }
  });

  it('les accomplissements restent affichés pendant une période', () => {
    expect(ids([candidate('record_recent', 'celebration')], true)).toEqual(['record_recent']);
    expect(ids([candidate('goal_achieved', 'celebration')], true)).toEqual(['goal_achieved']);
  });

  it('weekly_decision reste armé : sa source est filtrée en amont, pas ici', () => {
    // `decide()` (weekly-review) ne produit plus de reproche pendant une période. Le filtrer une
    // seconde fois ici masquerait aussi les décisions légitimes — dont `goal_behind`, volontairement
    // conservé (VIE-01, D6).
    expect(ids([candidate('weekly_decision', 'change')], true)).toEqual(['weekly_decision']);
  });

  it('une variation À LA BAISSE se tait…', () => {
    expect(ids([candidate('tonnage_change', 'change', { variant: 'down' })], true)).toEqual([]);
    expect(ids([candidate('distance_change', 'change', { variant: 'down' })], true)).toEqual([]);
  });

  it('…mais une variation À LA HAUSSE reste affichée', () => {
    // Une hausse pendant une semaine allégée est une vraie bonne nouvelle.
    expect(ids([candidate('tonnage_change', 'change', { variant: 'up' })], true))
      .toEqual(['tonnage_change']);
    expect(ids([candidate('distance_change', 'change', { variant: 'up' })], true))
      .toEqual(['distance_change']);
  });

  it('le sens est lu dans `variant`, jamais dans `metrics`', () => {
    // ⚠️ `insight-adapters` range `Math.abs(change.pct)` dans `metrics` : filtrer sur le signe d'une
    // métrique n'aurait JAMAIS rien muté. Ce test fige la bonne source.
    const down = candidate('tonnage_change', 'change', {
      variant: 'down', metrics: { pct: 41 }, // positif, alors que la variation est négative
    });
    expect(ids([down], true)).toEqual([]);
  });

  it('isMutedByRealLife est vrai/faux indépendamment de toute période — c’est un prédicat pur', () => {
    expect(isMutedByRealLife(candidate('muscle_neglected', 'change'))).toBe(true);
    expect(isMutedByRealLife(candidate('overtraining_guard', 'alert'))).toBe(false);
    expect(isMutedByRealLife(candidate('tonnage_change', 'change', { variant: 'down' }))).toBe(true);
    expect(isMutedByRealLife(candidate('tonnage_change', 'change', { variant: 'up' }))).toBe(false);
    // Sans `variant`, on ne peut pas conclure à une baisse : on n'invente pas un reproche.
    expect(isMutedByRealLife(candidate('tonnage_change', 'change'))).toBe(false);
  });

  it('un signal muet laisse sa place à un signal moins prioritaire', () => {
    // Le plafond de 3 ne doit pas être « consommé » par un candidat écarté.
    const candidates = [
      candidate('deficit_volume', 'alert'),            // muet en période
      candidate('muscle_neglected', 'change'),         // muet en période
      candidate('record_recent', 'celebration'),
      candidate('weekly_decision', 'change'),
    ];
    expect(ids(candidates, true)).toEqual(['record_recent', 'weekly_decision']);
  });
});
