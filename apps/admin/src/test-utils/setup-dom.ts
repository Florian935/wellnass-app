/**
 * Setup commun des tests du back-office.
 *
 * Chargé pour **tous** les fichiers de test, y compris ceux qui tournent en environnement `node` :
 * il ne doit donc rien faire qui suppose un DOM au niveau module. D'où le garde `typeof document`
 * — un `import '@testing-library/jest-dom'` nu ferait tomber les 249 tests de couche data.
 */

import { afterEach } from 'vitest';

if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
  const { cleanup } = await import('@testing-library/react');

  // Démonte l'arbre entre deux tests. Sans ça, `getByText` remonte des nœuds du test précédent —
  // un faux vert particulièrement retors, puisqu'il ne se manifeste qu'à partir du deuxième test.
  afterEach(() => cleanup());
}
