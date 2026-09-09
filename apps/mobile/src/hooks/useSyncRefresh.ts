/**
 * US ACCUEIL-05 — le geste « tirer pour rafraîchir », et ce qu'il fait vraiment.
 *
 * ── Pourquoi c'est subtil dans une app offline-first ─────────────────────────────────────────────
 * Les écrans lisent SQLite local via `useQuery`, qui est **déjà réactif** : une donnée modifiée
 * apparaît sans qu'on ait rien à demander. Un pull-to-refresh n'a donc rien à « recharger » côté
 * affichage — et c'est probablement pourquoi l'app n'en comptait pas un seul.
 *
 * Sauf que le geste est un **réflexe**, et qu'un écran qui ne réagit pas à un réflexe se lit comme
 * un écran figé. Ce hook lui donne le seul sens qu'il puisse avoir ici : **forcer la synchronisation
 * à reprendre**. C'est utile dans un cas réel et fréquent — au retour de connexion après un tunnel
 * ou une salle en sous-sol, quand PowerSync n'a pas encore reconnecté de lui-même.
 *
 * ── Ce qu'il ne fait pas ─────────────────────────────────────────────────────────────────────────
 * Il ne promet pas que les données distantes sont arrivées quand l'indicateur s'arrête : une
 * synchronisation peut être longue, et bloquer le spinner jusqu'à complétion donnerait un geste qui
 * tourne dans le vide hors ligne. On rend donc la main après un délai court et borné, avec un
 * plancher qui évite le clignotement d'un indicateur qui disparaît en 20 ms.
 */

import { useCallback, useRef, useState } from 'react';

import { connector, powerSync } from '@/powersync/system';

/** Durée minimale d'affichage de l'indicateur — en dessous, il clignote au lieu de se voir. */
const MIN_SPIN_MS = 450;
/** Durée maximale : hors ligne, la reconnexion n'aboutira pas, le geste ne doit pas rester pendu. */
const MAX_SPIN_MS = 2500;

export function useSyncRefresh(): { refreshing: boolean; onRefresh: () => void } {
  const [refreshing, setRefreshing] = useState(false);
  // Garde de réentrance : deux gestes rapprochés ne doivent pas lancer deux reconnexions.
  const busy = useRef(false);

  const onRefresh = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    const started = Date.now();

    const release = () => {
      const elapsed = Date.now() - started;
      const wait = Math.max(0, MIN_SPIN_MS - elapsed);
      setTimeout(() => {
        setRefreshing(false);
        busy.current = false;
      }, wait);
    };

    void (async () => {
      try {
        // `connect` est idempotent côté PowerSync : appelé alors que la session est déjà
        // connectée, il ne casse rien. C'est précisément ce qui rend le geste sûr à répéter.
        await Promise.race([
          powerSync.connect(connector),
          new Promise((resolve) => setTimeout(resolve, MAX_SPIN_MS)),
        ]);
      } catch {
        // Hors ligne, ou jeton expiré : il n'y a rien à dire à l'utilisateur. Le bandeau de
        // synchronisation de l'en-tête porte déjà l'état de la connexion, et une alerte sur un
        // geste exploratoire serait plus intrusive que l'échec lui-même.
      } finally {
        release();
      }
    })();
  }, []);

  return { refreshing, onRefresh };
}
