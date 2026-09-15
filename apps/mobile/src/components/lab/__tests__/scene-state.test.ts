/**
 * US LABO-01 — ce que la scène 3D reçoit.
 *
 * La scène elle-même n'est pas testable sous Jest (elle vit dans une WebView, avec WebGL) ; c'est
 * précisément pour ça que **tout ce qu'elle décide a été sorti** dans ces fonctions pures. Ce qui est
 * vérifié ici est ce qui, s'il cédait, ferait mentir l'image :
 *
 *  1. **une proposition réglée ne porte plus de médaille** — sinon l'utilisateur voit encore le
 *     problème qu'il vient de régler, et cesse de croire la scène ;
 *  2. **une nuit non saisie n'est pas une mauvaise nuit** (`null`, jamais 0) — même règle que le
 *     journal de bien-être : un trou n'est pas un zéro ;
 *  3. **une paire de piliers identiques ne produit pas de croisement** : la scène ne saurait pas où
 *     poser la médaille, et la poserait au centre de nulle part ;
 *  4. **l'état reste sérialisable** : il franchit la frontière d'un composant DOM, où une fonction
 *     ou un `undefined` passe à la trappe sans erreur.
 */

import {
  GOOD_NIGHT_MINUTES,
  PROTEIN_TARGETS_G_PER_KG,
  type LabComposerResult,
  type LabDoses,
  type LabKnowledgeCard,
  type LabProposal,
  type LabQuestion,
  type LabWeek,
} from '@wellness/shared';

import {
  labSceneFromComposer,
  labSceneFromWeek,
  labSceneWithKnowledge,
  labSceneWithQuestion,
  nightMark,
  sceneCrossing,
  scenePillar,
  type SceneLabels,
} from '../scene/scene-state';

const LABELS: SceneLabels = { brand: 'FITTRIO', plate: 'SÉANCE', trackBig: '18', trackSmall: 'SUR 30 KM', days: ['L', 'M', 'M', 'J', 'V', 'S', 'D'] };

const jour = (dayKey: string, over: Partial<LabWeek['days'][number]> = {}): LabWeek['days'][number] => ({
  dayKey,
  isToday: false,
  isPast: false,
  strength: [],
  running: [],
  proteinGPerKg: null,
  sleepMinutes: null,
  ...over,
});

const proposition = (over: Partial<LabProposal> = {}): LabProposal => ({
  id: 'p-1',
  kind: 'collision',
  tone: 'warn',
  pair: ['strength', 'running'],
  safety: false,
  values: {},
  action: { type: 'open', target: 'planning' },
  ...over,
});

const semaine = (over: Partial<LabWeek> = {}): LabWeek => ({
  days: ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20'].map((k) => jour(k)),
  progress: {
    strength: { done: 2, planned: 4, next: null },
    running: { doneKm: 18, plannedKm: 30, next: null },
    nutrition: { gPerKg: 1.4, target: PROTEIN_TARGETS_G_PER_KG.maintain, loggedDays: 5 },
    sleep: { goodNights: 3, loggedNights: 5, lastMinutes: 430 },
  },
  proposals: [],
  ...over,
});

const depuisSemaine = (week: LabWeek, resolved: string[] = []) =>
  labSceneFromWeek({
    week,
    activePillars: ['strength', 'running', 'nutrition'],
    objective: 'maintain',
    resolved,
    labels: LABELS,
    reducedMotion: false,
    selected: null,
    focus: null,
  });

// ---------------------------------------------------------------------------
// Vocabulaire
// ---------------------------------------------------------------------------

describe('vocabulaire de la scène', () => {
  it('traduit les piliers de l’app dans ceux de la scène, sommeil compris', () => {
    expect(scenePillar('strength')).toBe('muscu');
    expect(scenePillar('running')).toBe('course');
    expect(scenePillar('nutrition')).toBe('nutrition');
    expect(scenePillar('sleep')).toBe('socle');
  });

  it('🔴 une paire de piliers IDENTIQUES ne produit pas de croisement', () => {
    // Une médaille se pose entre deux disques : avec un seul, il n'y a pas d'entre-deux.
    expect(sceneCrossing('tension', ['nutrition', 'nutrition'])).toBeNull();
    expect(sceneCrossing('tension', ['sleep', 'running'])).toEqual({ kind: 'tension', pair: ['socle', 'course'] });
  });
});

