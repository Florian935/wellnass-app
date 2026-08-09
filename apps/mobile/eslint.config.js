// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
// Mêmes extensions que le préréglage Expo (`.android.js`, `.native.tsx`, …) : on ne redéfinit que
// l'emplacement de recherche, pas la liste des extensions.
const { allExtensions } = require('eslint-config-expo/flat/utils/extensions');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*'],
  },
  {
    /**
     * Résolution des imports — ancrée sur le `node_modules` **hoisté à la racine** du monorepo.
     *
     * `eslint-config-expo` configure déjà le résolveur `node`, mais sans `moduleDirectory` : la
     * recherche part alors du **répertoire de travail** d'ESLint. `npx eslint .` (lancé depuis
     * `apps/mobile`) trouve donc les paquets, tandis qu'`expo lint` — ce que lance `npm run lint`,
     * et donc la CI — ne les trouve pas. Symptôme observé le 06/08/2026 :
     * `react-native-android-widget` (hoisté à la racine, absent d'`apps/mobile/node_modules`)
     * remontait `import/no-unresolved` sur les 3 fichiers de `src/widgets/`, alors que
     * `require.resolve` et le résolveur appelé à la main le trouvaient tous les deux.
     *
     * Le piège n'est pas ce paquet en particulier : **tout paquet hoisté et non dupliqué** dans
     * `apps/mobile/node_modules` peut déclencher le même faux positif, au hasard des arbitrages
     * d'installation de npm. On rend donc les deux racines explicites plutôt que d'ajouter une
     * exception par paquet.
     */
    settings: {
      'import/resolver': {
        node: {
          extensions: allExtensions,
          moduleDirectory: ['node_modules', '../../node_modules'],
        },
      },
    },
  },
  {
    /**
     * Fichiers de test — deux règles désactivées, parce qu'elles décrivent un monde que Jest
     * n'habite pas.
     *
     * 1. **`import/first`.** `jest.mock(...)` est **hissé au-dessus des imports** par Babel : un
     *    module doit donc être importé **après** l'appel qui le mocke, sinon on capture le vrai
     *    module. L'ordre que la règle réclame est précisément celui qui casse le test.
     * 2. **`no-require-imports`.** Une fabrique `jest.mock()` ne peut référencer aucune variable
     *    du fichier (elle est hissée) : `require()` à l'intérieur est la seule façon d'y charger
     *    quoi que ce soit. C'est la forme documentée par Jest.
     *
     * Pourquoi une exception de configuration plutôt que des `eslint-disable` en tête de fichier :
     * il y en aurait **70**, chacun à recopier dans le prochain test, et un commentaire de
     * désactivation finit toujours par masquer autre chose que ce qu'il visait. Surtout, 70
     * avertissements qu'on apprend à ignorer, c'est un `npm run lint` dont plus personne ne lit la
     * sortie — et le jour où une vraie alerte apparaît, elle se noie dedans.
     */
    files: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx', 'jest.setup.ts'],
    rules: {
      'import/first': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    /**
     * Garde-fou « tout nombre affiché passe par un formateur localisé ».
     *
     * Trois défauts identiques ont été trouvés le même soir en recette device (31/07 – 01/08/2026),
     * chacun avec une cause différente mais le même symptôme — un **point** décimal au milieu d'une
     * app francophone :
     *   1. « Essaie 82.5 kg »        → `weightInputValue()` (pensé pour un champ de saisie) réutilisé
     *                                  comme texte d'affichage ;
     *   2. axe « 90.2 | 67.7 »       → libellés natifs de gifted-charts, faute de `formatYLabel` ;
     *   3. « +41.2 g de lipides »    → interpolation i18next, qui fait un `String()` brut.
     *
     * Seul le premier cas est détectable statiquement de façon fiable : les helpers `*InputValue`
     * ont un usage légitime (pré-remplir un `TextInput`) et un usage fautif (produire du texte), et
     * les deux se distinguent au contexte d'appel. La règle vise donc précisément ce contexte —
     * l'intérieur d'un `t(...)`, c'est-à-dire une chaîne destinée à être lue.
     *
     * Pour les deux autres cas, la convention est documentée dans
     * `docs/specs/technical/bonnes-pratiques.md` : le formateur d'affichage est `useUnits()`
     * (`formatWeight`, `formatDistance`, `formatCircumference`, `formatAxisNumber`), jamais
     * `String(n)`, `n.toFixed()` ni une interpolation directe.
     */
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.name='t'] CallExpression[callee.property.name=/InputValue$/]",
          message:
            "Les helpers `*InputValue` produisent un point décimal (String(Number(...))) : ils sont faits pour pré-remplir un champ de saisie, pas pour être affichés. Utilise le formateur localisé de useUnits() — formatWeight / formatDistance / formatCircumference / formatAxisNumber.",
        },
      ],
    },
  },
]);
