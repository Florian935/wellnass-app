import { describe, expect, it } from 'vitest';
import { chroma, contrastRatio, readableOn, relativeLuminance, tintPreservingLuminance } from './contrast';

describe('chroma', () => {
  it('un gris n’a aucune chroma, une primaire pure est au maximum', () => {
    expect(chroma('#000000')).toBe(0);
    expect(chroma('#ffffff')).toBe(0);
    expect(chroma('#808080')).toBe(0);
    expect(chroma('#ff0000')).toBe(255);
    expect(chroma('#00ff00')).toBe(255);
  });

  it('accepte la forme sans # et renvoie null sur une valeur illisible', () => {
    expect(chroma('2e4419')).toBe(43);
    expect(chroma('pas-un-hex')).toBeNull();
    expect(chroma('#fff')).toBeNull();
  });

  it('🔴 mesure bien le défaut qui a motivé la fonction : deux teintes de pilier, deux époques', () => {
    // Les valeurs relevées à la main dans `theme/pillar.ts` avant correction. Si l'une d'elles
    // change ici, c'est que la formule a bougé — et les seuils du test-garde côté mobile avec.
    expect(chroma('#2e4419')).toBe(43); // nutrition, avant NUTRI-UX02 : un olive
    expect(chroma('#1d4586')).toBe(105); // course : un bleu franc, le défaut était ailleurs
    expect(chroma('#2f6b12')).toBe(89); // nutrition, après : dans la bande des autres piliers
  });

  it('est indépendante de la clarté — c’est sa limite, et elle est assumée', () => {
    // Deux verts de clartés très différentes, même écart de canaux : la fonction ne les départage
    // pas. C'est pour ça qu'on ne l'utilise qu'à luminance comparable.
    expect(chroma('#102010')).toBe(chroma('#a0b0a0'));
  });
});

describe('relativeLuminance', () => {
  it('noir = 0, blanc = 1', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBe(1);
  });

  it('accepte la forme sans #', () => {
    expect(relativeLuminance('ffffff')).toBe(1);
  });

  it('renvoie null sur une valeur illisible', () => {
    expect(relativeLuminance('pas-un-hex')).toBeNull();
    expect(relativeLuminance('#fff')).toBeNull();
    expect(relativeLuminance('')).toBeNull();
  });
});

describe('contrastRatio', () => {
  it('noir / blanc = 21 (le maximum WCAG)', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('blanc / blanc = 1 (le minimum)', () => {
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  it('est symétrique (l’ordre des arguments ne compte pas)', () => {
    expect(contrastRatio('#33291f', '#f7eede')).toBeCloseTo(
      contrastRatio('#f7eede', '#33291f')!,
      5,
    );
  });

  it('renvoie null si une des deux couleurs est illisible', () => {
    expect(contrastRatio('#000000', 'pas-un-hex')).toBeNull();
  });
});

describe('tintPreservingLuminance', () => {
  it('🔴 conserve le contraste de la base contre n’importe quelle encre — c’est TOUT le contrat', () => {
    // Si cette propriété tombe, les palettes par pilier peuvent faire passer une paire de texte
    // sous le seuil WCAG sans que rien ne le signale.
    //
    // La tolérance (0,05) n'est pas du confort : une couleur hex a des canaux **entiers**, et près
    // du blanc la courbe sRGB est si raide qu'un arrondi d'un demi-niveau déplace déjà la luminance
    // de ~0,003, et un rapport de 20:1 s'en trouve décalé de 0,06. L'invariant exact est donc
    // inatteignable par construction : on mesure un écart RELATIF, sous 1 %.
    const encres = ['#000000', '#ffffff', '#f4ecdd', '#33291f', '#786a59', '#c9b79a'];
    for (const base of ['#fffaf2', '#30271e', '#f7eede', '#1c150e', '#3a2e22', '#eadcc6']) {
      for (const tint of ['#6b0028', '#1d4586', '#2e4419', '#8a6419', '#b14f2b']) {
        for (const amount of [0.1, 0.22, 0.3, 0.6, 1]) {
          const out = tintPreservingLuminance(base, tint, amount)!;
          for (const encre of encres) {
            const attendu = contrastRatio(encre, base)!;
            const obtenu = contrastRatio(encre, out)!;
            expect(Math.abs(obtenu - attendu) / attendu).toBeLessThan(0.01);
          }
        }
      }
    }
  });

  it('conserve donc le contraste contre une encre donnée', () => {
    const surface = '#30271e';
    const teintee = tintPreservingLuminance(surface, '#6b0028', 0.3)!;
    expect(contrastRatio('#f4ecdd', teintee)!).toBeCloseTo(contrastRatio('#f4ecdd', surface)!, 2);
  });

  it('déplace bien la teinte : le résultat n’est pas la base', () => {
    expect(tintPreservingLuminance('#30271e', '#6b0028', 0.3)).not.toBe('#30271e');
  });

  it('amount = 0 rend la base inchangée', () => {
    expect(tintPreservingLuminance('#30271e', '#6b0028', 0)).toBe('#30271e');
  });

  it('borne amount hors [0,1] au lieu d’extrapoler', () => {
    expect(tintPreservingLuminance('#30271e', '#6b0028', -3)).toBe('#30271e');
    expect(tintPreservingLuminance('#30271e', '#6b0028', 9)).toBe(
      tintPreservingLuminance('#30271e', '#6b0028', 1),
    );
  });

  it('le noir reste noir — aucun facteur ne peut l’éclaircir, et ça ne doit pas boucler', () => {
    expect(tintPreservingLuminance('#000000', '#6b0028', 0.5)).toBe('#000000');
  });

  it('renvoie null sur une entrée illisible', () => {
    expect(tintPreservingLuminance('pas-un-hex', '#6b0028', 0.3)).toBeNull();
    expect(tintPreservingLuminance('#30271e', '#fff', 0.3)).toBeNull();
  });
});

describe('readableOn', () => {
  it('🔴 atteint toujours le seuil, quel que soit le fond', () => {
    const fonds = ['#fffaf2', '#30271e', '#f7eede', '#1c150e', '#441c22', '#fff9fc'];
    const couleurs = ['#e07a98', '#6fa8ef', '#a9ba7e', '#e0b155', '#6b0028', '#e07a4d', '#ffffff', '#000000'];
    for (const fond of fonds) {
      for (const couleur of couleurs) {
        expect(contrastRatio(readableOn(couleur, fond)!, fond)!).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('ne touche PAS une couleur déjà lisible', () => {
    expect(readableOn('#e07a98', '#30271e')).toBe('#e07a98');
  });

  it('assombrit sur fond clair, éclaircit sur fond sombre', () => {
    const clair = readableOn('#e07a98', '#fffaf2')!;
    const sombre = readableOn('#6b0028', '#1c150e')!;
    expect(relativeLuminance(clair)!).toBeLessThan(relativeLuminance('#e07a98')!);
    expect(relativeLuminance(sombre)!).toBeGreaterThan(relativeLuminance('#6b0028')!);
  });

  it('respecte un seuil personnalisé', () => {
    expect(contrastRatio(readableOn('#e07a98', '#fffaf2', 7)!, '#fffaf2')!).toBeGreaterThanOrEqual(7);
  });

  it('renvoie null sur une entrée illisible', () => {
    expect(readableOn('nope', '#30271e')).toBeNull();
  });
});
