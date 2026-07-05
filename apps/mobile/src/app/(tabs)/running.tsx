import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';

export default function RunningScreen() {
  const { t } = useTranslation();
  return (
    <Screen edges={['top']}>
      <ScreenHeader title={t('pillars.running')} subtitle={t('pillarScreens.running.tagline')} />
      <EmptyState
        icon="walk-outline"
        title={t('pillarScreens.running.emptyTitle')}
        message={t('pillarScreens.running.emptyMessage')}
      />
    </Screen>
  );
}
