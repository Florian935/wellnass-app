/**
 * La feuille « Séance libre » — 1ʳᵉ passe de recette de MUSCU-FIX02 (23/09/2026).
 *
 * ── Le défaut qu'elle corrige ───────────────────────────────────────────────────────────────────
 * Sans modèle enregistré (le cas de tout compte neuf), « Séance libre » créait une séance **vide**
 * au premier appui : le chrono partait, l'écran restait noir, avec pour seul programme « ajoute un
 * premier exercice pour commencer » — en mode immersif, sans même un bouton pour le faire.
 * Florian : « pas intuitif, pas fluide, il faut retravailler le flux ».
 *
 * ── Ce qu'elle change ────────────────────────────────────────────────────────────────────────────
 * On choisit **quoi faire** d'abord ; la séance naît ensuite, déjà remplie. Trois entrées, par
 * ordre d'usage :
 *  1. **Composer ma séance** — le sélecteur d'exercices en choix multiple ; rien n'est créé tant
 *     qu'on n'a pas appuyé sur « Commencer » ;
 *  2. **Refaire une séance** — les trois dernières séances terminées, rejouées à l'identique ;
 *  3. **Depuis un modèle** — les modèles enregistrés, ou de quoi en créer un s'il n'y en a aucun.
 *
 * ⚠️ Elle remplace l'arbitrage « pas de choix à une seule issue » (MUSCU-FIX01, R6), qui faisait
 * démarrer une séance vide faute de modèle : il n'y a plus d'issue unique, « Composer » existe
 * toujours.
 *
 * Composant **présentationnel** : les données (historique, modèles) et les actions viennent du hub.
 */

import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { Palette } from '@/theme/colors';
import { fontFamily } from '@/theme/fonts';

/** Une séance terminée qu'on peut refaire. */
export type RepeatableWorkout = {
  id: string;
  /** Nom de la séance de programme d'origine ; `null` pour une séance libre. */
  name: string | null;
  finishedAt: string | null;
  exerciseCount: number;
};

/** Un modèle de séance. */
export type FreeSessionTemplate = { id: string; name: string; exerciseCount: number };

/** Nombre de séances récentes proposées : au-delà, c'est l'historique. */
export const REPEATABLE_LIMIT = 3;
/** Nombre de modèles affichés dans la feuille ; les autres sont à un appui (« Tous mes modèles »). */
const TEMPLATES_LIMIT = 3;

type Props = {
  visible: boolean;
  onClose: () => void;
  onCompose: () => void;
  recent: readonly RepeatableWorkout[];
  onRepeat: (workoutId: string) => void;
  templates: readonly FreeSessionTemplate[];
  onTemplate: (templateId: string) => void;
  /** Ouvre la liste des modèles — pour en créer un, ou voir ceux qui ne tiennent pas ici. */
  onManageTemplates: () => void;
  colors: Palette;
};

/** Une ligne de la feuille. Au niveau module : voir `SessionMenuSheet` (`static-components`). */
function Row({
  icon,
  title,
  meta,
  onPress,
  testID,
  primary = false,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  meta: string;
  onPress: () => void;
  testID: string;
  primary?: boolean;
  colors: Palette;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        primary
          ? { backgroundColor: colors.accent, borderColor: colors.accent }
          : { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.icon,
          { backgroundColor: primary ? `${colors.accentText}1f` : colors.surfaceAlt },
        ]}
      >
        <Ionicons name={icon} size={20} color={primary ? colors.accentText : colors.accent} />
      </View>
      <View style={styles.rowText}>
        <Text
          style={[styles.rowName, { color: primary ? colors.accentText : colors.text }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={[styles.rowDesc, { color: primary ? colors.accentText : colors.textMuted }]}
          numberOfLines={2}
        >
          {meta}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={primary ? colors.accentText : colors.textMuted}
      />
    </Pressable>
  );
}

export function FreeSessionSheet({
  visible,
  onClose,
  onCompose,
  recent,
  onRepeat,
  templates,
  onTemplate,
  onManageTemplates,
  colors,
}: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          style={styles.dismissZone}
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('workout.freeSheet.title')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {t('workout.freeSheet.subtitle')}
            </Text>

            <Row
              primary
              icon="list-outline"
              title={t('workout.freeSheet.compose')}
              meta={t('workout.freeSheet.composeDesc')}
              onPress={onCompose}
              testID="free-compose"
              colors={colors}
            />

            {recent.length > 0 ? (
              <View style={styles.section}>
                <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
                  {t('workout.freeSheet.repeatTitle')}
                </Text>
                {recent.slice(0, REPEATABLE_LIMIT).map((workout) => (
                  <Row
                    key={workout.id}
                    icon="refresh-outline"
                    title={workout.name?.trim() || t('workout.freeSheet.repeatUntitled')}
                    meta={t('workout.freeSheet.repeatMeta', {
                      count: workout.exerciseCount,
                      date: workout.finishedAt ? dateFormat.format(new Date(workout.finishedAt)) : '—',
                    })}
                    onPress={() => onRepeat(workout.id)}
                    testID={`free-repeat-${workout.id}`}
                    colors={colors}
                  />
                ))}
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
                {t('workout.freeSheet.templatesTitle')}
              </Text>
              {templates.length === 0 ? (
                <Row
                  icon="bookmark-outline"
                  title={t('workout.freeSheet.noTemplate')}
                  meta={t('workout.freeSheet.noTemplateDesc')}
                  onPress={onManageTemplates}
                  testID="free-templates-empty"
                  colors={colors}
                />
              ) : (
                <>
                  {templates.slice(0, TEMPLATES_LIMIT).map((template) => (
                    <Row
                      key={template.id}
                      icon="bookmark-outline"
                      title={template.name}
                      meta={t('workout.exerciseCount', { count: template.exerciseCount })}
                      onPress={() => onTemplate(template.id)}
                      testID={`free-template-${template.id}`}
                      colors={colors}
                    />
                  ))}
                  <Pressable
                    accessibilityRole="button"
                    testID="free-templates-all"
                    onPress={onManageTemplates}
                    style={styles.link}
                  >
                    <Text style={[styles.linkLabel, { color: colors.accent }]}>
                      {t('workout.freeSheet.allTemplates')}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0000008a' },
  dismissZone: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 10,
    maxHeight: '88%',
  },
  grabber: { width: 44, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  content: { paddingHorizontal: 20, gap: 10, paddingBottom: 4 },
  title: { fontFamily: fontFamily.displayXBold, fontSize: 24, letterSpacing: -0.8 },
  subtitle: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 19, marginBottom: 6 },
  section: { gap: 10, marginTop: 8 },
  eyebrow: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    minHeight: 64,
  },
  pressed: { opacity: 0.75 },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowName: { fontFamily: fontFamily.displaySemi, fontSize: 16.5 },
  rowDesc: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17 },
  link: { alignSelf: 'flex-start', paddingVertical: 6 },
  linkLabel: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
});
