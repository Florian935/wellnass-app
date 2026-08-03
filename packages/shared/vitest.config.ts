import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/index.ts',
        // Fichier **généré** par `npm run db:types` : 2 589 lignes de types purs et un objet
        // `Constants` vide. Le mesurer n'apprend rien et tirait à lui seul le paquet sous les
        // 100 % exigés — un seuil qu'on ne pouvait donc pas tenir, et que personne ne voyait
        // échouer puisque la CI ne lançait jamais la couverture.
        'src/database.types.ts',
      ],
      // ⚠️ **Ces seuils ne sont PAS l'objectif.** [bonnes-pratiques §4](../../docs/specs/technical/bonnes-pratiques.md)
      // exige 100 % sur ce paquet (logique pure, « aucune excuse ») ; le réel au 03/08/2026 est
      // 99,35 % d'instructions et **95,12 % de branches**. L'écart existait depuis longtemps sans
      // que personne le voie : le seuil à 100 % était bien déclaré, mais la CI ne lançait jamais
      // la couverture — il n'échouait donc nulle part.
      //
      // Ce qui est posé ici est un **cliquet** sur la valeur réelle : il interdit la régression
      // sans prétendre que l'objectif est atteint. Combler l'écart (ou ré-arbitrer la règle des
      // 100 %) est une décision à part, inscrite au BACKLOG. Ne pas rebaisser ces chiffres pour
      // faire passer un commit : c'est le seul garde-fou de ce paquet.
      thresholds: {
        statements: 99,
        branches: 95,
        functions: 99,
        lines: 99,
      },
    },
  },
});
