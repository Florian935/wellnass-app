---
id: FIX-JOURNAL-01
titre: "Édition/suppression découvrable d'une entrée de repas"
roadmap: []
catalogue: []
etape: close
branche: fix/journal-entree-swipe-edition
maj: 16/07/2026
---
# FIX — Édition/suppression découvrable d'une entrée de repas

_Spec fonctionnelle. Statut : en validation (brainstorming Florian, 16/07/2026). Branche :
`fix/journal-entree-swipe-edition` (depuis `dev`). Corrige le bug §🐞 « Modifier / supprimer un
aliment ajouté à un repas — geste peu découvrable + édition limitée à la quantité »._

## 1. Contexte & objectif

Remontée terrain (Florian, 16/07/2026) : « on ne peut pas modifier ni supprimer un aliment ajouté
sur un repas ». La **vérification code** confirme deux défauts sur l'écran
[nutrition.tsx](../../../apps/mobile/src/app/(tabs)/nutrition.tsx) :

1. **Découvrabilité nulle.** Sur une entrée de repas
   ([nutrition.tsx:612-628](../../../apps/mobile/src/app/(tabs)/nutrition.tsx#L612-L628)) :
   `onPress` → détail, `onLongPress` → suppression. **Aucun indice visuel** ne signale ces gestes
   (seul un `accessibilityHint` invisible) → l'utilisateur ne trouve ni la modification ni la
   suppression.
2. **Édition trop étroite.** Dans le détail
   ([nutrition.tsx:377-548](../../../apps/mobile/src/app/(tabs)/nutrition.tsx#L377-L548)) le bouton
   « Modifier » n'apparaît que si `canEdit = entry.quantityG != null && > 0`, et n'édite **que les
   grammes** (recalcul par règle de trois). Un **quick add** (kcal directs sans quantité,
   [food-picker.tsx:328-350](../../../apps/mobile/src/app/food-picker.tsx#L328-L350)) ou une **recette
   ajoutée sans quantité** ([food-picker.tsx:134](../../../apps/mobile/src/app/food-picker.tsx#L134))
   n'ont **aucun** bouton Modifier → impossibles à corriger.

Objectif : rendre **Modifier** et **Supprimer** immédiatement accessibles depuis une entrée, et
**débloquer l'édition des entrées sans quantité** (quick add). La suppression (`removeEntry`) et
l'édition de quantité (`updateEntry` + `rescaleEntryNutrition`) **existent déjà** ; le périmètre est
une **couche d'interaction** + un **élargissement du mode édition**.

## 2. Périmètre

- **Inclus** :
  - **Swipe** vers la gauche sur une entrée de repas → actions **Modifier** + **Supprimer**. Utiliser
    **`ReanimatedSwipeable`** (`react-native-gesture-handler/ReanimatedSwipeable`) : RNGH 2.32 +
    reanimated 4.5 sont présents et `GestureHandlerRootView` est déjà posé à la racine
    ([\_layout.tsx](../../../apps/mobile/src/app/_layout.tsx)), mais le `Swipeable` legacy est
    **déprécié** en 2.32. ⚠️ **Aucun `Swipeable` n'est encore utilisé dans le repo** (le dashboard
    `SortableDashboard` utilise `Gesture`/`GestureDetector` Pan, pas `Swipeable`) → **pattern nouveau,
    à valider en recette device**. Le **tap est conservé** (ouvre le détail en consultation). L'**appui
    long est retiré** (remplacé par le swipe).
  - **Édition élargie** dans le détail : toute entrée devient éditable (fin du gating `canEdit`).
    - Entrée **avec quantité** (`quantityG != null`) : champ Grammes + recalcul par règle de trois
      (`rescaleEntryNutrition`) — **comportement inchangé**.
    - Entrée **sans quantité** (`quantityG == null`, quick add / recette sans quantité) : champs
      **kcal + P/G/L + nom** éditables directement (miroir du `QuickAddPanel`), **sans** règle de trois.
  - Assouplissement de `updateEntry`
    ([journal-repository.ts:171](../../../apps/mobile/src/data/repositories/journal-repository.ts#L171)) :
    `quantityG: number | null` + `name?: string`.
  - Clés i18n FR/EN.
- **Exclu (YAGNI)** :
  - **Changer l'aliment référencé** d'une entrée (repiocher dans le picker) → recouvert par
    « supprimer + rajouter » (décision Florian, 16/07/2026).
  - **Corriger les macros d'une entrée référencée** (foodId + quantité) : on n'édite que sa quantité
    (les valeurs viennent de l'aliment). Seules les entrées **sans quantité** ont des macros éditables.
  - Édition des **micronutriments** d'un quick add (les quick add n'en portent pas ; le détail
    continue d'afficher les micros en lecture pour les entrées qui en ont).
  - Auto-scroll / animation d'ouverture avancée du swipe.
- **Maquette** : **écartée** (UI mineure sur écran existant : swipe standard + champs déjà dessinés
  dans `QuantityPanel`/`QuickAddPanel`). Précédent repo : maquette écartée pour 1.15, 4.7/4.18.

## 3. Règles métier / comportement

### 3.1 Swipe sur une entrée
- Balayage **vers la gauche** révèle deux actions à droite de la ligne : **Modifier** (accent) et
  **Supprimer** (danger).
- **Modifier** → ouvre le détail **directement en mode édition** (`editing = true`).
- **Supprimer** → **confirmation `Alert`** (titre = nom de l'entrée, `journal.deleteConfirm`) →
  `removeEntry(entry.id)`. Cohérent avec la confirmation déjà en place.
- **Tap** (hors swipe) → ouvre le détail en **consultation** (comportement actuel préservé).
- **Appui long retiré** : plus de suppression par `onLongPress` (le swipe le remplace, plus
  découvrable). `accessibilityHint` mis à jour en conséquence.
- Au repos, aucune action visible (comportement standard d'une liste swipeable).

### 3.2 Édition selon le type d'entrée
Le mode édition du détail se **branche sur `entry.quantityG`** :

| Type d'entrée | `quantityG` | Champs éditables | Recalcul |
|---|---|---|---|
| Aliment référencé / recette avec quantité | `> 0` | **Grammes** | règle de trois (`rescaleEntryNutrition`), inchangé |
| Quick add / recette sans quantité | `null` | **kcal, protéines, glucides, lipides, nom** | aucun (valeurs saisies directes) |

- **Entrée avec quantité** : identique à l'existant (champ Grammes, aperçu live, `updateEntry` avec le
  snapshot recalculé).
- **Entrée sans quantité** : formulaire kcal/P/G/L (`decimal-pad`, valeurs pré-remplies depuis l'entrée)
  + champ **Nom** (pré-rempli). Enregistrer → `updateEntry(id, { quantityG: null, name, kcal, proteinG,
  carbsG, fatG })`. Bouton **désactivé si `kcal <= 0`** (miroir du `QuickAddPanel`).
- Dans les **deux** cas, le bouton « Modifier » est **toujours proposé** en consultation (fin du
  masquage conditionnel).

### 3.3 Repository
- `updateEntry` : `quantityG` passe à `number | null` (le quick add écrit `null`) ; ajout de
  `name?: string` (patch `name` seulement s'il est fourni, pour ne pas écraser le nom d'une entrée
  référencée que l'on n'édite pas). **Un seul appelant existe aujourd'hui**
  ([nutrition.tsx:421](../../../apps/mobile/src/app/(tabs)/nutrition.tsx#L421)) → assouplir la signature
  est **sans risque de régression**.
- ⚠️ **`micronutrients` doit devenir conditionnel** : l'implémentation actuelle écrit **toujours**
  `micronutrients: JSON.stringify(values.micronutrients ?? {})`
  ([journal-repository.ts:188](../../../apps/mobile/src/data/repositories/journal-repository.ts#L188)) →
  éditer une entrée sans fournir de micros réécrirait `{}` (efface les micros existants). Le patch des
  micros ne doit s'appliquer que si `micronutrients` est fourni (comme `name`). Inoffensif pour les
  quick add (pas de micros), mais nécessaire pour que la promesse « micros non touchés » tienne.

## 4. i18n (FR + EN, parité)

Réutiliser l'existant **vérifié** : `journal.delete`, `journal.deleteConfirm`, `journal.grams`,
`journal.name` (= « Nom » / « Name », déjà utilisée par le `QuickAddPanel`,
[food-picker.tsx:341](../../../apps/mobile/src/app/food-picker.tsx#L341)), `nutrition.macros.protein|
carbs|fat`, `nutrition.kcal`, `common.cancel`.

**Pièges à éviter (relevés en relecture) :**
- ⚠️ **Ne pas réutiliser `journal.detail.edit`** pour l'action de swipe ni pour le bouton d'un quick
  add : sa valeur réelle est « **Modifier la quantité** » / « Edit quantity » — **faux** pour une
  entrée sans quantité. Créer une clé **générique** `journal.swipeEdit` (« Modifier » / « Edit »)
  utilisée par l'action swipe **et** le bouton « Modifier » du détail. `journal.detail.edit` peut
  rester pour le seul cas « entrée avec quantité » si on veut garder le libellé précis, sinon la
  généraliser.
- ⚠️ **Clé « Nom »** = `journal.name` (existe). **Ne pas** référencer `journal.detail.name` (inexistante).
- ⚠️ **`journal.longPressDelete`** ([fr/en](../../../apps/mobile/src/i18n/locales/fr.json)) n'est
  utilisée que par l'`accessibilityHint` de l'entrée ([nutrition.tsx:618](../../../apps/mobile/src/app/(tabs)/nutrition.tsx#L618)).
  En retirant l'appui long, elle devient **orpheline** → la **réutiliser** pour le hint du swipe
  (ex. « Balayer pour modifier ou supprimer ») **ou la supprimer** en FR **et** EN (règle « 0 clé
  orpheline »).
- **Libellé calories du quick add en édition** : le `QuickAddPanel` de création affiche « Besoin
  calorique (kcal) », inadapté à une entrée déjà journalisée → préférer un libellé propre type
  « Calories (kcal) » (`nutrition.kcal` + intitulé court), à définir en FR/EN.
- Nouvelle clé possible `journal.swipeDelete` si le libellé de suppression du swipe diffère de
  `journal.delete`.

Parité FR/EN vérifiée (le projet impose 0 clé orpheline ; le compteur de parité doit rester équilibré).

## 5. Cas limites

- **Entrée sans quantité et sans macros** (quick add kcal seul) → formulaire kcal + P/G/L à 0 :
  éditables, enregistrement autorisé dès `kcal > 0`.
- **kcal ramené à 0** en édition quick add → bouton Enregistrer désactivé (pas d'entrée à 0 kcal).
- **Grammes ramenés à 0** (entrée avec quantité) → bouton désactivé (comportement actuel préservé).
- **Swipe puis tap ailleurs** → la ligne swipée se referme (comportement standard `ReanimatedSwipeable`).
- ⚠️ **Clipping de la carte de repas** : les entrées vivent dans `styles.mealCard`
  ([nutrition.tsx:~710](../../../apps/mobile/src/app/(tabs)/nutrition.tsx)) qui porte `overflow: 'hidden'`.
  Vérifier **en recette device** que les actions révélées à droite du swipe **ne sont pas rognées**
  (adapter le conteneur si besoin — les actions occupent la largeur libérée, mais le clipping est un
  risque à confirmer).
- **Entrée « recette sans quantité »** : traitée comme un quick add en édition (kcal/P/G/L/nom directs).
  Conséquence **assumée** : le snapshot se désolidarise de la recette source (les snapshots du journal
  sont figés par nature — pas un bug). À refléter dans le wording si besoin.
- **Réordonnancement** (chevrons up/down du détail) → inchangé, indépendant du swipe.
- **Offline** : `updateEntry`/`removeEntry` écrivent en local PowerSync → appliqués hors-ligne,
  synchronisés ensuite. Aucune dépendance réseau ajoutée.
- **Totaux du jour / barres macros / micros suivis** → se recalculent via `useQuery` réactif (aucune
  action supplémentaire).

## 6. Tests

- **Shared (Vitest)** : `rescaleEntryNutrition` déjà testé (inchangé). Si une petite fonction pure est
  extraite (ex. « champs éditables selon le type d'entrée »), la couvrir ; sinon la logique reste UI.
- **Mobile** : `typecheck` + `lint` verts. Le gros du changement est UI (swipe + formulaire
  conditionnel) → vérifié à la **recette device**.
- Non-régression : édition de quantité d'une entrée référencée **inchangée** (chemin actuel préservé).

## 7. Definition of Done

- Swipe gauche sur une entrée → **Modifier** (ouvre le détail en édition) + **Supprimer** (confirmation
  → soft delete). Tap → détail. Appui long retiré.
- Toute entrée éditable : quantité (règle de trois, inchangé) **ou** kcal/P/G/L/nom (quick add), selon
  `quantityG`.
- `updateEntry` assoupli (`quantityG: number | null`, `name?`).
- i18n FR/EN (parité) ; typecheck/lint verts ; **100 % client, aucune migration, pas de checkpoint 🔴**.
- Bug §🐞 « modifier / supprimer un aliment ajouté à un repas » → **corrigé**.
- Reste : **recette device** (swipe → modifier/supprimer ; éditer un quick add : kcal/macros/nom ;
  éditer une entrée référencée : quantité inchangée) + relecture Damien.
