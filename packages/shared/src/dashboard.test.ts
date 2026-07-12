import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_WIDGET_IDS,
  WIDGET_PILLARS,
  defaultDashboardLayout,
  resolveDashboardLayout,
  moveWidget,
  parseDashboardLayout,
  type DashboardLayout,
} from './dashboard';

// ---------------------------------------------------------------------------
// Registre
// ---------------------------------------------------------------------------
describe('DASHBOARD_WIDGET_IDS / WIDGET_PILLARS', () => {
  it('déclare les 7 widgets canoniques', () => {
    expect(DASHBOARD_WIDGET_IDS).toEqual([
      'today-session',
      'nutrition-summary',
      'streak',
      'weight',
      'record-recent',
      'muscle-volume',
      'running-week',
    ]);
  });

  it('associe chaque widget à ses piliers (ou always)', () => {
    expect(WIDGET_PILLARS['today-session']).toEqual(['strength']);
    expect(WIDGET_PILLARS['nutrition-summary']).toEqual(['nutrition']);
    expect(WIDGET_PILLARS['streak']).toBe('always');
    expect(WIDGET_PILLARS['weight']).toEqual(['nutrition']);
    expect(WIDGET_PILLARS['record-recent']).toEqual(['strength', 'running']);
    expect(WIDGET_PILLARS['muscle-volume']).toEqual(['strength']);
    expect(WIDGET_PILLARS['running-week']).toEqual(['running']);
  });
});

// ---------------------------------------------------------------------------
// defaultDashboardLayout
// ---------------------------------------------------------------------------
describe('defaultDashboardLayout', () => {
  it('renvoie 7 widgets, ordre canonique, visibles, taille full', () => {
    const layout = defaultDashboardLayout();
    expect(layout.widgets).toHaveLength(7);
    layout.widgets.forEach((w, i) => {
      expect(w.id).toBe(DASHBOARD_WIDGET_IDS[i]);
      expect(w.order).toBe(i);
      expect(w.visible).toBe(true);
      expect(w.size).toBe('full');
    });
  });

  it('est immuable entre deux appels (nouvelle instance)', () => {
    const a = defaultDashboardLayout();
    const b = defaultDashboardLayout();
    expect(a).not.toBe(b);
    expect(a.widgets).not.toBe(b.widgets);
  });
});

