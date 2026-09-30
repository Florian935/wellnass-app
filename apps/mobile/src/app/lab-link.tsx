/**
 * US LABO-03 — la fiche d'un lien : tout ce que le Labo sait d'une question, à un seul endroit.
 *
 * ── Ce que la fiche dit, dans cet ordre ──────────────────────────────────────────────────────────
 *  1. la question, la paire croisée et l'état du lien ;
 *  2. le verdict (deux phrases au plus, descriptives) et **deux chiffres**, un par côté du lien ;
 *  3. le graphique sur huit semaines — deux panneaux alignés quand deux échelles se croisent ;
 *  4. **ce que tes données croisent** : une ligne par analyse du catalogue qui entre dans la fiche ;
 *  5. ce que tu peux faire — un geste qui écrit passe par la feuille « ce qui change » (LABO-01 R4) ;
 *  6. l'histoire du lien, **figée** semaine par semaine (décision Q5) ;
 *  7. où le lien fait aussi écho dans l'app, et sur quoi il repose.
 *
 * Un lien « à découvrir » dit ce qui lui manque, et rien d'autre : jamais un zéro à la place d'un trou.
 */

import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  CROSS_LINK_IDS,
  CYCLE_PHASES,
  crossLinkHistory,
  crossLinkWeekKey,
  addDays,
  localDateFromDayKey,
  localDayKey,
  type CrossLink,
  type CrossLinkAction,
  type CrossLinkChart as Chart,
  type CrossLinkId,
  type CrossLinkState,
  type CycleMetric,
  type CyclePhase,
  type GoalConflict,
} from '@wellness/shared';

import { CouncilSheet } from '@/components/dashboard/CouncilSheet';
import { TrainingNutritionCrossCard } from '@/components/TrainingNutritionCrossCard';
import { CrossTrainingSection } from '@/components/nutrition/CrossTrainingSection';
import { CrossLinkChart } from '@/components/lab/CrossLinkChart';
import { actionLabel, actionWrites } from '@/components/lab/CrossLinkCard';
import { LabApplySheet, type LabChangeItem } from '@/components/lab/LabApplySheet';
import { LinkLens } from '@/components/lab/LinkLens';
import { dayMonth } from '@/components/lab/lab-format';
import { figureTexts, formatLinkValues, linkTexts, rowTexts, stateGlyph, stateTone } from '@/components/lab/link-format';
import { LINK_ROUTES } from '@/components/lab/link-routes';
import { PillarStage, useStageTheme } from '@/components/stage/PillarStage';
import { keepMainGoal, keepPillarGoal } from '@/data/goal-conflict-resolution';
import { useCycleInsights } from '@/data/repositories/cycle-insights-repository';
import { useCrossLinks } from '@/data/repositories/cross-links-repository';
import { applyAdaptationForToday, reschedulePlannedSession } from '@/data/repositories/planned-session-repository';
import { useActionLock } from '@/hooks/useActionLock';
import { useTodayKey } from '@/hooks/useTodayKey';
import { hapticConfirm, hapticSelect } from '@/lib/haptics';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * Le détail par phase du cycle : il lit tout l'historique, donc seulement sur cette fiche.
 *
 * Revue du 30/09/2026 — il reprend ce que disait l'ancien écran « Cycle › Croisement » : une mesure
 * pas encore lisible dit **ce qui lui manque** (« Encore 3 jours à enregistrer en phase lutéale »),
 * au lieu de disparaître en silence.
 */
