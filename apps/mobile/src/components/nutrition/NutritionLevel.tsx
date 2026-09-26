/**
 * Le remplissage d'aujourd'hui, dans l'en-tête du hub Nutrition — US NUTRI-UX03, §4.2-1.
 *
 * C'est la scène de DASH-01 (« le remplissage ») et de NUTRI-UX02 (R10, R11) **moins la navigation
 * par jour** : plus de flèches, plus de trame des sept verres, plus de pastille « Revenir à
 * aujourd'hui ». Aujourd'hui est toujours aujourd'hui (D4, décision Q2) ; les jours passés vivent dans
 * Historique et sur leur page.
 *
 * ── Ce qui reste ──────────────────────────────────────────────────────────────────────────────────
 *  - le **niveau** qui monte derrière le texte (`NutritionLevelMatter`, posé en matière de l'en-tête) ;
 *  - le **grand chiffre** : ce qu'il reste, sinon le consommé ; le statut, la sous-ligne de détail et
 *    « Pourquoi ? » ;
 *  - les **tiges P/G/L**, avec leurs grammes et leur cible ;
 *  - la ligne du **jour sans saisie** le plus récent des six derniers (le « brouillard de confiance »
 *    de DASH-01), qui ouvre désormais la page de ce jour ;
 *  - les trois **ajouts rapides** et **« Chercher un aliment »**, avec **Scanner** à côté : le scan
 *    quitte la rangée d'icônes pour se ranger près du geste qu'il remplace.
 */

import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { addDays, localDateFromDayKey, localDayKey, weekLoggingConfidence } from '@wellness/shared';
import { ExplainButton } from '@/components/explain/ExplainButton';
import { AnimatedNumber, useLocaleSeparators } from '@/components/motion/AnimatedNumber';
import { PressableScale } from '@/components/motion/PressableScale';
import { useStageTheme } from '@/components/stage/PillarStage';
import { StageButton } from '@/components/stage/StageButton';
import { FillLevel } from '@/components/stage/matter/FillLevel';
import { useMonthTotals } from '@/data/repositories/journal-repository';
import { useLoopActive } from '@/hooks/useLoopActive';
import { fontFamily } from '@/theme/fonts';

/** Part de l'en-tête couverte par la jauge : le filet de cible est posé à 38 % du haut. */
const GAUGE_SPAN = 0.62;

export type QuickFood = { id: string; name: string; kcal: number; onAdd: () => void };
export type Macros = { protein: number; carbs: number; fat: number };

/** Le niveau et son filet, peints derrière l'en-tête (matière de `PillarStage`). */
export function NutritionLevelMatter({ consumedKcal, targetKcal }: { consumedKcal: number; targetKcal: number | null }) {
  const stage = useStageTheme('nutrition');
  const active = useLoopActive('nutrition');
  const ratio = targetKcal && targetKcal > 0 ? consumedKcal / targetKcal : 0;
  return (
    <>
      <FillLevel ratio={ratio} gaugeSpan={GAUGE_SPAN} active={active} fill={stage.fill!} wave={stage.wave!} />
      <View style={[styles.filet, { top: `${(1 - GAUGE_SPAN) * 100}%` }]} />
    </>
  );
}

type Props = {
  todayKey: string;
  consumedKcal: number;
  targetKcal: number | null;
  consumedMacros: Macros;
  targetMacros: Macros | null;
  trainingBonusKcal: number;
  quickFoods: readonly QuickFood[];
  /** Ouvre « Pourquoi ? » sur la cible calorique (§6.1) — absent quand il n'y a pas de cible. */
  onExplainTarget?: () => void;
  onSetTarget: () => void;
  onSearch: () => void;
  onScan: () => void;
  /** Ouvre la page d'un jour passé resté sans saisie. */
  onOpenDay: (dayKey: string) => void;
};

