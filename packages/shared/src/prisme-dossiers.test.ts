/**
 * US PRISME-01 — les dossiers que Prisme raconte : le soir et la semaine.
 *
 * Deux exigences, testées ici : **tout ce qu'un texte voudra dire est dans le dossier** (sans quoi le
 * garde-fou rejette un texte juste, spec R5), et **rien d'autre n'y entre** (liste blanche, R4).
 */
import { describe, expect, it } from 'vitest';

import { bilanNumbers, checkNarration } from './ai-narration';
import {
  buildEveningDossier,
  buildWeekDossier,
  eveningFingerprint,
  hasEveningFacts,
  type EveningFacts,
  type PrismeTranslate,
  type WeekDossierInput,
} from './prisme-dossiers';
import type { WeeklyReview } from './weekly-review';

/** Une traduction de test : la clé et ses paramètres, en clair — les nombres restent lisibles. */
const t: PrismeTranslate = (key, params) =>
  params
    ? `${key}(${Object.entries(params)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')})`
    : key;

const FULL: EveningFacts = {
  dayLabel: 'vendredi 2 octobre',
  sessions: [
    { type: 'strength', minutes: 52, tonnageKg: 8420, setsDone: 18, setsPlanned: 18, records: 1 },
    { type: 'run', minutes: 31, distanceKm: 5.24, paceSPerKm: 355 },
    { type: 'other', minutes: 40 },
  ],
  plate: { kcal: 2140, targetKcal: 2450, proteinG: 118, targetProteinG: 150, carbsG: 236, meals: 3 },
  week: { done: 3, goal: 4 },
  tomorrow: { type: 'run', time: '09:00', distanceKm: 14 },
  realLife: false,
};

describe('hasEveningFacts — une journée sans fait n’a pas de carte (R12)', () => {
  it('une séance ou un repas suffit', () => {
    expect(hasEveningFacts(FULL)).toBe(true);
    expect(hasEveningFacts({ ...FULL, plate: null })).toBe(true);
    expect(hasEveningFacts({ ...FULL, sessions: [] })).toBe(true);
  });

  it('la semaine et le lendemain seuls ne font pas une journée', () => {
    expect(hasEveningFacts({ ...FULL, sessions: [], plate: null })).toBe(false);
  });
});

