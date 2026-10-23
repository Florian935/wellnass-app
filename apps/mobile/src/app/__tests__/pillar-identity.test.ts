/**
 * Invariant d'identité visuelle : **tout écran d'un pilier déclare son pilier** (US CARDIO-UX02,
 * étendu à la Musculation et à la Nutrition par l'US IDENT-01).
 *
 * ── Le défaut que ce test ferme ──────────────────────────────────────────────────────────────────
 * MUSCU-UX04 a donné une palette à chaque pilier, résolue par `useTheme()` à partir de
 * `menu-accent-store.activeMenu`. Ce champ n'était posé que par `useMenuFocus`, appelé **uniquement
 * par les cinq écrans d'onglet**. Les écrans empilés héritaient donc du dernier onglet visité :
 *
 *  - ouvrir `/run` depuis l'onglet Course → bleu (correct, par accident de parcours) ;
 *  - ouvrir `/run` depuis l'Accueil (`QuickActions`), `/run/active` (`NowCard`) ou
 *    `/running-history` (`RecordRecentCard`) → **terracotta**, sur tout le pilier Course ;
 *  - ouvrir une séance ou ajouter un aliment depuis l'Accueil → **terracotta** (IDENT-01).
 *
 * Rien n'échoue, rien ne se voit en revue de diff : l'écran est simplement de la mauvaise couleur,
 * et seulement pour qui est arrivé par la mauvaise porte. C'est précisément le genre de défaut que
 * seul un test de garde attrape — il a été remonté en recette par Florian le 19/09/2026 sous la
 * forme « le bleu n'est pas repris sur le reste des écrans du pilier ».
 *
 * ── La règle (IDENT-01, D1) ──────────────────────────────────────────────────────────────────────
 * Un écran appartient à un pilier quand **ce qu'il montre ou modifie relève de ce pilier** ; son
 * identité ne dépend jamais de la porte d'entrée. Un écran **transverse** (Planning, Réglages,
 * Bilan…) ne déclare rien : il prend l'identité de l'écran qui l'ouvre, et `useMenuFocus` la lui
 * garde (pile de D8).
 *
 * ── Exhaustif ────────────────────────────────────────────────────────────────────────────────────
 * Chaque écran empilé de `app/` est **classé une et une seule fois** : dans une table de pilier (et il
 * déclare ce pilier), ou dans `SANS_PILIER` avec sa raison (et il ne déclare rien). Le prochain écran
 * ajouté fait échouer la suite tant qu'on n'a pas décidé de son identité.
 *
 * ⚠️ **Ce test lit les fichiers, il ne les rend pas** — même parti pris que `route-declarations`.
 * Monter un écran demanderait PowerSync, l'auth, les polices et vingt hooks, pour vérifier la
 * présence d'un appel. Le comportement du hook vit dans `hooks/__tests__/useMenuFocus.test.tsx`.
 */
// `require` plutôt qu'un `import` : le tsconfig mobile ne charge pas les types Node (c'est une
// cible React Native). Même convention que `route-declarations.test.ts`.
type Entree = { name: string; isDirectory: () => boolean };
const { readdirSync, readFileSync, existsSync } = require('fs') as {
  readdirSync: (p: string, o: { withFileTypes: true }) => Entree[];
  readFileSync: (p: string, e: 'utf8') => string;
  existsSync: (p: string) => boolean;
};
const { join, relative, sep } = require('path') as {
  join: (...parts: string[]) => string;
  relative: (from: string, to: string) => string;
  sep: string;
};
declare const __dirname: string;

const APP_DIR = join(__dirname, '..');

