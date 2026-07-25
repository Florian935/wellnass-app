import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useWorkoutTemplates } from '@/data/repositories/workout-template-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * Liste des templates de séance libre (US Refonte-D §2). Point d'entrée unique et
 * permanent (widget « strength-templates » du hub muscu, en plus du choix « Séance
 * libre » → « Depuis un template ») : tap sur une ligne ouvre toujours le détail du
 * template (`/templates/[id]`), qui porte l'action « Démarrer » explicite ainsi que
 * Dupliquer/Supprimer. Retour d'usage (22/07/2026, Florian) : un ancien « mode
 * sélection » faisait démarrer directement au tap depuis le hub, rendant la gestion
 * (éditer/dupliquer/supprimer) inatteignable par ce chemin — supprimé au profit d'un
 * comportement unique et prévisible quel que soit le point d'entrée.
 */
export default function TemplatesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const { templates, isLoading } = useWorkoutTemplates();

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={t('templates.title')}
        subtitle={t('templates.subtitle')}
        action={
          <Pressable
            onPress={() => router.push('/templates/edit')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('templates.create')}
            style={[styles.createBtn, { backgroundColor: colors.accent }]}
          >
            <Ionicons name="add" size={24} color={colors.accentText} />
          </Pressable>
        }
      />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : templates.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('templates.emptyList')}
          </Text>
        </Card>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.list}>
            {templates.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => router.push(`/templates/${item.id}`)}
                style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel={item.name}
              >
                <View style={styles.rowText}>
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    {t('templates.exerciseCount', { count: item.exerciseCount })}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  scroll: {
    paddingBottom: 24,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 16,
  },
  meta: {
    fontFamily: fontFamily.body,
    fontSize: 13,
  },
  createBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    padding: 16,
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
