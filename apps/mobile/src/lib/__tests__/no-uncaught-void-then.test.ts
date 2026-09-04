/**
 * Garde-fou contre les **rejets de promesse non capturés** dans les chaînes `void … .then(…)`.
 *
 * ── Pourquoi ce test existe ─────────────────────────────────────────────────────────────────────
 * `void p` satisfait `@typescript-eslint/no-floating-promises` — c'est même la façon officielle de
 * dire « je lance sans attendre ». Mais `void` **jette la référence, il ne capture pas le rejet** :
 * si `p` rejette, la promesse produite par `.then(cb)` rejette à son tour, plus personne ne la
 * tient, et React Native remonte un avertissement global au mieux, rien du tout au pire.
 *
 * Le motif s'est répété **quatre fois avant que ce test existe**, et chaque fois il a été
 * *rencontré*, jamais déduit :
 *  - 11/08/2026 — deux `void p.finally(…)` trouvés en couvrant les cinq derniers composants à 0 %.
 *    `finally` **relaie** le rejet, il ne l'absorbe pas.
 *  - 12/08/2026 — `AccessDenied.handleLogout`, en `try/finally` **sans `catch`** : le `finally`
 *    rendait bien la main, l'erreur remontait quand même. Symptôme retors : **tous les tests au
 *    vert et un code de sortie à 1**.
 *  - 12/08/2026 — **treize** sites `void … .then(…)` recensés d'un coup, dont un qui **bloquait le
 *    démarrage de l'app** (`auth-store` : `initializing` restait à `true` pour toujours si la
 *    lecture de session échouait).
 *
 * Quatre découvertes fortuites pour un même motif : c'est le signe qu'il faut un garde-fou, pas une
 * consigne. Ni `tsc` ni ESLint ne peuvent l'attraper — le premier voit du code bien typé, le second
 * considère le `void` comme la solution.
 *
 * ── Ce que le test autorise ─────────────────────────────────────────────────────────────────────
 * - `void appel()` **nu**, sans continuation : il en existe ~287 dans le dépôt, et la plupart sont
 *   légitimes (la fonction appelée capture déjà en interne). Les traiter tous ajouterait du bruit
 *   sans valeur démontrée. **Périmètre volontairement limité aux chaînes**, c'est-à-dire aux cas où
 *   quelqu'un a écrit une suite pour le succès — et donc pensé au succès seulement.
 * - Une chaîne qui porte un `.catch(…)` **n'importe où**, avant ou après le `.then`.
 *
 * ── En cas d'échec ──────────────────────────────────────────────────────────────────────────────
 * Ajouter un `.catch()` à la chaîne signalée. S'il n'y a rien à annoncer à l'utilisateur, un
 * `.catch(() => undefined)` **avec un commentaire disant pourquoi** est la convention du dépôt
 * (voir `planning/index.tsx`, `nutrition.tsx`). Un `catch` sans commentaire est un aveu.
 */

import { parse } from '@babel/parser';

/**
 * Accès Node local au test — même raison que dans `no-frozen-clock.test.ts` : le `tsconfig` de
 * `apps/mobile` n'expose pas `@types/node`, et c'est voulu (le code applicatif tourne sur Hermes).
 */
const nodeRequire = require as unknown as { (id: string): unknown };
const { readFileSync, readdirSync, statSync } = nodeRequire('fs') as {
  readFileSync(p: string, enc: string): string;
  readdirSync(p: string): string[];
  statSync(p: string): { isDirectory(): boolean };
};
const { join, relative } = nodeRequire('path') as {
  join(...parts: string[]): string;
  relative(from: string, to: string): string;
};
declare const __dirname: string;

/** Racine du code applicatif : `apps/mobile/src`. */
const SRC = join(__dirname, '..', '..');

/** Tous les `.ts`/`.tsx` de `src`, **hors tests** — un test peut légitimement provoquer un rejet. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'test-utils') continue;
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Nom de la propriété appelée (`foo.then(...)` → `then`), ou `null`. */
function calleeProperty(node: Record<string, unknown>): string | null {
  const callee = node.callee as Record<string, unknown> | undefined;
  if (!callee || callee.type !== 'MemberExpression') return null;
  const prop = callee.property as Record<string, unknown> | undefined;
  return typeof prop?.name === 'string' ? prop.name : null;
}

/**
 * Remonte une chaîne d'appels et collecte les méthodes rencontrées.
 *
 * `a().then(x).catch(y)` rend `['catch', 'then']`. On s'arrête dès qu'on quitte la chaîne : c'est
 * ce qui évite de confondre deux chaînes voisines dans la même expression.
 */
function chainMethods(node: unknown): string[] {
  const out: string[] = [];
  let current = node as Record<string, unknown> | undefined;
  while (current && current.type === 'CallExpression') {
    const prop = calleeProperty(current);
    if (prop !== null) out.push(prop);
    const callee = current.callee as Record<string, unknown> | undefined;
    current =
      callee?.type === 'MemberExpression'
        ? (callee.object as Record<string, unknown>)
        : undefined;
  }
  return out;
}

/** Parcourt l'AST et rend les lignes des `void <chaîne .then sans .catch>`. */
export function offendingLines(code: string): number[] {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
    errorRecovery: true,
  });

  const found: number[] = [];
  const seen = new Set<unknown>();

  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);

    const n = node as Record<string, unknown>;
    if (n.type === 'UnaryExpression' && n.operator === 'void') {
      const methods = chainMethods(n.argument);
      if (methods.includes('then') && !methods.includes('catch')) {
        const loc = n.loc as { start: { line: number } } | undefined;
        if (loc) found.push(loc.start.line);
      }
    }

    for (const value of Object.values(n)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
    }
  };

  walk(ast);
  return found;
}

describe('aucune chaîne `void … .then(…)` sans `.catch`', () => {
  it('🔴 tout le code applicatif capture les rejets de ses chaînes de promesses', () => {
    const coupables: string[] = [];

    for (const file of sourceFiles(SRC)) {
      const code = readFileSync(file, 'utf8');
      // Filtre bon marché avant de payer le parseur sur ~300 fichiers.
      if (!code.includes('.then(')) continue;
      for (const line of offendingLines(code)) {
        coupables.push(`${relative(SRC, file).replace(/\\/g, '/')}:${line}`);
      }
    }

    expect(coupables).toEqual([]);
  });

  it('détecte bien le motif — le garde-fou n’est pas vide', () => {
    // Contre-épreuve **intégrée** : sans elle, un parcours d'AST cassé rendrait le test
    // définitivement vert et personne ne le saurait. C'est la leçon des quatre découvertes
    // fortuites — un garde-fou qu'on n'a jamais vu échouer ne garde rien.
    expect(offendingLines('void faire().then((x) => x);')).toEqual([1]);
    expect(offendingLines('void a.b().then(f).finally(g);')).toEqual([1]);
  });

  it('n’alerte pas sur ce qui est légitime', () => {
    // Chaîne capturée, dans les deux ordres.
    expect(offendingLines('void faire().then(f).catch(g);')).toEqual([]);
    expect(offendingLines('void faire().catch(g).then(f);')).toEqual([]);
    // `void` nu : hors périmètre, et majoritairement légitime (~287 sites).
    expect(offendingLines('void faire();')).toEqual([]);
    // Chaîne attendue ou rendue : quelqu'un en tient la référence.
    expect(offendingLines('async function f() { await faire().then(g); }')).toEqual([]);
    expect(offendingLines('const p = faire().then(g);')).toEqual([]);
  });
});
