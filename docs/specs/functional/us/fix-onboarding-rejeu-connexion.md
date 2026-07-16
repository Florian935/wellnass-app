# Fix — Onboarding redemandé après réinstallation (race offline-first de la gate de routing)

_Spec courte de correctif. Statut : validée (Florian, 16/07/2026). Branche : `fix/onboarding-rejeu-connexion`
(depuis `dev`). Bug §🐞 « onboarding redemandé à chaque connexion »._

## 1. Symptôme & reproduction (Florian, 16/07/2026)
- **Déco / reco** (même installation) → l'onboarding **n'est pas** reproposé. ✅
- **Désinstallation / réinstallation** → l'onboarding **revient systématiquement**, alors qu'il a déjà
  été terminé.

## 2. Cause racine (confirmée dans le code)
La gate de routing ([\_layout.tsx](../../../apps/mobile/src/app/_layout.tsx)) décide via
`onboardingCompleted = profile?.onboardingCompletedAt != null`, et `ready` ne dépend que de
`profileLoading` = **résolution de la requête SQLite locale**, jamais de la synchro réseau
([profile-repository.ts:103-106](../../../apps/mobile/src/data/repositories/profile-repository.ts#L103-L106)).

Sur une **réinstallation**, la base locale est vide : la requête profil résout **`null` immédiatement**
→ `ready` devient vrai **avant** que PowerSync ait redescendu la ligne `profiles` (qui porte
`onboarding_completed_at`) → `onboardingCompleted = false` → **redirection onboarding**. En déco/reco, la
base locale contient encore le profil → pas de bug. C'est une **race offline-first**.

_Le bootstrap des réglages juste à côté ([\_layout.tsx:96-100](../../../apps/mobile/src/app/_layout.tsx#L96-L100))
attend déjà `hasSynced` pour éviter le même piège (doublon de ligne) → on applique la même garde à
l'onboarding._

## 3. Correctif
Extraire la **décision de routing racine** dans une **fonction pure testée** `resolveRootRoute` dans
`@wellness/shared`, et faire consommer `_layout.tsx` par ce helper. La règle clé ajoutée : **ne pas
conclure « onboarding non fait » sur un profil local nul tant que la synchro initiale n'est pas
terminée** (`hasSynced`).

```ts
export type RootRoute = 'wait' | 'auth' | 'onboarding' | 'app';

export function resolveRootRoute(input: {
  fontsReady: boolean;
  authInitializing: boolean;
  hasSession: boolean;
  profileLoading: boolean;
  hasProfile: boolean;
  onboardingCompletedAt: string | null;
  settingsLoading: boolean;
  hasSynced: boolean;
}): RootRoute;
```

Logique (préserve le comportement actuel + garde de synchro) :
1. `!fontsReady || authInitializing` → `wait` (splash).
2. `!hasSession` → `auth`.
3. session présente et `profileLoading || settingsLoading` → `wait` (résolution locale).
4. **`!hasProfile && !hasSynced` → `wait`** (⭐ le fix : profil peut n'être pas encore redescendu).
5. `onboardingCompleted = hasProfile && onboardingCompletedAt != null` ; `!onboardingCompleted` →
   `onboarding` ; sinon → `app`.

`_layout.tsx` : calcule `route = resolveRootRoute(...)`, `ready = route !== 'wait'` (splash), et dans
l'effet de redirection mappe `route` → `router.replace` **uniquement si** le groupe courant diffère
(comportement inchangé : `auth`→`/(auth)/sign-in`, `onboarding`→`/(onboarding)/intro`, `app`→`/(tabs)`
si l'on est encore dans auth/onboarding).

## 4. Non-régression / cas limites
- **Lancement normal / déco-reco** (profil local présent) : `hasProfile` vrai → étape 4 court-circuitée
  → **aucun changement**.
- **Nouveau compte** : après sign-up, `hasSynced` passe vrai (1ᵉʳ cycle, même sans données) → profil
  null → `onboarding` **légitime**.
- **Réinstallation (utilisateur existant)** : `wait` jusqu'à `hasSynced` → profil redescendu → `app`
  (plus d'onboarding fantôme).
- **Offline juste après réinstall** : la session exige une reconnexion **en ligne** (auth Supabase),
  donc la synchro suit ; le splash reste le temps du 1ᵉʳ sync (trade-off accepté — on ne peut pas
  connaître le statut d'onboarding sur une base fraîche hors-ligne).

## 5. Tests
- **Shared (Vitest)** `root-route.test.ts` — `resolveRootRoute` :
  - fonts non prêtes / auth en cours → `wait` ;
  - pas de session → `auth` ;
  - session + profil ou réglages en chargement → `wait` ;
  - **session + profil local null + `!hasSynced` → `wait`** (cœur du fix) ;
  - session + profil null + `hasSynced` → `onboarding` (nouveau compte) ;
  - session + profil avec `onboardingCompletedAt` null → `onboarding` ;
  - session + profil onboardé → `app` ;
  - **non-régression réinstall** : profil null + `!hasSynced` **puis** profil présent onboardé → `wait`
    puis `app` (jamais `onboarding`).
- **Mobile** : `typecheck` + `lint` verts.

## 6. Definition of Done
- Helper pur `resolveRootRoute` testé (@wellness/shared) ; `_layout.tsx` câblé dessus ; comportement de
  routing inchangé hors le cas réinstall, qui ne renvoie plus vers l'onboarding.
- typecheck/lint/tests verts. **100 % client, aucune migration, pas de checkpoint 🔴.**
- Bug §🐞 « onboarding redemandé » → **corrigé**. Reste : **recette device** (réinstaller l'APK → se
  reconnecter → arrive direct sur l'app, pas d'onboarding ; nouveau compte → onboarding ; déco/reco →
  inchangé) + relecture Damien.
