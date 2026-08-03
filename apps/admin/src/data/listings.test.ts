/**
 * Back-office — les **lectures de liste** (reliquat du lot 4).
 *
 * [strategie-tests.md](../../../../docs/specs/technical/strategie-tests.md) les classait moins
 * risquées que les écritures, et elles le sont : une liste fausse se voit à l'écran. Deux
 * exceptions, qui justifient ce fichier, et qu'un back-office de recette ne montre pas :
 *
 *  1. **La portée `active` / `archived` / `all`.** Le filtre est construit par une chaîne
 *     conditionnelle : se tromper de branche affiche les contenus **archivés** dans la liste
 *     active — donc republie visuellement ce qu'un admin avait retiré. Sur un jeu de données de
 *     test sans archive, les trois portées rendent exactement la même chose.
 *  2. **`deleted_at` sur les traductions, indépendamment du programme.** Une traduction archivée
 *     seule doit faire tomber le libellé à `null` (« sans nom ») et non ressortir. Le commentaire
 *     du code le dit explicitement ; rien ne le vérifiait.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSupabaseMock } from '../test-utils/supabase-mock';

const mock = createSupabaseMock();

vi.mock('../lib/supabase', () => ({ supabase: mock.client }));

const { listEditorialPrograms } = await import('./programs');
const { listEditorialExercises } = await import('./exercises');
const { listEditorialFoods } = await import('./foods');

const PROGRAM_ID = '88888888-8888-4888-8888-888888888888';

/** Une ligne de programme telle que Supabase la renvoie, traductions imbriquées. */
const programRow = (translations: Record<string, unknown>[]) => ({
  id: PROGRAM_ID,
  pillar: 'strength',
  status: 'published',
  level: 'beginner',
  goal: 'hypertrophy',
  duration_weeks: 8,
  created_at: '2026-08-01T10:00:00Z',
  deleted_at: null,
  program_translations: translations,
});

beforeEach(() => {
  mock.reset();
});

// ---------------------------------------------------------------------------
// Portée éditoriale — le filtre qui décide ce qu'on voit
// ---------------------------------------------------------------------------

