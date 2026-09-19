/**
 * US CARDIO-UX02 — l'annuaire du pilier Course.
 *
 * ── Ce qu'il remplace ────────────────────────────────────────────────────────────────────────────
 * La **grille de widgets** du hub course et son bouton « Personnaliser ». Trois de ses quatre
 * tuiles étaient des raccourcis d'administration déguisés en indicateurs — Programmes (un nom de
 * plan), Planning (un mini-calendrier), Historique (la distance de la dernière sortie). Le hub
 * muscu a perdu la sienne le 19/09 pour la même raison ; garder celle-ci aurait laissé deux hubs
 * avec deux structures, et le même widget rendu deux fois dans l'app.
 *
 * Quatre destinations au lieu de trois côté muscu : le **profil coureur** en fait partie, parce
 * qu'il porte l'allure de référence — laquelle pilote toutes les allures cibles, les zones, la
 * polarisation et les prédictions. Sans elle, la moitié du pilier tourne en mode dégradé silencieux
 * (constat F1/F2 de CARDIO-UX01). Il reste aussi atteignable depuis l'icône de la scène : une porte
 * de plus, pas une porte déplacée.
 *
 * ⚠️ Ce qui disparaît avec la grille : la **personnalisation** du hub course (ordre et taille des
 * tuiles). Aucune migration — les préférences `running` du registre de widgets deviennent
 * inertes, exactement comme celles du hub muscu depuis MUSCU-UX05. À confirmer en recette.
 */

import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { Palette } from '@/theme/colors';
import { fontFamily } from '@/theme/fonts';

/** Les quatre destinations du pilier, dans l'ordre où on en a besoin. */
export type RunDirectoryTarget = 'programs' | 'planning' | 'history' | 'profile';

const ROWS: readonly { target: RunDirectoryTarget; icon: keyof typeof Ionicons.glyphMap }[] = [
  { target: 'programs', icon: 'flag-outline' },
  { target: 'planning', icon: 'calendar-outline' },
  { target: 'history', icon: 'time-outline' },
  { target: 'profile', icon: 'person-outline' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (target: RunDirectoryTarget) => void;
  colors: Palette;
};

export function RunDirectorySheet({ visible, onClose, onPick, colors }: Props) {
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
            {t('runningHub.directorySheet.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('runningHub.directorySheet.subtitle')}
          </Text>

          <View style={styles.rows}>
            {ROWS.map(({ target, icon }) => (
              <Pressable
                key={target}
                accessibilityRole="button"
                testID={`run-directory-${target}`}
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
                    {t(`runningHub.directorySheet.${target}`)}
                  </Text>
                  <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
                    {t(`runningHub.directorySheet.${target}Desc`)}
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
