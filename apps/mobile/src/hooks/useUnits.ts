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
  cmToIn,
  inToCm,
  paceToSystem,
  formatPaceMMSS,
  parseWeightToKg as parseWeightToKgPure,
  parseDistanceToKm as parseDistanceToKmPure,
  heightPartsToCm as heightPartsToCmPure,
  parsePaceToSPerKm,
  formatPaceValue,
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
      /** Valeur numérique convertie, formatée à 2 décimales (sans symbole). Pour les
       *  layouts « grand nombre + petite unité » qui affichent le symbole séparément. */
      formatDistanceValue: (km: number | null | undefined): string => {
        if (km == null) return '—';
        const v = system === 'imperial' ? kmToMi(km) : km;
        return nf2.format(v);
      },
      /**
       * Circonférence corporelle (US MESUR-01) : cm ou **pouces décimaux**.
       *
       * ⚠️ **Ne pas utiliser `formatHeight` pour ça** : il rend l'impérial en pieds-pouces, ce qui
       * est juste pour une taille humaine et absurde pour un tour de bras — 35 cm s'afficherait
       * « 1 ft 1.8 in » au lieu de **13,8 in**.
       */
      formatCircumference: (cm: number | null | undefined): string => {
        if (cm == null) return '—';
        return system === 'imperial'
          ? `${nf1.format(cmToIn(cm))} in`
          : `${nf1.format(cm)} cm`;
      },
      /** Valeur convertie sans symbole, pour pré-remplir un champ de saisie (US MESUR-01). */
      toCircumferenceValue: (cm: number): number =>
        system === 'imperial' ? Math.round(cmToIn(cm) * 10) / 10 : cm,
      /** Symbole de circonférence, pour un placeholder ou un suffixe de champ. */
      circumferenceSymbol: system === 'imperial' ? 'in' : 'cm',
      /**
       * Saisie utilisateur → centimètres. Accepte la **virgule** comme séparateur décimal (clavier
       * français) autant que le point. Renvoie `null` si ce n'est pas un nombre exploitable.
       */
      parseCircumferenceToCm: (text: string): number | null => {
        const normalized = text.trim().replace(',', '.');
        if (normalized === '') return null;
        const parsed = Number(normalized);
        if (!Number.isFinite(parsed) || parsed <= 0) return null;
        // Arrondi au dixième : la colonne est `numeric(5,1)`, inutile de transporter plus de précision.
        const cm = system === 'imperial' ? inToCm(parsed) : parsed;
        return Math.round(cm * 10) / 10;
      },
      formatHeight: (cm: number | null | undefined): string => {
        if (cm == null) return '—';
        if (system === 'imperial') {
          // `ft`/`in` sont des entiers (jamais de séparateur de milliers pour une taille humaine)
          // → pas de passage par Intl, contrairement au cm métrique.
          const { feet, inches } = cmToFtIn(cm);
          return `${feet} ft ${inches} in`;
        }
        // 'cm' est codé en dur : la hauteur n'a pas de clé dans `unitSymbol`.
        return `${nf0.format(cm)} cm`;
      },
      formatPace: (sPerKm: number | null | undefined): string => {
        // Garde explicite (évite de comparer le résultat au sentinel par identité) :
        // reproduit le contrat de formatPaceMMSS (null / <= 0 / non fini → pas de donnée).
        if (sPerKm == null || sPerKm <= 0 || !Number.isFinite(sPerKm)) {
          return noData;
        }
        const mmss = formatPaceMMSS(paceToSystem(sPerKm, system), '');
        return `${mmss} /${symbols.distance}`;
      },

      parseWeightToKg: (text: string) => parseWeightToKgPure(text, system),
      parseDistanceToKm: (text: string) => parseDistanceToKmPure(text, system),
      heightPartsToCm: (a: string, b: string) => heightPartsToCmPure(a, b, system),
      parsePace: (text: string) => parsePaceToSPerKm(text, system),
      paceInputValue: (sPerKm: number | null | undefined) =>
        sPerKm == null ? '' : formatPaceValue(sPerKm, system),

      // Valeur numérique convertie vers l'unité d'affichage (pour alimenter les graphes ; sans arrondi ni symbole).
      toWeightValue: (kg: number): number => (system === 'imperial' ? kgToLb(kg) : kg),
      toDistanceValue: (km: number): number => (system === 'imperial' ? kmToMi(km) : km),

      // Pré-remplissage des champs : 1 décimale (cohérent avec l'affichage). La légère
      // dérive d'arrondi en impérial (kg→lb→kg) est neutralisée en amont par l'anti-dérive
      // de la saisie (on ne réécrit pas le SI si le champ n'a pas été modifié — cf. plan §D).
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
