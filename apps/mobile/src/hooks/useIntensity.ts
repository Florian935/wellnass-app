/**
 * US UX-05 — accès à l'échelle d'intensité choisie et à ses conversions.
 *
 * Même rôle que [`useUnits`](./useUnits.ts) pour les unités, et pour la même raison : la donnée
 * stockée (`workout_sets.rpe`) est unique, seule sa **présentation** change. Regrouper la conversion
 * et le libellé ici évite que trois écrans réinventent chacun `10 - rpe`.
 *
 * ⚠️ Ne s'applique **qu'aux séries de musculation**. Le ressenti global de séance (5 étoiles) et le
 * ressenti de course ne sont **pas** concernés : « répétitions en réserve » n'a aucun sens pour eux.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fromDisplayIntensity,
  intensityChoices,
  toDisplayIntensity,
  type IntensityScale,
} from '@wellness/shared';

import { useSettings } from '@/data/repositories/settings-repository';

export function useIntensity() {
  const { settings } = useSettings();
  const { t } = useTranslation();

  const scale: IntensityScale = settings?.intensityScale ?? 'rpe';

  return useMemo(
    () => ({
      scale,
      /** Libellé court de l'échelle (« RPE » / « RIR »), à interpoler dans les clés i18n. */
      label: t(`intensity.${scale}.short`),
      /** Nom complet, pour l'écran de réglages. */
      name: t(`intensity.${scale}.name`),
      /** Valeurs proposées à la saisie, dans l'ordre de lecture de l'échelle. */
      choices: intensityChoices(scale),
      /** RPE stocké → valeur affichée. `null` reste `null` (jamais « RIR 10 »). */
      toDisplay: (rpe: number | null | undefined): number | null =>
        toDisplayIntensity(rpe, scale),
      /** Valeur saisie → RPE à stocker. */
      toStored: (displayed: number | null | undefined): number | null =>
        fromDisplayIntensity(displayed, scale),
      /** Valeur formatée prête à afficher (« RPE 8 » / « RIR 2 »), ou `null` si non saisie. */
      format: (rpe: number | null | undefined): string | null => {
        const value = toDisplayIntensity(rpe, scale);
        if (value === null) return null;
        return t('workout.rpeValue', { scale: t(`intensity.${scale}.short`), value });
      },
    }),
    [scale, t],
  );
}
