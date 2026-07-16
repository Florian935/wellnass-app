# Changelog

Toutes les modifications notables du projet sont consignées ici — **maintenu automatiquement
par la commande [`/commit`](.claude/commands/commit.md)**. Chaque entrée est construite à partir
de l'analyse du `git diff` du commit, pour garder une **trace complète** des modifications
(utile aux devs et au débogage).

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/). Dates au format **JJ/MM/AAAA**.
Catégories : **Ajouté** · **Modifié** · **Corrigé** · **Supprimé** · **Technique / Notes**.

<!-- Nouvelles entrées ajoutées ICI (ordre anté-chronologique, la plus récente en haut) -->

### 16/07/2026 — `feature/mr06-temps-entrainement` — widget « Temps d'entraînement » (MR-06, inter-piliers)

**Ajouté** (analyse MR-06 du catalogue, Phase A, 1ʳᵉ stat **inter-piliers** en temps)
- Widget dashboard **`training-time`** : temps total d'entraînement (muscu + course) de la **semaine
  ISO courante** (lundi→dimanche, borné `finished_at`) + **ventilation** muscu / course. Gating
  transverse `['strength','running']` (visible si muscu **OU** course actif) ; ventilation affichée
  seulement si les deux piliers sont actifs (sinon le total suffit). Variante compacte + empty state.
- Logique pure `@wellness/shared` : `computeTrainingTime` (agrégation + clamp) et `formatHoursMinutes`
  (« Xh YY », minutes plancher zéro-paddées) — testées (Vitest).
- Hook `useTrainingTime` (dashboard-repository) : **composition** de `useRunStats('week')` (course) et
  `useWorkoutHistory` filtré semaine (muscu), gating au retour, hooks inconditionnels.
- Composant `TrainingTimeCard` + entrée `WIDGET_COMPONENTS` ; registre `dashboard.ts` étendu
  (8 → 9 widgets) + `dashboard.test.ts` mis à jour ; i18n `home.trainingTime` FR/EN (parité).

**Technique / Notes**
- **100 % client, offline, aucune migration** (durées déjà présentes : `workouts`/`runs`
  `duration_seconds`). Fenêtre alignée sur `muscle-volume`/`running-week` → les chiffres se réconcilient.
- Exécution **subagent-driven** (commits `f1c8a5a`→`6face77`), spec + plan relus par sous-agent
  (corrections intégrées : semaine ISO vs 7 j glissants, `formatHoursMinutes` dédié, ordre des commits),
  **revue finale de code *ready-to-merge*** (cohérence inter-widgets vérifiée au fuseau).
- typecheck/lint/tests(689) verts. Catalogue MR-06 → ✅.
- **Reste** : recette device (total + ventilation ; gating 1/2 piliers / nutrition seule ; empty ;
  compact) + relecture Damien.
- Commit précédent : `6603c65`.

### 16/07/2026 — `feature/8.8b-admin-bannissement` — bannissement des utilisateurs (back-office) → US 8.8 complète

**Ajouté** (US 8.8b — seconde moitié de 8.8 ; complète 8.8a)
- **Migration** `20260716150753_user_bans` (**appliquée cloud CLI + `db:types`**, cochée
  [MIGRATIONS.md](supabase/MIGRATIONS.md)) :
  - Table `public.user_bans` **append-only** (historique ban/unban + motif) : RLS `select` réservé à
    `can_manage_users()`, **aucune** policy d'écriture (seules les RPC écrivent).
  - RPC `public.ban_user(target_user_id, reason)` / `public.unban_user(target_user_id)`
    (`SECURITY DEFINER`, `search_path=public`, `revoke execute from public, anon` + `grant to
    authenticated`) : bannissent en posant `banned_until` à une **date lointaine** (`'9999-12-31'` —
    ban permanent, évite le risque de parsing `'infinity'` côté GoTrue). Garde-fous **serveur** :
    habilitation `can_manage_users()`, motif obligatoire, **anti-auto-ban**, **anti-ban d'un compte
    admin**.
  - Colonne **`is_admin`** ajoutée **en dernier** à la vue `admin_users` (garde-fou UI, lisible même
    par un moderator).
- **Audit** : actions `user.ban` / `user.unban` ajoutées à `AUDIT_ACTIONS`
  ([packages/shared/src/audit.ts](packages/shared/src/audit.ts)) + libellés `fr.audit.action`.
- **Data** `data/users.ts` : `banUser` / `unbanUser` (RPC + `logAudit` best-effort) / `listUserBans`.
- **UI** : section **Modération** sur la fiche `/users/:id` — Bannir (motif obligatoire via prompt) /
  Débannir (confirmation) + **historique** ; garde-fous UI (section masquée pour **soi-même** et pour un
  **compte admin**, double barrière avec le serveur) ; i18n `fr.users.ban`.

