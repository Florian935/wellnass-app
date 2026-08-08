/**
 * Garde-fou contre les **lectures d'horloge gelées par React Compiler**.
 *
 * ── Pourquoi ce test existe, et pourquoi il compile du code ───────────────────────────────────────
 * `experiments.reactCompiler` est activé. Quand une valeur calculée dans un composant ou un hook n'a
 * **aucune entrée réactive** — typiquement `localDayKey(new Date())` — le compilateur la classe
 * constante et la range dans un slot `useMemoCache` **mount-only**, évalué une seule fois pour la
 * durée de vie de l'instance. Sur un hook monté dans le layout racine ou dans un onglet (aucun
 * `unmountOnBlur` n'est configuré), la valeur ne change donc **plus jamais**.
 *
 * Cette classe de bugs est **structurellement invisible** aux trois portes de qualité :
 * - `tsc` ne voit rien, le code est parfaitement typé ;
 * - en **dev**, `enableResetCacheOnSourceFileChanges: !isProduction` réinitialise le cache à chaque
 *   sauvegarde de fichier, donc le défaut ne se reproduit pas ;
 * - sous **Jest**, `babel-preset-expo` n'applique le plugin que si l'appelant pose
 *   `supportsReactCompiler` — ce que seul le transformer Metro fait, jamais `babel-jest`. Un test de
 *   comportement classique ne peut donc pas l'attraper, même en simulant un changement de jour.
 *
 * Elle ne se manifeste qu'en **build release**, chez l'utilisateur. Le 30/07/2026, un audit en a
 * trouvé **19 occurrences** dans du code livré — dont le rappel de série qui ne repartait plus, et
 * un check-in de bien-être qui écrivait sur le mauvais jour.
 *
 * Ce test est donc le **seul** garde-fou possible : il applique lui-même le compilateur et inspecte
 * la sortie. Il échoue si un bloc mémoïsé au montage contient une lecture d'horloge.
 *
 * ── Ce qui reste légitime ─────────────────────────────────────────────────────────────────────────
 * `new Date()` dans un **callback d'événement** est correct : la closure lit l'horloge à l'appel, pas
 * au rendu. Le test ne regarde que les blocs `memo_cache_sentinel`, donc ces cas ne le déclenchent
 * pas. Et une fonction de **module** (hors composant/hook) n'est jamais mémoïsée.
 *
 * En cas d'échec : la valeur doit dériver de `useTodayKey()` / `useTodayDate()` /
 * `useWindowStartKey()` / `useWindowStartUtc()` (voir [useTodayKey.ts](../useTodayKey.ts)), ou la
 * date de référence doit être **injectée** en paramètre si le calcul vit dans une fonction de module.
 */

import { transformSync } from '@babel/core';

/**
 * Accès Node local au test.
 *
 * Le `tsconfig` de `apps/mobile` ne déclare pas `@types/node` — c'est voulu : le code applicatif
 * tourne sur Hermes, pas sur Node, et exposer les types Node partout inviterait à écrire du code qui
 * ne marche pas sur l'appareil. Ce test, lui, tourne bien sous Node : on récupère donc ce dont il a
 * besoin via un `require` typé localement, sans élargir la configuration globale.
 */
const nodeRequire = require as unknown as {
  (id: string): unknown;
  resolve(id: string): string;
};
const { readFileSync } = nodeRequire('fs') as { readFileSync(p: string, enc: string): string };
const { join } = nodeRequire('path') as { join(...parts: string[]): string };
// `__dirname` est une variable de portée module dans le wrapper CommonJS de Jest, pas une propriété
// de `globalThis` — d'où la déclaration plutôt qu'un accès via `globalThis`.
declare const __dirname: string;
const currentDir = __dirname;

/** Racine de `apps/mobile`. */
const APP_ROOT = join(currentDir, '..', '..', '..');

/**
 * Fichiers sous surveillance : ceux qui portent des décisions « aujourd'hui » et vivent longtemps.
 *
 * Liste **explicite** plutôt qu'un scan de tout `src` : un scan complet prendrait des dizaines de
 * secondes en CI et signalerait des cas bénins, ce qui finirait par faire désactiver le test. Ajouter
 * un fichier ici est un geste conscient — c'est le but.
 */
