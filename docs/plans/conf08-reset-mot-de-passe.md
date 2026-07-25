# US CONF-08 — Réinitialisation du mot de passe — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans. Steps en cases `- [ ]`.
> ⚠️ **Workflow projet** : ne PAS exécuter avant validation des 3 livrables (spec + plan + maquette).
> ✅ **Aucune migration. Aucun module natif ajouté → pas de rebuild** (reload Metro suffit pour le JS ;
> le **deep link** se teste sur le dev build existant).
> 🔧 **Prérequis avant recette (hors code, Florian)** : `wellness://password-reset` ajouté aux
> **Redirect URLs** Supabase.

**Goal :** un utilisateur qui a oublié son mot de passe reçoit un lien, le clique sur son téléphone,
saisit un nouveau mot de passe dans l'app, et se reconnecte avec — les autres appareils étant déconnectés.

**Architecture :** URL de redirection **dédiée** `wellness://password-reset` (discriminant structurel) →
`useAuthDeepLink` reconnaît le flux, ouvre la session **et** lève un drapeau `recoveryPending` (mémoire) →
`resolveRootRoute` renvoie le nouvel état `password-recovery`, prioritaire sur onboarding/app → écran-gate
racine `new-password` (patron `deletion-pending`) → `updateUser` → `signOut({scope:'others'})` → `signOut()`
→ retour connexion avec message de succès.

**Tech stack :** TypeScript, RN + Expo (SDK 57), `expo-linking` + `expo-router` (déjà en place),
`@supabase/supabase-js` (`resetPasswordForEmail` / `updateUser` / `signOut(scope)`), Zustand (`auth-store`),
i18next, Vitest (shared) + jest-expo (mobile).

**Spec :** [docs/specs/functional/us/conf08-reset-mot-de-passe.md](../specs/functional/us/conf08-reset-mot-de-passe.md)

**Ordre :** purs d'abord (règle mot de passe → routing → parsing du lien), puis I/O (store + hook), puis UI,
puis clôture. Chaque task est **livrable et vérifiable seule**.

---

## Structure des fichiers

**Créer :**
- `packages/shared/src/password.ts` (+ `password.test.ts`) — `MIN_PASSWORD_LENGTH` + `validatePasswordPair` (**pur, testé**).
- `apps/mobile/src/app/password-reset.tsx` — écran-gate « Nouveau mot de passe » (**racine**, à côté de `deletion-pending.tsx`).

**Modifier :**
- `packages/shared/src/index.ts` — export du nouveau module.
- `packages/shared/src/root-route.ts` (+ `root-route.test.ts`) — état `password-recovery` + entrée `recoveryPending?`.
- `apps/mobile/src/lib/auth-redirect.ts` (+ `__tests__/auth-redirect.test.ts`) — `PASSWORD_RESET_REDIRECT_URL` + `parseAuthDeepLink`.
- `apps/mobile/src/stores/auth-store.ts` — `redirectTo` sur `resetPassword`, drapeau `recoveryPending`, `completePasswordRecovery`, `clearRecovery`.
- `apps/mobile/src/hooks/useAuthDeepLink.ts` — dispatch selon le `kind` du lien.
- `apps/mobile/src/app/_layout.tsx` — `recoveryPending` passé au routing + branche de redirection + `Stack.Screen`.
- `apps/mobile/src/app/(auth)/sign-in.tsx` — messages « mot de passe modifié » / « lien expiré ».
- `apps/mobile/src/app/(auth)/sign-up.tsx` — bascule sur `validatePasswordPair` (**iso-comportement**).
- `apps/mobile/src/i18n/locales/{fr,en}.json` — `auth.newPassword.*` + 2 clés `auth.signIn.*`.

---

## Task 1 : Règle de mot de passe mutualisée (pur, TDD) + bascule de l'inscription

**Files:** `packages/shared/src/password.ts`, `packages/shared/src/password.test.ts`,
`packages/shared/src/index.ts`, `apps/mobile/src/app/(auth)/sign-up.tsx`

