import { describe, expect, it } from 'vitest';
import { localDayKey } from './date';

describe('localDayKey', () => {
  it("formate une Date en AAAA-MM-JJ selon l'heure locale", () => {
    expect(localDayKey(new Date(2026, 6, 11, 23, 30))).toBe('2026-07-11');
    expect(localDayKey(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });
});
