import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { TemplateComposer } from '@/components/templates/TemplateComposer';
import { createWorkoutTemplate } from '@/data/repositories/workout-template-repository';

/**
 * Écran de création / édition d'un template de séance libre (US Refonte-D §2).
 * Patron de `programs/edit.tsx` (formulaire nom seul puis composition), en plus
 * simple (pas de niveau/objectif/durée) :
 *  - Sans `?id=` : formulaire nom seul, `createWorkoutTemplate` puis bascule en
 *    édition du template créé (navigation vers soi-même avec l'`id`).
 *  - Avec `?id=` : composition (`TemplateComposer`) + bouton « Terminé » fixé en
 *    pied d'écran (`SafeAreaView` séparée), contrairement à `programs/edit.tsx`
 *    qui place ses boutons dans le `ScrollView` — choix délibéré ici pour garder
 *    « Terminé » toujours visible pendant l'ajout d'exercices.
 */
export default function TemplateEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const templateId = typeof params.id === 'string' ? params.id : '';

  if (templateId) {
    return <TemplateEditComposer templateId={templateId} />;
  }
  return (
    <TemplateCreateForm onCreated={(id) => router.replace(`/templates/edit?id=${id}`)} />
  );
}

// ---------------------------------------------------------------------------
// Étape 1 — création (nom)
// ---------------------------------------------------------------------------

function TemplateCreateForm({ onCreated }: { onCreated: (id: string) => void }) {
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canCreate = name.trim().length > 0 && !submitting;

  const onSubmit = async () => {
    if (!canCreate) return;
    setSubmitting(true);
    try {
      const id = await createWorkoutTemplate(name.trim());
      onCreated(id);
    } catch {
      // Écriture locale (offline-first) : un échec est très improbable. On
      // réactive le bouton pour permettre une nouvelle tentative.
      setSubmitting(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={t('templates.createTitle')}
        subtitle={t('templates.createSubtitle')}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          <TextField
            label={t('templates.name')}
            value={name}
            onChangeText={setName}
            autoCapitalize="sentences"
            placeholder={t('templates.namePlaceholder')}
          />

          <Button
            label={t('templates.create')}
            onPress={() => void onSubmit()}
            loading={submitting}
            disabled={!canCreate}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Étape 2 — composition
// ---------------------------------------------------------------------------

function TemplateEditComposer({ templateId }: { templateId: string }) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View style={styles.flex}>
      <TemplateComposer templateId={templateId} />
      <SafeAreaView edges={['bottom']} style={styles.done}>
        <Button label={t('templates.done')} onPress={() => router.back()} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  form: { gap: 16 },
  flex: { flex: 1 },
  done: { paddingHorizontal: 20, paddingTop: 12 },
});
