/**
 * US DEPENSE-02 — la carte **« Dépense estimée »**, partagée par le bilan de séance, le résumé de
 * course et l'historique des activités.
 *
 * ── Ce qu'elle montre, et pourquoi dans cet ordre ────────────────────────────────────────────────
 * 1. **l'estimation centrale**, en gros — c'est le chiffre que les gens cherchent ;
 * 2. **la fourchette**, juste en dessous — une valeur unique au kcal près serait un mensonge ;
 * 3. **ce que la cible retient** (le bas de la fourchette), parce que c'est le seul chiffre qui
 *    change ce qu'on peut manger ;
 * 4. **« D'où vient ce chiffre ? »** — la feuille d'explication existante (DASH-01).
 *
 * ── 🔴 Trois refus assumés ──────────────────────────────────────────────────────────────────────
 * - **aucune équivalence alimentaire** (« = 1 part de pizza ») : ça apprend à compenser, et c'est
 *   à rebours du « sans culpabiliser » du produit (variante C de la toile, écartée) ;
 * - **aucun ton de récompense** (« tu l'as bien mérité ») : le sport n'est pas une monnaie ;
 * - **rien ne s'affiche sans poids** : la carte montre alors son remède, jamais un chiffre inventé
 *   (même règle que MN-10 pour les g/kg).
 */

import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { explainEnergy, type EnergyEstimate, type RestingMetabolism } from '@wellness/shared';

import { ExplainSheet } from '@/components/explain/ExplainSheet';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  /** `null` = pas de poids connu : la carte bascule sur son état « remède ». */
  estimate: EnergyEstimate | null;
  resting: RestingMetabolism | null;
  /** Minutes réellement comptées (plafonnées pour la muscu) — affichées dans l'explication. */
  activeMinutes: number;
  /** Une ligne de contexte : « 1 h · ressenti 8/10 · repos 2 min 30 ». */
  detail?: string;
  /** Effet sur la cible du jour, déjà formaté. Absent quand le pilier Nutrition est inactif. */
  dayEffect?: string | null;
};

export function EnergyCard({ estimate, resting, activeMinutes, detail, dayEffect }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const [explainOpen, setExplainOpen] = useState(false);

  // Sans poids, pas de dépense — et surtout pas un chiffre par défaut : l'utilisateur doit savoir
  // quoi faire pour l'obtenir.
  if (estimate === null || resting === null) {
    return (
      <View style={[styles.missing, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}>
        <Ionicons name="scale-outline" size={20} color={colors.textMuted} />
        <View style={styles.missingTexts}>
          <Text style={[styles.missingTitle, { color: colors.text }]}>{t('energy.missingWeight.title')}</Text>
          <Text style={[styles.missingBody, { color: colors.textMuted }]}>{t('energy.missingWeight.body')}</Text>
        </View>
        <Pressable
          onPress={() => router.push('/nutrition-stats')}
          accessibilityRole="button"
          accessibilityLabel={t('energy.missingWeight.cta')}
          hitSlop={8}
        >
          <Text style={[styles.missingCta, { color: colors.accent }]}>{t('energy.missingWeight.cta')}</Text>
        </Pressable>
      </View>
    );
  }

  const isDevice = estimate.source === 'device';
  // Position du segment de fourchette, en part de la largeur : l'échelle va de 0 au haut de la
  // fourchette, pour que le bas retenu se lise comme une portion du total.
  const span = estimate.high > 0 ? estimate.high : 1;
  const lowPct = Math.round((estimate.low / span) * 100);
  const highPct = 100;

  return (
    <View style={[styles.card, { backgroundColor: colors.panel }]} testID="energy-card">
      <View style={styles.head}>
        <Text style={[styles.eyebrow, { color: colors.panelAccent }]}>{t('energy.title')}</Text>
        <Text style={[styles.confidence, { color: colors.panelMuted }]}>
          {t(`energy.confidence.${estimate.confidence}`)}
        </Text>
      </View>

      <View style={styles.valueRow}>
        <Text style={[styles.approx, { color: colors.panelMuted }]}>{isDevice ? '' : '≈'}</Text>
        <Text style={[styles.value, { color: colors.panelText }]} accessibilityLabel={t('energy.a11y', { kcal: estimate.kcal })}>
          {estimate.kcal}
        </Text>
        <Text style={[styles.unit, { color: colors.panelMuted }]}>{t('nutrition.kcal')}</Text>
      </View>

      {isDevice ? (
        <Text style={[styles.detail, { color: colors.panelMuted }]}>{t('energy.fromDevice')}</Text>
      ) : (
        <>
          <View style={[styles.track, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
            <View
              style={[
                styles.trackFill,
                { left: `${lowPct}%`, width: `${highPct - lowPct}%`, backgroundColor: colors.panelAccent },
              ]}
            />
          </View>
          <Text style={[styles.range, { color: colors.panelMuted }]}>
            {t('energy.range', { low: estimate.low, high: estimate.high })}
          </Text>
        </>
      )}

      {detail ? <Text style={[styles.detail, { color: colors.panelMuted }]}>{detail}</Text> : null}
      {dayEffect ? <Text style={[styles.dayEffect, { color: colors.panelText }]}>{dayEffect}</Text> : null}

      <Pressable
        onPress={() => setExplainOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('energy.explainCta')}
        hitSlop={8}
        style={styles.explainBtn}
      >
        <Ionicons name="help-circle-outline" size={17} color={colors.panelText} />
        <Text style={[styles.explainLabel, { color: colors.panelText }]}>{t('energy.explainCta')}</Text>
      </Pressable>

      <ExplainSheet
        visible={explainOpen}
        title={t('energy.explainTitle', { kcal: estimate.kcal })}
        explanation={explainEnergy({
          restingKcalPerHour: resting.kcalPerHour,
          personalised: resting.personalised,
          met: estimate.met,
          activeMinutes,
          kcal: estimate.kcal,
          low: estimate.low,
          high: estimate.high,
          confidence: estimate.confidence,
        })}
        onClose={() => setExplainOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 16, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  eyebrow: { fontFamily: fontFamily.monoBold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  confidence: { fontFamily: fontFamily.mono, fontSize: 10.5, flexShrink: 1, textAlign: 'right' },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  approx: { fontFamily: fontFamily.displaySemi, fontSize: 24 },
  value: { fontFamily: fontFamily.displayXBold, fontSize: 48, letterSpacing: -1.8 },
  unit: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  trackFill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 5 },
  range: { fontFamily: fontFamily.mono, fontSize: 11.5 },
  detail: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  dayEffect: { fontFamily: fontFamily.bodySemi, fontSize: 14, lineHeight: 20 },
  explainBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  explainLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13.5, textDecorationLine: 'underline' },
  missing: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 18, borderStyle: 'dashed', padding: 14 },
  missingTexts: { flex: 1, gap: 2 },
  missingTitle: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  missingBody: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17 },
  missingCta: { fontFamily: fontFamily.bodyBold, fontSize: 13.5, textDecorationLine: 'underline' },
});
