/**
 * US PRISME-01 — l'assemblage des faits du soir, à partir de ce que les repositories savent déjà.
 * Pur : aucune base, aucun React. C'est ici que se décide ce qui figure sur la carte « Ta journée »,
 * donc ce qui peut partir chez le fournisseur (liste blanche, spec R4).
 */
import { assembleEveningFacts, type EveningSources } from '../evening-facts';

const TODAY = '2026-10-02';
/** Un instant local du jour donné : l'assemblage compare des jours **locaux**. */
const at = (day: string, hour: number) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`).toISOString();

const BASE: EveningSources = {
  todayKey: TODAY,
  tomorrowKey: '2026-10-03',
  dayLabel: 'vendredi 2 octobre',
  workouts: [
    { startedAt: at(TODAY, 18), finishedAt: at(TODAY, 19), durationSeconds: 3120, volumeKg: 8420.4, recordCount: 1 },
    // Hier : ne compte pas.
    { startedAt: at('2026-10-01', 18), finishedAt: at('2026-10-01', 19), durationSeconds: 3000, volumeKg: 9000, recordCount: 0 },
    // En cours : ne compte pas.
    { startedAt: at(TODAY, 20), finishedAt: null, durationSeconds: null, volumeKg: 0, recordCount: 0 },
  ],
  runs: [{ startedAt: at(TODAY, 7), finishedAt: at(TODAY, 8), durationSeconds: 1860, distanceM: 5240, avgPaceSPerKm: 355 }],
  activities: [{ durationSeconds: 2400 }],
  nutrition: { kcal: 2140.6, target: 2450, proteinG: 118.2, proteinTarget: 150, carbsG: 236, meals: 3 },
  plannedTomorrow: [
    { scheduledTime: '18:30:00', pillar: 'strength', targetDistanceM: null, status: 'planned', orderIndex: 1 },
    { scheduledTime: '09:00:00', pillar: 'running', targetDistanceM: 14000, status: 'planned', orderIndex: 0 },
  ],
  week: { done: 3, goal: 4 },
  realLife: false,
  activePillars: { strength: true, running: true, nutrition: true },
};

describe('assembleEveningFacts', () => {
  it('ne garde que ce qui est TERMINÉ aujourd’hui, séances, sorties et autres activités', () => {
    const facts = assembleEveningFacts(BASE);
    expect(facts.sessions).toEqual([
      { type: 'strength', minutes: 52, tonnageKg: 8420.4, setsDone: null, setsPlanned: null, records: 1 },
      { type: 'run', minutes: 31, distanceKm: 5.24, paceSPerKm: 355 },
      { type: 'other', minutes: 40 },
    ]);
    expect(facts.dayLabel).toBe('vendredi 2 octobre');
  });

  it('l’assiette, seulement quand un repas est saisi et le pilier actif', () => {
    expect(assembleEveningFacts(BASE).plate).toEqual({
      kcal: 2141,
      targetKcal: 2450,
      proteinG: 118,
      targetProteinG: 150,
      carbsG: 236,
      meals: 3,
    });
    expect(assembleEveningFacts({ ...BASE, nutrition: { ...BASE.nutrition, meals: 0 } }).plate).toBeNull();
    expect(
      assembleEveningFacts({ ...BASE, activePillars: { ...BASE.activePillars, nutrition: false } }).plate,
    ).toBeNull();
  });

  it('demain : la PREMIÈRE séance prévue, son type, son heure, sa distance', () => {
    expect(assembleEveningFacts(BASE).tomorrow).toEqual({ type: 'run', time: '09:00', distanceKm: 14 });
    expect(assembleEveningFacts({ ...BASE, plannedTomorrow: [] }).tomorrow).toBeNull();
  });

  it('une séance de demain sautée ou faite n’est pas annoncée', () => {
    const skipped = assembleEveningFacts({
      ...BASE,
      plannedTomorrow: [{ scheduledTime: null, pillar: 'strength', targetDistanceM: null, status: 'skipped', orderIndex: 0 }],
    });
    expect(skipped.tomorrow).toBeNull();
  });

  it('sans heure, demain se dit sans heure', () => {
    const noTime = assembleEveningFacts({
      ...BASE,
      plannedTomorrow: [{ scheduledTime: null, pillar: 'strength', targetDistanceM: null, status: 'planned', orderIndex: 0 }],
    });
    expect(noTime.tomorrow).toEqual({ type: 'strength', time: null, distanceKm: null });
  });

  it('🔴 un pilier inactif ne produit rien (intégration sans imposition, décision H)', () => {
    const facts = assembleEveningFacts({ ...BASE, activePillars: { strength: false, running: false, nutrition: true } });
    expect(facts.sessions.map((s) => s.type)).toEqual(['other']);
  });

  it('la semaine, seulement si un objectif est réglé', () => {
    expect(assembleEveningFacts(BASE).week).toEqual({ done: 3, goal: 4 });
    expect(assembleEveningFacts({ ...BASE, week: { done: 3, goal: null } }).week).toBeNull();
  });

  it('une durée absente se déduit des bornes de la séance', () => {
    const facts = assembleEveningFacts({
      ...BASE,
      runs: [],
      activities: [],
      workouts: [{ startedAt: at(TODAY, 18), finishedAt: at(TODAY, 19), durationSeconds: null, volumeKg: 1000, recordCount: 0 }],
    });
    expect(facts.sessions[0]).toMatchObject({ minutes: 60 });
  });

  it('porte le mode vie réelle', () => {
    expect(assembleEveningFacts({ ...BASE, realLife: true }).realLife).toBe(true);
  });

  it('une sortie sans distance ni allure garde ses minutes', () => {
    const facts = assembleEveningFacts({
      ...BASE,
      workouts: [],
      activities: [],
      runs: [{ startedAt: at(TODAY, 7), finishedAt: at(TODAY, 8), durationSeconds: 1200, distanceM: null, avgPaceSPerKm: null }],
    });
    expect(facts.sessions).toEqual([{ type: 'run', minutes: 20, distanceKm: 0, paceSPerKm: null }]);
  });
});
