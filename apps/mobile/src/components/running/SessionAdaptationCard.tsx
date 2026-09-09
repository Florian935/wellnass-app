/**
 * US RUN-F4 (lot J) — « séance du jour » : ce que les signaux disent de la séance prévue.
 *
 * Répond au mur M15 de l'analyse du 04/09/2026 : l'app avait **toutes les entrées** de la table
 * « situation → décision » d'un plan d'entraînement (douleur, énergie, charge, jambes de la
 * veille) et **aucune sortie** — rien ne parlait jamais de la séance du jour.
 *
 * ⚠️ **Consultatif, et il faut que ça se voie.** La carte propose, elle ne modifie rien : la
 * séance planifiée reste intacte, aucun nombre de répétitions n'est réécrit en base. C'est dit
 * explicitement en pied de carte, parce qu'un encart qui annonce « retire 25 % des répétitions »
 * sans préciser qu'il n'a rien fait laisse croire que c'est déjà appliqué.
 *
 * Ton : jamais de rouge d'alerte, même sur `stop`. On informe un adulte qui décide — c'est la
 * même règle que COLLIS-01 et que RUN-F2b (R4).
 */

import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AdaptationProposal } from '@wellness/shared';
import { Card } from '@/components/Card';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = { proposal: AdaptationProposal | null };

export function SessionAdaptationCard({ proposal }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  // Rien à dire = rien à l'écran. Une carte « tout va bien » banaliserait la surface et la
  // ferait ignorer le jour où elle a quelque chose à dire.
  if (proposal === null || proposal.reasons.length === 0) return null;

  // `none` : des signaux existent mais aucune action n'est proposée (une gêne, ou de la fatigue
  // sur une séance déjà facile). On affiche alors les motifs seuls — informer sans prescrire.
  const actionLabel =
    proposal.action === 'none'
      ? null
      : t(`running.adaptation.${proposal.action}`, {
          pct: proposal.repsReductionPct,
          delta: proposal.paceSlowdownSPerKm,
        });

  const reasons = proposal.reasons
    .map((r) => t(`running.adaptation.reason.${r.code}`))
    .join(', ');

  return (
    <Card>
      <Text style={[styles.title, { color: colors.textMuted }]}>
        {t('running.adaptation.title')}
      </Text>

      {actionLabel ? (
        <Text style={[styles.action, { color: colors.text }]}>{actionLabel}</Text>
      ) : null}

      <Text style={[styles.reasons, { color: colors.textMuted }]}>
        {t('running.adaptation.reasonPrefix')} {reasons}.
      </Text>

      <Text style={[styles.advisory, { color: colors.textMuted }]}>
        {t('running.adaptation.advisory')}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  action: { fontFamily: fontFamily.bodyBold, fontSize: 15, lineHeight: 21, marginBottom: 4 },
  reasons: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  advisory: { fontFamily: fontFamily.body, fontSize: 11, lineHeight: 15, marginTop: 8 },
});
