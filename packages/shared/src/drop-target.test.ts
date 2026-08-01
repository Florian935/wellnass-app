import { describe, expect, it } from 'vitest';
import { findDropTarget, type DropZone } from './drop-target';

const ZONES: DropZone[] = [
  { dateKey: '2026-08-03', y: 0, height: 80 },
  { dateKey: '2026-08-04', y: 80, height: 80 },
  { dateKey: '2026-08-05', y: 160, height: 80 },
];

describe('findDropTarget', () => {
  it('y au milieu d’une zone → cette zone', () => {
    expect(findDropTarget(100, ZONES)).toBe('2026-08-04');
  });

  it('y exactement sur la borne basse d’une zone → cette zone (pas la précédente)', () => {
    expect(findDropTarget(80, ZONES)).toBe('2026-08-04');
  });

  it('y juste avant la borne basse → la zone précédente', () => {
    expect(findDropTarget(79, ZONES)).toBe('2026-08-03');
  });

  it('y au-dessus de la première zone → hors-zone (null)', () => {
    expect(findDropTarget(-10, ZONES)).toBeNull();
  });

  it('y en dessous de la dernière zone → hors-zone (null)', () => {
    expect(findDropTarget(500, ZONES)).toBeNull();
  });

  it('aucune zone fournie → null', () => {
    expect(findDropTarget(50, [])).toBeNull();
  });

  it('première et dernière zone testées correctement (pas seulement l’entre-deux)', () => {
    expect(findDropTarget(0, ZONES)).toBe('2026-08-03');
    expect(findDropTarget(200, ZONES)).toBe('2026-08-05');
  });
});
