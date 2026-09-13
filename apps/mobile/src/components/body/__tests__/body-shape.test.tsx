import { fireEvent, render } from '@testing-library/react-native';
import type { BodyEmphasis, BodyShape, BodyShapeZone, BodyGoalZone } from '@wellness/shared';
import { BodyShapeFigure } from '../BodyShapeFigure';
import { createBodyShapeGeometry } from '../body-shape-geometry';

jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light', colors: { accent: '#b14f2b', text: '#33291f' } }) }));

const shape: BodyShape = { base: 'balanced', proportions: { shoulders: 0, chest: 0, waist: 0, hips: 0, arms: 0, thighs: 0, calves: 0 } };
const emphasis: BodyEmphasis = { shoulders: 0, chest: 0, back: 0, arms: 0, glutes: 0, thighs: 0, calves: 0 };
const zones = Object.keys(shape.proportions) as BodyShapeZone[];
const goals = Object.keys(emphasis) as BodyGoalZone[];

describe('géométrie corporelle continue', () => {
  test('les courbes de l’aisselle ne se croisent pas aux volumes combinés extrêmes', () => {
    const geo = createBodyShapeGeometry({ base: 'broad_shoulders', proportions: { ...shape.proportions, chest: 2, arms: 2 } }, { ...emphasis, chest: 4, arms: 4 });
    type Point = { x: number; y: number };
    const samples = (curve: typeof geo.curves[number]) => Array.from({ length: 201 }, (_, i) => {
      const u = i / 200; const v = 1 - u;
      return { x: v ** 3 * curve.from.x + 3 * v ** 2 * u * curve.c1.x + 3 * v * u ** 2 * curve.c2.x + u ** 3 * curve.to.x,
        y: v ** 3 * curve.from.y + 3 * v ** 2 * u * curve.c1.y + 3 * v * u ** 2 * curve.c2.y + u ** 3 * curve.to.y };
    });
    const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const arm = samples(geo.curves[17]!); const chest = samples(geo.curves[18]!);
    let crossings = 0;
    for (let i = 1; i < arm.length; i++) for (let j = 1; j < chest.length; j++) {
      const a = arm[i - 1]!; const b = arm[i]!; const c = chest[j - 1]!; const d = chest[j]!;
      if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) crossings++;
    }
    expect(crossings).toBe(0);
  });

  test.each(zones)('%s change réellement le contour dans les deux vues', (zone) => {
    for (const side of ['front', 'back'] as const) {
      const small = createBodyShapeGeometry({ ...shape, proportions: { ...shape.proportions, [zone]: -2 } }, undefined, side);
      const large = createBodyShapeGeometry({ ...shape, proportions: { ...shape.proportions, [zone]: 2 } }, undefined, side);
      expect(small.outline).not.toEqual(large.outline);
      expect(large.widths[zone]).toBeGreaterThan(small.widths[zone]);
    }
  });

  test.each(goals)('intention %s modifie le volume, conserve les hauteurs et la taille', (zone) => {
    for (const side of ['front', 'back'] as const) {
      const start = createBodyShapeGeometry(shape, emphasis, side);
      const goal = createBodyShapeGeometry(shape, { ...emphasis, [zone]: 4 }, side);
      expect(goal.outline).not.toEqual(start.outline);
      expect(goal.widths.waist).toBe(start.widths.waist);
      expect(goal.curves.map(c => [c.from.y, c.c1.y, c.c2.y, c.to.y])).toEqual(start.curves.map(c => [c.from.y, c.c1.y, c.c2.y, c.to.y]));
    }
  });

  test('les 3 bases et toutes les combinaisons extrêmes restent jointives, symétriques et dans le cadre', () => {
    for (const base of ['balanced', 'broad_shoulders', 'broad_hips'] as const) {
      for (let mask = 0; mask < 128; mask++) {
        const proportions = Object.fromEntries(zones.map((zone, i) => [zone, mask & (1 << i) ? 2 : -2])) as BodyShape['proportions'];
        const geo = createBodyShapeGeometry({ base, proportions }, Object.fromEntries(goals.map(z => [z, 4])) as BodyEmphasis, 'back');
        expect(geo.curves[0]!.from).toEqual(geo.curves.at(-1)!.to);
        const points = geo.curves.flatMap(curve => [curve.from, curve.c1, curve.c2, curve.to]);
        expect(points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x > 0 && p.x < 300 && p.y > 0 && p.y < 680)).toBe(true);
        const errors: number[] = [];
        for (let i = 0; i < geo.curves.length; i++) {
          const curve = geo.curves[i]!;
          const mirror = geo.curves[geo.curves.length - 1 - i]!;
          errors.push(Math.abs(curve.from.x + mirror.to.x - 300), Math.abs(curve.from.y - mirror.to.y));
          errors.push(Math.abs(curve.c1.x + mirror.c2.x - 300), Math.abs(curve.c1.y - mirror.c2.y));
          if (i) errors.push(Math.abs(curve.from.x - geo.curves[i - 1]!.to.x), Math.abs(curve.from.y - geo.curves[i - 1]!.to.y));
        }
        expect(Math.max(...errors)).toBeLessThan(0.00001);
      }
    }
  });

  test('les valeurs non finies sont neutralisées et les entrées débordantes bornées', () => {
    const broken = { ...shape, proportions: { ...shape.proportions, arms: Infinity, shoulders: 99 } };
    const safe = { ...shape, proportions: { ...shape.proportions, arms: 0, shoulders: 2 } };
    expect(createBodyShapeGeometry(broken).outline).toBe(createBodyShapeGeometry(safe).outline);
  });
});

describe('BodyShapeFigure', () => {
  test.each(['front', 'back'] as const)('les zones de départ et objectif transmettent le bon identifiant (%s)', async (side) => {
    const onSelect = jest.fn();
    const ui = await render(<BodyShapeFigure shape={shape} side={side} onSelect={onSelect} />);
    for (const zone of zones) {
      await fireEvent.press(ui.getAllByTestId(`shape-zone-${zone}`)[0]!);
      expect(onSelect).toHaveBeenLastCalledWith(zone);
    }
    await ui.rerender(<BodyShapeFigure shape={shape} side={side} mode="goal" onSelect={onSelect} />);
    for (const zone of goals) {
      await fireEvent.press(ui.getAllByTestId(`shape-zone-${zone}`)[0]!);
      expect(onSelect).toHaveBeenLastCalledWith(zone);
    }
    expect(ui.queryByTestId('shape-zone-waist')).toBeNull();
  });

  test('la comparaison utilise exactement le contour et le cadre, sans cible tactile', async () => {
    const ui = await render(<BodyShapeFigure shape={shape} side="front" height={420} onSelect={jest.fn()} />);
    const outline = ui.getByTestId('shape-outline').props.d;
    const frame = ui.getByTestId('body-shape-figure').props;
    await ui.rerender(<BodyShapeFigure shape={shape} side="front" height={420} outlineOnly onSelect={jest.fn()} />);
    expect(ui.getByTestId('shape-outline').props.d).toBe(outline);
    expect(ui.getByTestId('body-shape-figure').props.viewBox).toBe(frame.viewBox);
    expect(ui.getByTestId('body-shape-figure').props.width).toBe(frame.width);
    expect(ui.getByTestId('body-shape-figure').props.pointerEvents).toBe('none');
    expect(ui.queryByTestId('shape-zone-arms')).toBeNull();
  });
});
