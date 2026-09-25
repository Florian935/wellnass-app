/**
 * Démarrer la séance du jour — un seul chemin pour la carte du hub et l'aperçu (US MUSCU-UX07, §4.5).
 *
 *  1. la question du premier mode (R-MO-3), par la porte `gate` ;
 *  2. en mode immersif, le brief annonce la séance **avant** de la créer et porte lui-même le
 *     démarrage, pour que le chrono parte sur « C'est parti » (MUSCU-UX03, §5.1) ;
 *  3. sinon la séance est créée, rattachée à son occurrence planifiée, puis ouverte.
 *
 * `starting` ne pilote que l'affichage : la garde est portée par `useActionLock`. Un état React ne
 * voit pas un second appui du même cycle de rendu — sans le verrou, deux appuis créaient DEUX
 * séances, dont une orpheline que rien ne rouvrirait (seizième site du défaut du 08/08/2026).
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { briefRouteForSession } from '@/components/workout/immersive/brief-entry';
import { startWorkoutFromSession } from '@/data/repositories/workout-repository';
import { useActionLock } from '@/hooks/useActionLock';

export function useStartTodaySession(gate: (run: () => void) => void): {
  start: (sessionId: string, plannedSessionId: string) => void;
  starting: boolean;
} {
  const router = useRouter();
  const lock = useActionLock();
  const [starting, setStarting] = useState(false);

  const start = (sessionId: string, plannedSessionId: string) =>
    gate(() => {
      const brief = briefRouteForSession(sessionId, plannedSessionId);
      if (brief) {
        router.push(brief);
        return;
      }
      void lock(async () => {
        setStarting(true);
        try {
          await startWorkoutFromSession(sessionId, { plannedSessionId });
          router.push('/workout');
        } catch {
          // Offline-first : écriture locale, échec très improbable — on reste sur place.
        } finally {
          setStarting(false);
        }
      });
    });

  return { start, starting };
}
