/**
 * La question du mode au tout premier démarrage — US MUSCU-UX03, règle R-MO-3, sortie du hub par
 * MUSCU-UX07 pour servir aussi l'aperçu de la séance.
 *
 * Posée **une seule fois**, et seulement à quelqu'un qui n'a encore rien fait : ni mode choisi, ni
 * séance terminée. `gate(run)` rejoue ensuite l'action qui l'a déclenchée — l'utilisateur voulait
 * démarrer, pas régler quelque chose. Dans une même vie d'écran, la question ne se repose pas, sans
 * quoi « ne pas retenir mon choix » bouclerait sur la feuille.
 *
 * L'écran rend la feuille avec `sheet` : `<SessionModeSheet {...gate.sheet} colors={colors} />`.
 */

import { useRef, useState } from 'react';
import type { WorkoutDisplayMode } from '@wellness/shared';
import { useSessionMode } from '@/stores/session-mode-store';

export type ModeGate = {
  /** Lance `run`, en posant d'abord la question si elle doit l'être. */
  gate: (run: () => void) => void;
  sheet: {
    visible: boolean;
    onClose: () => void;
    onPick: (mode: WorkoutDisplayMode, remember: boolean) => void;
  };
};

export function useModeGate(hasHistory: boolean): ModeGate {
  const modeChosen = useSessionMode((s) => s.chosen);
  const setMode = useSessionMode((s) => s.setMode);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const asked = useRef(false);

  return {
    gate: (run) => {
      if (asked.current || modeChosen || hasHistory) {
        run();
        return;
      }
      asked.current = true;
      setPending(() => run);
    },
    sheet: {
      visible: pending !== null,
      onClose: () => setPending(null),
      onPick: (mode, remember) => {
        setMode(mode, { remember });
        const run = pending;
        setPending(null);
        run?.();
      },
    },
  };
}
