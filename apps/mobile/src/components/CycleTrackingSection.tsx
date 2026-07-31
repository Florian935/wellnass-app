import { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { updateSettings } from '@/data/repositories/settings-repository';
import { deleteAllCycleData } from '@/data/repositories/menstrual-cycle-repository';
import {
  DEFAULT_WINDOW_DAYS,
  importCycleData,
  pushCycleData,
  requestCyclePermissions,
} from '@/lib/health-connect';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * US CYCLE-01 — section « Suivi du cycle » des Réglages.
 *
 * **Opt-in strict, désactivé par défaut, et proposé à tout le monde** : aucun filtre sur
 * `profiles.sex` (arbitrage Damien du 30/07/2026). Un filtre sur le sexe déclaré exclurait sans
 * recours les profils « non précisé », qui sont une valeur légitime du champ.
 *
 * ⚠️ **Désactiver n'efface pas.** R17 : à l'extinction, on **propose** la suppression sans
 * l'imposer — garder ses données tout en masquant la fonctionnalité est un choix valide, et ce qui
 * est gardé reste inclus dans l'export RGPD.
 */
export function CycleTrackingSection({
  enabled,
  healthConnectEnabled,
}: {
  enabled: boolean;
  healthConnectEnabled: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [hcBusy, setHcBusy] = useState(false);
  const [hcDenied, setHcDenied] = useState(false);

  /**
   * Extinction : on coupe **d'abord** le réglage (la fonctionnalité disparaît tout de suite), puis
   * on demande. Faire l'inverse laisserait le widget affiché derrière une boîte de dialogue.
   */
  const disable = async () => {
    setBusy(true);
    try {
      await updateSettings({ cycleTrackingEnabled: false, cycleHealthConnectEnabled: false });
      Alert.alert(t('cycle.settings.disableTitle'), t('cycle.settings.disableMessage'), [
        { text: t('cycle.settings.keepData'), style: 'cancel' },
        {
          text: t('cycle.settings.deleteData'),
          style: 'destructive',
          onPress: () => void deleteAllCycleData(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const onToggle = (next: boolean) => {
    if (next) {
      void updateSettings({ cycleTrackingEnabled: true });
      return;
    }
    void disable();
  };

  /**
   * Activation de la synchro Health Connect (R20) : permissions **d'abord** (interrupteur système,
   * seul point de l'app qui les demande pour ces types), réglage ON **seulement** si accordées, puis
   * un aller-retour immédiat (push des données déjà saisies + import de ce qui existe déjà dans le
   * hub) — même séquence que `HealthConnectSection.enable()`.
   */
  const enableHealthConnect = async () => {
    setHcBusy(true);
    setHcDenied(false);
    const granted = await requestCyclePermissions();
    if (!granted) {
      setHcDenied(true);
      setHcBusy(false);
      return;
    }
    await updateSettings({ cycleHealthConnectEnabled: true });
    await pushCycleData();
    await importCycleData(DEFAULT_WINDOW_DAYS);
    setHcBusy(false);
  };

  const onToggleHealthConnect = (next: boolean) => {
    if (next) {
      void enableHealthConnect();
      return;
    }
    setHcDenied(false);
    void updateSettings({ cycleHealthConnectEnabled: false });
  };

  return (
    <>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('cycle.title')}</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.row}>
          <View style={styles.grow}>
            <Text style={[styles.label, { color: colors.text }]}>
              {t('cycle.settings.toggle')}
            </Text>
            <Text style={[styles.desc, { color: colors.textMuted }]}>
              {t('cycle.settings.subtitle')}
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={onToggle}
            disabled={busy}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor="#ffffff"
            accessibilityLabel={t('cycle.settings.toggle')}
          />
        </View>

        {/*
          Second interrupteur, **indépendant** (R20) : synchroniser suppose les deux opt-in actifs
          plus la permission système. Il n'apparaît que si le suivi est actif — proposer une
          synchro pour une fonctionnalité éteinte n'aurait aucun sens.
        */}
        {enabled && (
          <View style={[styles.row, styles.rowSep, { borderTopColor: colors.border }]}>
            <View style={styles.grow}>
              <Text style={[styles.label, { color: colors.text }]}>
                {t('cycle.settings.healthConnect')}
              </Text>
              <Text style={[styles.desc, { color: colors.textMuted }]}>
                {t('cycle.settings.healthConnectDesc')}
              </Text>
            </View>
            <Switch
              value={healthConnectEnabled}
              onValueChange={onToggleHealthConnect}
              disabled={hcBusy}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor="#ffffff"
              accessibilityLabel={t('cycle.settings.healthConnect')}
            />
          </View>
        )}
      </View>

      {hcDenied && (
        <View
          style={[styles.banner, { backgroundColor: colors.surfaceAlt, borderColor: colors.danger }]}
        >
          <Text style={[styles.bannerText, { color: colors.text }]}>
            {t('cycle.settings.healthConnectDenied')}
          </Text>
        </View>
      )}

      {/* L'avertissement est répété ici : c'est le point où l'on active, donc où il compte le plus. */}
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('cycle.disclaimer')}</Text>

      {enabled && (
        <View style={styles.stack}>
          <Button
            label={t('cycle.settings.deleteAll')}
            variant="destructive"
            onPress={() =>
              Alert.alert(t('cycle.settings.deleteTitle'), t('cycle.settings.deleteMessage'), [
                { text: t('cycle.settings.cancel'), style: 'cancel' },
                {
                  text: t('cycle.settings.deleteData'),
                  style: 'destructive',
                  onPress: () => void deleteAllCycleData(),
                },
              ])
            }
          />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginTop: 28,
    marginBottom: 8,
  },
  card: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowSep: { borderTopWidth: 1 },
  grow: { flex: 1, gap: 2 },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  desc: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17 },
  hint: { fontFamily: fontFamily.body, fontSize: 12, marginTop: 8, lineHeight: 17 },
  stack: { marginTop: 12, gap: 8 },
  banner: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 10 },
  bannerText: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
});
