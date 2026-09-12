/**
 * Repos entre deux séries — enrichi par l'US MUSCU-UX01 (10/09/2026).
 *
 * ── Trois changements ────────────────────────────────────────────────────────────────────────────
 * 1. **Le compte à rebours n'est plus aveugle** : il annonce la série suivante et son exercice.
 *    C'est l'écran où l'on passe le plus de temps immobile ; y afficher ce qui vient permet de se
 *    préparer au lieu d'attendre.
 * 2. **Le réglage du repos atterrit ici**, là où le besoin se constate (« 90 s, c'est trop court
 *    sur cet exercice »). Il quittait la carte de série, où il occupait une ligne permanente à
 *    chaque série alors que c'est un réglage d'exercice, posé une fois.
 * 3. **La couleur vient du thème.** L'écran était peint en bordeaux `#6b0028` codé en dur, hors
 *    palette — seul écran du pilier dans ce cas, alors que l'accent de l'app est un terracotta.
 *    Il utilise désormais `colors.panel`, la surface sombre du thème, qui suit clair et sombre.
 *
 * Composant présentational : la minuterie (source de vérité), le retour haptique et l'état
 * `collapsed` restent gérés par `workout.tsx`.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { RestRing } from '@/components/workout/RestRing';
import { fontFamily } from '@/theme/fonts';
import type { Palette } from '@/theme/colors';

/**
 * Diamètre de l'anneau de repos. Calé sur la largeur d'un écran étroit (360 dp) moins les marges
 * de `content` : il occupe la place sans jamais toucher les bords.
 */
const RING_SIZE = 248;
const RING_STROKE = 10;

type RestOverlayProps = {
  secondsLeft: number;
  /** Replié = barre compacte en bas (n'obstrue pas la séance) ; sinon plein écran. */
  collapsed: boolean;
  /** Repos configuré pour l'exercice courant (secondes) — sert au réglage rapide. */
  restSeconds: number;
  /**
   * Durée totale du repos **en cours**, dénominateur de l'anneau (MOTION-01 · M3).
   *
   * Distinct de `restSeconds` à dessein : celui-ci est le réglage *durable* de l'exercice, celui-là
   * la durée réellement lancée. Les deux divergent dès qu'on appuie sur « + 15 s ».
   */
  totalSeconds: number;
  /** Exercice de la série qui suit, `null` si la séance est terminée. */
  nextLabel: string | null;
  /** Rang de la série qui suit (« Série 3/4 »), `null` si inconnu. */
  nextDetail: string | null;
  onSkip: () => void;
  onExtend: () => void;
  onToggleCollapse: () => void;
  /** Fixe le repos de l'exercice courant — le réglage rapide de cet écran. */
  onChangeRest: (seconds: number) => void;
  colors: Palette;
};

