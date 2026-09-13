import { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { BodyShapeEditor } from '@/components/body/BodyShapeEditor';
import { useBodyVisual } from '@/data/repositories/body-visual-repository';
import { useAuthStore } from '@/stores/auth-store';
import { useTheme } from '@/theme/useTheme';

function BodyShapeSession() {
  const source = useBodyVisual();
  const [hasLoaded, setHasLoaded] = useState(false);
  const { t } = useTranslation();
  const { colors } = useTheme();
  // Initial load gates the editor once. A later loading/error state keeps the existing draft mounted.
  if (!source.isLoading && !hasLoaded) setHasLoaded(true);
  return hasLoaded ? <BodyShapeEditor source={source} />
    : <ActivityIndicator accessibilityLabel={t('bodyShape.loading')} color={colors.accent} />;
}

export default function BodyShapeScreen() {
  const userId = useAuthStore((state) => state.session?.user.id);
  return <Screen>{userId ? <BodyShapeSession key={userId} /> : null}</Screen>;
}
