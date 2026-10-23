import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  RUNNER_OBJECTIVES,
  RUNNER_LEVELS,
  type RunnerObjective,
  type RunnerLevel,
} from '@wellness/shared';
import { GuidanceSelector } from '@/components/guidance/GuidanceSelector';
import { ReferencePaceCard } from '@/components/running/ReferencePaceCard';
import { useGuidance } from '@/data/guidance';
import {
  upsertRunnerProfile,
  useRunnerProfile,
} from '@/data/repositories/running-profile-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { useMenuFocus } from '@/hooks/useMenuFocus';
import { KeyboardAwareScrollView } from '@/components/keyboard';

/** Intervalles d'annonce proposés (US RUN-F2a, spec R1), en mètres. */
const ANNOUNCEMENT_INTERVALS_M = [500, 1000, 2000] as const;

export default function RunnerProfileScreen() {
  // US CARDIO-UX02 — **l'identité du pilier appartient à l'écran, pas à l'onglet d'où l'on vient.**
  // `useMenuFocus` n'était appelé que par les cinq onglets : un écran course ouvert depuis
  // l'Accueil (`NowCard`, `QuickActions`, `RecordRecentCard` y poussent tous vers `/run…`)
  // héritait du terracotta de l'accueil. Le déclarer ici rend la couleur du pilier vraie quel
  // que soit le chemin — un test de garde vérifie qu'aucun écran course ne l'oublie.
  useMenuFocus('running');

  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const { runnerProfile } = useRunnerProfile();
  // US GUID-01 — le régime vit dans le pilier qu'il gouverne, jamais dans la liste des réglages.
  const guidance = useGuidance('running');

  const objective: RunnerObjective | null = runnerProfile?.objective ?? null;
  const level: RunnerLevel | null = runnerProfile?.level ?? null;
  const weeklyFrequency: number | null = runnerProfile?.weeklyFrequency ?? null;
  const ref5kPaceSPerKm: number | null = runnerProfile?.ref5kPaceSPerKm ?? null;
  // US RUN-F2a : désactivé par défaut tant qu'aucun profil n'existe (spec R1).
  const voiceAnnouncementsEnabled = runnerProfile?.voiceAnnouncementsEnabled ?? false;
  const voiceAnnouncementIntervalM = runnerProfile?.voiceAnnouncementIntervalM ?? 1000;
  // US RUN-F2d : désactivé par défaut, réglage indépendant du précédent (spec R3).
  const intervalGuidanceEnabled = runnerProfile?.intervalGuidanceEnabled ?? false;

  return (
    <KeyboardAwareScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      {/* Guidage — en tête : il décide de ce que tous les réglages du dessous produiront à l'écran. */}
      <Text style={[styles.section, { color: colors.textMuted }]}>
        {t('guidance.sectionTitle')}
      </Text>
      <GuidanceSelector
        pillar="running"
        source={guidance.source}
        onChange={guidance.setRegime}
        colors={colors}
      />

      {/* US CARDIO-02 (§3.4, D8) — l'allure de référence, premier réglage du pilier : la valeur, d'où
          elle vient, les quatre allures qu'elle produit, et les portes pour la changer. Elle remplace
          le champ « allure actuelle sur 5 km », écrit à chaque frappe sans rien montrer (F2). */}
      <Text style={[styles.section, { color: colors.textMuted }]}>{t('running.refPace.title')}</Text>
      <ReferencePaceCard refSPerKm={ref5kPaceSPerKm} onChange={() => router.push('/running-pace')} />

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

      {/* Guidage fractionné vocal + vibration (US RUN-F2d, roadmap 5.18) */}
      <Text style={[styles.section, { color: colors.textMuted }]}>
        {t('running.profile.intervalGuidance')}
      </Text>
      <View style={[styles.announceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.announceRow}>
          <View style={styles.announceGrow}>
            <Text style={[styles.listLabel, { color: colors.text }]}>
              {t('running.profile.intervalGuidanceToggle')}
            </Text>
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              {t('running.profile.intervalGuidanceHint')}
            </Text>
          </View>
          <Switch
            value={intervalGuidanceEnabled}
            onValueChange={(v) => void upsertRunnerProfile({ intervalGuidanceEnabled: v })}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor="#ffffff"
            accessibilityLabel={t('running.profile.intervalGuidanceToggle')}
          />
        </View>
      </View>

      {/* US CARDIO-02 (F39) — plus de bouton « Retour » en pied : la flèche de l'en-tête suffit. */}
    </KeyboardAwareScrollView>
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
  hint: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18, marginTop: 4 },
  announceCard: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12 },
  announceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  announceGrow: { flex: 1, gap: 2 },
  announceIntervalRow: { borderTopWidth: 1, paddingTop: 12, gap: 8 },
});
