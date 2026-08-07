/**
 * Back-office — **lecture et écriture** d'un exercice éditorial (US 8.2, ADMIN-01, MUSC-F1b).
 *
 * `exercises.test.ts` couvre l'archivage, la restauration et la publication. Ce fichier prend
 * l'autre moitié — la liste, le détail et l'enregistrement — soit la moitié du fichier qui restait
 * sans filet.
 *
 * Ce qui se joue ici tient en trois points, et aucun ne se voit à l'écran :
 *
 *  1. **`owner_id IS NULL` sur chaque lecture comme sur chaque écriture.** Le back-office parle à
 *     Supabase avec la clé anon. Sans ce filtre, une recherche d'admin remonterait — et un
 *     enregistrement écraserait — des exercices **créés par les utilisateurs**.
 *  2. **La sémantique d'échec partiel de `saveExercise`.** L'écriture est séquentielle : ligne
 *     d'abord, puis les deux traductions. Si une traduction échoue, l'exercice **existe déjà** en
 *     base. Renvoyer `id: null` ferait croire à l'UI qu'il n'y a rien à reprendre, et le prochain
 *     enregistrement créerait un doublon au lieu de compléter la ligne existante.
 *  3. **L'audit n'est écrit qu'en succès complet.** Un journal qui affirme « exercice créé » alors
 *     que la fiche est sans nom est pire qu'un journal vide : il éteint la seule alerte disponible.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSupabaseMock } from '../test-utils/supabase-mock';

const mock = createSupabaseMock();

vi.mock('../lib/supabase', () => ({ supabase: mock.client }));

const { getExercise, listEditorialExercises, saveExercise } = await import('./exercises');

/** UUID valide — requis par `auditEntrySchema`. */
const EXERCISE_ID = '33333333-3333-4333-8333-333333333333';

/** Entrée minimale valide de `saveExercise`. */
const entree = (overrides: Record<string, unknown> = {}) =>
  ({
    musclePrimary: 'legs',
    musclesSecondary: [],
    musclesFine: [],
    equipment: 'barbell',
    status: 'draft',
    nameFr: 'Squat barre',
    nameEn: 'Barbell squat',
    instructionsFr: null,
    instructionsEn: null,
    ...overrides,
  }) as Parameters<typeof saveExercise>[0];

beforeEach(() => {
  mock.reset();
});

// ---------------------------------------------------------------------------
// Liste
// ---------------------------------------------------------------------------

