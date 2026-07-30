# Plan d'implémentation — NUTR-F1 · Rappels programmés nutrition

> Spec : [nutrf1-rappels-nutrition.md](../specs/functional/us/nutrf1-rappels-nutrition.md) ·
> Branche : `feature/nutrf1-rappels-nutrition` · 30/07/2026

## Résumé technique

| | |
|---|---|
| **Migration DB** | ❌ **aucune** — les 5 préférences vivent dans `user_settings.notifications` (JSON TEXT déjà synchronisé), et `parseNotificationPrefs` est tolérant |
| **Sync rules PowerSync** | ❌ **aucune à redéployer** — pas de nouvelle table |
| **Dépendance native** | ❌ **aucune** — `expo-notifications` déjà installé et configuré |
| **Nouveau build** | ❌ **non requis** — le dev build en place suffit |
| **Réseau** | ❌ aucun appel — apprentissage 100 % local sur le SQLite PowerSync |
| **Code livré modifié** | 🟢 **aucun planificateur existant touché** (décision D3) — seuls des ajouts |

US **entièrement JS/TS**. Le risque est concentré dans les règles pures, donc dans les tests — pas
dans la plomberie.

## Ordre de build

De bas en haut : **règles pures testées → lecture de données → planification → UI**. Chaque étape est
commitable seule et laisse l'app fonctionnelle.

---

### Étape 0 — Corriger la dérive Zod (préalable, 15 min)

Un préalable, pas une amélioration : on va ajouter 5 champs à un schéma qui en perd déjà 2
silencieusement.

**Fichiers**
- `packages/shared/src/settings.ts` — `notificationPrefsSchema` : ajouter `weeklyReview`
  (`z.boolean()`) et `weeklyReviewHour` (`hourSchema`), présents dans `NotificationPrefs` et
  `defaultNotificationPrefs()` depuis BILAN-01.
- `packages/shared/src/settings.test.ts` — le test « prefs explicites acceptées » (≈ L. 110-121)
  n'énumère que 6 champs et **entérine la dérive** : le compléter.

**Test d'abord** : parser un objet complet et vérifier qu'**aucun** champ n'est strippé. Échoue
avant, passe après.

---

### Étape 1 — Brique pure : l'échéance apprise (`packages/shared`)

Nouveau **`packages/shared/src/learned-hour.ts`** + `learned-hour.test.ts`, exporté depuis
`index.ts`. Aucune dépendance native ; toute référence temporelle est **injectée** (convention du
dépôt, cf. `localMidnightDaysAgo(daysAgo, ref)`).

```ts
/** Une saisie candidate : le jour du journal + l'instant de saisie. */
export interface LogSample {
  /** Clé de jour du journal (`log_date`, AAAA-MM-JJ). */
  logDate: string;
  /** Horodatage de création, ISO UTC (`created_at`). */
  createdAt: string;
}

/** Seuil de confiance : en dessous, on n'apprend pas. */
export const LEARNED_HOUR_MIN_SAMPLES = 5;
/** Fenêtre d'apprentissage, en jours. */
export const LEARNED_HOUR_WINDOW_DAYS = 14;
/** Décile visé — voir décision D1 : une échéance, pas une habitude. */
export const LEARNED_DEADLINE_PERCENTILE = 0.9;

/**
 * Une heure locale exploitable **par jour** : la plus ancienne entrée du jour dont le jour local
 * de `createdAt` correspond à `logDate` (rejet des saisies rétroactives — D4). Un jour sans
 * aucune entrée retenue est absent du résultat.
 */
export function usableDailyHours(samples: LogSample[]): number[];

/**
 * Percentile **par rang**, sans interpolation : `trié[ceil(p × n) − 1]`.
 * Défini pour tout `n ≥ 1`. `null` si l'échantillon est vide. Voir D2.
 */
export function percentileHour(hours: number[], percentile: number): number | null;

export interface LearnedHourResult {
  /** Heure retenue (0-23). */
  hour: number;
  /** `true` si elle vient de l'apprentissage, `false` si c'est le repli. */
  learned: boolean;
}

/** Résout l'échéance d'un rappel : p90 si assez d'échantillons, sinon `fallbackHour`. */
export function resolveLearnedDeadline(
  samples: LogSample[],
  fallbackHour: number,
  minSamples?: number,
): LearnedHourResult;
```

