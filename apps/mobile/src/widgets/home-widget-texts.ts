/**
 * US LAUNCHER-01 — résout tout le texte du widget AVANT de le passer à la couche d'affichage
 * native (D4). Même partage des responsabilités que `notification-repository.ts` /
 * `notifications.ts` : ce module résout via `i18n.t()`, `HomeWidget.tsx` ne fait que peindre du
 * texte déjà prêt — aucune duplication de traduction dans un `strings.xml` par locale.
 */

import type { TFunction } from 'i18next';
import type { HomeWidgetSnapshot } from './home-widget-data';

export type HomeWidgetTexts =
  | { authState: 'no-session'; noSessionText: string; openCta: string }
  | {
      authState: 'ready';
      streakLabel: string;
      streakValue: string;
      todayLabel: string;
      /** `null` = piliers musculation ET course inactifs (D6) — jamais affiché. */
      sessionText: string | null;
      /** Libellé du pilier sous `sessionText` (ex. « Musculation ») — `null` si repos ou masqué. */
      sessionSubtitle: string | null;
      kcalLabel: string;
      /** `null` = nutrition inactive ou profil incomplet (D6). */
      kcalValue: string | null;
    };

export function resolveHomeWidgetTexts(snapshot: HomeWidgetSnapshot, t: TFunction): HomeWidgetTexts {
  if (snapshot.authState === 'no-session') {
    return {
      authState: 'no-session',
      noSessionText: t('homeWidget.noSession'),
      openCta: t('homeWidget.openCta'),
    };
  }

  const sessionText =
    snapshot.todaySession === null
      ? null
      : snapshot.todaySession.kind === 'rest'
        ? t('homeWidget.restLabel')
        : snapshot.todaySession.name;

  const sessionSubtitle =
    snapshot.todaySession?.kind === 'session' ? t(`pillars.${snapshot.todaySession.pillar}`) : null;

  return {
    authState: 'ready',
    streakLabel: t('homeWidget.streakLabel'),
    streakValue: t('homeWidget.streakValue', { count: snapshot.streak }),
    todayLabel: t('homeWidget.todayLabel'),
    sessionText,
    sessionSubtitle,
    kcalLabel: t('homeWidget.kcalLabel'),
    kcalValue:
      snapshot.kcalRemaining == null ? null : t('homeWidget.kcalValue', { kcal: Math.round(snapshot.kcalRemaining) }),
  };
}
