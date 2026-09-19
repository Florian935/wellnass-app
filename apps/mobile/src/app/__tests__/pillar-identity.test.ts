/**
 * Invariant d'identité visuelle : **tout écran d'un pilier déclare son pilier** (US CARDIO-UX02).
 *
 * ── Le défaut que ce test ferme ──────────────────────────────────────────────────────────────────
 * MUSCU-UX04 a donné une palette à chaque pilier, résolue par `useTheme()` à partir de
 * `menu-accent-store.activeMenu`. Ce champ n'était posé que par `useMenuFocus`, appelé **uniquement
 * par les cinq écrans d'onglet**. Les écrans empilés héritaient donc du dernier onglet visité :
 *
 *  - ouvrir `/run` depuis l'onglet Course → bleu (correct, par accident de parcours) ;
 *  - ouvrir `/run` depuis l'Accueil (`QuickActions`), `/run/active` (`NowCard`) ou
 *    `/running-history` (`RecordRecentCard`) → **terracotta**, sur tout le pilier Course.
 *
 * Rien n'échoue, rien ne se voit en revue de diff : l'écran est simplement de la mauvaise couleur,
 * et seulement pour qui est arrivé par la mauvaise porte. C'est précisément le genre de défaut que
 * seul un test de garde attrape — il a été remonté en recette par Florian le 19/09/2026 sous la
 * forme « le bleu n'est pas repris sur le reste des écrans du pilier ».
 *
 * ⚠️ **Ce test lit les fichiers, il ne les rend pas** — même parti pris que `route-declarations`.
 * Monter un écran de course demanderait PowerSync, l'auth, les polices et vingt hooks, pour
 * vérifier la présence d'un appel.
 *
 * 🔴 **Portée volontairement limitée au pilier Course.** Les piliers Musculation et Nutrition ont
 * exactement le même défaut (`/workout`, `/exercises`, `/nutrition-stats`… n'appellent pas non plus
 * `useMenuFocus`) : il est **constaté, non corrigé** ici, parce que CARDIO-UX02 refond le pilier
 * Course et qu'élargir la correction reviendrait à toucher trente écrans sans recette. Voir
 * BACKLOG.md. Le jour où ce sera traité, il suffira d'ajouter les dossiers à `PILIERS` ci-dessous.
 */
// `require` plutôt qu'un `import` : le tsconfig mobile ne charge pas les types Node (c'est une
// cible React Native). Même convention que `route-declarations.test.ts`.
type Entree = { name: string; isDirectory: () => boolean };
const { readdirSync, readFileSync } = require('fs') as {
  readdirSync: (p: string, o: { withFileTypes: true }) => Entree[];
  readFileSync: (p: string, e: 'utf8') => string;
};
const { join } = require('path') as { join: (...parts: string[]) => string };
declare const __dirname: string;

const APP_DIR = join(__dirname, '..');

/** Les racines d'écrans à contrôler, et le pilier qu'elles doivent déclarer. */
const PILIERS: readonly { chemin: string[]; pilier: string }[] = [
  { chemin: ['run'], pilier: 'running' },
  { chemin: ['running-history'], pilier: 'running' },
  { chemin: ['running-programs'], pilier: 'running' },
];

/** Écrans de premier niveau (hors dossier) qui appartiennent aussi à un pilier. */
const FICHIERS: readonly { fichier: string; pilier: string }[] = [
  { fichier: 'running-profile.tsx', pilier: 'running' },
];

/** Un `_layout.tsx` ne rend pas d'écran : il monte un `Stack`, il n'a pas de couleur à poser. */
const NON_ECRANS = new Set(['_layout.tsx', '__tests__']);

/** Tous les fichiers d'écran d'un dossier, récursivement. */
function ecransDe(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (NON_ECRANS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...ecransDe(full));
    } else if (entry.name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

describe('identité de pilier — aucun écran ne dépend de l’onglet d’où l’on vient', () => {
  for (const { chemin, pilier } of PILIERS) {
    const dir = join(APP_DIR, ...chemin);
    for (const fichier of ecransDe(dir)) {
      const court = fichier.slice(fichier.indexOf(join('src', 'app')));
      it(`${court} déclare useMenuFocus('${pilier}')`, () => {
        const source = readFileSync(fichier, 'utf8');
        expect(source).toContain(`useMenuFocus('${pilier}')`);
      });
    }
  }

  for (const { fichier, pilier } of FICHIERS) {
    it(`${fichier} déclare useMenuFocus('${pilier}')`, () => {
      const source = readFileSync(join(APP_DIR, fichier), 'utf8');
      expect(source).toContain(`useMenuFocus('${pilier}')`);
    });
  }

  it('l’onglet Course déclare le pilier, comme les quatre autres', () => {
    const source = readFileSync(join(APP_DIR, '(tabs)', 'running.tsx'), 'utf8');
    expect(source).toContain("useMenuFocus('running')");
  });

  it('couvre bien tous les écrans du pilier Course — la liste n’est pas vide', () => {
    // Garde-fou du garde-fou : si un renommage de dossier vidait `ecransDe`, la boucle
    // ci-dessus ne déclarerait plus aucun test et la suite passerait au vert sans rien vérifier.
    const total = PILIERS.reduce((n, p) => n + ecransDe(join(APP_DIR, ...p.chemin)).length, 0);
    expect(total).toBeGreaterThanOrEqual(8);
  });
});
