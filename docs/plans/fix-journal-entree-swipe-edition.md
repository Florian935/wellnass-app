# Fix — Édition/suppression découvrable d'une entrée de repas — Plan d'implémentation

> **Pour l'exécutant :** implémenter tâche par tâche. Étapes cochables (`- [ ]`). Suivre le workflow
> du dépôt (TDD côté logique pure quand elle existe ; typecheck/lint/tests verts ; recette device pour
> l'UI). Commits conventionnels en français via `/commit`.

**Objectif :** rendre *Modifier* et *Supprimer* découvrables sur une entrée de repas (swipe) et
débloquer l'édition des entrées sans quantité (quick add).

**Architecture :** 100 % client. Une couche d'interaction (`ReanimatedSwipeable`) + un mode d'édition
qui se branche sur `entry.quantityG` dans le détail existant. `updateEntry` assoupli. Aucune migration.

**Tech Stack :** React Native / Expo, react-native-gesture-handler 2.32 (`ReanimatedSwipeable`),
reanimated 4.5, i18next FR/EN, PowerSync (SQLite local).

**Spec :** [docs/specs/functional/us/fix-journal-entree-swipe-edition.md](../specs/functional/us/fix-journal-entree-swipe-edition.md)

**Fichiers touchés :**
- Modifier : [apps/mobile/src/data/repositories/journal-repository.ts](../../apps/mobile/src/data/repositories/journal-repository.ts) (`updateEntry`)
- Modifier : [apps/mobile/src/app/(tabs)/nutrition.tsx](../../apps/mobile/src/app/(tabs)/nutrition.tsx) (swipe `MealSection` + édition `EntryDetailContent` + état parent)
- Modifier : [apps/mobile/src/i18n/locales/fr.json](../../apps/mobile/src/i18n/locales/fr.json) + [en.json](../../apps/mobile/src/i18n/locales/en.json)

---

## Task 1 : Assouplir `updateEntry` (quantité nullable + nom + micros conditionnels)

**Files :**
- Modify : `apps/mobile/src/data/repositories/journal-repository.ts:171-190`

- [ ] **Step 1 : Réécrire `updateEntry`**

Remplacer le bloc actuel par une version qui accepte `quantityG: number | null`, un `name?` optionnel,
et ne patche `name`/`micronutrients` **que s'ils sont fournis** (sinon le patch écraserait les micros
existants — `patch()` ne pose que les colonnes présentes dans l'objet) :

```ts
/**
 * Met à jour une entrée existante. Deux usages :
 *  - entrée avec quantité : quantité + snapshot recalculé (règle de trois côté appelant) ;
 *  - quick add (sans quantité) : kcal/macros/nom saisis directement (quantityG = null).
 * `name`/`micronutrients` ne sont écrits que s'ils sont fournis (sinon inchangés).
 */
export async function updateEntry(
  entryId: string,
  values: {
    quantityG: number | null;
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    name?: string;
    micronutrients?: Micronutrients;
  },
): Promise<void> {
  const patchValues: Record<string, unknown> = {
    quantity_g: values.quantityG,
    kcal: values.kcal,
    protein_g: values.proteinG,
    carbs_g: values.carbsG,
    fat_g: values.fatG,
  };
  if (values.name !== undefined) patchValues.name = values.name;
  if (values.micronutrients !== undefined) {
    patchValues.micronutrients = JSON.stringify(values.micronutrients);
  }
  await patch('food_entries', entryId, patchValues);
}
```

- [ ] **Step 2 : Vérifier le typecheck**

Run : `npm run typecheck`
Expected : PASS (l'unique appelant actuel — `nutrition.tsx:421` — passe `quantityG: number` + `micronutrients`, compatible avec la nouvelle signature).

- [ ] **Step 3 : Commit**

```bash
git add apps/mobile/src/data/repositories/journal-repository.ts
git commit -m "refactor(journal): updateEntry accepte quantité nulle + nom (quick add)"
```

---

## Task 2 : Clés i18n (FR + EN, parité)

**Files :**
- Modify : `apps/mobile/src/i18n/locales/fr.json` (objet `journal`)
- Modify : `apps/mobile/src/i18n/locales/en.json` (objet `journal`)

- [ ] **Step 1 : FR — ajouter/ajuster les clés `journal.*`**

- Ajouter `journal.swipeEdit` = `"Modifier"` (libellé générique : action swipe **et** bouton « Modifier » d'un quick add).
- **Remplacer** `journal.longPressDelete` (`"Appui long pour supprimer"`) par `journal.swipeHint` = `"Balayer pour modifier ou supprimer"` (l'appui long disparaît ; éviter la clé orpheline).
- Ajouter `journal.detail.calories` = `"Calories (kcal)"` (label du champ kcal en édition quick add).

- [ ] **Step 2 : EN — miroir**

- `journal.swipeEdit` = `"Edit"`
- `journal.swipeHint` = `"Swipe to edit or delete"` (remplace `longPressDelete`)
- `journal.detail.calories` = `"Calories (kcal)"`

> Réutiliser sans créer : `journal.delete`, `journal.deleteConfirm`, `journal.grams`, `journal.name`,
> `journal.detail.edit` (« Modifier la quantité » — réservé au cas **avec quantité**),
> `journal.detail.save`, `nutrition.kcal`, `nutrition.macros.{protein,carbs,fat}`, `common.cancel`.

- [ ] **Step 3 : Vérifier la parité FR/EN (manuellement)**

⚠️ **Aucun test de parité i18n automatisé n'existe dans le repo** — la vérification est **manuelle** :
diff des objets `journal` FR/EN (mêmes clés des deux côtés, aucune clé orpheline). Vérifier aussi
qu'aucune référence à `journal.longPressDelete` ne subsiste dans le code (grep) après Task 3.

- [ ] **Step 4 : Commit**

```bash
git add apps/mobile/src/i18n/locales/fr.json apps/mobile/src/i18n/locales/en.json
git commit -m "i18n(journal): clés swipe (modifier/hint) + label calories, retrait longPressDelete"
```

---

## Task 3 : Swipe sur l'entrée (MealSection) + ouverture du détail en édition

**Files :**
- Modify : `apps/mobile/src/app/(tabs)/nutrition.tsx` (imports ; `MealSection` ~556-628 ; état parent + rendu `MealSection`/`EntryDetailModal` ~155-296)

- [ ] **Step 1 : Importer `ReanimatedSwipeable`**

En tête de fichier :

```ts
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
```

> ⚠️ Ne PAS importer le `Swipeable` legacy de `'react-native-gesture-handler'` (déprécié en 2.32).
> `GestureHandlerRootView` est déjà posé à la racine (`_layout.tsx`).

- [ ] **Step 2 : État parent — ouvrir le détail en mode édition**

Dans le composant d'écran, ajouter un état à côté de `detailEntry` (existant) :

```ts
const [detailEditing, setDetailEditing] = useState(false);
```

Ajouter un handler qui ouvre le détail directement en édition :

```ts
const onEditEntry = (entry: JournalEntry) => {
  setDetailEntry(entry);
  setDetailEditing(true);
};
const onSelectEntry = (entry: JournalEntry) => {
  setDetailEntry(entry);
  setDetailEditing(false);
};
```

Dans le JSX `<MealSection>` (`nutrition.tsx:~281-282`), **remplacer** `onSelectEntry={setDetailEntry}`
par `onSelectEntry={onSelectEntry}` et ajouter `onEditEntry={onEditEntry}`. Propager
`startEditing={detailEditing}` à `<EntryDetailModal ... />` (~294, voir Task 4). À la fermeture du
détail (`onClose`, ~296), réinitialiser `setDetailEditing(false)` **en plus de** `setDetailEntry(null)`.

- [ ] **Step 3 : `MealSection` — envelopper l'entrée dans un swipe, retirer l'appui long**

Ajouter la prop `onEditEntry: (e: JournalEntry) => void` à la signature de `MealSection`.
Remplacer le `Pressable` de l'entrée (`nutrition.tsx:612-628`) par une entrée swipeable. Le `renderRightActions`
expose **Modifier** (accent) + **Supprimer** (danger) ; le tap ouvre la consultation ; **plus d'`onLongPress`** :

```tsx
{entries.map((e) => (
  <ReanimatedSwipeable
    key={e.id}
    friction={2}
    rightThreshold={40}
    renderRightActions={() => (
      <View style={styles.swipeActions}>
        <Pressable
          onPress={() => onEditEntry(e)}
          style={[styles.swipeAction, { backgroundColor: colors.accent }]}
          accessibilityRole="button"
          accessibilityLabel={t('journal.swipeEdit')}
        >
          <Ionicons name="create-outline" size={20} color="#fff" />
          <Text style={styles.swipeActionLabel}>{t('journal.swipeEdit')}</Text>
        </Pressable>
        <Pressable
          onPress={() => onDeleteEntry(e)}
          style={[styles.swipeAction, { backgroundColor: colors.danger }]}
          accessibilityRole="button"
          accessibilityLabel={t('journal.delete')}
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.swipeActionLabel}>{t('journal.delete')}</Text>
        </Pressable>
      </View>
    )}
  >
    <Pressable
      onPress={() => onSelectEntry(e)}
      style={[styles.entry, { backgroundColor: colors.surface }]}
      accessibilityHint={t('journal.swipeHint')}
    >
      <View style={styles.entryMain}>
        <Text style={[styles.entryName, { color: colors.text }]} numberOfLines={1}>{e.name}</Text>
        {e.quantityG != null ? (
          <Text style={[styles.entryQty, { color: colors.textMuted }]}>{e.quantityG} g</Text>
        ) : null}
      </View>
      <Text style={[styles.entryKcal, { color: colors.textMuted }]}>{e.kcal} {t('nutrition.kcal')}</Text>
    </Pressable>
  </ReanimatedSwipeable>
))}
```

> Le `Pressable` interne reçoit `backgroundColor: colors.surface` (opaque) : sinon on verrait les
> actions par transparence au repos, la carte `mealCard` étant clippée (`overflow: 'hidden'`).

- [ ] **Step 4 : Styles du swipe**

Dans `StyleSheet.create`, ajouter :

```ts
swipeActions: { flexDirection: 'row', alignItems: 'stretch' },
swipeAction: { justifyContent: 'center', alignItems: 'center', gap: 2, width: 76 },
swipeActionLabel: { fontFamily: fontFamily.bodySemi, fontSize: 11, color: '#fff' },
```

- [ ] **Step 5 : Retirer la clé orpheline / vérifier**

Vérifier qu'aucune occurrence de `journal.longPressDelete` ne subsiste dans le code.

Run : `npm run typecheck && npm run lint`
Expected : PASS.

- [ ] **Step 6 : Commit**

```bash
git add apps/mobile/src/app/(tabs)/nutrition.tsx
git commit -m "feat(journal): swipe modifier/supprimer sur une entrée de repas (tap conservé, appui long retiré)"
```

---

## Task 4 : Édition élargie dans le détail (quantité OU quick add)

**Files :**
- Modify : `apps/mobile/src/app/(tabs)/nutrition.tsx` (`EntryDetailModal` ~353-375 ; `EntryDetailContent` ~377-554)

- [ ] **Step 1 : Propager `startEditing` jusqu'à `EntryDetailContent`**

Ajouter `startEditing?: boolean` aux props de `EntryDetailModal` et de `EntryDetailContent`, et
initialiser l'état d'édition avec :

```ts
const [editing, setEditing] = useState(startEditing ?? false);
```

- [ ] **Step 2 : Remplacer le gating `canEdit` par une distinction de type**

```ts
// Une entrée référencée porte une quantité → édition par les grammes.
// Un quick add / une recette sans quantité → édition directe des valeurs.
const hasQuantity = entry.quantityG != null && entry.quantityG > 0;
```

⚠️ **Supprimer la déclaration `canEdit` (ligne ~393)** : elle est remplacée par `hasQuantity` partout
(preview ~402, onSave ~418, bouton ~544). La laisser en place déclenche une erreur `expo lint`
(variable inutilisée).

- [ ] **Step 3 : États du formulaire quick add**

À côté de `grams`, ajouter les champs pour le mode sans quantité :

```ts
const [name, setName] = useState(entry.name);
const [kcal, setKcal] = useState(String(entry.kcal));
const [protein, setProtein] = useState(String(entry.proteinG));
const [carbs, setCarbs] = useState(String(entry.carbsG));
const [fat, setFat] = useState(String(entry.fatG));
const num = (s: string) => Math.max(0, Math.round(Number(s.replace(',', '.')) || 0));
```

- [ ] **Step 4 : Aperçu + validité selon le type**

Le `preview` reste `rescaleEntryNutrition(...)` uniquement pour le cas quantité :

```ts
const preview = editing && hasQuantity ? rescaleEntryNutrition(entry, oldQty, g) : entry;
const canSave = hasQuantity ? g > 0 : num(kcal) > 0;
```

- [ ] **Step 5 : `onSave` — brancher les deux chemins**

```ts
const onSave = async () => {
  setSaving(true);
  if (hasQuantity) {
    const n = rescaleEntryNutrition(entry, oldQty, g);
    await updateEntry(entry.id, {
      quantityG: g, kcal: n.kcal, proteinG: n.proteinG, carbsG: n.carbsG, fatG: n.fatG,
      micronutrients: n.micronutrients,
    });
  } else {
    await updateEntry(entry.id, {
      quantityG: null,
      name: name.trim() || entry.name,
      kcal: num(kcal), proteinG: num(protein), carbsG: num(carbs), fatG: num(fat),
      // pas de micronutrients → micros existants inchangés (updateEntry conditionnel, Task 1)
    });
  }
  onClose();
};
```

- [ ] **Step 6 : Rendu des champs en mode édition**

Dans le bloc `{editing ? (...)}`, remplacer le seul champ Grammes par un rendu conditionnel :

```tsx
{editing ? (
  hasQuantity ? (
    <TextField label={t('journal.grams')} value={grams} onChangeText={setGrams} keyboardType="decimal-pad" autoFocus />
  ) : (
    <>
      <TextField label={t('journal.name')} value={name} onChangeText={setName} autoFocus />
      <TextField label={t('journal.detail.calories')} value={kcal} onChangeText={setKcal} keyboardType="decimal-pad" />
      <TextField label={t('nutrition.macros.protein')} value={protein} onChangeText={setProtein} keyboardType="decimal-pad" />
      <TextField label={t('nutrition.macros.carbs')} value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" />
      <TextField label={t('nutrition.macros.fat')} value={fat} onChangeText={setFat} keyboardType="decimal-pad" />
    </>
  )
) : null}
```

⚠️ **Masquer le bloc « macros de la quantité »** (aperçu `preview`, ~503-517) **en édition sans
quantité** : rendre son affichage conditionnel à `!editing || hasQuantity`. En quick add `preview =
entry` (valeurs **périmées**) → l'afficher à côté des champs éditables induirait en erreur. Les champs
kcal/P/G/L ci-dessus font foi.

> Cohérence des libellés : `journal.detail.calories` porte l'unité (« Calories (kcal) ») alors que
> `nutrition.macros.{protein,carbs,fat}` = « Protéines / Glucides / Lipides » (sans « (g) »). Pour
> homogénéiser le formulaire, concaténer « (g) » aux labels macros (ex. `` `${t('nutrition.macros.protein')} (g)` ``).

- [ ] **Step 7 : Bouton « Modifier » toujours visible + libellé adapté**

Remplacer la condition `{canEdit ? <Button .../> : null}` (`nutrition.tsx:544-546`) par un bouton
**toujours** rendu, dont le libellé dépend du type :

```tsx
<Button
  label={hasQuantity ? t('journal.detail.edit') : t('journal.swipeEdit')}
  onPress={() => setEditing(true)}
/>
```

Adapter le bloc actions en mode édition (`disabled={g <= 0}` → `disabled={!canSave}`).

- [ ] **Step 8 : Vérifs**

Run : `npm run typecheck && npm run lint && npm run test`
Expected : PASS. Non-régression : l'édition d'une entrée **avec quantité** est inchangée (mêmes champ,
recalcul, `updateEntry` avec `micronutrients`).

- [ ] **Step 9 : Commit**

```bash
git add apps/mobile/src/app/(tabs)/nutrition.tsx
git commit -m "feat(journal): éditer un quick add (kcal/macros/nom) depuis le détail d'entrée"
```

---

## Task 5 : Vérification finale & recette

- [ ] **Step 1 : Suite complète verte**

Run : `npm run typecheck && npm run lint && npm run test`
Expected : PASS sur tous les workspaces ; parité i18n FR/EN équilibrée ; 0 clé orpheline.

- [ ] **Step 2 : Mise à jour du suivi & commit final via `/commit`**

Cocher le bug §🐞 dans [TODO.md](../../TODO.md), tenir le [CHANGELOG.md](../../CHANGELOG.md), pousser sur `dev`.

- [ ] **Step 3 : Recette device (Florian)** — points à valider :
  - Swipe gauche sur une entrée → **Modifier** ouvre le détail en édition ; **Supprimer** → confirmation → l'entrée disparaît.
  - **Tap** sur l'entrée → détail en consultation. **Appui long → plus rien** (retiré).
  - Éditer un **quick add** : kcal + P/G/L + **nom** modifiables ; enregistrer → totaux du jour à jour.
  - Éditer une **entrée référencée** : champ **quantité** inchangé (recalcul par règle de trois), micros conservés.
  - ⚠️ **Actions de swipe non rognées** malgré `overflow:'hidden'` de la carte de repas.
  - i18n FR/EN sur toutes les nouvelles surfaces.

---

## Notes

- **Aucune migration, aucun checkpoint 🔴** (100 % client, écritures locales PowerSync).
- **Risque principal** : `ReanimatedSwipeable` est un **pattern nouveau dans ce repo** → valider le
  rendu/clipping en recette device (Task 5, Step 3).
- **Hors périmètre** (rappel spec) : changer l'aliment référencé d'une entrée ; corriger les macros
  d'une entrée référencée (seule sa quantité est éditable).
