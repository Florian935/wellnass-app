/**
 * US CARDIO-02 (R8) — le marqueur du test de 12 minutes : une préférence locale, aucune colonne.
 */
import { parseCooperMarker, useCooperTest } from '../cooper-test-store';
import { secureStorage } from '@/lib/secure-storage';

jest.mock('@/lib/secure-storage', () => ({
  secureStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

const storage = secureStorage as jest.Mocked<typeof secureStorage>;

beforeEach(() => {
  jest.clearAllMocks();
  storage.getItem.mockResolvedValue(null);
  useCooperTest.setState({ marker: null, hydrated: false });
});

describe('parseCooperMarker', () => {
  it('relit un marqueur valide', () => {
    expect(parseCooperMarker('{"runId":"r1","interrupted":true}')).toEqual({ runId: 'r1', interrupted: true });
    expect(parseCooperMarker('{"runId":"r1"}')).toEqual({ runId: 'r1', interrupted: false });
  });

  it('🔴 une valeur corrompue vaut « pas de test »', () => {
    expect(parseCooperMarker(null)).toBeNull();
    expect(parseCooperMarker('pas du json')).toBeNull();
    expect(parseCooperMarker('{"runId":""}')).toBeNull();
    expect(parseCooperMarker('{"runId":42}')).toBeNull();
  });
});

describe('useCooperTest', () => {
  it('aucun test par défaut', () => {
    expect(useCooperTest.getState().marker).toBeNull();
  });

  it('pose le marqueur au départ et le garde sur l’appareil', () => {
    useCooperTest.getState().mark('r1');
    expect(useCooperTest.getState().marker).toEqual({ runId: 'r1', interrupted: false });
    expect(storage.setItem).toHaveBeenCalledWith('cooper_test', '{"runId":"r1","interrupted":false}');
  });

  it('relit le marqueur après un redémarrage', async () => {
    storage.getItem.mockResolvedValue('{"runId":"r1","interrupted":false}');
    await useCooperTest.getState().hydrate();
    expect(storage.getItem).toHaveBeenCalledWith('cooper_test');
    expect(useCooperTest.getState()).toMatchObject({ marker: { runId: 'r1' }, hydrated: true });
  });

  it('un départ pendant la relecture l’emporte sur l’ancien marqueur', async () => {
    let resolve: (v: string) => void = () => undefined;
    storage.getItem.mockReturnValue(new Promise<string>((r) => (resolve = r)));
    const hydrating = useCooperTest.getState().hydrate();
    useCooperTest.getState().mark('neuf');
    resolve('{"runId":"ancien"}');
    await hydrating;
    expect(useCooperTest.getState().marker?.runId).toBe('neuf');
  });

  it('une pause interrompt le test de CETTE course seulement', () => {
    useCooperTest.getState().mark('r1');
    useCooperTest.getState().interrupt('autre');
    expect(useCooperTest.getState().marker?.interrupted).toBe(false);
    useCooperTest.getState().interrupt('r1');
    expect(useCooperTest.getState().marker).toEqual({ runId: 'r1', interrupted: true });
  });

  it('s’efface au choix', () => {
    useCooperTest.getState().mark('r1');
    useCooperTest.getState().clear();
    expect(useCooperTest.getState().marker).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith('cooper_test');
  });

  it('une lecture ou une écriture en échec ne remonte pas', async () => {
    storage.getItem.mockRejectedValue(new Error('keystore'));
    await useCooperTest.getState().hydrate();
    expect(useCooperTest.getState().hydrated).toBe(true);
    storage.setItem.mockRejectedValueOnce(new Error('keystore'));
    expect(() => useCooperTest.getState().mark('r2')).not.toThrow();
  });
});
