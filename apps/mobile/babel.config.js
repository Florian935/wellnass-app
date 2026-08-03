// Requis par @powersync/react-native : support des async generators (watched queries).
module.exports = function (api) {
  // `api.cache(true)` figerait la config pour tous les environnements ; on la recalcule quand
  // NODE_ENV change, puisque le bloc « tests uniquement » ci-dessous en dépend.
  api.cache.using(() => process.env.NODE_ENV);

  const isTest = process.env.NODE_ENV === 'test';

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      '@babel/plugin-transform-async-generator-functions',
      // ── Tests uniquement ──────────────────────────────────────────────────
      // `babel-preset-expo` conserve les `import()` dynamiques tels quels : Metro s'en sert pour
      // le chargement paresseux des modules natifs (`health-connect.ts` charge ainsi
      // `react-native-health-connect` à la demande, jamais au niveau du fichier).
      //
      // Jest, lui, s'exécute en CommonJS : un `import()` non transpilé y échoue avec
      // « A dynamic import callback was invoked without --experimental-vm-modules », le module
      // sous test part dans son `catch`, et le test passe au vert en ayant testé le chemin
      // d'erreur — pire qu'un échec franc. Ce plugin les convertit en `require` pour les tests
      // seulement ; le bundle Metro n'est pas concerné.
      ...(isTest ? ['dynamic-import-node'] : []),
    ],
  };
};
