/**
 * US CONF-07 — garde-fou de contraste WCAG AA sur la palette réelle.
 *
 * La première passe (30/07/2026) n'avait mesuré que 3 paires et affirmait le clair conforme — faux
 * sur 3 points, jamais détecté faute de mesure automatisée. Ce test parcourt la **table complète**
 * des paires réellement utilisées (spec §0) et échoue si l'une repasse sous son seuil : c'est le
 * vrai livrable durable de cette US.
 *
 * Vit côté mobile (pas `packages/shared`) parce que la palette elle-même
 * (`apps/mobile/src/theme/colors.ts`) vit ici — voir le plan §Étape 1 pour l'arbitrage.
 */
import { chroma, contrastRatio, readableOn } from '@wellness/shared';
import { palettes, type Palette } from '../colors';
import { DEFAULT_MENU_COLORS, MENU_COLOR_SWATCHES } from '@/stores/menu-accent-store';
import { PILLAR_KEYS, pillarPalette } from '../pillar';

/**
 * `[thème, premier plan, fond, seuil, usage]`. Le seuil dépend de l'usage réel du token, pas de son
 * nom (R2 de la spec) : 4,5 pour du texte (WCAG 1.4.3), 3,0 pour de la donnée / une limite de
 * composant (WCAG 1.4.11).
 */
const PAIRS: {
  theme: 'light' | 'dark';
  fg: keyof typeof palettes.light;
  bg: keyof typeof palettes.light;
  threshold: number;
  usage: string;
}[] = [
  // Thème clair — 3 non-conformités trouvées le 30/07/2026 (spec §0.1).
  { theme: 'light', fg: 'success', bg: 'background', threshold: 4.5, usage: 'texte de succès (sign-in, steps, WeightGoalCard, CurrentSetCard)' },
  { theme: 'light', fg: 'warnText', bg: 'warn', threshold: 4.5, usage: 'texte d’alerte (StreakCard, GoalCard, cartes d’insight)' },
  { theme: 'light', fg: 'amber', bg: 'background', threshold: 3.0, usage: 'donnée (barre glucides NutritionSummaryCard, MicroCoverageGrid, MacroTriple)' },
  // Thème sombre — 2 non-conformités déjà connues (spec §0.2).
  { theme: 'dark', fg: 'accentText', bg: 'accent', threshold: 4.5, usage: 'libellé des boutons pleins (D1, acceptée le 01/08/2026)' },
  // US DASH-01 (R10) — couleurs de pilier : textes et icônes sur les cartes et le fond, dans les deux thèmes.
  // Le bordeaux #6b0028 tombait à 1,15:1 sur une carte sombre ; les teintes de maquette du bleu et du vert
  // (#2f6fc0, #5c7a3f) échouaient de peu sur le fond clair (4,39 et 4,23).
  { theme: 'light', fg: 'pillarHome', bg: 'surface', threshold: 4.5, usage: 'couleur de pilier (onglet actif, barres, libellés) — DASH-01' },
  { theme: 'light', fg: 'pillarHome', bg: 'background', threshold: 4.5, usage: 'couleur de pilier (onglet actif, barres, libellés) — DASH-01' },
  { theme: 'light', fg: 'pillarStrength', bg: 'surface', threshold: 4.5, usage: 'couleur de pilier (onglet actif, barres, libellés) — DASH-01' },
  { theme: 'light', fg: 'pillarStrength', bg: 'background', threshold: 4.5, usage: 'couleur de pilier (onglet actif, barres, libellés) — DASH-01' },
  { theme: 'light', fg: 'pillarRunning', bg: 'surface', threshold: 4.5, usage: 'couleur de pilier (onglet actif, barres, libellés) — DASH-01' },
  { theme: 'light', fg: 'pillarRunning', bg: 'background', threshold: 4.5, usage: 'couleur de pilier (onglet actif, barres, libellés) — DASH-01' },
  { theme: 'light', fg: 'pillarNutrition', bg: 'surface', threshold: 4.5, usage: 'couleur de pilier (onglet actif, barres, libellés) — DASH-01' },
  { theme: 'light', fg: 'pillarNutrition', bg: 'background', threshold: 4.5, usage: 'couleur de pilier (onglet actif, barres, libellés) — DASH-01' },
  { theme: 'dark', fg: 'pillarHome', bg: 'surface', threshold: 4.5, usage: 'couleur de pilier (onglet actif, barres, libellés) — DASH-01' },
  { theme: 'dark', fg: 'pillarHome', bg: 'background', threshold: 4.5, usage: 'couleur de pilier (onglet actif, barres, libellés) — DASH-01' },
  { theme: 'dark', fg: 'pillarStrength', bg: 'surface', threshold: 4.5, usage: 'couleur de pilier (onglet actif, barres, libellés) — DASH-01' },
  { theme: 'dark', fg: 'pillarStrength', bg: 'background', threshold: 4.5, usage: 'couleur de pilier (onglet actif, barres, libellés) — DASH-01' },
  { theme: 'dark', fg: 'pillarRunning', bg: 'surface', threshold: 4.5, usage: 'couleur de pilier (onglet actif, barres, libellés) — DASH-01' },
  { theme: 'dark', fg: 'pillarRunning', bg: 'background', threshold: 4.5, usage: 'couleur de pilier (onglet actif, barres, libellés) — DASH-01' },
  { theme: 'dark', fg: 'pillarNutrition', bg: 'surface', threshold: 4.5, usage: 'couleur de pilier (onglet actif, barres, libellés) — DASH-01' },
  // US LABO-01 — la couleur du Labo, même contrat que les trois piliers.
  { theme: 'light', fg: 'pillarLab', bg: 'surface', threshold: 4.5, usage: 'couleur du Labo (onglet actif, libellés) — LABO-01' },
  { theme: 'light', fg: 'pillarLab', bg: 'background', threshold: 4.5, usage: 'couleur du Labo (onglet actif, libellés) — LABO-01' },
  { theme: 'dark', fg: 'pillarLab', bg: 'surface', threshold: 4.5, usage: 'couleur du Labo (onglet actif, libellés) — LABO-01' },
  { theme: 'dark', fg: 'pillarLab', bg: 'background', threshold: 4.5, usage: 'couleur du Labo (onglet actif, libellés) — LABO-01' },
  { theme: 'dark', fg: 'pillarNutrition', bg: 'background', threshold: 4.5, usage: 'couleur de pilier (onglet actif, barres, libellés) — DASH-01' },
  // `accent`/`surface` sombre (D2, 4,45) est un écart ASSUMÉ (spec §4) — volontairement absent de
  // cette table : le consigner ici comme une assertion qui doit rester rouge serait exactement le
  // bruit qu'on veut éviter. Voir le commentaire dans colors.ts.
];

