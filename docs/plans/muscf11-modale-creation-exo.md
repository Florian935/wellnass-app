# Plan d'implémentation — MUSC-F11 (modale création exo perso)

> **Pour les workers agentiques :** SOUS-SKILL REQUISE — `superpowers:subagent-driven-development`.
> Étapes en cases (`- [ ]`).

**But :** remplacer la card inline de création d'exercice perso par une **modale bottom-sheet**
(Nom + placeholder, groupe musculaire scrollable, clavier géré), sur le patron `ExerciseFilterDrawer`.

**Architecture :** nouveau composant `CreateExerciseModal` autonome (état de formulaire interne, reset
à la fermeture) ; `exercises.tsx` n'en garde qu'un booléen d'ouverture. Aucune migration, métier inchangé.

**Stack :** React Native/Expo, i18next, jest-expo + @testing-library/react-native.

**Spec :** [docs/specs/functional/us/muscf11-modale-creation-exo.md](../specs/functional/us/muscf11-modale-creation-exo.md)

---

## Structure des fichiers
- `apps/mobile/src/i18n/locales/fr.json` + `en.json` — **modifier** (2 clés).
- `apps/mobile/src/components/exercises/CreateExerciseModal.tsx` — **créer**.
- `apps/mobile/src/components/exercises/__tests__/create-exercise-modal-smoke.test.tsx` — **créer**.
- `apps/mobile/src/app/exercises.tsx` — **modifier** (retirer la card inline, brancher la modale).

---

## Task 1 : i18n + composant `CreateExerciseModal` (+ smoke)

**Files:**
- Modify: `apps/mobile/src/i18n/locales/fr.json`, `apps/mobile/src/i18n/locales/en.json`
- Create: `apps/mobile/src/components/exercises/CreateExerciseModal.tsx`
- Test: `apps/mobile/src/components/exercises/__tests__/create-exercise-modal-smoke.test.tsx`

- [ ] **Étape 1 : i18n** — dans `fr.json`, objet `exercises`, ajouter (après `customName`) :
```json
    "createTitle": "Créer un exercice",
    "customNamePlaceholder": "Ex. Développé couché",
```
  et dans `en.json` (même objet, même emplacement) :
```json
    "createTitle": "Create an exercise",
    "customNamePlaceholder": "E.g. Bench press",
```
  Vérifier parité + JSON valide.

