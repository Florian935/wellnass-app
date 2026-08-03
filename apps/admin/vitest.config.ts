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
    },
  },
});
