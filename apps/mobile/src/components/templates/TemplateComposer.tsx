import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { ExercisePicker } from '@/components/programs/ExercisePicker';
import { TemplateExerciseEditor } from '@/components/templates/TemplateExerciseEditor';
import type { ExerciseListItem } from '@/data/repositories/exercise-repository';
import {
  addTemplateExercise,
  renameWorkoutTemplate,
  useWorkoutTemplateDetail,
  type WorkoutTemplateDetail,
} from '@/data/repositories/workout-template-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type TemplateComposerProps = {
  templateId: string;
};

/**
 * Contenu partagé de composition d'un template de séance libre (US Refonte-D §2) :
 * nom éditable en tête + liste des exercices. Utilisé à l'identique par
 * `templates/edit.tsx?id=` et `templates/[id].tsx` — contrairement au patron
 * `programs/` (où `edit.tsx?id=` et `[id].tsx` affichent deux rendus différents,
 * composition vs lecture seule), un template est toujours possédé par
 * l'utilisateur courant : les deux routes affichent le même contenu éditable.
 *
 * Ni bouton « Terminé » ni actions Démarrer/Dupliquer/Supprimer ici : ce sont les
 * écrans appelants qui les ajoutent autour.
 */
export function TemplateComposer({ templateId }: TemplateComposerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { detail, isLoading } = useWorkoutTemplateDetail(templateId);

  if (isLoading && !detail) {
    return (
      <Screen edges={['top']} center>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  // Template introuvable (ex. supprimé depuis un autre appareil pendant la
  // consultation) : mêmes clés que `programs.detail.notFound*`.
  if (!detail) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title={t('templates.notFoundTitle')} />
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          {t('templates.notFoundMessage')}
        </Text>
      </Screen>
    );
  }

  // Composant enfant monté uniquement une fois `detail` disponible : l'état local
  // du nom s'initialise donc depuis la valeur chargée sans effet de resynchronisation
  // (même patron que l'initialisation du poids dans `TemplateExerciseEditor`).
  // `key={detail.id}` force un remount (donc une réinitialisation du nom) si l'id
  // change alors que ce composant resterait monté (ex. après une duplication qui
  // navigue vers le nouveau template via `router.replace`), patron `FeelingSection`
  // (`workout-summary.tsx`, `key={workout.id}`).
  return <TemplateComposerBody key={detail.id} templateId={templateId} detail={detail} />;
}

function TemplateComposerBody({
  templateId,
  detail,
}: {
  templateId: string;
  detail: WorkoutTemplateDetail;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [name, setName] = useState(detail.name);
  const [pickerVisible, setPickerVisible] = useState(false);

  const onBlurName = () => {
    const trimmed = name.trim();
    if (trimmed === '') {
      // Nom vide : on revient au nom persisté plutôt que d'écrire une chaîne vide.
      setName(detail.name);
      return;
    }
    void renameWorkoutTemplate(templateId, trimmed);
  };

  const onPickExercise = (exercise: ExerciseListItem) => {
    setPickerVisible(false);
    void addTemplateExercise(templateId, { exerciseId: exercise.id });
  };

  return (
    <Screen edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.nameField}>
          <TextField
            label={t('templates.name')}
            value={name}
            onChangeText={setName}
            onBlur={onBlurName}
            autoCapitalize="sentences"
            placeholder={t('templates.namePlaceholder')}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('templates.editTitle')}
        </Text>

        {detail.exercises.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('templates.emptyExercises')}
          </Text>
        ) : (
          <View style={styles.exercises}>
            {detail.exercises.map((plan) => (
              <TemplateExerciseEditor key={plan.id} plan={plan} />
            ))}
          </View>
        )}

        <View style={styles.addExercise}>
          <Button
            label={t('templates.addExercise')}
            variant="ghost"
            onPress={() => setPickerVisible(true)}
          />
        </View>
      </ScrollView>

      <ExercisePicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onPick={onPickExercise}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  nameField: { marginBottom: 20 },
  sectionTitle: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 18,
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
  },
  exercises: { gap: 14 },
  addExercise: { marginTop: 16 },
});
