/**
 * Primitives visuelles des widgets (`components/widgets/primitives`) — à 43 % avant ce fichier.
 *
 * Cinq mini-graphes purement présentationnels, mais dont **toute la géométrie est calculée à la
 * main** : arcs en `strokeDasharray`, normalisation d'une série sur une hauteur, pourcentages de
 * largeur. Aucune de ces formules ne lève quand elle est fausse — elle dessine simplement quelque
 * chose de faux, et un graphe faux se croit sur parole.
 *
 * Trois familles de pièges couvertes :
 *
 *  1. **Les divisions par zéro.** Une série plate (`max === min`), un maximum nul, un total à
 *     zéro : chacune produirait `NaN` ou `Infinity` dans un attribut SVG, donc un rendu vide sans
 *     le moindre message.
 *  2. **Les valeurs hors bornes.** Un pourcentage à 150 % ou négatif doit être **borné**, pas
 *     dessiné : un anneau qui se remplit deux fois ne veut plus rien dire.
 *  3. **Une barre de valeur nulle reste VISIBLE** (hauteur plancher) : sinon un jour sans activité
 *     disparaît de la semaine, et l'utilisateur compte six jours au lieu de sept.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

import { HBars, MiniBars, RingGauge, Sparkline, WeekDots } from '../primitives';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      background: '#f7eede',
      surfaceAlt: '#f3ddd0',
      track: '#e8dccb',
      accent: '#c0562f',
      success: '#7c8a5b',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

/**
 * Rend un élément et rend sa sérialisation — pour chercher un attribut SVG ou un style calculé.
 *
 * ⚠️ **Aucun `unmount()` nulle part dans ce fichier.** Démonter au milieu d'un test laisse `screen`
 * pointer sur un arbre mort et fait tomber les tests **suivants** (§3.7). Pour comparer deux
 * rendus, on sérialise chacun **avant** de passer au suivant, et on ne démonte rien — RNTL nettoie
 * entre les cas.
 */
const serialiser = async (element: React.ReactElement): Promise<string> =>
  JSON.stringify((await render(element)).toJSON());

/** Sérialisation d'une vue déjà rendue. */
const rendu = (vue: Awaited<ReturnType<typeof render>>) => JSON.stringify(vue.toJSON());

/** Aucun `NaN` ni `Infinity` n'a fuité dans un attribut. */
const sansNombreInvalide = (texte: string) => {
  expect(texte).not.toMatch(/NaN/);
  expect(texte).not.toMatch(/Infinity/);
};

// ---------------------------------------------------------------------------
// RingGauge
// ---------------------------------------------------------------------------

