/**
 * De quoi écrire « la dernière fois » dans l'unité et la langue de l'utilisateur — US MUSCU-UX07, R3.
 *
 * `formatLastPerformance` (packages/shared) ne connaît ni unités ni langue : ce hook lui fournit une
 * charge convertie **sans zéro inutile** (« 80 », « 77,5 », là où `formatWeight` écrirait « 80,0 kg »
 * — trop long pour une ligne qui en aligne cinq), le symbole d'unité, le libellé du poids du corps et
 * le format de durée de la séance.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { kgToLb, type LastPerfFormat } from '@wellness/shared';
import { useUnits } from '@/hooks/useUnits';
import { formatSetDuration } from '@/lib/progression-suggestion';

export function useLastPerfFormat(): LastPerfFormat {
  const { t, i18n } = useTranslation();
  const units = useUnits();
  const locale = i18n.language;

  return useMemo(() => {
    const nf = new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 1 });
    return {
      load: (kg: number) => nf.format(units.system === 'imperial' ? kgToLb(kg) : kg),
      unit: units.weightSymbol,
      bodyweight: t('strengthHub.lastTime.bodyweight'),
      duration: formatSetDuration,
    };
  }, [locale, units.system, units.weightSymbol, t]);
}

/**
 * Une date courte, jour de la semaine compris : « jeu. 17/09 », « Thu 17/09 ». Le jour et le mois
 * restent au format JJ/MM dans les deux langues, comme partout dans l'app.
 */
export function formatShortDay(iso: string, locale: string): string {
  const date = new Date(iso);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${weekday} ${dd}/${mm}`;
}

/** Un tonnage en tonnes métriques, une décimale (R6) : « 11,4 ». */
export function formatTonnes(kg: number, locale: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
    kg / 1000,
  );
}