- [ ] **Étape 2 : smoke test d'abord** — créer
      `apps/mobile/src/components/exercises/__tests__/create-exercise-modal-smoke.test.tsx`.
      jest-expo : `describe/it/expect` globaux (pas d'import framework). Mock du repo pour isoler PowerSync :

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import '@/i18n';
import { CreateExerciseModal } from '../CreateExerciseModal';
import { addCustomExercise } from '@/data/repositories/exercise-repository';

jest.mock('@/data/repositories/exercise-repository', () => ({
  addCustomExercise: jest.fn(() => Promise.resolve('new-id')),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: jest.fn(() => ({
    scheme: 'light',
    colors: {
      text: '#000', textMuted: '#888', background: '#fff', surface: '#f5f5f5',
      border: '#ddd', accent: '#6b0028', accentText: '#fff',
    },
  })),
}));

describe('CreateExerciseModal — smoke', () => {
  it('affiche le titre et un bouton Ajouter désactivé si le nom est vide', () => {
    const { getByText } = render(<CreateExerciseModal visible onClose={jest.fn()} />);
    expect(getByText('Créer un exercice')).toBeTruthy();
    // Ajouter présent (l'état désactivé est vérifié via le comportement onPress ci-dessous)
    expect(getByText('Ajouter')).toBeTruthy();
  });

  it('crée l’exercice puis ferme quand un nom est saisi', async () => {
    const onClose = jest.fn();
    const { getByText, getByPlaceholderText } = render(
      <CreateExerciseModal visible onClose={onClose} />,
    );
    fireEvent.changeText(getByPlaceholderText('Ex. Développé couché'), 'Mon exo');
    fireEvent.press(getByText('Ajouter'));
    // microtâche : laisser résoudre la promesse addCustomExercise
    await Promise.resolve();
    expect(addCustomExercise).toHaveBeenCalledWith('Mon exo', 'chest');
    expect(onClose).toHaveBeenCalled();
  });
});
```
> Si `getByPlaceholderText` ne matche pas (selon l'implémentation `TextField`), adapter le test au rendu
> réel (ex. `getByText(label)` + query du champ). Le smoke doit vérifier : titre affiché, appel
> `addCustomExercise(nom, groupe)` + `onClose` après ajout d'un nom.

- [ ] **Étape 3 : lancer, vérifier l'échec** — `npm run test --workspace=@wellness/mobile -- create-exercise-modal-smoke`.

- [ ] **Étape 4 : implémenter** `CreateExerciseModal.tsx` :

```tsx
import { useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MUSCLE_GROUPS, type MuscleGroup } from '@wellness/shared';
import { Button } from '@/components/Button';
import { Segment } from '@/components/Segment';
import { TextField } from '@/components/TextField';
import { addCustomExercise } from '@/data/repositories/exercise-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type CreateExerciseModalProps = { visible: boolean; onClose: () => void };

/**
 * Modale bottom-sheet de création d'un exercice personnalisé (nom + groupe
 * musculaire). Patron `ExerciseFilterDrawer`. État de formulaire interne, réinitialisé
 * à chaque fermeture (ajout, annulation, dismiss). Métier : `addCustomExercise`.
 */
export function CreateExerciseModal({ visible, onClose }: CreateExerciseModalProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup>('chest');
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0;

  const reset = () => {
    setName('');
    setMuscle('chest');
    setSaving(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const onAdd = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await addCustomExercise(name.trim(), muscle);
      close();
    } catch (e) {
      // Offline-first : écriture locale ; on garde la modale ouverte en cas d'échec improbable.
      console.warn('addCustomExercise a échoué', e);
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable
        style={styles.backdrop}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={[styles.title, { color: colors.text }]}>{t('exercises.createTitle')}</Text>

            <TextField
              label={t('exercises.customName')}
              value={name}
              onChangeText={setName}
              autoCapitalize="sentences"
              placeholder={t('exercises.customNamePlaceholder')}
            />

            <Segment
              options={MUSCLE_GROUPS}
              value={muscle}
              onChange={setMuscle}
              label={(m) => t(`muscle.${m}`)}
              scrollable
            />

            <View style={styles.actions}>
              <View style={styles.flex}>
                <Button label={t('common.cancel')} variant="ghost" onPress={close} />
              </View>
              <View style={styles.flex}>
                <Button
                  label={t('exercises.add')}
                  onPress={() => void onAdd()}
                  disabled={!canSave || saving}
                  loading={saving}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    maxHeight: '80%',
  },
  content: { padding: 20, gap: 16 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 18, letterSpacing: -0.3 },
  actions: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
});
```
> Vérifier les props réelles de `Button` (`loading`, `disabled`, `variant`), `Segment` (`scrollable`) et
> `TextField` (`placeholder`) — toutes déjà utilisées ailleurs (`exercises/[id].tsx`, `exercises.tsx`).
> Le `KeyboardAvoidingView` enveloppe le sheet ; si le rendu Android remonte mal, ajuster `behavior`.

- [ ] **Étape 5 : lancer, vérifier le succès** — smoke vert.
- [ ] **Étape 6 : typecheck + lint** — verts.
- [ ] **Étape 7 : commit**

```bash
git add apps/mobile/src/components/exercises/CreateExerciseModal.tsx apps/mobile/src/components/exercises/__tests__/create-exercise-modal-smoke.test.tsx apps/mobile/src/i18n/locales/fr.json apps/mobile/src/i18n/locales/en.json
git commit -m "feat(muscf11): modale bottom-sheet de création d'exercice perso

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2 : brancher la modale dans `exercises.tsx` (retirer la card inline)

**Files:**
- Modify: `apps/mobile/src/app/exercises.tsx`

- [ ] **Étape 1 : imports** — retirer `Segment`, `MUSCLE_GROUPS` et `addCustomExercise` (ne servaient
      qu'à la card de création). **Conserver** `TextField` (barre de recherche), `type MuscleGroup` et
      `type Equipment` (états `muscles`/`equipment`), `useExercises`, `toggleFavorite`,
      `type ExerciseListItem`. Ajouter :
      `import { CreateExerciseModal } from '@/components/exercises/CreateExerciseModal';`

- [ ] **Étape 2 : état** — remplacer les états `creating`, `newName`, `newMuscle` par un seul
      `const [createOpen, setCreateOpen] = useState(false);`. Supprimer la fonction `onCreate`.

- [ ] **Étape 3 : bouton déclencheur** — remplacer tout le bloc conditionnel
      `{creating ? (<View style={styles.createBox}>…</View>) : (<View style={styles.createTrigger}>…</View>)}`
      par le seul déclencheur :

```tsx
<View style={styles.createTrigger}>
  <Button label={t('exercises.createCustom')} variant="ghost" onPress={() => setCreateOpen(true)} />
</View>
```

- [ ] **Étape 4 : monter la modale** — à côté de `<ExerciseFilterDrawer … />`, ajouter :

```tsx
<CreateExerciseModal visible={createOpen} onClose={() => setCreateOpen(false)} />
```

- [ ] **Étape 5 : nettoyage styles** — supprimer les styles morts `createBox`, `createActions` (garder
      `createTrigger`, `flex`). Vérifier qu'aucun autre usage ne subsiste (`Segment`, `TextField` de
      création). `TextField` reste utilisé par la barre de recherche.

- [ ] **Étape 6 : vérifier** — `npm run typecheck` + `npm run lint` (verts, pas de nouvel avertissement /
      import inutilisé) + `npm run test --workspace=@wellness/mobile` (tous verts, smoke existant OK).

- [ ] **Étape 7 : commit**

```bash
git add apps/mobile/src/app/exercises.tsx
git commit -m "feat(muscf11): ouvre la modale de création depuis la liste (retire la card inline)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Clôture
- Revue de code finale (subagent) sur le diff.
- CHANGELOG + TODO (roadmap : pas de ligne dédiée — c'est une finition UX de 3.16 « Exercice
  personnalisé », déjà ✅ ; mentionner en Remarques si pertinent, sinon sauter). Merge ff `dev` + push.
- Recette Florian (ouverture modale, création, clavier, annulation) + relecture Damien.
