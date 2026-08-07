import { describe, expect, it } from 'vitest';

import {
  MIN_SESSIONS_FOR_COMPLIANCE,
  computeExecutionCompliance,
  parseTargetReps,
  type CompliancePlannedSet,
} from './execution-compliance';

/** Une série faite, conforme par défaut : 100 kg prescrits, 100 kg réalisés, 10 reps sur cible 10. */
function set(over: Partial<CompliancePlannedSet> = {}): CompliancePlannedSet {
  return {
    plannedWeightKg: 100,
    weightKg: 100,
    reps: 10,
    targetReps: '10',
    done: true,
    ...over,
  };
}

/** N séances identiques — le raccourci pour franchir le seuil sans bruit. */
function sessions(count: number, sets: CompliancePlannedSet[]) {
  return Array.from({ length: count }, () => ({ sets }));
}

const compute = (s: { sets: CompliancePlannedSet[] }[]) => computeExecutionCompliance({ sessions: s });

describe('parseTargetReps — texte libre, échec silencieux (R6)', () => {
  it('lit un entier simple', () => {
    expect(parseTargetReps('10')).toEqual({ min: 10, max: 10 });
  });

  it('lit une fourchette', () => {
    expect(parseTargetReps('8-12')).toEqual({ min: 8, max: 12 });
  });

  it('tolère les espaces autour du tiret', () => {
    expect(parseTargetReps(' 8 - 12 ')).toEqual({ min: 8, max: 12 });
  });

  it('remet une fourchette inversée à l’endroit', () => {
    // « 12-8 » est une faute de saisie, pas une intention. La refuser produirait un faux écart.
    expect(parseTargetReps('12-8')).toEqual({ min: 8, max: 12 });
  });

  it.each(['AMRAP', 'max', '8 à 12', '3x10', '', '   ', 'échec'])(
    'rend null sur « %s » — inexploitable, donc exclu du calcul sans être un écart',
    (raw) => {
      expect(parseTargetReps(raw)).toBeNull();
    },
  );

  it('rend null sur une cible absente', () => {
    expect(parseTargetReps(null)).toBeNull();
  });

  it('rend null sur zéro ou négatif — une cible de 0 rep n’a pas de sens', () => {
    expect(parseTargetReps('0')).toBeNull();
    expect(parseTargetReps('-5')).toBeNull();
  });

  it('rend null sur une fourchette dont une borne est zéro', () => {
    // « 0-5 » passe la forme `a-b` mais pas la validation de borne : le regex ne suffit pas.
    expect(parseTargetReps('0-5')).toBeNull();
    expect(parseTargetReps('5-0')).toBeNull();
  });

  it('rend null sur une borne hors des entiers sûrs', () => {
    expect(parseTargetReps('99999999999999999999')).toBeNull();
    expect(parseTargetReps('8-99999999999999999999')).toBeNull();
  });
});

describe('computeExecutionCompliance — le seuil de données (R3)', () => {
  it('rend null sans aucune séance', () => {
    expect(compute([])).toBeNull();
  });

  it('rend null sous le seuil — une moyenne sur n=1 n’est pas une tendance', () => {
    expect(compute(sessions(MIN_SESSIONS_FOR_COMPLIANCE - 1, [set()]))).toBeNull();
  });

  it('calcule au seuil pile — borne inclusive', () => {
    const out = compute(sessions(MIN_SESSIONS_FOR_COMPLIANCE, [set()]));
    expect(out).not.toBeNull();
    expect(out!.sessionCount).toBe(MIN_SESSIONS_FOR_COMPLIANCE);
  });

  it('expose le seuil, nommé et calibrable', () => {
    expect(MIN_SESSIONS_FOR_COMPLIANCE).toBe(3);
  });
});

describe('computeExecutionCompliance — la charge', () => {
  it('rend 1 quand la prescription est tenue', () => {
    const out = compute(sessions(3, [set()]));
    expect(out!.loadRatio).toBe(1);
    expect(out!.loadSetCount).toBe(3);
  });

  it('rend un ratio > 1 quand elle est dépassée — jamais plafonné', () => {
    // Dépasser est un signal utile (« ton programme est trop facile »), pas une anomalie à écrêter.
    const out = compute(sessions(3, [set({ weightKg: 110 })]));
    expect(out!.loadRatio).toBeCloseTo(1.1, 5);
  });

  it('rend un ratio < 1 quand elle n’est pas tenue', () => {
    const out = compute(sessions(3, [set({ weightKg: 80 })]));
    expect(out!.loadRatio).toBeCloseTo(0.8, 5);
  });

  it('ignore les séries non validées (R5)', () => {
    // Une séance abandonnée relève de l'assiduité, pas de l'exécution.
    const out = compute(sessions(3, [set(), set({ weightKg: 10, done: false })]));
    expect(out!.loadRatio).toBe(1);
    expect(out!.loadSetCount).toBe(3);
  });

  it('rend null si aucune série n’est validée — jamais 0', () => {
    const out = compute(sessions(3, [set({ done: false })]));
    expect(out!.loadRatio).toBeNull();
    expect(out!.loadSetCount).toBe(0);
  });

  it('ignore une série sans charge prescrite, sans perdre les autres', () => {
    const out = compute(sessions(3, [set(), set({ plannedWeightKg: null, weightKg: 60 })]));
    expect(out!.loadRatio).toBe(1);
    expect(out!.loadSetCount).toBe(3);
  });

  it('ignore une série sans charge réalisée', () => {
    const out = compute(sessions(3, [set(), set({ weightKg: null })]));
    expect(out!.loadSetCount).toBe(3);
  });

  it('🔴 ignore le poids du corps — 0/0 donnerait NaN', () => {
    // Précédent réel du dépôt : `bestSegmentTimeFromSamples` a écrit un record « NaN seconde » en
    // base (corrigé le 04/08/2026). Un ratio non fini ne doit jamais sortir d'ici.
    const out = compute(sessions(3, [set({ plannedWeightKg: 0, weightKg: 0 })]));
    expect(out!.loadRatio).toBeNull();
    expect(out!.loadSetCount).toBe(0);
  });

  it('ne rend jamais un ratio non fini, quelles que soient les entrées', () => {
    const out = compute(
      sessions(3, [set({ plannedWeightKg: 0, weightKg: 50 }), set(), set({ plannedWeightKg: -0 })]),
    );
    expect(Number.isFinite(out!.loadRatio!)).toBe(true);
  });

  it('écarte une valeur NaN ou infinie plutôt que de la propager', () => {
    // Le type est `number | null` : `NaN` et `Infinity` sont des `number` valides pour TypeScript,
    // et rien entre SQLite et ici ne les exclut. La garde n'est donc pas décorative.
    const out = compute(
      sessions(3, [
        set(),
        set({ weightKg: Number.NaN }),
        set({ plannedWeightKg: Number.POSITIVE_INFINITY }),
      ]),
    );
    expect(out!.loadRatio).toBe(1);
    expect(out!.loadSetCount).toBe(3);
  });
});

