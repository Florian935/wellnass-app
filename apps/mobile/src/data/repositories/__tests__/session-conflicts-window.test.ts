/**
 * US COLLIS-01 — la **fenêtre de lecture** du détecteur de collisions (correctif du 07/08/2026, D7).
 *
 * 🔴 **Le seul test capable d'échouer pour la bonne raison.** Le moteur ne voit que ce qu'on lui
 * donne : on peut le corriger, obtenir 100 % de tests verts sur `packages/shared`, et que **rien ne
 * change sur le device** — il suffit que la requête du repository garde ses 7 jours. Un test de
 * moteur ne peut pas attraper ça, puisqu'il croit à ce qu'on lui passe. Celui-ci part de l'appelant
 * et vérifie les **bornes réellement demandées** (spec R7).
 *
 * Il couvre aussi le second mode d'échec du correctif : **n'élargir qu'une des deux lectures**. Une
 * séance de jambes vue mais non chiffrée donne `setsByMuscle` vide → `isHeavyLegSession` rend
 * `false` → aucun conflit, et le symptôme est **identique à celui d'avant correctif**.
 *
 * Et les deux non-régressions que le correctif met en danger, parce qu'il touche un hook et une
 * requête **partagés** : l'écran de planning doit garder ses 7 jours (sinon une 8ᵉ carte apparaît),
 * et DOUL-01 les siens.
 */
import { renderHook } from '@testing-library/react-native';
import { useQuery } from '@powersync/react';

import {
  SELECT_PLANNED_MUSCLE_SETS,
  useSessionConflicts,
  useWeekPainSignals,
  useWeekPlan,
} from '../planned-session-repository';

const ME = 'user-me';
const WEEK_START = '2026-08-10'; // un lundi
const WEEK_END = '2026-08-16';
const EVE = '2026-08-09'; // le dimanche d'avant — hors semaine affichée

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ session: { user: { id: 'user-me' } } }),
}));

// eslint-disable-next-line no-var
var mockSettings: Record<string, boolean> = {};

jest.mock('@/data/repositories/settings-repository', () => ({
  useSettings: () => ({ settings: mockSettings, isLoading: false }),
}));

// Les quatre exports du module sont fournis : `jest.mock` remplace le module entier, et un hook
// voisin qui appellerait un export manquant échouerait pour une raison étrangère au test.
jest.mock('@/hooks/useTodayKey', () => ({
  useTodayKey: () => '2026-08-10',
  useTodayDate: () => new Date(2026, 7, 10),
  useWindowStartKey: () => '2026-08-10',
  useWindowStartUtc: () => '2026-08-10T00:00:00Z',
}));

jest.mock('@/data/repositories/pain-repository', () => ({
  usePainReports: () => ({ reports: [] }),
}));

const mockedUseQuery = useQuery as jest.MockedFunction<typeof useQuery>;

/**
 * Les paramètres liés de chaque appel à `useQuery`, indexés par la requête SQL.
 *
 * On interroge par **contenu de requête** et non par ordre d'appel : l'ordre dépend de la structure
 * interne du hook, et un test qui s'y accroche casse au premier refactor sans rien dire d'utile.
 */
function boundsOf(match: string): unknown[] | null {
  for (const call of mockedUseQuery.mock.calls) {
    const [sql, params] = call as [string, unknown[]];
    if (typeof sql === 'string' && sql.includes(match)) return params;
  }
  return null;
}

/** La requête des séances planifiées — celle qui donne pilier, statut et type de course. */
const PLANNED_SESSIONS_MARKER = 'FROM planned_sessions';
/** La requête d'enrichissement — celle qui donne les séries par groupe musculaire. */
const MUSCLE_SETS_MARKER = 'e.muscle_primary AS muscle';

beforeEach(() => {
  mockedUseQuery.mockClear();
  mockSettings = {};
});

describe('useSessionConflicts — la fenêtre remonte à la veille (D7)', () => {
  beforeEach(() => {
    mockSettings = { sessionConflictsEnabled: true };
  });

  it('lit les séances planifiées depuis la VEILLE du lundi affiché, pas depuis le lundi', async () => {
    await renderHook(() => useSessionConflicts(WEEK_START));

    // Avant correctif : [ME, '2026-08-10', '2026-08-16'] — la séance du dimanche n'entrait jamais,
    // donc le conflit « jambes dimanche → sortie longue lundi » était structurellement invisible.
    expect(boundsOf(PLANNED_SESSIONS_MARKER)).toEqual([ME, EVE, WEEK_END]);
  });

  it('lit les séries par muscle depuis la VEILLE aussi — élargir une seule lecture ne sert à rien', async () => {
    await renderHook(() => useSessionConflicts(WEEK_START));

    // Sans cette borne, la séance du dimanche remonte mais **sans ses séries** : `setsByMuscle` est
    // vide, `isHeavyLegSession` rend false, et le symptôme est celui d'avant correctif.
    expect(boundsOf(MUSCLE_SETS_MARKER)).toEqual([ME, EVE, WEEK_END]);
  });

  it('garde le verrou de l’opt-in : réglage éteint, aucune des deux lectures ne ramène rien (R2)', async () => {
    mockSettings = { sessionConflictsEnabled: false };

    await renderHook(() => useSessionConflicts(WEEK_START));

    // Le gate est un `owner_id` lié à vide. La fenêtre élargie ne doit pas l'avoir contourné : une
    // fonctionnalité opt-in qui lit quand même serait un manquement, pas une optimisation.
    expect(boundsOf(MUSCLE_SETS_MARKER)).toEqual(['', EVE, WEEK_END]);
  });
});

describe('les fenêtres qui ne doivent PAS bouger', () => {
  it('useWeekPlan garde ses 7 jours — sinon une 8ᵉ carte de jour apparaît sur /planning', async () => {
    await renderHook(() => useWeekPlan(WEEK_START));

    // `useWeekPlan` alimente les cartes de jour de l'écran de planning. Élargir SON contrat, plutôt
    // que celui du seul détecteur, ferait apparaître un dimanche hors semaine en tête d'écran.
    expect(boundsOf(PLANNED_SESSIONS_MARKER)).toEqual([ME, WEEK_START, WEEK_END]);
  });

  it('useWeekPainSignals (DOUL-01) garde ses 7 jours — la requête est partagée, pas le besoin', async () => {
    mockSettings = { painJournalEnabled: true };

    await renderHook(() => useWeekPainSignals(WEEK_START));

    // `SELECT_PLANNED_MUSCLE_SETS` est partagée avec COLLIS-01 mais prend ses bornes en paramètres
    // liés : élargir le détecteur ne doit rien changer ici. Un signal de douleur sur une séance que
    // l'utilisateur ne voit pas à l'écran n'aurait aucun sens.
    expect(boundsOf(MUSCLE_SETS_MARKER)).toEqual([ME, WEEK_START, WEEK_END]);
  });

  it('la constante SQL partagée n’a pas été réécrite — seuls ses paramètres changent', () => {
    // Garde-fou de conception : si un jour quelqu'un code la fenêtre en dur dans le SQL, DOUL-01
    // hériterait silencieusement de la fenêtre de COLLIS-01.
    expect(SELECT_PLANNED_MUSCLE_SETS).toContain('BETWEEN ? AND ?');
  });
});
