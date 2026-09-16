/**
 * US AUTRE-01 — l'**historique des autres activités**.
 *
 * Volontairement pauvre : une liste, une dépense par ligne, un tap pour corriger. Les piliers ont
 * des historiques riches (records, allures, volumes) parce qu'ils ont une progression à raconter ;
 * une sortie vélo notée à la main n'en a pas, et lui inventer des statistiques donnerait une fausse
 * idée de ce que l'app en sait.
 *
 * C'est aussi la **porte d'entrée transverse** : accessible depuis les réglages, elle sert à qui n'a
 * pas activé le pilier Nutrition et n'a donc pas la carte « Ta journée en énergie ».
 */

import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { activityTypeDef, formatDayFull, formatHoursMinutes, localDayKey } from '@wellness/shared';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { FormScreen } from '@/components/FormScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useActivities } from '@/data/repositories/activity-repository';
import { useEnergyItemsByDay } from '@/data/repositories/energy-repository';
import { useSettings } from '@/data/repositories/settings-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function ActivitiesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { activities, isLoading } = useActivities();
  const { byDay } = useEnergyItemsByDay();
  const { settings } = useSettings();
  const showNumbers = settings?.showEnergyEstimates ?? true;

  const kcalOf = (id: string, startedAt: string): number | null => {
    const item = byDay.get(localDayKey(new Date(startedAt)))?.find((i) => i.id === id);
    return item ? item.estimate.kcal : null;
  };

  return (
    <FormScreen>
      <ScreenHeader title={t('activity.listTitle')} subtitle={t('activity.listSubtitle')} />

      <Button label={t('activity.addCta')} onPress={() => router.push('/activity')} />

      {isLoading ? null : activities.length === 0 ? (
        <EmptyState
          icon="bicycle-outline"
          title={t('activity.empty.title')}
          message={t('activity.empty.body')}
        />
      ) : (
        <Card>
          {activities.map((a, index) => {
            const def = activityTypeDef(a.activityType);
            const kcal = kcalOf(a.id, a.startedAt);
            return (
              <Pressable
                key={a.id}
                onPress={() => router.push({ pathname: '/activity', params: { id: a.id } })}
                accessibilityRole="button"
                accessibilityLabel={t('activity.listItemA11y', {
                  type: t(`activity.types.${def.id}`),
                  date: formatDayFull(localDayKey(new Date(a.startedAt))),
                })}
                style={[
                  styles.row,
                  index > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : null,
                ]}
              >
                <View style={styles.texts}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    {t(`activity.types.${def.id}`)}
                  </Text>
                  <Text style={[styles.sub, { color: colors.textMuted }]}>
                    {formatDayFull(localDayKey(new Date(a.startedAt)))} ·{' '}
                    {formatHoursMinutes(a.durationSeconds)} ·{' '}
                    {t(`activity.intensity.${a.intensity}.label`).toLowerCase()}
                  </Text>
                </View>
                {showNumbers && kcal !== null ? (
                  <Text style={[styles.kcal, { color: colors.textMuted }]}>
                    {a.deviceKcal != null ? `${kcal}` : `≈ ${kcal}`}
                  </Text>
                ) : null}
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            );
          })}
        </Card>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 10 },
  texts: { flex: 1, gap: 2 },
  label: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  sub: { fontFamily: fontFamily.body, fontSize: 12.5 },
  kcal: { fontFamily: fontFamily.mono, fontSize: 13 },
});
