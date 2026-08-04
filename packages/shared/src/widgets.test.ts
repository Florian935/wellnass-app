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
  it('accueil 21, muscu 5, course 3 ; gardes pilier', () => {
    // 21 depuis MR-14 (04/08/2026). Le registre les **déclare** tous ; c'est
    // `resolveScreenLayout` qui filtre — `cycle` reste masqué tant que l'opt-in est faux.
    expect(HOME_WIDGET_IDS).toHaveLength(21);
    expect(STRENGTH_WIDGET_IDS).toHaveLength(5);
    expect(RUNNING_WIDGET_IDS).toHaveLength(3);
    expect(WIDGET_REGISTRY.home.pillars['streak']).toBe('always');
    expect(WIDGET_REGISTRY.strength.pillars['strength-programs']).toEqual(['strength']);
  });

  it('garde la charge d\'entraînement (META-19) derrière muscu ET course — ACWR combiné', () => {
    // Même garde que `training-time` : l'ACWR combine les deux piliers, un seul actif ne donnerait
    // qu'une moitié du calcul.
    expect(WIDGET_REGISTRY.home.pillars['training-load']).toEqual(['strength', 'running']);
  });

  it('garde le garde-fou tri-pilier (TRI-12) derrière les 3 piliers — le seul cas à 3', () => {
    // Contrairement à `training-load` (2 piliers), TRI-12 combine charge (muscu+course) et
    // déficit nutritionnel : aucun des trois n'est dispensable.
    expect(WIDGET_REGISTRY.home.pillars['overtraining-guard']).toEqual([
      'strength',
      'running',
      'nutrition',
    ]);
  });

  it('garde MR-14 à 2 piliers, là où TRI-12 en exige 3 — la distinction qui justifie l’US', () => {
    // Spec MR-14 §0 : `overtraining-guard` (TRI-12) est invisible pour un utilisateur muscu+course
    // sans nutrition activée ; `load-streak-alert` (MR-14) couvre exactement cette population.
    // Si un jour ces deux gardes deviennent identiques, l'une des deux US est un doublon.
    expect(WIDGET_REGISTRY.home.pillars['load-streak-alert']).toEqual(['strength', 'running']);
    expect(WIDGET_REGISTRY.home.pillars['overtraining-guard']).toEqual([
      'strength',
      'running',
      'nutrition',
    ]);
  });

  it('garde le cycle (CYCLE-01) par un RÉGLAGE — ni pilier, ni « always »', () => {
    // La 3ᵉ forme de garde, ajoutée pour ce cas précis : le cycle n'appartient à aucun pilier
    // (donc pas de liste) mais ne doit pas s'afficher pour tout le monde (donc pas `'always'`).
    expect(WIDGET_REGISTRY.home.pillars['cycle']).toEqual({ setting: 'cycleTrackingEnabled' });
  });

  it('garde les objectifs (OBJ-01) derrière muscu OU course, et non « always »', () => {
    // Les 2 types d'objectif portent sur la course et la force : un utilisateur « nutrition seule »
    // ne pourrait en créer aucun, le widget serait un vide permanent. Contrairement à `steps` et
    // `wellbeing`, qui sont eux réellement transverses.
    expect(WIDGET_REGISTRY.home.pillars['goals']).toEqual(['strength', 'running']);
    expect(WIDGET_REGISTRY.home.pillars['wellbeing']).toBe('always');
  });

  it('garde le bilan (BILAN-01) en transverse, lui — il agrège ce qui existe', () => {
    // La distinction avec `goals` est le point : un objectif de course n'a aucun sens sans le pilier
    // course, alors qu'un bilan « nutrition seule » a du contenu (jours journalisés, adhérence).
    expect(WIDGET_REGISTRY.home.pillars['review']).toBe('always');
  });

  it('garde le readiness (TRI-03) en transverse — dégradation par composante, pas par pilier', () => {
    // Contrairement à `training-load`/`overtraining-guard` (gardés par pilier, tout ou rien),
    // TRI-03 dégrade par composante en interne (spec D2) : même un utilisateur mono-pilier avec des
    // check-ins peut avoir un verdict partiel. La garde reste donc `'always'`, comme `wellbeing`.
    expect(WIDGET_REGISTRY.home.pillars['readiness']).toBe('always');
  });

  it("garde la suggestion de niveau d'activité (RN-03) derrière course ou nutrition (candidat de grille)", () => {
    // Registre = OU (guard.some(...), même sémantique que `overtraining-guard`) : décide si le
    // widget est un candidat de grille, pas le véritable ET. Le hook `useActivityLevelSuggestion`
    // applique le vrai ET (course + nutrition ensemble) et rend `null` sinon — même patron que
    // `useTrainingLoadAlert`.
    expect(WIDGET_REGISTRY.home.pillars['activity-level-suggestion']).toEqual([
      'running',
      'nutrition',
    ]);
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
    // 21 : `defaultScreenLayout` part du registre **sans filtrer** — c'est `resolveScreenLayout`
    // qui applique les gardes. Le widget `cycle` est donc présent ici, masqué là-bas.
    expect(layout.widgets).toHaveLength(21);
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
    expect(r.widgets).toHaveLength(20);
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

  it('complète un layout stocké avec un widget ajouté au registre (US PAS-01, sans migration)', () => {
    // Layout d'un utilisateur d'avant PAS-01 : il ne connaît pas `steps`. Il doit apparaître
    // quand même, sinon il faudrait migrer `user_settings.dashboard_layout` de tout le monde.
    const stored: ScreenLayout = {
      widgets: [
        { id: 'today-session', visible: true, size: 'wide', col: 0, row: 0 },
        { id: 'streak', visible: true, size: 'small', col: 0, row: 1 },
      ],
    };
    const r = resolveScreenLayout(stored, 'home', [...all]);
    expect(r.widgets.map((w) => w.id)).toContain('steps');
    expect(r.widgets.map((w) => w.id)).toContain('wellbeing');
    assertNoOverlap(r.widgets);
  });

  // -------------------------------------------------------------------------
  // US CYCLE-01 — garde par réglage (3ᵉ forme de `WidgetGuard`)
  // -------------------------------------------------------------------------

  it('masque `cycle` quand le drapeau est absent — l’absence ne vaut jamais consentement', () => {
    const r = resolveScreenLayout(null, 'home', [...all]);
    expect(r.widgets.map((w) => w.id)).not.toContain('cycle');
    // Et le hub garde donc exactement ses 20 widgets historiques (hors `cycle`).
    expect(r.widgets).toHaveLength(20);
  });

  it('masque `cycle` quand le drapeau est explicitement faux', () => {
    const r = resolveScreenLayout(null, 'home', [...all], { cycleTrackingEnabled: false });
    expect(r.widgets.map((w) => w.id)).not.toContain('cycle');
  });

  it('affiche `cycle` quand le suivi est activé, sans chevauchement', () => {
    const r = resolveScreenLayout(null, 'home', [...all], { cycleTrackingEnabled: true });
    expect(r.widgets.map((w) => w.id)).toContain('cycle');
    expect(r.widgets).toHaveLength(21);
    assertNoOverlap(r.widgets);
  });

  it("affiche `cycle` même en « nutrition seule » : il n'est gardé par aucun pilier", () => {
    const r = resolveScreenLayout(null, 'home', ['nutrition'], { cycleTrackingEnabled: true });
    expect(r.widgets.map((w) => w.id)).toContain('cycle');
  });

  it('retire `cycle` d’un layout stocké si le suivi a été désactivé depuis', () => {
    // Cas réel : l'utilisatrice a rangé le widget, puis coupé le suivi. Le layout stocké le
    // mentionne encore ; il ne doit plus être rendu, et sans laisser de trou.
    const stored: ScreenLayout = {
      widgets: [
        { id: 'streak', visible: true, size: 'small', col: 0, row: 0 },
        { id: 'cycle', visible: true, size: 'wide', col: 0, row: 1 },
      ],
    };
    const r = resolveScreenLayout(stored, 'home', [...all], { cycleTrackingEnabled: false });
    expect(r.widgets.map((w) => w.id)).not.toContain('cycle');
    assertNoOverlap(r.widgets);
    assertNoEmptyRow(r.widgets);
  });

  it('garde `wellbeing` visible pour un utilisateur « nutrition seule » (US BIEN-01)', () => {
    // Le bien-être est une 4ᵉ dimension **transverse**, pas un 4ᵉ pilier activable : il ne doit
    // jamais être filtré par `active_pillars`, exactement comme `streak` et `steps`.
    const r = resolveScreenLayout(null, 'home', ['nutrition']);
    const ids = r.widgets.map((w) => w.id);

    expect(ids).toContain('wellbeing');
    expect(ids).toContain('streak');
    expect(ids).toContain('steps');
    expect(ids).toContain('readiness');
    // Contrôle négatif : les widgets gardés par un pilier inactif, eux, disparaissent bien.
    expect(ids).not.toContain('muscle-volume');
    expect(ids).not.toContain('running-week');
    // Note : `activity-level-suggestion` reste dans le layout ici — la garde `Pillar[]` du
    // registre est un OU (`guard.some(...)`, même sémantique que `overtraining-guard` qui liste
    // 3 piliers) : elle décide seulement si le widget est un **candidat de grille**. Le véritable
    // ET (course + nutrition ensemble) est appliqué par le hook `useActivityLevelSuggestion`, qui
    // rend `null` hors des deux — même patron que `useTrainingLoadAlert`/`useOvertrainingGuardAlert`,
    // vérifié à ce niveau-là, pas ici (`widgets.ts` ne connaît aucune donnée applicative).
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
