import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useTranslation } from 'react-i18next';
import { BODY_GOAL_ZONES, bodyTrainingNeedsReview, suggestBodyPriorities, type BodyGoalZone } from '@wellness/shared';
import { saveBodyTraining, type useBodyTraining } from '@/data/repositories/body-training-repository';
import { type useBodyVisual } from '@/data/repositories/body-visual-repository';
import { useActionLock } from '@/hooks/useActionLock';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { BodyShapeFigure } from './BodyShapeFigure';
import { BodyTrainingButton as Button } from './BodyTrainingButton';
import { BodyTrainingProgramCard } from './BodyTrainingProgramCard';

type Props = { source: ReturnType<typeof useBodyTraining>; visualSource: ReturnType<typeof useBodyVisual> };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const canonical = (zones: BodyGoalZone[]) => BODY_GOAL_ZONES.filter(zone => zones.includes(zone));
function initialSelection(source: Props['source'], visualSource: Props['visualSource']) {
  return source.document?.priorities ?? (visualSource.document?.goal ? canonical(suggestBodyPriorities(visualSource.document.goal)) : []);
}

export function BodyTrainingEditor({ source, visualSource }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { formatAxisNumber } = useUnits();
  const router = useRouter();
  const navigation = useNavigation();
  const [saved, setSaved] = useState(source.document);
  const [visual, setVisual] = useState(visualSource.document);
  const [expectedRaw, setExpectedRaw] = useState(source.raw);
  const [expectedVisualRaw, setExpectedVisualRaw] = useState(visualSource.raw);
  const [pendingEcho, setPendingEcho] = useState<{ previousRaw: string | null } | null>(null);
  const [selection, setSelection] = useState(() => initialSelection(source, visualSource));
  const [editing, setEditing] = useState(!source.document);
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [forceReload, setForceReload] = useState(false);
  const runExclusive = useActionLock();
  const matchesTraining = same(saved, source.document);
  const matchesVisual = same(visual, visualSource.document);
  // A successful local write precedes the reactive SQLite echo. Keep the saved
  // result on screen; an old read must neither resurrect a clear nor enable another write.
  const waitingEcho = pendingEcho !== null && source.raw === pendingEcho.previousRaw && !matchesTraining;
  if (pendingEcho && !waitingEcho && !source.isLoading) setPendingEcho(null);
  // JSON key reordering alone is safe: refresh CAS tokens without replacing the draft.
  if (matchesTraining && !waitingEcho && source.status !== 'invalid' && source.status !== 'unsupported' && source.raw !== expectedRaw) setExpectedRaw(source.raw);
  if (matchesVisual && visualSource.status !== 'invalid' && visualSource.status !== 'unsupported' && visualSource.raw !== expectedVisualRaw) setExpectedVisualRaw(visualSource.raw);
  const changedElsewhere = forceReload || (!matchesTraining && !waitingEcho && source.raw !== expectedRaw)
    || (!matchesVisual && visualSource.raw !== expectedVisualRaw);
  const blocked = source.status === 'invalid' || source.status === 'unsupported'
    || visualSource.status === 'invalid' || visualSource.status === 'unsupported';
  const loading = source.isLoading || visualSource.isLoading;
  const loadError = !!source.error || !!visualSource.error;
  const disabled = busy || blocked || loading || loadError || waitingEcho;
  const goal = visual?.goal?.savedAt ? visual.goal : null;
  const reference = saved?.priorities ?? (goal ? canonical(suggestBodyPriorities(goal)) : []);
  const dirty = editing && !same(selection, reference);
  const staleGoal = saved && bodyTrainingNeedsReview(saved, visualSource.document?.goal ?? null);
  const figureGoal = editing ? goal : saved?.sourceGoal;

  usePreventRemove(dirty || busy, ({ data }) => {
    if (busy) return;
    Alert.alert(t('bodyShape.leaveTitle'), t('bodyShape.leaveHint'), [
      { text: t('bodyShape.stay'), style: 'cancel' },
      { text: t('bodyShape.discard'), style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const reload = () => {
    const replace = () => {
      setSaved(source.document); setVisual(visualSource.document);
      setExpectedRaw(source.raw); setExpectedVisualRaw(visualSource.raw);
      setSelection(initialSelection(source, visualSource)); setEditing(!source.document);
      setPendingEcho(null); setForceReload(false); setFailure(null);
    };
    if (dirty) Alert.alert(t('bodyShape.reloadTitle'), t('bodyShape.reloadHint'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('bodyShape.reloadConfirm'), style: 'destructive', onPress: replace },
    ]); else replace();
  };
  const modify = () => {
    setSaved(source.document); setVisual(visualSource.document);
    setExpectedRaw(source.raw); setExpectedVisualRaw(visualSource.raw);
    setSelection(initialSelection(source, visualSource)); setEditing(true);
    setForceReload(false); setFailure(null);
  };
  const persist = (priorities: BodyGoalZone[] | null) => {
    if (disabled || changedElsewhere) return;
    return runExclusive(async () => {
      setBusy(true); setFailure(null);
      try {
        const next = await saveBodyTraining(priorities, expectedRaw, expectedVisualRaw);
        setPendingEcho({ previousRaw: source.raw }); setSaved(next);
        setExpectedRaw(next ? JSON.stringify(next) : null); setEditing(!next);
        setSelection(next?.priorities ?? (goal ? canonical(suggestBodyPriorities(goal)) : []));
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
        const known = code === 'conflict' || code === 'settings_missing' || code === 'unauthenticated' || code === 'invalid' || code === 'goal_missing';
        setFailure(t(`bodyTraining.errors.${known ? code : 'save'}`));
        if (code === 'conflict') setForceReload(true);
      } finally { setBusy(false); }
    });
  };
  const clear = () => Alert.alert(t('bodyTraining.clearTitle'), t('bodyTraining.clearHint'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('bodyTraining.clear'), style: 'destructive', onPress: () => persist(null) },
  ]);
  const choose = (zone: BodyGoalZone) => {
    if (disabled) return;
    setSelection(current => current.includes(zone) ? current.filter(value => value !== zone)
      : current.length < 3 ? canonical([...current, zone]) : current);
  };
  const text = { color: colors.text };
  const muted = { color: colors.textMuted };
  const card = { backgroundColor: colors.surface, borderColor: colors.border };

  return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} disabled={busy}
      onPress={() => router.canGoBack() ? router.back() : router.replace('/body')} style={styles.back}>
      <Ionicons name="arrow-back" size={22} color={colors.text} />
      <Text style={[styles.body, text]}>{t('common.back')}</Text>
    </Pressable>
    <Text accessibilityRole="header" style={[styles.title, text]}>{t('bodyTraining.title')}</Text>
    <Text style={[styles.body, muted]}>{t('bodyTraining.subtitle')}</Text>
    {blocked ? <Text accessibilityRole="alert" style={[styles.body, text]}>{t(`bodyTraining.${source.status === 'unsupported' || visualSource.status === 'unsupported' ? 'unsupported' : 'invalid'}`)}</Text> : <>
      {loadError ? <Text accessibilityRole="alert" style={[styles.body, text]}>{t('bodyTraining.errors.load')}</Text> : null}
      {loading ? <Text style={[styles.body, muted]}>{t('bodyTraining.loading')}</Text> : null}
      {failure ? <Text accessibilityRole="alert" style={[styles.body, { color: colors.danger }]}>{failure}</Text> : null}
      {staleGoal ? <View style={[styles.card, { backgroundColor: colors.warn, borderColor: colors.warnBorder }]}>
        <Text style={[styles.section, { color: colors.warnText }]}>{t('bodyTraining.goalChanged')}</Text>
        <Text style={[styles.body, { color: colors.warnText }]}>{t(editing ? 'bodyTraining.reviewGoalHint' : 'bodyTraining.goalChangedHint')}</Text>
      </View> : null}
      {changedElsewhere && !loading && !loadError ? <View style={[styles.card, card]}>
        <Text style={[styles.body, text]}>{t('bodyTraining.newVersion')}</Text>
        <Button label={t('bodyTraining.reload')} onPress={reload} disabled={disabled} />
      </View> : null}
      {!goal ? <View style={[styles.card, card]}>
        <Text style={[styles.section, text]}>{t('bodyTraining.noGoal')}</Text>
        <Text style={[styles.body, muted]}>{t('bodyTraining.noGoalHint')}</Text>
        <Button label={t('bodyTraining.createGoal')} onPress={() => router.push('/body-shape')} disabled={disabled} primary={!saved} />
      </View> : null}
      {figureGoal ? <View style={[styles.card, card]}>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>{t(editing ? 'bodyTraining.yourGoal' : 'bodyTraining.confirmed')}</Text>
        <View accessibilityRole="tablist" style={styles.sides}>
          {(['front', 'back'] as const).map(value => <Pressable key={value} accessibilityRole="tab"
            accessibilityLabel={t(`bodyMap.${value}`)} accessibilityState={{ selected: side === value }}
            onPress={() => setSide(value)} style={[styles.side, { backgroundColor: side === value ? colors.surfaceAlt : colors.surface }]}>
            <Text style={[styles.body, text]}>{t(`bodyMap.${value}`)}</Text>
          </Pressable>)}
        </View>
        <View style={styles.figure}><BodyShapeFigure shape={figureGoal.baseline} emphasis={figureGoal.emphasis} side={side} mode="goal" height={210} /></View>
        <Text style={[styles.caption, muted]}>{t('bodyTraining.illustration')}</Text>
        {!editing && saved ? <>
          <Text style={[styles.caption, muted]}>{t('bodyTraining.confirmedOn', { date: new Intl.DateTimeFormat(i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR', { dateStyle: 'medium' }).format(new Date(saved.confirmedAt)) })}</Text>
          <View style={styles.tags}>{saved.priorities.map(zone => <View key={zone} style={[styles.tag, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.body, text]}>{t(`bodyShape.zones.${zone}`)}</Text>
          </View>)}</View>
        </> : null}
      </View> : null}
      {editing && goal ? <View style={styles.choices}>
        <Text accessibilityRole="header" style={[styles.section, text]}>{t('bodyTraining.choose')}</Text>
        <Text style={[styles.body, muted]}>{t('bodyTraining.suggestionHint')}</Text>
        <Text accessibilityLiveRegion="polite" style={[styles.caption, muted]}>{t('bodyTraining.selectedCount', { count: selection.length, value: formatAxisNumber(selection.length) })}</Text>
        <View style={styles.zones}>{BODY_GOAL_ZONES.map(zone => {
          const checked = selection.includes(zone);
          const unavailable = disabled || (!checked && selection.length >= 3);
          return <Pressable key={zone} accessibilityRole="checkbox" accessibilityLabel={t(`bodyShape.zones.${zone}`)}
            accessibilityState={{ checked, disabled: unavailable }} disabled={unavailable} onPress={() => choose(zone)}
            style={[styles.zone, { backgroundColor: checked ? colors.surfaceAlt : colors.surface, borderColor: checked ? colors.accent : colors.borderStrong, opacity: unavailable && !checked ? 0.5 : 1 }]}>
            <Text style={[styles.check, { color: colors.accent }]}>{checked ? '✓' : '○'}</Text>
            <Text style={[styles.zoneText, text]}>{t(`bodyShape.zones.${zone}`)}</Text>
          </Pressable>;
        })}</View>
        <Button label={t(busy ? 'bodyTraining.saving' : 'bodyTraining.confirm')} onPress={() => { void persist(selection); }} primary
          disabled={disabled || changedElsewhere || selection.length === 0} />
        {saved ? <Button label={t('common.cancel')} disabled={busy} onPress={() => { setSelection(saved.priorities); setEditing(false); setFailure(null); }} /> : null}
      </View> : null}
      {!editing && saved ? <>
        {goal ? <Button label={t('bodyTraining.modify')} onPress={modify} disabled={disabled} /> : null}
        <BodyTrainingProgramCard priorities={saved.priorities} />
        <Button label={t('bodyTraining.clear')} onPress={clear} disabled={disabled || changedElsewhere} />
      </> : null}
    </>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 32 },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  title: { fontFamily: fontFamily.displayBold, fontSize: 28 },
  body: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 21 },
  section: { fontFamily: fontFamily.bodyBold, fontSize: 18 },
  eyebrow: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  caption: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 18 },
  card: { borderRadius: 24, borderWidth: 1, padding: 16, gap: 12 },
  figure: { alignItems: 'center' },
  sides: { flexDirection: 'row', alignSelf: 'center', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  side: { minHeight: 44, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, justifyContent: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  choices: { gap: 12 },
  zones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  zone: { minHeight: 48, borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, flexGrow: 1, flexBasis: '45%' },
  check: { fontFamily: fontFamily.bodyBold, fontSize: 19 },
  zoneText: { fontFamily: fontFamily.bodySemi, fontSize: 14, flexShrink: 1 },
});
