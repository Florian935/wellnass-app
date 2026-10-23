---
id: CLAV-01
titre: "Le clavier ne recouvre plus aucun formulaire — une seule règle d'évitement, sur Android edge-to-edge comme sur iOS"
roadmap: []
catalogue: []
etape: close
branche: fix/clav01-clavier-formulaires
maj: 23/10/2026
---

# US CLAV-01 — Le clavier ne recouvre plus aucun formulaire

> **Demande** : Florian, 22/10/2026 — reprendre la ligne CLAV-01 du BACKLOG (P1) : depuis Expo SDK 54,
> l'edge-to-edge est forcé sur Android, `adjustResize` ne redimensionne plus la fenêtre, et le clavier
> recouvre les champs du bas. Inventaire exhaustif d'abord, une seule règle ensuite.
> **Sources** : BACKLOG, ligne CLAV-01 ; recette MUSCU-UX01 §57.19 (critères 68-69, RECETTES.md) ;
> [useKeyboardHeight.ts](../../../../apps/mobile/src/hooks/useKeyboardHeight.ts) ; docs Expo SDK 57
> (guide *Keyboard handling*, page *react-native-keyboard-controller*, *System bars*) ; code source de
> React Native 0.86.0 installé (`KeyboardAvoidingView.js`, `ScrollView.js`, `ReactRootView.java`,
> `ReactScrollView.java`, `ReactModalHostView.kt`).
> **Plan** : [docs/plans/clav01-clavier-formulaires.md](../../../plans/clav01-clavier-formulaires.md).
> **Maquette** : **sans objet — aucun écran ne change de forme.** Le conteneur ajoute un espace sous le
> contenu *pendant que le clavier est ouvert*, rien d'autre. Les pieds d'écran fixes existent déjà ; ils
> apparaissent désormais au-dessus du clavier au lieu de dessous. Seule la feuille d'ajout d'aliment
> change de *montage* (positionnement absolu → colonne), pour un rendu identique (§6.3).
> **Roadmap** : pas de ligne — c'est une correction cadrée en US (`fix/…`), qui vit au CHANGELOG
> (règle en fin de la section « Hors périmètre de cadrage »). Elle touche des fonctionnalités livrées
> sans en ajouter.
> **Vérifié dans le code** le 22/10/2026 sur `origin/dev` (`3a3cda89`) ; **relue** le même jour par un
> agent de revue (§15), dont les corrections sont intégrées.
> ✅ **Validée par Florian le 23/10/2026** : D1 à D12 **telles que proposées**, retours reportés à la
> recette.
> 🛠️ **Codée le 23/10/2026**, en un lot (filet, brique, puis les cinq familles), un seul commit poussé sur
> `dev` à la demande de Florian. Le filet a tenu : seuls les tests étiquetés K2 à K5 ont changé d'attendu,
> à l'étape qui les touche. Écarts au plan — des moyens, pas des règles — en fin de plan. En recette :
> [RECETTES.md](../../../../RECETTES.md) §95. Aucune migration, aucune sync rule,
> aucune dépendance native, aucun appel au projet, aucun déploiement, aucun build (§12).

## 0. Le besoin

Quand on tape dans un champ, on doit **voir ce qu'on tape**, et pouvoir **valider sans fermer le clavier**.
Aujourd'hui, sur Android, c'est vrai sur un seul écran de l'app — la séance de musculation, corrigée le
11/09/2026. Partout ailleurs, le clavier se pose **par-dessus** le bas de l'écran, et rien ne remonte.

Ce n'est pas un oubli par écran mais un **changement de plateforme** : depuis Expo SDK 54 (le projet est
en SDK 57 / React Native 0.86.0 depuis sa création), l'app dessine sous les barres système, la fenêtre
ne se redimensionne plus quand le clavier s'ouvre, et `android:windowSoftInputMode="adjustResize"` —
toujours au manifeste — n'a plus d'effet. Tout écran qui comptait sur ce redimensionnement est touché.

Il faut donc **une règle**, écrite à un seul endroit, que chaque formulaire réutilise — et un garde qui
empêche le prochain formulaire de l'oublier.

## 1. Ce que dit le code (avant de proposer quoi que ce soit)

### 1.1 Ce que React Native envoie quand le clavier s'ouvre (Android)

`ReactRootView.checkForKeyboardEvents()` (RN 0.86.0) émet `keyboardDidShow` avec :

- `height` = `ime.bottom − systemBars.bottom` : la hauteur du clavier **au-dessus de la barre de
  navigation** ;
- `screenY` = le bas de la zone visible de la fenêtre (`getWindowVisibleDisplayFrame`), c'est-à-dire
  **le haut du clavier**, en coordonnées d'**écran** — identiques à celles de la fenêtre tant que l'app
  est en plein écran (DD6) ;
- et **aucun** `keyboardWillShow` : Android n'émet que les `Did*`, une fois le clavier ouvert.

Ces événements viennent de la **vue racine de l'activité**. Une `Modal` React Native est, elle, une
**fenêtre `Dialog` à part**, que RN passe aussi en edge-to-edge (`statusBarTranslucent` et
`navigationBarTranslucent` forcés à vrai quand le drapeau edge-to-edge est actif, `ReactModalHostView.kt`)
et à qui il impose `SOFT_INPUT_ADJUST_RESIZE` — sans effet, pour la même raison. ⚠️ **Que la vue racine de
l'activité voie le clavier ouvert par une fenêtre `Dialog` n'est pas vérifiable sans appareil** : c'est le
point dur de cette US (§3 D2, §13 E4).

### 1.2 Pourquoi `KeyboardAvoidingView` ne suffit pas, même avec un `behavior`

