/**
 * US MUSCU-UX01 — la **zone Agir** du hub muscu : un emplacement, quatre états exclusifs.
 *
 * ── Ce que ça remplace ───────────────────────────────────────────────────────────────────────────
 * Une cascade de ternaires dans le JSX du hub, avec deux notes conditionnelles greffées dans la
 * dernière branche. Trois états seulement, et surtout : sans programme actif, l'action mise en
 * avant était **« Séance libre »** — la moins structurée de toutes. Un débutant arrivait donc sur
 * l'invitation à improviser, et devait repérer une petite tuile parmi sept pour trouver les
 * programmes.
 *
 * ── Les quatre états (règle R3-1, priorité A > B > C > D) ────────────────────────────────────────
 *   A `resume`     — une séance est en cours (la seule situation où l'on peut perdre quelque chose).
 *   B `today`      — la séance du jour, avec **son contenu** : on sait ce qu'on démarre.
 *   C `rest`       — jour de repos : une information, pas un vide, avec deux sorties de secours.
 *   D `onboarding` — aucun programme : on propose d'en choisir un, la séance libre passe second.
 *
 * La décision elle-même n'est pas ici : elle est dans `resolveHubState` (`packages/shared`), qui
 * est testée. Ce composant ne fait que rendre l'état qu'on lui donne.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { HubState } from '@wellness/shared';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  state: HubState;
  onResume: () => void;
  onStartToday: (sessionId: string, plannedSessionId: string) => void;
  onStartFree: () => void;
  onFromTemplate: () => void;
  onBrowsePrograms: () => void;
  onOpenPlanning: () => void;
  /** Vrai pendant le démarrage d'une séance : le bouton principal passe en attente. */
  starting?: boolean;
};

/**
 * Bouton principal des cartes sombres — l'accent terracotta manque de contraste sur `panel`, d'où
 * `panelAccent`. Défini **au niveau module** : le déclarer dans le corps du composant recréerait
 * un type de composant à chaque rendu, ce que `react-hooks/static-components` interdit à raison
 * (React démonterait et remonterait le sous-arbre à chaque fois).
 */
function PrimaryButton({
  label,
  onPress,
  disabled,
  colors,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: colors.panelAccent },
        (pressed || disabled) && styles.pressed,
      ]}
    >
      <Text style={[styles.primaryLabel, { color: colors.panel }]}>{label}</Text>
    </Pressable>
  );
}