// ---------------------------------------------------------------------------
// Les nuits
// ---------------------------------------------------------------------------

describe('marque de nuit', () => {
  it('🔴 une nuit NON SAISIE reste un trou, jamais une mauvaise nuit', () => {
    // La ramener à 0 dessinerait un anneau de nuits courtes pour quelqu'un qui n'a rien saisi.
    expect(nightMark(null)).toBeNull();
  });

  it('la borne des 7 h sépare bonne et courte nuit', () => {
    expect(nightMark(GOOD_NIGHT_MINUTES)).toBe(1);
    expect(nightMark(GOOD_NIGHT_MINUTES - 1)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Mode semaine
// ---------------------------------------------------------------------------

describe('mode semaine', () => {
  it('reporte le réel de la semaine : séances, kilomètres, nuits, jour courant', () => {
    const week = semaine();
    week.days[1] = jour('2026-09-15', { isToday: true, sleepMinutes: 480 });
    week.days[2] = jour('2026-09-16', { sleepMinutes: 300 });

    const state = depuisSemaine(week);

    expect(state.mode).toBe('week');
    expect(state.reality).toEqual(
      expect.objectContaining({ sessions: 4, sessionsDone: 2, km: 30, kmDone: 18, today: 1 }),
    );
    expect(state.reality!.nights).toEqual([null, 1, 0, null, null, null, null]);
  });

  it('chaque proposition ouverte pose une médaille, un garde-fou allume la garde', () => {
    const week = semaine({
      proposals: [proposition({ id: 'a' }), proposition({ id: 'b', kind: 'overtraining', tone: 'guard', pair: ['sleep', 'strength'] })],
    });

    const state = depuisSemaine(week);

    expect(state.crossings).toEqual([
      { kind: 'tension', pair: ['muscu', 'course'] },
      { kind: 'guard', pair: ['socle', 'muscu'] },
    ]);
    expect(state.values.guard).toBe(true);
  });

  it('🔴 une proposition RÉGLÉE retire sa médaille — et la garde avec elle', () => {
    const week = semaine({ proposals: [proposition({ id: 'a', tone: 'guard' })] });

    const state = depuisSemaine(week, ['a']);

    // Laisser la médaille après application ferait mentir la scène sur l'état du plan.
    expect(state.crossings).toEqual([]);
    expect(state.values.guard).toBe(false);
  });

  it('🔴 sans protéines saisies, aucune vapeur : on ne fabrique pas un remplissage', () => {
    const week = semaine();
    week.progress.nutrition = { gPerKg: null, target: PROTEIN_TARGETS_G_PER_KG.maintain, loggedDays: 0 };

    const state = depuisSemaine(week);

    expect(state.values.fuel).toBe(0);
    // L'assiette reste servie à sa taille neutre plutôt que de se vider comme un jour à 0 g.
    expect(state.reality!.protein).toBe(1);
  });

  it('les piliers désactivés sont éteints dans la scène', () => {
    const state = labSceneFromWeek({
      week: semaine(),
      activePillars: ['strength'],
      objective: 'maintain',
      resolved: [],
      labels: LABELS,
      reducedMotion: true,
      selected: null,
      focus: null,
    });

    expect(state.pillars).toEqual({ muscu: true, course: false, nutrition: false });
    expect(state.reducedMotion).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Mode formule
// ---------------------------------------------------------------------------

describe('mode formule', () => {
  const doses: LabDoses = { strengthSessions: 4, runningFrequency: 3, proteinGPerKg: 1.8, objective: 'maintain', sleep: 'long' };
  const result: LabComposerResult = {
    sbd: null,
    load: null,
    kcalTarget: 2400,
    weightChangeKg: 0,
    proteinGPerDay: 140,
    proteinStatus: 'in',
    carbTarget: null,
    crossings: [
      { kind: 'proteinStrength', tone: 'syn', pair: ['nutrition', 'strength'], values: {} },
      { kind: 'loadRisk', tone: 'guard', pair: ['strength', 'running'], values: {} },
    ],
    changes: [],
  };

  it('🔴 la formule ne montre AUCUN réel : c’est un projet, pas la semaine en cours', () => {
    const state = labSceneFromComposer({ doses, result, activePillars: ['strength', 'running', 'nutrition'], weeklyKm: 30, labels: LABELS, reducedMotion: false, selected: null });

    // Garder les barres du réel sous une formule projetée ferait croire que le plan est déjà tenu.
    expect(state.mode).toBe('formula');
    expect(state.reality).toBeNull();
  });

  it('les croisements gardent leur nature : synergie, tension, garde-fou', () => {
    const state = labSceneFromComposer({ doses, result, activePillars: ['strength', 'running', 'nutrition'], weeklyKm: 30, labels: LABELS, reducedMotion: false, selected: null });

    expect(state.crossings).toEqual([
      { kind: 'syn', pair: ['nutrition', 'muscu'] },
      { kind: 'guard', pair: ['muscu', 'course'] },
    ]);
    expect(state.values.guard).toBe(true);
  });

  it('les doses pilotent l’assiette et les lampes', () => {
    const state = labSceneFromComposer({ doses, result, activePillars: ['strength', 'running', 'nutrition'], weeklyKm: 30, labels: LABELS, reducedMotion: false, selected: null });

    expect(state.values.fq).toBe(4);
    expect(state.values.pr).toBe(1.8);
    expect(state.values.so).toBeGreaterThan(7);
  });
});

// ---------------------------------------------------------------------------
// Enquête et acquis
// ---------------------------------------------------------------------------

describe('enquête', () => {
  const question: LabQuestion = {
    id: 'q-1',
    kind: 'paceFade',
    values: {},
    series: [],
    flatFrom: 0,
    suspects: [
      { kind: 'legsBeforeQuality', pair: ['strength', 'running'], effect: 0.8, level: 'strong', values: {}, proposal: 'collision', experiment: 'legs48h' },
      { kind: 'sleepShort', pair: ['sleep', 'running'], effect: 0.4, level: 'medium', values: {}, proposal: null, experiment: null },
      { kind: 'proteinLow', pair: ['nutrition', 'strength'], effect: 0.2, level: 'weak', values: {}, proposal: 'protein', experiment: null },
    ],
    cleared: [],
    missing: [],
    focus: ['strength', 'running'],
    experiment: 'legs48h',
  };

  it('la caméra s’approche des piliers en cause et ne garde que les deux premiers suspects', () => {
    const state = labSceneWithQuestion(depuisSemaine(semaine()), question);

    // Trois médailles pour trois suspects se chevaucheraient : la scène n'a de la place qu'entre
    // deux disques à la fois.
    expect(state.focus).toEqual(['muscu', 'course']);
    expect(state.crossings).toEqual([
      { kind: 'tension', pair: ['muscu', 'course'] },
      { kind: 'tension', pair: ['socle', 'course'] },
    ]);
  });

  it('sans question, la scène reste celle de la semaine', () => {
    const base = depuisSemaine(semaine({ proposals: [proposition()] }));

    expect(labSceneWithQuestion(base, null)).toBe(base);
  });
});

describe('acquis', () => {
  const carte = (over: Partial<LabKnowledgeCard>): LabKnowledgeCard => ({
    id: 'k-1',
    source: 'association',
    kind: 'shortNightPace',
    status: 'solid',
    pair: ['sleep', 'running'],
    values: {},
    usedBy: 'shortNight',
    ...over,
  });

  it('🔴 seuls les acquis ÉTABLIS deviennent des médailles d’or', () => {
    const state = labSceneWithKnowledge(depuisSemaine(semaine()), [
      carte({ id: 'a', status: 'solid' }),
      carte({ id: 'b', status: 'learning', pair: ['nutrition', 'running'] }),
      carte({ id: 'c', status: 'noLink', pair: ['strength', 'running'] }),
    ]);

    // Afficher « en cours d'apprentissage » comme un acquis transformerait un début de piste en
    // certitude — c'est exactement ce que cet onglet est censé ne pas faire.
    expect(state.crossings).toEqual([{ kind: 'syn', pair: ['socle', 'course'] }]);
    expect(state.focus).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Frontière DOM
// ---------------------------------------------------------------------------

describe('frontière du composant DOM', () => {
  it('🔴 l’état est intégralement sérialisable', () => {
    const week = semaine({ proposals: [proposition()] });
    week.days[0] = jour('2026-09-14', { sleepMinutes: 400, isToday: true });

    const state = depuisSemaine(week);

    // Une fonction ou un `undefined` traverse la frontière WebView sans erreur… et sans valeur :
    // la scène afficherait alors un état muet, impossible à diagnostiquer.
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
