# TODO — Wellness App

Suivi **vivant** des tâches. On y ajoute les US au fur et à mesure qu'elles entrent dans le
pipeline ; la commande [`/commit`](.claude/commands/commit.md) coche ce qui vient d'être livré.

- Légende : `[ ]` à faire · `[~]` en cours · `[x]` fait
- Le **backlog complet** (179 US, V0.1 → V1.1) vit dans
  [docs/roadmap/roadmap.md](docs/roadmap/roadmap.md) — ne pas le recopier ici, seulement
  remonter les US actives.
- Rappel workflow (voir [CLAUDE.md](CLAUDE.md)) : **spec → plan → design → validation → code**.
  Chaque US = une branche (`feature/…`, `fix/…`, `chore/…`).

> ## 🟡 EN COURS — MUSC-F13 Niveaux d'affichage de la séance (Simplifiée / Normale / Détaillée)
>
> Promue depuis [IDEAS.md](IDEAS.md) (idée 23/07). Adapter la densité de l'écran de séance muscu au niveau de
> l'utilisateur via 3 niveaux qui pilotent la visibilité des champs de `CurrentSetCard`. Réglage synchronisé
> `profiles.workout_display_level` (défaut `normal`) + étape d'onboarding (compteur 3→4) + entrée Réglages.
> Périmètre Muscu. Branche `feature/muscf13-niveaux-affichage-seance`.
> Spec : [muscf13-niveaux-affichage-seance.md](docs/specs/functional/us/muscf13-niveaux-affichage-seance.md).
>
> - [x] **Spec** — écrite, revue subagent contre le code (**APPROUVÉ**, 5 imprécisions corrigées), **validée Florian (23/07)**.
> - [x] **Plan d'implémentation** — écrit (9 tâches TDD), revue subagent (1 bloquant + 3 mineurs **corrigés**). [plan](docs/plans/muscf13-niveaux-affichage-seance.md).
> - [x] **Maquette** — [design/muscf13/muscf13.html](design/muscf13/muscf13.html) : 3 niveaux côte à côte + matrice + aperçus onboarding/Réglages.
> - [x] **Validation** des 3 livrables — **Florian (23/07) ✅**.
> - [x] **Code livré (subagent-driven)** — 8 commits : shared (enum/coercition/matrice pures, testées) → migration cloud `workout_display_level` (appliquée + types + schéma PowerSync) → champ profil + mapping repo (coercition NULL→normal) → gating `CurrentSetCard` par prop `level` (+ 3 smoke tests) → câblage `workout.tsx` → réglage Réglages → étape onboarding (compteur 3→4) → i18n FR/EN. Revue finale **PRÊT À MERGER** (0 bloquant). typecheck/lint/807 shared+70 mobile verts.
> - [x] **MUSC-F13b — Vignette d'aperçu par niveau à l'onboarding** (retour Florian, 23/07) : composant décoratif `WorkoutLevelPreview` (schématique, piloté par `workoutFieldVisibility`) affiché sous chaque option. Branche `feature/muscf13b-vignette-onboarding`, 73 tests mobile verts.
> - [ ] **Recette device** (Florian) + relecture Damien (MUSC-F13 + F13b).

