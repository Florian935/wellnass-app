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
      // **Objectif de [bonnes-pratiques §4](../../docs/specs/technical/bonnes-pratiques.md) atteint
      // sur trois axes sur quatre**, le 04/08/2026 : instructions, fonctions et lignes sont à
      // **100 %** et verrouillées ici. Elles ne doivent plus jamais redescendre.
      //
      // ⚠️ **Les branches sont arbitrées à 97 %, et c'est une décision, pas un renoncement.**
      // Le réel est 97,35 %. Les ~2,5 % restants ont été audités un par un le 04/08/2026 : ils ne
      // relèvent pas d'un manque de tests mais de **code défensif inatteignable**, de deux familles :
      //
      //  1. **cas d'égalité de comparateurs de tri appliqués à des clés de `Map`** — uniques par
      //     construction, donc l'égalité ne peut jamais survenir (`learned-hour.ts`, `steps.ts`) ;
      //  2. **replis `?? 0` sur des `Map.get`** dont la clé vient d'être écrite quelques lignes plus
      //     haut (`training-nutrition.ts`, `weekly-review.ts`, `workout.ts`).
      //
      // Les couvrir demanderait soit des tests qui figent des comportements absurdes, soit de
      // **retirer ces filets** — ce qui échangerait une métrique contre une protection réelle
      // contre les évolutions futures. Là où supprimer le code mort corrigeait un vrai défaut, ça
      // a été fait (voir `pace-records.ts` : un `NaN` retourné comme record, et
      // `training-nutrition.ts` : un `return null` prouvé inatteignable).
      //
      // Ne pas rebaisser ces chiffres pour faire passer un commit : un seuil rouge signifie qu'on a
      // retiré de la couverture. Ajouter des tests, pas baisser le seuil.
      thresholds: {
        statements: 100,
        branches: 97,
        functions: 100,
        lines: 100,
      },
    },
  },
});
