/**
 * Déclarations minimales de `node:fs` et `node:path` pour les tests qui lisent du **source**.
 *
 * Même raison d'être que [node-sqlite.d.ts](./node-sqlite.d.ts) : les types complets viennent de
 * `@types/node`, qu'on **n'ajoute pas** au champ `types` du tsconfig de l'app — cela rendrait
 * `process`, `Buffer` et consorts visibles dans le code applicatif React Native, où ils n'existent
 * pas à l'exécution. On déclare donc ici la seule surface utilisée, et **aucun global**.
 *
 * Seul appelant : `sql-prepare-sweep.test.ts`, qui balaie les requêtes SQL des repositories.
 */

declare module 'node:fs' {
  export function readdirSync(path: string): string[];
  export function readFileSync(path: string, encoding: 'utf-8'): string;
  export function existsSync(path: string): boolean;
}

declare module 'node:path' {
  /**
   * Les segments relatifs sont résolus depuis le répertoire de travail du process — sous Jest,
   * le `rootDir` (`apps/mobile`).
   */
  export function resolve(...segments: string[]): string;
  export function join(...segments: string[]): string;
}
