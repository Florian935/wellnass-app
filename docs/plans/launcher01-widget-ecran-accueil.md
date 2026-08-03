# Plan — LAUNCHER-01 · Widget écran d'accueil Android (roadmap 7.19)

Spec : [launcher01-widget-ecran-accueil.md](../specs/functional/us/launcher01-widget-ecran-accueil.md) ·
branche `feature/launcher01-widget-ecran-accueil` · roadmap **7.19**.

Dépendance native neuve (`react-native-android-widget`, D1) dont la compatibilité SDK 57/RN 0.86
n'est **pas confirmée nommément** par la lib — le plan commence donc par un **spike bloquant**,
pas par du code produit. Si le spike échoue, retour à Florian/Damien avant d'aller plus loin
(pas de repli silencieux vers du Kotlin écrit à la main sans re-validation du coût).

## Étape 0 — Spike de compatibilité *(≈ 1-2 h, bloquant)*

1. `npm install react-native-android-widget --workspace=apps/mobile` (dev dependency native).
2. Config plugin minimal dans `app.json`/`app.config.ts` : un widget vide (`FlexWidget` +
   `TextWidget` statique « Hello »), `minWidth`/`minHeight`, `updatePeriodMillis` par défaut.
3. `npx expo prebuild --platform android --clean` (piège documenté dans
   [dev-build-android-local.md](../specs/technical/dev-build-android-local.md) : le dossier
   `android/` n'est pas versionné, un `--clean` évite les incohérences héritées).
4. Build local (`gradlew assembleRelease` ou `expo run:android`), ajout du widget depuis le
   sélecteur du launcher, vérifier qu'il s'affiche sans crash.
5. **Critère de passage** : le widget statique s'affiche. Sinon → **stop**, remonter le blocage
   avant d'investir dans le reste du plan (l'estimation entière du plan repose sur D1).

## Étape 1 — Couche d'orchestration, hors contexte React *(≈ 2 h)*

Nouveau `apps/mobile/src/widgets/home-widget-data.ts` (hors `data/repositories/` volontairement :
ce fichier n'exporte **aucun hook**, il doit être appelable depuis la tâche Headless JS de la lib,
qui ne monte aucun arbre React) :

```ts
export type HomeWidgetSnapshot = {
  streak: number;
  todaySession: { pillar: Pillar; label: string } | null; // null = repos ou pilier absent
  kcalRemaining: number | null; // null = nutrition non active
  authState: 'ready' | 'no-session'; // D10
};

export async function computeHomeWidgetSnapshot(): Promise<HomeWidgetSnapshot> {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) return { streak: 0, todaySession: null, kcalRemaining: null, authState: 'no-session' };

  // Streak : mêmes requêtes que useStreakData (dashboard-repository.ts), fonctions pures de
  // packages/shared/src/streak.ts — activeDayKeys + computeStreakWithJokers.
  // Séance du jour : mêmes requêtes SELECT_TODAY_OCCURRENCES / SELECT_NEXT_UPCOMING
  // (dashboard-repository.ts), un appel par pilier actif, priorité musculation > running (spec §3).
  // Kcal restantes : mêmes fonctions @wellness/shared (tdee/targetCalories/dayCalorieBonus) +
  // total du journal du jour, comme NutritionSummaryCard.
  // Tout via powerSync.getAll()/getOptional() (system.ts, singleton — D2), jamais un nouveau
  // PowerSyncDatabase.
}
```

**Test d'abord** (`home-widget-data.test.ts`, mock `powerSync`) : `authState: 'no-session'` quand
`useAuthStore.getState().session` est `null` (D10, ne doit **jamais** lancer de requête SQL dans ce
cas) ; streak/séance/kcal cohérents avec des fixtures reprenant les mêmes cas que
`useStreakData`/`useTodaySession`/`useNutritionSummary` existants (pas de nouvelle règle métier,
seulement une nouvelle façade d'appel — les tests vérifient l'orchestration, pas la logique déjà
couverte ailleurs) ; priorité musculation > running quand les deux ont une séance le même jour.

## Étape 2 — i18n : résolution avant le natif *(≈ 45 min)*

