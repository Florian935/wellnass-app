/**
 * Écran de séance — la **machine à états du focus** et les formats de saisie.
 *
 * `workout.tsx` est le plus gros écran à état de l'app (585 lignes). Sa substance n'est pas le
 * rendu : c'est `resolveCurrentSet`, qui décide **quelle série est « en cours »**. Cette fonction
 * est appelée à chaque rendu, et une erreur y est silencieuse — l'écran affiche simplement la
 * mauvaise série. L'utilisateur valide alors des reps sur la mauvaise ligne, et s'en aperçoit à la
 * fin de la séance, quand plus rien n'est corrigeable de tête.
 *
 * Trois règles y cohabitent, dans cet ordre de priorité :
 *  1. la dérogation de focus **avec rang** — la bascule superset, qui vise la série JUMELLE ;
 *  2. la dérogation de focus **sans rang** — un tap dans la liste, qui vise l'exercice ;
 *  3. l'ordre naturel — 1ʳᵉ série non validée, exercices puis séries.
 *
 * Chacune doit **retomber sur la suivante** quand elle ne s'applique pas. C'est cette cascade qui
 * est testée ici : un retour anticipé mal placé transformerait un tap sur un exercice terminé en
 * écran vide (« séance terminée ») alors qu'il reste des séries ailleurs.
 */

import {
  findSupersetPartnerSet,
  formatLastPerf,
  formatMmSs,
  parseMmSs,
  resolveCurrentSet,
  type CurrentSet,
} from '../workout';
import type { WorkoutEntry, WorkoutSetItem } from '@/data/repositories/workout-repository';

jest.mock('@/powersync/system', () => ({ powerSync: {}, connector: {} }));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let compteur = 0;

/** Une série. `done` seul suffit à décrire les cas de focus ; le reste est du remplissage. */
function serie(done: boolean, overrides: Partial<WorkoutSetItem> = {}): WorkoutSetItem {
  compteur += 1;
  return {
    id: `set-${compteur}`,
    exerciseId: 'x',
    setType: 'normal',
    reps: null,
    weightKg: null,
    durationSeconds: null,
    done,
    orderIndex: compteur,
    rpe: null,
    plannedWeightKg: null,
    ...overrides,
  };
}

/** Un exercice de la séance, décrit par la suite des `done` de ses séries. */
function exercice(exerciseId: string, dones: boolean[]): WorkoutEntry {
  return {
    exerciseId,
    exerciseName: exerciseId.toUpperCase(),
    sets: dones.map((d) => serie(d, { exerciseId })),
  };
}

/** Identifie une résolution par « exercice + rang », plus lisible qu'un id de série. */
const at = (c: CurrentSet | null) => (c === null ? null : `${c.entry.exerciseId}#${c.rang}`);

beforeEach(() => {
  compteur = 0;
});

// ---------------------------------------------------------------------------
// Ordre naturel — aucune dérogation
// ---------------------------------------------------------------------------