- [ ] **Step 1 : test qui échoue** — `packages/shared/src/password.test.ts` :
  ```ts
  import { describe, it, expect } from 'vitest';
  import { MIN_PASSWORD_LENGTH, validatePasswordPair } from './password';

  describe('validatePasswordPair', () => {
    it('longueur insuffisante → too-short (prioritaire sur la concordance)', () => {
      expect(validatePasswordPair('abc', 'abc')).toBe('too-short');
      expect(validatePasswordPair('abc', 'xyz')).toBe('too-short');
    });
    it('assez long mais différents → mismatch', () => {
      expect(validatePasswordPair('motdepasse1', 'motdepasse2')).toBe('mismatch');
    });
    it('valide → null', () => {
      expect(validatePasswordPair('motdepasse1', 'motdepasse1')).toBeNull();
    });
    it('exactement la longueur minimale → valide', () => {
      const pwd = 'a'.repeat(MIN_PASSWORD_LENGTH);
      expect(validatePasswordPair(pwd, pwd)).toBeNull();
    });
    it('constante = 8 (contrat repris de sign-up)', () => {
      expect(MIN_PASSWORD_LENGTH).toBe(8);
    });
  });
  ```
- [ ] **Step 2 : lancer → échec** `npm run test -w @wellness/shared -- password`.
- [ ] **Step 3 : implémenter** `password.ts` — pur, aucune I/O :
  ```ts
  /** Longueur minimale d'un mot de passe (contrat unique inscription + réinitialisation). */
  export const MIN_PASSWORD_LENGTH = 8;

  export type PasswordPairError = 'too-short' | 'mismatch';

  /**
   * Valide un couple (mot de passe, confirmation). **Pur.**
   * Ordre volontaire : la longueur est contrôlée AVANT la concordance (message le plus utile d'abord).
   */
  export function validatePasswordPair(
    password: string,
    confirm: string,
  ): PasswordPairError | null {
    if (password.length < MIN_PASSWORD_LENGTH) return 'too-short';
    if (password !== confirm) return 'mismatch';
    return null;
  }
  ```
- [ ] **Step 4 : exporter** — ajouter `export * from './password';` dans `packages/shared/src/index.ts`
  (à la suite des autres, ordre du fichier respecté).
- [ ] **Step 5 : lancer → succès** `npm run test -w @wellness/shared -- password`.
- [ ] **Step 6 : basculer `sign-up.tsx`** — supprimer la constante locale `MIN_PASSWORD_LENGTH` (l. 16) et
  remplacer les deux `if` de validation par un seul appel, **en conservant exactement les mêmes clés i18n** :
  ```ts
  const pwdError = validatePasswordPair(password, confirm);
  if (pwdError === 'too-short') {
    setError(t('auth.signUp.passwordTooShort', { count: MIN_PASSWORD_LENGTH }));
    return;
  }
  if (pwdError === 'mismatch') {
    setError(t('auth.signUp.passwordMismatch'));
    return;
  }
  ```
  ⚠️ **Iso-comportement exigé** : mêmes messages, même ordre, même moment de déclenchement. Ne rien
  durcir (pas de règle de complexité), ne pas toucher au reste de l'écran.
