/**
 * « Sans allure de référence, tes séances n'ont pas d'allure cible · La donner » (US CARDIO-02,
 * §3.5, D7).
 *
 * **Un seul bandeau en tête de liste**, et non un lien par ligne : les lignes du planning sont déjà
 * touchables (cibles imbriquées), et le même lien répété à chaque séance noierait la liste. Le message
 * de chaque ligne reste, non touchable. Le bandeau mène directement aux quatre portes.
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function RefPaceBanner({ testID = 'ref-pace-banner' }: { testID?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View testID={testID} style={[styles.banner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.text, { color: colors.text }]}>{t('running.refPace.missingBanner')}</Text>
      <Pressable
        testID={`${testID}-cta`}
        onPress={() => router.push('/running-pace')}
        accessibilityRole="button"
        accessibilityLabel={`${t('running.refPace.title')} · ${t('running.refPace.give')}`}
        style={[styles.cta, { borderColor: colors.accent }]}
      >
        <Text style={[styles.ctaLabel, { color: colors.accent }]}>{t('running.refPace.give')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  text: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 13.5, lineHeight: 19 },
  cta: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1.5, justifyContent: 'center' },
  ctaLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
});