**Tests (Vitest)** — c'est le cœur de l'US :
- `usableDailyHours` : conversion UTC → heure locale ; rejet d'une saisie rétroactive
  (`logDate` = veille, `createdAt` = aujourd'hui) ; acceptation d'une saisie à 23 h 50 le jour même ;
  rejet d'une saisie à 00 h 10 pour la veille ; **première entrée rejetée → on prend la suivante
  retenue** ; jour sans entrée retenue → absent ; horodatage malformé ignoré sans `throw` ; tableau
  vide.
- `percentileHour` : `n = 1` ; `n = 5` → le maximum (cas du seuil, documenté dans la spec) ;
  `n = 6`, `n = 7` → `{8,8,9,8,9,8,10}` → **10** ; `n = 14` → index 12 ; **`{23,0,23,0,23,0}` → 23**
  (le test qui justifie D2, avec « médiane = 11 h 30 » en commentaire) ; échantillon non trié ;
  percentile 0 et 1 ; échantillon vide → `null`.
- `resolveLearnedDeadline` : 0 / 4 / 5 / 14 échantillons ; `learned` correctement positionné ; le
  repli n'est jamais hors [0, 23].

`resolveLearnedDeadline` **ignore le DND** : c'est l'étape suivante. Les garder séparés les rend
testables isolément.

---

### Étape 2 — Briques pures : rabattement DND, décision, préférences

Dans **`packages/shared/src/notifications.ts`** (le fichier existant — on l'étend), tests dans
`notifications.test.ts`.

**2a. Rabattement hors DND** (D5)
```ts
/**
 * Ramène `hour` hors de la fenêtre DND en la rabattant sur le bord le plus proche :
 * `dndEndHour` ou `dndStartHour − 1 (mod 24)`. Égalité → vers l'arrière.
 * Retourne `hour` inchangée si le DND est inactif ou la fenêtre vide.
 * ⚠️ À n'appliquer QUE sur une heure **apprise** — jamais sur une heure réglée à la main (D6).
 */
export function clampOutOfDnd(hour: number, prefs: NotificationPrefs): number;
```
**Tests** : DND off → inchangé ; fenêtre vide → inchangé ; hors fenêtre → inchangé ; `[22,7)` :
23 → 21, 0 → 21, 5 → 7, 6 → 7 ; `[9,17)` : 10 → 8, 16 → 17 ; égalité de distance → bord arrière ;
`start = 0` (bord arrière = 23) ; cas dégénéré `[8,7)` (23 h de DND) → les deux candidats
convergent sur 7 ; **assertion de propriété** : pour toute fenêtre non vide et les 24 heures,
`!isWithinDnd(clampOutOfDnd(h, prefs), prefs)`. C'est cette dernière qui est la vraie garantie.

**2b. Décision de planification**
```ts
export type ProgrammedReminderKind = 'meal' | 'weighIn';

export interface ProgrammedReminderInput {
  enabled: boolean;
  /** Le geste est-il déjà fait aujourd'hui ? */
  doneToday: boolean;
  /** Heure courante (0-23). */
  nowHour: number;
  /** Échéance résolue : apprise **et déjà rabattue**, ou réglée à la main telle quelle. */
  targetHour: number;
  /** L'échéance vient-elle de l'apprentissage ? Décide de la politique DND (D5 vs D6). */
  learned: boolean;
  prefs: NotificationPrefs;
}

export type ReminderDecision =
  | { kind: 'schedule'; atHour: number }
  | { kind: 'skip'; reason: 'disabled' | 'done' | 'passed' | 'dnd' };
```
Union discriminée plutôt qu'un booléen (patron de `shouldScheduleStreakReminder`) : chaque refus
devient testable nommément et exploitable en diagnostic de recette.

Règles, dans cet ordre : `disabled` → `done` → `dnd` (seulement si `!learned`, puisqu'une heure
apprise a déjà été rabattue) → `passed` si `nowHour >= targetHour` → sinon `schedule`.

**Tests** : chaque `reason` isolément ; `nowHour === targetHour` → `passed` (la borne exacte, c'est
là que les bugs vivent) ; `nowHour = targetHour − 1` → `schedule` ; `learned: true` avec une heure en
DND → **pas** de `reason: 'dnd'` (elle a été rabattue en amont) ; `learned: false` avec heure en DND
→ `dnd`.

**2c. Préférences** — 5 champs ajoutés à `NotificationPrefs`, à `defaultNotificationPrefs()`
(`mealReminder: false`, `mealReminderHour: 13`, `weighInReminder: false`, `weighInReminderHour: 10`,
`learnedHour: true`) et au parse tolérant. Étendre le test d'invariant existant : les **4** heures
par défaut hors DND par défaut. Ajouter un test de rétrocompatibilité : un JSON d'avant cette US se
parse avec les 5 nouveaux champs à leurs défauts, **rappels éteints**.

---

### Étape 3 — Lecture des habitudes (mobile)

Nouveau **`apps/mobile/src/data/repositories/reminder-habits-repository.ts`**, dans le style maison
(SQL PowerSync brut en constante de module + `useQuery`, **pas** de filtre `user_id` — PowerSync ne
réplique que le bucket courant).

```sql
-- repas : TOUTES les entrées de la fenêtre. Pas de MIN() en SQL : le choix de l'entrée
-- retenue dépend du filtre anti-rétroactif, qui se calcule en JS (fuseau local).
SELECT log_date, created_at
FROM food_entries
WHERE deleted_at IS NULL AND created_at >= ?
ORDER BY created_at

-- pesée : au plus une ligne par jour
SELECT log_date, created_at
FROM body_weight_entries
WHERE deleted_at IS NULL AND created_at >= ?
ORDER BY created_at
```

Trois points à ne pas rater :
- **Pas d'agrégat SQL sur `created_at`.** La première version de ce plan utilisait
  `MIN(created_at) … GROUP BY log_date` ; c'est faux depuis D4 : si la plus ancienne entrée du jour
  est une saisie rétroactive, il faut la **suivante**, et ce test se fait en heure locale, donc en
  JS. Volume concerné : ~14 jours × quelques entrées, négligeable.
- **La borne `?`** vaut `localMidnightDaysAgo(LEARNED_HOUR_WINDOW_DAYS).toISOString()` — jour
  **local** converti en UTC, patron déjà appliqué par `utcBounds()` dans
  `weekly-review-repository.ts:47`.
- **`bodyweight-repository.ts` ne sélectionne jamais `created_at`** aujourd'hui ; la colonne existe
  bien en local, c'est une requête neuve à écrire.

Hooks exposés :
```ts
export function useMealDeadline(): { hour: number; learned: boolean; shifted: boolean; isLoading: boolean };
export function useWeighInDeadline(): { hour: number; learned: boolean; shifted: boolean; isLoading: boolean };
export function useMealLoggedToday(): { done: boolean; isLoading: boolean };
export function useWeighInToday(): { done: boolean; isLoading: boolean };
```
Les deux premiers enchaînent `usableDailyHours` → `resolveLearnedDeadline` → `clampOutOfDnd` (si
`learned`) et exposent `shifted` (vrai si le rabattement a changé l'heure), consommé **à la fois**
par le planificateur et par l'écran de réglages — un seul calcul, deux consommateurs, pas de
divergence possible.

**Tests (Jest, mobile)** : patron existant dans `__tests__` des repositories (voir
`daily-wellbeing-repository`). Couvrir la construction des bornes et le mapping des lignes. La
logique métier étant dans `shared`, ces tests restent minces — c'est voulu.

---

### Étape 4 — Planificateur des rappels programmés

Nouveau hook dans **`apps/mobile/src/data/repositories/notification-repository.ts`** (fichier
existant, pour garder toute la planification au même endroit) :

```ts
export function useProgrammedRemindersScheduler(): void;
```

Un **seul** hook pour les deux rappels, avec **un seul** listener `AppState`. Structure calquée sur
`useStreakReminderScheduler` : `apply()` mémoïsé, effet au montage + sur changement de dépendances,
effet `AppState` filtré sur `'active'`, désabonnement au démontage, garde `if (isLoading) return`.

Séquence de `apply()` :
1. Garde `isLoading` sur les 4 hooks de données — on ne décide pas sur des données non résolues.
2. `ensurePermissionAndChannel()` ; si refusée : annuler les deux rappels, sortir.
3. Pour chacun des deux types : `decideProgrammedReminder({…})` → `schedule` : planifier à
   `todayAtHour(atHour)` ; `skip` : annuler le rappel en attente de ce type.

**Aucun planificateur existant n'est modifié** (D3) : ni `useStreakReminderScheduler`, ni
`useWeeklyReviewScheduler`. Seule retouche sur du code livré : le **commentaire** des lignes 144-146
de `notification-repository.ts`, qui promet une application future de `maxPerDay` — il renverra
désormais à D3.

**Couche native** — `apps/mobile/src/lib/notifications.ts` : ajouter
`MEAL_REMINDER_ID = 'meal-reminder'` et `WEIGH_IN_REMINDER_ID = 'weigh-in-reminder'`, et
**généraliser** les deux fonctions datées existantes en une paire :
```ts
export function scheduleDatedReminder(id: string, date: Date, content: ReminderContent): Promise<void>;
export function cancelReminder(id: string): Promise<void>;
```
`scheduleStreakReminder` / `cancelStreakReminder` deviennent des appels à cette paire — 2 sites
d'appel, comportement identique. Contrat **no-op silencieux, jamais de `throw`** conservé. Le canal
Android `reminders` reste unique : les 4 rappels sont de même nature et l'utilisateur peut déjà les
couper individuellement dans l'app.

**Montage** : `apps/mobile/src/app/_layout.tsx` — ajouter `useProgrammedRemindersScheduler();` à côté
des deux appels existants, hook inconditionnel avant tout retour anticipé.

**Mock à créer** : `apps/mobile/jest.setup.ts` n'a **aucun mock `expo-notifications`** aujourd'hui.
Il devient nécessaire dès qu'un test monte un composant important ce module. À ajouter **avant** de
toucher aux call sites, sinon on casse des tests verts.

---

### Étape 5 — Réglages (UI) + i18n

**`apps/mobile/src/app/settings.tsx`**, section « Notifications » existante :
- switch **« Caler sur mes habitudes »** (`learnedHour`) en tête ;
- ligne **Rappel de repas** : switch + `HourStepper` (réutilisé tel quel), `disabled` quand
  `learnedHour` est actif ;
- ligne **Rappel de pesée** : idem ;
- sous chaque ligne, la **provenance de l'heure** : `learnedHourValue` / `learnedHourPending` /
  `learnedHourShifted` selon `learned` et `shifted` — c'est la ligne qui évite le ticket « pourquoi
  10 h ? » ;
- quand `learnedHour` est **inactif** et que l'heure réglée est en DND (`isWithinDnd`) :
  l'avertissement `manualHourInDnd` (D6).

L'écran consomme `useMealDeadline` / `useWeighInDeadline` — les mêmes hooks que le planificateur.

**Hint de section réécrit** (D3) : `settings.notifications.hint` ne doit plus promettre « Max 3
notifications par jour ». FR **et** EN.

**i18n** : 12 clés `settings.notifications.*` ajoutées, 1 modifiée (`hint`), 4 clés
`notifications.{mealReminder,weighInReminder}.*`. Textes arrêtés au §5 de la spec. Parité stricte.

**a11y** : `accessibilityLabel` sur les 3 switches, `accessibilityState={{ disabled }}` sur les
steppers inertes.

---

### Étape 6 — Vérification et clôture

1. `npm run typecheck` — **lire le code de sortie sans pipe**.
2. `npm run lint`.
3. `npm run test` — idem, sans `| tail` (un pipe renverrait 0 même sur échec).
4. `node scripts/etat.mjs`.
5. `/commit` → passe `etape: recette`, alimente CHANGELOG + roadmap (1.14 et 2.5 → ✅), ajoute la
   section de recette dans `RECETTES.md`, pousse sur `dev`.
6. Compléter la note de **MUSC-F8** dans `BACKLOG.md` : l'« échéance apprise » et le rabattement DND
   sont désormais livrés ici et réutilisables tels quels.

## Fichiers touchés — récapitulatif

**Créés (3 + maquette)**
- `packages/shared/src/learned-hour.ts` + `learned-hour.test.ts`
- `apps/mobile/src/data/repositories/reminder-habits-repository.ts` (+ test)
- `design/nutrf1-rappels-nutrition/nutrf1-rappels-nutrition.html`

**Modifiés (9)**
- `packages/shared/src/notifications.ts` + `notifications.test.ts`
- `packages/shared/src/settings.ts` + `settings.test.ts`
- `packages/shared/src/index.ts` (export du nouveau module)
- `apps/mobile/src/lib/notifications.ts`
- `apps/mobile/src/data/repositories/notification-repository.ts`
- `apps/mobile/src/app/_layout.tsx`
- `apps/mobile/src/app/settings.tsx`
- `apps/mobile/src/i18n/locales/fr.json` + `en.json`
- `apps/mobile/jest.setup.ts` (mock `expo-notifications`)

**Suivi** : la spec (front-matter), `BACKLOG.md`, `docs/roadmap/roadmap.md`, `RECETTES.md`,
`CHANGELOG.md`, `ETAT.md` (généré).

## Risques et parades

| Risque | Parade |
|---|---|
| **Le rappel part pendant que l'utilisateur fait le geste** — le défaut de conception que D1 corrige | Échéance = p90, pas médiane. Aucun rattrapage immédiat (D7). Critère de recette dédié : ouvrir l'app après l'échéance ne doit rien déclencher. |
| **L'échéance apprise est absurde** pour un profil atypique | p90 (bord tardif, donc conservateur) + seuil de 5 échantillons + rabattement DND + provenance affichée. Recette dédiée. |
| **Le rabattement DND se trompe** sur une fenêtre enjambant minuit | Assertion de propriété `!isWithinDnd(résultat)` sur les 24 heures × plusieurs fenêtres. C'est une propriété, pas un cas. |
| **`created_at` interprété en UTC** au lieu du local | Conversion en JS uniquement, jamais de `strftime('%H', …)`. Test explicite avec un horodatage UTC de fin de soirée. |
| **Régression sur du code livré** | D3 supprime le besoin de toucher aux planificateurs existants. Seule modification : un commentaire. |
| **Absence de mock `expo-notifications`** casse des tests verts | Mock ajouté à `jest.setup.ts` **avant** de toucher aux call sites (étape 4). |
| **Volume ressenti comme du spam** | Rappels **opt-in**, un par type et par jour, auto-annulés dès le geste fait, p90 donc rares, DND respecté, hint enfin exact. |

## Estimation

| Étape | Charge |
|---|---|
| 0 — dérive Zod | 0,25 h |
| 1 — échéance apprise (pur + tests) | 1,5 h |
| 2 — DND / décision / prefs (pur + tests) | 1,75 h |
| 3 — lecture des habitudes | 1,25 h |
| 4 — planificateur + couche native + mock Jest | 1,25 h |
| 5 — réglages + i18n + a11y | 1,5 h |
| 6 — vérification et clôture | 0,5 h |
| **Total** | **≈ 8 h** |

La roadmap estimait 1 h + 1 h pour deux notifications « à heure fixe ». L'écart tient entièrement à
l'**échéance apprise** — un enrichissement assumé, pas un dérapage. La décision D3 (pas de compteur
de quota) a retiré ~1 h et, surtout, tout le risque de régression sur les planificateurs déjà
recettés.

**Point de coupe propre** si la charge doit être réduite : livrer les deux rappels à heure fixe
réglable et garder `learned-hour.ts` pour une itération suivante (≈ 4 h, étapes 0, 2c, 4, 5). Ce
serait alors MUSC-F8 qui hériterait du sujet de l'apprentissage — avec le risque de le concevoir
deux fois.
