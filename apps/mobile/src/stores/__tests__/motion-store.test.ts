import { useMotionPreference } from '../motion-store';
import { secureStorage } from '@/lib/secure-storage';

jest.mock('@/lib/secure-storage', () => ({
  secureStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

const storage = secureStorage as jest.Mocked<typeof secureStorage>;

/** Réinitialise le store entre les tests (Zustand ne le fait pas tout seul). */
function resetStore() {
  useMotionPreference.setState({ enabled: true, hydrated: false });
}

describe('motion-store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.getItem.mockResolvedValue(null);
    resetStore();
  });

  it('démarre animations actives', () => {
    // Contrairement aux couleurs par menu (désactivées par défaut), le mouvement est le
    // comportement attendu d'une app : c'est son absence qui doit être un choix explicite.
    expect(useMotionPreference.getState().enabled).toBe(true);
  });

  it('hydrate à false quand la préférence a été coupée', async () => {
    storage.getItem.mockResolvedValue('false');
    await useMotionPreference.getState().hydrate();
    expect(useMotionPreference.getState().enabled).toBe(false);
    expect(useMotionPreference.getState().hydrated).toBe(true);
  });

  it('hydrate à true quand rien n’a jamais été stocké', async () => {
    await useMotionPreference.getState().hydrate();
    expect(useMotionPreference.getState().enabled).toBe(true);
  });

  it('retombe sur actif quand la valeur stockée est illisible', async () => {
    // Une préférence corrompue ne doit pas laisser l'app figée sans mouvement et sans explication :
    // le défaut est le comportement le moins surprenant.
    storage.getItem.mockResolvedValue('{ceci n’est pas du JSON');
    await useMotionPreference.getState().hydrate();
    expect(useMotionPreference.getState().enabled).toBe(true);
    expect(useMotionPreference.getState().hydrated).toBe(true);
  });

  it('n’hydrate qu’une fois', async () => {
    await useMotionPreference.getState().hydrate();
    await useMotionPreference.getState().hydrate();
    expect(storage.getItem).toHaveBeenCalledTimes(1);
  });

  it('persiste le nouveau réglage', () => {
    useMotionPreference.getState().setEnabled(false);
    expect(useMotionPreference.getState().enabled).toBe(false);
    expect(storage.setItem).toHaveBeenCalledWith('motion_enabled', 'false');
  });

  it('survit à un échec d’écriture', () => {
    // Persistance best-effort : un stockage indisponible ne doit pas casser l'interrupteur.
    storage.setItem.mockRejectedValue(new Error('stockage indisponible'));
    expect(() => useMotionPreference.getState().setEnabled(false)).not.toThrow();
    expect(useMotionPreference.getState().enabled).toBe(false);
  });

  it('survit à un échec de lecture', async () => {
    storage.getItem.mockRejectedValue(new Error('stockage indisponible'));
    await expect(useMotionPreference.getState().hydrate()).resolves.toBeUndefined();
    expect(useMotionPreference.getState().hydrated).toBe(true);
    expect(useMotionPreference.getState().enabled).toBe(true);
  });
});
