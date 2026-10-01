/**
 * US BIEN-02 / BIEN-06 / BIEN-07 — les réglages du pilier Bien-être.
 *
 * Quatre sections, dans l'ordre où l'on se les pose :
 *  1. **le pilier** — l'activer (avec consentement, données de santé) ou l'éteindre (données gardées) ;
 *  2. **les modules** (D6) — alcool, café tardif, sieste, fringales : éteints par défaut, chacun ajoute
 *     sa question au check-in du soir. L'eau vit dans Nutrition (NUTR-12) ;
 *  3. **la nuit lue dans Health Connect** (D3) — permission `READ_SLEEP` à part, la saisie manuelle
 *     prime toujours ;
 *  4. **le garde-fou** (D7) — ce que l'app dit quand l'humeur reste basse, et le numéro à appeler.
 */

import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { LOW_MOOD_HELPLINE } from '@/components/wellbeing/LowMoodCard';
import { toggleWellbeingPillar } from '@/components/wellbeing/wellbeing-consent';
import { updateSettings, useSettings } from '@/data/repositories/settings-repository';
import {
  getLastSleepImportAt,
  getSleepState,
  importSleep,
  openSettings,
  requestSleepPermissions,
  type HealthConnectState,
} from '@/lib/health-connect';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const MODULES = [
  { key: 'wellbeingAlcoholEnabled', i18n: 'alcohol' },
  { key: 'wellbeingCaffeineEnabled', i18n: 'caffeine' },
  { key: 'wellbeingNapEnabled', i18n: 'nap' },
  { key: 'wellbeingCravingsEnabled', i18n: 'cravings' },
] as const;

