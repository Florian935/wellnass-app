# US Refonte-A — Unifier programme → planning → séance (muscu + running)

> **Chantier refonte Muscu**, US-A (socle). Reprend ce que l'US [3.9](./3.9-planning-muscu-unifie.md)
> avait **explicitement différé** (« démarrer une séance depuis le planning » + « lien automatique avec
> une séance réellement effectuée ») et **fusionne** « activer » et « planifier » un programme.
> Corrige les **problèmes 1 et 2** de l'[audit des flux](../../../refonte-muscu/audit-flux.md).
> Pilier-agnostique → bénéficie **muscu ET running**. Branche : `feature/refonte-muscu-a` ·
> Date : 18/07/2026 · **Statut : à valider (pas de code avant validation Florian/Damien).**
> 🔴 **Contient une migration** (`planned_session_id` sur `workouts`) → checkpoint cloud (voir §5).

## 0. Contexte

Deux défauts de flux structurels du pilier muscu (déjà propagés à running, cf. audit) :

1. **Le planning et le logging ne se parlent pas.** On ne peut pas démarrer une vraie séance depuis le
   calendrier ([planning/index.tsx](../../../../apps/mobile/src/app/planning/index.tsx) : le menu n'offre
   que « Marquer fait / Reporter / Sauter »), et une séance réellement effectuée ne met jamais à jour
   l'occurrence du calendrier (`startWorkoutFromSession`/`finishWorkout` ne connaissent pas
   `planned_sessions`). Deux façons de « compléter » divergentes → historique/volume/records vides d'un
   côté, calendrier « manqué » de l'autre.
2. **« Activer » vs « Planifier » se recouvrent.** La fiche programme
   ([programs/[id].tsx](../../../../apps/mobile/src/app/programs/%5Bid%5D.tsx)) offre deux boutons :
   « Activer » (bascule `is_active`, ne génère rien) et « Planifier » (durée + jours → génère le
   calendrier **et** active déjà, via `planProgram`). On peut activer sans calendrier, et « Planifier »
   fait en réalité les deux. La spec [musculation.md §2.4](../musculation.md) promet pourtant une
   génération **automatique** du calendrier à l'activation.

Décisions de cadrage (brainstorming Florian, 18/07/2026) :
- **Fusion** : un seul concept « programme actif = programme au calendrier ». Un seul geste
  « Démarrer ce programme ». Le bouton « Activer » isolé disparaît.
- **Calendrier** : action principale = **Démarrer la séance** ; secondaires = Reporter, Sauter,
  **Marquer fait sans détailler**.
- **Complétion** : **lien explicite** — seule une séance démarrée depuis l'occurrence marque **cette**
  occurrence `done` à sa fin (le workout porte l'id de l'occurrence). Aucune heuristique.
- **Changement de programme actif** : **popup** proposant de **retirer ou garder** les occurrences
  futures encore `planned` de l'ancien programme ; l'historique est toujours conservé.

## 1. Périmètre à livrer

- **Fusion activer/planifier** sur la fiche programme (muscu + running) : un bouton unique
  « Démarrer ce programme » ouvrant l'assistant de planification ; « Modifier la planification » si déjà
  actif ; suppression du bouton « Activer » isolé et de la fonction `activateProgram` de l'UI.
- **Démarrer une séance depuis le calendrier** : action principale sur une occurrence `planned`, liée à
  cette occurrence.
- **Lien de complétion** : migration `planned_session_id` (nullable) sur `workouts` ; `startWorkoutFromSession`
  le renseigne ; `finishWorkout` bascule l'occurrence liée en `done` + `completed_at`.
