/**
 * Annonces vocales périodiques pendant une course (US RUN-F2a, roadmap 5.19).
 *
 * Déclenchées depuis l'écran de suivi (`run/active.tsx`), pas depuis la tâche de fond
 * (`tracker-task.ts`) — décision de conception (spec §1) : éviter d'ajouter une inconnue
 * (lecture audio hors contexte React) dans le fichier le plus sensible du projet. Conséquence
 * assumée : aucune annonce si l'écran de suivi n'est pas monté (onglet changé, écran verrouillé).
 */

import { useEffect, useRef } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import * as Speech from 'expo-speech';
import { nextAnnouncementThreshold } from '@wellness/shared';
import { useUnits } from '@/hooks/useUnits';

/**
 * Compose la phrase annoncée (distance, temps, allure — spec R3/R3 bis) :
 *  - distance en kilomètres entiers si `thresholdM` est un multiple de 1000, sinon en mètres
 *    (jamais une décimale lue à voix haute, ex. « 1,5 kilomètre ») ;
 *  - temps arrondi à la minute la plus proche (pas de secondes lues) ;
 *  - allure au format déjà utilisé ailleurs dans l'app (`units.formatPace`).
 * Pluriels i18next (`_one`/`_other`), jamais une concaténation manuelle (docs/specs/technical/i18n.md).
 */
export function buildAnnouncementPhrase(
  t: TFunction,
  thresholdM: number,
  elapsedSeconds: number,
  avgPaceSPerKm: number | null,
  units: ReturnType<typeof useUnits>,
): string {
  const distancePart =
    thresholdM % 1000 === 0
      ? t('running.announcement.distanceKm', { count: thresholdM / 1000 })
      : t('running.announcement.distanceM', { count: thresholdM });
  const minutes = Math.round(elapsedSeconds / 60);
  const timePart = t('running.announcement.minutes', { count: minutes });
  const pacePart = t('running.announcement.pacePart', { pace: units.formatPace(avgPaceSPerKm) });
  return t('running.announcement.template', { distance: distancePart, time: timePart, pace: pacePart });
}

/**
 * Déclenche une annonce vocale à chaque franchissement d'un multiple de `intervalM` (spec R2).
 *
 * Le compteur de seuil déjà annoncé est **initialisé depuis la distance courante**, pas 0 — sinon
 * rouvrir l'écran de suivi (ex. carte « Reprendre » du hub course après avoir changé d'onglet,
 * spec R2) redéclencherait en rafale toutes les annonces déjà passées.
 *
 * Appelé inconditionnellement (règle des hooks) ; `enabled` gate l'effet en interne, comme les
 * autres hooks conditionnels du projet.
 */
export function useDistanceAnnouncements(input: {
  enabled: boolean;
  intervalM: number;
  distanceM: number;
  elapsedSeconds: number;
  avgPaceSPerKm: number | null;
}): void {
  const { t } = useTranslation();
  const units = useUnits();
  const lastAnnouncedIndexRef = useRef<number | null>(null);

  if (lastAnnouncedIndexRef.current === null) {
    lastAnnouncedIndexRef.current = Math.floor(input.distanceM / Math.max(input.intervalM, 1));
  }

  useEffect(() => {
    if (!input.enabled) return;
    const next = nextAnnouncementThreshold(
      input.distanceM,
      input.intervalM,
      lastAnnouncedIndexRef.current ?? 0,
    );
    if (!next) return;
    lastAnnouncedIndexRef.current = next.index;
    Speech.speak(
      buildAnnouncementPhrase(t, next.thresholdM, input.elapsedSeconds, input.avgPaceSPerKm, units),
    );
    // Re-déclenché à chaque seconde (elapsedSeconds) sans effet indésirable : `next` reste `null`
    // tant qu'aucun nouveau seuil n'est franchi (spec R2), le re-calcul est un simple no-op.
  }, [input.enabled, input.distanceM, input.intervalM, input.elapsedSeconds, input.avgPaceSPerKm, t, units]);
}