describe('portée active / archivée / toutes', () => {
  /** Chaque liste éditoriale, avec la table qu'elle interroge. */
  const listes = [
    ['programs', listEditorialPrograms],
    ['exercises', listEditorialExercises],
    ['foods', listEditorialFoods],
  ] as const;

  it.each(listes)('« %s » : la portée active masque les archives', async (table, list) => {
    await list('active');

    const query = mock.lastQuery(table, 'select');
    expect(mock.hasFilter(query, 'is', 'deleted_at', null)).toBe(true);
    expect(mock.hasFilter(query, 'not', 'deleted_at', 'is', null)).toBe(false);
  });

  it.each(listes)('« %s » : la portée archivée ne montre QUE les archives', async (table, list) => {
    await list('archived');

    const query = mock.lastQuery(table, 'select');
    expect(mock.hasFilter(query, 'not', 'deleted_at', 'is', null)).toBe(true);
    expect(mock.hasFilter(query, 'is', 'deleted_at', null)).toBe(false);
  });

  it.each(listes)('« %s » : la portée « toutes » ne filtre pas sur l’archivage', async (table, list) => {
    await list('all');

    const query = mock.lastQuery(table, 'select');
    expect(mock.hasFilter(query, 'is', 'deleted_at', null)).toBe(false);
    expect(mock.hasFilter(query, 'not', 'deleted_at', 'is', null)).toBe(false);
  });

  it.each(listes)('« %s » : la portée par défaut est ACTIVE', async (table, list) => {
    await list();

    // Un défaut sur « toutes » ferait apparaître les contenus archivés dans l'écran principal —
    // c'est-à-dire republierait visuellement ce qu'un admin avait retiré.
    expect(mock.hasFilter(mock.lastQuery(table, 'select'), 'is', 'deleted_at', null)).toBe(true);
  });

  it.each(listes)('« %s » : ne montre jamais le contenu d’un utilisateur', async (table, list) => {
    await list('all');

    expect(mock.hasFilter(mock.lastQuery(table, 'select'), 'is', 'owner_id', null)).toBe(true);
  });

  it.each(listes)('« %s » : trie du plus récent au plus ancien', async (table, list) => {
    await list('active');

    expect(
      mock.hasFilter(mock.lastQuery(table, 'select'), 'order', 'created_at', {
        ascending: false,
      }),
    ).toBe(true);
  });

  it.each(listes)('« %s » : renvoie une liste vide et l’erreur, jamais du partiel', async (table, list) => {
    mock.setResponse(`${table}.select`, { error: new Error('rls') });

    const result = await list('active');

    expect(result.rows).toEqual([]);
    expect(result.error).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// Résolution des libellés
// ---------------------------------------------------------------------------

describe('libellés des programmes', () => {
  it('résout le nom de chaque langue', async () => {
    mock.setResponse('programs.select', {
      data: [
        programRow([
          { lang: 'fr', name: 'Full body', deleted_at: null },
          { lang: 'en', name: 'Full body EN', deleted_at: null },
        ]),
      ],
    });

    const { rows } = await listEditorialPrograms('active');

    expect(rows[0]).toMatchObject({ nameFr: 'Full body', nameEn: 'Full body EN' });
  });

  it('ignore une traduction ARCHIVÉE, même sur un programme vivant', async () => {
    mock.setResponse('programs.select', {
      data: [
        programRow([
          { lang: 'fr', name: 'Full body', deleted_at: '2026-01-01T00:00:00Z' },
          { lang: 'en', name: 'Full body EN', deleted_at: null },
        ]),
      ],
    });

    const { rows } = await listEditorialPrograms('active');

    // La portée ne s'applique qu'au programme : ses traductions sont filtrées séparément. Sans
    // ce filtre, un libellé retiré du catalogue continuerait de s'afficher.
    expect(rows[0]?.nameFr).toBeNull();
    expect(rows[0]?.nameEn).toBe('Full body EN');
  });

  it('renvoie null pour une langue absente, sans planter', async () => {
    mock.setResponse('programs.select', {
      data: [programRow([{ lang: 'fr', name: 'Full body', deleted_at: null }])],
    });

    expect((await listEditorialPrograms('active')).rows[0]).toMatchObject({
      nameFr: 'Full body',
      nameEn: null,
    });
  });

  it('supporte un programme sans aucune traduction', async () => {
    mock.setResponse('programs.select', { data: [programRow([])] });

    const { rows, error } = await listEditorialPrograms('active');

    expect(error).toBeNull();
    expect(rows[0]).toMatchObject({ nameFr: null, nameEn: null });
  });

  it('reporte les métadonnées de la ligne telles quelles', async () => {
    mock.setResponse('programs.select', { data: [programRow([])] });

    expect((await listEditorialPrograms('active')).rows[0]).toMatchObject({
      id: PROGRAM_ID,
      pillar: 'strength',
      status: 'published',
      durationWeeks: 8,
      deletedAt: null,
    });
  });

  it('expose la date d’archivage sur la portée archivée', async () => {
    mock.setResponse('programs.select', {
      data: [{ ...programRow([]), deleted_at: '2026-07-01T09:00:00Z' }],
    });

    // C'est cette valeur qui alimente le « Archivé le … » de la liste.
    expect((await listEditorialPrograms('archived')).rows[0]?.deletedAt).toBe(
      '2026-07-01T09:00:00Z',
    );
  });

  it('renvoie une liste vide quand il n’y a rien, sans erreur', async () => {
    mock.setResponse('programs.select', { data: [] });

    expect(await listEditorialPrograms('active')).toEqual({ rows: [], error: null });
  });

  it('tolère une réponse sans données', async () => {
    mock.setResponse('programs.select', { data: null });

    expect(await listEditorialPrograms('active')).toEqual({ rows: [], error: null });
  });
});
