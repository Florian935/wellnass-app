/**
 * Widget BIEN-01 — check-in de bien-être, décliné aux 3 formes de la galerie « FitTrio · Widgets ».
 *
 *  - `small` : état du jour (fait / à faire) ;
 *  - `wide`  : les 3 indicateurs du jour ;
 *  - `large` : idem + mini-tendance de l'humeur sur 7 jours.
 *
 * Widget **transverse** (`pillars: 'always'` au registre) : le bien-être n'appartient à aucun des
 * trois piliers — ce n'est **pas** un 4ᵉ pilier activable, et un utilisateur « nutrition seule » doit
 * y avoir accès (critère de recette 9).
 *
 * Le widget est aussi le **point d'entrée unique** du check-in : un tap ouvre la feuille (décision
 * D7), sans passer par un écran intermédiaire — c'est ce qui tient le rituel sous 10 s.
 */

import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ROLLING_WEEK_DAYS,
  WELLBEING_INDICATORS,
  isWellbeingLevel,
  wellbeingSeries,
  type WellbeingLevel,
  type WidgetSize,
} from '@wellness/shared';

import { Eyebrow, WidgetFrame } from '@/components/widgets/WidgetFrame';
import { Sparkline } from '@/components/widgets/primitives';
import { WellbeingLevelSummary, useLevelLabel } from '@/components/wellbeing/WellbeingScale';
import { WellbeingCheckinSheet } from '@/components/wellbeing/WellbeingCheckinSheet';
import {
  useTodayWellbeing,
  useWellbeingRows,
} from '@/data/repositories/daily-wellbeing-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { useTodayKey, useWindowStartKey } from '@/hooks/useTodayKey';


export function WellbeingCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const levelLabel = useLevelLabel();
  const [sheetOpen, setSheetOpen] = useState(false);

  // `todayKey` alimente `logDate` de la feuille de saisie : gelé, un check-in aurait écrit sur le
  // jour du montage de la carte.
  const todayKey = useTodayKey();
  const { entry, isLoading } = useTodayWellbeing();
  const weekStartKey = useWindowStartKey(ROLLING_WEEK_DAYS);
  const { rows } = useWellbeingRows(weekStartKey);

  if (isLoading) return null;

  const sheet = (
    <WellbeingCheckinSheet
      visible={sheetOpen}
      onClose={() => setSheetOpen(false)}
      logDate={todayKey}
      existing={entry}
    />
  );

  // ── Pas encore de check-in aujourd'hui : une invitation, pas une carte morte ────────────────
  if (entry === null) {
    return (
      <>
        <WidgetFrame
          pad={16}
          onPress={() => setSheetOpen(true)}
          accessibilityLabel={t('wellbeing.a11yOpenCheckin')}
          accessibilityHint={t('wellbeing.checkinHint')}
        >
          <Eyebrow>{t('wellbeing.title')}</Eyebrow>
          <Text style={[styles.prompt, { color: colors.text }]}>
            {t('wellbeing.checkinPrompt')}
          </Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {t('wellbeing.checkinHint')}
          </Text>
        </WidgetFrame>
        {sheet}
      </>
    );
  }

  // Annonce en **texte** de ce qui est saisi : les pictogrammes ne doivent pas porter seuls
  // l'information (accessibilité — même règle que la progression des pas).
  const spoken = WELLBEING_INDICATORS.filter((i) => isWellbeingLevel(entry[i]))
    .map(
      (i) =>
        `${t(`wellbeing.indicators.${i}`)} : ${levelLabel(i, entry[i] as WellbeingLevel)}`,
    )
    .join(', ');
  const a11y = spoken.length > 0 ? spoken : t('wellbeing.checkinDone');

  // ── Petit carré ─────────────────────────────────────────────────────────────────────────────
  if (size === 'small') {
    return (
      <>
        <WidgetFrame pad={16} onPress={() => setSheetOpen(true)} accessibilityLabel={a11y}>
          <Eyebrow>{t('wellbeing.title')}</Eyebrow>
          <Text style={[styles.prompt, { color: colors.text }]}>
            {t('wellbeing.checkinDone')}
          </Text>
        </WidgetFrame>
        {sheet}
      </>
    );
  }

  const trio = (
    <View style={styles.trio}>
      {WELLBEING_INDICATORS.map((indicator) => {
        const level = entry[indicator];
        if (!isWellbeingLevel(level)) {
          // Indicateur non renseigné (saisie partielle, décision D3) : un tiret, jamais un 0.
          return (
            <View
              key={indicator}
              style={[styles.empty, { borderColor: colors.border }]}
              accessibilityLabel={`${t(`wellbeing.indicators.${indicator}`)} : ${t('wellbeing.notLogged')}`}
            >
              <Text style={[styles.dash, { color: colors.textMuted }]}>—</Text>
              <Text style={[styles.emptyCaption, { color: colors.textMuted }]}>
                {t(`wellbeing.indicators.${indicator}`)}
              </Text>
            </View>
          );
        }
        return <WellbeingLevelSummary key={indicator} indicator={indicator} level={level} />;
      })}
    </View>
  );

  // ── Rectangle ───────────────────────────────────────────────────────────────────────────────
  if (size === 'wide') {
    return (
      <>
        <WidgetFrame
          pad={18}
          style={styles.col}
          onPress={() => setSheetOpen(true)}
          accessibilityLabel={a11y}
        >
          <Eyebrow>{t('wellbeing.title')}</Eyebrow>
          {trio}
        </WidgetFrame>
        {sheet}
      </>
    );
  }

  // ── Grand carré : + tendance de l'humeur ────────────────────────────────────────────────────
  const mood = wellbeingSeries(rows, 'mood', 7, todayKey).map((p) => p.value);

  return (
    <>
      <WidgetFrame
        pad={22}
        style={styles.col}
        onPress={() => router.push('/wellbeing')}
        accessibilityLabel={a11y}
      >
        <Eyebrow>{t('wellbeing.title')}</Eyebrow>
        {trio}
        {/* Une seule valeur n'est pas une tendance : on ne trace rien plutôt qu'une ligne plate. */}
        {mood.length >= 2 && (
          <>
            <Sparkline values={mood} height={44} color={colors.accent} />
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              {t('wellbeing.indicators.mood')}
            </Text>
          </>
        )}
      </WidgetFrame>
      {sheet}
    </>
  );
}

const styles = StyleSheet.create({
  col: { gap: 10 },
  prompt: { fontFamily: fontFamily.bodySemi, fontSize: 15, marginTop: 6 },
  hint: { fontFamily: fontFamily.body, fontSize: 12, marginTop: 3 },
  trio: { flexDirection: 'row', gap: 8 },
  empty: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 2,
  },
  dash: { fontFamily: fontFamily.bodySemi, fontSize: 18 },
  emptyCaption: { fontFamily: fontFamily.body, fontSize: 10, textTransform: 'uppercase' },
});
