import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { bodySideForMuscle, parseBodyMuscle, type FineMuscle } from '@wellness/shared';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { BodyExplorerCanvas } from '@/components/body/BodyExplorerCanvas';
import { BodyMuscleDetail } from '@/components/body/BodyMuscleDetail';
import { BodyMusclePicker } from '@/components/body/BodyMusclePicker';
import { useBodyExercises } from '@/data/repositories/body-explorer-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

function readMuscles(value: unknown): FineMuscle[] {
  if (typeof value !== 'string') return [];
  return [...new Set(value.split(',').map(parseBodyMuscle).filter((muscle): muscle is FineMuscle => muscle !== null))];
}

/** CORPS-01: anatomy and catalogue reads only. Camera and selection are ephemeral. */
export default function BodyScreen() {
  const params = useLocalSearchParams<{ muscle?: string; full?: string; reduced?: string; context?: string }>();
  const incoming = parseBodyMuscle(params.muscle);
  const context = params.context === 'exercise' || params.context === 'session' || params.context === 'week' ? params.context : null;
  const full = context ? readMuscles(params.full) : [];
  const reduced = context ? readMuscles(params.reduced).filter((muscle) => !full.includes(muscle)) : [];
  // A new incoming context starts a fresh exploration, without effect-driven state cascades.
  return <BodyExplorerContent key={`${incoming}:${context}:${full.join(',')}:${reduced.join(',')}`}
    incoming={incoming} context={context} full={full} reduced={reduced} />;
}

function BodyExplorerContent({ incoming, context, full, reduced }: {
  incoming: FineMuscle | null; context: 'exercise' | 'session' | 'week' | null;
  full: FineMuscle[]; reduced: FineMuscle[];
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const [selected, setSelected] = useState<FineMuscle | null>(incoming);
  const [side, setSide] = useState<'front' | 'back'>(incoming ? bodySideForMuscle(incoming, 'front') : 'front');
  const [query, setQuery] = useState('');
  const { exercises, isLoading, error } = useBodyExercises(selected, query);
  const choose = (muscle: FineMuscle) => {
    setSelected(muscle);
    setSide(bodySideForMuscle(muscle, side));
    setQuery('');
  };
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/strength')}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
          <Text style={[styles.backText, { color: colors.text }]}>{t('common.back')}</Text>
        </Pressable>
        <ScreenHeader title={t('bodyExplorer.title')} subtitle={t('bodyExplorer.subtitle')} />
        <Pressable accessibilityRole="button" accessibilityLabel={t('bodyShape.entry')}
          onPress={() => router.push('/body-shape')} style={[styles.context, { backgroundColor: colors.surfaceAlt, minHeight: 48 }]}>
          <Text style={[styles.contextText, { color: colors.accent }]}>{t('bodyShape.entry')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('bodyTraining.entry')}
          onPress={() => router.push('/body-training')} style={[styles.context, { backgroundColor: colors.surfaceAlt, minHeight: 48 }]}>
          <Text style={[styles.contextText, { color: colors.accent }]}>{t('bodyTraining.entry')}</Text>
        </Pressable>
        {context ? <View style={[styles.context, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.contextText, { color: colors.text }]}>{t(`bodyExplorer.context.${context}`)}</Text>
          <Text style={[styles.contextHint, { color: colors.textMuted }]}>{t('bodyExplorer.contextHint')}</Text>
        </View> : null}
        <View accessibilityRole="tablist" style={[styles.views, { backgroundColor: colors.surfaceAlt }]}>
          {(['front', 'back'] as const).map((view) => (
            <Pressable key={view} accessibilityRole="tab" accessibilityLabel={t(`bodyMap.${view}`)} accessibilityState={{ selected: view === side }}
              onPress={() => setSide(view)} style={[styles.viewTab, view === side && { backgroundColor: colors.surface }]}>
              <Text style={[styles.viewLabel, { color: view === side ? colors.accent : colors.text }]}>{t(`bodyMap.${view}`)}</Text>
            </Pressable>
          ))}
        </View>
        <BodyExplorerCanvas key={`${side}:${selected ?? 'none'}`} side={side} selected={selected} full={full} reduced={reduced} onSelect={choose} />
        <Text style={[styles.prompt, { color: colors.textMuted }]}>{t('bodyExplorer.selectHint')}</Text>
        <BodyMusclePicker selected={selected} onSelect={choose} />
        {selected ? <BodyMuscleDetail muscle={selected} exercises={exercises} isLoading={isLoading} error={error} query={query} onQueryChange={setQuery}
          onOpenExercise={(id) => router.push(`/exercises/${id}`)} />
          : <Text style={[styles.empty, { color: colors.textMuted }]}>{t('bodyExplorer.chooseMuscle')}</Text>}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 32 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, alignSelf: 'flex-start' },
  backText: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  views: { flexDirection: 'row', padding: 4, borderRadius: 18 },
  viewTab: { flex: 1, minHeight: 44, borderRadius: 14, padding: 10, alignItems: 'center', justifyContent: 'center' },
  viewLabel: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  prompt: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  context: { padding: 12, borderRadius: 14, gap: 4 },
  contextText: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  contextHint: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 18 },
  empty: { fontFamily: fontFamily.body, fontSize: 15, lineHeight: 22, paddingVertical: 8 },
});