/** Les dossiers d'écrans d'un pilier, et le pilier qu'ils doivent déclarer. */
const PILIERS: readonly { chemin: string[]; pilier: string }[] = [
  // Course — CARDIO-UX02.
  { chemin: ['run'], pilier: 'running' },
  { chemin: ['running-history'], pilier: 'running' },
  // US CARDIO-UX03 — « Toutes tes stats » ; `running-history` n'est plus qu'une redirection.
  { chemin: ['running-stats'], pilier: 'running' },
  { chemin: ['running-programs'], pilier: 'running' },
  // Musculation — IDENT-01. `history/index` est une redirection : elle déclare aussi (D11).
  { chemin: ['exercises'], pilier: 'strength' },
  { chemin: ['templates'], pilier: 'strength' },
  { chemin: ['programs'], pilier: 'strength' },
  { chemin: ['history'], pilier: 'strength' },
  { chemin: ['progress'], pilier: 'strength' },
  // Nutrition — IDENT-01.
  { chemin: ['meal-plan'], pilier: 'nutrition' },
];

/** Écrans de premier niveau (hors dossier) qui appartiennent à un pilier. */
const FICHIERS: readonly { fichier: string; pilier: string }[] = [
  { fichier: 'running-profile.tsx', pilier: 'running' },
  // US CARDIO-02 — les quatre portes et l'accueil du pilier.
  { fichier: 'running-pace.tsx', pilier: 'running' },
  { fichier: 'running-welcome.tsx', pilier: 'running' },
  // Musculation — IDENT-01.
  { fichier: 'workout.tsx', pilier: 'strength' },
  { fichier: 'workout-brief.tsx', pilier: 'strength' },
  { fichier: 'workout-summary.tsx', pilier: 'strength' },
  { fichier: 'session-preview.tsx', pilier: 'strength' },
  { fichier: 'exercises.tsx', pilier: 'strength' },
  { fichier: 'strength-lifts.tsx', pilier: 'strength' },
  // D4 — un profil ou un réglage de pilier prend son pilier, même ouvert depuis les Réglages.
  { fichier: 'strength-profile.tsx', pilier: 'strength' },
  { fichier: 'settings-session.tsx', pilier: 'strength' },
  // D2 — la famille Corps (CORPS-01 à 04) choisit muscles, exercices et programmes de force.
  { fichier: 'body.tsx', pilier: 'strength' },
  { fichier: 'body-shape.tsx', pilier: 'strength' },
  { fichier: 'body-training.tsx', pilier: 'strength' },
  { fichier: 'body-training-programs.tsx', pilier: 'strength' },
  // D3 — ligne 3.51 ; rouge même ouverte depuis le Labo.
  { fichier: 'measurements.tsx', pilier: 'strength' },
  // Nutrition — IDENT-01.
  { fichier: 'food-picker.tsx', pilier: 'nutrition' },
  { fichier: 'food-custom.tsx', pilier: 'nutrition' },
  { fichier: 'food-scan.tsx', pilier: 'nutrition' },
  { fichier: 'meal-quick-entry.tsx', pilier: 'nutrition' },
  { fichier: 'nutrition-day.tsx', pilier: 'nutrition' },
  { fichier: 'nutrition-meals.tsx', pilier: 'nutrition' },
  { fichier: 'nutrition-profile.tsx', pilier: 'nutrition' },
  { fichier: 'nutrition-stats.tsx', pilier: 'nutrition' },
  { fichier: 'recipe-edit.tsx', pilier: 'nutrition' },
];

const TRANSVERSE = 'transverse — prend l’identité de l’écran qui l’ouvre (IDENT-01 D6)';
const IDENT_02 = 'Bien-être / Labo — même défaut, hors périmètre d’IDENT-01 : BACKLOG IDENT-02 (D10)';
const SPIKE = 'spike, hors produit — à retirer avant la soumission Play (LANCE-02)';

