import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useTranslation } from 'react-i18next';
import {
  BODY_BASES, BODY_GOAL_ZONES, BODY_SHAPE_ZONES, bodyGoalUsesCurrentBaseline, bodyGoalZones,
  bodyVisualDirty, createBodyVisualDocument, createBodyVisualGoal,
  type BodyGoalZone, type BodyShapeZone, type BodyVisualZone,
} from '@wellness/shared';
import { saveBodyVisual, type useBodyVisual } from '@/data/repositories/body-visual-repository';
import { useActionLock } from '@/hooks/useActionLock';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { BodyShapeFigure } from './BodyShapeFigure';
import { BodyShapeControl } from './BodyShapeControl';
import { BodyMeasurementReferences } from './BodyMeasurementReferences';

type Mode = 'baseline' | 'goal' | 'compare';

export function BodyShapeEditor({ source }: { source: ReturnType<typeof useBodyVisual> }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const { height, width } = useWindowDimensions();
  const [draft, setDraft] = useState(() => source.document ?? createBodyVisualDocument());
  const [saved, setSaved] = useState(source.document);
  const [expectedRaw, setExpectedRaw] = useState(source.raw);
  const [pendingEcho, setPendingEcho] = useState<{ previousRaw: string | null } | null>(null);
  const [mode, setMode] = useState<Mode>('baseline');
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [shapeZone, setShapeZone] = useState<BodyShapeZone>('shoulders');
  const [goalZone, setGoalZone] = useState<BodyGoalZone>('shoulders');
  const [baselineOnly, setBaselineOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const runExclusive = useActionLock();
  const dirty = bodyVisualDirty(draft, saved);
  const blocked = source.status === 'invalid' || source.status === 'unsupported';
  // SQLite notifie ses lecteurs après la transaction. Cette ancienne lecture ne doit
  // jamais être présentée comme une nouvelle version à recharger après notre sauvegarde.
  if (pendingEcho && source.raw !== pendingEcho.previousRaw && !source.isLoading) setPendingEcho(null);
  const matchesSaved = source.document !== null && saved !== null && JSON.stringify(source.document) === JSON.stringify(saved);
  // Postgres peut réordonner les clés JSON sans changer le document. Le jeton CAS suit
  // alors cette représentation équivalente sans toucher au brouillon.
  if (matchesSaved && source.raw !== expectedRaw && source.raw !== pendingEcho?.previousRaw) setExpectedRaw(source.raw);
  const changedElsewhere = source.raw !== expectedRaw && !matchesSaved && source.raw !== pendingEcho?.previousRaw;
  const disabled = saving || blocked || !!source.error || source.isLoading;
  const goalMode = mode !== 'baseline';
  const selected = goalMode ? goalZone : shapeZone;
  const figureHeight = Math.min(280, Math.max(160, height * 0.28), Math.max(160, (width - 72) * 680 / 300));
  const zones = goalMode ? BODY_GOAL_ZONES : BODY_SHAPE_ZONES;
  const goal = draft.goal;
  const oldBaseline = goal !== null && !bodyGoalUsesCurrentBaseline(draft);

  usePreventRemove(dirty || saving, ({ data }) => {
    if (saving) return;
    Alert.alert(t('bodyShape.leaveTitle'), t('bodyShape.leaveHint'), [
      { text: t('bodyShape.stay'), style: 'cancel' },
      { text: t('bodyShape.discard'), style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const clearMessages = () => { setMessage(null); setFailure(null); };
  const choose = (zone: BodyVisualZone) => {
    if (disabled) return;
    if (goalMode && BODY_GOAL_ZONES.includes(zone as BodyGoalZone)) setGoalZone(zone as BodyGoalZone);
    if (!goalMode && BODY_SHAPE_ZONES.includes(zone as BodyShapeZone)) setShapeZone(zone as BodyShapeZone);
    if (zone === 'back' || zone === 'glutes') setSide('back');
    if (zone === 'chest') setSide('front');
  };
  const createGoal = () => {
    if (disabled) return;
    const replace = () => { setDraft(current => ({ ...current, goal: createBodyVisualGoal(current) })); clearMessages(); };
    if (goal && bodyGoalZones(goal.emphasis).length > 0) {
      Alert.alert(t('bodyShape.recreateTitle'), t('bodyShape.recreateHint'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('bodyShape.recreateConfirm'), style: 'destructive', onPress: replace },
      ]);
    } else replace();
  };
  const reload = () => {
    const replace = () => {
      setDraft(source.document ?? createBodyVisualDocument()); setSaved(source.document);
      setExpectedRaw(source.raw); clearMessages();
      setPendingEcho(null);
    };
    if (dirty) Alert.alert(t('bodyShape.reloadTitle'), t('bodyShape.reloadHint'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('bodyShape.reloadConfirm'), style: 'destructive', onPress: replace },
    ]); else replace();
  };
  const save = () => {
    if (disabled) return;
    void runExclusive(async () => {
      setSaving(true); clearMessages();
      try {
        const next = await saveBodyVisual(draft, expectedRaw);
        setPendingEcho({ previousRaw: source.raw });
        setDraft(next); setSaved(next); setExpectedRaw(JSON.stringify(next));
        setMessage(t('bodyShape.saved'));
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
        setFailure(t(code === 'conflict' ? 'bodyShape.errors.conflict'
          : code === 'settings_missing' || code === 'unauthenticated' ? 'bodyShape.errors.settings'
            : code === 'invalid' ? 'bodyShape.errors.invalid' : 'bodyShape.errors.save'));
      } finally { setSaving(false); }
    });
  };
  const textStyle = { color: colors.text };
  const mutedStyle = { color: colors.textMuted };
  const action = (label: string, onPress: () => void, primary = false, isDisabled = disabled) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled} onPress={onPress}
      style={[styles.action, { borderColor: colors.borderStrong, backgroundColor: primary ? colors.accent : colors.surface, opacity: isDisabled ? 0.5 : 1 }]}>
      <Text style={[styles.actionText, { color: primary ? colors.accentText : colors.text }]}>{label}</Text>
    </Pressable>
  );

  return <View style={styles.root}>
    <View style={styles.heading}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} disabled={saving}
        onPress={() => router.canGoBack() ? router.back() : router.replace('/body')} style={styles.back}>
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>
      <Text accessibilityRole="header" style={[styles.title, textStyle]}>{t('bodyShape.title')}</Text>
    </View>
    <Text style={[styles.note, mutedStyle]}>{t('bodyShape.subtitle')}</Text>
    {blocked ? <View style={styles.notice}>
      <Text accessibilityRole="alert" style={[styles.note, textStyle]}>{t(source.status === 'unsupported' ? 'bodyShape.unsupported' : 'bodyShape.invalid')}</Text>
    </View> : <>
      <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: colors.surfaceAlt }]}>
        {(['baseline', 'goal', 'compare'] as const).map(value => <Pressable key={value}
          accessibilityRole="tab" accessibilityLabel={t(`bodyShape.modes.${value}`)} accessibilityState={{ selected: mode === value }}
          onPress={() => { setMode(value); setBaselineOnly(false); }} style={[styles.tab, mode === value && { backgroundColor: colors.surface }]}>
          <Text style={[styles.tabText, { color: mode === value ? colors.accent : colors.text }]}>{t(`bodyShape.modes.${value}`)}</Text>
        </Pressable>)}
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {source.error ? <Text accessibilityRole="alert" style={[styles.note, textStyle]}>{t('bodyShape.errors.load')}</Text> : null}
        {changedElsewhere && !source.error && !source.isLoading ? <View style={styles.notice}>
          <Text style={[styles.note, textStyle]}>{t('bodyShape.newVersion')}</Text>
          {action(t('bodyShape.reload'), reload)}
        </View> : null}
        {goalMode && !goal ? <View style={[styles.empty, { backgroundColor: colors.surface }]}>
          <BodyShapeFigure shape={draft.baseline} side={side} height={figureHeight} />
          <Text style={[styles.sectionTitle, textStyle]}>{t('bodyShape.startGoalTitle')}</Text>
          <Text style={[styles.note, mutedStyle]}>{t('bodyShape.startGoalHint')}</Text>
          {action(t('bodyShape.createGoal'), createGoal, true)}
        </View> : <>
          <View style={[styles.canvas, { backgroundColor: colors.surface }]}>
            {goalMode ? <Text accessibilityRole="header" style={[styles.sectionTitle, textStyle]}>{t('bodyShape.illustrationTitle')}</Text> : null}
            <View accessibilityRole="tablist" style={styles.sides}>
              {(['front', 'back'] as const).map(value => <Pressable key={value} accessibilityRole="tab"
                accessibilityLabel={t(`bodyMap.${value}`)} accessibilityState={{ selected: side === value }}
                onPress={() => setSide(value)} style={[styles.sideTab, { borderColor: side === value ? colors.accent : colors.border }]}>
                <Text style={[styles.tabText, { color: side === value ? colors.accent : colors.textMuted }]}>{t(`bodyMap.${value}`)}</Text>
              </Pressable>)}
            </View>
            <View style={{ height: figureHeight, alignItems: 'center', justifyContent: 'center' }}>
              <BodyShapeFigure shape={goalMode && goal ? goal.baseline : draft.baseline}
                emphasis={goalMode && goal && !baselineOnly ? goal.emphasis : undefined} side={side} height={figureHeight}
                mode={goalMode ? 'goal' : 'baseline'} selected={mode === 'compare' ? null : selected}
                onSelect={mode === 'compare' || disabled ? undefined : choose} />
              {mode === 'compare' && goal && !baselineOnly ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ghost]}>
                <BodyShapeFigure shape={goal.baseline} side={side} height={figureHeight} outlineOnly />
              </View> : null}
            </View>
            <Text style={[styles.caption, mutedStyle]}>{t(mode === 'compare' ? 'bodyShape.compareHint' : 'bodyShape.selectHint')}</Text>
            {mode === 'compare' ? <>
              <View style={styles.legend}>
                <Text style={[styles.note, mutedStyle]}>{t('bodyShape.baselineLegend')}</Text>
                <Text style={[styles.note, textStyle]}>{t('bodyShape.goalLegend')}</Text>
              </View>
              {action(t(baselineOnly ? 'bodyShape.showComparison' : 'bodyShape.showBaseline'), () => setBaselineOnly(!baselineOnly))}
            </> : null}
          </View>
          {oldBaseline && goalMode ? <View style={styles.notice}>
            <Text style={[styles.note, textStyle]}>{t('bodyShape.oldBaseline')}</Text>
            {action(t('bodyShape.recreate'), createGoal)}
          </View> : null}
          {mode !== 'compare' ? <>
            <BodyShapeControl label={t(`bodyShape.zones.${selected}`)} goal={goalMode} disabled={disabled}
              value={goalMode && goal ? goal.emphasis[goalZone] : draft.baseline.proportions[shapeZone]}
              onChange={value => {
                clearMessages();
                setDraft(current => goalMode && current.goal
                  ? { ...current, goal: { ...current.goal, emphasis: { ...current.goal.emphasis, [goalZone]: value } } }
                  : { ...current, baseline: { ...current.baseline, proportions: { ...current.baseline.proportions, [shapeZone]: value } } });
              }} />
            <Text accessibilityRole="header" style={[styles.sectionTitle, textStyle]}>{t('bodyShape.chooseZone')}</Text>
            <View style={styles.chips}>{zones.map(zone => <Pressable key={zone} accessibilityRole="button"
              accessibilityLabel={t('bodyShape.chooseNamedZone', { zone: t(`bodyShape.zones.${zone}`) })}
              accessibilityState={{ selected: selected === zone, disabled }} disabled={disabled} onPress={() => choose(zone)}
              style={[styles.chip, { borderColor: selected === zone ? colors.accent : colors.border, backgroundColor: selected === zone ? colors.surfaceAlt : colors.surface }]}>
              <Text style={[styles.chipText, { color: selected === zone ? colors.accent : colors.text }]}>{t(`bodyShape.zones.${zone}`)}</Text>
            </Pressable>)}</View>
          </> : goal ? <View style={[styles.notice, { backgroundColor: colors.surfaceAlt }]}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, textStyle]}>{t('bodyShape.intentions')}</Text>
            {bodyGoalZones(goal.emphasis).length === 0 ? <Text style={[styles.note, mutedStyle]}>{t('bodyShape.noIntentions')}</Text>
              : bodyGoalZones(goal.emphasis).map(zone => <Text key={zone} style={[styles.note, textStyle]}>
                {t(`bodyShape.zones.${zone}`)} · {t(`bodyShape.goalLevels.${goal.emphasis[zone]}`)}
              </Text>)}
          </View> : null}
          {mode === 'baseline' ? <View style={styles.notice}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, textStyle]}>{t('bodyShape.baseTitle')}</Text>
            <Text style={[styles.note, mutedStyle]}>{t('bodyShape.baseHint')}</Text>
            <View style={styles.chips}>{BODY_BASES.map(base => <Pressable key={base} accessibilityRole="button"
              accessibilityLabel={t(`bodyShape.bases.${base}`)} accessibilityState={{ selected: draft.baseline.base === base, disabled }} disabled={disabled}
              onPress={() => { clearMessages(); setDraft(current => ({ ...current, baseline: { ...current.baseline, base } })); }}
              style={[styles.chip, { borderColor: draft.baseline.base === base ? colors.accent : colors.border }]}>
              <Text style={[styles.chipText, textStyle]}>{t(`bodyShape.bases.${base}`)}</Text>
            </Pressable>)}</View>
          </View> : null}
        </>}
        <Text style={[styles.note, mutedStyle]}>{t(goalMode ? 'bodyShape.goalHint' : 'bodyShape.baselineHint')}</Text>
        <BodyMeasurementReferences />
      </ScrollView>
      <View style={[styles.footer, { borderColor: colors.border }]}>
        {failure ? <Text accessibilityRole="alert" style={[styles.note, textStyle]}>{failure}</Text> : null}
        {message ? <Text accessibilityLiveRegion="polite" style={[styles.note, textStyle]}>{message}</Text> : null}
        <View style={styles.actions}>
          {action(t('common.cancel'), () => { setDraft(saved ?? createBodyVisualDocument()); clearMessages(); }, false, saving || !dirty)}
          {action(t(saving ? 'bodyShape.saving' : 'bodyShape.save'), save, true)}
        </View>
      </View>
    </>}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontFamily: fontFamily.displayBold, fontSize: 28 },
  note: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19 },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: 18 },
  tab: { flex: 1, minHeight: 44, padding: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  tabText: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  content: { gap: 14, paddingBottom: 16 },
  canvas: { borderRadius: 24, padding: 12, gap: 10 },
  sides: { flexDirection: 'row', alignSelf: 'center', gap: 8 },
  sideTab: { minHeight: 44, minWidth: 74, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  ghost: { alignItems: 'center', justifyContent: 'center' },
  caption: { fontFamily: fontFamily.body, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  sectionTitle: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 22, justifyContent: 'center' },
  chipText: { fontFamily: fontFamily.bodyMedium, fontSize: 13 },
  notice: { padding: 12, borderRadius: 16, gap: 10 },
  empty: { borderRadius: 24, padding: 16, alignItems: 'center', gap: 16 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  footer: { gap: 8, borderTopWidth: 1, paddingTop: 10, paddingBottom: 4 },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flexGrow: 1, flexShrink: 1, minHeight: 48, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontFamily: fontFamily.bodyBold, fontSize: 14, textAlign: 'center' },
});
