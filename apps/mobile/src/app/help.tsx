import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { FaqItem } from '@/components/FaqItem';
import { contactSupport } from '@/lib/support';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * Écran Aide & support : FAQ en accordéon mono-ouverture (un seul item ouvert à la fois)
 * + deux actions de contact (message libre / signalement de bug) qui ouvrent le mail natif.
 * Contenu 100 % i18n (aucune chaîne en dur).
 */
export default function HelpScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const raw = t('help.faq.items', { returnObjects: true });
  // Défense : si la clé i18n manque (dev), returnObjects renvoie la chaîne de clé → éviter le crash de .map.
  const faq = (Array.isArray(raw) ? raw : []) as { q: string; a: string }[];

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('help.faq.title')}</Text>
      <View style={styles.stack}>
        {faq.map((item, i) => (
          <FaqItem
            key={item.q}
            question={item.q}
            answer={item.a}
            expanded={openIndex === i}
            onToggle={() => setOpenIndex((cur) => (cur === i ? null : i))}
          />
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 28 }]}>
        {t('help.contact.title')}
      </Text>
      <Text style={[styles.intro, { color: colors.textMuted }]}>{t('help.contact.intro')}</Text>
      <View style={styles.stack}>
        <Button
          label={t('help.contact.contactButton')}
          onPress={() => void contactSupport('contact', t)}
        />
        <Button
          label={t('help.contact.bugButton')}
          variant="ghost"
          onPress={() => void contactSupport('bug', t)}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20 },
  sectionTitle: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  intro: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, marginBottom: 10 },
  stack: { gap: 10 },
});
