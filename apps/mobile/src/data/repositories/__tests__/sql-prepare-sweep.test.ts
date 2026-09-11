/**
 * Garde-fou global : **toute** requête SQL des repositories doit se préparer contre le schéma
 * PowerSync local.
 *
 * ── Pourquoi ce test existe (recette MUSCU-UX01, 11/09/2026) ─────────────────────────────────────
 * Deux des sept défauts remontés par la recette étaient la **même** panne, et la pire qui soit :
 * une requête qui référence une colonne absente du schéma local.
 *
 *  - `strength-hub-repository` lisait `e.name` sur `exercises` — table qui **n'a pas de colonne
 *    `name`** (les noms vivent dans `exercise_translations`). La requête levait à chaque rendu, le
 *    hub muscu n'affichait donc **jamais** la séance du jour et retombait sur « Repos aujourd'hui »
 *    (§57.3), y compris pour quelqu'un qui avait bel et bien une séance prévue dans l'heure.
 *  - `records-repository` filtrait `w2.owner_id` sur `workouts` — table qui porte `user_id`. Même
 *    conséquence : aucun écart « ▲ +2,5 kg » n'a jamais pu s'afficher sur le résumé (§57.36), alors
 *    même que la séance battait des records.
 *
 * Dans les deux cas, **rien ne le signalait** : `useQuery` avale l'erreur, `data` reste vide, et
 * l'écran affiche son état « pas de donnée » — qui est un état légitime. Aucun crash, aucun log,
 * aucun test au rouge. C'est exactement la classe de panne que le harness SQLite a été écrit pour
 * attraper (cf. `cycle_tracking_enabled`, `daily_step_goal`), mais elle n'était attrapée que sur
 * les requêtes qu'un test citait nommément — et ces deux-là n'en avaient aucun.
 *
 * ── Ce que le test fait ──────────────────────────────────────────────────────────────────────────
 * Il lit le **source** de chaque repository, en extrait toute chaîne littérale qui commence par un
 * verbe SQL, et demande à SQLite de la **préparer** (pas de l'exécuter : aucun jeu de données à
 * inventer, aucune valeur à ficher). Préparer suffit — c'est là que SQLite résout tables, colonnes
 * et alias. Une colonne fantôme ne passe pas.
 *
 * Les chaînes **interpolées** (`${...}`) sont hors de portée : leur texte final n'existe qu'à
 * l'exécution. Elles restent couvertes par les tests de repository dédiés.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { getTestDb, resetTestDb } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

/** Une chaîne n'est du SQL que si elle **commence** par un verbe — sinon on ramasse les commentaires. */
const SQL_START = /^\s*(WITH|SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s/i;

// Le backtick est construit par code : l'écrire dans un littéral d'expression régulière casse le
// parseur Babel de Jest.
const BACKTICK = String.fromCharCode(96);
/** Gabarits SANS interpolation (`[^$]`) : ceux avec `${}` n'ont pas de texte final à préparer. */
const TEMPLATE_LITERAL = new RegExp(BACKTICK + '([^' + BACKTICK + '$]*)' + BACKTICK, 'g');
/** Requêtes courtes écrites en apostrophes simples, sur une ligne. */
const SINGLE_QUOTED = new RegExp("'([^'\\n]*)'", 'g');

/** Retire commentaires de bloc et de ligne : ils citent abondamment du SQL en prose. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

it('toutes les requêtes SQL des repositories se préparent contre le schéma PowerSync', () => {
  resetTestDb();

  // Chemin relatif au `rootDir` de Jest (`apps/mobile`) plutôt qu'à `__dirname` : déclarer ce
  // global le rendrait visible depuis le code applicatif, ce que le tsconfig évite exprès.
  const dir = resolve('src/data/repositories');
  expect(existsSync(dir)).toBe(true);

  const failures: string[] = [];
  let prepared = 0;

  for (const file of readdirSync(dir).filter((f: string) => f.endsWith('.ts'))) {
    const source = stripComments(readFileSync(`${dir}/${file}`, 'utf-8'));

    for (const pattern of [TEMPLATE_LITERAL, SINGLE_QUOTED]) {
      for (const match of source.matchAll(pattern)) {
        const sql = match[1]!;
        if (!SQL_START.test(sql)) continue;
        try {
          getTestDb().prepare(sql);
          prepared += 1;
        } catch (error) {
          failures.push(
            `${file} — ${(error as Error).message}\n    ${sql.replace(/\s+/g, ' ').slice(0, 160)}`,
          );
        }
      }
    }
  }

  expect(failures).toEqual([]);
  // Filet du filet : si une évolution de syntaxe faisait que plus rien n'est détecté, le test
  // passerait au vert en ne vérifiant rien. Le seuil est volontairement très en dessous du compte
  // réel (162 au 11/09/2026) — il ne se déclenche que si la détection s'effondre.
  expect(prepared).toBeGreaterThan(100);
});