// ---------------------------------------------------------------------------
// resolveDashboardLayout
// ---------------------------------------------------------------------------
describe('resolveDashboardLayout', () => {
  const allPillars = ['strength', 'running', 'nutrition'] as const;

  it('(a) stored=null → défaut filtré par piliers (tous actifs → 7)', () => {
    const resolved = resolveDashboardLayout(null, [...allPillars]);
    expect(resolved.widgets.map((w) => w.id)).toEqual([...DASHBOARD_WIDGET_IDS]);
  });

  it('(a bis) stored=null, seul nutrition actif → nutrition + streak (always)', () => {
    const resolved = resolveDashboardLayout(null, ['nutrition']);
    expect(resolved.widgets.map((w) => w.id)).toEqual([
      'nutrition-summary',
      'streak',
      'weight',
    ]);
  });

  it('(b) widget connu absent du stored → ajouté en fin, visible/full', () => {
    const stored: DashboardLayout = {
      widgets: [
        { id: 'streak', visible: true, order: 0, size: 'full' },
        { id: 'weight', visible: false, order: 1, size: 'compact' },
      ],
    };
    const resolved = resolveDashboardLayout(stored, [...allPillars]);
    const ids = resolved.widgets.map((w) => w.id);
    // streak + weight en tête (ordre stored), puis les 5 nouveaux en fin
    expect(ids.slice(0, 2)).toEqual(['streak', 'weight']);
    expect(ids).toHaveLength(7);
    // le nouveau today-session ajouté est visible/full
    const today = resolved.widgets.find((w) => w.id === 'today-session')!;
    expect(today.visible).toBe(true);
    expect(today.size).toBe('full');
    // ordre recompacté 0..n-1
    expect(resolved.widgets.map((w) => w.order)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('(c) filtre piliers : widget d’un pilier inactif absent ; always jamais filtré', () => {
    const resolved = resolveDashboardLayout(null, ['strength']);
    const ids = resolved.widgets.map((w) => w.id);
    expect(ids).toContain('today-session'); // strength
    expect(ids).toContain('muscle-volume'); // strength
    expect(ids).toContain('record-recent'); // strength||running
    expect(ids).toContain('streak'); // always
    expect(ids).not.toContain('nutrition-summary'); // nutrition inactif
    expect(ids).not.toContain('weight'); // nutrition inactif
    expect(ids).not.toContain('running-week'); // running inactif
  });

  it('(c bis) always jamais filtré même si aucun pilier actif', () => {
    const resolved = resolveDashboardLayout(null, []);
    expect(resolved.widgets.map((w) => w.id)).toEqual(['streak']);
  });

  it('(d) ID inconnu du stored ignoré sans planter', () => {
    const stored = {
      widgets: [
        { id: 'streak', visible: true, order: 0, size: 'full' },
        { id: 'widget-fantome', visible: true, order: 1, size: 'full' },
      ],
    } as unknown as DashboardLayout;
    const resolved = resolveDashboardLayout(stored, [...allPillars]);
    expect(resolved.widgets.map((w) => w.id)).not.toContain('widget-fantome');
    expect(resolved.widgets).toHaveLength(7);
  });

  it('(e) tri par order (stored désordonné)', () => {
    const stored: DashboardLayout = {
      widgets: [
        { id: 'streak', visible: true, order: 5, size: 'full' },
        { id: 'weight', visible: true, order: 2, size: 'full' },
        { id: 'today-session', visible: true, order: 0, size: 'full' },
      ],
    };
    const resolved = resolveDashboardLayout(stored, [...allPillars]);
    // les 3 connus triés par order en tête : today-session(0), weight(2), streak(5)
    expect(resolved.widgets.slice(0, 3).map((w) => w.id)).toEqual([
      'today-session',
      'weight',
      'streak',
    ]);
  });

  it('(f) visible:false conservé, y compris pour always (streak)', () => {
    const stored: DashboardLayout = {
      widgets: [{ id: 'streak', visible: false, order: 0, size: 'full' }],
    };
    const resolved = resolveDashboardLayout(stored, [...allPillars]);
    const streak = resolved.widgets.find((w) => w.id === 'streak')!;
    expect(streak.visible).toBe(false);
  });

  it('(f bis) size stockée conservée', () => {
    const stored: DashboardLayout = {
      widgets: [{ id: 'streak', visible: true, order: 0, size: 'compact' }],
    };
    const resolved = resolveDashboardLayout(stored, [...allPillars]);
    expect(resolved.widgets.find((w) => w.id === 'streak')!.size).toBe('compact');
  });

  it('recompacte toujours order en 0..n-1 après filtrage', () => {
    const resolved = resolveDashboardLayout(null, ['strength']);
    expect(resolved.widgets.map((w) => w.order)).toEqual(
      resolved.widgets.map((_, i) => i),
    );
  });
});

// ---------------------------------------------------------------------------
// moveWidget
// ---------------------------------------------------------------------------
describe('moveWidget', () => {
  const base: DashboardLayout = defaultDashboardLayout();

  it('déplace un widget vers un index cible et recompacte les order', () => {
    const next = moveWidget(base, 'streak', 0);
    expect(next.widgets[0]!.id).toBe('streak');
    expect(next.widgets.map((w) => w.order)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(next.widgets).toHaveLength(7);
  });

  it('est pur / immuable (n’altère pas l’entrée)', () => {
    const snapshot = JSON.stringify(base);
    moveWidget(base, 'weight', 6);
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it('déplacer vers la fin place le widget en dernier', () => {
    const next = moveWidget(base, 'today-session', 6);
    expect(next.widgets[6]!.id).toBe('today-session');
  });

  it('id inconnu → layout inchangé (recompacté)', () => {
    const next = moveWidget(base, 'inconnu' as never, 0);
    expect(next.widgets.map((w) => w.id)).toEqual(base.widgets.map((w) => w.id));
  });

  it('borne l’index cible dans [0, n-1]', () => {
    const next = moveWidget(base, 'today-session', 99);
    expect(next.widgets[next.widgets.length - 1]!.id).toBe('today-session');
    const next2 = moveWidget(base, 'streak', -5);
    expect(next2.widgets[0]!.id).toBe('streak');
  });
});

// ---------------------------------------------------------------------------
// parseDashboardLayout — tolérant
// ---------------------------------------------------------------------------
describe('parseDashboardLayout', () => {
  it('null / undefined → null', () => {
    expect(parseDashboardLayout(null)).toBeNull();
    expect(parseDashboardLayout(undefined)).toBeNull();
  });

  it('objet invalide (pas de widgets tableau) → null', () => {
    expect(parseDashboardLayout({})).toBeNull();
    expect(parseDashboardLayout({ widgets: 'nope' })).toBeNull();
    expect(parseDashboardLayout(42)).toBeNull();
  });

  it('accepte un objet layout valide et normalise les entrées', () => {
    const raw = {
      widgets: [
        { id: 'streak', visible: false, order: 3, size: 'compact' },
        { id: 'weight', visible: true, order: 1, size: 'full' },
      ],
    };
    const parsed = parseDashboardLayout(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.widgets).toHaveLength(2);
  });

  it('ignore les entrées malformées mais garde les entrées valides', () => {
    const raw = {
      widgets: [
        { id: 'streak', visible: true, order: 0, size: 'full' },
        { nope: true },
        null,
        { id: 42, visible: true, order: 1, size: 'full' },
      ],
    };
    const parsed = parseDashboardLayout(raw);
    expect(parsed!.widgets.map((w) => w.id)).toEqual(['streak']);
  });

  it('tolère une chaîne JSON', () => {
    const parsed = parseDashboardLayout(
      JSON.stringify({ widgets: [{ id: 'streak', visible: true, order: 0, size: 'full' }] }),
    );
    expect(parsed!.widgets[0]!.id).toBe('streak');
  });

  it('JSON invalide → null', () => {
    expect(parseDashboardLayout('{bad json')).toBeNull();
  });
});
