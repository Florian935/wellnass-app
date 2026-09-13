---
id: GUID-01
titre: "Objectif utile et régime de guidage"
roadmap: [1.30]
catalogue: []
etape: recette
branche: feature/guid01-objectif-regime-guidage
maj: 13/09/2026
---

# US GUID-01 — Objectif utile et régime de guidage

> Née de l'[analyse du 12/09/2026](../../../product/analyse-objectif-guidage-2026-09.md)
> ([PDF](../../../product/analyse-objectif-guidage-2026-09.pdf)), **validée par Florian le
> 13/09/2026** avec les [trois planches de maquettes](../../../../design/objectif-guidage-2026-09/).
> Entrée neuve : absente de BACKLOG, de la roadmap et d'IDEAS. Traitée **en un seul lot** sur
> décision de Florian, là où l'analyse en proposait cinq.

## 0. Le problème, en trois chiffres

L'onboarding demande un objectif et promet qu'il « oriente les recommandations ». Vérification dans
le code au 12/09/2026 :

- `main_goal` est lu à **8 endroits**, et les 8 sont le même appel `objectiveFromGoal(...)` : le
  repli de l'objectif nutritionnel. Muscu : zéro lecture. Course : zéro lecture.
- **2 objectifs sur 4** (`performance`, `health`) tombent dans le même `default → maintain` : ils
  donnent une app identique à celle de quelqu'un qui a appuyé sur « Passer ».
- `runner_profiles.objective` et `.level` sont écrits, affichés dans leur propre formulaire, et
  **relus nulle part**.

Et la muscu ne stocke ni niveau ni disponibilité : `SuggestedPrograms` trie les programmes sur
`workoutDisplayLevel`, une **préférence d'affichage**, faute de mieux (son en-tête le documente).

## 1. Périmètre

**Dans le lot** — les cinq volets de l'analyse :

| Volet | Contenu |
|---|---|
| **A** | L'objectif pilote réellement les 3 piliers. `performance` et `health` cessent d'être synonymes. Le récapitulatif d'onboarding pose une première action. |
| **B** | `training_level` et `weekly_availability` sur `profiles`, demandés **devant la bibliothèque** et non à l'onboarding. `SuggestedPrograms` cesse d'utiliser le niveau d'affichage comme proxy. |
| **C** | Le **régime de guidage** (`guided` / `assisted` / `autonomous`), global + surcharge par pilier. Couche de politique pure dans `packages/shared`. L'étape 4 de l'onboarding remplace « Niveau d'affichage » par la question de guidage. Trois signaux de sécurité non désactivables. |
| **D** | Le régime `guided` **applique** au lieu de proposer : collision de séances déplacée d'office (avec annonce et annulation), et le programme éditorial **dupliqué puis activé** en un tap depuis le récapitulatif. ⚠️ La cible glucidique a été retirée en cours d'implémentation — voir §5.3. |
| **E** | Trois règles de **contradiction** entre objectifs, en carte explicable et contestable. |

**Hors du lot, et c'est un arbitrage, pas un oubli** :

