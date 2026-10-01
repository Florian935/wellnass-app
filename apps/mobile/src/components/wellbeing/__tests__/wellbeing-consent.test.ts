/**
 * US BIEN-02 — activer le pilier Bien-être, c'est consentir (RGPD, article 9).
 *
 * Le point d'entrée unique de l'onboarding, des Réglages et des réglages du pilier. Ce qui doit tenir :
 *  - **rien ne s'écrit sans le « oui »** — annuler, ou fermer l'alerte en touchant à côté, est un refus ;
 *  - un échec d'écriture se lit « non activé », jamais un rejet non capturé (panne CYCLE-01) ;
 *  - **éteindre est immédiat**, sans confirmation : refuser ne coûte pas un geste de plus qu'accepter.
 */

import { Alert } from 'react-native';
import type { TFunction } from 'i18next';

import { toggleWellbeingPillar } from '../wellbeing-consent';
import { updateSettings } from '@/data/repositories/settings-repository';

jest.mock('@/data/repositories/settings-repository', () => ({ updateSettings: jest.fn(async () => undefined) }));

const t = ((k: string) => k) as unknown as TFunction;

type Button = { text: string; onPress?: () => void };
type Options = { onDismiss?: () => void };

/** Rejoue l'alerte : `choice` est le bouton touché, ou « dismiss » pour un toucher à côté. */
function answer(choice: 'confirm' | 'cancel' | 'dismiss') {
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons, options) => {
    const list = (buttons ?? []) as Button[];
    if (choice === 'dismiss') (options as Options | undefined)?.onDismiss?.();
    else list.find((b) => b.text === (choice === 'confirm' ? 'wellbeingHub.consent.confirm' : 'common.cancel'))?.onPress?.();
  });
}

beforeEach(() => {
  jest.restoreAllMocks();
  (updateSettings as jest.Mock).mockReset().mockResolvedValue(undefined);
});

describe('toggleWellbeingPillar', () => {
  it('activer demande le consentement, puis écrit — et seulement après le « oui »', async () => {
    answer('confirm');

    expect(await toggleWellbeingPillar(t, true)).toBe(true);
    expect(Alert.alert).toHaveBeenCalledWith('wellbeingHub.consent.title', 'wellbeingHub.consent.body', expect.any(Array), expect.any(Object));
    expect(updateSettings).toHaveBeenCalledWith({ wellbeingPillarEnabled: true });
  });

  it.each(['cancel', 'dismiss'] as const)('🔴 « %s » est un refus : rien n’est écrit', async (choice) => {
    answer(choice);

    expect(await toggleWellbeingPillar(t, true)).toBe(false);
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('un échec d’écriture se lit « non activé », sans rejet', async () => {
    answer('confirm');
    (updateSettings as jest.Mock).mockRejectedValue(new Error('disque'));

    await expect(toggleWellbeingPillar(t, true)).resolves.toBe(false);
  });

  it('éteindre est immédiat, sans alerte — et un échec n’est pas un rejet', async () => {
    const alert = jest.spyOn(Alert, 'alert');

    expect(await toggleWellbeingPillar(t, false)).toBe(false);
    expect(alert).not.toHaveBeenCalled();
    expect(updateSettings).toHaveBeenCalledWith({ wellbeingPillarEnabled: false });

    (updateSettings as jest.Mock).mockRejectedValue(new Error('disque'));
    await expect(toggleWellbeingPillar(t, false)).resolves.toBe(false);
  });
});
