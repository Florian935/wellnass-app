/**
 * US CARDIO-02 (§3.2, R8, R12) — « Ton test de 12 minutes », en tête de l'arrivée.
 *
 *  - une mesure valable propose l'allure et ses quatre allures ; « Retenir » l'écrit et efface le
 *    marqueur, « Pas cette fois » efface le marqueur sans rien écrire ;
 *  - un test incomplet, interrompu ou sans trace ne propose rien ;
 *  - une course qui n'est pas celle du test n'affiche rien.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { CooperResultCard } from '../CooperResultCard';
import { upsertRunnerProfile } from '@/data/repositories/running-profile-repository';
import { useCooperMeasure } from '@/running/cooper-measure';
import { useCooperTest } from '@/stores/cooper-test-store';

jest.mock('@/running/cooper-measure', () => ({ useCooperMeasure: jest.fn() }));
jest.mock('@/data/repositories/running-profile-repository', () => ({ upsertRunnerProfile: jest.fn() }));
jest.mock('@/lib/secure-storage', () => ({
  secureStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('@/components/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) => (
      <Pressable testID={testID} accessibilityRole="button" onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
    i18n: { language: 'fr' },
  }),
}));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#33291f',
      textMuted: '#786a59',
      background: '#f7eede',
      surface: '#fffaf2',
      surfaceAlt: '#f3ddd0',
      border: '#e3d3ba',
      accent: '#2a64ad',
      accentText: '#ffffff',
    },
  }),
}));
jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    system: 'metric',
    formatDistance: (km: number) => `${km} km`,
    formatPace: (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')} /km`,
  }),
}));

const mockMeasure = useCooperMeasure as jest.Mock;
const mockUpsert = upsertRunnerProfile as jest.Mock;

const taper = async (testID: string) => {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUpsert.mockResolvedValue(undefined);
  useCooperTest.setState({ marker: { runId: 'r1', interrupted: false }, hydrated: true });
});

it('rien pour une course qui n’est pas celle du test', async () => {
  mockMeasure.mockReturnValue({ run: null, measure: null });
  await render(<CooperResultCard runId="autre" />);
  expect(screen.queryByTestId('cooper-result')).toBeNull();
});

it('🔴 2 400 m : l’allure 5:14 /km et ses quatre allures, proposées', async () => {
  mockMeasure.mockReturnValue({ run: { id: 'r1' }, measure: { status: 'ok', distanceM: 2400, sPerKm: 314 } });
  await render(<CooperResultCard runId="r1" />);

  expect(screen.getByTestId('cooper-result-distance').props.children).toMatch(/^2.400 m$/);
  expect(screen.getByTestId('cooper-result-pace').props.children).toBe('5:14 /km');
  for (const type of ['endurance', 'sortie_longue', 'recuperation', 'fractionne']) {
    expect(screen.getByText(`running.sessionType.${type}`)).toBeTruthy();
  }
  expect(mockUpsert).not.toHaveBeenCalled();
});

it('🔴 « Retenir » écrit l’allure, efface le marqueur, et le confirme', async () => {
  mockMeasure.mockReturnValue({ run: { id: 'r1' }, measure: { status: 'ok', distanceM: 2400, sPerKm: 314 } });
  await render(<CooperResultCard runId="r1" />);

  await taper('cooper-result-retain');

  expect(mockUpsert).toHaveBeenCalledWith({ ref5kPaceSPerKm: 314 });
  expect(useCooperTest.getState().marker).toBeNull();
  expect(screen.getByTestId('cooper-result-saved')).toBeTruthy();
});

it('« Pas cette fois » efface le marqueur sans rien écrire', async () => {
  mockMeasure.mockReturnValue({ run: { id: 'r1' }, measure: { status: 'ok', distanceM: 2400, sPerKm: 314 } });
  await render(<CooperResultCard runId="r1" />);

  await taper('cooper-result-dismiss');

  expect(mockUpsert).not.toHaveBeenCalled();
  expect(useCooperTest.getState().marker).toBeNull();
  expect(screen.queryByTestId('cooper-result')).toBeNull();
});

it.each([
  [{ status: 'incomplete', lastSeconds: 580 }, 'running.cooper.result.incomplete:{"time":"9:40"}'],
  [{ status: 'interrupted' }, 'running.cooper.result.interrupted'],
  [{ status: 'noTrack' }, 'running.cooper.result.noTrack'],
  [{ status: 'tooSlow', distanceM: 900, sPerKm: 860 }, 'running.cooper.result.outOfRange:{"pace":"14:20 /km"}'],
])('🔴 %j : aucune allure proposée, et la raison dite', async (measure, why) => {
  mockMeasure.mockReturnValue({ run: { id: 'r1' }, measure });
  await render(<CooperResultCard runId="r1" />);

  expect(screen.getByTestId('cooper-result-why').props.children).toBe(why);
  expect(screen.queryByTestId('cooper-result-retain')).toBeNull();
  // Le marqueur reste : rien n'a été choisi.
  expect(useCooperTest.getState().marker).not.toBeNull();
});