> ## ✅ CODE LIVRÉ — Couleurs des menus, réintroduites avec un toggle on/off (`feature/couleurs-menu-toggle`, 22/07/2026) — **reste recette device (Florian/Damien)**
>
> Retour sur le rollback `1ae20d4` (couleur d'accent par menu, commit original `751fa5d`, jugée peu
> lisible) : Florian souhaite la remettre, **cette fois pilotable par un réglage**. Spec ajoutée :
> [compte-profil-onboarding.md §4.3](docs/specs/functional/compte-profil-onboarding.md).
>
> - [x] Revert de `1ae20d4` (`git revert`, propre — seul conflit CHANGELOG résolu manuellement) :
>   restaure `menu-accent-store.ts`, `useMenuFocus.ts`, `useTheme.ts`, onglets, `settings.tsx`, i18n.
> - [x] Nouveau réglage **« Activer les couleurs par menu »** (Réglages → Apparence), **off par défaut**.
>   Off → accent unique (orange) pour tous les onglets (comportement actuel inchangé). On → couleurs
>   par onglet + pastilles + bouton réinitialiser (4 couleurs par défaut, pas l'orange unique).
> - [x] `enabled` persisté en local device (`secureStorage`), même logique que les couleurs
>   (non synchronisé, aucune migration).
> - [x] i18n FR/EN (`settings.menuColors.enable`).
> - [x] typecheck/lint/781 tests verts.
> - [ ] **Recette device** (Florian/Damien) : toggle off → orange partout ; toggle on → couleurs par
>   onglet + persistance après redémarrage app.
>
> ## ✅ RECETTE VALIDÉE — US NUTR-17 Régularité du journal (Stats nutrition mobile, Florian, 17/07/2026) — **RECETTÉ & VALIDÉ ✅** (plan conservé pour trace ; reste relecture Damien)
>
> Code **livré & mergé sur `dev`** (`feature/nutr17-regularite-journal`, `9b8b1ec`→`f6b54a1`). **100 %
> JS → reload Metro suffit** (aucune migration). Recette sur l'**app mobile** (Nutrition → Stats).
> Spec : [us/nutr17-regularite-journal.md](docs/specs/functional/us/nutr17-regularite-journal.md).
>
> **Préparation** : avoir logué **certains jours passés** et **sauté** d'autres jours sur la ou les 2
> dernières semaines.
>
> **1. Carte « Régularité du journal » (Nutrition → Stats)**
> - [ ] La carte affiche un **pct %** + « **N / M jours renseignés** » (M = fenêtre effective).
> - [ ] Cohérent : N = nb de jours (passés) avec au moins une entrée ; M = taille de la fenêtre effective.
> - [ ] Le sélecteur **7 j / 30 j** (partagé apports/adhérence/régularité) recalcule les 3 cartes.
>
> **2. Aujourd'hui exclu**
> - [ ] Logguer un aliment **aujourd'hui** ne fait **pas** bouger le taux (aujourd'hui n'est pas compté ;
>   la fenêtre s'arrête à hier).
>
> **3. Borne ancienneté (compte récent)**
> - [ ] Sur un compte dont la **1ʳᵉ entrée est récente** (ex. il y a 3 jours), fenêtre 30 j → le
>   dénominateur est **3** (jours depuis la 1ʳᵉ entrée), pas 30 → taux non écrasé artificiellement.
>
> **4. État vide**
> - [ ] Aucune entrée passée (ou 1ʳᵉ entrée = aujourd'hui) → « Commence à remplir ton journal ».
>
> **5. i18n** — [ ] En **anglais** : « Logging consistency », « N/M days logged », « Start logging your journal ».
>
> **Critère de validation** : points 1 + 2 + 3 OK (2 et 3 = les règles spécifiques). Tout écart → me
> remonter le détail. Une fois validé → NUTR-17 `[x]` + relecture Damien.

> ## ✅ RECETTE VALIDÉE — US NUTR-10 Adhérence à l'objectif (Stats nutrition mobile, Florian, 17/07/2026) — **RECETTÉ & VALIDÉ ✅** (plan conservé pour trace ; reste relecture Damien)
>
> Code **livré & mergé sur `dev`** (`feature/nutr10-adherence-objectif`, `bf689ef`→`f61b194`).
> **Migration cloud déjà appliquée** (`db:push` + `db:types`). Recette sur l'**app mobile** (Nutrition →
> Stats + profil nutritionnel). Spec : [us/nutr10-adherence-objectif.md](docs/specs/functional/us/nutr10-adherence-objectif.md).
>
> **Préparation** : un profil nutritionnel avec **objectif calorique défini** ; logguer **plusieurs
> jours** cette/ces semaine(s), certains proches de l'objectif, d'autres loin ; idéalement **un jour de
> séance** (muscu ou course) bien mangé.
>
> **1. Carte « Adhérence à l'objectif » (Nutrition → Stats, section apports)**
> - [ ] La carte affiche un **pct %** + « **N / M jours dans la cible** » (M = jours renseignés).
> - [ ] Les chiffres sont **cohérents** avec la marge : un jour à ±marge % de l'objectif compte comme dans la cible, au-delà non.
> - [ ] Le sélecteur **7 j / 30 j** (partagé avec les apports moyens) recalcule aussi l'adhérence.
>
> **2. Objectif effectif (jour de séance)**
> - [ ] Un **jour de séance** est comparé à l'objectif **+ bonus** (pas à la base) : un jour de séance
>   où tu as mangé « objectif + bonus » compte **dans la cible** (et non « au-dessus »).
>
> **3. Marge configurable (profil nutritionnel)**
> - [ ] Dans le profil nutritionnel, le réglage **Marge d'adhérence** (5 % / 10 % / 15 %) est présent.
> - [ ] Changer la marge → la carte Adhérence **se recalcule** (marge plus large = plus de jours dans la cible).
> - [ ] Le réglage est **conservé** au relancement (et se synchronise entre appareils).
>
> **4. États limites**
> - [ ] Profil **sans objectif** → « Définis ton objectif calorique » (pas de flash au chargement).
> - [ ] Fenêtre **sans jour renseigné** → « Aucun jour renseigné ».
>
> **5. i18n** — [ ] En **anglais** : « Goal adherence », « N/M days on target », « ±X% of the goal », « Adherence margin ».
>
> **Critère de validation** : points 1 + 2 + 3 OK (2 = objectif effectif, cœur de l'US ; 3 = marge
> configurable). Tout écart → me remonter le détail. Une fois validé → NUTR-10 `[x]` + relecture Damien.

> ## ✅ RECETTE VALIDÉE — US MR-06 Widget « Temps d'entraînement » (dashboard mobile, Florian, 17/07/2026) — **RECETTÉ & VALIDÉ ✅** (plan conservé pour trace ; reste relecture Damien)
>
> Code **livré & mergé sur `dev`** (`feature/mr06-temps-entrainement`, `f1c8a5a`→`6face77`). **100 % JS
> → reload Metro suffit** (aucun build, aucune migration). Recette sur l'**app mobile** (accueil/dashboard).
> Spec : [us/mr06-temps-entrainement.md](docs/specs/functional/us/mr06-temps-entrainement.md).
>
> **Préparation** : avoir au moins **1 séance muscu terminée** ET **1 course terminée** dans la
> **semaine en cours** (lundi→dimanche). Ouvrir l'accueil (dashboard).
>
> **1. Affichage nominal (2 piliers actifs)**
> - [ ] Le widget **« Temps d'entraînement »** apparaît sur l'accueil.
> - [ ] **Total** = somme des durées (muscu + course) de la semaine, format « Xh YY ».
> - [ ] **Ventilation** affichée : « muscu Xh YY · course Xh YY ».
> - [ ] **Réconciliation** : la durée course correspond à « Résumé running semaine » ; les séances muscu
>   comptées sont les mêmes que « Volume muscu semaine » (même semaine lundi→dimanche).
>
> **2. Gating par pilier**
> - [ ] Désactiver **Course** (Réglages → piliers) → widget **toujours visible**, **total = muscu seul**,
>   **pas de ligne de ventilation** (elle ne s'affiche que si les 2 piliers sont actifs).
> - [ ] Désactiver **Muscu** aussi (ne garder que Nutrition) → widget **absent** de l'accueil.
> - [ ] Réactiver muscu + course → widget de retour avec total + ventilation.
>
> **3. État vide**
> - [ ] Sur une semaine **sans aucune séance ni course** (ex. naviguer un lundi tôt, ou compte de test) →
>   « 0h 00 » / « Aucune séance cette semaine ».
>
> **4. Personnalisation (mode édition dashboard)**
> - [ ] Passer le widget en **compact** → une ligne cohérente (total ou « Aucune séance… »).
> - [ ] Le **masquer / déplacer** fonctionne comme les autres widgets (réordonnancement conservé).
>
> **5. i18n** — [ ] Basculer en **anglais** (Réglages → Langue) → « Training time », « strength »/« running », « No session this week ».
>
> **Critère de validation** : points 1 + 2 OK (2 = gating, le cœur inter-piliers). Tout écart (surtout si
> les chiffres ne coïncident pas avec les widgets voisins) → me remonter le détail. Une fois validé →
> MR-06 `[x]` + relecture Damien.

> ## ✅ RECETTE VALIDÉE — US 8.8 Gestion des utilisateurs : consultation (8.8a) + bannissement (8.8b) (back-office web, Florian, 17/07/2026)
>
> **RECETTÉ & VALIDÉ (Florian, 17/07/2026) ✅ → US 8.8 CLOSE (8.8a + 8.8b).** Seul écart remonté : la
> colonne « Piliers » affichait « — » pour tous les comptes → corrigé séparément
> (`fix/admin-piliers-affichage`, §🐞) et **revérifié OK par Florian**. Reste : relecture Damien.
> Plan de recette conservé ci-dessous pour trace.
>
> Code **livré & mergé sur `dev`** (8.8a `feature/8.8a-…` + 8.8b `feature/8.8b-…`). **Migrations cloud
> déjà appliquées** (`db:push` + `db:types`). Recette sur le **back-office web** (`apps/admin`) — pas
> l'app mobile. **Se recette d'un bloc** (même écran `/users`). Specs :
> [8.8a](docs/specs/functional/us/8.8a-admin-consultation-utilisateurs.md) ·
> [8.8b](docs/specs/functional/us/8.8b-admin-bannissement.md).
>
> **Préparation** : lancer l'admin (`npm run dev -w @wellness/admin`), se connecter en **super_admin**.
> Avoir sous la main : un **compte utilisateur normal** (non-admin, sera la cible du ban) ; idéalement un
> compte **moderator** et un compte **content_editor** (rôles attribuables via l'écran `/roles`) pour les
> tests d'accès et de garde-fous.
>
> **1. Accès par rôle — 8.8a (sécurité/RGPD, prioritaire)**
> - [ ] **super_admin** : l'entrée « 👤 Utilisateurs » apparaît dans la barre latérale → clic → la liste s'affiche.
> - [ ] **moderator** : même accès (entrée visible + liste).
> - [ ] **content_editor** : l'entrée « Utilisateurs » est **absente** ; saisir l'URL `/users` à la main → **redirection vers l'accueil** ; la liste ne s'affiche jamais.
>
> **2. Liste `/users` — 8.8a**
> - [ ] Tableau peuplé : **E-mail · Inscrit le · Dernière connexion · Piliers · Statut**.
> - [ ] **Recherche par e-mail** : taper une partie d'un e-mail → la liste se filtre (insensible casse).
> - [ ] **Pagination** (si > 25 comptes) : Précédent/Suivant + « Page X / Y » ; boutons désactivés aux bornes.
> - [ ] Compte **sans profil** (onboarding non terminé) → apparaît quand même, colonnes profil à « — ».
> - [ ] Dernière connexion **« Jamais »** pour un compte jamais connecté.
>
> **3. Fiche `/users/:id` — 8.8a**
> - [ ] Clic sur une ligne → fiche : sections **Compte / Configuration / Profil**.
> - [ ] Contenu **sobre** : e-mail, inscription, dernière connexion, statut, piliers, langue, prénom, objectif, onboarding oui/non.
> - [ ] **AUCUNE donnée de santé** (pas de poids, taille, sexe, date de naissance) — nulle part.
> - [ ] Retour à la liste OK ; id inexistant (URL bidon) → « Utilisateur introuvable ».
>
> **4. Bannir / débannir — 8.8b (parcours nominal, super_admin)**
> - [ ] Fiche d'un **compte normal** → section « Modération » → **Bannir** → invite de **motif** →
>   saisir un motif → statut **« Banni »** + **motif** affiché + ligne dans l'**historique** (date · Banni · motif · acteur).
> - [ ] **Débannir** → confirmation → statut **« Actif »** + ligne « Débanni » dans l'historique.
> - [ ] **Motif vide** (annuler l'invite ou laisser vide) → **aucune** action.
>
> **5. Garde-fous du ban — 8.8b (sécurité, prioritaire)**
> - [ ] Sur **sa propre fiche** (super_admin) → **« Ce compte ne peut pas être banni »**, pas de bouton.
> - [ ] Sur la fiche d'un **compte admin** (super_admin/moderator/content_editor) → idem, **pas de bouton**.
> - [ ] En **moderator** : peut bannir/débannir un compte normal (mêmes écrans). _(Sa trace n'apparaît pas dans `/audit` — normal, journal réservé super_admin.)_
>
> **6. Effet réel du ban — 8.8b (cœur du mécanisme)**
> - [ ] Un **compte banni** perd l'accès à l'app mobile / la synchro **au prochain rafraîchissement de
>   session** (~1 h) **ou** après déconnexion/reconnexion (connexion refusée). _(À vérifier sur un vrai
>   compte de test : `banned_until` bloque le refresh du token.)_
>
> **Critère de validation** : points **1, 3, 4, 5, 6** OK (1 & 5 = sécurité, prioritaires ; 6 = confirme
> que le ban agit vraiment). Tout écart → me remonter le détail (rôle, compte, capture, étape). Une fois
> validé → cocher **8.8a `[x]` + 8.8b `[x]` → US 8.8 close** + relecture Damien. _NB : le **fix nutrition**
> (bloc ci-dessous) est indépendant et se recette sur mobile._

> ## ✅ RECETTE VALIDÉE — Fix édition/suppression d'une entrée de repas (Florian, 17/07/2026) — **RECETTÉ & VALIDÉ ✅** (plan conservé pour trace ; reste relecture Damien)
>
> Code **livré & mergé sur `dev`** (`fix/journal-entree-swipe-edition`, commits `5e00ac9`→`0729039`).
> **100 % JS → reload Metro suffit** (aucun nouveau build). Spec :
> [us/fix-journal-entree-swipe-edition.md](docs/specs/functional/us/fix-journal-entree-swipe-edition.md).
>
> **Préparation** : ouvrir l'écran **Nutrition**, sur un jour ayant au moins **(a)** un aliment
> référencé (avec quantité en g), **(b)** un **Ajout rapide (calories)** sans quantité, et si possible
> **(c)** un aliment scanné/OpenFoodFacts (avec micronutriments).
>
> **1. Swipe & découvrabilité**
> - [ ] Balayer une entrée **vers la gauche** → 2 actions : **Modifier** (doré) + **Supprimer** (rouge).
> - [ ] Les actions **ne sont pas rognées/coupées** par les bords de la carte du repas (⚠️ point de vigilance `overflow:hidden` — vérifier surtout la **dernière** entrée d'un repas, coins arrondis).
> - [ ] **Supprimer** → confirmation (titre = nom de l'entrée) → l'entrée disparaît, **totaux du jour** mis à jour.
> - [ ] **Modifier** → le détail s'ouvre **directement en mode édition**.
>
> **2. Tap & appui long**
> - [ ] **Tap** simple sur une entrée → détail en **consultation** (pas en édition).
> - [ ] **Appui long** → **ne fait plus rien** (l'ancienne suppression cachée est retirée).
>
> **3. Édition d'un quick add (entrée sans quantité)**
> - [ ] Modifier un **Ajout rapide** → champs **Nom + Calories (kcal) + Protéines/Glucides/Lipides** éditables.
> - [ ] Changer nom + kcal + une macro → **Enregistrer** → valeurs à jour dans la liste **et** les totaux.
> - [ ] Ramener **Calories à 0** → bouton **Enregistrer désactivé**.
>
> **4. Édition d'une entrée avec quantité (NON-RÉGRESSION)**
> - [ ] Modifier un aliment référencé → **un seul champ « Quantité (g) »**.
> - [ ] Changer les grammes → kcal/macros **recalculés proportionnellement** → Enregistrer OK.
> - [ ] Les **micronutriments** de l'entrée restent corrects (non effacés).
>
> **5. i18n** — [ ] Passer l'app en **anglais** (Réglages → Langue) → libellés swipe (Edit/Delete),
> champs (Name, Calories (kcal)…) et hint bien traduits.
>
> **6. Offline** — [ ] En **mode avion** : modifier + supprimer fonctionnent (écriture locale), puis
> **resync** à la reconnexion.
>
> **7. Confort** — [ ] Après Modifier/Supprimer, en revenant à la liste, **aucune ligne ne reste
> « ouverte »** en position swipée.
>
> **Critère de validation** : points 1→5 OK (6/7 = confort/offline, bonus). Tout échec → me remonter le
> détail (entrée concernée, capture, étape). Une fois validé → cocher le bug §🐞 en `[x]` + relecture Damien.

> ## ✅ Recettes device — TOUTES VALIDÉES (Florian, 16/07/2026)
>
> Les 6 US ci-dessous ont été **recettées et validées par Florian le 16/07/2026** (APK release
> autonome + dataset de recette `supabase/scripts/recette-dataset.sql`). Historique des plans de
> recette conservé ci-dessous pour trace.
>
> - [x] **✅ RECETTE US 8.10 — Log d'audit admin** — code **mergé sur `dev`** (`d7b2976`, 14/07/2026),
>   **RECETTÉ & VALIDÉ (Florian, 16/07/2026) ✅**. Recette prévue par **Florian le soir du 15/07/2026**. Dérouler le plan de
>   recette complet (accès `/audit` super_admin, 1 action de chaque type → entrée correcte, no-op/
>   dépublication/sous-éditions non tracées, **immuabilité** update/delete refusés en SQL, filtres +
>   pagination, i18n). Point 4 (publication via formulaire d'édition = `exercise.update`) **accepté**.
>   Migration déjà appliquée sur le cloud. **8.10 validée → 8.7 (modération) puis 8.8 (utilisateurs) débloquées.**
>
> - [x] **✅ RECETTE US 4.32 — Alerte croisée déficit + fort volume** — code **mergé sur `dev`**
>   (15/07/2026), **RECETTÉ & VALIDÉ (Florian, 16/07/2026) ✅**. Recette prévue par **Florian le soir du 15/07/2026**.
>   Dérouler le plan : (1) provoquer l'alerte (≥ 4 jours loggés, moyenne ~≥ 15 % sous l'objectif +
>   volume muscu 7 j ≥ 8000) → widget « Nutrition & charge » sur le dashboard avec le % ; (2) la lever
>   (repli) ; (3) seuil < 4 jours → pas d'alerte ; (4) **gating piliers** (désactiver Nutrition ou
>   Muscu → widget disparaît) ; (5) message + i18n FR/EN ; (6) **l'ancienne alerte a bien disparu de
>   l'écran Stats nutrition** ; (7) mode édition dashboard (cadre vide = constat d'ergonomie) ;
>   (8) offline. JS pur → reload Metro suffit (pas de nouveau build). Widget conditionnel, 100 % client.
>
> - [x] **✅ RECETTE US RN-01/RN-02 — Dépense course → objectif du jour** — code **livré sur la branche
>   `feature/rn01-depense-course-objectif`**, **RECETTÉ & VALIDÉ (Florian, 16/07/2026) ✅**. ⚠️ **AVANT TOUT : appliquer la
>   migration cloud** (`npm run db:push` de `20260715152227_nutrition_training_bonus_mode` + `npm run
>   db:types`) — **impératif AVANT de basculer un device synchronisé en mode Auto**, sinon la file de
>   synchro PowerSync peut se bloquer (colonne inconnue côté Postgres). Puis dérouler : (1) mode
>   **Forfait** = comportement **inchangé** (bonus fixe les jours de séance) ; (2) passer en **Auto**,
>   faire une course → l'objectif du jour monte de la dépense estimée, badge « · course » ; (3) jour
>   **muscu seul** en Auto → repli forfait (badge « jour de séance ») ; (4) **plusieurs courses** le
>   même jour = somme ; (5) **sans pesée** → repli forfait ; (6) **navigation par jour** dans le journal
>   (objectif/badge du jour affiché, pas d'aujourd'hui) ; (7) **gating** running+nutrition ; (8) i18n
>   FR/EN ; (9) offline. Après migration, JS pur → reload Metro suffit.
>
> - [x] **✅ RECETTE US MUSC-04 — Courbe 1RM estimé + période « tout »** — code **livré sur la branche
>   `feature/musc04-courbe-1rm-periode-tout`** (mergée `dev`), **RECETTÉ & VALIDÉ (Florian, 16/07/2026) ✅**. Écran Muscu →
>   Progression → sélectionner un exercice avec historique : (1) les **3 métriques** (charge max /
>   volume / **1RM estimé**) tracent une courbe cohérente ; (2) les **4 périodes** (30 j / 90 j / 1 an /
>   **tout**) ; (3) `max_weight`/`volume` **inchangées** (non-régression) ; (4) le 1RM estimé suit le
>   **meilleur set par séance** (montre aussi les baisses) ; (5) exercice **au poids du corps** (charge 0)
>   → **absent** de la courbe 1RM (voulu) ; (6) empty states (exercice sans historique) ; (7) i18n FR/EN.
>   **Pas de migration, JS pur** → reload Metro suffit (pas de nouveau build).
>
> - [x] **✅ RECETTE US META-06 — Comparaison période N vs N-1** — code **livré & mergé sur `dev`**,
>   **RECETTÉ & VALIDÉ (Florian, 16/07/2026) ✅**. Vérifier le badge « vs période précédente » (flèche + %, ton neutre) sur
>   **3 surfaces** : (1) **Course** historique → sous distance/temps/nb, delta en semaine ET mois ;
>   période **« tout » → aucun badge** ; (2) **Nutrition** stats → carte apports moyens, delta **kcal**
>   en 7 j ET 30 j ; (3) **Muscu** Progression → volume hebdo **total** + delta « vs semaine
>   précédente ». Cas **« nouveau »** (période précédente vide) ; lisibilité thème clair/sombre ;
>   non-régression des chiffres courants. **Pas de migration, JS pur** → reload Metro suffit.
>
> - [x] **✅ RECETTE US MUSC-05 — Équilibre musculaire (14 j)** — code **livré & mergé sur `dev`**,
>   **RECETTÉ & VALIDÉ (Florian, 16/07/2026) ✅**. Écran Muscu → Progression, nouvelle section « Équilibre musculaire (14 j) » :
>   (1) barres **par nombre de séries** par groupe, colorées (délaissé = doré, équilibré = bordeaux,
>   sur-représenté = grisé) ; (2) **alerte douce** listant les groupes délaissés quand l'historique 14 j
>   est **≥ 12 séries** ; (3) historique **maigre** (< 12 séries) → barres possibles mais **pas d'alerte** ;
>   (4) aucune séance 14 j → état vide ; (5) **non-régression** de la section « volume hebdo » (tonnage)
>   juste au-dessus ; (6) i18n FR/EN. **Pas de migration, JS pur** → reload Metro suffit.
>
> - 🧰 **Outillage recette (16/07/2026)** : `supabase/scripts/recette-dataset.sql` (jeu de test
>   ~3 mois couvrant MUSC-04/05, META-06, 4.32, RN-01/02 — à jouer dans le **SQL Editor** cloud,
>   renseigner `v_email`, **hard delete** ciblé) + `recette-verification.sql` (grille de contrôles
>   ✅/⚠️). Pour recetter **sur device sans quota EAS** : APK autonome (mode B) →
>   [dev-build-android-local.md](docs/specs/technical/dev-build-android-local.md) §4.

*Dernière mise à jour : 23/07/2026 (**MUSC-F13 — SPEC VALIDÉE (Florian) ✅** : nouvelle US promue d'IDEAS —
3 niveaux d'affichage de la séance (Simplifiée / Normale / Détaillée) pilotant la visibilité des champs de
`CurrentSetCard` ; réglage synchronisé `profiles.workout_display_level` (défaut `normal`), étape d'onboarding
(compteur 3→4) + entrée Réglages, périmètre Muscu. Spec écrite + revue subagent contre le code (**APPROUVÉ**,
5 imprécisions corrigées). Branche `feature/muscf13-niveaux-affichage-seance`. **Prochaine étape : plan
d'implémentation → maquette → validation.** Précédemment : **FIX CI — timeout Jest `edit-exercise-modal-smoke` ✅** : le 1ᵉʳ test du suite dépassait le défaut de 5 s en CI en payant le coût de démarrage à froid (transfo Babel + RN + react-i18next + safe-area) dans son corps ; cache de transformation Jest non persisté en CI + runner 2 cœurs. Fix = `testTimeout: 15000` dans `apps/mobile/jest.config.js` ; 16 suites / 67 tests verts. Précédemment : **FIX modales exo (création + édition) ✅** : retour recette Florian —
les modales étaient tronquées en bas (boutons sous la barre de gestes, scroll non évident). Corrigé :
**pied de page fixe** (boutons toujours visibles) + champs défilants + **safe-area** basse ; mock
`react-native-safe-area-context` ajouté au setup jest. 67 tests mobile verts. **Recette validée
(Florian, 23/07/2026) ✅.** Branche `fix/modales-exo-tronquees`. — **MUSC-F12 — CODE LIVRÉ ✅** : cohérence fiche exo perso ↔
bibliothèque. `updateCustomExercise` gère désormais **instructions + muscles secondaires** (helper pur
`buildCustomExerciseWrite` testé) ; nouvelle **`EditExerciseModal`** (bottom-sheet) remplace le formulaire
d'édition inline de la fiche ; correctif revue (réinit à la fermeture : `saving` figé + saisies annulées).
Aucune migration ; typecheck/lint verts, 67 tests mobile + 800 shared. **Reste : recette + relecture Damien.**
Branche `feature/muscf12-coherence-fiche-exo-perso`. — **MUSC-F11 — CODE LIVRÉ (subagent-driven) ✅** : création d'exercice
perso en **modale bottom-sheet** (retour recette F10c). Remplace la card inline (effet sandwich, Segment
multi-ligne, nom sans placeholder) par une modale (`CreateExerciseModal`) : nom + placeholder, groupe
`scrollable`, clavier géré. Aucune migration ; typecheck/lint verts, 62 tests mobile. **Reste : recette +
relecture Damien.** Point 1 du retour recette (cohérence fiche biblio VS perso) = **US suivante à cadrer**.
Branche `feature/muscf11-modale-creation-exo`. — **Lot F10c — RECETTE VALIDÉE (Florian, 23/07/2026) ✅** : F10c-1
(muscles secondaires) + F10c-2 (variantes/alternatives) validés en recette device. Sync rules
redéployées OK. 2 retours UX captés dans [IDEAS.md](IDEAS.md) → à cadrer en US : (1) création d'exo
perso en **modale** (card inline mal fichue) ; (2) **cohérence** fiche exo bibliothèque VS perso. Reste :
relecture Damien. — **MUSC-F10c-2 — CODE LIVRÉ (subagent-driven) ✅** : variantes /
alternatives d'exercice. Table `exercise_variants` symétrique (canonique `a<b`, `owner_id` null=éditorial /
non-null=perso) + RLS + `alter publication` (migration poussée) + **sync rules à REDÉPLOYER dans le dashboard
PowerSync** (⚠️ geste humain Florian/Damien avant recette device). `canonicalPair` + schéma (shared, testés) ;
repo mobile `useExerciseVariants`/`add`/`remove` (upsert par clé naturelle anti-bug unicité, `dedupeVariants`
pure testée) ; **section « Variantes / alternatives » sur la fiche** (liens cliquables, ✕ perso, ajout depuis
n'importe quelle fiche via mode `pickVariant`) ; **admin** : liens éditoriaux (biblio↔biblio). 5 tâches ;
revue finale *rien de bloquant* ; typecheck/lint verts, 800 tests shared + 54 mobile. Roadmap 3.20 ⬜ → ✅.
**Reste : redéploiement sync rules + recette (admin + mobile) + relecture Damien.** Branche
`feature/muscf10c2-variantes-alternatives`.
Spec : [muscf10c2-variantes-alternatives.md](docs/specs/functional/us/muscf10c2-variantes-alternatives.md). —
**MUSC-F10c-1 — CODE LIVRÉ (subagent-driven) ✅** : muscles secondaires sur
la fiche exercice. Colonne `exercises.muscles_secondary` (jsonb `[]`, migration additive poussée sur le cloud) +
`column.text` PowerSync ; fonction pure partagée `normalizeSecondaryMuscles` (dédup, exclut le primaire, filtre
les invalides) testée Vitest ; **saisie admin** (multi-cases hors primaire, retrait auto au changement de
primaire) ; **affichage fiche mobile** (mode lecture, ligne « Muscles secondaires » si non vide, libellés
`muscle.*`). Filtre MUSC-F3 inchangé (primaire seul). 4 tâches + finitions (2 smoke tests fiche) ; revue finale
*rien de bloquant* ; typecheck/lint verts, 796 tests shared + smoke mobile. Roadmap 3.19 🟡 → ✅.
**Reste : recette (admin saisie + fiche affichage) + relecture Damien. F10c-2 (variantes/alternatives) reste à
cadrer.** Branche `feature/muscf10c1-muscles-secondaires`.
Spec : [muscf10c1-muscles-secondaires.md](docs/specs/functional/us/muscf10c1-muscles-secondaires.md). —
**MUSC-F10b — CODE LIVRÉ (subagent-driven) ✅** : section « Tes records » en
tuiles sur la fiche exercice (1RM réel/estimé + charge max + meilleur volume + dates) + lien « Voir la
progression » (pré-sélection de l'exo dans `/progress`). 6 tâches TDD, chacune revue spec + revue qualité ;
2 correctifs (date non nulle + type partagé ; /progress dérivé sans effet) ; revue finale *prête à merger*.
`pickOneRepMax` pur (shared) + `useExerciseTopSingle`/`useExerciseFicheRecords`. Aucune migration, lecture seule ;
typecheck/lint verts, 789 tests shared + 50 tests mobile. **Reste : recette device + relecture Damien** (à
signaler en recette : le 1RM réel prime sur l'estimé → peut différer de /progress). Roadmap inchangée. —
**MUSC-F10b — PLAN VALIDÉ (revue subagent Approved) → implémentation lancée
(subagent-driven)** : plan en 6 tâches TDD ([plan](docs/plans/muscf10b-records-fiche-exercice.md)) — pickOneRepMax
(shared) → hooks records (1RM réel + composite) → i18n → /progress param exerciseId → section tuiles + lien sur la
fiche → clôture. Aucune migration, lecture seule. — **MUSC-F10b — SPEC VALIDÉE (Florian) ✅** : section « Tes records » en tuiles
sur la fiche exercice (1RM réel/estimé + charge max + meilleur volume + dates) + lien « Voir la progression »
(pré-sélection de l'exo dans `/progress`). Réutilise `useExerciseRecords` ; 1RM réel dérivé de `workout_sets`
(reps=1) ; `pickOneRepMax` pur ; aucune migration, lecture seule. Spec vérifiée manuellement (revue subagent
coupée par la limite d'usage hebdo). Branche `feature/muscf10b-records-fiche-exercice`.
Spec : [muscf10b-records-fiche-exercice.md](docs/specs/functional/us/muscf10b-records-fiche-exercice.md).
**Prochaine étape : plan d'implémentation.** — **MUSC-F10a — CODE LIVRÉ (subagent-driven) ✅** : bibliothèque d'exercices en
accès direct depuis le hub Muscu + **écran fiche exercice** (`/exercises/[id]`) + gestion des exos perso
(modifier/supprimer). 8 tâches TDD, chacune revue spec + revue qualité ; 3 correctifs intégrés (jest env central,
throw si traduction absente, gestion d'erreur/anti-double-submit + a11y étoile) ; revue finale transverse *prête à
merger* (invariant critique soft-delete `exercises` seule vérifié bout en bout). Aucune migration ; typecheck/lint
verts, 786 tests shared + 50 tests mobile. **Reste : recette device + relecture Damien.** Roadmap inchangée (fiche
complète muscles secondaires/variantes = F10c). — **MUSC-F10a — PLAN VALIDÉ (revue subagent Approved) → implémentation lancée
(subagent-driven)** : plan en 8 tâches TDD ([plan](docs/plans/muscf10a-bibliotheque-fiche-exercice.md)) — hook
lecture → écritures+garde → i18n → écran fiche+route → gestion perso → mode parcours → entrée hub → clôture.
Aucune migration. — **MUSC-F10a — SPEC VALIDÉE (Florian) ✅** : chantier « fiche exercice »
découpé en 3 incréments — **F10a** (socle : entrée « Bibliothèque d'exercices » persistante dans le hub Muscu →
biblio en mode parcours → fiche `/exercises/[id]` avec données actuelles + gestion des exos perso Modifier/
Supprimer) → **F10b** (records sur la fiche) → **F10c = MUSC-F2** (muscles secondaires + variantes, migration +
admin). Spec F10a écrite + revue subagent (1 point bloquant corrigé : soft-delete de la ligne `exercises` seule,
pas les traductions) + **validée Florian**. Aucune migration. Branche `feature/muscf10a-bibliotheque-fiche-exercice`.
Spec : [muscf10a-bibliotheque-fiche-exercice.md](docs/specs/functional/us/muscf10a-bibliotheque-fiche-exercice.md).
**Prochaine étape : plan d'implémentation.** — **MUSC-F3 — RECETTE VALIDÉE À 100 % (Florian, 22/07/2026) ✅ → reste
relecture Damien** ; roadmap 3.14 note « recette device validée ». **Nouvelle US notée : MUSC-F10 —
Bibliothèque d'exercices en accès direct depuis le hub Muscu** (l'écran `exercises.tsx` n'est aujourd'hui
atteignable que via « Ajouter un exercice » en séance) — à cadrer (question ouverte : comportement du tap sur un
exercice hors séance active). — **MUSC-F3 — CODE LIVRÉ (subagent-driven) ✅ → roadmap 3.14 🟡 → ✅** : filtre
d'exercices par **groupe musculaire + matériel** (tiroir « Filtres ») dans `ExercisePicker` **et** l'écran
bibliothèque `exercises.tsx`, en plus de la recherche par nom. Exécution subagent-driven du plan (10 tâches,
chacune revue spec + revue qualité ; 2 correctifs intégrés en cours : a11y des chips, raccourci Réinitialiser dans
l'état vide filtré ; revue finale transverse *prête à merger*). `buildExerciseFilterClause` pur (5 tests) +
`useExercises` étendu + `ExerciseFilterDrawer` partagé + enum `EQUIPMENTS` enfin branché (admin `<select>` + i18n
mobile FR/EN + contrainte DB). **🔴 Migration `20260722080703_muscf3_equipment_check` poussée sur le cloud**
(`db:push`, registre coché ; pas de `db:types` — contrainte seule). Seed dev enrichi (16 exercices). typecheck/lint
verts, **786 tests**. **Reste : recette device + relecture Damien.** Dette notée (non bloquant) : duplication
résiduelle entre les 2 écrans (→ `ExerciseListRow`/`FiltersButton` partagés avec MUSC-F2) ; `ExerciseListItem.equipment`
encore `string|null` côté mobile. — **MUSC-F3 — PLAN VALIDÉ (revue subagent Approved)** : plan en 10 tâches TDD
écrit ([plan](docs/plans/muscf3-recherche-multicriteres.md)) — shared → admin → i18n → repository → drawer →
intégrations (ExercisePicker + exercises.tsx) → seed dev → migration (checkpoint cloud) → clôture.
**Prochaine étape : implémentation** (spec + plan couvrent les 3 livrables requis avant code avec la maquette
visuelle déjà comparée en brainstorming). — **MUSC-F3 — SPEC ÉCRITE** (recherche d'exercices multi-critères, groupe
musculaire + matériel), `feature/muscf3-recherche-multicriteres` : cadrée par brainstorming (Florian, maquettes
visuelles) une fois le chantier refonte Muscu clos côté implémentation ; choisie parmi les candidats P1 du
backlog §🗺️ (recherche multi-critères > fiche exercice > seed programmes). UI = bouton « Filtres » + tiroir
(2 sections, groupe musculaire + matériel) sur `ExercisePicker` **et** `exercises.tsx` ; réutilise
`EQUIPMENTS`/`Equipment` déjà présents dans `packages/shared` (posés dès US1, jamais branchés) ; migration prévue
= contrainte `CHECK` sur `exercises.equipment` (colonne déjà nullable, aucune donnée à migrer). Spec :
[muscf3-recherche-multicriteres.md](docs/specs/functional/us/muscf3-recherche-multicriteres.md).
**Prochaine étape : plan d'implémentation.** — **Couleurs des menus — CODE LIVRÉ ✅, réintroduites avec un toggle
on/off** (`feature/couleurs-menu-toggle`) — reste recette device. — **US-D — RECETTE VALIDÉE (Florian) ✅ → chantier refonte Muscu
(A/B/C1/C2/C3/D) complet côté implémentation** — reste relecture Damien sur l'ensemble. — **US-D —
correctif post-recette** : le seul accès à « Mes templates »
passait par « Séance libre » → « Depuis un template », qui lançait direct au tap sans possibilité
d'éditer/dupliquer/supprimer (mode normal non atteignable). Corrigé : tap sur un template ouvre toujours son
détail ; nouveau widget « Mes templates » sur le hub muscu (accès permanent indépendant), réécrit sur les
nouvelles primitives `WidgetFrame`/`Eyebrow`/`Metric` (voir merge avec `feature/widgets-v2-dnd` ci-dessous).
typecheck/lint/781+44 tests verts. — **US-D — CODE LIVRÉ (subagent-driven) ✅** : templates de séance libre
(dernière US du chantier refonte Muscu) — 12 tâches, 12 commits. Tables `workout_templates`/
`workout_template_exercises` (migration + sync rules PowerSync appliquées, 2 checkpoints cloud). Composer à
froid + enregistrer après coup depuis une séance terminée (dérivation testée Vitest), démarrer depuis un
template, gérer (éditer/dupliquer/supprimer). Refactor `ExerciseTargetsFields` partagé + nouveau sélecteur de
type de série. Choix à blanc/template sur le hub. typecheck/lint/781+44 tests verts, i18n FR/EN. **Chantier
refonte Muscu (A/B/C1/C2/C3/D) complet côté implémentation** — reste recette device + relecture Damien sur
l'ensemble. — **US-D — spec + plan + maquette validés (Florian) ✅** : 2 passages de revue sur la spec et sur
le plan (dont un oubli critique corrigé au stade plan : sync rules PowerSync, 2ᵉ checkpoint cloud distinct de
`db:push`). Branche `feature/refonte-muscu-d` créée depuis `dev`. Précédemment : **Widgets multi-formes —
DESIGN RICHE LIVRÉ** (`feature/widgets-v2-dnd`, demande Damien « dev la partie Widgets » d'après
`design/FitTrio - Widgets.dc.html`) : les **16 widgets × 3 formes** (accueil 9 + muscu 4 + course 3) passent
du rendu sobre au **langage visuel de la galerie** — primitives SVG (`RingGauge`/`Sparkline`/`MiniBars`/
`HBars`/`WeekDots`), cadre `WidgetFrame` (`card`/`warn`/`panel`) + `Eyebrow`/`Chip`/`Metric`, tokens thème
(`track`/`warn`/`panel`/`amber`) + `withAlpha`, hook `useRecentStrengthRecords`, 60 clés i18n FR+EN ; données
branchées au fil (macros, `useMuscleBalance`, tonnage+variation, semaine running par jour, sparkline poids),
dégradations gracieuses assumées (nom/tonnage séance, % semaine programme, splits/tracé course). typecheck
workspace+mobile / lint 0 err / **44 tests** verts, **aucune migration** (UI pure). **Reste : recette
device.** Précédemment : **US-C3 — RECETTE VALIDÉE (Florian) ✅ → chantier refonte Muscu COMPLET**
(A/B/C1/C2/C3 tous recettés ; reste relecture Damien sur l'ensemble). Superset v2 (lien explicite, dialogue de
choix libre, `workout_superset_pairs`) validé. Merge C3 → `dev`. — **US-C3 — recette : superset repensé (v2,
lien explicite)** : suite au retour Florian « pas intuitif + doit pouvoir choisir librement le partenaire », le
superset passe d'une liaison positionnelle (adjacence) à un **lien explicite** — nouvelle table
`workout_superset_pairs` (migration + sync rules appliquées), bouton « Lier en superset » → **dialogue de
choix** parmi tous les exercices de la séance, valable toute la séance. Nouveau composant `SupersetPickerModal`.
typecheck/lint/778 tests verts. — **US-C3 — CODE LIVRÉ (subagent-driven)** : ajustements en direct — réorganiser/
machine prise (↑/↓ + « Plus tard »), **superset**, remplacer un exercice (picker filtré), **note persistante par
exercice** (migration `exercise_notes` appliquée), **suggestion de progression** RPE-aware. Chantier refonte
Muscu (A/B/C1/C2/C3) complet côté implémentation ; reste relecture Damien sur l'ensemble. — **Widgets v2 — CODE
LIVRÉ** : glisser-déposer 2D en grille (appui long ~700 ms + fantôme + barre d'insertion + pastilles de coin),
3 formes remplissantes par module (9 widgets accueil + muscu/course), et **stats « semaine » → 7 jours
glissants** partout (y c. tendances 8 sem.). Tout vert, aucune migration. **Reste : recette device.** —
**Décision : GIF/vidéos de démo exercices abandonnés** (Florian/Damien) —
roadmap 6.1/3.18/6.3/8.3 passés ❌, MUSC-F1 clos en conséquence, C3 perd « accès démo en séance »,
[musculation.md §3.3](docs/specs/functional/musculation.md#33-démonstrations-visuelles-gifvidéo--abandonné)
mis à jour. — **US-C2 — CODE LIVRÉ (subagent-driven)** : saisie enrichie de l'écran de
séance — types de séries (dont dropset/échec, superset→C3), **RPE/série** 1-10 masqué derrière « ＋ RPE »,
**charge planifiée vs réalisée** (snapshot `planned_weight_kg`), résumé/historique hors échauffement. Migration
cloud appliquée (`20260719230416`). 6 commits, typecheck/lint/765 tests verts, parité i18n, revue finale sans
bloquant. **Reste : recette device Florian + relecture Damien.** Records excluent warmup **et** duration ;
bodyweight lesté = record légitime. Idée notée (IDEAS) : RIR en alternative au RPE. —
**Widgets multi-formes — CODE LIVRÉ** : moteur de widgets 3 formes
(petit carré / rectangle / grand carré) partagé par accueil + muscu + course, grille 2 colonnes, drag +
sélecteur de forme, layout multi-hubs sans migration SQL ; planning passé aux 7 prochains jours + visuel
calendrier. Spec/plan/design validés Damien, tout vert. **Reste : recette device.** — **Fix repas — CODE
LIVRÉ** : réordonnancement des repas (flèches ↑↓), section « Autres » pour les entrées orphelines, déplacer
une entrée vers un repas (`reassignEntryMeal`), fix libellé des repas custom. **Reste : recette device.** —
**US-C1 — RECETTE VALIDÉE (Florian, 19/07/2026) ✅** : écran de séance en flux guidé (carte série en cours +
steppers + dernière perf, valider=log+repos+avance, repos plein écran repliable + saisissable + vibration,
keep-awake, dialogue ✕, gestion des séries en direct, résumé éditable ressenti 5★ + note) livré et recetté après
2 vagues de correctifs. **C1 `[x]` — reste relecture Damien.** Suite : **spec C2** (types de séries dont
échauffement exclu, **RPE par série**, **charge planifiée vs réalisée** + migrations) puis **C3**.
Précédemment : **US-C1 — CODE LIVRÉ (subagent-driven)** : écran de séance refondu en flux
guidé (carte série en cours + steppers + dernière perf, valider=log+repos+avance, repos plein écran + vibration
+ éditable/exo, keep-awake, dialogue ✕ Continuer/Pause/Abandonner, gestion des séries en direct +Série/supprimer/
dé-valider, résumé éditable ressenti 5★ + note). 9 commits, aucune migration, revue globale sans bloquant, tout vert.
**Reste : recette device + relecture Damien.** Suite : **C2** (types de séries, RPE/série, planifié-réalisé) puis **C3**.
Précédemment : **US-C1 — plan validé** : plan d'implémentation C1 écrit (6 tâches, aucune
migration), **revue Approved + validé Florian** ([plan](docs/plans/refonte-muscu-c1-seance-live-coeur.md)).
Prochaine étape : **maquette** (carte focus / repos plein écran / dialogue ✕) puis validation finale avant code.
Précédemment : **US-C découpée en C1/C2/C3 — spec C1 validée** : US-C (refonte écran de
séance) scindée en **C1** (cœur flux guidé + garde-fous) → **C2** (saisie enrichie : types de séries, RPE/série,
charge planifiée-réalisée, migrations) → **C3** (ajustements live + suggestion progression). **Spec C1 écrite,
revue Approved, validée Florian** ([spec](docs/specs/functional/us/refonte-muscu-c1-seance-live-coeur.md),
`feature/refonte-muscu-c1`) ; aucune migration (réutilise `workouts.rpe`/`notes`). Prochaine étape : **plan C1**.
Précédemment : **US-A & US-B — RECETTE DEVICE VALIDÉE (Florian, 19/07/2026)** ✅ : les deux
US du chantier refonte Muscu passent en `[x]` (reste relecture Damien). Aucun changement roadmap (refonte d'existant).
Suite : **US-C** (refonte écran de séance — analyse de flux remontée à Florian, croisement des listes en cours avant
spec) puis **US-D**. Précédemment : **US Refonte-B — CODE LIVRÉ (subagent-driven)** : 5 tâches implémentées
(6 commits `10f267b`→`f5c7027`), revue de code globale **sans bloquant**, typecheck/lint/tests verts, parité i18n.
Hook partagé `useTodaySession` (occurrence réelle du jour, démarrage lié) → hub muscu carte 3 états (Reprendre /
Séance du jour / repli Séance libre + coche « faite » + mention « prochaine ») + widget dashboard 7.4 réaligné ;
`useNextSession` retiré. Aucune migration. **Reste : recette device (A+B ensemble) + relecture Damien.**
Précédemment : **US Refonte-B — spec validée** : spec « Séance du jour sur le hub muscu »
écrite ([spec](docs/specs/functional/us/refonte-muscu-b-seance-du-jour-hub.md), `feature/refonte-muscu-b`),
**validée par Florian** + **revue de spec Approved** (fix : requête tous statuts pour la coche « faite » ;
`programName` du programme de l'occurrence). Hook partagé `useTodaySession` (occurrence réelle du jour, démarrage
lié `plannedSessionId`), hub 3 états + mention prochaine + coche faite, réalignement du widget dashboard 7.4.
Aucune migration. Prochaine étape : **plan d'implémentation**. Précédemment : **US Refonte-A — CODE LIVRÉ (subagent-driven)** : 9 tâches implémentées
(7 commits `c0f6a07`→`c53d85a`), revue de code globale **sans bloquant**, typecheck/lint/tests verts, parité i18n
FR/EN. Migration `planned_session_id` **appliquée cloud** ; démarrer une séance depuis le calendrier (gaté muscu)
→ occurrence `done` à la fin ; fusion activer/planifier sur les 2 fiches ; popup de changement de programme.
**Reste : recette device + relecture Damien** (US-A `[~]`, passera `[x]` après recette). Point à confirmer en
recette : « reprise » via libellé de bouton (pas de dialogue). Running (démarrage course depuis le calendrier)
différé (option b). Précédemment : **US Refonte-A — maquette validée → GO implémentation** : maquette des
3 surfaces ([design](design/refonte-muscu-a/refonte-muscu-a.html)) **validée par Florian**. Les 3 livrables du
workflow sont réunis (spec ✅ + plan ✅ + design ✅) → passage à l'**implémentation subagent-driven** (9 tâches,
phases A→G). ⚠️ Task 1 = **migration cloud** `planned_session_id` (checkpoint 🔴 : `db:push` confirmé avant exécution).
Précédemment : **US Refonte-A — plan validé** : plan d'implémentation écrit
([plan](docs/plans/refonte-muscu-a-unification-programme-planning-seance.md), 9 tâches phases A→G),
**validé par Florian** et **revue de plan Approved** (1 itération : ajout de la 2ᵉ fiche
`running-programs/[id].tsx` à la fusion). Reste, avant tout code : **maquette** (design/refonte-muscu-a/)
puis **validation finale** (spec ✅ + plan ✅ + design). Mode d'exécution pressenti : subagent-driven.
Précédemment : **US Refonte-A — spec validée** : spec fonctionnelle « Unifier programme →
planning → séance » écrite ([refonte-muscu-a-…](docs/specs/functional/us/refonte-muscu-a-unification-programme-planning-seance.md),
`feature/refonte-muscu-a`), **validée par Florian** et **revue de spec Approved** (1 itération : gating « Démarrer »
muscu-spécifique). Fusion activer/planifier + démarrer depuis le calendrier + lien de complétion explicite
(migration `planned_session_id` à venir) + popup de changement de programme ; pilier-agnostique muscu+running.
Prochaine étape : **plan d'implémentation** (writing-plans). Précédemment : **Chantier refonte Muscu ouvert** : audit des flux du pilier Musculation
figé dans [docs/refonte-muscu/audit-flux.md](docs/refonte-muscu/audit-flux.md) (5 problèmes de logique de flux,
validés par Florian, avec preuves fichier:ligne et gravité [S]/[P]) → section **« 🔧 Chantier refonte Muscu »**
ajoutée au TODO : 4 US **A** (unifier programme→planning→séance, socle) → **B** (séance du jour sur le hub) →
**C** (refonte de l'écran de séance, absorbe MUSC-F4/F5/F6) → **D** (templates de séance libre). Hors roadmap
versionnée (refonte d'existant ≠ features) ; US-C fera évoluer le Statut des items concernés à sa livraison.
Prochaine étape : **spec US-A**. Précédemment : **Bilan MVP1 + suivi roadmap outillé** : réconciliation code ↔ roadmap
(3 explorations) → **colonne Statut de la [roadmap](docs/roadmap/roadmap.md) renseignée** (✅ Livré / 🟡 Partiel /
⬜ À faire / ⏳ Reporté) + Récapitulatif recalculé (**127 livré / 12 partiel / 39 à faire** sur 179 ; MVP1 = V1.0
complète ; V0.6 100 % livrée ; V0.8 conformité = principal reste-à-faire). **CLAUDE.md + skill `/commit`** :
nouvelle étape **obligatoire** de mise à jour du Statut roadmap à chaque livraison. **Backlog « Reste-à-faire MVP1 »**
ajouté au TODO (§🗺️) : 20 US candidates priorisées P0/P1/P2 (CONF-01→07, LANCE-01, MUSC-F1→9, RUN-F1→3,
CONTENU-01, NUTR-F1, SOCLE-01) à cadrer spec→plan→design→validation avant code. Précédemment : **US META-09 — Lissage des courbes par moyenne mobile — CODE LIVRÉ** (subagent-driven, `feature/meta09-lissage-courbes`) : brique pure `movingAverage` (centrée, fenêtre en points, bords rétrécis) dans `@wellness/shared` + prop `smooth` sur `ProgressLineChart` (overlay brut estompé + lissé accentué, fenêtre auto ≥ 4 points, rétrocompatible), activée sur **4 courbes** (poids, kcal, allure, muscu) ; fenêtre en points (pas en jours), taille fixe auto, aucun contrôle ajouté ; maquette légère validée Florian ; 100 % client, aucune migration/i18n ; typecheck/lint/tests(790) verts ; catalogue META-09 → ✅ + piste 8 barrée ; spec 1 passe + plan 1 passe + revues par tâche + revue finale *prête à merger* ; **mergé sur `dev` (`948beff`) ; recette device validée (Florian, 18/07/2026) ✅ — reste relecture Damien**. Précédemment : **US META-08 — Tendance générique par régression linéaire — CODE LIVRÉ** (subagent-driven, `feature/meta08-tendance-regression-lineaire`, commits `709ddc9`→`32b11bb`) : brique socle `linearRegression` (moindres carrés → pente/intercept/R²/n, `null` sur cas dégénéré) + `daysBetween` (DST-safe) dans `@wellness/shared` ; `weightTrend` (signature datée) et `paceTrend` (diviseur moyenne série) rebranchés dessus, **iso-comportement** prouvé par goldens de non-régression (oracle = ancienne logique), divergences non-monotones figées honnêtement ; R² calculé non exposé (réserve projections META-14/15/16) ; appelants `weightTrend` mis à jour (nutrition-stats, WeightCard, recipe.test). 100 % client, aucune UI/i18n/migration ; typecheck/lint/tests(739) verts ; catalogue META-08 → ✅ + piste 7 barrée ; spec 1 passe + plan 2 passes + revue par tâche + revue finale *prête à merger* ; **mergé sur `dev` (`fc9aead`) ; recette device validée (Florian, 18/07/2026) ✅ — reste relecture Damien**. Précédemment : **Modules en cartes-aperçu (Muscu & Course) + mini-calendrier planning — CODE LIVRÉ** (`feature/modules-cartes-apercu`, demande Damien) : les cartes-module « titre + bouton » deviennent des cartes d'aperçu du contenu, entièrement tappables (bouton retiré) ; composant `ModulePreviewCard` + `PlanningPreview` (mini-calendrier 4 prochains jours, pastilles par pilier, hook `useUpcomingSessions`) ; Muscu (programme actif, planning, 2 dernières séances, volume+delta) et Course (programme running, planning, dernière course) ; i18n FR/EN ; 100 % client sans migration ; typecheck/lint verts ; reste recette device + relecture Damien. Précédemment : **Fixes UI recette device (Damien)** — `fix/note-course-clavier-invisible` (note facultative après une course masquée par le clavier Android : `FormScreen` `behavior={undefined}` → `'height'`, corrige aussi les 8 formulaires longs) + `fix/food-picker-footer-deborde` (footer « Ajouter un aliment » à 4 boutons qui débordait à droite → `flexWrap:'wrap'`) ; 100 % JS ; reste recette device + relecture Damien. Précédemment : **Recettes validées Florian (17/07/2026) — TOUT LE BACKLOG DE RECETTE EST VIDÉ** ✅ : **NUTR-17** (régularité du journal), **NUTR-10** (adhérence à l'objectif), **MR-06** (widget temps d'entraînement) et le **fix édition/suppression d'une entrée de repas** passés en `[x]` ; les 4 blocs 🧪 en tête passent en ✅ (plans conservés pour trace) ; il ne reste que la **relecture Damien** sur ces livraisons. **Plus aucune recette en attente.** Précédemment : **US 8.8 — Gestion des utilisateurs (8.8a consultation + 8.8b bannissement) → CLOSE** ✅ et **US NUTR-11 — Progression vers l'objectif de poids → VALIDÉE** ✅ (toutes deux `[x]`, reste relecture Damien) ; le bloc 🧪 8.8 en tête passe en ✅. Le seul écart de la recette 8.8 (colonne « Piliers » = « — ») a été corrigé et revérifié OK. Précédemment : **Fix back-office `/users` : colonne « Piliers » = « — » pour tous les comptes — CORRIGÉ & mergé sur `dev`** (`fix/admin-piliers-affichage`, remontée Florian pendant la recette 8.8a) : `active_pillars` sérialisé `JSON.stringify` par le mobile arrive en **chaîne JSON** dans le `jsonb` cloud → l'admin faisait `Array.isArray` → « — » systématique ; fix = helper `parseActivePillars` (tolérant chaîne JSON + tableau natif) dans `data/users.ts`, utilisé par les 2 écrans ; 100 % JS, aucune migration, aucune reprise de données ; typecheck/lint/tests(711) verts. Précédemment : **US NUTR-11 — Progression vers l'objectif de poids — SPEC + PLAN VALIDÉS Florian** (pipeline spec → plan, branche `feature/nutr11-progression-poids`) : carte Stats nutrition (section Poids) = % (+ kg) du chemin entre poids de départ **figé** et poids **cible** ; départ figé à la définition de la cible (option A), formule bornée [0,1] (perte/prise), actuel = dernière pesée, dépassement → 100 % + badge, recul → 0 %, pas de carte si aucune cible ou départ = cible ; 1 migration (`profiles.target_weight_kg` + `start_weight_kg`) + `computeWeightGoalProgress` (pur) + `setWeightTarget` (fige départ) + hook `useWeightGoalProgress` + `WeightGoalCard` + i18n ; reste implémentation subagent-driven → recette → Damien. Commit spec+plan **manuel sur la branche** (`/commit` indisponible, classifieur down). Précédemment : **US NUTR-17 — Régularité du journal — CODE LIVRÉ & mergé sur `dev`** (subagent-driven, revue finale ready-to-merge) : carte Stats nutrition (pct + N/M jours renseignés, 7 j/30 j), dénominateur borné à l'ancienneté, aujourd'hui exclu ; pur `computeJournalCompletion` (dates UTC exact) + hook `useJournalCompletion` ; i18n FR/EN ; 100 % client, aucune migration ; catalogue NUTR-17 → ✅ ; reste recette + relecture Damien. Précédemment : **US NUTR-10 — Adhérence à l'objectif calorique — CODE LIVRÉ & mergé sur `dev`** (subagent-driven, revue finale ready-to-merge) : carte Stats nutrition (pct + N/M jours dans la cible, 7 j/30 j) vs objectif **effectif** du jour ±**marge %** configurable (5/10/15, défaut 10, colonne `adherence_margin_pct` synchronisée + migration cloud + schéma PowerSync) ; purs `computeGoalAdherence`/`computeEffectiveTargetForDay` + hook `useGoalAdherence` ; i18n FR/EN ; catalogue NUTR-10 → ✅ ; reste recette + relecture Damien. Précédemment : **US MR-06 — Widget « Temps d'entraînement » (dashboard, inter-piliers) — CODE LIVRÉ & mergé sur `dev`** (subagent-driven, revue finale ready-to-merge) : widget `training-time` = temps total muscu+course de la semaine ISO + ventilation, gating `['strength','running']` ; pur `computeTrainingTime`/`formatHoursMinutes` + hook `useTrainingTime` + `TrainingTimeCard` + i18n ; 100 % client offline sans migration ; catalogue MR-06 → ✅ ; reste recette + relecture Damien. Précédemment : **US 8.8b — Bannissement des utilisateurs — CODE LIVRÉ & mergé sur `dev`** (subagent-driven, revue finale ready-to-merge, 7/7 sécurité) → **US 8.8 COMPLÈTE** (8.8a consultation + 8.8b bannissement) : table `user_bans` append-only + RPC `ban_user`/`unban_user` (SECURITY DEFINER, garde-fous anti-self/anti-admin/motif, `banned_until='9999-12-31'`) + `is_admin` sur la vue + section Modération sur la fiche + audit `user.ban`/`user.unban` ; clé anon, aucun service_role, coupure au refresh ~1h ; migration cloud appliquée + `db:types` ; **reste recette (bloc 🧪) + relecture Damien**. Rattrapage : specs+plans 8.8a (jamais commités) ajoutés. Précédemment : **US 8.8a — Consultation des utilisateurs (back-office) — CODE LIVRÉ & mergé sur `dev`** (subagent-driven, spec+plan validés Florian, revue finale ready-to-merge) : vue SQL `admin_users` (gate `can_manage_users` super_admin/moderator, colonnes sobres RGPD, migration cloud appliquée + `db:types`) + capacité `canManageUsers` + écrans liste/fiche lecture seule + i18n `fr.users` ; lecture seule, clé anon, aucun service_role ; **reste recette + relecture Damien**. **US 8.8b (bannissement)** à cadrer avec Damien (RPC SECURITY DEFINER `banned_until` + `user_bans`). Précédemment : **Fix « édition/suppression d'une entrée de repas » — CODE LIVRÉ & mergé sur `dev`** (subagent-driven, 4 commits, revue finale *ready-to-merge*) : swipe gauche → Modifier + Supprimer (tap conservé, appui long retiré) + édition élargie aux quick add (kcal/P/G/L/nom), `updateEntry` assoupli ; 100 % client, aucune migration ; typecheck/lint/tests(684) verts ; **reste recette device (1ᵉʳ `ReanimatedSwipeable`) + relecture Damien**. Spec + plan validés Florian. **US 8.7 (modération aliments signalés) REPORTÉE** (décision Florian) : modèle privé par utilisateur (RLS `owner_id`) + aucun mécanisme de signalement → file de modération sans objet ; 8.8 reste disponible. Précédemment : **2 idées consignées dans IDEAS.md** (hors pipeline) : import de données multi-apps (Garmin/Strava — GPX + FC) et générateur IA de plan de repas hebdo + liste de courses. Précédemment : **CI rouge (run #194) corrigée** : erreur de typage `fontsReady` dans `_layout.tsx` (`true | Error | null` au lieu de `boolean`) introduite par le câblage de `resolveRootRoute` → `loaded || error != null`. Précédemment : **MN-03 & MN-06 — recette device validée (Florian, 16/07/2026)** ✅ (passées en `[x]`) ; bug consigné (§🐞) : **onboarding redemandé à chaque connexion** alors qu'il est déjà terminé (remontée Florian ; distinct du crash `fix/onboarding-rejeu-profil` déjà corrigé) — hypothèse de **race offline-first** (gate de routing sur `profileLoading` local, pas sur `hasSynced` synchro réseau) ; à reproduire device + spec courte avant fix. Précédemment : US **MN-06** (protéines/kg vs cible par objectif) **livrée & mergée sur `dev`** (subagent-driven) → catalogue MN-06 ✅ ; **ADR-007 — surfaçage des analyses** (catalogue = backlog ; 4 tiers ; conditionnel par défaut ; briques réutilisables ; critère d'entrée) → grille anti-saturation appliquée à chaque future analyse ; bug consigné (§🐞) : **aucun sélecteur de langue** dans les Réglages (langue figée après création du compte — à cadrer en US). Précédemment : Catalogue d'analyses `analyses-donnees.md` mis à jour : mention « recette device OK » sur les 6 analyses livrées+recettées (MUSC-04/05, 4.32, RN-01/02, META-06) + section « Pistes de priorisation » nettoyée (items livrés barrés). Précédemment : **Recettes device — TOUTES VALIDÉES (Florian, 16/07/2026)** : les 6 US en attente (MUSC-04, MUSC-05, META-06, 4.32, RN-01/02 via APK release + dataset de recette ; 8.10 côté back-office web) recettées et validées → bandeau ⛔ passé en ✅, US cochées `[x]` dans « En cours » ; **8.7 (modération) → 8.8 (utilisateurs) débloquées**. Précédemment : Affichage corrigé (§🐞, recette device validée Florian sur APK release) : graphiques qui débordaient de leur carte (largeur mesurée via `onLayout` + axe Y réparti — `ProgressLineChart`/`MuscleVolumeBarChart`) et filtre course « Semaine/Mois/Depuis le début » passé en `Segment scrollable` ; 100 % JS, reload Metro. Précédemment : Recette — dataset corrigé : la courbe « charge max » lit `personal_records` (1 point = 1 record battu) → le dataset sème désormais l'**historique des paliers** (max_weight/1RM/volume, une ligne par record battu, datée de la séance) au lieu d'un point unique ; contrôle « paliers charge max DC » ajouté à `recette-verification.sql` ; idée **infobulle au tap sur les graphiques** captée (IDEAS). Précédemment : Bug consigné (§🐞) : édition/suppression d'un aliment de repas — geste peu découvrable + édition limitée à la quantité (remontée Florian) ; à reproduire device + spec courte avant fix. Précédemment : Outillage de recette **sur device sans EAS** : scripts SQL `recette-dataset.sql` (dataset ~3 mois, une transaction, hard delete ciblé `v_email`) + `recette-verification.sql` (grille de contrôles) couvrant MUSC-04/05, META-06, 4.32, RN-01/02 ; doc `dev-build-android-local.md` enrichie du **mode B — APK autonome release** (`gradlew.bat assembleRelease`, hors quota EAS, install sans fil). Aucun code applicatif ni schéma touché). Précédemment : 15/07/2026 (US MUSC-05 équilibre musculaire par groupe (14 j) — **code livré & mergé sur `dev`** (subagent-driven, revue finale prête à merger) ; section `/progress` barres par séries colorées + alerte groupes délaissés, `computeMuscleBalance` + `useMuscleBalance`, 100 % offline sans migration ; ratio push/pull → MUSC-11 ; catalogue MUSC-05 → ✅ ; reste recette device. Précédemment : US META-06 comparaison période N vs N-1 — **code livré & mergé sur `dev`** (subagent-driven, revue finale prête à merger) ; brique transverse `percentChange`/`previousPeriodTodayKey` + `DeltaBadge` mutualisé, deltas sur 3 surfaces (running/nutrition/muscu), 100 % offline sans migration ; catalogue META-06 → ✅ ; reste recette device. Précédemment : US MUSC-04 courbe 1RM estimé + période « tout » — **code livré & mergé sur `dev`** (subagent-driven, revue finale prête à merger) ; clôture du delta vs spec 6.2 (écran `/progress` existait déjà à ~80 %) ; helper `sessionBestEstimated1RM`, métrique 1RM par séance + période tout, 100 % offline sans migration ; catalogue MUSC-04 → ✅ ; reste recette device. Précédemment : US RN-01/RN-02 dépense course → objectif du jour — **code livré** (subagent-driven, revues par tâche + revue finale *prête à merger*, aucun bloquant) ; 2ᵉ croisement inter-piliers running↔nutrition Phase A ; réglage Forfait/Auto, hook centralisé `useDayCalorieTarget`, badge « · course ». **🔴 Recette en attente — Florian** : migration `training_bonus_mode` (`db:push`+`db:types`) IMPÉRATIVE avant mode Auto sur device synchronisé (sinon file PowerSync bloquée), puis recette (voir bandeau ⛔). Précédemment : US 4.32 alerte croisée déficit+volume — **code livré & mergé sur `dev`** (subagent-driven, revue finale ready to merge) ; 1ʳᵉ stat croisée inter-piliers Phase A ; v1 faible migrée depuis l'écran Stats vers un widget dashboard ; reste recette device. Précédemment : US 8.10 log d'audit admin — **code mergé sur `dev`** (subagent-driven, revue finale ready to merge), migration appliquée cloud + db:types. **🔴 Recette en attente — Florian, soir du 15/07** (voir bandeau ⛔ en tête). Point 4 accepté. 1ʳᵉ des 3 US de gouvernance admin restantes (8.10 → 8.7 → 8.8). Précédemment : recette device CIQUAL validée sur Pixel 6a + outillage : scripts `db:new`/`db:push`/`db:push:dry`, bloc `env` preview dans `eas.json`, doc migrations cloud dans CLAUDE.md ; nettoyage des artefacts de prebuild lancé à la racine par erreur. US « enrichir la bibliothèque CIQUAL » — **code livré** : 80 aliments 100 % CIQUAL 2025 (50 + 30), livrés par **migration idempotente** (biblio sortie de seed.sql), tooling reproductible ; reste `db:push` cloud + device (Florian). Précédemment : US « panel nutritionnel étendu » **code livré & revu (Approved)**, 10 → 31 micronutriments, sans migration ; reste recette device. Fix scan code-barres : messages d'échec honnêtes + affichage P/G/L + sucres/AGS/fibres captés d'OFF — voir §Bugs connus (recette device restante). Fix UI food-picker : onglets `scrollable` étirés en hauteur corrigés — recette device validée par Florian ✅. Précédemment : build à deux RÉSOLU + convention timestamps migration OK ; toutes les migrations cloud running R3a/R3b-i/R3b-ii/R3c-i/R4b + admin 8.4 appliquées (db:types + sync rules) ; validation terrain running R1 recettée par Florian ; MapLibre acté. Il reste la campagne de vérif device — voir sections 🟠 et running. Bannière URGENT retirée ; fix fuite inter-piliers muscu ; import CSV 8.6.)*

---

## 🗺️ Reste-à-faire MVP1 (= V1.0 complète) — backlog issu de la réconciliation roadmap (18/07/2026)

> **51 items roadmap** non terminés dans le périmètre de lancement (39 ⬜ à faire + 12 🟡 partiels),
> regroupés ci-dessous en **US candidates**. Ce sont des **entrées de backlog** : chacune doit passer
> le workflow **spec → plan → design → validation (Florian/Damien) → code** avant toute ligne de code.
> Les # entre parenthèses renvoient à la [roadmap](docs/roadmap/roadmap.md). Priorité : **P0** =
> bloquant pour lancer / ouvrir la bêta ; **P1** = finitions produit visibles ; **P2** = confort / optionnel.

### 🔴 P0 — Conformité & lancement (V0.8 → V1.0) — *bloquant MVP1, quasi rien n'existe*

- [ ] **CONF-01 — Export des données (RGPD)** (1.18) — écran Réglages → export JSON/CSV de toutes les
  données perso de l'utilisateur. Obligation RGPD.
- [ ] **CONF-02 — Suppression du compte** (1.19) — double confirmation + délai de grâce 30 j + purge
  (RPC serveur). **Exigé par les stores.**
- [ ] **CONF-03 — Aide & support** (1.22) — écran FAQ + formulaire de contact / signalement de bug.
  🌐 bilingue FR+EN.
- [ ] **CONF-04 — Connexion via Google (OAuth)** (1.2) — provider Google (Supabase Auth) sur `sign-in`.
  🔴 **clé OAuth Google à fournir** (décision/ressource humaine).
- [ ] **CONF-05 — Analytics produit first-party** (9.10) — instrumentation d'événements anonymisés
  (instance auto-hébergée). 🔴 **décision outil** (PostHog auto-hébergé ?). Nécessaire avant d'ouvrir
  la bêta (sinon aucune mesure des testeurs).
- [ ] **CONF-06 — Health Connect** (9.9) — écriture des séances + lecture du poids (Android).
- [ ] **CONF-07 — Accessibilité** (9.11 + 9.12) — Dynamic Type explicite (`maxFontSizeMultiplier`/
  `fontScale`) + audit contraste WCAG AA (revue visuelle humaine).
- [ ] **LANCE-01 — Publication Play Store** (9.2) — build AAB prod (EAS) + fiche Play + soumission review.
  🔴 **compte Google Play + review**. Dépend de tout le P0 ci-dessus.

### 🟠 P1 — Finitions muscu (V0.2 / V0.3)

- [x] ~~**MUSC-F1 — Démonstration visuelle des exercices (GIF)** (6.1 + 3.18 + 8.3)~~ — **❌ Abandonné**
  (décision Florian/Damien, 20/07/2026) : jugé trop complexe pour la valeur apportée. `media_url` reste stocké
  (colonne inoffensive) mais ne sera jamais rendu. Voir [roadmap](docs/roadmap/roadmap.md) et
  [musculation.md §3.3](docs/specs/functional/musculation.md#33-démonstrations-visuelles-gifvidéo--abandonné).
- [ ] **MUSC-F1b — Muscles ciblés sur schéma SVG** (6.2) — sujet **distinct** (pas de média animé), reste ouvert.
- [ ] **MUSC-F2 — Fiche exercice complète** (3.13 + 3.19 + 3.20) — remplacer le picker simple par une
  fiche détaillée (muscle principal **+ secondaires**, variantes/alternatives). ⚠️ 3.19/3.20 = **colonnes
  à ajouter** (migration).
- [x] **MUSC-F3 — Recherche exercices multi-critères** (3.14) — ✅ **RECETTÉ & VALIDÉ (Florian, 22/07/2026)** :
  filtre par **groupe musculaire** et **matériel** (tiroir « Filtres » dans ExercisePicker + exercises.tsx).
  Migration cloud appliquée. **Reste : relecture Damien.**

- **MUSC-F10 — Fiche exercice & bibliothèque en accès direct** *(demande Florian 22/07/2026)* — découpé en
  **3 incréments** (spec → plan → design → validation → code chacun) :
  - [x] **MUSC-F10a — Socle : accès direct + fiche — ✅ CODE LIVRÉ (subagent-driven, 22/07/2026)** — entrée
    persistante « Bibliothèque d'exercices » dans le hub Muscu → biblio en mode parcours → fiche `/exercises/[id]`
    (nom, groupe, matériel, instructions, favori, badge perso) + gestion des exos perso (Modifier/Supprimer,
    soft-delete de la ligne `exercises` seule). Aucune migration. Spec + plan validés, revue finale *prête à
    merger*. **Reste : recette device + relecture Damien.**
    [plan](docs/plans/muscf10a-bibliotheque-fiche-exercice.md) · [spec](docs/specs/functional/us/muscf10a-bibliotheque-fiche-exercice.md).
  - [x] **MUSC-F10b — Records sur la fiche — ✅ CODE LIVRÉ (subagent-driven, 22/07/2026)** — section « Tes
    records » en tuiles (1RM réel/estimé + charge max + meilleur volume + dates) + lien « Voir la progression »
    (pré-sélection de l'exo dans `/progress`). `pickOneRepMax` pur + `useExerciseTopSingle`/`useExerciseFicheRecords` ;
    lecture seule, aucune migration. Spec + plan validés, revue finale *prête à merger*. **Reste : recette device +
    relecture Damien** (signaler : 1RM réel prime sur estimé → peut différer de /progress).
    [plan](docs/plans/muscf10b-records-fiche-exercice.md) · [spec](docs/specs/functional/us/muscf10b-records-fiche-exercice.md).
  - [ ] **MUSC-F10c (= MUSC-F2) — Fiche enrichie** — muscles principal **+ secondaires** + variantes/alternatives
    (3.13/3.19/3.20). ⚠️ migration (colonnes) + saisie admin. Remplace/absorbe MUSC-F2 ci-dessus.
- [ ] **MUSC-F4 — Séance : feedback & confort** (3.26 dernière perf affichée + 3.29 vibration fin de repos
  + 2.3 écran actif en muscu). ~~6.3 accès démo pendant la séance~~ — ❌ abandonné avec MUSC-F1.
- [ ] **MUSC-F5 — Séance : saisie enrichie** (3.33 note de séance + 3.34 RPE + 3.27 UI types de séries +
  3.28 chrono de repos configurable par exercice + 3.32 remplacer un exercice en direct + 3.17 note
  persistante par exercice). ⚠️ Plusieurs modèles déjà prêts (`notes`, `rpe`, `set_type`) → surtout de l'UI.
- [ ] **MUSC-F6 — Séance : cycle de vie** (3.36 pause/reprise sous 4 h + 3.37 clôture automatique après 3 h).
- [ ] **MUSC-F7 — Progression assistée** (3.7 progression automatique de charge + 3.8 deload/gestion de
  stagnation). Suggéré, jamais imposé.
- [ ] **MUSC-F8 — Notifications push muscu** (3.42 + 2.7 nouveau record + 2.4 rappel de séance planifiée).
  ⚠️ L'infra notif existe (streak) → à étendre.
- [ ] **MUSC-F9 — Décalage de séance en glisser-déposer** (3.10) — aujourd'hui report par action seulement.

### 🟠 P1 — Finitions running (V0.5)

- [ ] **RUN-F1 — Splits & dénivelé** (5.26 tableau pace par km + 5.32 dénivelé cumulé — nécessite l'altitude GPS).
- [ ] **RUN-F2 — Séances guidées vocales** (5.18 guidage fractionné vocal + 5.19 annonces audio par km +
  5.9 blocs rapide/récup structurés + 5.23 prolonger/raccourcir vs cible) — **brancher les séances guidées
  sur le tracker actif** (aujourd'hui déconnectées). Dépend de `expo-speech`.
- [ ] **RUN-F3 — Résumé de course enrichi** (5.24 météo/terrain + 5.25 comparaison à l'objectif + dénivelé).

### 🟠 P1 — Contenu éditorial

- [ ] **CONTENU-01 — Seed des bibliothèques de programmes** (3.1 muscu + 5.2 course) — catalogues
  aujourd'hui **vides** ; à peupler via le constructeur admin (8.4, déjà livré). 🌐 bilingue FR+EN.

### 🟢 P2 — Confort & optionnel

- [ ] **NUTR-F1 — Rappels programmés nutrition** (1.14 rappel de pesée + 2.5 rappel de repas). Étend l'infra notif.
- [ ] **SOCLE-01 — RevenueCat câblé inactif** (9.14) — entitlements posés mais inactifs, aucun paywall.
  **Optionnel** (peu coûteux posé tôt, évite une refonte ; app 100 % gratuite en V1).

---

## 🔧 Chantier refonte Muscu (18/07/2026)

> Problèmes de **logique de flux** du pilier Musculation, validés par Florian. Diagnostic figé :
> [docs/refonte-muscu/audit-flux.md](docs/refonte-muscu/audit-flux.md). Objectif : corriger les flux
> **structurels** (déjà propagés à Running) **avant** de poursuivre la roadmap. Chaque US suit le
> workflow **spec → plan → design → validation → code**. Ordre : A → B → C → D.

- [x] **US-A — Unifier programme → planning → séance** *(structurel, socle)* — **CODE LIVRÉ & RECETTE
  VALIDÉE (Florian, 19/07/2026) ✅** (subagent-driven, 7 commits `c0f6a07`→`c53d85a`, revue de code globale
  sans bloquant). Spec ✅ + plan ✅ + maquette ✅ validés Florian
  ([spec](docs/specs/functional/us/refonte-muscu-a-unification-programme-planning-seance.md) ·
  [plan](docs/plans/refonte-muscu-a-unification-programme-planning-seance.md)). Livré : migration
  `planned_session_id` (**appliquée cloud** + `db:types`), démarrer une séance **depuis le calendrier** (gaté
  muscu) + occurrence marquée `done` à la fin, fusion activer/planifier sur les 2 fiches, popup de changement
  de programme, i18n FR/EN. **Reste : relecture Damien.** ⚠️ **Running** : démarrage d'une course planifiée
  depuis le calendrier **différé** (option b du §7 — « Démarrer » masqué sur occurrences course).
- [x] **US-B — Séance du jour en accès direct** *(navigation)* — **CODE LIVRÉ & RECETTE VALIDÉE
  (Florian, 19/07/2026) ✅** (subagent-driven, 6 commits `10f267b`→`f5c7027`, revue de code globale sans bloquant).
  Raccourci « séance du jour » sur le hub muscu. Corrige le problème 3. Spec ✅ + plan ✅ + maquette ✅ validés
  Florian ([spec](docs/specs/functional/us/refonte-muscu-b-seance-du-jour-hub.md)). Hook partagé `useTodaySession`
  (occurrence réelle du jour, démarrage lié) + hub 3 états + coche « faite » + réalignement du widget dashboard 7.4.
  **Aucune migration.** **Reste : relecture Damien.**
- [x] **US-C — Refonte du flux de l'écran de séance en cours** *(le plus gros)* — **C1 + C2 + C3 tous livrés &
  recette validée (Florian). Reste relecture Damien.** Corrige le problème 4. **Absorbe MUSC-F4 / MUSC-F5 /
  MUSC-F6**. 📋 Analyse figée (22 points) :
  [analyse-seance-en-cours.md](docs/refonte-muscu/analyse-seance-en-cours.md). **Découpée en 3 sous-US** :
  - [x] **C1 — Cœur : flux guidé + garde-fous** — **CODE LIVRÉ & RECETTE VALIDÉE (Florian, 19/07/2026) ✅**
    (subagent-driven ; spec ✅ + plan ✅ + maquette ✅ ; revue globale sans bloquant). Carte série en cours
    (dernière perf + steppers) + liste repliée, valider = log+repos+avance, repos plein écran (repliable + repos
    éditable manuellement) + vibration, keep-awake, ✕ Continuer/Pause/Abandonner, Terminer + garde 0 série,
    **gestion des séries en direct** (+ Série / supprimer / dé-valider), résumé éditable (ressenti 5★ + note).
    2 vagues de correctifs recette intégrées (reps semées, charge non tronquée, « Ressenti /5 » ≠ RPE, repos
    saisissable + repliable, couleurs accent). **Aucune migration.** **Reste : relecture Damien.**
  - [~] **C2 — Saisie enrichie** — **CODE LIVRÉ (subagent-driven, 20/07/2026) ✅ ; reste recette device + relecture
    Damien.** Types de séries (échauffement auto-exclu, dropset, échec, durée, poids de corps ; **superset → C3**),
    **RPE par série** (1-10, optionnel, masqué derrière « ＋ RPE »), **charge planifiée vs réalisée** (snapshot
    `planned_weight_kg`). **Migration cloud appliquée** (`20260719230416` : `workout_sets.rpe` + `planned_weight_kg`
    + assouplissement `CHECK set_type` sur `workout_sets`/`exercise_plans`). Spec/plan/maquette validés Florian.
    6 commits, typecheck/lint/765 tests verts, parité i18n. Décisions : records excluent warmup **et** duration ;
    bodyweight lesté = record légitime. Revue finale sans bloquant. **Recette Florian (20/07/2026) : validée**
    (seul point remonté — rangée de chips sans indicateur de défilement — corrigé : fondu + chevron discret).
    Points connus non bloquants : poids de corps sans lest → « × 0 kg » (mineur) ; `lastPerf` désaligné si warmup
    intercalé (→ C3).
    Idée notée (IDEAS) : RIR en alternative au RPE.
    ([spec](docs/specs/functional/us/refonte-muscu-c2-saisie-enrichie.md) ·
    [plan](docs/plans/refonte-muscu-c2-saisie-enrichie.md) · [maquette](design/refonte-muscu-c2/refonte-muscu-c2.html))
  - [x] **C3 — Ajustements live** — **CODE LIVRÉ + RECETTE VALIDÉE (Florian, 21/07/2026) ✅** ; reste relecture
    Damien. Sync rules PowerSync déployées (2 tables C3). Réorganiser les
    exercices restants (↑/↓ + « Plus tard », machine prise), **superset** (liaison positionnelle, repos différé
    après la paire), remplacer un exercice (picker existant, exclut les exercices déjà présents), **note
    persistante par exercice** (migration `exercise_notes` appliquée), **suggestion de progression** RPE-aware
    (§6.5). ~~Accès démo en séance~~ retiré du périmètre (voir MUSC-F1 plus haut). Spec/plan/maquette validés
    Florian. 8 commits, typecheck/lint/778 tests verts, parité i18n. 2 fonctions pures testées Vitest
    (`computeReorderedExerciseOrder`, `computeProgressionSuggestion`).
    **Revue finale — 2 corrections** : (1) bug bascule superset (retombait sur la 1ʳᵉ série non validée du
    partenaire au lieu de la série jumelle au même rang, ex. échauffement antérieur) — corrigé, retracé à la
    main ; (2) **🔴 `exercise_notes` absente des sync rules PowerSync** (`docs/specs/technical/powersync-sync-rules.yaml`)
    — sans cette ligne, une note n'aurait pas survécu à une resynchro complète. **Action manuelle requise avant
    recette multi-appareils** : coller le fichier mis à jour dans le dashboard PowerSync (Settings → Sync
    Rules) puis Deploy — non automatisable, à faire par Florian ou Damien.
    **Recette (2 vagues, 20/07/2026)** : (1) indicateur de défilement chips ajouté [voir plus haut] ; (2)
    **superset revu deux fois** — v1 : action nommée « Lier avec {X} » mais toujours contrainte à un exercice
    **adjacent** (jugé « pas intuitif » / semblait ne pas marcher) ; **v2 (actuelle)** : lien **explicite**
    (nouvelle table `workout_superset_pairs`, migration appliquée + sync rules mises à jour **dans le même
    lot** cette fois) — bouton « Lier en superset » ouvre un **dialogue** listant tous les autres exercices de
    la séance (plus de contrainte de position), lien valable pour **toute la séance** (tous les rangs
    suivants). Nouveau composant `SupersetPickerModal`. Limite connue notée : un `exercise_plan` marqué
    `superset` côté admin ne crée plus de paire automatique au démarrage (seule la liaison en direct fonctionne).
    ([spec](docs/specs/functional/us/refonte-muscu-c3-ajustements-live.md) ·
    [plan](docs/plans/refonte-muscu-c3-ajustements-live.md) · [maquette](design/refonte-muscu-c3/refonte-muscu-c3.html))
- [x] **US-D — Templates de séance libre** *(arbitrable, lancée 21/07/2026)* — **RECETTE VALIDÉE (Florian,
  22/07/2026) ✅** (subagent-driven, 12 tâches ; + 1 correctif post-recette : accès aux templates rendu
  indépendant de « Séance libre », widget dédié sur le hub, cf. plus bas) ; reste relecture Damien sur
  l'ensemble du chantier. Sauvegarder une séance libre comme routine réutilisable (spec §4.1). Corrige le
  problème 5. Spec ✅ + plan ✅ (2 passages de
  revue chacun) + maquette ✅ validés Florian. Tables dédiées `workout_templates`/`workout_template_exercises`
  (patron repas types nutrition, **pas** de réutilisation `programs`) — **migration + sync rules PowerSync
  appliquées** (2 checkpoints cloud, go explicite Florian pour chacun). Composer un template à froid **et**
  l'enregistrer après coup depuis une séance libre terminée (cibles dérivées des séries **validées** via
  `deriveTemplateTargetsFromWorkoutSets`, testée Vitest), démarrer depuis un template
  (`planned_weight_kg` pré-rempli, même convention que `startWorkoutFromSession`), gérer (éditer/dupliquer/
  supprimer). Refactor `ExercisePlanEditor` → composant présentation partagé `ExerciseTargetsFields` +
  nouveau `TemplateExerciseEditor` (5ᵉ champ inédit : sélecteur de type de série, 7 valeurs). Choix à
  blanc/template sur le bouton « Séance libre » du hub + lien secondaire les jours de séance planifiée.
  typecheck/lint/781 tests (shared) + 44 tests (mobile) verts, parité i18n FR/EN stricte. **Chantier refonte
  Muscu (A/B/C1/C2/C3/D) complet côté implémentation.**
  ([spec](docs/specs/functional/us/refonte-muscu-d-templates-seance-libre.md) ·
  [plan](docs/plans/refonte-muscu-d-templates-seance-libre.md) · [maquette](design/refonte-muscu-d/refonte-muscu-d.html))

> **Note** : ces US ne sont **pas** ajoutées comme lignes de la [roadmap](docs/roadmap/roadmap.md)
> versionnée (elles relèvent de la **refonte** de fonctionnalités existantes, pas de nouvelles features).
> US-C consolide des items roadmap déjà présents (MUSC-F4/F5/F6 → 3.26/3.27/3.28/3.29/3.32/3.33/3.34/3.36/3.37…) ;
> leur Statut roadmap sera mis à jour à la livraison de US-C.

---

## ✅ Build à deux — RÉSOLU (14/07/2026)

> **Résolu (14/07/2026)** : le build à deux fonctionne, le contournement `app.json` local n'est
> plus nécessaire. Historique conservé ci-dessous pour trace.
> **Contexte initial (07/07/2026)** : Florian était **bloqué pour builder l'app** (EAS) — projet Expo
> sous le **compte perso `damdamdeoh`** (`projectId 4d24d343-…`), non partageable → `eas build` /
> `eas init` renvoyaient « Entity not authorized » pour `florian935`.

- [x] **Créer une Organisation Expo** (expo.dev) et y **transférer/héberger** le projet `wellness-app`. — org `wellness-appl`, projet transféré (07/07/2026).
- [x] **Inviter `florian935`** (`florian.martin63000@gmail.com`) comme membre (Developer/Admin).
- [x] Mettre `apps/mobile/app.json` → `"owner": "wellness-appl"` (au lieu de `damdamdeoh`). —
  **mergé dans `dev`** (PR #28, 07/07/2026). `extra.eas.projectId` + `updates.url` inchangés/cohérents.
  Transfert confirmé serveur (`eas project:info` → `@wellness-appl/wellness-app`, même projectId).
- [x] `npm run build:preview` / `build:dev` **passent sous le compte de Florian** ; `app.json`
  restauré, contournement local abandonné (confirmé 14/07/2026).
- [x] **Config env des builds autonomes** — ✅ **fait (07/07/2026)** : les 3 `EXPO_PUBLIC_*`
  (`SUPABASE_URL` / `_ANON_KEY` / `POWERSYNC_URL`) déclarées via **EAS Environment Variables**
  (`eas env:push` depuis `apps/mobile/.env`) pour **preview + production** (visibility PUBLIC ;
  vraies valeurs vérifiées via `eas env:list --format long`). _Contexte :_ `eas.json` n'a aucun bloc
  `env` → sinon les builds `preview`/`production` (JS compilé sur EAS cloud) sortaient **sans** ces
  variables → **crash au démarrage** (`supabase.ts` lève à l'import ; les dev builds marchaient car
  Metro injecte le `.env` local). _MàJ 14/07/2026 :_ un bloc `env` (mêmes 3 `EXPO_PUBLIC_*`, clé
  publishable) a aussi été ajouté au profil **preview** dans `eas.json` — redondant/explicite avec
  les EAS Environment Variables, versionné dans le repo (aucun secret).
- [x] **Coordination migrations** : convention de **plages de timestamps** de migration actée
  (collisions évitées de justesse le 06-07/07 : nutrition `140000-140002`, running `20260707120000`) —
  OK (14/07/2026).
- [x] Retirer la bannière ⚠️🔴 en tête de [CLAUDE.md](CLAUDE.md) — **fait (14/07/2026)**.

---

## 🐞 Bugs connus / à corriger

> Anomalies remontées hors du fil d'une US en cours. À traiter sur une branche `fix/…` dédiée
> (jamais en piggyback d'un dev en cours). Reproduire → spec courte si besoin → corriger → PR.

- [x] **Back-office `/users` : colonne « Piliers » = « — » pour tous les comptes** — **corrigé**
  (`fix/admin-piliers-affichage`, 17/07/2026 ; remontée Florian pendant la recette 8.8a). Le mobile
  sérialise `active_pillars` avec `JSON.stringify(...)` dans une colonne PowerSync `text`
  ([settings-repository.ts](apps/mobile/src/data/repositories/settings-repository.ts)) → à la synchro,
  la **chaîne JSON** atterrit telle quelle dans la colonne `jsonb` `user_settings.active_pillars`
  (jsonb `string`, pas `array`). Le mobile re-parse tolérant (`parseJsonColumn`) mais l'admin faisait un
  simple `Array.isArray` → « — » systématique. Fix : helper partagé `parseActivePillars`
  ([data/users.ts](apps/admin/src/data/users.ts)) tolérant chaîne JSON **et** tableau natif, utilisé
  par [UsersScreen.tsx](apps/admin/src/screens/UsersScreen.tsx) + [UserDetailScreen.tsx](apps/admin/src/screens/UserDetailScreen.tsx).
  **100 % JS, aucune migration, aucune reprise de données.** **Reste : recette back-office + relecture Damien.**
- [x] **Note facultative après une course invisible sous le clavier (Android)** — **corrigé**
  (`fix/note-course-clavier-invisible`, 18/07/2026 ; remontée Damien pendant la recette device). Le
  `KeyboardAvoidingView` de [FormScreen](apps/mobile/src/components/FormScreen.tsx) était inactif sur
  Android (`behavior={undefined}`) → le champ note en bas de l'écran de résumé de course restait masqué
  par le clavier pendant la saisie. Fix : `behavior='height'` sur Android (padding conservé iOS).
  Corrige aussi tous les formulaires longs (8 écrans). **100 % JS.** **Reste : recette device + relecture Damien.**
- [x] **Footer « Ajouter un aliment » : 4ᵉ bouton qui déborde en bas à droite** — **corrigé**
  (`fix/food-picker-footer-deborde`, 18/07/2026 ; remontée Damien pendant la recette device). Le footer de
  [food-picker](apps/mobile/src/app/food-picker.tsx) alignait 4 boutons (Scanner / Liste rapide / Ajout
  rapide / Créer un aliment) en `flexDirection:'row'` sans wrap → le 4ᵉ dépassait à droite. Fix :
  `flexWrap:'wrap'`. **100 % JS.** **Reste : recette device + relecture Damien.**
- [x] **Champs numériques du Profil : effacement silencieux sur saisie invalide** — **corrigé**
  (`fix/profil-champs-numeriques-invalides`, 16/07/2026 ; issu du point de vigilance de la revue NUTR-11).
  Une saisie non vide mais invalide (texte, ≤ 0) dans poids / taille / poids cible écrivait `null` en base
  (le parseur renvoie `null`) → **écrasement silencieux** de la valeur (et suppression de l'objectif pour
  le poids cible). Fix : détection `hasInvalidNumber` → **bouton « Enregistrer » désactivé** + message
  `profile.invalidNumber` (FR/EN) ; champ **vide** toujours autorisé (effacement volontaire).
  [profile.tsx](apps/mobile/src/app/profile.tsx). **100 % JS** (reload Metro). **Reste : recette device
  + relecture Damien.**
- [x] **Graphiques débordant à droite de leur carte (Nutrition → Stats ; latent muscu/course)** —
  **corrigé** (`fix/affichage-graphes-et-filtre-course`, 16/07/2026). Largeur codée en dur (`window − 48`)
  dans [ProgressLineChart.tsx](apps/mobile/src/components/charts/ProgressLineChart.tsx) /
  [MuscleVolumeBarChart.tsx](apps/mobile/src/components/charts/MuscleVolumeBarChart.tsx), sans compter
  l'axe Y de `react-native-gifted-charts` (rendu **hors** de `width`). Fix : largeur **mesurée** via
  `onLayout`, répartie axe Y 44 px + marge 12 px + tracé → tient dans la carte partout. **100 % JS**
  (reload Metro). **Recette device validée Florian (16/07/2026)** sur APK release ✅ — reste relecture Damien.
- [x] **Filtre course « Semaine / Mois / Depuis le début » sur 2 lignes (card Statistiques)** —
  **corrigé** (`fix/affichage-graphes-et-filtre-course`, 16/07/2026). `Segment` de
  [running-history/index.tsx](apps/mobile/src/app/running-history/index.tsx) passé en `scrollable`
  (variante déjà gérée par le composant) → une seule ligne défilable.
  **Recette device validée Florian (16/07/2026)** ✅ — reste relecture Damien.

- [x] **Modifier / supprimer un aliment ajouté à un repas — geste peu découvrable + édition limitée à la
  quantité** — **RECETTÉ & VALIDÉ (Florian, 17/07/2026) ✅** — _remontée Florian, 16/07/2026._ **Spec + plan validés Florian (16/07/2026)** → **code livré
  & mergé sur `dev`** (subagent-driven, 4 commits `5e00ac9`→`0729039`, revues spec+qualité par tâche +
  revue finale *ready-to-merge*). **Design livré** : swipe gauche sur l'entrée → Modifier + Supprimer
  (tap conservé, appui long retiré) ; édition élargie aux quick add (kcal/P/G/L/nom), entrées avec
  quantité inchangées (grammes) ; `updateEntry` assoupli (quantité nulle + nom + micros conditionnels) ;
  i18n FR/EN. 100 % client, aucune migration. typecheck/lint/tests(684) verts. **Recette device validée
  (Florian, 17/07/2026) ✅** (swipe Modifier/Supprimer, tap→détail, édition quick add, non-régression
  quantité, actions non rognées) **— reste relecture Damien.** Spec :
  [us/fix-journal-entree-swipe-edition.md](docs/specs/functional/us/fix-journal-entree-swipe-edition.md) ·
  Plan : [plans/fix-journal-entree-swipe-edition.md](docs/plans/fix-journal-entree-swipe-edition.md).
  Constat utilisateur : « on ne
  peut pas modifier ni supprimer un aliment ajouté sur un repas ». **Vérif code** ([nutrition.tsx](apps/mobile/src/app/(tabs)/nutrition.tsx))
  : les fonctions **existent** mais sont **cachées / partielles** — (1) **suppression** = appui **long**
  sur l'entrée (`onLongPress`) **ou** tap → fiche détail (4.34) → bouton corbeille ; rien à l'écran ne
  signale ces gestes → **découvrabilité nulle** ; (2) **modification** = tap → fiche → « Modifier », mais
  **ne change que la quantité (grammes)** et **uniquement** si l'entrée porte une quantité
  (`canEdit = quantityG != null && quantityG > 0`) → un **ajout rapide sans quantité** n'est pas
  éditable ; on ne peut **pas** changer l'aliment lui-même ni corriger ses macros. **Pistes** : rendre
  les actions visibles (bouton/onglet « … » ou swipe sur l'entrée, au lieu du seul appui long) ;
  autoriser l'édition d'un quick add sans quantité. **100 % client** a priori (UI + `updateEntry` /
  `removeEntry` déjà en place, pas de migration). _À cadrer : spec courte avant fix._

- [x] **Aucun sélecteur de langue dans l'app — impossible de changer FR/EN une fois le compte créé** —
  **corrigé** (`feature/langue-selecteur-reglages`, 16/07/2026) : `Segment` FR/EN dans Réglages →
  `updateSettings({ language })` ; l'effet i18next + la persistance/sync existaient déjà. 100 % client,
  aucune migration. Spec/plan : [us/langue-selecteur-reglages.md](docs/specs/functional/us/langue-selecteur-reglages.md).
  **✅ Recette device validée (Florian, 16/07/2026)** (bascule FR↔EN immédiate + conservée au relancement). Reste : relecture Damien.
  _remontée Florian, 16/07/2026 (Pixel 6a passé en anglais système, l'app reste en français)._ **Vérif
  code** : la langue du terminal n'est lue **qu'une fois**, à la création du compte, pour initialiser
  `user_settings.language` ([settings-repository.ts:245](apps/mobile/src/data/repositories/settings-repository.ts#L245)) ;
  ensuite c'est cette **préférence persistée** qui prime et qui est appliquée à i18next à chaque
  démarrage ([_layout.tsx:104-109](apps/mobile/src/app/_layout.tsx#L104-L109)). Or l'écran Réglages
  ([settings.tsx](apps/mobile/src/app/settings.tsx)) n'expose **pas** la langue (thème/unités/piliers/
  notifications seulement) → une fois le compte créé, changer la langue d'Android n'a aucun effet et
  **aucun utilisateur ne peut repasser l'app en EN/FR**. Le champ `language` existe côté données + type
  (`SettingsInput`), il suffit de le câbler à l'UI. **Piste** : ajouter un `Segment` Langue (FR / EN,
  éventuellement « langue du système ») → `updateSettings({ language })` ; la tuyauterie i18next réagit
  déjà au changement. **100 % client, pas de migration.** _À cadrer : c'est une US (spec → plan → design
  → validation avant code), pas un simple patch._

- [x] **Onboarding redemandé à chaque connexion alors qu'il est déjà terminé** — **corrigé**
  (`fix/onboarding-rejeu-connexion`, 16/07/2026). Repro Florian confirmée : **déco/reco OK**, **réinstall
  → onboarding systématique** (race offline-first). Fix : helper pur testé `resolveRootRoute`
  (@wellness/shared, 8 tests) + câblage `_layout.tsx` → on n'ouvre l'onboarding sur profil local absent
  qu'**après `hasSynced`**. Spec : [us/fix-onboarding-rejeu-connexion.md](docs/specs/functional/us/fix-onboarding-rejeu-connexion.md).
  **✅ Recette device validée (Florian, 16/07/2026)** (réinstall → reconnexion → app directe, plus d'onboarding fantôme). Reste : relecture Damien.
  - [x] **CI rouge (run #194) corrigée** — le câblage de `resolveRootRoute` avait introduit une erreur de
    typage : `fontsReady = loaded || error` valait `true | Error | null` au lieu de `boolean`
    ([_layout.tsx:71](apps/mobile/src/app/_layout.tsx#L71)). Corrigé en `loaded || error != null` (16/07/2026, `dev`).
  _Diagnostic initial : remontée Florian,
  16/07/2026, à reproduire sur device._ ⚠️ **Distinct** du bug déjà corrigé `fix/onboarding-rejeu-profil`
  (crash au 2ᵉ passage) : ici l'onboarding **se relance tout seul à chaque login**. **Vérif code** : la
  gate de routing ([_layout.tsx:79](apps/mobile/src/app/_layout.tsx#L79), [_layout.tsx:132-137](apps/mobile/src/app/_layout.tsx#L132-L137))
  décide via `onboardingCompleted = profile?.onboardingCompletedAt != null`. Or `ready` ne dépend que de
  `profileLoading` = **requête locale SQLite** ([profile-repository.ts:110-118](apps/mobile/src/data/repositories/profile-repository.ts#L110-L118)),
  **pas** de la **synchro initiale réseau** (`hasSynced`). **Hypothèse (race offline-first)** : à la
  connexion, si la base locale n'a pas encore la ligne `profiles` (nouvel appareil, réinstall, ou base
  locale vide), la requête locale résout `null` **immédiatement** → `ready` devient vrai → `profile` est
  `null` → `onboardingCompleted = false` → redirection vers `/(onboarding)/intro` **avant** que PowerSync
  ait téléchargé le profil (qui porte pourtant `onboarding_completed_at`). Piste alternative à écarter :
  l'écriture `completeOnboarding()` ([profile-repository.ts:161](apps/mobile/src/data/repositories/profile-repository.ts#L161))
  ne remonte pas au serveur (le flag ne persiste pas entre sessions). **Pistes de fix** : attendre
  `hasSynced` (ou un état « profil chargé depuis le serveur ») avant de router vers l'onboarding, au lieu
  du seul `profileLoading` local ; ou distinguer « profil absent car pas encore synchro » de « profil
  absent car nouveau compte ». **100 % client a priori, pas de migration.** _À cadrer : reproduire device
  (est-ce à chaque login, ou seulement après réinstall/2ᵉ appareil ?) → spec courte avant fix._

- [x] **Scan code-barres : « produit introuvable » trompeur + affichage nutritionnel pauvre** —
  **corrigé** (`fix/scan-code-barres`, 14/07/2026). Investigation (adb logcat + test direct endpoint
  OFF) : le scan **fonctionne** (validé Perrier physique) ; les échecs venaient de scanner des
  **codes-barres à l'écran** (mauvaise lecture → code absent d'OFF). Le pot de Nutella ne scanne pas
  (surface courbée = autofocus). **(1)** `fetchOpenFoodFactsByBarcode` renvoie un **résultat typé**
  `OffLookup` + helper pur `interpretOffProduct` → messages honnêtes (réseau / code inconnu affiché /
  fiche incomplète) au lieu d'« introuvable » générique. **(2)** `QuantityPanel` affiche **P/G/L** +
  **sucres/AGS/fibres** désormais captés depuis OFF et **stockés** à l'import (les 2 flux scan +
  recherche texte). +5 tests (39/39 mobile), i18n 787/787, typecheck/lint verts. **100 % client, pas
  de checkpoint 🔴.** **Reste** : recette device (rescanner un vrai produit → P/G/L + sucres/AGS
  visibles ; scanner une image → « code inconnu (…) »). _Note : `eas.json` local de Florian non
  commité (identifiants, hors git)._

- [x] **Onglets du food-picker étirés en hauteur (« Ajouter un aliment »)** — **corrigé**
  (`fix/food-picker-onglets-scrollable`, 14/07/2026). Régression de la variante `scrollable` de
  [Segment.tsx](apps/mobile/src/components/Segment.tsx) (commit `41e459b`) : un `ScrollView`
  horizontal enfant direct d'un flex colonne s'étire sur toute la hauteur → l'onglet sélectionné
  (« Tous ») devenait une grande barre orange, libellé en haut. Fix : `ScrollView` enveloppé dans
  une `View` qui se cale sur la hauteur du contenu et porte le cadre. typecheck/lint/test verts.
  **100 % client, UI pure.** **Recette device validée par Florian (14/07/2026)** ✅ — reste relecture Damien.

- [x] **Fuite inter-piliers dans « Mes programmes » muscu (pas de filtre par pilier)** — **corrigé**
  (`fix/programmes-filtre-pilier`, 13/07/2026). L'écran muscu [programs/index.tsx](apps/mobile/src/app/programs/index.tsx)
  ne passait **jamais** le pilier (`useMyPrograms()` sans argument + `filters` sans `pillar`) → les
  programmes running fuyaient dans « Mes programmes » **et** « Bibliothèque » muscu. Fix ~2 lignes :
  `useMyPrograms('strength')` + `pillar: 'strength'` toujours présent dans `filters`. Bug
  **unidirectionnel** (running filtrait déjà bien). typecheck mobile vert. **100 % client, aucune
  migration.** **Recette device validée par Florian (13/07/2026)** ✅ — reste relecture Damien.

- [x] **Écran détail programme (mobile) — séances repliables** — **livré & mergé `dev`**, **recette
  device validée par Florian (13/07/2026)**. Cadrage complet (spec + plan, maquette écartée). Composant
  partagé `CollapsibleCard` : séances **repliées par défaut**, ouverture indépendante, en-tête tappable
  + chevron, `footer` (Démarrer) toujours visible. **(1) Nom d'exercice tronqué → corrigé** (`PlanRow`
  sur 2 lignes). **(2) Séance cliquable → expansion inline** (muscu = « N exercices » + liste ; running
  = « type · cible » + puces/allure). Spec/plan :
  [detail-programme-seances-repliables.md](docs/specs/functional/us/detail-programme-seances-repliables.md).
  typecheck/lint/tests verts, i18n 796/796. **100 % client.** Reste : relecture Damien.

- [x] **🔴 BLOQUANT — Crash + non-enregistrement au 2ᵉ passage de l'onboarding** — **corrigé**
  (`fix/onboarding-rejeu-profil`, 13/07/2026), diagnostic device (adb logcat + logs temporaires).
  4 causes distinctes trouvées & corrigées : **(1) crash** = `active_pillars` triple-encodé relu
  en chaîne → `.map` planté → `parseJsonColumn` gagne un validateur de forme + garde `isPillarArray` ;
  **(2) profil affiché vide** (données pourtant enregistrées) = formulaire figé au montage alors que
  `useQuery` renvoie `null` au 1ᵉʳ rendu → **gate `isLoading`** sur `profile.tsx` + `infos.tsx` ;
  **(3) perte de saisie** = garde anti-écrasement prénom/sexe/date ; **(4) date de naissance −1** =
  `toISOString()` (UTC) sur date locale → helper `toIsoDate`. + objectif `scrollable` (UI) + note
  synchro corrigée. Vérifs vertes. Recette device validée par Florian ✅ (reste : relecture Damien).
  **Suivi levé** (`fix/finitions-affichage-profils`, 13/07/2026) : `nutrition-profile`/`running-profile`
  **vérifiés OK** — lecture réactive, pas de snapshot au montage, donc pas concernés par le bug.

- [x] **Typecheck `running-history` au vert** (`fix/finitions-affichage-profils`, 13/07/2026) : les 2
  erreurs préexistantes (`router.push` string → route typée `{ pathname, params }`) corrigées →
  **typecheck 100 % vert** sur tous les workspaces.

- [ ] **Doc** : [dev-build-android-local.md](docs/specs/technical/dev-build-android-local.md) créée
  (procédure dev build Android local pour Damien) — 13/07/2026.

---

## 🟠 Activation cloud — ✅ FAITE (09/07/2026), reste la vérif device

> **Cloud activé (09/07/2026)** : toutes les migrations sont appliquées sur Supabase, la publication
> `powersync` est en place et les **sync rules sont déployées** sur PowerSync. ⚠️ **Format réel =
> `bucket_definitions`** (et **non** « edition 3 » comme l'écrivaient les anciennes entrées TODO /
> CHANGELOG) : les Sync Streams `auto_subscribe` ne délivraient aucune donnée au client → revert
> documenté en tête de [powersync-sync-rules.yaml](docs/specs/technical/powersync-sync-rules.yaml).
> **Vérif device faite (Florian, 14/07/2026)** ✅ pour tous les piliers (muscu US1/US2/US3, nutrition,
> running R3/R4b*) + validation terrain running R1. _(* R4b records : vérif terrain prévue le 15/07.)_

- [x] **Migrations Supabase cloud appliquées** — les 14 migrations (socle + muscu US1/US2/US3, nutrition,
  food, recettes/poids, running `runs`, `nutrition_meals`) sont sur le cloud ; publication `powersync`
  en place (gérée via `alter publication … add table` dans les migrations).
- [x] **Sync rules déployées** — format `bucket_definitions`, 2 buckets (`user_data` / `shared_content`),
  toutes les tables — depuis [powersync-sync-rules.yaml](docs/specs/technical/powersync-sync-rules.yaml).
- [x] **`database.types.ts` régénéré depuis le cloud** (09/07/2026, `supabase gen types --project-id …`) —
  inclut la colonne `meals` ; typecheck vert sur les 3 workspaces.
- [x] **Seed** (16 exercices bilingues + 50 aliments) appliqué au cloud (chore db, 06/07/2026).
- [x] **Vérif device US1 (Task 22)** — **recettée (Florian, 14/07/2026)** ✅ : écriture/lecture mode avion,
  sync montante/descendante, RLS sur 2 appareils, i18n FR/EN.
- [ ] **Relecture a posteriori par Damien** — le merge US1 a court-circuité la relecture à deux
  (zones sync/sécurité) sur décision explicite de Florian ; à repasser.
- [x] **Vérif device US2** — **recettée (Florian, 14/07/2026)** ✅ : créer/dupliquer/activer un programme, démarrer une séance depuis un programme.
- [x] **Vérif device US3** — **recettée (Florian, 14/07/2026)** ✅ : record détecté à la clôture + mis en avant au résumé, historique liste/détail, courbes qui s'affichent, volume/groupe.
- [x] **Running R1 — VALIDATION TERRAIN faite (Florian, 14/07/2026)** ✅ : course réelle écran verrouillé
  + arrière-plan, perte GPS, auto-pause, mode avion→sync (1 ligne/course), reprise après kill, batterie,
  RLS 2 comptes, i18n — le cœur de R1 est recetté sur device.
  - [x] **Fix crash au lancement d'une course** (`fix/location-receive-boot-completed`, 09/07/2026) :
    ajout de la permission `RECEIVE_BOOT_COMPLETED` (manquait → `expo-location`/`task-manager`
    plantait à la 1ʳᵉ position GPS en programmant un job persistant). Diagnostic via `adb logcat`
    sur l'APK preview (Pixel 6a). **Nécessite un nouveau build** pour valider (l'APK actuel plante).

---

## 🚧 En cours

- [x] **US META-09 — Lissage des courbes par moyenne mobile** — **RECETTÉ & VALIDÉ (Florian, 18/07/2026) ✅** — **CODE LIVRÉ & mergé sur `dev`** (`948beff`) (subagent-driven,
  branche `feature/meta09-lissage-courbes`, spec 1 passe + plan 1 passe + revues par tâche + **revue
  finale *prête à merger***). **Spec + maquette + plan validés Florian (18/07/2026).** Brique pure
  `movingAverage` (centrée, fenêtre en points, bords rétrécis) + prop `smooth` sur `ProgressLineChart`
  (overlay **brut estompé + lissé accentué**, fenêtre auto ≥ 4 points, rétrocompatible), activée sur
  **4 courbes** (poids, kcal, allure, muscu). Fenêtre **en points** (pas en jours), taille fixe auto ;
  aucun contrôle ajouté. **100 % client, aucune migration, aucune i18n.** typecheck/lint/tests(790)
  verts. Catalogue META-09 → ✅. **Reste : recette device (4 courbes : lissé cohérent + brut visible,
  pas de glitch d'axe allure) → **RECETTÉ & VALIDÉ (Florian, 18/07/2026) ✅ — reste relecture Damien.** Spec :
  [us/meta09-lissage-courbes.md](docs/specs/functional/us/meta09-lissage-courbes.md) ·
  Plan : [plans/meta09-lissage-courbes.md](docs/plans/meta09-lissage-courbes.md) ·
  Maquette : [design/meta09-lissage-courbes](design/meta09-lissage-courbes/meta09-lissage-courbes.html).
- [x] **US META-08 — Tendance générique par régression linéaire (pente + R²)** — **RECETTÉ & VALIDÉ (Florian, 18/07/2026) ✅** — **CODE LIVRÉ & mergé sur `dev`** (`fc9aead`)
  (subagent-driven, branche `feature/meta08-tendance-regression-lineaire`, commits `709ddc9`→`32b11bb`,
  spec 1 passe + plan 2 passes + revue par tâche + **revue finale *prête à merger***). **Spec + plan
  validés Florian (17-18/07/2026).** Brique socle : moteur pur `linearRegression` (moindres carrés →
  pente/intercept/R²/n, `null` sur cas dégénéré) + `daysBetween` (DST-safe) ; `weightTrend` (signature
  datée) et `paceTrend` rebranchés dessus, **iso-comportement** (goldens de non-régression ; divergences
  non-monotones figées). R² non exposé (réserve pour projections META-14/15/16). **100 % client, aucune
  UI, aucun i18n, aucune migration.** typecheck/lint/tests(739) verts. Catalogue META-08 → ✅. **Reste :
  recette device (non-régression des tendances poids [dashboard + Stats nutrition] et allure [Stats
  running]) → **RECETTÉ & VALIDÉ (Florian, 18/07/2026) ✅ — reste relecture Damien.** Spec :
  [us/meta08-tendance-regression-lineaire.md](docs/specs/functional/us/meta08-tendance-regression-lineaire.md) ·
  Plan : [plans/meta08-tendance-regression-lineaire.md](docs/plans/meta08-tendance-regression-lineaire.md).
- [x] **US NUTR-11 — Progression vers l'objectif de poids** — **RECETTÉ & VALIDÉ (Florian, 17/07/2026) ✅** — **CODE LIVRÉ & mergé sur `dev`** (subagent-driven, commits
  `826cf59`→`8a4c486` sur `feature/nutr11-progression-poids`, revue finale *APPROVED* + correctif
  d'arrondi). **Spec + plan validés Florian (16/07/2026).** Carte Stats nutrition (section Poids) : **%
  (+ kg)** du chemin entre un **poids de départ figé** et un **poids cible** (Profil). Départ figé à la
  définition de la cible (option A) ; formule bornée [0,1] (perte ou prise) ; actuel = dernière pesée ;
  dépassement → 100 % + badge « Objectif atteint » ; recul → 0 % ; pct plafonné à 99 % tant que non
  atteint ; pas de carte si aucune cible ou départ = cible. **Migration cloud appliquée** (`profiles.target_weight_kg`
  + `start_weight_kg`, `db:push` + `db:types` + `MIGRATIONS.md`) + `computeWeightGoalProgress` (pur, testé,
  9 cas) + `setWeightTarget` (fige le départ) + hook `useWeightGoalProgress` + champ « Poids cible » (Profil)
  + `WeightGoalCard` + i18n FR/EN. **100 % client hormis migration.** typecheck/lint/tests(710) verts.
  Catalogue NUTR-11 → ✅. **Recette device validée (Florian, 17/07/2026) ✅ — reste relecture Damien.** Spec :
  [us/nutr11-progression-poids.md](docs/specs/functional/us/nutr11-progression-poids.md) ·
  Plan : [plans/nutr11-progression-poids.md](docs/plans/nutr11-progression-poids.md).
- [x] **US NUTR-17 — Régularité du journal (taux de complétion)** — **RECETTÉ & VALIDÉ (Florian, 17/07/2026) ✅** — **code livré & mergé sur `dev`**
  (`feature/nutr17-regularite-journal`, commits `9b8b1ec`→`f6b54a1`, revue finale *ready-to-merge*).
  **Spec + plan validés Florian (16/07/2026).** Carte « Régularité du journal » sur Stats nutrition
  (pct + N/M jours renseignés, 7 j/30 j) : dénominateur **borné à l'ancienneté**, **aujourd'hui exclu**.
  Pur `computeJournalCompletion` (testé, dates UTC exact/DST-safe) + hook `useJournalCompletion`
  (`useDailyTotals` + `MIN(log_date)`). i18n FR/EN. **100 % client, aucune migration.** typecheck/lint/
  tests(702) verts. Catalogue NUTR-17 → ✅. **Recette device validée (Florian, 17/07/2026) ✅ — reste relecture Damien.** Spec :
  [us/nutr17-regularite-journal.md](docs/specs/functional/us/nutr17-regularite-journal.md) ·
  Plan : [plans/nutr17-regularite-journal.md](docs/plans/nutr17-regularite-journal.md).
- [x] **US NUTR-10 — Adhérence à l'objectif calorique** — **RECETTÉ & VALIDÉ (Florian, 17/07/2026) ✅** — **code livré & mergé sur `dev`**
  (`feature/nutr10-adherence-objectif`, commits `bf689ef`→`f61b194`, revue finale *ready-to-merge*).
  **Spec + plan validés Florian (16/07/2026).** Carte « Adhérence à l'objectif » sur Stats nutrition
  (part % + N/M jours dans la cible, fenêtre 7 j/30 j) : « dans la cible » = |kcal − objectif **effectif**
  du jour| ≤ marge % ; jours loggés seulement. **Marge configurable 5/10/15 % (défaut 10), synchronisée**
  (colonne `nutrition_profiles.adherence_margin_pct`, migration cloud appliquée + `db:types` + schéma
  PowerSync). Purs `computeEffectiveTargetForDay`/`computeGoalAdherence` (testés) + hook `useGoalAdherence`.
  i18n FR/EN. **100 % client hormis migration.** typecheck/lint/tests(697) verts. Catalogue NUTR-10 → ✅.
  **Recette device validée (Florian, 17/07/2026) ✅ — reste relecture Damien.** Spec :
  [us/nutr10-adherence-objectif.md](docs/specs/functional/us/nutr10-adherence-objectif.md) ·
  Plan : [plans/nutr10-adherence-objectif.md](docs/plans/nutr10-adherence-objectif.md).
- [x] **US MR-06 — Widget « Temps d'entraînement » (dashboard, inter-piliers)** — **RECETTÉ & VALIDÉ (Florian, 17/07/2026) ✅** — **code livré & mergé
  sur `dev`** (`feature/mr06-temps-entrainement`, commits `f1c8a5a`→`6face77`, revue finale
  *ready-to-merge*). **Spec + plan validés Florian (16/07/2026).** 1ʳᵉ stat inter-piliers en **temps** :
  widget `training-time` = total muscu + course de la **semaine ISO** + ventilation, gating
  `['strength','running']`, compact + empty. Pur `computeTrainingTime`/`formatHoursMinutes` (testés) +
  hook `useTrainingTime` (compose `useRunStats('week')` + `useWorkoutHistory`) + `TrainingTimeCard` +
  i18n FR/EN. **100 % client, offline, aucune migration.** typecheck/lint/tests(689) verts. Catalogue
  MR-06 → ✅. **Recette device validée (Florian, 17/07/2026) ✅ — reste relecture Damien.** Spec :
  [us/mr06-temps-entrainement.md](docs/specs/functional/us/mr06-temps-entrainement.md) ·
  Plan : [plans/mr06-temps-entrainement.md](docs/plans/mr06-temps-entrainement.md).
- [x] **US 8.8a — Consultation des utilisateurs (back-office)** — **RECETTÉ & VALIDÉ (Florian, 17/07/2026) ✅** — **code livré & mergé sur `dev`**
  (`feature/8.8a-admin-consultation-utilisateurs`, subagent-driven, commits `48c2f1f`→`5573579`, revue
  finale *ready-to-merge*). **Spec + plan validés Florian (16/07/2026).** Première moitié de 8.8 (le
  **bannissement = 8.8b**, à cadrer avec Damien). Vue SQL `admin_users` (fonction `can_manage_users()`
  super_admin/moderator, `WHERE` = barrière serveur, colonnes **sobres RGPD**, hors PowerSync,
  **migration appliquée cloud + `db:types`**) + gate `canManageUsers` (+ `RequireCanManageUsers`,
  `content_editor` exclu) + écrans liste `/users` (recherche email + pagination) & fiche `/users/:id`
  (lecture seule) + `data/users.ts` + i18n `fr.users`. **Lecture seule, clé anon, aucun `service_role`.**
  typecheck/lint/build verts. **Recette validée (Florian, 17/07/2026) ✅ — reste relecture Damien.** _Bug
  d'affichage « Piliers » remonté pendant la recette → corrigé séparément (`fix/admin-piliers-affichage`, §🐞)._ Spec :
  [us/8.8a-admin-consultation-utilisateurs.md](docs/specs/functional/us/8.8a-admin-consultation-utilisateurs.md) ·
  Plan : [plans/8.8a-admin-consultation-utilisateurs.md](docs/plans/8.8a-admin-consultation-utilisateurs.md).
- [x] **US 8.8b — Bannissement des utilisateurs** — **RECETTÉ & VALIDÉ (Florian, 17/07/2026) ✅ → US 8.8 CLOSE** — **code livré & mergé sur `dev`**
  (`feature/8.8b-admin-bannissement`, subagent-driven, commits `0845df6`→`b6b3aca`, revue finale
  *ready-to-merge* 7/7 sécurité). **Spec + plan validés Florian (16/07/2026).** **US 8.8 complète**
  (avec 8.8a). Table `user_bans` append-only + RPC `ban_user`/`unban_user` (`SECURITY DEFINER`,
  garde-fous habilitation/anti-self/anti-admin/motif, `banned_until='9999-12-31'`) + colonne `is_admin`
  sur la vue + section Modération sur la fiche `/users/:id` (Bannir/Débannir + historique, garde-fous UI)
  + audit `user.ban`/`user.unban` + i18n. **Migration appliquée cloud + `db:types`.** Clé anon, aucun
  `service_role`, coupure au prochain refresh (~1 h). typecheck/lint/build/tests(684) verts. **Recette
  validée (Florian, 17/07/2026) ✅ → US 8.8 close — reste relecture Damien.** Spec :
  [us/8.8b-admin-bannissement.md](docs/specs/functional/us/8.8b-admin-bannissement.md) ·
  Plan : [plans/8.8b-admin-bannissement.md](docs/plans/8.8b-admin-bannissement.md).
- [x] **US MN-06 — Apport protéique par kg (vs cible par objectif)** — ✅ **recette device validée (Florian, 16/07/2026)** (`feature/mn06-proteines-par-kg`,
  16/07/2026) — **spec + plan validés Florian (16/07/2026), code livré** (subagent-driven, revues par
  tâche + revue finale). Stat
  muscu↔nutrition, Phase A, descriptive. Section **Nutrition → Stats** : protéines **g/kg** (moyenne
  7 j/30 j ÷ poids) vs **fourchette cible par objectif** (bulk 1,6–2,2 · maintien 1,6–2,0 · sèche
  1,8–2,4 · perte 1,8–2,2) + statut low/in/high (couleurs neutres MN-05). Pure `computeProteinPerKg`
  + `PROTEIN_TARGETS_G_PER_KG` (shared, testées) + hook `useProteinPerKg` (réutilise `useDailyTotals`/
  `averageIntake`/`useLatestWeight`/objectif) + `ProteinPerKgCard`. **100 % client, offline, pas de
  migration.** Spec : [us/mn06-proteines-par-kg.md](docs/specs/functional/us/mn06-proteines-par-kg.md) ·
  Plan : [plans/mn06-proteines-par-kg.md](docs/plans/mn06-proteines-par-kg.md). Catalogue MN-06 → ✅.
  typecheck/lint/tests(676) verts. **✅ Recette device validée (Florian, 16/07/2026)** : g/kg + statut
  selon objectif + bascule 7 j/30 j vérifiés. Reste : relecture Damien.
- [x] **US MN-03 — Vue croisée « charge muscu & apports » (8 sem)** — ✅ **recette device validée (Florian, 16/07/2026)** (`feature/mn03-vue-croisee-seances-apports`,
  16/07/2026) — **spec + plan validés Florian (16/07/2026), code livré** (subagent-driven, revues
  spec+qualité par tâche + revue finale *prête à merger*). 3ᵉ stat
  croisée inter-piliers (muscu↔nutrition), Phase A, **descriptive** (complète l'alerte 4.32). Tableau
  8 semaines sur **Nutrition → Stats** : nb séances + tonnage muscu · kcal/j + prot/j (moyenne jours
  loggés) + mini-tendance `DeltaBadge` vs semaine précédente. Fonction pure `computeWeeklyTrainingNutrition`
  (shared, testée) + hook `useTrainingNutritionCross` (2 requêtes locales, gating au retour) + composant
  `TrainingNutritionCrossCard`. **100 % client, offline, pas de migration.** Revue spec sous-agent : 4
  bloquants corrigés (borne dayKey vs ISO, bucketing sans `weekEnd`, séances via LEFT JOIN, gating au
  retour). **Spec validée Florian (16/07/2026) → plan rédigé** (revue sous-agent : réf. `activePillars`
  + imports corrigés, `EmptyState` → texte simple, `test` shared-only). Spec :
  [us/mn03-vue-croisee-seances-apports.md](docs/specs/functional/us/mn03-vue-croisee-seances-apports.md) ·
  Plan : [plans/mn03-vue-croisee-seances-apports.md](docs/plans/mn03-vue-croisee-seances-apports.md) (6 tâches TDD).
  Catalogue MN-03 → ✅. typecheck/lint/tests(671) verts. **✅ Recette device validée (Florian, 16/07/2026)**
  (valeurs/tendances, cellules « — », gating). Reste : relecture Damien.
- [x] **US MUSC-05 — Équilibre musculaire par groupe (14 j)** — ✅ **recette device validée (Florian, 16/07/2026)** (`feature/musc05-equilibre-groupes`,
  15/07/2026) — **spec + plan validés**, **code livré & mergé sur `dev`** (subagent-driven, revues par
  tâche + revue finale *prête à merger*, aucun bloquant). Nouvelle section `/progress` : barres **par
  séries** colorées (délaissé/équilibré/sur-représenté vs cible uniforme 1/6) + alerte douce des
  groupes délaissés (≥ 12 séries sur 14 j). Brique pure `computeMuscleBalance` (testée) + hook
  `useMuscleBalance` (14 j) + `MuscleVolumeBarChart` étendu (couleur par barre, rétrocompatible). i18n
  FR/EN, **100 % offline, pas de migration**. 663 tests verts. Ratio pousser/tirer → **MUSC-11** (à
  cadrer, nécessite le type de mouvement = migration). Catalogue MUSC-05 → ✅. **✅ Recette device faite (Florian, 16/07/2026).**
- [x] **US META-06 — Comparaison période N vs N-1 (delta)** — ✅ **recette device validée (Florian, 16/07/2026)** (`feature/meta06-comparaison-periode`,
  15/07/2026) — **spec + plan validés**, **code livré & mergé sur `dev`** (subagent-driven, revues par
  tâche + revue finale *prête à merger*, aucun bloquant). Brique transverse Phase A : `percentChange` +
  `previousPeriodTodayKey` (shared, testés), composant mutualisé `DeltaBadge` (ton neutre), hooks
  `useRunStatsAt`/`useWeeklyVolumeComparison`. Deltas « vs période précédente » sur **3 surfaces**
  (running distance/temps/nb, nutrition kcal moyens, muscu volume hebdo total). i18n FR/EN, **100 %
  offline, pas de migration**. 658 tests verts. Catalogue META-06 → ✅. **✅ Recette device faite (Florian, 16/07/2026).**
- [x] **US MUSC-04 — Courbe 1RM estimé + période « tout »** — ✅ **recette device validée (Florian, 16/07/2026)** (`feature/musc04-courbe-1rm-periode-tout`,
  15/07/2026) — **spec + plan validés**, **code livré** (subagent-driven, revues par tâche + revue
  finale *prête à merger*, aucun bloquant). Clôture du delta MUSC-04 vs spec 6.2 (l'écran `/progress`
  existait déjà à ~80 %) : helper pur `sessionBestEstimated1RM` (shared, testé), métrique 1RM estimé
  **par séance** + période **tout** dans `useExerciseProgression` (réutilise `estimate1RM`, pas d'Epley
  SQL), toggles 3 métriques × 4 périodes, i18n FR/EN. `max_weight`/`volume` inchangées. **Pas de
  migration, 100 % offline.** 647 tests verts. Catalogue MUSC-04 → ✅. **✅ Recette device faite (Florian, 16/07/2026).**
- [x] **US RN-01/RN-02 — Dépense course → objectif du jour** — ✅ **recette device validée (Florian, 16/07/2026)** (`feature/rn01-depense-course-objectif`,
  15/07/2026) — **spec + plan validés** (brainstorming Florian + revues spec/plan *Approved*). 2ᵉ
  croisement inter-piliers (running↔nutrition), Phase A du
  [catalogue d'analyses](docs/product/analyses-donnees.md) (déterministe, gratuit, offline). Réglage
  **Forfait/Auto** : en Auto l'objectif du jour suit la **dépense estimée des courses terminées**
  (repli forfait muscu), Forfait **inchangé**. Formule NET ≈ poids × distance × 1,0 + intensité bornée
  (EPOC). Spec : [us/rn01-depense-course-objectif.md](docs/specs/functional/us/rn01-depense-course-objectif.md) ·
  Plan : [plans/rn01-depense-course-objectif.md](docs/plans/rn01-depense-course-objectif.md) (8 tâches TDD,
  subagent-driven). **Code livré** (revues spec+qualité par tâche + revue finale *prête à merger*, aucun
  bloquant, non-régression Forfait prouvée) : `estimateRunCalories` + `dayCalorieBonus` (shared, testés),
  câblage repository + schéma PowerSync, migration `training_bonus_mode`, hook centralisé
  `useDayCalorieTarget(dayKey)`, sélecteur profil, badge « · course », i18n FR/EN. typecheck/tests/lint
  verts. **✅ Migration `training_bonus_mode` appliquée + recette device validée (Florian, 16/07/2026)** :
  mode Forfait inchangé, Auto = dépense course (somme le même jour), repli forfait jour muscu seul.
- [x] **US 4.32 — Alerte croisée déficit + fort volume** — ✅ **recette device validée (Florian, 16/07/2026)** (`feature/4.32-alerte-deficit-volume`,
  15/07/2026) — **spec validée** (brainstorming Florian + relecture *Approved*). Première **stat
  croisée inter-piliers** (muscu↔nutrition), Phase A du [catalogue d'analyses](docs/product/analyses-donnees.md)
  (déterministe, gratuit, offline, **sans IA**). Widget dashboard conditionnel (déficit ≥ 15 % sur ≥ 4
  jours loggés **et** volume muscu 7 j ≥ 8000), message paramétré, gating piliers actifs.
  **Découverte** : une v1 faible existe déjà sur l'écran Stats nutrition (commit `193c5ff`) → l'US la
  **déplace** sur le dashboard (retrait de l'ancienne). Logique pure `computeDeficitVolumeAlert`
  (shared, testée) + hook `useDeficitVolumeAlert` + widget. **100 % client, offline, pas de checkpoint
  🔴.** Spec : [us/4.32-alerte-deficit-volume.md](docs/specs/functional/us/4.32-alerte-deficit-volume.md) ·
  Plan : [plans/4.32-alerte-deficit-volume.md](docs/plans/4.32-alerte-deficit-volume.md) (7 tâches TDD).
  **Code livré** (subagent-driven, revues spec+qualité par tâche + revue finale *ready to merge*,
  mergé sur `dev`) : `computeDeficitVolumeAlert` (shared, testé), widget `deficit-volume` au registre,
  hook `useDeficitVolumeAlert` (gating muscu+nutrition, cible de base, volume 7 j), widget
  `DeficitVolumeAlertCard` (rend `null` hors alerte), i18n FR/EN, retrait de l'ancienne alerte sur
  `nutrition-stats`. typecheck/tests(631)/lint verts. **100 % client, offline, pas de checkpoint 🔴.**
  **✅ Recette device validée (Florian, 16/07/2026)** : alerte provoquée/levée, gating piliers,
  disparition de l'ancienne alerte écran Stats, cadre vide en mode édition. _(Export web KO = pré-existant op-sqlite, hors 4.32.)_
- [x] **US 8.10 — Log d'audit admin** — ✅ **recette validée (Florian, 16/07/2026, back-office web)** (`feature/8.10-admin-log-audit`, 14/07/2026) — **cadrage validé**
  (brainstorming Florian + relecture sous-agent *Approved*). Première des 3 US de gouvernance admin
  restantes (ordre : **8.10 → 8.7 modération → 8.8 utilisateurs**). Journal **append-only non
  supprimable** des écritures éditoriales + rôles : table `audit_log` (web/admin, hors PowerSync,
  RLS super_admin en lecture + trigger d'immuabilité), **capture applicative** `logAudit()`
  best-effort (rôles, exos, programmes, aliments + import CSV = 1 entrée), logique pure
  `@wellness/shared/audit.ts` (testée), écran `/audit` super_admin (filtres acteur/action/période).
  Spec : [us/8.10-admin-log-audit.md](docs/specs/functional/us/8.10-admin-log-audit.md) ·
  Plan : [plans/8.10-admin-log-audit.md](docs/plans/8.10-admin-log-audit.md) (9 tâches TDD).
  **Code livré** (subagent-driven, revues spec+qualité par tâche + revue finale *ready to merge*) :
  module `@wellness/shared/audit.ts` (testé), migration `audit_log` (append-only, RLS super_admin,
  trigger immuabilité, **appliquée cloud CLI + db:types**), `data/audit.ts` (`logAudit` best-effort +
  `listAudit`), instrumentation rôles/exos/programmes/aliments, écran `/audit` super_admin (filtres +
  pagination). typecheck/tests(625)/lint/build verts. **✅ Recette validée (Florian, 16/07/2026, back-office web)** :
  chaque type d'action → entrée visible dans `/audit` ; modif/suppr d'entrée refusée (immuabilité) ;
  filtres/pagination OK. **8.7 (modération) → 8.8 (utilisateurs) débloquées.** Point 4
  (publication d'exercice via formulaire d'édition = `exercise.update`) **accepté** — pas de suivi.
- [~] **Modules en cartes-aperçu (onglets Muscu & Course) + mini-calendrier planning** — **code livré**
  (`feature/modules-cartes-apercu`, 18/07/2026 ; demande Damien). Les cartes-module « titre + bouton »
  deviennent des **cartes d'aperçu du contenu**, entièrement tappables (bouton générique retiré) :
  composant réutilisable `ModulePreviewCard` + `PlanningPreview` (mini-calendrier 4 prochains jours,
  pastilles par pilier, hook `useUpcomingSessions`). Muscu : programme actif+durée, planning, 2 dernières
  séances, volume semaine+delta. Course : programme running, planning, dernière course (distance·durée·
  allure). i18n FR/EN. 100 % client, aucune migration ; typecheck/lint verts. **Reste : recette device +
  relecture Damien** (ajuster le rendu si besoin). Spec/design validés en direct avec Damien (hors pipeline
  formel). _NB : le planning de test a été seedé sur le compte Damien pour visualiser l'aperçu peuplé._
- [~] **Panel nutritionnel étendu (AG détaillés + oméga + toutes vitamines/minéraux)** — **code livré
  & revu (*Approved*)** (`feature/panel-nutritionnel-etendu`, 14/07/2026). Prolonge 4.33 (panel étendu
  différé). +21 nutriments (socle 10 → 31) : AG mono/poly/trans + oméga-3/6/9, minéraux (zinc,
  phosphore, cuivre, manganèse, sélénium, iode), vitamines A/E/K/B1/B2/B3/B5/B6/B7 — stockés dans la
  colonne JSON `micronutrients` (**aucune migration**), captés depuis OFF (present-only, garde-fou
  unité vitamine A en IU), affichés dans `MicronutrientDetails`. Vit C/D/B9/B12 déjà gérées (socle).
  **Décisions produit (Florian)** : périmètre **complet**, **pas de 2ᵉ source** (USDA/CIQUAL par nom)
  pour l'instant. Spec+plan : [spec](docs/specs/functional/us/panel-nutritionnel-etendu.md) ·
  [plan](docs/plans/panel-nutritionnel-etendu.md). Exécution subagent-driven + revue de code *Approved*.
  Propagation embrassée : le **formulaire admin** couvre aussi les 31 (+21 libellés admin FR). Garde
  vit A en IU (omise si unité non massique). typecheck/lint/build verts, shared 620 + mobile 42 tests,
  parité i18n 808/808. **Reste** : recette device (aliment riche → 3 groupes ; aliment pauvre →
  inchangé ; vit A IU non affichée) + relecture Damien. **Différé** : objectifs/RDA, regroupement
  visuel admin, agrégats recettes/repas types. **100 % client, pas de checkpoint 🔴.**
- [x] **US — Enrichir la bibliothèque d'aliments avec CIQUAL 2025** — **code livré**
  (`feature/seed-ciqual-enrichment`, 14/07/2026). **Approche A** : bibliothèque reconstruite depuis
  **CIQUAL 2025** (ANSES/Etalab) — **80 aliments** (50 identités conservées + toute la nutrition
  CIQUAL **macros de base incluses** ; **+30 nouveaux** fruits/légumes/viandes/poissons/légumineuses/
  oléagineux), **present-only, ne rien inventer** (oméga = somme des AG ; `trans`/biotine absents de
  CIQUAL ; café non mappé). **Livraison = migration idempotente** `20260714120000_seed_library_foods_ciqual`
  (upsert : réconcilie le cloud + insère les 30) — la biblio **quitte `seed.sql`** (nouvelle règle
  « jamais de SQL manuel »). Tooling reproductible `supabase/scripts/enrich-ciqual/` (générateur +
  `foods-catalog.json` + `mapping-columns.json`, export brut hors git). Spec+plan à jour (révision).
  **Terminée (14/07/2026)** ✅ — migration poussée par CLI (`npm run db:push`, cochée dans
  [MIGRATIONS.md](supabase/MIGRATIONS.md)) + recette device validée par Florian (build debug Pixel 6a).

- [x] **Session persistante & chiffrée** (1.5/9.8) — SecureStore/Keystore — mergé, **testé sur device** (persistance OK après fermeture) (05/07/2026)
- [x] **PowerSync** (9.13/9.3) — SQLite local (op-sqlite) + connecteur Supabase + sync streams — mergé, **« Synchronisé » vert sur device** (05/07/2026)
- [x] **Légal + consentement + âge 16+** (1.21) — CGU/confidentialité (brouillon) + contrôle d'âge — mergé, testé device (05/07/2026)
- [x] **🏷️ Tag v0.1.0** — fin de version V0.1 (05/07/2026)
- [x] **V0.2 — Onboarding skippable** (1.7-1.11) — parcours 5 étapes + store profil — mergé, testé device (05/07/2026)
- [x] **V0.2 — Profil persistant & éditable** (1.12) — persistance SecureStore + profil éditable + accueil perso + relance onboarding — mergé, testé device (05/07/2026)
- [x] **V0.2 — Séance libre (muscu)** — bibliothèque/recherche/favoris/perso (3.13-3.16), séance libre + validation + chrono repos + édition séries (3.23/3.25/3.28/3.30/3.31), résumé (3.35) — mergé (PR #13), testé device (06/07/2026). ⚠️ stores persistés **local Zustand** (dette data adressée par le cadrage ci-dessous).
- [x] **Cadrage — Schéma de données socle & muscu (PowerSync)** — spec [schema-donnees-muscu.md](docs/specs/technical/schema-donnees-muscu.md) + plan [us1-socle-data-muscu.md](docs/plans/us1-socle-data-muscu.md), tous deux revus et **validés**. Découpé en 3 US. (06/07/2026)
- [x] **US1 — Socle data (bascule PowerSync)** — **code mergé dans `dev`** (`248e2b2`, 06/07/2026) : `packages/shared` (schémas Zod + logique, 127 tests), 4 repositories, schéma PowerSync local, migrations+RLS+seed+sync rules, bascule de tous les écrans + gate offline, jest-expo, suppression des stores Zustand (dette soldée). typecheck/lint/test verts, 2 revues + fix offline-first. **Activation cloud + vérif device = section 🔴 en haut.**
- [x] **US2 — Programmes muscu** — **mergée dans `dev`** (`cdf0032`, 06/07/2026) : schémas shared, migrations+RLS+seed+sync rules, `program-repository`, écrans biblio/création/détail/activation + démarrer depuis programme (3.1-3.6, 3.12, 3.24). Revues repo + finale GO. Activation cloud + device = section 🔴. (Planning/progression/notifs → US2b.)
- [x] **US3 — Historique & records** — **mergée dans `dev`** (06/07/2026) : logique records shared (Epley, +39 tests), table `personal_records`+RLS+sync rules, `records-repository` (détection à la clôture), graphes (`react-native-svg`+gifted-charts), écrans historique + progression + records au résumé (3.22/3.38/3.21/3.39/3.40). Revues repo + finale GO. Activation cloud + **dev build svg** + device = section 🔴. (Notif record 3.42 → V0.8.)
- [x] **V0.4 — US4.1 Profil nutritionnel & TDEE** (`feature/4.1-profil-nutritionnel-repo`, 1.10/4.1-4.7) — objectif nutritionnel, facteur d'activité (5 niveaux), TDEE Mifflin-St Jeor, objectif calorique (auto + surcharge manuelle), macros par défaut/manuelles (%↔g), restrictions/allergènes. Calculs purs + `nutritionProfileRowSchema` dans `@wellness/shared` (+28 tests), **table `nutrition_profiles`** (schéma PowerSync + migrations 140000/140001 + RLS + sync rules), `nutrition-repository` (`useQuery`/upsert), écrans + FR/EN. typecheck/lint/test verts. Spec : [us/4.1-profil-nutritionnel.md](docs/specs/functional/us/4.1-profil-nutritionnel.md). **Activation cloud + vérif device faites (Florian, 14/07/2026).** ✅ (4.7 câblage planning muscu = ultérieur.) _(mergée en parallèle par Damien)_
- [x] **V0.4 — US4.8 Base d'aliments & journal** (`feature/4.8-aliments-journal`, 4.8/4.9/4.11-4.14/4.16/4.17/4.19-4.23) — 50 aliments bilingues (seed), recherche + OpenFoodFacts + favoris + aliment perso, journal 4 repas (nav jours, totaux + barres macros temps réel, quick add, portions). `food.ts` (+16 tests), 4 tables PowerSync + migrations `150000/150001` + RLS + sync rules + seed, `food-repository`/`journal-repository`/`lib/openfoodfacts`, écrans + FR/EN. typecheck/lint/test verts. Spec : [us/4.8-aliments-journal.md](docs/specs/functional/us/4.8-aliments-journal.md). **Activation cloud + vérif device faites (Florian, 14/07/2026).** ✅ **Différé** : renommer/ajouter repas (4.15), copier (4.18), recettes (4.24-4.26), poids & stats (1.13/1.14/4.30-4.32), notif (2.5).
- [x] **V0.4 — US4.10 Scan code-barres** (`feature/4.10-scan-code-barres`) — scan EAN/UPC via `expo-camera` → recherche d'abord le code-barres **en local** (évite un doublon d'import), sinon **OpenFoodFacts par code-barres** → panneau quantité (composant `QuantityPanel` extrait, partagé avec le picker) → ajout au journal. Gère la permission caméra + l'état « introuvable » (rescan / créer un aliment), FR/EN. `fetchOpenFoodFactsByBarcode` (`lib/openfoodfacts`) + `findFoodByBarcode` (`food-repository`) + écran `food-scan`. typecheck/lint/test verts. **Reste** : nouveau **dev build** (`expo-camera` natif) + vérif device.
- [x] **V0.4 — US4.24 Recettes, repas types, poids & stats** (`feature/4.24-recettes-poids-stats`, 4.24-4.26/1.13/4.30/4.31) — recettes (ingrédients + portions + valeurs par portion), repas types (enregistrer/réappliquer), poids corporel (pesée/jour + tendance + courbe 4 sem/3 mois/1 an), apports moyens 7/30 j + courbe. `recipe.ts`/`bodyweight.ts` (+tests), 5 tables PowerSync + migrations `130000/130001` + RLS + sync rules, repos + écrans (`recipe-edit`, `nutrition-stats`, food-picker étendu). typecheck/lint/test verts. Spec : [us/4.24-recettes-poids-stats.md](docs/specs/functional/us/4.24-recettes-poids-stats.md). **Activation cloud + vérif device faites (Florian, 14/07/2026).** ✅ **Différé** : rappels (natif), planning (V1.1). _(4.32 stat croisée : en fait livrée en v1 faible sur `nutrition-stats` — voir US 4.32 dédiée en cours qui la migre sur le dashboard.)_
- [x] **V0.6 — US7.4–7.7 Dashboard live (MVP)** (`feature/7.4-7.7-dashboard-live`) — l'accueil placeholder devient un **dashboard branché sur les données locales réelles**, réactif (`useQuery`). Logique `computeStreak` + `localDayKey` (shared, purs, testés) ; hooks `dashboard-repository` (`useNextSession`/`useStreakData`/`useNutritionSummary`) ; 4 widgets (Séance du jour, Résumé nutrition, Régularité/streak, Poids) + `DashboardCard` extrait ; i18n `home.*` FR/EN ; suppression du « arrive bientôt ». Démarrage via `startWorkoutFromSession`. Spec + plan + **maquette** validés (Florian), exécution subagent-driven (revues par phase + revue finale *Approved*), smoke test streak. typecheck/lint/tests verts (362 shared + 29 mobile), parité i18n 535/535, 0 doublon de clé. **Décisions MVP H1–H4** (pas de planning hebdo, jour nutrition = ≥1 repas, pas de repos-neutre, widget Poids si pilier nutrition). **100 % client, sans activation cloud.** **Validé device (11/07/2026)** : 4 widgets branchés sur données réelles, temps réel OK, FR/EN, bascule d'unités widget Poids OK. Différé : personnalisation (7.1-7.3/7.11/7.12), widgets 7.8-7.10.
- [x] **V0.6 — US7.8–7.10 Widgets dashboard (Lot A)** (`feature/7.8-7.10-widgets-dashboard`) — 3 widgets additifs sur l'accueil : **Record récent** (7.8, dernier record battu muscu OU course, gardé par pilier), **Volume muscu semaine** (7.9, réutilise `MuscleVolumeBarChart`, kg), **Résumé running semaine** (7.10, distance + séances vs `weeklyFrequency`). Hook composite `useMostRecentRecord` (`dashboard-repository`) **respectant les piliers actifs** (sources muscu/running filtrées sur les résultats, hooks inconditionnels). i18n `home.record.*`/`home.volumeWeek.*`/`home.runningWeek.*` FR/EN à parité. typecheck/lint/tests verts (507 shared). **100 % client — aucune migration/cloud/dépendance native, pas de checkpoint 🔴.** Différé : objectif de distance hebdo (colonne dédiée), personnalisation dashboard (Lot B). **Vérif device faite (Florian, 14/07/2026).** ✅
- [x] **V0.6 — US7.1/7.2/7.3/7.11/7.12 Personnalisation dashboard (Lot B)** (`feature/dashboard-personnalisation`) — **mode édition** de l'accueil : **réorganiser par drag & drop** (7.2), **masquer/afficher** (7.3, œil sur **tous** les widgets, streak compris — masquabilité uniforme), **taille** compacte/normale (7.11, variante « une ligne » des 7 widgets via `DashboardCardCompact`), **persistance** locale + cloud (7.12) via la colonne existante `user_settings.dashboard_layout`. Logique pure `@wellness/shared/dashboard.ts` (registre + `resolveDashboardLayout` forward-compat/filtre piliers/tri + `moveWidget` + `parseDashboardLayout`, **25 tests**) ; `dashboard-layout-repository` (`useDashboardLayout` + mutateurs `updateSettings`, débounce ~400 ms sur le drag) ; `SortableDashboard` (gesture-handler `Pan` + reanimated, scroll neutralisé pendant le drag), `GestureHandlerRootView` posé à la racine. i18n `home.customize.*` FR/EN 65/65. typecheck/lint verts, 532 tests. **100 % client — aucune migration/cloud/dépendance native (reanimated/gesture-handler déjà présents), pas de checkpoint 🔴.** Spec+plan+maquette : [us/7.1-7.3-7.11-7.12-dashboard-personnalisation.md](docs/specs/functional/us/7.1-7.3-7.11-7.12-dashboard-personnalisation.md). **Vérif device du drag & drop faite (Florian, 14/07/2026).** ✅ **Différé** : auto-scroll près des bords pendant le drag (spec §8).
- [x] **V0.6 — US2.6/2.8/1.17 Notifications locales** (`feature/notifications-v0.6`) — rappel local **série en danger** (2.6, planifié aujourd'hui à l'heure choisie si aucune activité, annulé dès qu'actif), **Ne pas déranger** (2.8, fenêtre configurable défaut 22→7 pouvant enjamber minuit + max/jour défaut 3), **gestion par type** depuis les Réglages (1.17). Logique pure `@wellness/shared/notifications.ts` (`NotificationPrefs` + `defaultNotificationPrefs` + `parseNotificationPrefs` tolérant + `isWithinDnd` + `shouldScheduleStreakReminder` + `canScheduleMore`, testée) ; colonne `user_settings.notifications` enrichie (`z.record`→schéma typé) **sans migration** ; wrapper natif `lib/notifications.ts` (**expo-notifications SDK 57** : permission + canal Android `reminders` + trigger `DATE` avec id stable idempotent, permission refusée = no-op) ; `notification-repository` (`useNotificationPrefs`/`updateNotificationPrefs`/`useStreakReminderScheduler` réagissant à `activeToday`+prefs+`AppState`) ; section Réglages (Switches + `HourStepper` **pur JS** 0-23) + bandeau permission refusée ; init/scheduler monté dans `_layout`. i18n FR/EN à parité. typecheck/lint/tests verts (595 shared). **Une seule dépendance native (`expo-notifications`), aucune migration, pas de checkpoint 🔴.** Spec+plan+maquette : [us/2.6-2.8-1.17-notifications.md](docs/specs/functional/us/2.6-2.8-1.17-notifications.md). **Nouveau build + recette device faits (Florian, 14/07/2026)** ✅ (permission, rappel, DND, toggles). **Différé** : push distantes, types additionnels (rappel repas/suggestion séance), job d'arrière-plan garanti, iOS, exposition UI du `maxPerDay`.
- [x] **V0.4 — US4.34 + 4.35 Détail d'entrée & suivi micros** (`feature/nutrition-detail-suivi-micros`) — **4.34** : taper une entrée du journal ouvre un **modal détail** (macros + micros de la quantité, `MicronutrientDetails` + prop `showPer100`) ; appui long = suppression conservée. **4.35** : sélection de micros suivis (chips au profil, store **Zustand** persisté local device) → **totaux du jour** sous P/G/L dans le récap (`sumMicronutrients`, sel dérivé si sodium). **🐛 Fix** : `parseMicronutrients` tolérant au **double encodage JSON** (PowerSync/op-sqlite double-encode les colonnes texte-JSON écrites côté client — cause racine trouvée en interrogeant la base SQLite du device ; répare aussi les micros des aliments OFF). +1 test. i18n 616/616, typecheck/lint/test verts (401). **Validé device (Pixel, adb)**. Spec+plan : [us/4.34-4.35-nutrition-detail-suivi-micros.md](docs/specs/functional/us/4.34-4.35-nutrition-detail-suivi-micros.md). **100 % client — pas de checkpoint 🔴.** **⚠️ À traiter globalement** : le double encodage touche toutes les colonnes texte-JSON client (`active_pillars`, `portions`…) — helper de parse tolérant partagé à généraliser (lot dédié).
- [x] **V0.4 — US4.7 + 4.18 Finitions nutrition** (`feature/nutrition-finitions-4.7-4.18`) — branche deux fonctions déjà écrites mais inaccessibles. **4.7 calories jour de séance** : hook `useIsTrainingDay(dayKey)` (muscu OU course terminée ce jour, composé de `useWorkoutHistory`/`useRunHistory`, détection **rétroactive**) → objectif effectif = `trainingDayCalories(base, bonus)` dans le journal + widget dashboard, **badge** « +X kcal · jour de séance », réglage du bonus ajouté au profil nutritionnel (0 = désactivé). **4.18 copier une journée** : bouton « Copier toute la journée d'hier » (`duplicateDay`) sur jour vide, distinct du copier-repas. i18n FR/EN 612/612. typecheck/lint/test verts (400). Spec+plan : [us/4.7-4.18-nutrition-finitions.md](docs/specs/functional/us/4.7-4.18-nutrition-finitions.md). **100 % client — pas de checkpoint 🔴 cloud.** **Recette device faite (Florian, 14/07/2026).** ✅ **Assumé MVP** : macros non ventilées par le bonus ; objectif rétroactif (anticipé quand planning muscu US2b existera). _Design écarté (UI mineure, précédent 1.15)._
- [x] **US4.7b — Détection anticipée des jours d'entraînement** (`feature/nutrition-4.7-anticipee`) — complète US4.7 : un jour avec une séance **planifiée** (`planned_sessions`, statut `planned`/`done`) compte comme jour d'entraînement **par anticipation** (aujourd'hui + futur), déclenchant le bonus calorique nutrition. Le passé reste rétroactif uniquement. Helper pur `isTrainingDay(i)` dans `@wellness/shared` (TDD, 6 tests, frontière `dayKey===todayKey` couverte) ; hook `useHasPlannedSession(dayKey)` dans `planned-session-repository` (owner-scopé, réactif) ; composition dans `useIsTrainingDay` (aliasé `computeIsTrainingDay`). Streak inchangé. **Aucune migration, aucun cloud.** typecheck/lint/test verts. Spec+plan : [us/4.7b-nutrition-jour-entrainement-anticipe.md](docs/specs/functional/us/4.7b-nutrition-jour-entrainement-anticipe.md).
- [x] **V0.4 — Nutrition : édition d'entrée + 8 durcissements** (`feature/journal-modifier-supprimer-entree`) — (a) **US4.34** : éditer la quantité (aperçu live, `rescaleEntryNutrition`) / supprimer une entrée depuis le détail du journal. (b) **8 correctifs** issus de l'analyse des manques : **#1** éditer/supprimer un aliment (`updateFood`/`deleteFood`, food-custom en mode édition, appui long sur le picker) ; **#2** dédup OFF sur la recherche texte (`findFoodByBarcode` avant import) ; **#3** recherche insensible aux accents/ligatures (`search.ts`, filtrage JS) ; **#4** fibres/sucres/AG saturés branchés (saisie + stockage + aperçu `QuantityPanel`) ; **#5** onglet Récents (`useRecentFoods`) + multi-ajout ; **#6** réordonnancement (`moveEntry`) + horodatage du détail ; **#7** `rescaleEntryNutrition` extrait/testé dans shared ; **#8** `parseJsonColumn` partagé tolérant au double-encodage (généralise le contournement micros à `active_pillars`/`meals`/`portions` — **résout la dette « lot dédié » de l'US4.34**). +16 tests shared (467), i18n 708/708, typecheck/lint verts. Recette device Pixel 6a : #3/#5/#6 confirmés. **100 % client.** **Différé (checkpoint 🔴)** : suivi de l'eau (table `water_logs`) et snapshot fibres/sucres/AGS par entrée (`food_entries`) — migration cloud requise. ~~Reste : 2 erreurs typecheck `running-history`~~ → **corrigées le 13/07/2026** (`fix/finitions-affichage-profils`).
- [x] **V0.4 — US4.33 Micronutriments (socle)** (`feature/4.33-micronutriments`) — enrichit la base d'aliments et le journal d'un **panel de 10 micronutriments** (cholestérol, sodium+sel dérivé, magnésium, potassium, calcium, fer, vitamines C/D/B9/B12) stocké en **colonne JSON `micronutrients`** (pour 100 g sur `foods`, **snapshot** figé pour la quantité sur `food_entries`). `food.ts` (+18 tests : schéma strict, `parseMicronutrients` tolérant, `scaleMicronutrients`/`sumMicronutrients`/`saltFromSodiumMg`), migration `20260711140000` (jsonb default `{}`, additif/rétrocompatible), mapping **OpenFoodFacts** avec normalisation d'unité (`mapOffMicronutrients`, +3 tests), repos food/journal, composant **`MicronutrientDetails`** (accordéon « Valeurs détaillées », sel dérivé, état vide) dans `QuantityPanel` + bloc facultatif dans l'aliment perso, i18n FR/EN (520/520). Spec/plan/maquette (Claude Design) inclus. typecheck/lint/test verts. **Activation cloud faite** (migration + re-seed + `database.types.ts` régénéré, 11/07). **Vérif device faite** (Pixel, adb) : affichage enrichi + mise à l'échelle (banane 120 g : Mg 27→32, K 358→430, Fe 0,3, sel dérivé 0,00 g), **seuls les nutriments présents** affichés (D/B12 masqués), **snapshot** journal, **état vide** (Sucre), écran aliment perso (bloc facultatif). **Unité OFF confirmée** (11/07, `api/v2` Nutella : `sodium_100g` 0,0428 g → 42,8 mg, recoupé au sel 0,107 g) : le `×1000`/`×1e6` (g→mg/µg) est juste ; sodium 0 → omis. NB : la **recherche texte OFF** (`search.pl`) renvoie 503 côté OFF (panne d'infra) → app dégrade en « Aucun résultat » ; le **scan** (`api/v2`) est le chemin fiable. **Reste** : (b) EN à l'écran (pas de toggle in-app, suit la locale système — parité 520/520 OK) ; (c) offline/sync 2 appareils. **Points d'attention** : seed enrichi de **7 aliments** seulement (compléter d'après l'export CIQUAL réel, ne pas inventer). **Différé** : agrégat micros du jour, objectifs/RDA, micros recettes/repas types, panel étendu.
- [x] **Session test device + correctifs (07/07/2026)** — app lancée sur **Pixel 6a** (USB) et passe de
  tests. Correctifs mergés dans `dev` : **résolution `@wellness/shared` sous Windows/Metro** (junction npm →
  `resolver.extraNodeModules`, PR #24) · **sync du journal** (`order_index: Date.now()` dépassait l'`integer`
  Postgres → `MAX(order_index)+1`, PR #25) · **bouton « Enregistrer »** qui wrappait (PR #26) · **nom d'app**
  dans les permissions localisation (SparkWine → Wellness, PR #29). Journal nutrition **vérifié device**
  (ajout aliment + upload sync OK). Constat : le **dashboard d'accueil est un placeholder statique** (3 cartes
  non branchées) → spec US « Dashboard live » V0.6 rédigée
  ([us/7.4-7.7-dashboard-live.md](docs/specs/functional/us/7.4-7.7-dashboard-live.md)) → **implémentée le 11/07/2026** (voir entrée US7.4–7.7 ci-dessus ; la spec a été reprise à jour sur une branche depuis `dev`, l'ancienne PR #27 étant obsolète).
- [x] **US 1.15 transverse — Affichage & saisie des unités (métrique/impérial)** — **livrée & validée device (11/07/2026)** : câbler
  `useSettings().units` sur **tout l'affichage ET toute la saisie** des grandeurs (poids charges +
  corporel, distance, allure, taille), stockage toujours SI. Dette pré-existante (`displayWeight`
  existait mais n'était lu nulle part → tout s'affichait en kg/km).
  - [x] **Spec** ([us/1.15-unites-metrique-imperial.md](docs/specs/functional/us/1.15-unites-metrique-imperial.md)) — commit `c2c0e84`, revue *Approved*.
  - [x] **Plan** ([1.15-unites-metrique-imperial.md](docs/plans/1.15-unites-metrique-imperial.md)) — 14 tâches TDD, revue *Approved*.
  - [x] **Design/maquette** — écartée (option 2 : changement d'UI mineur), validé Florian 09/07/2026.
  - [x] **Code** — 16 commits (`0d1df62`→`379a7cc`), subagent-driven : shared (ft/in, allure, parseurs) + hook `useUnits()` + smoke test + branchement de tous les écrans/composants (affichage + saisie) + i18n FR/EN (miroir) + anti-dérive. Garde-fou grep vert, typecheck/lint/test verts (343 shared + 23 mobile), parité FR/EN 495/495. Revues par phase + revue finale (1 bloquant corrigé : collision clé `workout.set`).
  - [x] **Recette device (11/07/2026)** — build preview `87de89b5`, testé Pixel 6a : bascule metric↔imperial (Réglages → Unités) OK sur les surfaces §1, taille en ft/in OK, saisie round-trip OK.
  - _Décision produit actée : unités = **réglage in-app**, défaut **métrique**, **non dérivées de la région OS** (découplage confirmé). Le changement de région du téléphone n'influe volontairement pas ; l'utilisateur choisit dans Réglages._
  - _US 100 % client : validée sans activation cloud (pas de checkpoint 🔴)._

### V0.5 — Running (spec [running-r1-tracker-gps.md](docs/specs/technical/running-r1-tracker-gps.md), découpage R1-R4)
- [x] **Running R1 — Tracker GPS nu (course libre)** — **mergé dans `dev`** (06/07/2026) : calculs GPS shared (+45 tests) + encodage trace append-friendly, table `runs`+RLS+stream, `run-repository` (flush sérialisé), tracking `expo-location`+task-manager+foreground service, écrans démarrage/suivi/résumé (5.12-5.16, 5.20-5.22, 5.24-5.26). Revues repo + finale GO. **Activation cloud + dev build + VALIDATION TERRAIN = section 🔴.**
- [x] **Running R2 — Carte** (5.17/5.27) — **livrée & validée device (11/07/2026)** (`feature/running-r2-carte`, MapLibre + MapTiler, [ADR-006](docs/adr/ADR-006-cartographie.md)). `simplifyTrack` (Douglas-Peucker, shared, testé) + `RouteMap` réutilisable (live `follow` / résumé fit-bounds) + `RunDetail.gpsTrack` + branchement `active`/`summary` + i18n FR/EN. Cadrage complet (spec→plan→maquette), revues par phase + finale. Clé MapTiler en EAS env (preview+prod, hors git). **Validé sur Pixel** : carte live tracé+caméra, résumé fit-bounds, tuiles outdoor, états vides. Différé : tuiles offline, sélecteur de style, export GPX (R4).
- [x] **Running R3 — Profil coureur + programmes** (5.1-5.11) — **découpé en R3a/R3b/R3c** :
  - [x] **R3a — Profil coureur + types de séance** (5.1, 5.8-5.11) — **code livré & revu** (`feature/running-r3a-profil-types`). `running-paces` (VMA dérivée + plages d'allure, testé) + parse allure M:SS ; table **`running_profiles`** (migration `20260712090000` + RLS + sync rules + schéma PowerSync) ; `running-profile-repository` ; écran profil + « Mes allures » + route + entrée Réglages ; i18n FR/EN. Cadrage complet, revues par phase + finale (*Approved*). typecheck/lint/tests verts. **Migration cloud + sync rules + `db:types` + vérif device faits (Florian, 14/07/2026).** ✅ _Récup +90-120 : plafond d'affichage à confirmer produit._
  - [x] **R3b — Programmes de course** — **découpé en R3b-i / R3b-ii** :
    - [x] **R3b-i — Programme custom** (5.4) — **code livré & revu** (`feature/running-r3b1-programme-custom`). Réutilise l'infra programmes muscu (pilier-aware) ; contenu de séance running (type + cible) ajouté à `sessions` (migration `20260712100000`) ; repo (`updateRunningSession`/`updateProgram`/`updateProgramTranslation`/duplicate étendu) ; écrans `running-programs` (liste/détail/éditeur) + allure dérivée R3a. Blocs d'intervalles différés. Cadrage + revues (par phase + finale *Approved*). typecheck/lint/tests verts, muscu non régressé. **Migration cloud + `db:types` + vérif device faits (Florian, 14/07/2026).** ✅
    - [x] **R3b-ii — Bibliothèque + filtres + seed** (5.2, 5.3) — **code livré & revu** (`feature/running-r3b2-bibliotheque`). Filtre pilier sur `useProgramLibrary` (champ `filters.pillar`, appelants muscu intacts) + `duplicateProgram` copie non active confirmée ; **seed** 3 programmes starter bilingues FR+EN (préfixe UUID `e…`, idempotent, séances `session_type`+cible conformes à la check R3b-i) ; **onglet « Bibliothèque »** (parcours + filtres objectif/niveau/durée + « Utiliser » → duplication → détail copie) ; i18n `running.library.*` FR/EN. Cadrage complet, revues spec (*conforme*) + qualité (*Approved*). typecheck/lint/tests verts (400 shared + 29 mobile), parité 617/617, muscu non régressé. _Micro-écart : résumé non affiché sur carte (comme muscu) — à arbitrer produit._ **Seed cloud + vérif device faits (Florian, 14/07/2026)** ✅ (sync `shared_content`).
  - [x] **R3c — Planning + coordination muscu/running + séance manquée** (5.5, 5.6, 5.7) — **découpé en R3c-i / (5.6 différée)** :
    - [x] **R3c-i — Planning daté + séance manquée** (5.5, 5.7) — **code livré & revu** (`feature/running-r3c1-planning`). Première **couche de planification datée** : table générique **`planned_sessions`** (migration `20260712110000` + RLS `owner_id` + sync rule `user_data` + schéma PowerSync) ; logique partagée testée (`generatePlannedSessions` semaine type 0=lundi + `isMissed` + helpers `date.ts`, validation Zod) ; `planned-session-repository` (`planRunningProgram` transactionnel idempotent + activation inlinée, `useWeekPlan`, `useMissedSessions`, reporter/sauter/fait ; `txInsert` extrait dans `_sql`) ; écrans **assistant Planifier** (durée + date de début + semaine type) + **vue semaine 7 jours** (allures via profil R3a, séances manquées, actions) ; i18n `running.planning.*` + `common.weekday.*`. Sélection de date en **JS pur** (pas de dépendance native). Cadrage complet (spec→plan→maquette), revues par phase (spec+qualité) + finale (*Ready to merge*). typecheck/lint/tests verts (shared 423 + mobile 29), parité 659/659, muscu non régressé. **Migration cloud + sync rule + `db:types` + vérif device faits (Florian, 14/07/2026).** ✅
    - [x] **5.6 — Coordination muscu ↔ running** (alerte 2 séances le même jour) — **livrée avec US 3.9** : indicateur « N séances » sur le calendrier unifié quand ≥ 2 séances (planned+done) le même jour (non bloquant). _(Coordination avancée charge/récup toujours différée.)_
- [~] **Running R4 — Historique, stats, records d'allure, export GPX** (5.28-5.33) — **découpé R4a / R4b / (GPX + dénivelé différés)** :
  - [x] **R4a — Historique + stats + courbe d'allure** (5.28, 5.29, 6.1) — **code livré & revu, intégré `dev`** (`feature/running-r4a-historique-stats`). Écran « Historique & progression » : stats (semaine/mois/début), courbe d'allure globale 30/90 j + tendance, liste chronologique → détail. Logique partagée testée (`run-stats.ts`, +`formatDurationHms`) + hooks lecture (`useRunStats`/`usePaceTrend`, `useRunHistory` inchangé). Lecture seule : **aucune migration, aucun rebuild**. Cadrage complet, revues par phase (spec+qualité) + finale (*Ready to merge*). typecheck/lint/tests verts (shared 436 + mobile 29), parité 678/678. _Pas de checkpoint 🔴 (lecture seule)._
  - [x] **R4b — Records d'allure (segment glissant) + maj auto allure de réf** (5.30, 5.31) — **code livré & revu, intégré `dev`** (`feature/running-r4b-records`). Table **`running_pace_records`** (migration `20260712120000` + RLS + sync `user_data` + schéma PowerSync) ; logique partagée testée (`pace-records.ts` : meilleur segment glissant + interpolation + filtre outliers, 9 tests) ; `running-record-repository` (`useRunningRecords`, `detectAndStoreRunRecords` idempotent GPS-only + maj ref 5 km, `backfillRunningRecords`) ; **section « Records »** dans l'Historique + **célébration in-app** (bandeau animé charte, aucun module natif). Notification poussée différée. Cadrage complet, revues par phase (spec+qualité) + finale (*Ready to merge*). typecheck/lint/tests verts (shared 445 + mobile 29), parité 688/688, muscu non régressé. **Migration cloud + `db:types` + sync rule appliqués (14/07/2026).** ⏳ **Vérif terrain prévue le 15/07/2026 (marche, Florian)** — records d'allure + célébration à valider sur le terrain.
  - [x] **Fix — précision GPS & records d'allure (marche/course lente)** — **code livré** (`fix/running-gps-precision-records`). Bug device : marche 1,01 km sans record 1 km + point (0,0) sur la carte. Diagnostic [fix-running-gps-precision-records.md](docs/specs/technical/fix-running-gps-precision-records.md). 3 volets : **(C, dominant)** encodage trace `1e-5→1e-6` avec **marqueur de version par segment** (compat ascendante, décode l'ancien 1e-5 et le nouveau 1e-6, aucune migration DB) ; **(A)** helper pur `isValidFix` + filtre ingestion (null island (0,0), hors bornes, `accuracy>50 m`) ; **(B)** auto-pause dé-sensibilisée (seuil `0,5→0,3 m/s` **+** vitesse lissée `smoothedSpeedMs` sur fenêtre 10 s). Test de repro rouge→vert + tests unitaires. typecheck/lint/tests verts (shared 478 + mobile 29). `distance_m` d'affichage inchangé (cumul live). **Rebuild preview + vérif device faits (Florian, 14/07/2026)** ✅ (badge 1 km OK, plus de point (0,0)). Reste : PR à relire.
  - [x] **Export GPX** (5.33) — **code livré** (`feature/5.33-export-gpx`). Bouton « Exporter (GPX) » sous la carte du résumé (course GPS terminée, ≥ 2 points valides) → GPX 1.1 sans altitude → feuille de partage OS. Logique pure testée (`buildGpx`, `gpxFileName`, `isValidCoord` extrait d'`isValidFix` sans régression) ; couche native `lib/gpx-export.ts` (API legacy `expo-file-system`, nom cache fixe) ; i18n FR/EN. 100 % local. typecheck/lint/tests verts (shared 506 + mobile 33). **Nouveau build + recette device faits (Florian, 14/07/2026)** ✅ : GPX exporté puis **ré-importé dans Garmin Connect**. _Export seul assumé — pas d'import GPX dans l'app Wellness (non spécifié/non prévu)._
  - [ ] **Dénivelé cumulé** (5.32) — **différé** : aucune altitude captée (`GpsPoint = {lat,lng,t}`) ; nécessite de modifier le tracker (R1) + étendre `GpsPoint`/le codec + un build.
  - [ ] **Découpage par type de séance** (stats/courbe par type) — différé : les courses libres n'ont pas de `session_type`.

---

## ⏭️ À faire prochainement (avant / début V0.1)

### Décisions bloquantes à trancher
- [x] Confirmer **PowerSync** via le spike ([spike-001](docs/specs/technical/spike-001-powersync.md)) — ✅ **validé le 05/07/2026** (voir [ADR-001](docs/adr/ADR-001-moteur-sync-offline.md)), débloque le modèle de données
- [x] Trancher **Mapbox vs MapLibre** (fournisseur de cartes, running V0.5) — ✅ **MapLibre acté** ([ADR-006](docs/adr/ADR-006-cartographie.md), livré & validé device en R2)
- 🚫 **BLOQUÉ — Média des exercices (images / GIF)** _(décision produit à trancher, 13/07/2026)_ : on n'a
  **ni images ni GIF** pour les exercices, et la **stratégie n'est pas décidée** — (a) **source** du média
  (exercises-dataset vs ExerciseDB vs médias maison), (b) **licence/droits**, (c) **stockage** (Supabase
  Storage vs CDN externe), (d) **upload/attribution** côté admin. **Bloque l'US 8.3** (upload média admin) et
  l'affichage média dans la biblio mobile (`exercises.media_url` reste vide en attendant). → **décision produit
  + technique à prendre (Florian et/ou Damien) avant de démarrer 8.3.** _(Remplace l'ancienne ligne « Source des GIF —
  exercises-dataset vs ExerciseDB ».)_
- [x] Source de la **base d'aliments** — ✅ **CIQUAL (bruts FR, + traduction EN) + OpenFoodFacts (industriels via scan)**, tranché le 06/07/2026 — débloque les US base d'aliments / journal (4.8+)
- ⏳ **REPORTÉ — US 8.7 Modération des aliments signalés** _(décision Florian, 16/07/2026)_ : le produit est
  **privé par utilisateur** (RLS `foods_select` = `owner_id IS NULL OR owner_id = auth.uid()` →
  [20260706150001_food_rls.sql](supabase/migrations/20260706150001_food_rls.sql)) — les aliments
  créés par un utilisateur **ne sont visibles que par lui**, et **aucun mécanisme de signalement**
  (table `food_reports` + geste mobile) n'existe. La file de modération n'aurait donc **rien à
  traiter**. Reprise conditionnée à un choix produit : (a) signalement des aliments **éditoriaux**
  (bibliothèque CIQUAL/OFF), ou (b) **modèle communautaire** d'aliments partagés (gros périmètre, hors
  cadre actuel). ⚠️ Le bandeau 8.10 mentionnait « 8.7 → 8.8 débloquées » : **8.8 reste disponible**,
  8.7 est mise en attente.

### Scaffolding (fondations, à poser avant tout code fonctionnel)
- [x] Initialiser le **monorepo** (`apps/mobile`, `apps/admin`, `packages/shared`) — npm workspaces (05/07/2026)
- [x] Créer l'**app Expo** (React Native + TypeScript + Expo Router + Zustand) — SDK 57, Metro monorepo (05/07/2026)
- [x] Poser l'infra **i18n** (i18next + expo-localization, FR + EN, aucune chaîne en dur) (05/07/2026)
- [x] Renseigner la section **Commandes** de [CLAUDE.md](CLAUDE.md) (05/07/2026)
- [x] Câbler un **runner de tests** — Vitest sur `packages/shared` (couverture 100 %) + `npm run test` (05/07/2026)
- [x] **Dev build Expo** (EAS) — profils `eas.json`, `eas init`, **1er build `build:dev` réussi** (APK dev client) (05/07/2026)
- [~] **Socle Supabase local** — `supabase/` (config, migration conventions, seed), client typé mobile + `.env.example`, scripts `db:*`. Reste : `db:start` (Docker) + provisioning cloud + schéma métier (avec les US)
- [x] Câbler les **tests mobile** (jest-expo) — fait avec l'US1 (mocks PowerSync + smoke) (06/07/2026)
- [x] Provisionner **Supabase cloud** (projet) + instance **PowerSync** — provisionné (confirmé 06/07/2026). Reste : pousser tables + RLS + sync rules (US1)
- [~] Intégrer **PowerSync** dans l'app (SQLite local, sync rules, repository) — plomberie posée (schéma jouet `todos`, connecteur générique) ; vrai schéma métier = US1
- [x] **US 8.1a — Admin Fondation-1** (`apps/admin`) : scaffold Vite+React+TS + auth Supabase (login/session/logout) + shell protégé (RequireAuth + layout + placeholder), libellés FR centralisés, `@wellness/shared` réutilisé. Build OK, racine typecheck/lint verts. 100 % client web, aucune migration/cloud. Gate par rôle = F2 (13/07/2026)
- [x] **US 8.4 — Admin constructeur de programmes** (`apps/admin`) : builder éditorial *pillar-aware* (muscu = séances→exos avec séries/reps/charge/repos ; running = cibles type/distance/durée), bilingue FR/EN, brouillon/publié, réorganisation glisser-déposer (@dnd-kit), archivage cascade. Migration RLS d'écriture éditoriale (`is_content_editor`, 4 tables), couche data `programs.ts`, composants `SortableList`/`ExercisePicker`, écrans liste/création/composition, routing gated. Impl. + 3 revues (data layer, écran compo, finale) ✅, typecheck/lint/build verts, mobile inchangé. **Migration (projet `nsxzflxsgovriwwvflxe`) + `db:types` + recette web faits (Florian, 14/07/2026).** ✅ (aucune sync rule à redéployer).
- [~] **US 8.6 — Import aliments CSV (CIQUAL)** (`feature/8.6-import-csv-ciqual`, 13/07/2026) — **code livré**. Cadrage complet (spec+plan). `@wellness/shared/food-csv.ts` (`parseFoodCsv` pur, 8 tests TDD) ; migration `foods.import_key` + index unique (**checkpoint appliqué** : migration cloud + `db:types` faits) ; admin : écran Import CSV (upload→papaparse→aperçu→confirmation→rapport + modèle CSV), `data/foods.ts` (upsert idempotent `foods`+`food_translations` FR/EN), route `/foods` + nav « Aliments » gated `content_editor`, `papaparse`. Contrat : `import_key`/`name_fr`/`name_en`/`category`/`kcal` requis + macros/10 micros optionnels. typecheck/lint/tests verts (shared 610), build admin OK. Spec/plan : [8.6-import-csv-ciqual.md](docs/specs/functional/us/8.6-import-csv-ciqual.md). **Recette de base OK (13/07/2026)** : import du fichier d'exemple (1 ligne) → chemin complet parse→aperçu→upsert→rapport + RLS validé (après application de la migration RLS 8.5). **Reste** : import d'un vrai lot CIQUAL + ré-import idempotent + relecture Damien. **Différé** : rollback, import mobile.
- [~] **US 8.5 — Gestion base d'aliments (admin)** (`feature/8.5-gestion-aliments`, 13/07/2026) — **code livré**. Cadrage complet (spec+plan). CRUD éditorial : lister/rechercher/filtrer, **créer**, **éditer** (macros + 10 micros), **archiver** (soft-delete). `@wellness/shared/food-form.ts` (`validateFoodInput` pur, 9 tests TDD) ; `data/foods.ts` étendu (list/get/save insert-ou-update-ciblé/archive) ; écrans `FoodsScreen` (liste = hub) + `FoodEditScreen` (formulaire) ; **routing « Aliments » réorganisé** (`/foods` liste, `/foods/import` = 8.6 déplacé, `/foods/new`, `/foods/:id`) ; i18n admin FR. typecheck/lint/build verts, shared 619 tests. 100 % client admin, pas de dépendance native. Spec/plan : [8.5-gestion-aliments.md](docs/specs/functional/us/8.5-gestion-aliments.md). **Migration RLS `20260713160000` appliquée + recette OK (Florian, 13/07/2026)** : créer/éditer/archiver validés (débloque aussi 8.6). **Reste** : relecture Damien. **Différé** : signalements (8.7), restauration, édition `portions`, audit (8.10).

### Modèle de données & bascule PowerSync — pilier muscu (spec [schema-donnees-muscu.md](docs/specs/technical/schema-donnees-muscu.md))
- [x] **US1 — Socle data** — mergée dans `dev` (`248e2b2`, 06/07/2026). Activation cloud + device = section 🔴 en haut.
- [x] **US2 — Programmes muscu** — mergée dans `dev` (`cdf0032`, 06/07/2026).
- [x] **US3 — Historique & records** — mergée dans `dev` (06/07/2026). **Pilier muscu (V0.2+V0.3) complet côté code.**

---

## 📋 Backlog par version

Voir [docs/roadmap/roadmap.md](docs/roadmap/roadmap.md). Ordre de build :
**V0.1** socle & compte → **V0.2/V0.3** muscu → **V0.4** alimentation → **V0.5** running →
**V0.6** dashboard & sync cloud → **V0.7** admin → **V0.8** bêta → **V1.0** lancement → **V1.1** post-lancement.

Les US remontent ici (dans « À faire prochainement » puis « En cours ») dès qu'elles
démarrent leur cycle spec → plan → design → validation → code.

---

## ✅ Fait

- [x] Phase de cadrage : fusion des cadrages Florian + Damien, arbitrages A→H, roadmap versionnée (04/07/2026)
- [x] Process de travail : workflow spec→plan→design→validation→code, branches, `/commit` (revue + CHANGELOG + push `dev`) (05/07/2026)
- [x] Fichiers de config dépôt : `.gitignore` + `.gitattributes` (normalisation LF) (05/07/2026)
- [x] Bundle design FitTrio (handoff Claude Design) importé dans `design/` (05/07/2026)
- [x] Scaffolding monorepo : npm workspaces + Expo (SDK 57, Router, Zustand, i18n FR/EN) + `packages/shared` (Zod) + stub `apps/admin` — typecheck ✅, bundle web ✅ (05/07/2026)
- [x] Runner de tests : Vitest sur `packages/shared`, 15 tests, couverture **100 %** (05/07/2026)
- [x] **V0.1 — Shell de navigation** : onglets + masquage piliers (2.1/2.2), thème (1.16), états vides (2.10), i18n FR/EN — mergé, **testé sur device** (05/07/2026)
- [x] **V0.1 — Polices custom** : Bricolage / Hanken / Space Mono d'après la maquette — mergé, testé sur device (05/07/2026)
- [x] **V0.1 — Unités (1.15) + blocs dashboard** : métrique/impérial (conversions 100 %) + accueil étoffé — mergé, testé sur device (05/07/2026)
- [x] **Écrans piliers** : en-tête structuré (`ScreenHeader`) + tagline — mergé (05/07/2026)
- [x] **V0.1 — Auth Supabase** (1.1/1.4/1.5/1.6/9.5) : inscription, connexion, session, reset, déconnexion — mergé, testé sur device (05/07/2026)
- [x] ESLint mobile (eslint-config-expo, flat config) + config EAS (`eas.json`) + `eas init` (05/07/2026)
- [x] CI GitHub Actions : typecheck + lint + tests sur chaque PR `dev`/`main` (05/07/2026)
- [x] **Suppression de programmes & de séances** (`feature/suppression-programmes-seances`, 13/07/2026) — supprimer un programme (muscu **isOwned only** + course) et une séance depuis l'app. **Durcissement data** : `deleteProgram` = `writeTransaction` (is_active=0 si actif **puis** soft-delete, ordre impératif) + cascade `planned_sessions` owner-scopée par `program_id` + cascade existante préservée ; `removeSession` = cascade `planned_sessions` par `session_id`. Variante **`Button` destructive** (couleur `danger`). UI : bouton destructif + confirmation `Alert` (loading, retour liste, erreur non bloquante) sur les 2 écrans détail ; confirmation ajoutée à la suppression de séance (2 éditeurs). i18n FR/EN à parité (12 nouvelles clés). typecheck/lint/tests verts (595 shared). **100 % client — soft delete, aucune migration, aucune dépendance native, pas de checkpoint 🔴.** Spec+plan : [us/suppression-programmes-seances.md](docs/specs/functional/us/suppression-programmes-seances.md). **Vérif device faite (Florian, 14/07/2026).** ✅
