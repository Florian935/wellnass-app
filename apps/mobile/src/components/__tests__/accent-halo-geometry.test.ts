/**
 * Géométrie du cercle d'accent, dérivée de l'identité du widget.
 *
 * Ce que ces tests protègent, et pourquoi ça mérite un test alors que c'est décoratif :
 *
 *  1. **déterminisme** — un widget doit garder son coin d'un lancement à l'autre. Une
 *     implémentation à base de `Math.random()` passerait l'œil en revue mais ferait sauter
 *     les halos à chaque re-render ;
 *  2. **dispersion** — c'est tout l'intérêt de la fonctionnalité : si les ids réels d'un même
 *     écran tombaient tous dans le même coin, on aurait réintroduit le motif régulier que la
 *     variation par widget doit casser.
 */
import { geometryFromId, hasHaloFor } from '../AccentHalo';

// Ids réels des widgets du tableau de bord (`HOME_WIDGET_IDS` de `@wellness/shared`).
const DASHBOARD_IDS = [
  'today-session',
  'nutrition-summary',
  'streak',
  'weight',
  'record-recent',
  'muscle-volume',
  'running-week',
  'deficit-volume',
  'training-time',
  'steps',
  'wellbeing',
  'goals',
  'review',
];

describe('geometryFromId', () => {
  it('est déterministe : même id → même géométrie', () => {
    for (const id of DASHBOARD_IDS) {
      expect(geometryFromId(id)).toEqual(geometryFromId(id));
    }
  });

  it('ne renvoie que des coins et des facteurs du répertoire', () => {
    const corners = ['top-right', 'top-left', 'bottom-right', 'bottom-left'];
    const scales = [0.85, 1, 1.15, 1.3];
    for (const id of DASHBOARD_IDS) {
      const g = geometryFromId(id);
      expect(corners).toContain(g.corner);
      expect(scales).toContain(g.scale);
    }
  });

  it('disperse les widgets du dashboard sur au moins 3 coins', () => {
    const used = new Set(DASHBOARD_IDS.map((id) => geometryFromId(id).corner));
    expect(used.size).toBeGreaterThanOrEqual(3);
  });

  it('fait varier aussi la taille, pas seulement le coin', () => {
    const used = new Set(DASHBOARD_IDS.map((id) => geometryFromId(id).scale));
    expect(used.size).toBeGreaterThanOrEqual(2);
  });

  it('distingue deux ids proches', () => {
    // Le hachage doit réagir à un caractère près, sinon les widgets d'une même famille
    // (`run-week`, `run-weeks`…) se retrouveraient tous au même endroit.
    expect(geometryFromId('run-week')).not.toEqual(geometryFromId('run-weeks'));
  });
});

describe('hasHaloFor', () => {
  it('est déterministe', () => {
    for (const id of DASHBOARD_IDS) {
      expect(hasHaloFor(id)).toBe(hasHaloFor(id));
    }
  });

  it('n’en pose que sur une minorité de widgets', () => {
    // Tout l'intérêt de l'ornement : s'il est sur chaque carte, il n'accentue plus rien.
    // On veut « quelques-unes », pas « toutes » — et pas zéro non plus.
    const withHalo = DASHBOARD_IDS.filter(hasHaloFor);
    expect(withHalo.length).toBeGreaterThanOrEqual(1);
    expect(withHalo.length).toBeLessThanOrEqual(Math.ceil(DASHBOARD_IDS.length / 2));
  });

  it('ne corrèle pas la présence à la géométrie', () => {
    // Présence et coin sortent de deux tranches différentes du hachage. Si elles étaient
    // corrélées, tous les halos visibles atterriraient dans le même coin.
    const corners = new Set(DASHBOARD_IDS.filter(hasHaloFor).map((id) => geometryFromId(id).corner));
    expect(corners.size).toBeGreaterThanOrEqual(2);
  });
});
