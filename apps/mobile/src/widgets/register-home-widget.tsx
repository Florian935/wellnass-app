/**
 * US LAUNCHER-01 — enregistre la tâche de fond `react-native-android-widget` (side-effect) dès le
 * chargement du JS, même patron que `@/running/tracker-task` : ce module ne peut lire aucun état
 * React (hooks/stores) car il peut être invoqué par Android hors de tout arbre monté (widget ajouté
 * au home screen, alarme périodique, tap sur le widget) — voir la note de `tracker-task.ts`.
 */

import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { renderHomeWidgetNow } from './render-home-widget';

registerWidgetTaskHandler(async ({ widgetAction, renderWidget }) => {
  if (widgetAction === 'WIDGET_DELETED') return;
  renderWidget(await renderHomeWidgetNow());
});
