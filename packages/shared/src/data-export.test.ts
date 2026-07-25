import { describe, expect, it } from 'vitest';
import { buildExportEnvelope, exportFileName } from './data-export';

describe('data export', () => {
  it('assemble l’enveloppe (en-tête + data)', () => {
    const env = buildExportEnvelope({
      userId: 'u1', exportedAt: '2026-07-23T10:00:00.000Z', syncComplete: true,
      tables: { workouts: [{ id: 'w1' }], runs: [] },
    });
    expect(env).toEqual({
      app: 'Wellness', formatVersion: 1, exportedAt: '2026-07-23T10:00:00.000Z',
      userId: 'u1', syncComplete: true, data: { workouts: [{ id: 'w1' }], runs: [] },
    });
  });
  it('nom de fichier daté', () => {
    // Date construite en LOCAL (pas d'ISO+Z) → robuste au fuseau du runner CI.
    expect(exportFileName(new Date(2026, 6, 23))).toBe('wellness-export-2026-07-23.json');
  });
});
