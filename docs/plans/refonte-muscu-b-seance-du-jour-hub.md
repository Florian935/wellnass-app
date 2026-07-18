# US Refonte-B — Séance du jour sur le hub muscu — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour implémenter ce plan tâche par tâche. Étapes en checkbox (`- [ ]`).

**Goal:** Surfacer la séance planifiée **du jour** en accès direct sur le hub muscu (et réaligner le widget dashboard 7.4 sur la même logique), avec démarrage **lié à l'occurrence** (complétion via US-A).

**Architecture:** Un hook partagé **`useTodaySession('strength')`** (dans `dashboard-repository`, remplace `useNextSession`) devient la source de vérité : il lit l'occurrence `planned_sessions` **du jour** (tous statuts) + la **prochaine future** + l'état séance active, et résout le **nom du programme de l'occurrence** (jointure `program_translations`). Le hub et le widget consomment ce hook ; « Démarrer » passe `plannedSessionId`.

**Tech Stack:** `apps/mobile` (Expo Router, PowerSync `useQuery`, i18next FR/EN). Aucune migration (`planned_session_id` posé par US-A). Fichiers : `dashboard-repository.ts`, `TodaySessionCard.tsx`, `(tabs)/strength.tsx`, `i18n/locales/{fr,en}.json`, `StreakCard.test.tsx` (mock).

**Spec :** [refonte-muscu-b-seance-du-jour-hub.md](../specs/functional/us/refonte-muscu-b-seance-du-jour-hub.md) (validée Florian + revue Approved).

**Branche :** `feature/refonte-muscu-b` (spec commitée `ae9413c`).

> **Invariants :**
> - **Offline-first** : lecture locale réactive (`useQuery`), aucune écriture nouvelle (démarrage géré par US-A).
> - **i18n** : parité FR/EN ; aucune chaîne en dur.
> - **Cohérence US-A** : tout démarrage partant d'une occurrence passe `plannedSessionId`.
> - **Non-régression** : le widget dashboard 7.4 et le hub restent fonctionnels ; `useActiveProgram`/`useActiveWorkout` inchangés.
> - À chaque commit : `npm run typecheck` + `npm run lint -w @wellness/mobile` + `npm run test` verts. Ne jamais stager `apps/mobile/eas.json`. Tests mobile jest-expo non câblés → vérif par typecheck/lint/grep.

---

## Task 1 : hook `useTodaySession('strength')` (dashboard-repository)

**Files:** Modify `apps/mobile/src/data/repositories/dashboard-repository.ts` (région `useNextSession`, ~L63-130). **Lis le fichier d'abord.** `useNextSession` est **conservé** dans cette tâche (encore consommé par le widget ; retiré en Task 5).

- [ ] **Étape 1 : type d'état exposé** — ajouter :
```ts
export type TodaySessionState =
  | { state: 'active-workout'; workoutId: string; isLoading: boolean }
  | {
      state: 'today-session';
      session: {
        plannedSessionId: string; // occurrence (planned_sessions.id) — pour le lien de complétion
        sessionId: string;        // gabarit (sessions.id) — pour startWorkoutFromSession
        name: string | null;      // fallback « Séance N » appliqué côté UI
        orderIndex: number;
        exerciseCount: number;
        programName: string | null;
      };
      isLoading: boolean;
    }
  | {
      state: 'none';
      doneToday: { name: string | null } | null;      // occurrence du jour déjà faite (coche)
      nextUpcoming: { scheduledDate: string; name: string | null } | null; // mention « Prochaine »
      hasActiveProgram: boolean;
      isLoading: boolean;
    };
```

