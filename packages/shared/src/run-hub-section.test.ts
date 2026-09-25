import { describe, expect, it } from 'vitest';
import { RUN_HUB_SECTIONS, isRunHubSection, resolveRunHubSection } from './run-hub-section';

describe('resolveRunHubSection — CARDIO-UX03 D1', () => {
  it('trois onglets, dans cet ordre : Courir, Historique, Progrès', () => {
    expect(RUN_HUB_SECTIONS).toEqual(['run', 'history', 'progress']);
  });

  it('démarrage à froid : Courir', () => {
    expect(resolveRunHubSection({ param: undefined, remembered: null })).toBe('run');
  });

  it('le dernier onglet choisi est rouvert', () => {
    expect(resolveRunHubSection({ param: undefined, remembered: 'progress' })).toBe('progress');
  });

  it('un paramètre de route passe devant la mémoire', () => {
    expect(resolveRunHubSection({ param: 'history', remembered: 'progress' })).toBe('history');
  });

  it('un paramètre inconnu est ignoré', () => {
    expect(resolveRunHubSection({ param: 'train', remembered: null })).toBe('run');
    expect(resolveRunHubSection({ param: 'nimporte', remembered: 'history' })).toBe('history');
  });

  it('un paramètre en tableau (lien mal formé) est ignoré', () => {
    expect(resolveRunHubSection({ param: ['history'], remembered: null })).toBe('run');
  });

  it('isRunHubSection ne reconnaît que les trois clés', () => {
    expect(isRunHubSection('run')).toBe(true);
    expect(isRunHubSection('history')).toBe(true);
    expect(isRunHubSection('progress')).toBe(true);
    expect(isRunHubSection('train')).toBe(false);
    expect(isRunHubSection(null)).toBe(false);
    expect(isRunHubSection(3)).toBe(false);
  });
});
