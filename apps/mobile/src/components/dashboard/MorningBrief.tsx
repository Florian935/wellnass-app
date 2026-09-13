/**
 * US DASH-01 (§6.2) — le brief du matin, **branché**.
 *
 * Ce fichier existe pour une raison précise : c'est lui qui monte les requêtes du brief (record à
 * portée, protéines, période « vie réelle »), et il n'est rendu que le matin. Appeler le hook depuis
 * l'écran les monterait **toute la journée**, sur l'écran le plus ouvert de l'app.
 *
 * La carte, elle, reste une feuille : elle reçoit des faits et ne connaît aucun repository — c'est
 * ce qui permet de la tester sans monter la moitié de la couche de données.
 */

import type { NowAction, ReadinessVerdict } from '@wellness/shared';
import { MorningBriefCard } from '@/components/dashboard/MorningBriefCard';
import { useMorningBriefFacts } from '@/hooks/useHomeScene';

type Props = {
  action: NowAction;
  verdict: ReadinessVerdict | null;
  /** Langue de la synthèse vocale (`fr-FR` / `en-GB`). */
  speechLanguage: string;
};

export function MorningBrief({ action, verdict, speechLanguage }: Props) {
  const facts = useMorningBriefFacts(action, verdict);
  return <MorningBriefCard facts={facts} speechLanguage={speechLanguage} />;
}
