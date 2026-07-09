/**
 * useUnits — lie le système d'unités (réglage utilisateur) à la locale courante.
 *
 * Ce hook ne contient AUCUNE logique de conversion : il délègue entièrement à
 * `@wellness/shared/units` et formate les nombres via `Intl.NumberFormat`.
 *
 * Utilisation :
 *   const { formatWeight, formatDistance, formatHeight, formatPace } = useUnits();
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  unitSymbol,
  kgToLb,
  kmToMi,
  cmToFtIn,
  paceToSystem,
  formatPaceMMSS,
  parseWeightToKg as parseWeightToKgPure,
  parseDistanceToKm as parseDistanceToKmPure,
  heightPartsToCm as heightPartsToCmPure,
  type UnitSystem,
} from '@wellness/shared';
import { useSettings } from '@/data/repositories/settings-repository';

export function useUnits() {
  const { settings } = useSettings();
  const { t, i18n } = useTranslation();
  const system: UnitSystem = settings?.units ?? 'metric';
  const locale = i18n.language;

  return useMemo(() => {
    const symbols = unitSymbol[system];
    const nf = (min: number, max: number) =>
      new Intl.NumberFormat(locale, { minimumFractionDigits: min, maximumFractionDigits: max });
    const nf1 = nf(1, 1); // poids : 1 décimale
    const nf2 = nf(2, 2); // distance : 2 décimales
    const nf0 = nf(0, 0); // taille cm : entier
    const noData = t('running.active.noData');

    return {
      system,
      weightSymbol: symbols.weight,
      distanceSymbol: symbols.distance,

      formatWeight: (kg: number | null | undefined): string => {
        if (kg == null) return '—';
        const v = system === 'imperial' ? kgToLb(kg) : kg;
        return `${nf1.format(v)} ${symbols.weight}`;
      },
      formatDistance: (km: number | null | undefined): string => {
        if (km == null) return '—';
        const v = system === 'imperial' ? kmToMi(km) : km;
        return `${nf2.format(v)} ${symbols.distance}`;
      },
      formatHeight: (cm: number | null | undefined): string => {
        if (cm == null) return '—';
        if (system === 'imperial') {
          const { feet, inches } = cmToFtIn(cm);
          return `${feet} ft ${inches} in`;
        }
        return `${nf0.format(cm)} cm`;
      },
      formatPace: (sPerKm: number | null | undefined): string => {
        const secs = sPerKm == null ? null : paceToSystem(sPerKm, system);
        const mmss = formatPaceMMSS(secs, noData);
        return mmss === noData ? mmss : `${mmss} /${symbols.distance}`;
      },

      parseWeightToKg: (text: string) => parseWeightToKgPure(text, system),
      parseDistanceToKm: (text: string) => parseDistanceToKmPure(text, system),
      heightPartsToCm: (a: string, b: string) => heightPartsToCmPure(a, b, system),

      weightInputValue: (kg: number | null | undefined): string =>
        kg == null ? '' : String(Number((system === 'imperial' ? kgToLb(kg) : kg).toFixed(1))),
      distanceInputValue: (km: number | null | undefined): string =>
        km == null ? '' : String(Number((system === 'imperial' ? kmToMi(km) : km).toFixed(2))),
      heightPartsFromCm: (cm: number | null | undefined): { a: string; b: string } => {
        if (cm == null) return { a: '', b: '' };
        if (system === 'imperial') {
          const { feet, inches } = cmToFtIn(cm);
          return { a: String(feet), b: String(inches) };
        }
        return { a: String(Math.round(cm)), b: '' };
      },
    };
  }, [system, locale, t]);
}
