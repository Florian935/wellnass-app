import React from 'react';
import { render } from '@testing-library/react-native';
import { palettes } from '@/theme/colors';
import { WorkoutLevelPreview } from './WorkoutLevelPreview';

const colors = palettes.light;

// La vignette est décorative → masquée à l'arbre d'accessibilité. RNTL ignore les
// éléments cachés par défaut ; on interroge donc avec `includeHiddenElements`.
const HIDDEN = { includeHiddenElements: true } as const;

describe('WorkoutLevelPreview (MUSC-F13b)', () => {
  it('simplifiée : aucune pastille de supplément', async () => {
    const { queryByText } = await render(<WorkoutLevelPreview level="simplified" colors={colors} />);
    expect(queryByText('🔥', HIDDEN)).toBeNull();
    expect(queryByText('💡', HIDDEN)).toBeNull();
    expect(queryByText('RPE', HIDDEN)).toBeNull();
    expect(queryByText('Types', HIDDEN)).toBeNull();
  });

  it('normale : échauffement + suggestion, mais pas RPE/Types', async () => {
    const { queryByText } = await render(<WorkoutLevelPreview level="normal" colors={colors} />);
    expect(queryByText('🔥', HIDDEN)).not.toBeNull();
    expect(queryByText('💡', HIDDEN)).not.toBeNull();
    expect(queryByText('RPE', HIDDEN)).toBeNull();
    expect(queryByText('Types', HIDDEN)).toBeNull();
    expect(queryByText('⇄', HIDDEN)).toBeNull();
  });

  it('détaillée : toutes les pastilles', async () => {
    const { queryByText } = await render(<WorkoutLevelPreview level="detailed" colors={colors} />);
    for (const badge of ['🔥', '💡', 'Types', 'RPE', '📝', '⇄']) {
      expect(queryByText(badge, HIDDEN)).not.toBeNull();
    }
  });
});
