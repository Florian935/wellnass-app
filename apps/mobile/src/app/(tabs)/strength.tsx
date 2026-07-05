import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';

export default function StrengthScreen() {
  const { t } = useTranslation();
  return (
    <Screen edges={['top']}>
      <ScreenHeader title={t('pillars.strength')} subtitle={t('pillarScreens.strength.tagline')} />
      <EmptyState
        icon="barbell-outline"
        title={t('pillarScreens.strength.emptyTitle')}
        message={t('pillarScreens.strength.emptyMessage')}
      />
    </Screen>
  );
}
