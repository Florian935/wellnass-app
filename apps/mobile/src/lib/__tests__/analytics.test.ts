import { sanitizeProps, buildEventRow } from '../analytics';

describe('sanitizeProps', () => {
  it('ne garde que les clés autorisées et scalaires', () => {
    expect(sanitizeProps({ pillar: 'strength', weight: 82, note: 'secret', nested: { a: 1 } })).toEqual(
      { pillar: 'strength' },
    ); // weight/note/nested écartés (hors allowlist)
  });
  it('sans props → objet vide', () => {
    expect(sanitizeProps(undefined)).toEqual({});
  });
});

describe('buildEventRow', () => {
  it('assemble une ligne déterministe (properties sérialisé, PII écartée)', () => {
    const row = buildEventRow({
      id: 'e1',
      userId: 'u1',
      eventName: 'workout_completed',
      props: { pillar: 'strength', weightKg: 90 },
      appVersion: '1.0.0',
      platform: 'android',
      occurredAt: '2026-07-24T10:00:00.000Z',
    });
    expect(row).toEqual({
      id: 'e1',
      user_id: 'u1',
      event_name: 'workout_completed',
      properties: '{"pillar":"strength"}',
      app_version: '1.0.0',
      platform: 'android',
      occurred_at: '2026-07-24T10:00:00.000Z',
      created_at: '2026-07-24T10:00:00.000Z',
    });
  });
});