describe('buildEveningDossier', () => {
  const dossier = buildEveningDossier(FULL, t);

  it('un fait par séance, puis l’assiette, la semaine et demain', () => {
    expect(dossier.facts.map((f) => f.label)).toEqual([
      'prisme.dossier.session.strength',
      'prisme.dossier.session.run',
      'prisme.dossier.session.other',
      'prisme.dossier.plate.label',
      'prisme.dossier.week.label',
      'prisme.dossier.tomorrow',
    ]);
    expect(dossier.headline).toContain('vendredi 2 octobre');
    expect(dossier.decision).toBeNull();
  });

  it('🔴 les écarts aux cibles sont calculés ICI, par le moteur (spec R5)', () => {
    const plate = dossier.facts.find((f) => f.label === 'prisme.dossier.plate.label')!;
    expect(plate.detail).toContain('kcalLeft(kcal=310)');
    expect(plate.detail).toContain('proteinMissing(g=32)');
    // Le texte juste de Prisme passe donc le garde-fou.
    expect(checkNarration('Il te manque 32 g de protéines, et il te reste 310 kcal.', bilanNumbers(dossier)).ok).toBe(
      true,
    );
  });

  it('dit « dépassé » et « atteint » sans signe négatif à interpréter', () => {
    const over = buildEveningDossier(
      { ...FULL, plate: { ...FULL.plate!, kcal: 2600, proteinG: 160 } },
      t,
    ).facts.find((f) => f.label === 'prisme.dossier.plate.label')!;
    expect(over.detail).toContain('kcalOver(kcal=150)');
    expect(over.detail).toContain('proteinReached');
    expect(over.values.every((v) => v >= 0)).toBe(true);
  });

  it('sans cible, aucun écart n’est inventé', () => {
    const plate = buildEveningDossier(
      { ...FULL, plate: { ...FULL.plate!, targetKcal: null, targetProteinG: null } },
      t,
    ).facts.find((f) => f.label === 'prisme.dossier.plate.label')!;
    expect(plate.detail).not.toContain('Left');
    expect(plate.detail).not.toContain('Missing');
  });

  it('la course porte sa distance arrondie et son allure en minutes:secondes', () => {
    const run = dossier.facts.find((f) => f.label === 'prisme.dossier.session.run')!;
    expect(run.detail).toContain('distance(km=5.2)');
    expect(run.detail).toContain('pace(pace=5:55)');
    expect(checkNarration('Une sortie de 5,2 km à 5:55 au kilomètre.', bilanNumbers(dossier)).ok).toBe(true);
  });

  it('demain : le type de séance, l’heure et la distance — jamais un nom', () => {
    const tomorrow = dossier.facts.find((f) => f.label === 'prisme.dossier.tomorrow')!;
    expect(tomorrow.detail).toContain('prisme.dossier.session.run');
    expect(tomorrow.detail).toContain('09:00');
    expect(checkNarration('Demain, ta sortie de 14 km est à 9 h.', bilanNumbers(dossier)).ok).toBe(true);
  });

  it('omet un bloc absent, sans zéro (IA-LAB-01 R5)', () => {
    const bare = buildEveningDossier({ ...FULL, plate: null, week: null, tomorrow: null }, t);
    expect(bare.facts.map((f) => f.label)).not.toContain('prisme.dossier.plate.label');
    expect(bare.facts.map((f) => f.label)).not.toContain('prisme.dossier.week.label');
    expect(bare.facts.map((f) => f.label)).not.toContain('prisme.dossier.tomorrow');
  });

  it('porte le mode vie réelle jusqu’à la consigne', () => {
    expect(buildEveningDossier({ ...FULL, realLife: true }, t).realLife).toBe(true);
  });

  it('une séance libre dit ses séries faites, sans plan ni record inventés', () => {
    const free = buildEveningDossier(
      { ...FULL, sessions: [{ type: 'strength', minutes: 40, tonnageKg: 5200, setsDone: 12, setsPlanned: null, records: 0 }] },
      t,
    ).facts[0]!;
    expect(free.detail).toContain('setsDone(done=12)');
    expect(free.detail).not.toContain('planned');
    expect(free.detail).not.toContain('records');
  });

  it('des séries inconnues ne sont pas dites — ni zéro ni « sur 18 »', () => {
    const unknown = buildEveningDossier(
      { ...FULL, sessions: [{ type: 'strength', minutes: 52, tonnageKg: 8420, setsDone: null, setsPlanned: null, records: 0 }] },
      t,
    ).facts[0]!;
    expect(unknown.detail).not.toContain('sets');
    expect(unknown.values).toEqual([52, 8420]);
  });

  it('une sortie sans allure connue ne dit pas d’allure', () => {
    const run = buildEveningDossier({ ...FULL, sessions: [{ type: 'run', minutes: 20, distanceKm: 3, paceSPerKm: null }] }, t)
      .facts[0]!;
    expect(run.detail).not.toContain('pace');
  });

  it('une cible tout juste atteinte se dit « atteinte », sans écart', () => {
    const plate = buildEveningDossier({ ...FULL, plate: { ...FULL.plate!, kcal: 2450 } }, t).facts.find(
      (f) => f.label === 'prisme.dossier.plate.label',
    )!;
    expect(plate.detail).toContain('kcalOnTarget');
  });

  it('demain sans heure ni distance : le type de séance, et rien d’autre', () => {
    const tomorrow = buildEveningDossier({ ...FULL, tomorrow: { type: 'strength', time: null, distanceKm: null } }, t).facts.find(
      (f) => f.label === 'prisme.dossier.tomorrow',
    )!;
    expect(tomorrow.detail).toBe('prisme.dossier.session.strength');
    expect(tomorrow.values).toEqual([]);
  });
});

describe('eveningFingerprint — « ta journée a bougé depuis » (DD12)', () => {
  it('change quand un repas s’ajoute, pas quand rien ne bouge', () => {
    const before = eveningFingerprint(FULL);
    expect(eveningFingerprint({ ...FULL })).toBe(before);
    expect(eveningFingerprint({ ...FULL, plate: { ...FULL.plate!, kcal: 2410, meals: 4 } })).not.toBe(before);
  });
});

