/**
 * US PRISME-01 — « Prisme raconte ta semaine », sous les chiffres du bilan hebdo (spec §4, §6.2).
 *
 * N'envoie que ce que l'écran affiche, piliers actifs seulement : les objectifs ne figurent pas sur
 * cet écran, ils ne partent donc pas. La décision part **telle qu'elle est écrite au-dessus** — sauf le
 * nom d'un objectif en retard, retiré (R4) ; Prisme peut la citer, jamais en proposer une autre (R16).
 */

import { useTranslation } from 'react-i18next';
import { buildWeekDossier, resolveActivePillars, type WeeklyReview } from '@wellness/shared';

import { useSettings } from '@/data/repositories/settings-repository';
import { usePrismeVisibility } from '@/hooks/usePrismeVisibility';

import { PrismeTell } from './PrismeTell';

type Props = {
  review: WeeklyReview;
  /** La période telle qu'affichée (« du 21 au 27 septembre »). */
  periodLabel: string;
  /** La décision telle qu'affichée, `null` s'il n'y en a pas. */
  decisionText: string | null;
};

export function PrismeWeek({ review, periodLabel, decisionText }: Props) {
  const { t } = useTranslation();
  const { visible } = usePrismeVisibility();
  const { settings } = useSettings();
  const active = resolveActivePillars(settings?.activePillars);

  const activePillars = {
    strength: active.includes('strength'),
    running: active.includes('running'),
    nutrition: active.includes('nutrition'),
  };

  // 🔴 R4 — « objectif en retard » nomme l'objectif à l'écran, et ce nom peut être celui d'un exercice
  // perso, donc du texte saisi. Prisme reçoit la même décision, avec les mêmes chiffres, sans le nom.
  const prismeDecision =
    review.decision?.kind === 'goal_behind'
      ? t('prisme.dossier.week.goalBehind', review.decision.metrics)
      : decisionText;

  const dossier = buildWeekDossier(
    { review, periodLabel, goals: [], activePillars, decisionText: prismeDecision },
    (key, params) => t(key, params),
  );

  if (!visible || review.isEmpty) return null;

  return (
    <PrismeTell
      dossier={dossier}
      usage="week"
      storeKey={`week:${review.period.start}`}
      // Une semaine close ne bouge plus : son empreinte est celle du dossier lui-même.
      fingerprint={JSON.stringify(dossier)}
      testID="review-prisme"
    />
  );
}
