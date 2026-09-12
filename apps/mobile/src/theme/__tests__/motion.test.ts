import { DURATION, PRESS_SCALE, SPRING, STAGGER, STAGGER_MAX, staggerDelay } from '../motion';

describe('jetons de mouvement', () => {
  describe('staggerDelay', () => {
    it('décale de 40 ms par rang', () => {
      expect(staggerDelay(0)).toBe(0);
      expect(staggerDelay(1)).toBe(STAGGER);
      expect(staggerDelay(3)).toBe(3 * STAGGER);
    });

    it('plafonne au sixième élément', () => {
      // C'est la raison d'être du plafond : sans lui, la grille de l'accueil (jusqu'à huit
      // widgets) ferait arriver le dernier 320 ms après le premier — une latence, pas une
      // élégance, et au moment précis du premier contact du matin.
      const plateau = (STAGGER_MAX - 1) * STAGGER;
      expect(staggerDelay(STAGGER_MAX - 1)).toBe(plateau);
      expect(staggerDelay(STAGGER_MAX)).toBe(plateau);
      expect(staggerDelay(42)).toBe(plateau);
    });

    it('ne recule jamais sur un index négatif ou fractionnaire', () => {
      expect(staggerDelay(-3)).toBe(0);
      expect(staggerDelay(2.7)).toBe(2 * STAGGER);
    });
  });

  describe('cohérence des paliers', () => {
    it('ordonne les durées du plus court au plus long', () => {
      // Le palier compte plus que la valeur : ce qui doit se voir, c'est qu'un enfoncement au
      // doigt et un chiffre qui change n'appartiennent pas au même monde.
      const paliers = [
        DURATION.instant,
        DURATION.quick,
        DURATION.base,
        DURATION.data,
        DURATION.celebrate,
        DURATION.ambient,
      ];
      const trie = [...paliers].sort((a, b) => a - b);
      expect(paliers).toEqual(trie);
    });

    it('garde l’enfoncement sous le seuil de perception d’une attente', () => {
      // Au-delà de ~100 ms, un retour tactile cesse d'être ressenti comme instantané.
      expect(DURATION.instant).toBeLessThanOrEqual(100);
    });

    it('garde un enfoncement perceptible mais discret', () => {
      expect(PRESS_SCALE).toBeGreaterThan(0.94);
      expect(PRESS_SCALE).toBeLessThan(1);
    });

    it('donne au ressort d’impact la raideur la plus forte', () => {
      // La signature du pilier muscu : le geste est fini avant que l'œil n'arrive.
      expect(SPRING.impact.stiffness).toBeGreaterThan(SPRING.settle.stiffness);
      expect(SPRING.impact.stiffness).toBeGreaterThan(SPRING.pop.stiffness);
    });
  });
});