- [ ] **Étape 2 : requêtes SQL** (constantes en tête de région ; valeurs liées via `?`) :
```ts
// Occurrences du JOUR (tous statuts), pilier + nom de séance + nb exercices + nom du programme (langue courante → fr).
const SELECT_TODAY_OCCURRENCES = `
  SELECT ps.id, ps.session_id, ps.status, s.name AS session_name, s.order_index,
         (SELECT COUNT(*) FROM exercise_plans ep WHERE ep.session_id = ps.session_id AND ep.deleted_at IS NULL) AS exercise_count,
         COALESCE(tl.name, tfr.name) AS program_name
  FROM planned_sessions ps
  JOIN sessions s ON s.id = ps.session_id AND s.deleted_at IS NULL
  JOIN programs  p ON p.id = ps.program_id AND p.deleted_at IS NULL
  LEFT JOIN program_translations tl  ON tl.program_id  = p.id AND tl.lang  = ?  AND tl.deleted_at  IS NULL
  LEFT JOIN program_translations tfr ON tfr.program_id = p.id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  WHERE ps.owner_id = ? AND ps.deleted_at IS NULL AND p.pillar = ? AND ps.scheduled_date = ?
  ORDER BY s.order_index
`;
// Prochaine occurrence FUTURE encore planifiée (la plus proche).
const SELECT_NEXT_UPCOMING = `
  SELECT ps.scheduled_date, s.name AS session_name
  FROM planned_sessions ps
  JOIN sessions s ON s.id = ps.session_id AND s.deleted_at IS NULL
  JOIN programs  p ON p.id = ps.program_id AND p.deleted_at IS NULL
  WHERE ps.owner_id = ? AND ps.deleted_at IS NULL AND p.pillar = ? AND ps.status = 'planned' AND ps.scheduled_date > ?
  ORDER BY ps.scheduled_date, s.order_index
  LIMIT 1
`;
```

- [ ] **Étape 3 : le hook** — appels de hooks **inconditionnels** (règle React), langue via `i18n` :
```ts
export function useTodaySession(pillar: Pillar): TodaySessionState {
  const userId = useAuthStore((s) => s.session?.user.id ?? '');
  const lang = getAppLanguage() === 'en' ? 'en' : 'fr';
  const today = localDayKey(new Date());

  const { workout, isLoading: workoutLoading } = useActiveWorkout();
  const { program, isLoading: programLoading } = useActiveProgram(pillar);
  const { data: todayRows, isLoading: todayLoading } = useQuery<{
    id: string; session_id: string; status: string; session_name: string | null;
    order_index: number; exercise_count: number; program_name: string | null;
  }>(SELECT_TODAY_OCCURRENCES, [lang, userId, pillar, today]);
  const { data: nextRows, isLoading: nextLoading } = useQuery<{
    scheduled_date: string; session_name: string | null;
  }>(SELECT_NEXT_UPCOMING, [userId, pillar, today]);

  const isLoading = workoutLoading || programLoading || todayLoading || nextLoading;

  if (workout != null) {
    return { state: 'active-workout', workoutId: workout.id, isLoading };
  }

  const planned = todayRows.find((r) => r.status === 'planned');
  if (planned) {
    return {
      state: 'today-session',
      session: {
        plannedSessionId: planned.id,
        sessionId: planned.session_id,
        name: planned.session_name,
        orderIndex: planned.order_index,
        exerciseCount: planned.exercise_count,
        programName: planned.program_name,
      },
      isLoading,
    };
  }

  const done = todayRows.find((r) => r.status === 'done');
  const next = nextRows[0];
  return {
    state: 'none',
    doneToday: done ? { name: done.session_name } : null,
    nextUpcoming: next ? { scheduledDate: next.scheduled_date, name: next.session_name } : null,
    hasActiveProgram: program != null,
    isLoading,
  };
}
```
   - Importer `Pillar` (`@wellness/shared`), `getAppLanguage` (`@/i18n`) et `useQuery` (`@powersync/react`, déjà importé) si absents. `useAuthStore` est déjà importé.

- [ ] **Étape 4 : vérifier** — `npm run typecheck` + `npm run lint -w @wellness/mobile` passent.
- [ ] **Étape 5 : commit** — `git add apps/mobile/src/data/repositories/dashboard-repository.ts` puis
  `git commit -m "feat(mobile): hook useTodaySession (occurrence du jour, calendrier + lien completion)"`.

---

## Task 2 : i18n — libellés « prochaine » + « faite » (FR/EN)

**Files:** Modify `apps/mobile/src/i18n/locales/fr.json` et `en.json` (bloc `home.today`, ~L454). **Lis le bloc d'abord.**

