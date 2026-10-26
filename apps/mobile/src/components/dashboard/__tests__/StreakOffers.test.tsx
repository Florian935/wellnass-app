/**
 * Les deux offres de la série (`StreakOffers`, US ACCUEIL-08), déménagées de la carte Régularité
 * dans « Ta semaine » quand la Régularité a quitté l'accueil.
 *
 * Reprend les tests d'offres de `StreakCard.test.tsx` (supprimé avec la carte) : le joker
 * (STREAK-01) et la bascule en semaines (SERIE-01, D1). Ce qui a disparu avec la carte — le grand
 * chiffre, la bande des sept jours ou des huit semaines — est couvert par « Ta semaine » elle-même
 * (`WeekStrip.test.tsx`, la série en pastille). Les faits arrivent par props : `useHomeScene` les lit
 * (`useHomeScene.test.tsx`).
 */
import '@/i18n';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StreakOffers, type StreakOffersProps } from '../StreakOffers';
import { consumeJoker } from '@/data/repositories/streak-joker-repository';
import { updateSettings } from '@/data/repositories/settings-repository';

jest.mock('@/data/repositories/streak-joker-repository', () => ({ consumeJoker: jest.fn() }));
// Mocké pour isoler l'écriture (inspectable) : la base n'est pas montée ici.
jest.mock('@/data/repositories/settings-repository', () => ({
  updateSettings: jest.fn(() => Promise.resolve()),
}));

const RIEN: StreakOffersProps = { dailyCurrent: 5, weeklyCurrent: 4, restorableGap: null, offerSwitch: false };
const offres = (over: Partial<StreakOffersProps> = {}) => <StreakOffers {...RIEN} {...over} />;

beforeEach(() => {
  jest.clearAllMocks();
  (consumeJoker as jest.Mock).mockResolvedValue(undefined);
});

describe('rien à proposer', () => {
  it('ne rend RIEN — le cas courant', async () => {
    const vue = await render(offres());
    expect(vue.toJSON()).toBeNull();
  });

  it('la bascule ne s’affiche PAS quand la question a déjà été tranchée', async () => {
    await render(offres());
    expect(screen.queryByTestId('streak-switch-offer')).toBeNull();
  });
});

describe('la bascule en semaines (SERIE-01, D1)', () => {
  const bascule = { dailyCurrent: 9, weeklyCurrent: 4, offerSwitch: true };

  it('montre les DEUX chiffres : on choisit en connaissance de cause', async () => {
    await render(offres(bascule));
    expect(screen.getByTestId('streak-switch-offer')).toBeTruthy();
    expect(screen.getByText(/9 jours d'affilée aujourd'hui — soit 4 semaines/)).toBeTruthy();
  });

  it('🔴 « garder les jours » écrit le réglage lui AUSSI — sinon l’offre reviendrait', async () => {
    // Le piège serait de n'écrire la colonne que sur « oui » : `null` continuerait de vouloir dire
    // « jamais demandé », et la proposition reviendrait à chaque ouverture.
    await render(offres(bascule));
    await fireEvent.press(screen.getByText('Garder les jours'));
    expect(updateSettings).toHaveBeenCalledWith({ streakUnit: 'day' });
  });

  it('« compter en semaines » écrit l’unité hebdomadaire', async () => {
    await render(offres(bascule));
    await fireEvent.press(screen.getByText('Compter en semaines'));
    expect(updateSettings).toHaveBeenCalledWith({ streakUnit: 'week' });
  });
});

describe('le joker (STREAK-01)', () => {
  const gap = { day: '2026-07-07', streakIfUsed: 6 };

  it('🔴 un joker à proposer efface la bascule — une seule offre à la fois', async () => {
    await render(offres({ offerSwitch: true, restorableGap: gap }));
    expect(screen.getByTestId('streak-joker-offer')).toBeTruthy();
    expect(screen.queryByTestId('streak-switch-offer')).toBeNull();
  });

  it('rattrape le jour manqué au tap', async () => {
    await render(offres({ restorableGap: gap }));
    await fireEvent.press(screen.getByTestId('streak-joker-offer'));
    expect(consumeJoker).toHaveBeenCalledWith('2026-07-07');
  });

  it('dit l’échec au lieu de se taire', async () => {
    (consumeJoker as jest.Mock).mockRejectedValue(new Error('hors ligne'));
    await render(offres({ restorableGap: gap }));
    await fireEvent.press(screen.getByTestId('streak-joker-offer'));
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