export function StrengthNowCard({
  state,
  onResume,
  onStartToday,
  onStartFree,
  onFromTemplate,
  onBrowsePrograms,
  onOpenPlanning,
  starting = false,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  // ── A · une séance est en cours ────────────────────────────────────────────────────────────
  if (state.kind === 'resume') {
    const { doneSets, totalSets } = state.workout;
    const ratio = totalSets > 0 ? doneSets / totalSets : 0;
    return (
      <View style={[styles.panel, { backgroundColor: colors.panel }]}>
        <View style={styles.headRow}>
          <View style={styles.headTexts}>
            <Text style={[styles.eyebrow, { color: colors.panelAccent }]}>
              {t('strengthHub.resume.eyebrow')}
            </Text>
            <Text style={[styles.title, { color: colors.panelText }]} numberOfLines={2}>
              {t('workout.resumeTitle')}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.panelAccent + '29' }]}>
            <Text style={[styles.badgeValue, { color: colors.panelAccent }]}>
              {`${doneSets}/${totalSets}`}
            </Text>
            <Text style={[styles.badgeLabel, { color: colors.panelMuted }]}>
              {t('strengthHub.setsShort')}
            </Text>
          </View>
        </View>

        <View
          style={[styles.track, { backgroundColor: colors.panelText + '29' }]}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: totalSets, now: doneSets }}
        >
          <View
            style={[
              styles.trackFill,
              { width: `${Math.round(ratio * 100)}%`, backgroundColor: colors.panelAccent },
            ]}
          />
        </View>

        <PrimaryButton disabled={starting} colors={colors} label={t('workout.resume')} onPress={onResume} />
      </View>
    );
  }

  // ── B · la séance du jour, avec son contenu ────────────────────────────────────────────────
  if (state.kind === 'today') {
    const { session } = state;
    const name =
      session.name?.trim() ||
      t('programs.detail.sessionFallback', { index: session.orderIndex + 1 });
    const extra = session.exerciseCount - session.previewExercises.length;

    return (
      <View style={[styles.panel, { backgroundColor: colors.panel }]}>
        <View style={styles.headRow}>
          <View style={styles.headTexts}>
            <Text style={[styles.eyebrow, { color: colors.panelAccent }]}>
              {t('strengthHub.today.eyebrow')}
            </Text>
            <Text style={[styles.title, { color: colors.panelText }]} numberOfLines={2}>
              {name}
            </Text>
          </View>
          {session.estimatedMinutes != null ? (
            <View style={[styles.badge, { backgroundColor: colors.panelAccent + '29' }]}>
              <Text style={[styles.badgeValue, { color: colors.panelAccent }]}>
                {t('strengthHub.minutesShort', { count: session.estimatedMinutes })}
              </Text>
              <Text style={[styles.badgeLabel, { color: colors.panelMuted }]}>
                {t('strengthHub.estimated')}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Le contenu de la séance : on savait « 5 exercices », jamais lesquels. */}
        {session.previewExercises.length > 0 ? (
          <View style={styles.preview}>
            {session.previewExercises.map((exercise) => (
              <Text
                key={exercise}
                style={[styles.previewLine, { color: colors.panelText }]}
                numberOfLines={1}
              >
                {exercise}
              </Text>
            ))}
            {extra > 0 ? (
              <Text style={[styles.previewMore, { color: colors.panelMuted }]}>
                {t('strengthHub.today.more', { count: extra })}
              </Text>
            ) : null}
          </View>
        ) : null}

        <PrimaryButton
          disabled={starting}
          colors={colors}
          label={t('home.today.cta')}
          onPress={() => onStartToday(session.sessionId, session.plannedSessionId)}
        />

        <View style={styles.secondaryRow}>
          <Pressable accessibilityRole="button" onPress={onStartFree} hitSlop={6}>
            <Text style={[styles.secondaryLink, { color: colors.panelMuted }]}>
              {t('workout.freeTitle')}
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onFromTemplate} hitSlop={6}>
            <Text style={[styles.secondaryLink, { color: colors.panelMuted }]}>
              {t('workout.freeStart.fromTemplate')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── C · jour de repos : une information, pas un vide ───────────────────────────────────────
  if (state.kind === 'rest') {
    const { doneToday, nextUpcoming } = state;
    const nextLabel = (() => {
      if (doneToday) {
        return t('home.today.doneToday', {
          name: doneToday.name?.trim() || t('programs.detail.sessionFallback', { index: 1 }),
        });
      }
      if (nextUpcoming) {
        const [, mm, dd] = nextUpcoming.scheduledDate.split('-');
        return t('home.today.next', {
          date: `${dd}/${mm}`,
          name: nextUpcoming.name?.trim() || t('programs.detail.sessionFallback', { index: 1 }),
        });
      }
      return t('strengthHub.rest.noNext');
    })();

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.restHead}>
          <View style={[styles.restIcon, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name="moon-outline" size={19} color={colors.textMuted} />
          </View>
          <View style={styles.headTexts}>
            <Text style={[styles.restTitle, { color: colors.text }]}>
              {doneToday ? t('strengthHub.rest.doneTitle') : t('strengthHub.rest.title')}
            </Text>
            <Text style={[styles.restSub, { color: colors.textMuted }]} numberOfLines={2}>
              {nextLabel}
            </Text>
          </View>
        </View>

        {/* Deux sorties de secours, aucune injonction (décision H). */}
        <View style={styles.restActions}>
          <Pressable
            accessibilityRole="button"
            onPress={onOpenPlanning}
            style={({ pressed }) => [
              styles.ghost,
              { borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.ghostLabel, { color: colors.text }]}>
              {t('strengthHub.rest.seePlanning')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onStartFree}
            style={({ pressed }) => [
              styles.ghost,
              { borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.ghostLabel, { color: colors.text }]}>
              {t('workout.freeTitle')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── D · aucun programme : l'amorce remplace « Séance libre » ───────────────────────────────
  return (
    <View style={[styles.panel, { backgroundColor: colors.panel }]}>
      <View style={styles.headTexts}>
        <Text style={[styles.eyebrow, { color: colors.panelAccent }]}>
          {t('strengthHub.onboarding.eyebrow')}
        </Text>
        <Text style={[styles.onboardingTitle, { color: colors.panelText }]}>
          {t('strengthHub.onboarding.title')}
        </Text>
        <Text style={[styles.onboardingSub, { color: colors.panelMuted }]}>
          {t('strengthHub.onboarding.subtitle')}
        </Text>
      </View>

      <PrimaryButton disabled={starting} colors={colors} label={t('strengthHub.onboarding.cta')} onPress={onBrowsePrograms} />

      <View style={styles.freeRow}>
        <Text style={[styles.freeHint, { color: colors.panelMuted }]}>
          {t('strengthHub.onboarding.freeHint')}
        </Text>
        <Pressable accessibilityRole="button" onPress={onStartFree} hitSlop={6}>
          <Text style={[styles.freeLink, { color: colors.panelText }]}>
            {t('workout.freeTitle')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: 22, padding: 20, gap: 14 },
  card: { borderRadius: 22, borderWidth: 1, padding: 18, gap: 14 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headTexts: { flex: 1, gap: 5 },
  eyebrow: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  title: { fontFamily: fontFamily.displayBold, fontSize: 24, letterSpacing: -0.6, lineHeight: 27 },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, alignItems: 'center' },
  badgeValue: { fontFamily: fontFamily.monoBold, fontSize: 15 },
  badgeLabel: { fontFamily: fontFamily.bodySemi, fontSize: 9, letterSpacing: 0.6 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  trackFill: { height: 6, borderRadius: 3 },
  preview: { gap: 6 },
  previewLine: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 18 },
  previewMore: { fontFamily: fontFamily.body, fontSize: 12.5 },
  primary: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
  secondaryRow: { flexDirection: 'row', justifyContent: 'center', gap: 18 },
  secondaryLink: { fontFamily: fontFamily.body, fontSize: 12.5, textDecorationLine: 'underline' },
  restHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  restIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  restTitle: { fontFamily: fontFamily.displaySemi, fontSize: 16, letterSpacing: -0.3 },
  restSub: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17 },
  restActions: { flexDirection: 'row', gap: 10 },
  ghost: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostLabel: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  onboardingTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 23,
    letterSpacing: -0.6,
    lineHeight: 28,
  },
  onboardingSub: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 19, marginTop: 2 },
  freeRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  freeHint: { fontFamily: fontFamily.body, fontSize: 12.5 },
  freeLink: { fontFamily: fontFamily.bodySemi, fontSize: 12.5, textDecorationLine: 'underline' },
  pressed: { opacity: 0.8 },
});
