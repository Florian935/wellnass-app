/**
 * useUnits.test.tsx — Smoke test du hook useUnits.
 *
 * Vérifie les formateurs et parseurs pour les deux systèmes (metric/imperial)
 * et les deux locales (FR/EN).
 *
 * Note : renderHook() de @testing-library/react-native v14 est async — on
 * doit toujours l'awaiter.
 * Note : les factories jest.mock() sont hoistées par Babel avant const/let ;
 * on utilise `var` pour que les objets mutables soient accessibles depuis les
 * factories (hoisting de var au même niveau).
 */
import { renderHook } from '@testing-library/react-native';
import { useUnits } from '../useUnits';

// eslint-disable-next-line no-var
var settingsMock = { units: 'metric' };
// eslint-disable-next-line no-var
var langMock = { language: 'fr' };

jest.mock('@/data/repositories/settings-repository', () => ({
  useSettings: () => ({ settings: settingsMock, isLoading: false }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: langMock }),
}));

describe('useUnits', () => {
  it('metric + FR : virgule décimale, symboles SI', async () => {
    settingsMock.units = 'metric';
    langMock.language = 'fr';
    const { result } = await renderHook(() => useUnits());
    expect(result.current.formatWeight(72.5)).toBe('72,5 kg');
    expect(result.current.formatDistance(5.2)).toBe('5,20 km');
    expect(result.current.formatHeight(178)).toBe('178 cm');
    expect(result.current.formatPace(300)).toBe('5:00 /km');
    expect(result.current.parseWeightToKg('72,5')).toBeCloseTo(72.5, 5);
  });

  it('imperial + EN : point décimal, conversions lb/mi/ft-in', async () => {
    settingsMock.units = 'imperial';
    langMock.language = 'en';
    const { result } = await renderHook(() => useUnits());
    expect(result.current.formatWeight(72.5)).toBe('159.8 lb');
    expect(result.current.formatDistance(5.2)).toBe('3.23 mi');
    expect(result.current.formatHeight(178)).toBe('5 ft 10 in');
    expect(result.current.formatPace(300)).toBe('8:03 /mi');
    expect(result.current.parseWeightToKg('160')).toBeCloseTo(72.57, 1);
  });
});
