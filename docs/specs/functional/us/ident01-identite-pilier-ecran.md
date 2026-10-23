---
id: IDENT-01
titre: "L'identité de pilier appartient à l'écran, pas à l'onglet — les écrans empilés de Musculation et de Nutrition déclarent leur pilier"
roadmap: [3.63, 4.46]
catalogue: []
etape: close
branche: fix/ident01-identite-pilier-ecran
maj: 23/10/2026
---

# US IDENT-01 — L'identité de pilier appartient à l'écran, pas à l'onglet

> **Demande** : Florian, 23/10/2026 — reprendre la ligne IDENT-01 du BACKLOG (P1, constat de
> CARDIO-UX02) : les écrans empilés de Musculation et de Nutrition héritent de la couleur du dernier
> onglet visité. Inventaire exhaustif, sort des écrans partagés ou sans pilier, correctif d'une ligne
> par écran, test de garde déjà écrit à étendre.
> **Sources** : BACKLOG, ligne IDENT-01 ; spec CARDIO-UX02 §1 et §4.3 ; spec DASH-01 (R4) ;
> [pillar-identity.test.ts](../../../../apps/mobile/src/app/__tests__/pillar-identity.test.ts) ;
> [useMenuFocus.ts](../../../../apps/mobile/src/hooks/useMenuFocus.ts) ;
> [menu-accent-store.ts](../../../../apps/mobile/src/stores/menu-accent-store.ts) ;
> [useTheme.ts](../../../../apps/mobile/src/theme/useTheme.ts) ;
> [(tabs)/_layout.tsx](../../../../apps/mobile/src/app/(tabs)/_layout.tsx) ; code installé :
> `expo-router` 57.0.3 (`build/useFocusEffect.js`, `build/link/useLoadedNavigation.js`,
> `build/react-navigation/core/useFocusEvents.js`, `routers/TabRouter.js`), `expo-status-bar` 57.0.0,
> `react-native/Libraries/Components/StatusBar/StatusBar.js`.
> **Plan** : [docs/plans/ident01-identite-pilier-ecran.md](../../../plans/ident01-identite-pilier-ecran.md).
> **Maquette** : **sans objet — aucun écran ne change de forme.** Un écran empilé prend la palette de
> son pilier (accent, surfaces teintées, en-tête natif), que MUSCU-UX04 a déjà dessinée et que le
> contrôle de contraste couvre pour les six identités. Rien n'est ajouté, déplacé ni retiré.
> **Roadmap** : rattachée aux lignes existantes 3.63 (Musculation) et 4.46 (Nutrition), désignées pour
> ce chantier le 23/10/2026. Aucune ligne neuve : c'est une correction (`fix/…`) de fonctionnalités
> livrées.
> **Recette** : aucune recette consignée (règle du 23/10/2026, « recette à la demande ») — l'US passera
> de `code` à `close` dans le commit qui livre. Les critères d'acceptation (§14.1) sont prouvés par
> les tests ; les parcours du §14.2 sont la liste à dérouler sur téléphone **si Florian le demande**.
> Le numéro RECETTES §98 réservé n'est donc pas utilisé.
> **Vérifié dans le code** le 23/10/2026 sur `origin/dev` (`d604dec2`) ; **relue** le même jour par un
> agent de revue (§15), dont les corrections sont intégrées.
> ✅ **Validée par Florian le 23/10/2026** : D1 à D12 **telles que proposées** (dont D7 et D8 sur le hook,
> et D12 hors périmètre : le `StatusBar` forcé de l'onglet Labo est retiré).
> 🛠️ **Codée et clôturée le 23/10/2026**, en un lot sur `dev` (rebasé sur CARDIO-08 et CIBLE-04) : le hook
> d'abord (filet vert, règles rouges), le garde (32 échecs nommés), puis les 22 écrans Musculation et les
> 10 écrans Nutrition. Relecture du code par un agent : rien de bloquant ; l'hypothèse de la pile est
> écrite dans le hook et gardée par un test, la règle « dès la première image » a son test, le garde est
> ancré sur l'instruction. Écarts au plan en fin de plan. Vérification sur téléphone : à la demande, avec
> les parcours du §14.2. Aucune migration, aucune sync rule, aucun déploiement.

## 0. Le besoin

Un pilier a une couleur — rouge fonte pour la Musculation, vert pour la Nutrition, bleu pour la
Course, terracotta pour l'Accueil. Depuis MUSCU-UX04 (19/09/2026), ce n'est plus un détail d'onglet :
l'accent, les surfaces des cartes et l'en-tête natif prennent la teinte du pilier affiché.

Mais *le pilier affiché* est aujourd'hui **le dernier écran qui s'est déclaré** — en pratique le
dernier onglet visité —, pas l'écran qu'on regarde. Ouvrir une séance depuis l'Accueil la rend en
terracotta ; ajouter un aliment depuis l'Accueil ouvre un sélecteur terracotta ; ouvrir les
statistiques nutrition depuis le Labo les rend dorées. Rien n'échoue, rien ne se voit en revue :
l'écran est simplement de la mauvaise couleur, et seulement pour qui est arrivé par la mauvaise porte.

CARDIO-UX02 l'a corrigé pour la Course le 19/09/2026. Il reste les deux autres piliers — et, en les
corrigeant, deux défauts que la correction de la Course a introduits sans qu'on les voie (§1.3).

## 1. Ce que dit le code

### 1.1 Le mécanisme

- `menu-accent-store` porte deux champs. **`activeMenu`** : l'identité affichée, lue par `useTheme()`
  (`pillarPalette(scheme, activeMenu)`), donc par les ~130 composants qui l'appellent et par les
  options d'en-tête du `Stack` racine. **`focusedMenu`** (DASH-01 R4) : « l'onglet **réellement au
  premier plan**, `null` quand un écran empilé le recouvre ».
- `useMenuFocus(menu)` pose les deux au focus de l'écran, et libère `focusedMenu` à la perte de focus
  (seulement s'il lui appartient encore).
- `focusedMenu` a trois lecteurs : la **barre d'état** de `(tabs)/_layout.tsx` (icônes claires dès que
  `focusedMenu` est non nul et différent de `home`) ; **`useLoopActive`** (boucles décoratives de
  `HomeStage`, `NutritionLevel`, `RunHeader`, toutes dans des onglets) ; l'arrivée animée de
  **`PillarStage`** (onglets, et la fiche d'un lien du Labo).

### 1.2 Le défaut

`useMenuFocus` est appelé par les **six onglets**, les **dix écrans Course** (CARDIO-UX02), et deux
écrans isolés (`session-preview`, `nutrition-day`). Les **32 autres écrans** de Musculation et de
Nutrition n'appellent rien : ils affichent l'`activeMenu` laissé par l'écran précédent.

Or ils ont des portes hors de leur onglet. Musculation : l'Accueil (carte « Maintenant » → séance,
brief, programmes ; parcours d'activation → Historique), le Planning (→ séance, brief), le Labo
(cartes et fiche d'un lien → Progrès, Mensurations), le Bilan (→ Mon corps), les Réglages (→ profil
musculation, Séance). Nutrition : l'Accueil (actions rapides → ajout d'aliment, pesée ; carte
« Maintenant » ; résumé nutrition ; carte poids), le Labo (→ profil, stats), le Bien-être (→ stats),
les Mensurations (→ stats poids), la carte énergie de fin de séance et de fin de course (→ stats,
quand le poids manque), les Réglages (→ profil nutrition).

### 1.3 Pourquoi « une ligne par écran » ne suffit pas — deux défauts, mesurés dans le code

**(a) Un écran empilé qui se déclare laisse `focusedMenu` posé, quelle que soit la porte.** Le hook
importe `useFocusEffect` d'`expo-router`, qui n'est **pas** celui de react-navigation : c'est une
copie (`build/useFocusEffect.js`) qui attend `useOptionalNavigation()`. Or cette navigation vaut
`null` au premier rendu et n'est posée que par un effet (`link/useLoadedNavigation.js`), donc **au
rendu suivant**. À la poussée d'un écran P depuis un écran T, l'ordre réel est :

1. premier commit : l'effet de focus de P sort sans rien faire ;
2. l'effet `useFocusEvents` du navigateur parent émet `blur` vers T (relayé par les onglets) →
   `clearFocusedMenu(t)` → `focusedMenu` repasse à `null` ;
3. second rendu : l'effet de P s'exécute enfin → `setFocusedMenu(p)`.

`focusedMenu` vaut donc **p tant que P est affiché**, qu'on vienne de son onglet ou d'ailleurs.
Conséquences :

- **barre d'état** — `(tabs)/_layout.tsx` reste monté sous la pile et son `StatusBar`, monté après
  celui de la racine, l'emporte (la pile de React Native fusionne dans l'ordre de montage) : icônes
  **claires**. En thème clair, sur le fond clair d'un écran empilé (`colors.background`), l'heure et la
  batterie deviennent quasi invisibles. En thème sombre, rien ne se voit — des icônes claires y sont
  justes ;
