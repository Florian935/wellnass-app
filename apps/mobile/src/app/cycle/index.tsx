/**
 * US CYCLE-01 — écran de détail du suivi de cycle.
 *
 * Atteint **uniquement depuis le widget** : il n'y a pas d'onglet de navigation (arbitrage du
 * 31/07/2026). Le cycle est une dimension transverse, pas un 4ᵉ pilier.
 *
 * ⚠️ Le bandeau d'avertissement est posé **en tête, visible sans défilement** (spec §0). Ce n'est
 * pas une précaution de style : c'est ce qui empêche l'écran d'être lu comme un outil médical.
 *
 * ⚠️ **Aucune phrase n'est construite ici.** Tous les libellés viennent de l'i18n, tous les calculs
 * de `@wellness/shared` — c'est ce qui rend le critère de recette 14 (relecture de toutes les
 * formulations) faisable d'un coup.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  cycleDayFor,
  cycleLengths,
  formatDayFull,
  phaseForDate,
  predictNextPeriod,
  usableCycleLengths,
} from '@wellness/shared';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { CycleTrackingGuard } from '@/components/cycle/CycleTrackingGuard';
import { CycleDaySheet } from '@/components/cycle/CycleDaySheet';
import { CycleMonthCalendar } from '@/components/cycle/CycleMonthCalendar';
import {
  autoCloseStalePeriods,
  endPeriod,
  getMenstrualLogForDay,
  startPeriod,
  useMenstrualDailyLogs,
  useMenstrualPeriods,
  useOpenPeriod,
  useTodayMenstrualLog,
  type MenstrualDailyLog,
} from '@/data/repositories/menstrual-cycle-repository';
import { pushCycleData } from '@/lib/health-connect';
import { useTodayKey } from '@/hooks/useTodayKey';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function CycleScreen() {
  // Le garde enveloppe le contenu plutôt que de vivre dedans : tant que le suivi est éteint,
  // aucun hook de `menstrual-cycle-repository` ne s'exécute — la route ne lit rien.
  return (
    <CycleTrackingGuard>
      <CycleScreenContent />
    </CycleTrackingGuard>
  );
}

function CycleScreenContent() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const todayKey = useTodayKey();
  // Feuille de saisie : un seul état pour « aujourd'hui » (bouton d'action) ET n'importe quel jour
  // tappé au calendrier — plutôt que deux mécanismes qui finiraient par diverger.
  const [daySheet, setDaySheet] = useState<{ dateKey: string; existing: MenstrualDailyLog | null } | null>(
    null,
  );

  const { periods, isLoading } = useMenstrualPeriods();
  const { period: openPeriod } = useOpenPeriod();
  const { log: todayLog } = useTodayMenstrualLog();
  const { logs } = useMenstrualDailyLogs();

  const openDaySheet = async (dateKey: string) => {
    // Le jour courant est déjà chargé de façon réactive (todayLog) : pas de round-trip pour lui.
    const existing = dateKey === todayKey ? todayLog : await getMenstrualLogForDay(dateKey);
    setDaySheet({ dateKey, existing });
  };

  // R3 — clôture des périodes oubliées, **à l'ouverture de l'écran** et non sur un minuteur : c'est
  // une correction de saisie, pas un fait à horodater.
  useEffect(() => {
    void autoCloseStalePeriods(todayKey);
  }, [todayKey]);

  const view = useMemo(() => {
    const lengths = cycleLengths(periods);
    const { usable, ignored } = usableCycleLengths(lengths);
    const averageLength =
      usable.length > 0
        ? Math.round(usable.reduce((a, c) => a + c.length, 0) / usable.length)
        : null;
    const ignoredStarts = new Set(ignored.map((c) => c.startedOn));
    const lengthByStart = new Map(lengths.map((c) => [c.startedOn, c.length]));
    return {
      day: cycleDayFor(todayKey, periods),
      phase: phaseForDate(todayKey, periods, averageLength),
      prediction: predictNextPeriod(periods, todayKey),
      averageLength,
      usableCount: usable.length,
      ignoredStarts,
      lengthByStart,
    };
  }, [periods, todayKey]);

  if (isLoading) return null;

  const dayLabel = view.day !== null ? t('cycle.widget.dayOfCycle', { day: view.day }) : null;

  return (
    // `Screen` fournit la zone sûre du haut. Sans lui — et sans en-tête de navigation, la route
    // `cycle` n'étant pas déclarée dans le Stack racine — le titre se dessinait **sous la barre
    // d'état** : c'est le défaut PAS-01, invisible au typecheck comme aux tests jusqu'au
    // 14/08/2026. Le padding est repris de `Screen`, `page` ne garde que le bas et l'espacement.
    <Screen edges={['top']}>
      <ScrollView contentContainerStyle={styles.page}>
        <ScreenHeader title={t('cycle.title')} subtitle={t('cycle.subtitle')} />

        {/* Bandeau d'avertissement — en tête, jamais escamotable. */}
        <View
          style={[styles.disclaimer, { backgroundColor: colors.warn, borderColor: colors.warnBorder }]}
        >
          <Text style={[styles.disclaimerText, { color: colors.warnText }]}>
            {t('cycle.disclaimer')}
          </Text>
        </View>

        {/* ── État courant ─────────────────────────────────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {dayLabel !== null ? (
            <View style={styles.headline}>
              <Text style={[styles.day, { color: colors.text }]}>{dayLabel}</Text>
              {view.phase !== null && (
                <Text style={[styles.phase, { color: colors.accent, borderColor: colors.accent }]}>
                  {t(`cycle.phase.${view.phase}`)}
                </Text>
              )}
            </View>
          ) : (
            <Text style={[styles.empty, { color: colors.textMuted }]}>{t('cycle.noData')}</Text>
          )}

          <PredictionBlock prediction={view.prediction} />
        </View>

        {/* ── Actions ──────────────────────────────────────────────────────────────────────────── */}
        <View style={styles.actions}>
          {openPeriod === null ? (
            <Button
              label={t('cycle.actions.startPeriod')}
              onPress={() => void startPeriod(todayKey)}
            />
          ) : (
            <Button
              label={t('cycle.actions.endPeriod')}
              variant="ghost"
              // La période close devient exportable (R20/D) : synchro fire-and-forget, comme
              // `pushWorkout` à la clôture d'une séance — elle ne doit jamais bloquer l'UI.
              onPress={() =>
                void endPeriod(openPeriod.id, todayKey)
                  .then(() => void pushCycleData())
                  // Fire-and-forget assumé (voir ci-dessus) — mais capturé : une donnée de santé
                  // dont la synchro échoue ne doit pas produire un rejet non capturé au milieu de
                  // l'écran cycle.
                  .catch(() => undefined)
              }
            />
          )}
          <Button
            label={t('cycle.actions.logDay')}
            variant="ghost"
            onPress={() => void openDaySheet(todayKey)}
          />
          <Button
            label={t('cycle.actions.insights')}
            variant="ghost"
            onPress={() => router.push('/cycle/insights')}
          />
        </View>

        {/* ── Calendrier ───────────────────────────────────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
          {t('cycle.calendar.title')}
        </Text>
        <CycleMonthCalendar
          periods={periods}
          logs={logs}
          todayKey={todayKey}
          onSelectDay={(dateKey) => void openDaySheet(dateKey)}
        />

        {/* ── Historique ───────────────────────────────────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
          {t('cycle.history.title')}
        </Text>
        {periods.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>{t('cycle.history.empty')}</Text>
        ) : (
          [...periods].reverse().map((p) => {
            const length = view.lengthByStart.get(p.startedOn) ?? null;
            const ignored = view.ignoredStarts.has(p.startedOn);
            return (
              <View
                key={p.id}
                style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.rowMain}>
                  <Text style={[styles.rowDate, { color: colors.text }]}>
                    {p.endedOn
                      ? t('cycle.history.range', {
                          from: formatDayFull(p.startedOn),
                          to: formatDayFull(p.endedOn),
                        })
                      : t('cycle.history.ongoing', { from: formatDayFull(p.startedOn) })}
                  </Text>
                  {/* Un cycle aberrant reste VISIBLE et signalé — l'app n'efface jamais une saisie. */}
                  {ignored && (
                    <Text style={[styles.ignored, { color: colors.warnText }]}>
                      {t('cycle.history.ignored')}
                    </Text>
                  )}
                </View>
                {length !== null && (
                  <Text style={[styles.rowLength, { color: ignored ? colors.warnText : colors.textMuted }]}>
                    {t('cycle.history.cycleLength', { days: length })}
                  </Text>
                )}
              </View>
            );
          })
        )}

        <CycleDaySheet
          visible={daySheet !== null}
          onClose={() => setDaySheet(null)}
          logDate={daySheet?.dateKey ?? todayKey}
          existing={daySheet?.existing ?? null}
        />
      </ScrollView>
    </Screen>
  );
}

