/**
 * Réglages › Séance — US MUSCU-UX03, spec §6.
 *
 * Un écran dédié plutôt qu'une section de plus dans des Réglages déjà longs : le mode immersif
 * apporte **huit** interrupteurs, et ils n'ont de sens qu'ensemble. On y trouve aussi le **niveau
 * d'affichage** — il était jusqu'ici uniquement joignable depuis le menu de la séance en cours,
 * c'est-à-dire au pire moment pour se poser la question.
 *
 * Tous ces réglages sont **locaux à l'appareil** (`secureStorage`), sauf le niveau d'affichage qui
 * reste dans le profil synchronisé : c'est une préférence de densité d'information, pas de mise en
 * scène. Voir `session-mode-store` et `immersive-prefs-store`.
 */

import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  COACH_CHARACTERS,
  KG_BARS,
  WORKOUT_DISPLAY_LEVELS,
  WORKOUT_DISPLAY_MODES,
  type CoachCharacter,
  type WorkoutDisplayLevel,
  type WorkoutDisplayMode,
} from '@wellness/shared';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Segment } from '@/components/Segment';
import { upsertProfile, useProfile } from '@/data/repositories/profile-repository';
import { useImmersivePrefs } from '@/stores/immersive-prefs-store';
import { useSessionMode } from '@/stores/session-mode-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Une ligne « libellé + description + interrupteur ». */
function ToggleRow({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderTopColor: colors.border }]}>
      <View style={styles.rowGrow}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        {description ? (
          <Text style={[styles.rowDesc, { color: colors.textMuted }]}>{description}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor="#ffffff"
        accessibilityLabel={label}
      />
    </View>
  );
}

export default function SessionSettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const mode = useSessionMode((s) => s.mode);
  const setMode = useSessionMode((s) => s.setMode);

  const prefs = useImmersivePrefs();
  const update = useImmersivePrefs((s) => s.update);

  const { profile } = useProfile();
  const level: WorkoutDisplayLevel = profile?.workoutDisplayLevel ?? 'normal';

  const modeLabel = (value: WorkoutDisplayMode) => t(`workoutMode.${value}`);
  const coachLabel = (value: CoachCharacter) =>
    t(
      value === 'motivant'
        ? 'settingsSession.coachMotivant'
        : value === 'sobre'
          ? 'settingsSession.coachSobre'
          : 'settingsSession.coachMuet',
    );

  return (
    <Screen>
      <ScreenHeader title={t('settingsSession.title')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Mode par défaut */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
          {t('settingsSession.defaultMode')}
        </Text>
        <Segment
          options={WORKOUT_DISPLAY_MODES}
          value={mode}
          onChange={(value) => setMode(value)}
          label={modeLabel}
        />
        <Text style={[styles.help, { color: colors.textMuted }]}>
          {t('settingsSession.defaultModeHelp')}
        </Text>

        {/* Niveau d'affichage — préférence de profil, valable dans les deux modes */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 28 }]}>
          {t('workout.displayLevel.title')}
        </Text>
        <Segment
          options={WORKOUT_DISPLAY_LEVELS}
          value={level}
          onChange={(value) => void upsertProfile({ workoutDisplayLevel: value })}
          label={(option) => t(`workout.displayLevel.levels.${option}.label`)}
        />
        <Text style={[styles.help, { color: colors.textMuted }]}>
          {t(`workout.displayLevel.levels.${level}.description`)} {t('settingsSession.levelHelp')}
        </Text>

        {/* Mode immersif */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 28 }]}>
          {t('settingsSession.immersiveSection')}
        </Text>
        <Text style={[styles.rowLabel, { color: colors.text, marginBottom: 8 }]}>
          {t('settingsSession.coach')}
        </Text>
        <Segment
          options={COACH_CHARACTERS}
          value={prefs.coach}
          onChange={(value) => update({ coach: value })}
          label={coachLabel}
        />
        <Text style={[styles.help, { color: colors.textMuted }]}>
          {t('settingsSession.coachHelp')}
        </Text>

        <View style={styles.group}>
          <ToggleRow
            label={t('settingsSession.tempo')}
            description={t('settingsSession.tempoHelp')}
            value={prefs.tempo}
            onValueChange={(value) => update({ tempo: value })}
          />
          <ToggleRow
            label={t('settingsSession.breathing')}
            value={prefs.breathing}
            onValueChange={(value) => update({ breathing: value })}
          />
          <ToggleRow
            label={t('settingsSession.ghost')}
            description={t('settingsSession.ghostHelp')}
            value={prefs.ghost}
            onValueChange={(value) => update({ ghost: value })}
          />
          <ToggleRow
            label={t('settingsSession.sleep')}
            description={t('settingsSession.sleepHelp')}
            value={prefs.sleep}
            onValueChange={(value) => update({ sleep: value })}
          />
        </View>

        <Text style={[styles.rowLabel, { color: colors.text, marginTop: 20, marginBottom: 8 }]}>
          {t('settingsSession.bar')}
        </Text>
        <Segment
          options={KG_BARS.map(String)}
          value={String(prefs.barKg)}
          onChange={(value) => update({ barKg: Number(value) })}
          label={(option) => `${option} kg`}
        />

        {/* Pour les deux modes */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 28 }]}>
          {t('settingsSession.bothSection')}
        </Text>
        <View style={styles.group}>
          <ToggleRow
            label={`${t('settingsSession.restNotification')} · ${t('workoutMode.immersive')}`}
            description={t('settingsSession.restNotificationHelp')}
            value={prefs.restNotificationImmersive}
            onValueChange={(value) => update({ restNotificationImmersive: value })}
          />
          <ToggleRow
            label={`${t('settingsSession.restNotification')} · ${t('workoutMode.classic')}`}
            value={prefs.restNotificationClassic}
            onValueChange={(value) => update({ restNotificationClassic: value })}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 40 },
  sectionTitle: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  help: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18, marginTop: 8 },
  group: { marginTop: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  rowGrow: { flex: 1, gap: 2 },
  rowLabel: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  rowDesc: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17 },
});