export default function WellbeingSettingsScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { settings } = useSettings();
  const enabled = settings?.wellbeingPillarEnabled === true;
  const sleepEnabled = settings?.sleepHealthConnectEnabled === true;

  const [sleepState, setSleepState] = useState<HealthConnectState | null>(null);
  const [lastImport, setLastImport] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const [imported, setImported] = useState<number | null>(null);

  const reload = useCallback(() => {
    void getSleepState().then(setSleepState).catch(() => setSleepState(null));
    void getLastSleepImportAt().then(setLastImport).catch(() => setLastImport(null));
  }, []);

  useEffect(() => {
    reload();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') reload();
    });
    return () => sub.remove();
  }, [reload, enabled, sleepEnabled]);

  /** Même séquence que le cycle : la permission d'abord, le réglage seulement si elle est accordée. */
  const enableSleep = async () => {
    setBusy(true);
    setDenied(false);
    const granted = await requestSleepPermissions();
    if (!granted) {
      setDenied(true);
      setBusy(false);
      return;
    }
    try {
      await updateSettings({ sleepHealthConnectEnabled: true });
      setImported(await importSleep());
    } catch {
      setDenied(true);
    }
    setBusy(false);
    reload();
  };

  const onToggleSleep = (next: boolean) => {
    if (next) {
      void enableSleep();
      return;
    }
    setDenied(false);
    void updateSettings({ sleepHealthConnectEnabled: false }).catch(() => undefined);
  };

  const runImport = async () => {
    setBusy(true);
    setImported(await importSleep());
    setBusy(false);
    reload();
  };

  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];
  const available = Platform.OS === 'android' && sleepState !== 'unsupported' && sleepState !== 'provider_missing';

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content} testID="wellbeing-settings">
      {/* 1. Le pilier */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('wellbeingSettings.pillar.title')}</Text>
      <View style={card}>
        <View style={styles.row}>
          <View style={styles.grow}>
            <Text style={[styles.label, { color: colors.text }]}>{t('pillars.wellbeing')}</Text>
            <Text style={[styles.desc, { color: colors.textMuted }]}>{t('wellbeingSettings.pillar.desc')}</Text>
          </View>
          <Switch
            testID="wellbeing-pillar-switch"
            value={enabled}
            onValueChange={(next) => void toggleWellbeingPillar(t, next)}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor="#ffffff"
            accessibilityLabel={t('pillars.wellbeing')}
          />
        </View>
      </View>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('wellbeingSettings.pillar.hint')}</Text>

      {enabled ? (
        <>
          {/* 2. Les modules */}
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('wellbeingSettings.modules.title')}</Text>
          <View style={card}>
            {MODULES.map((m, i) => (
              <View key={m.key} style={[styles.row, i > 0 && [styles.rowSep, { borderTopColor: colors.border }]]}>
                <View style={styles.grow}>
                  <Text style={[styles.label, { color: colors.text }]}>{t(`wellbeing.modules.${m.i18n}.title`)}</Text>
                  <Text style={[styles.desc, { color: colors.textMuted }]}>{t(`wellbeing.modules.${m.i18n}.desc`)}</Text>
                </View>
                <Switch
                  testID={`wellbeing-module-${m.i18n}`}
                  value={settings?.[m.key] === true}
                  onValueChange={(next) => void updateSettings({ [m.key]: next }).catch(() => undefined)}
                  trackColor={{ true: colors.accent, false: colors.border }}
                  thumbColor="#ffffff"
                  accessibilityLabel={t(`wellbeing.modules.${m.i18n}.title`)}
                />
              </View>
            ))}
          </View>
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('wellbeingSettings.modules.hint')}</Text>

          {/* 3. La nuit lue dans Health Connect */}
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('wellbeingSettings.sleep.title')}</Text>
          <View style={card}>
            <View style={styles.row}>
              <View style={styles.grow}>
                <Text style={[styles.label, { color: colors.text }]}>{t('wellbeingSettings.sleep.toggle')}</Text>
                <Text style={[styles.desc, { color: colors.textMuted }]}>{t('wellbeingSettings.sleep.desc')}</Text>
              </View>
              <Switch
                testID="wellbeing-sleep-switch"
                value={sleepEnabled}
                onValueChange={onToggleSleep}
                disabled={busy || !available}
                trackColor={{ true: colors.accent, false: colors.border }}
                thumbColor="#ffffff"
                accessibilityLabel={t('wellbeingSettings.sleep.toggle')}
              />
            </View>
            {!available ? (
              <Text style={[styles.desc, styles.rowSep, { color: colors.textMuted, borderTopColor: colors.border }]}>
                {t('wellbeingSettings.sleep.unavailable')}
              </Text>
            ) : null}
            {sleepEnabled && sleepState === 'permissions_missing' ? (
              <View style={[styles.rowSep, { borderTopColor: colors.border, gap: 8 }]}>
                <Text style={[styles.desc, { color: colors.text }]}>{t('wellbeingSettings.sleep.permissionMissing')}</Text>
                <Button label={t('wellbeingSettings.sleep.grant')} variant="ghost" onPress={() => void enableSleep()} />
              </View>
            ) : null}
            {sleepEnabled && sleepState === 'ready' ? (
              <View style={[styles.rowSep, { borderTopColor: colors.border, gap: 8 }]}>
                <Text style={[styles.desc, { color: colors.textMuted }]}>
                  {lastImport === null
                    ? t('wellbeingSettings.sleep.neverImported')
                    : t('wellbeingSettings.sleep.lastImport', { at: new Date(lastImport).toLocaleString(i18n.language) })}
                </Text>
                {imported !== null ? (
                  <Text style={[styles.desc, { color: colors.text }]}>{t('wellbeingSettings.sleep.imported', { count: imported })}</Text>
                ) : null}
                <Button label={t('wellbeingSettings.sleep.importNow')} variant="ghost" onPress={() => void runImport()} loading={busy} />
                <Pressable onPress={() => void openSettings()} accessibilityRole="link">
                  <Text style={[styles.link, { color: colors.accent }]}>{t('wellbeingSettings.sleep.openHealthConnect')}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
          {denied ? (
            <View style={[styles.banner, { backgroundColor: colors.surfaceAlt, borderColor: colors.danger }]}>
              <Text style={[styles.desc, { color: colors.text }]}>{t('wellbeingSettings.sleep.denied')}</Text>
            </View>
          ) : null}
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('wellbeingSettings.sleep.how')}</Text>

          {/* 4. Le garde-fou */}
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('wellbeingSettings.guard.title')}</Text>
          <View style={card}>
            <Text style={[styles.desc, { color: colors.text }]}>{t('wellbeingSettings.guard.body')}</Text>
            <Pressable
              onPress={() => void Linking.openURL(`tel:${LOW_MOOD_HELPLINE}`).catch(() => undefined)}
              accessibilityRole="button"
              style={styles.callRow}
            >
              <Text style={[styles.link, { color: colors.accent }]}>{t('wellbeingHub.lowMood.call', { phone: LOW_MOOD_HELPLINE })}</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 8, paddingBottom: 48 },
  sectionTitle: { fontFamily: fontFamily.bodySemi, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 20 },
  card: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowSep: { borderTopWidth: 1, paddingVertical: 12 },
  grow: { flex: 1, minWidth: 0, gap: 2 },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  desc: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19 },
  hint: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 18, paddingHorizontal: 4 },
  link: { fontFamily: fontFamily.bodySemi, fontSize: 13.5 },
  callRow: { paddingVertical: 10 },
  banner: { borderWidth: 1, borderRadius: 12, padding: 12 },
});
