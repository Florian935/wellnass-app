/**
 * US CARDIO-UX03 — les deux mémoires du hub Course.
 *
 *  - l'onglet affiché (D1) : en mémoire, jamais persisté — relancer l'app rouvre Courir ;
 *  - le dernier mode de départ (D5, R6) : préférence **locale** (`secureStorage`), aucune colonne.
 */
import { useRunSection } from '../run-section-store';
import { useRunStartMode } from '../run-start-mode-store';
import { secureStorage } from '@/lib/secure-storage';

jest.mock('@/lib/secure-storage', () => ({
  secureStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

const storage = secureStorage as jest.Mocked<typeof secureStorage>;

describe('run-section-store — l’onglet du hub Course', () => {
  beforeEach(() => useRunSection.setState({ section: null }));

  it('aucun onglet retenu au démarrage', () => {
    expect(useRunSection.getState().section).toBeNull();
  });

  it('retient le dernier onglet choisi, sans rien écrire sur l’appareil', () => {
    useRunSection.getState().setSection('history');
    expect(useRunSection.getState().section).toBe('history');
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});

describe('run-start-mode-store — le dernier mode de départ (R6)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.getItem.mockResolvedValue(null);
    useRunStartMode.setState({ source: 'gps', hydrated: false });
  });

  it('GPS par défaut', () => {
    expect(useRunStartMode.getState().source).toBe('gps');
  });

  it('relit le mode retenu', async () => {
    storage.getItem.mockResolvedValue('manual');
    await useRunStartMode.getState().hydrate();
    expect(storage.getItem).toHaveBeenCalledWith('run_start_source');
    expect(useRunStartMode.getState()).toMatchObject({ source: 'manual', hydrated: true });
  });

  it('🔴 une valeur illisible retombe sur GPS', async () => {
    storage.getItem.mockResolvedValue('velo');
    await useRunStartMode.getState().hydrate();
    expect(useRunStartMode.getState().source).toBe('gps');
  });

  it('une lecture en échec ne bloque pas le départ', async () => {
    storage.getItem.mockRejectedValue(new Error('keystore'));
    await useRunStartMode.getState().hydrate();
    expect(useRunStartMode.getState()).toMatchObject({ source: 'gps', hydrated: true });
  });

  it('n’hydrate qu’une fois : un choix fait entre-temps n’est pas écrasé', async () => {
    useRunStartMode.setState({ hydrated: true });
    storage.getItem.mockResolvedValue('manual');
    await useRunStartMode.getState().hydrate();
    expect(storage.getItem).not.toHaveBeenCalled();
  });

  it('retient le mode démarré', () => {
    useRunStartMode.getState().setSource('manual');
    expect(useRunStartMode.getState().source).toBe('manual');
    expect(storage.setItem).toHaveBeenCalledWith('run_start_source', 'manual');
  });

  it('une écriture en échec ne remonte pas', () => {
    storage.setItem.mockRejectedValueOnce(new Error('keystore'));
    expect(() => useRunStartMode.getState().setSource('gps')).not.toThrow();
  });
});
