import { describe, expect, it } from 'vitest';
import { HUB_SECTIONS, isHubSection, resolveHubSection } from './hub-section';

describe('resolveHubSection — D3', () => {
  it('trois onglets, dans cet ordre', () => {
    expect(HUB_SECTIONS).toEqual(['train', 'history', 'progress']);
  });

  it('démarrage à froid : S’entraîner', () => {
    expect(resolveHubSection({ param: undefined, remembered: null })).toBe('train');
  });

  it('le dernier onglet choisi est rouvert', () => {
    expect(resolveHubSection({ param: undefined, remembered: 'progress' })).toBe('progress');
  });

  it('un paramètre de route passe devant la mémoire', () => {
    expect(resolveHubSection({ param: 'history', remembered: 'progress' })).toBe('history');
  });

  it('un paramètre inconnu est ignoré', () => {
    expect(resolveHubSection({ param: 'calendrier', remembered: 'progress' })).toBe('progress');
    expect(resolveHubSection({ param: ['history'], remembered: null })).toBe('train');
  });

  it('isHubSection', () => {
    expect(isHubSection('train')).toBe(true);
    expect(isHubSection('Train')).toBe(false);
    expect(isHubSection(undefined)).toBe(false);
  });
});