/** Écrans empilés qui ne déclarent **aucun** pilier, avec la raison. Clé : dossier ou fichier de premier niveau. */
const SANS_PILIER: Readonly<Record<string, string>> = {
  planning: TRANSVERSE,
  'goals.tsx': TRANSVERSE,
  'insights.tsx': TRANSVERSE,
  'review.tsx': TRANSVERSE,
  // D5 — la dépense d'une autre activité touche la cible, la série et la charge.
  'activities.tsx': TRANSVERSE,
  'activity.tsx': TRANSVERSE,
  'steps.tsx': TRANSVERSE,
  'settings.tsx': TRANSVERSE,
  'profile.tsx': TRANSVERSE,
  'help.tsx': TRANSVERSE,
  'account-delete.tsx': TRANSVERSE,
  'deletion-pending.tsx': TRANSVERSE,
  'password-reset.tsx': TRANSVERSE,
  'ai-lab.tsx': TRANSVERSE,
  'wellbeing.tsx': IDENT_02,
  'wellbeing-settings.tsx': IDENT_02,
  'pain.tsx': IDENT_02,
  cycle: IDENT_02,
  'lab-link.tsx': IDENT_02,
  'spike-corps-3d.tsx': SPIKE,
  'spike-vbt.tsx': SPIKE,
};

/** Les onglets : `useMenuFocus` y reconnaît un onglet et le déclare au premier plan (IDENT-01 D7). */
const ONGLETS: readonly { fichier: string; menu: string }[] = [
  { fichier: 'index.tsx', menu: 'home' },
  { fichier: 'strength.tsx', menu: 'strength' },
  { fichier: 'running.tsx', menu: 'running' },
  { fichier: 'nutrition.tsx', menu: 'nutrition' },
  { fichier: 'lab.tsx', menu: 'lab' },
  { fichier: 'wellbeing-hub.tsx', menu: 'wellbeing' },
];

/** Un `_layout.tsx` ne rend pas d'écran : il monte un `Stack`, il n'a pas de couleur à poser. */
const NON_ECRANS = new Set(['_layout.tsx', '__tests__']);

/** Les groupes qui ne sont pas des écrans empilés : avant l'app (auth, onboarding) et les onglets. */
const GROUPES = new Set(['(auth)', '(onboarding)', '(tabs)']);

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

