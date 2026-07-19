import { describe, expect, it } from 'vitest';
import {
  HOME_WIDGET_IDS,
  STRENGTH_WIDGET_IDS,
  RUNNING_WIDGET_IDS,
  WIDGET_REGISTRY,
  coerceSize,
  defaultScreenLayout,
  resolveScreenLayout,
  moveWidget,
  packWidgets,
  parseMultiScreenLayout,
  type ScreenLayout,
  type WidgetLayoutEntry,
} from './widgets';

// ---------------------------------------------------------------------------
// Registres
// ---------------------------------------------------------------------------
describe('WIDGET_REGISTRY', () => {
  it('accueil : 9 widgets, gardes pilier, toutes formes par défaut = wide', () => {
    expect(HOME_WIDGET_IDS).toHaveLength(9);
    expect(WIDGET_REGISTRY.home.pillars['streak']).toBe('always');
    expect(WIDGET_REGISTRY.home.pillars['today-session']).toEqual(['strength']);
    HOME_WIDGET_IDS.forEach((id) => {
      expect(WIDGET_REGISTRY.home.defaultSize[id]).toBe('wide');
    });
  });

  it('muscu : 4 widgets, tous gardés par strength, formes par défaut = maquette', () => {
    expect(STRENGTH_WIDGET_IDS).toEqual([
      'strength-programs',
      'strength-history',
      'strength-planning',
      'strength-progress',
    ]);
    STRENGTH_WIDGET_IDS.forEach((id) => {
      expect(WIDGET_REGISTRY.strength.pillars[id]).toEqual(['strength']);
    });
    expect(WIDGET_REGISTRY.strength.defaultSize['strength-programs']).toBe('small');
    expect(WIDGET_REGISTRY.strength.defaultSize['strength-planning']).toBe('wide');
    expect(WIDGET_REGISTRY.strength.defaultSize['strength-progress']).toBe('large');
  });

  it('course : 3 widgets, tous gardés par running', () => {
    expect(RUNNING_WIDGET_IDS).toEqual([
      'running-history',
      'running-programs',
      'running-planning',
    ]);
    RUNNING_WIDGET_IDS.forEach((id) => {
      expect(WIDGET_REGISTRY.running.pillars[id]).toEqual(['running']);
    });
    expect(WIDGET_REGISTRY.running.defaultSize['running-history']).toBe('wide');
  });
});

// ---------------------------------------------------------------------------
// coerceSize — migration full/compact
// ---------------------------------------------------------------------------
describe('coerceSize', () => {
  it('migre full → wide et compact → small', () => {
    expect(coerceSize('full', 'wide')).toBe('wide');
    expect(coerceSize('compact', 'wide')).toBe('small');
  });

  it('laisse passer les 3 formes valides', () => {
    expect(coerceSize('small', 'wide')).toBe('small');
    expect(coerceSize('wide', 'small')).toBe('wide');
    expect(coerceSize('large', 'small')).toBe('large');
  });

  it('valeur inconnue → fallback', () => {
    expect(coerceSize('xxl', 'wide')).toBe('wide');
    expect(coerceSize(undefined, 'small')).toBe('small');
    expect(coerceSize(42, 'large')).toBe('large');
  });
});

// ---------------------------------------------------------------------------
// defaultScreenLayout
// ---------------------------------------------------------------------------
describe('defaultScreenLayout', () => {
  it('renvoie tous les widgets du hub, ordre canonique, visibles, forme par défaut', () => {
    const layout = defaultScreenLayout('strength');
    expect(layout.widgets.map((w) => w.id)).toEqual([...STRENGTH_WIDGET_IDS]);
    layout.widgets.forEach((w, i) => {
      expect(w.order).toBe(i);
      expect(w.visible).toBe(true);
      expect(w.size).toBe(WIDGET_REGISTRY.strength.defaultSize[w.id]);
    });
  });

  it('nouvelle instance immuable à chaque appel', () => {
    const a = defaultScreenLayout('home');
    const b = defaultScreenLayout('home');
    expect(a).not.toBe(b);
    expect(a.widgets).not.toBe(b.widgets);
  });
});

