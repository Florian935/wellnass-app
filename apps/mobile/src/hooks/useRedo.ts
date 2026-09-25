/**
 * Refaire une séance passée — US MUSCU-UX07, règle R4. Le même geste depuis le hub, l'historique et
 * le détail d'une séance.
 *
 * `startWorkoutFromWorkout` crée une séance **libre** : mêmes exercices, même ordre, charges et
 * répétitions de départ. **Si une séance est déjà en cours**, rien n'est créé : une alerte propose
 * de la reprendre. Avant cette US, la fonction renvoyait en silence la séance en cours, et
 * l'utilisateur se retrouvait dans une autre séance que celle qu'il avait demandée.
 */

import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { hasActiveWorkout, startWorkoutFromWorkout } from '@/data/repositories/workout-repository';
import { useActionLock } from '@/hooks/useActionLock';

export function useRedo(): (workoutId: string) => void {
  const { t } = useTranslation();
  const router = useRouter();
  const lock = useActionLock();

  return (workoutId) =>
    void lock(async () => {
      try {
        if (await hasActiveWorkout()) {
          Alert.alert(t('strengthHub.redo.busyTitle'), t('strengthHub.redo.busyMessage'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('strengthHub.resumeLine.action'), onPress: () => router.push('/workout') },
          ]);
          return;
        }
        await startWorkoutFromWorkout(workoutId);
        router.push('/workout');
      } catch (error) {
        // Séance d'origine introuvable (supprimée entre-temps) : rien n'est écrit, on reste là.
        console.warn('Refaire la séance impossible :', error);
      }
    });
}
