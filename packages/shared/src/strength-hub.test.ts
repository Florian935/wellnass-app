import { describe, expect, it } from 'vitest';
import { resolveHubState, resolveProgramProgress, type HubStateInput } from './strength-hub';

const activeWorkout = { exerciseCount: 3, doneSets: 7, totalSets: 18, name: 'Push A' };
const todaySession = {
  sessionId: 's1',
  plannedSessionId: 'p1',
  name: 'Push A',
  orderIndex: 0,
  exerciseCount: 5,
  programName: 'PPL 6 jours',
  previewExercises: ['Développé couché', 'Incliné haltères'],
  estimatedMinutes: 55,
};

/** Situation la plus vide possible : compte neuf. */
const empty: HubStateInput = {
  activeWorkout: null,
  todaySession: null,
  hasActiveProgram: false,
  doneToday: null,
  nextUpcoming: null,
};

describe('resolveHubState', () => {
  it('A — une séance en cours l’emporte sur tout le reste', () => {
    // Le seul cas où l'utilisateur a quelque chose à perdre : il passe devant, même s'il
    // existe aussi une séance planifiée aujourd'hui.
    const state = resolveHubState({
      ...empty,
      activeWorkout,
      todaySession,
      hasActiveProgram: true,
    });
    expect(state.kind).toBe('resume');
  });

  it('B — sans séance active, la séance du jour prend la carte', () => {
    const state = resolveHubState({ ...empty, todaySession, hasActiveProgram: true });
    expect(state).toEqual({ kind: 'today', session: todaySession });
  });

  it('C — programme actif sans séance aujourd’hui : jour de repos', () => {
    const nextUpcoming = { scheduledDate: '2026-09-12', name: 'Pull A' };
    const state = resolveHubState({ ...empty, hasActiveProgram: true, nextUpcoming });
    expect(state).toEqual({ kind: 'rest', doneToday: null, nextUpcoming });
  });

  it('C — la séance du jour déjà faite est un repos, pas une relance', () => {
    // Cas limite de la spec : on ne repropose pas « Démarrer » après coup.
    const doneToday = { name: 'Push A' };
    const state = resolveHubState({ ...empty, hasActiveProgram: true, doneToday });
    expect(state).toEqual({ kind: 'rest', doneToday, nextUpcoming: null });
  });

  it('D — aucun programme actif : c’est l’amorce, pas la séance libre', () => {
    // Le défaut corrigé : le hub mettait « Séance libre » en action principale.
    expect(resolveHubState(empty)).toEqual({ kind: 'onboarding' });
  });

  it('ne retourne jamais deux états : un seul `kind` par situation', () => {
    const situations: HubStateInput[] = [
      empty,
      { ...empty, hasActiveProgram: true },
      { ...empty, todaySession, hasActiveProgram: true },
      { ...empty, activeWorkout, todaySession, hasActiveProgram: true },
    ];
    const kinds = situations.map((s) => resolveHubState(s).kind);
    expect(kinds).toEqual(['onboarding', 'rest', 'today', 'resume']);
  });
});

describe('resolveProgramProgress', () => {
  it('rend une semaine 1-based lisible', () => {
    // week_index est 0-based en base ; « semaine 0 sur 8 » n'a aucun sens à l'écran.
    expect(resolveProgramProgress({
      currentWeekIndex: 2, durationWeeks: 8, doneSessions: 14, totalSessions: 24,
    })).toEqual({ week: 3, totalWeeks: 8, done: 14, total: 24, ratio: 14 / 24 });
  });

  it('borne la semaine à la durée du programme', () => {
    // Une séance rattrapée en retard ne doit pas afficher « semaine 9 sur 8 ».
    const p = resolveProgramProgress({
      currentWeekIndex: 11, durationWeeks: 8, doneSessions: 24, totalSessions: 24,
    });
    expect(p?.week).toBe(8);
  });

  it('borne les séances faites au total', () => {
    const p = resolveProgramProgress({
      currentWeekIndex: 0, durationWeeks: 4, doneSessions: 99, totalSessions: 12,
    });
    expect(p?.done).toBe(12);
    expect(p?.ratio).toBe(1);
  });

  it('traite une semaine inconnue comme la première', () => {
    const p = resolveProgramProgress({
      currentWeekIndex: null, durationWeeks: 8, doneSessions: 0, totalSessions: 24,
    });
    expect(p?.week).toBe(1);
  });

  it('ne rend rien quand le programme n’a ni durée ni séance', () => {
    expect(resolveProgramProgress({
      currentWeekIndex: 0, durationWeeks: null, doneSessions: 0, totalSessions: 12,
    })).toBeNull();
    expect(resolveProgramProgress({
      currentWeekIndex: 0, durationWeeks: 8, doneSessions: 0, totalSessions: 0,
    })).toBeNull();
  });
});
