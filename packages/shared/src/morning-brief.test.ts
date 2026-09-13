import { describe, expect, it } from 'vitest';
import { BRIEF_MAX_SENTENCES, buildMorningBrief, type BriefFacts } from './morning-brief';

const facts = (over: Partial<BriefFacts> = {}): BriefFacts => ({
  verdict: 'push',
  todaySession: { title: 'Push B', time: '18:00' },
  nearRecord: { exerciseName: 'Développé couché', gapKind: 'kg', gap: 2.5 },
  proteinGapG: 42,
  streak: 14,
  realLifeActive: false,
  ...over,
});

describe('buildMorningBrief (US DASH-01, §6.2 — sans IA)', () => {
  it('verdict, séance, record à portée — dans cet ordre, trois phrases au plus', () => {
    expect(buildMorningBrief(facts())).toEqual([
      { key: 'brief.verdict.push', params: {} },
      { key: 'brief.sessionAt', params: { title: 'Push B', time: '18:00' } },
      { key: 'brief.nearRecordKg', params: { exercise: 'Développé couché', gap: 2.5 } },
    ]);
    expect(buildMorningBrief(facts())).toHaveLength(BRIEF_MAX_SENTENCES);
  });

  it('séance sans heure → phrase sans heure', () => {
    expect(buildMorningBrief(facts({ todaySession: { title: 'Pull A', time: null } }))[1]).toEqual({
      key: 'brief.session',
      params: { title: 'Pull A' },
    });
  });

  it('pas de record à portée → l’écart de protéines, arrondi à 5 g', () => {
    expect(buildMorningBrief(facts({ nearRecord: null }))[2]).toEqual({
      key: 'brief.protein',
      params: { grams: 40 },
    });
  });

  it('un petit écart de protéines (< 20 g) ne mérite pas une phrase', () => {
    const brief = buildMorningBrief(facts({ nearRecord: null, proteinGapG: 12 }));
    expect(brief.map((s) => s.key)).not.toContain('brief.protein');
  });

  it('un record en répétitions a sa propre phrase', () => {
    expect(
      buildMorningBrief(facts({ nearRecord: { exerciseName: 'Squat', gapKind: 'reps', gap: 1 } }))[2],
    ).toEqual({ key: 'brief.nearRecordReps', params: { exercise: 'Squat', gap: 1 } });
  });

  it('période « vie réelle » → une phrase douce remplace le verdict', () => {
    expect(buildMorningBrief(facts({ realLifeActive: true }))[0]).toEqual({ key: 'brief.gentle', params: {} });
  });

  it('peu à dire → la série complète le brief', () => {
    expect(
      buildMorningBrief(facts({ verdict: null, todaySession: null, nearRecord: null, proteinGapG: null })),
    ).toEqual([{ key: 'brief.streak', params: { days: 14 } }]);
  });

  it('rien du tout → aucun brief (on ne lit pas du vide)', () => {
    expect(
      buildMorningBrief(
        facts({ verdict: null, todaySession: null, nearRecord: null, proteinGapG: null, streak: 0 }),
      ),
    ).toEqual([]);
  });
});