const WATCHED = [
  'src/data/repositories/dashboard-repository.ts',
  'src/data/repositories/weekly-review-repository.ts',
  'src/data/repositories/goal-repository.ts',
  'src/data/repositories/planned-session-repository.ts',
  'src/data/repositories/run-repository.ts',
  'src/data/repositories/records-repository.ts',
  'src/data/repositories/daily-steps-repository.ts',
  'src/data/repositories/daily-wellbeing-repository.ts',
  'src/data/repositories/reminder-habits-repository.ts',
  'src/data/repositories/notification-repository.ts',
  // US INSIGHTS-01 : l'agrégateur porte une décision « aujourd'hui » — la porte des 14 jours du
  // moteur (`isStale`) — et vit tant que l'écran d'accueil est monté. Une horloge lue dans son
  // corps serait gelée par React Compiler et la sélection ne bougerait plus jusqu'au redémarrage
  // de l'app : exactement le défaut que le critère de recette 14 cherche.
  'src/data/repositories/insights-repository.ts',
  // `WellbeingCard.tsx` était surveillé ici ; le composant a été **supprimé** le 08/08/2026 avec
  // les 11 autres cartes devenues mortes après INSIGHTS-02. La liste est lue par `readFileSync` :
  // y laisser un chemin inexistant aurait fait échouer ce test, pas seulement l'affaiblir.
  'src/components/dashboard/NutritionSummaryCard.tsx',
];

/** Expressions qui lisent l'horloge. */
const CLOCK_READ = /new Date\(\s*\)|Date\.now\(\s*\)/;

/**
 * Compile un fichier avec React Compiler et renvoie les lignes de code qui, **dans un bloc mémoïsé
 * au montage**, lisent l'horloge.
 *
 * Un bloc mount-only a la forme `if ($[n] === Symbol.for("react.memo_cache_sentinel")) { … }`. On
 * découpe donc la sortie sur cette sentinelle et on inspecte chaque bloc jusqu'à sa fermeture.
 */
function frozenClockReads(relativePath: string): string[] {
  const source = readFileSync(join(APP_ROOT, relativePath), 'utf8');

  const result = transformSync(source, {
    filename: relativePath,
    babelrc: false,
    configFile: false,
    presets: [[nodeRequire.resolve('@babel/preset-typescript'), { isTSX: true, allExtensions: true }]],
    plugins: [[nodeRequire.resolve('babel-plugin-react-compiler'), { target: '19' }]],
    compact: false,
  });

  const code = result?.code ?? '';
  const offenders: string[] = [];

  const SENTINEL = 'Symbol.for("react.memo_cache_sentinel")';
  let cursor = code.indexOf(SENTINEL);

  while (cursor !== -1) {
    // Bloc = du `{` qui suit la sentinelle jusqu'à sa fermeture, en comptant les accolades.
    const blockStart = code.indexOf('{', cursor);
    if (blockStart === -1) break;

    let depth = 0;
    let end = blockStart;
    for (; end < code.length; end += 1) {
      if (code[end] === '{') depth += 1;
      else if (code[end] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    const block = code.slice(blockStart, end + 1);
    for (const line of block.split('\n')) {
      // On ignore les closures : `() => …` lit l'horloge à l'appel, pas au montage.
      if (CLOCK_READ.test(line) && !line.includes('=>') && !line.includes('function')) {
        offenders.push(line.trim());
      }
    }

    cursor = code.indexOf(SENTINEL, end);
  }

  return offenders;
}

describe('React Compiler — aucune lecture d’horloge gelée au montage', () => {
  it.each(WATCHED)('%s', (relativePath) => {
    const offenders = frozenClockReads(relativePath);

    expect(offenders).toEqual([]);
  });

  it('détecte réellement le défaut (test du test)', () => {
    // Sans ce cas, un détecteur cassé passerait pour un code sain. On compile un hook fautif et on
    // vérifie que le mécanisme le voit.
    const source = `
      import { useQuery } from '@powersync/react';
      export function useBroken() {
        const todayKey = localDayKey(new Date());
        return useQuery('SELECT 1 WHERE d = ?', [todayKey]);
      }
    `;
    const result = transformSync(source, {
      filename: 'broken.ts',
      babelrc: false,
      configFile: false,
      presets: [[nodeRequire.resolve('@babel/preset-typescript'), { isTSX: true, allExtensions: true }]],
      plugins: [[nodeRequire.resolve('babel-plugin-react-compiler'), { target: '19' }]],
      compact: false,
    });

    const code = result?.code ?? '';
    expect(code).toContain('react.memo_cache_sentinel');
    expect(code).toMatch(/memo_cache_sentinel[\s\S]{0,200}new Date\(\)/);
  });
});
