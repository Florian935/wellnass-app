import { describe, expect, it } from 'vitest';
import {
  DECISION_KINDS,
  DEFAULT_GUIDANCE_REGIME,
  GUIDANCE_REGIMES,
  SAFETY_DECISIONS,
  displayLevelForRegime,
  dispositionFor,
  effectiveGlobalRegime,
  effectiveRegime,
  hasChosenRegime,
  hasPillarOverride,
  isSafetyDecision,
  type GuidanceSource,
} from './guidance';
import { PILLARS } from './pillar';

describe('dispositionFor', () => {
  it('applique les décisions réversibles en régime guidé', () => {
    expect(dispositionFor('sessionConflict', 'guided')).toBe('apply');
    expect(dispositionFor('carbTarget', 'guided')).toBe('apply');
  });

  it("propose — et n'applique jamais — ce qui n'est pas réversible en un geste", () => {
    // Poser un programme change le calendrier de plusieurs semaines : même en régime guidé, ça se
    // demande.
    expect(dispositionFor('programSuggestion', 'guided')).toBe('propose');
    expect(dispositionFor('goalConflict', 'guided')).toBe('propose');
  });

  it('propose tout en régime accompagné', () => {
    for (const kind of DECISION_KINDS) {
      expect(dispositionFor(kind, 'assisted')).toBe('propose');
    }
  });

  it('se tait en régime autonome — sauf sécurité', () => {
    expect(dispositionFor('sessionConflict', 'autonomous')).toBe('silent');
    expect(dispositionFor('carbTarget', 'autonomous')).toBe('silent');
    expect(dispositionFor('programSuggestion', 'autonomous')).toBe('silent');
    expect(dispositionFor('goalConflict', 'autonomous')).toBe('silent');
  });
});

describe('les trois signaux de sécurité (décision D5)', () => {
  it('franchissent TOUS les régimes, y compris autonome', () => {
    for (const kind of SAFETY_DECISIONS) {
      for (const regime of GUIDANCE_REGIMES) {
        expect(dispositionFor(kind, regime)).not.toBe('silent');
      }
    }
  });

  it("ne s'appliquent JAMAIS d'office — on alerte, on ne décide pas à la place", () => {
    for (const kind of SAFETY_DECISIONS) {
      for (const regime of GUIDANCE_REGIMES) {
        expect(dispositionFor(kind, regime)).toBe('propose');
      }
    }
  });

  it('sont exactement trois, et reconnus comme tels', () => {
    expect(SAFETY_DECISIONS).toHaveLength(3);
    expect(isSafetyDecision('safetyLoad')).toBe(true);
    expect(isSafetyDecision('safetyPain')).toBe(true);
    expect(isSafetyDecision('safetyDeficit')).toBe(true);
    expect(isSafetyDecision('sessionConflict')).toBe(false);
  });
});

describe('effectiveRegime — appliqué', () => {
  it('retombe sur accompagné quand rien n’a été répondu', () => {
    expect(effectiveRegime(null, 'strength')).toBe(DEFAULT_GUIDANCE_REGIME);
    expect(effectiveRegime(undefined, 'nutrition')).toBe('assisted');
    expect(effectiveRegime({ regime: null }, 'running')).toBe('assisted');
  });

  it('hérite du régime global quand le pilier n’a pas de surcharge', () => {
    const source: GuidanceSource = { regime: 'guided' };
    for (const pillar of PILLARS) {
      expect(effectiveRegime(source, pillar)).toBe('guided');
    }
  });

  it('fait gagner la surcharge de pilier sur le global', () => {
    const source: GuidanceSource = { regime: 'guided', nutrition: 'autonomous' };
    expect(effectiveRegime(source, 'nutrition')).toBe('autonomous');
    expect(effectiveRegime(source, 'strength')).toBe('guided');
    expect(effectiveRegime(source, 'running')).toBe('guided');
  });

  it('mappe bien cardio → pilier running', () => {
    expect(effectiveRegime({ regime: 'assisted', cardio: 'guided' }, 'running')).toBe('guided');
  });

  it('ignore une valeur illisible en base plutôt que de planter', () => {
    expect(effectiveRegime({ regime: 'n’importe quoi' }, 'strength')).toBe('assisted');
    expect(effectiveRegime({ regime: 'guided', strength: 'bidon' }, 'strength')).toBe('guided');
  });

  it('expose le régime global seul', () => {
    expect(effectiveGlobalRegime({ regime: 'autonomous', strength: 'guided' })).toBe('autonomous');
    expect(effectiveGlobalRegime(null)).toBe('assisted');
  });
});

describe('hasChosenRegime — choisi', () => {
  it('est faux tant que rien n’a été écrit — le repli ne se fait pas passer pour un choix', () => {
    expect(hasChosenRegime(null, 'strength')).toBe(false);
    expect(hasChosenRegime({ regime: null }, 'strength')).toBe(false);
  });

  it('est vrai dès que le global a été choisi', () => {
    expect(hasChosenRegime({ regime: 'assisted' }, 'strength')).toBe(true);
  });

  it('distingue un choix global d’une surcharge de pilier', () => {
    const source: GuidanceSource = { regime: 'assisted', strength: 'guided' };
    expect(hasPillarOverride(source, 'strength')).toBe(true);
    expect(hasPillarOverride(source, 'nutrition')).toBe(false);
    // Le pilier nutrition applique bien un régime choisi (le global), sans surcharge propre.
    expect(hasChosenRegime(source, 'nutrition')).toBe(true);
  });
});

describe('displayLevelForRegime', () => {
  it('déduit la densité d’écran du régime', () => {
    expect(displayLevelForRegime('guided')).toBe('simplified');
    expect(displayLevelForRegime('assisted')).toBe('normal');
    expect(displayLevelForRegime('autonomous')).toBe('detailed');
  });

  it('couvre les trois régimes sans trou', () => {
    for (const regime of GUIDANCE_REGIMES) {
      expect(['simplified', 'normal', 'detailed']).toContain(displayLevelForRegime(regime));
    }
  });
});
