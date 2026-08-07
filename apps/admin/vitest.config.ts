import { defineConfig } from 'vitest/config';

/**
 * Tests du back-office.
 *
 * Environnement `node` : ce qui est testé ici est la **couche data** (`src/data`) et les briques
 * pures (`src/lib`), pas le rendu React. Les écrans demanderont `jsdom` + Testing Library — à
 * ajouter le jour où on les couvre (lot 5 de docs/specs/technical/strategie-tests.md), pas avant :
 * un jsdom chargé pour rien ralentit chaque exécution.
 *
 * `src/lib/supabase.ts` lit `import.meta.env` et **lève au chargement** sans les variables Vite.
 * On les fournit ici pour que l'import du module ne casse pas ; le client réel n'est jamais
 * appelé, les tests mockent `../lib/supabase` (voir `src/test-utils/supabase-mock.ts`).
 */
export default defineConfig({
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://localhost'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('test-anon-key'),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/data/**/*.ts', 'src/lib/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/lib/supabase.ts'],
      // ── Seuils (lot 6, 03/08/2026) ──────────────────────────────────────────
      //
      // **Cliquets** posés sous le réel du jour (56 % d'instructions, 86,9 % de branches) : ils
      // interdisent la régression, ils ne fixent pas d'objectif. L'écart entre les deux chiffres
      // est normal ici et mérite d'être compris : les **écritures** sont couvertes avec leurs
      // chemins d'échec (d'où les branches hautes), les **lectures de liste** ne le sont pas
      // encore (d'où les instructions plus basses).
      //
      // Le périmètre s'arrête à `src/data` et `src/lib` : les écrans React ne sont pas mesurés
      // tant qu'ils ne sont pas testés (lot 5), sinon le seuil ne dirait plus rien.
      // Relevé le 03/08/2026 (54 → 60) après couverture des lectures de liste : un cliquet ne
      // sert à rien s'il reste sous le réel — on le remonte à chaque palier gagné.
      //
      // Relevé de nouveau le **04/08/2026** (60 → 68) après couverture de `exercise-variants.ts`,
      // qui était à **0 %** — 172 lignes de couche data sans un seul test, le plus gros trou du
      // paquet. Réel : 68,88 % d'instructions, 87,86 % de branches, 70,17 % de fonctions.
      //
      // Relevé une dernière fois le **07/08/2026** (68 → 96) : `exercises.ts` (49,8 → 99,1 %),
      // `programs.ts` (57,8 → 96,9 %), `foods.ts` et `users.ts` à **100 %**. Réel : 97,71 %
      // d'instructions, 89,59 % de branches, 98,27 % de fonctions. **La couche data du back-office
      // est couverte** ; le seuil est désormais assez haut pour qu'un nouveau fichier non testé le
      // fasse rougir — ce qui est exactement l'effet recherché à ce stade.
      //
      // Les branches restent en retrait (89,6 %) : ce sont surtout des gardes défensives sur des
      // colonnes `numeric` nullables. Même arbitrage qu'au §5 bis pour `packages/shared`.
      thresholds: {
        statements: 96,
        branches: 89,
        functions: 96,
        lines: 96,
      },
    },
  },
});
