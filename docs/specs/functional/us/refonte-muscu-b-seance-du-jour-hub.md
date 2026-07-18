# US Refonte-B — Séance du jour en accès direct sur le hub muscu

> **Chantier refonte Muscu**, US-B. Corrige le **problème 3** de l'[audit des flux](../../../refonte-muscu/audit-flux.md) :
> l'action la plus utile (démarrer la séance planifiée du jour) est enfouie à 4-5 taps, « Séance libre »
> est le gros bouton par défaut, et aucun raccourci « séance du jour » n'existe sur le hub muscu.
> **Dépend d'US-A** (lien planning ↔ séance via `planned_session_id`, démarrage depuis une occurrence) — livrée.
> Branche : `feature/refonte-muscu-b` · Date : 18/07/2026 · **Statut : à valider (pas de code avant validation).**
> **Aucune migration** (`planned_session_id` déjà posé par US-A) → pas de checkpoint cloud.

## 0. Contexte

Le hub muscu ([(tabs)/strength.tsx](../../../../apps/mobile/src/app/%28tabs%29/strength.tsx)) présente une carte
d'action (« Reprendre » si séance active, sinon « Séance libre ») puis 4 cartes-aperçu (Programmes, Planning,
Historique, Progression). Il **ne surface pas la séance planifiée du jour**.

Par ailleurs, le widget dashboard 7.4 [TodaySessionCard](../../../../apps/mobile/src/components/dashboard/TodaySessionCard.tsx)
via `useNextSession` affiche la **1ʳᵉ séance du programme actif** (par `orderIndex`) — **sans regarder le
calendrier** — et démarre via `startWorkoutFromSession(session.id)` **sans `plannedSessionId`** : depuis US-A,
ce démarrage **ne marque donc pas** l'occurrence « faite ». Deux notions divergentes de « séance du jour »
coexisteraient si le hub introduisait une logique calendrier distincte.

Décisions de cadrage (brainstorming Florian, 18/07/2026) :
- **Source = occurrence réelle du calendrier** : la séance planifiée (`planned_sessions`) de **date =
  aujourd'hui**, pilier muscu. Si plusieurs, la **1ʳᵉ non faite**. « Démarrer » passe son `plannedSessionId`
  (complétion remonte, cohérent US-A).
- **Rien planifié aujourd'hui** → « Séance libre » reste l'action principale + **mention discrète** de la
  prochaine occurrence future (menant au planning), si elle existe.
- **Occurrence du jour déjà faite** → repli sur « Séance libre » + **ligne de confirmation discrète**
  « ✓ Séance du jour faite · <nom> » (pas de carte non actionnable, mais accusé de complétion motivant).
- **Périmètre** = **une seule source de vérité** : un hook partagé consommé par le hub **et** le widget
  dashboard 7.4 (aligné sur la logique calendrier + lien de complétion).

## 1. Périmètre à livrer

- **Hook partagé `useTodaySession('strength')`** (remplace `useNextSession`) : occurrence du jour +
  prochaine occurrence future + état séance active, basé sur `planned_sessions`.
- **Hub muscu** : carte d'action à 3 états (active / séance du jour / rien), avec la mention « Prochaine »
  et la coche « faite » (voir §2).
- **Widget dashboard 7.4** aligné sur le même hook (occurrence du jour + démarrage **lié**).
- **i18n** FR/EN des nouveaux libellés ; offline-first.

**Hors périmètre :**
- Le hub **course** (même patron applicable plus tard, comme le §7 d'US-A).
- Refonte de l'écran de séance (US-C), templates (US-D).
- Toute évolution du calendrier lui-même (fait en US-A).

## 2. Comportement attendu

**Carte d'action du hub muscu** — priorité stricte :
1. **Séance active** → carte « Reprendre la séance » → `/workout` (comportement actuel conservé).
2. **Occurrence planifiée aujourd'hui** (statut `planned`, la 1ʳᵉ non faite) → carte **« Séance du jour »** :
   nom de séance (repli « Séance N »), badge « N exercices », nom du programme, bouton **« Démarrer la
   séance »** → `startWorkoutFromSession(sessionId, { plannedSessionId })` puis `/workout`. À la fin de la
   séance (US-A), l'occurrence bascule « faite ».
3. **Rien à démarrer aujourd'hui** → carte **« Séance libre »** (bouton « Démarrer une séance libre »,
   comportement actuel) **plus** :
   - si l'occurrence du jour est **déjà faite** : ligne discrète **« ✓ Séance du jour faite · <nom> »** ;
   - si une **occurrence future** existe : ligne discrète **« Prochaine : <jj/mm> · <nom> »**, tappable →
     `/planning`.

**Widget dashboard 7.4** (même hook) :
- **active** → « Reprendre » ; **séance du jour** → nom + « N exercices » + « Démarrer » **lié** ;
- **rien** → si programme actif : état « rien aujourd'hui » (+ mention prochaine si dispo) ; sinon
  « Créer un programme » → `/programs` (état vide conservé).

**Règles de sélection de l'occurrence du jour :**
- Pilier `strength`, `scheduled_date == aujourd'hui` (clé locale AAAA-MM-JJ), `status == 'planned'`,
  `deleted_at IS NULL` ; s'il y en a plusieurs, ordre par `sessions.order_index`, prendre la 1ʳᵉ.
- Une occurrence **manquée** (date passée, encore `planned`) **n'est pas** « du jour » (reste dans le
  planning / bannière manquées).