describe('computeExecutionCompliance — les répétitions', () => {
  it('compte conforme une cible entière atteinte', () => {
    const out = compute(sessions(3, [set()]));
    expect(out!.repsRatio).toBe(1);
    expect(out!.repsSetCount).toBe(3);
  });

  it('compte conforme un réalisé DANS la fourchette', () => {
    const out = compute(sessions(3, [set({ targetReps: '8-12', reps: 10 })]));
    expect(out!.repsRatio).toBe(1);
  });

  it('compte un écart sous la fourchette — rapporté à la borne basse', () => {
    const out = compute(sessions(3, [set({ targetReps: '8-12', reps: 6 })]));
    expect(out!.repsRatio).toBeCloseTo(0.75, 5);
  });

  it('compte un dépassement au-dessus de la fourchette — rapporté à la borne haute', () => {
    const out = compute(sessions(3, [set({ targetReps: '8-12', reps: 15 })]));
    expect(out!.repsRatio).toBeCloseTo(1.25, 5);
  });

  it('exclut une cible inexploitable SANS la compter comme un écart (R6)', () => {
    const out = compute(sessions(3, [set(), set({ targetReps: 'AMRAP', reps: 25 })]));
    expect(out!.repsRatio).toBe(1);
    expect(out!.repsSetCount).toBe(3);
  });

  it('ignore une série sans réalisé', () => {
    const out = compute(sessions(3, [set(), set({ reps: null })]));
    expect(out!.repsSetCount).toBe(3);
  });
});

describe('computeExecutionCompliance — les deux dénominateurs sont distincts (R6)', () => {
  it('rend la charge quand TOUTES les cibles de reps sont inexploitables', () => {
    // Le cas réel d'un programme écrit en « AMRAP » : la charge reste parfaitement mesurable.
    const out = compute(sessions(3, [set({ targetReps: 'AMRAP' })]));
    expect(out!.loadRatio).toBe(1);
    expect(out!.repsRatio).toBeNull();
    expect(out!.repsSetCount).toBe(0);
  });

  it('rend les reps quand AUCUNE charge n’est prescrite', () => {
    // Le cas réel d'un programme au poids du corps : les répétitions restent mesurables.
    const out = compute(sessions(3, [set({ plannedWeightKg: null })]));
    expect(out!.loadRatio).toBeNull();
    expect(out!.repsRatio).toBe(1);
  });

  it('rapporte deux comptes différents quand les exploitables diffèrent', () => {
    const out = compute(
      sessions(3, [set(), set({ targetReps: 'AMRAP' }), set({ plannedWeightKg: null })]),
    );
    expect(out!.loadSetCount).toBe(6); // 2 séries × 3 séances
    expect(out!.repsSetCount).toBe(6);
    expect(out!.loadSetCount).not.toBe(9);
  });

  it('rend un résultat même si les deux taux sont nuls — le nombre de séances reste dit', () => {
    // La carte doit pouvoir afficher « 3 séances, rien de mesurable » plutôt que disparaître
    // sans explication : c'est l'écran qui décide de se taire, pas le moteur.
    const out = compute(sessions(3, [set({ plannedWeightKg: null, targetReps: 'AMRAP' })]));
    expect(out).not.toBeNull();
    expect(out!.loadRatio).toBeNull();
    expect(out!.repsRatio).toBeNull();
    expect(out!.sessionCount).toBe(3);
  });
});

describe('computeExecutionCompliance — agrégation', () => {
  it('pondère par série et non par séance', () => {
    // Une séance de 10 séries pèse 10 fois plus qu'une séance d'une série : c'est le taux
    // d'exécution des SÉRIES, pas la moyenne des moyennes de séances.
    const out = compute([
      { sets: [set({ weightKg: 50 })] },
      { sets: Array.from({ length: 9 }, () => set()) },
      { sets: [set()] },
    ]);
    // 10 séries à 1 + 1 série à 0,5 → 10,5 / 11
    expect(out!.loadRatio).toBeCloseTo(10.5 / 11, 5);
    expect(out!.loadSetCount).toBe(11);
  });

  it('compte les séances vides dans sessionCount mais pas dans les taux', () => {
    const out = compute([{ sets: [] }, { sets: [set()] }, { sets: [set()] }]);
    expect(out!.sessionCount).toBe(3);
    expect(out!.loadSetCount).toBe(2);
  });
});
