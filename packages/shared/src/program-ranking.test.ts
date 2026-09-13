import { describe, expect, it } from 'vitest';
import {
  fitsAvailability,
  preferredProgramLevel,
  rankSuggestedPrograms,
  type RankableProgram,
  type RankingContext,
} from './program-ranking';

const P = (
  id: string,
  level: RankableProgram['level'],
  sessionCount: number | null = null,
): RankableProgram => ({ id, name: id, level, sessionCount });

const CONTEXT: RankingContext = {
  trainingLevel: null,
  displayLevel: null,
  weeklyAvailability: null,
};

describe('preferredProgramLevel', () => {
  it('utilise le niveau déclaré quand il existe', () => {
    expect(preferredProgramLevel({ ...CONTEXT, trainingLevel: 'advanced' })).toBe('advanced');
  });

  /**
   * 🔴 Le cœur du volet B : le niveau déclaré doit **écraser** le proxy d'affichage. C'est le cas
   * du pratiquant confirmé qui aime les écrans épurés — avant GUID-01, il recevait des programmes
   * débutants.
   */
  it('fait gagner le niveau déclaré sur le proxy d’affichage, même contradictoires', () => {
    expect(
      preferredProgramLevel({
        ...CONTEXT,
        trainingLevel: 'advanced',
        displayLevel: 'simplified',
      }),
    ).toBe('advanced');
  });

  it('retombe sur le proxy d’affichage quand le niveau n’a jamais été demandé', () => {
    expect(preferredProgramLevel({ ...CONTEXT, displayLevel: 'detailed' })).toBe('advanced');
    expect(preferredProgramLevel({ ...CONTEXT, displayLevel: 'normal' })).toBe('intermediate');
    expect(preferredProgramLevel({ ...CONTEXT, displayLevel: 'simplified' })).toBe('beginner');
  });

  it('vise débutant quand on ne sait rien — le bon défaut pour un compte neuf', () => {
    expect(preferredProgramLevel(CONTEXT)).toBe('beginner');
  });
});

describe('fitsAvailability', () => {
  const programs = [P('a', 'beginner', 3), P('b', 'beginner', 5), P('c', 'beginner', 2)];

  it('ne filtre rien quand la disponibilité n’a pas été déclarée', () => {
    expect(fitsAvailability(programs, null)).toHaveLength(3);
  });

  it('écarte les programmes trop fréquents', () => {
    expect(fitsAvailability(programs, 3).map((p) => p.id)).toEqual(['a', 'c']);
  });

  /**
   * Quelqu'un qui déclare 1 jour et à qui on répond « aucun programme » a été puni d'avoir répondu
   * honnêtement. Le filtre s'efface plutôt que de vider l'écran.
   */
  it('s’efface plutôt que de vider la liste', () => {
    expect(fitsAvailability(programs, 1)).toHaveLength(3);
  });

  it('garde un programme dont le nombre de séances est inconnu', () => {
    expect(fitsAvailability([P('x', 'beginner', null)], 2).map((p) => p.id)).toEqual(['x']);
  });
});

describe('rankSuggestedPrograms', () => {
  const library = [
    P('avancé', 'advanced'),
    P('débutant', 'beginner'),
    P('intermédiaire', 'intermediate'),
    P('sans niveau', null),
  ];

  it('met le niveau visé en tête', () => {
    const ranked = rankSuggestedPrograms(library, { ...CONTEXT, trainingLevel: 'intermediate' });
    expect(ranked[0]?.id).toBe('intermédiaire');
  });

  it('place le niveau inconnu en dernier, jamais confondu avec débutant', () => {
    const ranked = rankSuggestedPrograms(library, { ...CONTEXT, trainingLevel: 'beginner' });
    expect(ranked[ranked.length - 1]?.id).toBe('sans niveau');
  });

  it('respecte l’ordre de repli propre à chaque niveau', () => {
    const advanced = rankSuggestedPrograms(library, { ...CONTEXT, trainingLevel: 'advanced' });
    expect(advanced.map((p) => p.id).slice(0, 3)).toEqual(['avancé', 'intermédiaire', 'débutant']);
  });

  it('départage à niveau égal par le nom, pour un ordre stable', () => {
    const same = [P('zèbre', 'beginner'), P('alpha', 'beginner')];
    expect(rankSuggestedPrograms(same, CONTEXT).map((p) => p.id)).toEqual(['alpha', 'zèbre']);
  });

  it('combine disponibilité et niveau', () => {
    const programs = [
      P('gros volume', 'intermediate', 6),
      P('léger', 'intermediate', 2),
      P('léger débutant', 'beginner', 2),
    ];
    const ranked = rankSuggestedPrograms(programs, {
      trainingLevel: 'intermediate',
      displayLevel: null,
      weeklyAvailability: 3,
    });
    expect(ranked.map((p) => p.id)).toEqual(['léger', 'léger débutant']);
  });

  it('ne modifie pas le tableau reçu', () => {
    const source = [...library];
    rankSuggestedPrograms(source, CONTEXT);
    expect(source.map((p) => p.id)).toEqual(library.map((p) => p.id));
  });

  it('rend une liste vide sur une bibliothèque vide', () => {
    expect(rankSuggestedPrograms([], CONTEXT)).toEqual([]);
  });
});