- 🔴 **La génération d'un plan hebdomadaire sur mesure.** Le volet D de l'analyse disait « le régime
  Guidé construit réellement la semaine ». Il en construit la **sélection** (choisir le bon
  programme éditorial parmi ceux de CONTENU-01, le dupliquer, l'activer), pas la **composition**
  (inventer des séances, des séries et des charges). Composer demanderait du contenu de coach que
  le dépôt n'a pas : CONTENU-01 a livré **3 programmes muscu + 3 course**, ce qui suffit largement à
  choisir, et pas du tout à générer. Fabriquer ces séances reviendrait à **inventer des données
  d'entraînement**, ce que CONTENU-01 et l'audit nutrition ont tous deux refusé de faire.
- L'**objectif hybride unifié** à arbitrage de priorités et le **simulateur « what-if »**
  ([IDEAS](../../../../IDEAS.md), 25/07/2026). On **détecte** la contradiction (volet E), on ne la
  résout pas automatiquement.
- La règle **RN-17** (« perte de poids + volume de course élevé + déficit ») n'existe pas au
  catalogue en tant que calcul livré. Le volet E livre **deux** règles sur les trois annoncées, et
  la troisième est posée comme extensible. Voir §5.3.

## 2. Le modèle de données

Six colonnes, toutes **additives et nullable**, sur `profiles`.

| Colonne | Type | `null` veut dire |
|---|---|---|
| `guidance_regime` | text | la question n'a jamais été posée → `assisted` appliqué, **affiché comme repli** |
| `guidance_strength` | text | hérite du régime global |
| `guidance_cardio` | text | hérite du régime global |
| `guidance_nutrition` | text | hérite du régime global |
| `training_level` | text | jamais demandé → repli documenté (§4.2) |
| `weekly_availability` | integer | jamais demandé |
| `main_goal_deadline` | date | pas d'échéance (le cas normal) |

Soit **sept** colonnes avec l'échéance. Contraintes `check` sur les énumérations et sur
`weekly_availability between 1 and 7`.

### 2.1 La règle qui structure tout : *appliqué* ≠ *choisi*

C'est le motif inventé pendant NUTRI-UX01 (R1.3) et généralisé ici. Pour chaque valeur, deux
fonctions :

```ts
effectiveRegime(profile, pillar)   // ce qui est APPLIQUÉ (repli compris)
hasChosenRegime(profile, pillar)   // ce qui a été CHOISI
```

Toute interface qui montre un régime **doit** distinguer les deux : un repli s'affiche comme repli
(« Accompagné — déduit de ton objectif »), jamais comme une sélection. Confondre les deux, c'est
refaire le bug des **~614 kcal/jour** du niveau d'activité, un cran plus haut.

⚠️ **Les sept colonnes doivent être déclarées dans
[`powersync/schema.ts`](../../../../apps/mobile/src/powersync/schema.ts)** en plus de la migration.
Absente du schéma local, une colonne n'existe pas dans la base SQLite embarquée : l'écriture échoue,
`void upsertProfile()` avale le rejet, et le sélecteur revient à sa valeur précédente **sans aucun
message**. C'est la panne de CYCLE-01 (recette du 31/07/2026) et celle de `daily_step_goal`
(03/08/2026). Le piège a déjà coûté deux recettes.

✅ **Aucune sync rule PowerSync à redéployer** : `profiles` est déjà publiée et son bucket lit
`select *`.

### 2.2 🔴 `GUIDANCE_WRITE_READY` — l'interrupteur de sûreté

Ajouté en revue (13/09/2026), et il n'est pas cosmétique. Tant que la migration n'est pas sur le
cloud, une écriture locale met en file une op PowerSync que PostgREST rejette
(`column does not exist`) ; `connector.ts` relance l'erreur **sans compléter la transaction**, qui
reste en tête de file et se rejoue indéfiniment. Or la file est **sérialisée** : plus aucune
écriture ne remonte, **toutes tables confondues** — séances, repas, poids, courses.

Le drapeau (`profile-repository.ts`) **retire les 8 colonnes de l'écriture** tant qu'il vaut
`false`. Conséquence assumée : les réglages de guidage ne sont pas persistés. Perdre un réglage est
réparable ; figer la synchro de tout le monde ne l'est pas. Même patron que `ADAPTATION_WRITE_READY`
(CARDIO-UX01).

**À passer à `true` dans le même geste que `npm run db:push`.**

## 3. Volet A — l'objectif pilote les trois piliers

### 3.1 `pillarDefaults(goal)` — une fonction, une source de vérité

Nouveau module `packages/shared/src/goal-defaults.ts`, pur et testé sous Vitest. Il rend, pour
chaque objectif, ce que chaque pilier décide par défaut :

| Objectif | Musculation | Course | Nutrition |
|---|---|---|---|
| **`muscle`** | niveau visé selon l'expérience · progression en charge · deload après 3 stagnations | volume **plafonné**, endurance seulement (interférence MR-08) | `bulk`, +300 kcal, protéines ≥ 1,8 g/kg, glucides péri-séance actifs |
| **`weightloss`** | **maintien** de charge, pas de progression forcée · full-body / haut-bas | fréquence > intensité, endurance fondamentale | `weightloss`, −250 kcal, protéines ≥ 2,0 g/kg |
| **`performance`** | dépend de la discipline (§3.2) | objectif coureur pré-rempli, séances structurées | `maintain`, socle glucidique périodisé (FUEL-01), TDEE ajusté course (RN-03) |
| **`health`** | volume modéré, **régularité avant charge** · garde-fou plus conservateur | endurance, **zéro fractionné** par défaut | `maintain`, accent **micronutriments** plutôt que macros |

`objectiveFromGoal` est **conservée** — huit sites l'appellent — mais devient un mince adaptateur
au-dessus de `pillarDefaults(goal).nutrition.objective`. Aucun appelant ne change.

### 3.2 « Performance » sans discipline (décision D2, tranchée)

Avec trois piliers, « Performance » ne dit pas *en quoi*. **On ne rallonge pas la liste à 5
objectifs** : on pose une **question conditionnelle**, affichée uniquement si `performance` est
choisi **et** que les deux piliers d'entraînement sont actifs → `strength` ou `endurance`, stockée
dans `training_focus` (8ᵉ colonne, nullable). Un seul pilier actif ⇒ la discipline s'en déduit,
aucune question.

### 3.3 Le récapitulatif pose une première action

`(onboarding)/summary.tsx` gagne une carte sombre « Ta première action », déduite des piliers actifs
(priorité **muscu > course > nutrition**, l'ordre déjà acté dans CLAUDE.md et réutilisé par
ACTIV-01). Elle **referme le trou de la roadmap 1.11**, qui promet une « suggestion d'une première
action » constatée absente par la cartographie d'ACTIV-01 le 03/08/2026.

## 4. Volet B — les deux questions manquantes

### 4.1 Où elles sont posées

**Pas à l'onboarding** (décision D6) : la décision de cadrage F impose un onboarding minimal, et une
question sans objet visible est du coût. Elles sont posées **devant la bibliothèque**, dans une
feuille qui s'ouvre au premier contact avec les programmes suggérés, quand `training_level` est
`null`. Deux questions, deux taps, annulable.

### 4.2 Ce que `SuggestedPrograms` fait désormais

Ordre de préférence, du meilleur signal au repli :

1. `training_level` s'il est renseigné ;
2. **sinon** `workoutDisplayLevel` — le proxy actuel, **conservé comme dernier repli** pour ne pas
   dégrader les comptes existants qui n'ont pas encore répondu ;
3. à défaut, débutant d'abord.

Le biais d'objectif de `pillarDefaults` s'applique **par-dessus** le niveau. `weekly_availability`
filtre les programmes dont la fréquence hebdomadaire dépasse la disponibilité déclarée, **sans
jamais vider la liste** : si le filtre ne laisse rien, il est ignoré et la liste complète revient.

## 5. Volet C — le régime de guidage

### 5.1 Les trois régimes, et ce qu'ils changent

L'axe est **qui décide**, pas *combien de messages* (décision D1). Une décision produite par un
moteur existant reçoit une **disposition** :

| Régime | Disposition | Comportement |
|---|---|---|
| `guided` | `apply` | l'app agit et **annonce** ce qu'elle a fait, avec une action d'annulation |
| `assisted` *(défaut)* | `propose` | carte avec deux actions de **poids visuel égal** — « Laisser » n'est pas un bouton de honte |
| `autonomous` | `silent` | rien ne s'affiche spontanément ; l'analyse tourne et reste consultable dans Insights |

### 5.2 Les trois signaux qui ne se coupent jamais (décision D5)

`SAFETY_DECISIONS` — quel que soit le régime, **y compris `autonomous`** :

1. ACWR en zone critique (META-19 / GARDE-01) ;
2. même zone douloureuse déclarée **3 fois en 14 jours** (DOUL-01) ;
3. déficit calorique sévère prolongé (alerte 4.32).

Ils sont **toujours `propose`, jamais `apply`** : on alerte, on ne décide pas à la place de
quelqu'un sur un sujet de santé. Ils s'affichent **une fois**, sobrement, sans répétition. C'est une
position produit assumée : on ne laisse pas quelqu'un se blesser parce qu'il a coché « je me
débrouille », et la contrepartie est que l'écran de choix **le dit**.

### 5.3 Ce que la couche gouverne réellement

Elle ne crée aucun moteur : elle **arbitre** des producteurs déjà livrés.

| Décision | Producteur existant | `guided` | `assisted` | `autonomous` |
|---|---|---|---|---|
| `sessionConflict` | COLLIS-01 | déplacée + annonce | carte à deux boutons | rien |
| `carbTarget` | MN-04 | ⬜ **déclaré, non câblé** — voir l'encadré ci-dessous | | |
| `programSuggestion` | MUSCU-UX01 | posé en un tap depuis le récap | 3 propositions | bibliothèque brute |
| `goalConflict` | volet E | carte | carte | rien |
| `displayDensity` | MUSC-F13 | `simplified` | `normal` | `detailed` |
| *les 3 signaux de sécurité* | META-19, DOUL-01, 4.32 | carte | carte | **carte** |

> 🔴 **Pourquoi `carbTarget` n'est finalement PAS câblé (constat d'implémentation, 13/09/2026).**
> Le bonus des jours d'entraînement est **déjà** appliqué automatiquement, et il est piloté par deux
> réglages que l'utilisateur a posés lui-même dans son profil nutritionnel
> (`trainingDayBonus`, `trainingBonusMode`). Le passer sous le régime aurait deux conséquences, et
> les deux sont inacceptables : **(1)** le régime par défaut (`assisted`) cesserait d'appliquer un
> bonus aujourd'hui automatique — une **régression** pour tous les comptes existants, déguisée en
> fonctionnalité ; **(2)** un réglage en outrepasserait un autre, exactement ce que la règle
> ci-dessous interdit. La décision est donc **déclarée dans `DECISION_KINDS` et testée**, mais aucun
> écran ne la consomme. Elle attend une US qui rendra le bonus lui-même optionnel.

