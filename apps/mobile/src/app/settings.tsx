import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStatus } from '@powersync/react';
import {
  LOCALES,
  PILLARS,
  UNIT_SYSTEMS,
  WORKOUT_DISPLAY_LEVELS,
  type Locale,
  type NotificationPrefs,
  type Pillar,
  type Theme,
  type UnitSystem,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import { Segment } from '@/components/Segment';
import { upsertProfile, useProfile } from '@/data/repositories/profile-repository';
import { togglePillar, updateSettings, useSettings } from '@/data/repositories/settings-repository';
import {
  useNotificationPrefs,
  updateNotificationPrefs,
} from '@/data/repositories/notification-repository';
import { getAppLanguage } from '@/i18n';
import { exportUserData } from '@/lib/data-export';
import { ensurePermissionAndChannel } from '@/lib/notifications';
import { useAuthStore } from '@/stores/auth-store';
import {
  MENU_COLOR_SWATCHES,
  MENU_KEYS,
  useMenuAccent,
  type MenuKey,
} from '@/stores/menu-accent-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const THEME_OPTIONS = ['system', 'light', 'dark'] as const;

/** Libellé i18n de chaque menu (réutilise onglet Accueil + noms de piliers). */
const MENU_LABEL_KEY: Record<MenuKey, string> = {
  home: 'tabs.home',
  strength: 'pillars.strength',
  running: 'pillars.running',
  nutrition: 'pillars.nutrition',
};

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
  const menuColorsEnabled = useMenuAccent((s) => s.enabled);
  const setMenuColorsEnabled = useMenuAccent((s) => s.setEnabled);
  const menuColors = useMenuAccent((s) => s.colors);
  const setMenuColor = useMenuAccent((s) => s.setColor);
  const resetMenuColors = useMenuAccent((s) => s.reset);
  // Defaults null-safe tant que les réglages ne sont pas chargés / synchronisés.
  const activePillars = settings?.activePillars ?? [...PILLARS];
  const theme = settings?.theme ?? 'system';
  const units = settings?.units ?? 'metric';
  const language = settings?.language ?? getAppLanguage();
  const email = useAuthStore((s) => s.session?.user.email);
  const signOut = useAuthStore((s) => s.signOut);
  const userId = useAuthStore((s) => s.session?.user.id) ?? null;
  const { connected, hasSynced } = useStatus();
  const { profile } = useProfile();
  const displayLevel = profile?.workoutDisplayLevel ?? 'normal';
  const [exporting, setExporting] = useState(false);

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

  const runExport = async () => {
    if (!userId) return;
    setExporting(true);
    const res = await exportUserData(userId, !!hasSynced, t);
    setExporting(false);
    if ('error' in res) {
      Alert.alert(t(res.error === 'unavailable' ? 'account.export.errorUnavailable' : 'account.export.errorFailed'));
    }
  };
  const onExport = () => {
    if (!hasSynced) {
      Alert.alert(t('account.export.syncWarningTitle'), t('account.export.syncWarningBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('settings.dataExport.button'), onPress: () => void runExport() },
      ]);
      return;
    }
    void runExport();
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

      {/* Couleurs des menus : un accent par onglet (Accueil / Muscu / Course / Alimentation) */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 28 }]}>
        {t('settings.menuColors.title')}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>
            {t('settings.menuColors.enable')}
          </Text>
          <Switch
            value={menuColorsEnabled}
            onValueChange={setMenuColorsEnabled}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor="#ffffff"
            accessibilityLabel={t('settings.menuColors.enable')}
          />
        </View>
      </View>
      {menuColorsEnabled && (
        <>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 10 },
            ]}
          >
            {MENU_KEYS.map((menu, i) => (
              <View
                key={menu}
                style={[
                  styles.menuColorRow,
                  i < MENU_KEYS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
              >
                <View style={styles.menuColorHead}>
                  <View style={[styles.menuColorDot, { backgroundColor: menuColors[menu] }]} />
                  <Text style={[styles.rowLabel, { color: colors.text }]}>
                    {t(MENU_LABEL_KEY[menu])}
                  </Text>
                </View>
                <View style={styles.swatches}>
                  {MENU_COLOR_SWATCHES.map((sw) => {
                    const selected = menuColors[menu].toLowerCase() === sw.toLowerCase();
                    return (
                      <Pressable
                        key={sw}
                        onPress={() => setMenuColor(menu, sw)}
                        hitSlop={4}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`${t(MENU_LABEL_KEY[menu])} · ${sw}`}
                        style={[
                          styles.swatch,
                          { backgroundColor: sw, borderColor: selected ? colors.text : 'transparent' },
                        ]}
                      />
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
          <View style={styles.stack}>
            <Button
              label={t('settings.menuColors.reset')}
              variant="ghost"
              onPress={() => resetMenuColors()}
            />
          </View>
        </>
      )}
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('settings.menuColors.hint')}</Text>

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

      {/* Langue (FR/EN) — correction bug « aucun sélecteur de langue » */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 28 }]}>
        {t('settings.language.title')}
      </Text>
      <Segment
        options={LOCALES}
        value={language}
        onChange={(next: Locale) => void updateSettings({ language: next })}
        label={(option) => t(`settings.language.${option}`)}
      />

      {/* Niveau d'affichage de la séance (US MUSC-F13) */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 28 }]}>
        {t('settings.workoutDisplayLevel.title')}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {WORKOUT_DISPLAY_LEVELS.map((lvl, i) => {
          const selected = displayLevel === lvl;
          return (
            <Pressable
              key={lvl}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => void upsertProfile({ workoutDisplayLevel: lvl })}
              style={[
                styles.menuColorRow,
                { flexDirection: 'row', alignItems: 'center', gap: 12 },
                i < WORKOUT_DISPLAY_LEVELS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>
                  {t(`workout.displayLevel.levels.${lvl}.label`)}
                </Text>
                <Text style={[styles.hint, { color: colors.textMuted, marginTop: 0 }]}>
                  {t(`workout.displayLevel.levels.${lvl}.description`)}
                </Text>
              </View>
              <View
                style={[
                  styles.menuColorDot,
                  {
                    backgroundColor: selected ? colors.accent : 'transparent',
                    borderColor: colors.border,
                    borderWidth: selected ? 0 : 1.5,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {t('settings.workoutDisplayLevel.hint')}
      </Text>

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

      {/* Aide & support (US 1.22) */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 28 }]}>
        {t('settings.help.title')}
      </Text>
      <View style={styles.stack}>
        <Button label={t('settings.help.button')} variant="ghost" onPress={() => router.push('/help')} />
      </View>

      {/* Statistiques d'usage — opt-out (US 9.10, RGPD) */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 28 }]}>
        {t('settings.analytics.title')}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.row}>
          <View style={styles.rowGrow}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{t('settings.analytics.toggle')}</Text>
            <Text style={[styles.rowDesc, { color: colors.textMuted }]}>{t('settings.analytics.subtitle')}</Text>
          </View>
          <Switch
            value={settings?.analyticsEnabled ?? true}
            onValueChange={(next) => void updateSettings({ analyticsEnabled: next })}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor="#ffffff"
            accessibilityLabel={t('settings.analytics.toggle')}
          />
        </View>
      </View>

      {/* Export de données (US CONF-01, RGPD) */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 28 }]}>
        {t('settings.dataExport.title')}
      </Text>
      <Text style={[styles.hint, { color: colors.textMuted, marginTop: 0 }]}>
        {t('settings.dataExport.subtitle')}
      </Text>
      <View style={styles.stack}>
        <Button
          label={t('settings.dataExport.button')}
          onPress={onExport}
          loading={exporting}
        />
      </View>

      {/* Zone de danger (US CONF-02) */}
      <View style={[styles.dangerZone, { borderColor: colors.danger, backgroundColor: colors.surface }]}>
        <Text style={[styles.dangerTitle, { color: colors.danger }]}>
          {t('settings.dangerZone.title')}
        </Text>
        <Text style={[styles.hint, { color: colors.textMuted, marginTop: 0 }]}>
          {t('settings.dangerZone.subtitle')}
        </Text>
        <Button
          label={t('settings.dangerZone.delete')}
          variant="destructive"
          disabled={!connected}
          onPress={() => router.push('/account-delete')}
        />
        {!connected ? (
          <Text style={[styles.hint, { color: colors.textMuted, marginTop: 0 }]}>
            {t('settings.dangerZone.requiresConnection')}
          </Text>
        ) : null}
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
  dangerZone: {
    marginTop: 28,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  dangerTitle: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  stack: { gap: 10, marginTop: 10 },
  // Couleurs des menus
  menuColorRow: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  menuColorHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  menuColorDot: { width: 16, height: 16, borderRadius: 8 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 3 },
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
