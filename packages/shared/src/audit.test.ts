import { describe, expect, it } from 'vitest';
import { AUDIT_ACTIONS, auditActionLabelKey, auditEntrySchema } from './audit';

describe('audit', () => {
  it('accepte une entrée minimale', () => {
    const r = auditEntrySchema.safeParse({ action: 'food.import' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.details).toEqual({});
  });
  it('accepte une entrée complète', () => {
    const r = auditEntrySchema.safeParse({
      action: 'role.grant', targetTable: 'user_roles',
      targetId: '00000000-0000-0000-0000-000000000001',
      targetLabel: 'moderator → 42', details: { role: 'moderator', targetUserId: '42' },
    });
    expect(r.success).toBe(true);
  });
  it('rejette une action hors union', () => {
    expect(auditEntrySchema.safeParse({ action: 'food.delete' }).success).toBe(false);
  });
  it('rejette un targetId non-uuid', () => {
    expect(auditEntrySchema.safeParse({ action: 'food.archive', targetId: 'nope' }).success).toBe(false);
  });
  it('auditActionLabelKey renvoie une clé pour CHAQUE action (complétude)', () => {
    for (const a of AUDIT_ACTIONS) expect(auditActionLabelKey(a)).toMatch(/^audit\.action\./);
    expect(new Set(AUDIT_ACTIONS).size).toBe(AUDIT_ACTIONS.length); // pas de doublon
  });
});
