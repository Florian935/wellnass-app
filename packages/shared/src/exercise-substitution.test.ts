import { describe, expect, it } from 'vitest';

import {
  MAX_SUBSTITUTIONS,
  rankSubstitutions,
  type SubstitutionCandidate,
} from './exercise-substitution';

const bench: SubstitutionCandidate = {
  id: 'bench',
  name: 'Développé couché',
  muscle: 'chest',
  equipment: 'barbell',
  musclesSecondary: ['shoulders', 'arms'],
};

const candidates: SubstitutionCandidate[] = [
  { id: 'db-press', name: 'Développé haltères', muscle: 'chest', equipment: 'dumbbell', musclesSecondary: ['shoulders', 'arms'] },
  { id: 'machine-press', name: 'Développé machine', muscle: 'chest', equipment: 'machine' },
  { id: 'bench-2', name: 'Développé couché prise serrée', muscle: 'chest', equipment: 'barbell' },
  { id: 'squat', name: 'Squat', muscle: 'legs', equipment: 'barbell' },
  { id: 'row', name: 'Rowing barre', muscle: 'back', equipment: 'barbell' },
];

describe('sélection des candidats', () => {
  it('ne propose que des exercices du MÊME groupe musculaire', () => {
    const result = rankSubstitutions({ source: bench, candidates });
    const muscles = new Set(result.map((r) => r.muscle));
    expect(muscles).toEqual(new Set(['chest']));
    expect(result.map((r) => r.id)).not.toContain('squat');
    expect(result.map((r) => r.id)).not.toContain('row');
  });

  it('n’inclut JAMAIS l’exercice lui-même', () => {
    const result = rankSubstitutions({ source: bench, candidates: [...candidates, bench] });
    expect(result.map((r) => r.id)).not.toContain('bench');
  });

  it('exclut ce qui est déjà dans la séance — le proposer n’aurait aucun sens', () => {
    const result = rankSubstitutions({
      source: bench,
      candidates,
      excludeIds: ['db-press', 'machine-press'],
    });
    expect(result.map((r) => r.id)).toEqual(['bench-2']);
  });

  it('borne le nombre de suggestions', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      id: `x${i}`,
      name: `Exercice ${i}`,
      muscle: 'chest' as const,
      equipment: 'machine',
    }));
    expect(rankSubstitutions({ source: bench, candidates: many })).toHaveLength(MAX_SUBSTITUTIONS);
    expect(rankSubstitutions({ source: bench, candidates: many, limit: 2 })).toHaveLength(2);
  });

  it('rend une liste vide plutôt que de forcer une suggestion hors sujet', () => {
    // Aucun exercice du même groupe : on n'affichera pas de section, on ne bricole pas.
    const result = rankSubstitutions({
      source: bench,
      candidates: [{ id: 'squat', name: 'Squat', muscle: 'legs', equipment: 'barbell' }],
    });
    expect(result).toEqual([]);
  });
});

describe('priorité des variantes déclarées', () => {
  it('place une variante déclarée AVANT toute suggestion calculée', () => {
    // Une variante déclarée est une donnée saisie par un humain : elle prime sur un score.
    const result = rankSubstitutions({
      source: bench,
      candidates,
      declaredVariantIds: ['bench-2'],
    });
    expect(result[0]!.id).toBe('bench-2');
    expect(result[0]!.isDeclaredVariant).toBe(true);
  });

  it('retient une variante déclarée MÊME si son groupe musculaire diffère', () => {
    // Si un humain a lié les deux exercices, on ne remet pas cette information en cause.
    const result = rankSubstitutions({
      source: bench,
      candidates,
      declaredVariantIds: ['row'],
    });
    expect(result.map((r) => r.id)).toContain('row');
    expect(result.find((r) => r.id === 'row')!.isDeclaredVariant).toBe(true);
  });

  it('marque les autres comme NON déclarées', () => {
    const result = rankSubstitutions({ source: bench, candidates });
    expect(result.every((r) => r.isDeclaredVariant === false)).toBe(true);
  });
});

describe('classement calculé', () => {
  it('favorise un matériel DIFFÉRENT — c’est le cas « machine occupée »', () => {
    const result = rankSubstitutions({ source: bench, candidates });
    // `bench-2` est aussi en barbell : il passe derrière ceux qui changent de matériel.
    const barbellIndex = result.findIndex((r) => r.id === 'bench-2');
    const dumbbellIndex = result.findIndex((r) => r.id === 'db-press');
    expect(dumbbellIndex).toBeLessThan(barbellIndex);
  });

  it('signale le changement de matériel, pour que l’UI puisse l’expliquer', () => {
    const result = rankSubstitutions({ source: bench, candidates });
    expect(result.find((r) => r.id === 'db-press')!.differentEquipment).toBe(true);
    expect(result.find((r) => r.id === 'bench-2')!.differentEquipment).toBe(false);
  });

  it('départage par muscles secondaires communs à matériel équivalent', () => {
    const a: SubstitutionCandidate = { id: 'a', name: 'A', muscle: 'chest', equipment: 'machine', musclesSecondary: ['shoulders', 'arms'] };
    const b: SubstitutionCandidate = { id: 'b', name: 'B', muscle: 'chest', equipment: 'machine', musclesSecondary: [] };
    const result = rankSubstitutions({ source: bench, candidates: [b, a] });
    expect(result[0]!.id).toBe('a');
  });

  it('traite l’absence de muscles secondaires sans planter', () => {
    const result = rankSubstitutions({
      source: { ...bench, musclesSecondary: undefined },
      candidates: [{ id: 'x', name: 'X', muscle: 'chest', equipment: 'machine' }],
    });
    expect(result).toHaveLength(1);
    expect(Number.isFinite(result[0]!.score)).toBe(true);
  });
});

describe('déterminisme', () => {
  it('classe par ordre alphabétique à score égal — deux appels donnent le même ordre', () => {
    // Sans ce départage, l'ordre dépendrait de celui des candidats en entrée : un même résultat
    // pourrait s'afficher différemment d'un affichage à l'autre, ce qui se lit comme un bug.
    const equal: SubstitutionCandidate[] = [
      { id: 'z', name: 'Zéphyr', muscle: 'chest', equipment: 'machine' },
      { id: 'a', name: 'Alpha', muscle: 'chest', equipment: 'machine' },
      { id: 'm', name: 'Momentum', muscle: 'chest', equipment: 'machine' },
    ];
    const first = rankSubstitutions({ source: bench, candidates: equal }).map((r) => r.name);
    const shuffled = rankSubstitutions({ source: bench, candidates: [...equal].reverse() }).map(
      (r) => r.name,
    );
    expect(first).toEqual(['Alpha', 'Momentum', 'Zéphyr']);
    expect(shuffled).toEqual(first);
  });
});
