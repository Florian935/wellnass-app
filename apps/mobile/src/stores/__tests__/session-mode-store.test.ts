import { useSessionMode } from '../session-mode-store';
import { useImmersivePrefs, DEFAULT_IMMERSIVE_PREFS, parseImmersivePrefs } from '../immersive-prefs-store';
import { secureStorage } from '@/lib/secure-storage';

jest.mock('@/lib/secure-storage', () => ({
  secureStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

const storage = secureStorage as jest.Mocked<typeof secureStorage>;

describe('session-mode-store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.getItem.mockResolvedValue(null);
    useSessionMode.setState({ mode: 'classic', chosen: false, hydrated: false });
  });

  it('démarre en classique — personne ne voit son écran changer sans l’avoir demandé', () => {
    expect(useSessionMode.getState().mode).toBe('classic');
    expect(useSessionMode.getState().chosen).toBe(false);
  });

  it('hydrate le mode immersif et le choix déjà fait', async () => {
    storage.getItem.mockImplementation(async (key: string) =>
      key === 'workout_display_mode' ? 'immersive' : 'true',
    );
    await useSessionMode.getState().hydrate();
    expect(useSessionMode.getState().mode).toBe('immersive');
    expect(useSessionMode.getState().chosen).toBe(true);
  });

  it('retombe sur classique devant une valeur illisible', async () => {
    storage.getItem.mockResolvedValue('cinéma');
    await useSessionMode.getState().hydrate();
    expect(useSessionMode.getState().mode).toBe('classic');
  });

  it('retient le choix par défaut, et sait ne pas le retenir', () => {
    useSessionMode.getState().setMode('immersive');
    expect(useSessionMode.getState().chosen).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith('workout_display_mode', 'immersive');
    expect(storage.setItem).toHaveBeenCalledWith('workout_mode_chosen', 'true');

    jest.clearAllMocks();
    useSessionMode.setState({ mode: 'classic', chosen: false, hydrated: true });
    useSessionMode.getState().setMode('immersive', { remember: false });
    expect(useSessionMode.getState().mode).toBe('immersive');
    expect(useSessionMode.getState().chosen).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalledWith('workout_mode_chosen', 'true');
  });
});

describe('immersive-prefs-store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.getItem.mockResolvedValue(null);
    useImmersivePrefs.setState({ ...DEFAULT_IMMERSIVE_PREFS, hydrated: false });
  });

  it('active toutes les mécaniques par défaut, sauf la notification en classique', () => {
    expect(DEFAULT_IMMERSIVE_PREFS.tempo).toBe(true);
    expect(DEFAULT_IMMERSIVE_PREFS.ghost).toBe(true);
    expect(DEFAULT_IMMERSIVE_PREFS.restNotificationImmersive).toBe(true);
    expect(DEFAULT_IMMERSIVE_PREFS.restNotificationClassic).toBe(false);
  });

  it('relit un objet partiel sans perdre les défauts', () => {
    const prefs = parseImmersivePrefs(JSON.stringify({ coach: 'sobre', ghost: false }));
    expect(prefs.coach).toBe('sobre');
    expect(prefs.ghost).toBe(false);
    expect(prefs.tempo).toBe(true);
    expect(prefs.barKg).toBe(DEFAULT_IMMERSIVE_PREFS.barKg);
  });

  it('ignore un JSON corrompu, un type inattendu et une barre fantaisiste', () => {
    expect(parseImmersivePrefs('{oups')).toEqual(DEFAULT_IMMERSIVE_PREFS);
    expect(parseImmersivePrefs(JSON.stringify({ tempo: 'oui', barKg: 17.5 }))).toEqual(DEFAULT_IMMERSIVE_PREFS);
  });

  it('persiste l’objet complet à chaque changement', async () => {
    useImmersivePrefs.getState().update({ coach: 'muet' });
    expect(useImmersivePrefs.getState().coach).toBe('muet');
    await Promise.resolve();
    const [key, value] = storage.setItem.mock.calls[0] ?? [];
    expect(key).toBe('immersive_prefs');
    expect(JSON.parse(String(value)).coach).toBe('muet');
    expect(JSON.parse(String(value))).not.toHaveProperty('hydrate');
  });
});
