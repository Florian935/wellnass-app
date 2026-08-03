import { describe, expect, it } from 'vitest';
import {
  activationPathDayIndex,
  activationDayTheme,
  rankedActivePillars,
} from './activation-path';

const T0 = '2026-08-03T08:00:00.000Z';

describe('activationPathDayIndex', () => {
  it('onboarding non terminé -> null', () => {
    expect(activationPathDayIndex(null, T0)).toBeNull();
  });

  it('jour 1 juste après la fin de l\'onboarding', () => {
    expect(activationPathDayIndex(T0, T0)).toBe(1);
    expect(activationPathDayIndex(T0, '2026-08-03T23:59:00.000Z')).toBe(1);
  });

  it('jour 7 à J+6', () => {
    expect(activationPathDayIndex(T0, '2026-08-09T08:00:00.000Z')).toBe(7);
  });

  it('hors fenêtre (jour 8, J+7) -> null', () => {
    expect(activationPathDayIndex(T0, '2026-08-10T08:00:00.000Z')).toBeNull();
  });

  it('bien après la fenêtre -> null', () => {
    expect(activationPathDayIndex(T0, '2026-09-03T08:00:00.000Z')).toBeNull();
  });
});

describe('rankedActivePillars', () => {
  it('les 3 piliers actifs -> ordre de priorité complet', () => {
    expect(rankedActivePillars(['nutrition', 'strength', 'running'])).toEqual([
      'strength',
      'running',
      'nutrition',
    ]);
  });

  it('muscu désactivé, running + nutrition actifs -> ordre conservé sur les 2 restants', () => {
    expect(rankedActivePillars(['running', 'nutrition'])).toEqual(['running', 'nutrition']);
  });

  it('un seul pilier actif', () => {
    expect(rankedActivePillars(['nutrition'])).toEqual(['nutrition']);
  });

  it('aucun pilier actif -> liste vide', () => {
    expect(rankedActivePillars([])).toEqual([]);
  });
});

describe('activationDayTheme', () => {
  it('les 3 piliers actifs : jour 1/3/5 ciblent rang 1/2/3, jours pairs universels', () => {
    const active = ['strength', 'running', 'nutrition'] as const;
    expect(activationDayTheme(1, active)).toEqual({ kind: 'pillar', rank: 1, pillar: 'strength' });
    expect(activationDayTheme(2, active)).toEqual({ kind: 'universal', day: 2 });
    expect(activationDayTheme(3, active)).toEqual({ kind: 'pillar', rank: 2, pillar: 'running' });
    expect(activationDayTheme(4, active)).toEqual({ kind: 'universal', day: 4 });
    expect(activationDayTheme(5, active)).toEqual({ kind: 'pillar', rank: 3, pillar: 'nutrition' });
    expect(activationDayTheme(6, active)).toEqual({ kind: 'universal', day: 6 });
    expect(activationDayTheme(7, active)).toEqual({ kind: 'universal', day: 7 });
  });

  it('exemple concret de la spec §2 ter : running + nutrition actifs, muscu désactivé', () => {
    const active = ['running', 'nutrition'] as const;
    expect(activationDayTheme(1, active)).toEqual({ kind: 'pillar', rank: 1, pillar: 'running' });
    expect(activationDayTheme(3, active)).toEqual({ kind: 'pillar', rank: 2, pillar: 'nutrition' });
    // Rang 3 absent (seulement 2 piliers actifs) -> repli universel, même si rien n'a été fait.
    expect(activationDayTheme(5, active)).toEqual({ kind: 'universal', day: 5 });
  });

  it('un seul pilier actif : jours 3 et 5 tous deux universels', () => {
    const active = ['nutrition'] as const;
    expect(activationDayTheme(1, active)).toEqual({ kind: 'pillar', rank: 1, pillar: 'nutrition' });
    expect(activationDayTheme(3, active)).toEqual({ kind: 'universal', day: 3 });
    expect(activationDayTheme(5, active)).toEqual({ kind: 'universal', day: 5 });
  });

  it('aucun pilier actif : tous les jours universels, y compris le jour 1', () => {
    expect(activationDayTheme(1, [])).toEqual({ kind: 'universal', day: 1 });
  });
});