// ---------------------------------------------------------------------------
// resolveScreenLayout
// ---------------------------------------------------------------------------
describe('resolveScreenLayout', () => {
  const allPillars = ['strength', 'running', 'nutrition'] as const;

  it('stored=null → défaut du hub, filtré par piliers', () => {
    const resolved = resolveScreenLayout(null, 'home', [...allPillars]);
    expect(resolved.widgets.map((w) => w.id)).toEqual([...HOME_WIDGET_IDS]);
  });

  it('filtre pilier : course masquée si running inactif (aucun widget)', () => {
    const resolved = resolveScreenLayout(null, 'running', ['strength', 'nutrition']);
    expect(resolved.widgets).toHaveLength(0);
  });

  it('forward-compat : widget connu absent → ajouté en fin, visible, forme par défaut', () => {
    const stored: ScreenLayout = {
      widgets: [{ id: 'strength-planning', visible: true, order: 0, size: 'small' }],
    };
    const resolved = resolveScreenLayout(stored, 'strength', [...allPillars]);
    expect(resolved.widgets).toHaveLength(4);
    expect(resolved.widgets[0]!.id).toBe('strength-planning');
    const prog = resolved.widgets.find((w) => w.id === 'strength-progress')!;
    expect(prog.visible).toBe(true);
    expect(prog.size).toBe('large'); // forme par défaut du registre
  });

  it('migre les tailles stockées en ancien modèle (full/compact)', () => {
    const stored = {
      widgets: [
        { id: 'today-session', visible: true, order: 0, size: 'full' },
        { id: 'streak', visible: true, order: 1, size: 'compact' },
      ],
    } as unknown as ScreenLayout;
    const resolved = resolveScreenLayout(stored, 'home', [...allPillars]);
    expect(resolved.widgets.find((w) => w.id === 'today-session')!.size).toBe('wide');
    expect(resolved.widgets.find((w) => w.id === 'streak')!.size).toBe('small');
  });

  it('ID inconnu ignoré ; IDs dupliqués dédupliqués (1ʳᵉ occurrence)', () => {
    const stored = {
      widgets: [
        { id: 'strength-programs', visible: false, order: 0, size: 'wide' },
        { id: 'fantome', visible: true, order: 1, size: 'wide' },
        { id: 'strength-programs', visible: true, order: 2, size: 'small' },
      ],
    } as unknown as ScreenLayout;
    const resolved = resolveScreenLayout(stored, 'strength', [...allPillars]);
    const progs = resolved.widgets.filter((w) => w.id === 'strength-programs');
    expect(progs).toHaveLength(1);
    expect(progs[0]!.visible).toBe(false); // 1ʳᵉ occurrence prime
    expect(resolved.widgets.map((w) => w.id)).not.toContain('fantome');
  });

  it('trie par order et recompacte 0..n-1', () => {
    const stored: ScreenLayout = {
      widgets: [
        { id: 'strength-progress', visible: true, order: 5, size: 'large' },
        { id: 'strength-programs', visible: true, order: 1, size: 'small' },
      ],
    };
    const resolved = resolveScreenLayout(stored, 'strength', [...allPillars]);
    expect(resolved.widgets.slice(0, 2).map((w) => w.id)).toEqual([
      'strength-programs',
      'strength-progress',
    ]);
    expect(resolved.widgets.map((w) => w.order)).toEqual([0, 1, 2, 3]);
  });

  it('indépendance des hubs : un stored muscu n’affecte pas la course', () => {
    const stored: ScreenLayout = {
      widgets: [{ id: 'strength-programs', visible: false, order: 0, size: 'small' }],
    };
    const running = resolveScreenLayout(stored, 'running', [...allPillars]);
    // Le stored muscu ne contient aucun ID course → défaut course complet.
    expect(running.widgets.map((w) => w.id)).toEqual([...RUNNING_WIDGET_IDS]);
  });
});