function CycleDetail() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insights = useCycleInsights();
  if (insights.isLoading) return null;
  const keys = Object.keys(insights.byMetric) as CycleMetric[];
  const metrics = keys.flatMap((metric) => {
    const result = insights.byMetric[metric];
    if (result.status !== 'ready') return [];
    const byPhase = Object.fromEntries(CYCLE_PHASES.map((ph) => [ph, Math.round(result.byPhase[ph].average * 10) / 10])) as Record<CyclePhase, number>;
    return [{ metric, byPhase }];
  });
  const missing = keys.flatMap((metric) => {
    const result = insights.byMetric[metric];
    if (result.status !== 'insufficient') return [];
    const worst = CYCLE_PHASES.reduce<{ phase: CyclePhase; missing: number }>(
      (acc, p) => (result.missingByPhase[p] > acc.missing ? { phase: p, missing: result.missingByPhase[p] } : acc),
      { phase: 'menstrual', missing: 0 },
    );
    const detail =
      worst.missing > 0
        ? t('cycle.insights.missingSamples', { count: worst.missing, phase: t(`cycle.phase.${worst.phase}`) })
        : t('cycle.insights.missingCycles', { count: Math.max(1, result.cyclesNeeded - result.cyclesAvailable) });
    return [{ metric, detail }];
  });
  if (metrics.length === 0 && missing.length === 0) return null;
  const chart: Chart = { type: 'phases', metrics };
  return (
    <View style={styles.detail} testID="lab-link-detail-cycle">
      {metrics.length > 0 ? <CrossLinkChart chart={chart} /> : null}
      {missing.length > 0 ? (
        <View style={[styles.card, styles.cycleMissing, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.overline, { color: colors.pillarLab }]}>{t('lab.fiche.cycleMissingTitle').toUpperCase()}</Text>
          {missing.map((m) => (
            <View key={m.metric} style={styles.rowText} testID={`lab-cycle-missing-${m.metric}`}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>{t(`cycle.insights.metrics.${m.metric}`)}</Text>
              <Text style={[styles.rowNote, { color: colors.textMuted }]}>{m.detail}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * US ECHO-01 (décision Q3) — le détail de « Manges-tu assez pour ta muscu ? » : les deux cartes
 * croisées qui vivaient dans Stats nutrition (APPORT-01 : énergie et adhérence par type de jour,
 * jours à faible carburant, répartition des protéines ; MN-03 : charge muscu ↔ apports sur 8
 * semaines). Elles ont besoin de la muscu pour exister, donc elles ont déménagé ici, **entières** :
 * les lignes de la fiche les résument, elles en gardent le détail. Chacune se tait sans données.
 */
function FuelStrengthDetail() {
  return (
    <View style={styles.detail} testID="lab-link-detail-fuelStrength">
      <CrossTrainingSection />
      <TrainingNutritionCrossCard />
    </View>
  );
}

const isLinkId = (value: string | undefined): value is CrossLinkId => (CROSS_LINK_IDS as readonly string[]).includes(value ?? '');

export default function LabLinkScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { colors } = useTheme();
  const stage = useStageTheme('lab');
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; from?: string }>();
  const todayKey = useTodayKey();
  const lockApply = useActionLock();
  const shared = useCrossLinks();

  const [sheetFor, setSheetFor] = useState<CrossLinkAction | null>(null);
  // Par proposition, pas par fiche : la même fiche peut porter une seconde collision (revue du 30/09).
  const [applied, setApplied] = useState<string[]>([]);
  const [council, setCouncil] = useState<GoalConflict | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const id = isLinkId(params.id) ? params.id : null;
  const link: CrossLink | null = id === null ? null : (shared?.links.find((l) => l.id === id) ?? null);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/lab'));
  const backLabel = params.from === 'learn' ? t('lab.fiche.backLearn') : t('lab.fiche.back');

  const header = (
    <View style={styles.backRow}>
      <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={back} style={styles.back} hitSlop={8}>
        <Ionicons name="chevron-back" size={20} color={stage.ink} />
        <Text style={[styles.backText, { color: stage.ink }]}>{backLabel}</Text>
      </Pressable>
    </View>
  );

  if (link === null) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <StatusBar style="light" />
        <PillarStage pillar="lab">{header}</PillarStage>
        <Text style={[styles.empty, { color: colors.textMuted }]} testID="lab-link-missing">
          {shared === null || shared.isLoading ? '' : t('lab.fiche.notFound')}
        </Text>
      </View>
    );
  }

  const texts = linkTexts(t, locale, link);
  const tone = stateTone(colors, link.state);
  const figures = link.figures.map((f) => figureTexts(t, locale, f));
  const rows = link.rows.map((r) => ({ ...rowTexts(t, locale, r), state: r.state }));
  const history = crossLinkHistory(shared?.weeks ?? [], link.id, todayKey);
  const firstWeek = localDayKey(addDays(localDateFromDayKey(crossLinkWeekKey(todayKey)), -7 * (history.length - 1)));
  const historyKnown = history.some((h) => h !== null);

  const onAction = (action: CrossLinkAction) => {
    hapticSelect();
    if (action.type === 'council') {
      setCouncil(action.conflict);
      return;
    }
    if (action.type === 'open') {
      router.push(LINK_ROUTES[action.route]);
      return;
    }
    if (!actionWrites(action)) {
      if (action.proposal.action.type === 'open') router.push(LINK_ROUTES[action.proposal.action.target]);
      return;
    }
    // Un geste qui écrit ne part jamais au toucher : la feuille dit ce qui change, et où (R4).
    setSheetFor(action);
  };

  const sheetItems: LabChangeItem[] =
    sheetFor !== null && sheetFor.type === 'proposal'
      ? (() => {
          const p = sheetFor.proposal;
          const values = formatLinkValues(p.values, locale, t);
          return [
            {
              id: p.id,
              pillar: p.pair[0] === 'sleep' ? (p.pair[1] === 'sleep' ? 'running' : p.pair[1]) : p.pair[0],
              title: t(`lab.proposals.${p.kind}.changeTitle`, values),
              detail: t(`lab.proposals.${p.kind}.changeDetail`, values),
              where: t(`lab.proposals.${p.kind}.changeWhere`),
            },
          ];
        })()
      : [];

  const confirm = () =>
    lockApply(async () => {
      if (sheetFor === null || sheetFor.type !== 'proposal') return;
      setBusy(true);
      setError(null);
      try {
        const action = sheetFor.proposal.action;
        if (action.type === 'reschedule') await reschedulePlannedSession(action.plannedSessionId, action.toDayKey);
        else if (action.type === 'lighten') await applyAdaptationForToday(action.plannedSessionId, { repsReductionPct: action.repsReductionPct, paceSlowdownSPerKm: null });
        hapticConfirm();
        const appliedId = sheetFor.proposal.id;
        setApplied((current) => [...current, appliedId]);
        setSheetFor(null);
      } catch {
        setError(t('lab.apply.error'));
      } finally {
        setBusy(false);
      }
    });

  // Le signe d'une pastille : clair sur le corail et l'or, foncé sur le bronze (plus clair).
  const glyphColor = (h: CrossLinkState) => (h === 'adjust' ? colors.text : colors.background);
  const historyFill = (h: CrossLinkState | null) =>
    h === null ? 'transparent' : h === 'guard' ? colors.danger : h === 'adjust' ? colors.amber : h === 'holds' ? colors.pillarLab : 'transparent';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} testID={`lab-link-screen-${link.id}`}>
        <PillarStage pillar="lab">
          {header}
          <View style={styles.pairRow}>
            <LinkLens lens={link.lens} size={44} onDark dashed={link.state === 'discover'} />
            <Text style={[styles.pair, { color: stage.inkMuted }]}>{texts.pair}</Text>
          </View>
          <Text style={[styles.question, { color: stage.ink }]} accessibilityRole="header">
            {texts.question}
          </Text>
          <View style={[styles.stateChip, { backgroundColor: stage.glass, borderColor: stage.glassBorder }]}>
            <View
              style={[
                styles.stateDot,
                link.state === 'discover' ? { borderWidth: 1.5, borderStyle: 'dashed', borderColor: stage.ink } : { backgroundColor: tone.dot },
              ]}
            />
            <Text style={[styles.stateText, { color: stage.ink }]}>{texts.state}</Text>
          </View>
        </PillarStage>

        <View style={styles.body}>
          <Text style={[styles.verdict, { color: colors.text }]}>{texts.verdict}</Text>

          {link.state === 'discover' && texts.missing !== null ? (
            <View style={[styles.missing, { borderColor: colors.textMuted }]}>
              <Text style={[styles.overline, { color: colors.pillarLab }]}>{t('lab.fiche.missingTitle').toUpperCase()}</Text>
              <Text style={[styles.missingText, { color: colors.text }]}>{texts.missing}</Text>
              <View style={styles.meterRow}>
                <View style={[styles.meter, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.meterFill,
                      {
                        width: `${Math.round((Math.min(link.missing?.have ?? 0, link.missing?.need ?? 1) / Math.max(1, link.missing?.need ?? 1)) * 100)}%`,
                        backgroundColor: colors.pillarLab,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.meterText, { color: colors.textMuted }]}>{texts.meter}</Text>
              </View>
            </View>
          ) : null}

          {figures.length > 0 ? (
            <View style={styles.figures}>
              {figures.map((f, i) => (
                <View key={i} style={[styles.figure, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.figureValue, { color: colors.text }]}>{f.value}</Text>
                  <Text style={[styles.figureLabel, { color: colors.textMuted }]}>{f.label}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {link.id === 'cycle' ? <CycleDetail /> : link.chart !== null ? <CrossLinkChart chart={link.chart} /> : null}

          {rows.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={[styles.overline, { color: colors.pillarLab }]}>{t('lab.fiche.crossings').toUpperCase()}</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>{t('lab.fiche.measures', { count: rows.length })}</Text>
              </View>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {rows.map((r, i) => {
                  const rowTone = r.state === null ? null : stateTone(colors, r.state);
                  return (
                    <View key={i} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]} testID={`lab-link-row-${i}`}>
                      <View style={styles.rowText}>
                        <Text style={[styles.rowLabel, { color: colors.text }]}>{r.label}</Text>
                        <Text style={[styles.rowNote, { color: colors.textMuted }]}>{r.note}</Text>
                      </View>
                      <Text style={[styles.rowValue, { color: colors.text }]}>{r.value}</Text>
                      <View
                        accessibilityLabel={r.state === null ? undefined : t(`lab.links.states.${r.state}`)}
                        style={[
                          styles.rowDot,
                          rowTone === null ? null : rowTone.dashed ? { borderWidth: 1.5, borderStyle: 'dashed', borderColor: rowTone.border } : { backgroundColor: rowTone.dot },
                        ]}
                      >
                        {r.state !== null ? (
                          <Text style={[styles.glyph, styles.rowGlyph, { color: glyphColor(r.state) }]} importantForAccessibility="no">
                            {stateGlyph(r.state)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {link.id === 'fuelStrength' && link.state !== 'discover' ? <FuelStrengthDetail /> : null}

          {link.actions.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.overline, { color: colors.pillarLab }]}>{t('lab.fiche.actions').toUpperCase()}</Text>
              {link.actions.map((action, i) => {
                const writes = actionWrites(action);
                const done = writes && action.type === 'proposal' && applied.includes(action.proposal.id);
                return (
                  <Pressable
                    key={i}
                    testID={`lab-link-action-${i}`}
                    accessibilityRole="button"
                    disabled={done}
                    onPress={() => onAction(action)}
                    style={[
                      styles.action,
                      i === 0
                        ? { borderColor: colors.pillarLab, backgroundColor: done ? 'transparent' : colors.pillarLab }
                        : { borderColor: colors.border, backgroundColor: 'transparent' },
                    ]}
                  >
                    <Text style={[styles.actionText, { color: i === 0 ? (done ? colors.success : colors.background) : colors.text }]}>
                      {done ? t('lab.cross.applied') : actionLabel(t, locale, action)}
                    </Text>
                    <Text style={[styles.actionNote, { color: i === 0 && !done ? colors.background : colors.textMuted }]}>
                      {writes ? t('lab.fiche.writes') : t('lab.fiche.opens')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {link.state !== 'discover' ? (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={[styles.overline, { color: colors.pillarLab }]}>{t('lab.fiche.history').toUpperCase()}</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>{t('lab.fiche.historyMeta')}</Text>
              </View>
              <View style={[styles.card, styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.historyDots}>
                  {history.map((h, i) => {
                    const week = localDayKey(addDays(localDateFromDayKey(firstWeek), 7 * i));
                    return (
                      <View
                        key={i}
                        accessible
                        accessibilityLabel={
                          h === null
                            ? t('lab.fiche.historyWeekNone', { date: dayMonth(week) })
                            : t('lab.fiche.historyWeek', { date: dayMonth(week), state: t(`lab.links.states.${h}`) })
                        }
                        style={[
                          styles.historyDot,
                          { backgroundColor: historyFill(h) },
                          h === null ? { borderWidth: 1, borderColor: colors.border } : h === 'discover' ? { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.textMuted } : null,
                        ]}
                      >
                        {h !== null ? (
                          <Text style={[styles.glyph, { color: glyphColor(h) }]} importantForAccessibility="no">
                            {stateGlyph(h)}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
                <View style={styles.historyAxis}>
                  <Text style={[styles.historyAxisText, { color: colors.textMuted }]}>{dayMonth(firstWeek)}</Text>
                  <Text style={[styles.historyAxisText, { color: colors.textMuted }]}>{t('lab.fiche.historyNow')}</Text>
                </View>
                {!historyKnown || history.slice(0, -1).every((h) => h === null) ? (
                  <Text style={[styles.historyText, { color: colors.text }]}>{t('lab.fiche.historyEmpty')}</Text>
                ) : null}
                <Text style={[styles.historyLegend, { color: colors.textMuted }]}>{t('lab.fiche.historyLegend')}</Text>
              </View>
            </View>
          ) : null}

          {link.echoes.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.overline, { color: colors.pillarLab }]}>{t('lab.fiche.echoes').toUpperCase()}</Text>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {link.echoes.map((surface, i) => (
                  <View key={surface} style={[styles.echo, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <Ionicons name="git-compare-outline" size={17} color={colors.pillarLab} />
                    <Text style={[styles.echoText, { color: colors.text }]}>{t(`lab.links.surfaces.${surface}`)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <Text style={[styles.source, { color: colors.textMuted }]}>{texts.source}</Text>
        </View>
      </ScrollView>

      <LabApplySheet
        visible={sheetFor !== null}
        title={t('lab.apply.weekTitle')}
        subtitle={t('lab.apply.weekSubtitle', { count: sheetItems.length })}
        items={sheetItems}
        confirmLabel={t('lab.apply.confirm')}
        busy={busy}
        error={error}
        onConfirm={confirm}
        onClose={() => {
          setError(null);
          setSheetFor(null);
        }}
      />

      {council !== null ? (
        <CouncilSheet
          visible
          conflict={council}
          // Leçon CONF-06 (revue du 30/09/2026) : un choix qui ne s'écrit pas doit se voir.
          onKeepMainGoal={() => {
            void keepMainGoal(council).catch(() => Alert.alert(t('lab.apply.error')));
            setCouncil(null);
          }}
          onKeepPillarGoal={() => {
            void keepPillarGoal(council).catch(() => Alert.alert(t('lab.apply.error')));
            setCouncil(null);
          }}
          onClose={() => setCouncil(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingBottom: 40 },
  backRow: { flexDirection: 'row' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, marginLeft: -6, paddingRight: 8 },
  backText: { fontFamily: fontFamily.bodySemi, fontSize: 14.5 },
  pairRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  pair: { fontFamily: fontFamily.monoBold, fontSize: 11, letterSpacing: 1.4 },
  question: { fontFamily: fontFamily.displayXBold, fontSize: 27, lineHeight: 30, letterSpacing: -0.8, marginTop: 8 },
  stateChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 30, paddingHorizontal: 12, borderRadius: 15, borderWidth: 1, marginTop: 10 },
  stateDot: { width: 10, height: 10, borderRadius: 5 },
  stateText: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  body: { padding: 20, gap: 18 },
  verdict: { fontFamily: fontFamily.body, fontSize: 16, lineHeight: 23 },
  missing: { borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', padding: 16, gap: 10 },
  missingText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  meter: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  meterFill: { height: 6, borderRadius: 3 },
  meterText: { fontFamily: fontFamily.monoBold, fontSize: 11 },
  figures: { flexDirection: 'row', gap: 8 },
  figure: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 12, gap: 4 },
  figureValue: { fontFamily: fontFamily.monoBold, fontSize: 18 },
  figureLabel: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17 },
  section: { gap: 10 },
  detail: { gap: 12 },
  cycleMissing: { paddingVertical: 14, gap: 10 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  overline: { fontFamily: fontFamily.monoBold, fontSize: 11, letterSpacing: 1.4 },
  meta: { fontFamily: fontFamily.body, fontSize: 12 },
  card: { borderRadius: 22, borderWidth: 1, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontFamily: fontFamily.bodySemi, fontSize: 14, lineHeight: 18 },
  rowNote: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 16 },
  rowValue: { fontFamily: fontFamily.monoBold, fontSize: 13 },
  rowDot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontFamily: fontFamily.bodyBold, fontSize: 13, lineHeight: 16, textAlign: 'center' },
  rowGlyph: { fontSize: 11, lineHeight: 14 },
  action: { borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 12, gap: 2, minHeight: 52 },
  actionText: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  actionNote: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 16 },
  historyCard: { paddingVertical: 14, gap: 8 },
  historyDots: { flexDirection: 'row', justifyContent: 'space-between' },
  historyDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  historyAxis: { flexDirection: 'row', justifyContent: 'space-between' },
  historyAxisText: { fontFamily: fontFamily.mono, fontSize: 9.5 },
  historyText: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 19 },
  historyLegend: { fontFamily: fontFamily.body, fontSize: 11.5, lineHeight: 16 },
  echo: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  echoText: { flex: 1, fontFamily: fontFamily.body, fontSize: 13.5 },
  source: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 18, fontStyle: 'italic' },
  empty: { padding: 20, fontFamily: fontFamily.body, fontSize: 14 },
});