describe('Palette — contraste WCAG AA', () => {
  it.each(PAIRS)(
    '$theme : $fg / $bg ≥ $threshold ($usage)',
    ({ theme, fg, bg, threshold }) => {
      const ratio = contrastRatio(palettes[theme][fg], palettes[theme][bg]);
      expect(ratio).not.toBeNull();
      expect(ratio!).toBeGreaterThanOrEqual(threshold);
    },
  );

  it('non-régression : chartGreen (clair) reste inchangée — R3, ne diverge pas de success par hasard', () => {
    expect(palettes.light.chartGreen).toBe('#7c8a5b');
    // Seuil « donnée » (3,0), pas « texte » (4,5) : chartGreen ne peint que des courbes.
    expect(contrastRatio(palettes.light.chartGreen, palettes.light.background)).toBeGreaterThanOrEqual(3.0);
  });
});

// ---------------------------------------------------------------------------
// US MUSCU-UX04 — les palettes par pilier
// ---------------------------------------------------------------------------

/**
 * Les surfaces sont teintées **à luminance constante**, donc aucun rapport de contraste ne devrait
 * bouger. Ce bloc le **mesure** au lieu de le supposer : c'est la seule chose qui empêche qu'un
 * réglage de teinte fasse passer une paire sous le seuil sans que personne ne le voie.
 *
 * La règle est une **non-régression**, pas un seuil absolu : une paire que la palette neutre ne
 * tient déjà pas (l'écart assumé `accentText`/`accent` de CONF-07 D2, par exemple) n'a pas à être
 * réparée ici. On exige seulement que la teinte ne dégrade rien.
 */
