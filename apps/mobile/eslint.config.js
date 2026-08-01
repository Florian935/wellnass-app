// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*'],
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
