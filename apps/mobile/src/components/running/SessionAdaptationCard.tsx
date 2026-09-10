/**
 * US RUN-F4 (lot J) — « séance du jour » : ce que les signaux disent de la séance prévue.
 * Étendue par US CARDIO-UX01 (R3-3 / constat F36) : la carte **agit** désormais.
 *
 * Répond au mur M15 de l'analyse du 04/09/2026 : l'app avait **toutes les entrées** de la table
 * « situation → décision » d'un plan d'entraînement (douleur, énergie, charge, jambes de la
 * veille) et **aucune sortie** — rien ne parlait jamais de la séance du jour.
 *
 * ── Ce que CARDIO-UX01 change ────────────────────────────────────────────────────────────────────
 * La carte annonçait « retire 25 % des répétitions » **puis précisait qu'elle n'avait rien fait**
 * (constat F36). Elle avait raison de le préciser — mais l'utilisateur devait alors refaire le
 * calcul lui-même, dans un éditeur à 14 contrôles par segment, un mardi matin à 6 h. Un conseil
 * qu'on ne peut pas appliquer est un conseil qui coûte plus qu'il ne rapporte.
 *
 * « Appliquer aujourd'hui » écrit une **variante datée** de la séance (sur l'occurrence, jamais
 * sur le template) : le programme des semaines suivantes reste intact. C'est la règle R3-3.
 *
 * ⚠️ **L'action attend sa migration.** Elle écrit `planned_sessions.adapted_reps_pct` /
 * `adapted_pace_delta_s`, deux colonnes additives livrées par la migration de cette US mais
 * **non poussées** sur le cloud (voir spec §1 R9). Tant que `ADAPTATION_WRITE_READY` vaut `false`,
 * le bouton n'est pas rendu et la carte reste strictement consultative, comme avant — plutôt que
 * d'écrire une colonne que le serveur refuserait, ce qui bloquerait la file de synchro pour
 * **toutes** les tables. Un seul drapeau à basculer après `npm run db:push`.
 *
 * Ton : jamais de rouge d'alerte, même sur `stop`. On informe un adulte qui décide — c'est la
 * même règle que COLLIS-01 et que RUN-F2b (R4).
 */

import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AdaptationProposal } from '@wellness/shared';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import {
  ADAPTATION_WRITE_READY,
  applyAdaptationForToday,
} from '@/data/repositories/planned-session-repository';
import { useActionLock } from '@/hooks/useActionLock';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  proposal: AdaptationProposal | null;
  /**
   * Occurrence du jour à adapter. `null` = aucune séance planifiée aujourd'hui : la carte reste
   * consultative (elle peut parler d'une course libre à venir).
   */
  plannedSessionId?: string | null;
};

export function SessionAdaptationCard({ proposal, plannedSessionId = null }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [applied, setApplied] = useState(false);
  const [applying, setApplying] = useState(false);
  const lockApply = useActionLock();

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

  /**
   * L'action n'est proposée que si elle a quelque chose à écrire ET quelqu'un à qui l'écrire :
   * une proposition `none` ne change rien, et sans occurrence du jour il n'y a pas de variante
   * datée à poser.
   */
  const canApply =
    ADAPTATION_WRITE_READY && proposal.action !== 'none' && plannedSessionId !== null;

  const onApply = () =>
    void lockApply(async () => {
      if (plannedSessionId === null) return;
      setApplying(true);
      try {
        await applyAdaptationForToday(plannedSessionId, {
          // `undefined` et `null` disent la même chose ici — « pas de réduction » — mais seul
          // `null` s'écrit en base.
          repsReductionPct: proposal.repsReductionPct ?? null,
          paceSlowdownSPerKm: proposal.paceSlowdownSPerKm ?? null,
        });
        setApplied(true);
      } catch (error) {
        // Offline-first : l'écriture locale ne devrait pas échouer. On ne prétend pas avoir
        // appliqué si elle a échoué — la carte reste telle quelle.
        console.warn('[SessionAdaptationCard] applyAdaptationForToday a échoué :', error);
      } finally {
        setApplying(false);
      }
    });

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

      {applied ? (
        <Text style={[styles.appliedNote, { color: colors.success }]}>
          {t('running.adaptation.applied')}
        </Text>
      ) : canApply ? (
        <>
          <Button
            label={applying ? t('running.adaptation.applying') : t('running.adaptation.applyCta')}
            onPress={onApply}
            loading={applying}
          />
          <Text style={[styles.advisory, { color: colors.textMuted }]}>
            {t('running.adaptation.applyHint')}
          </Text>
        </>
      ) : (
        <Text style={[styles.advisory, { color: colors.textMuted }]}>
          {t('running.adaptation.advisory')}
        </Text>
      )}
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
  appliedNote: { fontFamily: fontFamily.bodySemi, fontSize: 13, lineHeight: 18, marginTop: 6 },
});
