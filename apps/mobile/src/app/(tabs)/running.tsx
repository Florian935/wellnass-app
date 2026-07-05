import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/EmptyState';

export default function RunningScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <EmptyState
        icon="walk-outline"
        title={t('pillarScreens.running.emptyTitle')}
        message={t('pillarScreens.running.emptyMessage')}
      />
    </Screen>
  );
}