- **boucles** — l'onglet du pilier, s'il est monté, croit être au premier plan : sa matière tourne
  sous l'écran qui le recouvre.

**C'est déjà le cas des douze écrans qui se déclarent aujourd'hui.** Onglet Course › Démarrer →
`/run` → `/run/active` : `focusedMenu = 'running'` pendant toute la sortie, et `RunHeader`, dans
l'onglet Course resté monté, anime sa trace sous la course chaque fois que l'écran est allumé —
exactement le cas que DASH-01 R4 écrivait pour l'interdire (« une trace GPS qui tourne sous un écran
empilé, pendant une heure de sortie, se paie en batterie »). Ajouter 32 déclarations par le même hook
l'étendrait à toute la Musculation et la Nutrition.

**(b) Un écran qui ne déclare rien change de couleur au retour d'un écran qui déclare.** `activeMenu`
n'est jamais rendu : revenir sur un écran sans déclaration le laisse dans l'identité de l'écran qu'on
vient de quitter. **Existe déjà** : Accueil › Réglages › Profil course → retour : les Réglages sont
bleus. Avec 32 déclarations de plus, cela s'étend : Réglages › Profil nutrition (vert au retour),
Planning › séance (rouge au retour), Bilan › Mon corps (rouge au retour), et surtout **Labo › fiche
d'un lien › « Voir » les stats nutrition** → retour : la scène de la fiche reste dorée
(`useStageTheme('lab')`, fixe) mais ses cartes, qui lisent `useTheme()`, passent au vert — **deux
identités sur un écran**, le défaut que MUSCU-UX04 a corrigé.