⚠️ **Le réglage existant `sessionConflictsEnabled` reste maître.** S'il est éteint, la couche de
guidage ne rallume rien : le régime module ce qui est **déjà activé**, il ne contourne pas un
interrupteur. Un réglage qu'un autre réglage peut outrepasser n'est plus un réglage.

### 5.4 L'étape 4 de l'onboarding change de question (décision D4)

`(onboarding)/displayLevel.tsx` est **remplacé** par `(onboarding)/guidance.tsx`, à la même place.
Le parcours garde **exactement le même nombre d'écrans** — la décision de cadrage F est intacte.

Le niveau d'affichage n'est pas perdu : il est **déduit** du régime (`guided → simplified`,
`assisted → normal`, `autonomous → detailed`) et reste réglable dans
[settings.tsx](../../../../apps/mobile/src/app/settings.tsx) (deux sélecteurs y existent déjà).
C'est ce qui **supprime le détournement** du constat 5 : `workoutDisplayLevel` redevient un réglage
d'affichage, et le niveau d'expérience a enfin sa propre colonne.

### 5.5 Où le régime se règle après coup

Dans **le pilier qu'il gouverne**, jamais dans la liste des réglages — qui compte déjà **18 sections
et 11 interrupteurs**, où une 19ᵉ ligne disparaîtrait.