`KeyboardAvoidingView` calcule le recouvrement par
`frame.y + frame.height − keyboard.screenY`, où `frame` vient de son `onLayout` — **relatif à son
parent** — et `screenY` est **absolu**. Les deux ne coïncident que si la vue commence en haut de la
fenêtre. Sous un **en-tête natif** (`headerShown: true`), la vue est décalée de la hauteur de l'en-tête
(~56 dp + la barre d'état en edge-to-edge) : le recouvrement calculé est **trop court d'autant**, et le bas
du formulaire reste sous le clavier. C'est le rôle de `keyboardVerticalOffset`… à régler **écran par
écran**. Le mode `'height'` ajoute un défaut : il mémorise la hauteur initiale (`_initialFrameHeight`)
une fois pour toutes.

Corollaire : **sans en-tête natif**, quand le `SafeAreaView` de `FormScreen` commence en haut de la
fenêtre, le calcul est juste — les écrans `FormScreen` sans en-tête sont donc **présumés** couverts
depuis le 18/07 (jamais recetté, E1). Ce sont les trois écrans sous en-tête qui restent courts.

### 1.3 Pourquoi l'écran de séance marche

[workout.tsx:332](../../../../apps/mobile/src/app/workout.tsx#L332) lit `useKeyboardHeight()` et, clavier
ouvert, pose `paddingBottom: keyboardHeight` sur le `SafeAreaView` racine en lui retirant l'arête basse
([:1257-1265](../../../../apps/mobile/src/app/workout.tsx#L1257)) ; le `ScrollView` en `flex: 1`
rétrécit, la barre `SetActionBar` remonte. Même montage dans
[ImmersiveWorkout.tsx:308-314](../../../../apps/mobile/src/components/workout/immersive/ImmersiveWorkout.tsx#L308).
Validé sur appareil le 13/09/2026 (critères 68-69), en navigation **gestuelle**.

Le hook ne connaît que `height` (au-dessus de la barre de navigation) : réutilisé tel quel, il oblige
chaque écran à savoir ce qui se trouve entre lui et le bas de la fenêtre (barre d'onglets, en-tête,
arête de safe area, feuille). C'est exactement « un correctif par écran ».

Et d'après le code, la séance elle-même est **courte d'un inset** : la vue racine descend jusqu'au bas
de la fenêtre, le haut du clavier est à `height + inset bas` du bord, la barre est posée à `height`.
Son bas passe donc d'environ 24 dp (gestuelle) — 48 dp (3 boutons) — **sous** le haut du clavier. La
recette du 13/09 l'a jugée entièrement visible (la barre a 12 dp de marge basse) ; en 3 boutons, ce ne
serait plus vrai (D7).

### 1.4 Pourquoi le champ actif remontera tout seul sur Android

Un `ScrollView` Android qui **rétrécit** fait défiler le champ qui a le focus pour le garder visible :
`ReactScrollView.onSizeChanged` appelle `ScrollView.onSizeChanged` d'Android, qui le fait nativement.
C'est ce qui rendait `adjustResize` confortable. Et quand le focus passe d'un champ à l'autre, clavier
ouvert, `ReactScrollView.requestChildFocus` amène le nouveau champ à l'écran (`scrollToChild`). Il suffit
donc de **faire rétrécir le `ScrollView`** — ce que fait le padding d'un conteneur parent. (Condition
tacite d'Android : le champ était visible avant le rétrécissement — vrai dans le cas courant, puisqu'on
touche un champ qu'on voit.)

### 1.5 Pourquoi une mesure dans la fenêtre est juste, même sous un en-tête natif

`measureInWindow` rend la position d'une vue dans **sa** fenêtre. Sous un en-tête natif Android, elle
n'est juste que parce que **react-native-screens** (4.25.2) corrige l'origine de l'écran dans l'arbre
d'ombre : `RNSScreenShadowNode::applyFrameCorrections` décale l'origine de la hauteur d'en-tête connue,
et `getContentOriginOffset` la reporte aux descendants. C'est la **prémisse de D1** : vérifiée dans le
code, à confirmer sur appareil par les écrans sous en-tête (A2, A3, A6, B1-B10 — critères 3, 4, 7, 11 à
20). Dans une `Modal`, la mesure s'arrête à la fenêtre du `Dialog` — plein écran en edge-to-edge,
donc juste aussi.

### 1.6 Ce que disent les docs Expo SDK 57

Le guide *Keyboard handling* recommande `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`
(« for Android, just having the KeyboardAvoidingView prevents covering the input ») — **c'est la
recommandation d'avant l'edge-to-edge** : le motif exact qui ne fait plus rien. Il cite
`react-native-keyboard-controller` (`KeyboardAwareScrollView`, `KeyboardToolbar`) pour les cas avancés ;
le blog Expo sur l'edge-to-edge dit : « Like on iOS, you'll need to use KeyboardAvoidingView or —
ideally — react-native-keyboard-controller ». La page *System bars* ne traite pas du clavier.

## 2. L'inventaire

Cherché dans tout `apps/mobile/src` : tout `TextInput` (18 fichiers, dont un en lecture seule —
`AnimatedNumber`, `editable={false}`, hors sujet), tout composant qui l'enveloppe (`TextField`,
`DeferredTextField`, `DraftNumberInput`, `ExerciseTargetsFields`) et **tous leurs appelants**, jusqu'à
l'écran ou la `Modal` qui les porte ; tout `keyboardType`, `onChangeText`, `autoFocus`,
`onSubmitEditing` (50 fichiers, mêmes résultats) ; toute `Modal`, tout `KeyboardAvoidingView`, toute
barre de recherche native (`headerSearchBarOptions` : aucune), tout champ de `@expo/ui` (aucun). Le
back-office (`apps/admin`) est une app web au clavier physique : hors sujet.

**Légende de l'impact aujourd'hui (Android)** —
🔴 **bloquant** : un champ ou le bouton de validation **ne peut pas** être amené au-dessus du clavier
(dernier élément d'un défilement, feuille ancrée en bas, pied fixe) ;
🟠 **gênant** : champ masqué à l'ouverture, atteignable en faisant défiler à la main ;
🟢 **marginal** : le champ reste visible ; seule la fin d'une liste passe sous le clavier — ou **présumé**
couvert (KAV-h sans en-tête, §1.2 : calcul juste, jamais recetté) ;
✅ **déjà couvert** (recetté).

**Légende du mécanisme** — **KAV-h** : `KeyboardAvoidingView` `'height'` sur Android (`FormScreen`, depuis le
18/07/2026) ; **KAV-∅** : `KeyboardAvoidingView` sans `behavior` sur Android (rien) ; **∅** : rien du tout ;
**hook** : `useKeyboardHeight`.

**Ce qui changera** — **C** = le conteneur commun (§4) ; **S** = `KeyboardAwareScrollView` (le conteneur
plus le `ScrollView`, §4) ; **M** = le conteneur posé en premier enfant de la `Modal`.

### 2.1 Famille A — `FormScreen` (9 écrans)

| # | Écran | En-tête natif | Mécanisme | Champs (le plus bas en gras) | Impact | Change |
|---|---|---|---|---|---|---|
| A1 | Connexion ([sign-in.tsx:65](../../../../apps/mobile/src/app/(auth)/sign-in.tsx#L65)) | non | KAV-h | e-mail, **mot de passe** | 🟢 présumé | S via `FormScreen` |
| A2 | Inscription ([sign-up.tsx:88](../../../../apps/mobile/src/app/(auth)/sign-up.tsx#L88)) | **oui** | KAV-h, court de l'en-tête | e-mail, mot de passe, confirmation, jour, mois, **année**, CGU, bouton | 🟠 | S via `FormScreen` |
| A3 | Mot de passe oublié ([forgot-password.tsx:35](../../../../apps/mobile/src/app/(auth)/forgot-password.tsx#L35)) | **oui** | KAV-h, court de l'en-tête | **e-mail**, bouton | 🟢 écran court | S via `FormScreen` |
| A4 | Nouveau mot de passe ([password-reset.tsx:87](../../../../apps/mobile/src/app/password-reset.tsx#L87)) | non | KAV-h | mot de passe, **confirmation**, bouton | 🟢 présumé | S via `FormScreen` |
| A5 | Onboarding › Infos ([infos.tsx:86](../../../../apps/mobile/src/app/(onboarding)/infos.tsx#L86), `OnboardingScaffold` → `FormScreen`) | non | KAV-h | prénom, jour, mois, année, poids, **taille** (pieds/pouces en impérial), pied Retour/Suivant | 🟢 présumé | S via `FormScreen` |
| A6 | Saisir une activité ([activity.tsx:259](../../../../apps/mobile/src/app/activity.tsx#L259)) | **oui** | KAV-h, court de l'en-tête | distance, **kcal de la montre**, Enregistrer | 🔴 le bouton | S via `FormScreen` |
| A7 | Fin de séance muscu ([workout-summary.tsx:115](../../../../apps/mobile/src/app/workout-summary.tsx#L115)) | non | KAV-h | note de ressenti ([FeelingSection.tsx:98](../../../../apps/mobile/src/components/workout/report/FeelingSection.tsx#L98), dernier bloc du rapport), puis, sous le rapport, **nom du modèle** (facultatif, :142) | 🟢 présumé | S via `FormScreen` |
| A8 | Fin de course ([run/summary.tsx:326](../../../../apps/mobile/src/app/run/summary.tsx#L326)) | non | KAV-h (le correctif du 18/07 visait cette note) | distance et durée manuelles (:434, :454), **note** (:518), Enregistrer | 🟢 présumé | S via `FormScreen` |
| A9 | Analyse d'une course ([run/analysis.tsx:232](../../../../apps/mobile/src/app/run/analysis.tsx#L232)) | non | KAV-h | **distance corrigée** (:472), Enregistrer la correction | 🟢 présumé | S via `FormScreen` |

`FormScreen` sert aussi **onze écrans sans champ** : vérification d'e-mail, intro et récapitulatif
d'onboarding, Activités, suppression en attente, CGU et confidentialité (`LegalScreen`), et, par
`OnboardingScaffold`, les étapes Activité, Objectif, Guidage et Piliers de l'onboarding. Non concernés,
mais ils changent de conteneur — critère de non-régression (§14, critère 50).

### 2.2 Famille B — écrans qui défilent, sans aucun évitement (18 écrans)

| # | Écran | En-tête natif | Mécanisme | Champs (le plus bas en gras) | Impact | Change |
|---|---|---|---|---|---|---|
| B1 | Supprimer mon compte ([account-delete.tsx:64](../../../../apps/mobile/src/app/account-delete.tsx#L64)) | oui | ∅ | **mot de passe** (:99), puis Supprimer / Annuler | 🔴 les boutons | S |
| B2 | Labo IA ([ai-lab.tsx:84](../../../../apps/mobile/src/app/ai-lab.tsx#L84)) | oui | ∅ | **question** multiligne (:167), Envoyer | 🟠 | S |
| B3 | Créer un aliment ([food-custom.tsx:172](../../../../apps/mobile/src/app/food-custom.tsx#L172)) | oui | ∅ | nom, portions, kcal, macros, détail, **micronutriments** (repliés), Enregistrer (:306) | 🔴 | S |
| B4 | Saisie en phrase ([meal-quick-entry.tsx:250](../../../../apps/mobile/src/app/meal-quick-entry.tsx#L250)) | oui | ∅ | phrase multiligne (:257), **grammes** de chaque ligne reconnue (:289) | 🔴 la dernière ligne | S |
| B5 | Mes repas ([nutrition-meals.tsx:84](../../../../apps/mobile/src/app/nutrition-meals.tsx#L84)) | oui | ∅ | **nom de chaque repas** (:90) | 🟠 | S |
| B6 | Réglages › Nutrition ([nutrition-profile.tsx:177](../../../../apps/mobile/src/app/nutrition-profile.tsx#L177)) | oui | ∅ | cible manuelle, bonus d'entraînement, grammes de macros, **allergènes** (:440) | 🟠 | S |
| B7 | Statistiques nutrition › poids ([nutrition-stats.tsx:363](../../../../apps/mobile/src/app/nutrition-stats.tsx#L363)) | oui | ∅ | **pesée** + Enregistrer, en pied d'onglet | 🔴 | S |
| B8 | Mon profil ([profile.tsx:99](../../../../apps/mobile/src/app/profile.tsx#L99)) | oui | ∅ | prénom, date, poids, taille…, **poids cible** (:189), Enregistrer | 🔴 | S |
| B9 | Recette ([recipe-edit.tsx:44](../../../../apps/mobile/src/app/recipe-edit.tsx#L44), :63) | oui | ∅ | nom ; puis **grammes d'un ingrédient** (:203) + Annuler / Enregistrer, Terminé | 🔴 | S |
| B10 | Réglages › Course ([running-profile.tsx:79](../../../../apps/mobile/src/app/running-profile.tsx#L79)) | oui | ∅ | **allure de référence 5 km** (:119), au milieu | 🟠 | S |
| B11 | Planifier un programme ([planning/plan.tsx:193](../../../../apps/mobile/src/app/planning/plan.tsx#L193)) | non | ∅ | **durée en semaines** (:199), en haut | 🟢 | S |
| B12 | Programme muscu ([programs/edit.tsx:103](../../../../apps/mobile/src/app/programs/edit.tsx#L103), :208) | non | ∅ | étape 1 : nom, objectif, **durée** ; étape 2 : par exercice de chaque séance, séries / reps / charge / repos (`SessionEditor` → `ExercisePlanEditor` → [ExerciseTargetsFields](../../../../apps/mobile/src/components/exercise/ExerciseTargetsFields.tsx)), Terminé | 🔴 le dernier exercice | S |
| B13 | Programme course ([running-programs/edit.tsx:128](../../../../apps/mobile/src/app/running-programs/edit.tsx#L128), :353) | non | ∅ | étape 1 : nom, durée ; étape 2 : nom, résumé, épreuve, date, temps visé, durée, puis par séance [RunningSessionEditor](../../../../apps/mobile/src/components/running/RunningSessionEditor.tsx) (8 champs) et [IntervalBlockEditor](../../../../apps/mobile/src/components/running/IntervalBlockEditor.tsx) (12 champs), Terminé | 🔴 | S |
| B14 | Nouveau modèle ([templates/edit.tsx:68](../../../../apps/mobile/src/app/templates/edit.tsx#L68)) | non | ∅ | étape 1 : **nom** + Créer (🟢) ; étape 2 : [TemplateComposer](../../../../apps/mobile/src/components/templates/TemplateComposer.tsx) (nom, cibles de chaque exercice) + **pied fixe « Terminé »** (:105) | 🔴 le pied | S + pied dans C |
| B15 | Un modèle ([templates/[id].tsx:117](../../../../apps/mobile/src/app/templates/[id].tsx#L117)) | non | ∅ | `TemplateComposer` + **pied fixe** Démarrer / Dupliquer / Supprimer | 🔴 le pied | S + pied dans C |
| B16 | Une séance passée ([history/[id].tsx:92](../../../../apps/mobile/src/app/history/[id].tsx#L92)) | non | ∅ | **note de ressenti** (`FeelingSection`, dernier bloc) ; bouton « Refaire » en surimpression (`position: absolute`) | 🔴 | S — le « Refaire » reste sous le clavier : ce n'est pas la validation de la note (écart au plan) |
| B17 | Mon corps ([body.tsx:51](../../../../apps/mobile/src/app/body.tsx#L51)) | non | ∅ | **recherche d'exercices** sous la silhouette ([BodyMuscleDetail.tsx:23](../../../../apps/mobile/src/components/body/BodyMuscleDetail.tsx#L23)), résultats dessous | 🔴 les résultats | S |
| B18 | Musculation › Historique › Exercices ([ExerciseLastDoneList.tsx:48](../../../../apps/mobile/src/components/strength/ExerciseLastDoneList.tsx#L48), dans [StageScrollView](../../../../apps/mobile/src/components/stage/StageScrollView.tsx)) | non (barre d'onglets) | ∅ | **recherche**, liste dessous | 🟠 | S dans `StageScrollView` |

### 2.3 Famille C — recherche et liste, panneaux de quantité (5 surfaces, dont une modale plein écran)

| # | Écran | En-tête natif | Mécanisme | Champs | Impact | Change |
|---|---|---|---|---|---|---|
| C1 | Exercices ([exercises.tsx:148](../../../../apps/mobile/src/app/exercises.tsx#L148)) | oui | ∅ | **recherche**, `FlatList` dessous ; en mode « composer » une séance, **pied fixe** « Commencer » (:262-283, `paddingBottom: insets.bottom + 12`) | 🔴 le pied, en mode composer ; 🟢 sinon | C autour de l'écran |
| C2 | Choisir un aliment ([food-picker.tsx:203](../../../../apps/mobile/src/app/food-picker.tsx#L203)) | oui | ∅ | **recherche**, trois `FlatList`, actions en pied de liste (« Créer un aliment », « Créer une recette ») | 🟠 les actions | C autour de l'écran |
| C2b | — panneau portions d'une recette (:364) et ajout rapide (:385) | oui | ∅ (vues **non défilantes**) | portions ; nom, kcal, **trois macros**, Annuler / Ajouter | 🟠, 🔴 en grande police | S (le panneau devient défilant, même rendu) |
| C3 | Quantité d'un aliment ([QuantityPanel.tsx:116](../../../../apps/mobile/src/components/QuantityPanel.tsx#L116)), après un choix ou un scan ([food-scan.tsx:134](../../../../apps/mobile/src/app/food-scan.tsx#L134)) | oui | ∅ | **grammes** (:195), **pied fixe** Annuler / Ajouter (:252) | 🔴 le pied | C autour du panneau |
| C4 | Choisir un exercice ([ExercisePicker.tsx:49](../../../../apps/mobile/src/components/programs/ExercisePicker.tsx#L49) — `Modal` `pageSheet`, plein écran sur Android), depuis programme, modèle, Progression | — | ∅ | **recherche**, `FlatList` | 🟢 | M (dans son `SafeAreaView`) |

### 2.4 Famille D — feuilles dans une `Modal` (11 feuilles)

Huit suivent le même montage : `Modal transparent` → fond pressable en `flex: 1` → feuille en bas
(`maxHeight` 85 à 92 %) → `ScrollView`. Trois s'en écartent : D3 a un fond en remplissage absolu et pas
de `ScrollView` (`SaveTemplateSheet.tsx:41`, `:77`) ; D4 a le fond pressable **parent** de la feuille
(`EntryDetailModal.tsx:131`, `:290`) ; D5 a la feuille en `position: absolute`. Aucune ne remonte sur Android.

| # | Feuille | Ouverte depuis | Mécanisme | Champs (le plus bas en gras) | Impact | Change |
|---|---|---|---|---|---|---|
| D1 | Créer un exercice ([CreateExerciseModal.tsx:57](../../../../apps/mobile/src/components/exercises/CreateExerciseModal.tsx#L57)) | Exercices | **KAV-∅** (:64) | **nom**, groupe musculaire, **pied fixe** Annuler / Ajouter | 🔴 toute la feuille | M (le KAV disparaît) |
| D2 | Modifier un exercice ([EditExerciseModal.tsx:92](../../../../apps/mobile/src/components/exercises/EditExerciseModal.tsx#L92)) | Fiche exercice | **KAV-∅** (:99) | nom, **consignes** multilignes (:164), pied fixe | 🔴 | M (le KAV disparaît) |
| D3 | Enregistrer comme repas type ([SaveTemplateSheet.tsx:39](../../../../apps/mobile/src/components/nutrition/SaveTemplateSheet.tsx#L39)) | Nutrition › Aujourd'hui, page d'un jour | **KAV-∅** (:40) | **nom** (`autoFocus`), Annuler / Enregistrer | 🔴 toute la feuille | M (le KAV disparaît) |
| D4 | Détail d'une entrée ([EntryDetailModal.tsx:130](../../../../apps/mobile/src/components/nutrition/journal/EntryDetailModal.tsx#L130)) | idem | ∅ | grammes ; ou nom (`autoFocus`), kcal, **macros** (entrée rapide), Annuler / Enregistrer | 🔴 | M |
| D5 | Ajouter un aliment ([AddFoodSheet.tsx:163](../../../../apps/mobile/src/components/nutrition/AddFoodSheet.tsx#L163)) | idem | ∅ (feuille en `position: absolute`) | **recherche** (:242), résultats dessous | 🟠 les résultats | M + montage en colonne (§6.3) |
| D6 | Planning repas › ajouter ([meal-plan/index.tsx:391](../../../../apps/mobile/src/app/meal-plan/index.tsx#L391)) | Planning repas | ∅ | recherche, ou nom + kcal (ajout rapide) ; **grammes** sous la liste (:565) | 🔴 | M |
| D7 | Nouvel objectif ([GoalFormSheet.tsx:48](../../../../apps/mobile/src/components/goals/GoalFormSheet.tsx#L48)) | Objectifs | ∅ | recherche d'exercice, valeur cible, **lettre à son futur soi** (:251) | 🔴 | M |
| D8 | Lettre à ton futur toi ([GoalLetterSheet.tsx:59](../../../../apps/mobile/src/components/goals/GoalLetterSheet.tsx#L59)) | Objectifs | ∅ | **lettre** multiligne (:138), Enregistrer | 🔴 | M |
| D9 | Mensurations ([MeasurementSheet.tsx:50](../../../../apps/mobile/src/components/measurements/MeasurementSheet.tsx#L50)) | Mensurations | ∅ | un champ par mensuration, **le dernier** (:183), Enregistrer | 🔴 | M |
| D10 | Check-in du jour ([WellbeingCheckinSheet.tsx:61](../../../../apps/mobile/src/components/wellbeing/WellbeingCheckinSheet.tsx#L61)) | Bien-être | ∅ | **poids** (:227), Enregistrer | 🔴 | M |
| D11 | Check-in matin / soir ([MomentCheckinSheet.tsx:78](../../../../apps/mobile/src/components/wellbeing/MomentCheckinSheet.tsx#L78)) | Bien-être, hub Bien-être (Aujourd'hui, Journal) | ∅ | **poids** du matin (:316), Enregistrer | 🔴 | M |

### 2.5 Famille E — déjà couvertes par `useKeyboardHeight` (2 écrans)

| # | Écran | Mécanisme | Champs | Impact | Change |
|---|---|---|---|---|---|
| E1 | Séance classique ([workout.tsx:1257](../../../../apps/mobile/src/app/workout.tsx#L1257)) | hook | reps, charge ([SetActionBar.tsx:158](../../../../apps/mobile/src/components/workout/SetActionBar.tsx#L158)), note d'exercice ([SetOptions.tsx:172](../../../../apps/mobile/src/components/workout/SetOptions.tsx#L172), dans le défilement) | ✅ (gestuelle) — **3 boutons non vérifié** (§3 D7) | C (D7) |
| E2 | Séance immersive ([ImmersiveWorkout.tsx:308](../../../../apps/mobile/src/components/workout/immersive/ImmersiveWorkout.tsx#L308)) | hook | champs du pont, note d'exercice | ✅ idem | C (D7) |

### 2.6 Le compte

**45 surfaces** : 9 `FormScreen`, 18 écrans défilants nus, 5 surfaces de liste ou de panneau (dont une
modale plein écran), 11 feuilles, 2 déjà couvertes. **25 bloquantes** (🔴), 9 gênantes (🟠),
9 marginales ou présumées couvertes (🟢), 2 couvertes. Quatre `KeyboardAvoidingView` dans le code — `FormScreen` (`'height'`)
et trois `behavior={undefined}` (D1, D2, D3) — et **aucun** sur les 31 autres surfaces non couvertes.

## 3. Décisions — à valider

| # | Question | Proposition | Pourquoi | Alternatives |
|---|---|---|---|---|
| **D1** | Le **mécanisme** | **B — un conteneur maison unique** (`KeyboardAvoidingContainer`, §4), bâti sur les événements du hook existant : il **mesure sa propre position dans la fenêtre** (`measureInWindow`) et pose en bas un padding égal au recouvrement réel `max(0, bas du conteneur − haut du clavier)`. Une variante `KeyboardAwareScrollView` = conteneur + `ScrollView`, pour remplacer un `ScrollView` de formulaire sans toucher à son style | C'est le calcul de `KeyboardAvoidingView` `'padding'`, **en coordonnées absolues** : juste sous un en-tête natif, au-dessus d'une barre d'onglets, dans une feuille, dans la safe area — **sans réglage par écran**. 100 % JS : recettable sur le dev build déjà installé, publiable comme le reste | **A** — `KeyboardAvoidingView` avec un `behavior` par plateforme : faux sous en-tête (§1.2), corrigé seulement par un `keyboardVerticalOffset` par écran ; `'height'` fige la hauteur initiale. **C** — `react-native-keyboard-controller` : voir D6. **D** — `softwareKeyboardLayoutMode: "pan"` : la fenêtre entière glisse (l'en-tête sort de l'écran, les pieds fixes ne remontent pas), RN impose `ADJUST_RESIZE` aux fenêtres des `Modal` (les 11 feuilles resteraient couvertes), et il faudrait défaire le correctif de la séance |
| **D2** | Les **modales et feuilles** | **Le même conteneur, premier enfant de chaque `Modal`** (fenêtre plein écran en edge-to-edge) : la feuille, ancrée en bas, remonte au-dessus du clavier ; son `maxHeight` en % se calcule sur la place restante ; son `ScrollView` rétrécit, donc le champ actif remonte (§1.4). Modale plein écran (C4) : le conteneur dans son `SafeAreaView`. Les trois `KeyboardAvoidingView` iOS-only disparaissent. **Le conteneur d'une `Modal` est déclaré `kind="sheet"`** : une `Modal` RN n'est pas un portail, le contexte React la traverse, et plusieurs feuilles sont rendues **dans** un conteneur d'écran (`CreateExerciseModal` dans Exercices, les feuilles de `DayJournal` dans le hub Nutrition, `ExercisePicker` dans `TemplateComposer` et `SessionEditor`) ; sans `kind="sheet"`, la règle d'imbrication (§4) les rendrait passives. Le garde l'impose (§11.3, G3). Les fonds pressables passent en **remplissage absolu** (comme D3) : la zone de padding est assombrie elle aussi, sinon une bande claire apparaîtrait un instant à la fermeture du clavier | Une seule règle pour l'écran et la feuille ; la feuille garde sa forme | Transformer les feuilles en routes `presentation: 'formSheet'` (react-native-screens les fait monter avec le clavier) : refonte de 11 composants et de leur état, hors proportion |
| ⚠️ | *Condition de D2* | **Le premier critère de recette** (§14, critère 1) : si une feuille ne remonte pas, c'est que la vue racine de l'activité ne voit pas le clavier d'une fenêtre `Dialog` (§1.1). On s'arrête, et on passe au repli D6 — qui ne change que **l'intérieur** du conteneur, pas les 45 appels | C'est la raison pour laquelle `react-native-keyboard-controller` n'a supporté les `Modal` qu'à partir de sa 1.13 | — |
| **D3** | Le **défilement automatique** vers le champ actif | **Celui d'Android, sans code** : le conteneur fait rétrécir le `ScrollView`, Android fait défiler le champ qui a le focus pour le garder visible (§1.4) ; au changement de champ, `scrollToChild` ; pendant la frappe multiligne, le curseur reste visible (`requestChildRectangleOnScreen`). Le libellé d'un `TextField` est **au-dessus** du champ : il reste visible. Sur iOS, rien de natif équivalent → **hors périmètre** (BACKLOG, CLAV-02, avec le portage iOS) | Le comportement d'`adjustResize` d'avant SDK 54, retrouvé ; aucune mesure de champ à maintenir | Un défilement JS sur les deux plateformes (mesurer le champ actif, `scrollTo`) : double défilement sur Android, plus de code ; ou un écart de confort (16 dp) au-dessus du champ : non natif, demanderait le défilement JS |
| **D4** | Le **bouton de validation** en bas d'écran : visible au-dessus du clavier, ou non ? | **Non, pas de nouveau pied collant.** Un bouton **dans le flux** reste dans le flux : clavier ouvert, on l'atteint en faisant défiler — le conteneur garantit que la fin du contenu peut passer au-dessus du clavier, ce qui est faux aujourd'hui (E3). Les **pieds fixes qui existent déjà** (C1 en mode composer, C3, D1, D2, B14, B15, séance) **remontent** au-dessus du clavier, puisqu'ils sont dans le conteneur. Ceux qui portent leur propre `insets.bottom + 12` (C1, D1, D2) le gardent : clavier ouvert, ~24 dp d'écart au-dessus du clavier, accepté | Un pied collant sur ~30 formulaires change leur forme (maquette), et prend 70 à 100 dp — davantage à 200 % de police — sur les ~400 dp qui restent au-dessus du clavier d'un Pixel 6a | Un « Enregistrer » collant sur les longs formulaires (B3, B8, A2, A5) : maquette à produire, ouvrirait une US de forme |
| **D4b** | Le **pied à trois boutons** de « Un modèle » (B15) | **Il remonte, comme les autres** ; le critère 24 vérifie la place restante en grande police | Une règle sans exception ; ~280 dp restent pour le modèle en police normale | Masquer ce pied pendant la frappe (Démarrer / Dupliquer / Supprimer ne servent pas à la saisie) — à trancher si la recette le juge trop haut |
| **D5** | **iOS** | **Le même conteneur, sur les deux plateformes.** La seule différence reste celle des événements (`Will*` sur iOS, `Did*` sur Android — `keyboardEventNames`, inchangé). Sur iOS, les quatre `KeyboardAvoidingView` `'padding'` deviennent le conteneur : même effet, **plus juste** sous un en-tête (le défaut du §1.2 existe aussi sur iOS). Pas d'`automaticallyAdjustKeyboardInsets` (un seul chemin). Sur iOS, le conteneur anime son padding avec la durée du clavier (`Keyboard.scheduleLayoutAnimation`), comme le faisait `KeyboardAvoidingView` | Rien ne régresse : sur iOS, 12 surfaces avaient un évitement (`FormScreen`, D1-D3) et 2 le hook, 31 aucun (iOS ne redimensionne pas non plus) ; toutes l'ont | Garder `KeyboardAvoidingView` `'padding'` sur iOS : deux règles, et le défaut d'en-tête conservé |
| ⚠️ | *Limite de D5* | **Aucune recette iOS possible aujourd'hui** (iOS hors lancement, décision E) : la branche iOS du calcul est couverte par les tests unitaires ; les critères iOS (§14.4) attendent la première build iOS. **Un écart connu pour ce jour-là** : dans une `Modal` `pageSheet` iOS (C4, une vraie feuille décalée du haut), `measureInWindow` est relatif à la feuille, pas à l'écran — à reprendre avec le portage (CLAV-02) | — | — |
| **D6** | **Une bibliothèque tierce** ? | **Non, pas maintenant.** `react-native-keyboard-controller` (listée par Expo SDK 57) est le **repli écrit d'avance**, si le critère 1 échoue (feuilles) ou si le saut d'après-animation (DD3) est jugé inacceptable. Ce serait alors une décision à part (Florian et/ou Damien), parce qu'elle coûte : module natif → nouvelle build de dev et nouvel APK pour chacun ; `runtimeVersion` figé à `"1.0.0"` avec `expo-updates` → à relever, sinon une mise à jour OTA chargerait un JS qui appelle un module absent des anciens binaires ; `KeyboardProvider` à la racine remplace l'écouteur d'insets que react-native-screens pose sur la *decor view* (ticket ouvert #1683, 15/10/2026, signalé sur RN 0.86 et screens 4.26 — le projet est en 4.25.2) ; mocks Jest ; recette de la séance à rejouer | Ce qu'elle apporte (animation image par image, `KeyboardStickyView`, barre précédent / suivant, `Modal` supportée depuis la 1.13) n'est **pas nécessaire** pour que le dernier champ soit visible | L'installer d'emblée |
| **D7** | L'**écran de séance** (E1, E2) | **Il passe sur le conteneur, en dernier**, en gardant son comportement validé (barre au-dessus du clavier, rien ne saute à la fermeture — critères 68-69 rejoués) | Une seule règle : aujourd'hui deux formules coexistent. Celle de la séance pose `height` (clavier **au-dessus de la barre de navigation**) en retirant l'arête basse — exact seulement si la vue racine s'arrête à la barre de navigation, ce qui n'est plus le cas en edge-to-edge (§1.3) : la barre passe d'un inset sous le haut du clavier, ~24 dp en gestuelle (jugé visible le 13/09, la barre a 12 dp de marge), 48 dp en **3 boutons** (non vérifié). Le conteneur la pose exactement au haut du clavier : l'attendu de K4 / K5 change d'un inset (§11.1) | La laisser telle quelle : le garde accepterait `useKeyboardHeight` comme seconde règle |
| **D8** | **`keyboardShouldPersistTaps`** | **`"handled"` partout où le conteneur fait défiler** (imposé par `KeyboardAwareScrollView`) | Sans lui, le premier appui sur « Enregistrer » clavier ouvert **ferme le clavier sans enregistrer**. Dix surfaces (onze `ScrollView`) n'ont pas la prop aujourd'hui : B3, B5, B7, B8, B9 (deux), B16, B18 (`StageScrollView`), D6, D9, D10 ; plus deux `FlatList` de C2 (`food-picker.tsx:227`, `:248`), qui la reçoivent aussi. Effet de bord accepté : sur un écran qui **reste affiché** après validation, le clavier reste ouvert — B7 (la pesée) le ferme dans son gestionnaire (`Keyboard.dismiss()`) | Au cas par cas |
| **D9** | Les **listes sous une recherche** (C1, C2, C4, D5, D6, B17, B18) | **La liste s'arrête au-dessus du clavier** (conteneur) : les derniers résultats et les actions de pied de liste restent atteignables pendant la frappe. Pas de `keyboardDismissMode` ajouté | Même règle ; ne change aucun geste | Fermer le clavier au défilement (`on-drag`) : un geste en plus, hors sujet |
| **D10** | Le **filet** et le **garde** | **Les tests de caractérisation d'abord**, verts sur le code d'aujourd'hui (étiquetés K1 à K6, §11) ; puis un **test-garde** à cliquet (§11.3) : aucun `KeyboardAvoidingView` de `react-native` hors du module clavier ; tout fichier qui rend un champ de saisie figure à l'inventaire avec sa couverture, vérifiée ; un fichier qui rend une `Modal` **et** un champ pose lui-même un conteneur `kind="sheet"` (un parent ne couvre pas une autre fenêtre). Le garde lit le code avec l'analyseur TypeScript (déjà en dépendance de dev), pas avec des regex : alias d'import, génériques (`RefObject<ScrollView>`), commentaires et props fléchées trompent une regex (constats de la relecture, §15) | Le défaut ne se voit ni au typecheck, ni au lint, ni en test : seulement sur appareil, clavier ouvert. Le garde est le seul filet qui survit à la recette | Une revue manuelle à chaque nouveau formulaire |
| **D11** | Le **mode de livraison** | **Un lot**, toutes les surfaces (ton habitude) ; le critère 1 (feuilles) se recette **en premier** | Les 45 surfaces appellent le même conteneur : si le critère 1 échoue, seul le conteneur change | Un point d'étape sur trois surfaces représentatives (A2, B3, D8) avant les autres |
| **D12** | La **recette** — étendue | **Chaque surface en petite et en grande police**, navigation gestuelle (§14.2) ; **TalkBack et navigation à 3 boutons sur une surface par famille** (§14.3) | 45 × 2 passes, c'est déjà ~1 h 30 ; TalkBack et la barre à 3 boutons éprouvent le **conteneur**, identique d'une surface à l'autre de la même famille | TalkBack et 3 boutons sur les 45 |

**Décisions dérivées** (à relire, pas d'arbitrage attendu) :

| # | Proposition |
|---|---|
| DD1 | `useKeyboardHeight` devient **`useKeyboardFrame`** (`components/keyboard/`) : `{ visible, height, screenY }`, mêmes événements ; `keyboardEventNames` y déménage avec son test, **attendus inchangés** (K1). État initial lu dans `Keyboard.isVisible()` / `Keyboard.metrics()` : un conteneur monté **alors que le clavier est déjà ouvert** (une feuille ouverte pendant qu'on tapait dans l'écran) le voit tout de suite. (Un `autoFocus` — D3, D4, `recipe-edit.tsx:74`, `:208` — ouvre le clavier **après** le montage : l'événement arrive normalement.) |
| DD2 | `FormScreen` garde son API (`children`, `edges`) et son rendu (padding 24, gap 16, `flexGrow: 1`) : seul l'intérieur change. Ses six écrans sans champ ne bougent pas. |
| DD3 | **Le contenu remonte une fois le clavier ouvert, pas pendant son animation** (Android n'émet que `keyboardDidShow`) : un court saut, comme en séance aujourd'hui. Limite connue ; repli D6 si la recette la juge gênante. |
| DD4 | **Arête basse de safe area — jamais par défaut.** Le conteneur n'ajoute **que** le recouvrement : clavier fermé, padding = celui de l'appelant, rien ne change (§4). Une option explicite, `safeAreaBottom`, lui fait **reprendre** l'arête basse d'un `SafeAreaView` : padding = `max(inset bas, recouvrement)` — clavier fermé, l'inset comme avant ; ouvert, pas d'inset **en plus** du clavier (le motif de la séance, généralisé). Elle ne sert qu'aux surfaces dont l'arête basse était posée **juste autour** de la colonne : `FormScreen` (si ses `edges` contiennent `'bottom'`), le pied de B14 et B15, la séance (E1, E2). Partout ailleurs, la mesure suffit : un conteneur posé au-dessus d'un inset déjà appliqué par un parent (`Screen` par défaut, B17) a son bas au-dessus de l'inset, et le recouvrement mesuré le déduit. |
| DD5 | Les écrans **cachés** (sous une `Modal`, onglet inactif, écran du dessous de la pile) reçoivent aussi l'événement et prennent le padding sans qu'on le voie ; à la fermeture du clavier, tout revient à 0. Pas de filtrage par focus de navigation : une `Modal` n'est pas un écran. |
| DD6 | **Hors périmètre, documentés** : écran partagé / multi-fenêtre (`screenY` en coordonnées d'écran, `measureInWindow` en coordonnées de fenêtre) ; clavier physique ou flottant (recouvrement 0 → rien ne bouge, à juste titre) ; paysage (l'app est verrouillée en portrait) ; web (pas d'événement clavier → 0). |
| DD7 | **Aucune chaîne neuve** (i18n §9), aucune donnée (offline §10), aucune migration, aucune sync rule, aucune dépendance (§12) → recettable sur le dev build existant via Metro, **sans build EAS**. |

## 4. La règle

> **Toute surface où l'on tape est posée dans un `KeyboardAvoidingContainer`** — directement, par
> `KeyboardAwareScrollView`, ou par `FormScreen` qui l'enveloppe. Le conteneur est en colonne, ses
> enfants rétrécissent ; il pose en bas **exactement** ce que le clavier recouvre de lui.

```
recouvrement = max(0, basDuConteneurDansLaFenêtre − hautDuClavier)
padding bas  = padding bas de l'appelant
             + (safeAreaBottom ? max(insetBas, recouvrement) : recouvrement)      (DD4)
```

Clavier fermé, le recouvrement vaut 0 : **le conteneur ne change rien** à l'écran qui l'accueille (sauf
`safeAreaBottom`, qui rend exactement l'arête basse qu'il remplace). Le padding bas de l'appelant
(`padding: 16` de `QuantityPanel`, de la racine de `food-picker`…) est **conservé et additionné**, jamais
écrasé.

- **Une source** : `useKeyboardFrame` (le hook d'aujourd'hui, complété — DD1).
- **Une formule** : `keyboardOverlap()`, **pure**, testée sur les deux plateformes (§11.2).
- **Deux formes** : `KeyboardAvoidingContainer` (une colonne : écran avec pied fixe, feuille, liste) et
  `KeyboardAwareScrollView` (le conteneur + un `ScrollView`, qui reprend le style de l'appelant et impose
  `keyboardShouldPersistTaps="handled"` — D8).
- **Un seul endroit** : `apps/mobile/src/components/keyboard/`. Aucun `KeyboardAvoidingView` de
  `react-native` ailleurs (garde, §11.3).
- **Un seul conteneur actif par fenêtre et par branche** : un conteneur posé dans un autre conteneur de
  la même fenêtre est passif — c'est le plus extérieur qui décale (ex. `TemplateComposer` dans
  « composeur + pied fixe » de B14, B15). Sans cette règle, deux conteneurs décaleraient deux fois, puis
  sauteraient.
- **`kind="sheet"` ouvre une autre fenêtre** : le conteneur posé en premier enfant d'une `Modal` est
  toujours actif et repart d'un contexte neuf. Une `Modal` RN n'est **pas** un portail : le contexte
  React la traverse, et plusieurs feuilles sont rendues dans un conteneur d'écran (D2). Le garde exige
  `kind="sheet"` dans tout fichier qui rend une `Modal` et un champ (G3).
- **Le haut du clavier** vient de `screenY` (§1.1). Si le critère 1 montre qu'il est faux dans une feuille,
  la correction se fait dans `keyboardOverlap()` (repli : `hauteurDuCadre − (height + insetBas)`, le cadre
  étant celui de `useSafeAreaFrame()` — la hauteur de fenêtre de RN exclut la barre de navigation sur
  certaines versions d'Android), une seule fois — jamais dans un écran.

## 5. Règles métier

- **R1 — Le dernier champ se voit.** Clavier ouvert, le champ qui a le focus est entièrement visible
  au-dessus du clavier, sans geste ; s'il est plus haut que la place restante (multiligne, grande
  police), sa ligne de curseur l'est.
- **R2 — La fin du contenu s'atteint.** Clavier ouvert, on peut faire défiler jusqu'au dernier élément
  (bouton compris) et le voir au-dessus du clavier.
- **R3 — Un pied fixe reste au-dessus du clavier** (D4) ; un bouton dans le flux reste dans le flux.
- **R4 — Le premier appui valide** : un appui sur un bouton, clavier ouvert, déclenche le bouton (D8).
- **R5 — Rien ne saute à la fermeture** : le clavier fermé, la disposition revient exactement à celle
  d'avant, sans bande vide, sans chevaucher la barre de navigation.
- **R6 — Une feuille ne dépasse jamais le haut de l'écran** : son `maxHeight` se calcule sur la place
  restante au-dessus du clavier.
- **R7 — Aucun réglage par écran** : aucune surface ne connaît la hauteur d'un en-tête, d'une barre
  d'onglets ou d'une barre de navigation.

## 6. Ce qui change, famille par famille

### 6.1 `FormScreen` (A1-A9)

`SafeAreaView edges={edges sans 'bottom'}` → `KeyboardAwareScrollView safeAreaBottom` (si `edges`
contenait `'bottom'` — c'est le cas par défaut ; l'arête basse est alors rendue par le conteneur, DD4).
Le `KeyboardAvoidingView` `'height'` disparaît. Effet visible : A2, A3, A6 (sous en-tête) remontent
désormais **assez** ; les autres comme avant ou mieux (le champ actif remonte seul).

### 6.2 Écrans défilants (B1-B18)

Le `ScrollView` racine devient `KeyboardAwareScrollView`, mêmes props. Écrans sous `Screen`
(`programs/edit`, `running-programs/edit`, `templates/*`, `history/[id]`, `body`, `planning/plan`) :
`Screen` inchangé, le `ScrollView` intérieur remplacé. Ces écrans n'avaient pas d'arête basse
(`edges={['top']}`) ou l'avaient posée autour (`<Screen>` par défaut, B17) : pas de `safeAreaBottom`,
clavier fermé rien ne change. B14, B15 : la colonne « composeur + pied fixe » passe dans un
`KeyboardAvoidingContainer safeAreaBottom`, qui reprend l'arête basse du `SafeAreaView` du pied (DD4). B18 : `StageScrollView` (qui sert tous les hubs) pose le conteneur autour de son
`ScrollView` — sans effet sur les hubs sans champ.

### 6.3 Listes, panneaux et feuilles (C1-C4, D1-D11)

- C1, C2 : la vue racine de l'écran devient un `KeyboardAvoidingContainer` (son `padding: 16` est
  conservé). Le pied « Commencer » de C1 garde son `insets.bottom + 12`. C2b : les deux panneaux
  deviennent défilants (`KeyboardAwareScrollView`, même style, `flex: 1` passé en `flexGrow: 1` dans
  `contentContainerStyle` — sinon le panneau ne défile pas) : en grande police, les macros et « Ajouter »
  restaient inatteignables. C3 : `QuantityPanel` dans un conteneur (le pied remonte, son `padding: 16`
  est conservé).
- C4 et D1-D11 : le conteneur `kind="sheet"` est le **premier enfant de la `Modal`** (`flex: 1`,
  `justifyContent: 'flex-end'`), la feuille dedans ; le fond pressable passe en **remplissage absolu**
  (`StyleSheet.absoluteFill`, comme D3) pour assombrir aussi la zone de padding — sans quoi une bande
  claire paraîtrait un instant à la fermeture du clavier (`keyboardDidHide` arrive après l'animation).
  Clavier fermé, rendu identique. D1, D2 : leur pied fixe garde son `paddingBottom: insets.bottom + 12`.
  D4 : le `Pressable` parent qui sert de fond reste le parent, le conteneur se pose au-dessus de lui et
  porte le voile sombre (même effet que le fond absolu des autres feuilles).
- **D6** : la feuille n'est pas défilante (une liste en `maxHeight: 240`, puis les grammes, les
  portions, le bouton). En grande police, clavier ouvert, elle peut dépasser la place restante et
  couper son bas. La liste garde son `maxHeight: 240` et reçoit `flexShrink: 1` : c'est elle qui cède
  la place en premier. Rendu identique quand tout tient (critère 38).
- **D5** : la feuille d'ajout d'aliment est en `position: absolute; bottom: 0` — un enfant absolu ne suit
  pas le padding de son parent. Elle passe dans le flux (même fond absolu, feuille en bas de colonne,
  mêmes dimensions) : **même rendu**, vérifié au critère 37.

### 6.4 Séance (E1, E2) — D7

Le `SafeAreaView` racine garde `edges={['top']}` en permanence et la colonne (en-tête, défilement,
barre) passe dans un `KeyboardAvoidingContainer safeAreaBottom` : clavier fermé, padding = inset bas
(comme `edges={['top','bottom']}` aujourd'hui) ; ouvert, padding = recouvrement — **un inset de plus**
que `keyboardHeight` aujourd'hui (§1.3) : la barre s'arrête exactement au haut du clavier. `useKeyboardHeight` n'a alors plus d'appelant : retiré, ses tests passent sur
`useKeyboardFrame`.

## 7. Cas limites

| Cas | Comportement |
|---|---|
| Conteneur monté clavier déjà ouvert (feuille ouverte pendant la frappe) | État initial lu dans `Keyboard.metrics()` (DD1) ; le conteneur se mesure à son premier `onLayout` et applique aussitôt |
| Champ avec `autoFocus` (D3, D4, B9) | Le clavier s'ouvre après le montage : événement normal |
| Pied qui porte son propre inset (C1, D1, D2 : `insets.bottom + 12`) | Clavier ouvert, ~24 dp d'écart entre le pied et le clavier — accepté (D4) |
| Feuille non défilante plus haute que la place restante (D6, grande police) | La liste cède la place (`flexShrink`, §6.3) |
| Passage clavier lettres ↔ chiffres ↔ emoji (hauteur qui change, clavier ouvert) | RN réémet `keyboardDidShow` à chaque changement de hauteur (`ReactRootView`) : recouvrement recalculé |
| Fermeture par le geste retour | `keyboardDidHide` → padding = celui de l'appelant (+ inset bas avec `safeAreaBottom`) ; R5. Dans une feuille, le fond absolu couvre la zone le temps que l'événement arrive |
| Un champ plus haut que la place restante (multiligne en 200 %) | Android garde le curseur visible ; R1 |
| Feuille plus haute que la place restante | `maxHeight` en % de la place restante (R6) ; son défilement interne prend le relais |
| Le contenu change de hauteur clavier ouvert (ligne reconnue en B4, micronutriments dépliés en B3) | Le conteneur ne bouge pas (son cadre extérieur est fixe) ; le `ScrollView` défile normalement |
| La feuille s'ouvre en glissant (`animationType="slide"`) | L'animation déplace la fenêtre `Dialog`, pas le conteneur dans sa fenêtre : `measureInWindow` n'en dépend pas |
| Écran sous une `Modal` ou en arrière-plan | Prend le padding sans qu'on le voie, revient à 0 (DD5) |
| Barre d'onglets (B18) | Le conteneur s'arrête au-dessus d'elle : le recouvrement mesuré la déduit (R7) |
| Conteneur dans un conteneur (B14, B15) | L'intérieur est passif, l'extérieur décale (§4) |
| Première image, avant toute mesure | Le conteneur suppose qu'il touche le bas du cadre (`useSafeAreaFrame()`) ; corrigé dès la mesure. Clavier fermé, sans effet |
| Navigation à 3 boutons | Même formule : `screenY` est le haut du clavier, barre comprise (critère 47) |
| Clavier physique, flottant, écran partagé, paysage, web | DD6 |

## 8. Accessibilité

- **TalkBack** : le conteneur n'ajoute aucun élément accessible ; l'ordre de lecture ne change pas. Clavier
  ouvert, balayer jusqu'au dernier champ puis jusqu'au bouton : ils sont annoncés **et** visibles
  au-dessus du clavier — le `ScrollView` rétréci défile vers l'élément qui reçoit le focus d'accessibilité
  (critère 46).
- **Grande police** : aucun plafond de taille n'est posé ; la règle ne dépend d'aucune hauteur de texte.
  Chaque surface est recettée à la taille de police **maximale** du système (200 % sur Android 14+), en
  plus de la minimale (§14.2). C2b devient défilant pour cette raison.
- Les libellés existants (`accessibilityLabel` des champs, repris de leur `label` par `TextField`) ne
  changent pas.

## 9. i18n

**Aucune chaîne neuve.** Le conteneur n'affiche rien. Si l'implémentation en ajoutait une (elle ne le
prévoit pas), FR et EN dans le même commit, parité contrôlée par `scripts/check-i18n-parity.mjs`.

## 10. Comportement offline

Sans objet : la règle est purement d'affichage, ne lit ni n'écrit aucune donnée, et se comporte
identiquement en mode avion. Les écritures des formulaires (repository, PowerSync) ne changent pas.

## 11. Le filet, puis le garde

### 11.1 Le filet — tests de caractérisation, verts sur le code d'aujourd'hui

Écrits **avant** toute modification. Chacun est étiqueté ; son attendu ne change qu'à l'étape du plan
qui le touche, et le commit le dit.

| # | Ce qu'il fige aujourd'hui | Change à |
|---|---|---|
| K1 | `keyboardEventNames` : `Did*` sur Android, `Will*` sur iOS (test existant) | **jamais** |
| K2 | `FormScreen` : un `KeyboardAvoidingView` `'height'` sur Android, `'padding'` sur iOS ; `edges` haut + bas par défaut ; un `ScrollView` en `keyboardShouldPersistTaps="handled"`, padding 24 / gap 16 / `flexGrow: 1` | étape 3 : le KAV devient le conteneur, `'bottom'` quitte les `edges` du `SafeAreaView` pour le `safeAreaBottom` du conteneur ; le `ScrollView` et son style ne bougent pas |
| K3 | D1, D2, D3 : `KeyboardAvoidingView` sans `behavior` sur Android, `'padding'` sur iOS | étape 6 |
| K4 | Séance classique, hook simulé : clavier fermé → `edges` haut + bas, pas de padding ; ouvert à 300 → `edges` haut, `paddingBottom` 300 | étape 7 : fermé, padding bas = inset (24) comme avant ; ouvert, **324** (300 + l'inset que la formule d'aujourd'hui oublie, §1.3, D7) |
| K5 | Séance immersive : idem | étape 7 |
| K6 | Liste des `ScrollView` / `FlatList` de formulaire **sans** `keyboardShouldPersistTaps` (les 13 de D8 : onze `ScrollView`, deux `FlatList`) | étapes 4 à 6 (la liste se vide) |

Contrainte connue : sous RNTL v14, un `setState` déclenché par un abonnement natif simulé ne se propage
pas au rendu (constat de MUSCU-UX01, en tête de `useKeyboardHeight.test.ts`). Les tests de rendu
**simulent donc le module** du hook (`jest.mock`), pas l'émetteur natif. Et RNTL v14 ne rend que l'arbre
hôte (plus d'`UNSAFE_getByType`, constat de `planning-screen.test.tsx`) : le `behavior` d'un
`KeyboardAvoidingView` et les `edges` d'un `SafeAreaView` se lisent par un `jest.mock` local du module
qui expose ses props sur une vue hôte — l'étape 1 reste « tests seulement ».

### 11.2 La brique

- `keyboardOverlap()` (pure) : clavier fermé → 0 ; conteneur au bas de la fenêtre → hauteur au-dessus du
  haut du clavier ; conteneur au-dessus d'une barre d'onglets → déduite ; conteneur entièrement au-dessus
  du clavier → 0 ; jamais négatif ; arrondi ; écran vs feuille (DD4) ; iOS et Android.
- `KeyboardAvoidingContainer` et `KeyboardAwareScrollView`, hook et mesure simulés : padding appliqué ;
  **clavier fermé, aucun padding ajouté** sans `safeAreaBottom` ; padding de l'appelant additionné, pas
  écrasé ; `safeAreaBottom` ; imbrication passive ; `kind="sheet"` actif dans un conteneur d'écran ;
  `keyboardShouldPersistTaps` imposé ; props, style et `ref` de l'appelant transmis.
- La mesure (`measureInWindow`) testée elle-même, avec le patron de la « vue mesurable » de
  `planning-screen.test.tsx` — sous Jest, l'appel natif ne rappelle jamais : appel protégé.

### 11.3 Le garde — `keyboard-coverage-guard.test.ts`

Le garde **lit le code avec l'analyseur TypeScript** (`typescript`, déjà en dépendance de dev de
`apps/mobile`) : il parcourt les imports et les éléments JSX, ce qu'une regex ne fait pas sans se
tromper (alias `Animated.createAnimatedComponent(TextInput)`, `Omit<TextInputProps>`,
`RefObject<ScrollView | null>`, commentaires, imports sur plusieurs lignes, `=>` dans les props).

1. **G1** — Aucun fichier de `apps/mobile/src` hors de `components/keyboard/` n'importe
   `KeyboardAvoidingView` de `react-native`. On ne peut plus écrire `behavior={undefined}`.
2. **G2** — Un fichier « à champ » = il importe **en valeur** `TextInput` de `react-native` (alias
   compris) ou rend `TextField`, `DeferredTextField`, `DraftNumberInput`, `ExerciseTargetsFields` ; une
   liste explicite de lecture seule l'exempte (`AnimatedNumber`). Tout fichier à champ — et tout fichier
   intermédiaire d'une chaîne de couverture (`WorkoutReport`, `SessionEditor`, `CurrentSetCard`,
   `HistorySection`…) — figure dans l'**inventaire du test** :
   - `self` : il importe `KeyboardAvoidingContainer` ou `KeyboardAwareScrollView`, ou une **enveloppe
     déclarée** de la règle — `FormScreen`, `OnboardingScaffold`, `StageScrollView`, chacune vérifiée
     `self` elle-même (c'est ce qui couvre la composition par `children` : `infos.tsx` par
     `OnboardingScaffold`, `(tabs)/strength` par `StageScrollView`) ;
   - `coveredBy: [fichiers]` : vérifié **dans les deux sens** — chaque fichier couvrant importe le
     composant, **et** l'ensemble de ses importeurs réels (hors `__tests__`) est égal à `coveredBy`. Un
     nouvel écran qui rendrait `QuantityPanel`, `TemplateComposer` ou `WorkoutReport` sans conteneur
     échoue ; la chaîne remonte jusqu'à un `self`, cycle interdit.
   Un fichier à champ absent de l'inventaire échoue avec un message qui renvoie à cette spec.
3. **G3** — Un fichier qui rend une `<Modal` **et** un champ doit être `self` **avec un conteneur
   `kind="sheet"`** : un parent ne couvre pas une autre fenêtre, et sans `kind="sheet"` le conteneur
   serait passif dans un conteneur d'écran (§4).
4. **Cliquet** — À l'étape 1, les fichiers des 43 surfaces non couvertes et les 4 `KeyboardAvoidingView`
   sont listés « à migrer » : le test passe et **interdit d'en ajouter**. Chaque étape vide sa part ; à la
   dernière, la liste « à migrer » doit être vide (assertion).

## 12. Migration, déploiement, build : aucun

Aucune migration, aucune sync rule PowerSync, aucun `db:types`, aucune dépendance native, aucun appel au
projet Supabase, aucun déploiement, aucun build EAS. Recette sur le dev build déjà installé, branché
sur Metro (`npm run mobile` depuis le worktree).

## 13. Hors périmètre, et écarts signalés

- **E1 — La prémisse du BACKLOG est en partie périmée.** « `FormScreen` passe `behavior={undefined}` »
  était vrai jusqu'au 18/07/2026 : depuis `b50ff64b` (Damien, « note facultative sous le clavier »),
  `FormScreen` passe `'height'` sur Android — correctif jamais recetté formellement (CHANGELOG du
  18/07 : « Reste : recette device »). Le constat du 12/09 (CHANGELOG MUSCU-UX01, puis BACKLOG) reposait
  sur une lecture antérieure. Seules les trois feuilles D1-D3 passent `undefined`. Et `'height'` a son
  propre défaut (§1.2) : A2, A3, A6 (sous en-tête) restent en partie couverts ; les six autres sont
  présumés justes.
- **E2 — « `useKeyboardHeight` est réutilisable tel quel » : en partie.** Ses événements, oui ; sa valeur
  seule, non (§1.3) — elle obligerait chaque écran à connaître ce qui le sépare du bas de la fenêtre.
  Le conteneur la complète par sa position mesurée.
- **E3 — « Moins bloquant qu'en séance : ces écrans défilent, on peut faire remonter le champ à la
  main » : faux pour 25 surfaces.** Le `ScrollView` garde toute sa hauteur sous le clavier, donc sa fin
  **ne peut pas** passer au-dessus : le mot de passe et « Supprimer mon compte » (B1), la pesée (B7), le
  poids cible et « Enregistrer » (B8), toute feuille courte (D1, D3). La priorité P1 tient (aucune perte
  de donnée, le clavier se ferme d'un geste), mais l'impact est plus large qu'écrit.
- **E4 — Les deux incertitudes de la solution**, invérifiables sans appareil : les feuilles (D2 — la vue
  racine de l'activité voit-elle le clavier d'un `Dialog` ?) et la mesure sous en-tête natif (§1.5 —
  vérifiée dans le code de react-native-screens). Critère 1 en premier, puis A2 / A6 ; repli D6, à
  décider alors.
- **E6 — L'écran de séance validé est, d'après le code, court d'un inset** (§1.3) : D7 le corrige, et
  l'attendu de son test change d'autant (K4). Si la recette du 13/09 le jugeait bon, c'est qu'en
  gestuelle l'écart (24 dp) tombe dans la marge basse de la barre (12 dp) et dans le haut du clavier.
- **E5 — Ce que la demande impliquait et que la spec réduit** : TalkBack et navigation à 3 boutons sur
  une surface par famille, pas sur les 45 (D12). À dire si tu les veux partout.
- **Hors périmètre** : défilement automatique sur iOS (BACKLOG **CLAV-02**, avec le portage iOS — D3) ;
  barre « précédent / suivant / OK » au-dessus du clavier (`returnKeyType` chaînés) : confort, pas
  visibilité ; animation synchrone du clavier (DD3, repli D6).

## 14. Recette

### 14.1 Préparation

- Dev build déjà installé, Metro lancé depuis le worktree de la branche ; compte réel (aucune donnée
  à préparer : il suffit d'ouvrir les écrans).
- Pixel 6a, navigation **gestuelle**. Taille de police : **minimale** pour une première passe, puis
  **maximale** (Paramètres › Affichage › Taille d'affichage et texte) pour la seconde — la « taille
  d'affichage » reste par défaut.
- Pour chaque surface : toucher le champ **le plus bas** (en gras au §2), **sans faire défiler avant**.
  Attendu commun : (a) le champ remonte seul, entièrement visible au-dessus du clavier ; (b) on peut
  faire défiler jusqu'au bouton de validation et le voir au-dessus du clavier (ou il y est déjà, s'il
  est fixe) ; (c) un appui sur ce bouton, clavier ouvert, le déclenche ; (d) clavier fermé, **rien n'a
  bougé par rapport à avant la branche** — aucune bande ajoutée en bas d'écran, au-dessus de la barre
  d'onglets ou sous une feuille.

### 14.2 Critères (à porter dans RECETTES.md, §95 — numéro libre au 22/10/2026)

**La porte**

1. 🔴 **Une feuille remonte.** Objectifs › une lettre (D8) : toucher la lettre → **la feuille entière
   remonte** au-dessus du clavier. Puis Choisir un exercice (C4, `Modal` plein écran, même mécanisme) :
   rechercher → la liste s'arrête au-dessus du clavier. ⚠️ **Si l'une ne bouge pas, s'arrêter** : c'est
   E4, repli D6 à décider.

**Famille A — `FormScreen`** (petite **et** grande police à chaque critère)

2. A1 Connexion — mot de passe, « Se connecter ».
3. A2 Inscription — année de naissance, puis case CGU et bouton (sous en-tête : c'était court).
4. A3 Mot de passe oublié — e-mail, bouton.
5. A4 Nouveau mot de passe — confirmation, bouton.
6. A5 Onboarding › Infos — taille, pied Retour / Suivant (métrique, puis impérial : pieds / pouces).
7. A6 Saisir une activité — kcal de la montre, « Enregistrer » (sous en-tête : c'était court).
8. A7 Fin de séance — « Enregistrer comme modèle », toucher le nom (le plus bas) ; puis ouvrir la note de
   ressenti et la toucher.
9. A8 Fin de course — note, « Enregistrer » ; puis distance et durée manuelles.
10. A9 Analyse d'une course — distance corrigée, « Enregistrer la correction ».

**Famille B — écrans défilants**

11. B1 Supprimer mon compte — mot de passe, « Supprimer » visible. **Ne pas appuyer.**
12. B2 Labo IA — question (taper 4 lignes), « Envoyer ».
13. B3 Créer un aliment — déplier les micronutriments, toucher le dernier, « Enregistrer » ; un appui
    suffit (D8). Annuler sans enregistrer.
14. B4 Saisie en phrase — « 2 œufs, 1 banane, 100 g de riz » puis les grammes de la **dernière** ligne.
15. B5 Mes repas — le nom du dernier repas.
16. B6 Réglages › Nutrition — allergènes.
17. B7 Statistiques nutrition — pesée et « Enregistrer » ; un appui suffit, et le clavier se ferme
    (D8).
18. B8 Mon profil — poids cible, « Enregistrer » ; un appui suffit.
19. B9 Recette — modifier les grammes du dernier ingrédient, « Enregistrer », puis « Terminé ».
20. B10 Réglages › Course — allure de référence, après avoir fait défiler pour la placer en bas.
21. B11 Planifier un programme — durée.
22. B12 Programme muscu — étape 2, un programme d'au moins 3 exercices : charge et repos du **dernier**,
    puis « Terminé ».
23. B13 Programme course — étape 2 : le dernier champ du dernier bloc de fractionné, puis « Terminé ».
24. B14 Nouveau modèle (étape 2) et B15 Un modèle — la cible du dernier exercice : le pied (« Terminé » ;
    Démarrer / Dupliquer / Supprimer) est **au-dessus** du clavier, et en **grande police** il reste de
    la place pour lire le champ (D4b).
25. B16 Une séance passée — note de ressenti.
26. B17 Mon corps — choisir un muscle, rechercher : la recherche et les premiers résultats au-dessus du
    clavier.
27. B18 Musculation › Historique › Exercices — recherche : la liste se lit au-dessus du clavier.

**Famille C — listes et panneaux**

28. C1 Exercices — rechercher : le dernier résultat atteignable clavier ouvert. Puis en mode
    « composer » une séance : le pied « Commencer » au-dessus du clavier (un écart d'un inset entre les
    deux est attendu, D4).
29. C2 Choisir un aliment — rechercher : « Créer un aliment » atteignable clavier ouvert.
30. C2b — Ajout rapide : les trois macros et « Ajouter » ; portions d'une recette et « Ajouter ».
31. C3 Quantité — après un choix **et** après un scan : grammes, le pied Annuler / Ajouter au-dessus du
    clavier.
32. C4 Choisir un exercice (depuis un programme, un modèle, Progression) — rechercher : la liste
    s'arrête au-dessus du clavier.

**Famille D — feuilles**

33. D1 Créer un exercice — nom : la feuille et son pied au-dessus du clavier.
34. D2 Modifier un exercice — consignes (4 lignes), pied visible.
35. D3 Enregistrer comme repas type — le clavier s'ouvre seul : la feuille est **déjà** au-dessus.
36. D4 Détail d'une entrée — modifier une entrée pesée (grammes), puis une entrée rapide (macros).
37. D5 Ajouter un aliment — **même aspect qu'avant clavier fermé** (montage changé, §6.3) ; rechercher :
    résultats au-dessus du clavier.
38. D6 Planning repas › ajouter — onglet Aliments, choisir un aliment, grammes ; onglet Rapide, kcal.
    En **grande** police : les grammes et le bouton restent visibles, c'est la liste qui rétrécit (§6.3).
39. D7 Nouvel objectif — la lettre en bas du formulaire.
40. D8 Lettre — déjà vu au critère 1 ; ici en **grande** police, 10 lignes : le curseur reste visible.
41. D9 Mensurations — la dernière mensuration, « Enregistrer ».
42. D10 Check-in du jour — poids, « Enregistrer ».
43. D11 Check-in du matin — poids, « Enregistrer » ; depuis Bien-être **et** depuis le hub.

**Séance — non-régression (D7)**

44. E1 Séance classique — rejouer les critères 68 et 69 de §57 : la barre (deux champs **et** « Valider
    la série ») entièrement au-dessus du clavier ; à la fermeture, rien ne saute, pas de bande vide, rien
    sous la barre gestuelle. Puis la note d'exercice (options).
45. E2 Séance immersive — idem pour le pont.

**Transverses (une surface par famille — D12)**

46. **TalkBack**, clavier ouvert, sur A5, B8, C3, D9 et E1 : balayer jusqu'au dernier champ puis
    jusqu'au bouton — annoncés **et** visibles au-dessus du clavier ; le bouton s'active d'un double
    appui.
47. **Navigation à 3 boutons** (Paramètres › Système › Navigation), sur A6, B3, C3, D8 et E1 : rien
    sous le clavier, pas de bande vide à la fermeture.
48. **Passer en emoji** dans la note de A8 : le contenu suit la nouvelle hauteur du clavier.
49. **Fermer par le geste retour**, sur B8, D8 et D10 : la disposition revient exactement (R5) ; sous la
    feuille, **aucune bande claire** ne paraît pendant que le clavier descend (fond absolu, §6.3).
50. **Écrans sans champ** de `FormScreen` — vérification d'e-mail, intro, récapitulatif, Activité,
    Objectif, Guidage et Piliers de l'onboarding, Activités, CGU, confidentialité (suppression en
    attente si un compte de test s'y prête) : rien n'a changé.
51. **Clavier fermé, rien n'a bougé** sur les écrans qui ont reçu le conteneur sans arête basse : les
    quatre hubs (bas de page au-dessus de la barre d'onglets), Mon profil, Créer un aliment, Programme
    muscu, Mon corps — aucune bande ajoutée en bas.

### 14.3 Ce que l'agent vérifie, sans geste de ta part

Typecheck, lint, suite complète (codes de sortie lus sans pipe) ; le garde (§11.3) avec une liste
« à migrer » **vide** ; parité i18n inchangée.

### 14.4 iOS — à la première build iOS (D5)

52. Une surface par famille (A2, B8, C3, D8, E1) : même attendu qu'au §14.1, sauf (a) — le champ ne
    remonte pas seul sur iOS (D3, CLAV-02) ; et C4 (`pageSheet`), écart connu (D5).

## 15. Relecture (22/10/2026)

Relecture par un agent de revue, en lecture seule, avec vérification dans le code de `3a3cda89` et dans
les sources installées de React Native 0.86.0 et react-native-screens 4.25.2. **Confirmés** :
l'inventaire (aucune surface manquante ni en double ; les 12 `Modal` à champ = D1-D11 et C4, les 18
autres sans champ, même par un enfant ; exactement 4 `KeyboardAvoidingView` ; colonne « en-tête natif »
juste partout), ~75 références de ligne, les comptes, les §1.1, §1.2, §1.4, D8, R6, la mesure dans une
`Modal`, E1, et le fait qu'aucun test existant ne fige un `KeyboardAvoidingView`, des `edges` ni
`keyboardShouldPersistTaps` (trois tests touchés, traités par le plan). Ce qu'elle a changé :

- 🔴 **DD4 aurait changé la forme d'une vingtaine d'écrans, clavier fermé** : `max(inset, recouvrement)`
  appliqué à tout conteneur d'écran ajoutait l'inset bas là où personne ne le posait (B1-B13, B16), le
  doublait (B17, C1) et posait une bande au-dessus de la barre d'onglets des quatre hubs (B18) — et le
  style de l'appelant aurait écrasé son propre `padding`. Désormais : le conteneur n'ajoute **que** le
  recouvrement ; l'arête basse n'est reprise que par l'option explicite `safeAreaBottom` (`FormScreen`,
  pied de B14 / B15, séance) ; le padding de l'appelant est additionné (§4, DD4) ; critère 51.
- 🟠 Une `Modal` RN n'est pas un portail, le contexte la traverse : sans `kind="sheet"` exigé par le
  garde, une feuille rendue dans un conteneur d'écran serait devenue passive en silence (§4, G3).
- 🟠 Le garde : couverture vérifiée dans les deux sens, enveloppes déclarées (`OnboardingScaffold`,
  `StageScrollView`), analyseur TypeScript au lieu de regex (alias, génériques, commentaires, props
  fléchées), fichiers intermédiaires inventoriés (§11.3).
- 🟠 D8 : dix surfaces (onze `ScrollView`, `StageScrollView` compris) et deux `FlatList`, pas neuf
  écrans ; le pied « Commencer » de C1 manquait ; la prémisse de la mesure sous en-tête (react-native-
  screens) est désormais nommée (§1.5, E4).
- 🟡 La séance est courte d'un inset d'après le code (§1.3, D7, E6 ; K4 passe de 300 à 324) ; les
  écrans `FormScreen` sans en-tête sont présumés couverts (§1.2) ; A7 (champ le plus bas) ; onze écrans
  `FormScreen` sans champ, pas six ; DD1 (`autoFocus`) ; montage des feuilles D3-D5 ; fonds en
  remplissage absolu ; D6 non défilante (`flexShrink`) ; C2b (`flexGrow`) ; B18 ; repli sur
  `useSafeAreaFrame()` ; coordonnées d'écran de `screenY` ; animation et `pageSheet` sur iOS ; version de
  react-native-screens ; B7 ferme le clavier après la pesée ; tests sous RNTL v14 (props lues par un mock
  local).
