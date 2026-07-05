import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/EmptyState';

export default function NutritionScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <EmptyState
        icon="nutrition-outline"
        title={t('pillarScreens.nutrition.emptyTitle')}
        message={t('pillarScreens.nutrition.emptyMessage')}
      />
    </Screen>
  );
}
