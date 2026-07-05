import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FormScreen } from '@/components/FormScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * Écran de document légal (CGU / confidentialité). Contenu **brouillon** tant qu'il n'a pas
 * été rédigé/relu juridiquement (roadmap item 1.21). Bilingue via i18n.
 */
export function LegalScreen({ document }: { document: 'terms' | 'privacy' }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const paragraphs = t(`legal.${document}.body`, { returnObjects: true }) as string[];

  return (
    <FormScreen>
      <ScreenHeader title={t(`legal.${document}.title`)} />
      <View style={[styles.draft, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Text style={[styles.draftText, { color: colors.textMuted }]}>{t('legal.draftNotice')}</Text>
      </View>
      {paragraphs.map((paragraph, index) => (
        <Text key={index} style={[styles.paragraph, { color: colors.text }]}>
          {paragraph}
        </Text>
      ))}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  draft: { borderRadius: 12, borderWidth: 1, padding: 12 },
  draftText: { fontFamily: fontFamily.bodyMedium, fontSize: 13, lineHeight: 18 },
  paragraph: { fontFamily: fontFamily.body, fontSize: 15, lineHeight: 22 },
});