const PILLAR_PAIRS: { fg: keyof Palette; bg: keyof Palette; threshold: number; usage: string }[] = [
  { fg: 'text', bg: 'surface', threshold: 4.5, usage: 'texte de carte' },
  { fg: 'text', bg: 'background', threshold: 4.5, usage: 'texte de page' },
  { fg: 'textMuted', bg: 'surface', threshold: 4.5, usage: 'texte secondaire de carte' },
  { fg: 'textMuted', bg: 'background', threshold: 4.5, usage: 'texte secondaire de page' },
  { fg: 'accent', bg: 'surface', threshold: 4.5, usage: 'accent du pilier sur une carte' },
  { fg: 'accent', bg: 'background', threshold: 4.5, usage: 'accent du pilier sur la page' },
  { fg: 'accentText', bg: 'accent', threshold: 4.5, usage: 'libellé des boutons pleins' },
  { fg: 'borderStrong', bg: 'surface', threshold: 3.0, usage: 'limite de champ sur une carte' },
  { fg: 'borderStrong', bg: 'background', threshold: 3.0, usage: 'limite de champ sur la page' },
  { fg: 'success', bg: 'surface', threshold: 4.5, usage: 'texte de succès' },
  { fg: 'success', bg: 'background', threshold: 4.5, usage: 'texte de succès sur la page' },
  { fg: 'amber', bg: 'background', threshold: 3.0, usage: 'donnée ambre' },
  { fg: 'chartGreen', bg: 'background', threshold: 3.0, usage: 'donnée verte' },
  { fg: 'panelText', bg: 'panel', threshold: 4.5, usage: 'texte du panneau inversé' },
  { fg: 'panelMuted', bg: 'panel', threshold: 4.5, usage: 'texte secondaire du panneau' },
  { fg: 'warnText', bg: 'warn', threshold: 4.5, usage: 'alerte — jamais teintée, doit le rester' },
  { fg: 'pillarHome', bg: 'surface', threshold: 4.5, usage: 'couleur de pilier sur une carte' },
  { fg: 'pillarStrength', bg: 'surface', threshold: 4.5, usage: 'couleur de pilier sur une carte' },
  { fg: 'pillarRunning', bg: 'surface', threshold: 4.5, usage: 'couleur de pilier sur une carte' },
  { fg: 'pillarNutrition', bg: 'surface', threshold: 4.5, usage: 'couleur de pilier sur une carte' },
  { fg: 'pillarLab', bg: 'surface', threshold: 4.5, usage: 'couleur de pilier sur une carte' },
];

const CASES = (['light', 'dark'] as const).flatMap((theme) =>
  PILLAR_KEYS.flatMap((pillar) =>
    PILLAR_PAIRS.map((pair) => ({ theme, pillar, ...pair })),
  ),
);

