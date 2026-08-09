import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  computePaceFade,
  computePaceZoneMix,
  computeSplitBalance,
  type KmSplit,
} from '@wellness/shared';

import { useRunnerProfile } from '@/data/repositories/running-profile-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * Les trois lectures intra-sortie de la courbe d'allure (US ALLURE-01 — RUN-11, RUN-20, RUN-17).
 *
 * ── Pourquoi les splits arrivent en PROP ────────────────────────────────────────────────────────
 * 🔴 `run/summary.tsx` **décode déjà la trace et calcule déjà les splits** (l.225 et l.238). Les
 * recalculer ici doublerait le coût du plus gros calcul de l'écran pour un résultat identique. La prop
 * n'est donc pas un choix de style : c'est **la** raison pour laquelle ce lot est bon marché.
 *
 * ── On constate, on ne prescrit pas ─────────────────────────────────────────────────────────────
 * Aucune de ces cartes ne conseille. Un fade de +14 % n'est pas commenté, un negative split n'est pas
 * félicité. Ton de GARDE-01 et DOUL-01, déjà validé quatre fois.
 *
 * ⚠️ **Chaque verdict porte son écart chiffré** (spec R2) : « negative split » seul n'est pas
 * vérifiable par celui qui le lit.
 */
export function PaceCurveCards({ splits }: { splits: readonly KmSplit[] }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();
  const { runnerProfile } = useRunnerProfile();

  const ref5kPaceSPerKm = runnerProfile?.ref5kPaceSPerKm ?? null;

  const balance = computeSplitBalance(splits);
  const fade = computePaceFade(splits);
  const zones = computePaceZoneMix({ splits, ref5kPaceSPerKm });

  // Spec R7 — une course saisie à la main n'a pas de trace : il n'y a rien à analyser, et ce n'est
  // pas une erreur. On ne rend rien, sans message.
  if (splits.length === 0) return null;

  /** Écart en % arrondi et signé, formaté **avant** `t()` (i18next n'a aucun formatage par défaut). */
  const signedPct = (pct: number) => `${pct > 0 ? '+' : ''}${Math.round(pct)} %`;

  return (
    <>
      {balance !== null ? (
        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessible
          accessibilityLabel={[
            t('run.summary.split.title'),
            t(`run.summary.split.${balance.verdict}`),
            t('run.summary.split.detail', {
              first: units.formatPace(balance.firstHalfPaceSPerKm),
              second: units.formatPace(balance.secondHalfPaceSPerKm),
              delta: signedPct(balance.deltaPct),
            }),
          ].join('. ')}
        >
          <Text style={[styles.cardTitle, { color: colors.textMuted }]}>
            {t('run.summary.split.title')}
          </Text>
          <Text
            style={[
              styles.verdict,
              {
                // `even` reste en couleur de texte : ce n'est ni une réussite ni un défaut, et le
                // colorer ferait passer un constat neutre pour un jugement.
                color:
                  balance.verdict === 'negative'
                    ? colors.success
                    : balance.verdict === 'positive'
                      ? colors.accent
                      : colors.text,
              },
            ]}
          >
            {t(`run.summary.split.${balance.verdict}`)}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {t('run.summary.split.detail', {
              first: units.formatPace(balance.firstHalfPaceSPerKm),
              second: units.formatPace(balance.secondHalfPaceSPerKm),
              delta: signedPct(balance.deltaPct),
            })}
          </Text>
        </View>
      ) : null}

      {fade !== null ? (
        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessible
          accessibilityLabel={[
            t('run.summary.fade.title'),
            signedPct(fade.fadePct),
            t('run.summary.fade.detail', {
              first: units.formatPace(fade.firstQuarterPaceSPerKm),
              last: units.formatPace(fade.lastQuarterPaceSPerKm),
              km: fade.kmPerQuarter,
            }),
          ].join('. ')}
        >
          <Text style={[styles.cardTitle, { color: colors.textMuted }]}>
            {t('run.summary.fade.title')}
          </Text>
          <Text
            style={[
              styles.value,
              // 🔴 Un fade négatif est une BONNE nouvelle : la fin était plus rapide. Le signe se lit
              // à l'envers de l'intuition, et la couleur doit suivre le sens, pas le signe.
              { color: fade.fadePct > 0 ? colors.accent : colors.success },
            ]}
          >
            {signedPct(fade.fadePct)}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {t('run.summary.fade.detail', {
              first: units.formatPace(fade.firstQuarterPaceSPerKm),
              last: units.formatPace(fade.lastQuarterPaceSPerKm),
              km: fade.kmPerQuarter,
            })}
          </Text>
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.textMuted }]}>
          {t('run.summary.zones.title')}
        </Text>
        {zones !== null ? (
          <View accessible accessibilityLabel={[
            t('run.summary.zones.title'),
            ...zones.map((z) => `${t(`run.summary.zones.zone.${z.zone}`)} ${z.percent} %`),
          ].join('. ')}>
            {zones.map((share) => (
              <View key={share.zone} style={styles.zoneRow}>
                <Text style={[styles.zoneLabel, { color: colors.text }]}>
                  {t(`run.summary.zones.zone.${share.zone}`)}
                </Text>
                <Text style={[styles.zonePercent, { color: colors.textMuted }]}>
                  {share.percent} %
                </Text>
              </View>
            ))}
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {t('run.summary.zones.basis', { count: zones.reduce((sum, z) => sum + z.km, 0) })}
            </Text>
          </View>
        ) : (
          /* Spec R4 — sans allure de référence, aucune zone n'est calculable et il n'existe AUCUNE
             valeur neutre pour la remplacer. On affiche donc l'indisponibilité **et son remède**,
             jamais un « — » : masquer la carte laisserait l'utilisateur ignorer qu'il lui manque un
             réglage. Patron de `StrengthSection` pour le DOTS sans sexe déclaré (MUSCPWR-01 R6). */
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('run.summary.zones.needsRef')}
            onPress={() => router.push('/running-profile')}
            style={styles.needsRefRow}
          >
            <Text style={[styles.needsRef, { color: colors.textMuted }]}>
              {t('run.summary.zones.needsRef')}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // Aucune hauteur fixe : tout grandit avec la police système (recette à 1,5×).
  card: { borderWidth: 1, borderRadius: 14, padding: 13, marginTop: 10, gap: 3 },
  cardTitle: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  verdict: { fontFamily: fontFamily.bodyBold, fontSize: 18, lineHeight: 23 },
  value: { fontFamily: fontFamily.bodyBold, fontSize: 25, lineHeight: 30 },
  meta: { fontFamily: fontFamily.body, fontSize: 11.5, lineHeight: 16 },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  zoneLabel: { fontFamily: fontFamily.body, fontSize: 13, flexShrink: 1 },
  zonePercent: { fontFamily: fontFamily.bodyBold, fontSize: 12, marginLeft: 'auto' },
  needsRefRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  needsRef: { fontFamily: fontFamily.body, fontSize: 12.5, fontStyle: 'italic', flexShrink: 1 },
});
