---
id: ADMIN-01
titre: "Archivage sûr du contenu éditorial (back-office)"
roadmap: [8.11]
catalogue: []
etape: recette
branche: feature/admin01-archivage-sur
maj: 29/07/2026
---

# US ADMIN-01 — Archivage sûr du contenu éditorial

> **Spec fonctionnelle — ✅ validée par Florian le 29/07/2026**, avec arbitrage des 7 décisions §1
> conformément aux recommandations. Implémentation en cours. Roadmap **8.11** (V0.9, P1, ~4 h).
>
> ⚠️ **Ce n'est pas du confort, c'est un risque d'intégrité de données**, et il faut le corriger
> **avant** d'avoir de vrais utilisateurs. Après, le mal est fait et irréparable : on ne peut pas
> reconstituer un nom qu'on n'a jamais stocké ailleurs.
>
> Bonne nouvelle de calendrier : c'est du **back-office web**, donc sa recette se fait dans un
> navigateur — **aucun APK requis**, contrairement à toutes les autres US de V0.9.

## 0. Le problème, vérifié dans le code

Trois constats enchaînés, chacun anodin seul, désastreux ensemble.

**(1) Archiver est une porte à sens unique.** `archiveExercise` pose `deleted_at = now`
([exercises.ts:272](../../../../apps/admin/src/data/exercises.ts#L272)), et **toutes** les listes de
l'admin filtrent `.is('deleted_at', null)`. Un contenu archivé **disparaît donc de l'admin
lui-même** : plus aucun écran ne le montre, et **aucune fonction de restauration n'existe** pour les
exercices, les programmes ni les aliments.

**(2) La ligne quitte les appareils.** Les sync rules PowerSync filtrent `deleted_at is null`
([powersync-sync-rules.yaml](../../technical/powersync-sync-rules.yaml)) : à la resynchro suivante,
la ligne est **retirée des bases locales** de tous les utilisateurs.

**(3) L'historique affiche alors un nom vide.** `workout_sets` ne porte **que** `exercise_id` —
aucun nom dénormalisé (vérifié dans `database.types.ts`). L'historique mobile résout le nom par
`LEFT JOIN exercise_translations`
([workout-repository.ts:157](../../../../apps/mobile/src/data/repositories/workout-repository.ts#L157))
avec pour repli ultime **la chaîne vide**
([workout-repository.ts:225](../../../../apps/mobile/src/data/repositories/workout-repository.ts#L225)).

> **Conséquence exacte** : un admin archive « Développé couché ». À la resynchro, tous les
> utilisateurs qui en ont fait voient, dans leur historique de séances, **une ligne sans nom** — pas
> un message d'erreur, pas « exercice archivé » : **du vide**. Leurs séries, charges et records sont
> toujours là, mais plus rien ne dit de quel mouvement il s'agit. Et personne ne peut annuler
> l'archivage depuis l'admin.

### Ce qui est déjà en place et qu'on réutilise

| Brique | Où | Usage ici |
|---|---|---|
| Réactivation d'une ligne soft-deletée | `addEditorialVariant` remet `deleted_at: null` ([exercise-variants.ts:126](../../../../apps/admin/src/data/exercise-variants.ts#L126)) | **Précédent** : « désarchiver » n'est pas un patron nouveau dans ce dépôt |
| Archivage en cascade, du plus fin vers l'entête | `archiveProgram` ([programs.ts:566](../../../../apps/admin/src/data/programs.ts#L566)) | La restauration doit faire le **chemin inverse** |
| Journal d'audit | `logAudit({ action, targetTable, targetId, targetLabel })` | Archivage **et** restauration doivent y laisser une trace |
| Filtres de liste | `statusFilter` / `groupFilter` sur [ExercisesScreen](../../../../apps/admin/src/screens/ExercisesScreen.tsx) | Le filtre « archivés » suit le même patron |

## 1. Décisions de cadrage — ✅ TRANCHÉES le 29/07/2026

> ✅ **Validation Florian, 29/07/2026 : les 3 livrables sont validés et les 7 décisions arbitrées
> conformément aux recommandations ci-dessous.** À lire comme des règles, plus comme des propositions.
>
> ⚠️ **Constaté à l'implémentation** : la RLS ne permet **pas** à un admin de compter les données des
> autres utilisateurs (`workout_sets_select` est `user_id = auth.uid()`, sans bypass). Le décompte de
> D1 impose donc une **migration** : une fonction `security definer` réservée aux admins. C'était la
> question que le plan demandait de lever en premier — réponse : oui, migration nécessaire.

| # | Question | Décision retenue | Pourquoi |
|---|---|---|---|
| **D1** | Interdire l'archivage d'un contenu référencé, ou l'autoriser en avertissant ? | **Autoriser, mais jamais en aveugle** : compter les usages et les afficher dans la confirmation (« 128 séries et 3 programmes utilisent cet exercice ») | Interdire bloquerait le retrait d'un contenu obsolète dès qu'**un** utilisateur l'a touché — inapplicable en pratique. La vraie faute n'est pas d'archiver, c'est d'archiver **sans savoir** |
| **D2** | Comment garder l'historique lisible après archivage ? | **Ne plus retirer le contenu éditorial archivé des appareils** : la sync rule `shared_content` cesse de filtrer `deleted_at is null` pour les tables éditoriales, et **c'est l'app qui masque** les contenus archivés dans les listes de sélection, tout en continuant à résoudre leur nom dans l'historique | C'est le seul choix qui répare la cause. L'alternative — dénormaliser le nom dans `workout_sets` — demande une migration, un remplissage rétroactif et **fige un nom qui ne suivra plus les corrections d'orthographe ni les traductions**. Voir §4, c'est le cœur de l'US |
| **D3** | La restauration doit-elle gérer un conflit de nom ? | **Non, et ce n'est pas un raccourci** : il n'existe **aucune contrainte d'unicité sur le nom** d'un exercice, d'un programme ou d'un aliment — le nom vit dans les tables de traduction, sans index unique | Vérifié au schéma. Restaurer = remettre `deleted_at à null`, rien de plus. Inventer une gestion de conflit serait du code mort |
| **D4** | Restauration en cascade ? | **Oui, exactement en miroir** de l'archivage : entête d'abord, puis enfants (l'inverse de `archiveProgram`) | Restaurer un programme sans ses séances donnerait une coquille vide, plus déroutante que l'absence |
| **D5** | Un contenu archivé peut-il redevenir `published` ? | **La restauration ne touche pas `status`** : on remet `deleted_at à null`, le contenu retrouve le statut qu'il avait | Deux notions distinctes (`status` = brouillon/publié ; `deleted_at` = archivé/vivant). Les mélanger republierait un brouillon par accident |
| **D6** | Où vit la liste des archivés ? | **Un filtre de plus dans les écrans existants**, pas un nouvel écran | Trois écrans d'archives (exercices, programmes, aliments) pour une action rare, c'est de la surface d'UI pour rien. Le patron `statusFilter` est déjà là |
| **D7** | Que fait l'import CSV face à un aliment archivé ? | **Réactiver** (`deleted_at → null`) et le **compter dans le rapport d'import** | Bug silencieux trouvé au cadrage, voir §7. Aujourd'hui l'import ne peut que produire un résultat trompeur : soit il échoue sans le dire, soit il met à jour une ligne que personne ne voit |

## 2. Périmètre à livrer

**Dans le périmètre :**

1. **Compter les usages** avant d'archiver, et l'afficher dans la confirmation, pour les **3 types**
   de contenu éditorial : exercices, programmes, aliments.
2. **Voir les archivés** : un filtre « archivés » dans les 3 écrans de liste existants.
3. **Restaurer**, en cascade miroir, avec trace d'audit.
4. **Corriger la sync rule** pour que le contenu éditorial archivé reste résoluble par les appareils
   (D2) — et **masquer côté app** les contenus archivés dans les listes de **sélection**.
5. **i18n FR + EN** de tout le nouveau texte (admin **et** app).

**Hors périmètre, explicitement :**

- **Suppression définitive** (hard delete). On ne l'ouvre pas : le soft delete est la règle du projet,
  et un hard delete casserait les FK de l'historique — exactement le problème qu'on corrige.
- **Archivage du contenu *utilisateur*** (exercices et aliments persos, `owner_id = user`). Il est
  géré côté app et ne passe pas par l'admin.
- **Purge des contenus archivés depuis longtemps.** Sujet de rétention à part, sans urgence.
- **Modération des aliments signalés** (8.7) — reportée pour une autre raison (modèle privé).

## 3. Comportement attendu

### 3.1 Compter les usages (D1)

Avant d'archiver, l'admin compte les références **vivantes** (`deleted_at is null`) :

| Type | Tables comptées |
|---|---|
| **Exercice** | `workout_sets` (séries réalisées, tous utilisateurs) · `exercise_plans` (programmes qui le planifient) · `personal_records` · `exercise_variants` (liens de variante) |
| **Programme** | `sessions` et `exercise_plans` du programme (contenu propre) · `planned_sessions` qui le référencent (planning des utilisateurs) |
| **Aliment** | `food_entries` (journaux) · `recipe_ingredients` · `meal_template_items` |

La confirmation affiche ces décomptes en clair. Si le total est **zéro**, elle le dit aussi — c'est
l'information rassurante qui permet d'archiver sans hésiter.

⚠️ Ces décomptes traversent les données de **tous** les utilisateurs : la requête doit passer par un
compte à privilège admin (RLS), pas par la session d'un utilisateur. À instruire au plan.

### 3.2 Voir et restaurer

- Un filtre **« Archivés »** dans les écrans Exercices, Programmes et Aliments (valeurs :
  actifs / archivés / tous). Par défaut **actifs**, pour ne rien changer à l'usage courant.
- Une ligne archivée est **visuellement distincte** (libellé « Archivé le JJ/MM/AAAA »), et sa seule
  action est **Restaurer**.
- Restaurer demande confirmation, remet `deleted_at à null` en cascade miroir, **ne touche pas
  `status`** (D5), et écrit une entrée d'audit (`*.restore`).

### 3.3 Ce que voit l'utilisateur de l'app (D2)

- **Historique** (séances passées, journal alimentaire, records) : le nom **continue de s'afficher**,
  archivé ou non. C'est l'objet de l'US.
- **Listes de sélection** (choisir un exercice, un aliment, adopter un programme) : le contenu
  archivé **n'apparaît pas**. Un contenu retiré du catalogue ne doit plus être choisissable.
- **Programme déjà adopté** par un utilisateur : sa copie lui appartient (`owner_id = user`) et n'est
  pas concernée par l'archivage de l'éditorial.

## 4bis. Deux corrections au diagnostic, constatées à l'implémentation (29/07/2026)

**1. Le journal alimentaire n'est PAS affecté.** `food_entries` stocke le nom de l'aliment en
**instantané** ([journal-repository.ts:49](../../../../apps/mobile/src/data/repositories/journal-repository.ts#L49)) :
il survit donc déjà à l'archivage. La §0 généralisait à tort « aucun nom dénormalisé » — c'est vrai
de `workout_sets`, faux de `food_entries`. **Seuls l'historique muscu et les records** perdaient le nom.

**2. Le risque que le plan redoutait n'existait pas, et le vrai correctif est ailleurs.** Le plan
craignait qu'après le changement de sync rule, du contenu archivé apparaisse dans les listes de
sélection. Vérification faite requête par requête : **toutes** les lectures de sélection filtrent
**déjà** `deleted_at IS NULL` sur le parent éditorial (`SELECT_EXERCISES`, `SELECT_FOODS`,
`SELECT_PROGRAM_BASE`…). Rien à ajouter de ce côté.

En revanche les **jointures de traduction** filtraient elles aussi `deleted_at` — et comme archiver un
exercice soft-delete ses traductions, le nom restait introuvable **même en répliquant** la ligne
archivée. Le correctif réel tient donc en trois points ciblés :

| # | Changement | Pourquoi |
|---|---|---|
| a | `shared_content` : plus de filtre `deleted_at` sur `exercises` et `exercise_translations` | pour que la ligne archivée **existe** encore en local |
| b | `SELECT_SETS_FOR_WORKOUT` : les jointures de traduction ne filtrent plus `deleted_at` | pour que le nom soit **résolu** dans l'historique |
| c | Résolution de nom des records : ni `e.deleted_at` ni les traductions ne sont filtrés | même raison, sur la surface records |

Les autres tables de `shared_content` (`programs`, `sessions`, `exercise_plans`, `foods`,
`food_translations`, `exercise_variants`) **gardent** leur filtre : aucune surface d'historique n'en
dépend pour résoudre un libellé, donc répliquer leurs lignes mortes n'apporterait rien.

## 4. Le point technique qui décide de tout (D2)

Aujourd'hui, `shared_content` filtre `deleted_at is null` sur les tables éditoriales. Résultat :
archiver = **faire disparaître la ligne des appareils**, donc perdre le nom dans l'historique.

**Correction proposée** : retirer ce filtre pour les tables éditoriales de `shared_content`, et
déplacer le masquage **dans l'app**, là où il relève de l'usage (une liste de sélection) et non du
transport.

Conséquences à assumer, et il faut les regarder en face :

- ⚠️ **La sync rule devra être redéployée à la main** sur l'instance PowerSync — étape manuelle,
  déjà oubliée une fois le 24/07.
- Les requêtes de l'app qui listent du contenu éditorial **doivent être auditées une par une** :
  celles qui alimentent une **sélection** ont besoin d'un `deleted_at IS NULL` explicite ; celles qui
  résolvent un **nom d'historique** ne doivent surtout pas l'avoir. C'est le vrai travail de cette US,
  et le risque de régression est là — pas dans l'admin.
- Le volume répliqué augmente très légèrement (quelques lignes mortes). Négligeable.

> **Alternative écartée** : dénormaliser le nom dans `workout_sets` / `food_entries`. Elle demande une
> migration, un remplissage rétroactif, et surtout elle **fige** le nom : une correction d'orthographe
> ou une traduction améliorée ne remonterait plus dans l'historique. Elle règle le symptôme en créant
> une seconde vérité.

## 5. i18n (FR + EN)

- **Admin** : libellés du filtre, texte de confirmation **avec les décomptes** (pluriels), libellé
  « Archivé le … », bouton et confirmation de restauration, messages d'erreur.
- **App** : rien de neuf **si** D2 est retenue — c'est bien l'intérêt : on ne fabrique pas de texte
  « contenu archivé » à traduire, l'historique affiche simplement le vrai nom.
- Aucune chaîne en dur, de part et d'autre.

## 6. Offline

L'admin est une **application web en ligne** : pas de contrainte offline-first de son côté.

Côté app, l'effet de D2 est **favorable** : le contenu éditorial archivé reste dans la base locale,
donc l'historique reste lisible **même hors ligne** — ce qui n'est pas le cas aujourd'hui.

## 7. Cas limites

| Situation | Comportement attendu |
|---|---|
| Archiver un contenu à zéro usage | Autorisé, la confirmation indique explicitement « aucun usage ». |
| Archiver un exercice utilisé par 128 séries | Autorisé, la confirmation affiche le décompte (D1). |
| Restaurer un contenu dont le parent est archivé (séance d'un programme archivé) | Restaurer le **programme** restaure ses enfants (D4). Restaurer un enfant seul n'est pas proposé. |
| Archiver puis restaurer aussitôt | Idempotent : l'état revient exactement à l'initial, `status` inchangé. |
| Deux admins archivent le même contenu simultanément | Dernière écriture gagnante ; l'opération est idempotente (`.is('deleted_at', null)` déjà utilisé par `archiveProgram`). |
| Contenu archivé présent dans un programme **déjà adopté** par un utilisateur | Sa copie lui appartient, elle n'est pas touchée. L'historique reste lisible. |
| Échec en cours de cascade | On s'arrête et on renvoie l'erreur ; l'UI invite à **retenter** (le rejeu ne touche que les lignes encore dans le mauvais état) — comportement déjà en place sur `archiveProgram`. |
| **Ré-importer un CSV contenant un aliment archivé** | 🐛 **Bug silencieux trouvé au cadrage.** L'import fait `upsert(foodRows, { onConflict: 'import_key' })` ([foods.ts:323](../../../../apps/admin/src/data/foods.ts#L323)) et `import_key` **est unique**. La ligne archivée est donc **mise à jour sans que `deleted_at` soit remis à null** : l'aliment reste invisible partout, et le rapport d'import annonce un succès. L'admin croit avoir réimporté l'aliment, il n'en est rien. → **D7** : l'import doit réactiver et **le dire dans son rapport**. |
| Sync rule non redéployée après la migration | L'admin fonctionne, mais **le bug d'historique reste entier**. D'où sa place en DoD. |

## 8. Definition of Done

- [ ] D1 → D6 arbitrées par Florian ou Damien.
- [ ] Décompte des usages pour les 3 types, affiché dans la confirmation d'archivage.
- [ ] Filtre « archivés » dans les 3 écrans, restauration en cascade miroir, audit sur les 2 actions.
- [ ] `shared_content` corrigée dans [powersync-sync-rules.yaml](../../technical/powersync-sync-rules.yaml)
      **et redéployée à la main** sur l'instance.
- [ ] **Audit exhaustif** des requêtes de l'app listant du contenu éditorial : `deleted_at IS NULL`
      ajouté aux listes de **sélection**, absent des résolutions de **nom d'historique**.
- [ ] Briques de comptage **pures et testées** là où c'est possible.
- [ ] i18n FR + EN complètes côté admin.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test` verts.
- [ ] Roadmap 8.11 → ✅.

## 9. Critères d'acceptation (recette — **navigateur**, pas d'APK)

1. Archiver un exercice utilisé affiche un décompte d'usages **exact** (recoupé en base).
2. Archiver un exercice inutilisé indique explicitement « aucun usage ».
3. Le filtre « archivés » montre le contenu archivé, avec sa date, dans les 3 écrans.
4. Restaurer le fait réapparaître dans la liste active, **avec son `status` d'avant**.
5. Restaurer un programme restaure aussi ses séances et ses plans d'exercice.
6. Le journal d'audit porte une entrée pour l'archivage **et** pour la restauration.
7. **Le test qui compte** (device, à faire au prochain build) : une séance contenant un exercice
   archivé affiche **toujours son nom** dans l'historique, et cet exercice **n'apparaît plus** dans la
   liste de sélection d'un nouvel exercice.
8. Le parcours « adopter un programme » ignore les programmes archivés.
