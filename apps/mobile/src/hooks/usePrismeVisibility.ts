/**
 * US PRISME-01 — une entrée Prisme est-elle **visible** ? (spec DD7, R7, R13)
 *
 * - Le dernier statut connu dit « disponible » → visible, même sans accord : le geste ouvrira la
 *   feuille d'accord, ce n'est pas un bouton mort.
 * - Le statut dit « indisponible » (fournisseur non autorisé, rien de configuré) → rien de Prisme.
 * - Pas de statut connu (l'app a démarré hors ligne) → l'accord local fait foi. Une entrée visible hors
 *   ligne dit « Prisme a besoin du réseau » au geste, et rien ne part.
 * - Moins de 18 ans d'après la date de naissance → rien de Prisme, quoi que dise le statut. Le serveur
 *   le refuse aussi ; ce contrôle-ci évite seulement d'afficher un bouton qui mènerait à un refus.
 *
 * « Visible » n'est pas « appelable » : le réseau ne se sait qu'au geste (le client renvoie `offline`).
 * Le statut est demandé **une fois par session**, au premier montage qui en a besoin.
 */

import { useEffect } from 'react';
import type { PrismeStatus } from '@wellness/shared';

import { useProfile } from '@/data/repositories/profile-repository';
import { useSettings } from '@/data/repositories/settings-repository';
import { useTodayKey } from '@/hooks/useTodayKey';
import { refreshPrismeStatus } from '@/lib/ai/prisme';
import { usePrismeStore } from '@/stores/prisme-store';

const ADULT_AGE_YEARS = 18;

/** Moins de 18 ans au jour donné, d'après une date `AAAA-MM-JJ`. Date inconnue → pas mineur (déclaratif, DD15). */
function isMinor(birthDate: string | null | undefined, todayKey: string): boolean {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}/.test(birthDate)) return false;
  const [by, bm, bd] = birthDate.slice(0, 10).split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = todayKey.split('-').map(Number) as [number, number, number];
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age < ADULT_AGE_YEARS;
}

export function usePrismeVisibility(): { visible: boolean; minor: boolean; status: PrismeStatus | null } {
  const status = usePrismeStore((s) => s.status);
  const requested = usePrismeStore((s) => s.statusRequested);
  const { settings } = useSettings();
  const { profile } = useProfile();
  const todayKey = useTodayKey();

  useEffect(() => {
    if (requested) return;
    usePrismeStore.getState().markStatusRequested();
    void refreshPrismeStatus();
  }, [requested]);

  const minor = isMinor(profile?.birthDate, todayKey);
  const visible = minor ? false : status !== null ? status.available : Boolean(settings?.prismeConsentAt);
  return { visible, minor, status };
}
