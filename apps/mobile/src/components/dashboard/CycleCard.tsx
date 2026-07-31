/**
 * Widget CYCLE-01 — suivi du cycle menstruel, décliné aux 3 formes.
 *
 *  - `small` : jour du cycle + phase ;
 *  - `wide`  : + la prochaine estimation, ou l'état d'attente ;
 *  - `large` : + un mini-calendrier de la **période en cours** et un accès direct à la saisie.
 *
 * ⚠️ Le mini-calendrier n'existait pas dans le code livré la nuit du 30 au 31/07 : ce commentaire
 * l'annonçait déjà, mais le rendu s'arrêtait à la prédiction + un lien texte. Ajouté ici (spec §R16
 * bis, tableau des formes) — une bande de pastilles colorées par intensité de flux, du début de la
 * période en cours à aujourd'hui. **Rien à afficher si aucune période n'est ouverte** : ce n'est pas
 * une régression, c'est l'état normal la plupart du temps.
 *
 * ⚠️ **Ce widget est le SEUL point d'entrée du suivi** — il n'y a pas d'onglet de navigation
 * (arbitrage du 31/07/2026, contre ce que proposait la maquette). Le cycle est une dimension
 * transverse comme le bien-être, pas un 4ᵉ pilier.
 *
 * ⚠️ Le registre le garde par **réglage** (`{ setting: 'cycleTrackingEnabled' }`) et non par pilier :
 * si le suivi est désactivé, ce composant n'est jamais monté. Il ne refait donc pas le test — mais
 * il ne doit **rien** afficher d'identifiable non plus si jamais il l'était.
 *
 * ⚠️ **Aucune phrase n'est construite ici** : tous les libellés viennent de l'i18n, tous les calculs
 * de `@wellness/shared`. C'est ce qui permet de relire toutes les formulations d'un coup.
 */

import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  cycleDayFor,
  cycleLengths,
  localDayKey,
  phaseForDate,
  predictNextPeriod,
  usableCycleLengths,
  formatDayFull,
  type MenstrualFlow,
  type WidgetSize,
} from '@wellness/shared';

import { Eyebrow, WidgetFrame } from '@/components/widgets/WidgetFrame';
import {
  useMenstrualDailyLogs,
  useMenstrualPeriods,
  useOpenPeriod,
} from '@/data/repositories/menstrual-cycle-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { useTodayKey } from '@/hooks/useTodayKey';

/** Intensité visuelle par flux — même échelle que `CycleMonthCalendar`. */
const FLOW_OPACITY: Record<MenstrualFlow, number> = {
  spotting: 0.3,
  light: 0.5,
  medium: 0.75,
  heavy: 1,
};

