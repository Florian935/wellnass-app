import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { TemplateComposer } from '@/components/templates/TemplateComposer';
import { useActionLock } from '@/hooks/useActionLock';
import {
  deleteWorkoutTemplate,
  duplicateWorkoutTemplate,
  startWorkoutFromTemplate,
  useWorkoutTemplateDetail,
} from '@/data/repositories/workout-template-repository';

/**
 * Détail d'un template de séance libre (US Refonte-D §2) : même contenu éditable
 * que `templates/edit.tsx?id=` (`TemplateComposer`) plus les actions Démarrer /
 * Dupliquer / Supprimer. Patron exact `ProgramDetailScreen` pour la suppression
 * (confirmation puis soft delete).
 */
export default function TemplateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const templateId = typeof id === 'string' ? id : '';

  return <TemplateDetailView templateId={templateId} />;
}

function TemplateDetailView({ templateId }: { templateId: string }) {
  const { t } = useTranslation();
  const router = useRouter();

  // Hook propre à cet écran (en plus de celui interne à `TemplateComposer`) pour
  // connaître le nombre d'exercices et activer/désactiver le bouton Démarrer.
  const { detail } = useWorkoutTemplateDetail(templateId);

  const [starting, setStarting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const lockStart = useActionLock();
  const lockDuplicate = useActionLock();
  const lockDelete = useActionLock();

  // Tant que le template n'est pas chargé (ou introuvable — ex. supprimé depuis un
  // autre appareil), `TemplateComposer` affiche déjà son propre état de chargement/
  // "introuvable" : on n'ajoute PAS le footer d'actions dans ce cas (patron
  // `ProgramDetailView`, qui masque aussi ses actions tant que `detail` est absent).
  if (!detail) {
    return <TemplateComposer templateId={templateId} />;
  }

  const hasExercises = detail.exercises.length > 0;

  // Les états `starting` / `duplicating` / `deleting` ne pilotent que l'affichage ; la garde
  // contre le double appui est portée par `useActionLock` (un état React ne voit pas un second
  // appui du même cycle de rendu — voir le hook).
  const onStart = () =>
    void lockStart(async () => {
      setStarting(true);
      try {
        await startWorkoutFromTemplate(templateId);
        router.push('/workout');
      } catch {
        // Écriture offline-first : échec très improbable ; on réactive le bouton.
      } finally {
        setStarting(false);
      }
    });

  const onDuplicate = () =>
    void lockDuplicate(async () => {
      setDuplicating(true);
      try {
        const newId = await duplicateWorkoutTemplate(templateId);
        router.replace(`/templates/${newId}`);
      } catch {
        // Silencieux : la duplication atomique a échoué, on reste sur le détail.
      } finally {
        setDuplicating(false);
      }
    });

  const handleDelete = () =>
    void lockDelete(async () => {
      setDeleting(true);
      try {
        await deleteWorkoutTemplate(templateId);
        router.replace('/templates');
      } catch {
        setDeleting(false);
      }
    });

  const onDelete = () => {
    if (deleting) return;
    Alert.alert(detail.name, t('templates.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('templates.delete'),
        style: 'destructive',
        onPress: handleDelete,
      },
    ]);
  };

  return (
    <View style={styles.flex}>
      <TemplateComposer templateId={templateId} />
      <SafeAreaView edges={['bottom']} style={styles.actions}>
        <Button
          label={starting ? t('templates.starting') : t('templates.start')}
          onPress={() => void onStart()}
          loading={starting}
          disabled={starting || !hasExercises}
        />
        <Button
          label={duplicating ? t('templates.duplicating') : t('templates.duplicate')}
          variant="ghost"
          onPress={() => void onDuplicate()}
          loading={duplicating}
          disabled={duplicating}
        />
        <Button
          label={deleting ? t('templates.deleting') : t('templates.delete')}
          variant="destructive"
          onPress={onDelete}
          loading={deleting}
          disabled={deleting}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  actions: { paddingHorizontal: 20, paddingTop: 12, gap: 10 },
});
