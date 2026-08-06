import { describe, expect, it } from 'vitest';
import {
  HOME_WIDGET_IDS,
  MAX_HOME_WIDGETS,
  WIDGET_SCREENS,
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
  compactLayout,
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
  it('accueil 7, muscu 7, course 4 ; gardes pilier', () => {
    // 7 depuis INSIGHTS-02 (05/08/2026), contre **21** la veille — 3,5x le plafond d'ADR-007 §2.
    // **8 depuis VIE-01** (le meme jour) : le cliquet a casse la CI et force l'arbitrage, voir le
    // commentaire de `MAX_HOME_WIDGETS`. Les 4 premiers sont permanents ; parmi les 4 derniers,
    // `insights` / `activation-path` / `cycle` ne s'affichent jamais tous ensemble par defaut, donc
    // le compte **visible** typique est de 5 a 6 — dans la fourchette de l'ADR.
    expect(HOME_WIDGET_IDS).toHaveLength(8);
    // Les hubs **gagnent** ce que l accueil perd : INSIGHTS-02 y a cree les destinations de
    // `record-recent` et `training-time`, qui n en avaient aucune de valable.
    expect(STRENGTH_WIDGET_IDS).toHaveLength(7);
    expect(RUNNING_WIDGET_IDS).toHaveLength(4);
    expect(WIDGET_REGISTRY.home.pillars['streak']).toBe('always');
    expect(WIDGET_REGISTRY.home.pillars['today-session']).toEqual(['strength']);
    expect(WIDGET_REGISTRY.strength.pillars['strength-programs']).toEqual(['strength']);
  });

  it('ne depasse pas le plafond Tier 0 d ADR-007 §2', () => {
    // Un plafond ecrit dans un ADR que personne ne relit s'est fait depasser de 350 %. Celui-ci
    // casse la CI. Le depasser reste **possible** — il faut modifier cette ligne, donc en faire un
    // arbitrage conscient : c'est exactement ce que l'ADR demandait depuis le 16/07/2026.
    expect(HOME_WIDGET_IDS.length).toBeLessThanOrEqual(MAX_HOME_WIDGETS);
  });

  it('declare une garde ET une taille pour chaque widget des TROIS hubs', () => {
    // Portait d'abord sur le seul accueil — et n'a donc pas vu que les 3 destinations creees par
    // INSIGHTS-02 sur les hubs muscu/course n'avaient aucune taille declaree. Trouve en revue.
    // Un id sans garde s'affiche a tout le monde par accident ; un id sans taille retombe sur
    // 'wide' via defaultSizeOf, donc rend **correctement par hasard** — plus insidieux encore.
    for (const screen of WIDGET_SCREENS) {
      for (const id of WIDGET_REGISTRY[screen].ids) {
        expect(WIDGET_REGISTRY[screen].pillars[id]).toBeDefined();
        expect(WIDGET_REGISTRY[screen].defaultSize[id]).toBeDefined();
      }
    }
  });

  it('n a plus aucune garde a 3 piliers', () => {
    expect(
      Object.values(WIDGET_REGISTRY.home.pillars).filter(
        (guard) => Array.isArray(guard) && guard.length === 3,
      ),
    ).toHaveLength(0);
  });

  it('garde le cycle (CYCLE-01) par un REGLAGE — ni pilier, ni « always »', () => {
    // La 3e forme de garde, ajoutee pour ce cas precis : le cycle n'appartient a aucun pilier
    // (donc pas de liste) mais ne doit pas s'afficher pour tout le monde (donc pas 'always').
    expect(WIDGET_REGISTRY.home.pillars['cycle']).toEqual({ setting: 'cycleTrackingEnabled' });
  });

  it('garde les pas (PAS-01) en transverse — la marche n appartient a aucun pilier', () => {
    // Conserve par INSIGHTS-02 alors que la plupart de ses voisins partaient : c'est du live du
    // jour, **et** son widget est le seul point d'entree de /steps.
    expect(WIDGET_REGISTRY.home.pillars['steps']).toBe('always');
  });

  it('a retire du registre les 14 widgets deplaces par INSIGHTS-02', () => {
    // Leur garde partait avec eux : en laisser une derriere serait du code mort trompeur.
    const retires = [
      'weight', 'record-recent', 'muscle-volume', 'running-week', 'deficit-volume',
      'training-time', 'wellbeing', 'goals', 'review', 'training-load',
      'overtraining-guard', 'readiness', 'activity-level-suggestion',
      'concurrent-training-interference',
    ];
    for (const id of retires) {
      expect(HOME_WIDGET_IDS as readonly string[]).not.toContain(id);
      expect(WIDGET_REGISTRY.home.pillars[id]).toBeUndefined();
    }
  });

  it('load-streak-alert (MR-14) n est plus dans le registre — fusionne par GARDE-01', () => {
    expect(HOME_WIDGET_IDS as readonly string[]).not.toContain('load-streak-alert');
    expect(WIDGET_REGISTRY.home.pillars['load-streak-alert']).toBeUndefined();
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
    // 8 depuis VIE-01 : `defaultScreenLayout` part du registre **sans filtrer** — c'est
    // `resolveScreenLayout` qui applique les gardes. Le widget `cycle` est donc présent ici,
    // masqué là-bas.
    expect(layout.widgets).toHaveLength(8);
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
    // 7 depuis VIE-01 (8 déclarés moins `cycle`, masqué faute d'opt-in).
    expect(r.widgets).toHaveLength(7);
    assertNoOverlap(r.widgets);
  });

  it('compacte le layout stocké : aucun chevauchement ni ligne vide', () => {
    const stored: ScreenLayout = {
      widgets: [
        { id: 'streak', visible: true, size: 'small', col: 1, row: 3 },
        { id: 'steps', visible: true, size: 'small', col: 0, row: 5 },
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
    // INSIGHTS-02 : `wellbeing` a quitté l'accueil ; `insights` est le nouveau venu que la
    // forward-compat doit ajouter à un layout qui ne le connaît pas.
    expect(r.widgets.map((w) => w.id)).toContain('insights');
    assertNoOverlap(r.widgets);
  });

  // -------------------------------------------------------------------------
  // US CYCLE-01 — garde par réglage (3ᵉ forme de `WidgetGuard`)
  // -------------------------------------------------------------------------

  it('masque `cycle` quand le drapeau est absent — l’absence ne vaut jamais consentement', () => {
    const r = resolveScreenLayout(null, 'home', [...all]);
    expect(r.widgets.map((w) => w.id)).not.toContain('cycle');
    // Et le hub garde donc exactement ses autres widgets (hors `cycle`).
    expect(r.widgets).toHaveLength(7);
  });

  it('masque `cycle` quand le drapeau est explicitement faux', () => {
    const r = resolveScreenLayout(null, 'home', [...all], { cycleTrackingEnabled: false });
    expect(r.widgets.map((w) => w.id)).not.toContain('cycle');
  });

  it('affiche `cycle` quand le suivi est activé, sans chevauchement', () => {
    const r = resolveScreenLayout(null, 'home', [...all], { cycleTrackingEnabled: true });
    expect(r.widgets.map((w) => w.id)).toContain('cycle');
    expect(r.widgets).toHaveLength(8);
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

  it('GARDE-01 — un layout stocké mentionnant `load-streak-alert` se résout sans trou ni doublon', () => {
    // Preuve concrète de la promesse « aucune migration » de D1 : l'utilisateur qui aurait rangé le
    // widget MR-14 dans son dashboard avant la fusion ne doit ni voir une cellule vide, ni perdre
    // ses autres widgets. `resolveScreenLayout` ignore l'id inconnu via son filtre `known.has`.
    // Layout **complet** (les 21 widgets du registre, positionnés), + l'id retiré inséré au milieu :
    // c'est le cas réel d'un utilisateur qui avait personnalisé son dashboard avant la fusion. Un
    // layout de 3 entrées ne prouverait pas grand-chose (le first-fit a trop de place libre).
    const full = defaultScreenLayout('home').widgets;
    const stored: ScreenLayout = {
      widgets: [
        ...full.slice(0, 4),
        { id: 'load-streak-alert' as WidgetLayoutEntry['id'], visible: true, size: 'wide', col: 0, row: 99 },
        ...full.slice(4),
      ],
    };
    const r = resolveScreenLayout(stored, 'home', [...all]);
    const ids = r.widgets.map((w) => w.id);

    expect(ids).not.toContain('load-streak-alert');
    // Rien n'a été perdu au passage : on retrouve
    // exactement les widgets autorisés du registre, ni un de plus (doublon) ni un de moins.
    expect(ids).toContain('insights');
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(
      resolveScreenLayout(null, 'home', [...all]).widgets.length,
    );
    assertNoOverlap(r.widgets);
    assertNoEmptyRow(r.widgets);
  });

  it('garde les transverses visibles pour un utilisateur « nutrition seule »', () => {
    // `streak`, `steps` et `insights` sont transverses : jamais filtrés par `active_pillars`.
    // (`wellbeing` l'était aussi jusqu'à INSIGHTS-02, qui l'a déplacé vers Réglages › Suivi.)
    const r = resolveScreenLayout(null, 'home', ['nutrition']);
    const ids = r.widgets.map((w) => w.id);

    expect(ids).toContain('streak');
    expect(ids).toContain('steps');
    expect(ids).toContain('insights');
    // Contrôle négatif : les widgets gardés par un pilier inactif, eux, disparaissent bien.
    expect(ids).not.toContain('today-session');
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
        { id: 'steps', visible: true, order: 2, size: 'compact' },
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
        { id: 'steps', visible: true, size: 'small', col: 1, row: 0 },
        { id: 'today-session', visible: true, size: 'wide', col: 0, row: 1 },
      ],
    };
    // Déplace weight sous streak (col 0, row 1) → collision avec today-session (wide) → poussée.
    const r = moveWidgetToCell(base, 'steps', 0, 1);
    const steps = r.widgets.find((w) => w.id === 'steps')!;
    expect({ col: steps.col, row: steps.row }).toEqual({ col: 0, row: 1 });
    assertNoOverlap(r.widgets);
    // today-session (wide) a été poussé sous steps.
    expect(r.widgets.find((w) => w.id === 'today-session')!.row).toBeGreaterThanOrEqual(2);
  });

  it('deux petits carrés empilés dans la même colonne', () => {
    const base: ScreenLayout = {
      widgets: [
        { id: 'streak', visible: true, size: 'small', col: 0, row: 0 },
        { id: 'steps', visible: true, size: 'small', col: 1, row: 0 },
      ],
    };
    const r = moveWidgetToCell(base, 'steps', 0, 1); // col 0, sous streak
    const steps = r.widgets.find((w) => w.id === 'steps')!;
    expect({ col: steps.col, row: steps.row }).toEqual({ col: 0, row: 1 });
    assertNoOverlap(r.widgets); // colonne droite laissée vide (trou autorisé)
  });

  it('compaction : une ligne vide au-dessus est supprimée (remontée)', () => {
    const base: ScreenLayout = {
      widgets: [
        { id: 'streak', visible: true, size: 'wide', col: 0, row: 0 },
        { id: 'steps', visible: true, size: 'wide', col: 0, row: 2 }, // trou en ligne 1
      ],
    };
    const r = moveWidgetToCell(base, 'steps', 0, 2); // re-place → compaction
    expect(r.widgets.find((w) => w.id === 'steps')!.row).toBe(1); // remontée en ligne 1
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
        { id: 'steps', visible: true, size: 'large', col: 0, row: 2 },
      ]),
    ).toBe(4); // large en row 2, hauteur 2 → 4
  });
});

