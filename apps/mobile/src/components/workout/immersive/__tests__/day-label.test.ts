/**
 * Nommer la séance de référence — US MUSCU-UX03, spec §5.3 et §5.10.
 *
 * Le point dur n'est pas le formatage, c'est **la bascule à 7 jours** : « mardi » n'est lisible que
 * tant qu'il n'y a qu'un seul mardi possible. Au-delà, deux mardis se disputeraient le mot et
 * l'utilisateur comparerait sa séance à la mauvaise.
 */

import {
  ghostDayLabel,
  latestReferenceDate,
  referenceDayLabel,
} from '@/components/workout/immersive/day-label';

describe('referenceDayLabel', () => {
  it('nomme le jour quand la référence est récente', () => {
    // 08/09/2026 est un mardi.
    expect(referenceDayLabel('2026-09-08T18:00:00.000Z', 'named', 'fr')).toBe('mardi');
  });

  it('donne la date quand la référence est trop ancienne pour être nommée', () => {
    expect(referenceDayLabel('2026-08-02T18:00:00.000Z', 'date', 'fr')).toBe('02/08');
  });

  it('se tait sans référence', () => {
    expect(referenceDayLabel(null, 'named', 'fr')).toBeNull();
    expect(referenceDayLabel('2026-09-08T18:00:00.000Z', 'none', 'fr')).toBeNull();
  });

  it('🔴 se tait plutôt que de rendre « Invalid Date » sur une date illisible', () => {
    expect(referenceDayLabel('pas-une-date', 'named', 'fr')).toBeNull();
  });
});

describe('latestReferenceDate', () => {
  it('retient la fin de séance la plus récente', () => {
    expect(
      latestReferenceDate({
        a: { finishedAt: '2026-09-01T10:00:00.000Z' },
        b: { finishedAt: '2026-09-08T10:00:00.000Z' },
        c: { finishedAt: null },
      }),
    ).toBe('2026-09-08T10:00:00.000Z');
  });

  it('rend null quand aucun exercice n’a d’historique', () => {
    expect(latestReferenceDate({ a: { finishedAt: null } })).toBeNull();
    expect(latestReferenceDate({})).toBeNull();
  });
});

describe('ghostDayLabel', () => {
  const now = new Date('2026-09-13T09:00:00.000Z').getTime();

  it('🔴 nomme le jour en deçà de 7 jours', () => {
    const label = ghostDayLabel({ a: { finishedAt: '2026-09-08T18:00:00.000Z' } }, 'fr', now);
    expect(label).toBe('mardi');
  });

  it('🔴 bascule sur la date au-delà de 7 jours — deux mardis ne peuvent pas porter le même mot', () => {
    const label = ghostDayLabel({ a: { finishedAt: '2026-09-05T18:00:00.000Z' } }, 'fr', now);
    expect(label).toBe('05/09');
  });

  it('rend null sans aucune référence', () => {
    expect(ghostDayLabel({}, 'fr', now)).toBeNull();
  });
});
