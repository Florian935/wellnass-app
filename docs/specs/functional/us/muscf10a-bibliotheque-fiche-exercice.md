---
id: MUSC-F10a
titre: "Bibliothèque d'exercices en accès direct + fiche exercice (socle)"
roadmap: [3.13]
catalogue: []
etape: close
branche: feature/muscf10a-bibliotheque-fiche-exercice
maj: 22/07/2026
---
# US MUSC-F10a — Bibliothèque d'exercices en accès direct + fiche exercice (socle)

> Nouvelle US (demande Florian, 22/07/2026), **1ᵉʳ des 3 incréments** du chantier « fiche exercice » :
> **F10a** (socle : accès direct + fiche données actuelles + gestion des exos perso) → **F10b** (section
> records sur la fiche) → **F10c = MUSC-F2** (muscles secondaires + variantes/alternatives, migration + admin).
> Découpage validé Florian. Branche : `feature/muscf10a-bibliotheque-fiche-exercice`.
> **Statut : à valider (pas de code avant validation).** **Aucune migration.**

## 0. Contexte

L'écran bibliothèque d'exercices ([exercises.tsx](../../../../apps/mobile/src/app/exercises.tsx)) — recherche,
filtres (MUSC-F3), favoris, création d'exo perso — n'est aujourd'hui atteignable que **depuis une séance en
cours** (bouton « Ajouter un exercice » de [workout.tsx](../../../../apps/mobile/src/app/workout.tsx#L558), ou
« remplacer un exercice » avec `replaceExerciseId`). Il n'y a **aucune entrée dans le hub Muscu**
([strength.tsx](../../../../apps/mobile/src/app/%28tabs%29/strength.tsx)) pour parcourir la bibliothèque sans
lancer de séance. Son `onPick` ne fait d'ailleurs **rien sans séance active**
([exercises.tsx:52-61](../../../../apps/mobile/src/app/exercises.tsx#L52-L61)).

Par ailleurs il n'existe **aucun écran de détail d'exercice**, et les exercices **perso** (créés par
l'utilisateur via `addCustomExercise`) ne peuvent être **ni modifiés ni supprimés** dans l'app.

Décisions de cadrage (brainstorming Florian, 22/07/2026) :
- **Entrée persistante dédiée** dans le hub Muscu (non masquable — l'objectif est un accès **fiable**, pas un
  widget que l'utilisateur peut cacher et perdre).
- **Tap en mode parcours → ouvre la fiche** de l'exercice (le mode « ajout en séance » reste inchangé).
- **Fiche = données actuelles** (nom, groupe, matériel, instructions, favori, badge perso) ; muscles
  secondaires/variantes = F10c, records = F10b.
- **Gestion des exos perso incluse** : modifier + supprimer, **suppression toujours autorisée** (soft-delete,
  sans blocage) — les programmes/templates référençant l'exo gardent une entrée orpheline à gérer, l'historique
  est préservé.
- Fiche accessible **uniquement depuis la biblio en mode parcours** pour l'instant (les autres points d'entrée —
  historique, progression — sont différés).

## 1. Périmètre à livrer

- **Entrée « Bibliothèque d'exercices »** persistante dans le hub Muscu → ouvre `exercises.tsx` en **mode
  parcours**.
- **Mode parcours** de `exercises.tsx` : distinct du mode « ajout/remplacement en séance » via un paramètre de
  route ; le tap sur un exercice **ouvre sa fiche** au lieu d'ajouter à une séance. Recherche, filtres (MUSC-F3),
  favoris et création d'exo perso restent disponibles.
- **Écran fiche exercice** (nouveau) : nom, groupe musculaire, matériel (si renseigné), instructions (si
  présentes), bouton favori ⭐, badge « perso » si custom.
- **Gestion des exos perso** sur la fiche (custom uniquement) : **Modifier** (nom, groupe, matériel) +
  **Supprimer** (soft-delete + confirmation, toujours autorisé).
- **Repository** : `useExercise(id)`, `updateCustomExercise`, `deleteCustomExercise`.
- **i18n** FR/EN ; offline-first ; **aucune migration**.

**Hors périmètre :**
- **Records sur la fiche** (1RM réel/estimé, charge max, volume) → **F10b**.
- **Muscles secondaires + variantes/alternatives** → **F10c (= MUSC-F2)** (migration + admin).
- Édition des exercices de **bibliothèque** (contenu éditorial = back-office admin, jamais côté mobile).
- Fiche accessible depuis l'historique / la progression / la séance → **différé** (autre US).
- Média (GIF/vidéo) — **abandonné** (MUSC-F1).

## 2. Comportement attendu

### 2.1 Entrée dans le hub Muscu
- Une entrée **« Bibliothèque d'exercices »** (carte/rangée d'action dédiée, avec icône) est **toujours visible**
  dans le hub Muscu, indépendante de la grille de widgets personnalisable (non masquable).
- Un tap ouvre l'écran bibliothèque en **mode parcours**.

### 2.2 Mode parcours (`exercises.tsx`)
- Ouvert depuis le hub → **mode parcours** : le tap sur une ligne d'exercice **ouvre sa fiche**
  (`/exercises/[id]`). L'étoile favori reste tappable indépendamment (comme aujourd'hui).
- Recherche par nom, **tiroir Filtres** (groupe musculaire + matériel, MUSC-F3) et **création d'exo perso**
  restent fonctionnels en mode parcours.
- Ouvert depuis une séance (« Ajouter un exercice » / « remplacer ») → **comportement inchangé** : le tap
  ajoute/remplace l'exercice dans la séance (pas de fiche). Le mode est déterminé par un **paramètre de route**
  explicite (pas par la simple présence/absence d'une séance active, pour rester non ambigu).

### 2.3 Fiche exercice (`/exercises/[id]`)
- Affiche : **nom** (résolu selon la langue), **groupe musculaire** (libellé `muscle.*`), **matériel** (libellé
  `equipment.*` si renseigné, sinon masqué), **instructions** (si présentes, sinon section masquée), **badge
  « perso »** si `source = 'custom'`.
- **Favori** : bouton ⭐ (réutilise `toggleFavorite`), reflète et bascule l'état.
- **Exercice introuvable** (id inexistant / supprimé) : état « Exercice introuvable » + retour.
- Accessible **uniquement** depuis la biblio en mode parcours (F10a).

### 2.4 Gestion des exos perso (custom uniquement)
- La fiche d'un exercice **`source = 'custom'`** (et `owner_id` = utilisateur courant) affiche **Modifier** et
  **Supprimer**. La fiche d'un exercice de **bibliothèque** ne les affiche pas (lecture seule).
- **Modifier** : formulaire (nom + groupe musculaire + matériel optionnel via `EQUIPMENTS`). Enregistrer met à
  jour l'exercice et sa traduction dans la langue courante ; la fiche se rafraîchit.
- **Supprimer** : confirmation (`Alert`, titre = nom de l'exercice) → **soft-delete toujours autorisé**. Après
  suppression : retour à la biblio, l'exo **disparaît** de la liste et du picker.
  - **Historique préservé** : les séances passées et records qui référencent l'exo continuent d'afficher son nom
    — c'est **déjà le cas** puisqu'on ne soft-delete pas les traductions (voir §3), donc **rien à modifier** sur
    ces écrans.
  - **Références orphelines** : un programme/template qui référence l'exo supprimé garde son entrée ; ces écrans
    **ne plantent pas** et affichent toujours le nom (traductions vivantes) — comportement acquis, pas une action.

## 3. Règles métier

- **Édition/suppression réservées aux exos perso** de l'utilisateur courant (`source = 'custom'` **et**
  `owner_id = auth.uid()`). Jamais sur la bibliothèque (`owner_id IS NULL`) — garanti par la RLS existante +
  garde applicative (ne pas afficher les boutons).
- **Soft-delete : uniquement la ligne `exercises`** (`deleted_at = now()`), **surtout PAS les
  `exercise_translations`**. Raison (vérifiée dans le code) : toutes les surfaces d'affichage (historique,
  programmes, templates, records, dashboard) résolvent le nom **depuis `exercise_translations`** via
  `LEFT JOIN exercise_translations … AND tl.deleted_at IS NULL` — elles ne joignent **pas** `exercises` pour le
  nom. Si on soft-deletait aussi les traductions, `COALESCE(tl.name, tfr.name)` renverrait NULL → le nom
  s'afficherait **vide** précisément là où on veut le préserver. En laissant les traductions **intactes**, le nom
  reste résolu partout, **sans toucher aucune requête d'affichage**. Réutilise `softDelete` sur `exercises` seul.
- **Sélection vs affichage** : les surfaces de **sélection** (biblio, picker) filtrent déjà `e.deleted_at IS NULL`
  sur `exercises` ([exercise-repository.ts:73](../../../../apps/mobile/src/data/repositories/exercise-repository.ts#L73))
  → un exo supprimé n'est **plus sélectionnable** (voulu). Les surfaces d'**affichage** ne joignant pas
  `exercises` pour le nom, elles continuent de l'afficher (traductions vivantes) → **aucun audit de jointures
  `exercises` nécessaire**, aucune requête d'affichage à modifier.
- **Favori d'un exo supprimé** : la ligne `exercise_favorites` peut rester (elle ne remonte plus car la biblio
  filtre l'exo supprimé) — pas de nettoyage requis en F10a.
- **Offline-first** : toutes les écritures (favori, modif, suppression) sont **optimistes locales**, synchro en
  arrière-plan (PowerSync). Aucune dépend d'un aller-retour réseau.

## 4. Architecture & données

### 4.1 Aucune migration
Réutilise le schéma existant (`exercises`, `exercise_translations`, `exercise_favorites`). Le champ
`instructions` existe déjà sur `exercise_translations`.

### 4.2 Repository (`exercise-repository.ts`)
- **`useExercise(id: string)`** → `{ exercise: ExerciseDetail | null; isLoading }` où `ExerciseDetail` étend la
  vue liste avec `instructions: string | null`. Résout le nom + instructions depuis `exercise_translations`
  (langue courante → `fr`). La fiche filtre `exercises.deleted_at IS NULL` → après une suppression on revient à
  la biblio (état « introuvable » si l'id est un exo supprimé). Les traductions restant vivantes, le nom se
  résout normalement pour tout exo non supprimé.
- **`updateCustomExercise(id, { name, muscle, equipment })`** : garde `source = 'custom'` + `owner_id` courant ;
  met à jour `exercises` (`muscle_primary`, `equipment`) et la ligne `exercise_translations` de la langue de
  saisie (`name`). `writeTransaction`.
- **`deleteCustomExercise(id)`** : garde custom + owner ; **`softDelete('exercises', id)` UNIQUEMENT** — ne
  **pas** soft-deleter les `exercise_translations` (voir §3 : sinon le nom se vide sur les surfaces d'affichage).
  Pas de vérification de références (suppression toujours autorisée, décision Florian).
- `toggleFavorite` : réutilisé tel quel.

### 4.3 Routing (`apps/mobile/src/app`)
- Nouvelle route **`/exercises/[id]`** (fiche). ⚠️ `exercises.tsx` est aujourd'hui un **fichier** présenté en
  **modal** ([_layout.tsx:187-197](../../../../apps/mobile/src/app/_layout.tsx#L187-L197)). Ajouter la route de
  détail impose de choisir la structure (ex. déplacer `exercises.tsx` → `exercises/index.tsx` + créer
  `exercises/[id].tsx`, ou route sœur `exercises/[id].tsx`) et de **l'enregistrer** dans `_layout.tsx` avec une
  présentation cohérente (la fiche est poussée **au-dessus** de la biblio modale). À trancher au plan.
- `exercises.tsx` accepte un **param de mode** (ex. `mode=browse`) : en `browse`, `onPick` → `router.push(
  '/exercises/[id]')` ; sinon comportement séance inchangé. Le param `replaceExerciseId` existant est conservé.

### 4.4 Hub Muscu (`strength.tsx`)
- Ajouter l'entrée persistante « Bibliothèque d'exercices » (hors grille de widgets), qui
  `router.push({ pathname: '/exercises', params: { mode: 'browse' } })`.

### 4.5 UI fiche
- Nouvel écran fiche : sections Compte de l'exercice (nom, groupe, matériel, instructions, badge perso), action
  favori, et (custom only) actions Modifier/Supprimer. Formulaire de modification (réutiliser `TextField` +
  `Segment` pour le groupe, sélecteur matériel cohérent avec MUSC-F3). Confirmation de suppression via `Alert`.

### 4.6 i18n
- Clés `exercises.detail.*` (titre, sections, instructions, boutons Modifier/Supprimer, confirmation, état
  introuvable) + `exercises.library` (libellé de l'entrée hub) — FR + EN, parité stricte. Réutilise `muscle.*`,
  `equipment.*`, `exercises.customBadge`.

## 5. Tests
- Fonctions repository de garde/écriture : couvrir que `updateCustomExercise`/`deleteCustomExercise` ne
  s'appliquent qu'aux exos perso de l'utilisateur (garde), et **vérifier (non-régression)** qu'après suppression
  le nom reste résolu sur les surfaces d'affichage (traductions non supprimées — comportement acquis, pas un
  changement). Fonctions pures extraites si pertinent (Vitest).
- Non-régression : le mode « ajout/remplacement en séance » de `exercises.tsx` reste inchangé.

## 6. Definition of Done
- [ ] Spec + plan + **maquette** validés (pas de code avant).
- [ ] Entrée persistante « Bibliothèque d'exercices » dans le hub Muscu → ouvre la biblio en mode parcours.
- [ ] Mode parcours : tap → fiche ; recherche/filtres/création perso fonctionnels ; mode séance **inchangé**.
- [ ] Fiche `/exercises/[id]` : nom, groupe, matériel, instructions, favori, badge perso ; état introuvable.
- [ ] Exos perso : Modifier (nom/groupe/matériel) + Supprimer (soft-delete, confirmation) — custom & owner only ;
      boutons absents sur les exos de bibliothèque.
- [ ] Suppression : soft-delete de la ligne `exercises` **seule** (traductions préservées) → l'exo disparaît de
      la biblio/picker ; **historique et références programmes/templates ne plantent pas** et affichent toujours
      le nom (aucune requête d'affichage modifiée).
- [ ] `useExercise` / `updateCustomExercise` / `deleteCustomExercise` + tests ; aucune migration.
- [ ] i18n FR/EN (parité) ; offline-first ; typecheck/lint/tests verts ; PR relue par les deux devs.

## 7. Explicitement différé
- **F10b** — Section records sur la fiche (1RM réel/estimé, charge max, meilleur volume ; lecture
  `personal_records` + historique, sans migration). ⚠️ **Note pour F10b** : `records-repository.ts` calcule les
  records via `JOIN exercises e … AND e.deleted_at IS NULL` (INNER) — un exo perso soft-deleted verrait donc ses
  séries **exclues du recalcul futur** des records. Sans incidence sur l'affichage F10a, mais à prendre en compte
  au cadrage de F10b.
- **F10c (= MUSC-F2)** — Muscles secondaires + variantes/alternatives (migration + saisie admin).
- Fiche accessible depuis l'historique / la progression / la séance en cours.
- Nettoyage des favoris/références orphelines d'un exo supprimé.