- Nutrition → [nutrition-profile.tsx](../../../../apps/mobile/src/app/nutrition-profile.tsx)
- Course → [running-profile.tsx](../../../../apps/mobile/src/app/running-profile.tsx)
- Musculation → **écran neuf** `strength-profile.tsx` : il n'en existait aucun, alors que les deux
  autres piliers en ont un depuis toujours. Il porte le **contexte** (niveau, disponibilité,
  objectif principal en lecture seule).

> 🔴 **Pas de sélecteur de régime sur le profil Musculation** (correction de revue, 13/09/2026).
> `dispositionFor` n'est consulté qu'à **deux** endroits : les collisions de séances (Course) et la
> carte de contradiction (Nutrition). Aucun moteur de musculation ne lit le régime. Afficher un
> curseur accompagné d'un texte décrivant trois comportements qui ne se produisent pas serait
> **exactement le défaut que cette US corrige**. Le curseur reviendra quand les moteurs muscu y
> seront branchés — et les textes `guidance.pillarEffect.nutrition.*` ont été réécrits pour ne
> décrire que ce qui est réellement câblé.

## 6. Volet E — les contradictions

| # | Conflit | Détection | Livré ici |
|---|---|---|---|
| 1 | objectif global `muscle` + nutrition `cut` (ou `weightloss`) | comparaison directe des deux champs | ✅ |
| 2 | objectif coureur `marathon`/`semi` + objectif global `muscle` | MR-08 (livré) | ✅ |
| 3 | `weightloss` + volume de course élevé + déficit | RN-17 — **calcul absent du dépôt** | ⬜ structure posée, règle non livrée |

