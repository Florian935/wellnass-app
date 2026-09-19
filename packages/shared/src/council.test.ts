import { describe, it, expect } from 'vitest';
import { buildCouncil, councilNumbers, COUNCIL_OPTIONS } from './council';
import type { GoalConflict } from './goal-conflicts';
import type { LabComposerContext } from './lab-composer';

/**
 * US CONS-01 — le Conseil chiffre les deux issues d'une contradiction.
 *
 * Ce qui se teste ici n'est pas l'arithmétique (elle appartient à `lab-composer`, déjà testé), mais
 * **les décisions du Conseil** : quelles doses correspondent à quelle issue, quand il refuse de
 * chiffrer, et quelles voix parlent. Une erreur sur les doses ferait afficher, sous un bouton, les
 * conséquences d'une écriture qui n'est pas celle qu'il déclenche — le pire défaut possible pour un
 * écran d'arbitrage.
 */

const CONFLIT: GoalConflict = { rule: 'bulkVsCut', left: 'goal.muscle', right: 'nutrition.cut' };

const CTX: LabComposerContext = {
  activePillars: ['strength', 'nutrition', 'running'],
  baseline: {
    strengthSessions: 3,
    runningFrequency: 2,
    proteinGPerKg: 1.8,
    objective: 'cut',
    sleep: 'long',
  },
  weightKg: 78,
  tdeeKcal: 2600,
  sbd: { lastTotalKg: 420, slopePerWeek: 1.2 },
  loadRatio: 1.05,
  hoursPerRun: 0.8,
};

describe('buildCouncil — ce qu’il refuse de chiffrer', () => {
  it('🔴 rien sur la contradiction course ↔ masse', () => {
    // Ses deux issues changent des intentions dont la conséquence n'est pas calculable : il
    // faudrait RN-17, que le catalogue donne « non construit ». Chiffrer quand même reviendrait à
    // inventer un seuil — ce que `goal-conflicts.ts` avait déjà refusé en écrivant la règle.
    const endurance: GoalConflict = {
      rule: 'enduranceVsMass',
      left: 'goal.muscle',
      right: 'running.marathon',
    };
    expect(buildCouncil(endurance, CTX)).toBeNull();
  });

  it('🔴 rien sans poids ni dépense de référence', () => {
    expect(buildCouncil(CONFLIT, { ...CTX, weightKg: null })).toBeNull();
    expect(buildCouncil(CONFLIT, { ...CTX, tdeeKcal: null })).toBeNull();
  });
});

describe('buildCouncil — les deux issues', () => {
  it('rend exactement deux issues, dans un ordre stable', () => {
    const council = buildCouncil(CONFLIT, CTX)!;
    expect(council.options.map((o) => o.id)).toEqual([...COUNCIL_OPTIONS]);
  });

  it('🔴 « garder l’objectif principal » met la nutrition en surplus', () => {
    const council = buildCouncil(CONFLIT, CTX)!;
    const [main] = council.options;

    // C'est **exactement** ce qu'écrit la carte de GUID-01 (`upsertNutritionProfile({objective:'bulk'})`).
    // Projeter autre chose afficherait, sous le bouton, les conséquences d'une écriture différente.
    expect(main!.doses.objective).toBe('bulk');
  });

  it('🔴 « garder le réglage du pilier » ne change AUCUNE dose', () => {
    const council = buildCouncil(CONFLIT, CTX)!;
    const pillar = council.options[1]!;

    // Cette issue aligne l'objectif PRINCIPAL, qui n'entre dans aucun calcul du composeur : la
    // projection doit donc être celle d'aujourd'hui, sans retouche cosmétique.
    expect(pillar.doses).toEqual(CTX.baseline);
  });

  it('les deux issues se distinguent par les calories et le poids projeté', () => {
    const council = buildCouncil(CONFLIT, CTX)!;
    const [main, pillar] = council.options;

    expect(main!.projection.kcalTarget).toBeGreaterThan(pillar!.projection.kcalTarget!);
    // Surplus contre déficit : le poids projeté monte d'un côté, descend de l'autre.
    expect(main!.projection.weightChangeKg).toBeGreaterThan(0);
    expect(pillar!.projection.weightChangeKg).toBeLessThan(0);
  });

  it('la force est projetée avec sa fourchette', () => {
    const council = buildCouncil(CONFLIT, CTX)!;
    const sbd = council.options[0]!.projection.sbd!;

    // Une projection affichée en un seul nombre se lirait comme une promesse (spec R3).
    expect(sbd.lowKg).toBeLessThan(sbd.projectedKg);
    expect(sbd.highKg).toBeGreaterThan(sbd.projectedKg);
  });

  it('sans historique de force, le reste tient quand même', () => {
    const council = buildCouncil(CONFLIT, { ...CTX, sbd: null })!;

    expect(council.options[0]!.projection.sbd).toBeNull();
    expect(council.options[0]!.projection.kcalTarget).not.toBeNull();
  });
});

describe('buildCouncil — les voix', () => {
  it('une voix par pilier actif', () => {
    const council = buildCouncil(CONFLIT, CTX)!;
    expect(council.voices.map((v) => v.pillar)).toEqual(['strength', 'nutrition', 'running']);
  });

  it('🔴 un pilier désactivé n’a pas d’avis à donner', () => {
    // Décision H : l'intégration ne s'impose jamais. Faire parler un pilier éteint, c'est faire
    // parler quelqu'un qui a explicitement dit qu'il ne jouait pas.
    const council = buildCouncil(CONFLIT, { ...CTX, activePillars: ['nutrition'] })!;
    expect(council.voices.map((v) => v.pillar)).toEqual(['nutrition']);
  });

  it('la voix de la force avoue quand elle ne sait pas', () => {
    const council = buildCouncil(CONFLIT, { ...CTX, sbd: null })!;
    expect(council.voices[0]).toMatchObject({ pillar: 'strength', id: 'strengthUnknown' });
  });

  it('la voix de la course se tait si l’on ne court pas', () => {
    const council = buildCouncil(CONFLIT, {
      ...CTX,
      baseline: { ...CTX.baseline, runningFrequency: 0 },
    })!;
    expect(council.voices.some((v) => v.pillar === 'running')).toBe(false);
  });
});

describe('councilNumbers', () => {
  it('rassemble les chiffres des voix ET des deux issues', () => {
    const council = buildCouncil(CONFLIT, CTX)!;
    const numbers = councilNumbers(council);

    // C'est la liste de référence du garde-fou de NARR-01 quand le modèle résume cette page : un
    // chiffre affiché qui n'y serait pas ferait rejeter un résumé pourtant juste.
    expect(numbers).toContain(council.options[0]!.projection.kcalTarget);
    expect(numbers).toContain(council.options[1]!.projection.weightChangeKg);
    expect(numbers).toContain(council.voices[0]!.values.totalKg);
  });
});