export function NutritionLevel(props: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n?.language ?? 'fr';
  const stage = useStageTheme('nutrition');
  const { groupSeparator, decimalSeparator } = useLocaleSeparators();
  const { todayKey, consumedKcal, targetKcal } = props;

  // Le brouillard de confiance porte sur les six jours avant aujourd'hui.
  const fromKey = useMemo(() => localDayKey(addDays(localDateFromDayKey(todayKey), -6)), [todayKey]);
  const { totals } = useMonthTotals(fromKey, todayKey);
  const confidence = useMemo(
    () => weekLoggingConfidence(totals.map((r) => ({ dayKey: r.logDate, kcal: r.kcal })), todayKey),
    [totals, todayKey],
  );
  const latestMissing = confidence.missingDayKeys[0];

  /**
   * US NUTRI-UX02 — **le grand chiffre dit ce qu'il RESTE**, plus ce qui a été mangé : le niveau
   * montre le consommé, le chiffre dit le restant, la sous-ligne porte le détail complet. Replis :
   * sans cible, ou cible atteinte, on revient au consommé.
   */
  const remaining = targetKcal !== null ? targetKcal - consumedKcal : null;
  const showRemaining = remaining !== null && remaining > 0;
  const heroValue = showRemaining ? remaining! : consumedKcal;

  const status = (() => {
    if (targetKcal === null) return t('stage.nutrition.noTarget');
    if (showRemaining) return t('stage.nutrition.stillAvailable');
    return remaining! < 0 ? t('stage.nutrition.over', { kcal: -remaining! }) : t('stage.nutrition.reached');
  })();

  const detail =
    targetKcal === null || !showRemaining
      ? null
      : props.trainingBonusKcal > 0
        ? t('stage.nutrition.detailWithBonus', {
            consumed: consumedKcal,
            target: targetKcal,
            bonus: props.trainingBonusKcal,
          })
        : t('stage.nutrition.detail', { consumed: consumedKcal, target: targetKcal });

  const stems: { key: keyof Macros; label: string; color: string }[] = [
    { key: 'protein', label: t('stage.nutrition.macroP'), color: '#e8f0d6' },
    { key: 'carbs', label: t('stage.nutrition.macroC'), color: '#f2d9a3' },
    { key: 'fat', label: t('stage.nutrition.macroF'), color: '#f0b79b' },
  ];

  const eyebrowDate = localDateFromDayKey(todayKey).toLocaleDateString(lang, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <View style={styles.root} testID="nutrition-level">
      <Text style={[styles.eyebrow, { color: stage.ink }]} numberOfLines={1}>
        {t('nutritionHub.eyebrow', { date: eyebrowDate })}
      </Text>

      {latestMissing ? (
        <Pressable onPress={() => props.onOpenDay(latestMissing)} accessibilityRole="button" style={styles.hazeLine}>
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
              value={heroValue}
              groupSeparator={groupSeparator}
              decimalSeparator={decimalSeparator}
              style={[styles.big, { color: stage.ink }]}
              accessibilityLabel={
                showRemaining
                  ? t('stage.nutrition.remainingA11y', { kcal: heroValue })
                  : t('stage.nutrition.consumedA11y', { kcal: heroValue })
              }
            />
            <Text style={[styles.unit, { color: stage.inkMuted }]}>{t('nutrition.kcal')}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[styles.status, { color: stage.ink }]}>{status}</Text>
            {targetKcal !== null && props.onExplainTarget ? (
              <ExplainButton onPress={props.onExplainTarget} color={stage.inkMuted} subject={t('journal.balance.target')} />
            ) : null}
          </View>
          {detail ? (
            <Text style={[styles.detail, { color: stage.inkMuted }]} numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
          {targetKcal === null ? (
            <Pressable onPress={props.onSetTarget} accessibilityRole="button" hitSlop={8}>
              <Text style={[styles.link, { color: stage.accent }]}>{t('journal.setTarget')}</Text>
            </Pressable>
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
                  <Text style={[styles.stemValue, { color: stage.ink }]}>
                    {t('stage.nutrition.macroGrams', { value, goal: Math.round(goal) })}
                  </Text>
                  <Text style={[styles.stemLabel, { color: stage.inkMuted }]}>{m.label}</Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      {props.quickFoods.length > 0 ? (
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
          icon="search"
          label={t('stage.nutrition.search')}
          onPress={props.onSearch}
          style={styles.flex}
        />
        <Pressable
          onPress={props.onScan}
          accessibilityRole="button"
          accessibilityLabel={t('scan.title')}
          style={[styles.scan, { backgroundColor: stage.glass, borderColor: stage.glassBorder }]}
        >
          <Ionicons name="barcode-outline" size={22} color={stage.ink} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  filet: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(232,240,214,0.45)',
  },
  eyebrow: { fontFamily: fontFamily.monoBold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 4 },
  hazeLine: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  hazeText: { fontFamily: fontFamily.bodyMedium, fontSize: 12.5, flexShrink: 1 },
  levelRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  levelTexts: { flex: 1, gap: 6 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  big: { fontFamily: fontFamily.displayXBold, fontSize: 60, letterSpacing: -2.6, lineHeight: 64 },
  unit: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  status: { fontFamily: fontFamily.displayBold, fontSize: 17, letterSpacing: -0.4 },
  detail: { fontFamily: fontFamily.mono, fontSize: 11, marginTop: 3 },
  link: { fontFamily: fontFamily.bodyBold, fontSize: 14, textDecorationLine: 'underline' },
  stems: { flexDirection: 'row', gap: 10, paddingBottom: 4 },
  stemCol: { alignItems: 'center', gap: 4 },
  stemTrack: { width: 14, height: 84, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' },
  stemFill: { position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: 7 },
  stemValue: { fontFamily: fontFamily.monoBold, fontSize: 10 },
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
  scan: { width: 52, minHeight: 50, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
