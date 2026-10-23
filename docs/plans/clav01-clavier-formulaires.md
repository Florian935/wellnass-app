# Plan — CLAV-01 · Le clavier ne recouvre plus aucun formulaire

Spec : [clav01-clavier-formulaires.md](../specs/functional/us/clav01-clavier-formulaires.md) · 22/10/2026 ·
branche `fix/clav01-clavier-formulaires` (worktree `.expo/claude-worktrees/clav-01`, créé depuis
`origin/dev` à `3a3cda89` ; jonctions `node_modules/@wellness/shared` → `packages/shared` du worktree,
`apps/admin/node_modules` et `apps/mobile/node_modules` → ceux du dépôt principal ; poussé par
`git push origin HEAD:dev` après vérification de l'avance rapide).

✅ **Validé par Florian le 23/10/2026** avec la spec (D1 à D12 telles que proposées, retours à la
recette). Écrit sur les propositions de la spec :
**D1-B** (conteneur maison), **D2** (le même conteneur, `kind="sheet"`, dans chaque `Modal`), **D3**
(défilement natif d'Android), **D4** (pas de nouveau pied collant ; les pieds fixes remontent), **D4b**
(le pied à trois boutons remonte), **D5** (même conteneur sur iOS), **D6** (pas de bibliothèque ; repli
écrit), **D7** (la séance passe sur le conteneur), **D8** (`keyboardShouldPersistTaps="handled"`
imposé), **D9** (les listes s'arrêtent au-dessus du clavier), **D10** (filet puis garde à cliquet),
**D11** (un lot), **D12** (TalkBack et 3 boutons sur une surface par famille).
Une autre réponse : **D7 non** supprime l'étape 7 et fait accepter `useKeyboardHeight` au garde ;
**D11 point d'étape** coupe le lot après l'étape 3 + B3 + D8 (recette des critères 1, 3, 7, puis le
reste) ; **D4b masqué** ajoute à l'étape 4 un « masquer pendant la frappe » pour le pied de
`templates/[id]` ; **D1-C / D6 maintenant** remplace l'étape 2 par la section « Repli » ci-dessous. Le
reste tient.

**Aucune migration, aucune sync rule, aucun `db:types`, aucune dépendance, aucun déploiement, aucun
build** (spec §12). Aucune action sur le cloud. Rien dans `C:\noryn`.

## Ordre de build

Un lot, neuf étapes, **un commit par étape** : chacune laisse `npm run typecheck`, `npm run lint` et
`npm run test` verts (code de sortie lu **sans pipe**). Le filet d'abord, vert sur le code d'aujourd'hui ;
la brique ensuite (aucun écran ne bouge) ; puis une famille par étape, où **seuls** les tests étiquetés
K du §11.1 de la spec changent d'attendu, et où la liste « à migrer » du garde se vide de sa part.

| # | Étape | Fichiers | Tests |
|---|---|---|---|
| 0 | **Relecture** de la spec et du plan — faite le 22/10/2026 | spec §15 | — |
| 1 | **Le filet** et le garde à cliquet | tests seulement | K2 à K6, garde (G1-G3 + liste « à migrer ») |
| 2 | **La brique** : module `components/keyboard/` | 6 fichiers neufs | formule, conteneur, mesure, défilement, imbrication |
| 3 | **`FormScreen`** (A1-A9) | 1 | K2 change ; garde −9 surfaces |
| 4 | **Écrans défilants** (B1-B18) | 19 | K6 en partie ; garde −18 |
| 5 | **Listes et panneaux** (C1-C4) | 4 | K6 en partie ; garde −5 |
| 6 | **Feuilles** (D1-D11) | 11 | K3 change ; K6 vide ; garde −11 |
| 7 | **Séance** (E1-E2) — D7 | 5 | K4, K5 : +1 inset ouvert, inchangés fermé |
| 8 | **Garde strict, recette, docs** | docs | liste « à migrer » vide (assertion) |

## Étape 1 — le filet

Tests de **caractérisation**, verts sur le code de `3a3cda89`, écrits avant toute modification. Chacun
porte son étiquette en tête (`K2 — …`) et la phrase « change à l'étape N » : quand son attendu bouge,
le commit de l'étape le dit.

**Comment lire des props sous RNTL v14** (arbre hôte seulement, pas d'`UNSAFE_getByType` —
`planning-screen.test.tsx:72-74`) : un `jest.mock` **local** du module
`react-native/Libraries/Components/Keyboard/KeyboardAvoidingView` qui rend une `View` hôte portant
`testID="kav"` et ses props (`behavior`) ; pour la séance, un mock local de `SafeAreaView` (le mock
global de `jest.setup.ts:165-168` étendu dans le fichier) qui expose `edges`. Ainsi l'étape 1 ne touche
**aucune** source.

- **K2** — `src/components/__tests__/FormScreen.keyboard.test.tsx` : sous `Platform.OS = 'android'`, un
  `KeyboardAvoidingView` de `behavior` `'height'` ; sous `'ios'`, `'padding'` ; `edges` haut + bas par
  défaut ; un `ScrollView` en `keyboardShouldPersistTaps="handled"`, `contentContainerStyle` padding 24 /
  gap 16 / `flexGrow: 1`. *(Changent à l'étape 3 : la présence du KAV et le `'bottom'` des `edges` ; le
  `ScrollView` et son style, jamais.)*
- **K3** — `src/components/__tests__/keyboard-legacy-kav.test.tsx` : `CreateExerciseModal`,
  `EditExerciseModal`, `SaveTemplateSheet` rendent un `KeyboardAvoidingView` sans `behavior` sur Android,
  `'padding'` sur iOS. Mocks repris des tests de fumée existants (`create-exercise-modal-smoke`,
  `edit-exercise-modal-smoke`).
- **K4** — `src/app/__tests__/workout-keyboard.test.tsx` : l'écran de séance classique, avec
  `@/hooks/useKeyboardHeight` simulé : 0 → `edges` `['top','bottom']`, pas de `paddingBottom` ; 300 →
  `edges` `['top']`, `paddingBottom: 300`. Harnais repris de `workout-screen.test.tsx`.
- **K5** — même chose dans `ImmersiveWorkout.test.tsx` (qui simule déjà le hook à 0, ligne 67) : un cas
  à 300 ajouté.
- **K6** — dans le garde : la liste nommée des `ScrollView` / `FlatList` de formulaire **sans**
  `keyboardShouldPersistTaps` (13 : `food-custom:172`, `nutrition-meals:84`, `nutrition-stats:104`,
  `profile:99`, `recipe-edit:44` et `:63`, `history/[id]:92`, `StageScrollView:67`, `meal-plan:457`,
  `MeasurementSheet:141`, `WellbeingCheckinSheet:153`, `food-picker:227` et `:248`). Elle ne peut que
  rétrécir.
- **K1** (`keyboardEventNames`) existe et ne change jamais d'attendu.

**Le garde** — `src/components/keyboard/__tests__/keyboard-coverage-guard.test.ts`, sur le patron des
gardes statiques du dépôt (`no-frozen-clock`, `cible01-no-formula` : `require` typé localement, chemins
depuis `__dirname`, pas de `@types/node` global). Il **analyse le code avec `typescript`**
(`ts.createSourceFile`, déjà en dépendance de dev de `apps/mobile`) : imports (valeur / type, alias,
multilignes), éléments JSX et leurs attributs, commentaires ignorés. Pas de regex.

- **G1** — import de `KeyboardAvoidingView` depuis `react-native` : autorisé seulement dans
  `components/keyboard/` **et** dans la liste « à migrer » (les 4 d'aujourd'hui).
- **G2** — « fichier à champ » = import **en valeur** de `TextInput` depuis `react-native` (alias compris),
  ou élément JSX `TextField`, `DeferredTextField`, `DraftNumberInput`, `ExerciseTargetsFields`. Lecture
  seule exemptée par liste explicite (`components/motion/AnimatedNumber.tsx`). Les quatre composants de
  champ sont déclarés `field`. `INVENTORY` liste les fichiers à champ **et** les fichiers intermédiaires
  des chaînes (`WorkoutReport`, `SessionEditor`, `ExercisePlanEditor`, `TemplateExerciseEditor`,
  `RunningSessionEditor`, `CurrentSetCard`, `HistorySection`, `DayJournal`…), chacun avec `self`,
  `coveredBy: [...]` ou `todo` :
  - `self` vérifié : le fichier importe `KeyboardAvoidingContainer` / `KeyboardAwareScrollView`, ou une
    **enveloppe déclarée** (`FormScreen`, `OnboardingScaffold`, `StageScrollView` — chacune `self`) ;
  - `coveredBy` vérifié **dans les deux sens** : chaque fichier couvrant importe le composant, **et**
    l'ensemble de ses importeurs réels hors `__tests__` est égal à `coveredBy` ; la chaîne remonte jusqu'à
    un `self`, cycle interdit ;
  - un fichier à champ absent d'`INVENTORY` échoue avec : « Nouveau champ de saisie : poser
    `KeyboardAwareScrollView` ou `KeyboardAvoidingContainer` (spec CLAV-01 §4), puis l'inscrire ici. »
- **G3** — un fichier qui rend `<Modal` et un champ doit être `self` **et** rendre un
  `KeyboardAvoidingContainer` (ou `KeyboardAwareScrollView`) avec `kind="sheet"` (ou `todo` à cette
  étape).
- **Cliquet** — `todo` est accepté, mais la liste `todo` est **figée** (égalité exacte avec celle du
  22/10) : on ne peut qu'en retirer.

À l'étape 1, `INVENTORY` marque `todo` tout ce qui n'est pas couvert, et `legacy-hook` (nommé, dans le
cliquet) la séance : `SetOptions` ← `CurrentSetCard` ← `workout`, `SetActionBar` ← `workout`,
`DraftNumberInput` / `SetOptions` ← `ImmersiveWorkout` — jusqu'à l'étape 7.

## Étape 2 — la brique

Dossier neuf `apps/mobile/src/components/keyboard/` ; **aucun écran ne bouge** à cette étape.

| Fichier | Rôle |
|---|---|
| `keyboard-overlap.ts` | **Pure.** `keyboardOverlap({ containerBottom, keyboardTop, visible })` → `max(0, round(containerBottom − keyboardTop))`, 0 si fermé ; `bottomPadding({ base, overlap, safeAreaBottom, inset })` → `base + (safeAreaBottom ? max(inset, overlap) : overlap)` (DD4). Le seul endroit où vivra un éventuel correctif de `keyboardTop` après le critère 1 |
| `useKeyboardFrame.ts` | `{ visible, height, screenY }`, mêmes événements que `useKeyboardHeight` (`keyboardEventNames` **importé** de `hooks/useKeyboardHeight.ts` jusqu'à l'étape 7, où il déménage ici) ; état initial `Keyboard.isVisible()` / `Keyboard.metrics()` (DD1) ; garde d'idempotence reprise. Sur iOS, transmet l'événement pour `Keyboard.scheduleLayoutAnimation` (D5) |
| `useMeasuredBottom.ts` | Bas du conteneur dans la fenêtre : `ref.current?.measureInWindow(...)` (appel protégé — sous Jest, le natif ne rappelle jamais) au `onLayout` et à chaque ouverture du clavier ; tant que rien n'est mesuré, le bas du cadre de `useSafeAreaFrame()` (pas `useWindowDimensions` : la fenêtre RN exclut la barre de navigation sur certaines versions d'Android) |
| `KeyboardAvoidingContainer.tsx` | Une `View` en colonne (`flex: 1` par défaut, `style` de l'appelant fusionné) ; `paddingBottom` = `bottomPadding(...)` où `base` est le padding bas **résolu** du style de l'appelant (`paddingBottom` ?? `paddingVertical` ?? `padding` ?? 0) — additionné, jamais écrasé. Props : `kind: 'screen' \| 'sheet'` (`'screen'` par défaut), `safeAreaBottom` (faux par défaut), `enabled` (vrai). **Imbrication** : un contexte React signale qu'on est dans un conteneur de la même fenêtre → le conteneur intérieur rend une simple `View` (le plus extérieur décale). `kind="sheet"` est toujours actif et fournit un contexte neuf (une `Modal` RN n'est pas un portail : le contexte la traverse) |
| `KeyboardAwareScrollView.tsx` | `KeyboardAvoidingContainer` + `ScrollView` ; transmet toutes les props et la `ref` du `ScrollView` ; impose `keyboardShouldPersistTaps="handled"` (D8) ; `style` de l'appelant sur le `ScrollView` (fond compris), `containerStyle` pour le conteneur ; `kind` et `safeAreaBottom` transmis |
| `index.ts` | Exports publics |

**Tests** (`components/keyboard/__tests__/`) :
- `keyboard-overlap.test.ts` — clavier fermé → 0 ; conteneur au bas de la fenêtre (Pixel 6a : 914 dp,
  haut du clavier à 600) → 314 ; au-dessus d'une barre d'onglets (bas à 834) → 234 ; entièrement
  au-dessus → 0 ; jamais négatif ; arrondi ; `bottomPadding` : sans `safeAreaBottom`, fermé → `base`
  (**aucun inset ajouté**) ; avec, fermé → `base + 24`, ouvert → `base + max(24, overlap)` ; mêmes cas
  avec des valeurs iOS.
- `KeyboardAvoidingContainer.test.tsx` — `useKeyboardFrame` et `useMeasuredBottom` simulés : padding
  appliqué ouvert, padding de l'appelant seul fermé ; `padding: 16` de l'appelant conservé et additionné ;
  `safeAreaBottom` ; `enabled={false}` ; un conteneur dans un conteneur est passif ; un `kind="sheet"`
  dans un conteneur d'écran est actif, et un conteneur dans ce `sheet` passif.
- `useMeasuredBottom.test.tsx` — patron de la « vue mesurable » (`planning-screen.test.tsx:84-97`) :
  valeur mesurée rendue ; sans rappel natif, repli sur `useSafeAreaFrame()` ; pas d'exception si la
  `ref` est nulle.
- `KeyboardAwareScrollView.test.tsx` — props, `ref` et style transmis ; `keyboardShouldPersistTaps`
  imposé même si l'appelant passe `"never"` (documenté : D8).
- `useKeyboardFrame.test.ts` — état initial lu dans `Keyboard.metrics()` (simulé) ; `keyboardEventNames`
  identique à celui du hook d'aujourd'hui.

## Étape 3 — `FormScreen` (A1-A9)

`FormScreen` : `SafeAreaView edges={edges sans 'bottom'}` → `KeyboardAwareScrollView`, avec
`safeAreaBottom` si `edges` contenait `'bottom'` (le défaut). Même `contentContainerStyle`, même API
(DD2). `KeyboardAvoidingView` et `Platform` sortent du fichier.

**K2 change** : plus de `KeyboardAvoidingView`, `'bottom'` quitte les `edges` du `SafeAreaView` ; le
`ScrollView` et son style identiques. Garde : `FormScreen` et `OnboardingScaffold` passent `self`
(enveloppes) ; les 9 écrans A sont `self` par l'enveloppe.

## Étape 4 — écrans défilants (B1-B18)

Le `ScrollView` racine ou intérieur devient `KeyboardAwareScrollView`, **mêmes props**, **sans**
`safeAreaBottom` (ces écrans n'avaient pas d'arête basse autour de leur défilement, ou l'avaient posée
plus haut — `<Screen>` par défaut de `body`) :

`app/account-delete.tsx`, `app/ai-lab.tsx`, `app/food-custom.tsx`, `app/meal-quick-entry.tsx`,
`app/nutrition-meals.tsx`, `app/nutrition-profile.tsx`, `app/nutrition-stats.tsx` (+ `Keyboard.dismiss()`
dans `saveWeight` — D8), `app/profile.tsx`, `app/recipe-edit.tsx` (deux), `app/running-profile.tsx`,
`app/planning/plan.tsx`, `app/programs/edit.tsx` (deux), `app/running-programs/edit.tsx` (deux),
`components/templates/TemplateComposer.tsx`, `app/history/[id].tsx`, `app/body.tsx`.

Et :
- `app/templates/edit.tsx` (étape 2 de la création) et `app/templates/[id].tsx` : la `View` « composeur
  + pied » devient `KeyboardAvoidingContainer safeAreaBottom` ; le `SafeAreaView edges={['bottom']}` du
  pied devient une `View` (l'arête est rendue par le conteneur). `TemplateComposer` y est passif
  (imbrication). L'étape 1 de `templates/edit` (nom + Créer) : `KeyboardAwareScrollView`.
- `components/stage/StageScrollView.tsx` : son `ScrollView` devient `KeyboardAwareScrollView`, sans
  `safeAreaBottom` (l'écran s'arrête à la barre d'onglets) ; `ref` transmise : `useScrollToTop` de
  MUSCU-UX07 et `nutrition-screen.test.tsx:523-530` (la `ref` doit rester non nulle) restent verts.
  Couvre B18 ; clavier fermé, sans effet sur les quatre hubs (critère 51).

**K6** perd B3, B5, B7, B8, B9, B16, B18. Garde : 18 surfaces de `todo` à `self` / `coveredBy`
(`ExerciseTargetsFields` ← `ExercisePlanEditor` ← `SessionEditor` ← `programs/edit` ;
← `TemplateExerciseEditor` ← `TemplateComposer` ← `templates/edit`, `templates/[id]` ;
← `IntervalBlockEditor` ← `RunningSessionEditor` ← `running-programs/edit` ; `FeelingSection` ←
`WorkoutReport` ← `history/[id]`, `workout-summary` ; `BodyMuscleDetail` ← `body` ;
`ExerciseLastDoneList` ← `HistorySection` ← `(tabs)/strength`, `self` par `StageScrollView`).

## Étape 5 — listes et panneaux (C1-C4)

- `app/exercises.tsx` : la `View` racine devient `KeyboardAvoidingContainer` (son style conservé). Le
  pied « Commencer » du mode composer garde son `insets.bottom + 12` (D4). La `Modal`
  `CreateExerciseModal` reste à l'étape 6.
- `app/food-picker.tsx` : la `View` racine de l'écran devient `KeyboardAvoidingContainer` (son
  `padding: 16` conservé, additionné) ; les `FlatList` `:227` et `:248` reçoivent
  `keyboardShouldPersistTaps="handled"` ; `RecipeServingsPanel` et `QuickAddPanel` deviennent
  `KeyboardAwareScrollView` — style du panneau porté par `contentContainerStyle`, `flex: 1` remplacé par
  `flexGrow: 1` (sinon il ne défile pas) — C2b, grande police.
- `components/QuantityPanel.tsx` : la `View` du panneau devient `KeyboardAvoidingContainer` (le pied
  Annuler / Ajouter remonte ; `padding: 16` conservé) ; son `ScrollView` reste un `ScrollView`. Couvre
  `food-picker` et `food-scan`.
- `components/programs/ExercisePicker.tsx` (`Modal` `pageSheet`) : dans son `SafeAreaView`, un
  `KeyboardAvoidingContainer kind="sheet"` autour de l'en-tête et de la `FlatList` — `kind="sheet"`
  parce que c'est une autre fenêtre, même plein écran, rendue dans `TemplateComposer` et `SessionEditor`
  (G3).

**K6** perd les deux `FlatList` de C2.

## Étape 6 — feuilles (D1-D11)

Partout le même montage : premier enfant de la `Modal` = `KeyboardAvoidingContainer kind="sheet"`
(`justifyContent: 'flex-end'`), avec dedans la feuille, **inchangée** ; le fond pressable passe en
`StyleSheet.absoluteFill` (comme D3) pour assombrir aussi la zone de padding (spec §6.3).

`components/exercises/CreateExerciseModal.tsx`, `components/exercises/EditExerciseModal.tsx`,
`components/nutrition/SaveTemplateSheet.tsx` (les trois `KeyboardAvoidingView` disparaissent avec
`Platform`), `components/nutrition/journal/EntryDetailModal.tsx` (le `Pressable` qui sert de fond reste
le parent de la feuille, le conteneur se pose au-dessus de lui), `app/meal-plan/index.tsx` (la feuille
d'ajout ; la liste `options` reçoit `flexShrink: 1` — spec §6.3), `components/goals/GoalFormSheet.tsx`,
`components/goals/GoalLetterSheet.tsx`, `components/measurements/MeasurementSheet.tsx`,
`components/wellbeing/WellbeingCheckinSheet.tsx`, `components/wellbeing/MomentCheckinSheet.tsx`.

Les `ScrollView` de feuille sans `keyboardShouldPersistTaps` (`meal-plan:457`, `MeasurementSheet:141`,
`WellbeingCheckinSheet:153`) reçoivent `"handled"` — **K6 est vide**. Ils restent des `ScrollView` : le
conteneur de feuille suffit.

**`components/nutrition/AddFoodSheet.tsx`** (D5) : le fond garde son `position: absolute` (remplissage) ;
la feuille quitte `position: absolute; left/right/bottom: 0` pour le flux, en bas du conteneur, avec
`maxHeight: '92%'`, ses rayons et son `paddingTop` inchangés. Si un test de rendu de la feuille fige sa
position, il change ici (dit dans le commit).

**K3 change** : plus de `KeyboardAvoidingView`. Garde : 11 surfaces de `todo` à `self` (G3 satisfait,
`kind="sheet"` présent) ; G1 n'a plus d'exception hors `components/keyboard/`.

## Étape 7 — séance (E1-E2) — D7

- `app/workout.tsx` : `SafeAreaView edges={['top']}` en permanence ; en-tête, défilement et
  `SetActionBar` dans un `KeyboardAvoidingContainer safeAreaBottom` ; la ligne
  `keyboardHeight > 0 ? { paddingBottom } : null` et la bascule d'`edges` disparaissent.
- `components/workout/immersive/ImmersiveWorkout.tsx` : même chose.
- `hooks/useKeyboardHeight.ts` n'a plus d'appelant : **supprimé**. `keyboardEventNames` déménage dans
  `components/keyboard/useKeyboardFrame.ts` ; `hooks/__tests__/useKeyboardHeight.test.ts` devient
  `components/keyboard/__tests__/keyboard-event-names.test.ts`, **attendus identiques** (K1), import
  seul modifié.
- **K4 / K5 réexprimés** : `useKeyboardFrame` et `useMeasuredBottom` simulés (conteneur au bas de la
  fenêtre, inset 24, clavier ouvert à `height` 300) → `paddingBottom` **324** (le haut du clavier, +1
  inset sur aujourd'hui — spec §1.3, E6) ; fermé → 24, comme l'arête basse d'aujourd'hui. Le commit dit
  que l'attendu « ouvert » change, et pourquoi.
- `ImmersiveWorkout.test.tsx` : le mock de `@/hooks/useKeyboardHeight` (ligne 67) devient celui de
  `@/components/keyboard/useKeyboardFrame`.
- Garde : l'entrée `legacy-hook` disparaît ; `SetOptions`, `SetActionBar`, `DraftNumberInput` sont
  `coveredBy` des écrans de séance, qui sont `self`.

## Étape 8 — garde strict, recette et docs

- **Garde** : la liste `todo` est **vide** et l'assertion le dit (`expect(TODO).toEqual([])`) ; le
  cliquet devient une interdiction pure.
- **RECETTES.md §95** (numéro à reconfirmer au moment d'écrire) : les 52 critères du §14 de la spec
  (dont 1 iOS, en attente), préparation comprise, le critère 1 en tête avec sa consigne d'arrêt.
- **Spec** : `etape: recette`, écarts au plan en fin de plan ; **CHANGELOG** ; **BACKLOG** inchangé
  (CLAV-01 en est sorti à l'entrée dans le pipeline, CLAV-02 y est) ; `node scripts/etat.mjs`.
- **Vérifications finales** : typecheck, lint, **suite entière** (codes de sortie sans pipe), parité
  i18n (`scripts/check-i18n-parity.mjs`, aucune clé neuve attendue), `npx expo export --platform web`
  (fumée de bundling).
- Push : `git fetch origin`, vérifier que `origin/dev` est un ancêtre de `HEAD`
  (`git merge-base --is-ancestor origin/dev HEAD`), sinon rebaser ; puis `git push origin HEAD:dev`.

## Repli — si le critère 1 échoue (D6), à décider alors

Ne change **que** `components/keyboard/` et la racine : `npx expo install react-native-keyboard-controller`,
`KeyboardProvider` dans `app/_layout.tsx`, `KeyboardAvoidingContainer` délègue au
`KeyboardAvoidingView` de la bibliothèque (`behavior="padding"`) et `KeyboardAwareScrollView` au sien ;
`runtimeVersion` relevé ; mock Jest ; nouvelle build de dev et nouvel APK ; vérifier le ticket #1683
(insets de react-native-screens) ; rejouer toute la recette. **Les 45 surfaces ne bougent pas.**

## Ce que le plan ne fait pas

- Aucun défilement JS vers le champ actif (Android natif ; iOS → CLAV-02).
- Aucun pied collant neuf (D4), aucune barre précédent / suivant au-dessus du clavier.
- Aucune animation synchrone du clavier sur Android (DD3).
- Rien sur le back-office web.

## Écarts au plan

Codé le 23/10/2026. Des moyens, pas des règles :

- **Un commit au lieu de neuf.** Florian a demandé de partir sur toutes les recommandations puis de passer
  par `/commit` : le lot est livré en un commit. L'ordre a été tenu dans la session — le filet (K2 à K5)
  a d'abord été écrit **et passé au vert sur le code d'avant** (KAV `'height'` / `'padding'`, trois KAV
  sans `behavior`, la séance à 300 → 300), puis la brique, puis chaque famille ; le garde a d'abord été
  lancé sur le code non migré, où il échouait sur exactement ce qui était attendu (34 fichiers `self`,
  les enveloppes `FormScreen` et `StageScrollView`, G1 sur les 4 KAV, G3 sur les 12 `Modal`, D8 sur les
  13 défilements) et passait sur les 13 chaînes `coveredBy`. Le fichier de caractérisation provisoire
  (`keyboard-characterization.test.tsx`) a été retiré à mesure que ses attentes passaient aux tests
  définitifs (`FormScreen.keyboard.test.tsx`, `keyboard-sheets.test.tsx`) ; les états « avant » sont écrits
  en tête de ces tests.
- **Pas de liste `todo` dans le garde final** : sans commits intermédiaires, le cliquet n'avait plus de
  raison d'exister dans le dépôt — le garde est livré **strict** (spec §11.3, point 4 : « à la dernière,
  la liste doit être vide »).
- **Lecture des props sous RNTL v14** : par `toJSON()` (utilitaire `src/test-utils/host-tree.ts`) plutôt
  que par un mock de `SafeAreaView` — le natif reçoit `edges` sous forme d'objet (`{ bottom: 'off' }`),
  lu par `hasBottomEdge`. Les conteneurs de la séance portent un `testID`
  (`workout-keyboard-area`, `immersive-keyboard-area`).
- **`StyleSheet.absoluteFillObject` n'existe plus** en RN 0.86 : les fonds de feuille étalent
  `StyleSheet.absoluteFill`.
- **`EntryDetailModal`** : le voile sombre passe du `Pressable` de fond au conteneur (le `Pressable` reste
  le parent de la feuille) — même effet que le fond absolu des autres feuilles.
- **`history/[id]`** : son bouton « Refaire » est en `position: absolute` au bas de l'écran ; il reste sous
  le clavier pendant qu'on écrit la note (ce n'est pas la validation de la note). Le défilement, lui,
  s'arrête au-dessus du clavier : la note et la fin du rapport s'atteignent. Critère 25.
- **`food-picker`** : le style `panel` devenu inutile est retiré (remplacé par `panelContent`).
- **`node-fs.d.ts`** reçoit `statSync`, `dirname` et `relative` (le garde parcourt `src/`).
- **K4 vit dans `workout-screen.test.tsx`** (son harnais), pas dans un `workout-keyboard.test.tsx` à part.
- **Revue de code du 23/10/2026** (agent `superpowers:code-reviewer`), corrigé avant le commit :
  - 🔴 **le voile de repos de la séance** (`RestOverlay`, `absoluteFill`) était passé dans le conteneur,
    posé sous l'inset haut : il aurait commencé un inset plus bas et laissé la barre d'état découverte,
    clavier fermé, après chaque série. Il reste un enfant direct du `SafeAreaView` ; un test K4 le fige ;
  - rien ne vérifiait que le conteneur **se mesure** (tous les tests simulaient la mesure) : trois tests
    (au `layout`, à l'ouverture du clavier, jamais pour un passif) ;
  - un conteneur passif avec `safeAreaBottom` ne garde plus l'inset clavier ouvert (il doublerait le
    décalage de l'extérieur) ; le recouvrement est borné à la hauteur du conteneur (`containerTop`) ;
  - iOS : seule une instance **active** programme la `LayoutAnimation` (`useKeyboardFrame(animate)`) ;
  - la `ref` de mesure passe après la décomposition des props ;
  - le garde résout les balises par leur **import** (alias, `<RN.TextInput>`), cherche le `kind="sheet"`
    **dans** la `Modal`, et lit `horizontal={false}` comme vertical ; ses limites restantes sont écrites
    en tête du fichier. Vérifié par mutation : retirer `kind="sheet"` d'une feuille fait échouer G3 ;
  - le critère 1 de la recette couvre aussi `ExercisePicker` (même mécanisme qu'une feuille).
- **Parité i18n** : `scripts/check-i18n-parity.mjs` échoue sur quatre valeurs vides
  (`coach.*.verdict.warmup`) **déjà présentes sur `origin/dev`** — ce lot ne touche aucun fichier i18n.
