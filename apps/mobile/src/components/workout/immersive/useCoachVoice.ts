/**
 * La voix du coach — US MUSCU-UX03, spec §5.14.
 *
 * ── Ce que c'est, et ce que ce n'est pas ────────────────────────────────────────────────────────
 * **Pas d'IA ici.** Des phrases à trous, en FR et en EN, dites par la synthèse vocale du téléphone
 * (`expo-speech`, déjà utilisée par la course, hors ligne). Le jour où une US d'IA enrichira ces
 * répliques, elle produira **les mêmes clés avec les mêmes variables** — rien à recâbler.
 *
 * ── Deux garde-fous ─────────────────────────────────────────────────────────────────────────────
 *  · **Une seule réplique à la fois** : une nouvelle interrompt la précédente. Deux phrases qui se
 *    chevauchent ne sont ni l'une ni l'autre compréhensibles.
 *  · **Chaque réplique est aussi écrite** à l'écran. La voix est un confort, jamais le seul canal —
 *    casque branché sur autre chose, salle bruyante, ou simplement mode silencieux.
 *
 * Le caractère « muet » coupe la voix, pas les légendes : c'est `pickCoachLine` qui renvoie alors
 * `null`, donc rien n'arrive jusqu'ici.
 */

import { useCallback } from 'react';
import * as Speech from 'expo-speech';
import { useTranslation } from 'react-i18next';
import type { CoachLine } from '@wellness/shared';

/**
 * Renvoie `speak(line)`, qui dit une réplique à voix haute.
 *
 * @param enabled Faux quand le mode immersif n'est pas actif ou que le caractère est « muet ».
 */
export function useCoachVoice(enabled: boolean): (line: CoachLine | null) => void {
  const { t, i18n } = useTranslation();

  return useCallback(
    (line: CoachLine | null) => {
      if (!enabled || !line) return;

      const phrase = t(line.key, line.vars);
      // Une clé absente de la traduction rend la clé elle-même : la faire lire à voix haute
      // donnerait « coach point motivant point verdict ». Mieux vaut se taire.
      if (!phrase || phrase === line.key) return;

      // Une seule réplique à la fois : la nouvelle interrompt la précédente.
      Speech.stop();
      Speech.speak(phrase, { language: i18n.language });
    },
    [enabled, i18n.language, t],
  );
}
