/**
 * La carte « Ton allure de référence » du profil coureur (US CARDIO-02, §3.4, D8).
 *
 * Elle remplace le champ « Allure de référence (5 km) », écrit à chaque frappe et sans rien montrer
 * de ce qu'il produisait. La carte dit la valeur, **d'où elle vient** — déduit, jamais stocké (D6) :
 * égale au record 5 km ÷ 5, elle vient du record ; sinon, du coureur —, les quatre allures qu'elle
 * produit, et mène aux portes pour la changer.
 */

import { formatMmSs, referencePaceOrigin } from '@wellness/shared';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '@/components/motion/PressableScale';
import { TrainingPaceList } from '@/components/running/TrainingPaceList';
import { useRunningRecords } from '@/data/repositories/running-record-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** « 12/10/2026 », en heure locale. */
function longDate(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

type Props = {
  refSPerKm: number | null;
  onChange: () => void;
};

export function ReferencePaceCard({ refSPerKm, onChange }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const { records } = useRunningRecords();
  const record5k = records.find((r) => r.distanceKey === '5k') ?? null;
  const origin = referencePaceOrigin({
    refSPerKm,
    record5k: record5k ? { bestTimeSeconds: record5k.bestTimeSeconds, achievedAt: record5k.achievedAt } : null,
  });

  const cta = (
    <PressableScale
      testID="ref-card-change"
      onPress={onChange}
      accessibilityRole="button"
      style={[styles.cta, { borderColor: colors.accent }]}
    >
      <Text style={[styles.ctaLabel, { color: colors.accent }]}>
        {t(refSPerKm == null ? 'running.refPace.card.give' : 'running.refPace.card.change')}
      </Text>
    </PressableScale>
  );

  return (
    <View testID="ref-card" style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {refSPerKm == null ? (
        <View style={styles.row}>
          <View style={styles.grow}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('running.refPace.card.emptyTitle')}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>{t('running.refPace.card.emptyBody')}</Text>
          </View>
          {cta}
        </View>
      ) : (
        <>
          <View style={styles.row}>
            <View style={styles.grow}>
              <Text testID="ref-card-value" style={[styles.value, { color: colors.accent }]}>
                {units.formatPace(refSPerKm)}
              </Text>
              <Text testID="ref-card-origin" style={[styles.meta, { color: colors.textMuted }]}>
                {origin.kind === 'record'
                  ? t('running.refPace.origin.record', {
                      time: formatMmSs(origin.timeSeconds),
                      date: longDate(origin.achievedAt),
                    })
                  : t('running.refPace.origin.declared')}
              </Text>
            </View>
            {cta}
          </View>
          <TrainingPaceList refSPerKm={refSPerKm} tone="background" />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grow: { flex: 1, gap: 4 },
  value: { fontFamily: fontFamily.monoBold, fontSize: 30 },
  emptyTitle: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  meta: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17 },
  cta: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1.5, justifyContent: 'center' },
  ctaLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
});
