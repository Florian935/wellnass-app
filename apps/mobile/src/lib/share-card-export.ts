/**
 * Couche native fine de partage d'image (US PARTAGE-01).
 *
 * Orchestre : capture de la vue en PNG → copie dans le cache sous un nom lisible → feuille de
 * partage OS. Même patron et même contrat d'erreurs que [`gpx-export.ts`](./gpx-export.ts).
 * 100 % local, aucun réseau, aucune migration. Non testée unitairement (I/O natif) : la logique
 * testable vit dans `@wellness/shared` (`projectTrack`, `sampleTrack`, `shareCardFileName`).
 */

import type { View } from 'react-native';
// API LEGACY d'expo-file-system (SDK 57) : cohérence avec `gpx-export` et `data-export`.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import type { TFunction } from 'i18next';
import { shareCardFileName, SHARE_CARD_SIZE } from '@wellness/shared';

/** Résultat typé, pour que l'écran affiche le bon message plutôt qu'un échec muet. */
export type ShareCardResult = { ok: true } | { error: 'unavailable' | 'failed' };

/**
 * Capture la carte référencée et ouvre la feuille de partage OS.
 *
 * La capture est demandée en **1080 × 1080 indépendamment de la taille d'affichage** : la carte est
 * dessinée à ~320 dp pour l'aperçu, et `captureRef` la rend à la résolution de partage. C'est ce qui
 * évite d'avoir deux mises en page à tenir.
 *
 * ⚠️ Ne jamais passer ici une vue contenant une carte **MapLibre** : les vues natives de carte
 * ressortent noires ou vides d'une capture. C'est précisément pourquoi le tracé de la carte est du
 * SVG (décision D5).
 */
export async function shareCardImage(
  ref: React.RefObject<View | null>,
  kind: 'run' | 'workout',
  startedAtMs: number,
  t: TFunction,
): Promise<ShareCardResult> {
  if (ref.current === null) return { error: 'failed' };
  if (Number.isNaN(startedAtMs)) return { error: 'failed' };

  try {
    const captured = await captureRef(ref, {
      format: 'png',
      quality: 1,
      width: SHARE_CARD_SIZE,
      height: SHARE_CARD_SIZE,
      result: 'tmpfile',
    });

    if (!(await Sharing.isAvailableAsync())) {
      return { error: 'unavailable' };
    }

    // Le fichier temporaire de `captureRef` porte un nom aléatoire. On le recopie sous un nom
    // lisible et daté : c'est celui que verra l'app réceptrice et la galerie de l'utilisateur.
    const uri = FileSystem.cacheDirectory + shareCardFileName(kind, startedAtMs);
    try {
      await FileSystem.copyAsync({ from: captured, to: uri });
    } catch {
      // Le renommage est un confort, pas une condition : en cas d'échec on partage le fichier
      // temporaire tel quel plutôt que de perdre l'image.
      await Sharing.shareAsync(captured, {
        mimeType: 'image/png',
        dialogTitle: t('share.dialogTitle'),
      });
      return { ok: true };
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: t('share.dialogTitle'),
    });
    return { ok: true };
  } catch (err) {
    console.warn('[share-card] échec capture/partage:', err);
    return { error: 'failed' };
  }
}
