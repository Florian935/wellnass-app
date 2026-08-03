/**
 * US LAUNCHER-01 — calcule l'instantané puis peint le widget. Factorisé entre
 * `register-home-widget.tsx` (tâche de fond obligatoire) et `refresh-home-widget.ts`
 * (déclenchement applicatif, D5) pour ne jamais avoir deux implémentations de ce chemin.
 */

import i18n from '@/i18n';
import { HomeWidget } from './HomeWidget';
import { computeHomeWidgetSnapshot } from './home-widget-data';
import { resolveHomeWidgetTexts } from './home-widget-texts';

export async function renderHomeWidgetNow() {
  const snapshot = await computeHomeWidgetSnapshot();
  const texts = resolveHomeWidgetTexts(snapshot, i18n.t);
  return <HomeWidget texts={texts} />;
}
