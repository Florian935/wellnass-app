/**
 * Suggestions de remplacement d'exercice (US MUSC-F14) — la requête des candidats.
 *
 * Le **classement** (`rankSubstitutions`) vit dans `@wellness/shared` et y est testé. Ce qui n'est
 * vérifié nulle part, c'est la requête qui l'alimente — et elle fait trois choses qu'un mock
 * n'aurait jamais exercées :
 *
 *  1. **Un `json_each`** : la liste des variantes déclarées est passée en **chaîne JSON** et
 *     dépliée par SQLite. Une sérialisation cassée ne lève pas — elle rend simplement une liste
 *     vide, donc « aucune suggestion » là où l'utilisateur en attend.
 *  2. **Un repli de langue** sur deux jointures. Un exercice sans traduction dans la langue
 *     courante doit ressortir avec son nom français, pas disparaître.
 *  3. **L'exclusion des exercices archivés** (US ADMIN-01). Proposer en remplacement un exercice
 *     retiré du catalogue enverrait l'utilisateur vers une fiche qui n'existe plus.
 *
 * Le point qui justifie ce fichier : la clause est un **OU** — même groupe musculaire **ou**
 * variante déclarée. Si un humain a lié deux exercices, on ne remet pas cette information en
 * cause, quel que soit leur groupe. Un `ET` accidentel ferait disparaître toutes les variantes
 * inter-groupes sans qu'aucune erreur ne se produise.
 */

import { SELECT_CANDIDATES } from '../exercise-substitution-repository';
import { resetTestDb, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

type CandidateRow = {
  id: string;
  muscle_primary: string;
  equipment: string | null;
  name: string | null;
};

/** Exécute la requête telle que le hook la lance. */
const candidates = (lang: string, muscle: string, variantIds: string[]) =>
  testPowerSync.getAll<CandidateRow>(SELECT_CANDIDATES, [
    lang,
    muscle,
    JSON.stringify(variantIds),
  ]);

/** Un exercice au catalogue, avec ses traductions. */
function seedExercise(
  id: string,
  opts: {
    muscle: string;
    equipment?: string;
    nameFr?: string | null;
    nameEn?: string | null;
    archived?: boolean;
  },
): void {
  seed('exercises', [
    {
      id,
      owner_id: null,
      muscle_primary: opts.muscle,
      equipment: opts.equipment ?? 'barbell',
      muscles_secondary: JSON.stringify([]),
      ...(opts.archived ? { deleted_at: new Date().toISOString() } : {}),
    },
  ]);
  const translations: Record<string, unknown>[] = [];
  if (opts.nameFr !== null) {
    translations.push({ exercise_id: id, lang: 'fr', name: opts.nameFr ?? `${id} (fr)` });
  }
  if (opts.nameEn) translations.push({ exercise_id: id, lang: 'en', name: opts.nameEn });
  if (translations.length > 0) seed('exercise_translations', translations);
}

const ids = (rows: CandidateRow[]) => rows.map((r) => r.id).sort();

beforeEach(() => {
  resetTestDb();
});

// ---------------------------------------------------------------------------
// Groupe musculaire
// ---------------------------------------------------------------------------

describe('sélection par groupe musculaire', () => {
  it('retient les exercices du même groupe', async () => {
    seedExercise('squat', { muscle: 'legs' });
    seedExercise('presse', { muscle: 'legs' });
    seedExercise('developpe', { muscle: 'chest' });

    expect(ids(await candidates('fr', 'legs', []))).toEqual(['presse', 'squat']);
  });

  it('ne rend rien pour un groupe sans exercice', async () => {
    seedExercise('squat', { muscle: 'legs' });

    expect(await candidates('fr', 'shoulders', [])).toEqual([]);
  });

  it('ne rend rien quand le groupe est vide — cas « aucune source »', async () => {
    seedExercise('squat', { muscle: 'legs' });

    // Le hook passe `''` quand `source` est null : la requête ne doit pas tout ramener.
    expect(await candidates('fr', '', [])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Variantes déclarées — le OU
// ---------------------------------------------------------------------------

describe('variantes déclarées', () => {
  it('🔴 retient une variante d’un AUTRE groupe musculaire', async () => {
    seedExercise('squat', { muscle: 'legs' });
    seedExercise('souleve-de-terre', { muscle: 'back' });

    const rows = await candidates('fr', 'legs', ['souleve-de-terre']);

    // La clause est un OU : si un humain a lié deux exercices, on ne remet pas cette information
    // en cause. Un ET accidentel ferait disparaître toutes les variantes inter-groupes — sans la
    // moindre erreur.
    expect(ids(rows)).toEqual(['souleve-de-terre', 'squat']);
  });

  it('déplie correctement une liste JSON de plusieurs variantes', async () => {
    seedExercise('squat', { muscle: 'legs' });
    seedExercise('rowing', { muscle: 'back' });
    seedExercise('curl', { muscle: 'biceps' });
    seedExercise('ignore', { muscle: 'shoulders' });

    const rows = await candidates('fr', 'legs', ['rowing', 'curl']);

    expect(ids(rows)).toEqual(['curl', 'rowing', 'squat']);
  });

  it('supporte une liste de variantes vide sans tout ramener', async () => {
    seedExercise('squat', { muscle: 'legs' });
    seedExercise('rowing', { muscle: 'back' });

    expect(ids(await candidates('fr', 'legs', []))).toEqual(['squat']);
  });

  it('ne duplique pas un exercice à la fois du bon groupe ET déclaré variante', async () => {
    seedExercise('squat', { muscle: 'legs' });
    seedExercise('presse', { muscle: 'legs' });

    const rows = await candidates('fr', 'legs', ['presse']);

    // Le `OR` pourrait faire remonter deux fois la même ligne selon la formulation.
    expect(rows).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Langue
// ---------------------------------------------------------------------------

describe('résolution du nom', () => {
  it('rend le nom de la langue demandée', async () => {
    seedExercise('squat', { muscle: 'legs', nameFr: 'Squat', nameEn: 'Back squat' });

    const rows = await candidates('en', 'legs', []);

    expect(rows[0]?.name).toBe('Back squat');
  });

  it('replie sur le français quand la traduction manque', async () => {
    seedExercise('squat', { muscle: 'legs', nameFr: 'Squat' });

    const rows = await candidates('en', 'legs', []);

    // Sans le repli, l'exercice ressortirait sans nom — donc filtré par le hook, donc absent des
    // suggestions alors qu'il est parfaitement pertinent.
    expect(rows[0]?.name).toBe('Squat');
  });

  it('rend un nom nul quand aucune traduction n’existe — le hook filtrera', async () => {
    seedExercise('squat', { muscle: 'legs', nameFr: null });

    const rows = await candidates('fr', 'legs', []);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Archivage
// ---------------------------------------------------------------------------

describe('exercices archivés', () => {
  it('🔴 exclut un exercice retiré du catalogue (US ADMIN-01)', async () => {
    seedExercise('squat', { muscle: 'legs' });
    seedExercise('presse-retiree', { muscle: 'legs', archived: true });

    // Le proposer en remplacement enverrait l'utilisateur vers une fiche qui n'existe plus.
    expect(ids(await candidates('fr', 'legs', []))).toEqual(['squat']);
  });

  it('l’exclut MÊME s’il est déclaré comme variante', async () => {
    seedExercise('squat', { muscle: 'legs' });
    seedExercise('variante-retiree', { muscle: 'back', archived: true });

    expect(ids(await candidates('fr', 'legs', ['variante-retiree']))).toEqual(['squat']);
  });
});
