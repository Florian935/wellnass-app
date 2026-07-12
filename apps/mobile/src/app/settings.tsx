import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  PILLARS,
  UNIT_SYSTEMS,
  type NotificationPrefs,
  type Pillar,
  type Theme,
  type UnitSystem,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import { Segment } from '@/components/Segment';
import { upsertProfile } from '@/data/repositories/profile-repository';
import { togglePillar, updateSettings, useSettings } from '@/data/repositories/settings-repository';
import {
  useNotificationPrefs,
  updateNotificationPrefs,
} from '@/data/repositories/notification-repository';
import { ensurePermissionAndChannel } from '@/lib/notifications';
import { useAuthStore } from '@/stores/auth-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const THEME_OPTIONS = ['system', 'light', 'dark'] as const;

/** Formate une heure entière 0-23 en `HH:00`. */
function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/**
 * Sélecteur d'heure 0-23 en pur JS (pas de date-picker natif). Boucle
 * modulo 24 (`− à 0` → 23, `+ à 23` → 0). Boutons étiquetés (a11y).
 */
function HourStepper({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.stepper,
        { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
        disabled && styles.disabled,
      ]}
    >
      <Pressable
        onPress={() => onChange((value + 23) % 24)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t('settings.notifications.decreaseHour')}
        hitSlop={8}
        style={styles.stepperBtn}
      >
        <Text style={[styles.stepperSign, { color: colors.accent }]}>−</Text>
      </Pressable>
      <Text style={[styles.stepperVal, { color: colors.text, borderColor: colors.border }]}>
        {formatHour(value)}
      </Text>
      <Pressable
        onPress={() => onChange((value + 1) % 24)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t('settings.notifications.increaseHour')}
        hitSlop={8}
        style={styles.stepperBtn}
      >
        <Text style={[styles.stepperSign, { color: colors.accent }]}>+</Text>
      </Pressable>
    </View>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { settings } = useSettings();
  // Defaults null-safe tant que les réglages ne sont pas chargés / synchronisés.
  const activePillars = settings?.activePillars ?? [...PILLARS];
  const theme = settings?.theme ?? 'system';
  const units = settings?.units ?? 'metric';
  const email = useAuthStore((s) => s.session?.user.email);
  const signOut = useAuthStore((s) => s.signOut);

  // Préférences de notifications (US 2.6/2.8/1.17).
  const notificationPrefs = useNotificationPrefs();
  // État de permission système — pour afficher le bandeau informatif si refusée.
  const [notificationsGranted, setNotificationsGranted] = useState(true);
  useEffect(() => {
    void ensurePermissionAndChannel().then(setNotificationsGranted);
  }, []);

  const patchNotifications = (patch: Partial<NotificationPrefs>) =>
    void updateNotificationPrefs(notificationPrefs, patch);

  const relaunchOnboarding = async () => {
    // Réinitialise le drapeau d'onboarding via le profil ; la gate de routing
    // redirigera automatiquement vers l'onboarding.
    await upsertProfile({ onboardingCompletedAt: null });
    router.replace('/(onboarding)/intro');
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      {/* Profil */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
        {t('settings.profile.title')}
      </Text>
      <View style={styles.stack}>
        <Button label={t('settings.profile.edit')} variant="ghost" onPress={() => router.push('/profile')} />
        {activePillars.includes('nutrition') ? (
          <Button
            label={t('settings.profile.nutrition')}
            variant="ghost"
            onPress={() => router.push('/nutrition-profile')}
          />
        ) : null}
        {activePillars.includes('running') ? (
          <Button
            label={t('settings.profile.running')}
            variant="ghost"
            onPress={() => router.push('/running-profile')}
          />
        ) : null}
        <Button label={t('settings.profile.relaunchOnboarding')} variant="ghost" onPress={() => void relaunchOnboarding()} />
      </View>

      {/* Piliers actifs (décision H) */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 28 }]}>
        {t('settings.pillars.title')}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {PILLARS.map((pillar: Pillar, i) => (
          <View
            key={pillar}
            style={[
              styles.row,
              i < PILLARS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
          >
            <Text style={[styles.rowLabel, { color: colors.text }]}>{t(`pillars.${pillar}`)}</Text>
            <Switch
              value={activePillars.includes(pillar)}
              onValueChange={() => void togglePillar(pillar)}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor="#ffffff"
              accessibilityLabel={t(`pillars.${pillar}`)}
            />
          </View>
        ))}
      </View>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('settings.pillars.hint')}</Text>

      {/* Apparence (thème) */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 28 }]}>
        {t('settings.appearance.title')}
      </Text>
      <Segment
        options={THEME_OPTIONS}
        value={theme}
        onChange={(next: Theme) => void updateSettings({ theme: next })}
        label={(option) => t(`settings.appearance.${option}`)}
      />

      {/* Unités (item 1.15) */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 28 }]}>
        {t('settings.units.title')}
      </Text>
      <Segment
        options={UNIT_SYSTEMS}
        value={units}
        onChange={(next: UnitSystem) => void updateSettings({ units: next })}
        label={(option) => t(`settings.units.${option}`)}
      />
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('settings.units.hint')}</Text>

      {/* Notifications (US 2.6 rappel streak, 1.17 gestion par type) */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 28 }]}>
        {t('settings.notifications.title')}
      </Text>
      {!notificationsGranted ? (
        <View
          style={[
            styles.banner,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.bannerText, { color: colors.text }]}>
            🔕 {t('settings.notifications.permissionDenied')}
          </Text>
        </View>
      ) : null}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.row}>
          <View style={styles.rowGrow}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>
              {t('settings.notifications.streakReminder')}
            </Text>
            <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
              {t('settings.notifications.streakReminderDesc')}
            </Text>
          </View>
          <Switch
            value={notificationPrefs.streakDanger}
            onValueChange={(next) => patchNotifications({ streakDanger: next })}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor="#ffffff"
            accessibilityLabel={t('settings.notifications.streakReminder')}
          />
        </View>
        <View style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.border }]}>
          <View style={styles.rowGrow}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>
              {t('settings.notifications.reminderTime')}
            </Text>
          </View>
          <HourStepper
            value={notificationPrefs.reminderHour}
            onChange={(next) => patchNotifications({ reminderHour: next })}
            disabled={!notificationPrefs.streakDanger}
          />
        </View>
      </View>

      {/* Ne pas déranger (US 2.8) */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 28 }]}>
        {t('settings.notifications.dndTitle')}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.row}>
          <View style={styles.rowGrow}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>
              {t('settings.notifications.dnd')}
            </Text>
            <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
              {t('settings.notifications.dndDesc')}
            </Text>
          </View>
          <Switch
            value={notificationPrefs.dndEnabled}
            onValueChange={(next) => patchNotifications({ dndEnabled: next })}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor="#ffffff"
            accessibilityLabel={t('settings.notifications.dnd')}
          />
        </View>
        <View style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.border }]}>
          <View style={styles.rowGrow}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>
              {t('settings.notifications.dndStart')}
            </Text>
          </View>
          <HourStepper
            value={notificationPrefs.dndStartHour}
            onChange={(next) => patchNotifications({ dndStartHour: next })}
            disabled={!notificationPrefs.dndEnabled}
          />
        </View>
        <View style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.border }]}>
          <View style={styles.rowGrow}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>
              {t('settings.notifications.dndEnd')}
            </Text>
          </View>
          <HourStepper
            value={notificationPrefs.dndEndHour}
            onChange={(next) => patchNotifications({ dndEndHour: next })}
            disabled={!notificationPrefs.dndEnabled}
          />
        </View>
      </View>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {t('settings.notifications.hint')}
      </Text>

      {/* Compte */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 28 }]}>
        {t('settings.account.title')}
      </Text>
      {email ? <Text style={[styles.rowLabel, { color: colors.text }]}>{email}</Text> : null}
      <View style={styles.signOut}>
        <Button label={t('settings.account.signOut')} variant="ghost" onPress={() => void signOut()} />
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
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLabel: { fontFamily: fontFamily.bodySemi, fontSize: 16 },
  rowGrow: { flex: 1, minWidth: 0, paddingRight: 12 },
  rowDesc: { fontFamily: fontFamily.body, fontSize: 12, marginTop: 2, lineHeight: 16 },
  hint: { fontFamily: fontFamily.body, fontSize: 13, marginTop: 8, lineHeight: 18 },
  signOut: { marginTop: 12 },
  stack: { gap: 10 },
  // Sélecteur d'heure (stepper JS)
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  stepperBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepperSign: { fontFamily: fontFamily.bodySemi, fontSize: 20 },
  stepperVal: {
    minWidth: 62,
    textAlign: 'center',
    fontFamily: fontFamily.mono,
    fontSize: 15,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    lineHeight: 36,
  },
  disabled: { opacity: 0.4 },
  // Bandeau permission refusée
  banner: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  bannerText: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
});
