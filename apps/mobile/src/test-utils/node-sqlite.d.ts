/**
 * Déclaration minimale de `node:sqlite` pour le harness de test.
 *
 * Les types complets viennent de `@types/node`, qu'on **n'ajoute pas** au champ `types` du
 * tsconfig de l'app : cela rendrait `process`, `Buffer` et consorts visibles dans le code
 * applicatif React Native, où ils n'existent pas à l'exécution. On déclare donc ici la seule
 * surface utilisée par `sqlite-harness.ts`.
 */
declare module 'node:sqlite' {
  type SQLInputValue = null | number | bigint | string | Uint8Array;

  export class StatementSync {
    all(...params: SQLInputValue[]): unknown[];
    get(...params: SQLInputValue[]): unknown;
    run(...params: SQLInputValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