## 3. Règles métier

- **Cohérence avec US-A** : le démarrage depuis le hub (et le widget) passe **toujours** `plannedSessionId`
  quand il part d'une occurrence, pour que la complétion remonte. Aucun démarrage « du jour » non lié.
- **Priorité** : séance active > occurrence du jour (non faite) > repli séance libre. Jamais deux cartes
  d'action simultanées.
- **Occurrence du jour faite** : ne réaffiche pas « Démarrer » (repli séance libre + coche).
- **Offline-first** : lecture locale réactive (`useQuery`), aucune dépendance réseau pour l'affichage.
- **Course** : le hook `useTodaySession` est paramétré par pilier ; seul `'strength'` est câblé aux surfaces
  de cette US (le hub course reste inchangé).

## 4. Architecture

- **Hook** `useTodaySession(pillar: Pillar)` dans
  [dashboard-repository.ts](../../../../apps/mobile/src/data/repositories/dashboard-repository.ts) (remplace
  `useNextSession`) :
  - Réutilise `useActiveWorkout()` (priorité 1).
  - **Requête « occurrences du jour »** (`scheduled_date = ?today`, pilier via `programs.pillar`,
    `deleted_at IS NULL`, **tous statuts**), jointure `sessions` (nom / `order_index`) +
    `COUNT(exercise_plans)` (`exerciseCount`) + **`program_translations` pour le nom du programme**
    (résolu langue courante → fr), ordonnée par `order_index`. Sélection :
    - s'il existe une occurrence **`planned`** → état `today-session` (la 1ʳᵉ `planned`) ;
    - sinon s'il existe une occurrence **`done`** → état `none` avec `doneToday = { name }` (1ʳᵉ `done`) ;
    - sinon → état `none` sans `doneToday`.
  - **Requête « prochaine future »** (`scheduled_date > ?today`, pilier muscu, `status='planned'`, la plus
    proche) → `nextUpcoming` (pour la mention discrète).
  - **`hasActiveProgram`** via `useActiveProgram(pillar)` (état vide « Créer un programme » du widget).
  - ⚠️ **`programName`** vient du **programme de l'occurrence** (résolu dans la requête ci-dessus), **pas**
    de `useActiveProgram` : une occurrence du jour peut appartenir à un programme désormais inactif (cas
    « garder les séances à venir » d'US-A).
  - *(Réutiliser/étendre les patterns de
    [planned-session-repository.ts](../../../../apps/mobile/src/data/repositories/planned-session-repository.ts) —
    `SELECT_PLANNED_BETWEEN` joint déjà `sessions`/`programs` + `COUNT(exercise_plans)` ; ajouter le filtre
    pilier + la jointure `program_translations`.)*
  - État exposé (indicatif) :
    ```ts
    type TodaySessionState =
      | { state: 'active-workout'; workoutId: string; isLoading: boolean }
      | { state: 'today-session'; session: { plannedSessionId: string; sessionId: string; name: string;
            orderIndex: number; exerciseCount: number; programName: string }; isLoading: boolean }
      | { state: 'none'; doneToday: { name: string } | null;
            nextUpcoming: { scheduledDate: string; name: string } | null;
            hasActiveProgram: boolean; isLoading: boolean };
    ```
- **Hub** ([(tabs)/strength.tsx](../../../../apps/mobile/src/app/%28tabs%29/strength.tsx)) : la carte d'action
  actuelle (active/free) devient le rendu des 3 états ci-dessus ; bouton « Démarrer » →
  `startWorkoutFromSession(session.sessionId, { plannedSessionId: session.plannedSessionId })`. Les 4
  `ModulePreviewCard` sont inchangées.
- **Widget** ([TodaySessionCard.tsx](../../../../apps/mobile/src/components/dashboard/TodaySessionCard.tsx)) :
  consomme `useTodaySession('strength')` ; « Démarrer » lié ; états compact/full conservés.
- **i18n** : réutiliser `home.today.*` (widget) ; ajouter les libellés hub (`pillarScreens.strength.*` ou
  `workout.*` selon l'existant) : « Séance du jour », « Démarrer la séance », « Prochaine : {{date}} · {{name}} »,
  « Séance du jour faite · {{name}} ». FR + EN, parité.

## 5. Offline & données

- **Aucune migration** (`planned_session_id` déjà posé par US-A ; `planned_sessions` déjà déployée).
- Lecture locale réactive (offline-first) ; aucune écriture nouvelle hormis le démarrage (déjà géré US-A).

## 6. Definition of Done

- [ ] Spec + plan + **maquette** validés (pas de code avant).
- [ ] Hook `useTodaySession('strength')` (calendrier + prochaine + actif), source unique.
- [ ] Hub : 3 états (active / séance du jour liée / repli séance libre) + mention « Prochaine » + coche
      « faite » ; « Démarrer » passe `plannedSessionId`.
- [ ] Widget dashboard 7.4 aligné (même hook, démarrage **lié**), états compact/full + vide conservés.
- [ ] Occurrence du jour terminée → bascule « faite » (via US-A) ; hub repasse en repli + coche.
- [ ] i18n FR+EN (parité) ; offline-first ; typecheck/lint/tests verts ; non-régression dashboard/hub.
- [ ] Maquette validée + PR relue par les deux devs.

## 7. Explicitement différé

Hub course (séance du jour côté running) ; refonte de l'écran de séance (US-C) ; templates de séance libre
(US-D). Aucune évolution du calendrier (US-A).
