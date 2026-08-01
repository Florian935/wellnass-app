/**
 * US CYCLE-01 — garde d'accès des écrans de cycle.
 *
 * Le critère de recette 1 dit « réglage désactivé par défaut : aucun widget, **aucune route
 * atteignable** ». Or les deux écrans ne reposaient que sur une convention — « on n'y accède que
 * par le widget ». Expo Router enregistre pourtant les routes, et le schéma `wellness://` est
 * déclaré : `wellness://cycle` et `wellness://cycle/insights` s'ouvraient donc entièrement,
 * suivi éteint (constaté en recette device du 31/07/2026).
 *
 * Pour une donnée de santé sensible en opt-in strict, la convention ne suffit pas : la porte est
 * fermée ici, une seule fois, pour les deux écrans.
 *
 * ⚠️ **Ne jamais rediriger pendant le chargement.** `settings` vaut `null` tant que la requête
 * locale n'a pas répondu ; rediriger à ce moment renverrait à l'accueil un utilisateur qui a bien
 * activé le suivi — le bug inverse, et plus pénible.
 */

import type { ReactNode } from 'react';
import { Redirect } from 'expo-router';

import { useSettings } from '@/data/repositories/settings-repository';

export function CycleTrackingGuard({ children }: { children: ReactNode }) {
  const { settings, isLoading } = useSettings();

  // Chargement en cours : on n'affiche rien et on ne redirige pas encore.
  if (isLoading) return null;

  if (!settings?.cycleTrackingEnabled) return <Redirect href="/" />;

  return <>{children}</>;
}
