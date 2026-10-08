// Types de scripts/noryn-context-bundle.mjs (US NORYN-01), pour le test Vitest de packages/shared.

export declare const ENTRY: string;
export declare const OUTFILE: string;

/** Construit le bundle ; rend son texte (`write: false`), ou `null` après l'avoir écrit. */
export declare function buildNorynBundle(options?: { write?: false; banner?: string }): Promise<string>;
export declare function buildNorynBundle(options: { write: true; banner?: string }): Promise<null>;

/** Charge un bundle à part, comme le ferait la fonction. */
export declare function loadBundle(text: string): Promise<typeof import('../packages/shared/src/noryn/index')>;
