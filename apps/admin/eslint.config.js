import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// Config ESLint (flat) web React — l'app mobile utilise eslint-config-expo,
// inadaptée ici. Couvre TS + react-hooks + react-refresh.
export default tseslint.config(
  // `coverage/` est le rapport HTML généré par Vitest : ESLint y trouvait les scripts d'Istanbul
  // et remontait des avertissements sur du code qu'on n'écrit pas. Ce bruit apparaît dès qu'un dev
  // lance `test:coverage` en local, et pas en CI — soit exactement le genre d'écart qui apprend à
  // ignorer la sortie du linter.
  { ignores: ['dist', 'node_modules', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        console: 'readonly',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
);
