import { describe, expect, it } from 'vitest';
import {
  HOME_WIDGET_IDS,
  STRENGTH_WIDGET_IDS,
  RUNNING_WIDGET_IDS,
  WIDGET_REGISTRY,
  GRID_COLS,
  coerceSize,
  sizeSpan,
  clampCol,
  defaultScreenLayout,
  resolveScreenLayout,
  moveWidgetToCell,
  gridRowCount,
  parseMultiScreenLayout,
  type ScreenLayout,
  type WidgetLayoutEntry,
} from './widgets';

/** Vrai si deux entrées se chevauchent en grille. */
function overlap(a: WidgetLayoutEntry, b: WidgetLayoutEntry): boolean {
  const sa = sizeSpan(a.size);
  const sb = sizeSpan(b.size);
  return (
    a.col < b.col + sb.w &&
    b.col < a.col + sa.w &&
    a.row < b.row + sb.h &&
    b.row < a.row + sa.h
  );
}

/** Assert : aucune paire de widgets ne se chevauche, et tout tient dans la grille. */
function assertNoOverlap(widgets: WidgetLayoutEntry[]): void {
  for (const w of widgets) {
    expect(w.col).toBeGreaterThanOrEqual(0);
    expect(w.col + sizeSpan(w.size).w).toBeLessThanOrEqual(GRID_COLS);
  }
  for (let i = 0; i < widgets.length; i += 1) {
    for (let j = i + 1; j < widgets.length; j += 1) {
      expect(overlap(widgets[i]!, widgets[j]!)).toBe(false);
    }
  }
}

/** Assert : aucune ligne entièrement vide (invariant de compaction verticale). */
function assertNoEmptyRow(widgets: WidgetLayoutEntry[]): void {
  const rows = gridRowCount(widgets);
  for (let r = 0; r < rows; r += 1) {
    const covered = widgets.some((w) => w.row <= r && r < w.row + sizeSpan(w.size).h);
    expect(covered).toBe(true);
  }
}

