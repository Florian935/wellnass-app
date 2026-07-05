import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';

export default function NutritionScreen() {
  const { t } = useTranslation();
  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={t('pillars.nutrition')}
        subtitle={t('pillarScreens.nutrition.tagline')}
      />
      <EmptyState
        icon="nutrition-outline"
        title={t('pillarScreens.nutrition.emptyTitle')}
        message={t('pillarScreens.nutrition.emptyMessage')}
      />
    </Screen>
  );
}
