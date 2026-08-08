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

  // ── `Blob.prototype.text` / `arrayBuffer` ────────────────────────────────────
  //
  // jsdom **n'implémente pas** ces deux méthodes, même en v26 (jsdom#2555). Ce n'est pas une
  // question de version : les installer plus récent n'y change rien.
  //
  // Sans ce complément, `FoodImportScreen` casse là où on ne regarde pas : son `await file.text()`
  // rejette, le gestionnaire `onChange` avale l'erreur, et l'écran reste simplement figé sur son
  // état initial. Onze tests échouaient sur « bouton d'import introuvable » — le symptôme est à
  // trois écrans de la cause.
  //
  // L'implémentation lit le contenu via `FileReader`, que jsdom fournit, lui.
  const proto = Blob.prototype as Blob & {
    text?: () => Promise<string>;
    arrayBuffer?: () => Promise<ArrayBuffer>;
  };

  const lire = <T>(blob: Blob, methode: 'readAsText' | 'readAsArrayBuffer') =>
    new Promise<T>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as T);
      reader.onerror = () => reject(reader.error);
      reader[methode](blob);
    });

  proto.text ??= function text(this: Blob) {
    return lire<string>(this, 'readAsText');
  };
  proto.arrayBuffer ??= function arrayBuffer(this: Blob) {
    return lire<ArrayBuffer>(this, 'readAsArrayBuffer');
  };
}