/** Formate un nombre de secondes en `m:ss` (≥ 60 s) ou `{n} s` sinon. */
function formatSecondsLeft(
  seconds: number,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  if (safeSeconds < 60) return t('workout.restRemaining', { seconds: safeSeconds });
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

export function RestOverlay({
  secondsLeft,
  collapsed,
  restSeconds,
  totalSeconds,
  nextLabel,
  nextDetail,
  onSkip,
  onExtend,
  onToggleCollapse,
  onChangeRest,
  colors,
}: RestOverlayProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const countdown = formatSecondsLeft(secondsLeft, t);

  if (collapsed) {
    return (
      <View style={[styles.collapsedBar, { backgroundColor: colors.panel }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('workout.restTitle')}
          onPress={onToggleCollapse}
          style={({ pressed }) => [styles.collapsedMain, pressed && styles.pressed]}
        >
          <Ionicons name="timer-outline" size={18} color={colors.panelText} />
          <Text style={[styles.collapsedText, { color: colors.panelText }]}>
            {`${t('workout.restTitle')} · ${countdown}`}
          </Text>
          <Ionicons name="chevron-up" size={18} color={colors.panelText} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onSkip}
          style={({ pressed }) => [styles.collapsedSkip, pressed && styles.pressed]}
        >
          <Text style={[styles.collapsedSkipLabel, { color: colors.panelAccent }]}>
            {t('workout.skipRest')}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: colors.panel }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('workout.restCollapse')}
        onPress={onToggleCollapse}
        hitSlop={12}
        style={({ pressed }) => [styles.collapseBtn, { top: insets.top + 12 }, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-down" size={26} color={colors.panelMuted} />
      </Pressable>

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.panelMuted }]}>{t('workout.restTitle')}</Text>
        {/*
          MOTION-01 (M3/M4) : le compte à rebours passe **dans** un anneau qui se vide. Le chiffre
          n'a pas changé — il reste la source d'information — mais il cesse d'être la seule chose à
          regarder sur un écran où l'on attend, assis, une minute et demie.
        */}
        <RestRing
          secondsLeft={secondsLeft}
          totalSeconds={totalSeconds}
          size={RING_SIZE}
          stroke={RING_STROKE}
          color={colors.panelAccent}
          warnColor={colors.success}
          trackColor={`${colors.panelText}1f`}
        >
          <Text style={[styles.countdown, { color: colors.panelText }]}>{countdown}</Text>
        </RestRing>

        {/* Ce qui vient : le repos cesse d'être un temps mort. */}
        {nextLabel ? (
          <View style={[styles.nextCard, { backgroundColor: `${colors.panelAccent}1f` }]}>
            <Text style={[styles.nextEyebrow, { color: colors.panelAccent }]}>
              {t('workout.restNext')}
            </Text>
            <Text style={[styles.nextName, { color: colors.panelText }]} numberOfLines={2}>
              {nextLabel}
            </Text>
            {nextDetail ? (
              <Text style={[styles.nextDetail, { color: colors.panelMuted }]}>{nextDetail}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={onSkip}
            style={({ pressed }) => [
              styles.button,
              { borderColor: `${colors.panelText}52` },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.buttonLabel, { color: colors.panelText }]}>
              {t('workout.skipRest')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onExtend}
            style={({ pressed }) => [
              styles.button,
              { borderColor: `${colors.panelText}52` },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.buttonLabel, { color: colors.panelText }]}>
              {t('workout.restExtend')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Le réglage durable, à l'endroit où l'on constate qu'il faut le changer. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('workout.restAlways', { count: restSeconds + 30 })}
        onPress={() => onChangeRest(restSeconds + 30)}
        style={({ pressed }) => [
          styles.restSetting,
          { borderColor: `${colors.panelText}4d`, bottom: insets.bottom + 24 },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="timer-outline" size={16} color={colors.panelMuted} />
        <Text style={[styles.restSettingText, { color: colors.panelMuted }]} numberOfLines={2}>
          {t('workout.restAlways', { count: restSeconds + 30 })}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  collapseBtn: { position: 'absolute', alignSelf: 'center' },
  content: { alignItems: 'center', gap: 8, paddingHorizontal: 24, width: '100%' },
  title: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  // Abaissé de 72 à 60 px en entrant dans l'anneau (MOTION-01 · M3) : le diamètre intérieur fait
  // 228 px, et Space Mono avance d'environ 0,6 em par glyphe. À 72 px un repos de dix minutes
  // (« 10:00 », 5 glyphes ≈ 216 px) touchait l'arc ; à 60 px il reste 48 px de marge.
  countdown: { fontFamily: fontFamily.monoBold, fontSize: 60, letterSpacing: -2, lineHeight: 68 },
  nextCard: { width: '100%', borderRadius: 18, padding: 16, gap: 4, marginTop: 18 },
  nextEyebrow: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 10.5,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  nextName: { fontFamily: fontFamily.displaySemi, fontSize: 16, letterSpacing: -0.3 },
  nextDetail: { fontFamily: fontFamily.body, fontSize: 12.5 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 26, width: '100%' },
  button: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  restSetting: {
    position: 'absolute',
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  restSettingText: { flex: 1, fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17 },
  collapsedBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    zIndex: 20,
  },
  collapsedMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  collapsedText: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 14 },
  collapsedSkip: { paddingHorizontal: 10, paddingVertical: 6 },
  collapsedSkipLabel: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  pressed: { opacity: 0.8 },
});
