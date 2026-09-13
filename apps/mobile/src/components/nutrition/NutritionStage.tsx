/**
 * US DASH-01 — la scène du pilier Nutrition : « le remplissage » (spec §4.2).
 *
 * Remplace, en tête du journal, l'en-tête, la navigation de jour, la trame de la semaine, la carte
 * « Bilan du jour » et les trois macros : cinq blocs devenus une seule surface.
 *
 * ── Ce que la scène montre ────────────────────────────────────────────────────────────────────────
 *  - le **niveau** : consommé / cible du jour affiché, plafonné au filet de cible (jamais de
 *    débordement ; au-delà, le texte dit l'excédent) ;
 *  - les **7 verres** de la semaine du jour sélectionné — un tap change de jour, les jours futurs
 *    sont inertes ;
 *  - le **brouillard de confiance** : un jour passé sans saisie est dessiné en pointillé, et la scène
 *    nomme le plus récent — c'est la donnée qui affinerait le plus les conseils ;
 *  - l'**ajout rapide** des aliments récents (aujourd'hui seulement), la **photo** du repas et la
 *    recherche.
 */

import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  dayFill,
  localDateFromDayKey,
  localDayKey,
  startOfWeek,
  weekLoggingConfidence,
} from '@wellness/shared';
import { ExplainButton } from '@/components/explain/ExplainButton';
import { AnimatedNumber, useLocaleSeparators } from '@/components/motion/AnimatedNumber';
import { PressableScale } from '@/components/motion/PressableScale';
import { PillarStage, useStageTheme } from '@/components/stage/PillarStage';
import { StageButton } from '@/components/stage/StageButton';
import { StageIconButton } from '@/components/stage/StageIconButton';
import { FillLevel } from '@/components/stage/matter/FillLevel';
import { useMonthTotals } from '@/data/repositories/journal-repository';
import { useLoopActive } from '@/hooks/useLoopActive';
import { fontFamily } from '@/theme/fonts';

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
/** Part de la scène couverte par la jauge : le filet de cible est posé à 38 % du haut. */
const GAUGE_SPAN = 0.62;

export type QuickFood = { id: string; name: string; kcal: number; onAdd: () => void };
export type Macros = { protein: number; carbs: number; fat: number };

type Props = {
  day: string;
  todayKey: string;
  dayLabel: string;
  consumedKcal: number;
  targetKcal: number | null;
  consumedMacros: Macros;
  targetMacros: Macros | null;
  trainingBonusKcal: number;
  quickFoods: readonly QuickFood[];
  /** Ouvre « Pourquoi ? » sur la cible calorique (§6.1) — absent quand il n'y a pas de cible. */
  onExplainTarget?: () => void;
  onSelectDay: (dayKey: string) => void;
  onOpenCalendar: () => void;
  onSetTarget: () => void;
  onPhoto: () => void;
  onSearch: () => void;
  onScan: () => void;
  onStats: () => void;
  onProfile: () => void;
};

