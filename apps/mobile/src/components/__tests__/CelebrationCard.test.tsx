/**
 * CelebrationCard.test.tsx — conteneur animé de célébration (US MUSC-F8, repris par MOTION-01).
 *
 * Le contrat testé a changé avec MOTION-01 : le composant ne gère plus lui-même le réglage système
 * via `AccessibilityInfo` (il était le seul fichier de l'app à le faire), mais lit le hook partagé
 * `useAppReducedMotion`, qui combine le réglage système **et** l'interrupteur « Animations » des
 * Réglages. Les tests pilotent donc ce hook, et non `AccessibilityInfo`.
 *
 * On vérifie le **contrat**, pas la trajectoire : que les enfants passent, que les ondes
 * décoratives disparaissent quand le mouvement est coupé, et qu'elles ne sont jamais annoncées.
 */
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { CelebrationCard } from '../CelebrationCard';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';

jest.mock('@/hooks/useAppReducedMotion', () => ({
  useAppReducedMotion: jest.fn(() => false),
}));

const reduced = useAppReducedMotion as jest.MockedFunction<typeof useAppReducedMotion>;

/** Compte les cercles décoratifs : ce sont les seules vues à bord de 2 px que pose le composant. */
function compterOndes(tree: unknown): number {
  const json = JSON.stringify(tree ?? null);
  return (json.match(/"borderWidth":2/g) ?? []).length;
}

describe('CelebrationCard', () => {
  beforeEach(() => {
    reduced.mockReturnValue(false);
  });

  it('rend ses enfants', async () => {
    const { getByText } = await render(
      <CelebrationCard>
        <Text>Record battu</Text>
      </CelebrationCard>,
    );
    expect(getByText('Record battu')).toBeTruthy();
  });

  it('rend ses enfants même quand le mouvement est coupé', async () => {
    // Règle R1 : couper l'animation ne doit rien cacher. C'est ce qui autorise à en poser partout.
    reduced.mockReturnValue(true);
    const { getByText } = await render(
      <CelebrationCard>
        <Text>Record battu</Text>
      </CelebrationCard>,
    );
    expect(getByText('Record battu')).toBeTruthy();
  });

  it('pose deux ondes quand le mouvement est permis', async () => {
    const { toJSON } = await render(
      <CelebrationCard>
        <Text>Record battu</Text>
      </CelebrationCard>,
    );
    expect(compterOndes(toJSON())).toBe(2);
  });

  it('ne pose aucune onde quand le mouvement est coupé', async () => {
    // Une onde n'est rien d'autre que son mouvement : contrairement au reste de l'US, il n'y a pas
    // d'« état final » à afficher — on ne la rend pas du tout.
    reduced.mockReturnValue(true);
    const { toJSON } = await render(
      <CelebrationCard>
        <Text>Record battu</Text>
      </CelebrationCard>,
    );
    expect(compterOndes(toJSON())).toBe(0);
  });

  it('ne fait pas annoncer les ondes par un lecteur d’écran', async () => {
    const { toJSON } = await render(
      <CelebrationCard>
        <Text>Record battu</Text>
      </CelebrationCard>,
    );
    const json = JSON.stringify(toJSON());
    expect((json.match(/"importantForAccessibility":"no-hide-descendants"/g) ?? []).length).toBe(2);
  });
});
