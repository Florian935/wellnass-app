import { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { BodyTrainingEditor } from '@/components/body/BodyTrainingEditor';
import { useBodyTraining } from '@/data/repositories/body-training-repository';
import { useBodyVisual } from '@/data/repositories/body-visual-repository';
import { useAuthStore } from '@/stores/auth-store';
import { useTheme } from '@/theme/useTheme';

function BodyTrainingSession() {
  const source = useBodyTraining();
  const visualSource = useBodyVisual();
  const [hasLoaded, setHasLoaded] = useState(false);
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  // Gate only the initial read: subsequent loading/errors must preserve the draft.
  if (!source.isLoading && !visualSource.isLoading && !hasLoaded) setHasLoaded(true);
  return hasLoaded ? (
    <BodyTrainingEditor
      source={source}
      visualSource={visualSource}
      onOpenCompatiblePrograms={() => router.push('/body-training-programs')}
    />
  ) : (
    <ActivityIndicator accessibilityLabel={t('bodyTraining.loading')} color={colors.accent} />
  );
}

export default function BodyTrainingScreen() {
  const userId = useAuthStore(state => state.session?.user.id);
  return <Screen>{userId ? <BodyTrainingSession key={userId} /> : null}</Screen>;
}
