import { describe, expect, it } from 'vitest';
import {
  contentSyncFieldsSchema,
  syncFieldsSchema,
  utcTimestampSchema,
  uuidSchema,
} from './sync';

const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

describe('uuidSchema', () => {
  it('accepte un UUID valide', () => {
    expect(uuidSchema.parse(UUID)).toBe(UUID);
  });

  it('rejette une chaîne qui n’est pas un UUID', () => {
    expect(uuidSchema.safeParse('pas-un-uuid').success).toBe(false);
  });
});

describe('utcTimestampSchema', () => {
  it('accepte un ISO 8601 en UTC (suffixe Z)', () => {
    expect(utcTimestampSchema.parse('2026-07-05T10:30:00.000Z')).toBe('2026-07-05T10:30:00.000Z');
  });

  it('rejette un timestamp avec décalage de fuseau', () => {
    expect(utcTimestampSchema.safeParse('2026-07-05T10:30:00+02:00').success).toBe(false);
  });
});

describe('syncFieldsSchema', () => {
  const base = {
    id: UUID,
    userId: UUID,
    createdAt: '2026-07-05T10:30:00.000Z',
    updatedAt: '2026-07-05T10:30:00.000Z',
    deletedAt: null,
  };

  it('valide une entité synchronisée complète', () => {
    expect(syncFieldsSchema.parse(base)).toEqual(base);
  });

  it('accepte un deletedAt non nul (soft delete)', () => {
    const deleted = { ...base, deletedAt: '2026-07-06T08:00:00.000Z' };
    expect(syncFieldsSchema.parse(deleted).deletedAt).toBe('2026-07-06T08:00:00.000Z');
  });

  it('exige userId', () => {
    const { userId: _userId, ...withoutUser } = base;
    expect(syncFieldsSchema.safeParse(withoutUser).success).toBe(false);
  });
});

describe('contentSyncFieldsSchema', () => {
  it('n’exige pas userId (contenu global en lecture seule)', () => {
    const content = {
      id: UUID,
      createdAt: '2026-07-05T10:30:00.000Z',
      updatedAt: '2026-07-05T10:30:00.000Z',
      deletedAt: null,
    };
    const parsed = contentSyncFieldsSchema.parse(content);
    expect(parsed).not.toHaveProperty('userId');
    expect(parsed.id).toBe(UUID);
  });
});
