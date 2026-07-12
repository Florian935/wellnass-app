import { describe, expect, it } from 'vitest';
import { isTrainingDay } from './training-day';

describe('isTrainingDay', () => {
  const TODAY = '2026-07-12';
  const YESTERDAY = '2026-07-11';
  const TOMORROW = '2026-07-13';

  it('passe + seance terminee (retroactif) -> vrai', () => {
    expect(
      isTrainingDay({ retroactiveDone: true, hasPlanned: false, dayKey: YESTERDAY, todayKey: TODAY }),
    ).toBe(true);
  });

  it('passe + seulement planifie -> faux (pas d\'anticipation dans le passe)', () => {
    expect(
      isTrainingDay({ retroactiveDone: false, hasPlanned: true, dayKey: YESTERDAY, todayKey: TODAY }),
    ).toBe(false);
  });

  it('aujourd\'hui planifie (cas frontiere dayKey === todayKey) -> vrai', () => {
    expect(
      isTrainingDay({ retroactiveDone: false, hasPlanned: true, dayKey: TODAY, todayKey: TODAY }),
    ).toBe(true);
  });

  it('futur planifie -> vrai', () => {
    expect(
      isTrainingDay({ retroactiveDone: false, hasPlanned: true, dayKey: TOMORROW, todayKey: TODAY }),
    ).toBe(true);
  });

  it('futur sans planning ni seance -> faux', () => {
    expect(
      isTrainingDay({ retroactiveDone: false, hasPlanned: false, dayKey: TOMORROW, todayKey: TODAY }),
    ).toBe(false);
  });

  it('aucun signal (passe sans rien) -> faux', () => {
    expect(
      isTrainingDay({ retroactiveDone: false, hasPlanned: false, dayKey: YESTERDAY, todayKey: TODAY }),
    ).toBe(false);
  });

  it('rétroactif ET planifié (les deux signaux vrais) -> vrai', () => {
    expect(
      isTrainingDay({ retroactiveDone: true, hasPlanned: true, dayKey: TODAY, todayKey: TODAY }),
    ).toBe(true);
  });
});