describe('listEditorialExercises', () => {
  it('🔴 ne lit que l’éditorial, jamais les exercices des utilisateurs', async () => {
    await listEditorialExercises();

    const q = mock.lastQuery('exercises', 'select');
    expect(mock.hasFilter(q, 'is', 'owner_id', null)).toBe(true);
  });

  it('par défaut, masque les archivés', async () => {
    await listEditorialExercises();

    expect(mock.hasFilter(mock.lastQuery('exercises', 'select'), 'is', 'deleted_at', null)).toBe(true);
  });

  it('🔴 la portée « archivés » ne remonte QUE les archivés', async () => {
    await listEditorialExercises('archived');

    // C'est ce filtre qui rend l'archivage réversible : sans lui, l'écran de corbeille afficherait
    // tout le catalogue et « restaurer » deviendrait une action au hasard.
    const q = mock.lastQuery('exercises', 'select');
    expect(mock.hasFilter(q, 'not', 'deleted_at', 'is', null)).toBe(true);
    expect(mock.hasFilter(q, 'is', 'deleted_at', null)).toBe(false);
  });

  it('la portée « tout » n’applique aucun filtre de suppression', async () => {
    await listEditorialExercises('all');

    const q = mock.lastQuery('exercises', 'select');
    expect(mock.hasFilter(q, 'is', 'deleted_at', null)).toBe(false);
    expect(mock.hasFilter(q, 'not', 'deleted_at', 'is', null)).toBe(false);
  });

  it('trie du plus récent au plus ancien', async () => {
    await listEditorialExercises();

    expect(
      mock.hasFilter(mock.lastQuery('exercises', 'select'), 'order', 'created_at', {
        ascending: false,
      }),
    ).toBe(true);
  });

  it('aplatit les traductions FR et EN en deux colonnes', async () => {
    mock.setResponse('exercises.select', {
      data: [
        {
          id: EXERCISE_ID,
          muscle_primary: 'legs',
          equipment: 'barbell',
          status: 'published',
          created_at: '2026-07-01T10:00:00.000Z',
          deleted_at: null,
          exercise_translations: [
            { lang: 'en', name: 'Barbell squat' },
            { lang: 'fr', name: 'Squat barre' },
          ],
        },
      ],
    });

    const { rows } = await listEditorialExercises();

    // L'ordre des traductions renvoyées par PostgREST n'est pas garanti : les prendre par index
    // donnerait un nom anglais dans la colonne française, de façon intermittente.
    expect(rows[0]).toMatchObject({ nameFr: 'Squat barre', nameEn: 'Barbell squat' });
  });

  it('🔴 une traduction manquante donne `null`, pas une ligne perdue', async () => {
    mock.setResponse('exercises.select', {
      data: [
        {
          id: EXERCISE_ID,
          muscle_primary: 'legs',
          equipment: null,
          status: 'draft',
          created_at: '2026-07-01T10:00:00.000Z',
          deleted_at: null,
          exercise_translations: [{ lang: 'fr', name: 'Squat barre' }],
        },
      ],
    });

    const { rows } = await listEditorialExercises();

    // Un exercice sans traduction anglaise est exactement ce qu'un admin doit voir pour le corriger.
    // Le faire disparaître de la liste rendrait le trou invisible.
    expect(rows).toHaveLength(1);
    expect(rows[0]?.nameEn).toBeNull();
  });

  it('remonte l’erreur et une liste vide, sans lever', async () => {
    mock.setResponse('exercises.select', { error: new Error('rls') });

    const { rows, error } = await listEditorialExercises();

    expect(rows).toEqual([]);
    expect(error).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// Détail
// ---------------------------------------------------------------------------

describe('getExercise', () => {
  const detail = (overrides: Record<string, unknown> = {}) => ({
    id: EXERCISE_ID,
    muscle_primary: 'legs',
    muscles_secondary: ['core'],
    muscles_fine: ['quadriceps_vastus_lateralis'],
    equipment: 'barbell',
    status: 'published',
    exercise_translations: [
      { lang: 'fr', name: 'Squat barre', instructions: 'Dos droit.' },
      { lang: 'en', name: 'Barbell squat', instructions: 'Keep your back straight.' },
    ],
    ...overrides,
  });

  it('🔴 refuse de charger un exercice utilisateur ou archivé', async () => {
    await getExercise(EXERCISE_ID);

    const q = mock.lastQuery('exercises', 'select');
    // Ouvrir la fiche d'édition d'un exercice appartenant à un utilisateur donnerait à l'admin
    // l'illusion de pouvoir le corriger — alors que la RLS refusera l'écriture, sans le dire.
    expect(mock.hasFilter(q, 'is', 'owner_id', null)).toBe(true);
    expect(mock.hasFilter(q, 'is', 'deleted_at', null)).toBe(true);
    expect(mock.hasFilter(q, 'eq', 'id', EXERCISE_ID)).toBe(true);
  });

  it('rend les deux langues séparées', async () => {
    mock.setResponse('exercises.select', { data: detail() });

    const { exercise } = await getExercise(EXERCISE_ID);

    expect(exercise).toMatchObject({
      nameFr: 'Squat barre',
      nameEn: 'Barbell squat',
      instructionsFr: 'Dos droit.',
      instructionsEn: 'Keep your back straight.',
    });
  });

  it('🔴 un nom manquant devient une chaîne vide, pas `undefined`', async () => {
    mock.setResponse('exercises.select', {
      data: detail({ exercise_translations: [{ lang: 'fr', name: 'Squat', instructions: null }] }),
    });

    const { exercise } = await getExercise(EXERCISE_ID);

    // Le formulaire est contrôlé : un `undefined` y basculerait le champ en non contrôlé, et React
    // perdrait la saisie de l'admin en cours de route.
    expect(exercise?.nameEn).toBe('');
    expect(exercise?.instructionsFr).toBeNull();
  });

  it('replie un statut absent sur « brouillon »', async () => {
    mock.setResponse('exercises.select', { data: detail({ status: null }) });

    const { exercise } = await getExercise(EXERCISE_ID);

    // Le défaut sûr : une fiche au statut indéterminé ne doit pas se retrouver publiée.
    expect(exercise?.status).toBe('draft');
  });

  it('🔴 exclut le muscle principal des secondaires', async () => {
    mock.setResponse('exercises.select', {
      data: detail({ muscle_primary: 'legs', muscles_secondary: ['legs', 'core'] }),
    });

    const { exercise } = await getExercise(EXERCISE_ID);

    // Une donnée héritée peut contenir le doublon ; l'afficher coché deux fois dans le formulaire
    // le réécrirait à chaque enregistrement.
    expect(exercise?.musclesSecondary).toEqual(['core']);
  });

  it('un `muscles_secondary` corrompu ne fait pas tomber la fiche', async () => {
    mock.setResponse('exercises.select', {
      data: detail({ muscles_secondary: 'pas-un-tableau', muscles_fine: null }),
    });

    const { exercise, error } = await getExercise(EXERCISE_ID);

    expect(error).toBeNull();
    expect(exercise?.musclesSecondary).toEqual([]);
    expect(exercise?.musclesFine).toEqual([]);
  });

  it('exercice introuvable → `null` sans erreur', async () => {
    mock.setResponse('exercises.select', { data: null });

    const { exercise, error } = await getExercise(EXERCISE_ID);

    // « Pas trouvé » n'est pas une panne : l'UI affiche un état vide, pas un message d'erreur.
    expect(exercise).toBeNull();
    expect(error).toBeNull();
  });

  it('erreur de lecture → `null` ET l’erreur', async () => {
    mock.setResponse('exercises.select', { error: new Error('réseau') });

    const { exercise, error } = await getExercise(EXERCISE_ID);

    expect(exercise).toBeNull();
    expect(error).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// Enregistrement
// ---------------------------------------------------------------------------

describe('saveExercise', () => {
  it('🔴 écrit toujours un exercice éditorial de bibliothèque', async () => {
    await saveExercise(entree());

    expect(mock.lastQuery('exercises', 'upsert')?.rows?.[0]).toMatchObject({
      owner_id: null,
      source: 'library',
    });
  });

  it('génère un identifiant à la création, et le renvoie', async () => {
    const { id, error } = await saveExercise(entree());

    expect(error).toBeNull();
    expect(id).toEqual(expect.any(String));
    expect(mock.lastQuery('exercises', 'upsert')?.rows?.[0]?.id).toBe(id);
  });

  it('réutilise l’identifiant fourni à la mise à jour', async () => {
    const { id } = await saveExercise(entree({ id: EXERCISE_ID }));

    // Un nouvel UUID ici créerait un doublon à chaque enregistrement d'une fiche existante.
    expect(id).toBe(EXERCISE_ID);
  });

  it('écrit les deux traductions, en conflit sur (exercice, langue)', async () => {
    await saveExercise(entree({ id: EXERCISE_ID }));

    const traductions = mock.queriesOn('exercise_translations', 'upsert');
    expect(traductions).toHaveLength(2);
    expect(traductions.map((q) => q.rows?.[0]?.lang)).toEqual(['fr', 'en']);
    // Sans `onConflict`, chaque enregistrement empilerait une traduction de plus.
    expect(traductions[0]?.options).toMatchObject({ onConflict: 'exercise_id,lang' });
    expect(traductions.every((q) => q.rows?.[0]?.owner_id === null)).toBe(true);
  });

  it('🔴 exclut le muscle principal des secondaires à l’écriture aussi', async () => {
    await saveExercise(entree({ musclePrimary: 'legs', musclesSecondary: ['legs', 'core'] }));

    // Même règle qu'à la lecture : sinon un aller-retour dans le formulaire réintroduirait le
    // doublon que la lecture venait de retirer.
    expect(mock.lastQuery('exercises', 'upsert')?.rows?.[0]?.muscles_secondary).toEqual(['core']);
  });

  it('n’écrit aucune traduction si la ligne échoue', async () => {
    mock.setResponse('exercises.upsert', { error: new Error('rls') });

    const { id, error } = await saveExercise(entree());

    expect(error).toBeInstanceOf(Error);
    expect(id).toBeNull();
    expect(mock.queriesOn('exercise_translations')).toHaveLength(0);
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });

  it('🔴 si une traduction échoue, renvoie quand même l’identifiant', async () => {
    mock.setResponse('exercise_translations.upsert', { error: new Error('rls') });

    const { id, error } = await saveExercise(entree());

    // L'exercice EXISTE en base à ce stade. Renvoyer `null` ferait croire à l'UI qu'il n'y a rien à
    // reprendre, et le prochain enregistrement créerait un doublon au lieu de compléter la ligne.
    expect(error).toBeInstanceOf(Error);
    expect(id).toEqual(expect.any(String));
  });

  it('🔴 s’arrête à la PREMIÈRE traduction en échec', async () => {
    mock.setResponse('exercise_translations.upsert', { error: new Error('rls') });

    await saveExercise(entree());

    expect(mock.queriesOn('exercise_translations', 'upsert')).toHaveLength(1);
  });

  it('🔴 ne journalise pas un succès qui n’en est pas un', async () => {
    mock.setResponse('exercise_translations.upsert', { error: new Error('rls') });

    await saveExercise(entree());

    // Un journal qui affirme « exercice créé » alors que la fiche est sans nom éteint la seule
    // alerte disponible.
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });

  it('journalise une création avec le nom français comme libellé', async () => {
    await saveExercise(entree());

    expect(mock.lastQuery('audit_log', 'insert')?.rows?.[0]).toMatchObject({
      action: 'exercise.create',
      target_table: 'exercises',
      target_label: 'Squat barre',
    });
  });

  it('🔴 distingue création et mise à jour dans le journal', async () => {
    await saveExercise(entree({ id: EXERCISE_ID }));

    // C'est la présence d'un `id` en entrée qui fait la différence — sans elle, l'historique
    // afficherait une suite de « créations » pour une même fiche corrigée dix fois.
    expect(mock.lastQuery('audit_log', 'insert')?.rows?.[0]).toMatchObject({
      action: 'exercise.update',
      target_id: EXERCISE_ID,
    });
  });
});
