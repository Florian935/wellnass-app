import { act, renderHook } from '@testing-library/react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useAppReducedMotion } from '../useAppReducedMotion';
import { useMotionPreference } from '@/stores/motion-store';

// Pas de `jest.mock` local ici : `react-native-reanimated` est déjà mocké globalement dans
// `jest.setup.ts`, et sa factory ne peut pas faire de `requireActual` sans déclencher le
// chargement du module natif. `useReducedMotion` y est un `jest.fn`, donc pilotable d'ici.
const systemReduced = useReducedMotion as unknown as jest.Mock<boolean>;

/**
 * La table de vérité du hook. C'est **un OU**, et c'est le point qui compte : le réglage
 * applicatif ne peut que retirer du mouvement, jamais en rendre à quelqu'un qui a demandé au
 * système de ne pas en recevoir. L'inverse serait un défaut d'accessibilité déguisé en préférence.
 */
describe('useAppReducedMotion', () => {
  afterEach(async () => {
    systemReduced.mockReturnValue(false);
    await act(async () => {
      useMotionPreference.setState({ enabled: true, hydrated: false });
    });
  });

  it.each([
    { system: false, app: true, expected: false, cas: 'rien de coupé → du mouvement' },
    { system: true, app: true, expected: true, cas: 'réglage système actif → coupé' },
    { system: false, app: false, expected: true, cas: 'réglage app coupé → coupé' },
    { system: true, app: false, expected: true, cas: 'les deux coupés → coupé' },
  ])('$cas', async ({ system, app, expected }) => {
    systemReduced.mockReturnValue(system);
    useMotionPreference.setState({ enabled: app });

    const { result } = await renderHook(() => useAppReducedMotion());

    expect(result.current).toBe(expected);
  });

  it('le réglage app ne peut pas contredire le système', async () => {
    // Le cas qui justifie le OU : animations activées dans l'app, mais « réduire les animations »
    // actif côté Android. L'app doit obéir au système.
    systemReduced.mockReturnValue(true);
    useMotionPreference.setState({ enabled: true });

    const { result } = await renderHook(() => useAppReducedMotion());

    expect(result.current).toBe(true);
  });

  it('suit un changement de préférence sans remontage', async () => {
    // Couper les animations depuis les Réglages doit agir **tout de suite**, sur tous les écrans
    // montés — pas au prochain changement d'onglet. C'est l'abonnement Zustand qui le garantit.
    systemReduced.mockReturnValue(false);
    const { result } = await renderHook(() => useAppReducedMotion());
    expect(result.current).toBe(false);

    await act(async () => {
      useMotionPreference.getState().setEnabled(false);
    });

    expect(result.current).toBe(true);
  });
});