**Technique / Notes**
- **Clé anon uniquement (aucun `service_role`), pas de sync rule**, coupure d'accès au **prochain
  refresh** (~1 h) assumée. `banned_until = '9999-12-31'` (décision Florian : date lointaine plutôt
  qu'`'infinity'`, non testable en CLI).
- Exécution **subagent-driven** (commits `0845df6`→`b6b3aca`), spec + plan relus par sous-agent
  (corrections intégrées), **revue finale de code *ready-to-merge*** (7/7 points sécurité conformes).
- **Rattrapage** : les specs+plans **8.8a** (jamais commités lors de la livraison) ont été ajoutés au
  passage (`6ca0d4a`).
- **Reste** : **recette** (bannir un compte normal → Banni + historique ; auto-ban / ban d'admin
  refusés ; débannir → Actif ; parcours moderator ; coupure effective au refresh) + **relecture
  Damien**. **US 8.8 complète** une fois recettée.
- Commit précédent : `3c1d2e1`.

### 16/07/2026 — `feature/8.8a-admin-consultation-utilisateurs` — consultation des utilisateurs (back-office)

**Ajouté** (US 8.8a — première moitié de 8.8 ; le bannissement = 8.8b, à cadrer avec Damien)
- **Migration** `20260716134626_admin_users_view` (**appliquée cloud CLI + `db:types`**, cochée
  [MIGRATIONS.md](supabase/MIGRATIONS.md)) :
  - Fonction `public.can_manage_users()` (`SECURITY DEFINER`, `super_admin` **ou** `moderator`).
  - Vue `public.admin_users` (`security_invoker=false` + `WHERE can_manage_users()` = **barrière serveur
    authoritative** ; `REVOKE anon` / `GRANT authenticated`) joignant `auth.users`+`profiles`+
    `user_settings`, **colonnes sobres RGPD** (email, inscription, dernière connexion, `is_banned`,
    prénom, objectif, onboarding, piliers, langue — **aucune donnée de santé**). Hors PowerSync.
- **Gate `canManageUsers`** (super_admin/moderator) : `rolesContext.ts` + `RolesProvider.tsx` + garde de
  route `RequireCanManageUsers` (`App.tsx`). **`content_editor` explicitement exclu.**
- **Écrans admin** : liste `/users` (recherche email débouncée + pagination serveur + statut Actif/Banni),
  fiche `/users/:id` (lecture seule, sobre). Couche data `data/users.ts` (`listUsers`/`getUser`, typés
  sur la vue). i18n FR `fr.users`.

**Modifié**
- `AdminLayout` : entrée « Utilisateurs » convertie de placeholder « bientôt » en vrai lien gated
  `canManageUsers` ; `NAV_SOON` + styles morts retirés.

**Technique / Notes**
- **Lecture seule, clé anon uniquement (aucun `service_role`), aucune écriture, aucun `logAudit`**
  (la consultation n'écrit rien). Colonnes de vue toutes nullables → guards systématiques côté écrans
  (`formatDate`, `renderPillars`/`Array.isArray`, cast des clés i18n littérales, pagination sans
  interpolation).
- Exécution **subagent-driven** (commits `48c2f1f`→`5573579`), spec + plan relus par sous-agent
  (corrections intégrées), **revue finale de code *ready-to-merge*** (barrière serveur validée : un
  compte non habilité obtient 0 ligne).
- **Reste** : **recette** (super_admin/moderator voient la liste + fiche ; `content_editor` ne voit rien,
  `/users` redirige ; recherche/pagination ; compte sans profil → « — ») + **relecture Damien**.
- **8.8b (bannissement)** à cadrer avec Damien : RPC `SECURITY DEFINER` sur `auth.users.banned_until`
  + table `user_bans` (motif) + actions UI + audit.
- Commit précédent : `e2220c4`.

### 16/07/2026 — `fix/journal-entree-swipe-edition` — implémentation : swipe + édition élargie des entrées de repas

**Corrigé** (bug §🐞 « modifier / supprimer un aliment ajouté à un repas »)
- **Découvrabilité** : une entrée de repas est désormais un **swipe gauche** (`ReanimatedSwipeable`)
  révélant **Modifier** (ouvre le détail en édition) et **Supprimer** (confirmation → soft delete).
  Le **tap** ouvre le détail en consultation. L'**appui long** (suppression invisible) est **retiré**.
- **Édition élargie** : les **quick add** (entrées sans quantité) deviennent éditables — kcal, P/G/L
  et **nom** en saisie directe. Les entrées **avec quantité** conservent l'édition par les grammes
  (règle de trois `rescaleEntryNutrition`, **non régressé**).

**Ajouté**
- `journal.swipeEdit`, `journal.swipeHint`, `journal.detail.calories` (i18n FR/EN, parité).

**Modifié**
- `updateEntry` ([journal-repository.ts](apps/mobile/src/data/repositories/journal-repository.ts)) :
  `quantityG: number | null`, `name?` optionnel, `micronutrients` **conditionnel** (ne réécrit plus
  `{}` par défaut → micros existants préservés).
- `EntryDetailContent` / `MealSection` ([nutrition.tsx](apps/mobile/src/app/(tabs)/nutrition.tsx)) :
  swipe, ouverture directe en édition (`startEditing`), formulaire d'édition branché sur `hasQuantity`,
  aperçu macros périmé masqué en édition quick add, bouton « Modifier » toujours visible.

**Supprimé**
- Clé i18n orpheline `journal.longPressDelete` (FR+EN) ; variable `canEdit` (remplacée par `hasQuantity`).

**Technique / Notes**
- **100 % client, aucune migration, pas de checkpoint 🔴.** typecheck/lint verts, **684 tests** verts.
- Exécution **subagent-driven** (4 commits `5e00ac9`→`0729039` : updateEntry → i18n → swipe → édition),
  revues spec + qualité par tâche + **revue finale de code *ready-to-merge*** (aucun bloquant).
- ⚠️ **Premier usage de `ReanimatedSwipeable` dans le repo** → **recette device** requise : swipe
  Modifier/Supprimer, tap → détail, édition quick add (kcal/macros/nom), non-régression édition par
  quantité, **actions de swipe non rognées** malgré `overflow:'hidden'` de la carte de repas, confort
  de fermeture du swipe après action. Relecture Damien à faire.
- Commit précédent : `7958b8c`.

### 16/07/2026 — `fix/journal-entree-swipe-edition` — cadrage (spec + plan) édition/suppression d'une entrée de repas + report US 8.7

**Ajouté**
- [docs/specs/functional/us/fix-journal-entree-swipe-edition.md](docs/specs/functional/us/fix-journal-entree-swipe-edition.md) —
  spec du fix du bug §🐞 « modifier / supprimer un aliment ajouté à un repas ». Deux volets :
  **(1) découvrabilité** = swipe gauche sur l'entrée → Modifier + Supprimer (tap conservé, appui long
  retiré) ; **(2) édition élargie** = les quick add (entrées sans quantité) deviennent éditables
  (kcal/P/G/L/nom), les entrées avec quantité restent en édition par les grammes (règle de trois,
  inchangé). 100 % client, aucune migration. **Validée Florian (16/07/2026)**, relue par sous-agent
  (3 corrections intégrées : `ReanimatedSwipeable` au lieu du `Swipeable` déprécié, clés i18n
  rectifiées, `updateEntry.micronutrients` conditionnel).
- [docs/plans/fix-journal-entree-swipe-edition.md](docs/plans/fix-journal-entree-swipe-edition.md) —
  plan d'implémentation en 5 tâches (updateEntry → i18n → swipe → édition élargie → vérifs/recette).
  **Validé Florian (16/07/2026)**, relu par sous-agent (5 corrections mineures intégrées : parité i18n
  manuelle, swap `onSelectEntry`, suppression `canEdit`, masquage aperçu périmé, unité labels macros).

**Modifié**
- [docs/roadmap/roadmap.md](docs/roadmap/roadmap.md) — US **8.7 (modération aliments signalés)** passée
  en **⏳ Reporté** avec justification.
- [TODO.md](TODO.md) — note de report 8.7 dans « Décisions bloquantes » ; bug §🐞 passé en `[~]`
  (spec + plan validés, code à venir).

**Notes**
- **Docs uniquement** (aucun code applicatif touché) → lint/typecheck/tests non pertinents pour ce commit.
- **Report US 8.7** _(décision Florian, 16/07/2026)_ : modèle **privé par utilisateur** (RLS
  `foods_select` = `owner_id IS NULL OR owner_id = auth.uid()`) → aliments utilisateurs non partagés +
  **aucun mécanisme de signalement** (table + geste mobile). La file de modération n'aurait rien à
  traiter → reprise conditionnée à un choix produit (signalement de l'éditorial, ou modèle
  communautaire hors périmètre). **8.8 reste disponible.**
- ⚠️ Nom de branche `fix/journal-entree-swipe-edition` **réutilisé** (une session précédente l'a
  employé pour l'ajout IDEAS.md, déjà mergé sur `dev`). Sans incidence : travail additif.
- Commit précédent : `ab2ded2`.

### 16/07/2026 — `fix/journal-entree-swipe-edition` — 2 idées consignées (IDEAS.md)

**Ajouté**
- [IDEAS.md](IDEAS.md), section « À trier » — deux idées brutes captées (hors pipeline, avant cadrage),
  chacune adossée à l'existant vérifié :
  - 🔍 **Import de données depuis d'autres apps (Garmin/Strava…)** — trace GPX + FC + données non
    modélisées. Recoupe l'US 1.20 (déjà backlog V1.1) ; export GPX déjà codé (écriture seule, sans FC) ;
    FC classée V2. Distinction trace GPX vs métriques non modélisées ; piège FC = extension GPX / FIT / TCX ;
    question ouverte migration ponctuelle (A) vs connexion continue (B).
  - 🆕 **Générateur IA de plan de repas hebdo + liste de courses** — s'appuie sur 4.27/4.28/4.4 (manuels,
    V1.1) mais ajoute la génération IA (nouvel usage IA non cadré). Point dur = optimisation sous contraintes
    (kcal + macros) → calcul déterministe en appui de l'IA. Candidat premium.

**Notes**
- **Docs uniquement** (aucun code touché) ; commité sur la branche de travail courante `fix/journal-entree-swipe-edition`
  (IDEAS.md = fichier transverse hors pipeline). Fichiers non suivis de l'US swipe/édition journal laissés
  hors de ce commit. Commit précédent : `2399ffd`.

### 16/07/2026 — `dev` — CI en échec : erreur de typage `fontsReady` (_layout.tsx)

**Corrigé**
- [_layout.tsx:71](apps/mobile/src/app/_layout.tsx#L71) — `fontsReady = loaded || error` produisait
  le type `true | Error | null` (car `useAppFonts().error` est `Error | null`), refusé par
  `resolveRootRoute` qui attend `fontsReady: boolean`. Le typecheck CI échouait
  (TS2322, run #194). Correction : `loaded || error != null` — vrai booléen, **intention préservée**
  (polices « prêtes » si chargées **ou** en erreur, pour ne pas bloquer le splash indéfiniment).

**Notes**
- **100 % client, une ligne, aucune migration.** typecheck/lint verts, mobile 42 tests + shared 684 tests OK.
  Régression introduite par le commit précédent `d1c0e14` (extraction `resolveRootRoute`). Commit précédent : `2b0ecd5`.

### 16/07/2026 — `fix/onboarding-rejeu-connexion` — onboarding redemandé après réinstallation (race offline-first)

**Corrigé**
- Sur une **réinstallation**, l'app renvoyait vers l'onboarding pourtant terminé : la gate de routing
  ([_layout.tsx](apps/mobile/src/app/_layout.tsx)) concluait « onboarding non fait » sur un profil
  **local** nul, **avant** que PowerSync ait redescendu la ligne `profiles` (qui porte
  `onboarding_completed_at`) — **race offline-first** (déco/reco OK car la base locale garde le profil).
  Repro Florian (16/07/2026) : déco/reco OK, réinstall → onboarding systématique.
- Décision de routing extraite dans une **fonction pure testée** `resolveRootRoute`
  (`packages/shared/src/root-route.ts`, 8 tests Vitest) : garde « ne pas ouvrir l'onboarding sur profil
  local absent tant que `hasSynced` n'est pas vrai » ; `_layout.tsx` consomme le helper. **Comportement
  de routing inchangé hors le cas réinstall.**

**Notes**
- **100 % client, aucune migration, pas de checkpoint 🔴.** typecheck/lint verts, shared 684 tests.
  Reste : recette device (réinstaller → reconnexion → app directe) + relecture Damien. Commit précédent : `cf83d61`.

### 16/07/2026 — `docs/bug-onboarding-rejeu-connexion` — bug onboarding consigné + recettes MN-06/MN-03 validées (TODO)

**Modifié**
- `TODO.md` — **US MN-06** (protéines/kg) et **US MN-03** (vue croisée charge muscu & apports 8 sem)
  passées de `[~]` à `[x]` : **recette device validée par Florian le 16/07/2026** (mentions « 🔴 Reste
  recette » remplacées par le statut validé ; reste relecture Damien). _Note : validations saisies hors
  de cette session, intégrées au même commit sur décision de Florian._
- `TODO.md` — nouvelle entrée dans **§🐞 Bugs connus** : **onboarding relancé à chaque connexion** alors
  qu'il est déjà terminé (remontée Florian, 16/07/2026, à reproduire sur device). Distinct du bug déjà
  corrigé `fix/onboarding-rejeu-profil` (qui était un *crash* au 2ᵉ passage). Diagnostic code consigné :
  la gate de routing ([_layout.tsx:79](apps/mobile/src/app/_layout.tsx#L79), [_layout.tsx:132-137](apps/mobile/src/app/_layout.tsx#L132-L137))
  route vers l'onboarding dès que `profile` est `null`, et `ready` n'attend que la **requête locale
  SQLite** (`profileLoading`), **pas** la **synchro initiale réseau** (`hasSynced`) → **hypothèse de race
  offline-first** (profil pas encore rapatrié = considéré comme onboarding non fait). Pistes de fix
  (attendre `hasSynced` / distinguer « pas encore synchro » de « nouveau compte ») + question à trancher
  à la reproduction (chaque login vs réinstall/2ᵉ appareil). À cadrer : spec courte avant fix.

**Notes**
- Mise à jour **documentaire** (suivi) uniquement — aucun code applicatif ni schéma, aucun secret.
  Commit précédent : `9f161e0`.

### 16/07/2026 — `fix/affichage-graphes-et-filtre-course` — catalogue d'analyses : recette + priorisation à jour

**Modifié**
- `docs/product/analyses-donnees.md` — mention « recette device OK 16/07/2026 » ajoutée aux **6 analyses
  livrées & recettées** (MUSC-04, MUSC-05, MN-02/4.32, RN-01, RN-02, META-06) ; section **« Pistes de
  priorisation »** corrigée : items **1/2/6/11 barrés** (livrés + recettés, statuts périmés ⏳/🟡 retirés),
  note de MàJ ajoutée. _Rappel : ce catalogue trace l'**existence** d'une analyse (✅ = implémenté), pas
  la recette — le suivi de recette vit dans `TODO.md` / `CHANGELOG.md`._

**Notes**
- Mise à jour **documentaire** uniquement — aucun code ni schéma, aucun secret. Commit précédent : `263a539`.

### 16/07/2026 — `fix/affichage-graphes-et-filtre-course` — recettes device TOUTES validées (TODO)

**Modifié**
- `TODO.md` — les **6 US en attente de recette** (MUSC-04, MUSC-05, META-06, 4.32, RN-01/02 + 8.10)
  **recettées et validées par Florian le 16/07/2026** (APK release + dataset de recette ; 8.10 côté
  back-office web) : bandeau ⛔ « recettes en attente » → **✅ TOUTES VALIDÉES**, cases `[x]`, mentions
  « 🔴 Reste recette » / « PAS ENCORE RECETTÉ » remplacées par le statut validé. **8.7 (modération) →
  8.8 (utilisateurs) débloquées** (dépendaient de la recette 8.10).

**Notes**
- Mise à jour **documentaire** (suivi) uniquement — aucun code ni schéma. Aucun secret.
  Commit précédent : `bc2ef62`.

### 16/07/2026 — `fix/affichage-graphes-et-filtre-course` — recette : fix typage UNION (personal_records)

**Corrigé**
- `supabase/scripts/recette-dataset.sql` (section 9) — le `UNION ALL` insérait des `null` **nus** dans
  `reps` / `weight_kg` ; Postgres les typait en `text` → `ERROR 42804: column "reps" is of type integer
  but expression is of type text` (remontée Florian à l'exécution). Casts explicites `null::int` /
  `null::numeric` dans les 3 branches. Le bloc `DO $$` étant **transactionnel**, l'échec n'avait **rien
  appliqué** (effacement inclus → données intactes). Commit précédent : `008c1cd`.

### 16/07/2026 — `fix/affichage-graphes-et-filtre-course` — affichage : graphiques débordants + filtre course multiligne

**Corrigé**
- [ProgressLineChart.tsx](apps/mobile/src/components/charts/ProgressLineChart.tsx) /
  [MuscleVolumeBarChart.tsx](apps/mobile/src/components/charts/MuscleVolumeBarChart.tsx) — les
  graphiques débordaient à droite de leur carte (visible Nutrition → Stats). Largeur codée en dur
  (`window − 48`) sans compter l'axe Y de `react-native-gifted-charts`, rendu **hors** de `width`
  (empreinte = `yAxisLabelWidth + width + endSpacing`). Largeur désormais **mesurée** via `onLayout`
  et répartie (axe Y 44 px + marge 12 px + tracé) → tient dans la carte partout (nutrition, course,
  muscu). Repli au 1ᵉʳ rendu = écran − paddings usuels (garde le test smoke vert).
- [running-history/index.tsx](apps/mobile/src/app/running-history/index.tsx) — `Segment` de la card
  « Statistiques » passé en `scrollable` : « Semaine / Mois / Depuis le début » sur une seule ligne
  défilable (fin du retour à la ligne).

**Notes**
- **100 % JS** (aucun module natif) → reload Metro suffit, pas de build. **Recette device validée par
  Florian (16/07/2026)** sur APK release. typecheck/lint/tests verts (charts smoke 6/6, shared 663).
  Aucun secret. Commit précédent : `b19df7c`. Reste : relecture Damien.

### 16/07/2026 — `fix/affichage-graphes-et-filtre-course` — recette : dataset charge max (historique des paliers) + idée infobulle

**Corrigé**
- `supabase/scripts/recette-dataset.sql` — la courbe « charge max » (écran Progression) lit
  `personal_records` : **1 point = 1 record battu** ([records-repository.ts:512-543](apps/mobile/src/data/repositories/records-repository.ts#L512-L543)),
  pas le max par séance. Le dataset ne semait qu'**un seul** record `max_weight` daté du jour → un
  point unique (remontée Florian, recette MUSC-04). Il reconstitue désormais l'**historique des
  paliers** (`max_weight` / `estimated_1rm` / `best_volume`) via fonctions fenêtre : une ligne par
  palier réellement franchi (valeur strictement supérieure aux séances précédentes), datée de la
  séance. Exercices au poids du corps (charge 0) **exclus** (restent absents des courbes charge/1RM,
  comportement voulu). ⚠️ Re-exécuter le script d'injection pour bénéficier du correctif.

**Ajouté**
- `supabase/scripts/recette-verification.sql` — contrôle « Paliers charge max DC (courbe) »
  (attendu **6** : 60 → 65 → 70 → 72 → 75 → 80).
- `IDEAS.md` — idée **infobulle de donnée au tap sur les graphiques** (points cliquables), transverse
  à tous les graphiques, à cadrer via le workflow spec → plan → design (remontée Florian, recette MUSC-04).

**Notes**
- Outillage de recette (SQL **non joué par le CLI**) + note d'idée. **Aucun code applicatif, aucun
  schéma, aucun secret.** Commit précédent : `ac0a691`.

### 16/07/2026 — `dev` (exceptionnel, sans branche) — bug consigné : édition/suppression d'un aliment de repas

**Ajouté**
- `TODO.md` (§🐞 Bugs connus) — nouvelle entrée `[ ]` : *modifier / supprimer un aliment ajouté à un
  repas* — geste peu découvrable + édition limitée à la quantité. Remontée Florian (16/07/2026).
  Vérif code [nutrition.tsx](apps/mobile/src/app/(tabs)/nutrition.tsx) : suppression via appui long
  **ou** fiche détail (corbeille), modification limitée à la **quantité** (grammes) et seulement si
  `quantityG > 0` (un quick add sans quantité n'est pas éditable ; pas de changement de l'aliment ni
  des macros). Pistes notées (actions visibles / swipe, édition d'un quick add). À reproduire device +
  cadrer une spec courte avant `fix/…`.

**Notes**
- Commit **direct sur `dev`** (dev→dev, sans branche dédiée), **exceptionnellement** à la demande de
  Florian. Changement **documentaire uniquement** (aucun code ni schéma) → lint/typecheck/tests non
  rejoués. Aucun secret. Commit précédent : `3898567`.

### 16/07/2026 — `chore/recette-outillage-device` — outillage de recette sur device (sans EAS)

**Ajouté**
- `supabase/scripts/recette-dataset.sql` — script de **données de test** (pas une migration) :
  remise à plat (hard delete) des données perso de l'utilisateur cible + injection de ~3 mois
  d'historique cohérent (muscu 14 j déséquilibrée, historique 1RM DC, tractions charge 0, runs
  ~2 mois dont 2 aujourd'hui, nutrition 60 j en 3 paliers kcal, poids hebdo, records, profils
  pré-réglés 3 piliers / nutrition Auto). Couvre les recettes 🔴 en attente : MUSC-04, MUSC-05,
  META-06, 4.32, RN-01/02. Un seul paramètre à renseigner : `v_email`. Tout en une transaction
  `DO $$`. À jouer dans le **SQL Editor** cloud (bypass RLS), **jamais** via `db push`.
- `supabase/scripts/recette-verification.sql` — contrôles **lecture seule** : une grille
  bloc · contrôle · attendu · obtenu · statut (✅/⚠️) validant le dataset ci-dessus (compteurs,
  déficit 7 j, deltas N vs N-1, courbe 1RM, équilibre 14 j par groupe, dépense course du jour).

**Modifié**
- `docs/specs/technical/dev-build-android-local.md` — ajout du **mode B : APK autonome (release,
  sans Metro ni câble)**. Build local via `gradlew.bat assembleRelease` (signé `debug.keystore`
  du projet, `EXPO_PUBLIC_*` embarquées depuis `.env`), transfert sans fil, install sans câble,
  **hors quota EAS**. Intro reformulée (2 modes A/B, prérequis §1 communs), renumérotation
  (§5 fichiers locaux, §6 dépannage) + 1 ligne de dépannage (`.env` absent → crash au lancement).

**Notes**
- Aucun code applicatif ni schéma touché (docs `.md` + `.sql` autonomes non importés) → lint/
  typecheck/tests non rejoués. Scripts SQL **non idempotents** et **destructifs** (hard delete
  ciblé sur `v_email`) : à réserver à un compte de recette. Aucun secret (email en placeholder
  `REMPLACE-MOI@exemple.fr`). Commit précédent : `fe11bcb`.

### 15/07/2026 — `feature/musc05-equilibre-groupes` — MUSC-05 livrée (équilibre par groupe, 14 j)

**Ajouté**
- `computeMuscleBalance(setsByGroup)` + constantes de seuils (`packages/shared/src/muscle-balance.ts`,
  testée) — parts par groupe, classement délaissé/équilibré/sur-représenté vs cible uniforme (1/6),
  liste des délaissés, `hasEnoughData` (≥ 12 séries). Métrique = **nombre de séries** (comparable
  entre groupes, contrairement au tonnage).
- Hook `useMuscleBalance()` (records-repository) — `COUNT` séries + `SUM` tonnage par groupe sur
  **14 j glissants** (mêmes filtres que `useMuscleVolumeThisWeek`).
- Section « Équilibre musculaire (14 j) » dans `/progress` : barres par séries **colorées** selon le
  classement (délaissé = doré `#c9a96e`, équilibré = accent, sur-représenté = grisé) + **alerte douce**
  listant les groupes délaissés (si historique ≥ 12 séries). i18n `progress.balance.*` FR/EN.
- `MuscleVolumeBarChart` étendu : couleur par barre optionnelle (`color?`), **rétrocompatible**.

**Notes**
- 100 % offline, **pas de migration**. Section « volume hebdo » + widget dashboard inchangés
  (non-régression ; chart rétrocompatible). Revue finale *prête à merger* (aucun bloquant). 663 tests verts.
- Ratio **pousser/tirer reporté à MUSC-11** (nécessite le « type de mouvement », absent du schéma).
  Catalogue MUSC-05 → ✅.

### 15/07/2026 — `feature/meta06-comparaison-periode` — META-06 livrée (delta N vs N-1, 3 surfaces)

**Ajouté**
- `percentChange(current, previous)` + `previousPeriodTodayKey(todayKey, period)` + types
  (`packages/shared/src/comparison.ts`, testés) — écart % + direction ↑/↓/→ (`previous=0` → `null`),
  et clé de jour de la période précédente (semaine −7 j, mois précédent, `all` → null).
- Composant mutualisé `DeltaBadge` (`apps/mobile/src/components/DeltaBadge.tsx`) — flèche + %
  (ou « nouveau »), **ton neutre** (couleur accent), a11y i18n. i18n `stats.delta.*` FR/EN.
- Hook `useRunStatsAt(period, todayKey)` (run-repository) — agrégat course sur une fenêtre décalée ;
  `useRunStats` délègue (comportement inchangé).
- Hook `useWeeklyVolumeComparison()` (records-repository) — volume muscu total semaine courante vs
  précédente (2 `SUM` bornés, jointure `exercises` alignée sur l'histogramme).
- Deltas « vs période précédente » sur **3 surfaces** : running (distance/temps/nb, sem/mois),
  nutrition (kcal moyens 7/30 j), muscu (volume hebdo total). i18n `progress.weeklyVolume.total`/`vsPrevious`.

**Notes**
- 100 % offline, **pas de migration**. `max_weight`/`volume`/affichages courants inchangés
  (non-régression). Revue finale *prête à merger* (aucun bloquant). 658 tests verts. Catalogue META-06 → ✅.
- Mineurs connus (non bloquants) : « 0 vs 0 » affiche « nouveau » (écran totalement vide) ; borne
  hebdo muscu décalée d'≈ 1 h les 2 semaines de bascule heure été/hiver (impact marginal).

### 15/07/2026 — `feature/musc04-courbe-1rm-periode-tout` — MUSC-04 clôturée (courbe 1RM estimé + période « tout »)

**Ajouté**
- `sessionBestEstimated1RM(sets)` (`packages/shared/src/records.ts`, testée) — meilleur 1RM estimé
  d'une séance (max de `estimate1RM` sur les séries à reps+poids non nuls, 0 sinon).
- Métrique `estimated_1rm` et période `all` dans `useExerciseProgression` (records-repository) :
  1RM estimé **par séance** (regroupement `workout_id`, agrégation JS via `sessionBestEstimated1RM`,
  **pas d'Epley en SQL**) ; borne `all` = epoch. Toggles `/progress` : 3 métriques × 4 périodes.
- i18n FR/EN : `progress.curve.metric.estimated_1rm`, `metricLabel.estimated_1rm`, `period.all`.

**Notes**
- Ferme le delta MUSC-04 vs spec 6.2 ; le reste de l'écran `/progress` existait déjà (~80 %).
  `max_weight`/`volume` **strictement inchangées** (SQL/mapping intouchés). Catalogue MUSC-04 → ✅.
- 100 % offline, **pas de migration**. Revue finale *prête à merger* (aucun bloquant). 647 tests verts.
- Recette : un exercice **au poids du corps** (charge 0) n'apparaît pas sur la courbe 1RM (voulu).

### 15/07/2026 — `feature/rn01-depense-course-objectif` — RN-01/RN-02 dépense course → objectif du jour (code livré)

**Ajouté (code)**
- `estimateRunCalories` (`packages/shared/src/running.ts`, testée) — dépense NET d'une course ≈ poids ×
  distance × 1,0 kcal/kg/km + terme d'intensité borné (EPOC, +1 %/km·h > 8 km/h, plafond +10 %) ;
  0 si distance/poids manquant.
- `dayCalorieBonus` + type `TrainingBonusMode` (`packages/shared/src/nutrition.ts`, testée) — bonus du
  jour selon le mode ; champ `trainingBonusMode` (`z.enum(['fixed','auto']).default('fixed')`) au
  `nutritionProfileRowSchema`.
- Hook `useDayCalorieTarget(dayKey)` (`dashboard-repository.ts`) — calcul **centralisé** de l'objectif
  effectif (mode, forfait, poids, courses du jour, gating running+nutrition) exposant `bonusSource`
  (`run`/`forfait`/`none`) ; consommé par `useNutritionSummary(today)` **et** le journal (jour sélectionné).
- Sélecteur **Forfait/Auto** dans l'écran profil nutrition (`Segment`) + badge adaptatif « · course »
  (journal + carte dashboard), i18n FR/EN (`bonusMode.*`, `runDayBadge`).
- Migration `20260715152227_nutrition_training_bonus_mode.sql` (colonne additive, défaut `'fixed'`,
  check `in ('fixed','auto')`) + colonne au schéma PowerSync local.

**Modifié**
- `nutrition.tsx` : suppression du recalcul local d'objectif effectif (dé-duplication) → consomme
  `useDayCalorieTarget(day)`, redevient sensible au jour navigable.
- `nutrition-repository.ts` : câblage `training_bonus_mode` ↔ `trainingBonusMode` (lecture + écriture,
  repli `'fixed'`).

**Notes**
- Revues spec + plan + revue finale (subagents) : ✅ prêt à merger, aucun bloquant. Non-régression du
  mode Forfait prouvée (identique à l'existant à l'arrondi près).
- ⚠️ **Séquencement obligatoire** : appliquer la migration cloud (`db:push` + `db:types`) **AVANT**
  toute bascule en mode **Auto** sur un device synchronisé — sinon l'`UPDATE` de `training_bonus_mode`
  vers un Postgres sans la colonne peut **bloquer la file de synchro PowerSync**. En lecture / mode
  Forfait, aucun risque (repli `'fixed'`).

### 15/07/2026 — `feature/rn01-depense-course-objectif` — Cadrage RN-01/RN-02 (dépense course → objectif du jour)

**Ajouté**
- `docs/specs/functional/us/rn01-depense-course-objectif.md` — spec validée : réglage **Forfait/Auto**
  du bonus calorique ; en Auto l'objectif du jour suit la **dépense estimée des courses terminées**
  (repli forfait muscu), Forfait inchangé. Formule NET ≈ poids × distance × 1,0 + terme d'intensité
  borné (EPOC, +1 %/km·h > 8 km/h, plafond +10 %). Croisement running↔nutrition, Phase A.
- `docs/plans/rn01-depense-course-objectif.md` — plan d'implémentation en 8 tâches (TDD, subagent-driven) :
  `estimateRunCalories` (running.ts) · `dayCalorieBonus` + mode Zod (nutrition.ts) · câblage repository
  mobile + schéma PowerSync local · migration `training_bonus_mode` · centralisation objectif effectif ·
  sélecteur profil · badge adaptatif · catalogue.

**Notes**
- Revue de spec + revue de plan (subagents) : références codebase vérifiées ; la revue de plan a
  rattrapé le câblage repository (le mobile ne parse pas via Zod) + le schéma PowerSync local, et
  2 bugs de référence (poids depuis `profile`, `localDayKey(new Date(...))`).
- Migration = **checkpoint 🔴 Florian** (`db:push` + `db:types`), non bloquante (défaut `'fixed'`).

## 15/07/2026 — Ajouté — IDEAS.md : SaaS coach (web) + arbitrage surfaces coach/créateur

Branche `docs/ideas-saas-coach`. Capture produit (aucun code, aucune US en pipeline). Issu d'un
échange de cadrage exploratoire avec Florian + recherche marché (WebSearch). Idée ciblée **post-V1**.

### Ajouté
- **IDEAS.md** — nouvelle idée `[[saas-coach-import-ia]]` (🔍 à creuser) : **SaaS web séparé** pour
  coachs (B2B, coach payant, athlète gratuit), 3 modules — **program builder « en béton »**
  (réutilise le constructeur admin US 8.4), **import IA de fichiers Excel/Sheets hétérogènes** = wedge
  choisi (parcours → inférence de structure → mapping en préviz → correction → push en base), et
  **dashboard coach** (athlètes, perfs, stats). Côté client = l'app Wellness gratuite. Monétisation
  incl. **paiements hors-plateforme sans commission**. Recherche marché consignée (catégorie saturée :
  Trainerize/TrueCoach/Everfit/… ; concurrent import à benchmarker = **Repport** ; gap paiements).
  Points durs notés : pipeline import IA non trivial ; **relation coach↔athlète casse le RLS `owner_id`**.

### Modifié
- **IDEAS.md** — arbitrage daté **15/07/2026** ajouté à `[[module-coach-coache]]` et
  `[[module-influenceur]]`, principe directeur : **on produit sur le web, on consomme sur mobile**
  (intensité 1-à-1 coach vs 1-à-N créateur décide de la surface). Conséquences : **console coach →
  SaaS web** (module coach mobile rendu superflu, seule la **face coaché** reste sur mobile) ;
  **influenceur reste sur mobile** côté audience (vente/communauté) mais **authoring = moteur web
  partagé** avec le SaaS coach. MàJ de `[[offre-payante-coach]]` (monétisation portée par le SaaS).

### Technique / Notes
- **Docs uniquement** (`IDEAS.md` + `CHANGELOG.md`) → lint/typecheck/tests non exécutés (aucune
  surface de code touchée). `TODO.md` non modifié (aucune US n'entre/ne sort du pipeline).
- Branche créée **depuis `origin/dev`** (et non depuis `feature/4.32-alerte-deficit-volume`) pour
  **ne pas embarquer** le commit de code 4.32 en cours (`e918efb`) dans `dev`.

## 15/07/2026 — Ajouté / Modifié — US 4.32 : alerte croisée déficit + volume (code livré, subagent-driven)

Branche `feature/4.32-alerte-deficit-volume`. Exécution subagent-driven (implémenteur + revues spec &
qualité par tâche, revue finale *ready to merge*). Première **stat croisée inter-piliers** livrée sous
forme de **widget dashboard conditionnel**. **100 % client, offline — aucune migration/cloud/natif.**

### Ajouté
- **`@wellness/shared/bodyweight.ts`** : `computeDeficitVolumeAlert({ loggedDailyKcals, targetKcal,
  weeklyVolume }) → { show, deficitPct, loggedDays }` + `MIN_LOGGED_DAYS = 4` (réutilise
  `shouldAlertDeficitVolume`/`averageIntake`). +tests (shared 631).
- **Registre dashboard** (`dashboard.ts`) : widget `deficit-volume` (`WIDGET_PILLARS`
  `['strength','nutrition']`) ; `dashboard.test.ts` mis à jour (8 widgets).
- **Hook** `useDeficitVolumeAlert` (`dashboard-repository.ts`) : `useDailyTotals(7 j)` (épars) →
  `loggedDailyKcals`, cible **de base** via `useNutritionSummary().target`, requête volume muscu 7 j
  glissante dédiée (`set_type != 'warmup'`), **gating muscu ET nutrition actifs**.
- **Widget** `DeficitVolumeAlertCard` (rend `null` hors alerte) + mapping `dashboard-widgets.tsx`.
- **i18n** `home.deficitVolume.{title,message}` FR/EN (`{{pct}}`).

### Modifié / Supprimé
- **`nutrition-stats.tsx`** : **retrait** de l'ancienne alerte (v1 faible, commit `193c5ff`) — bloc +
  calcul + requête volume + imports morts (`Ionicons`, `useQuery`, `useProfile`,
  `useNutritionProfile`, `tdee`, `targetCalories`, `objectiveFromGoal`, `computeAge`,
  `shouldAlertDeficitVolume`) + styles. Clé i18n **`stats.deficitAlert` supprimée** (FR/EN). Sections
  poids & apports intactes.

### Technique / Notes
- Gating « les deux piliers » porté par le hook (le registre filtre en `.some()`). Cible de base (pas
  ajustée jour-de-séance). Fenêtre 7 j (borne verbatim de l'existant). typecheck/tests(631)/lint verts.
- **Reste 🔴 recette (Florian/Damien)** : provoquer/lever l'alerte, gating piliers, disparition de
  l'écran Stats, cadre vide en mode édition. Export web KO = **pré-existant** (op-sqlite/better-sqlite3,
  sans rapport avec 4.32).

## 15/07/2026 — Ajouté — Plan d'implémentation US 4.32 (alerte déficit + volume, relu Approved)

Branche `feature/4.32-alerte-deficit-volume`. Plan issu de `writing-plans`, relu par sous-agent
`plan-document-reviewer` (Approved après corrections).

### Ajouté
- **Plan** [docs/plans/4.32-alerte-deficit-volume.md](docs/plans/4.32-alerte-deficit-volume.md) :
  7 tâches TDD — `computeDeficitVolumeAlert` (shared, testé), enregistrement widget `deficit-volume`
  au registre dashboard (+ maj `dashboard.test.ts`), hook `useDeficitVolumeAlert` (réutilise
  `useNutritionSummary().target` base + `useDailyTotals` + requête volume 7 j déplacée + gating
  piliers), widget `DeficitVolumeAlertCard` (rend `null` hors alerte), i18n `home.deficitVolume.*`
  FR/EN + retrait `stats.deficitAlert`, retrait de l'ancienne alerte sur `nutrition-stats.tsx`,
  vérif d'ensemble. Pas de checkpoint 🔴.

## 15/07/2026 — Ajouté — Spec US 4.32 : alerte croisée déficit + fort volume (cadrage validé)

Branche `feature/4.32-alerte-deficit-volume`. Première **stat croisée inter-piliers** (muscu↔nutrition)
du catalogue d'analyses — Phase A (déterministe, gratuite, offline, **sans IA**). Cadrage issu du
brainstorming (Florian), relu par un sous-agent `spec-document-reviewer` (Approved).

### Ajouté
- **Spec fonctionnelle** [docs/specs/functional/us/4.32-alerte-deficit-volume.md](docs/specs/functional/us/4.32-alerte-deficit-volume.md) :
  widget dashboard **conditionnel** alertant sur une semaine à déficit calorique ≥ 15 % (moyenne sur
  **≥ 4 jours loggés**) **et** volume muscu 7 j ≥ 8000, message **informatif** paramétré (`%`), gating
  **piliers actifs** (muscu **et** nutrition). Logique pure `computeDeficitVolumeAlert` (shared, testée)
  réutilisant `shouldAlertDeficitVolume`/`averageIntake` existants ; hook `useDeficitVolumeAlert`
  (requête volume 7 j glissante dédiée) ; widget `DeficitVolumeAlertCard`.

### Technique / Notes
- **Découverte en revue** : une **v1 faible** de 4.32 existe déjà en prod (commit `193c5ff`) sur
  l'écran **Stats nutrition** (message statique, sans `%`, sans règle ≥4 jours, **sans gating piliers**).
  **Décision (Florian)** : la **déplacer** sur le dashboard (retrait de l'ancienne + clé `stats.deficitAlert`).
  `TODO.md` marquait 4.32 « différé » à tort — corrigé.
- Gating dashboard confirmé : le registre filtre « au moins un pilier actif » → le « les deux requis »
  est porté par le hook. **100 % client, offline — pas de checkpoint 🔴.**

## 14/07/2026 — Ajouté — US 8.10 : log d'audit admin (code livré, subagent-driven)

Branche `feature/8.10-admin-log-audit`. Commit précédent : `c3cc92b` (plan). Exécution subagent-driven
(implémenteur + revues spec & qualité par tâche, revue finale *ready to merge*). Migration appliquée
sur le cloud (CLI, 14/07/2026), `db:types` régénérés.

### Ajouté
- **`@wellness/shared/audit.ts`** (pur, testé) : `AUDIT_ACTIONS` (14 actions, source unique array-first),
  `AuditAction` dérivé, `auditEntrySchema` (Zod), `auditActionLabelKey`. +5 tests (shared 625).
- **Migration `20260714170000_admin_audit_log.sql`** : table `audit_log` (web/admin, **hors PowerSync**),
  append-only — RLS `select` super_admin / `insert` admin (`actor_id = auth.uid()`), **aucune** policy
  update/delete + **trigger d'immuabilité**. Index created_at/actor/action.
- **`apps/admin/src/data/audit.ts`** : `logAudit` (best-effort, try/catch global, **ne lève jamais**,
  capte l'acteur via session) + `listAudit` (curseur `created_at`, filtres acteur/action/période).
- **Écran `/audit`** (`AuditScreen.tsx`, super_admin) : liste anti-chronologique, filtres
  acteur/action/dates (bornes en **fuseau local**), pagination « Charger plus » (garde anti-course
  `requestId`), états vide/erreur, date `JJ/MM/AAAA HH:MM`. Route + `NavLink` gated super_admin.
- **i18n admin FR** : section `audit` + 14 libellés d'action.

### Modifié
- **Instrumentation `logAudit`** (best-effort, après succès) : `roles.ts` (grant/revoke — `grantRole`
  retourne l'id d'attribution, log par branche écrivante), `exercises.ts` (create/update/publish/archive),
  `programs.ts` (create/update/publish/archive), `foods.ts` (create/update/archive + import = 1 entrée).
  Écrans passant le libellé : Exercises/Programs/Foods/Roles. Paramètres additifs (`opts?.label`,
  `revokeRole(id, {role,userId})`) — retours inchangés, aucun appelant cassé.

### Technique / Notes
- **Écart assumé vs spec §7** (retenu) : `setStatus`/`archive*`/`revokeRole` reçoivent un libellé
  optionnel de l'écran (le nom n'est pas en main dans la couche). Publication tracée uniquement au
  passage à `published` (dépublication non tracée). Sous-éditions de programme non auditées.
- **Point relevé en revue finale (à trancher recette)** : publier un exercice **depuis le formulaire
  d'édition** est journalisé `exercise.update` (et non `.publish`) — `saveExercise` décide selon
  `input.id` ; seul le bouton de publication de la **liste** émet `exercise.publish`. Conforme spec §7 ;
  à accepter ou objet d'un suivi.
- **Limitations mineures acceptées** : curseur `created_at` sans tie-break ; filtre acteur limité aux
  lignes chargées.
- Vérif d'ensemble : typecheck (3 workspaces) + 625 tests shared + lint (0 erreur) + build admin verts.
- **Reste 🔴 recette (Florian/Damien)** : déclencher une action de chaque type → vérifier les entrées
  dans `/audit` ; tenter un `update`/`delete` d'entrée → refus (trigger).

## 14/07/2026 — Ajouté — Plan d'implémentation US 8.10 : log d'audit admin (relu, Approved)

Branche `feature/8.10-admin-log-audit`. Commit précédent : `e0005a1` (spec). Plan issu du skill
`writing-plans`, relu par un sous-agent `plan-document-reviewer` (Approved, signatures vérifiées
contre le code réel + migration validée contre 8.9).

### Ajouté
- **Plan d'implémentation** [docs/plans/8.10-admin-log-audit.md](docs/plans/8.10-admin-log-audit.md) :
  9 tâches TDD, commits fréquents. Structure — `@wellness/shared/audit.ts` (union d'actions,
  schéma Zod, clés libellés ; testé), migration `audit_log` (append-only, RLS super_admin, trigger
  d'immuabilité, hors PowerSync), `apps/admin/src/data/audit.ts` (`logAudit` best-effort +
  `listAudit` paginé), instrumentation des 4 couches data (rôles, exos, programmes, aliments),
  écran `/audit` super_admin + route + nav + i18n, vérification d'ensemble.

### Technique / Notes
- **Écart assumé vs spec §7** (à valider) : `setStatus`/`archive*`/`revokeRole` ne disposent que d'un
  `id`, pas du nom FR → ajout d'un **paramètre optionnel de libellé** passé par l'écran appelant
  (additif, comportement de retour inchangé). `grantRole` gagne `.select('id')` + retourne l'id
  d'attribution (log par branche écrivante). Publication tracée uniquement au passage à `published`
  (dépublication non tracée). Import CSV = 1 entrée `food.import` (`details.count`).
- **Checkpoint 🔴** à l'impl : migration `audit_log` via `db:push` + `db:types` (typecheck admin rouge
  tant que non appliqué). Aucune sync rule (hors PowerSync).

## 14/07/2026 — Ajouté — Spec US 8.10 : log d'audit admin (cadrage validé)

Branche `feature/8.10-admin-log-audit`. Commit précédent : `9626521`. Première des trois US de
gouvernance admin restantes (ordre acté : **8.10 audit → 8.7 modération → 8.8 utilisateurs**).
Cadrage complet issu du brainstorming (Florian, 14/07/2026), relu par un sous-agent
`spec-document-reviewer` (Approved après 4 corrections).

### Ajouté
- **Spec fonctionnelle** [docs/specs/functional/us/8.10-admin-log-audit.md](docs/specs/functional/us/8.10-admin-log-audit.md) :
  journal d'audit append-only et non supprimable des écritures éditoriales + rôles du back-office.
  - **Périmètre** : rôles (grant/revoke), CRUD exercices/programmes/aliments + import CSV.
    Exclus : lectures, actions mobile, diff avant/après, sous-éditions de structure d'un programme.
  - **Capture applicative** (approche A) : `logAudit()` après chaque mutation, best-effort non
    bloquant. Modèle de menace assumé (clé anon, équipe interne de confiance) ; durcissement futur
    possible via trigger `user_roles` sans casse.
  - **Modèle de données** : table `audit_log` (web/admin, hors PowerSync) — `actor_id`/`actor_email`
    (snapshot, pas de FK cascade), `action`/`target_table`/`target_id`/`target_label`/`details` jsonb.
    Schéma générique → accueillera 8.7/8.8 sans migration.
  - **Immuabilité** : RLS `select` super_admin, `insert` admin (`actor_id = auth.uid()`), aucune
    policy update/delete + trigger anti-`UPDATE`/`DELETE`.
  - **Écran** `/audit` (super_admin) : liste anti-chronologique + filtres acteur/action/période.
  - Logique pure `@wellness/shared/audit.ts` (testée), couche I/O `apps/admin/src/data/audit.ts`.

### Technique / Notes
- Décision produit (Florian) : détail limité à qui/quoi/cible/quand + libellé (pas de diff) ;
  consultation super_admin only. Checkpoint 🔴 à l'implémentation : migration `audit_log` + `db:types`.

## 14/07/2026 — Technique / Notes — Outillage migrations cloud + config build EAS + nettoyage prebuild

Branche `feature/seed-ciqual-enrichment`. Commit précédent : `0b1fac2`. Aligne la doc et l'outillage
sur le workflow **migrations directement sur le cloud** (pas de Docker chez les devs) et fiabilise le
build Android local.

### Ajouté
- **`package.json`** (racine) : scripts `db:new` (`supabase migration new`), `db:push`
  (`supabase db push`) et `db:push:dry` (`--dry-run`) — remplacent le copier-coller de SQL dans la
  console Supabase.
- **`apps/mobile/eas.json`** : bloc `env` sur le profil **preview** — `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` (clé **publishable**, publique par nature — protégée par RLS),
  `EXPO_PUBLIC_POWERSYNC_URL`. Pas de secret (`service_role` jamais exposée).

### Modifié
- **`CLAUDE.md`** : nouvelle section « Migrations base de données (OBLIGATOIRE) » (cycle sans Docker,
  garde-fou `--linked`, réconciliation `migration repair`) ; tableau des commandes Supabase avec
  colonne « Docker requis » ; état Supabase passé à **cloud provisionné** ; ajout du registre
  `supabase/MIGRATIONS.md` dans l'arborescence doc.
- **`supabase/MIGRATIONS.md`** : réalignement du tableau + ligne `20260714120000_seed_library_foods_ciqual`
  (à pousser).

### Supprimé (nettoyage)
- **`android/` (racine)** et **`app.json` (racine)** : artefacts d'un `npx expo run:android` lancé par
  erreur depuis la racine au lieu de `apps/mobile/`. Le vrai projet natif est `apps/mobile/android/`.
- Bloc `dependencies` (`expo`/`react`/`react-native`) injecté par erreur dans le **`package.json`
  racine** par ce même prebuild — ces deps appartiennent à `apps/mobile`, pas au workspace racine
  (annulé, avec restauration de `package-lock.json`).

### Notes débogage (environnement)
- Build Android local KO tant que `ANDROID_HOME`/`ANDROID_SDK_ROOT` contenaient des **guillemets
  littéraux** (« syntaxe du nom de fichier incorrecte » côté Gradle). Corrigé au niveau **variables
  User** (valeurs sans guillemets) + `platform-tools` ajouté au `PATH`. Rouvrir le terminal après coup.
- Détection du Pixel 6a par `adb` : nécessite serveur adb propre (`kill-server`/`start-server`) +
  autorisation RSA acceptée sur le téléphone + mode USB « Transfert de fichiers ».

## 14/07/2026 — Ajouté — Bibliothèque d'aliments enrichie CIQUAL 2025 (80 aliments, via migration)

Branche `feature/seed-ciqual-enrichment`. Réalise l'US d'enrichissement — **approche A** (voir révision
dans spec/plan). Données 100 % **CIQUAL 2025** (ANSES, Licence Ouverte / Etalab).

### Ajouté
- **Migration idempotente** `supabase/migrations/20260714120000_seed_library_foods_ciqual.sql` : upsert
  de **80 aliments de bibliothèque** (foods + food_translations FR/EN + `micronutrients`). **50**
  aliments existants voient **toute leur nutrition** (macros de base + sous-macros + 31 micros) reprise
  de CIQUAL, identités conservées (UUID/noms/catégorie/portions) ; **+30 nouveaux** (fruits, légumes,
  viandes/poissons, légumineuses, oléagineux). `on conflict do update` → réconcilie les aliments déjà
  présents sur le cloud + insère les nouveaux ; rejouable au `db:reset`.
- **Tooling reproductible** `supabase/scripts/enrich-ciqual/` : `generate.py` (stdlib, CSV→migration),
  `foods-catalog.json` (source unique : identité + code CIQUAL par aliment), `mapping-columns.json`
  (index colonne CIQUAL → clé/unité), `README.md`, `.gitignore` (export brut hors git).

### Modifié / Supprimé
- **`supabase/seed.sql`** : la bibliothèque d'aliments **quitte le seed** (remplacée par un pointeur
  vers la migration). Motif : nouvelle règle CLAUDE.md « jamais de SQL manuel en console » → la donnée
  de référence cloud passe par une migration versionnée (`db:push`), plus par une application hors-bande.
- **MIGRATIONS.md** : ligne ajoutée (`[ ]`, à pousser).

### Technique / Notes
- **Present-only, « ne rien inventer »** : `traces`/`NC`/`< x`/`-` omis. **Oméga** = somme des AG
  mesurés CIQUAL (ALA+EPA+DHA / linoléique+arachidonique / oléique). **Absents de CIQUAL 2025** :
  `trans_fat_g`, `vitamin_b7_ug` (biotine) → jamais renseignés. **Café noir** : pas de café-boisson
  dans CIQUAL (seulement « café moulu ») → non mappé, valeurs conservées. **Vitamine A** = colonne
  « équivalents rétinol (µg) ». Macros CIQUAL « - » → 0 (correct : glucides viandes, lipides fruits…).
- **Reste** : `npm run db:push` (cloud) + cocher MIGRATIONS.md + `npm run db:reset` + `db:types`
  (local, Docker) + recette device. **Aucune dépendance native.**

## 14/07/2026 — Technique/Notes — Cadrage US « enrichir le seed CIQUAL »

Branche `feature/seed-ciqual-enrichment`. **Cadrage seul (aucun code applicatif)** ; brainstorming +
design validés par Florian.

### Ajouté
- **Spec** [seed-ciqual-enrichment.md](docs/specs/functional/us/seed-ciqual-enrichment.md) + **plan**
  [seed-ciqual-enrichment.md](docs/plans/seed-ciqual-enrichment.md). Objectif : compléter les ~50
  aliments du seed avec les **micros (31) + sous-macros** issus de **CIQUAL** (ANSES), sans toucher les
  macros de base, via un **générateur reproductible** (export CIQUAL + `mapping-foods` UUID→code +
  `mapping-columns` → `UPDATE public.foods` dans `seed.sql` + `cloud-update.sql` one-shot).
- Décisions actées : source = export officiel fourni par Florian (hors git, licence Etalab) ; périmètre
  = 50 aliments seed ; livraison = seed + one-shot cloud (🔴) ; **present-only, « ne rien inventer »**
  (tokens `traces`/`NC`/`< x` omis) ; vitamine A mappée seulement si colonne µg présente.

### Technique / Notes
- **Bloqué** en attente de l'export ANSES CIQUAL (CSV) de Florian (Task 0). Ensuite : relecture Florian
  du `mapping-foods.json` (appariement aliment↔code CIQUAL). Aucune migration, aucun code runtime.

## 14/07/2026 — Ajouté — Panel nutritionnel étendu (10 → 31 micronutriments)

Branche `feature/panel-nutritionnel-etendu`. Implémentation de l'US cadrée + validée (spec + plan),
exécution subagent-driven + **revue de code indépendante *Approved***.

### Ajouté
- **+21 micronutriments** au panel (socle 10 → 31) : AG **monoinsaturés / polyinsaturés / trans** +
  **oméga-3/6/9** ; minéraux **zinc, phosphore, cuivre, manganèse, sélénium, iode** ; vitamines
  **A, E, K, B1, B2, B3, B5, B6, B7** (C/D/B9/B12 déjà gérées). Source unique `MICRONUTRIENT_KEYS`
  (`packages/shared/src/food.ts`) → schéma Zod, `scaleMicronutrients`/`sumMicronutrients`, import CSV
  et validation du formulaire admin **dérivent automatiquement**.
- **Capture OpenFoodFacts** (`apps/mobile/src/lib/openfoodfacts.ts`, `MICRO_MAP` 31 entrées) :
  conversion `*_100g` (grammes) → unité de la clé (g ×1 / mg ×1000 / µg ×1e6). **Garde vitamine A** :
  omise si l'unité OFF (`vitamin-a_unit`) n'est pas massique (ex. IU) → pas de valeur fausse. La clé
  `vitamin_a_ug` reste affichable/éditable (seed CIQUAL / admin).
- **Affichage** (`MicronutrientDetails.tsx`) : groupes Lipides / Minéraux / Vitamines étendus, unité
  `g` ajoutée au type `Unit`, `unitLabel` généralisé. **Present-only** conservé (aliment pauvre =
  rendu inchangé). **Formulaire admin** (`FoodEditScreen`) couvre les 31 (via `MICRONUTRIENT_KEYS`).

### Technique / Notes
- **Aucune migration** (colonne JSON `micronutrients`), **aucune dépendance native**, pas de checkpoint 🔴.
- i18n : +21 libellés mobile FR/EN (`nutrition.micros.labels.*`, parité **808/808**) + 21 libellés
  admin FR (`fr.foods.microNames`). Tests : shared **620**, mobile **42** (dont mapping OFF étendu +
  garde vit A IU). typecheck (3 workspaces) / lint (0 err) / build admin verts.
- **Écart de plan corrigé** : le découpage en 5 commits par tâche n'était pas viable (le typage
  exhaustif TS couple `MICRONUTRIENT_KEYS` au fixture `food-form.test.ts` et à l'indexation
  `fr.foods.microNames`) → **implémentation atomique en un commit**. `Unit` n'incluait pas `'g'`
  (supposé à tort dans le plan) → corrigé.
- **Valeur réelle** conditionnée à l'enrichissement du **seed CIQUAL** (US tracée) : un Nutella scanné
  reste pauvre (donnée absente d'OFF), c'est attendu. **Reste** : recette device.

## 14/07/2026 — Technique/Notes — Cadrage US « panel nutritionnel étendu » (spec validée)

Branche `feature/panel-nutritionnel-etendu`. **Cadrage uniquement (aucun code applicatif).**

### Ajouté
- **Spec** [panel-nutritionnel-etendu.md](docs/specs/functional/us/panel-nutritionnel-etendu.md),
  **validée par Florian** : étendre le panel micronutriments de 10 → 31 nutriments (AG mono/poly/trans
  + oméga-3/6/9, minéraux zinc/phosphore/cuivre/manganèse/sélénium/iode, vitamines A/E/K/B1/B2/B3/B5/
  B6/B7), stockés dans la colonne JSON `micronutrients` (**aucune migration**), captés depuis OFF
  (present-only, garde-fou unité vitamine A en IU). Décisions produit : périmètre complet, **pas de
  2ᵉ source** (USDA/CIQUAL par nom) pour l'instant.

### Modifié
- **TODO.md** : US « panel nutritionnel étendu » passée en cadrage (`[~]`, spec validée, reste
  plan → maquette → code) ; nouvelle US **« enrichir le seed avec les données CIQUAL détaillées »**
  tracée (prérequis à la valeur réelle du panel — les produits scannés OFF n'ont pas ces détails).

## 14/07/2026 — Corrigé + Modifié — Scan code-barres : échecs honnêtes + affichage nutritionnel enrichi

Branche `fix/scan-code-barres`. Investigation d'un « produit introuvable » au scan (Florian, adb
logcat + test direct de l'endpoint OFF). **Diagnostic** : ni OpenFoodFacts (HTTP 200 + données
complètes pour le Nutella `3017620422003`, quel que soit le User-Agent), ni notre parsing n'étaient
en cause. Le scan **fonctionne** (validé sur une bouteille Perrier physique) ; les échecs venaient de
scanner des **codes-barres à l'écran** (images Google / site OFF) → mauvaise lecture caméra → code
erroné réellement absent d'OFF. Le pot de Nutella lui-même ne scanne pas (surface courbée/brillante =
autofocus qui peine), ce n'est pas un bug.

### Corrigé
- **Messages d'échec de scan honnêtes** : `fetchOpenFoodFactsByBarcode` ne renvoie plus un `null`
  fourre-tout mais un **résultat typé** `OffLookup` (`found` / `notFound` / `incomplete` /
  `networkError` / `invalidCode`). L'écran de scan affiche désormais un message distinct :
  « Pas de connexion » (réseau), « Code-barres inconnu (`<code lu>`) » (avec le code, pour repérer
  une mauvaise lecture), ou « fiche sans calories ». Avant : tout tombait sur « produit introuvable ».
- Logique de décision isolée dans un helper **pur `interpretOffProduct`** (testable sans réseau).

### Modifié
- **Affichage nutritionnel au scan / dans le picker** : le `QuantityPanel` affiche maintenant la ligne
  **macros P/G/L** (mise à l'échelle en direct, motif repris de `nutrition-stats`), et **sucres /
  AG saturés / fibres** sont désormais **captés depuis OFF** (`mapProduct` + `OffFood` étendus),
  **stockés** à l'import (`importOpenFoodFactsFood`, au lieu de `null`) et affichés present-only.
  Les deux flux (scan + recherche texte du food-picker) passent ces champs au panneau.

### Technique / Notes
- **i18n** FR/EN : +3 clés `scan.error.*` (parité 787/787) ; macros réutilisent `nutrition.macros.*`
  (aucune nouvelle clé). Sucres/AGS/fibres réutilisent `food.custom.*`.
- Tests `packages`… → mobile `openfoodfacts.test.ts` : +5 tests sur `interpretOffProduct` (found +
  repli code-barres + sous-macros, notFound status 0, incomplete sans kcal / sans nom). 39/39 mobile.
- **100 % client** — aucune migration, aucune dépendance native, pas de checkpoint 🔴.
- **Point d'attention** : les produits déjà importés **avant** ce commit ont sucres/AGS/fibres à
  `null` en local → au re-scan ils remontent depuis le local sans ces champs ; les nouveaux scans ont
  tout. Logs de diagnostic temporaires (`[SCAN]…`) retirés. `apps/mobile/eas.json` **non commité**
  (contournement env local de Florian, contient des identifiants → hors git par convention).

## 14/07/2026 — Corrigé — Onglets du food-picker étirés en hauteur (régression `scrollable`)

Branche `fix/food-picker-onglets-scrollable`. Bug d'affichage remonté par Florian (capture) sur
l'écran « Ajouter un aliment » : l'onglet sélectionné (« Tous ») s'affichait comme une grande
barre orange occupant presque toute la hauteur de l'écran, libellé collé en haut, poussant la
liste des aliments vers le bas. Régression introduite par le passage des onglets en `ScrollView`
horizontal (commit `41e459b`).

### Corrigé
- [Segment.tsx](apps/mobile/src/components/Segment.tsx) (variante `scrollable`) : un `ScrollView`
  horizontal placé **directement** dans un flex colonne (`food-picker` `styles.screen`, `flex: 1`)
  s'étire sur toute la hauteur disponible, et comme `contentContainerStyle` garde
  `alignItems: stretch` par défaut, chaque onglet s'étire avec lui. Correctif : envelopper le
  `ScrollView` dans une `View` qui se cale sur la hauteur du contenu et porte désormais le cadre
  (bordure/rayon/fond) ; le `ScrollView` ne gère plus que le défilement horizontal. Le `style`
  `styles.viewport` passe de la `ScrollView` à la `View`.

### Technique / Notes
- Correctif **UI pur, 100 % client** — aucune migration, aucun cloud, pas de checkpoint 🔴,
  pas de chaîne i18n touchée.
- typecheck vert (tous workspaces), lint 0 erreur (4 warnings préexistants dans le smoke test
  charts, sans rapport), 619 tests shared verts. Pas de test unitaire ajouté : bug de mise en
  page RN sans logique testable. **Recette device validée par Florian le 14/07/2026** ✅ (barre
  d'onglets revenue à une hauteur d'une ligne, défilement horizontal OK).
- **Non committé dans cette passe** : la modification de [eas.json](apps/mobile/eas.json) (bloc
  `env` `EXPO_PUBLIC_*` au profil `preview`) toujours présente dans l'arbre — sujet distinct qui
  contredit la décision documentée (env via `eas env:push`), laissée de côté comme au commit
  précédent.

## 14/07/2026 — Modifié — Mise à jour du TODO rendue obligatoire à chaque `/commit`

Branche `fix/food-picker-onglets-scrollable`. Demande de Florian : rendre explicite, dans la
définition du workflow, que la commande `/commit` **doit** tenir à jour le suivi.

### Modifié
- [CLAUDE.md](CLAUDE.md) (section « Commits ») : la puce « coche le TODO.md » devient
  « **met à jour le TODO.md** — étape **obligatoire** à chaque commit & push » (cocher `[x]` ce
  qui est livré, passer en `[~]` ce qui est en cours, actualiser la date de « Dernière mise à
  jour »). Cohérent avec la section « Suivi — TODO.md » déjà présente.

### Technique / Notes
- Modification **documentaire uniquement** (Markdown) — aucun code applicatif touché, pas de
  lint/typecheck/tests pertinents.
- **Non committé dans cette passe** : une modification de [eas.json](apps/mobile/eas.json) (ajout
  d'un bloc `env` `EXPO_PUBLIC_*` au profil `preview`) présente dans l'arbre de travail. Sujet
  distinct, laissé de côté car il **contredit la décision documentée** (config env via
  `eas env:push`, `eas.json` sans bloc `env` — cf. TODO §URGENT) → à trancher avec Florian/Damien.

## 13/07/2026 — Corrigé — Onglets « Ajouter un aliment » qui passaient à la ligne

Branche `fix/food-picker-onglets-scrollable`. Sur l'écran food-picker, les 5 onglets
(Tous / Favoris / Récents / Recettes / Repas types) étaient rendus en `Segment` mode fixe
(`flex: 1`, sans `numberOfLines`) → « Repas types » débordait sur 2 lignes (affichage disgracieux,
remonté par Florian, capture device).

### Corrigé
- [food-picker.tsx](apps/mobile/src/app/food-picker.tsx) : ajout de la prop **`scrollable`** au
  `Segment` des onglets → libellés à largeur intrinsèque, une seule ligne, défilement horizontal si
  débordement (même patron que les filtres running). Aucune autre modification.

### Technique / Notes
- Le composant [Segment](apps/mobile/src/components/Segment.tsx) prévoyait déjà ce mode (prop
  documentée « libellés nombreux/longs ») — correctif d'une ligne, aucun changement du composant.
- typecheck vert (3 workspaces) ; lint mobile 0 erreur (4 warnings préexistants hors périmètre).
  **100 % client, aucune migration, aucune dépendance native.** Reste : recette device.

## 13/07/2026 — Corrigé — Fuite inter-piliers dans « Mes programmes » muscu

Branche `fix/programmes-filtre-pilier` (depuis `dev`). Bug remonté par Florian en recette :
côté **Musculation**, l'écran « Mes programmes » **et** la « Bibliothèque » affichaient aussi les
programmes **running**.

### Corrigé
- [apps/mobile/src/app/programs/index.tsx](apps/mobile/src/app/programs/index.tsx) : l'écran muscu
  ne passait **jamais** le pilier → `useMyPrograms()` sans argument (tous piliers) et `filters` sans
  `pillar`. Fix (~2 lignes, miroir de l'écran running) : `useMyPrograms('strength')` + `pillar:
  'strength'` toujours présent dans `ProgramLibraryFilters` (avec ou sans filtre de niveau).

### Technique / Notes
- Bug **unidirectionnel** : l'écran running filtrait déjà correctement (`useMyPrograms('running')` +
  `useProgramLibrary({ pillar: 'running' })`) — confirmé par Florian. Seul le muscu était touché.
- typecheck mobile vert. **100 % client, aucune migration, pas de checkpoint 🔴.** **Reste** : vérif device.

## 13/07/2026 — Feat — US 8.5 : gestion de la base d'aliments (CRUD éditorial admin)

Branche `feature/8.5-gestion-aliments` (depuis `dev` `63acf79`). Cadrage complet
(brainstorming → spec → plan) puis exécution TDD. Complément unitaire de l'import CSV (8.6) :
lister / rechercher / créer / éditer / archiver les aliments éditoriaux (`owner_id NULL`,
`source library`).

### Ajouté
- **`@wellness/shared/food-form.ts`** : `validateFoodInput(input)` pur — valide/mappe les champs
  saisis (nom FR/EN requis, `category` ∈ enum, kcal requis ≥ 0, macros/micros optionnels ≥ 0,
  virgule décimale tolérée, seules les clés micros fournies conservées via `micronutrientsSchema`),
  renvoie `values` typé ou `errors` par champ. **9 tests** (TDD).
- **Migration** `20260713160000_admin_editorial_foods_rls.sql` : rouvre `insert`/`update` sur
  `foods` + `food_translations` à `is_content_editor()` (patron identique 8.2/8.4).
- **Admin** : couche `data/foods.ts` étendue (`listEditorialFoods`, `getFood`, `saveFood`
  **insert/update ciblé**, `archiveFood` soft-delete) ; écran **liste** `FoodsScreen`
  (recherche + filtre catégorie + « Nouvel aliment » + « Importer un CSV » + éditer/archiver) ;
  écran **formulaire** `FoodEditScreen` (création/édition, nom FR/EN, catégorie, kcal, 6 macros,
  10 micros, `import_key` en lecture seule, erreurs par champ) ; i18n admin FR.

### Modifié
- **Routing « Aliments »** réorganisé : la **liste devient le hub** (`/foods` → `FoodsScreen`) ;
  l'import CSV 8.6 déplacé en `/foods/import` (+ lien retour) ; `/foods/new` et `/foods/:id` →
  `FoodEditScreen`. Nav « Aliments » inchangée (pointe `/foods`).

### Technique / Notes
- 🔴 **La migration RLS répare aussi l'US 8.6** : la RLS d'origine
  ([20260706150001_food_rls.sql](supabase/migrations/20260706150001_food_rls.sql)) n'autorisait
  l'écriture que pour `owner_id = auth.uid()` — l'écriture **éditoriale** (`owner_id NULL`) n'avait
  jamais été rouverte aux éditeurs de contenu (contrairement aux exos/programmes). Sans elle,
  **ni 8.5 ni l'import 8.6** ne peuvent écrire l'éditorial. La note « RLS inchangée » de la spec 8.6
  §4 était **erronée** — corrigée ici.
- **Pas de `db:types`, pas de sync rule à redéployer** (RLS seule ; archivage via `deleted_at` déjà
  couvert). Pas de dépendance native. 100 % client admin.
- **update ciblé à l'édition** (et non upsert) : ne touche que les colonnes du formulaire →
  `portions` / `import_key` / `barcode` intacts.
- Vérifs : typecheck (tous) OK, shared **619** tests (dont 9 nouveaux), mobile 34, lint 0 erreur,
  build admin OK. Revue du diff : miroir du CRUD exos 8.2 (déjà relu), validateur testé.
- **Reste 🔴 Florian** : appliquer la migration RLS foods (**débloque 8.5 + 8.6**) puis recette
  (créer / éditer / archiver un aliment ; ré-import CSV 8.6 fonctionnel ; affichage mobile).
- Différé : validation des aliments signalés (→ 8.7), restauration d'un archivé, édition des
  `portions`, audit (→ 8.10).

## 13/07/2026 — Feat — US 8.6 : import d'aliments par CSV (CIQUAL), back-office

Branche `feature/8.6-import-csv-ciqual` (depuis `dev` `81064a5`). Cadrage complet
(brainstorming → spec → plan) puis exécution TDD. Remplissage en masse de la base d'aliments
éditoriale depuis un CSV formaté (FR/EN + macros + micros).

### Ajouté
- **`@wellness/shared/food-csv.ts`** : `parseFoodCsv(rows)` pur — validation/mapping ligne à ligne
  (requis, `category` ∈ enum, nombres ≥ 0, `import_key` unique intra-fichier, micros via
  `micronutrientsSchema`), sépare `valid` / `errors` (ligne, champ, raison). **8 tests** (TDD).
- **Migration** `20260713150000_foods_import_key.sql` : colonne `foods.import_key` + index unique
  (arbitre `on conflict` de l'upsert idempotent ; NULL illimités pour OFF/custom). `database.types`
  régénéré (`import_key`).
- **Admin** : écran **Import CSV** (`screens/FoodImportScreen.tsx`) — upload → papaparse → aperçu
  (N valides / M erreurs) → confirmation → rapport (créés / mis à jour) + modèle CSV téléchargeable ;
  couche `data/foods.ts` (`importFoods` upsert `foods` par `import_key` + `food_translations` FR/EN,
  `owner_id NULL`, `source library`) ; route `/foods` + nav « Aliments » gated `content_editor` ;
  i18n admin FR ; dépendance `papaparse`.

### Technique / Notes
- Contrat CSV (spec §3) : `import_key, name_fr, name_en, category, kcal_per_100g` requis ;
  macros + 10 micros (`MICRONUTRIENT_KEYS`) optionnels. `portions` hors v1.
- Vérifs : typecheck (tous) OK, shared **610** tests, mobile 34, lint 0 erreur, build admin OK.
- **Checkpoint 🔴 déjà appliqué** (migration cloud + `db:types`, 13/07). **Reste** : recette (import
  d'un échantillon CIQUAL réel, ré-import idempotent, vérif base + affichage mobile) + relecture Damien.
- Différé : 8.5 (CRUD/édition unitaire), annulation/rollback d'import, import depuis le mobile.

## 13/07/2026 — Feat — Détail programme : séances repliables (expansion inline, muscu + running)

Branche `feature/detail-programme-seances-repliables` (depuis `dev` `abaf5df`). Cadrage complet
(brainstorming → spec → plan, maquette écartée / validation device — précédent 1.15). Exécution
TDD, 5 tâches, commits par tâche.

### Ajouté
- **`components/CollapsibleCard.tsx`** : carte de séance repliable réutilisable (en-tête tappable
  titre + résumé + chevron, toggle local éphémère, `footer` toujours visible, animation
  `LayoutAnimation` sobre dégradable). Test unitaire (`+1`, replié→déplié).
- i18n `programs.detail.exerciseCount` (pluriel `_one`/`_other`) fr + en.

### Modifié
- **Muscu** ([programs/[id].tsx](../apps/mobile/src/app/programs/[id].tsx)) : `SessionCard` via
  `CollapsibleCard` — séances **repliées par défaut**, ouverture **indépendante** ; en-tête =
  nom + « N exercices » ; bouton **« Démarrer »** en `footer` (accessible replié). Styles morts
  supprimés (`sessionCard`, `sessionName`).
- **Running** ([running-programs/[id].tsx](../apps/mobile/src/app/running-programs/[id].tsx)) :
  `RunningSessionCard` via `CollapsibleCard` — résumé d'en-tête = **type + cible** (« Endurance ·
  8 km ») ; détail (puces type/cible + allure) au dépli. Pas de bouton par séance (inchangé).

### Corrigé
- **Nom d'exercice tronqué** (bug #1) dans `PlanRow` (muscu) : nom et objectifs passent sur **2
  lignes** (objectifs sous le nom) au lieu de `space-between` sur une ligne → fini le « T… ».

### Technique / Notes
- Vérifs vertes : typecheck (tous), mobile **34** tests (10 suites), lint **0 erreur**, i18n
  **796/796**. **100 % client** : aucune donnée/migration/dépendance native. Pas de checkpoint 🔴.
- **Reste** : recette **device** (risque visuel — repli/dépli, nom 2 lignes, Démarrer replié) +
  relecture Damien avant merge.

## 13/07/2026 — Fix — Typecheck `running-history` au vert (route typée)

Branche `fix/finitions-affichage-profils` (depuis `dev` `bbbf82d`). Lot « finitions ».

### Corrigé
- **2 erreurs typecheck préexistantes** dans `app/running-history/index.tsx` : les
  `router.push('/run/summary?id=' + …)` (string brute rejetée par le typage de route
  expo-router) passent en **forme objet typée** `{ pathname: '/run/summary', params: { id } }`,
  alignée sur l'usage existant de `run/active.tsx`. **Typecheck 100 % vert** sur tous les workspaces.

### Technique / Notes
- **Vérification (pas de correctif nécessaire)** : `nutrition-profile.tsx` et `running-profile.tsx`
  ne souffrent PAS du bug « affichage vide » (contrairement à `profile.tsx`/`infos.tsx`) — ils
  lisent leur donnée de façon **réactive** (consts dérivés à chaque rendu, `paceText` retombe sur
  la valeur persistée), sans snapshot `useState` au montage. Point de suivi levé.
- Vérifs vertes : typecheck OK, mobile 33 tests, lint 0 erreur.
- Reste ouvert : bug **détail programme** (nom tronqué + séance non cliquable) → à cadrer.

## 13/07/2026 — Fix — Rejeu onboarding : crash, profil affiché vide, date de naissance −1

Branche `fix/onboarding-rejeu-profil` (depuis `dev` `92ef71e`). Correction du bug bloquant
« crash + non-enregistrement au 2ᵉ passage de l'onboarding depuis le profil » + finitions.
Diagnostic device via `adb logcat` (crash JS) puis logs `console.log` temporaires (base saine
mais affichée vide) — cause racine confirmée à chaque étape, pas de correctif à l'aveugle.

### Corrigé
- **Crash au « Terminer » du rejeu** (`TypeError: undefined is not a function` dans
  `OnboardingSummary`) : `active_pillars` triple-encodé était relu comme **chaîne** typée
  `Pillar[]` → `activePillars.map` plantait le rendu. `parseJsonColumn` gagne un **validateur
  de forme** optionnel (`isValid`) et déballe jusqu'à 3 niveaux ; `settings-repository` valide
  que `active_pillars` est bien un tableau de piliers (`isPillarArray`) aux 2 points de lecture.
- **Profil affiché vide alors que plein en base** (bug d'affichage, données bien enregistrées) :
  `profile.tsx` et `(onboarding)/infos.tsx` figeaient leur formulaire depuis `useProfile()` **au
  montage**, or `useQuery` (PowerSync) renvoie `null` au 1ᵉʳ rendu puis les données un tick plus
  tard → champs vides jamais re-remplis. Ajout d'un **gate sur `isLoading`** (composant formulaire
  monté après résolution de la requête) sur les 2 écrans.
- **Perte de données au rejeu** : garde anti-écrasement (prénom / sexe / date) dans `infos.tsx`
  (à l'image de poids/taille) — un champ non modifié réécrit la valeur du profil, jamais un blanc.
- **Date de naissance enregistrée à J−1** : `toDate(...).toISOString()` convertissait une date à
  minuit **local** en **UTC** (décalage −1 j en fuseau UTC+). Nouveau helper pur **`toIsoDate`**
  (formatage depuis les composants locaux, validé) ; `infos.tsx` + `profile.tsx` l'utilisent.
- **UI « Modifier le profil »** : sélecteur d'objectif en mode `scrollable` (une ligne) — plus de
  retour à la ligne disgracieux.
- **Note récap onboarding** obsolète (« synchro arrive bientôt ») → « profil enregistré et
  synchronisé de façon sécurisée » (fr + en), la synchro PowerSync étant active.

### Ajouté
- `packages/shared/src/age.ts` : `toIsoDate(day, month, year)` (+3 tests) — date-only ISO sans
  décalage de fuseau.
- `packages/shared/src/json-column.ts` : paramètre `isValid` sur `parseJsonColumn` (+3 tests,
  triple-encodage + rejet de forme).
- `docs/specs/technical/dev-build-android-local.md` : procédure complète **dev build Android en
  local** (JDK 17, SDK/NDK, `gradle.properties`, `ANDROID_HOME`/`local.properties`, conflit de
  signature, dépannage) — pour que Damien reproduise le setup.

### Fichiers touchés
`packages/shared/src/{age,json-column}.ts` (+ tests), `settings-repository.ts`,
`app/(onboarding)/infos.tsx`, `app/profile.tsx`, `i18n/locales/{fr,en}.json`,
`docs/specs/technical/dev-build-android-local.md`.

### Technique / Notes
- Vérifs vertes : shared **602** tests, mobile **33**, lint **0 erreur**, parité i18n **794/794**.
- **Point d'attention (hors périmètre)** : `nutrition-profile.tsx` et `running-profile.tsx`
  utilisent probablement le même schéma d'init au montage → même risque d'affichage vide à
  l'ouverture ; à corriger dans un lot dédié (même gate `isLoading`).
- **2 erreurs typecheck préexistantes** dans `app/running-history/index.tsx` (déjà sur `dev`,
  non introduites ici) — à traiter à part.
- 100 % client : aucune migration, aucun redéploiement de sync rules, aucune dépendance native.

## 13/07/2026 — US 8.4 — Admin : constructeur de programmes éditoriaux (muscu + running)

Branche `feature/admin-8.4-constructeur-programmes`. Back-office `apps/admin` : composer des
programmes éditoriaux (programme → séances → exos muscu | cibles running), bilingue FR/EN,
brouillon/publié, réorganisation glisser-déposer, archivage. **Aucun changement mobile ni sync rules.**

**Ajouté**
- Migration `supabase/migrations/20260713140000_admin_editorial_programs_rls.sql` : RLS d'écriture
  éditoriale (DROP+CREATE `insert`/`update`) sur `programs` / `program_translations` / `sessions` /
  `exercise_plans`, ouverte aux éditeurs de contenu via `public.is_content_editor()` (réutilisée de 8.2 ;
  non recréée). SELECT inchangé. 🔴 à appliquer manuellement (SQL Editor) puis `db:types`.
- Couche data `apps/admin/src/data/programs.ts` (supabase-js, éditorial `owner_id NULL`) : list/get,
  create/updateMeta/setStatus/archive (soft-delete cascade), séances (add/update/remove/reorder),
  exos (add/update/remove/reorder). *Pillar-aware*.
- Composants `apps/admin/src/components/SortableList.tsx` (drag & drop générique @dnd-kit, clavier,
  contrôlé) + `ExercisePicker.tsx` (exercices éditoriaux **publiés** — évite les références orphelines).
- Écrans `apps/admin/src/screens/ProgramsScreen.tsx` (liste : recherche, filtres pilier/statut,
  publier/brouillon, archiver), `ProgramCreateScreen.tsx` (création : pilier + nom FR/EN requis +
  niveau/objectif/durée), `ProgramEditScreen.tsx` (composition : métadonnées bilingues, séances
  ajout/nommage auto A/B/C/réorg/retrait, muscu = exos via picker + cibles séries/reps/charge/repos,
  running = type/distance/durée, publication gated sur le nom serveur).
- Dépendances `@dnd-kit/core` ^6.3.1, `@dnd-kit/sortable` ^10.0.0, `@dnd-kit/utilities` ^3.2.2 (`apps/admin`).
- Routes `/programs`, `/programs/new`, `/programs/:id` (gated `RequireContentEditor`) + entrée nav Programmes.
- Bloc i18n `fr.programs.*`.

**Corrigé (revues qualité)**
- Data layer : filtre `deleted_at` sur les jointures de traductions (nom obsolète ne réapparaît plus,
  aligné sur le repo mobile) ; coercion `numeric` `target_weight_kg` → nombre ; idempotence des cascades
  (`.is('deleted_at', null)`) ; reorder bornés au parent ; JSDoc retry.
- Écran composition : anti-clobber seed-once des sous-composants (une saisie en cours n'est plus écrasée
  par un changement de select voisin) ; réorg plus jamais silencieusement ignorée pendant un write en vol ;
  publication gated sur le nom **serveur** (pas la saisie locale non enregistrée) ; valeurs numériques
  négatives rejetées (→ null) ; `busy` toujours relâché (try/finally). Parité durée ≥ 1 côté création.

**Technique / Notes**
- Brouillons non exposés au mobile : `programs` filtre déjà `status='published'` dans les sync rules →
  **aucun redéploiement**. Séances/exos d'un brouillon restent orphelins invisibles (parent absent), même
  pattern inoffensif que les traductions d'exercices en 8.2.
- Revues : couche data (qualité), écran composition (qualité, 2 Critiques corrigés), revue finale (RAS).
- Périmètre : cadrage `docs/specs/functional/us/8.4-…` + `docs/plans/8.4-…` (commit `37ff6d0`).

## 13/07/2026 — Idées : consignation de 16 pistes produit dans IDEAS.md

Branche `feature/admin-8.4-constructeur-programmes`. Session de captation d'idées produit : après
analyse du cadrage (roadmap V0.1→V1.1, « hors périmètre », vision) pour écarter les doublons, ajout
de 16 idées neuves dans la boîte de dépôt. **Documentation uniquement — aucun code applicatif touché.**

### Ajouté
- **IDEAS.md** — 16 entrées 🆕 datées du 13/07/2026, en tête de « À trier » : bilan hebdo/mensuel
  auto, rétrospective annuelle « Wrapped », rappels intelligents contextuels, carte de séance/course
  partageable en image, programme de parrainage, reconnaissance de repas par photo, substitution
  d'aliments, jeûne intermittent, substitution d'exercices, détection de plateau + deload, météo
  avant sortie planifiée, journal bien-être/humeur, journal blessures/douleurs, widget écran
  d'accueil Android, commandes/annonces vocales en séance, langues supplémentaires (ES/DE).
- Chaque entrée signale explicitement les **chevauchements avec le cadrage** (ce qui est déjà prévu
  vs neuf) et tisse des liens `[[…]]` vers les idées connexes (analyses croisées, module coach, IA…).

### Technique / Notes
- Commit **volontairement limité à IDEAS.md**. `apps/mobile/eas.json` est modifié dans l'arbre de
  travail (ajout de variables d'env au profil `preview` : URL Supabase, clé **anon publishable**,
  URL PowerSync) mais **non committé ici** : sujet distinct (config de build, hors périmètre idées).
  Valeurs publiques par conception (pas de `service_role` ni de secret) ; à trancher par les devs
  (valeurs en dur vs secrets EAS).

## 13/07/2026 — Admin : CRUD des exercices éditoriaux + brouillon/publié (US 8.2)

Branche `feature/admin-8.2-exercices-crud`. Gestion des exercices éditoriaux depuis le back-office :
liste (recherche + filtres), création/édition bilingue (FR+EN requis), brouillon/publié, archivage.
⚠️ **Checkpoint cloud** : migration RLS/status + redéploiement des sync rules PowerSync + `db:types`
à réaliser par Florian (bon projet) avant recette. **Aucun code mobile modifié.**

### Ajouté
- **Migration** `supabase/migrations/20260713110000_admin_editorial_exercises.sql` : colonne
  `exercises.status` (text not null default `'published'`, check `draft`/`published`). RLS réécrite en
  **DROP+CREATE** (Postgres n'a pas `CREATE OR REPLACE POLICY`) : `exercises_select`
  (`owner_id = auth.uid()` **ou** éditorial publié **ou** `is_admin()`), `exercises_insert`/`exercises_update`
  (self **ou** `is_admin()`) ; `exercise_translations_insert`/`exercise_translations_update` rouverts à
  `is_admin()`. Défaut `'published'` → seed/customs existants restent visibles.
- **`apps/admin/src/data/exercises.ts`** : couche data (`listEditorialExercises`, `getExercise`,
  `saveExercise` — upsert exercice + 2 traductions séquentiel, UUID client —, `setStatus`,
  `archiveExercise` — soft-delete exercice + traductions). Typée via `Database`, réutilise `MUSCLE_GROUPS`.
- **`apps/admin/src/screens/ExercisesScreen.tsx`** : liste (nom FR, groupe traduit, badge statut, date),
  recherche par nom, filtres groupe + statut, « Nouvel exercice », actions éditer / publier-brouillon /
  archiver (confirmation) ; états loading/vide/erreur.
- **`apps/admin/src/screens/ExerciseEditScreen.tsx`** : formulaire créer/éditer (groupe, équipement
  optionnel, **nom FR + nom EN requis**, instructions FR/EN optionnelles, statut — brouillon par défaut).
- **Routes** `/exercises`, `/exercises/new`, `/exercises/:id` sous `RequireAdmin` + `AdminLayout`.
- **i18n** `apps/admin/src/i18n/fr.ts` : bloc `exercises.*` (liste, colonnes, formulaire, statuts,
  actions, erreurs, confirmations, noms de groupes).

### Modifié
- **`packages/shared/src/database.types.ts`** : ajout **manuel** de `status` à `exercises`
  (Row/Insert/Update), pour que les requêtes admin compilent avant l'apply cloud (idempotent `db:types`).
- **`docs/specs/technical/powersync-sync-rules.yaml`** : bucket `shared_content`, `exercises` filtre
  désormais `status = 'published'` (masque les brouillons éditoriaux au mobile, même pattern que
  `programs`). `exercise_translations` sans filtre status (parent brouillon non synchronisé).
- **`apps/admin/src/components/AdminLayout.tsx`** : entrée de nav « Exercices » désormais cliquable
  (NavLink) au lieu de « bientôt ».

### Technique / Notes
- Sécurité : clé anon uniquement (jamais `service_role`) ; RLS = frontière ; soft-delete uniquement ;
  brouillons éditoriaux jamais exposés au mobile (filtrés au niveau sync).
- 🔴 Reste à faire par Florian : appliquer la migration + redéployer les sync rules + `db:types` + recette.

## 13/07/2026 — Admin Fondation-2 : rôles + gate d'accès (US 8.9)

Branche `feature/admin-f2-roles-gate`. Restreint le back-office aux administrateurs (table
`user_roles` + RLS + gate) et ajoute une gestion minimale des rôles réservée au super_admin.
⚠️ **La migration est un checkpoint cloud** (apply manuel + `db:types` + bootstrap par Florian
avant que le gate soit testable en navigateur).

### Ajouté
- **Migration** `supabase/migrations/20260713100000_admin_user_roles.sql` : table `public.user_roles`
  (`role` = text + check `super_admin`/`content_editor`/`moderator`, soft delete `deleted_at`), index
  **unique partiel** `(user_id, role) WHERE deleted_at IS NULL` (ré-attribution possible), trigger
  `set_updated_at`. Fonctions `is_admin()`/`is_super_admin()` en **`SECURITY DEFINER STABLE SET
  search_path = public`** (évitent la récursion des policies). RLS : select (propre ligne ou
  super_admin), insert/update/delete (super_admin). **Hors publication PowerSync** (table web/admin).
- **`packages/shared/src/database.types.ts`** : ajout **manuel** de l'entrée `user_roles`
  (Row/Insert/Update/Relationships) + fonctions `is_admin`/`is_super_admin`, pour que
  `supabase.from('user_roles')` compile avant l'apply cloud (idempotent avec un futur `db:types`).
- **`apps/admin/src/data/roles.ts`** : couche data (`AdminRole`, `ADMIN_ROLES`, `fetchMyRoles`
  tolérant aux erreurs, `listRoles`, `grantRole` en update-puis-insert pour réactiver un rôle
  soft-deleted, `revokeRole` en soft-delete).
- **Contexte rôles** : `rolesContext.ts`, `RolesProvider.tsx`, `useRoles.ts` — charge les rôles
  après session (recharge au changement d'utilisateur), expose
  `roles/isAdmin/isSuperAdmin/rolesLoading/rolesError` ; erreur ⇒ non-admin (pas de crash).
- **`RequireAdmin.tsx`** : gate à l'intérieur de `RequireAuth` — spinner pendant le chargement,
  shell si admin, sinon `AccessDenied` (pas de redirection `/login`).
- **`AccessDenied.tsx`** : écran FR (message + bouton Déconnexion).
- **`RolesScreen.tsx`** (super_admin) : liste des attributions actives (user_id, rôle, date
  JJ/MM/AAAA), formulaire d'attribution par `user_id` (UUID + select rôle, aide dashboard Supabase),
  révocation avec confirmation ; erreurs Supabase surfacées en FR, états de chargement.

### Modifié
- **`App.tsx`** : `RolesProvider` en racine ; groupe protégé `RequireAuth → RequireAdmin →
  AdminLayout` ; routes `/` (accueil) et `/roles` (super_admin only, sinon redirection `/`).
- **`AdminLayout.tsx`** : entrées de nav `NavLink` (Accueil + « Rôles » visible **uniquement si
  super_admin**), lien actif géré.
- **`i18n/fr.ts`** : libellés `accessDenied.*` et `roles.*`.

### Technique / Notes
- **Vérifications** : racine `typecheck` + `lint` **verts** (admin inclus, aucune régression
  mobile/shared) ; `apps/admin` build OK.
- **Sécurité** : clé anon uniquement (jamais `service_role`) ; RLS = frontière ; gate client = confort.
- **Checkpoint cloud (Florian)** : appliquer la migration (SQL Editor) → bootstrap du 1ᵉʳ super_admin
  (`insert ... select id, 'super_admin' from auth.users where email = ...`) → `npm run db:types` →
  recette navigateur.

## 13/07/2026 — Admin Fondation-1 : écran de connexion + shell protégé

Branche `feature/admin-f1-scaffold-auth`. Clôt la fondation-1 du back-office : login + shell
protégé opérationnels (conforme à `design/admin-f1/admin-f1.html`, thème clair, accent terracotta).

### Ajouté
- **`LoginScreen`** (`apps/admin/src/screens/`) : formulaire e-mail + mot de passe contrôlés,
  bouton « Se connecter » avec état de chargement, message d'erreur FR (`Identifiants incorrects`) ;
  succès → `navigate('/')` ; déjà connecté → `<Navigate to="/">`.
- **`AdminLayout`** (`apps/admin/src/components/`) : barre latérale sombre (Accueil actif + modules
  Exercices/Aliments/Programmes/Utilisateurs grisés « bientôt », non cliquables), entête avec titre,
  e-mail utilisateur et bouton **Déconnexion** (`signOut`), `<Outlet/>`.
- **`HomePlaceholder`** (`apps/admin/src/screens/`) : message « Back-office — bientôt » + grille des
  futurs modules (non cliquables) + badge lots à venir.
- **Router** (`App.tsx`) : `/login` public ; groupe protégé (`RequireAuth` → `AdminLayout`) avec
  `/` → `HomePlaceholder` ; route `*` → redirection `/`. `AuthProvider` en racine.

### Technique / Notes
- **Vérifications** : `apps/admin` build OK ; racine `typecheck` + `lint` **verts** (admin inclus),
  aucune régression mobile/shared ; suites de tests inchangées. Aucune clé réelle (`.env.example` vide).
- **Flux runtime** (login effectif) nécessite un `.env` avec l'URL + la clé anon Supabase — non
  exécutable sans les identifiants (recette navigateur côté Florian).

## 13/07/2026 — Admin Fondation-1 : contexte d'auth Supabase + RequireAuth

Branche `feature/admin-f1-scaffold-auth`.

### Ajouté
- **Contexte d'authentification** (`apps/admin/src/auth/`) : `AuthProvider` (`getSession()` au montage
  + abonnement `onAuthStateChange`, nettoyé au démontage ; expose `session`, `user`, `loading`,
  `signIn` = `signInWithPassword`, `signOut`), `context.ts` (contexte + type), `useAuth.ts` (hook, dans
  un module dédié pour la compatibilité fast-refresh).
- **`RequireAuth`** (garde de route) : écran de chargement (spinner) tant que la session n'est pas
  restaurée, redirection `<Navigate to="/login">` si non connecté, sinon `<Outlet/>`. F1 =
  authentification seule (gate par rôle en F2).
- **Keyframe `admin-spin`** (`index.css`) pour le spinner de chargement.

## 13/07/2026 — Admin Fondation-1 : client Supabase web + libellés FR

Branche `feature/admin-f1-scaffold-auth`.

### Ajouté
- **Client Supabase web** (`apps/admin/src/lib/supabase.ts`) : `createClient<Database>` typé via
  `@wellness/shared`, env `import.meta.env.VITE_SUPABASE_URL/ANON_KEY`, `auth: { persistSession,
  autoRefreshToken }` (session `localStorage` par défaut). Garde-fou runtime si env manquante.
  **Clé anon uniquement** (jamais `service_role`).
- **`.env.example`** (`apps/admin/`) : `VITE_SUPABASE_URL=` / `VITE_SUPABASE_ANON_KEY=` **vides**
  (couvert par `.gitignore` racine ; jamais de vraie clé).
- **Libellés FR centralisés** (`apps/admin/src/i18n/fr.ts`) : login, erreurs, layout, placeholder
  (aucune chaîne d'UI en dur ailleurs).

## 13/07/2026 — Admin Fondation-1 : scaffold Vite + React + TypeScript (`apps/admin`)

Branche `feature/admin-f1-scaffold-auth`. Transformation du stub `apps/admin` en app web
**Vite + React + TypeScript** intégrée au monorepo npm workspaces. **100 % client web, aucune
migration, aucun cloud.**

### Ajouté
- **App web `@wellness/admin`** : `package.json` réécrit (deps `react`/`react-dom` **19.2.3 exact**
  — alignées mobile, `react-router-dom` ^7, `@supabase/supabase-js` ^2.110.0, `@wellness/shared` `*` ;
  devDeps `vite` ^7, `@vitejs/plugin-react`, `typescript` ~5.6.3, types React, ESLint flat web React).
  Scripts `dev` / `build` (`tsc -b && vite build`) / `preview` / `typecheck` / `lint`.
- **Config** : `vite.config.ts` (`@vitejs/plugin-react`), `index.html` (`#root` + `main.tsx`),
  `tsconfig.json` réécrit (extends base ; `lib` DOM+DOM.Iterable+ESNext, `jsx` react-jsx,
  `moduleResolution` bundler, `noEmit`, `include ["src"]`), `eslint.config.js` (flat, react-hooks +
  react-refresh + typescript-eslint), `src/vite-env.d.ts` (typage `import.meta.env` `VITE_*`).
- **Socle UI** : `src/theme.ts` (tokens couleurs thème clair, accent terracotta `#dd6e40`),
  `src/index.css` (variables CSS + reset), `src/main.tsx` (`createRoot` + `StrictMode`),
  `src/App.tsx` minimal (scaffold).

### Supprimé
- Ancien stub `apps/admin/src/index.ts`.

### Technique / Notes
- **Intégration monorepo** : `apps/admin` build OK ; racine `typecheck` + `lint` **verts** (admin
  inclus via `--workspaces --if-present`) ; aucune régression mobile/shared. `vite` 7.3.6 imbriqué
  dans `apps/admin` (le root garde un `vite` 5.x transitif hoisté, sans impact).

## 13/07/2026 — Suppression de programmes & de séances (muscu + course)

Branche `feature/suppression-programmes-seances`. Permet de supprimer un programme
(muscu **si possédé** + course) et une séance depuis l'app, proprement (cascade planning,
désactivation si actif, confirmations). **100 % client, soft delete, aucune migration, aucune
dépendance native, offline-first, i18n FR/EN à parité.**

### Ajouté
- **Variante `Button` `destructive`** (`apps/mobile/src/components/Button.tsx`) — fond plein
  `colors.danger`, texte/spinner `accentText` ; même API (label/loading/disabled), a11y conservée.
- **Bouton « Supprimer le programme »** sur les écrans détail muscu
  (`app/programs/[id].tsx`, **uniquement si `isOwned`**) et course (`app/running-programs/[id].tsx`,
  tous possédés) : confirmation `Alert` (titre = nom, message `deleteConfirm`), garde anti-double-tap
  + état `deleting` (loading), `deleteProgram` puis `router.replace` vers la liste ; en cas d'erreur,
  `Alert` non bloquant et maintien sur l'écran.
- **Confirmation avant suppression d'une séance** dans les deux éditeurs
  (`components/programs/SessionEditor.tsx`, `components/running/RunningSessionEditor.tsx`) :
  `Alert.alert(nom séance, removeSessionConfirm, [Annuler, Supprimer(destructive)])` autour de
  `removeSession` (auparavant suppression immédiate sans confirmation).
- **i18n FR/EN** (parité) — `programs.detail.{delete,deleting,deleteConfirm,deleteError,
  deleteErrorMessage}`, `programs.edit.removeSessionConfirm`, `running.program.{delete,deleting,
  deleteConfirm,deleteError,deleteErrorMessage,removeSessionConfirm}`.

### Modifié
- **`deleteProgram` durci** (`data/repositories/program-repository.ts`) — enveloppe désormais dans
  une **`writeTransaction`** le passage `is_active=0` (si le programme est actif) **puis** le
  soft-delete du programme, dans cet ordre impératif (jamais de ligne soft-deletée restée active,
  cohérent avec `activateProgram` qui filtre `is_active=1 AND deleted_at IS NULL`). Ajoute une
  **cascade `planned_sessions`** owner-scopée par `program_id` (nettoie les entrées de planning
  orphelines). La cascade existante (séances → `exercise_plans` → `program_translations`) est
  préservée. Idempotent (`deleted_at IS NULL`).
- **`removeSession` durci** — ajoute une **cascade `planned_sessions`** owner-scopée par
  `session_id`, en plus de la cascade `exercise_plans` existante.

### Technique / Notes
- Owner résolu via `currentUserId()` ; timestamps UTC ; écritures locales (PowerSync synchronise
  ensuite). Aucune régression des cascades existantes. typecheck/lint/tests verts (595 tests shared).
- Hors périmètre : hard delete, corbeille/restauration, multi-sélection.

## 13/07/2026 — Notifications locales : rappel série en danger, Ne pas déranger, gestion par type (US 2.6/2.8/1.17)

Branche `feature/notifications-v0.6`. Rappel local « série en danger » (2.6), fenêtre **Ne pas
déranger** configurable + plafond quotidien (2.8), **gestion par type** depuis les Réglages (1.17).
**Une seule dépendance native ajoutée** (`expo-notifications`), **aucune migration** (colonne texte
`user_settings.notifications` enrichie), offline-first, i18n FR/EN à parité.

### Ajouté
- **Logique pure (`@wellness/shared/notifications.ts`)** — interface `NotificationPrefs`
  (`streakDanger`, `reminderHour`, `dndEnabled`, `dndStartHour`, `dndEndHour`, `maxPerDay`) ;
  `defaultNotificationPrefs()` (`true/20/true/22/7/3` — `reminderHour=20` volontairement hors DND
  `[22,7)`) ; `parseNotificationPrefs()` **tolérant** (null/`{}`/ancien `Record<string,boolean>` →
  défauts, heures bornées 0-23, `maxPerDay≥1`) ; `isWithinDnd()` (fenêtre simple **et** enjambant
  minuit) ; `shouldScheduleStreakReminder()` ; `canScheduleMore()`. **Couverture Vitest** (défauts,
  bornes, DND minuit, règle streak, max/jour).
- **Wrapper natif (`apps/mobile/src/lib/notifications.ts`)** — API **expo-notifications SDK 57** :
  `ensurePermissionAndChannel()` (canal Android `reminders`, get/request permissions, retourne
  `granted`), `scheduleStreakReminder(date, content)` (trigger `DATE`, identifiant stable
  `STREAK_REMINDER_ID` → idempotent), `cancelStreakReminder()`, `setNotificationHandler` (affichage
  au premier plan). Permission refusée / module indisponible = **no-op silencieux** (jamais de throw).
- **Repository + scheduler (`notification-repository.ts`)** — `useNotificationPrefs()` (prefs
  réactives), `updateNotificationPrefs(current, patch)` (merge + `updateSettings`),
  `useStreakReminderScheduler()` : (re)planifie/annule selon `activeToday` (`useStreakData`) + prefs,
  au montage / changement / retour au premier plan (`AppState`, abonnement nettoyé au démontage).
- **Réglages (`settings.tsx`)** — sections « Notifications » (Switch rappel streak + `HourStepper`
  heure de rappel) et « Ne pas déranger » (Switch + steppers début/fin), suivant la maquette et le
  thème sombre. `HourStepper` : sélecteur d'heure 0-23 **pur JS** (boucle modulo 24, a11y), aucune
  dépendance native. Bandeau informatif si permission système refusée (non bloquant).
- **Init (`_layout.tsx`)** — montage de `useStreakReminderScheduler()` dans `RootNavigator`
  (permission + canal à l'init, (re)planification à l'ouverture).
- **i18n** — `settings.notifications.*` + `notifications.streakDanger.{title,body}` FR **et** EN à parité.

### Modifié
- **`@wellness/shared/settings.ts`** — colonne `notifications` : `z.record(z.string(), z.boolean())`
  → schéma typé `notificationPrefsSchema` (`.default(defaultNotificationPrefs())`). **Sans migration**
  (colonne texte). `settings.test.ts` adapté (nouvelle forme + rejet d'heure hors bornes).
- **`settings-repository.ts`** — lecture `notifications` via
  `parseNotificationPrefs(parseJsonColumn(row.notifications, null))` ; défauts d'insertion via
  `defaultNotificationPrefs()`.

### Technique / Notes
- `expo-notifications@~57.0.3` (aligné SDK 57) + plugin `app.json` + permission Android
  `POST_NOTIFICATIONS`. `owner`/`projectId` inchangés.
- **Nouveau build requis** (dépendance native) → recette device à faire (permission, rappel, DND,
  toggles). typecheck/lint/tests verts (595 tests shared), parité i18n confirmée.

## 12/07/2026 — Personnalisation du dashboard : mode édition, drag & drop, masquer, taille (US 7.1/7.2/7.3/7.11/7.12)

Branche `feature/dashboard-personnalisation`. Rend l'accueil personnalisable, disposition
persistée localement **et** dans le cloud via la colonne existante `user_settings.dashboard_layout`.
**100 % client — aucune migration, aucun checkpoint 🔴 cloud, aucune dépendance native ajoutée**
(`react-native-reanimated` / `react-native-gesture-handler` déjà présents).

### Ajouté
- **Logique pure (`@wellness/shared/dashboard.ts`)** — registre `DASHBOARD_WIDGET_IDS` (7 widgets)
  + `WIDGET_PILLARS` (gardes piliers, `always` transverse jamais filtré) ; types `WidgetSize`,
  `WidgetLayoutEntry`, `DashboardLayout` ; `defaultDashboardLayout()`, `resolveDashboardLayout()`
  (défaut, fusion forward-compat, filtre piliers, IDs inconnus ignorés, tri par ordre, recompactage,
  `visible`/`size` préservés), `moveWidget()` pur/immuable, `parseDashboardLayout()` tolérant.
  **25 tests Vitest**.
- **Persistance (`dashboard-layout-repository.ts`)** — `useDashboardLayout()` : lecture réactive
  (`useSettings`), parse tolérant, résolution filtrée piliers pour l'affichage ; mutateurs
  `toggleVisible`/`setSize`/`reorder`/`setLayout` écrivant le **layout complet non filtré** via
  `updateSettings({ dashboardLayout })`. **Débounce ~400 ms** sur le réordonnancement (drag).
- **Variante compacte (7.11)** — prop `size?: WidgetSize` sur les 7 widgets + composant partagé
  `DashboardCardCompact` (une ligne : icône + titre + valeur clé), conforme à la maquette.
- **Mode édition (7.1/7.3)** — bouton « Personnaliser » / « Terminé » dans l'en-tête ; rendu de la
  disposition résolue via map `id → composant` ; `DashboardWidgetRow` (cadre pointillé, marquage
  « Masqué » grisé + badge) + `DashboardEditControls` (œil masquer/afficher sur **tous** les widgets
  y compris streak — **masquabilité uniforme** ; bascule de taille). a11y sur tous les contrôles.
- **Drag & drop (7.2)** — `SortableDashboard` (`react-native-gesture-handler` `Pan` +
  `react-native-reanimated`) : poignée par carte, la carte active suit le doigt, calcul d'index
  cible sur hauteurs mesurées, `reorder(id, toIndex)` au drop. **Défilement du `ScrollView`
  neutralisé pendant un drag actif.** `GestureHandlerRootView` posé à la racine.
- i18n FR/EN à parité : `home.customize.*` et clés compactes des widgets (65/65 sur `home.*`).

### Technique / Notes
- Aucune migration : la colonne `dashboard_layout` (JSON TEXT PowerSync) préexistait. Offline-first.
- **Reste** : vérification device du drag & drop (non validable en CI — module natif + New Arch).
  **Auto-scroll près des bords pendant le drag : différé** (spec §8, optionnel MVP).

## 12/07/2026 — Widgets dashboard : Record récent, Volume muscu, Résumé running (US 7.8–7.10)

Branche `feature/7.8-7.10-widgets-dashboard`. 3 widgets additifs sur le tableau de bord,
100 % client (lectures locales réactives) — aucune migration, cloud ni dépendance native.

### Ajouté
- **Record récent (7.8)** — `RecordRecentCard` : dernier record battu, muscu OU course, avec
  badge pilier, libellé (exercice + poids, ou distance + temps M:SS) et date JJ/MM/AAAA. Lien
  vers Progression (muscu) ou Historique (course). Gardé si pilier `strength` OU `running` actif.
- **Volume muscu semaine (7.9)** — `MuscleVolumeCard` : histogramme du volume par groupe
  musculaire de la semaine (réutilise `MuscleVolumeBarChart`, unité **kg**). Gardé si `strength`.
- **Résumé running semaine (7.10)** — `RunningWeekCard` : distance + nombre de séances de la
  semaine, avec objectif de séances (`weeklyFrequency`) si défini. Gardé si `running`.
- `dashboard-repository` : hook composite `useMostRecentRecord()` composant record muscu le plus
  récent (nouveau `useQuery` + jointure `exercise_translations`) et record d'allure le plus récent
  (`useRunningRecords`), **filtré selon les piliers actifs** (hooks inconditionnels, filtrage sur
  les résultats).
- i18n FR/EN à parité : `home.record.*`, `home.volumeWeek.*`, `home.runningWeek.*`.

### Modifié
- `(tabs)/index.tsx` : intègre les 3 cartes à la suite des widgets existants, gardées par pilier.

### Technique / Notes
- Réutilisation stricte : `MuscleVolumeBarChart` non dupliqué ; libellés de groupes musculaires
  via `muscle.*` existant. Objectif de **distance** hebdo différé (Lot B / colonne dédiée).

## 12/07/2026 — Export GPX d'une course (US 5.33)

Branche `feature/5.33-export-gpx`.

### Ajouté
- **Export GPX** d'une course GPS terminée : bouton « Exporter (GPX) » sous la carte du
  résumé de course, visible uniquement pour une course GPS terminée avec ≥ 2 points valides.
  Génère un fichier `.gpx` (GPX 1.1, sans altitude) et l'ouvre via la feuille de partage OS.
  100 % local/hors-ligne (aucun réseau, cloud ni migration).
- `@wellness/shared` : `buildGpx(points, { startedAtMs, name })` (pur, testé), `gpxFileName`
  (nom daté en heure locale), `isValidCoord(lat, lng)` (extrait d'`isValidFix`).
- `apps/mobile/src/lib/gpx-export.ts` : couche native (écriture cache + `Sharing.shareAsync`).
- i18n FR/EN : `running.export.*` (cta, defaultName, dialogTitle, erreurs).

### Modifié
- `isValidFix` délègue désormais à `isValidCoord` (comportement inchangé — fix records préservé).

### Technique / Notes
- Dépendances : `expo-sharing` (~57.0.3) + `expo-file-system` (~57.0.0) → **nouveau build requis**.
- API `expo-file-system` **legacy** (`writeAsStringAsync` + `cacheDirectory`), nom de fichier
  cache fixe (`course.gpx`) pour éviter l'accumulation. Tests : 20 nouveaux (buildGpx + gpxFileName
  + isValidCoord), régression `isValidFix` verte.

## 12/07/2026 — Fix UI : écran Musculation non défilable + cartes collées

Branche `fix/strength-scroll-spacing`.

### Corrigé
- L'onglet **Musculation** posait ses cartes directement dans `Screen` (hauteur fixe) **sans `ScrollView`
  ni espacement** → impossible de défiler (carte « Progression » inatteignable) et cartes collées. Ajout d'un
  `ScrollView` (pattern du dashboard `(tabs)/index.tsx`) avec `contentContainerStyle={{ gap: 14, paddingBottom: 24 }}`,
  en-tête `ScreenHeader` conservé fixe. Fichier : `apps/mobile/src/app/(tabs)/strength.tsx`.

### Technique / Notes
- Le pilier Course (`(tabs)/running.tsx`) n'est pas concerné (2 cartes max, tient sans défilement).

## 12/07/2026 — Fix UI : sélecteur de niveau (création/édition de programme)

Branche `fix/segment-niveau-muscu-wrap`.

### Corrigé
- Le sélecteur segmenté « Niveau » faisait passer « Intermédiaire » sur deux lignes (mode par défaut
  `flex: 1` à 4 colonnes égales, libellés trop longs). Passage en mode `scrollable` (une ligne, largeur
  intrinsèque, défilement horizontal si besoin) — cohérent avec le sélecteur d'objectif de course.
- Fichiers : `apps/mobile/src/app/programs/edit.tsx` (muscu), `apps/mobile/src/app/running-programs/edit.tsx`
  (course, création + édition — même classe de bug).

### Technique / Notes
- Aucun changement du composant `Segment` (le mode `scrollable` existait déjà) ; simple opt-in par écran.

## 12/07/2026 — US 4.7b : détection anticipée des jours d'entraînement (nutrition)

Étend `useIsTrainingDay(dayKey)` pour qu'une séance **planifiée** (`planned_sessions`, statut
`planned`/`done`) compte comme jour d'entraînement **par anticipation** (aujourd'hui + futur).
Le passé reste rétroactif uniquement. Streak inchangé. Aucune migration, aucun cloud.
Branche `feature/nutrition-4.7-anticipee`.

### Ajouté
- **`packages/shared/src/training-day.ts`** : helper pur `isTrainingDay(i: TrainingDayInput): boolean`.
  Règle : `retroactiveDone || (hasPlanned && dayKey >= todayKey)`. Comparaison lexicographique
  `AAAA-MM-JJ` (= chronologique). Exporté via `index.ts`.
- **`packages/shared/src/training-day.test.ts`** : 6 tests Vitest TDD (passé+fait→vrai,
  passé+planifié-seul→faux, aujourd'hui planifié→vrai, futur planifié→vrai, futur vide→faux,
  aucun signal→faux). Frontière `dayKey===todayKey` explicitement couverte.
- **`useHasPlannedSession(dayKey)`** dans `planned-session-repository.ts` : hook réactif
  owner-scopé (`useAuthStore` + `useQuery`), requête bornée `SELECT 1 … WHERE owner_id=?
  AND scheduled_date=? AND status IN ('planned','done') AND deleted_at IS NULL LIMIT 1`.
  Retourne `{ hasPlanned: boolean; isLoading: boolean }`.

### Modifié
- **`useIsTrainingDay`** dans `dashboard-repository.ts` : compose l'existant (logique rétroactive
  inchangée, extraite dans `retroactiveDone`) + `useHasPlannedSession(dayKey)`. Import aliasé
  `isTrainingDay as computeIsTrainingDay` pour éviter la collision de nom avec le champ retourné.
  `isLoading` = OR des trois hooks. JSDoc mis à jour (rétroactif + anticipé). UI et signature
  inchangés.

## 12/07/2026 — Fix : précision GPS & records d'allure (marche/course lente)

Correctif du bug device : une marche de 1,01 km ne produisait **aucun record** (section
« Records d'allure » à « — », pas de badge 1 km) et la carte affichait un point aberrant à (0,0).
Diagnostic complet : [docs/specs/technical/fix-running-gps-precision-records.md](docs/specs/technical/fix-running-gps-precision-records.md).
Branche `fix/running-gps-precision-records`.

### Corrigé
- **Volet C (cause dominante) — précision d'encodage de trace `1e-5` → `1e-6`** (`packages/shared/src/running.ts`).
  La maille `1e-5` (~1,1 m) écrasait les pas d'une marche lente (~0,7 m) → la trace **décodée**
  sous-comptait la distance (< 1 km) alors que le tracker live cumulait ~1,01 km → aucun record.
  Passage à `1e-6` (~0,11 m) : trace décodée fidèle, record 1 km posé.
- **Volet A — filtre des fixes GPS invalides à l'ingestion** (helper pur `isValidFix` dans shared,
  câblé dans `apps/mobile/src/running/tracker-task.ts`). Rejette (0,0) « null island », coordonnées
  hors bornes, coords non finies, et `accuracy > 50 m`. Un fix rejeté n'entre ni dans la trace, ni
  dans le cumul distance/durée, ni comme `lastPoint`.
- **Volet B — auto-pause moins sensible au mouvement lent réel.** Seuil abaissé `0,5 → 0,3 m/s`
  **et** comparaison sur la **vitesse lissée** (moyenne sur fenêtre `AUTO_PAUSE_WINDOW_S = 10 s`,
  helper pur `smoothedSpeedMs`) au lieu de la vitesse instantanée bruitée. Une marche lente réelle
  ne déclenche plus de fausse pause ; un arrêt réel prolongé reste détecté ; auto-reprise conservée.

### Technique / Notes
- **Compat ascendante** (Volet C) : marqueur de version **par segment** — un segment hérité (v0,
  `1e-5`, sans marqueur) et un nouveau segment (v1, `1e-6`, préfixe `#1#`) coexistent dans la même
  trace et se décodent chacun à leur précision. Séparateur coords/temps `,` pour v1 (hors domaine
  polyline, car à `1e-6` le caractère `|` peut apparaître dans un chunk). **Aucune migration DB.**
- `distance_m` d'affichage **inchangé** (reste le cumul live pleine précision).
- Tests : test de reproduction (`fix-running-gps-precision-records.test.ts`, rouge avant / vert
  après) + tests unitaires `isValidFix`, `smoothedSpeedMs`, round-trip `1e-6`, décodage hérité `1e-5`
  et trace mixte. typecheck/lint/tests verts (shared 478 + mobile 29). **Rebuild preview requis**
  pour recette device (badge 1 km attendu).

## 12/07/2026 — US 3.9 : planning muscu daté + calendrier unifié (coordination muscu↔running)

_Branche : `feature/us3.9-planning-unifie`. Cadrage complet (spec+plan+maquette validés) puis code subagent-driven (revues par phase + finale = **Ready to merge**). **Généralise** l'infra de planification R3c-i (pilier-agnostique) : livre le planning muscu **et** l'essentiel de la coordination 5.6. **100 % JS — aucune migration, aucun cloud, aucune dépendance native** (`planned_sessions` déjà déployée)._

### Ajouté / Modifié
- **`@wellness/shared`** : `planRunningProgramInput{Schema}` → **`planProgramInput{Schema}`** (pilier-neutre).
- **`planned-session-repository.ts` — pilier-agnostique** : `planRunningProgram` → **`planProgram`** (active par le pilier du programme) ; `useWeekPlan`/`useMissedSessions` renvoient **tous les piliers** ; `PlannedSessionItem` gagne `pillar` + `exerciseCount` (sous-requête `COUNT(exercise_plans)`). `SELECT_MISSED` (ex-`SELECT_MISSED_RUNNING`) sans filtre pilier.
- **Écran unifié `/planning`** (renommé depuis `running-planning`) : vue semaine 7 jours affichant **muscu (nom + N exercices, puce bordeaux)** et **running (type/cible/allure, puce terracotta)** mélangés ; **indicateur de coordination** (« N séances ») quand ≥ 2 séances `planned`+`done` le même jour ; bannière manquées + actions (reporter/sauter/faite) tous piliers.
- **Assistant « Planifier » pilier-aware** (`planning/plan.tsx`) : muscu = noms de séance, running = types ; accessible depuis le détail programme **muscu** (`programs/[id].tsx`) **et** running.
- **Entrée « Mon planning »** dans l'onglet Muscu (`(tabs)/strength.tsx`, sans gating — pilier socle) et l'onglet Course (recâblée vers `/planning`).
- **i18n** : `running.planning.*` → namespace partagé **`planning.*`** (+ clés muscu/coordination), parité FR/EN 693/693.

### Technique / Notes
- **Non-régression running (device-validé)** : renommage i18n/route **exhaustif** ; greps `running.planning.`/`running-planning`/`running-programs/plan`/`planRunningProgram` = **0** ; comportement running iso (branches `if (isRunning)` additives). Vérifié par revue finale (diff commit à commit).
- **Aucune migration/cloud/rebuild bloquant** : `planned_sessions` + `exercise_plans` déjà déployés/synchronisés. Un simple rebuild preview suffit pour la recette device.
- Qualité verte (typecheck 3 workspaces / lint / shared 451 + mobile 29) ; 0 doublon i18n.
- **Débloque** : la coordination 5.6 (indicateur même-jour livré ici) et prépare la détection anticipée des jours d'entraînement (nutrition 4.7).
- **Suivi (non bloquant)** : le bouton « Planifier » s'affiche sur un programme éditorial non dupliqué (aspérité pré-existante R3c-i — idéalement masquer/rediriger vers duplication) ; à traiter ultérieurement.

## 12/07/2026 — Fix : champs du programme de course enregistrés à la saisie

_Branche : `fix/running-program-fields-onchange`. Suite du fix précédent : les champs texte du composer de programme (nom, résumé, **durée en semaines**) souffraient du même défaut que la cible de séance — commit `onBlur` uniquement, donc perdus si « Terminé » était tapé sans quitter le champ (le `Keyboard.dismiss()` posé avant ne suffit pas : le blur est asynchrone, `router.back()` navigue avant). 100 % JS._

### Corrigé
- **`running-programs/edit.tsx`** : commit-on-change sur les 3 champs du composer (`saveName`/`saveSummary`/`saveDurationWeeks` branchés sur `onChangeText`, écriture uniquement si valeur valide, `onBlur` conservé). Plus de perte à la modification, quel que soit le geste de sortie.
- Le **formulaire de création** (`RunningProgramCreateForm`) lit déjà l'état au submit (bouton « Créer ») — non concerné (aucune dépendance au blur).

### Technique / Notes
- Généralise le pattern commit-on-change du fix cible-de-séance à tous les champs texte running. Qualité verte (typecheck / lint / 451 shared + 29 mobile). Rebuild preview pour re-recette.

## 12/07/2026 — Nutrition : édition/suppression d'entrée + 8 correctifs base d'aliments & journal

_Branche : `feature/journal-modifier-supprimer-entree`. Deux lots : (a) éditer la quantité / supprimer une entrée depuis le détail du journal (US4.34) ; (b) 8 correctifs issus d'une analyse des manques du pilier Nutrition (hygiène de données, recherche, saisie rapide, dette technique). **100 % client** — deux parts nécessitant une migration cloud sont explicitement différées (eau, snapshot fibres/sucres/AGS par entrée). Qualité verte (467 tests shared dont +16, typecheck/lint OK sur les fichiers touchés, i18n FR/EN 708/708). Recette device Pixel 6a : recherche accent-insensible, onglet Récents, horodatage + réordonnancement du détail confirmés._

### Ajouté
- **Éditer la quantité / supprimer une entrée du journal** (`nutrition.tsx`, US4.34) : le détail d'une entrée expose « Modifier la quantité » (champ grammes + aperçu live kcal/macros/micros, recalcul par règle de trois) et « Supprimer » (avec confirmation) ; l'appui long reste un raccourci de suppression.
- **#1 Éditer / supprimer un aliment de la base** (`food-repository.ts`, `food-custom.tsx`, `food-picker.tsx`) : `updateFood`/`deleteFood`/`getFood`/`isEditableFood`. `food-custom` passe en **mode édition** (param `foodId`, préremplissage) ; **appui long** sur une ligne du picker → Modifier / Supprimer (réservé aux aliments perso & OFF importés ; la bibliothèque `library` reste en lecture seule).
- **#4 Fibres / sucres / AG saturés** : colonnes désormais **branchées** (saisie dans `food-custom`, stockage `addCustomFood`/`updateFood`, lecture dans `FoodListItem`, aperçu mis à l'échelle dans `QuantityPanel`). Étaient des colonnes mortes.
- **#5 Saisie rapide** : **onglet « Récents »** (`useRecentFoods`, aliments récemment journalisés) + **multi-ajout** (le picker reste ouvert après un ajout, bannière « N ajouté(s) » + « Terminé »).
- **#6 Réordonnancement + horodatage** : `moveEntry` (échange d'`order_index`) exposé par des chevrons ↑/↓ dans le détail (désactivés aux extrémités) ; l'heure de journalisation (`created_at`) s'affiche dans le sous-titre du détail.

### Modifié
- **#3 Recherche d'aliments insensible aux accents/ligatures** (`search.ts`, `food-repository.ts`) : `useFoods` filtre désormais **en mémoire** via `matchesSearch` (repli des diacritiques + ligatures œ/æ) au lieu d'un `LIKE '%…%'` SQL — « boeuf » trouve « Bœuf haché », « pates » trouve « Pâtes ».
- **#7 Logique de rescale extraite et testée** : `rescaleEntryNutrition` dans `@wellness/shared` (règle de trois depuis le snapshot, un seul arrondi) ; `nutrition.tsx` la consomme au lieu d'un calcul inline.

### Corrigé
- **#2 Doublons OpenFoodFacts** (`food-picker.tsx`) : la sélection d'un résultat OFF via la recherche texte fait désormais `findFoodByBarcode` **avant** d'importer → plus de lignes `foods` dupliquées (seul le scan dédupliquait jusqu'ici).
- **#8 Double-encodage JSON (cause racine)** : nouveau helper partagé `parseJsonColumn` (tolérant au double-encodage PowerSync/op-sqlite) ; `parseMicronutrients`, `parsePortions` (`food-repository`), et les `parseJsonColumn` locaux de `settings-repository` (`active_pillars`/`meals`) et `nutrition-repository` s'appuient dessus. Généralise le contournement jusque-là limité aux micronutriments (US4.34).

### Technique / Notes
- **Nouveaux modules shared** : `json-column.ts` (+6 tests), `search.ts` (+7 tests), `rescaleEntryNutrition` (+3 tests dans `food.test.ts`). i18n FR/EN : +14 clés (`journal.detail.*`, `journal.tabs.recent`, `journal.addedCount/done/noRecent`, `food.edit/delete/deleteConfirm/…`, `food.custom.sugars/saturatedFat/fiber/update`), parité 708/708.
- **Différé (déclenche le checkpoint 🔴 cloud)** : suivi de l'eau (#6, table `water_logs` à créer) et **snapshot fibres/sucres/AGS par entrée de journal** (#4, 3 colonnes sur `food_entries`) — nécessitent migration + activation cloud, non faites unilatéralement. Les valeurs fibres/sucres/AGS sont pour l'instant visibles à l'ajout (QuantityPanel) mais pas figées par entrée.
- **Hors périmètre** : les 2 erreurs typecheck préexistantes de `running-history/index.tsx` (typage `router.push(string)`) sont identiques à `origin/dev` — non introduites ici, à traiter séparément (feront échouer la CI).

## 12/07/2026 — Fix : cible de séance perdue sans blur + contrainte cloud bloquante

_Branche : `fix/running-commit-on-change`. Suite de la recette device : la durée d'une séance n'était pas enregistrée si l'utilisateur tapait « Terminé » sans sortir du champ (commit uniquement `onBlur`). Cause secondaire : une CHECK constraint cloud bloquait la synchro PowerSync pendant l'édition. 100 % JS + 1 migration cloud (déjà appliquée)._

### Corrigé
- **Cible de séance (distance/durée) enregistrée à la saisie** (`RunningSessionEditor.tsx`) : nouveau `saveTargetValue(kind, rawValue)` (commit-on-change silencieux — écrit **uniquement si la valeur est valide**, sans flash d'erreur pendant la frappe) branché sur `onChangeText` des deux champs, en plus de l'`onBlur` existant. Plus de perte de saisie si « Terminé » est tapé sans blur.
- **« Terminé » ferme le clavier avant de naviguer** (`running-programs/edit.tsx`) : `Keyboard.dismiss()` puis `router.back()` → les champs d'entête du programme (`name`/`summary`/`durationWeeks`, commit `onBlur`) sont bien enregistrés avant de quitter.
- **Contrainte cloud `sessions_running_target_chk` retirée** (`20260712130000_drop_sessions_running_target_chk.sql`, appliquée manuellement au cloud le 12/07) : cette CHECK multi-colonnes (« type ⇒ cible obligatoire », posée en R3b-i) **rejetait les écritures intermédiaires** (type choisi avant la cible) et **bloquait la file d'upload PowerSync** → aucune écriture running ne montait au cloud. La règle « cible requise » reste validée **côté app** (`hasRunningSessionTarget`).

### Technique / Notes
- **Leçon offline-first** (ajoutée à [bonnes-pratiques.md](docs/specs/technical/bonnes-pratiques.md) §5) : éviter les CHECK constraints multi-colonnes dépendant d'un état complet — elles rejettent les écritures optimistes incrémentales et bloquent la synchro. Valider ces invariants côté application.
- `db:types` inchangé (drop de contrainte ≠ changement de colonnes). Diagnostic confirmé par requête cloud (durée `NULL` avant drop → OK après). Qualité verte (typecheck / lint / 451 shared + 29 mobile). **Rebuild preview** pour re-recette.

## 12/07/2026 — Fix : 5 correctifs running (recette device R3/R4)

_Branche : `fix/running-r3-r4-persistance-ui`. Bugs remontés à la recette device du build preview ; cause racine diagnostiquée puis corrigée, revue qualité (bug 4 repris en 2 passes). **100 % JS** (aucune migration, aucun schéma) → simple rebuild pour re-tester._

### Corrigé
- **Cause racine commune (init offline-first)** : plusieurs champs contrôlés étaient figés au montage via `useState(() => valeurAsyncPowerSync)` — avant résolution de `useQuery` la valeur était `null`, le champ restait vide au rechargement bien que la donnée soit **bien enregistrée**. Idiome corrigé partout : state local `null` + valeur affichée `local ?? valeurDB`.
  - **Allure de référence** (`running-profile.tsx`) : s'affiche désormais au rechargement du profil coureur (l'écriture fonctionnait déjà).
  - **Séance de course** (`RunningSessionEditor.tsx`) : le **type de cible « Durée »** et sa valeur sont conservés à la réouverture (valeurs effectives dérivées de la séance rechargée).
  - **Résumé de programme** (`program-repository.ts` + `running-programs/edit.tsx`) : `ProgramDetail` **expose** désormais `summary` (requête détail dédiée `COALESCE(tl.summary, tfr.summary)`, `SELECT_PROGRAM_BASE` liste inchangé) et le champ est pré-rempli à l'édition. _(Durée : round-trip vérifié correct — l'affichage vide était le même artefact de timing, résolu par l'idiome null-init.)_
- **Sélecteur « Objectif »** : `Segment` gagne une prop **opt-in `scrollable`** (scroll horizontal, largeur intrinsèque) — plus de retour à la ligne disgracieux ; les ~10 autres usages de `Segment` inchangés (défaut `false`).
- **Courbe d'allure — axe Y en M:SS** : `ProgressLineChart` gagne une prop **opt-in `formatYLabel`** qui **impose l'échelle tracée** (`maxValue`/`yAxisOffset`/`stepValue`) **et** les libellés sur la même plage `[min, max]` (helper pur testé `buildPaceYAxis` dans `@wellness/shared`, +6 tests) → les points tombent pile sur leurs graduations M:SS (au lieu de secondes brutes sur une échelle 0→max). Cas une seule course (`min==max`) géré (bande ±30 s). Muscu (`progress/index.tsx`) inchangé (opt-in).

### Technique / Notes
- Chemins d'écriture (SQLite/PowerSync) et schéma **inchangés** — bugs purement UI/affichage/requête. Composants partagés (`Segment`, `ProgressLineChart`) modifiés **uniquement via props opt-in** (rétro-compatible). React Compiler-safe (state + valeurs dérivées, aucun memo manuel).
- Qualité verte (typecheck 3 workspaces / lint / **451 shared + 29 mobile**). 6 commits (1 par bug + reprise du bug 4).
- **Rebuild preview** requis pour re-recette (pas de migration/cloud).

## 12/07/2026 — Running R4b : records d'allure + maj auto allure de réf

_Branche : `feature/running-r4b-records`. Cadrage complet (spec+plan+maquette validés) puis code subagent-driven (revue spec + qualité par phase + revue finale = **Ready to merge**). **US data → checkpoint 🔴 cloud non encore appliqué (après R3a/R3b-i/R3c-i).** Aucun module natif ajouté → **pas de rebuild**._

### Ajouté
- **`@wellness/shared`** `pace-records.ts` (pur, testé — 9 tests) : `RUNNING_RECORD_DISTANCES` (1/5/10 km, semi 21097,5 m, marathon 42195 m), `cumulativeDistances` (filtre outliers `MAX_PLAUSIBLE_SPEED_MS` → 0 m, point conservé), `bestSegmentTimeFromSamples` (**fenêtre glissante deux-pointeurs** + **interpolation linéaire de `t` au franchissement de D**), `bestSegmentTime`, `computeRunRecords`.
- **Table `running_pace_records`** : migration `20260712120000_running_pace_records.sql` (1 ligne par utilisateur × distance, `best_time_seconds`, `run_id`, `achieved_at` ; index **unique partiel `(user_id, distance_key) where deleted_at is null`** ; RLS `user_id = auth.uid()` ; publication PowerSync) + schéma PowerSync local + sync rule bucket `user_data`.
- **`running-record-repository.ts`** : `useRunningRecords()` (lecture réactive triée par ordre canonique) ; `detectAndStoreRunRecords(runId)` — **détection idempotente à la fin de course** (GPS terminée uniquement ; upsert « seulement si strictement plus rapide », comparaison et stockage **arrondi↔arrondi** ; renvoie les distances battues) + **maj auto de l'allure de référence** du profil coureur si le **5 km** est battu (5.31) ; `backfillRunningRecords()` (peuplement de l'historique existant, verrou in-flight).
- **Section « Records »** dans l'écran Historique : les 5 distances (allure dérivée + date via `useUnits`, tap → détail `run/summary?id=`, « — » si aucun record) ; **backfill** au 1ᵉʳ affichage si vide.
- **Célébration in-app** sur le résumé de course : bandeau animé (RN `Animated`, couleurs charte bordeaux/doré, **aucun module natif**) « Nouveau record ! » listant les distances battues + ligne « allure de réf mise à jour » si 5 km battu. Effet one-shot (déps primitives + garde démontage). i18n `running.records.*` FR/EN.

### Technique / Notes
- **Idempotence / non-re-célébration** : garantie par l'upsert « seulement si strictement plus rapide » comparant **arrondi↔arrondi** — rejouer le résumé d'une course déjà traitée renvoie `[]` (pas de re-célébration, pas de flag persistant).
- **GPS uniquement** (manuel exclu partout — données non vérifiables, spec §8) ; records **par course** (`t` = secondes depuis le départ, jamais à cheval sur deux courses).
- **Notification poussée différée** (infra `expo-notifications` dédiée, couvrira aussi muscu) → célébration **in-app** seule au MVP. Dénivelé (5.32), export GPX (5.33), découpage par type : différés.
- **Muscu non régressé** (`personal_records` hors diff) ; `upsertRunnerProfile` ne touche que `ref_5k_pace_s_per_km`.
- Offline-first (écritures locales `_sql`, UUID client, timestamps UTC, soft delete) ; qualité verte (typecheck 3 workspaces / lint / shared 445 + mobile 29) ; parité i18n 688/688 ; 0 doublon.
- **Reste (🔴, avec Damien)** : appliquer la migration `20260712120000` **après** R3a/R3b-i/R3c-i (ordre des timestamps) + `npm run db:types` + déployer la sync rule `user_data` + **vérif device** (établir un record → célébration + maj allure réf 5 km, rejouer sans re-célébration, section Records, backfill, RLS 2 comptes, FR/EN, offline).

## 12/07/2026 — Running R4a : historique + stats + courbe d'allure

_Branche : `feature/running-r4a-historique-stats`. Cadrage complet (spec+plan+maquette validés) puis code subagent-driven (revue spec + qualité par phase + revue finale = **Ready to merge**). **Lecture seule** sur `runs` : aucune migration, aucune dépendance, **aucun rebuild**._

### Ajouté
- **`@wellness/shared`** `run-stats.ts` (pur, testé — 13 tests) : `aggregateRunStats(runs, period, todayKey)` (distance/temps/nombre par **semaine lun→dim / mois calendaire / depuis le début**), `paceTrendPoints(runs, days, todayKey)` (fenêtre **glissante** 30/90 j, courses avec allure), `paceTrend(points)` (`improving`/`declining`/`stable`, seuil ±2 %, allure basse = plus rapide), `formatDurationHms(seconds)` (durée lisible).
- **`run-repository.ts`** : hooks **lecture seule** `useRunStats(period)` et `usePaceTrend(days)` réutilisant `useRunHistory` (inchangé → **dashboard streak / jour d'entraînement non régressés**) ; mapping course → `StatRun` via `localDayKey(finishedAt)`.
- **Écran `app/running-history/`** : « Historique & progression » (onglet Course, entrée gatée `runningActive`) — **stats** (sélecteur Semaine/Mois/Début), **courbe d'allure** (`ProgressLineChart`, sélecteur 30/90 j + libellé de **tendance**), **liste chronologique** (date/distance/durée/allure) → détail existant `run/summary?id=`. État de chargement (loader) + état vide. i18n `running.history.*` FR/EN. Route enregistrée dans `app/_layout.tsx`.

### Technique / Notes
- **Lecture seule / offline-first** : uniquement des lectures `useQuery` ; aucune écriture, aucune migration, aucune sync rule, `runs` intacte. **Charts déjà présents** (`react-native-gifted-charts`) → aucun nouveau module natif, **pas de rebuild**.
- **Périodes calendaires** (stats) vs **fenêtres glissantes** (courbe) ; dates en clés `AAAA-MM-JJ` (`localDayKey`), sans dérive fuseau. **Courbe globale** (pas par type — les courses libres n'ont pas de `session_type`). Manuel : compté en distance/temps/nombre ; dans la courbe seulement si une allure existe.
- **Limitation assumée** : l'axe Y de la courbe est numérique (allure en secondes de l'unité) — une **ligne descendante = progrès** ; le libellé de tendance + la liste donnent la valeur précise.
- **Hors périmètre / différé** : export GPX (5.33, incrément dédié + build) ; records d'allure + maj allure réf (5.30/5.31 → **R4b**) ; dénivelé (5.32, altitude non captée) ; découpage par type ; filtres de liste.
- Qualité verte (typecheck 3 workspaces / lint / shared 436 + mobile 29) ; parité i18n 678/678 ; 0 doublon de clé. **Pas de checkpoint 🔴 cloud.**

## 12/07/2026 — Running R3c-i : planning daté + séance manquée

_Branche : `feature/running-r3c1-planning`. Cadrage complet (spec+plan+maquette validés) puis code subagent-driven (revue spec + qualité par phase + revue finale = **Ready to merge**). Introduit la **première couche de planification datée** de l'app, générique et pilier-agnostique. **5.6 (coordination muscu↔running) différée** (dépend d'un planning muscu daté inexistant). **US data → checkpoint 🔴 cloud non encore appliqué (après R3a + R3b-i).**_

### Ajouté
- **`@wellness/shared`** : helpers de semaine dans `date.ts` (`startOfWeek`/`addDays`/`weekdayIndex`, convention **0=lundi**) + `planning.ts` (`generatePlannedSessions` — semaine type × durée → instances datées alignées sur le lundi de la semaine de départ, `isMissed`, schéma Zod `planRunningProgramInputSchema`). Purs, **testés** (date 8 + planning 15 tests).
- **Table générique `planned_sessions`** : migration `20260712110000_planned_sessions.sql` (instance datée référençant `programs`/`sessions` ; `scheduled_date` **date calendaire**, `status` planned/done/skipped, `week_index`, `completed_at` ; index `(owner_id, scheduled_date)` ; RLS `owner_id = auth.uid()` select/insert/update ; `alter publication powersync`) + schéma PowerSync local + sync rule bucket `user_data`. Le **pilier est hérité** de la séance/programme — jamais dupliqué.
- **`planned-session-repository.ts`** : `planRunningProgram(programId, { startDate, durationWeeks, dayAssignments })` — **une seule transaction** (soft-delete des instances `planned` du programme → génération → insertion → **activation inlinée**), **idempotente** (re-planifier remplace le futur+passé `planned`, conserve `done`/`skipped`), validée par Zod avant transaction + garde programme sans séances ; `useWeekPlan(weekStart)` (fenêtre 7 jours jointe au détail séance), `useMissedSessions()` (running, passées `planned`), `reschedulePlannedSession`/`skipPlannedSession`/`markPlannedSessionDone`.
- **Écrans** `app/running-programs/plan.tsx` (assistant : durée **obligatoire**, semaine de début JS pur ◀/▶ prochain lundi, affectation séance→jour, allures via profil R3a) et `app/running-planning/` (vue **semaine 7 jours** lun→dim, séances type/cible/allure via `useUnits`, jours de repos, **bannière séances manquées**, feuille d'actions Marquer faite / Reporter (aujourd'hui/demain/+7) / Sauter, état vide). Entrées « Planifier » (détail programme) et « Mon planning » (onglet Course). i18n `running.planning.*` + `common.weekday.*` FR/EN.

### Technique / Notes
- **`txInsert` extrait** de `program-repository.ts` vers `_sql.ts` (exporté, réutilisable) — muscu non régressé (`duplicateProgram` inchangé).
- **Dates calendaires** (`AAAA-MM-JJ`) partout, construites composant-par-composant (jamais `new Date('AAAA-MM-JJ')`) → aucune dérive fuseau/DST. Comparaison chronologique = lexicographique.
- **Pas de date-picker natif** (sélection JS pur) → aucun nouveau module natif, build standard.
- **Hors périmètre / différé** : coordination 5.6 (planning muscu daté requis) ; démarrer une course depuis une séance planifiée (lien tracker, R4) ; progression auto de volume ; décalage en cascade ; auto-détection « fait » via course libre ; intégration dashboard « séance du jour » running.
- Offline-first (écritures locales, UUID client, timestamps UTC, soft delete, réactif) ; qualité verte (typecheck 3 workspaces / lint / shared 423 + mobile 29) ; parité i18n 659/659 ; 0 doublon de clé.
- **Reste (🔴, avec Damien)** : appliquer la migration `20260712110000` sur le cloud (après R3a `…090000` + R3b-i `…100000`, ordre des timestamps) + déployer la sync rule `user_data` + `npm run db:types` (committer) + **vérif device** (planifier, vue semaine, reporter/sauter/fait, manquées, re-planif sans doublon, muscu intact, RLS 2 comptes, FR/EN, offline).

## 12/07/2026 — chore : `.easignore` (archive de build EAS allégée)

_Branche : `chore/easignore-build-archive`. Suite au constat que l'archive uploadée à EAS Build faisait **344 Mo** (upload ~5 min) alors que les sources trackées ne pèsent que ~5 Mo._

### Ajouté
- **`.easignore`** à la racine : exclut de l'archive de build tout ce qui est inutile (`node_modules/`, `.git/`, `.expo/`, caches, artefacts natifs, secrets, logs) **et** le non-build (`docs/`, `design/`, `supabase/`, `.claude/`, `.github/`, Markdown racine, bases `.db` de debug). Devrait ramener l'archive de ~344 Mo à quelques Mo → uploads bien plus rapides.

### Technique / Notes
- ⚠️ **`.easignore` remplace `.gitignore`** pour l'archive EAS (ne les combine pas) → il reprend les exclusions essentielles de `.gitignore` (node_modules, secrets, caches).
- **Ne pas exclure** `apps/admin/` ni `packages/*` : ce sont des **workspaces npm** dont le `package.json` doit rester présent pour que `npm ci` réussisse côté EAS.
- Prendra effet au **prochain build EAS** (aucun impact sur le build déjà réalisé aujourd'hui).

## 12/07/2026 — Running R3b-ii : bibliothèque de programmes de course

_Branche : `feature/running-r3b2-bibliotheque`. Cadrage (spec+plan+maquette) puis code subagent-driven (revue spec = **conforme**, revue qualité = **Approved**). Réutilise l'infra bibliothèque muscu (`owner_id NULL` + `status='published'`, bucket `shared_content`). **Aucune migration de schéma** ; seul ajout data = contenu seedé → checkpoint 🔴 cloud non encore appliqué (après R3a + R3b-i)._

### Ajouté
- **Filtre pilier sur `useProgramLibrary`** (`program-repository.ts`) : nouveau champ `ProgramLibraryFilters.pillar?` (signature `useProgramLibrary(filters?)` **inchangée** → appelants muscu intacts) ; quand fourni, ajoute une clause `p.pillar = ?` (paramètre lié). `duplicateProgram` confirmé : copie utilisateur **`is_active=0`** (non active, éditable).
- **Seed bibliothèque running** (`supabase/seed.sql`) : 3 programmes « starter » bilingues FR+EN (préfixe UUID dédié `e…`, `owner_id null`, `status='published'`, `pillar='running'`, idempotent `ON CONFLICT DO NOTHING`) — « 10 km en 8 semaines » (10k/débutant), « Prépa semi-marathon » (semi/intermédiaire), « Reprise en douceur » (endurance/débutant). Séances avec `session_type` + `target_distance_m` (respecte la check R3b-i).
- **Onglet « Bibliothèque »** dans `app/running-programs/index.tsx` (sélecteur `Segment` « Mes programmes » / « Bibliothèque ») : parcours des programmes publiés running via `useProgramLibrary({ pillar:'running', …filters })` + **barre de filtres** (objectif `RUNNER_OBJECTIVES`, niveau `beginner/intermediate/advanced`, durée) combinés en ET ; **carte** (nom + chips objectif/niveau/durée) ; bouton **« Utiliser »** → `duplicateProgram` (anti double-clic) → navigation vers le détail de la copie ; état vide. i18n `running.library.*` FR/EN.

### Technique / Notes
- **Muscu non régressé** : `useProgramLibrary()` sans `pillar` inchangé, écran `programs/index.tsx` hors diff. **Aucune nouvelle table, aucune sync rule modifiée** (`sessions`/`programs` déjà dans `user_data` + `shared_content`).
- **Micro-écart maquette↔code** (non bloquant, à arbitrer produit) : le **résumé** du programme n'est pas affiché sur la carte (comme l'écran muscu de référence — `ProgramListItem` ne remonte pas `summary`) ; soit l'ajouter aux deux écrans dans un incrément cohérent, soit mettre à jour la maquette.
- Offline-first ; qualité verte (typecheck 3 workspaces / lint / 400 shared + 29 mobile) ; parité i18n (617/617) ; 0 doublon de clé (2 clés mortes `used`/`filters` retirées après revue).
- **Reste (🔴, avec Damien)** : appliquer le **seed running** sur le cloud **après R3a + R3b-i** (les séances utilisent les colonnes running de R3b-i) — `db:types` non requis (pas de schéma changé) — puis **vérif device** (les 3 programmes apparaissent via `shared_content`, filtres OK, « Utiliser » → copie éditable non active, muscu intact, FR/EN, offline).
## 12/07/2026 — US 4.34 + 4.35 : détail d'une entrée & suivi de micronutriments (+ fix double encodage)

_Branche : `feature/nutrition-detail-suivi-micros` (depuis `origin/dev`, commit précédent `733347c`). Cadrage (spec + plan), code, **test en direct sur device (Pixel, adb)** → bug de double encodage JSON trouvé et corrigé. **100 % client, aucune migration, aucun checkpoint cloud 🔴.**_

### Ajouté
- **4.34 — Détail d'une entrée de journal** : taper un aliment journalisé ouvre un **modal** (nom, quantité, `kcal` + P/G/L, puis micronutriments **de la quantité**, via `MicronutrientDetails`). L'appui long (suppression) est conservé. Écran [(tabs)/nutrition.tsx](<apps/mobile/src/app/(tabs)/nutrition.tsx>) (composant `EntryDetailModal`).
- **4.35 — Suivi de micronutriments dans le récap** : sélection de micros à suivre (chips sur les 10 clés) dans le **profil nutritionnel** ; **totaux du jour** des micros suivis affichés sous les barres P/G/L (+ sel dérivé si sodium suivi), réactifs (`sumMicronutrients`). Sélection persistée en **préférence locale (device)** via un **store Zustand** [tracked-micros.ts](apps/mobile/src/stores/tracked-micros.ts) + `secure-storage` (hydratée au boot dans [_layout.tsx](apps/mobile/src/app/_layout.tsx)).
- **`MicronutrientDetails`** : prop **`showPer100`** (défaut `true`) — masque la ligne « pour 100 g » quand les valeurs sont déjà un snapshot mis à l'échelle (détail d'entrée).
- **i18n** FR/EN (4 clés) : `journal.detail.{quantity, close}`, `nutrition.micros.tracked.{title, hint}`. Parité **616/616**.

### Corrigé
- **🐛 Micronutriments vides pour les données écrites côté client** (détail d'entrée, aliments importés d'OpenFoodFacts) : **`parseMicronutrients`** ([food.ts](packages/shared/src/food.ts)) est désormais **tolérant au double encodage**. **Cause racine** (diagnostiquée en interrogeant la base SQLite du device) : **PowerSync/op-sqlite stocke les colonnes texte-JSON écrites côté client en double encodage** (une string JSON dans une string JSON), alors que les données synchronisées du serveur (seed) sont en simple encodage. `parseMicronutrients` ne faisait qu'un `JSON.parse` → obtenait une string → renvoyait `{}`. Il parse maintenant **jusqu'à 2 fois**. Test ajouté ([food.test.ts](packages/shared/src/food.test.ts)).

### Technique / Notes
- **⚠️ Double encodage systémique** : le même phénomène touche **toutes** les colonnes texte-JSON écrites côté client (`active_pillars`, `notifications`, `portions` d'aliments perso, etc.). Les lecteurs existants (`parseJsonColumn`, `parsePortions`) font un seul `JSON.parse` → ils tolèrent le serveur mais **pas** le client (certains « marchent » par coïncidence via `String.includes`, d'autres perdent silencieusement la donnée). **À traiter globalement** dans un lot dédié (helper de parse tolérant partagé + revue des writers), hors périmètre de cette US.
- **Préférence micros suivis = locale (device), non synchronisée** entre appareils (assumé cloud-free ; promotion vers `user_settings` = migration ultérieure).
- **Détail = snapshot** (grams=100 sur `MicronutrientDetails` ⇒ valeurs affichées = quantité journalisée, pas de ligne « pour 100 g »).
- Vérifs : typecheck ✅ · lint 0 erreur ✅ · tests **401** ✅ (+1 double encodage) · i18n 616/616 ✅. **Validé device** (Pixel) : détail micros OK après fix, suivi micros dans le récap OK (Mg 32 / K 430 = total du jour).

## 12/07/2026 — US 4.7 + 4.18 : finitions Nutrition (calories jour de séance · copier une journée)

_Branche : `feature/nutrition-finitions-4.7-4.18` (depuis `origin/dev`, commit précédent `a2373a8`). Cadrage (spec + plan), code, vérifs vertes. Branche deux fonctions **déjà écrites mais inaccessibles** ; **100 % client, aucune migration, aucun nouveau build natif** (pas de checkpoint 🔴 cloud)._

### Ajouté
- **4.7 — Calories des jours d'entraînement** : l'objectif calorique du jour est **rehaussé du bonus** quand le jour porte au moins une **séance muscu OU une course terminée** (décision produit 12/07 : détection **rétroactive**, faute de planning muscu daté). Nouveau hook réactif **`useIsTrainingDay(dayKey)`** ([dashboard-repository.ts](apps/mobile/src/data/repositories/dashboard-repository.ts)) composé de `useWorkoutHistory` + `useRunHistory` (aucune SQL directe ; `finishedAt` UTC ramené au jour local via `localDayKey`).
- **Réglage du bonus** dans l'écran profil nutritionnel ([nutrition-profile.tsx](apps/mobile/src/app/nutrition-profile.tsx)) : champ « Bonus jour d'entraînement (kcal) », `parseBonus` (entier ≥ 0, `0`/vide = **désactivé**).
- **Badge** « +X kcal · jour de séance » sous la ligne calories, dans le **journal** ([(tabs)/nutrition.tsx](<apps/mobile/src/app/(tabs)/nutrition.tsx>)) et le **widget dashboard** ([NutritionSummaryCard.tsx](apps/mobile/src/components/dashboard/NutritionSummaryCard.tsx)).
- **4.18 — Copier une journée** : bouton « Copier toute la journée d'hier » (branché sur `duplicateDay`, déjà présent au repo), rendu **uniquement si le jour affiché est vide** ; alerte « rien à copier » si la veille est vide. Distinct du « Copier hier » **par repas** existant.
- **i18n** FR + EN (6 clés miroir) : `journal.{copyDayYesterday, nothingYesterdayFull, trainingDayBadge}`, `nutrition.calories.{trainingBonus, trainingBonusHint}`, `home.nutrition.trainingDayBadge`. Parité vérifiée **612/612**.

### Modifié
- **`useNutritionSummary`** expose désormais `effectiveTarget` (base + bonus), `isTrainingDay`, `trainingBonus` ; `target` reste l'objectif **de base** (référence des macros cibles). Le journal utilise `effectiveTarget` pour l'objectif affiché **et** le « restant ».

### Technique / Notes
- **Macros cibles calées sur l'objectif de base** : le bonus est un supplément **calorique non ventilé** en P/G/L (assumé MVP — évite d'inventer une répartition).
- **Détection rétroactive assumée** : l'objectif monte **après** l'enregistrement de la séance ; passera en anticipé quand le planning muscu (US2b) existera.
- Sur le dashboard, `useNutritionSummary` charge maintenant l'historique séances/courses via `useIsTrainingDay` **en plus** de `useStreakData` (déjà présent) — coût négligeable (requêtes locales PowerSync).
- Vérifs : typecheck (3 workspaces) ✅ · lint 0 erreur (4 warnings pré-existants hors périmètre) ✅ · tests **400** ✅. `trainingDayCalories`/`duplicateDay` déjà couverts/écrits en amont — aucune nouvelle logique pure.
- **Reste** : recette device (checklist : bonus + séance → objectif+badge réactif journal/accueil ; jour vide → copie ; bonus 0 → aucun badge ; FR/EN).

## 12/07/2026 — Running R3b-i : programme de course custom

_Branche : `feature/running-r3b1-programme-custom`. Cadrage (spec+plan+maquette) puis code subagent-driven (revues par phase + revue finale = **Approved for merge**). Réutilise l'infra programmes muscu (pilier-aware). **US data → checkpoint 🔴 cloud non encore appliqué (après R3a).**_

### Ajouté
- **`packages/shared/src/running-paces.ts`** : `PROGRAM_SESSION_TYPES` (4 types, course libre exclue) + `hasRunningSessionTarget(distanceM, durationS)`. Testés (400 shared).
- **Contenu de séance running** sur la table partagée `sessions` : migration `20260712100000_running_session_content.sql` (colonnes nullables `session_type`/`target_distance_m`/`target_duration_seconds` + **check conditionnelle** `session_type is null or au moins une cible` — les séances muscu passent toujours) + schéma PowerSync local.
- **`program-repository.ts`** : `updateRunningSession`, `updateProgram`, `updateProgramTranslation` (upsert traduction par langue) ; `SessionDetail` étendu (champs running nullables) ; `duplicateProgram` **étendu** (recopie le contenu running) ; `useMyPrograms(pillar?)` (filtre pilier optionnel).
- **Écrans `app/running-programs/`** : liste (« Mes programmes de course »), détail (métadonnées + séances : type, cible, **allure dérivée du profil R3a** via `sessionTargetPace`+`useUnits`), éditeur (création + composition) ; composant **`RunningSessionEditor`** (type + cible distance km/durée min + allure affichée + validation cible). Entrée « Mes programmes de course » dans l'onglet Course (si pilier running actif). i18n FR/EN.

### Technique / Notes
- **Réutilisation** de `programs` (`pillar='running'`, `goal`=objectif, `level`=beginner/intermediate/advanced) / `sessions` / `program_translations` — **aucune nouvelle table**. **Muscu non régressé** (fichiers `programs/*` hors diff, colonnes nullables, `useMyPrograms()` sans arg inchangé).
- **Blocs d'intervalles différés** (fractionné = type + cible + allure, sans structure) ; **bibliothèque + filtres + seed = R3b-ii** ; **planning = R3c** ; démarrer une course depuis une séance = différé.
- Offline-first ; qualité verte (typecheck 3 workspaces / lint / 400 shared + 29 mobile) ; parité i18n ; 0 doublon de clé.
- **Reste (🔴, avec Damien)** : appliquer la migration cloud **après R3a** (ordre des timestamps `…090000` → `…100000`), `npm run db:types`, puis **vérif device** (créer/activer/dupliquer un programme, allures affichées, muscu intact, RLS, FR/EN, offline).

## 11/07/2026 — Running R3a : profil coureur + types de séance (allures)

_Branche : `feature/running-r3a-profil-types`. Cadrage (spec+plan+maquette) puis code subagent-driven (revues par phase + revue finale = **Approved for merge**). Premier incrément de R3 (R3a/R3b/R3c). **US data → checkpoint 🔴 cloud non encore appliqué.**_

### Ajouté
- **`packages/shared/src/running-paces.ts`** : enums `RUNNER_OBJECTIVES` / `RUNNER_LEVELS` / `SESSION_TYPES` (+ schémas Zod), `VMA_COEFFICIENT = 0.95`, `derivedVmaPace`, `sessionTargetPace(type, ref5kPaceSPerKm)` → plages `{minSPerKm,maxSPerKm}` (endurance réf+60-90, sortie longue +30-60, récup +90-120, fractionné 95-100 % VMA ; `course_libre` → null). Purs, testés.
- **`packages/shared/src/units.ts`** : `parsePaceToSPerKm(text, system)` (saisie « M:SS » → s/km, garde de plausibilité 2:30–12:00 /km) + `formatPaceValue`. Tests (394 shared au total).
- **Table `running_profiles`** (1 ligne/utilisateur) : migration `supabase/migrations/20260712090000_running_profiles.sql` (colonnes scalaires + CHECK enum/fréquence + RLS `user_id = auth.uid()` + `alter publication powersync`), sync rules (bucket `user_data`), schéma PowerSync local.
- **`running-profile-repository.ts`** : `useRunnerProfile()` réactif + `upsertRunnerProfile()` (patron nutrition).
- **`useUnits`** : `parsePace` / `paceInputValue` (saisie/pré-remplissage d'allure).
- **Écran `running-profile.tsx`** : objectif / niveau / allure de réf (5 km, saisie M:SS) / fréquence + section « Mes allures d'entraînement » (plages via `useUnits`, min/km ou min/mi). Route modale + entrée « Profil coureur » dans Réglages (si pilier running actif). i18n FR/EN.

### Technique / Notes
- **Découpage R3** : R3a (profil + types/allures) *livré* · R3b (programmes : custom/bibliothèque/filtres) · R3c (planning + coordination + séance manquée) — à venir.
- **VMA dérivée** de l'allure 5 km (coeff. 0.95) ; **allures en plages** ; **récup +90-120** (plafond d'affichage assumé — running.md §4.4 dit « +90 ou plus », à confirmer produit). FCmax = V2.
- **Offline-first** ; qualité verte (typecheck 3 workspaces / lint / 394 shared + 29 mobile) ; parité i18n ; 0 doublon de clé.
- **Reste (🔴 checkpoint cloud, avec Damien)** : confirmer le **timestamp de migration** (`20260712090000`, > `20260711140000`), appliquer la migration sur le cloud, déployer les sync rules, `npm run db:types` (régénérer `database.types.ts`), puis **vérif device** (édition profil + sync + RLS + allures + FR/EN + offline).
- Point mineur (revue) : course théorique de double-insert au 1er remplissage (même patron que nutrition, couverte par la contrainte `unique` au cloud) — durcissement possible ultérieurement.

## 11/07/2026 — Running R2 : carte du parcours (MapLibre + MapTiler)

_Branche : `feature/running-r2-carte`. Cadrage (spec+plan+maquette) puis code subagent-driven (revues par phase + revue finale = **Approved for merge**, 1 point i18n corrigé). Décision fournisseur : [ADR-006](docs/adr/ADR-006-cartographie.md)._

### Ajouté
- **`packages/shared/src/geo.ts`** : `simplifyTrack(points, epsilonMeters): GpsPoint[]` — **Douglas-Peucker** (distance perpendiculaire en mètres, projection équirectangulaire), conserve `.t`, préserve les extrémités. Pur, testé (367 tests shared). Simplification **à l'affichage uniquement** — la trace stockée reste complète.
- **`@maplibre/maplibre-react-native@^11`** + config plugin `app.json` ([ADR-006](docs/adr/ADR-006-cartographie.md)). Module natif → **nouveau dev/preview build requis**.
- **`apps/mobile/src/lib/map.ts`** : `hasMapKey` + `MAP_STYLE_URL` (style **outdoor** MapTiler) depuis `EXPO_PUBLIC_MAPTILER_KEY` (env, jamais committée ; ajoutée à `.env.example`).
- **`apps/mobile/src/components/running/RouteMap.tsx`** : composant réutilisable (MapLibre v11 `Map`/`Camera`/`GeoJSONSource`/`Layer`). Tracé (LineString, couleur accent) + marqueur de position ; `follow` (caméra suit le dernier point) vs fit-bounds (résumé). États sans crash : clé absente → « Carte indisponible » ; sans point → `emptyLabel` (attente GPS / manuel) ; 1 point → marqueur seul ; attribution © OSM/© MapTiler conservée.
- i18n `running.map.{awaitingGps,noTrack,unavailable}` (FR + EN).

### Modifié
- **`run/active.tsx`** : carte **live** (`follow`) sous les allures — tracé simplifié en temps réel.
- **`run/summary.tsx`** : carte **statique** (fit-bounds) entre métriques et RPE — décode `run.gpsTrack`.
- **`run-repository.ts`** : `RunDetail.gpsTrack` exposé (3 changements coordonnés : `SELECT_RUN_BY_ID` + `RunDetailDbRow` + type/mapper).

### Technique / Notes
- **Tuiles en ligne au MVP** ; le **tracking GPS reste 100 % offline** (inchangé). Aucune migration, aucun impact sync. Pas de checkpoint 🔴 cloud (mais **dev/preview build requis** pour le module natif).
- Qualité : typecheck (3 workspaces) / lint (0 erreur, 4 warnings pré-existants) / tests (367 shared + 29 mobile) verts ; parité i18n FR/EN ; 0 doublon de clé.
- **Reste** : recette device (build + clé MapTiler à fournir). Différé : tuiles offline, sélecteur de style, marqueurs km, export GPX (R4). Profil coureur/programmes = R3.

## 11/07/2026 — ADR-006 : fournisseur de cartographie (MapLibre + MapTiler)

_Branche : `docs/adr-006-cartographie`. Décision d'architecture (débloque Running R2)._

### Ajouté
- **[docs/adr/ADR-006-cartographie.md](docs/adr/ADR-006-cartographie.md)** : tranche le point ouvert « Mapbox vs MapLibre ». **Décision : MapLibre** (`@maplibre/maplibre-react-native`, open-source BSD, sans token, coût maîtrisé, RGPD-friendly, offline, cross-platform) **+ MapTiler** (palier gratuit) comme source de tuiles pour démarrer R2. Comparatif, justification, pistes d'évolution (Stadia EU / Protomaps auto-hébergé sur Supabase Storage).

### Modifié
- **[architecture.md](docs/specs/technical/architecture.md)** : table stack + point ouvert « Fournisseur de cartes » → **fermé** (MapLibre + MapTiler, réf. ADR-006).
- **[roadmap.md](docs/roadmap/roadmap.md)** : 5.17 + décision pré-V0.5 → MapLibre + MapTiler.
- **[TODO.md](TODO.md)** : Running R2 **débloqué** (décision carte tranchée) ; prochaine étape = cadrage R2.

## 11/07/2026 — US 7.4–7.7 : dashboard d'accueil « live » (MVP)

_Branche : `feature/7.4-7.7-dashboard-live` (commit précédent : `fa5d222`). Cadrage (spec+plan+maquette) puis 11 commits de code, exécution subagent-driven (par phase : implémenteur → revue conformité → revue qualité), revue finale consolidée = **Approved for merge**._

### Ajouté
- **`packages/shared`** : `date.ts` (`localDayKey` — clé de jour local `AAAA-MM-JJ`) et `streak.ts` (`computeStreak(activeDays, todayKey)` **pur, `today` en paramètre**, arithmétique de jours **anti-DST** via `Date.UTC` ; `DayActivity` + `activeDayKeys`). Tests Vitest (362 verts au total).
- **`apps/mobile/src/data/repositories/dashboard-repository.ts`** : hooks d'agrégation réactifs composant les repos existants — `useNextSession` (prochaine séance du programme muscu actif / séance en cours), `useStreakData` (agrège séances muscu + courses running + journées nutrition en `DayActivity[]` → streak + pastilles semaine L→D), `useNutritionSummary` (totaux du jour + objectif `tdee`/`targetCalories`).
- **Widgets** `apps/mobile/src/components/dashboard/` : `TodaySessionCard`, `NutritionSummaryCard`, `StreakCard`, `WeightCard` (poids via `useUnits().formatWeight` → kg/lb). `DashboardCard` extrait en composant partagé ([components/DashboardCard.tsx](apps/mobile/src/components/DashboardCard.tsx)).
- Smoke test `jest-expo` de `StreakCard` (garde-fou anti double-nombre + états vide/loading).

### Modifié
- **[app/(tabs)/index.tsx](apps/mobile/src/app/(tabs)/index.tsx)** : l'accueil placeholder devient un dashboard **live** — widgets conditionnés aux piliers actifs (décision H), max 4 blocs, temps réel (`useQuery` PowerSync). Démarrer une séance passe par `startWorkoutFromSession(id)` (pré-remplit les exercices).
- **i18n** `home.*` (FR + EN miroir) : nouvelles clés séance/nutrition/streak/poids.

### Supprimé
- Message « le journal alimentaire arrive bientôt » (`home.nutrition.empty`) et clés placeholder devenues inutiles (`home.streak.count_*`) — grep = 0 référence.

### Corrigé (en cours de revue)
- Séance démarrée depuis le dashboard : lançait une séance **libre** au lieu de la séance **planifiée** → corrigé (`startWorkoutFromSession`).
- `StreakCard` affichait le nombre **en double** (grand chiffre + `{{count}} jours`) → clé `home.streak.suffix` sans le compte.

### Technique / Notes
- **Décisions MVP validées (H1–H4)** : séance = prochaine séance du programme (pas de planning hebdo) ; jour actif nutrition = ≥ 1 repas ; pas de « jour de repos neutre » ; widget Poids si pilier nutrition actif.
- **100 % client / offline-first** — aucune migration, aucune sync rule. i18n : 0 doublon de clé, parité FR/EN 535/535. typecheck (3 workspaces) / lint / tests (362 shared + 29 mobile) verts.
- **Reste** : recette device (build). Écarts maquette assumés/conformes spec : flèche de tendance poids sans la valeur ; sous-titre d'en-tête = nom de l'app.

## 11/07/2026 — US 4.33 : activation cloud (types régénérés)

_Branche : `feature/4.33-micronutriments` (commit précédent : `33ea91f`). Migration
`20260711140000_food_micronutrients.sql` **appliquée sur le cloud** par Damien._

### Modifié
- **`packages/shared/src/database.types.ts`** régénéré depuis le cloud (`supabase gen types
  --project-id …`) : inclut `foods.micronutrients` et `food_entries.micronutrients` (`Json`).
  typecheck (3 workspaces) vert.

### Technique / Notes
- **Sync rules** inchangées (streams en `select *`). **Reste** : re-seed cloud des 7 aliments
  enrichis (bloc `update … set micronutrients` de `seed.sql`, à exécuter dans le SQL editor) +
  **vérif device**.

## 11/07/2026 — US 4.33 : micronutriments (socle) + rangement du dossier design

_Branche : `feature/4.33-micronutriments` (commit précédent : `e26596b`). Spec + plan + maquette
(Claude Design) + implémentation TDD d'un seul tenant (workflow US complet)._

### Ajouté
- **Spec & plan** : [docs/specs/functional/us/4.33-micronutriments.md](docs/specs/functional/us/4.33-micronutriments.md)
  et [docs/plans/4.33-micronutriments.md](docs/plans/4.33-micronutriments.md). Décisions validées :
  **panel socle ciblé** (10 champs), **stockage JSON** `micronutrients`, **snapshot** dans le journal.
- **Maquette** [design/FitTrio - Micronutriments.dc.html](design/) (Claude Design) : détail aliment
  (accordéon « Valeurs détaillées ») + aliment perso (saisie micros), clair & sombre, états vide/partiel.
- **`packages/shared/src/food.ts`** (+18 tests) : `MICRONUTRIENT_KEYS` (cholesterol_mg, sodium_mg,
  magnesium_mg, potassium_mg, calcium_mg, iron_mg, vitamin_c_mg, vitamin_d_ug, vitamin_b9_ug,
  vitamin_b12_ug), `micronutrientsSchema` (écriture stricte), `parseMicronutrients` (lecture tolérante
  → `{}` sur JSON invalide, clés hors panel/valeurs ≤0 ignorées), `scaleMicronutrients`,
  `sumMicronutrients`, `saltFromSodiumMg` (sodium×2,5/1000, 2 déc.). Colonne `micronutrients` (défaut
  `{}`) sur `foodRowSchema` **et** `foodEntryRowSchema`.
- **Composant `MicronutrientDetails`** : accordéon repliable, 3 groupes (lipides/minéraux/vitamines),
  valeur pour la quantité + pour 100 g, **sel dérivé** sous le sodium, **état vide** ; n'affiche que les
  nutriments **présents** (jamais `0` par défaut). Intégré au `QuantityPanel` (partagé picker + scan).
- **Aliment perso** : bloc repliable **facultatif** de saisie des 10 micros (`food-custom.tsx`).
- **Migration** [`20260711140000_food_micronutrients.sql`](supabase/migrations/20260711140000_food_micronutrients.sql) :
  `foods.micronutrients` + `food_entries.micronutrients` en `jsonb not null default '{}'` (additif,
  rétrocompatible). Seed enrichi de **7 aliments bruts** (valeurs pour 100 g d'après CIQUAL ; épinards =
  valeurs de la maquette) — les autres gardent `{}`.
- **i18n** FR + EN (miroir, `nutrition.micros.*`, parité 520/520).
- **Tests** : `mapOffMicronutrients` (+3, `apps/mobile/src/lib/__tests__/openfoodfacts.test.ts`).

### Modifié
- **`lib/openfoodfacts.ts`** : `mapOffMicronutrients` extrait/normalise les micros du bloc `nutriments`
  (grammes OFF → mg ×1000 / µg ×1e6, alias `folates_100g` pour la B9), ajoutés à `OffFood` → import.
- **`powersync/schema.ts`** : colonne `micronutrients` (text/JSON) sur `foods` et `food_entries`.
- **Repos** : `food-repository` (lecture `parseMicronutrients`, écriture perso/OFF) ; `journal-repository`
  (**snapshot** figé à l'ajout/édition + transport dans copyMeal/duplicateDay).
- **`food-picker` / `food-scan`** : figent `scaleMicronutrients(micros, grammes)` dans le snapshot d'entrée.

### Supprimé
- **Rangement `design/`** : double emboîtement `prototype-d-application-markdown/` aplati (nouveautés
  remontées) ; doublons/brouillons supprimés (`dark.html`, `dark2.html`, `FitTrio.dc (1).webp`,
  `download.md`, `.gitkeep`) ; `Architecture Applicative (1).jpg` → `Architecture Applicative.jpg` ;
  note obsolète du `design-system.md` corrigée + inventaire à jour.

### Technique / Notes
- **Rétrocompatible** : colonne à défaut `'{}'`, aucune donnée existante impactée. **Sync rules : rien à
  faire** (streams `foods`/`food_entries` en `select *`). Stockage micros = pour 100 g sur `foods`, figés
  pour la quantité sur `food_entries` (cohérent avec la règle de non-recalcul de l'historique).
- typecheck (3 workspaces) / lint (0 err) / test (354 shared + 26 mobile) verts.
- **Reste (checkpoint 🔴)** : appliquer migration + re-seed sur le cloud + `db:types` ; **vérif device**
  (lecture micros, snapshot journal, import OFF avec/sans micros, offline, sync, FR/EN). **Point
  d'attention** : (a) enrichissement seed limité à 7 aliments — compléter d'après l'**export CIQUAL réel**
  (ne pas inventer de valeurs) ; (b) **normalisation d'unité OFF** (hypothèse g→mg/µg) à confirmer sur
  quelques produits réels au test device. **Différé** : agrégat micros du jour, objectifs/RDA, micros
  dans recettes/repas types, panel étendu.

## 09/07/2026 — US 1.15 : implémentation affichage & saisie des unités (métrique/impérial)

_Branche : `feature/1.15-unites-metrique-imperial` (commit précédent : `a7822fb`). 16 commits (`0d1df62` → `379a7cc`), exécution subagent-driven (implémenteur → revue spec → revue qualité par phase)._

### Ajouté
- **`packages/shared/src/units.ts`** (+ `units.test.ts`, 343 tests verts) : `cmToFtIn`/`ftInToCm` (+ `CM_PER_IN`), `paceToSystem`/`formatPaceMMSS` (allure s/km↔s/mi → `M:SS`), parseurs de saisie `parseWeightToKg`/`parseDistanceToKm`/`heightPartsToCm` (texte→SI, virgule/point, vide/invalide/≤0/notation scientifique → `null`). `LB_PER_KG`/`MI_PER_KM` exportées.
- **`apps/mobile/src/hooks/useUnits.ts`** (+ smoke test jest-expo metric/imperial × FR/EN) : hook mince liant `useSettings().units` + locale i18n à `units.ts` ; `formatWeight`/`formatDistance`/`formatHeight`/`formatPace` (via `Intl.NumberFormat`), symboles, parseurs liés, pré-remplissages `weightInputValue`/`distanceInputValue`/`heightPartsFromCm`, convertisseurs numériques `toWeightValue`/`toDistanceValue`/`formatDistanceValue` (pour les axes de courbes). Aucune conversion dans le hook (délègue à shared).

### Modifié
- **Affichage branché sur le hook** (plus aucune unité codée en dur) : `workout.tsx` (en-tête + saisie charge), `workout-summary.tsx` (volume + records), `history/[id].tsx` (séries/records/volume), `progress/index.tsx` (records + **séries de courbes converties**, axe = symbole), `programs/[id].tsx` (PlanRow), `nutrition-stats.tsx` (poids + **courbe de poids convertie**), `run/active.tsx` & `run/summary.tsx` (distance + allure).
- **Saisie reconvertie en SI** : charge de série (`workout.tsx`), charge cible programme (`components/programs/ExercisePlanEditor.tsx`), distance manuelle (`run/summary.tsx`), pesée (`nutrition-stats.tsx`), **poids + taille** (`(onboarding)/infos.tsx`, `profile.tsx`) avec **taille = 1 champ cm (métrique) / 2 champs ft+in (impérial)**.
- **Anti-dérive d'arrondi** sur les champs à valeur stockée (`profile.tsx`, `ExercisePlanEditor.tsx`) : chaîne initiale mémorisée (`useRef`) ; si le champ n'est pas modifié, on réécrit le **SI d'origine** (jamais `parse(display(SI))`).
- **i18n FR+EN (miroir, 495 clés chacune)** : symboles sortis des chaînes ; gabarits `{{kg}} kg` → `{{weight}}` (valeur pré-formatée) ; placeholders d'exemple par unité.

### Supprimé
- Clés i18n devenues inutiles (grep = 0 réf) : `running.active.kmUnit`/`paceUnit`, `progress.unit.kg`, `programs.edit.targets.weightPlaceholder`, et l'orpheline `history.row.volumeKg`. `formatPace` locales + styles orphelins des écrans run.

### Corrigé
- **Collision de clé JSON `workout.set`** (en-tête de colonne « Série/Set » cassé, rendait la clé brute) : les placeholders avaient été ajoutés comme objet `workout.set.*`, écrasant la chaîne `workout.set`. Placeholders déplacés en `workout.weightPlaceholderMetric/Imperial`. Détecté par la revue finale ; scan anti-doublon des 2 locales = 0 collision.

### Technique / Notes
- **Stockage 100 % SI** (kg/km/cm) — aucune migration, aucun impact sync/offline/PowerSync. Unités **découplées de la langue**.
- **Revues** : Phases A & B revues par phase (spec + qualité, avec durcissements) ; Phase C+D revue consolidée finale (1 bloquant corrigé = la collision `workout.set`). `typecheck` (3 workspaces) / `lint` / `test` (343 shared + 23 mobile) verts. Parité FR/EN 495/495.
- **Reste (Task 14 DoD)** : recette manuelle sur device (bascule metric↔imperial réactive, FR+EN, round-trip saisie, taille ft/in, anti-dérive) — **nécessite un build**. US validable **sans activation cloud** (pas de 🔴).
- Rebord UX connu (non bloquant) : le champ charge de série en impérial ré-affiche la valeur reconvertie à chaque frappe (`.toFixed(1)`) — à confirmer sur device, bascule possible vers le patron état-local si gênant.

## 09/07/2026 — US 1.15 : cadrage (spec + plan) affichage & saisie des unités (métrique/impérial)

_Branche : `feature/1.15-unites-metrique-imperial` (commit précédent : `c2c0e84`)_

### Ajouté
- **[docs/plans/1.15-unites-metrique-imperial.md](docs/plans/1.15-unites-metrique-imperial.md)** :
  plan d'implémentation de l'US 1.15 (14 tâches TDD). Approche A validée : logique pure étendue
  dans `packages/shared/src/units.ts` (conversions taille cm↔ft/in, allure s/km↔s/mi + format
  `M:SS`, parseurs de saisie tolérants vide→`null`) + hook mince `apps/mobile/src/hooks/useUnits.ts`
  (formateurs/parseurs liés au réglage `useSettings().units` et à la locale i18n via
  `Intl.NumberFormat`) ; branchement de 12 écrans (affichage + saisie) ; refonte des clés i18n
  porteuses d'unité (FR+EN miroir) ; anti-dérive d'arrondi par champ ; garde-fou grep.
- Pour mémoire, la **spec** correspondante ([docs/specs/functional/us/1.15-unites-metrique-imperial.md](docs/specs/functional/us/1.15-unites-metrique-imperial.md))
  avait été commitée en `c2c0e84` (non encore tracée ici) : elle est consignée avec ce commit.

### Technique / Notes
- **Décisions de cadrage** : stockage **toujours en SI** (aucune migration/sync/PowerSync) →
  **US 100 % client, validable sans activation cloud** (pas de checkpoint 🔴). Unités **découplées
  de la langue**. Seul vrai changement d'UI de saisie : la **taille** (1 champ `cm` en métrique →
  2 champs `ft` + `in` en impérial).
- **Workflow** : spec ✔ → plan ✔ (revu par un plan-document-reviewer : *Approved*) → maquette
  **écartée** (option 2, changement d'UI mineur, validé par Florian le 09/07/2026) → **code à suivre**.

## 09/07/2026 — V0.4 US4.10 : scan code-barres nutrition (OpenFoodFacts)

_Branche : `feature/4.10-scan-code-barres` (commit précédent sur `dev` : `c26abe2`)_

### Ajouté
- **Scan de code-barres (4.10)** : ajout d'un aliment au journal en scannant son EAN/UPC.
  - **`expo-camera`** (`~57.0.1`) + config plugin dans [app.json](apps/mobile/app.json)
    (`cameraPermission` FR). **Module natif → nécessite un nouveau dev build.**
  - **[lib/openfoodfacts.ts](apps/mobile/src/lib/openfoodfacts.ts)** : `fetchOpenFoodFactsByBarcode`
    (API produit v2, garde le code numérique EAN/UPC, `null` si introuvable/hors-réseau ; constantes
    d'URL/headers/fields factorisées avec la recherche texte existante).
  - **[food-repository.ts](apps/mobile/src/data/repositories/food-repository.ts)** :
    `findFoodByBarcode` — lookup **local** (lecture ponctuelle) pour réutiliser un produit déjà
    importé et **éviter un doublon** avant d'interroger le réseau.
  - **Écran [food-scan.tsx](apps/mobile/src/app/food-scan.tsx)** (modale) : caméra + cadre de visée,
    machine à états (scan → résolution → quantité / introuvable), gestion de la permission,
    verrou anti double-scan. Résolution : local d'abord, puis OpenFoodFacts, puis état « introuvable »
    (rescan / créer un aliment). Ajout au journal via `addFoodEntry`, retour au journal (`dismissAll`).
  - Entrée **« Scanner »** dans le footer du food-picker (mode journal) + route déclarée dans
    [_layout.tsx](apps/mobile/src/app/_layout.tsx). i18n FR/EN (`scan.*`).

### Modifié
- **[food-picker.tsx](apps/mobile/src/app/food-picker.tsx)** : le `QuantityPanel` local est
  **extrait** en composant partagé [components/QuantityPanel.tsx](apps/mobile/src/components/QuantityPanel.tsx)
  (avec le type `PickTarget`), réutilisé par le picker et l'écran de scan (DRY).

### Technique / Notes
- Qualité : `typecheck` OK (3 workspaces), `lint` 0 erreur (4 warnings pré-existants hors périmètre),
  `test` **325** verts. Régénération des typed-routes Expo pour inclure la route `food-scan`.
- Pas de test unitaire ajouté : `fetchOpenFoodFactsByBarcode` (réseau) et `findFoodByBarcode`
  (module natif PowerSync) suivent la même convention que l'existant (`searchOpenFoodFacts`,
  repositories) → validés device.
- **Reste 🔴** : nouveau **dev build** (`expo-camera`) + **vérif device** (scan réel, permission
  refusée, produit absent d'OpenFoodFacts, offline).

## 09/07/2026 — chore(db) : CLI Supabase + régén des types depuis le cloud + activation cloud actée

_Branche : `chore/supabase-cli-db-types-cloud` (commit précédent sur `dev` : `e70e2df`)_

### Ajouté
- **Supabase CLI** en devDependency racine (`supabase@^2.109.1`) — les scripts `db:*` la résolvent
  via `npm run` (l'install globale npm est volontairement bloquée par Supabase). La génération de
  types depuis le **cloud** ne nécessite ni Docker ni Supabase local.

### Modifié
- **[package.json](package.json)** : le script `db:types` bascule de `--local` (exigeait Docker +
  une base Supabase locale) vers `--project-id nsxzflxsgovriwwvflxe` (génération depuis le **cloud**,
  source de vérité du projet). Corrige un **footgun** : `--local` sans Docker échouait en laissant
  la redirection `>` **vider `database.types.ts`**.
- **[packages/shared/src/database.types.ts](packages/shared/src/database.types.ts)** régénéré depuis
  le cloud — inclut désormais la colonne `meals` de `nutrition_profiles` (migration `20260707140000`),
  absente depuis le 06/07. Confirme que **le cloud est à jour** : toutes les migrations appliquées,
  publication `powersync` + sync rules déployées.
- **[TODO.md](TODO.md)** : section « infra cloud » requalifiée en **activation faite (09/07/2026)** ;
  correction de la mention périmée « sync rules **edition 3** » → format réel **`bucket_definitions`**
  (les Sync Streams `auto_subscribe` ne délivraient aucune donnée au client ; revert documenté en tête
  de [powersync-sync-rules.yaml](docs/specs/technical/powersync-sync-rules.yaml)). Reste = **vérif
  device** par pilier + validation terrain running.

### Technique / Notes
- Qualité : `lint` 0 erreur (4 warnings pré-existants hors périmètre, `charts-smoke.test.tsx`),
  `typecheck` OK (3 workspaces), `test` **325** verts.
- `--project-id` s'authentifie via le token Supabase déjà présent dans l'environnement ; **aucun
  secret committé** (le project-ref est public, présent dans l'URL de l'API).

## 09/07/2026 — Running R1 : correction du crash au lancement d'une course (permission Android)

_Branche : `fix/location-receive-boot-completed` (commit précédent : `d8b919e`)_

### Corrigé
- **[apps/mobile/app.json](apps/mobile/app.json)** : ajout de
  `android.permissions: ["android.permission.RECEIVE_BOOT_COMPLETED"]`. Sans cette permission,
  l'app **plantait quelques secondes après le démarrage d'une course** (puis en boucle à chaque
  relance) : à la 1ʳᵉ position GPS, `expo-location` (`LocationTaskConsumer`) demande à
  `expo-task-manager` de programmer un **job JobScheduler persistant** pour livrer la position à
  la tâche JS ; Android **exige** `RECEIVE_BOOT_COMPLETED` pour tout job persistant → sinon
  `IllegalArgumentException: Requested job cannot be persisted without holding ...RECEIVE_BOOT_COMPLETED`
  → `FATAL EXCEPTION` (process tué, `crashed too many times, killing!`).

### Technique / Notes
- **Diagnostic** : `adb logcat` sur l'APK **preview** installé sur un Pixel 6a (Android 14/15).
  Le foreground service démarrait correctement — la piste initiale « foreground service mal
  déclaré » était donc **fausse** ; c'est bien le job persistant de task-manager qui manquait la
  permission (trace : `TaskManagerUtils.scheduleJob` → `LocationTaskConsumer.reportLocationsImmediately`).
- En Expo (prebuild), `android.permissions` est **additif** avec les permissions injectées par les
  config plugins (`expo-location` : `FOREGROUND_SERVICE`, `ACCESS_BACKGROUND_LOCATION`, etc.) — celles-ci
  restent en place ; on ne fait qu'**ajouter** `RECEIVE_BOOT_COMPLETED`.
- **Nécessite un nouveau build** (`npm run build:dev` / `build:preview`) pour prendre effet : la
  permission est native, l'APK actuel ne peut pas être corrigé à chaud. Validation terrain à refaire.
- Qualité : `typecheck` **OK** (3 workspaces), `lint` **OK** (0 erreur ; 4 warnings pré-existants
  hors périmètre dans `charts-smoke.test.tsx`). Tests non exécutés (changement de config native
  `app.json`, sans impact possible sur les suites ; tests mobile non encore câblés).
- Hors périmètre volontairement laissé de côté : modif locale non commitée de `apps/mobile/eas.json`
  (bloc `env` `EXPO_PUBLIC_*`).

## 07/07/2026 — EAS : projet sous l'organisation Expo (owner → `wellness-appl`)

_Branche : `chore/expo-org-owner`_

### Modifié
- **[apps/mobile/app.json](apps/mobile/app.json)** : `owner` `damdamdeoh` → `wellness-appl`
  (organisation Expo), suite au **transfert** du projet EAS vers l'org (buildable à deux).
  `extra.eas.projectId` (`4d24d343-…ac689`) + `updates.url` **inchangés** (le transfert conserve
  le projectId) et cohérents entre eux.

### Technique / Notes
- Débloque le build par **Florian** (`florian935` invité dans l'org).
- Transfert **confirmé côté serveur** (`eas project:info` → `@wellness-appl/wellness-app`, même
  projectId). Le `owner` local encore à `damdamdeoh` provoquait un mismatch qui **bloquait toute
  commande `eas`** (`env:push` : « does not match owner specified in the "owner" field ») — d'où cette mise à jour.
- **Reste** (section URGENT TODO) : EAS Environment Variables `EXPO_PUBLIC_*` (preview + production
  = faites) ; confirmer un `eas build` sous l'org puis retirer la bannière.

## 07/07/2026 — Corrige le nom d'app dans les permissions de localisation (SparkWine → Wellness)

_Branche : `fix/app-name-location-permissions`_

### Corrigé
- **Permissions de localisation** ([app.json](apps/mobile/app.json)) : la popup système affichait
  « **SparkWine** utilise votre position… » (copier-coller d'un autre projet) au lieu de
  « **Wellness** ». Corrigé sur `locationAlwaysAndWhenInUsePermission` + `locationWhenInUsePermission`.

### Technique / Notes
- Seule occurrence dans le code suivi (l'artefact `android/…/app.config` est ignoré et se régénère).
- Prend effet au prochain build natif.

## 07/07/2026 — Corrige le bouton « Enregistrer » qui passait à la ligne (écran Suivi)

_Branche : `fix/weight-save-button-wrap`_

### Corrigé
- **Bouton « Enregistrer » (pesée, écran Suivi) tronqué sur 2 lignes** : le conteneur avait une
  largeur fixe `120` trop courte pour le libellé. Passé en `minWidth: 120` (le bouton s'adapte
  au texte, robuste aux traductions) — [nutrition-stats.tsx](apps/mobile/src/app/nutrition-stats.tsx).
- **Défensif** : `numberOfLines={1}` sur le libellé du composant [Button](apps/mobile/src/components/Button.tsx)
  — un libellé de bouton ne doit jamais wrapper sur 2 lignes (évite ce défaut ailleurs).

### Technique / Notes
- Trouvé en testant l'app sur device. `typecheck` + `lint` (0 erreur) + `test` (325 + 21) verts.
- Vérifié en live : le libellé tient désormais sur une seule ligne.

## 07/07/2026 — Corrige l'overflow de `food_entries.order_index` (sync PowerSync)

_Branche : `fix/food-entries-order-index-overflow`_

### Corrigé
- **Le journal alimentaire ne se synchronisait pas au cloud** : `addFoodEntry` écrivait
  `order_index: Date.now()` (epoch en **ms**, ≈ 1,78 × 10¹²), au-delà du `integer` Postgres
  de `food_entries.order_index` (max 2,147 × 10⁹). SQLite local l'acceptait (typage lâche,
  affichage OK) mais chaque upload PowerSync échouait — `value "…" is out of range for type
  integer` — et **rejouait en boucle toutes les ~5 s**, bloquant toute la file d'upload.
  Correctif : `order_index` = `MAX(order_index)+1` scopé au repas (helper `nextOrderIndex`,
  même idiome que `workout-repository` / `program-repository`) → un petit entier séquentiel.
  Fichier : [journal-repository.ts](apps/mobile/src/data/repositories/journal-repository.ts).

### Technique / Notes
- Trouvé en testant l'app sur device (Pixel 6a) : warning `[PowerSync] upload PUT food_entries
  échoué` en boucle. Le connecteur upload via `op.opData` (snapshot capturé à l'écriture,
  [connector.ts](apps/mobile/src/powersync/connector.ts)) : les entrées **déjà** créées
  gardent l'`order_index` géant et continueront de bloquer la file tant que la base locale
  n'est pas réinitialisée (`disconnectAndClear`) — ce fix ne concerne que les écritures futures.

## 07/07/2026 — Corrige la résolution de `@wellness/shared` sous Windows (Metro)

_Branche : `fix/metro-resolution-shared-windows`_

### Corrigé
- **Bundling natif impossible sur Windows** : Metro échouait avec
  `Unable to resolve "@wellness/shared" from …/goal.tsx` (donc écran d'erreur du dev-client au
  lieu de l'app). Cause : sur Windows, npm workspaces crée des **junctions** (et non des
  symlinks) pour lier les packages locaux ; le resolver Metro ne les suit pas (`lstat` ne les
  voit pas comme des liens). Correctif : `resolver.extraNodeModules` dans
  [apps/mobile/metro.config.js](apps/mobile/metro.config.js) mappe explicitement
  `@wellness/shared` → `packages/shared`.

### Technique / Notes
- Lancement sur **téléphone Android physique en USB depuis Windows** (mémo débogage) :
  1. `adb reverse tcp:8081 tcp:8081` puis viser `http://127.0.0.1:8081` (le loopback n'est pas
     filtré par le pare-feu Windows, qui bloque sinon le port 8081 en Wi-Fi → `ETIMEDOUT`).
  2. Démarrer Metro **sans** `--host localhost` (sinon bind IPv6 `::1` seul et `adb reverse`,
     qui tape en IPv4, renvoie `unexpected end of stream`).

## 07/07/2026 — V0.4 : repas personnalisables (4.15) + alerte croisée déficit/volume (4.32)

_Branche : `feature/4.15-4.32-finitions-v04`_

### Ajouté
- **Repas personnalisables (4.15)** : renommer / ajouter / supprimer ses repas.
  - `@wellness/shared` : `mealConfigItemSchema`, `DEFAULT_MEAL_CONFIG`, `resolveMealConfig`,
    champ `meals` sur `nutritionProfileRowSchema`. Migration `20260707140000` (colonne `meals` jsonb +
    **relâche le CHECK `food_entries.meal_type`** pour autoriser des clés custom). Schéma PowerSync + repo.
  - Journal rendu depuis la config ; écran **Gérer les repas** (`nutrition-meals`). Signatures
    repository `MealType` → `string` (clés de repas libres).
- **Alerte croisée (4.32)** : `shouldAlertDeficitVolume` (shared) + carte sur `nutrition-stats` —
  déficit calorique hebdo ≥ 15 % **et** fort volume muscu (Σ reps×kg sur 7 j) → conseil de récupération.
  Première stat croisée inter-piliers (décision H).

### Technique / Notes
- `typecheck` + `lint` (0 erreur) + `test` (325) verts.
- **Checkpoint 🔴** : appliquer la migration `20260707140000_nutrition_meals.sql` sur le cloud.
- **Reste V0.4** : 4.10 scan + 1.14/2.5 rappels (**natif** → build).

## 07/07/2026 — V0.4 : saisie de repas par liste (langage naturel) + copier un repas (4.5 / 4.18)

_Branche : `feature/4.5-saisie-langage-naturel`_

### Ajouté
- **Saisie par liste (4.5)** : écrire un repas en une phrase (« une banane, 3 tranches de pain de
  mie, et beurre de cacahuète ») → l'app retrouve chaque aliment.
  - `@wellness/shared/meal-parser` : parseur pur (segmentation `,`/et/avec/and/with/+/retours ligne,
    quantité chiffre|mot, unités FR/EN tranche/tbsp/verre/g…, décimales `2,5` préservées) +
    `normalizeName` / `bestMatchIndex` (recherche floue tolérante **accents + pluriel**) +
    `DEFAULT_UNIT_GRAMS`. **+12 tests** (318 au total).
  - Écran `meal-quick-entry` : analyse → **revue éditable** (grammes/kcal, items non reconnus
    signalés) → confirmation. Rien n'est ajouté avant validation (spec §8). Offline. Entrée depuis
    le food-picker (« Saisie par liste »).
- **Copier (4.18)** : `copyMeal` / `duplicateDay` (repository) + action « **Copier d'hier** » sur un
  repas vide du journal.

### Technique / Notes
- `typecheck` + `lint` (0 erreur) + `test` verts.
- **Reste V0.4** : 4.15 renommer/ajouter repas (schéma), 4.32 stat croisée, 4.10 scan + 1.14/2.5
  rappels (**natif** → nouveau build).

## 06/07/2026 — chore(db) : types Supabase régénérés (food, recipes, runs, bodyweight)

_Branche : `chore/db-types-food-recipes`_

### Modifié
- **`packages/shared/src/database.types.ts`** régénéré via l'API Management Supabase après
  application sur le cloud des migrations food (`150000/150001` + seed), running (`120000`),
  recettes/poids (`130000/130001`). Contient désormais `foods`/`food_*`, `recipes`/
  `recipe_ingredients`, `meal_templates`/`meal_template_items`, `body_weight_entries`, `runs`.

### Technique / Notes
- **Cloud à jour** : 10 tables créées + seed 50 aliments + RLS + publication PowerSync (24 tables) —
  appliqué via API Management. `typecheck` vert.
- Reste (hors SQL) : redéployer les **sync rules edition 3** sur le dashboard PowerSync.

## 06/07/2026 — V0.4 US4.24 : recettes, repas types, poids & stats

_Branche : `feature/4.24-recettes-poids-stats`_

### Ajouté (items 4.24-4.26, 1.13, 4.30, 4.31)
- **`packages/shared`** : `recipe.ts` (schémas recettes/ingrédients/repas types + helpers `perServing`/
  `scalePortions`) + `bodyweight.ts` (pesées + `weightTrend`/`averageIntake`). **+tests** (306 shared).
- **5 tables PowerSync** (user_id) : `recipes`, `recipe_ingredients`, `meal_templates`,
  `meal_template_items`, `body_weight_entries`. Migrations `20260707130000/130001` + RLS + sync rules edition 3.
- **Repositories** : `recipe-repository` (totaux SQL), `meal-template-repository` (save/apply),
  `bodyweight-repository` + `useDailyTotals` (stats apports).
- **Écrans** : `recipe-edit` (ingrédients via food-picker mode recette, total + par portion, 4.24/4.25) ;
  **food-picker** étendu (onglets Recettes/Repas types + mode recette) ; **nutrition-stats** (pesée,
  courbe poids 4 sem/3 mois/1 an, apports moyens 7/30 j — `ProgressLineChart` réutilisé) ; onglet
  Nutrition (icône Suivi + « enregistrer comme repas type » par repas, 4.26).

### Technique / Notes
- `typecheck` + `lint` (0 erreur) + `test` verts.
- **Différé** : 4.32 stat croisée déficit/volume, rappels 1.14/2.5 (`expo-notifications` natif), planning/liste de courses (V1.1).
- **Checkpoints 🔴** : appliquer migrations `130000/130001` sur Supabase, redéployer sync rules (5 streams), `db:types`, vérif device.

## 06/07/2026 — V0.4 US4.8 : base d'aliments & journal alimentaire

_Branche : `feature/4.8-aliments-journal` · commit précédent sur `dev` : `632f5b5`_

### Ajouté (cœur du pilier Alimentation — items 4.8/4.9/4.11-4.14/4.16/4.17/4.19-4.23)
- **`packages/shared/src/food.ts`** : enums (catégories, sources, repas), schémas `foods`/
  `food_translations`/`food_entries`/portions, helpers purs `resolveFoodName` / `scaleNutrition` /
  `sumNutrients`. **+16 tests** (253 shared).
- **4 tables PowerSync** : `foods` (owner_id null = bibliothèque), `food_translations`,
  `food_favorites`, `food_entries` (snapshot). Migrations `20260706150000_food_tables.sql` +
  `150001_food_rls.sql` + **sync rules edition 3** (streams food) + **seed 50 aliments bilingues** curés.
- **`food-repository`** (recherche nom résolu SQL, favoris, aliment perso, import OFF) +
  **`journal-repository`** (entrées du jour, ajout/maj/suppr) + **`lib/openfoodfacts.ts`** (recherche texte, sans clé).
- **Écrans** : onglet **Nutrition** = journal (nav jours, totaux + barres macros temps réel, 4 repas) ;
  **food-picker** (recherche locale + OpenFoodFacts, favoris, portions/quantité, quick add) ;
  **food-custom** (aliment perso). FR + EN.

### Technique / Notes
- `typecheck` + `lint` (0 erreur) + `test` verts.
- **Différé** : scan code-barres (4.10, expo-camera), renommer/ajouter repas (4.15), copier repas/
  journée (4.18), recettes & repas types (4.24-4.26), poids & stats (1.13/1.14/4.30-4.32), notif repas (2.5).
- **Checkpoints 🔴 humains** : appliquer migrations `150000/150001` + **seed** sur Supabase, redéployer
  les sync rules (streams food), `db:types`, vérif device.

## 06/07/2026 — V0.5 Running R1 : tracker GPS nu (course libre)

_Branche : `feature/running-r1-tracker` · commit précédent sur `dev` : `5f1b91d`_

### Ajouté (premier incrément V0.5 — Running)
- **`packages/shared/src/running.ts`** : calculs GPS purs — `haversineMeters`, `totalDistance` (filtre
  outliers via `MAX_PLAUSIBLE_SPEED_MS`), `averagePace`, `instantPace`, **encodage trace append-friendly**
  (`encodeSegment`/`appendToTrack`/`decodeTrack`, polyline + deltas de temps, length-prefix), `runRowSchema`.
  **+45 tests.**
- **Table `runs`** : migration `20260707120000_running_runs.sql` + RLS (table utilisateur) + **stream
  edition 3** + schéma PowerSync local. Trace GPS = **1 colonne encodée** sur la ligne (pas de table de
  points → 1 ligne/course, évite l'explosion PowerSync).
- **`run-repository`** : `useActiveRun`/`useRun`/`useRunHistory`, `startRun` (garde anti double-active),
  `flushTrack` (append-only **sérialisé**, garde de statut), `finishRun` (au stop, `avg_pace` des scalaires
  flushés, garde active), `cancelRun` (soft delete), `setRunFeedback`/`setManualRunDistance`.
- **Suivi GPS** : `expo-location` + `expo-task-manager` + **foreground service Android** (nouveau dev build),
  service `tracker`/`tracker-task` (encode+append par batch, auto-pause, pause observable, stop→drain→finish).
- **Écrans** : démarrage course libre (GPS/sans-GPS, refus permission → bascule manuelle), suivi temps réel
  (distance/temps/allure inst.+moy., pause/reprise, écran verrouillé, keep-awake), résumé (RPE/note/distance
  manuelle). i18n FR/EN, smoke test.

### Technique / Notes
- **Découpage V0.5** : R1 (ce livrable) → R2 carte (**Mapbox/MapLibre à trancher**) → R3 profil/programmes → R4 stats/records/GPX.
- **Nouveau dev build requis** (`expo-location`/`task-manager` natifs) avant tout test device.
- Revues repo + finale : **GO**. Le cœur (GPS arrière-plan, écran verrouillé, batterie, reprise après kill,
  offline→sync) **n'est validable que sur le terrain** = checkpoint 🔴 humain (Task 10).
- **Checkpoints 🔴** : migration `runs` + stream sur le cloud, dev build, **validation terrain**.
- Caveats terrain notés : relance process Android (batch ignoré si `startTracking` pas rejoué), seuils
  auto-pause à ajuster, rendu notif foreground service à vérifier.

## 06/07/2026 — chore(db) : sync rules PowerSync en edition 3 + types Supabase générés

_Branche : `chore/db-types-sync-edition3` · commit précédent sur `dev` : `d45ac5b`_

### Modifié
- **`docs/specs/technical/powersync-sync-rules.yaml`** : **réécrit en Sync Streams (edition 3)**
  pour coller à l'instance PowerSync réelle (l'ancien format `bucket_definitions` n'était pas
  déployable dessus). 18 streams `auto_subscribe` couvrant les 13 tables (données utilisateur
  `user_id`, contenu custom `owner_id = auth.user_id()`, bibliothèque `owner_id IS NULL`) —
  socle + muscu (US1/US2/US3) + nutrition.
- **`packages/shared/src/database.types.ts`** : régénéré depuis le schéma Supabase cloud
  (`supabase gen types`) — remplace le fichier vide. Contient profils, réglages, exercices,
  séances, programmes, **nutrition_profiles**.

### Technique / Notes
- `typecheck` + `test` (241) verts ; lint 0 erreur (warnings pré-existants US3).
- **`personal_records` (US3, migration 140002) absent** des types : la table n'est pas encore
  appliquée sur le cloud. À régénérer (`npm run db:types`) une fois 140002 appliquée — les sync
  rules l'incluent déjà (à déployer quand la table existe).

## 06/07/2026 — V0.4 US4.1 : profil nutritionnel & TDEE (1.10 / 4.1-4.7)

_Branche : `feature/4.1-profil-nutritionnel-repo` · commit précédent sur `dev` : `a1c9e9f`_

### Ajouté (première US de la V0.4 — Alimentation)
- **`packages/shared/src/nutrition.ts`** : calculs purs — **TDEE Mifflin-St Jeor** (homme +5 /
  femme −161 / non précisé = moyenne, constante −78) × **facteur d'activité** 5 niveaux (4.1/4.2),
  **objectif calorique** = TDEE + delta d'objectif avec **surcharge manuelle** prioritaire (4.3),
  **macros par défaut** selon l'objectif (4.4) + conversions **%↔grammes** (grammes prioritaires,
  spec §8, 4.5), `objectiveFromGoal`, bonus jours d'entraînement (4.7). **+ `nutritionProfileRowSchema`**
  (Zod) + enum `DIET_RESTRICTIONS` (4.6). **+28 tests** (202 au total shared).
- **Table `nutrition_profiles`** (une ligne par compte) : schéma **PowerSync local** + migrations
  Supabase `20260706140000_nutrition_tables.sql` + `…140001_nutrition_rls.sql` (RLS user_id) +
  **sync rules** (bucket `user_data`).
- **`data/repositories/nutrition-repository.ts`** : `useNutritionProfile()` (lecture réactive
  `useQuery`) + `upsertNutritionProfile()` (écriture via `_sql`, mapping snake↔camel, JSON pour
  restrictions/allergènes). Aligné sur le pattern repository US1 (aucun store Zustand).
- **Écran Profil nutritionnel** (`nutrition-profile.tsx`, modale) : objectif, activité, TDEE en
  direct, macros éditables + barres, restrictions en puces, allergènes, état « profil incomplet ».
- **Onglet Nutrition** : carte résumé (objectif calorique + macros) ou CTA de configuration.
  Entrée Réglages (gated pilier actif) + route modale.
- **i18n FR + EN** : bloc `nutrition.*` complet (aucune chaîne en dur).

### Technique / Notes
- **Rebasé sur la nouvelle archi `dev`** : la 1ʳᵉ version (branche `feature/4.1-profil-nutritionnel`,
  commit `981b91d`) suivait le pattern Zustand/SecureStore, **supprimé par l'US1** (bascule
  repositories/PowerSync). Portée intégralement sur la couche data actuelle.
- `typecheck` + `lint` (0 problème) + `test` verts (jest-expo mobile + vitest shared).
- **Checkpoints 🔴 humains avant activation** : appliquer les migrations nutrition sur Supabase
  cloud, vérifier la publication `powersync`, redéployer les sync rules PowerSync, `db:types`,
  **vérif device** (offline, sync, RLS) — comme US1/US2.
- **Décision bloquante 4.8 tranchée** le 06/07/2026 : base d'aliments = **CIQUAL (bruts FR + trad. EN)
  + OpenFoodFacts** (scan) — débloque les US base d'aliments / journal.
- **Différé** : câblage 4.7 au planning muscu (dépend de la donnée planning).

## 06/07/2026 — US3 : historique & records muscu

_Branche : `feature/historique-records-muscu` · commit précédent sur `dev` : `a1c9e9f`_

### Ajouté
- **`packages/shared`** : logique records — `estimate1RM` (Epley), `computeWorkoutRecords` (max charge / 1RM estimé / meilleur volume, hors échauffement), `personalRecordRowSchema` — +39 tests (213 au total).
- **Backend** : table `personal_records` + **RLS** (table utilisateur) + sync rules + schéma PowerSync local.
- **`records-repository`** : `evaluateWorkoutRecords` (détection **strictement supérieur** à la clôture, insert atomique), `useWorkoutRecords`/`useExerciseRecords`/`useExerciseProgression`/`useMuscleVolumeThisWeek`/`useWorkoutDetail`. Calcul branché **après** `finishWorkout` (best-effort, clôture résiliente).
- **Graphes** : `react-native-svg` + `react-native-gifted-charts` ; composants `ProgressLineChart`/`MuscleVolumeBarChart` (thémés, empty-safe).
- **Écrans** : historique (liste + détail, 3.38), progression (records par exercice + courbe charge/volume 30/90j/1an + volume par groupe musculaire semaine, 3.21/3.39/3.40), **mise en avant des records battus au résumé** (3.22). Entrées depuis l'onglet muscu.

### Corrigé (revues)
- Clôture de séance **résiliente** : `onFinish` navigue même si l'évaluation des records échoue.
- Label du record `best_volume` (reps×kg) affiché **sans « kg »** (évite « 800 kg »).
- Retrait de `finishWorkoutAndEvaluate` (code mort).

### Technique / Notes
- Périmètre : records + historique + courbes. **Hors périmètre** : notification push nouveau record (3.42, différée V0.8 — détection déjà posée) ; alerte déséquilibre (3.41).
- Records = **journal** (nouvelle ligne par record, jamais d'écrasement) — compatible gamification future.
- **Nouveau dev build requis** (`react-native-svg` natif) avant test device.
- **Dette connue (transverse, pré-existante)** : l'affichage des poids ignore le réglage métrique/impérial (1.15) sur **tout le muscu** (US1/US2/US3) — `displayWeight` (`@wellness/shared`) existe mais n'est câblé nulle part → **US de suivi dédiée** (voir TODO).
- **Checkpoints 🔴 humains** : migration `personal_records` + sync rules sur le cloud, dev build svg, vérif device.
- ⚠️ **Collision de timestamp résolue au merge** : la migration records renommée `20260706140002_personal_records.sql` (l'US4.1 nutrition, mergée en parallèle, occupe `140000`/`140001`).

## 06/07/2026 — US2 : programmes muscu (structure + bibliothèque + lien séance)

_Branche : `feature/programmes-muscu` (13 commits) · commit précédent sur `dev` : `5e590fd`_

### Ajouté
- **`packages/shared`** : schémas Zod `program`/`program_translations`/`sessions`/`exercise_plans`
  (+ enums `PROGRAM_STATUSES`/`PROGRAM_LEVELS`, `resolveProgramName` fallback FR) — +47 tests (174 au total).
- **Backend Supabase (fichiers à appliquer)** : migration 4 tables programmes + **FK `workouts.session_id`/`program_id`** (différées par l'US1), migration **RLS** (pattern contenu `owner_id`), extension des **sync rules**, **seed** d'un programme éditorial placeholder (bilingue, référence les exercices US1).
- **Schéma PowerSync local** étendu (+4 tables).
- **`program-repository`** : biblio/mes-programmes/actif/détail réactifs + `createProgram`/`addSession`/`addExercisePlan`/`updateExercisePlan`/`removeExercisePlan`/`removeSession`/`duplicateProgram`/`activateProgram`/`deleteProgram` (transactions atomiques pour duplication & activation).
- **Écrans** : bibliothèque + filtre niveau + duplication (3.1-3.3), création/édition de programme (métadonnées → séances → exercices/cibles, 3.4-3.6), détail + activation un-actif-par-pilier (3.12), **démarrer une séance depuis un programme** (3.24) via `startWorkoutFromSession` (extension ciblée du workout-repository, séries pré-remplies).
- Indicateur du programme actif dans l'onglet muscu. Smoke test programmes (jest-expo).

### Technique / Notes
- Périmètre : structure + biblio + lien séance. **Hors périmètre → US2b** (nouvelle table requise) : planning calendaire (3.9-3.11), progression auto/deload (3.7/3.8), notifs séance (2.4/2.7). Records → US3.
- Revue du program-repository + revue finale d'intégration : **GO**, cohérence 5 couches vérifiée, offline-first (`isLoading = queryLoading`) et i18n FR/EN respectés. Mineurs (noms de séances FR dans le seed placeholder, filtre `goal` non exposé) → suivi.
- **Checkpoints 🔴 humains avant activation** : appliquer les migrations US2 sur Supabase cloud, redéployer les sync rules PowerSync, `db:types`, **vérif device** (Task 13) — comme l'US1.

## 06/07/2026 — US1 : socle data muscu sur PowerSync (bascule complète)

_Branche : `feature/data-socle-muscu` (22 commits) · commit précédent sur `dev` : `69134aa`_

### Ajouté
- **`packages/shared`** : schémas Zod + logique pure — `contentOwnerSyncFieldsSchema` (owner_id), `exercise`
  (+ `resolveExerciseName`, fallback FR), `workout` (+ `computeVolume`, hors échauffement),
  `user_settings`, `profileRow`. Couverture Vitest portée à **127 tests**.
- **Couche data mobile** (`apps/mobile/src/data/repositories/`) : helpers `_sql` (UUID client, UTC,
  soft delete via PATCH) + 4 repositories (`profile`, `settings`, `exercise`, `workout`) — lectures
  réactives `useQuery` (`@powersync/react`), écritures via repository. Séance en cours = ligne
  `workouts` active.
- **Schéma PowerSync local** : 7 tables (remplace la table jouet `todos`).
- **Backend Supabase** (fichiers, à appliquer) : migrations `tables` + `RLS` (9.6), `seed.sql`
  (16 exercices bilingues, UUID déterministes), `powersync-sync-rules.yaml`.
- **jest-expo** câblé (+ mocks PowerSync) — `npm run test` couvre désormais mobile **et** shared.

### Modifié
- Bascule de tous les écrans vers les repositories : onboarding, profil, réglages (+ masquage
  onglets, thème/unités/langue synchronisés), accueil, exercices, séance, résumé.
- **Gate de routing** (`_layout.tsx`) : splash tant que la base locale n'a pas résolu, puis
  onboarding vs app selon `onboarding_completed_at` — remplace `hasHydrated`. `ensureSettings`
  crée la ligne de réglages au 1er accès.
- `generateId` → **UUID v4** (`expo-crypto`).

### Supprimé
- Stores Zustand persistés `profile` / `workout` / `exercise` / `settings`, `data/exercises.ts`,
  `lib/zustand-secure-storage.ts` (**dette data soldée** : `grep persist( = 0`).

### Corrigé (revues)
- Revue workout-repo : requête des séries stable sans séance active (le `AND 0` mal placé).
- Revue finale : **démarrage offline-first** — `isLoading` ne dépend plus de `hasSynced` (évitait un
  splash infini hors-ligne pour un compte connecté) ; langue des noms d'exercices cohérente en
  séance (langue applicative, pas locale device) ; garde anti double-séance-active dans `startWorkout`.

### Technique / Notes
- Enums alignés sur `@wellness/shared` (`SEXES`, `GOALS`, `UNIT_SYSTEMS`, `PILLARS`).
- **Checkpoints 🔴 humains restants avant merge** : appliquer les 2 migrations sur Supabase cloud +
  vérifier le nom de la publication `powersync` ; déployer les sync rules sur le dashboard PowerSync ;
  **vérif device** (offline, sync montante/descendante, RLS 2 appareils, i18n FR/EN) — Task 22.
- Repositories mobiles non couverts en unitaire (module natif) → validés device.

## 06/07/2026 — Plan d'implémentation US1 (socle data muscu)

_Branche : `docs/schema-donnees-muscu` · commit précédent : `cabe5f6`_

### Ajouté
- **Plan d'implémentation** [`docs/plans/us1-socle-data-muscu.md`](docs/plans/us1-socle-data-muscu.md) :
  22 tâches en 5 phases (backend Supabase + RLS + sync rules → schémas/logique `packages/shared`
  TDD → couche data mobile repository → jest-expo + bascule des écrans → vérif device). Découpage
  bite-sized, commits bornés, points 🔴 humains isolés (migrations cloud, sync rules dashboard).

### Corrigé (revue de plan)
- `useQuery`/`useStatus` rattachés au bon package **`@powersync/react`** (et non `@powersync/react-native`).
- Ajout explicite du **gate de chargement/routing** (remplace `hasHydrated` ; évite le flash
  d'onboarding avec les lectures async) + sémantique d'upsert des réglages par défaut au 1er accès.
- Migration du symbole `MUSCLE_GROUPS`/`MuscleGroup` vers `@wellness/shared` ; reshape explicite
  de l'ancien modèle imbriqué `entries[].sets[]` vers `workout_sets` plat.

### Technique / Notes
- Commit **docs uniquement**. Revue de plan (agent `plan-document-reviewer`) traitée ; validation
  humaine (Damien/Florian) requise avant implémentation (workflow CLAUDE.md).

## 06/07/2026 — Spec : schéma de données socle & muscu (PowerSync / Supabase)

_Branche : `docs/schema-donnees-muscu` · commit précédent : `727c7f6`_

### Ajouté
- **Spec technique** [`docs/specs/technical/schema-donnees-muscu.md`](docs/specs/technical/schema-donnees-muscu.md) :
  fige le **schéma physique** du socle transverse + pilier musculation complet (V0.2 **et** V0.3)
  et la couche d'accès aux données PowerSync.
  - **13 tables** : `profiles`, `user_settings` ; contenu partagé `exercises` /
    `exercise_translations` / `programs` / `program_translations` ; muscu utilisateur
    `exercise_favorites`, `sessions`, `exercise_plans`, `workouts`, `workout_sets`,
    `personal_records`.
  - **Conventions transverses** : colonnes de synchro (`id` UUID client, `created_at`/`updated_at`
    UTC, `deleted_at` soft delete), buckets `user_data` / `shared_content` (via `owner_id`
    nullable), sync rules YAML, RLS Supabase (item 9.6).
  - **Approche d'accès** actée : lectures réactives PowerSync (`useQuery`) + **repository** pour
    les écritures ; Zustand réduit à l'UI éphémère ; **séance en cours = ligne `workouts` active**
    (fin de la persistance Zustand).
  - **Bascule propre** (cutover sans migration) des stores `profile`/`settings`/`exercise`/`workout`
    et du fichier statique `data/exercises.ts` (→ seed Supabase).
  - **Découpage en 3 US** : socle data → programmes → historique/records.

### Technique / Notes
- Décisions de cadrage tranchées (05-06/07/2026) : périmètre muscu complet · infra déjà
  provisionnée (Supabase + PowerSync) · réglages synchronisés · nom d'exercice toujours en table de
  traduction · `active_pillars` porté par `user_settings`.
- Revue de spec (agent `spec-document-reviewer`) : **approuvée**. Écarts corrigés — enums réalignés
  sur `packages/shared` (`SEXES`, `GOALS`), propriété de `active_pillars` clarifiée, garantie
  soft-delete du connecteur ancrée.
- Point laissé à valider : traduction du `name` des `sessions` (non traduit en V0.3).
- Commit **docs uniquement** (aucun code applicatif) → gates lint/typecheck/tests non rejouées.

## 06/07/2026 — V0.2 : séance libre (muscu) — 10 items

_Branche : `feat/3.23-seance-libre`_

### Ajouté (parcours cœur muscu)
- **Bibliothèque d'exercices** (3.13) : seed local bilingue (16 exercices, 6 groupes musculaires)
  + **recherche** (3.14) + **favoris** (3.15) + **exercice personnalisé** (3.16). Écran
  `exercises.tsx` (sélecteur).
- **Séance libre** (3.23) : `workout.tsx` — ajout d'exercices au fil de l'eau, **validation de
  série** reps × charge (3.25), **chrono de repos** automatique 90 s (3.28), **ajout/suppression
  de série** (3.30), **édition charge/reps en direct** (3.31), chrono de séance.
- **Résumé de fin de séance** (3.35) : durée, exercices, séries validées, volume total.
- Onglet **Muscu** : démarrer / reprendre une séance ; compteur d'historique.

### Technique / Notes
- Stores `exercise` (favoris + perso) et `workout` (séance active + historique) **persistés**
  chiffrés (SecureStore) — la séance survit à un kill (spec 3.36).
- Frontend + local (pas de rebuild). Vérifié : `typecheck` OK, `lint` (0 problème), `test` 43/43.
- **Différé** : synchro cloud (tables `exercises`/`workouts` PowerSync), GIF/démos (6.1, décision
  bloquante), records/1RM (3.22), types de séries avancés (3.27), vibration fin de repos (3.29).

## 05/07/2026 — V0.2 : profil persistant & éditable (item 1.12)

_Branche : `feat/1.12-profil-persist`_

### Ajouté (4 points)
1. **Persistance** des stores `profile` et `settings` via **SecureStore** (Zustand `persist`,
   chiffré) — l'onboarding et les préférences (thème, unités, piliers, langue) **survivent au
   redémarrage**. Gating d'hydratation dans le layout racine (`useHydrated`).
2. **Écran Profil éditable** (`app/profile.tsx`, modale) accessible depuis les Réglages :
   prénom, sexe, date de naissance, poids, taille, objectif (item 1.12).
3. **Accueil personnalisé** : « Bonjour {prénom} » quand le profil est renseigné.
4. **Relancer l'onboarding** depuis les Réglages (compte-profil-onboarding §3.3).

### Technique / Notes
- `lib/zustand-secure-storage.ts` (StateStorage SecureStore + hook `useHydrated`).
- Frontend + SecureStore (déjà dans le dev build) → **pas de rebuild**. Vérifié : `typecheck`,
  `lint` (0 problème), `test` 43/43.

## 05/07/2026 — V0.2 : onboarding skippable (items 1.7-1.11)

_Branche : `feat/1.7-onboarding`_

### Ajouté
- **Parcours d'onboarding** (groupe `(onboarding)`) après inscription, **non bloquant** :
  intro → infos (prénom, sexe, date de naissance, poids, taille) → piliers → objectif → récap.
  **« Passer »** (saute l'étape) et **« Passer tout »** disponibles partout (décision F).
- **Store profil** (`stores/profile-store.ts`) : prénom, sexe, date de naissance, poids/taille
  (SI), objectif, `onboardingCompleted`.
- **Gating** dans le layout racine : session sans onboarding → parcours ; sinon → app.
- **`packages/shared/profile.ts`** : enums `Sex` / `Goal` (+ Zod), 4 tests (100 %).
- Composants réutilisables : `Segment` (extrait des Réglages), `OnboardingScaffold`.

### Technique / Notes
- Frontend pur (hot-reload). Vérifié : `typecheck` OK, `lint` (0 problème), `test` **43/43**.
- **Profil en mémoire** pour l'instant → l'onboarding se rejoue après un redémarrage complet.
  La persistance/synchro via la table `profiles` (PowerSync) est l'US suivante.
- Étape « alimentation » (1.10) simplifiée / différée ; unités d'entrée en métrique.

## 05/07/2026 — V0.1 : écrans légaux & consentement + âge 16+ (item 1.21)

_Branche : `feat/1.21-legal-consent`_

### Ajouté
- **`packages/shared/age.ts`** : `computeAge`, `isAtLeast`, `toDate` (validation calendrier) +
  `MIN_SIGNUP_AGE` (16). **11 tests, couverture 100 %.**
- **Inscription** : champs **date de naissance** (JJ/MM/AAAA) avec contrôle **âge ≥ 16 ans**
  (RGPD) + **case de consentement** CGU / politique de confidentialité (obligatoire).
- **Écrans légaux** `(auth)/terms` et `(auth)/privacy` (composant `LegalScreen`, contenu
  **brouillon** bilingue à faire relire juridiquement) accessibles via liens à l'inscription.
- Composant `Checkbox` réutilisable. i18n FR/EN complet.

### Technique / Notes
- Frontend pur (testé en hot-reload). Vérifié : `typecheck` OK, `lint` (0 problème),
  `test` **39/39** (shared 100 %).
- Contenu légal = **placeholder** (roadmap : « textes juridiques à fournir / faire relire »).

## 05/07/2026 — V0.1 : intégration PowerSync (SQLite local + connecteur Supabase, 9.13)

_Branche : `feat/9.13-powersync`_

### Ajouté
- **SDK PowerSync** (compatible RN 0.86 / new architecture) : `@powersync/react-native`,
  `@powersync/react`, adaptateur **`@powersync/op-sqlite` + `@op-engineering/op-sqlite`**,
  polyfill `@azure/core-asynciterator-polyfill`, plugin babel `transform-async-generator-functions`.
- **`src/powersync/`** :
  - `schema.ts` — schéma local (table jouet `todos` du runbook pour valider le pipeline).
  - `connector.ts` — connecteur Supabase (`fetchCredentials` via JWT, `uploadData` rejoue le CRUD).
  - `system.ts` — `PowerSyncDatabase` sur op-sqlite.
  - `PowerSyncProvider.tsx` — contexte + connexion auto quand une session existe.
- **Indicateur de synchro** (`SyncStatus`) dans l'accueil (navigation-ux §7).
- Config `babel.config.js` + `metro.config.js` (inlineRequires blockList op-sqlite).

### Technique / Notes
- Vérifié : `typecheck` OK (API PowerSync validées), `lint` (0 problème), `test` 28/28.
- ⚠️ **Non testé au runtime** : modules natifs (op-sqlite) → nécessite un **nouveau `build:dev`**
  ET une **config cloud** (table + publication Supabase, sync rules PowerSync — voir runbook).
  Schéma métier réel à ajouter avec les US (ici table jouet `todos`).

## 05/07/2026 — Session persistante & chiffrée (SecureStore / Keystore, item 9.8)

_Branche : `feat/9.8-secure-session`_

### Ajouté
- **`lib/secure-storage.ts`** : adaptateur de stockage **chiffré et persistant** pour la
  session Supabase via `expo-secure-store` (Android Keystore — architecture §7). Découpage en
  morceaux (SecureStore limite ~2 Ko/valeur ; la session Supabase dépasse cette taille).

### Modifié
- **`lib/supabase.ts`** : le client utilise désormais `secureStorage` (session **persistée**
  entre redémarrages, item 1.5 + chiffrée, item 9.8) au lieu du stockage mémoire temporaire.
- Dépendances : `+ expo-secure-store` ; **retrait** de `@react-native-async-storage/async-storage`
  (devenu inutilisé → un module natif de moins dans le build).

### Technique / Notes
- **Nécessite un nouveau `build:dev`** : `expo-secure-store` est un module natif absent du dev
  client actuel. Après rebuild, la session survit à une fermeture complète de l'app.
- **PowerSync** volontairement **non inclus** dans ce rebuild (US dédiée) : compat native à
  vérifier avec RN 0.86 (new architecture) avant de l'ajouter.

## 05/07/2026 — V0.1 : authentification Supabase (inscription, connexion, session)

_Branche : `feat/1.1-auth-supabase`_

### Ajouté
- **Store d'auth** (`stores/auth-store.ts`) : session Supabase + `signUp` / `signIn` /
  `signOut` / `resetPassword`, résolution de session au démarrage et abonnement
  `onAuthStateChange` (session persistante, refresh silencieux — items 1.1/1.4/1.5/1.6/9.5).
- **Groupe de routes `(auth)`** : `sign-in`, `sign-up`, `forgot-password`, `verify-email`.
- **Gating de navigation** dans le layout racine : redirige vers `(auth)` sans session, vers
  `(tabs)` une fois connecté (splash maintenu jusqu'à résolution de la session).
- **Composants** réutilisables : `Button`, `TextField`, `FormScreen`.
- Réglages : section **Compte** (email + déconnexion). i18n FR/EN complet.

### Modifié
- **`lib/supabase.ts`** : stockage de session **en mémoire** (aucun module natif) pour tester
  le flux sur le dev client actuel sans rebuild.

### Technique / Notes
- Vérifié : `typecheck` OK, `lint` (0 problème), `test` 28/28, testé sur device (inscription →
  vérif email → connexion → déconnexion).
- **`.env`** local (gitignoré) créé pour charger les clés client Supabase.
- **Différé** (prochain dev build, groupé avec PowerSync) : stockage **chiffré/persistant**
  (`expo-secure-store`, item 9.8). En attendant, la session ne survit pas à une fermeture totale.
- **Différé** (US dédiées) : OAuth Google, CGU + âge 16+ (1.21), onboarding (V0.2),
  localisation des messages d'erreur Supabase.

## 05/07/2026 — Écrans piliers : en-tête structuré (ScreenHeader)

_Branche : `feat/pillar-screens`_

### Ajouté
- **Composant `ScreenHeader`** réutilisable : gros titre display + sous-titre + action optionnelle.
- Les 3 écrans piliers (Muscu / Course / Alim) reçoivent un **en-tête + tagline** au-dessus de
  l'état vide (plutôt qu'un simple état vide centré). i18n FR/EN.

### Technique / Notes
- Frontend pur, aucun package. Vérifié : `typecheck` OK, `lint` (0 problème), `test` 28/28.

## 05/07/2026 — V0.1 : unités (1.15) + blocs du dashboard d'accueil

_Branche : `feat/1.15-unites-dashboard`_

### Ajouté
- **Unités métrique/impérial** (item 1.15) :
  - **`packages/shared/units.ts`** : `UnitSystem` + schéma Zod, conversions pures
    (`kgToLb`/`lbToKg`, `kmToMi`/`miToKm`), formateurs `displayWeight`/`displayDistance`
    (stockage **toujours en SI**, conversion à l'affichage). **13 tests, couverture 100 %.**
  - Préférence `units` dans le store + **section « Unités »** dans les Réglages (segmented).
- **Tableau de bord d'accueil** (spec navigation-ux §3) : blocs en **états vides structurés** —
  *Séance du jour*, *Régularité* (semaine + compteur de série pluralisé), *Nutrition*
  (affiché seulement si le pilier est actif). Nouveau composant `Card`.

### Modifié
- Réglages : segment extrait en composant `Segment` réutilisé (thème + unités).
- Accueil : `EmptyState` unique remplacé par les blocs du dashboard.
- i18n FR/EN : clés dashboard + unités (avec pluriels `count_one`/`count_other`).

### Technique / Notes
- Vérifié : `typecheck` OK, `lint` (0 problème), `test` **28/28** (couverture shared 100 %),
  testé sur le dev client. Aucun package natif → pas de rebuild.

## 05/07/2026 — Polices custom (identité de la maquette)

_Branche : `feat/design-fonts`_

### Ajouté
- **Polices Google** (via `@expo-google-fonts`) fidèles à la maquette : **Bricolage Grotesque**
  (display/titres), **Hanken Grotesk** (corps/UI), **Space Mono** (chiffres).
- **`src/theme/fonts.ts`** : hook `useAppFonts` (chargement des graisses via `expo-font`) +
  constantes `fontFamily`. **`src/theme/typography.ts`** : presets sémantiques (display, title,
  body, mono…).
- **Splash gate** : le layout racine maintient le splash (`expo-splash-screen`) tant que les
  polices ne sont pas prêtes, puis le masque.

### Modifié
- Application des polices : accueil, écrans piliers (`EmptyState`), Réglages, libellés d'onglets,
  titre de la modale — `fontWeight` remplacé par les familles custom (livrées par graisse).

### Technique / Notes
- Chargées à l'exécution → **aucun rebuild natif** (testé sur le dev client existant).
- Vérifié : `typecheck` OK, `lint` (0 problème), `test` (15/15), bundle Android OK (1547 modules).
- Rappel outillage : **relancer Metro avec `-c`** après tout `expo install` (le cache ignore les
  nouveaux assets, cf. `.ttf`).

## 05/07/2026 — V0.1 : shell de navigation (onglets, thème, états vides)

_Branche : `feat/2.1-navigation-onglets`_

### Ajouté
- **Navigation à onglets** (spec navigation-ux §2 · items 2.1/2.2) : groupe `src/app/(tabs)/`
  — Accueil, Muscu, Course, Alim. Les onglets des **piliers non activés sont masqués**
  (décision H), pilotés par le store, réactivables dans les Réglages (`href: null`).
- **Écran Réglages** (`settings.tsx`, en modale) : activation des piliers + **choix du thème**
  clair / sombre / système (item 1.16).
- **Système de thème** (`src/theme/`) : échelle nommée clair/sombre (accent terracotta) dérivée
  de la maquette de référence, hook `useTheme`, application à la navigation + StatusBar.
- **États vides soignés** (item 2.10) : composant `EmptyState` (icône + texte + CTA) sur chaque
  écran pilier + accueil ; conteneur `Screen` thémé.
- **i18n FR + EN** de toute l'US (aucune chaîne en dur — décision G).
- Dépendance `@expo/vector-icons` (icônes onglets/états vides).

### Technique / Notes
- Vérifié : `typecheck` OK, `lint` (0 problème), `test` (15/15), `expo export web` OK (11 routes).
- **Aucun module natif ajouté** → chargeable par le dev client existant sans rebuild.
- **Différé** : polices custom (Bricolage Grotesque / Hanken Grotesk / Space Mono) et unités
  métrique/impérial (item 1.15) — US dédiées.

## 05/07/2026 — Socle Supabase local

_Branche : `chore/supabase-socle`_

### Ajouté
- **`supabase/`** (`supabase init`) : `config.toml`, `.gitignore` ; **migration de conventions**
  `20260705150000_init_conventions.sql` (extension `pgcrypto` + trigger réutilisable
  `set_updated_at()` pour l'offline-first) ; `seed.sql` (placeholder). Aucune table métier
  (viendront avec leurs US).
- **Client Supabase typé** mobile ([src/lib/supabase.ts](apps/mobile/src/lib/supabase.ts)) :
  `createClient<Database>` (Auth), session persistée (AsyncStorage), auto-refresh piloté par
  `AppState`, polyfill URL. Lit `EXPO_PUBLIC_SUPABASE_URL` / `..._ANON_KEY`.
- **`apps/mobile/.env.example`** (valeurs client uniquement — jamais de secret).
- **`packages/shared`** : `database.types.ts` (stub des types générés) exporté (`Database`, `Json`).
- **Scripts racine** : `db:start` / `db:stop` / `db:reset` / `db:status` / `db:types`.
- Dépendances mobile : `@supabase/supabase-js`, `@react-native-async-storage/async-storage`,
  `react-native-url-polyfill`.

### Modifié
- **CLAUDE.md** / **TODO.md** : commandes `db:*`, structure `/supabase`, état du socle Supabase.

### Technique / Notes
- **Non provisionné / non appliqué** : pas de Docker sur ce poste → `supabase start` et la
  génération réelle des types (`db:types`) restent à faire ; pas de projet cloud.
- Stockage des tokens en clair (AsyncStorage) pour l'instant — à passer en chiffré
  (SecureStore/Keystore) avec l'US d'authentification (architecture §7).
- Vérifié : `npm run typecheck` OK, `npm run lint` (0 problème), `npm run test` (15/15).

## 05/07/2026 — CI GitHub Actions + ESLint mobile

_Branche : `chore/scaffolding-monorepo`_

### Ajouté
- **`.github/workflows/ci.yml`** : workflow **CI** sur PR/push vers `dev`/`main` — `npm ci`
  puis **typecheck + lint + tests** (Node depuis `.nvmrc`, cache npm, concurrency avec
  annulation, timeout 15 min). Répond à bonnes-pratiques §10 (qualité < 10 min sur chaque PR).
- **ESLint mobile** : `eslint` + `eslint-config-expo` (flat config `eslint.config.js`) —
  `npm run lint` (`expo lint`) désormais non interactif.

### Modifié
- **`src/i18n/index.ts`** : suppression d'une warning eslint (faux positif
  `import/no-named-as-default-member` sur `i18n.use()`), lint à **0 problème**.
- **CLAUDE.md** / **TODO.md** : CI et lint documentés.

### Technique / Notes
- Vérifié en local : `npm run lint` (0 problème), `npm run typecheck` OK, `npm run test`
  (15/15) ; `ci.yml` = YAML valide.

## 05/07/2026 — Config EAS (profils de build Android)

_Branche : `chore/scaffolding-monorepo`_

### Ajouté
- **`apps/mobile/eas.json`** : 3 profils alignés sur architecture §9 —
  `development` (dev client APK, **requis PowerSync**), `preview` (bêta interne APK),
  `production` (AAB, `autoIncrement`) ; `submit.production` → Google Play **track internal**.
  `appVersionSource: remote` (EAS gère le `versionCode`).
- **Scripts npm** mobile : `build:dev` / `build:preview` / `build:prod` / `submit:prod`.
- **README mobile** : section Builds (EAS) + procédure `eas login` / `eas init`.

### Technique / Notes
- **`eas init` effectué** (compte `damdamdeoh`) : `extra.eas.projectId`, bloc `updates`
  (EAS Update) et `runtimeVersion` (policy `appVersion`) ajoutés dans `app.json` ; dépendances
  `expo-dev-client` + `expo-updates` installées.
- **Reste à faire** : lancer le **premier build** (`npm run build:dev`).
- Vérifié : `eas.json` = JSON valide, `npm run typecheck` OK, `expo install --check` aligné.

## 05/07/2026 — Runner de tests unitaires (Vitest sur packages/shared)

_Branche : `chore/scaffolding-monorepo`_

### Ajouté
- **Vitest** sur `packages/shared` (`vitest.config.ts`, env node) avec **seuils de couverture
  à 100 %** (statements / branches / functions / lines) — exigence bonnes-pratiques §4 pour la
  logique pure. Scripts `test`, `test:watch`, `test:coverage`.
- **15 tests** couvrant les schémas Zod : `sync.test.ts` (UUID, timestamp UTC, champs de synchro,
  soft delete, contenu global sans `userId`) et `pillar.test.ts` (piliers, locales FR/EN).

### Modifié
- **package.json** (`@wellness/shared`) : dépendances de dev `vitest` + `@vitest/coverage-v8`.
- **CLAUDE.md** / **TODO.md** : commande `test` documentée, item runner de tests coché.

### Technique / Notes
- Vérifié : `npm run test` OK (15/15), couverture **100 %**, `npm run typecheck` OK (fichiers de
  test inclus).
- Tests **mobile** (jest-expo) volontairement différés à la première feature.

## 05/07/2026 — Scaffolding du monorepo (npm workspaces + Expo + shared)

_Branche : `chore/scaffolding-monorepo`_

### Ajouté
- **Racine monorepo** : `package.json` (npm workspaces `apps/*` + `packages/*`),
  `tsconfig.base.json` (TS strict + `noUncheckedIndexedAccess`), `.editorconfig`, `.nvmrc`
  (Node 20), config Prettier (`.prettierrc.json`, `.prettierignore`). Scripts agrégés :
  `typecheck` / `lint` / `test` / `mobile`.
- **`apps/mobile`** (`@wellness/mobile`) : app **Expo SDK 57** (React Native 0.86, React 19.2)
  générée avec **Expo Router**, adaptée au monorepo (`metro.config.js` : watch racine +
  résolution `node_modules` hoistés). Démo du template retirée, écran d'accueil minimal.
  - **i18n** (`src/i18n/`) : i18next + react-i18next + expo-localization, **FR + EN**,
    résolution de la langue du terminal, français par défaut.
  - **State** (`src/stores/settings-store.ts`) : store **Zustand** des réglages (langue,
    thème, piliers actifs opt-in — décision H).
- **`packages/shared`** (`@wellness/shared`) : types + schémas **Zod** partagés — champs de
  synchro transverses (UUID client, timestamps UTC, soft delete) et piliers / locales.
- **`apps/admin`** (`@wellness/admin`) : **stub** du back-office web (détaillé en V0.7).

### Modifié
- **CLAUDE.md** : état du projet (scaffolding posé) + section **Commandes** renseignée +
  arbre de structure (`apps/`, `packages/`).
- **TODO.md** : items de scaffolding cochés (monorepo, app Expo, i18n, Commandes).

### Technique / Notes
- Vérifié : `npm install` (604 paquets) OK, `npm run typecheck` OK sur les 3 workspaces,
  `expo export --platform web` OK (bundle Metro résout `@wellness/shared` et i18n).
- **Pas encore câblés** (US dédiées à venir) : dev build EAS, runner de tests, Supabase,
  intégration PowerSync.

## 05/07/2026 — Ajout du bundle design FitTrio (handoff Claude Design)

_Branche : `docs/verdict-spike-001`_

### Ajouté
- **`design/`** : bundle de handoff exporté depuis Claude Design (« FitTrio ») — prototype
  HTML/CSS/JS (`FitTrio.dc.html`), preview (`FitTrio.preview.webp`), `design-system.md`,
  script `support.js` et `README.md` d'instructions pour l'agent.

### Fichiers touchés
- `design/FitTrio.dc.html`, `design/FitTrio.preview.webp`, `design/README.md`,
  `design/design-system.md`, `design/support.js`

## 05/07/2026 — Spike 001 PowerSync : verdict ✅ + runbook corrigé

_Branche : `docs/verdict-spike-001`_

### Ajouté
- **ADR-001** — section « Résultat du spike 001 (05/07/2026) » : tableau des 6 critères,
  verdict (**PowerSync validé**), 2 pièges de config rencontrés, réserve sur la volumétrie GPS.

### Modifié
- **ADR-001** : statut → « ✅ Accepté et confirmé » (confirmé par le spike le 05/07/2026).
- **runbook-provisioning-spike** : rôle de réplication dédié `powersync_role` (1.3) ;
  formulaire de connexion réel + étape **Client Auth « Use Supabase Auth »** contre le 401
  `PSYNC_S2101` (2.2/2.2b) ; **Sync Streams `edition: 3` avec `auto_subscribe: true`** (2.3).

### Technique / Notes
- Le code de la mini-app du spike vit **hors du repo** (`../wellness-spike`, dépôt git séparé),
  conforme à la spec spike-001 (« jetable / archivé hors du repo principal »).

### Fichiers touchés
- `docs/adr/ADR-001-moteur-sync-offline.md`, `docs/specs/technical/runbook-provisioning-spike.md`,
  `CHANGELOG.md`, `TODO.md`

## 05/07/2026 — Ajout de `.gitignore` et `.gitattributes`

_Branche : `chore/gitignore-gitattributes` · commit précédent : `d81b11e`_

### Ajouté
- **`.gitignore`** : dépendances, secrets/env (`.env*`, clés, `google-services.json`, keystores),
  artefacts Expo/Metro/Android/iOS, Supabase local, caches, fichiers OS/IDE. Le dossier `.claude/`
  reste suivi volontairement.
- **`.gitattributes`** : normalisation des fins de ligne (LF dans le dépôt), scripts Windows en
  CRLF, fichiers binaires marqués — **supprime les avertissements « LF will be replaced by CRLF »**.

### Fichiers touchés
- `.gitignore`, `.gitattributes`

## 05/07/2026 — `/commit` : robustesse du hash CHANGELOG (pas de self-amend)

_Branche : `chore/mise-en-place-process`_

### Corrigé
- Règle CHANGELOG de `/commit` : ne plus embarquer le hash du commit courant (circulaire) ni
  faire de `--amend` pour l'insérer. Une entrée est identifiée par date + branche + sujet ; le
  hash court du **commit précédent** est renseigné au passage.
- Hash de l'entrée précédente corrigé (`e174d89`).

### Fichiers touchés
- `.claude/commands/commit.md`, `CHANGELOG.md`

## 05/07/2026 — `/commit` : revue de code, CHANGELOG et traces de diff (`e174d89`)

_Branche : `chore/mise-en-place-process`_

### Ajouté
- **`CHANGELOG.md`** : trace des modifications par commit, construite à partir du `git diff`,
  maintenue par `/commit`.
- **`/commit`** : étape de **revue de code** (relecture critique du diff, délégable à
  `superpowers:code-reviewer`) et étape de **tenue du CHANGELOG** ; l'analyse exploite le diff
  complet comme trace pour les devs / le débogage.

### Modifié
- `CLAUDE.md` : responsabilités élargies de `/commit` (revue + CHANGELOG + traçabilité) et ajout
  de `CHANGELOG.md` à la structure documentaire.

### Fichiers touchés
- `CHANGELOG.md`, `.claude/commands/commit.md`, `CLAUDE.md`

## 05/07/2026 — Adoption de `dev` comme branche d'intégration (`785459c`)

_Branche : `chore/mise-en-place-process`_

### Modifié
- **Modèle de branches** : `main` (release, protégée) · `dev` (intégration, cible du travail
  courant) · `feature/*` (travail). Les branches partent désormais de `dev`.
- **`/commit`** : refuse aussi `dev` (étape branche) et pousse le travail sur `dev` distant en
  fin de commande.

### Fichiers touchés
- `CLAUDE.md`, `.claude/commands/commit.md`

## 05/07/2026 — Base documentaire de cadrage & process de travail (`b46d458`)

_Branche : `chore/mise-en-place-process`_

### Ajouté
- Base documentaire unique sous `docs/` (product, specs functional/technical, adr, roadmap).
- `CLAUDE.md`, `SYNTHESE-CADRAGE.md`, `TODO.md` (suivi vivant), `design/` (maquettes).
- Workflow obligatoire par fonctionnalité (spec → plan → design → validation → code) et
  convention de branches dans `CLAUDE.md`.
- Commande `/commit` adaptée au projet (`.claude/commands/commit.md`).

### Supprimé
- Anciens dossiers de cadrage séparés `dams/` et `flo/` (fusionnés dans `docs/`).

### Modifié
- `README.md` (mise à jour post-fusion).
