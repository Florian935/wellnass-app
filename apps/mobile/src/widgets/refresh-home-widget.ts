/**
 * US LAUNCHER-01 — déclenchement applicatif du rafraîchissement (D5), en complément du filet
 * périodique `updatePeriodMillis` (plafond OS 30 min, config plugin). Fire-and-forget partout où
 * c'est appelé — un rafraîchissement de widget qui échoue ne doit jamais faire échouer l'action
 * réelle (fin de séance, ajout d'un repas...), même patron que `void track(...)` ailleurs.
 *
 * `widgetNotFound` : aucune erreur si le widget n'est pas posé sur l'écran d'accueil — c'est l'état
 * normal de la majorité des utilisateurs, pas un cas à journaliser.
 */

import { requestWidgetUpdate } from 'react-native-android-widget';
import { renderHomeWidgetNow } from './render-home-widget';

const WIDGET_NAME = 'HomeWidget';

export function refreshHomeWidget(): void {
  void requestWidgetUpdate({
    widgetName: WIDGET_NAME,
    renderWidget: renderHomeWidgetNow,
  });
}
