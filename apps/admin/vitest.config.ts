import { defineConfig } from 'vitest/config';

/**
 * Tests du back-office.
 *
 * **Deux environnements, choisis par l'extension du fichier de test** (07/08/2026) :
 *  - `.test.ts`  → `node`. La couche data (`src/data`) et les briques pures (`src/lib`) n'ont pas
 *    besoin d'un DOM, et lui en charger un ralentirait chaque exécution pour rien.
 *  - `.test.tsx` → `jsdom`. Les écrans React, eux, en ont besoin.
 *
 * La règle est portée par `environmentMatchGlobs` plutôt que par un pragma en tête de chaque
 * fichier : un pragma s'oublie, et l'oubli ne se voit pas — le test échoue sur un
 * « document is not defined » qui ne dit pas qu'il manque une ligne de commentaire.
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
    environmentMatchGlobs: [['src/**/*.test.tsx', 'jsdom']],
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-utils/setup-dom.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/data/**/*.ts', 'src/lib/**/*.ts', 'src/screens/**/*.tsx'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/lib/supabase.ts'],
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
      //
      // ⚠️ **Cliquets par chemin** depuis l'ouverture des écrans à la mesure (07/08/2026). Les
      // ~2 200 lignes de `src/screens` diluent tout : mesurées ensemble, la couche data à 97,7 % et
      // les écrans à 6,7 % donnent un chiffre global de 30 %, qui ne dit plus rien de ce qu'il
      // protège — on pourrait retirer la moitié des tests de `src/data` en couvrant un écran de
      // plus. D'où deux seuils distincts, chacun calé sous SON réel.
      //
      // Le seuil global qui reste (28/85/80) porte sur l'union et n'est qu'un plancher : la vraie
      // protection est dans les deux entrées ci-dessous. ⚠️ En Vitest 2, un seuil par glob
      // **n'exclut pas** ses fichiers du calcul global — vérifié, contrairement à ce que laisse
      // entendre la doc. Le global doit donc rester cohérent avec l'union, pas avec `src/data`.
      //
      // ⚠️ **Un pourcentage de branches peut BAISSER quand on couvre un gros fichier.** Constaté
      // le 08/08/2026 en couvrant `ProgramEditScreen` (1 458 lignes) : avec le fournisseur v8, un
      // fichier jamais chargé par un test contribue **zéro branche au dénominateur**. Le couvrir à
      // 75 % ajoute d'un coup ses centaines de branches au total, et le pourcentage global recule
      // même si la protection réelle a augmenté. Ne pas lire un seuil qui recule comme une
      // régression sans avoir vérifié ce qui est entré dans la mesure.
      thresholds: {
        statements: 67,
        branches: 84,
        functions: 68,
        lines: 67,
        // Couche data : c'est elle qui écrit dans le contenu partagé par tous les utilisateurs.
        'src/data/**': {
          statements: 97,
          branches: 89,
          functions: 98,
          lines: 97,
        },
        // Écrans React : cliquet volontairement en retrait, comme côté mobile. Un écran arrive
        // toujours moins couvert que la moyenne ; un seuil collé au réel le ferait rougir dès le
        // premier commit, ce qui pousserait à contourner le garde-fou.
        'src/screens/**': {
          statements: 57,
          branches: 78,
          functions: 56,
          lines: 57,
        },
      },
    },
  },
});