Nouvelle famille `homeWidget.*` (FR+EN) : `streakLabel`, `todayLabel`, `restLabel` (repos),
`kcalRemainingLabel`, `noSessionCta` (« Ouvre l'app »). Fonction `resolveHomeWidgetTexts(snapshot,
t)` qui transforme le `HomeWidgetSnapshot` (données brutes) en chaînes déjà traduites — **jamais**
de texte résolu dans la couche d'affichage du widget (D4, patron notifications :
`notification-repository.ts` résout, `notifications.ts` ne fait qu'afficher un contenu déjà prêt).

## Étape 3 — Composant widget (JSX de la lib, pas des composants RN standards) *(≈ 2 h)*

Nouveau `apps/mobile/src/widgets/HomeWidget.tsx` : `FlexWidget`/`TextWidget`/`IconWidget` de
`react-native-android-widget` (7 primitives seulement, cf. spec §1 — pas de `View`/`Text` RN).
Trois blocs conditionnels (D6) : streak toujours affiché, séance du jour si `todaySession !== null`
**ou** si le pilier correspondant est actif (masqué sinon), kcal restantes si `kcalRemaining !==
null`. État `authState === 'no-session'` → un seul bloc « Ouvre l'app » (D10), rien d'autre.

**Point de vigilance accessibilité (spec §6)** : vérifier dans la doc de la lib si un
`contentDescription` global peut être posé sur la racine du widget (le rendu final est un bitmap —
sans ça, TalkBack ne lit rien). Si aucune API ne le permet, **consigner en dette technique avant de
clôturer**, pas un simple constat perdu.

## Étape 4 — Déclencheurs de rafraîchissement *(≈ 1 h 30)*

`registerWidgetTaskHandler` (Headless JS, appelé aussi par le timer `updatePeriodMillis` — plafond
OS 30 min, D5) : calcule le snapshot (étape 1), résout les textes (étape 2), peint le widget
(étape 3).

Déclenchement applicatif (`requestWidgetUpdate`), branché aux points déjà identifiés (spec §4) :
- foreground/background de l'app (`AppState` listener, un seul point central — pas un par écran) ;
- fin de séance (`workouts.finished_at` posé) et fin de course (`runs.status = 'completed'`) — même
  point d'écriture déjà utilisé par les notifications de record (MUSC-F8) ;
- ajout d'une entrée de journal (`food_entries` insert) ;
- jour de streak franchi (détecté par le listener foreground, pas un job séparé).

## Étape 5 — Config plugin final *(≈ 30 min)*

Nom, description, `previewImage` (asset statique), `minWidth`/`minHeight` (fallback ≤ Android 11),
`targetCellWidth`/`targetCellHeight` (Android 12+, D9 — une seule taille). `packageName` =
`com.wellness.app`.

## Étape 6 — Quality gate + solde *(≈ 30 min)*

`npm run typecheck` / `lint` / `test` (lus sans pipe). Roadmap 7.19 ⬜→✅ (ou 🟡 si l'accessibilité
du §6 reste ouverte), BACKLOG (retirer la ligne « Widget écran d'accueil Android »), CHANGELOG,
`etat.mjs`, front-matter `etape: recette`, `/commit`, merge `dev`.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `apps/mobile/package.json` | dépendance `react-native-android-widget` (native) |
| `apps/mobile/app.json` (ou `app.config.ts`) | config plugin du widget |
| `apps/mobile/src/widgets/home-widget-data.ts` (+ `.test.ts`, nouveau) | orchestration hors React (D2/D3/D10) |
| `apps/mobile/src/widgets/HomeWidget.tsx` (nouveau) | UI JSX de la lib (D6, D9) |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | `homeWidget.*` |
| Point d'appel `requestWidgetUpdate` | dans le listener `AppState` global + points d'écriture séance/course/journal existants |

## Migration / sync rules

**Aucune** — le widget ne fait que lire des tables déjà synchronisées, aucune nouvelle colonne ni
table.

## Dépendances

**`react-native-android-widget`, dépendance native neuve** → dev client **et** APK à reconstruire
avant recette (spec §9, même coût que PARTAGE-01/RUN-F2a/MUSC-F9).

## Risques

- 🔴 **Étape 0 (spike) conditionne tout le reste** : compatibilité SDK 57/RN 0.86 non confirmée par
  la lib elle-même (spec §1). Ne pas commencer l'étape 1 avant que l'étape 0 soit verte.
- 🔴 **D2 (singleton PowerSync partagé)** : zone « non défrichée par la communauté » (aucun retour
  d'expérience publié croisant cette lib et PowerSync/op-sqlite). Premier signe d'alerte à
  surveiller en étape 1 : erreurs « database is locked » ou `watch()` qui ne se met pas à jour côté
  app UI après une écriture — indiquerait une seconde instance créée par erreur.
- 🟠 **Accessibilité du rendu bitmap (étape 3, spec §6)** : si aucune API de `contentDescription`
  n'existe, ce n'est pas un point à reporter silencieusement — en discuter avant `etape: recette`.
- 🟢 **Aucune nouvelle règle métier** : streak/séance du jour/kcal restantes réutilisent des briques
  déjà testées — le risque est entièrement dans l'intégration native, pas dans le calcul.