Chaque carte est **explicable** (« Pourquoi je te dis ça » déplie les raisons) et **contestable**
(« Cette règle ne me correspond pas » la masque durablement) — principe transverse noté dans IDEAS
le 25/07/2026. Le rejet est stocké en préférence locale par identifiant de règle.

Aucune carte n'est affichée en régime `autonomous`.

## 7. i18n

**FR + EN obligatoires** (décision G), pour ~90 clés neuves. Le point dur n'est pas le volume, c'est
le **ton du régime `guided`** : « J'ai déplacé ta séance Jambes à jeudi » ne se traduit pas
mécaniquement sans devenir soit sec, soit infantilisant. Trois règles de rédaction :

1. l'app dit ce qu'elle **a fait**, jamais ce que l'utilisateur **aurait dû** faire ;
2. toute annonce porte une **sortie** (annuler, ou changer de régime) ;
3. aucun impératif dans les cartes de sécurité — on décrit un fait, on ne commande pas.

## 8. Comportement offline

Aucun obstacle. Tout est calculé **localement** à partir de colonnes du profil déjà synchronisées :
la couche de politique est une fonction pure de `packages/shared`, sans I/O. Les écritures passent
par les repositories existants (SQLite local d'abord, PowerSync ensuite). Les rejets de règles du
volet E sont une **préférence locale**, non synchronisée — assumé : refuser un conseil sur son
téléphone n'a pas à voyager.

## 9. Cas limites

| Cas | Comportement attendu |
|---|---|
| Onboarding entièrement passé | `guidance_regime` `null` → `assisted` appliqué, affiché comme repli |
| Compte antérieur à la migration | idem, et `workoutDisplayLevel` **conservé tel quel** — le régime ne l'écrase jamais rétroactivement |
| Régime global changé après des surcharges par pilier | les surcharges **gagnent** ; le global ne les réécrit pas |
| `weekly_availability` = 1 et aucun programme à 1 séance | filtre ignoré, liste complète (jamais d'écran vide) |
| Pilier désactivé | son régime n'est ni lu ni affiché |
| `performance` + un seul pilier d'entraînement actif | pas de question de discipline, déduction directe |
| Programme éditorial « posé » en régime `guided` | **dupliqué puis activé** — activer un éditorial directement est rejeté par la RLS (piège documenté dans `activateProgram`) |
| Deux conflits simultanés (volet E) | **un seul** affiché, le plus ancien par ordre de règle ; l'accueil est plafonné (ADR-007) |

## 10. Critères de recette

Repris dans [RECETTES.md](../../../../RECETTES.md) à la livraison.

1. Compte neuf, onboarding complet : l'étape 4 demande le **guidage** et non le niveau d'affichage ;
   le parcours compte toujours 5 étapes.
2. Choisir « Performance » avec muscu + course actifs → la question de discipline apparaît. Avec un
   seul pilier → elle n'apparaît pas.
3. Le récapitulatif affiche le régime **et** la mention de repli quand rien n'a été choisi ; la
   carte « Ta première action » pointe le bon pilier.
4. Régime `guided` : une collision de séances est **déplacée** et annoncée, avec annulation
   fonctionnelle.
5. Régime `assisted` : la même collision est **proposée**, les deux boutons ont le même poids.
6. Régime `autonomous` : aucune carte spontanée sur l'accueil — **mais** une alerte de sécurité
   simulée s'affiche quand même.
7. `sessionConflictsEnabled` éteint + régime `guided` : **rien ne bouge**.
8. Première ouverture des programmes suggérés : la feuille demande niveau et disponibilité ; après
   réponse, le tri change et la feuille ne revient plus.
9. Les trois écrans de profil de pilier portent le sélecteur de régime, avec la mention « déduit »
   tant qu'il n'a pas été touché.
10. Contradiction masse ↔ sèche : la carte apparaît, « Pourquoi » déplie, « Cette règle ne me
    correspond pas » la fait disparaître durablement (survit à un redémarrage).
11. Bascule FR ↔ EN sur les 6 écrans touchés : aucune clé brute, aucun texte tronqué.
12. Mode avion : changer de régime, répondre aux deux questions et rejeter une règle fonctionnent ;
    tout est retrouvé au retour du réseau.