// ---------------------------------------------------------------------------
// moveWidget
// ---------------------------------------------------------------------------
describe('moveWidget', () => {
  const base = defaultScreenLayout('strength');

  it('déplace vers un index cible et recompacte', () => {
    const next = moveWidget(base, 'strength-progress', 0);
    expect(next.widgets[0]!.id).toBe('strength-progress');
    expect(next.widgets.map((w) => w.order)).toEqual([0, 1, 2, 3]);
  });

  it('pur / immuable', () => {
    const snapshot = JSON.stringify(base);
    moveWidget(base, 'strength-history', 3);
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it('borne l’index dans [0, n-1] ; id inconnu → inchangé', () => {
    expect(moveWidget(base, 'strength-programs', 99).widgets.at(-1)!.id).toBe('strength-programs');
    expect(moveWidget(base, 'inconnu' as never, 0).widgets.map((w) => w.id)).toEqual(
      base.widgets.map((w) => w.id),
    );
  });
});

// ---------------------------------------------------------------------------
// packWidgets — grille 2 colonnes
// ---------------------------------------------------------------------------
describe('packWidgets', () => {
  const e = (id: string, size: WidgetLayoutEntry['size']): WidgetLayoutEntry => ({
    id: id as WidgetLayoutEntry['id'],
    size,
    visible: true,
    order: 0,
  });

  it('liste vide → aucune ligne', () => {
    expect(packWidgets([])).toEqual([]);
  });

  it('deux small consécutifs → 1 ligne à 2 cellules', () => {
    const rows = packWidgets([e('a', 'small'), e('b', 'small')]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.cells).toHaveLength(2);
    expect(rows[0]!.full).toBe(false);
  });

  it('wide / large → lignes pleine largeur', () => {
    const rows = packWidgets([e('a', 'wide'), e('b', 'large')]);
    expect(rows.map((r) => r.full)).toEqual([true, true]);
    expect(rows.every((r) => r.cells.length === 1)).toBe(true);
  });

  it('small isolé (suivi d’un wide) → ligne à 1 cellule (colonne gauche)', () => {
    const rows = packWidgets([e('a', 'small'), e('b', 'wide'), e('c', 'small')]);
    expect(rows).toHaveLength(3);
    expect(rows[0]!.cells.map((c) => c.id)).toEqual(['a']);
    expect(rows[0]!.full).toBe(false);
    expect(rows[1]!.full).toBe(true);
    expect(rows[2]!.cells.map((c) => c.id)).toEqual(['c']);
  });

  it('trois small → lignes (2) + (1)', () => {
    const rows = packWidgets([e('a', 'small'), e('b', 'small'), e('c', 'small')]);
    expect(rows.map((r) => r.cells.length)).toEqual([2, 1]);
  });
});

// ---------------------------------------------------------------------------
// parseMultiScreenLayout — tolérant + rétro-compatible
// ---------------------------------------------------------------------------
describe('parseMultiScreenLayout', () => {
  it('null / valeurs corrompues → null', () => {
    expect(parseMultiScreenLayout(null)).toBeNull();
    expect(parseMultiScreenLayout(42)).toBeNull();
    expect(parseMultiScreenLayout('{bad json')).toBeNull();
    expect(parseMultiScreenLayout({})).toBeNull();
  });

  it('nouveau format { screens } → parsé par hub', () => {
    const raw = {
      screens: {
        home: { widgets: [{ id: 'streak', visible: true, order: 0, size: 'small' }] },
        strength: {
          widgets: [{ id: 'strength-programs', visible: false, order: 0, size: 'large' }],
        },
      },
    };
    const parsed = parseMultiScreenLayout(raw);
    expect(parsed!.screens.home!.widgets[0]!.id).toBe('streak');
    expect(parsed!.screens.strength!.widgets[0]!.size).toBe('large');
    expect(parsed!.screens.running).toBeUndefined();
  });

  it('ancien format { widgets } → interprété comme screens.home, tailles migrées', () => {
    const raw = {
      widgets: [
        { id: 'today-session', visible: true, order: 0, size: 'full' },
        { id: 'weight', visible: false, order: 1, size: 'compact' },
      ],
    };
    const parsed = parseMultiScreenLayout(raw);
    expect(parsed!.screens.home!.widgets.map((w) => w.size)).toEqual(['wide', 'small']);
    expect(parsed!.screens.strength).toBeUndefined();
  });

  it('tolère une chaîne JSON et ignore les entrées malformées', () => {
    const parsed = parseMultiScreenLayout(
      JSON.stringify({
        screens: { home: { widgets: [{ nope: true }, { id: 'streak', order: 0 }] } },
      }),
    );
    expect(parsed!.screens.home!.widgets.map((w) => w.id)).toEqual(['streak']);
  });
});
