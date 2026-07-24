import type { TFunction } from 'i18next';

/** Adresse de destination du support. PLACEHOLDER — à remplacer par la vraie boîte avant le build. */
export const SUPPORT_EMAIL = 'support@example.com';

export type SupportMeta = {
  appVersion: string;
  buildVersion: string;
  osName: string;
  osVersion: string;
  deviceModel: string;
  language: string;
};

/**
 * Corps pré-rempli du mail de signalement de bug : invite libre + bloc technique délimité,
 * visible et effaçable par l'utilisateur. PUR (aucun I/O) → testé.
 */
export function formatBugReportBody(meta: SupportMeta, t: TFunction): string {
  return [
    t('help.bug.prompt'),
    '',
    '',
    `——— ${t('help.bug.techHeader')} ———`,
    `${t('help.bug.appLabel')} : ${meta.appVersion} (${t('help.bug.buildLabel')} ${meta.buildVersion})`,
    `${t('help.bug.systemLabel')} : ${meta.osName} ${meta.osVersion}`,
    `${t('help.bug.deviceLabel')} : ${meta.deviceModel}`,
    `${t('help.bug.languageLabel')} : ${meta.language}`,
  ].join('\n');
}
