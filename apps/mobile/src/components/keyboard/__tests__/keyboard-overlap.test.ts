/**
 * US CLAV-01 — la formule d'évitement du clavier (`keyboard-overlap.ts`).
 *
 * Valeurs d'un Pixel 6a : écran de 914 dp ; clavier ouvert, son bord haut à 600 (314 dp recouverts,
 * barre de navigation gestuelle de 24 dp comprise). Les valeurs iOS sont celles d'un iPhone 15
 * (852 pt, clavier à 516) : la formule est la même, seuls les événements diffèrent.
 */

import { bottomPadding, keyboardOverlap, resolveBottomPadding } from '../keyboard-overlap';

describe('keyboardOverlap', () => {
  it('clavier fermé → 0, quoi que disent les mesures', () => {
    expect(keyboardOverlap({ containerBottom: 914, keyboardTop: 600, visible: false })).toBe(0);
  });

  it('conteneur au bas de l’écran : tout ce qui est sous le bord haut du clavier (Android)', () => {
    expect(keyboardOverlap({ containerBottom: 914, keyboardTop: 600, visible: true })).toBe(314);
  });

  it('conteneur au-dessus d’une barre d’onglets (bas à 834) : la barre est déduite par la mesure', () => {
    expect(keyboardOverlap({ containerBottom: 834, keyboardTop: 600, visible: true })).toBe(234);
  });

  it('conteneur entièrement au-dessus du clavier → 0, jamais négatif', () => {
    expect(keyboardOverlap({ containerBottom: 500, keyboardTop: 600, visible: true })).toBe(0);
  });

  it('arrondi au point : pas de demi-pixel qui ferait trembler la mise en page', () => {
    expect(keyboardOverlap({ containerBottom: 914.4, keyboardTop: 600.1, visible: true })).toBe(
      314,
    );
  });

  it('une mesure invalide ne décale rien (pas de NaN dans un style)', () => {
    expect(keyboardOverlap({ containerBottom: Number.NaN, keyboardTop: 600, visible: true })).toBe(
      0,
    );
  });

  it('🔒 jamais plus que la hauteur du conteneur : un haut sous le clavier ne fait pas boucler la mesure', () => {
    // Conteneur de 650 à 914, clavier à 600 : 264 au plus (et non 314, qui dépasserait le conteneur).
    expect(
      keyboardOverlap({ containerTop: 650, containerBottom: 914, keyboardTop: 600, visible: true }),
    ).toBe(264);
    // Haut au-dessus du clavier : la borne ne joue pas.
    expect(
      keyboardOverlap({ containerTop: 0, containerBottom: 914, keyboardTop: 600, visible: true }),
    ).toBe(314);
  });

  it('iOS : même formule', () => {
    expect(keyboardOverlap({ containerBottom: 852, keyboardTop: 516, visible: true })).toBe(336);
  });
});

describe('bottomPadding', () => {
  it('🔴 sans `safeAreaBottom`, clavier fermé : le padding de l’appelant, rien de plus', () => {
    // C'est la correction de la relecture (§15) : ajouter l'inset par défaut aurait changé la forme
    // d'une vingtaine d'écrans clavier fermé.
    expect(bottomPadding({ base: 16, overlap: 0, safeAreaBottom: false, inset: 24 })).toBe(16);
  });

  it('sans `safeAreaBottom`, clavier ouvert : le padding de l’appelant plus le recouvrement', () => {
    expect(bottomPadding({ base: 16, overlap: 234, safeAreaBottom: false, inset: 24 })).toBe(250);
  });

  it('avec `safeAreaBottom`, clavier fermé : l’inset, comme l’arête basse qu’il remplace', () => {
    expect(bottomPadding({ base: 0, overlap: 0, safeAreaBottom: true, inset: 24 })).toBe(24);
  });

  it('avec `safeAreaBottom`, clavier ouvert : le recouvrement seul, pas d’inset en plus', () => {
    expect(bottomPadding({ base: 0, overlap: 324, safeAreaBottom: true, inset: 24 })).toBe(324);
  });
});

describe('resolveBottomPadding', () => {
  it('`paddingBottom` d’abord, puis `paddingVertical`, puis `padding`', () => {
    expect(resolveBottomPadding({ paddingBottom: 8, paddingVertical: 12, padding: 16 })).toBe(8);
    expect(resolveBottomPadding({ paddingVertical: 12, padding: 16 })).toBe(12);
    expect(resolveBottomPadding({ padding: 16 })).toBe(16);
    expect(resolveBottomPadding({})).toBe(0);
    expect(resolveBottomPadding(undefined)).toBe(0);
  });

  it('une valeur non numérique compte pour 0', () => {
    expect(resolveBottomPadding({ paddingBottom: '10%' })).toBe(0);
  });
});
