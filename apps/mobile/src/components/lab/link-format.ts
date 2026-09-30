/**
 * US LIENS-01 / LABO-02 — la mise en mots d'un lien : ses textes et ses chiffres.
 *
 * Le registre (`@wellness/shared`, `cross-links.ts`) ne formule rien : il rend des **clés** et des
 * **valeurs brutes** (des clés de jour, des minutes, des écarts signés, des nombres décimaux). Ce
 * fichier les rend lisibles, dans la langue courante, et en un seul endroit — la carte, la fiche,
 * l'écho et le widget de l'accueil disent ainsi exactement la même chose.
 *
 * 🔴 **Une clé de jour ne s'affiche jamais telle quelle.** Avant LIENS-01, la feuille « ce qui
 * change » de la collision affichait « Séance déplacée au 2026-09-27 » : la valeur brute passait
 * directement dans la traduction. Toute clé qui finit par `DayKey` devient ici un jour en toutes
 * lettres.
 */

import type { TFunction } from 'i18next';
import type { CrossLink, CrossLinkState, CrossLinkText } from '@wellness/shared';

import { formatDecimal, formatMinutes, weekdayName } from './lab-format';
import type { Palette } from '@/theme/colors';

/** Les valeurs d'un texte de lien, prêtes à interpoler. */
export function formatLinkValues(
  values: Record<string, number | string>,
  locale: string,
  t: TFunction,
): Record<string, number | string> {
  const out: Record<string, number | string> = { ...values };
  for (const [key, raw] of Object.entries(values)) {
    if (typeof raw === 'string') {
      if (key.endsWith('DayKey') && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const day = weekdayName(raw, locale);
        out[key] = day;
        out[key.slice(0, -3)] = day; // strengthDayKey → strengthDay
      }
      if (key === 'runType' && raw.length > 0) {
        const label = t(`running.sessionType.${raw}`);
        out.runTypeLabel = label.charAt(0).toLocaleLowerCase(locale) + label.slice(1);
      }
      continue;
    }
    if (key === 'count' || key === 'have' || key === 'need' || key === 'cases' || key === 'needed') continue;
    if (key === 'sleepMinutes') {
      out.sleep = formatMinutes(raw);
      continue;
    }
    if (key === 'last') {
      out.last = raw > 0 ? formatMinutes(raw) : '—';
      continue;
    }
    if (key === 'delta' || key === 'kgPerWeek') {
      const digits = Number.isInteger(raw) ? 0 : 1;
      const abs = formatDecimal(Math.abs(raw), locale, digits);
      out[key] = raw > 0 ? `+${abs}` : raw < 0 ? `−${abs}` : abs;
      continue;
    }
    if (!Number.isInteger(raw)) {
      const digits = key === 'ratio' || key === 'run' || key === 'strength' ? 2 : 1;
      out[key] = formatDecimal(raw, locale, digits);
    }
  }
  return out;
}

/** Un texte de lien traduit : `lab.links.<scope>.<key>` avec ses valeurs mises en forme. */
export function linkText(t: TFunction, locale: string, scope: string, text: CrossLinkText, suffix = ''): string {
  return t(`lab.links.${scope}.${text.key}${suffix}`, formatLinkValues(text.values, locale, t));
}

/** Les textes d'un lien dont l'écran a besoin, résolus une fois. */
export function linkTexts(t: TFunction, locale: string, link: CrossLink) {
  return {
    question: t(`lab.links.${link.id}.question`),
    pair: t(`lab.links.${link.id}.pair`),
    verdict: linkText(t, locale, `${link.id}.verdict`, link.verdict),
    short: linkText(t, locale, `${link.id}.short`, link.short),
    state: t(`lab.links.states.${link.state}`),
    missing: link.missing === null ? null : linkText(t, locale, 'missing', link.missing, '.text'),
    meter: link.missing === null ? null : linkText(t, locale, 'missing', link.missing, '.meter'),
    source: linkText(t, locale, 'source', link.source),
  };
}

/** Une ligne « chiffre + libellé » (les deux chiffres d'une carte). */
export function figureTexts(t: TFunction, locale: string, figure: CrossLinkText) {
  const values = formatLinkValues(figure.values, locale, t);
  return {
    value: t(`lab.links.figures.${figure.key}.value`, values),
    label: t(`lab.links.figures.${figure.key}.label`, values),
  };
}

/** Une ligne de « ce que tes données croisent ». */
export function rowTexts(t: TFunction, locale: string, row: CrossLinkText) {
  const values = formatLinkValues(row.values, locale, t);
  return {
    label: t(`lab.links.rows.${row.key}.label`, values),
    value: t(`lab.links.rows.${row.key}.value`, values),
    note: t(`lab.links.rows.${row.key}.note`, values),
  };
}

/**
 * Le signe d'un état, posé **dans** une pastille (revue du 30/09/2026) : une pastille colorée seule
 * ne se lit pas pour qui distingue mal le corail, le bronze et l'or. « À découvrir » garde son
 * pointillé, qui est déjà une forme.
 */
export function stateGlyph(state: CrossLinkState): string {
  switch (state) {
    case 'guard':
      return '!';
    case 'adjust':
      return '~';
    case 'holds':
      return '✓';
    case 'discover':
      return '';
  }
}

/**
 * Les couleurs d'un état. Toujours accompagnées d'un mot (jamais une couleur seule) : `dot` pour la
 * pastille, `text` pour le mot, lisible à 4,5:1 sur la surface.
 */
export function stateTone(colors: Palette, state: CrossLinkState): { dot: string; text: string; border: string; dashed: boolean } {
  switch (state) {
    case 'guard':
      return { dot: colors.danger, text: colors.danger, border: colors.danger, dashed: false };
    case 'adjust':
      return { dot: colors.amber, text: colors.warnText, border: colors.warnBorder, dashed: false };
    case 'holds':
      return { dot: colors.pillarLab, text: colors.pillarLab, border: colors.border, dashed: false };
    case 'discover':
      return { dot: 'transparent', text: colors.textMuted, border: colors.textMuted, dashed: true };
  }
}