/** Tous les écrans empilés de `app/`, hors groupes. */
function ecransEmpiles(): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(APP_DIR, { withFileTypes: true })) {
    if (NON_ECRANS.has(entry.name) || GROUPES.has(entry.name)) continue;
    const full = join(APP_DIR, entry.name);
    if (entry.isDirectory()) out.push(...ecransDe(full));
    else if (entry.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/** La clé de classement d'un écran : son dossier de premier niveau, ou son nom de fichier. */
function cleDe(fichier: string): string {
  return relative(APP_DIR, fichier).split(sep)[0]!;
}

const court = (fichier: string) => fichier.slice(fichier.indexOf(join('src', 'app')));

/**
 * L'appel de déclaration, **en instruction** — ancré en début de ligne : un commentaire qui le cite ne
 * suffit pas à faire passer un écran, et une mention en commentaire ne fait pas échouer un transverse.
 */
const declare = (source: string, pilier: string) =>
  new RegExp(`^\\s*useMenuFocus\\('${pilier}'\\);`, 'm').test(source);
const declareQuelquechose = (source: string) => /^\s*useMenuFocus\(/m.test(source);

describe('identité de pilier — aucun écran ne dépend de l’onglet d’où l’on vient', () => {
  for (const { chemin, pilier } of PILIERS) {
    const dir = join(APP_DIR, ...chemin);
    for (const fichier of ecransDe(dir)) {
      it(`${court(fichier)} déclare useMenuFocus('${pilier}')`, () => {
        expect(declare(readFileSync(fichier, 'utf8'), pilier)).toBe(true);
      });
    }
  }

  for (const { fichier, pilier } of FICHIERS) {
    it(`${fichier} déclare useMenuFocus('${pilier}')`, () => {
      expect(declare(readFileSync(join(APP_DIR, fichier), 'utf8'), pilier)).toBe(true);
    });
  }

  for (const { fichier, menu } of ONGLETS) {
    it(`l’onglet ${fichier} déclare useMenuFocus('${menu}')`, () => {
      expect(declare(readFileSync(join(APP_DIR, '(tabs)', fichier), 'utf8'), menu)).toBe(true);
    });
  }

  it('un écran sans pilier ne déclare rien — sinon, le ranger dans la table de son pilier', () => {
    const declarants = ecransEmpiles()
      .filter((fichier) => cleDe(fichier) in SANS_PILIER)
      .filter((fichier) => declareQuelquechose(readFileSync(fichier, 'utf8')))
      .map(court);
    expect(declarants).toEqual([]);
  });
});

describe('identité de pilier — le classement est exhaustif', () => {
  const cles = new Map<string, number>();
  for (const { chemin } of PILIERS) cles.set(chemin[0]!, (cles.get(chemin[0]!) ?? 0) + 1);
  for (const { fichier } of FICHIERS) cles.set(fichier, (cles.get(fichier) ?? 0) + 1);
  for (const cle of Object.keys(SANS_PILIER)) cles.set(cle, (cles.get(cle) ?? 0) + 1);

  it('chaque écran empilé est classé une et une seule fois', () => {
    const nonClasses = ecransEmpiles()
      .filter((fichier) => !cles.has(cleDe(fichier)))
      .map(
        (fichier) =>
          `nouvel écran non classé : ${court(fichier)} — déclare son pilier, ou ajoute-le à SANS_PILIER avec la raison`,
      );
    expect(nonClasses).toEqual([]);
    const doublons = [...cles].filter(([, n]) => n > 1).map(([cle]) => `classé deux fois : ${cle}`);
    expect(doublons).toEqual([]);
  });

  it('chaque onglet est dans la table des onglets — un onglet ajouté doit aussi déclarer son menu', () => {
    const tables = new Set(ONGLETS.map((o) => o.fichier));
    const absents = ecransDe(join(APP_DIR, '(tabs)'))
      .map((fichier) => relative(join(APP_DIR, '(tabs)'), fichier))
      .filter((fichier) => !tables.has(fichier));
    expect(absents).toEqual([]);
  });

  it('aucune entrée des tables ne désigne un écran disparu', () => {
    const disparus = [...cles.keys()].filter((cle) => !existsSync(join(APP_DIR, cle)));
    expect(disparus).toEqual([]);
  });

  it('chaque dossier de pilier contient des écrans — la liste n’est pas vide', () => {
    // Garde-fou du garde-fou : si un renommage de dossier vidait `ecransDe`, la boucle de déclaration
    // ne produirait plus aucun test et la suite passerait au vert sans rien vérifier.
    const vides = PILIERS.filter((p) => ecransDe(join(APP_DIR, ...p.chemin)).length === 0).map((p) =>
      p.chemin.join('/'),
    );
    expect(vides).toEqual([]);
    expect(ecransEmpiles().length).toBeGreaterThanOrEqual(66);
  });
});

describe('identité de pilier — l’hypothèse de la pile de `useMenuFocus`', () => {
  /** Tous les fichiers source de `src/`, hors tests. */
  function sources(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...sources(full));
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  it('aucun écran n’est gelé ni préchargé : un effet n’est nettoyé qu’au démontage', () => {
    // `useMenuFocus` empile les écrans empilés et rend leur identité à leur démontage. Le gel des écrans
    // masqués (Suspense), `<Activity>` ou un écran préchargé nettoieraient ou monteraient un effet sans
    // que l'écran parte ou s'affiche — la pile mentirait. Si l'un devient nécessaire, revoir le hook.
    const interdits = [/\bfreezeOnBlur\b/, /\benableFreeze\b/, /\bprefetch\b/, /<(unstable_)?Activity[\s>]/];
    // Le hook lui-même nomme ces mécanismes dans son en-tête, pour dire pourquoi ils sont exclus.
    const hook = join(APP_DIR, '..', 'hooks', 'useMenuFocus.ts');
    const fautifs = sources(join(APP_DIR, '..'))
      .filter((fichier) => fichier !== hook)
      .filter((fichier) => interdits.some((motif) => motif.test(readFileSync(fichier, 'utf8'))))
      .map((fichier) => relative(join(APP_DIR, '..'), fichier));
    expect(fautifs).toEqual([]);
  });
});
