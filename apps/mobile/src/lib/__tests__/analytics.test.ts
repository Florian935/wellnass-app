import { sanitizeProps, buildEventRow, track } from '../analytics';
import { insertAnalyticsEvent } from '@/data/repositories/analytics-repository';
import { getAnalyticsEnabled } from '@/data/repositories/settings-repository';
import { useAuthStore } from '@/stores/auth-store';

jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.0.0' }));

jest.mock('@/data/repositories/analytics-repository', () => ({
  insertAnalyticsEvent: jest.fn(async () => undefined),
}));

jest.mock('@/data/repositories/settings-repository', () => ({
  getAnalyticsEnabled: jest.fn(async () => true),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: jest.fn(() => ({ session: { user: { id: 'user-1' } } })) },
}));

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

// ---------------------------------------------------------------------------
// track — gating (consentement, session) et garantie « ne jette jamais »
// ---------------------------------------------------------------------------
describe('track', () => {
  const insertMock = insertAnalyticsEvent as jest.Mock;
  const enabledMock = getAnalyticsEnabled as jest.Mock;
  const getStateMock = useAuthStore.getState as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    insertMock.mockResolvedValue(undefined);
    enabledMock.mockResolvedValue(true);
    getStateMock.mockReturnValue({ session: { user: { id: 'user-1' } } });
  });

  it('écrit l’événement quand une session existe et le consentement est ON', async () => {
    await track('app_opened');
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      event_name: 'app_opened',
    }));
  });

  it('no-op si le consentement est OFF (aucune écriture)', async () => {
    enabledMock.mockResolvedValue(false);
    await track('app_opened');
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('no-op si aucune session (déconnecté) — ne consulte même pas le consentement', async () => {
    getStateMock.mockReturnValue({ session: null });
    await track('app_opened');
    expect(insertMock).not.toHaveBeenCalled();
    expect(enabledMock).not.toHaveBeenCalled();
  });

  it('ne jette JAMAIS, même si l’écriture échoue (best-effort, US 9.10)', async () => {
    insertMock.mockRejectedValue(new Error('offline'));
    await expect(track('app_opened')).resolves.toBeUndefined();
  });
});