- [ ] **Step 7 : vérifier** `npm run typecheck` + `npm run lint` + `npm run test` (shared **et** mobile — si
  un test mobile couvre l'inscription, il doit rester vert **sans modification**).
- [ ] **Step 8 : commit** `refactor(conf08): règle de mot de passe mutualisée dans shared (pure, testée)`

---

## Task 2 : État de routing `password-recovery` (pur, TDD)

**Files:** `packages/shared/src/root-route.ts`, `packages/shared/src/root-route.test.ts`

- [ ] **Step 1 : test qui échoue** — ajouter au `describe` existant (réutiliser l'objet `base`) :
  ```ts
  it('password-recovery quand une récupération est en cours (prioritaire sur onboarding/app)', () => {
    expect(resolveRootRoute({ ...base, recoveryPending: true })).toBe('password-recovery');
    // même si l'onboarding n'est pas fini
    expect(
      resolveRootRoute({ ...base, recoveryPending: true, onboardingCompletedAt: null }),
    ).toBe('password-recovery');
  });

  it('la gate de suppression reste prioritaire sur la récupération', () => {
    expect(
      resolveRootRoute({ ...base, recoveryPending: true, deletionPending: true }),
    ).toBe('deletion-pending');
  });

  it('sans session, la récupération ne s\'applique pas (retour auth)', () => {
    expect(resolveRootRoute({ ...base, hasSession: false, recoveryPending: true })).toBe('auth');
  });

  it('non-régression : sans recoveryPending, comportement inchangé', () => {
    expect(resolveRootRoute({ ...base })).toBe('app');
  });
  ```
- [ ] **Step 2 : lancer → échec** `npm run test -w @wellness/shared -- root-route`.
- [ ] **Step 3 : implémenter** dans `root-route.ts` :
  - ajouter `'password-recovery'` au type `RootRoute` ;
  - ajouter l'entrée **optionnelle** documentée :
    ```ts
    /** Une réinitialisation de mot de passe est en cours (deep link de récupération) — CONF-08. */
    recoveryPending?: boolean;
    ```
  - insérer le contrôle **après** `deletionPending` et **avant** `if (profileLoading || settingsLoading)` :
    ```ts
    // Gate réinitialisation de mot de passe (CONF-08) : le lien de récupération ouvre une session, mais
    // l'utilisateur doit choisir son nouveau mot de passe avant d'entrer dans l'app. Placé APRÈS la gate
    // de suppression (qui offre l'annulation, action plus urgente) et AVANT l'attente profil/réglages :
    // l'écran n'a besoin ni du profil ni des réglages, inutile de faire attendre l'utilisateur.
    if (recoveryPending) return 'password-recovery';
    ```
  - déstructurer `recoveryPending` avec les autres entrées.
- [ ] **Step 4 : lancer → succès** + `npm run typecheck` + `npm run lint`.
- [ ] **Step 5 : commit** `feat(conf08): état de routing password-recovery (helper pur testé)`

> Le champ est **optionnel** → tous les appels existants de `resolveRootRoute` compilent et se comportent
> à l'identique. C'est la garantie de non-régression de cette task.

---

## Task 3 : Parsing du deep link — jetons / récupération / erreur (pur, TDD)

**Files:** `apps/mobile/src/lib/auth-redirect.ts`, `apps/mobile/src/lib/__tests__/auth-redirect.test.ts`

- [ ] **Step 1 : test qui échoue** — compléter le fichier de test existant (**ne pas** supprimer les tests
  de `parseAuthTokensFromUrl`, qui couvrent la confirmation déjà recettée) :
  ```ts
  import { parseAuthDeepLink, PASSWORD_RESET_REDIRECT_URL } from '../auth-redirect';

  describe('parseAuthDeepLink', () => {
    it('lien de récupération → kind tokens + isRecovery', () => {
      const url = `${PASSWORD_RESET_REDIRECT_URL}#access_token=a&refresh_token=r&type=recovery`;
      expect(parseAuthDeepLink(url)).toEqual({
        kind: 'tokens',
        tokens: { accessToken: 'a', refreshToken: 'r' },
        isRecovery: true,
      });
    });
    it('lien de confirmation → kind tokens sans récupération', () => {
      const url = 'wellness://auth-callback#access_token=a&refresh_token=r';
      expect(parseAuthDeepLink(url)).toEqual({
        kind: 'tokens',
        tokens: { accessToken: 'a', refreshToken: 'r' },
        isRecovery: false,
      });
    });
    it('récupération reconnue par le chemin même sans type=recovery', () => {
      const url = `${PASSWORD_RESET_REDIRECT_URL}#access_token=a&refresh_token=r`;
      expect(parseAuthDeepLink(url)).toMatchObject({ isRecovery: true });
    });
    it('lien expiré → kind error', () => {
      const url = `${PASSWORD_RESET_REDIRECT_URL}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`;
      expect(parseAuthDeepLink(url)).toEqual({ kind: 'error', code: 'otp_expired' });
    });
    it('erreur sans error_code → code de repli', () => {
      const url = `${PASSWORD_RESET_REDIRECT_URL}#error=access_denied`;
      expect(parseAuthDeepLink(url)).toEqual({ kind: 'error', code: 'access_denied' });
    });
    it('deep link quelconque ou URL vide → null', () => {
      expect(parseAuthDeepLink('wellness://autre-chose')).toBeNull();
      expect(parseAuthDeepLink(null)).toBeNull();
      expect(parseAuthDeepLink('')).toBeNull();
    });
    it('jetons incomplets → null (pas de session bancale)', () => {
      expect(parseAuthDeepLink(`${PASSWORD_RESET_REDIRECT_URL}#access_token=a`)).toBeNull();
    });
  });
  ```
- [ ] **Step 2 : lancer → échec** `npm run test -w @wellness/mobile -- auth-redirect`.
- [ ] **Step 3 : implémenter** dans `auth-redirect.ts` :
  ```ts
  /** Deep link cible des liens de **réinitialisation de mot de passe** (Redirect URLs Supabase). */
  export const PASSWORD_RESET_REDIRECT_URL = 'wellness://password-reset';

  export type AuthDeepLink =
    | { kind: 'tokens'; tokens: AuthTokens; isRecovery: boolean }
    | { kind: 'error'; code: string };

  /**
   * Classe un deep link d'authentification Supabase. **Pur.**
   *
   * Le discriminant de la récupération est **le chemin du lien** (`PASSWORD_RESET_REDIRECT_URL`) et non
   * `type=recovery` : on ne dépend pas du contenu exact du fragment. `type=recovery`, s'il est présent,
   * sert de contrôle secondaire (l'un OU l'autre suffit).
   */
  export function parseAuthDeepLink(url: string | null | undefined): AuthDeepLink | null {
    if (!url) return null;
    const hashIndex = url.indexOf('#');
    if (hashIndex === -1) return null;
    const params = new URLSearchParams(url.slice(hashIndex + 1));

    // Erreur explicite renvoyée par Supabase (lien expiré / déjà consommé).
    const error = params.get('error');
    if (error) return { kind: 'error', code: params.get('error_code') ?? error };

    const tokens = parseAuthTokensFromUrl(url); // réutilise le helper déjà recetté
    if (!tokens) return null;

    const isRecovery =
      url.startsWith(PASSWORD_RESET_REDIRECT_URL) || params.get('type') === 'recovery';
    return { kind: 'tokens', tokens, isRecovery };
  }
  ```
  ⚠️ **Ne pas modifier** `parseAuthTokensFromUrl` ni `AUTH_REDIRECT_URL` : le flux de confirmation est
  déjà en production et recetté.
- [ ] **Step 4 : lancer → succès** + `npm run typecheck` + `npm run lint`.
- [ ] **Step 5 : commit** `feat(conf08): parsing typé des deep links auth (récupération / erreur) — pur, testé`

---

## Task 4 : Store + hook — envoi, réception, enregistrement

**Files:** `apps/mobile/src/stores/auth-store.ts`, `apps/mobile/src/hooks/useAuthDeepLink.ts`

- [ ] **Step 1 : `resetPassword` → `redirectTo`** :
  ```ts
  resetPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: PASSWORD_RESET_REDIRECT_URL, // sinon Supabase retombe sur le Site URL (localhost)
    });
    return { error: error?.message ?? null };
  },
  ```
- [ ] **Step 2 : drapeau de récupération** — ajouter à `AuthState` et au store :
  ```ts
  /**
   * Une réinitialisation de mot de passe est en cours (session ouverte par un lien de récupération).
   * **En mémoire uniquement** : si l'app est tuée sur l'écran de saisie, le lancement suivant reprend
   * un parcours normal, mot de passe inchangé (comportement accepté — spec §2.5).
   */
  recoveryPending: boolean;
  /** Sort du mode récupération sans changer le mot de passe (bouton Annuler → déconnexion). */
  clearRecovery: () => void;
  ```
  Valeur initiale `false` ; `clearRecovery: () => useAuthStore.setState({ recoveryPending: false })`.
- [ ] **Step 3 : `completePasswordRecovery`** :
  ```ts
  /**
   * Enregistre le nouveau mot de passe, puis déconnecte **tous** les appareils.
   *
   * `signOut()` sans argument utilise le scope **`global`** (défaut de `@supabase/auth-js`) : il révoque
   * les refresh tokens de tous les appareils ET efface la session locale (`SIGNED_OUT` émis). Un seul
   * appel couvre donc la décision de cadrage — inutile d'enchaîner `{ scope: 'others' }` puis un second
   * `signOut()`. Ne PAS passer `{ scope: 'local' }` ici : on veut justement éjecter les autres appareils.
   */
  completePasswordRecovery: async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };

    useAuthStore.setState({ recoveryPending: false });
    // PAS de powerSync.disconnectAndClear() : même utilisateur, on garde la base locale et les
    // écritures en attente (contraste volontaire avec requestAccountDeletion).
    await supabase.auth.signOut(); // scope global par défaut → tous les appareils
    return { error: null };
  },
  ```
  > **Vérifié dans le code de la dépendance** (`node_modules/@supabase/auth-js`) :
  > `scope?: 'global' | 'local' | 'others'` (types.d.ts) et « *the default `scope` is `'global'`. This signs
  > the user out of every device* » (GoTrueClient.d.ts). **Ne pas** « corriger » en ajoutant un scope.
  Signature : `completePasswordRecovery: (password: string) => Promise<AuthResult>` (contrat d'erreur =
  **message Supabase brut**, comme `signIn`/`signUp` — l'écran l'affiche tel quel ; documenter dans le
  type pour éviter la confusion avec le contrat « clé i18n » de `signInWithGoogle`).
- [ ] **Step 4 : `useAuthDeepLink`** — dispatch selon le `kind`, en gardant le no-op par défaut :
  ```ts
  const handle = (url: string | null) => {
    const link = parseAuthDeepLink(url);
    if (!link) return; // n'importe quel autre deep link
    if (link.kind === 'error') {
      useAuthStore.setState({ deepLinkError: link.code }); // affiché par sign-in
      return;
    }
    if (link.isRecovery) {
      useAuthStore.setState({ recoveryPending: true }); // AVANT setSession : la gate doit être
      // active dès que la session arrive, sinon un rendu intermédiaire enverrait vers (tabs).
    }
    void supabase.auth.setSession({
      access_token: link.tokens.accessToken,
      refresh_token: link.tokens.refreshToken,
    });
  };
  ```
  Ajouter au store `deepLinkError: string | null` + `clearDeepLinkError()` (consommé puis effacé par
  l'écran de connexion).
- [ ] **Step 5 : vérifier** `npm run typecheck` + `npm run lint` + `npm run test` (mobile).
  Pas de test unitaire sur ces appels (I/O Supabase) — la logique testable est déjà sortie en Tasks 1-3.
- [ ] **Step 6 : commit** `feat(conf08): envoi avec redirectTo, réception du lien de récupération et enregistrement du mot de passe`

> ⚠️ Vérifier la signature `signOut({ scope })` et `updateUser({ password })` contre la version de
> `@supabase/supabase-js` du projet au moment du code (`package.json`).

---

## Task 5 : Écran « Nouveau mot de passe » + branchement du gate + messages + i18n

**Files:** `apps/mobile/src/app/password-reset.tsx`, `apps/mobile/src/app/_layout.tsx`,
`apps/mobile/src/app/(auth)/sign-in.tsx`, `apps/mobile/src/i18n/locales/{fr,en}.json`

- [ ] **Step 1 : i18n** — ajouter dans `fr.json` **et** `en.json` (parité stricte) :
  - `auth.newPassword` : `title`, `subtitle`, `field`, `confirmField`, `cta`, `cancel`, `tooShort`
    (avec `{{count}}`), `mismatch`, `updateFailed`, `offline` ;
  - `auth.signIn.passwordResetSuccess` — « Mot de passe modifié. Connecte-toi avec ton nouveau mot de passe. » ;
  - `auth.signIn.resetLinkExpired` — « Ce lien de réinitialisation a expiré ou a déjà été utilisé. Demande un nouveau lien. ».
- [ ] **Step 2 : écran** `apps/mobile/src/app/password-reset.tsx` — reprendre la structure de
  `forgot-password.tsx` (`FormScreen` + `ScreenHeader` + `TextField` + `Button`) :
  - 2 `TextField` `secureTextEntry`, `autoComplete="new-password"`, `textContentType="newPassword"` ;
  - validation via `validatePasswordPair` → `tooShort` (avec `count: MIN_PASSWORD_LENGTH`) / `mismatch`,
    **sans appel réseau** ;
  - succès → `router.replace({ pathname: '/(auth)/sign-in', params: { reset: 'done' } })` (la déconnexion
    du store déclenche de toute façon la redirection ; le paramètre porte le message de succès) ;
  - échec → afficher le message Supabase ; si l'erreur ressemble à un problème réseau
    (`fetch`/`Network request failed`), afficher `auth.newPassword.offline` à la place ;
  - bouton **« Annuler »** (style discret, secondaire) → `clearRecovery()` puis `signOut()` ;
  - états `loading` sur le bouton principal (anti double-tap, patron existant).
- [ ] **Step 3 : `_layout.tsx`** — 3 modifications :
  1. lire le drapeau : `const recoveryPending = useAuthStore((s) => s.recoveryPending);` ;
  2. le passer à `resolveRootRoute({ …, recoveryPending })` ;
  3. ajouter la branche de redirection **avant** `// route === 'app'`, calquée sur `deletion-pending`
     (l. 181-186) :
     ```ts
     if (route === 'password-recovery') {
       if (segments[0] !== 'password-reset') {
         router.replace('/password-reset');
       }
       return;
     }
     ```
  4. déclarer l'écran dans le `Stack` racine, à côté de `deletion-pending` :
     ```tsx
     <Stack.Screen name="password-reset" options={{ headerShown: false, gestureEnabled: false }} />
     ```
