/**
 * US NORYN-02 — les cibles et le verdict servis à Noryn : **les mêmes valeurs que l'app**.
 *
 * Les chiffres attendus sont ceux du filet du mobile (`day-calorie-target-assembly`,
 * `day-nutrition-targets-assembly`, `readiness-assembly`), sur le profil A : 80 kg, 180 cm, 30 ans au
 * 08/10/2026 ; `tdee` « modéré » 2 759, socle hors sport 2 448 ; sèche −400. Quand une valeur dépend
 * d'une estimation (dépense, course), elle est comparée à la composition appelée sur les entrées que
 * l'app lui passerait : même entrée, même sortie.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { dayEnergyTotals, energyItemsByDay } from '../day-energy';
import { estimateRunCalories } from '../running';
import { buildNorynDay } from './day';
import { NOW, OWNER, emptySnapshot } from './noryn.testkit';
import {
  bonusModeOf,
  decodeDailyKcal,
  decodeReadinessWellbeing,
  decodeTargetNutrition,
  decodeTargetProfile,
  decodeWeights,
  type OwnerSnapshot,
  type ReadinessRows,
  type TargetRows,
} from './snapshot';
import { ageInstantOf, norynReadiness, norynTargets, parisDayKeyOf } from './targets';

const TODAY = '2026-10-08';

const profileRow = {
  user_id: OWNER,
  birth_date: '1996-01-15',
  sex: 'male',
  height_cm: 180,
  weight_kg: 80,
  main_goal: 'muscle',
};
const nutritionRow = (over: Partial<TargetRows['nutritionProfile']> = {}) => ({
  user_id: OWNER,
  objective: 'cut',
  activity_level: 'moderate',
  manual_calories: null,
  manual_protein_g: null,
  manual_carbs_g: null,
  manual_fat_g: null,
  training_day_bonus: 300,
  training_bonus_mode: 'fixed',
  sport_free_level: null,
  ...over,
});
const targetRows = (over: Partial<TargetRows> = {}): TargetRows => ({
  date: TODAY,
  profile: profileRow,
  nutritionProfile: nutritionRow(),
  periods: [],
  latestWeight: null,
  weightAtDate: null,
  oldestWeight: null,
  workouts: [],
  workoutSets: [],
  runs: [],
  activities: [],
  ...over,
});
const snapshotWith = (targets: TargetRows | null, over: Partial<OwnerSnapshot> = {}) => emptySnapshot({ targets, ...over });
const targetsOn = (date: string, rows: Partial<TargetRows> = {}, over: Partial<OwnerSnapshot> = {}) =>
  norynTargets(snapshotWith(targetRows(rows), over), { date, today: TODAY });

const workout = (finishedAt: string, id = 'w1') => ({
  user_id: OWNER,
  id,
  started_at: new Date(new Date(finishedAt).getTime() - 3_600_000).toISOString(),
  finished_at: finishedAt,
  duration_seconds: 3600,
  rpe: 7,
});
const run = (finishedAt: string, status = 'completed') => ({
  user_id: OWNER,
  id: `r-${status}`,
  status,
  finished_at: finishedAt,
  duration_seconds: 2700,
  distance_m: 8000,
  elevation_gain_m: 50,
  rpe: 5,
});
const planned = (date: string, status = 'planned') => ({
  owner_id: OWNER,
  id: `p-${date}-${status}`,
  scheduled_date: date,
  scheduled_time: null,
  status,
  session_id: 's',
  program_id: 'p',
});

describe('norynTargets — mode `fixed` (valeurs du filet du mobile)', () => {
  it('repos : 2 359 kcal, 236 g', () => {
    expect(targetsOn(TODAY)).toEqual({ energyTargetKcal: 2359, proteinTargetG: 236 });
  });

  it('séance faite ce jour : forfait, protéines inchangées (le bonus va aux glucides)', () => {
    expect(targetsOn(TODAY, { workouts: [workout('2026-10-08T17:00:00.000Z')] })).toEqual({
      energyTargetKcal: 2659,
      proteinTargetG: 236,
    });
  });

  it('séance finie le jeudi à 00 h 30 à Paris (mercredi en UTC) : comptée le jeudi', () => {
    const rows = { workouts: [workout('2026-10-07T22:30:00.000Z')] };
    expect(targetsOn(TODAY, rows).energyTargetKcal).toBe(2659);
    expect(targetsOn('2026-10-07', rows).energyTargetKcal).toBe(2359);
  });

  it('autre activité seule : forfait aussi', () => {
    const activity = {
      user_id: OWNER,
      id: 'a',
      activity_type: 'bike',
      started_at: '2026-10-08T15:00:00.000Z',
      duration_seconds: 3600,
      intensity: 'moderate',
      rpe: 6,
      distance_m: 25_000,
      device_kcal: null,
    };
    expect(targetsOn(TODAY, { activities: [activity] }).energyTargetKcal).toBe(2659);
  });

  it('date future : forfait anticipé si une séance `planned`/`done` y est prévue, pas si elle est `skipped`', () => {
    expect(targetsOn('2026-10-11', {}, { planned: [planned('2026-10-11')] }).energyTargetKcal).toBe(2659);
    expect(targetsOn('2026-10-11', {}, { planned: [planned('2026-10-11', 'skipped')] }).energyTargetKcal).toBe(2359);
    // Jamais pour un jour passé.
    expect(targetsOn('2026-10-06', {}, { planned: [planned('2026-10-06')] }).energyTargetKcal).toBe(2359);
  });

  it('période « vie réelle » couvrant la date : maintien', () => {
    expect(targetsOn(TODAY, { periods: [{ user_id: OWNER, started_on: TODAY, ends_on: TODAY }] }).energyTargetKcal).toBe(2759);
  });

  it('surcharge manuelle : prime, forfait ajouté', () => {
    expect(
      targetsOn(TODAY, {
        nutritionProfile: nutritionRow({ manual_calories: 2000 }),
        workouts: [workout('2026-10-08T17:00:00.000Z')],
      }).energyTargetKcal,
    ).toBe(2300);
  });

  it('l’âge est celui d’aujourd’hui à Paris, quelle que soit la date demandée (DD6)', () => {
    // Né le 15/10/1996 : 29 ans le 08/10/2026, 30 le 20/10. L'app prend l'âge du jour pour toute date.
    const rows = { profile: { ...profileRow, birth_date: '1996-10-15' } };
    expect(targetsOn('2026-10-20', rows).energyTargetKcal).toBe(2767 - 400);
    expect(ageInstantOf(TODAY).toISOString()).toBe('2026-10-08T12:00:00.000Z');
  });
});

describe('norynTargets — mode `auto`', () => {
  const auto = { nutritionProfile: nutritionRow({ training_bonus_mode: 'auto' }) };

  it('course terminée ce jour : dépense au poids de la dernière pesée', () => {
    const kcal = estimateRunCalories({ distanceM: 8000, durationSeconds: 2700, weightKg: 75 });
    expect(
      targetsOn(TODAY, { ...auto, latestWeight: { user_id: OWNER, log_date: '2026-10-05', weight_kg: 75 }, runs: [run('2026-10-08T06:00:00.000Z')] }),
    ).toEqual({ energyTargetKcal: 2359 + kcal, proteinTargetG: 236 });
  });

  it('une course non terminée ne fait ni jour d’entraînement ni bonus', () => {
    expect(targetsOn(TODAY, { ...auto, runs: [run('2026-10-08T06:00:00.000Z', 'active')] }).energyTargetKcal).toBe(2359);
  });
});

describe('norynTargets — mode `activities` (D1-A)', () => {
  const activities = nutritionRow({ training_bonus_mode: 'activities' });

  it('repos : socle hors sport, 2 048 kcal, 205 g', () => {
    expect(targetsOn(TODAY, { nutritionProfile: activities })).toEqual({ energyTargetKcal: 2048, proteinTargetG: 205 });
  });

  it('séance, course (tout statut) et activité du jour : la dépense de l’app, au poids de la date', () => {
    const rows: Partial<TargetRows> = {
      nutritionProfile: activities,
      weightAtDate: { user_id: OWNER, log_date: '2026-10-05', weight_kg: 79.5 },
      oldestWeight: { user_id: OWNER, log_date: '2026-09-01', weight_kg: 81 },
      workouts: [workout('2026-10-08T17:00:00.000Z')],
      workoutSets: Array.from({ length: 18 }, () => ({ user_id: OWNER, workout_id: 'w1' })),
      runs: [run('2026-10-08T06:00:00.000Z', 'cancelled')],
      activities: [
        {
          user_id: OWNER,
          id: 'a',
          activity_type: 'parapente',
          started_at: '2026-10-08T10:00:00.000Z',
          duration_seconds: 1800,
          intensity: 'light',
          rpe: 3,
          distance_m: null,
          device_kcal: 120,
        },
      ],
    };
    // Ce que l'app retiendrait sur les mêmes entrées.
    const energy = dayEnergyTotals(
      energyItemsByDay({
        profile: { sex: 'male', heightCm: 180, birthDate: '1996-01-15', weightKg: 80 },
        weightEntries: [{ logDate: '2026-10-05', weightKg: 79.5 }, { logDate: '2026-09-01', weightKg: 81 }],
        workouts: [{ id: 'w1', startedAt: '2026-10-08T16:00:00.000Z', finishedAt: '2026-10-08T17:00:00.000Z', durationSeconds: 3600, rpe: 7, totalSets: 18 }],
        finishedRuns: [{ id: 'r-cancelled', finishedAt: '2026-10-08T06:00:00.000Z', distanceM: 8000, durationSeconds: 2700, elevationGainM: 50, rpe: 5 }],
        activities: [{ id: 'a', activityType: 'parapente', startedAt: '2026-10-08T10:00:00.000Z', durationSeconds: 1800, intensity: 'light', rpe: 3, distanceM: null, deviceKcal: 120 }],
        dayKeyOf: parisDayKeyOf,
        at: ageInstantOf(TODAY),
      }).get(TODAY) ?? [],
    ).targetKcal;
    expect(energy).toBeGreaterThan(120);
    expect(targetsOn(TODAY, rows)).toEqual({ energyTargetKcal: 2048 + energy, proteinTargetG: 205 });
  });

  it('date future : pas de dépense, pas d’anticipation', () => {
    expect(targetsOn('2026-10-11', { nutritionProfile: activities }, { planned: [planned('2026-10-11')] }).energyTargetKcal).toBe(2048);
  });
});

describe('norynTargets — protéines, bornes, entrées invalides', () => {
  it('protéines manuelles : la saisie, même sans cible calorique (DD7)', () => {
    expect(
      targetsOn(TODAY, { profile: { ...profileRow, birth_date: null }, nutritionProfile: nutritionRow({ manual_protein_g: 150 }) }),
    ).toEqual({ energyTargetKcal: null, proteinTargetG: 150 });
  });

  it('une seule macro manuelle sans les protéines : `null` (0 g dans l’app)', () => {
    expect(targetsOn(TODAY, { nutritionProfile: nutritionRow({ manual_carbs_g: 200 }) }).proteinTargetG).toBeNull();
  });

  it('objectif jamais posé : celui du but principal, comme l’onglet Nutrition (DD7)', () => {
    expect(targetsOn(TODAY, { nutritionProfile: nutritionRow({ objective: null }) }).energyTargetKcal).not.toBeNull();
  });

  it('hors bornes : `null`, jamais rognée (DD1)', () => {
    expect(targetsOn(TODAY, { nutritionProfile: nutritionRow({ manual_calories: 25_000 }) }).energyTargetKcal).toBeNull();
  });

  it('une énumération hors domaine (protégée par un CHECK) : aucune cible (DD4)', () => {
    expect(targetsOn(TODAY, { nutritionProfile: nutritionRow({ objective: 'jeûne' }) })).toEqual({
      energyTargetKcal: null,
      proteinTargetG: null,
    });
    expect(targetsOn(TODAY, { profile: { ...profileRow, sex: 'x' } }).energyTargetKcal).toBeNull();
    expect(
      targetsOn(TODAY, {
        activities: [
          { user_id: OWNER, id: 'a', activity_type: 'bike', started_at: '2026-10-08T10:00:00.000Z', duration_seconds: 60, intensity: 'extrême', rpe: null, distance_m: null, device_kcal: null },
        ],
      }).energyTargetKcal,
    ).toBeNull();
  });

  it('sans entrées (pilier Nutrition éteint, jamais synchronisé) : rien', () => {
    expect(norynTargets(snapshotWith(null), { date: TODAY, today: TODAY })).toEqual({ energyTargetKcal: null, proteinTargetG: null });
  });
});

describe('norynReadiness — le verdict d’aujourd’hui (D4)', () => {
  const readinessRows = (over: Partial<ReadinessRows> = {}): ReadinessRows => ({
    workouts: [],
    runs: [],
    activities: [],
    food: [],
    wellbeing: [],
    ...over,
  });
  const verdict = (rows: Partial<ReadinessRows>, over: Partial<OwnerSnapshot> = {}) =>
    norynReadiness(emptySnapshot({ readiness: readinessRows(rows), targets: targetRows(), ...over }), { today: TODAY });

  it('rien d’évaluable : `null` (l’app n’affiche pas de verdict)', () => {
    expect(verdict({})).toBeNull();
    expect(norynReadiness(emptySnapshot(), { today: TODAY })).toBeNull();
  });

  it('charge basse : `push` ; énergie basse : `rest`', () => {
    expect(verdict({ workouts: [{ user_id: OWNER, finished_at: '2026-09-11T10:00:00.000Z', duration_seconds: 3600, rpe: 5 }] })).toBe('push');
    expect(verdict({ wellbeing: [{ user_id: OWNER, log_date: TODAY, energy: 1, stress: 3, sleep_minutes: null, sleep_quality: null, sick: false }] })).toBe('rest');
  });

  it('« malade » ce matin : `rest` pilier Bien-être allumé (réglages du jeu), ignoré éteint', () => {
    const wellbeing = [{ user_id: OWNER, log_date: TODAY, energy: 5, stress: 1, sleep_minutes: 480, sleep_quality: 5, sick: true }];
    expect(verdict({ wellbeing })).toBe('rest');
    const off = { ...emptySnapshot().settings!, wellbeing_pillar_enabled: false };
    expect(verdict({ wellbeing }, { settings: off })).toBe('push');
  });

  it('nutrition contre la cible **de base** d’aujourd’hui (2 359), jours notés depuis J−6', () => {
    const food = ['2026-10-02', '2026-10-05', '2026-10-07', TODAY].map((log_date) => ({ user_id: OWNER, log_date, kcal: 1600 }));
    expect(verdict({ food })).toBe('rest');
    // Sans entrées de cible (non lues) : composante indisponible, pas de verdict.
    expect(verdict({ food }, { targets: null })).toBeNull();
    // Entrées lues pour une autre date : jamais prises pour la cible d'aujourd'hui.
    expect(verdict({ food }, { targets: targetRows({ date: '2026-10-07' }) })).toBeNull();
  });
});

describe('buildNorynDay — les trois champs (spec §5)', () => {
  const synced = (over: Partial<OwnerSnapshot> = {}) =>
    emptySnapshot({ targets: targetRows(), readiness: { workouts: [{ user_id: OWNER, finished_at: '2026-09-11T10:00:00.000Z', duration_seconds: 3600, rpe: 5 }], runs: [], activities: [], food: [], wellbeing: [] }, ...over });

  it('aujourd’hui : cibles et verdict', () => {
    const day = buildNorynDay(synced(), { date: TODAY, now: NOW });
    expect(day.nutrition).toMatchObject({ energy_target_kcal: 2359, protein_target_g: 236 });
    expect(day.readiness).toBe('push');
  });

  it('une autre date : cibles, verdict `null`', () => {
    const day = buildNorynDay(synced(), { date: '2026-10-07', now: NOW });
    expect(day.nutrition?.energy_target_kcal).toBe(2359);
    expect(day.readiness).toBeNull();
  });

  it('jamais synchronisé : ni cible, ni verdict (DD2)', () => {
    const day = buildNorynDay(synced({ receivedAt: null }), { date: TODAY, now: NOW });
    expect(day.nutrition).toMatchObject({ energy_target_kcal: null, protein_target_g: null });
    expect(day.readiness).toBeNull();
  });

  it('pilier Nutrition éteint : `nutrition` `null`, verdict servi (DD3)', () => {
    const settings = { ...emptySnapshot().settings!, active_pillars: ['strength', 'running'] };
    const day = buildNorynDay(synced({ settings }), { date: TODAY, now: NOW });
    expect(day.nutrition).toBeNull();
    expect(day.readiness).toBe('push');
  });

  it('une exception : ce seul champ à `null`, un code fixe au journal (DD8)', () => {
    const codes: string[] = [];
    const broken = synced();
    Object.defineProperty(broken.targets!, 'profile', { get: () => { throw new Error('boum'); } });
    Object.defineProperty(broken.readiness!, 'wellbeing', { get: () => { throw new Error('boum'); } });
    const day = buildNorynDay(broken, { date: TODAY, now: NOW, log: (code) => codes.push(code) });
    expect(day.nutrition).toMatchObject({ energy_target_kcal: null, protein_target_g: null, energy_kcal: null });
    expect(day.readiness).toBeNull();
    expect(codes).toEqual(['target_error', 'readiness_error']);
    // Sans journal fourni, rien ne lève non plus.
    expect(() => buildNorynDay(broken, { date: TODAY, now: NOW })).not.toThrow();
  });
});

describe('R1 — aucune formule côté Noryn (test-garde)', () => {
  it('`targets.ts` n’importe que les compositions, les décodeurs et les dates de Paris', () => {
    const source = readFileSync(fileURLToPath(new URL('./targets.ts', import.meta.url)), 'utf8');
    // Toute instruction qui fait entrer du code d'ailleurs : `import …`, `export … from`, imports de
    // simple effet ou dynamiques. Chacune doit être reconnue ci-dessous, sinon le test échoue.
    const statements = [...source.matchAll(/^\s*(?:import|export)\b[^;]*?(?:from\s+)?'[^']+'\s*;/gms)].map((m) => m[0]);
    expect(source).not.toMatch(/\bimport\s*\(/);
    expect(source).not.toMatch(/\brequire\s*\(/);
    const allowed: Record<string, string[]> = {
      '../day-energy': ['dayEnergyTotals', 'energyItemsByDay'],
      '../day-target': ['composeDayCalorieTarget', 'dayMacroTargets', 'trainedOnDay'],
      '../readiness': ['composeReadiness', 'ReadinessVerdict'],
      './paris-date': ['parisDayKey'],
      './snapshot': [
        'activePillarsOf',
        'bonusModeOf',
        'boundedInt',
        'decodeActivities',
        'decodeActivityLoad',
        'decodeCompletedRuns',
        'decodeDailyKcal',
        'decodeEnergyWorkouts',
        'decodeFinishedRuns',
        'decodeLoad',
        'decodePeriods',
        'decodeReadinessWellbeing',
        'decodeTargetNutrition',
        'decodeTargetProfile',
        'decodeWeights',
        'hasPlannedOn',
        'OwnerSnapshot',
        'TargetRows',
      ],
    };
    expect(statements.length).toBeGreaterThan(0);
    for (const statement of statements) {
      const match = /^\s*import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'\s*;$/s.exec(statement);
      // Seuls les imports nommés `import { … } from '…'` sont permis : ni `* as`, ni défaut, ni ré-export.
      expect(match, statement).not.toBeNull();
      const [, names, from] = match!;
      expect(Object.keys(allowed)).toContain(from);
      for (const name of names!.split(',').map((n) => n.trim().replace(/^type\s+/, '')).filter(Boolean)) {
        expect(allowed[from!]).toContain(name);
      }
    }
  });
});

describe('décodeurs des lignes Postgres (spec D8, R4)', () => {
  it('sans ligne : `null` ; but principal hors domaine : invalide ; mode absent : `fixed`', () => {
    expect(decodeTargetProfile(null)).toBeNull();
    expect(decodeTargetNutrition(null)).toBeNull();
    expect(decodeTargetProfile({ ...profileRow, main_goal: 'devenir-astronaute' })).toBe('invalid');
    expect(decodeTargetProfile({ ...profileRow, sex: null, main_goal: null })).toMatchObject({ sex: null, mainGoal: null });
    expect(bonusModeOf(null)).toBe('fixed');
  });

  it('sans profil ni profil nutritionnel : pas de cible calorique', () => {
    expect(targetsOn(TODAY, { profile: null, nutritionProfile: null })).toEqual({ energyTargetKcal: null, proteinTargetG: null });
  });

  it('totaux par jour : additionnés, arrondis jour par jour, triés ; un jour à 0 compte', () => {
    expect(
      decodeDailyKcal([
        { user_id: OWNER, log_date: '2026-10-03', kcal: 0 },
        { user_id: OWNER, log_date: '2026-10-02', kcal: 600.4 },
        { user_id: OWNER, log_date: '2026-10-02', kcal: 650.4 },
      ]),
    ).toEqual([
      { logDate: '2026-10-02', kcal: 1251 },
      { logDate: '2026-10-03', kcal: 0 },
    ]);
  });

  it('check-ins du verdict : « malade » strict, rien d’autre de la ligne', () => {
    expect(
      decodeReadinessWellbeing([{ user_id: OWNER, log_date: TODAY, energy: 3, stress: 4, sleep_minutes: 400, sleep_quality: 3, sick: null }]),
    ).toEqual([{ logDate: TODAY, energy: 3, stress: 4, sleepMinutes: 400, sleepQuality: 3, sick: false, deletedAt: null }]);
  });

  it('pesées : les absentes écartées', () => {
    expect(decodeWeights([null, { user_id: OWNER, log_date: '2026-10-05', weight_kg: 79.5 }])).toEqual([
      { logDate: '2026-10-05', weightKg: 79.5 },
    ]);
  });
});

describe('NORYN-02 — cas de bord de la relecture du code', () => {
  it('changement d’heure : une séance finie le lundi 26/10/2026 à 00 h 30 à Paris (dimanche 23 h 30 UTC) compte le lundi', () => {
    const rows = { workouts: [workout('2026-10-25T23:30:00.000Z')] };
    const today = '2026-10-26';
    expect(norynTargets(snapshotWith(targetRows({ ...rows, date: today })), { date: today, today }).energyTargetKcal).toBe(2659);
    expect(norynTargets(snapshotWith(targetRows({ ...rows, date: '2026-10-25' })), { date: '2026-10-25', today }).energyTargetKcal).toBe(2359);
  });

  it('la nuit d’un anniversaire : à 00 h 30 à Paris (22 h 30 UTC la veille), l’âge a déjà changé', () => {
    // Né le 09/10/1996. Le 08/10 à 22 h 30 UTC, il est 00 h 30 le 09/10 à Paris : 30 ans (et non 29 en UTC).
    const born = targetRows({ date: '2026-10-09', profile: { ...profileRow, birth_date: '1996-10-09' } });
    const day = buildNorynDay(emptySnapshot({ targets: born }), { date: '2026-10-09', now: new Date('2026-10-08T22:30:00.000Z') });
    expect(day.nutrition?.energy_target_kcal).toBe(2359);
  });

  it('instants au format PostgREST (microsecondes, `+00:00`) : lus comme les autres', () => {
    const postgrest = { ...workout('2026-10-08T17:00:00.000Z'), started_at: '2026-10-08T16:00:00.123456+00:00', finished_at: '2026-10-08T17:00:00.123456+00:00' };
    expect(targetsOn(TODAY, { workouts: [postgrest] }).energyTargetKcal).toBe(2659);
    expect(parisDayKeyOf('2026-10-07T22:30:00.123456+00:00')).toBe(TODAY);
  });
});
