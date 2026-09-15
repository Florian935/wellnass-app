/**
 * Garde-fou : **toute** clé de `ProfileInput` doit avoir sa colonne, aux trois endroits.
 *
 * ── Le piège que ce test ferme, et qui a déjà coûté deux recettes ────────────────────────────────
 * Ajouter une colonne au profil demande **trois** gestes, et l'oubli du troisième est silencieux :
 *
 *  1. la migration SQL (cloud) ;
 *  2. `powersync/schema.ts` (base SQLite **locale**) ;
 *  3. `profile-repository.ts` (`ProfileInput`, `rowToProfile`, `inputToColumns`).
 *
 * Sans le 2, la colonne n'existe pas en local : l'écriture lève, `void upsertProfile()` avale le
 * rejet, et le sélecteur revient à sa valeur précédente **sans le moindre message**. C'est
 * exactement la panne de `cycle_tracking_enabled` (CYCLE-01, recette du 31/07/2026) et celle de
 * `daily_step_goal` (03/08/2026) — deux fois le même scénario, deux fois découvert sur device.
 *
 * Sans le 3 (`inputToColumns`), c'est pire encore : l'écriture « réussit » en ne écrivant rien.
 *
 * Le test lit le **source** du repository plutôt que d'appeler la fonction : `inputToColumns` n'est
 * pas exportée, et la rendre publique pour la tester reviendrait à élargir une API interne pour les
 * besoins d'un test. L'analyse statique est ici suffisante et sans effet de bord.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { getTestDb, resetTestDb } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

// Chemin relatif au **cwd** du runner (`apps/mobile`), comme `sql-prepare-sweep.test.ts` :
// `__dirname` n'existe pas sous la config TS du workspace.
const SOURCE = readFileSync(resolve('src/data/repositories/profile-repository.ts'), 'utf-8');

/** camelCase → snake_case, la convention du dépôt entre domaine et colonnes. */
function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** Les clés déclarées dans le `Pick<ProfileRow, ...>` de `ProfileInput`. */
function profileInputKeys(): string[] {
  const block = /export type ProfileInput = Pick<\s*ProfileRow,([\s\S]*?)>;/.exec(SOURCE);
  if (!block?.[1]) throw new Error('Bloc ProfileInput introuvable dans profile-repository.ts');
  return [...block[1].matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1] as string);
}

describe('ProfileInput — garde-fou des trois gestes', () => {
  beforeEach(() => {
    resetTestDb();
  });

  const keys = profileInputKeys();

  it('déclare au moins les huit champs de GUID-01', () => {
    for (const key of [
      'mainGoalDeadline',
      'trainingFocus',
      'trainingLevel',
      'weeklyAvailability',
      'guidanceRegime',
      'guidanceStrength',
      'guidanceCardio',
      'guidanceNutrition',
    ]) {
      expect(keys).toContain(key);
    }
  });

  it.each(keys)('%s est mappée dans inputToColumns', (key) => {
    // On cherche la ligne exacte `if ('<key>' in input)` — une clé listée dans le type mais absente
    // de la conversion écrit « avec succès » sans rien écrire du tout.
    expect(SOURCE).toContain(`'${key}' in input`);
  });

  // On cherche la lecture de la COLONNE (`row.x_y`) et non l'affectation `clé: row.x_y` : deux
  // champs passent légitimement par une coercion (`workoutDisplayLevel`, `summaryDisplayLevel`),
  // et exiger la forme directe reviendrait à interdire ce repli parfaitement voulu.
  it.each(keys)('%s est relue depuis sa colonne dans rowToProfile', (key) => {
    expect(SOURCE).toContain(`row.${toSnake(key)}`);
  });

  it.each(keys)('%s existe comme colonne dans le schéma PowerSync local', (key) => {
    const columns = getTestDb()
      .prepare(`PRAGMA table_info(profiles)`)
      .all() as { name: string }[];
    expect(columns.map((c) => c.name)).toContain(toSnake(key));
  });
});
