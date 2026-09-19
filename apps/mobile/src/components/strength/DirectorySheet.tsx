/**
 * L'annuaire du pilier Musculation — les trois destinations que son icône promet.
 *
 * ── Pourquoi ce composant existe (recette du 19/09/2026) ────────────────────────────────────────
 * L'icône 📚 de la scène porte le libellé « Exercices, programmes, templates » et ouvrait
 * `/exercises` : un annuaire d'exercices, seul. Les deux autres destinations n'étaient nulle part.
 *
 * Pour les **templates**, ce n'était pas un défaut cosmétique mais une impasse complète. US
 * MUSCU-UX01 (10/09/2026) a retiré le widget `strength-templates` du hub en désignant précisément
 * cette ligne d'annuaire comme destination de repli — destination qui n'a jamais été construite.
 * Il ne restait donc qu'un seul chemin vers `/templates` dans toute l'app : le choix
 * « Depuis un template » de la séance libre, qui ne s'affiche **que si au moins un template
 * existe** (arbitrage délibéré : pas de choix à une seule issue). Or l'unique écran permettant
 * d'en créer un est `/templates` lui-même. À zéro template — l'état de tout compte neuf — la
 * fonctionnalité était littéralement inatteignable.
 *
 * La feuille rend la ligne d'annuaire conforme à son libellé, et rend aux templates le point
 * d'entrée **permanent** que l'US Refonte-D leur avait donné le 22/07/2026.
 */

import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { Palette } from '@/theme/colors';
import { fontFamily } from '@/theme/fonts';

/** Les trois destinations, dans l'ordre du libellé de l'icône. */
export type DirectoryTarget = 'exercises' | 'programs' | 'templates';

const ROWS: readonly { target: DirectoryTarget; icon: keyof typeof Ionicons.glyphMap }[] = [
  { target: 'exercises', icon: 'barbell-outline' },
  { target: 'programs', icon: 'calendar-outline' },
  { target: 'templates', icon: 'bookmark-outline' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (target: DirectoryTarget) => void;
  colors: Palette;
};

export function DirectorySheet({ visible, onClose, onPick, colors }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

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

          <Text style={[styles.title, { color: colors.text }]}>
            {t('strengthHub.directorySheet.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('strengthHub.directorySheet.subtitle')}
          </Text>

          <View style={styles.rows}>
            {ROWS.map(({ target, icon }) => (
              <Pressable
                key={target}
                accessibilityRole="button"
                testID={`directory-${target}`}
                onPress={() => onPick(target)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.icon, { backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name={icon} size={20} color={colors.accent} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowName, { color: colors.text }]}>
                    {t(`strengthHub.directorySheet.${target}`)}
                  </Text>
                  <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
                    {t(`strengthHub.directorySheet.${target}Desc`)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
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
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 10,
  },
  grabber: { width: 44, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  title: { fontFamily: fontFamily.displayXBold, fontSize: 24, letterSpacing: -0.8 },
  subtitle: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 19 },
  rows: { gap: 10, marginTop: 6 },
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
});