describe('RingGauge', () => {
  it('trace un anneau vide à 0 %', async () => {
    const vue = await render(<RingGauge size={100} stroke={10} pct={0} />);

    sansNombreInvalide(rendu(vue));
  });

  it('🔴 borne une progression SUPÉRIEURE à 100 %', async () => {
    const complet = await serialiser(<RingGauge size={100} stroke={10} pct={1} />);
    const depasse = await serialiser(<RingGauge size={100} stroke={10} pct={2.5} />);

    // Un anneau qui se remplit deux fois ne veut plus rien dire : au-delà de la cible, il est
    // plein, point. Le dépassement se dit en chiffres, pas en géométrie.
    expect(depasse).toBe(complet);
  });

  it('🔴 borne une progression NÉGATIVE à zéro', async () => {
    const vide = await serialiser(<RingGauge size={100} stroke={10} pct={0} />);
    const negatif = await serialiser(<RingGauge size={100} stroke={10} pct={-0.5} />);

    expect(negatif).toBe(vide);
  });

  it('🔴 une progression NaN retombe à zéro, elle ne casse pas le SVG', async () => {
    const vue = await render(<RingGauge size={100} stroke={10} pct={Number.NaN} />);

    // Une division par zéro en amont (0 séance sur 0 planifiée) produit `NaN` : sans la garde, le
    // `strokeDashoffset` devient `NaN` et l'anneau **disparaît entièrement**.
    sansNombreInvalide(rendu(vue));
  });

  it('les repères sont dessinés là où on les demande', async () => {
    const sans = await serialiser(<RingGauge size={100} stroke={10} pct={0.5} />);
    const avec = await serialiser(
      <RingGauge size={100} stroke={10} pct={0.5} milestones={[0.25, 0.5, 0.75]} />,
    );

    // Trois encoches en plus : ce sont des **repères, pas des récompenses** (arbitrage C).
    expect(avec).not.toBe(sans);
    sansNombreInvalide(avec);
  });

  it('affiche le contenu centré quand il existe', async () => {
    const { Text } = require('react-native');
    const vue = await render(
      <RingGauge size={100} stroke={10} pct={0.5}>
        <Text>1 200</Text>
      </RingGauge>,
    );

    expect(vue.getByText('1 200')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Sparkline
// ---------------------------------------------------------------------------

describe('Sparkline', () => {
  it.each([
    ['aucune valeur', [] as number[]],
    ['une seule valeur', [42]],
  ])('🔴 ne trace RIEN avec %s', async (_cas, values) => {
    // Une « courbe » à un point est un point : elle suggère une tendance qui n'existe pas.
    expect(await serialiser(<Sparkline values={values} height={40} />)).not.toMatch(/RNSVGPath/);
  });

  it('trace la courbe dès deux points', async () => {
    const vue = await render(<Sparkline values={[10, 20]} height={40} />);

    expect(rendu(vue)).toMatch(/RNSVGPath/);
    sansNombreInvalide(rendu(vue));
  });

  it('🔴 une série PLATE ne divise pas par zéro', async () => {
    const vue = await render(<Sparkline values={[50, 50, 50, 50]} height={40} />);

    // `max - min === 0` : sans le repli à 1, chaque ordonnée devient `NaN` et la courbe disparaît
    // — précisément sur le cas le plus banal, une semaine sans variation.
    sansNombreInvalide(rendu(vue));
    expect(rendu(vue)).toMatch(/RNSVGPath/);
  });

  it('une série à zéro partout reste traçable', async () => {
    const vue = await render(<Sparkline values={[0, 0, 0]} height={40} />);

    sansNombreInvalide(rendu(vue));
  });

  it('🔴 chaque zone dégradée porte un identifiant UNIQUE', async () => {
    const vue = await render(
      <>
        <Sparkline values={[1, 5, 3]} height={40} area />
        <Sparkline values={[2, 8, 4]} height={40} area />
      </>,
    );

    // Deux dégradés SVG au même `id` dans un même document : le second écrase le premier, et les
    // deux courbes prennent la même teinte de remplissage. Sur un accueil qui empile des widgets,
    // c'est le cas normal.
    const ids = [...rendu(vue).matchAll(/spark-(\d+)/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBeGreaterThan(1);
  });

  it('le point de fin n’est ajouté que sur demande', async () => {
    const sans = await serialiser(<Sparkline values={[1, 5]} height={40} />);
    const avec = await serialiser(<Sparkline values={[1, 5]} height={40} showDot />);

    expect(avec).not.toBe(sans);
  });
});

// ---------------------------------------------------------------------------
// MiniBars
// ---------------------------------------------------------------------------

describe('MiniBars', () => {
  it('🔴 une barre de valeur NULLE reste visible', async () => {
    const vue = await render(<MiniBars values={[0, 10, 20]} height={60} />);

    // Sans hauteur plancher, un jour sans activité disparaît de la semaine : l'utilisateur compte
    // six colonnes au lieu de sept et croit à un bug d'affichage.
    expect(rendu(vue)).toMatch(/"height":"4%"/);
  });

  it('🔴 une série entièrement à zéro ne divise pas par zéro', async () => {
    const vue = await render(<MiniBars values={[0, 0, 0]} height={60} />);

    // `Math.max(1, ...)` : sans lui, `v / max` vaut `0 / 0`, donc `NaN%` — et les barres
    // disparaissent au lieu d'être au plancher.
    sansNombreInvalide(rendu(vue));
  });

  it('🔴 « max » met en avant la plus haute, pas la première', async () => {
    const vue = await render(<MiniBars values={[3, 9, 5]} height={60} highlightIndex="max" />);

    // La couleur d'accent doit désigner un fait, pas une position.
    const barres = [...rendu(vue).matchAll(/"backgroundColor":"(#[0-9a-f]{6})"/g)].map((m) => m[1]);
    expect(barres[1]).toBe('#c0562f');
    expect(barres[0]).not.toBe('#c0562f');
  });

  it('« all » met toutes les barres en avant', async () => {
    expect(await serialiser(<MiniBars values={[3, 9]} height={60} highlightIndex="all" />)).not.toMatch(
      /#e8dccb/,
    );
  });

  it('l’absence de consigne n’en met aucune en avant', async () => {
    expect(await serialiser(<MiniBars values={[3, 9]} height={60} />)).not.toMatch(/#c0562f/);
  });

  it('un tableau d’index met en avant exactement ceux-là', async () => {
    const vue = await render(<MiniBars values={[1, 2, 3]} height={60} highlightIndex={[0, 2]} />);

    const barres = [...rendu(vue).matchAll(/"backgroundColor":"(#[0-9a-f]{6})"/g)].map((m) => m[1]);
    expect(barres).toEqual(['#c0562f', '#e8dccb', '#c0562f']);
  });

  it('affiche les étiquettes fournies', async () => {
    const vue = await render(<MiniBars values={[1, 2]} height={60} labels={['L', 'M']} />);

    expect(vue.getByText('L')).toBeTruthy();
  });

  it('🔴 une étiquette manquante ne rend pas « undefined »', async () => {
    const vue = await render(<MiniBars values={[1, 2, 3]} height={60} labels={['L']} />);

    expect(rendu(vue)).not.toMatch(/undefined/);
  });
});

// ---------------------------------------------------------------------------
// HBars
// ---------------------------------------------------------------------------

describe('HBars', () => {
  it('🔴 borne les pourcentages hors plage', async () => {
    const vue = await render(
      <HBars
        rows={[
          { label: 'Jambes', pct: 150, value: '3 t' },
          { label: 'Dos', pct: -20, value: '0 t' },
        ]}
      />,
    );

    // Une barre à 150 % déborderait de son conteneur ; une barre négative inverserait le rendu.
    const largeurs = [...rendu(vue).matchAll(/"width":"(-?\d+)%"/g)].map((m) => m[1]);
    expect(largeurs).toEqual(['100', '0']);
  });

  it('affiche libellé et valeur de chaque ligne', async () => {
    const vue = await render(<HBars rows={[{ label: 'Jambes', pct: 60, value: '3,2 t' }]} />);

    expect(vue.getByText('Jambes')).toBeTruthy();
    expect(vue.getByText('3,2 t')).toBeTruthy();
  });

  it('aucune ligne rendue sur une liste vide', async () => {
    const vue = await render(<HBars rows={[]} />);

    expect(rendu(vue)).not.toMatch(/width/);
  });
});

// ---------------------------------------------------------------------------
// WeekDots
// ---------------------------------------------------------------------------

describe('WeekDots', () => {
  const jours = (etats: string[]) =>
    etats.map((state, i) => ({ label: 'LMMJVSD'[i]!, state })) as Parameters<
      typeof WeekDots
    >[0]['days'];

  it('rend une colonne par jour', async () => {
    const vue = await render(<WeekDots days={jours(['done', 'rest', 'today', 'future', 'empty'])} />);

    expect(vue.getByText('L')).toBeTruthy();
    expect(vue.getByText('V')).toBeTruthy();
  });

  it('🔴 un jour de repos porte une LETTRE, pas seulement une couleur', async () => {
    const vue = await render(<WeekDots days={jours(['rest'])} />);

    // Sans le « R », un jour de repos et un jour vide ne se distinguent que par une nuance de
    // vert — invisible pour une partie des utilisateurs.
    expect(vue.getByText('R')).toBeTruthy();
  });

  it('🔴 aujourd’hui est marqué par une BORDURE, pas seulement par un fond', async () => {
    const vue = await render(<WeekDots days={jours(['today'])} />);

    // Le fond d'« aujourd'hui » est un accent très pâle : sans bordure, il se confond avec un jour
    // vide sur un écran en plein soleil.
    expect(rendu(vue)).toMatch(/"borderWidth":2/);
  });

  it('un glyphe fourni prime sur la lettre de repos', async () => {
    const vue = await render(
      <WeekDots days={[{ label: 'L', state: 'rest', glyph: '🏃' }]} />,
    );

    expect(vue.getByText('🏃')).toBeTruthy();
    expect(vue.queryByText('R')).toBeNull();
  });

  it('🔴 la taille des pastilles fait varier celle du glyphe', async () => {
    const vue = await render(
      <WeekDots days={[{ label: 'L', state: 'done', glyph: '🏃' }]} tile={60} />,
    );

    // Un glyphe à taille fixe déborde d'une petite pastille et se perd dans une grande.
    expect(rendu(vue)).toMatch(/"fontSize":27\.6/);
  });

  it('une semaine vide ne rend aucune colonne', async () => {
    const vue = await render(<WeekDots days={[]} />);

    expect(rendu(vue)).not.toMatch(/borderRadius":10/);
  });
});