/**
 * 🔴 **Test-garde de minimisation (spec R4).** Ce qui n'est pas dans ces listes ne peut pas partir :
 * ni titre ou nom saisi par l'utilisateur, ni note, ni donnée du bien-être ou de Health Connect.
 * Ajouter une clé fait échouer ce test : c'est voulu, la question « a-t-elle le droit de partir ? »
 * doit être posée — et la réponse écrite dans la spec avant d'être écrite ici.
 */
describe('liste blanche du dossier du soir', () => {
  it('ne connaît que ces champs', () => {
    expect(Object.keys(FULL).sort()).toEqual(['dayLabel', 'plate', 'realLife', 'sessions', 'tomorrow', 'week']);
    expect(Object.keys(FULL.sessions[0]!).sort()).toEqual([
      'minutes',
      'records',
      'setsDone',
      'setsPlanned',
      'tonnageKg',
      'type',
    ]);
    expect(Object.keys(FULL.sessions[1]!).sort()).toEqual(['distanceKm', 'minutes', 'paceSPerKm', 'type']);
    expect(Object.keys(FULL.sessions[2]!).sort()).toEqual(['minutes', 'type']);
    expect(Object.keys(FULL.plate!).sort()).toEqual(['carbsG', 'kcal', 'meals', 'proteinG', 'targetKcal', 'targetProteinG']);
    expect(Object.keys(FULL.tomorrow!).sort()).toEqual(['distanceKm', 'time', 'type']);
  });

  it('aucun mot du bien-être, de Health Connect ou de texte libre dans ce qui part', () => {
    const sent = JSON.stringify(buildEveningDossier(FULL, t)).toLowerCase();
    for (const word of ['sleep', 'nuit', 'mood', 'humeur', 'energy', 'énergie', 'steps', 'pas du jour', 'title', 'name', 'note']) {
      expect(sent).not.toContain(word);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Le dossier de la semaine
// ───────────────────────────────────────────────────────────────────────────────────────────────

const REVIEW: WeeklyReview = {
  period: { start: '2026-09-21', end: '2026-09-27' },
  current: { workouts: 2, tonnageKg: 16280.4, runs: 2, distanceM: 31540, loggedDays: 7, daysInTarget: 5, activeDays: 5 },
  previous: { workouts: 2, tonnageKg: 15074, runs: 2, distanceM: 28160, loggedDays: 6, daysInTarget: 4, activeDays: 5 },
  recordsBeaten: 1,
  changes: {
    tonnage: { pct: 8, direction: 'up' },
    distance: { pct: 12, direction: 'up' },
    activeDays: { pct: 0, direction: 'flat' },
    loggedDays: { pct: 17, direction: 'up' },
  },
  isEmpty: false,
  decision: { kind: 'all_good', metrics: { activeDays: 5 } },
  realLifeDays: 0,
};

const WEEK_INPUT: WeekDossierInput = {
  review: REVIEW,
  periodLabel: 'du 21 au 27 septembre',
  goals: [{ typeLabel: 'objectif de course', ratioPct: 62 }],
  activePillars: { strength: true, running: true, nutrition: true },
  decisionText: 'Point fort : ta régularité, 5 jours actifs sur 7.',
};

describe('buildWeekDossier', () => {
  const dossier = buildWeekDossier(WEEK_INPUT, t);

  it('un fait par pilier actif, puis la régularité, les records et les objectifs', () => {
    expect(dossier.facts.map((f) => f.label)).toEqual([
      'prisme.dossier.session.strength',
      'prisme.dossier.session.run',
      'prisme.dossier.plate.label',
      'prisme.dossier.week.activeDays',
      'prisme.dossier.week.records',
      'prisme.dossier.week.goal',
    ]);
    expect(dossier.headline).toContain('du 21 au 27 septembre');
  });

  it('🔴 un pilier inactif ne produit aucune ligne, pas de zéro (IA-LAB-01 R5)', () => {
    const noRun = buildWeekDossier({ ...WEEK_INPUT, activePillars: { strength: true, running: false, nutrition: true } }, t);
    expect(noRun.facts.map((f) => f.label)).not.toContain('prisme.dossier.session.run');
  });

  it('porte la décision du moteur telle qu’affichée (R16)', () => {
    expect(dossier.decision).toBe('Point fort : ta régularité, 5 jours actifs sur 7.');
  });

  it('distance en km arrondie, variation en mots plutôt qu’en signe', () => {
    const run = dossier.facts.find((f) => f.label === 'prisme.dossier.session.run')!;
    expect(run.detail).toContain('distance(km=31.5)');
    expect(run.detail).toContain('changeUp(pct=12)');
  });

  it('l’objectif part avec son type et son pourcentage, jamais son nom saisi (R4)', () => {
    const goal = dossier.facts.find((f) => f.label === 'prisme.dossier.week.goal')!;
    expect(goal.detail).toContain('type=objectif de course');
    expect(goal.detail).toContain('pct=62');
  });

  it('le texte juste de Prisme passe le garde-fou', () => {
    const text =
      'Semaine tenue : 2 séances et 2 sorties pour 31,5 km. Ta cible tenue 5 jours sur 7, ' +
      'et ton objectif de course avance à 62 %. Ton bilan retient ta régularité : 5 jours actifs.';
    expect(checkNarration(text, bilanNumbers(dossier), { maxChars: 500 }).ok).toBe(true);
  });

  it('des jours en mode vie réelle font passer la consigne en douceur', () => {
    const soft = buildWeekDossier({ ...WEEK_INPUT, review: { ...REVIEW, realLifeDays: 3 } }, t);
    expect(soft.realLife).toBe(true);
    expect(soft.facts.map((f) => f.label)).toContain('prisme.dossier.week.realLife');
  });

  it('🔴 les jours actifs se disent « sur 7 », comme à l’écran (« 5 / 7 ») : le texte qui le reprend passe', () => {
    // Relu avant commit : l'écran du bilan affiche « 5 / 7 », mais 7 n'était dans aucun fait — « 5 jours
    // sur 7 », juste, était jeté dès qu'aucune autre ligne ne portait un 7.
    const strengthOnly = buildWeekDossier(
      {
        ...WEEK_INPUT,
        goals: [],
        decisionText: 'Bonne semaine.',
        activePillars: { strength: true, running: false, nutrition: false },
      },
      t,
    );
    expect(checkNarration('Tu as été actif 5 jours sur 7.', bilanNumbers(strengthOnly)).ok).toBe(true);
  });

  it('une semaine sans décision (vide) n’en porte pas', () => {
    expect(buildWeekDossier({ ...WEEK_INPUT, decisionText: null }, t).decision).toBeNull();
  });

  it('une baisse se dit en mots, une variation incalculable se tait', () => {
    const changed = buildWeekDossier(
      {
        ...WEEK_INPUT,
        review: {
          ...REVIEW,
          changes: {
            tonnage: { pct: -30, direction: 'down' },
            distance: { pct: null, direction: 'up' },
            activeDays: null,
            loggedDays: null,
          },
        },
      },
      t,
    );
    expect(changed.facts[0]!.detail).toContain('changeDown(pct=30)');
    expect(changed.facts[1]!.detail).not.toContain('change');
    expect(changed.facts.find((f) => f.label === 'prisme.dossier.week.activeDays')!.detail).not.toContain('change');
  });

  it('chaque variation dite part avec sa valeur, une stabilité sans valeur', () => {
    const moved = buildWeekDossier(
      {
        ...WEEK_INPUT,
        review: {
          ...REVIEW,
          changes: { ...REVIEW.changes, tonnage: { pct: 0, direction: 'flat' }, activeDays: { pct: 25, direction: 'up' } },
        },
      },
      t,
    );
    expect(moved.facts[0]!.detail).toContain('changeFlat');
    expect(moved.facts[0]!.values).toEqual([2, 16280]);
    const active = moved.facts.find((f) => f.label === 'prisme.dossier.week.activeDays')!;
    expect(active.detail).toContain('changeUp(pct=25)');
    // 5 jours, sur 7 (comme l'écran), et la variation.
    expect(active.values).toEqual([5, 7, 25]);
  });

  it('première semaine, sans cible, sans record ni objectif : rien n’est inventé', () => {
    const bare = buildWeekDossier(
      {
        ...WEEK_INPUT,
        goals: [],
        activePillars: { strength: false, running: true, nutrition: true },
        review: { ...REVIEW, recordsBeaten: 0, current: { ...REVIEW.current, daysInTarget: null } },
      },
      t,
    );
    expect(bare.facts.map((f) => f.label)).toEqual([
      'prisme.dossier.session.run',
      'prisme.dossier.plate.label',
      'prisme.dossier.week.activeDays',
    ]);
    expect(bare.facts[1]!.detail).not.toContain('daysInTarget');
  });
});