export function CycleCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const todayKey = useTodayKey();
  const { periods, isLoading } = useMenstrualPeriods();
  // Hooks inconditionnels : `useOpenPeriod`/`useMenstrualDailyLogs` sont toujours appelés, la donnée
  // n'est simplement pas utilisée quand `size !== 'large'` ou qu'aucune période n'est ouverte.
  const { period: openPeriod } = useOpenPeriod();
  const { logs } = useMenstrualDailyLogs(openPeriod?.startedOn);

  const periodDays = useMemo(() => {
    if (!openPeriod) return [];
    const flowByDate = new Map(logs.map((l) => [l.logDate, l.flow]));
    const days: { key: string; flow: MenstrualFlow | null }[] = [];
    // Construction locale par composants — `new Date("AAAA-MM-JJ")` parse en UTC (piège documenté
    // dans `formatDayFull`), ce qui décalerait la période d'un jour en fuseau négatif.
    const [y, m, dNum] = openPeriod.startedOn.split('-').map(Number);
    let cursor = new Date(y!, m! - 1, dNum!);
    while (localDayKey(cursor) <= todayKey) {
      const key = localDayKey(cursor);
      days.push({ key, flow: flowByDate.get(key) ?? null });
      cursor = addDays(cursor, 1);
    }
    return days;
  }, [openPeriod, logs, todayKey]);

  const view = useMemo(() => {
    const usable = usableCycleLengths(cycleLengths(periods)).usable;
    // Moyenne seulement si l'on a de quoi : sinon `phaseForDate` se taira, ce qui est voulu.
    const averageLength =
      usable.length > 0
        ? Math.round(usable.reduce((a, c) => a + c.length, 0) / usable.length)
        : null;
    return {
      day: cycleDayFor(todayKey, periods),
      phase: phaseForDate(todayKey, periods, averageLength),
      prediction: predictNextPeriod(periods, todayKey),
    };
  }, [periods, todayKey]);

  if (isLoading) return null;

  const open = () => router.push('/cycle');

  // ── Aucune donnée : une invitation, pas une carte morte ─────────────────────────────────────
  if (periods.length === 0) {
    return (
      <WidgetFrame pad={16} onPress={open} accessibilityLabel={t('cycle.widget.emptyA11y')}>
        <Eyebrow>{t('cycle.title')}</Eyebrow>
        <Text style={[styles.prompt, { color: colors.text }]}>{t('cycle.widget.emptyPrompt')}</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>{t('cycle.widget.emptyHint')}</Text>
      </WidgetFrame>
    );
  }

  const phaseLabel = view.phase ? t(`cycle.phase.${view.phase}`) : null;
  const dayLabel = view.day !== null ? t('cycle.widget.dayOfCycle', { day: view.day }) : null;

  // Annonce en texte de ce qui est affiché : le chiffre et la puce ne doivent pas porter seuls
  // l'information (même règle que les pas et le bien-être).
  const a11y = [dayLabel, phaseLabel].filter(Boolean).join(' · ') || t('cycle.widget.emptyA11y');

  const header = (
    <>
      <Eyebrow>{t('cycle.title')}</Eyebrow>
      <View style={styles.headline}>
        {dayLabel !== null && (
          <Text style={[styles.day, { color: colors.text }]} maxFontSizeMultiplier={1.4}>
            {dayLabel}
          </Text>
        )}
        {phaseLabel !== null && (
          <Text style={[styles.phase, { color: colors.accent, borderColor: colors.accent }]}>
            {phaseLabel}
          </Text>
        )}
      </View>
    </>
  );

  if (size === 'small') {
    return (
      <WidgetFrame pad={16} onPress={open} accessibilityLabel={a11y}>
        {header}
      </WidgetFrame>
    );
  }

  // ── Bloc prédiction — les trois états sont des affichages à part entière ─────────────────────
  const prediction = (() => {
    const p = view.prediction;
    if (p.status === 'insufficient') {
      return (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {t('cycle.prediction.insufficient', { count: p.cyclesNeeded - p.cyclesAvailable })}
        </Text>
      );
    }
    if (p.status === 'irregular') {
      // Aucune date : sur des cycles très dispersés, une estimation serait trompeuse.
      return (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {t('cycle.prediction.irregular')}
        </Text>
      );
    }
    return (
      <>
        <Text style={[styles.predLabel, { color: colors.textMuted }]}>
          {t('cycle.prediction.nextLabel')}
        </Text>
        <Text style={[styles.predValue, { color: colors.text }]}>
          {t('cycle.prediction.aroundDate', { date: formatDayFull(p.predictedOn) })}
        </Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {t('cycle.prediction.margin', { days: p.marginDays })}
        </Text>
      </>
    );
  })();

  if (size === 'wide') {
    return (
      <WidgetFrame pad={18} style={styles.col} onPress={open} accessibilityLabel={a11y}>
        {header}
        {prediction}
      </WidgetFrame>
    );
  }

  return (
    <WidgetFrame pad={22} style={styles.col} onPress={open} accessibilityLabel={a11y}>
      {header}
      {prediction}
      {periodDays.length > 0 && (
        <View style={styles.periodStrip} accessibilityLabel={t('cycle.widget.periodStripA11y')}>
          {periodDays.map((d) => (
            <View
              key={d.key}
              style={[
                styles.periodDot,
                {
                  backgroundColor: d.flow
                    ? colors.accent
                    : colors.surfaceAlt,
                  opacity: d.flow ? FLOW_OPACITY[d.flow] : 1,
                  borderColor: colors.border,
                },
              ]}
            />
          ))}
        </View>
      )}
      <Text style={[styles.cta, { color: colors.accent }]}>{t('cycle.widget.logToday')}</Text>
    </WidgetFrame>
  );
}

const styles = StyleSheet.create({
  col: { gap: 8 },
  headline: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  day: { fontFamily: fontFamily.displayBold, fontSize: 26 },
  phase: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 12,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  prompt: { fontFamily: fontFamily.bodySemi, fontSize: 15, marginTop: 6 },
  hint: { fontFamily: fontFamily.body, fontSize: 12, marginTop: 3 },
  predLabel: { fontFamily: fontFamily.body, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  predValue: { fontFamily: fontFamily.displaySemi, fontSize: 17 },
  cta: { fontFamily: fontFamily.bodySemi, fontSize: 13, marginTop: 2 },
  periodStrip: { flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  periodDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },
});
