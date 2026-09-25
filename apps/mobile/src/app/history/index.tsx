/**
 * `/history` — une redirection vers Muscu › Historique (US MUSCU-UX07, D7).
 *
 * L'historique des séances vit désormais dans l'onglet Historique du hub Musculation, avec son
 * calendrier et la dernière fois exercice par exercice. Cet écran n'avait qu'un seul lien dans toute
 * l'app (la carte d'activation du 6ᵉ jour) ; la route reste pour ne casser ni ce lien ni un lien
 * entrant. Le détail d'une séance, `/history/[id]`, reste un écran.
 */

import { Redirect } from 'expo-router';

export default function HistoryRedirect() {
  return <Redirect href={{ pathname: '/(tabs)/strength', params: { section: 'history' } }} />;
}
