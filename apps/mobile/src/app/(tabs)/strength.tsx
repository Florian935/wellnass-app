import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/EmptyState';

export default function StrengthScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <EmptyState
        icon="barbell-outline"
        title={t('pillarScreens.strength.emptyTitle')}
        message={t('pillarScreens.strength.emptyMessage')}
      />
    </Screen>
  );
}