describe('Palettes par pilier — aucune régression de contraste', () => {
  it.each(CASES)(
    '$theme/$pillar : $fg / $bg ($usage)',
    ({ theme, pillar, fg, bg, threshold }) => {
      const neutre = contrastRatio(palettes[theme][fg], palettes[theme][bg]);
      const teintee = pillarPalette(theme, pillar);
      const obtenu = contrastRatio(teintee[fg], teintee[bg]);

      expect(obtenu).not.toBeNull();
      // Seuil absolu — mais seulement là où la palette neutre le tenait déjà.
      if (neutre !== null && neutre >= threshold) {
        expect(obtenu!).toBeGreaterThanOrEqual(threshold);
      }
    },
  );

  /**
   * ⚠️ US MUSCU-UX06 (23/09/2026) — **une exception nommée**, pas un seuil relâché.
   *
   * Le rouge fonte `#8e1b1b` est une teinte sombre : en clair, `tintPreservingLuminance` finit le
   * chemin vers le blanc (sa phase 2) et retombe **exactement** sur la carte neutre `#fffaf2`, quel
   * que soit le gain (mesuré de 1 à 2). La carte claire de la musculation reste donc neutre ; la
   * teinte y passe par le **fond** (`#ffecdc`) et le **filet** (`#f9ccb4`), que ce test continue
   * d'exiger. C'est le rendu validé par Florian sur la planche comparative.
   */
  const CARTE_CLAIRE_NEUTRE: readonly (typeof PILLAR_KEYS)[number][] = ['strength'];

  it('🔴 les surfaces changent VRAIMENT de teinte — sinon le test ci-dessus passe pour rien', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const pillar of PILLAR_KEYS) {
        const teintee = pillarPalette(theme, pillar);
        if (theme === 'light' && CARTE_CLAIRE_NEUTRE.includes(pillar)) {
          expect(teintee.border).not.toBe(palettes[theme].border);
        } else {
          expect(teintee.surface).not.toBe(palettes[theme].surface);
        }
        expect(teintee.background).not.toBe(palettes[theme].background);
      }
      // Et deux piliers ne se ressemblent pas.
      expect(pillarPalette(theme, 'strength').surface).not.toBe(pillarPalette(theme, 'running').surface);
    }
  });

  it('🔴 le bandeau d’alerte n’est JAMAIS teinté — il doit rester reconnaissable partout', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const pillar of PILLAR_KEYS) {
        expect(pillarPalette(theme, pillar).warn).toBe(palettes[theme].warn);
        expect(pillarPalette(theme, pillar).warnBorder).toBe(palettes[theme].warnBorder);
        expect(pillarPalette(theme, pillar).warnText).toBe(palettes[theme].warnText);
      }
    }
  });

  it('chaque pilier porte bien son propre accent', () => {
    expect(pillarPalette('dark', 'strength').accent).toBe(palettes.dark.pillarStrength);
    expect(pillarPalette('dark', 'running').accent).toBe(palettes.dark.pillarRunning);
    expect(pillarPalette('light', 'nutrition').accent).toBe(palettes.light.pillarNutrition);
  });
});

/**
 * 🔴 US NUTRI-UX02 — le garde-fou qui manquait, et qui a coûté deux recettes.
 *
 * Le test de contraste ci-dessus ne pouvait **pas** attraper le défaut : `tintPreservingLuminance`
 * conserve la luminance, donc les ratios passent quoi qu'il arrive — y compris quand la teinte a
 * complètement disparu. Deux fois, un pilier a ainsi produit une surface **moins colorée que la
 * surface neutre qu'elle remplace**, sans qu'aucun test ne bronche : la course en septembre
 * (chroma 16 contre 18), la nutrition aujourd'hui (17 contre 18). Les deux fois, la seule alerte a
 * été l'œil de Florian sur une recette device.
 *
 * Ce test mesure ce que le contraste ne voit pas. Il n'a **aucun seuil arbitraire** : il compare
 * chaque pilier à la palette neutre, donc il reste juste si la palette de base change.
 */