// ---------------------------------------------------------------------------
// Empreintes
// ---------------------------------------------------------------------------
describe('sizeSpan / clampCol', () => {
  it('empreintes : small 1×1, wide 2×1, large 2×2', () => {
    expect(sizeSpan('small')).toEqual({ w: 1, h: 1 });
    expect(sizeSpan('wide')).toEqual({ w: 2, h: 1 });
    expect(sizeSpan('large')).toEqual({ w: 2, h: 2 });
  });
  it('clampCol borne pour que l’empreinte tienne dans la grille (2 colonnes)', () => {
    expect(clampCol(1, 1)).toBe(1); // small en col 1 OK
    expect(clampCol(1, 2)).toBe(0); // wide/large ne peut pas commencer en col 1
    expect(clampCol(-3, 1)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Registres (inchangés)
// ---------------------------------------------------------------------------
describe('WIDGET_REGISTRY', () => {
  it('accueil 9, muscu 4, course 3 ; gardes pilier', () => {
    expect(HOME_WIDGET_IDS).toHaveLength(9);
    expect(STRENGTH_WIDGET_IDS).toHaveLength(4);
    expect(RUNNING_WIDGET_IDS).toHaveLength(3);
    expect(WIDGET_REGISTRY.home.pillars['streak']).toBe('always');
    expect(WIDGET_REGISTRY.strength.pillars['strength-programs']).toEqual(['strength']);
  });
});

describe('coerceSize (migration full/compact)', () => {
  it('full→wide, compact→small, sinon fallback', () => {
    expect(coerceSize('full', 'wide')).toBe('wide');
    expect(coerceSize('compact', 'wide')).toBe('small');
    expect(coerceSize('large', 'small')).toBe('large');
    expect(coerceSize('xxl', 'wide')).toBe('wide');
  });
});

// ---------------------------------------------------------------------------
// defaultScreenLayout : positions grille, sans chevauchement
// ---------------------------------------------------------------------------
describe('defaultScreenLayout', () => {
  it('place tous les widgets du hub sans chevauchement, dans la grille', () => {
    const layout = defaultScreenLayout('home');
    expect(layout.widgets).toHaveLength(9);
    layout.widgets.forEach((w) => {
      expect(Number.isFinite(w.col)).toBe(true);
      expect(Number.isFinite(w.row)).toBe(true);
    });
    assertNoOverlap(layout.widgets);
  });
  it('nouvelle instance à chaque appel', () => {
    expect(defaultScreenLayout('strength')).not.toBe(defaultScreenLayout('strength'));
  });
});

// ---------------------------------------------------------------------------
// resolveScreenLayout
// ---------------------------------------------------------------------------
describe('resolveScreenLayout', () => {
  const all = ['strength', 'running', 'nutrition'] as const;

  it('stored=null → défaut du hub, sans chevauchement', () => {
    const r = resolveScreenLayout(null, 'home', [...all]);
    expect(r.widgets).toHaveLength(9);
    assertNoOverlap(r.widgets);
  });

  it('compacte le layout stocké : aucun chevauchement ni ligne vide', () => {
    const stored: ScreenLayout = {
      widgets: [
        { id: 'streak', visible: true, size: 'small', col: 1, row: 3 },
        { id: 'weight', visible: true, size: 'small', col: 0, row: 5 },
      ],
    };
    const r = resolveScreenLayout(stored, 'home', [...all]);
    assertNoOverlap(r.widgets);
    assertNoEmptyRow(r.widgets);
  });

  it('borne une colonne invalide (wide en col 1 → col 0)', () => {
    const stored: ScreenLayout = {
      widgets: [{ id: 'today-session', visible: true, size: 'wide', col: 1, row: 0 }],
    };
    const r = resolveScreenLayout(stored, 'home', [...all]);
    expect(r.widgets.find((w) => w.id === 'today-session')!.col).toBe(0);
  });

  it('ancien format (order + full/compact, sans col/row) → migration first-fit, sans chevauchement', () => {
    const stored = {
      widgets: [
        { id: 'streak', visible: true, order: 0, size: 'compact' },
        { id: 'today-session', visible: true, order: 1, size: 'full' },
        { id: 'weight', visible: true, order: 2, size: 'compact' },
      ],
    } as unknown as ScreenLayout;
    const r = resolveScreenLayout(stored, 'home', [...all]);
    // tailles migrées
    expect(r.widgets.find((w) => w.id === 'streak')!.size).toBe('small');
    expect(r.widgets.find((w) => w.id === 'today-session')!.size).toBe('wide');
    r.widgets.forEach((w) => expect(Number.isFinite(w.col)).toBe(true));
    assertNoOverlap(r.widgets);
  });

  it('filtre par pilier ; course masquée si running inactif', () => {
    expect(resolveScreenLayout(null, 'running', ['strength']).widgets).toHaveLength(0);
    const home = resolveScreenLayout(null, 'home', ['strength']).widgets.map((w) => w.id);
    expect(home).toContain('streak');
    expect(home).not.toContain('running-week');
  });

  it('IDs inconnus ignorés', () => {
    const stored = {
      widgets: [
        { id: 'streak', visible: true, size: 'small', col: 0, row: 0 },
        { id: 'fantome', visible: true, size: 'small', col: 1, row: 0 },
      ],
    } as unknown as ScreenLayout;
    const ids = resolveScreenLayout(stored, 'home', [...all]).widgets.map((w) => w.id);
    expect(ids).not.toContain('fantome');
  });
});

// ---------------------------------------------------------------------------
// moveWidgetToCell : place + collision par poussée
// ---------------------------------------------------------------------------
describe('moveWidgetToCell', () => {
  it('déplace vers la case cible (bornée) et ne laisse aucun chevauchement', () => {
    const base: ScreenLayout = {
      widgets: [
        { id: 'streak', visible: true, size: 'small', col: 0, row: 0 },
        { id: 'weight', visible: true, size: 'small', col: 1, row: 0 },
        { id: 'today-session', visible: true, size: 'wide', col: 0, row: 1 },
      ],
    };
    // Déplace weight sous streak (col 0, row 1) → collision avec today-session (wide) → poussée.
    const r = moveWidgetToCell(base, 'weight', 0, 1);
    const weight = r.widgets.find((w) => w.id === 'weight')!;
    expect({ col: weight.col, row: weight.row }).toEqual({ col: 0, row: 1 });
    assertNoOverlap(r.widgets);
    // today-session (wide) a été poussé sous weight.
    expect(r.widgets.find((w) => w.id === 'today-session')!.row).toBeGreaterThanOrEqual(2);
  });

  it('deux petits carrés empilés dans la même colonne', () => {
    const base: ScreenLayout = {
      widgets: [
        { id: 'streak', visible: true, size: 'small', col: 0, row: 0 },
        { id: 'weight', visible: true, size: 'small', col: 1, row: 0 },
      ],
    };
    const r = moveWidgetToCell(base, 'weight', 0, 1); // col 0, sous streak
    const weight = r.widgets.find((w) => w.id === 'weight')!;
    expect({ col: weight.col, row: weight.row }).toEqual({ col: 0, row: 1 });
    assertNoOverlap(r.widgets); // colonne droite laissée vide (trou autorisé)
  });

  it('compaction : une ligne vide au-dessus est supprimée (remontée)', () => {
    const base: ScreenLayout = {
      widgets: [
        { id: 'streak', visible: true, size: 'wide', col: 0, row: 0 },
        { id: 'weight', visible: true, size: 'wide', col: 0, row: 2 }, // trou en ligne 1
      ],
    };
    const r = moveWidgetToCell(base, 'weight', 0, 2); // re-place → compaction
    expect(r.widgets.find((w) => w.id === 'weight')!.row).toBe(1); // remontée en ligne 1
    assertNoEmptyRow(r.widgets);
  });

  it('borne la colonne d’un wide (col 1 demandé → 0)', () => {
    const base: ScreenLayout = {
      widgets: [{ id: 'today-session', visible: true, size: 'wide', col: 0, row: 0 }],
    };
    expect(moveWidgetToCell(base, 'today-session', 1, 0).widgets[0]!.col).toBe(0);
  });

  it('id inconnu → inchangé', () => {
    const base = defaultScreenLayout('running');
    const r = moveWidgetToCell(base, 'inconnu' as never, 0, 0);
    expect(r.widgets.map((w) => w.id)).toEqual(base.widgets.map((w) => w.id));
  });
});

describe('gridRowCount', () => {
  it('hauteur = ligne max occupée', () => {
    expect(
      gridRowCount([
        { id: 'streak', visible: true, size: 'small', col: 0, row: 0 },
        { id: 'weight', visible: true, size: 'large', col: 0, row: 2 },
      ]),
    ).toBe(4); // large en row 2, hauteur 2 → 4
  });
});

// ---------------------------------------------------------------------------
// parseMultiScreenLayout (rétro-compat + positions grille)
// ---------------------------------------------------------------------------
describe('parseMultiScreenLayout', () => {
  it('null / corrompu → null', () => {
    expect(parseMultiScreenLayout(null)).toBeNull();
    expect(parseMultiScreenLayout('{bad')).toBeNull();
    expect(parseMultiScreenLayout({})).toBeNull();
  });

  it('nouveau format { screens } avec col/row', () => {
    const parsed = parseMultiScreenLayout({
      screens: {
        home: { widgets: [{ id: 'streak', visible: true, size: 'small', col: 1, row: 2 }] },
      },
    });
    const w = parsed!.screens.home!.widgets[0]!;
    expect({ col: w.col, row: w.row, size: w.size }).toEqual({ col: 1, row: 2, size: 'small' });
  });

  it('ancien format { widgets } (order/full) → screens.home, résolu en grille', () => {
    const parsed = parseMultiScreenLayout({
      widgets: [
        { id: 'today-session', visible: true, order: 0, size: 'full' },
        { id: 'streak', visible: true, order: 1, size: 'compact' },
      ],
    });
    expect(parsed!.screens.home).toBeDefined();
    // Résolution en aval migre positions + tailles.
    const r = resolveScreenLayout(parsed!.screens.home, 'home', ['strength', 'running', 'nutrition']);
    expect(r.widgets.find((w) => w.id === 'today-session')!.size).toBe('wide');
    assertNoOverlap(r.widgets);
  });
});