- **Actions secondaires** sur une occurrence : Reporter, Sauter, Marquer fait sans détailler (conserve
  l'existant 3.11).
- **Popup de changement de programme** (retirer/garder les occurrences futures de l'ancien).
- **i18n** FR/EN des nouveaux libellés ; **non-régression running** (mêmes écrans, pilier-agnostiques).

**Hors périmètre (autres US du chantier) :**
- Raccourci « séance du jour » sur le hub muscu → **US-B**.
- Refonte de l'écran de séance en cours (flux guidé, types de séries, pause…) → **US-C**.
- Templates de séance libre → **US-D**.
- Glisser-déposer dans le calendrier (reste par action, cf. 3.9) ; progression automatique de charge.

## 2. Comportement attendu

1. **Démarrer un programme** : depuis le détail du programme → « **Démarrer ce programme** » → assistant
   (date de début, durée, affectation de chaque séance-gabarit à un jour) → génère les occurrences datées
   **et** active (un actif par pilier). Si le programme est déjà actif, le bouton devient « **Modifier la
   planification** » (re-génère : remplace les `planned`, conserve `done`/`skipped`).
2. **Démarrer une séance depuis le calendrier** : dans « Mon planning », taper une occurrence `planned` →
   **action principale « Démarrer la séance »** → crée le workout pré-rempli (via `startWorkoutFromSession`)
   **lié à l'occurrence** (`planned_session_id`) → navigue vers l'écran de séance. À la **fin**
   (`finishWorkout`), l'occurrence passe **`done`** + `completed_at`.
3. **Actions secondaires** (même menu) : **Reporter** (aujourd'hui / demain / +7), **Sauter**,
   **Marquer fait sans détailler** (bascule `done` sans workout — cas « entraîné hors app »). Une
   occurrence `done`/`skipped` **n'affiche plus** « Démarrer ».
4. **Abandon** : si la séance liée est **annulée** (`cancelWorkout`), l'occurrence **reste `planned`**
   (rien n'est marqué).
5. **Séance libre** ou séance lancée **depuis la fiche programme** (ad hoc, hors calendrier) :
   `planned_session_id` **nul** → ne touche **aucune** occurrence (conforme au « lien explicite »).
6. **Changement de programme actif** : démarrer/planifier un programme alors qu'un autre est actif sur le
   même pilier → **popup** : « L'ancien programme a des séances à venir — les **retirer** du calendrier ou
   les **garder** ? ». *Retirer* = soft-delete des occurrences **futures `planned`** de l'ancien ; *garder*
   = on les laisse. Dans les deux cas l'**historique** (`done`/`skipped`/passées) est conservé
   ([musculation.md §8](../musculation.md)).
7. **Réactif** (`useQuery`), **offline-first** (lecture/écriture locales).

## 3. Règles métier

- **Un seul concept** : « programme actif » ⇔ « programme au calendrier » (par pilier). Il n'existe plus
  d'état « actif sans calendrier ». `planProgram` reste le point d'entrée unique (génère + active).
- **Lien de complétion explicite** : une occurrence ne passe `done` automatiquement **que** si une séance
  démarrée **depuis elle** est **terminée**. Aucune correspondance par jour ou par gabarit.
- **Au plus une séance active** à la fois (garde `startWorkoutFromSession` déjà en place) : démarrer depuis
  le calendrier alors qu'une séance active existe déjà → **proposer de reprendre** l'active plutôt que d'en
  créer une seconde (le `planned_session_id` n'est posé qu'à la **création** d'une nouvelle séance).
- **Idempotence de re-planification** : ne pas dupliquer les occurrences `done` ; remplacer les `planned`
  (logique existante de `planProgram`).
- **Un actif par pilier** : planifier un programme muscu n'affecte pas le programme running actif, et
  inversement. Le popup de changement ne concerne que le **même** pilier.
- **Marquer fait sans détailler** : bascule `done` + `completed_at`, **sans** créer de workout (donc sans
  volume/records/historique) — comportement `markPlannedSessionDone` actuel, conservé comme action
  secondaire assumée.

## 4. Architecture

- **Données** — migration (voir §5) : colonne **`planned_session_id TEXT NULL`** sur `workouts`
  (référence logique vers `planned_sessions.id`), + schéma PowerSync + `db:types`.
- **Repository workout** ([workout-repository.ts](../../../../apps/mobile/src/data/repositories/workout-repository.ts)) :
  - `startWorkoutFromSession(sessionId, opts?: { plannedSessionId?: string })` → stocke `planned_session_id`
    sur la ligne `workouts` créée (nul si ad hoc). Garde « une active à la fois » inchangée.
  - `finishWorkout(id, …)` → si la séance porte un `planned_session_id`, passer l'occurrence liée en `done`
    + `completed_at` **dans la même logique de fin** (best-effort n'empêchant pas la clôture du workout).
  - `cancelWorkout` inchangé (n'affecte pas l'occurrence).
- **Repository planned-session**
  ([planned-session-repository.ts](../../../../apps/mobile/src/data/repositories/planned-session-repository.ts)) :
  - `planProgram` : ajouter la gestion du **changement de programme** — option `{ previousProgram: 'keep' | 'remove' }`
    (ou équivalent) pilotée par le popup ; *remove* soft-delete les occurrences **futures `planned`** de
    l'ancien programme actif du pilier. Logique génération/activation inchangée par ailleurs.
  - `markPlannedSessionDone` : conservé (action secondaire).
- **Écran planning** ([planning/index.tsx](../../../../apps/mobile/src/app/planning/index.tsx)) : le menu
  d'occurrence (Modal) devient **Démarrer (principal)** + Reporter / Sauter / Marquer fait (secondaires).
  ⚠️ **`startWorkoutFromSession` est spécifique muscu** (il lit `exercise_plans` et crée `workouts`/`workout_sets`) :
  sur ce modal **partagé muscu + running**, « Démarrer » n'est câblé que pour `item.pillar === 'strength'`
  (sinon on créerait un workout **vide** pour une course). Pour une occurrence **running**, « Démarrer »
  est **masqué** cette US (seules les actions secondaires restent) — sauf si l'option (a) du §7 est retenue.
  Côté muscu : « Démarrer » appelle `startWorkoutFromSession(item.sessionId, { plannedSessionId: item.id })`
  puis `router.push('/workout')`. Masquer « Démarrer » si `status !== 'planned'`. **Reprise** : si une séance
  active existe déjà, le tap propose de **reprendre l'active** (l'occurrence tapée n'est alors pas liée — voir
  garde §3) plutôt que d'en créer une seconde.
- **Fiche programme** ([programs/[id].tsx](../../../../apps/mobile/src/app/programs/%5Bid%5D.tsx)) :
  remplacer les boutons « Activer » + « Planifier » par **« Démarrer ce programme »** (ou « Modifier la
  planification » si `isActive`) → `router.push('/planning/plan?id=…')`. Retirer l'appel `activateProgram`
  de cet écran. Le popup de changement de programme s'insère dans le flux de l'assistant `plan.tsx` au moment
  du `planProgram` (détection d'un autre programme actif du pilier).
- **Running** : mêmes écrans (pilier-agnostiques) → vérifier le comportement identique côté course
  (démarrer une course planifiée depuis le calendrier ⇒ suppose que le tracker running accepte un
  `plannedSessionId` ; **à cadrer** : soit inclus ici, soit noté comme adaptation running à part si le
  parcours de démarrage course diffère — voir §7).
- **i18n** : clés `planning.startSession`, `planning.markDoneQuick`, `programs.detail.startProgram`,
  `programs.detail.editPlanning`, `planning.switchProgram.*` (titre/corps/keep/remove), FR + EN, parité.

## 5. Offline & données

- **Migration** `planned_session_id` sur `workouts` : cycle CLI **sans Docker** (cf. [CLAUDE.md](../../../../CLAUDE.md)) —
  `db:new` → SQL (`ALTER TABLE workouts ADD COLUMN planned_session_id text`) → `db:push:dry` → `db:push` →
  `db:types` → cocher [MIGRATIONS.md](../../../../supabase/MIGRATIONS.md). Ajouter la colonne au **schéma
  PowerSync** ([powersync/schema.ts](../../../../apps/mobile/src/powersync/schema.ts)).
- 🔴 **Checkpoint cloud** : la migration doit être poussée **avant** qu'un device synchronisé n'écrive la
  nouvelle colonne (sinon file de synchro bloquée — colonne inconnue côté Postgres). Recette **après**
  `db:push` + `db:types`.
- Écritures **optimistes locales** (UUID client, timestamps UTC, soft delete) ; synchro via le bucket
  `user_data` existant. Nullable → **rétrocompatible** (workouts existants = `planned_session_id` nul).

## 6. Definition of Done

- [ ] Spec + plan + **maquette** validés (pas de code avant).
- [ ] Fusion : un seul bouton « Démarrer ce programme » / « Modifier la planification » ; plus de bouton
      « Activer » isolé ; `activateProgram` retiré de l'UI.
- [ ] Démarrer une séance **depuis le calendrier** (occurrence `planned`) → workout pré-rempli lié.
- [ ] **Complétion** : terminer la séance liée → occurrence `done` + `completed_at` ; abandon → reste `planned` ;
      séance libre/ad hoc → ne touche aucune occurrence.
- [ ] Actions secondaires (Reporter / Sauter / Marquer fait) conservées ; « Démarrer » masqué si non `planned`
      **et** masqué sur les occurrences running (pilier ≠ strength) sauf option (a) du §7.
- [ ] Popup de changement de programme (retirer/garder les futures) ; historique conservé.
- [ ] Migration `planned_session_id` : SQL poussé cloud (🔴 checkpoint) + `db:types` + schéma PowerSync +
      [MIGRATIONS.md](../../../../supabase/MIGRATIONS.md) coché.
- [ ] i18n FR+EN (parité) ; offline-first ; typecheck/lint/tests verts.
- [ ] **Non-régression** : planning running (occurrences course inchangées, pas de « Démarrer » cassé),
      programmes muscu, nutrition.
- [ ] PR relue par les deux devs.

## 7. Points à trancher / explicitement différé

- **Démarrage d'une course planifiée depuis le calendrier** : le parcours de démarrage running (tracker GPS)
  diffère de la muscu, et `startWorkoutFromSession` est muscu-spécifique. À décider en plan : (a) inclure le
  passage de `plannedSessionId` au tracker running dans cette US (« Démarrer » actif sur les occurrences
  running), ou **(b, défaut)** livrer le lien de complétion **muscu** ici et masquer « Démarrer » sur les
  occurrences running (traiter l'adaptation running en suivant). Sont **communs aux deux piliers dès cette US** :
  la **fusion activer/planifier** et les **actions secondaires** du calendrier (Reporter / Sauter / Marquer
  fait). Le **« Démarrer » (logging réel)** est **muscu-spécifique** tant que (a) n'est pas retenu.
- **Différé** (autres US) : hub « séance du jour » (US-B), refonte écran de séance (US-C), templates (US-D),
  glisser-déposer calendrier, progression automatique de charge, clôture auto 3 h / pause (US-C).