describe('ordre naturel', () => {
  it('prend la 1ʳᵉ série non validée du 1ᵉʳ exercice', () => {
    const entries = [exercice('squat', [false, false]), exercice('bench', [false])];

    expect(at(resolveCurrentSet(entries, null))).toBe('squat#0');
  });

  it('saute les séries déjà validées à l’intérieur d’un exercice', () => {
    const entries = [exercice('squat', [true, true, false])];

    expect(at(resolveCurrentSet(entries, null))).toBe('squat#2');
  });

  it('passe à l’exercice suivant quand le premier est terminé', () => {
    const entries = [exercice('squat', [true, true]), exercice('bench', [false])];

    expect(at(resolveCurrentSet(entries, null))).toBe('bench#0');
  });

  it('🔴 ne saute PAS un trou : une série dé-validée redevient la série courante', () => {
    // Dé-valider une série depuis la liste dépliée (C1) doit ramener le focus dessus, sinon
    // l'utilisateur corrige une faute de frappe et l'écran continue d'afficher la série suivante.
    const entries = [exercice('squat', [true, false, true])];

    expect(at(resolveCurrentSet(entries, null))).toBe('squat#1');
  });

  it('rend null quand tout est validé — état de fin de séance', () => {
    const entries = [exercice('squat', [true]), exercice('bench', [true])];

    expect(resolveCurrentSet(entries, null)).toBeNull();
  });

  it('rend null sur une séance sans exercice', () => {
    expect(resolveCurrentSet([], null)).toBeNull();
  });

  it('rend null sur un exercice sans aucune série', () => {
    expect(resolveCurrentSet([exercice('squat', [])], null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Dérogation sans rang — le tap dans la liste
// ---------------------------------------------------------------------------

describe('dérogation de focus sur un exercice', () => {
  it('vise la 1ʳᵉ série non validée de l’exercice désigné', () => {
    const entries = [exercice('squat', [false]), exercice('bench', [true, false])];

    expect(at(resolveCurrentSet(entries, { exerciseId: 'bench' }))).toBe('bench#1');
  });

  it('🔴 retombe sur l’ordre naturel quand l’exercice visé est terminé', () => {
    const entries = [exercice('squat', [false]), exercice('bench', [true])];

    // Sans ce repli, taper sur un exercice fini afficherait « séance terminée » alors qu'il reste
    // des séries — et l'utilisateur devrait deviner qu'il faut retaper ailleurs.
    expect(at(resolveCurrentSet(entries, { exerciseId: 'bench' }))).toBe('squat#0');
  });

  it('retombe sur l’ordre naturel quand l’exercice visé a quitté la séance', () => {
    // L'exercice peut être remplacé (MUSC-F14) alors que la dérogation le désigne encore.
    const entries = [exercice('squat', [false])];

    expect(at(resolveCurrentSet(entries, { exerciseId: 'disparu' }))).toBe('squat#0');
  });
});

// ---------------------------------------------------------------------------
// Dérogation avec rang — la bascule superset
// ---------------------------------------------------------------------------

describe('dérogation de focus sur un rang précis (superset)', () => {
  it('🔴 vise la série JUMELLE, pas la 1ʳᵉ série non validée de l’exercice', () => {
    // Le partenaire a un échauffement non validé au rang 0 : viser « la 1ʳᵉ non validée »
    // renverrait sur cet échauffement, sans rapport avec le couple superset en cours.
    const entries = [exercice('squat', [true, false]), exercice('row', [false, false])];

    expect(at(resolveCurrentSet(entries, { exerciseId: 'row', rang: 1 }))).toBe('row#1');
  });

  it('retombe sur la 1ʳᵉ série non validée quand la jumelle est déjà validée', () => {
    const entries = [exercice('squat', [false]), exercice('row', [false, true])];

    expect(at(resolveCurrentSet(entries, { exerciseId: 'row', rang: 1 }))).toBe('row#0');
  });

  it('retombe proprement quand le rang n’existe pas chez le partenaire', () => {
    // Progressions différentes : 3 séries d'un côté, 2 de l'autre.
    const entries = [exercice('squat', [false]), exercice('row', [false, false])];

    expect(at(resolveCurrentSet(entries, { exerciseId: 'row', rang: 5 }))).toBe('row#0');
  });

  it('accepte le rang 0 — et ne le confond pas avec « pas de rang »', () => {
    // `rang: 0` est falsy : un test `if (rang)` au lieu de `if (rang != null)` traiterait la
    // 1ʳᵉ série d'un superset comme une dérogation sans rang. Ici les deux chemins donnent le
    // même résultat, mais la garde reste celle qu'il faut lire.
    const entries = [exercice('squat', [true]), exercice('row', [false, false])];

    expect(at(resolveCurrentSet(entries, { exerciseId: 'row', rang: 0 }))).toBe('row#0');
  });
});

// ---------------------------------------------------------------------------
// Partenaire superset
// ---------------------------------------------------------------------------

describe('findSupersetPartnerSet', () => {
  const entries = [exercice('squat', [false, false]), exercice('row', [false, true])];
  const pairs = { squat: 'row', row: 'squat' };

  it('rend la série du partenaire au MÊME rang', () => {
    const found = findSupersetPartnerSet(entries, pairs, 'squat', 1);

    expect(found?.entry.exerciseId).toBe('row');
    expect(found?.set.done).toBe(true);
  });

  it('rend null quand l’exercice n’est lié à personne', () => {
    expect(findSupersetPartnerSet(entries, {}, 'squat', 0)).toBeNull();
  });

  it('rend null quand le partenaire n’a pas de série à ce rang', () => {
    // Progressions différentes — dégradation silencieuse : repos normal, pas de plantage.
    expect(findSupersetPartnerSet(entries, pairs, 'squat', 9)).toBeNull();
  });

  it('rend null quand le partenaire a quitté la séance', () => {
    // Le lien survit en base au retrait de l'exercice de la séance en cours.
    expect(findSupersetPartnerSet(entries, { squat: 'parti' }, 'squat', 0)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Durées — saisie et affichage
// ---------------------------------------------------------------------------

describe('formatMmSs', () => {
  it.each([
    [0, '0:00'],
    [9, '0:09'],
    [60, '1:00'],
    [90, '1:30'],
    [3599, '59:59'],
    [3600, '60:00'],
  ])('%i s → « %s »', (seconds, expected) => {
    expect(formatMmSs(seconds)).toBe(expected);
  });

  it('borne les valeurs négatives à 0:00 plutôt que d’afficher « -1:-1 »', () => {
    expect(formatMmSs(-30)).toBe('0:00');
  });

  it('tronque les décimales vers le bas', () => {
    expect(formatMmSs(90.9)).toBe('1:30');
  });
});

describe('parseMmSs', () => {
  it.each([
    ['90', 90],
    ['1:30', 90],
    ['0:45', 45],
    ['2:00', 120],
    ['  60  ', 60],
  ])('« %s » → %i s', (input, expected) => {
    expect(parseMmSs(input)).toBe(expected);
  });

  it('rend null sur un champ vide — « pas de durée », pas « zéro seconde »', () => {
    expect(parseMmSs('')).toBeNull();
    expect(parseMmSs('   ')).toBeNull();
  });

  it('rend null sur une saisie sans aucun chiffre', () => {
    expect(parseMmSs('abc')).toBeNull();
  });

  it('ignore les caractères parasites autour des chiffres', () => {
    expect(parseMmSs('1:3s0')).toBe(90);
  });

  it('traite une partie manquante comme zéro', () => {
    expect(parseMmSs('2:')).toBe(120);
    expect(parseMmSs(':45')).toBe(45);
  });

  it('fait l’aller-retour avec formatMmSs', () => {
    for (const s of [0, 45, 90, 605]) {
      expect(parseMmSs(formatMmSs(s))).toBe(s);
    }
  });
});

// ---------------------------------------------------------------------------
// Dernière performance
// ---------------------------------------------------------------------------

describe('formatLastPerf', () => {
  const units = {
    weightSymbol: 'kg' as const,
    weightInputValue: (kg: number | null | undefined) => (kg == null ? '' : String(kg)),
  };

  it('factorise le poids quand toutes les séries sont au même poids', () => {
    const perf = [
      { weightKg: 80, reps: 8 },
      { weightKg: 80, reps: 8 },
      { weightKg: 80, reps: 7 },
    ];

    expect(formatLastPerf(perf, units)).toBe('80 kg × 8/8/7');
  });

  it('détaille série par série dès qu’un poids diffère', () => {
    const perf = [
      { weightKg: 80, reps: 8 },
      { weightKg: 82.5, reps: 8 },
    ];

    expect(formatLastPerf(perf, units)).toBe('80×8, 82.5×8');
  });

  it('rend null quand il n’y a aucune donnée — l’écran n’affiche alors rien', () => {
    expect(formatLastPerf([], units)).toBeNull();
  });

  it('omet le poids au poids du corps (null partout)', () => {
    const perf = [
      { weightKg: null, reps: 12 },
      { weightKg: null, reps: 10 },
    ];

    expect(formatLastPerf(perf, units)).toBe('12/10');
  });

  it('remplace les reps manquantes par un tiret, pas par « null »', () => {
    const perf = [
      { weightKg: 80, reps: null },
      { weightKg: 80, reps: 8 },
    ];

    expect(formatLastPerf(perf, units)).toBe('80 kg × —/8');
  });

  it('mélange poids présents et absents sans coller un « × » orphelin', () => {
    const perf = [
      { weightKg: null, reps: 12 },
      { weightKg: 20, reps: 10 },
    ];

    expect(formatLastPerf(perf, units)).toBe('12, 20×10');
  });
});
