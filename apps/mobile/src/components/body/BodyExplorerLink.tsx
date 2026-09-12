import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { FineMuscle } from '@wellness/shared';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Navigation stays outside the SVG: the same drawing also serves the pain journal. */
export function BodyExplorerLink({ full = [], reduced = [], context }: {
  full?: FineMuscle[]; reduced?: FineMuscle[]; context?: 'exercise' | 'session' | 'week';
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const label = t(context ? 'bodyExplorer.explore' : 'bodyExplorer.title');
  const open = () => {
    if (!context) { router.push('/body'); return; }
    const muscle = full[0] ?? reduced[0];
    router.push({ pathname: '/body', params: {
      context, full: full.join(','), reduced: reduced.join(','), ...(muscle ? { muscle } : {}),
    } });
  };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={open}
      style={({ pressed }) => [styles.link, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}>
      <Ionicons name="body-outline" size={24} color={colors.accent} />
      <View style={styles.text}>
        <Text style={[styles.title, { color: colors.text }]}>{label}</Text>
        {!context ? <Text style={[styles.hint, { color: colors.textMuted }]}>{t('bodyExplorer.entryHint')}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1 },
  text: { flex: 1, gap: 4 },
  title: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  hint: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 18 },
});