// ---------------------------------------------------------------------------
// compactLayout — compaction du sous-ensemble VISIBLE, à l'affichage
// ---------------------------------------------------------------------------
//
// Fonction publique qui n'était **appelée par aucun test** : c'est elle qui empêche un widget
// masqué de laisser un trou dans la grille (les positions stockées, elles, ne bougent pas). Un
// défaut ici se voit immédiatement à l'écran — et c'est exactement le symptôme qui a été corrigé
// le 03/08/2026 sur `training-load`/`overtraining-guard` (trou dans la grille quand la carte rend
// `null`).
describe('compactLayout', () => {
  it('remonte les widgets pour ne laisser aucune ligne vide', () => {
    const out = compactLayout([
      { id: 'streak', visible: true, size: 'small', col: 0, row: 0 },
      { id: 'steps', visible: true, size: 'small', col: 0, row: 5 },
    ]);
    expect(out.map((w) => [w.id, w.row])).toEqual([
      ['streak', 0],
      ['steps', 1],
    ]);
  });

  it('conserve les colonnes — la compaction est verticale, pas un réagencement', () => {
    const out = compactLayout([
      { id: 'streak', visible: true, size: 'small', col: 1, row: 3 },
      { id: 'steps', visible: true, size: 'small', col: 0, row: 7 },
    ]);
    expect(out.find((w) => w.id === 'streak')!.col).toBe(1);
    expect(out.find((w) => w.id === 'steps')!.col).toBe(0);
    // Deux colonnes distinctes → les deux peuvent tenir sur la première ligne.
    expect(out.every((w) => w.row === 0)).toBe(true);
  });

  it('ne modifie pas le tableau reçu (copie défensive)', () => {
    const input: WidgetLayoutEntry[] = [
      { id: 'streak', visible: true, size: 'small', col: 0, row: 4 },
    ];
    const out = compactLayout(input);
    expect(input[0]!.row).toBe(4);
    expect(out[0]!.row).toBe(0);
    expect(out[0]).not.toBe(input[0]);
  });

  it('accepte une disposition vide', () => {
    expect(compactLayout([])).toEqual([]);
  });

  it('résout un chevauchement en descendant le widget chevauché', () => {
    // Deux `wide` (pleine largeur) déclarés sur la même ligne : le second doit descendre.
    const out = compactLayout([
      { id: 'today-session', visible: true, size: 'wide', col: 0, row: 0 },
      { id: 'streak', visible: true, size: 'wide', col: 0, row: 0 },
    ]);
    expect(out.map((w) => w.row).sort()).toEqual([0, 1]);
  });
});

