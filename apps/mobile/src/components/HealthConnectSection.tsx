import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { updateSettings } from '@/data/repositories/settings-repository';
import {
  DEFAULT_WINDOW_DAYS,
  getLastSyncReport,
  getLastWeightImportAt,
  getState,
  importWeight,
  openProviderInstall,
  openSettings,
  pushRecent,
  requestPermissions,
  type HealthConnectState,
  type SyncReport,
} from '@/lib/health-connect';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * US CONF-06 — section « Health Connect » des Réglages.
 *
 * Rend **un seul** des états du service (spec §2.1). Le réglage est un **opt-in** : les permissions
 * système ne sont demandées que par le tap sur l'interrupteur, jamais à l'ouverture de l'écran.
 *
 * Hors Android (ou fournisseur introuvable au point de ne pas pouvoir statuer), le composant ne rend
 * rien du tout : `state === 'unsupported'`.
 */
export function HealthConnectSection({ enabled }: { enabled: boolean }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();

  /**
   * État affiché, en **une seule** valeur : disponibilité + date du dernier import vont toujours
   * ensemble, et un seul `setView` évite un rendu intermédiaire incohérent.
   * `null` = pas encore résolu → on ne rend rien.
   */
  const [view, setView] = useState<{
    state: HealthConnectState;
    lastImportAt: string | null;
    /** Compte rendu de la dernière tentative — affiché tel quel en cas d'échec (diagnostic). */
    report: SyncReport | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  /** Message de résultat inline (« N activités synchronisées ») — pas d'alerte modale. */
  const [feedback, setFeedback] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const refresh = useCallback(async () => {
    setView({
      state: await getState(),
      lastImportAt: await getLastWeightImportAt(),
      report: getLastSyncReport(),
    });
  }, []);

  // État recalculé au montage, quand le réglage change, et au retour au premier plan : les
  // permissions peuvent avoir été révoquées depuis les réglages système entre-temps.
  // Le drapeau `cancelled` évite d'écrire l'état d'un composant démonté entre-temps.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const next = {
        state: await getState(),
        lastImportAt: await getLastWeightImportAt(),
        report: getLastSyncReport(),
      };
      if (!cancelled) setView(next);
    };
    void load();
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') void load();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [enabled]);

  const titles = {
    workout: t('settings.healthConnect.defaultWorkoutTitle'),
    run: t('settings.healthConnect.defaultRunTitle'),
  };

  /** Activation : permissions → réglage ON → rattrapage + import initial (retour chiffré inline). */
  const enable = async () => {
    setBusy(true);
    setFeedback(null);
    setDenied(false);
    const granted = await requestPermissions();
    if (!granted) {
      // Refus : le réglage reste OFF. On ne réessaie pas, on explique.
      setDenied(true);
      setBusy(false);
      await refresh();
      return;
    }
    await updateSettings({ healthConnectEnabled: true });
    const pushed = await pushRecent(DEFAULT_WINDOW_DAYS, titles);
    const imported = await importWeight(DEFAULT_WINDOW_DAYS);
    setFeedback(
      `${t('settings.healthConnect.pushed', { count: pushed })} · ${t('settings.healthConnect.imported', { count: imported })}`,
    );
    setBusy(false);
    await refresh();
  };

  const disable = async () => {
    setBusy(true);
    setFeedback(null);
    setDenied(false);
    await updateSettings({ healthConnectEnabled: false });
    setBusy(false);
    await refresh();
  };

  const runImport = async () => {
    setBusy(true);
    setFeedback(null);
    const imported = await importWeight(DEFAULT_WINDOW_DAYS);
    setFeedback(t('settings.healthConnect.imported', { count: imported }));
    setBusy(false);
    await refresh();
  };

  /**
   * Renvoi manuel des activités des 30 derniers jours. Sûr à répéter (dédup par `clientRecordId`),
   * et c'est le geste qui permet à l'utilisateur de rattraper une séance qui n'aurait pas été
   * envoyée — par exemple si Health Connect était indisponible à la clôture.
   */
  const runPush = async () => {
    setBusy(true);
    setFeedback(null);
    const pushed = await pushRecent(DEFAULT_WINDOW_DAYS, titles);
    setFeedback(t('settings.healthConnect.pushed', { count: pushed }));
    setBusy(false);
    await refresh();
  };

  // Tant que l'état n'est pas connu, ou hors Android : on n'affiche rien (pas de section fantôme).
  if (view === null || view.state === 'unsupported') return null;

  const { state, lastImportAt, report } = view;

  const formattedLastImport =
    lastImportAt !== null
      ? new Date(lastImportAt).toLocaleString(i18n.language === 'en' ? 'en-GB' : 'fr-FR', {
          dateStyle: 'short',
          timeStyle: 'short',
        })
      : null;

  return (
    <>
      <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 28 }]}>
        {t('settings.healthConnect.title')}
      </Text>

      {state === 'provider_missing' || state === 'provider_update_required' ? (
        <>
          <View style={[styles.banner, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Text style={[styles.bannerText, { color: colors.text }]}>
              {t(
                state === 'provider_missing'
                  ? 'settings.healthConnect.providerMissing'
                  : 'settings.healthConnect.updateRequired',
              )}
            </Text>
          </View>
          <View style={styles.stack}>
            <Button
              label={t(
                state === 'provider_missing'
                  ? 'settings.healthConnect.install'
                  : 'settings.healthConnect.update',
              )}
              variant="ghost"
              onPress={() => void openProviderInstall()}
            />
          </View>
        </>
      ) : (
        <>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.row}>
              <View style={styles.rowGrow}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>
                  {t('settings.healthConnect.toggle')}
                </Text>
                <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
                  {t('settings.healthConnect.subtitle')}
                </Text>
              </View>
              <Switch
                value={enabled}
                disabled={busy}
                onValueChange={(next) => void (next ? enable() : disable())}
                trackColor={{ true: colors.accent, false: colors.border }}
                thumbColor="#ffffff"
                accessibilityLabel={t('settings.healthConnect.toggle')}
              />
            </View>
            {state === 'ready' && formattedLastImport !== null ? (
              <View style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Text style={[styles.rowDesc, { color: colors.textMuted, marginTop: 0 }]}>
                  {t('settings.healthConnect.lastImport', { date: formattedLastImport })}
                </Text>
              </View>
            ) : null}
          </View>

          {denied ? (
            <View style={[styles.banner, { backgroundColor: colors.surfaceAlt, borderColor: colors.danger }]}>
              <Text style={[styles.bannerText, { color: colors.text }]}>
                {t('settings.healthConnect.denied')}
              </Text>
            </View>
          ) : null}

          {feedback !== null ? (
            <View style={[styles.banner, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Text style={[styles.bannerText, { color: colors.text }]}>{feedback}</Text>
            </View>
          ) : null}

          {state === 'permissions_missing' ? (
            <>
              <View style={[styles.banner, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <Text style={[styles.bannerText, { color: colors.text }]}>
                  {t('settings.healthConnect.permissionsMissing')}
                </Text>
              </View>
              <View style={styles.stack}>
                <Button
                  label={t('settings.healthConnect.grant')}
                  loading={busy}
                  onPress={() => void enable()}
                />
              </View>
            </>
          ) : null}

          {state === 'ready' ? (
            <View style={styles.stack}>
              <Button
                label={t('settings.healthConnect.syncNow')}
                variant="ghost"
                loading={busy}
                onPress={() => void runPush()}
              />
              <Button
                label={t('settings.healthConnect.importWeight')}
                variant="ghost"
                loading={busy}
                onPress={() => void runImport()}
              />
            </View>
          ) : null}

          {/*
            Compte rendu de la dernière tentative, affiché **uniquement en cas d'échec**. Message
            technique non traduit : c'est un outil de diagnostic (sans lui, une panne d'écriture est
            invisible — l'app semble fonctionner alors que rien n'est envoyé).
          */}
          {report?.error ? (
            <View style={[styles.banner, { backgroundColor: colors.surfaceAlt, borderColor: colors.danger }]}>
              <Text style={[styles.bannerText, { color: colors.text }]}>
                {t('settings.healthConnect.lastAttemptFailed', {
                  kind: report.kind,
                  reason: report.error,
                })}
              </Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.healthConnect.openSettings')}
            onPress={() => void openSettings()}
            style={styles.link}
          >
            <Text style={[styles.linkText, { color: colors.accent }]}>
              {t('settings.healthConnect.openSettings')}
            </Text>
          </Pressable>

          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {t('settings.healthConnect.disableHint')}
          </Text>
        </>
      )}
    </>
  );
}

// Styles alignés sur ceux de l'écran Réglages (mêmes cartes, mêmes rangées, mêmes bandeaux).
const styles = StyleSheet.create({
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
  stack: { gap: 10, marginTop: 10 },
  banner: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 10 },
  bannerText: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  link: { paddingVertical: 12 },
  linkText: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
});
