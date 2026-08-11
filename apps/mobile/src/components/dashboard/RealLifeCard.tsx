/**
 * US VIE-01 — widget « mode vie réelle », 3 formes, **deux états dans un seul id**.
 *
 *  - **hors période** : une ligne discrète, le point d'entrée pour déclarer ;
 *  - **en période**   : la carte active — échéance, jours restants, objectif de semaine minimal,
 *    et les deux actions « Prolonger » / « Reprendre le plan normal ».
 *
 * Un seul widget pour les deux, délibérément : ils ne s'affichent jamais ensemble, et INSIGHTS-02
 * vient de ramener l'accueil de 21 à 7 entrées — en ajouter deux aurait défait ce travail.
 *
 * ⚠️ **Le ton est une règle testée** (R9) : aucun « seulement », « manqué », « raté », aucun compteur
 * d'écart négatif. Hors période, la ligne ne réclame rien ; en période, elle ne reproche rien.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatDayFull, type WidgetSize } from '@wellness/shared';

import { Eyebrow, WidgetFrame } from '@/components/widgets/WidgetFrame';
import { RealLifeSheet } from '@/components/real-life/RealLifeSheet';
import { useMinimalWeekTargets } from '@/data/repositories/dashboard-repository';
import {
  extendRealLifePeriod,
  stopRealLifePeriod,
  useRealLifeState,
} from '@/data/repositories/real-life-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Jours ajoutés par « Prolonger » — la durée médiane proposée à l'activation (D3). */
const EXTEND_BY_DAYS = 7;

export function RealLifeCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { activePeriod, daysRemaining } = useRealLifeState();
  const targets = useMinimalWeekTargets();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // ── Hors période : le point d'entrée ────────────────────────────────────────
  if (activePeriod === null) {
    return (
      <>
        <WidgetFrame pad={16} onPress={() => setSheetOpen(true)}>
          <View accessible accessibilityLabel={t('realLife.cta')} style={styles.entryRow}>
            <Text style={[styles.entryLabel, { color: colors.textMuted }]} numberOfLines={2}>
              {t('realLife.cta')}
            </Text>
            <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
          </View>
        </WidgetFrame>
        <RealLifeSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
      </>
    );
  }

  const until = t('realLife.activeUntil', { date: formatDayFull(activePeriod.endsOn) });
  const remaining =
    daysRemaining === 0 ? t('realLife.lastDay') : t('realLife.remaining', { count: daysRemaining ?? 0 });

  const onExtend = () => {
    setBusy(true);
    // `ends_on` est recalculé depuis la fin **courante** : prolonger deux fois ajoute bien 14 jours.
    const next = new Date(activePeriod.endsOn + 'T12:00:00');
    next.setDate(next.getDate() + EXTEND_BY_DAYS);
    const p = (n: number) => String(n).padStart(2, '0');
    const key = `${next.getFullYear()}-${p(next.getMonth() + 1)}-${p(next.getDate())}`;
    // `.catch` AVANT `.finally` : `finally` relaie le rejet, il ne le capture pas. Sans lui, un
    // échec d'écriture (hors ligne, RLS) laisse une rejection non capturée que React Native
    // remonte en avertissement global. `finally` rend la main dans tous les cas — rester bloqué
    // en « occupé » après un échec laisserait la carte inerte jusqu'au remontage de l'accueil.
    void extendRealLifePeriod(activePeriod.id, key)
      .catch((err) => console.warn('[real-life] prolongation :', err))
      .finally(() => setBusy(false));
  };

  const onStop = () => {
    setBusy(true);
    void stopRealLifePeriod(activePeriod.id)
      .catch((err) => console.warn('[real-life] arrêt :', err))
      .finally(() => setBusy(false));
  };

  const targetLines = [
    targets.strengthSessions != null
      ? t('realLife.targets.strength', { count: targets.strengthSessions })
      : null,
    targets.runs != null ? t('realLife.targets.running') : null,
    targets.proteinG != null
      ? t('realLife.targets.nutrition', { grams: Math.round(targets.proteinG) })
      : null,
  ].filter((line): line is string => line !== null);

  const a11yLabel = `${until}. ${remaining}. ${targetLines.join('. ')}`;

  // ── Petit carré : l'essentiel, sans les actions ─────────────────────────────
  if (size === 'small') {
    return (
      <WidgetFrame pad={16}>
        <View accessible accessibilityLabel={a11yLabel}>
          <Eyebrow>{t('realLife.title')}</Eyebrow>
          <Text style={[styles.smallTitle, { color: colors.text }]} numberOfLines={2}>
            {remaining}
          </Text>
        </View>
      </WidgetFrame>
    );
  }

  const actions = (
    <View style={styles.actions}>
      <Pressable
        onPress={onExtend}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t('realLife.extend')}
        style={[styles.primary, { backgroundColor: colors.accent }, busy && styles.dimmed]}
      >
        <Text style={[styles.primaryLabel, { color: colors.accentText }]}>
          {t('realLife.extend')}
        </Text>
      </Pressable>
      <Pressable
        onPress={onStop}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t('realLife.stop')}
        style={[styles.secondary, { borderColor: colors.border }, busy && styles.dimmed]}
      >
        <Text style={[styles.secondaryLabel, { color: colors.text }]}>{t('realLife.stop')}</Text>
      </Pressable>
    </View>
  );

  // ── Rectangle et grand carré ────────────────────────────────────────────────
  return (
    <WidgetFrame pad={size === 'large' ? 22 : 18}>
      <View accessible accessibilityLabel={a11yLabel}>
        <Eyebrow>{t('realLife.title')}</Eyebrow>
        <Text style={[styles.title, { color: colors.text }]}>{until}</Text>
        <Text style={[styles.remaining, { color: colors.textMuted }]}>{remaining}</Text>

        {targetLines.length > 0 && (
          <View style={[styles.targets, { borderTopColor: colors.border }]}>
            <Text style={[styles.targetsLabel, { color: colors.textMuted }]}>
              {t('realLife.targets.label')}
            </Text>
            {targetLines.map((line) => (
              <Text key={line} style={[styles.targetLine, { color: colors.text }]}>
                {line}
              </Text>
            ))}
          </View>
        )}
      </View>
      {actions}
    </WidgetFrame>
  );
}

const styles = StyleSheet.create({
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  entryLabel: { fontFamily: fontFamily.body, fontSize: 13, flex: 1 },
  chevron: { fontFamily: fontFamily.bodySemi, fontSize: 18 },

  smallTitle: { fontFamily: fontFamily.displayBold, fontSize: 16, marginTop: 6 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 17, marginTop: 6 },
  remaining: { fontFamily: fontFamily.body, fontSize: 13, marginTop: 2 },

  targets: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, gap: 3 },
  targetsLabel: { fontFamily: fontFamily.bodySemi, fontSize: 11.5, marginBottom: 2 },
  targetLine: { fontFamily: fontFamily.body, fontSize: 13 },

  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  primary: { borderRadius: 10, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  primaryLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  secondary: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: 'center',
    flex: 1,
  },
  secondaryLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  dimmed: { opacity: 0.5 },
});