- [ ] **Étape 1** — ajouter dans `home.today` (FR) :
  - `"next": "Prochaine : {{date}} · {{name}}"`
  - `"doneToday": "Séance du jour faite · {{name}}"`
  - `"noneToday": "Rien de prévu aujourd'hui"`
- [ ] **Étape 2** — mêmes clés (EN) : `"Next: {{date}} · {{name}}"`, `"Today's session done · {{name}}"`, `"Nothing planned today"`.
- [ ] **Étape 3 : parité** — valider que `fr.json`/`en.json` parsent et ont les mêmes clés
  (`node -e "..."` : comparer les ensembles de clés aplaties ; 0 clé seule d'un côté).
- [ ] **Étape 4 : vérifier** — `npm run typecheck` (les JSON sont importés typés) passe.
- [ ] **Étape 5 : commit** — `git commit -m "i18n(mobile): libelles seance du jour (prochaine, faite, rien aujourd'hui)"`.

---

## Task 3 : widget dashboard 7.4 sur le nouveau hook (démarrage lié)

**Files:** Modify `apps/mobile/src/components/dashboard/TodaySessionCard.tsx`. **Lis le fichier d'abord.**

- [ ] **Étape 1** — remplacer `useNextSession()` par `useTodaySession('strength')` (import depuis `dashboard-repository`).
- [ ] **Étape 2** — état **`today-session`** : `onStart` passe désormais le lien :
  `await startWorkoutFromSession(session.sessionId, { plannedSessionId: session.plannedSessionId });` puis `/workout`.
  Le nom affiché applique le fallback « Séance N » : `session.name?.trim() || t('programs.detail.sessionFallback', { index: session.orderIndex + 1 })`. `exerciseCount`/`programName` comme avant (gérer `programName` nul → masquer la ligne programme).
- [ ] **Étape 3** — état **`none`** : si `hasActiveProgram` → afficher `home.today.noneToday` (+ mention `home.today.next` si `nextUpcoming`, + coche `home.today.doneToday` si `doneToday`) ; sinon (`!hasActiveProgram`) → conserver l'état vide actuel (`home.today.empty` + « Créer un programme »). Variante **compact** : adapter (`compactActive` si active, nom de séance si today-session, sinon `compactNone`).
- [ ] **Étape 4 : vérifier** — `npm run typecheck` + `npm run lint -w @wellness/mobile` ; grep `useNextSession` dans `TodaySessionCard.tsx` → **0**.
- [ ] **Étape 5 : commit** — `git commit -m "feat(mobile): widget seance du jour aligne calendrier + demarrage lie"`.

---

## Task 4 : hub muscu — carte d'action 3 états

**Files:** Modify `apps/mobile/src/app/(tabs)/strength.tsx` (carte d'action ~L53-80 ; imports). **Lis le fichier d'abord.**

- [ ] **Étape 1** — imports : ajouter `useTodaySession` (dashboard-repository) **et `startWorkoutFromSession`**
  à l'import existant de `workout-repository` (aujourd'hui : `startWorkout, useActiveWorkout, useWorkoutHistory`
  seulement — `startWorkoutFromSession` **n'est pas** encore importé). Pour la date de la mention « Prochaine »,
  **ne pas** réutiliser `formatDayMonth` (il fait `new Date(iso)` → décalage de fuseau possible sur une date
  seule) : formater JJ/MM **depuis la chaîne `AAAA-MM-JJ`** par découpage (`const [, m, d] = date.split('-')` →
  `` `${d}/${m}` ``), comme `formatDayKey` dans `planning/index.tsx`.
- [ ] **Étape 2** — remplacer le bloc conditionnel `active ? (Reprendre) : (Séance libre)` par un rendu à 3 états depuis `const today = useTodaySession('strength')` :
  - **`active-workout`** → carte « Reprendre » (réutiliser le rendu actuel : `workout.resumeTitle` + `workout.resume` → `/workout`).
  - **`today-session`** → carte **« Séance du jour »** : icône `barbell`, titre `home.today.title`, nom (fallback « Séance N »), badge `home.today.exercises` (count), ligne programme (`home.today.program`, masquée si `programName` nul), bouton `home.today.cta` → `onStartToday` :
    ```ts
    const onStartToday = async (sessionId: string, plannedSessionId: string) => {
      try {
        await startWorkoutFromSession(sessionId, { plannedSessionId });
        router.push('/workout');
      } catch {
        // Offline-first : échec très improbable.
      }
    };
    ```
    (garder l'état `starting`/`loading` comme le widget ; offline-first, try/catch silencieux.)
  - **`none`** → carte **« Séance libre »** (rendu actuel : `workout.freeTitle`/`freeSubtitle`/`startFree` → `onStart` existant) **plus**, sous le bouton :
    - si `today.doneToday` → ligne discrète avec ✓ : `home.today.doneToday` (nom = fallback « Séance N » si nul) ;
    - si `today.nextUpcoming` → ligne discrète tappable `home.today.next` (date = JJ/MM obtenu par découpage de
      `nextUpcoming.scheduledDate` — voir Étape 1, pas `new Date`, name = fallback « Séance N ») → `router.push('/planning')`.
- [ ] **Étape 3** — conserver les 4 `ModulePreviewCard` en dessous **inchangées**.
- [ ] **Étape 4 : vérifier** — `npm run typecheck` + `npm run lint -w @wellness/mobile` passent ; vérifier visuellement (lecture) que « Démarrer » n'apparaît que dans l'état `today-session`.
- [ ] **Étape 5 : commit** — `git commit -m "feat(mobile): hub muscu — carte seance du jour (3 etats) + mention prochaine + coche faite"`.

---

## Task 5 : retrait de `useNextSession` + nettoyage mock + contrôle final

**Files:** Modify `apps/mobile/src/data/repositories/dashboard-repository.ts` (retrait `useNextSession` + type `NextSessionState`), `apps/mobile/src/components/dashboard/__tests__/StreakCard.test.tsx` (mock résiduel), + entête de doc du repository (liste des hooks).

- [ ] **Étape 1** — grep `useNextSession` sur `apps/mobile/src` : ne doit rester que la définition (dashboard-repository) + le mock de `StreakCard.test.tsx`. Retirer la fonction `useNextSession` et le type `NextSessionState` de `dashboard-repository.ts` (plus aucun consommateur applicatif après Tasks 3). Mettre à jour le commentaire d'entête (`useNextSession` → `useTodaySession`).
- [ ] **Étape 2** — dans `StreakCard.test.tsx`, retirer la ligne `useNextSession: jest.fn()` du `jest.mock(...)` (clé morte) ; si le mock ne sert qu'à `useStreakData`, ne rien casser d'autre.
- [ ] **Étape 3 : contrôle final** — `npm run typecheck` + `npm run lint` + `npm run test` verts ; grep `useNextSession` → **0 occurrence** ; parité i18n FR/EN OK.
- [ ] **Étape 4 : revue de code globale** — `superpowers:requesting-code-review` (ou `/code-review`) sur `git diff dev...HEAD`.
- [ ] **Étape 5 : commit** — `git commit -m "chore(mobile): retire useNextSession (remplace par useTodaySession) + nettoie le mock"`.

---

## Ordre & dépendances

```
Task 1 (hook)  →  Task 2 (i18n)  →  Task 3 (widget)  →  Task 4 (hub)  →  Task 5 (retrait useNextSession + contrôle)
```
Task 2 (i18n) peut précéder 3/4 (les libellés doivent exister avant usage). Task 5 vient en dernier (retrait du hook une fois les 2 consommateurs migrés).

## Definition of Done (rappel spec §6)
- [ ] `useTodaySession('strength')` : occurrence du jour (tous statuts, règle planned→done), prochaine future, actif, `programName` de l'occurrence.
- [ ] Hub : 3 états (active / séance du jour liée / repli séance libre + mention prochaine + coche faite) ; « Démarrer » passe `plannedSessionId`.
- [ ] Widget 7.4 aligné (même hook, démarrage lié) ; états compact/full + vide conservés.
- [ ] `useNextSession` retiré ; mock nettoyé ; grep à 0.
- [ ] i18n FR+EN parité ; offline-first ; typecheck/lint/tests verts ; non-régression dashboard/hub.
- [ ] Maquette validée + PR relue par les deux devs.
