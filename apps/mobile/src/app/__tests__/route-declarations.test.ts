/**
 * Invariant de navigation : **toute route de premier niveau est déclarée dans le Stack racine**
 * (`app/_layout.tsx`).
 *
 * Ce fichier existe parce que `_layout.tsx` porte **trois fois** la même mise en garde, écrite après
 * trois défauts distincts (PAS-01 le 30/07/2026, INSIGHTS-01, REPAS-01) :
 *
 * > « Une route non déclarée ici n'échoue ni au typecheck ni aux tests — seul l'œil voit l'en-tête
 * > manquant. »
 *
 * Une mise en garde répétée trois fois est un test qui manque. Une route absente du Stack hérite du
 * `screenOptions` racine (`headerShown: false`) : elle s'affiche **sans en-tête de navigation**, et
 * si l'écran n'apporte pas lui-même sa zone sûre, son titre se dessine **sous la barre d'état**.
 * Rien n'échoue, rien ne se voit en revue de diff — l'écran est simplement mal posé sur l'appareil.
 *
 * Le 14/08/2026, ce test a trouvé sa première vraie route manquante : **`cycle`** (US CYCLE-01,
 * deux écrans livrés et recettés), plus `templates`, oubliée sans conséquence visible puisque sa
 * pile interne gère déjà ses en-têtes.
 *
 * ⚠️ **Ce test lit le fichier, il ne le rend pas.** Rendre le Stack demanderait de monter
 * PowerSync, l'auth, les polices et vingt hooks — pour vérifier une liste de chaînes. La lecture
 * statique est ici plus fiable que le rendu : elle ne peut pas passer au vert parce qu'un mock a
 * neutralisé le composant.
 */
// `require` plutôt qu'un `import` : le tsconfig mobile ne charge pas les types Node (c'est une
// cible React Native), et ce fichier est le seul à lire le disque. Les signatures utilisées sont
// donc décrites ici, au plus près de leur usage.
type Entree = { name: string; isDirectory: () => boolean };
const { readdirSync, readFileSync } = require('fs') as {
  readdirSync: (p: string, o: { withFileTypes: true }) => Entree[];
  readFileSync: (p: string, e: 'utf8') => string;
};
const { join } = require('path') as { join: (...parts: string[]) => string };
declare const __dirname: string;

const APP_DIR = join(__dirname, '..');
const LAYOUT = join(APP_DIR, '_layout.tsx');

/**
 * Entrées de `src/app` qui ne sont **pas** des routes de premier niveau :
 *  - les groupes `(auth)`, `(onboarding)`, `(tabs)` — déclarés, mais listés à part ici parce que
 *    leurs parenthèses n'apparaissent pas dans les chemins d'URL ;
 *  - `_layout.tsx` lui-même, et les dossiers de tests.
 */
const NON_ROUTES = new Set(['_layout.tsx', '__tests__']);

/** Nom de route Expo Router à partir d'une entrée de dossier (`steps.tsx` → `steps`). */
const routeName = (entry: string) => entry.replace(/\.tsx$/, '');

/** Les routes de premier niveau réellement présentes sur le disque. */
function routesSurDisque(): string[] {
  return readdirSync(APP_DIR, { withFileTypes: true })
    .filter((e) => !NON_ROUTES.has(e.name))
    .filter((e) => e.isDirectory() || e.name.endsWith('.tsx'))
    .map((e) => routeName(e.name))
    .sort();
}

/** Les `<Stack.Screen name="…">` déclarés dans le layout racine. */
function routesDeclarees(): string[] {
  const source = readFileSync(LAYOUT, 'utf8');
  return [...source.matchAll(/<Stack\.Screen\s+name="([^"]+)"/g)]
    .map((m) => m[1]!)
    // `exercises/[id]` est une déclaration de sous-route : elle ne concerne pas cet invariant,
    // qui porte sur le premier niveau.
    .filter((name) => !name.includes('/'))
    .sort();
}

describe('déclaration des routes de premier niveau', () => {
  it('🔴 toute route présente sur le disque est déclarée dans le Stack racine', () => {
    const manquantes = routesSurDisque().filter((r) => !routesDeclarees().includes(r));

    // Si ce test rougit, c'est qu'un écran vient d'être livré sans sa ligne dans `_layout.tsx` :
    // il s'affichera sans en-tête, titre sous la barre d'état. Ajouter la déclaration — pas
    // l'exception ci-dessus.
    expect(manquantes).toEqual([]);
  });

  it('🔴 aucune déclaration ne pointe vers une route qui n’existe plus', () => {
    const orphelines = routesDeclarees().filter((r) => !routesSurDisque().includes(r));

    // L'inverse coûte moins cher mais salit : une déclaration orpheline survit à la suppression
    // d'un écran et laisse croire que la route existe encore.
    expect(orphelines).toEqual([]);
  });

  it('les trois groupes de navigation sont déclarés', () => {
    // Ils portent la bascule auth / onboarding / app : sans déclaration, la gate de routing de
    // `_layout.tsx` redirigerait vers des écrans que le Stack ne connaît pas.
    expect(routesDeclarees()).toEqual(
      expect.arrayContaining(['(auth)', '(onboarding)', '(tabs)']),
    );
  });

  it('🔴 la route `password-reset` porte EXACTEMENT le nom attendu par le deep link', () => {
    // Expo Router résout `wellness://password-reset` comme un chemin et navigue lui-même dessus :
    // un nom différent produit « Unmatched Route », sa navigation gagnant la course contre la gate.
    expect(routesSurDisque()).toContain('password-reset');
    expect(routesDeclarees()).toContain('password-reset');
  });

  it('🔴 les écrans qui piègent l’utilisateur désactivent le geste de retour', () => {
    const source = readFileSync(LAYOUT, 'utf8');

    // `deletion-pending`, `password-reset` et la séance en cours : un balayage arrière y sortirait
    // d'un état qu'on ne sait pas reprendre (compte en suppression, mot de passe à moitié changé,
    // séance ouverte sans écran pour la rouvrir).
    for (const route of ['deletion-pending', 'password-reset', 'workout', 'workout-summary']) {
      const bloc = source.slice(source.indexOf(`name="${route}"`));
      expect(bloc.slice(0, 200)).toContain('gestureEnabled: false');
    }
  });
});
