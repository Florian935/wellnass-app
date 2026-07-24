import { Alert, Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as MailComposer from 'expo-mail-composer';
import type { TFunction } from 'i18next';

import { getAppLanguage } from '@/i18n';

/** Adresse de destination du support (boîte dédiée bêta). Migrable vers support@<domaine> plus tard. */
export const SUPPORT_EMAIL = 'wellnessfit.app.support@gmail.com';

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

/** Collecte les métadonnées techniques (non identifiantes). Jamais bloquante : valeurs manquantes → « — ». */
export function collectSupportMeta(): SupportMeta {
  return {
    appVersion: Application.nativeApplicationVersion ?? '—',
    buildVersion: Application.nativeBuildVersion ?? '—',
    osName: Device.osName ?? Platform.OS,
    osVersion: Device.osVersion ?? String(Platform.Version),
    deviceModel: Device.modelName ?? '—',
    language: getAppLanguage(),
  };
}

export type ContactKind = 'contact' | 'bug';
export type ContactResult = { ok: true } | { fallback: true };

/**
 * Ouvre le client mail natif pré-rempli (contact ou signalement de bug). Si aucun client mail
 * n'est disponible → fallback `Alert` affichant l'adresse (l'utilisateur peut la recopier).
 */
export async function contactSupport(kind: ContactKind, t: TFunction): Promise<ContactResult> {
  // Fallback commun : aucune app mail (isAvailableAsync=false) OU rejet imprévu (isAvailableAsync/
  // composeAsync). contactSupport ne rejette JAMAIS → l'appelant `void contactSupport(...)` est sûr.
  const showFallback = (): ContactResult => {
    Alert.alert(t('help.mailUnavailableTitle'), t('help.mailUnavailableBody', { email: SUPPORT_EMAIL }));
    return { fallback: true };
  };

  try {
    if (!(await MailComposer.isAvailableAsync())) return showFallback();

    const isBug = kind === 'bug';
    const subject = t(isBug ? 'help.bug.subject' : 'help.contact.subject');
    // Métadonnées collectées uniquement sur le chemin nominal (pas de lecture native inutile en fallback).
    const body = isBug ? formatBugReportBody(collectSupportMeta(), t) : undefined;
    await MailComposer.composeAsync({ recipients: [SUPPORT_EMAIL], subject, body });
    return { ok: true };
  } catch {
    return showFallback();
  }
}
