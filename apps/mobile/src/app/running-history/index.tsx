/**
 * `/running-history` — une redirection vers Course › Historique (US CARDIO-UX03, D7 ; Q8).
 *
 * L'historique des sorties vit désormais dans l'onglet Historique du hub Course (calendrier, lignes
 * enrichies, par type), et les analyses de l'ancien écran « Historique & progression » dans
 * « Toutes tes stats » (`/running-stats`). La route reste pour ne casser aucun lien entrant.
 *
 * Elle déclare son pilier comme tout écran du pilier : le test-garde `pillar-identity` le vérifie
 * pour chaque fichier de `running-history/`, et une redirection rendue une fraction de seconde
 * depuis l'accueil n'a pas à clignoter en terracotta.
 */

import { Redirect } from 'expo-router';
import { useMenuFocus } from '@/hooks/useMenuFocus';

export default function RunningHistoryRedirect() {
  useMenuFocus('running');
  return <Redirect href={{ pathname: '/(tabs)/running', params: { section: 'history' } }} />;
}