**Et un troisième effet, mineur** : la déclaration n'arrive qu'au second rendu de l'écran (point 3
ci-dessus) ; sa première image se dessine dans l'identité de l'écran précédent.

### 1.4 Ce qui n'est pas en cause

- **Les palettes** : toutes les combinaisons écran × pilier existent déjà (un écran Musculation
  ouvert depuis l'onglet Course était bleu) ; `theme/__tests__/contrast.test.ts` couvre les six
  identités dans les deux thèmes. Aucun nouveau couple couleur / fond.
- **La séance immersive et son brief** : palette fixe (`immersivePalette = pillarPalette('dark',
  'strength')`), indépendante d'`activeMenu`.
- **Les données** : rien n'est lu ni écrit en base.

## 2. L'inventaire — les 66 écrans empilés

Tout fichier d'écran de `apps/mobile/src/app/` hors groupes `(auth)`, `(onboarding)`, `(tabs)` et hors
`_layout.tsx`. ✅ = déclare déjà ; ➕ = à corriger par IDENT-01.

### 2.1 Musculation — 23 écrans (22 ➕, 1 ✅)

| # | Fichier | Écran | Portes hors de l'onglet Muscu |
|---|---|---|---|
| M1 | `workout.tsx` | Séance en cours (classique et immersive) | Accueil (« Maintenant », séance du jour), Planning ; remplace le brief et le catalogue |
| M2 | `workout-brief.tsx` | Brief d'entrée en séance (immersif) | Accueil (« Maintenant »), Planning |
| M3 | `workout-summary.tsx` | Fin de séance | — (remplace la séance) |
| M4 | `session-preview.tsx` ✅ | Aperçu de séance | — |
| M5 | `exercises.tsx` | Catalogue d'exercices | — (onglet, séance, répertoire) |
| M6 | `exercises/[id].tsx` | Fiche exercice | Mon corps |
| M7-M9 | `templates/index.tsx`, `[id].tsx`, `edit.tsx` | Modèles de séance | — |
| M10-M12 | `programs/index.tsx`, `[id].tsx`, `edit.tsx` | Programmes | Accueil (« Maintenant »), Corps (programmes compatibles) |
| M13 | `history/index.tsx` | **Redirection** vers Muscu › Historique | Accueil (parcours d'activation) |
| M14 | `history/[id].tsx` | Détail d'une séance passée | — |
| M15 | `progress/index.tsx` | Progression musculaire | Labo (cartes et fiche d'un lien) |
| M16 | `strength-lifts.tsx` | Désignation des trois mouvements | — |
| M17 | `strength-profile.tsx` | Profil musculation | Réglages, Corps — **D4** |
| M18 | `settings-session.tsx` | Réglages › Séance (mode immersif, niveau d'affichage) | Réglages — **D4** |
| M19 | `body.tsx` | Mon corps — carte anatomique (CORPS-01) | Bilan — **D2** |
| M20 | `body-shape.tsx` | Silhouette (CORPS-02) | Corps — **D2** |
| M21 | `body-training.tsx` | Priorités d'entraînement (CORPS-03) | Corps — **D2** |
| M22 | `body-training-programs.tsx` | Programme compatible (CORPS-04) | Corps — **D2** |
| M23 | `measurements.tsx` | Mensurations (MESUR-01, roadmap 3.51) | Labo (fiche d'un lien, section croisée), Corps — **D3** |

### 2.2 Nutrition — 11 écrans (10 ➕, 1 ✅)

| # | Fichier | Écran | Portes hors de l'onglet Alim |
|---|---|---|---|
| N1 | `food-picker.tsx` | Ajouter un aliment | Accueil (action rapide « Petit-déj / Déjeuner… », « Maintenant », résumé nutrition) |
| N2 | `food-custom.tsx` | Aliment personnalisé | — (sélecteur, saisie rapide ; remplace le scan) |
| N3 | `food-scan.tsx` | Scan de code-barres | — |
| N4 | `meal-quick-entry.tsx` | Saisie rapide en phrase | — ⚠️ contient le recours Prisme (§13) |
| N5-N6 | `meal-plan/index.tsx`, `shopping.tsx` | Planning repas, liste de courses | — |
| N7 | `nutrition-day.tsx` ✅ | Page d'un jour | — |
| N8 | `nutrition-meals.tsx` | Réglage des repas | — |
| N9 | `nutrition-profile.tsx` | Profil nutrition | Accueil (résumé nutrition), Labo, Réglages — **D4** |
| N10 | `nutrition-stats.tsx` | Stats nutrition (et pesée) | Accueil (action rapide « Pesée », « Maintenant », carte poids), Labo, Bien-être, Mensurations, carte énergie (fin de séance, fin de course, autre activité) |
| N11 | `recipe-edit.tsx` | Recette | — (sélecteur) |

### 2.3 Course — 10 écrans ✅ (CARDIO-UX02, **non touchés**)

`run/index`, `run/active`, `run/analysis`, `run/summary`, `running-history/index` (redirection),
`running-stats/index`, `running-programs/index`, `[id]`, `edit`, `running-profile`. Ils bénéficient
de D7 et D8 sans qu'aucun de leurs fichiers ne change (§6).

### 2.4 Transverses — 15 écrans, ne déclarent rien (D6)

| Fichier | Écran | Ouvert depuis |
|---|---|---|
| `planning/index.tsx` | Planning unifié (3.9 + 5.6) | Accueil, Muscu, Course, Labo, programmes |
| `planning/plan.tsx` | Planifier un programme | Programme muscu **ou** course |
| `goals.tsx` | Objectifs (7.15) | Accueil, Réglages |
| `insights.tsx` | Insights (7.20) | Accueil, Muscu, Course |
| `review.tsx` | Bilan de la semaine (7.16) | Accueil, Labo, Réglages |
| `activities.tsx`, `activity.tsx` | Autres activités (4.43) — **D5** | Réglages, carte énergie du jour (Alim) |
| `steps.tsx` | Pas (9.15) | Accueil, Bien-être |
| `settings.tsx` | Réglages | **Accueil** (et deux liens secondaires de l'Accueil) |
| `profile.tsx` | Profil (compte) | Réglages, profil musculation, profil nutrition, section force |
| `help.tsx`, `account-delete.tsx` | Aide, suppression du compte | Réglages |
| `deletion-pending.tsx`, `password-reset.tsx` | Portes de compte (hors navigation normale) | Racine |
| `ai-lab.tsx` | Labo IA (surface d'évaluation) | Réglages |

### 2.5 Bien-être et Labo — 5 écrans, **même défaut, hors périmètre** (D10)

`wellbeing.tsx`, `wellbeing-settings.tsx`, `pain.tsx` (zones sensibles, un module du check-in
Bien-être), `cycle/index.tsx` (Bien-être) et `lab-link.tsx` (Labo, fiche d'un lien) ne déclarent pas
leur identité. Hors du périmètre demandé ; portés au BACKLOG sous **IDENT-02**. Avec D8, ils ne
**régressent** pas : ils gardent l'identité trouvée en arrivant, même après avoir ouvert un écran
Musculation ou Nutrition (c'est le cas de la fiche de lien, §1.3 b).

### 2.6 Hors produit — 2 écrans

`spike-corps-3d.tsx`, `spike-vbt.tsx` : écrans de spike, à retirer avant la soumission Play
(LANCE-02). Ne déclarent rien.

### 2.7 Le compte

23 + 11 + 10 + 15 + 5 + 2 = **66** fichiers, recomptés sur `d604dec2` et par la relecture.
**32 lignes ajoutées** (22 Musculation + 10 Nutrition).

## 3. Décisions — à valider

| # | Question | Proposition | Pourquoi | Alternative écartée |
|---|---|---|---|---|
| **D1** | Quand un écran appartient-il à un pilier ? | Quand **ce qu'il montre ou modifie relève de ce pilier**. Son identité ne dépend **jamais** de la porte d'entrée. | C'est l'intitulé de l'US. La porte d'entrée est ce qui produit le défaut. | Classer par numéro de roadmap : la famille Corps est en 6.x (visualisation) alors qu'elle choisit des programmes de musculation. |
| **D2** | La famille **Corps** (M19-M22) ? | **Musculation.** | Carte des muscles, fiches d'exercices, priorités d'entraînement, programmes de force ; on y entre par l'onglet Muscu (et le Bilan), elle renvoie vers les programmes et le profil musculation. | Transverse (héritage) : la même silhouette serait rouge ou terracotta selon la porte. |
| **D3** | Les **Mensurations** (M23) ? | **Musculation**, même ouvertes depuis le Labo. | Ligne 3.51 ; deux portes sur trois sont côté muscu (Progrès, Corps). | Transverse : rouge depuis le Progrès, doré depuis la fiche d'un lien. |
| **D4** | Les **profils et réglages d'un pilier** ouverts depuis les Réglages (M17, M18, N9) ? | **Leur pilier.** | Précédent : `running-profile` déclare la Course depuis CARDIO-UX02. « Réglages › Séance » ne règle que la séance de musculation. | Les laisser hériter des Réglages (terracotta) : un même profil aurait deux couleurs selon qu'on vient de l'onglet ou des Réglages. |
| **D5** | Les **Autres activités** (`activities`, `activity`, ligne 4.43) ? | **Transverses** (héritent). | L'écran parle de la cible du jour, mais aussi de la série et de la charge : il touche plusieurs piliers. On y entre par les Réglages ou par la carte énergie de l'Alim — il sera terracotta ou vert, et le restera (D8). | Nutrition (ligne 4.x) : défendable ; à trancher si Florian préfère (+2 lignes). |
| **D6** | Les **écrans transverses** (§2.4) ? | **Ne déclarent rien : ils prennent l'identité de l'écran qui les ouvre**, et la gardent (D8). Aucun de leurs fichiers ne change. | « Planifier un programme » est rouge depuis un programme muscu, bleu depuis un programme course : c'est l'identité de ce qu'on planifie. Les Réglages ne s'ouvrent que depuis l'Accueil : ils restent terracotta. Ne pas toucher `settings.tsx` ni `review.tsx` évite tout conflit avec ACCES-IA (Prisme). | Tous en `useMenuFocus('home')` : 15 fichiers de plus, dont deux qu'ACCES-IA modifie, et « Planifier » perdrait le contexte du programme. |
| **D7** | Le défaut (a) du §1.3 — `focusedMenu` posé sous un écran empilé ? | **Le hook ne pose `focusedMenu` que pour un onglet.** Un écran empilé ne pose que l'identité (`activeMenu`). Détection, dans l'effet : le navigateur de l'écran est un navigateur à onglets (`navigation.getState().type === 'tab'`). | Rétablit à l'identique la règle écrite de DASH-01 R4 (« `null` quand un écran empilé le recouvre »). Barre d'état et boucles redeviennent justes quelle que soit la porte. **Corrige aussi les dix écrans Course** sans toucher à leurs fichiers — ils gardent leur ligne `useMenuFocus('running')`. | (i) Ne pas toucher au hook : les 32 lignes étendent le défaut à deux piliers de plus. (ii) Un second hook pour les écrans empilés : le garde de CARDIO-UX02 lit `useMenuFocus('running')` mot pour mot, il faudrait réécrire les dix écrans Course. |
| **D8** | Le défaut (b) du §1.3 — un écran sans déclaration change de couleur au retour ? Et la première image dans la mauvaise identité ? | **Un écran empilé se déclare à son montage, avant sa première image, et rend en partant l'identité qu'il a trouvée en arrivant.** Le hook tient une **pile** des écrans empilés déclarés : à son montage, un écran y entre avec l'identité trouvée ; à son démontage, s'il est au sommet il rend cette identité, sinon il la **lègue** à l'écran juste au-dessus. | La navigation est une pile : l'identité trouvée en arrivant est celle de l'écran qu'on retrouve en revenant. Les écrans transverses, Bien-être et Labo restent stables **sans être modifiés**. Le legs rend le résultat juste quand plusieurs écrans se ferment d'un coup (React les démonte de bas en haut) ou quand un écran est remplacé (brief → séance, séance → fin de séance) : lire l'identité **au montage** et non au rendu fait que le remplaçant trouve celle que le remplacé vient de rendre. Les onglets ne sont pas concernés (ils se redéclarent à chaque focus). | (i) Lire l'identité au premier rendu : faux à chaque `router.replace`, donc à chaque séance (Planning › brief › séance › retour : Planning rouge). (ii) Rendre « seulement si l'identité affichée est encore la sienne », sans pile : faux quand deux écrans se ferment d'un coup. |
| **D9** | Le garde ? | **Exhaustif.** `pillar-identity.test.ts` gagne les dossiers et fichiers Musculation et Nutrition, et un test qui **classe les 66 écrans** : chaque fichier est soit dans une table de pilier (et déclare ce pilier), soit dans une liste `SANS_PILIER` avec sa raison (et ne déclare rien). Un nouvel écran non classé fait échouer la suite. | Le défaut ne se voit ni en revue ni en test d'écran ; le prochain écran empilé l'oublierait. Le garde de CARDIO-UX02 ne vérifiait que les dossiers listés. | Étendre les tables sans test d'exhaustivité : le 67ᵉ écran passerait inaperçu. |
| **D10** | Bien-être et Labo (§2.5) ? | **Hors périmètre**, portés au BACKLOG sous **IDENT-02**, classés `SANS_PILIER` avec la raison « IDENT-02 ». | Périmètre demandé : Musculation et Nutrition. D8 les protège de toute régression entre-temps. | Les inclure : cinq fichiers de plus, une vérification Bien-être et Labo, hors de la demande. |
| **D11** | La redirection `history/index.tsx` (M13) ? | **Déclare aussi** (`useMenuFocus('strength')`). | Même choix que `running-history/index` dans CARDIO-UX02 : le garde lit les fichiers d'un dossier sans distinguer une redirection, et la déclaration y est sans effet visible. | L'exclure du garde : une exception de plus à maintenir. |
| **D12** ⚠️ hors périmètre | L'onglet **Labo** force la barre d'état (`<StatusBar style="light" />`, `(tabs)/lab.tsx:378`) : monté après celui de `(tabs)/_layout.tsx` et jamais démonté, il l'emporte **pour toute la session** dès la première visite du Labo — icônes claires partout, y compris sur l'Accueil en thème clair. | **Retirer cette ligne** (une ligne, dans un onglet). | Elle est redondante : `(tabs)/_layout.tsx` donne déjà `light` quand le Labo est au premier plan. Sans ce retrait, le gain de D7 (barre d'état juste) disparaît dès qu'on a ouvert le Labo une fois. | La laisser : à porter au BACKLOG (BARRE-01) ; vérifier alors les barres d'état sur une app relancée, sans passer par le Labo. |

## 4. La règle

`useMenuFocus(menu)` — un seul hook, une seule ligne par écran :

1. **À chaque focus**, l'écran pose son identité (`activeMenu = menu`). Inchangé.
2. **Un onglet seulement** se déclare aussi au premier plan (`focusedMenu = menu`) et s'en retire à la
   perte de focus. (D7)
3. **Un écran empilé** se déclare dès son montage, avant sa première image, en retenant l'identité
   trouvée ; en se démontant, il la rend s'il est au sommet, ou la lègue à l'écran juste au-dessus.
   (D8)

## 5. Règles métier

- **R1.** Un écran de Musculation (§2.1) s'affiche **toujours** dans l'identité Musculation, quelle
  que soit la porte d'entrée, dès sa première image. Idem Nutrition (§2.2).
- **R2.** Un écran transverse (§2.4) s'affiche dans l'identité de l'écran qui l'a ouvert, **et la
  garde** jusqu'à ce qu'on le quitte — y compris au retour d'un écran d'un autre pilier.
- **R3.** Sous un écran empilé, aucun onglet n'est « au premier plan » : barre d'état réglée sur le
  thème, boucles décoratives arrêtées, quelle que soit la porte d'entrée (sous réserve de D12).
- **R4.** Revenir sur un onglet le redéclare (inchangé).
- **R5.** La préférence « Couleurs des menus » (Réglages) suit l'identité de l'écran : un écran
  Musculation prend la couleur choisie pour Muscu.
- **R6.** Dans les 32 écrans, **rien d'autre** ne change que la déclaration.

## 6. Ce qui change

| Fichier | Changement |
|---|---|
| `hooks/useMenuFocus.ts` | Règles 2 et 3 du §4 et son en-tête (≈ 25 lignes). |
| 22 écrans §2.1, 10 écrans §2.2 | Un import et une ligne `useMenuFocus('strength' \| 'nutrition')` en tête du composant exporté. |
| `app/__tests__/pillar-identity.test.ts` | Tables Musculation et Nutrition, classement exhaustif `SANS_PILIER`, les six onglets. |
| `hooks/__tests__/useMenuFocus.test.tsx` (neuf) | Les comportements du §4. |
| `hooks/__tests__/useLoopActive.test.tsx` | Son mock d'`expo-router` gagne `useNavigation` (onglet). |
| 26 tests d'écran Musculation / Nutrition | Mock de `@/hooks/useMenuFocus`, comme les tests Course et d'onglet. |
| `stores/menu-accent-store.ts`, `theme/useTheme.ts` | **Commentaires seulement** : ils décrivent l'héritage « par la branche de l'onglet », qui n'est plus la règle. |
| `app/(tabs)/lab.tsx` | **Si D12** : une ligne retirée (et son import). |

**Non touchés** : les écrans Course (§2.3), les 15 transverses, Bien-être et Labo, `lab-repository.ts`,
tout fichier Prisme, `(tabs)/_layout.tsx` (sa barre d'état redevient juste par D7, sans changement).

## 7. Cas limites

| Cas | Comportement |
|---|---|
| Écran ouvert depuis l'onglet de **son** pilier | Même couleur qu'aujourd'hui ; barre d'état désormais réglée sur le thème (R3). |
| Écran empilé ouvert depuis **un autre** écran empilé (Progrès → Mensurations → Stats nutrition) | Chacun dans son identité ; chaque retour rend celle de l'écran retrouvé (D8). |
| **Remplacement** (`router.replace` : brief → séance, séance → fin de séance, catalogue → séance, scan → aliment personnalisé) | Dans la même mise à jour, React démonte le remplacé avant de monter le remplaçant : le remplacé rend son identité trouvée, le remplaçant la retrouve et se déclare. Revenir en arrière ramène à l'écran d'avant le remplacé, dans sa couleur. |
| `dismissTo` / plusieurs écrans fermés d'un coup | React les démonte de bas en haut : chacun lègue son identité trouvée à l'écran au-dessus, le dernier la rend. Résultat juste quel que soit l'ordre. (Aujourd'hui, toutes les fermetures multiples visent un onglet, qui se redéclare de toute façon.) |
| Un écran **sous** l'écran affiché est retiré | Il lègue son identité trouvée à l'écran au-dessus ; l'identité affichée ne bouge pas. |
| **Redirection** (`history/index`) | Se déclare, puis est remplacée par l'onglet Muscu, qui se redéclare. Sans effet visible. |
| Pilier **désactivé** (onglet masqué, décision H) mais écran atteint par un lien | L'écran prend quand même l'identité de son pilier : la palette existe indépendamment de l'onglet. |
| **Notification** (rappel de repos pendant une séance) | Aucune notification ne route vers un écran : la toucher ramène l'app là où elle était. L'identité est un état mémoire, elle n'a pas bougé. Après un arrêt de l'app par le système, on repart de l'Accueil. |
| **Transitions** | L'écran qui arrive se déclare avant sa première image (D8) ; celui qui part rend l'identité au moment où il est démonté. L'identité étant globale, **à l'aller** l'écran qui reste dessous prend déjà la couleur du nouvel écran pendant l'animation d'arrivée (l'Accueil passe au vert en ouvrant le sélecteur d'aliment) — c'était déjà le cas pour la Course. Au retour, aucun éclair n'est attendu. Rien de cela n'est vérifiable en test : parcours d'observation au §14.2. |
| **Déconnexion**, session expirée | Inchangé : les écrans de connexion affichent l'identité laissée en dernier, comme aujourd'hui. |
| **iOS** (plus tard) | Une `presentation: 'modal'` y est une feuille qui laisse voir l'écran du dessous ; l'identité étant globale, cet écran prend la couleur de la feuille tant qu'elle est ouverte. Android d'abord : sans objet aujourd'hui, à revoir à la première build iOS. |

## 8. Accessibilité

La couleur n'est le seul porteur d'aucune information : titres et libellés ne changent pas. Les
contrastes sont couverts pour les six identités (§1.4). **Gain** : la barre d'état redevient lisible
en thème clair sur les écrans empilés (R3), y compris les dix écrans Course.

## 9. i18n

**Aucune chaîne** ajoutée, modifiée ni retirée.

## 10. Comportement offline

**Sans objet** : `activeMenu`, `focusedMenu` et la pile de D8 sont un état d'affichage en mémoire, non
persisté, non synchronisé. Aucune requête, aucune écriture.

## 11. Tests

1. **Filet** — `useMenuFocus.test.tsx`, cas **onglet**, vert sur le code d'aujourd'hui : il pose les
   deux champs au focus, libère `focusedMenu` à la perte de focus, ne libère pas un focus repris par
   un autre onglet. Le test existant de `useLoopActive.test.tsx` reste vert.
2. **Les deux règles**, écrites rouges avant le hook : un écran empilé pose `activeMenu` dès son
   montage et ne touche jamais `focusedMenu` (D7) ; en se démontant au sommet, il rend l'identité
   trouvée ; un remplacement, une fermeture de deux écrans d'un coup (de bas en haut) et le retrait
   d'un écran sous un autre donnent l'identité juste (D8) ; un onglet démonté ne rend rien.
3. **Le garde** (D9), écrit rouge avant les 32 lignes : 32 échecs nommés, un par écran, puis vert
   pilier par pilier.
4. **Tests d'écran** : mock du hook ajouté là où le mock d'`expo-router` n'expose pas `useFocusEffect`
   ou `useNavigation` — c'est ce que CARDIO-UX02 a rencontré sur neuf suites Course.

## 12. Migration, déploiement, build : aucun

Aucune migration, aucune sync rule, aucune dépendance, aucune fonction, aucun secret. Rien sur le
cloud. Un dev build existant suffit (JavaScript seul).

## 13. Hors périmètre, et écarts signalés

- **Bien-être et Labo** (§2.5) → **IDENT-02** au BACKLOG. La fiche d'un lien monte aussi un
  `StatusBar style="light"` tant qu'elle est ouverte : les écrans qu'elle ouvre (stats, Progrès)
  ont une barre d'état claire en thème clair, avec ou sans IDENT-01 — noté dans IDENT-02.
- **Barre d'état des écrans à fond sombre fixe** — séance immersive et brief (`immersivePalette`) :
  la barre d'état suit le thème, donc en thème clair des icônes sombres sur fond sombre. Préexistant,
  ni causé ni corrigé par IDENT-01 (R6) → BACKLOG **BARRE-01** (l'onglet Labo, lui, est corrigé par
  D12).
- **`/real-life`** : la « reprise en douceur » de l'Accueil (`(tabs)/index.tsx:186-187`) pousse vers
  une route qui n'existe pas — constaté à l'inventaire → BACKLOG **VIE-02**.
- **`meal-quick-entry.tsx`** porte le recours Prisme, qu'ACCES-IA peut modifier en parallèle. IDENT-01
  n'y ajoute qu'un import et une ligne en tête du composant : un conflit éventuel se résout en gardant
  les deux côtés.
- **Couleurs écrites en dur** dans les 32 écrans : non auditées (R6). Une teinte en dur reste fausse
  dans la bonne identité.

## 14. Acceptation

### 14.1 Critères d'acceptation — ce que les tests prouvent

1. Les **32 écrans** du §2.1 et du §2.2 déclarent leur pilier ; les 66 écrans empilés sont classés une
   et une seule fois ; un écran sans pilier ne déclare rien ; les six onglets déclarent leur menu
   (garde, D9).
2. Un onglet pose `activeMenu` et `focusedMenu`, et libère `focusedMenu` à la perte de focus (filet).
3. Un écran empilé pose `activeMenu` **dès son montage** et ne touche **jamais** `focusedMenu` (D7).
4. Pile de D8 : retour simple, remplacement, deux écrans fermés de bas en haut, retrait d'un écran
   sous un autre → chaque fois l'identité de l'écran retrouvé.
5. Typecheck, lint, suite complète verts — code de sortie lu sans pipe.

### 14.2 Parcours sur téléphone — à dérouler à la demande

Rien n'est consigné ni coché (règle du 23/10/2026). C'est la liste des **portes d'entrée** à essayer
si Florian demande une vérification ; la session qui aura codé la détaillera alors pas à pas.

- **Préparation** : dev build, Metro lancé depuis le worktree ; piliers Musculation, Course et
  Nutrition activés (Bien-être pour le parcours Bien-être). **Thème clair** pour la passe principale ;
  « Couleurs des menus » désactivé. **App relancée**, et le Labo gardé pour la fin (sauf si D12 est
  retenue). Certaines portes dépendent des données : la carte « Maintenant » → Programmes n'apparaît
  qu'Accueil au repos, le parcours d'activation qu'à son jour 6.
- **Repères** : Musculation = boutons, liens et icônes **rouges** ; Nutrition = **verts** ; Accueil =
  **terracotta** ; Course = **bleus** ; Labo = **dorés** ; Bien-être = **violets**.
- **Attendu à chaque écran** : la couleur de son pilier dès la première image ; en thème clair,
  l'heure et la batterie **lisibles** ; au retour, l'écran retrouvé dans **sa** couleur.

| Porte | Parcours | Attendu |
|---|---|---|
| Accueil | « Maintenant » → séance du jour (classique, puis immersive : brief → séance) → terminer | rouge de bout en bout ; retour Accueil terracotta |
| Accueil | « Maintenant » → Programmes → un programme → Modifier | rouge |
| Accueil | Parcours d'activation → Historique | onglet Muscu sur Historique, rouge |
| Accueil | Action rapide « Petit-déj / Déjeuner… » → sélecteur → aliment personnalisé, scan, saisie rapide, recette | vert ; retour Accueil terracotta |
| Accueil | Action rapide « Pesée », carte poids, résumé nutrition | vert |
| Planning | Une séance → retour | séance rouge ; **Planning garde sa couleur** (D8) |
| Planning | Séance immersive : brief → séance → retour arrière | **Planning garde sa couleur** (D8, remplacement) |
| Bilan | Mon corps → retour | rouge ; **Bilan garde sa couleur** |
| Réglages | Profil musculation, Séance, Profil nutrition, Profil course → retour à chaque fois | rouge, rouge, vert, bleu ; **Réglages terracotta** à chaque retour (aujourd'hui : bleu après le profil course) |
| Muscu | Progrès → Mensurations → lien poids → stats nutrition → retours | rouge, rouge, vert ; Mensurations rouges au retour |
| Muscu | Mon corps, Silhouette, Priorités, Programmes compatibles ; Exercices, fiche ; Modèles | rouge (D2) |
| Muscu / Course | Un programme → Planifier | rouge depuis la muscu, bleu depuis la course (D6) |
| Alim | Planning repas, courses, réglage des repas, page d'un jour ; carte énergie → ajouter une activité | vert (l'activité hérite, D5) |
| Bien-être | Aujourd'hui → stats nutrition → retour | vert ; retour violet |
| Course | Démarrer → `/run` → course en cours | bleu, **barre d'état lisible** (D7 — illisible aujourd'hui) |
| Labo | Une carte → Progrès, profil nutrition, stats → retours | rouge / vert ; retour doré |
| Labo | Fiche d'un lien → « Voir » les stats nutrition → retour | **fiche entière dorée**, scène et cartes (D8) ; barre d'état de la fiche et des stats : voir IDENT-02 |
| Notification | Séance lancée depuis l'Accueil → arrière-plan → notification de repos → la toucher | séance rouge |
| Préférence | « Couleurs des menus » activé, une couleur pour Muscu → séance | **cette** couleur (R5) |
| Thème sombre | Séance depuis l'Accueil, sélecteur d'aliment, fiche de lien | mêmes couleurs, barre d'état claire |
| *Observation* | Pendant les animations, à l'aller et au retour | à l'aller, l'écran du dessous prend déjà la couleur du nouveau (attendu) ; au retour, aucun éclair de la couleur de l'écran quitté |

## 15. Relecture (23/10/2026)

Relue par un agent de revue sur le code de `d604dec2` et le code installé. **Vérifié juste** :
l'inventaire (66 fichiers, chacun classé une fois), les appels actuels du hook, la détection d'un
onglet (`TabRouter` → `type: 'tab'`, piles imbriquées → `'stack'`, aucun autre navigateur à onglets),
la priorité de la barre d'état des onglets, la liste des 26 tests d'écran à adapter, l'absence de
routage par notification, l'absence de StrictMode et de préchargement d'écran. **Corrigé dans cette
version** :

1. **§1.3 a réécrit** — la version précédente s'appuyait sur le `useFocusEffect` de react-navigation ;
   le hook utilise la copie d'`expo-router`, qui attend un rendu de plus. Conséquence plus forte
   qu'annoncé : `focusedMenu` reste posé **quelle que soit la porte**, y compris depuis l'onglet du
   pilier — les douze écrans qui se déclarent aujourd'hui ont déjà le défaut.
2. **D12 ajoutée** — le `StatusBar` forcé de l'onglet Labo l'emporte pour toute la session ;
   sans lui retiré, le bénéfice de D7 ne tient pas après une visite du Labo.
3. **D8 refaite** — lire l'identité trouvée au rendu était faux à chaque `router.replace` (brief →
   séance, séance → fin de séance) ; et la garde « encore la sienne » était fausse quand deux écrans
   se ferment d'un coup, React les démontant de bas en haut. Remplacée par la pile avec legs, lue et
   posée au montage (effet de mise en page), ce qui supprime aussi la première image dans la mauvaise
   identité.
4. **Portes corrigées** — « Accueil › record récent → Progrès » n'existe plus (la carte ne vit que
   dans le Progrès) ; la section croisée → Mensurations vit dans la fiche d'un lien du Labo, pas dans
   l'Alim ; la carte énergie n'est pas sur l'Accueil ; `body.tsx` ouvre la fiche exercice, pas le
   catalogue. Ajoutées : Bilan → Mon corps, Planning → brief, profil (compte) depuis les profils.
5. **`pain.tsx` reclassé** dans le groupe Bien-être (IDENT-02) : c'est un module du check-in.
6. **Recette alignée** sur la règle du 23/10/2026 : plus de §98 ni d'étape `recette` ; critères
   d'acceptation prouvés par les tests (§14.1), parcours à la demande (§14.2).
7. Constats hors périmètre portés au BACKLOG : barre d'état des écrans sombres (BARRE-01), route
   `/real-life` inexistante (VIE-02). Numéro de ligne de « Autres activités » corrigé (4.43, l'erreur
   vient du front-matter d'AUTRE-01).