export function NutritionStage(props: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n?.language ?? 'fr';
  const stage = useStageTheme('nutrition');
  const active = useLoopActive('nutrition');
  const { groupSeparator, decimalSeparator } = useLocaleSeparators();
  const { day, todayKey, consumedKcal, targetKcal } = props;
  const isToday = day === todayKey;

  const weekDays = useMemo(() => {
    const start = startOfWeek(localDateFromDayKey(day));
    return Array.from({ length: 7 }, (_, i) => localDayKey(addDays(start, i)));
  }, [day]);

  // La confiance porte sur les 6 jours avant aujourd'hui, quelle que soit la semaine affichée.
  const confidenceFrom = useMemo(() => localDayKey(addDays(localDateFromDayKey(todayKey), -6)), [todayKey]);
  const rangeFrom = weekDays[0]! < confidenceFrom ? weekDays[0]! : confidenceFrom;
  const rangeTo = weekDays[6]! > todayKey ? weekDays[6]! : todayKey;
  const { totals } = useMonthTotals(rangeFrom, rangeTo);
  const kcalByDay = useMemo(() => new Map(totals.map((r) => [r.logDate, r.kcal])), [totals]);
  const confidence = useMemo(
    () => weekLoggingConfidence(totals.map((r) => ({ dayKey: r.logDate, kcal: r.kcal })), todayKey),
    [totals, todayKey],
  );
  const missing = new Set(confidence.missingDayKeys);

  const ratio = targetKcal && targetKcal > 0 ? consumedKcal / targetKcal : 0;
  const status = (() => {
    if (targetKcal === null) return t('stage.nutrition.noTarget');
    if (!isToday) return t('stage.nutrition.ofTarget', { kcal: targetKcal });
    const remaining = targetKcal - consumedKcal;
    if (remaining > 0) return t('stage.nutrition.remaining', { kcal: remaining });
    return remaining < 0 ? t('stage.nutrition.over', { kcal: -remaining }) : t('stage.nutrition.reached');
  })();

  const stems: { key: keyof Macros; label: string; color: string }[] = [
    { key: 'protein', label: t('stage.nutrition.macroP'), color: '#e8f0d6' },
    { key: 'carbs', label: t('stage.nutrition.macroC'), color: '#f2d9a3' },
    { key: 'fat', label: t('stage.nutrition.macroF'), color: '#f0b79b' },
  ];

  const latestMissing = isToday ? confidence.missingDayKeys[0] : undefined;

  return (
    <PillarStage
      pillar="nutrition"
      testID="nutrition-stage"
      matter={
        <>
          <FillLevel ratio={ratio} gaugeSpan={GAUGE_SPAN} active={active} fill={stage.fill!} wave={stage.wave!} />
          <View style={[styles.filet, { top: `${(1 - GAUGE_SPAN) * 100}%` }]} />
        </>
      }
    >
      <View style={styles.topRow}>
        <View style={styles.dayNav}>
          <StageIconButton
            icon="chevron-back"
            label={t('journal.prevDay')}
            onPress={() => props.onSelectDay(shiftDay(day, -1))}
            color={stage.inkMuted}
            size={19}
          />
          {/* Le libellé du jour ouvre le calendrier — l'affordance est le chevron (R3.1 du journal). */}
          <Pressable
            onPress={props.onOpenCalendar}
            accessibilityRole="button"
            accessibilityLabel={t('journal.calendar.open')}
            hitSlop={8}
            style={styles.dayButton}
          >
            <Text style={[styles.eyebrow, { color: stage.ink }]} numberOfLines={1}>
              {isToday ? t('journal.today') : props.dayLabel}
            </Text>
            <Ionicons name="chevron-down" size={13} color={stage.inkMuted} />
          </Pressable>
          <StageIconButton
            icon="chevron-forward"
            label={t('journal.nextDay')}
            onPress={() => props.onSelectDay(shiftDay(day, 1))}
            color={stage.inkMuted}
            size={19}
          />
        </View>
        <View style={styles.icons}>
          <StageIconButton icon="barcode-outline" label={t('scan.title')} onPress={props.onScan} color={stage.ink} />
          <StageIconButton icon="stats-chart-outline" label={t('stats.title')} onPress={props.onStats} color={stage.ink} />
          <StageIconButton icon="options-outline" label={t('nutrition.title')} onPress={props.onProfile} color={stage.ink} />
        </View>
      </View>

      <View style={styles.glasses}>
        {weekDays.map((key, i) => {
          const future = key > todayKey;
          const selected = key === day;
          const fill = dayFill(kcalByDay.get(key) ?? 0, targetKcal);
          const pct = fill === 'complete' ? 100 : fill === 'partial' ? 55 : 0;
          const hazy = missing.has(key);
          return (
            <PressableScale
              key={key}
              haptic="select"
              disabled={future}
              onPress={() => props.onSelectDay(key)}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: future }}
              accessibilityLabel={t(`journal.calendar.dayA11y.${future ? 'empty' : fill}`, {
                day: localDateFromDayKey(key).getDate(),
              })}
              style={styles.glassCol}
            >
              <View
                style={[
                  styles.glass,
                  {
                    borderColor: selected ? stage.ink : 'rgba(255,255,255,0.28)',
                    borderWidth: selected ? 2 : 1.5,
                    borderStyle: hazy ? 'dashed' : 'solid',
                    opacity: future ? 0.4 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.glassFill,
                    { height: `${pct}%`, backgroundColor: selected ? stage.accent : 'rgba(169,186,126,0.75)' },
                  ]}
                />
              </View>
              <Text style={[styles.weekday, { color: selected ? stage.ink : stage.inkMuted }]}>
                {t(`common.weekdayShort.${WEEKDAY_KEYS[i]}`)}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {latestMissing ? (
        <Pressable
          onPress={() => props.onSelectDay(latestMissing)}
          accessibilityRole="button"
          style={styles.hazeLine}
        >
          <Ionicons name="ellipsis-horizontal" size={14} color={stage.inkMuted} />
          <Text style={[styles.hazeText, { color: stage.inkMuted }]} numberOfLines={2}>
            {t('stage.nutrition.missingDay', {
              day: localDateFromDayKey(latestMissing).toLocaleDateString(lang, { weekday: 'long', day: 'numeric' }),
              count: confidence.missingDayKeys.length,
            })}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.levelRow}>
        <View style={styles.levelTexts}>
          <View style={styles.bigRow}>
            <AnimatedNumber
              testID="stage-kcal"
              value={consumedKcal}
              groupSeparator={groupSeparator}
              decimalSeparator={decimalSeparator}
              style={[styles.big, { color: stage.ink }]}
              accessibilityLabel={t('stage.nutrition.consumedA11y', { kcal: consumedKcal })}
            />
            <Text style={[styles.unit, { color: stage.inkMuted }]}>{t('nutrition.kcal')}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[styles.status, { color: stage.ink }]}>{status}</Text>
            {targetKcal !== null && props.onExplainTarget ? (
              <ExplainButton
                onPress={props.onExplainTarget}
                color={stage.inkMuted}
                subject={t('journal.balance.target')}
              />
            ) : null}
          </View>
          {targetKcal === null ? (
            <Pressable onPress={props.onSetTarget} accessibilityRole="button" hitSlop={8}>
              <Text style={[styles.link, { color: stage.accent }]}>{t('journal.setTarget')}</Text>
            </Pressable>
          ) : null}
          {props.trainingBonusKcal > 0 ? (
            <View style={[styles.chip, { backgroundColor: stage.glass, borderColor: stage.glassBorder }]}>
              <Text style={[styles.chipText, { color: stage.ink }]}>
                {t('stage.nutrition.trainingBonus', { kcal: props.trainingBonusKcal })}
              </Text>
            </View>
          ) : null}
        </View>
        {props.targetMacros ? (
          <View style={styles.stems}>
            {stems.map((m) => {
              const goal = props.targetMacros![m.key];
              const value = Math.round(props.consumedMacros[m.key]);
              const pct = goal > 0 ? Math.min(1, props.consumedMacros[m.key] / goal) : 0;
              return (
                <View
                  key={m.key}
                  accessible
                  accessibilityLabel={t('stage.nutrition.macroA11y', {
                    macro: t(`nutrition.macros.${m.key}`),
                    value,
                    goal: Math.round(goal),
                  })}
                  style={styles.stemCol}
                >
                  <View style={styles.stemTrack}>
                    <View style={[styles.stemFill, { height: `${pct * 100}%`, backgroundColor: m.color }]} />
                  </View>
                  <Text style={[styles.stemLabel, { color: stage.ink }]}>{m.label}</Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      {isToday && props.quickFoods.length > 0 ? (
        <View style={styles.quickRow}>
          {props.quickFoods.slice(0, 3).map((food) => (
            <PressableScale
              key={food.id}
              haptic="confirm"
              onPress={food.onAdd}
              accessibilityRole="button"
              accessibilityLabel={t('stage.nutrition.quickAddA11y', { name: food.name, kcal: food.kcal })}
              style={[styles.quick, { backgroundColor: stage.glass, borderColor: stage.glassBorder }]}
            >
              <Ionicons name="add" size={14} color={stage.ink} />
              <Text style={[styles.quickName, { color: stage.ink }]} numberOfLines={1}>
                {food.name}
              </Text>
              <Text style={[styles.quickKcal, { color: stage.inkMuted }]}>{food.kcal}</Text>
            </PressableScale>
          ))}
        </View>
      ) : null}

      <View style={styles.ctaRow}>
        <StageButton
          pillar="nutrition"
          icon="camera-outline"
          label={t('stage.nutrition.photo')}
          onPress={props.onPhoto}
          style={styles.flex}
        />
        <StageButton
          pillar="nutrition"
          variant="glass"
          icon="search"
          label={t('stage.nutrition.search')}
          onPress={props.onSearch}
          style={styles.searchButton}
        />
      </View>
    </PillarStage>
  );
}

/** Décale une clé de jour de `n` jours, sur les composants de date (« 2026-08-00 » n'existe pas). */
function shiftDay(dayKey: string, n: number): string {
  return localDayKey(addDays(localDateFromDayKey(dayKey), n));
}

const styles = StyleSheet.create({
  filet: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(232,240,214,0.45)',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  dayNav: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  dayButton: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1, minHeight: 44, paddingHorizontal: 2 },
  eyebrow: { fontFamily: fontFamily.monoBold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', flexShrink: 1 },
  icons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  glasses: { flexDirection: 'row', gap: 8 },
  glassCol: { flex: 1, alignItems: 'center', gap: 5 },
  glass: {
    width: '100%',
    height: 40,
    borderRadius: 3,
    borderBottomLeftRadius: 9,
    borderBottomRightRadius: 9,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  glassFill: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  weekday: { fontFamily: fontFamily.mono, fontSize: 10 },
  hazeLine: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  hazeText: { fontFamily: fontFamily.bodyMedium, fontSize: 12.5, flexShrink: 1 },
  levelRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 28 },
  levelTexts: { flex: 1, gap: 6 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  big: { fontFamily: fontFamily.displayXBold, fontSize: 60, letterSpacing: -2.6, lineHeight: 64 },
  unit: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  status: { fontFamily: fontFamily.displayBold, fontSize: 17, letterSpacing: -0.4 },
  link: { fontFamily: fontFamily.bodyBold, fontSize: 14, textDecorationLine: 'underline' },
  chip: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontFamily: fontFamily.bodySemi, fontSize: 11.5 },
  stems: { flexDirection: 'row', gap: 10, paddingBottom: 4 },
  stemCol: { alignItems: 'center', gap: 5 },
  stemTrack: { width: 14, height: 84, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' },
  stemFill: { position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: 7 },
  stemLabel: { fontFamily: fontFamily.mono, fontSize: 10 },
  quickRow: { flexDirection: 'row', gap: 7 },
  quick: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  quickName: { fontFamily: fontFamily.bodyBold, fontSize: 12.5, flexShrink: 1 },
  quickKcal: { fontFamily: fontFamily.mono, fontSize: 10 },
  ctaRow: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  searchButton: { width: 112 },
});