/** Les 3 états de la prédiction — chacun est un affichage à part entière, pas une erreur. */
function PredictionBlock({
  prediction,
}: {
  prediction: ReturnType<typeof predictNextPeriod>;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  if (prediction.status === 'insufficient') {
    return (
      <Text style={[styles.pred, { color: colors.textMuted }]}>
        {t('cycle.prediction.insufficient', {
          count: prediction.cyclesNeeded - prediction.cyclesAvailable,
        })}
      </Text>
    );
  }

  if (prediction.status === 'irregular') {
    return (
      <Text style={[styles.pred, { color: colors.textMuted }]}>
        {t('cycle.prediction.irregular')}
      </Text>
    );
  }

  return (
    <View style={styles.predBlock}>
      <Text style={[styles.predLabel, { color: colors.textMuted }]}>
        {t('cycle.prediction.nextLabel')}
      </Text>
      <Text style={[styles.predValue, { color: colors.text }]}>
        {t('cycle.prediction.aroundDate', { date: formatDayFull(prediction.predictedOn) })}
      </Text>
      <Text style={[styles.pred, { color: colors.textMuted }]}>
        {t('cycle.prediction.margin', { days: prediction.marginDays })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Le rembourrage vient de `Screen` : le répéter ici doublerait les marges latérales.
  page: { paddingBottom: 48, gap: 12 },
  disclaimer: { borderWidth: 1, borderRadius: 12, padding: 12 },
  disclaimerText: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 18 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  headline: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  day: { fontFamily: fontFamily.displayBold, fontSize: 30 },
  phase: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 12,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  predBlock: { gap: 2 },
  predLabel: { fontFamily: fontFamily.body, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  predValue: { fontFamily: fontFamily.displaySemi, fontSize: 18 },
  pred: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 18 },
  actions: { gap: 8 },
  sectionTitle: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginTop: 8,
  },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowMain: { flex: 1, gap: 3 },
  rowDate: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  rowLength: { fontFamily: fontFamily.mono, fontSize: 13 },
  ignored: { fontFamily: fontFamily.body, fontSize: 11.5 },
  empty: { fontFamily: fontFamily.body, fontSize: 13 },
});
