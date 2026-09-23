/**
 * L'écran de repos immersif — la ligne « quoi toucher sur la barre » (MUSCU-FIX02, passe 3).
 *
 * C'est pendant le repos qu'on recharge la barre : l'écran dit ce qui change pour la série qui
 * vient (même exercice), ou le chargement complet par côté (nouvel exercice à la barre).
 */

import { render, screen } from '@testing-library/react-native';

import { ImmersiveRest } from '../ImmersiveRest';
import { makeRuntime, type RuntimeOverrides } from '@/test-utils/immersive-runtime';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}|${JSON.stringify(vars)}` : key,
    i18n: { language: 'fr' },
  }),
}));
// Les cartes du repos ont leurs propres sujets ; ici, seule la ligne de la barre compte.
jest.mock('../BodyHeatCard', () => ({ BodyHeatCard: () => null }));
jest.mock('../GhostCard', () => ({ GhostCard: () => null }));
jest.mock('../RecordTakeover', () => ({ RecordTakeover: () => null }));
jest.mock('@/components/workout/RestRing', () => ({ RestRing: () => null }));

const ghost = { hasGhost: false, you: 0, ghostTotal: 0, delta: 0 } as never;

const monter = (over: RuntimeOverrides) =>
  render(
    <ImmersiveRest
      runtime={makeRuntime({ rest: { active: true, collapsed: false, secondsLeft: 60 }, ...over })}
      ghost={ghost}
      ghostVisible={false}
      ghostDayLabel="mardi"
      onOpenPlan={jest.fn()}
    />,
  );

describe('ImmersiveRest — la barre pour la série qui vient', () => {
  it('🔴 même exercice : dit ce qu’il faut ajouter de chaque côté', async () => {
    await monter({ showBarbell: true, displayWeightKg: 137.5, barChange: { direction: 'add', perSide: 1.25 } });

    expect(screen.getByTestId('rest-next-load').props.children).toBe(
      'immersive.bar.changeAdd|{"weight":"1,25","unit":"kg"}',
    );
  });

  it('nouvel exercice à la barre : le chargement complet par côté', async () => {
    await monter({ showBarbell: true, displayWeightKg: 100, barChange: null, prefs: { barKg: 20 } });

    expect(screen.getByTestId('rest-next-load').props.children).toMatch(/immersive\.bar\.perSide/);
  });

  it('hors barre : rien sur la barre', async () => {
    await monter({ showBarbell: false, barChange: { direction: 'add', perSide: 1.25 } });

    expect(screen.queryByTestId('rest-next-load')).toBeNull();
  });
});