describe('Palettes par pilier — teinter doit AJOUTER de la couleur, jamais en enlever', () => {
  const THEMES = ['light', 'dark'] as const;

  /**
   * L'écart minimal, en thème **sombre**. Relevé sur les cinq piliers une fois la nutrition
   * corrigée : accueil +18, labo +14, musculation +11, course +11, nutrition +11 — contre **−1 et
   * −2** pour les deux défauts constatés. Le seuil est posé à 8, sous le plus faible écart sain et
   * très au-dessus des valeurs fautives : il attrape la panne sans se déclencher au moindre
   * ajustement de teinte.
   */
  const ECART_MIN_SOMBRE = 8;

  it.each(PILLAR_KEYS.map((pillar) => ({ pillar })))(
    'dark/$pillar : la teinte se VOIT — au moins 8 points de chroma au-dessus du neutre',
    ({ pillar }) => {
      const neutre = chroma(palettes.dark.surface)!;
      const teintee = chroma(pillarPalette('dark', pillar).surface)!;
      expect(teintee - neutre).toBeGreaterThanOrEqual(ECART_MIN_SOMBRE);
    },
  );

  /**
   * ⚠️ Le thème **clair** n'a pas le même contrat, et c'est voulu.
   *
   * En clair, la surface de départ est presque blanche : `tintPreservingLuminance` ne peut pas
   * atteindre sa luminance en gardant la saturation, et finit donc le chemin **vers le blanc** —
   * sa phase 2, documentée comme « la teinte se désature en pastel au lieu de s'assombrir, ce qui
   * est précisément ce qu'on veut d'un thème clair ». Exiger ici « plus coloré que le neutre »
   * reviendrait à exiger l'inverse de ce que la fonction promet, d'autant que la surface neutre
   * claire (`#fffaf2`) porte déjà une chroma de 13 par son propre réchauffement.
   *
   * 🔴 **Ce que ce test a trouvé en clair, le 20/09/2026** : la musculation sortait à **9**, soit
   * SOUS le neutre — le bordeaux `#7c2734`, sombre, était massivement blanchi vers un rose pâle. Le
   * test portait alors une exception datée (plancher à 9), et le constat était au BACKLOG (TEINTE-01).
   *
   * ✅ **Levée le 23/09/2026 par MUSCU-UX06** : le rouge fonte retombe exactement sur la carte neutre
   * (chroma 13 = neutre). Plus aucune exception ici — un pilier qui retirerait de la couleur à la
   * carte claire fera de nouveau échouer le test.
   */
  it.each(PILLAR_KEYS.map((pillar) => ({ pillar })))(
    'light/$pillar : la surface teintée reste au moins aussi colorée que le neutre',
    ({ pillar }) => {
      const neutre = chroma(palettes.light.surface)!;
      const teintee = chroma(pillarPalette('light', pillar).surface)!;
      expect(teintee).toBeGreaterThanOrEqual(neutre);
    },
  );

  /**
   * Aucun pilier n'est le parent pauvre des autres. Formulé en **relatif** — la moitié du plus
   * coloré des cinq — pour qu'il reste juste si toute la palette bouge. C'est exactement le défaut
   * que Florian a vu : la nutrition sortait à 60 en sombre quand les autres étaient entre 102 et
   * 147, et à 54 en clair contre 85 à 134.
   */
  it.each(THEMES.map((theme) => ({ theme })))(
    '$theme : aucun accent de pilier ne descend sous la moitié du plus coloré',
    ({ theme }) => {
      const chromas = PILLAR_KEYS.map((p) => chroma(pillarPalette(theme, p).accent)!);
      const plafond = Math.max(...chromas);
      for (const [i, valeur] of chromas.entries()) {
        expect(`${PILLAR_KEYS[i]}: ${valeur}`).toBe(
          valeur >= plafond / 2 ? `${PILLAR_KEYS[i]}: ${valeur}` : `${PILLAR_KEYS[i]}: ≥ ${Math.ceil(plafond / 2)}`,
        );
      }
    },
  );
});

/**
 * La préférence « Couleurs des menus » pose l'une de ces valeurs comme **accent**, sur les deux
 * thèmes. Jusqu'au 19/09/2026 elle portait les teintes profondes des scènes : activer
 * l'interrupteur mettait `#6b0028` (1,15:1 sur une carte sombre) en couleur d'icône et de libellé.
 * Un réglage ne doit pas pouvoir rendre l'app illisible.
 */
describe('Couleurs des menus (préférence) — lisibles dans les deux thèmes', () => {
  const VALEURS = [...new Set([...Object.values(DEFAULT_MENU_COLORS), ...MENU_COLOR_SWATCHES])];

  it.each(
    (['light', 'dark'] as const).flatMap((theme) =>
      VALEURS.flatMap((couleur) => PILLAR_KEYS.map((pillar) => ({ theme, couleur, pillar }))),
    ),
  )('$theme/$pillar : $couleur est rendue lisible sur les cartes', ({ theme, couleur, pillar }) => {
    // Le contrat n'est pas que la couleur STOCKÉE soit lisible partout — c'est impossible pour une
    // valeur unique servie aux deux thèmes. C'est que `readableOn` la ramène au seuil avant de la
    // poser comme accent, ce que fait `useTheme`.
    const surface = pillarPalette(theme, pillar).surface;
    expect(contrastRatio(readableOn(couleur, surface)!, surface)!).toBeGreaterThanOrEqual(4.5);
  });
});