- [ ] **Step 4 : `sign-in.tsx`** — afficher les deux messages :
  - succès : lire le paramètre de route (`useLocalSearchParams`) → bandeau de succès (couleur
    `colors.success`, comme `forgot-password`) ;
  - lien expiré : lire `deepLinkError` du store → message d'erreur + **`clearDeepLinkError()`** après
    affichage (sinon il réapparaîtrait à chaque retour sur l'écran).
- [ ] **Step 5 : smoke test mobile** (optionnel mais recommandé) —
  `apps/mobile/src/app/__tests__/password-reset-smoke.test.tsx` : rendu de l'écran + un cas de validation
  locale (mot de passe trop court → message, **aucun** appel au store). Suivre le patron des smokes
  existants (mocks PowerSync/safe-area déjà en place dans le setup jest).
- [ ] **Step 6 : vérifier** `npm run typecheck` + `npm run lint` + `npm run test` (shared + mobile).
- [ ] **Step 7 : commit** `feat(conf08): écran Nouveau mot de passe + gate de routing + messages de connexion + i18n`

---

## Task 6 : Parité, revue finale et clôture

- [ ] **Step 1 : parité i18n** FR/EN de toutes les clés ajoutées (comparer les deux fichiers clé par clé).
- [ ] **Step 2 : suite complète** — `npm run typecheck` + `npm run lint` + `npm run test` verts (shared **et** mobile).
- [ ] **Step 3 : revue finale** — checklist :
  - un lien de récupération **ne peut pas** faire entrer dans l'app sans passer par l'écran ;
  - `recoveryPending` est levé **avant** `setSession` (pas de rendu intermédiaire vers `(tabs)`) ;
  - `updateUser` → `signOut()` (scope global par défaut = tous les appareils), **aucun scope explicite** ;
  - **aucun** `disconnectAndClear` ;
  - `deletionPending` reste prioritaire sur `recoveryPending` ;
  - inscription **iso-comportement** ;
  - flux de **confirmation d'inscription intact** (`AUTH_REDIRECT_URL` et `parseAuthTokensFromUrl` non modifiés) ;
  - aucune chaîne en dur, aucun mot de passe journalisé, aucun secret ajouté.
- [ ] **Step 4 : clôture** — `TODO.md` (US → recette + relecture Damien ; cocher la ligne 🐞 « reset de mot
  de passe » en suivi), `CHANGELOG.md`, **statut roadmap** : ligne **1.6 « Récupération mot de passe »**
  (V0.1) — aujourd'hui ✅ « géré par Supabase Auth », à **compléter en Remarques** (le flux mobile complet
  n'existait pas avant CONF-08) ; push via `/commit`.

---

## Prérequis de déploiement (hors code, avant recette)

1. **Supabase → Authentication → URL Configuration → Redirect URLs** : ajouter
   **`wellness://password-reset`**. `wellness://auth-callback` et le Site URL restent inchangés.
2. Rien d'autre : **aucune migration**, **aucun module natif**, **aucune variable d'environnement**.

> Si la recette échoue avec une page `localhost:3000`, c'est **ce point 1** — pas le code.

## Notes de test

- **Purs testés** (l'essentiel de la logique) : `validatePasswordPair` (Task 1), `resolveRootRoute` +
  `password-recovery` et priorités (Task 2), `parseAuthDeepLink` (Task 3 : récupération, confirmation,
  erreur, jetons incomplets, bruit).
- **Non testables unitairement** : `setSession` / `updateUser` / `signOut(scope)` (I/O Supabase) et le
  deep link réel → couverts par la **recette device** (spec §9).
- **Non-régression à surveiller** : tests existants de `root-route`, de `auth-redirect`
  (`parseAuthTokensFromUrl`) et de l'inscription — tous doivent rester verts **sans être modifiés**.

## Points d'attention

- **Le piège principal** : sans le drapeau + le gate, ajouter `redirectTo` suffirait à **connecter
  l'utilisateur dans l'app sans changer son mot de passe**. C'est la raison d'être des Tasks 2 et 4.
- **Ordre de levée du drapeau** : `recoveryPending = true` **avant** `setSession`. Dans l'autre sens,
  `onAuthStateChange` peut déclencher un rendu où la session existe mais pas le drapeau → redirection
  éclair vers `(tabs)`.
- **⚠️ Nom de route = chemin du deep link** (bug de recette du 25/07) : Expo Router navigue lui-même sur le
  chemin de l'URL reçue. L'écran **doit** donc s'appeler `password-reset.tsx` pour
  `wellness://password-reset`, sinon → écran « Unmatched Route ». Corollaire : la branche `route === 'app'`
  doit offrir une échappatoire depuis `auth-callback` (chemin sans écran), sinon un compte déjà onboardé qui
  clique un lien de confirmation reste bloqué.
- **Bug préexistant repéré, hors périmètre** : le `signOut()` du bouton « Se déconnecter » des Réglages
  utilise lui aussi le scope `global` par défaut → il déconnecte l'utilisateur **de tous ses appareils**.
  Inattendu pour une déconnexion ordinaire. **Ne pas le corriger dans cette US** (changement de
  comportement existant → décision + recette à part) : consigner dans [TODO.md](../../TODO.md) §🐞.
- **Pas de désactivation hors-ligne du bouton** : `useStatus().connected` (PowerSync) n'est pas fiable
  juste après l'ouverture par deep link → on laisse partir l'appel et on mappe l'erreur réseau
  (spec §2.3).
- **Deux contrats d'erreur cohabitent** dans le store : `signInWithGoogle` renvoie une **clé i18n**,
  `signIn`/`signUp`/`completePasswordRecovery` renvoient le **message Supabase brut**. Ne pas les mélanger
  (pas de `t()` sur un message brut).
- **Expo SDK 57** : vérifier `expo-linking` / `expo-router` (`useLocalSearchParams`, `router.replace` avec
  `params`) contre <https://docs.expo.dev/versions/v57.0.0/> avant de coder (consigne
  [AGENTS.md](../../apps/mobile/AGENTS.md)).