// Le comparateur de `compactVertical` privilégie le widget déplacé à ligne égale, dans les DEUX
// sens de comparaison. Le sens « le prioritaire est le second opérande » n'était jamais exercé :
// il faut que le widget déplacé apparaisse **après** son voisin dans le tableau.
describe('moveWidgetToCell — priorité du widget déplacé à ligne égale', () => {
  it('donne la ligne la plus haute au widget déplacé, même s’il est en fin de liste', () => {
    const base: ScreenLayout = {
      widgets: [
        { id: 'today-session', visible: true, size: 'wide', col: 0, row: 0 },
        // `streak` est APRÈS dans le tableau : c'est lui qu'on déplace sur la même ligne.
        { id: 'streak', visible: true, size: 'wide', col: 0, row: 1 },
      ],
    };
    const r = moveWidgetToCell(base, 'streak', 0, 0);

    // Le widget déplacé gagne le slot du haut ; l'autre est repoussé dessous.
    expect(r.widgets.find((w) => w.id === 'streak')!.row).toBe(0);
    expect(r.widgets.find((w) => w.id === 'today-session')!.row).toBe(1);
    assertNoOverlap(r.widgets);
  });

  it('id inconnu → disposition inchangée', () => {
    const base: ScreenLayout = {
      widgets: [{ id: 'streak', visible: true, size: 'small', col: 0, row: 3 }],
    };
    const r = moveWidgetToCell(base, 'steps', 0, 0);
    expect(r.widgets).toEqual(base.widgets);
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
