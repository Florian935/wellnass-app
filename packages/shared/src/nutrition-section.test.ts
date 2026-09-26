import { describe, expect, it } from 'vitest';
import {
  NUTRITION_SECTIONS,
  NUTRITION_STATS_TABS,
  isNutritionSection,
  resolveNutritionSection,
  resolveStatsTab,
} from './nutrition-section';

describe('resolveNutritionSection — NUTRI-UX03 D3', () => {
  it('trois onglets, dans cet ordre', () => {
    expect(NUTRITION_SECTIONS).toEqual(['today', 'history', 'progress']);
  });

  it('démarrage à froid : Aujourd’hui — l’app s’ouvre sur la saisie (NUTRI-UX02 R3.2)', () => {
    expect(resolveNutritionSection({ param: undefined, remembered: null })).toBe('today');
  });

  it('le dernier onglet choisi est rouvert', () => {
    expect(resolveNutritionSection({ param: undefined, remembered: 'progress' })).toBe('progress');
  });

  it('un paramètre de route passe devant la mémoire', () => {
    expect(resolveNutritionSection({ param: 'history', remembered: 'progress' })).toBe('history');
  });

  it('un paramètre inconnu, ou un tableau, est ignoré', () => {
    expect(resolveNutritionSection({ param: 'semaine', remembered: 'progress' })).toBe('progress');
    expect(resolveNutritionSection({ param: ['history'], remembered: null })).toBe('today');
    expect(resolveNutritionSection({ param: '', remembered: null })).toBe('today');
  });

  it('isNutritionSection', () => {
    expect(isNutritionSection('today')).toBe(true);
    expect(isNutritionSection('Today')).toBe(false);
    expect(isNutritionSection('week')).toBe(false);
    expect(isNutritionSection(undefined)).toBe(false);
  });
});

describe('resolveStatsTab — NUTRI-UX03 R12', () => {
  it('les quatre sous-onglets de Stats, dans l’ordre de l’écran', () => {
    expect(NUTRITION_STATS_TABS).toEqual(['regularity', 'intake', 'weight', 'quality']);
  });

  it('« Me peser » ouvre Poids', () => {
    expect(resolveStatsTab('weight')).toBe('weight');
  });

  it('absent ou inconnu : Régularité, comme avant', () => {
    expect(resolveStatsTab(undefined)).toBe('regularity');
    expect(resolveStatsTab('poids')).toBe('regularity');
    expect(resolveStatsTab(['weight'])).toBe('regularity');
  });
});
