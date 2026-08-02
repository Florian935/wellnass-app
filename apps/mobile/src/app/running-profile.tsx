import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  RUNNER_OBJECTIVES,
  RUNNER_LEVELS,
  sessionTargetPace,
  type RunnerObjective,
  type RunnerLevel,
  type SessionType,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { TextField } from '@/components/TextField';
import {
  upsertRunnerProfile,
  useRunnerProfile,
} from '@/data/repositories/running-profile-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Types de séance affichés dans la section "Mes allures" (course_libre exclue). */
const PACE_SESSION_TYPES: readonly SessionType[] = [
  'endurance',
  'sortie_longue',
  'recuperation',
  'fractionne',
] as const;

/** Intervalles d'annonce proposés (US RUN-F2a, spec R1), en mètres. */
const ANNOUNCEMENT_INTERVALS_M = [500, 1000, 2000] as const;

export default function RunnerProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();

  const { runnerProfile } = useRunnerProfile();

  // État local pour le champ allure de référence (saisie libre M:SS).
  // Offline-first : démarre null ; la valeur affichée retombe sur la valeur persistée
  // (résolue de façon asynchrone par PowerSync) tant que l'utilisateur n'a pas édité.
  const [paceText, setPaceText] = useState<string | null>(null);

  const objective: RunnerObjective | null = runnerProfile?.objective ?? null;
  const level: RunnerLevel | null = runnerProfile?.level ?? null;
  const weeklyFrequency: number | null = runnerProfile?.weeklyFrequency ?? null;
  const ref5kPaceSPerKm: number | null = runnerProfile?.ref5kPaceSPerKm ?? null;
  // US RUN-F2a : désactivé par défaut tant qu'aucun profil n'existe (spec R1).
  const voiceAnnouncementsEnabled = runnerProfile?.voiceAnnouncementsEnabled ?? false;
  const voiceAnnouncementIntervalM = runnerProfile?.voiceAnnouncementIntervalM ?? 1000;

  const onPaceChange = (v: string) => {
    setPaceText(v);
    const p = units.parsePace(v);
    if (p != null) {
      void upsertRunnerProfile({ ref5kPaceSPerKm: p });
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Objectif */}
      <Text style={[styles.section, { color: colors.textMuted }]}>
        {t('running.profile.objective')}
      </Text>
      <OptionList
        options={RUNNER_OBJECTIVES}
        value={objective}
        onChange={(o) => void upsertRunnerProfile({ objective: o })}
        label={(o) => t(`running.objective.${o}`)}
      />

      {/* Niveau */}
      <Text style={[styles.section, { color: colors.textMuted }]}>
        {t('running.profile.level')}
      </Text>
      <OptionList
        options={RUNNER_LEVELS}
        value={level}
        onChange={(l) => void upsertRunnerProfile({ level: l })}
        label={(l) => t(`running.level.${l}`)}
      />

      {/* Allure de référence */}
      <Card>
        <TextField
          label={`${t('running.profile.ref5k')} (/${units.distanceSymbol})`}
          value={paceText ?? units.paceInputValue(runnerProfile?.ref5kPaceSPerKm)}
          onChangeText={onPaceChange}
          keyboardType="numbers-and-punctuation"
          placeholder={t(
            units.system === 'imperial'
              ? 'running.profile.ref5kPlaceholderImperial'
              : 'running.profile.ref5kPlaceholderMetric',
          )}
        />
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {t('running.profile.ref5kHint')}
        </Text>
      </Card>

      {/* Fréquence hebdo */}
      <Text style={[styles.section, { color: colors.textMuted }]}>
        {t('running.profile.frequency')}
      </Text>
      <View style={styles.freqRow}>
        {[1, 2, 3, 4, 5, 6, 7].map((n) => {
          const active = weeklyFrequency === n;
          return (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => void upsertRunnerProfile({ weeklyFrequency: n })}
              style={[
                styles.freqChip,
                {
                  backgroundColor: active ? colors.accent : colors.surface,
                  borderColor: active ? colors.accent : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.freqLabel,
                  { color: active ? colors.accentText : colors.textMuted },
                ]}
              >
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Mes allures d'entraînement */}
      <Text style={[styles.section, { color: colors.textMuted }]}>
        {t('running.profile.paces')}
      </Text>
      {ref5kPaceSPerKm == null ? (
        <Card>
          <Text style={[styles.cardText, { color: colors.textMuted }]}>
            {t('running.profile.pacesEmpty')}
          </Text>
        </Card>
      ) : (
        <View style={[styles.paceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {PACE_SESSION_TYPES.map((type, i) => {
            const range = sessionTargetPace(type, ref5kPaceSPerKm);
            if (range == null) return null;
            return (
              <View
                key={type}
                style={[
                  styles.paceRow,
                  i < PACE_SESSION_TYPES.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.paceType, { color: colors.text }]}>
                  {t(`running.sessionType.${type}`)}
                </Text>
                <Text style={[styles.paceRange, { color: colors.accent }]}>
                  {t('running.paces.range', {
                    min: units.formatPace(range.minSPerKm),
                    max: units.formatPace(range.maxSPerKm),
                  })}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Annonces vocales (US RUN-F2a, roadmap 5.19) */}
      <Text style={[styles.section, { color: colors.textMuted }]}>
        {t('running.profile.announcements')}
      </Text>
      <View style={[styles.announceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.announceRow}>
          <View style={styles.announceGrow}>
            <Text style={[styles.listLabel, { color: colors.text }]}>
              {t('running.profile.announcementsToggle')}
            </Text>
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              {t('running.profile.announcementsHint')}
            </Text>
          </View>
          <Switch
            value={voiceAnnouncementsEnabled}
            onValueChange={(v) => void upsertRunnerProfile({ voiceAnnouncementsEnabled: v })}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor="#ffffff"
            accessibilityLabel={t('running.profile.announcementsToggle')}
          />
        </View>

        {voiceAnnouncementsEnabled ? (
          <View style={[styles.announceIntervalRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              {t('running.profile.announcementsInterval')}
            </Text>
            <View style={styles.freqRow}>
              {ANNOUNCEMENT_INTERVALS_M.map((m) => {
                const active = voiceAnnouncementIntervalM === m;
                return (
                  <Pressable
                    key={m}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => void upsertRunnerProfile({ voiceAnnouncementIntervalM: m })}
                    style={[
                      styles.freqChip,
                      {
                        backgroundColor: active ? colors.accent : colors.surface,
                        borderColor: active ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.freqLabel,
                        { color: active ? colors.accentText : colors.textMuted },
                      ]}
                    >
                      {m < 1000 ? `${m} m` : `${m / 1000} km`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Button label={t('common.back')} onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}

type OptionListProps<T extends string> = {
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  label: (option: T) => string;
};

/** Liste d'options verticale à sélection unique (radio). */
function OptionList<T extends string>({ options, value, onChange, label }: OptionListProps<T>) {
  const { colors } = useTheme();
  return (
    <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {options.map((option, i) => {
        const selected = value === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option)}
            style={[
              styles.listItem,
              i < options.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
          >
            <View style={[styles.radio, { borderColor: selected ? colors.accent : colors.border }]}>
              {selected ? <View style={[styles.radioDot, { backgroundColor: colors.accent }]} /> : null}
            </View>
            <Text style={[styles.listLabel, { color: colors.text }]}>{label(option)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12 },
  section: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
  },
  cardText: { fontFamily: fontFamily.body, fontSize: 15, lineHeight: 21 },
  list: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  listLabel: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 16 },
  freqRow: { flexDirection: 'row', gap: 6 },
  freqChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  freqLabel: { fontFamily: fontFamily.monoBold, fontSize: 15 },
  paceCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  paceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  paceType: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 14 },
  paceRange: { fontFamily: fontFamily.monoBold, fontSize: 14 },
  hint: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18, marginTop: 4 },
  footer: { marginTop: 20 },
  announceCard: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12 },
  announceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  announceGrow: { flex: 1, gap: 2 },
  announceIntervalRow: { borderTopWidth: 1, paddingTop: 12, gap: 8 },
});