/**
 * 🔴 US MUSCU-UX06 — « on ne voit pas assez les cartes » (Florian, 23/09/2026).
 *
 * Mesuré : carte / fond = **1,23:1 dans tous les piliers**. Le défaut n'était pas une teinte mal
 * choisie mais la palette de base, puisque `tintPreservingLuminance` recopie son écart de luminance
 * dans chaque pilier. Aucun test ne le voyait : les contrastes de texte, eux, passaient tous.
 *
 * Ce bloc fixe les deux leviers retenus — fond sombre abaissé, filet relevé — pour la palette
 * neutre **et** pour chaque pilier. Seuils posés juste sous les valeurs livrées (sombre : carte
 * 1,35 · filet 1,88 ; clair : carte 1,11 · filet 1,28) : ils attrapent un retour en arrière sans se
 * déclencher au moindre ajustement.
 */
describe('Séparation des cartes — la carte et son filet se détachent du fond', () => {
  const SEUILS = {
    dark: { carte: 1.33, filet: 1.8 },
    // En clair, la carte presque blanche ne peut guère s'écarter du fond : c'est le filet qui sépare.
    light: { carte: 1.1, filet: 1.25 },
  } as const;

  const CAS = (['light', 'dark'] as const).flatMap((theme) => [
    { theme, pillar: 'neutre' as const, palette: palettes[theme] },
    ...PILLAR_KEYS.map((pillar) => ({ theme, pillar, palette: pillarPalette(theme, pillar) })),
  ]);

  it.each(CAS)('$theme/$pillar : carte / fond et filet / fond', ({ theme, palette }) => {
    expect(contrastRatio(palette.surface, palette.background)!).toBeGreaterThanOrEqual(SEUILS[theme].carte);
    expect(contrastRatio(palette.border, palette.background)!).toBeGreaterThanOrEqual(SEUILS[theme].filet);
  });

  it('le filet se voit aussi SUR la carte — sinon il ne dessine pas le bord', () => {
    for (const theme of ['light', 'dark'] as const) {
      expect(contrastRatio(palettes[theme].border, palettes[theme].surface)!).toBeGreaterThanOrEqual(1.35);
    }
  });
});

/**
 * 🔴 US MUSCU-UX06 — la couleur muscu vit en **copie** à trois endroits hors de la palette : la
 * préférence « Couleurs des menus » et les disques du Labo (2D et 3D, ce dernier en JS pur pour la
 * WebView). Au passage du rose au rouge fonte, rien ne les aurait signalés : ils auraient gardé le
 * rose sur le Labo pendant que tout le pilier passait au rouge.
 */
// `require` plutôt qu'un `import` : le tsconfig mobile ne charge pas les types Node (cible React
// Native). Même convention que `app/__tests__/pillar-identity.test.ts`.
const { readFileSync } = require('fs') as { readFileSync: (p: string, e: 'utf8') => string };
const { join } = require('path') as { join: (...parts: string[]) => string };
declare const __dirname: string;

describe('Identité muscu — les copies en dur suivent le token', () => {
  it('les couleurs par défaut des menus sont les accents sombres des piliers', () => {
    expect(DEFAULT_MENU_COLORS).toEqual({
      home: palettes.dark.pillarHome,
      strength: palettes.dark.pillarStrength,
      running: palettes.dark.pillarRunning,
      nutrition: palettes.dark.pillarNutrition,
      lab: palettes.dark.pillarLab,
    });
  });

  it.each(['components/lab/scene/LabScene2D.tsx', 'components/lab/scene/engine.js'])(
    '%s : le disque muscu porte pillarStrength (sombre)',
    (fichier) => {
      const source = readFileSync(join(__dirname, '..', '..', fichier), 'utf8');
      expect(source).toContain(`muscu: '${palettes.dark.pillarStrength}'`);
    },
  );
});
