/**
 * Le choix du fantôme (`GhostPicker`) — FANT-01, étendu par US CARDIO-UX03 (D4, Q4).
 *
 * Ce qui est vérifié ici : la sortie **épinglée** par « Recourir » est listée en tête, même quand
 * elle ne fait pas partie des propositions (partie d'ailleurs, ou position inconnue), et une seule
 * fois quand elle en fait partie.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { GhostPicker } from '../GhostPicker';
import { useGhostCandidates } from '@/data/repositories/run-repository';

jest.mock('@/data/repositories/run-repository', () => ({
  GHOST_SUGGESTIONS: 3,
  useGhostCandidates: jest.fn(() => ({ candidates: [], isLoading: false })),
}));
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
  getLastKnownPositionAsync: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/components/Card', () => {
  const { View } = require('react-native');
  return { Card: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});
jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({ formatDistance: (km: number | null) => (km == null ? '—' : `${km} km`) }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
    i18n: { language: 'fr' },
  }),
}));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: { text: '#33291f', textMuted: '#786a59', border: '#e3d3ba', accent: '#2a64ad', surfaceAlt: '#e1eaf6' },
  }),
}));

const mockCandidates = useGhostCandidates as jest.Mock;

const candidate = (id: string, distanceM: number) => ({
  id,
  finishedAt: '2026-09-20T08:15:30.000Z',
  distanceM,
  durationSeconds: 4050,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCandidates.mockReturnValue({ candidates: [], isLoading: false });
});

describe('GhostPicker — la sortie épinglée par « Recourir » (CARDIO-UX03)', () => {
  it('sans proposition ni épingle : le message « aucune course »', async () => {
    await render(<GhostPicker selectedId={null} onSelect={jest.fn()} />);
    expect(screen.getByText('running.ghost.none')).toBeTruthy();
  });

  it('🔴 une sortie partie d’ailleurs est listée quand même, et sélectionnée', async () => {
    await render(
      <GhostPicker selectedId="run-ailleurs" onSelect={jest.fn()} pinned={candidate('run-ailleurs', 11400)} />,
    );
    expect(screen.queryByText('running.ghost.none')).toBeNull();
    expect(screen.getAllByText(/running\.ghost\.option/)).toHaveLength(1);
    expect(screen.getByText(/"distance":"11\.4 km"/)).toBeTruthy();
    expect(screen.getByRole('button', { selected: true })).toBeTruthy();
  });

  it('épinglée en tête, et une seule fois quand elle fait aussi partie des propositions', async () => {
    mockCandidates.mockReturnValue({
      candidates: [candidate('run-proche', 8100), candidate('run-ailleurs', 11400)],
      isLoading: false,
    });
    await render(<GhostPicker selectedId={null} onSelect={jest.fn()} pinned={candidate('run-ailleurs', 11400)} />);
    const options = screen.getAllByText(/running\.ghost\.option/);
    expect(options).toHaveLength(2);
    expect(options[0]!.props.children).toContain('11.4 km');
  });

  it('un appui sur l’épingle sélectionnée la retire (on peut courir sans fantôme)', async () => {
    const onSelect = jest.fn();
    await render(<GhostPicker selectedId="run-ailleurs" onSelect={onSelect} pinned={candidate('run-ailleurs', 11400)} />);
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { selected: true }));
    });
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
