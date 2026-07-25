# US CONF-08 — Réinitialisation du mot de passe (deep link + écran « nouveau mot de passe »)

> Rendre la **récupération de compte réellement utilisable sur mobile** : le lien « mot de passe oublié »
> doit rouvrir l'app (deep link), proposer un **écran de saisie du nouveau mot de passe**, l'enregistrer,
> **révoquer les autres sessions**, puis renvoyer vers la connexion. Aujourd'hui le lien mène à une **page
> morte** `http://localhost:3000` et **aucun écran de nouveau mot de passe n'existe** → un utilisateur qui
> oublie son mot de passe **ne peut pas récupérer son compte**.
> Prolonge le fix livré le 25/07/2026 sur la **confirmation d'inscription**
> ([auth-redirect.ts](../../../../apps/mobile/src/lib/auth-redirect.ts),
> [useAuthDeepLink.ts](../../../../apps/mobile/src/hooks/useAuthDeepLink.ts)) — mêmes briques, flux différent.
> Hors roadmap chiffrée (trou fonctionnel du socle auth V0.1 `1.6`, révélé en recette) — **prérequis bêta**.
> Branche : `fix/reset-mot-de-passe-deeplink` · Date : 25/07/2026 ·
> **Statut : à valider (pas de code avant validation Florian/Damien).**
> **Aucune migration.** 🔧 **Config Supabase requise** : ajouter `wellness://password-reset` aux Redirect URLs.

## 0. Contexte

`resetPassword` existe déjà côté app ([auth-store.ts](../../../../apps/mobile/src/stores/auth-store.ts) :
`supabase.auth.resetPasswordForEmail(email)`) et l'écran
[forgot-password.tsx](<../../../../apps/mobile/src/app/(auth)/forgot-password.tsx>) envoie bien le mail.
Mais la chaîne est **coupée en deux endroits** :

1. **Pas de `redirectTo`** → Supabase redirige vers le **Site URL** du projet (`http://localhost:3000`) →
   page morte sur le téléphone. Exactement le bug corrigé le 25/07 pour la confirmation d'inscription,
   **non traité** pour le reset (noté en suivi séparé dans [TODO.md](../../../../TODO.md) §🐞).
2. **Pas d'écran de saisie du nouveau mot de passe** → même avec la bonne redirection, il n'y a nulle part
   où choisir le nouveau mot de passe.

### Le point dur (à ne pas manquer)

Le lien de récupération Supabase, comme celui de confirmation, renvoie **des jetons de session** dans le
fragment (flux implicite, `detectSessionInUrl: false`). Or `useAuthDeepLink` appelle aujourd'hui
`setSession` **pour tout deep link porteur de jetons**, et `onAuthStateChange` → `resolveRootRoute` conclut
`hasSession → app`.

> **Conséquence si on se contente d'ajouter `redirectTo`** : cliquer sur le lien de reset **connecte
> l'utilisateur et l'envoie dans l'app**, sans jamais lui demander de nouveau mot de passe. L'ancien mot de
> passe reste actif. Le bug devient silencieux au lieu d'être visible.

Il faut donc **distinguer le flux récupération** et **retenir l'utilisateur** sur un écran dédié.

### Contraintes d'architecture (vérifiées dans le code)

- **La session est nécessaire** : `supabase.auth.updateUser({ password })` exige une session active. Le flux
  correct est donc bien « le lien ouvre une session **de récupération** → on change le mot de passe → on
  coupe la session », et non « on change le mot de passe sans être connecté ».
- **Gate de routing** : [root-route.ts](../../../../packages/shared/src/root-route.ts) est un helper **pur et
  testé** qui décide `wait | auth | onboarding | app | deletion-pending`. Le gate
  **`deletion-pending`** (CONF-02) est le **patron exact** à reproduire : un état qui, session ouverte,
  **court-circuite** onboarding/app pour imposer un écran. → on ajoute `password-recovery`.
- **Action serveur → connexion requise** : comme toute action d'authentification, ce flux **n'est pas
  offline-first** (exception assumée, cohérente avec CONF-02 §0).
- **Politique de mot de passe** : `MIN_PASSWORD_LENGTH = 8` est aujourd'hui une constante **locale** à
  [sign-up.tsx](<../../../../apps/mobile/src/app/(auth)/sign-up.tsx>) (l. 16), avec vérification longueur +
  concordance. À **mutualiser** pour que l'inscription et le reset ne divergent pas.

### Décisions de cadrage (arbitrage Florian, 25/07/2026)

- **Après validation : déconnexion + retour à l'écran de connexion** avec message de succès. L'utilisateur
  se reconnecte avec son nouveau mot de passe — ce qui le **valide immédiatement**. (Alternative « rester
  connecté » écartée : on n'aurait jamais vérifié que le nouveau mot de passe fonctionne.)
- **Révocation des autres sessions** : oui. Le cas d'usage réel du reset est « je crains que quelqu'un ait
  accès à mon compte ». Effet de bord assumé : un simple oubli déconnecte aussi les autres appareils de
  l'utilisateur. _Mise en œuvre : un simple `signOut()` suffit — voir §2.4._
- **URL de redirection dédiée `wellness://password-reset`** (et non la réutilisation de
  `wellness://auth-callback`) : le discriminant devient **structurel** (le chemin du deep link) au lieu de
  dépendre d'un paramètre de fragment (`type=recovery`) dont on ne veut pas faire un point de rupture. Coût :
  une ligne à ajouter dans la liste blanche Supabase. `type=recovery`, s'il est présent, sert de **contrôle
  secondaire défensif**, jamais de condition unique.

## 1. Périmètre à livrer

- **Envoi** : `resetPassword` passe `{ redirectTo: PASSWORD_RESET_REDIRECT_URL }`.
- **Réception** : le deep link `wellness://password-reset#access_token=…&refresh_token=…` ouvre une session
  **marquée « récupération »** (drapeau en mémoire), et **ne laisse pas** entrer dans l'app.
- **Écran « Nouveau mot de passe »** (`app/password-reset.tsx`, **nom aligné sur le chemin du deep link** —
  cf. §2.3) : 2 champs (nouveau + confirmation), validation, enregistrement, **Annuler** (déconnexion).
- **Gate de routing** : nouvel état `password-recovery` dans `resolveRootRoute`, prioritaire sur
  onboarding/app, au même niveau que `deletion-pending`.
- **Liens invalides / expirés** : parsing des erreurs du fragment → message explicite + invitation à
  redemander un lien (aujourd'hui : no-op silencieux).
- **Mutualisation** de la règle de mot de passe (longueur + concordance) dans `@wellness/shared`, réutilisée
  par l'inscription **sans changement de comportement**.
- **i18n FR + EN** ; états de chargement et d'erreur ; **connexion requise** (action serveur, jamais offline).

**Hors périmètre (à ne pas implémenter ici) :**

- **Changement de mot de passe depuis les Réglages** (utilisateur déjà connecté, connaissant son mot de
  passe) — besoin distinct, à cadrer séparément si on le veut avant la bêta.
- **SMTP custom Supabase** — le service e-mail intégré est **rate-limité** ; c'est un **prérequis bêta** de
  config, sans code, suivi hors de cette US.
- **Renforcement de la politique de mot de passe** (majuscule/chiffre/entropie, indicateur de robustesse) :
  on **mutualise** la règle existante (≥ 8 caractères), on ne la durcit pas ici.
- **Comptes Google** (CONF-04) : un compte créé via Google n'a pas de mot de passe local à réinitialiser.
  Rien à faire — voir §7 pour le comportement attendu.
- **Page web de repli** quand l'app n'est pas installée (le deep link échoue) — voir §7, accepté en V1.

## 2. Comportement attendu

### 2.1 Demande de lien (écran existant, inchangé côté UX)

- Réglages/Connexion → « Mot de passe oublié ? » → écran existant `forgot-password`.
- Comportement conservé, y compris le message **neutre anti-énumération** déjà en place
  (`auth.forgot.sent` : « **Si un compte existe** pour {{email}}… ») — on ne révèle pas si l'adresse existe.
- **Seul changement** : le mail pointe désormais vers `wellness://password-reset`.
- Bouton **désactivé hors-ligne** + message « nécessite une connexion Internet » (patron `useStatus()`
  déjà utilisé par CONF-02). _Écran existant : comportement inchangé. À ne pas confondre avec l'écran de
  saisie (§2.3), où ce patron n'est **pas** réutilisable._

### 2.2 Retour dans l'app par le lien

- Le lien est cliqué **sur le téléphone** → Android ouvre l'app sur `wellness://password-reset#…`.
- Cas **jetons présents** : on établit la session (`setSession`) **et** on lève un drapeau
  **`recoveryPending`** (en mémoire). Le routing racine part alors sur l'écran **Nouveau mot de passe**,
  quel que soit l'état du profil/onboarding.
- Cas **erreur dans le fragment** (`error=access_denied&error_code=otp_expired`, lien déjà utilisé,
  lien tronqué) : **aucune session** n'est ouverte → l'utilisateur reste sur la connexion, avec un message
  explicite « **Ce lien de réinitialisation a expiré ou a déjà été utilisé.** Demande un nouveau lien. » et
  un accès direct à « Mot de passe oublié ? ».
- Cas **app fermée** (ouverture à froid) **et** **app déjà ouverte** (ouverture à chaud) : mêmes règles —
  `useAuthDeepLink` traite déjà les deux (`getInitialURL` + listener `url`).

### 2.3 Écran « Nouveau mot de passe »

- Deux champs : **nouveau mot de passe** et **confirmation** (`secureTextEntry`,
  `autoComplete="new-password"`, `textContentType="newPassword"`).
- Bouton **« Enregistrer le mot de passe »**. Validations, dans cet ordre, message par cas :
  1. longueur < 8 → « 8 caractères minimum » ;
  2. les deux champs diffèrent → « Les mots de passe ne correspondent pas ».
- Aucun retour arrière implicite : **pas de geste de balayage**, **pas de flèche de header**
  (`gestureEnabled: false`, `headerShown: false` — même traitement que `deletion-pending`). La seule sortie
  est le bouton **« Annuler »**, qui **déconnecte** et renvoie à la connexion.
- **Écran de niveau racine** (`app/password-reset.tsx`, à côté de `deletion-pending.tsx`), **pas** dans le
  groupe `(auth)` : c'est un **écran-gate**, exactement comme `deletion-pending`. Le mettre dans `(auth)`
  ferait entrer en collision son segment avec la branche `route === 'auth'` du routeur racine.
- ⚠️ **Le nom du fichier fait partie du contrat** (constaté en recette du 25/07) : il **doit** correspondre
  au chemin de `PASSWORD_RESET_REDIRECT_URL` (`wellness://password-reset` → `password-reset.tsx`).
  **Expo Router résout le deep link entrant comme un chemin de route et y navigue lui-même** ; si aucune
  route ne correspond, il affiche son écran **« Unmatched Route »**, et cette navigation **gagne la course**
  contre celle du gate. Renommer l'un sans l'autre casse le flux.
- **Corollaire — échappatoire pour les chemins d'atterrissage sans écran** : `wellness://auth-callback`
  (confirmation d'inscription) n'a **pas** d'écran. La branche `route === 'onboarding'` redirige
  inconditionnellement, ce qui masquait le problème pour un **nouveau** compte (cas recetté le 25/07) ;
  mais un compte **déjà onboardé** (`route === 'app'`) restait **bloqué** sur « Unmatched Route ». La
  branche `app` doit donc aussi rediriger depuis ces chemins d'atterrissage.
- Hors-ligne : **on ne désactive pas le bouton**. Le patron `useStatus().connected` de CONF-02 n'est **pas**
  réutilisable ici : l'app vient d'être ouverte par un deep link et la connexion PowerSync n'est pas encore
  établie → `connected` serait `false` à tort et **bloquerait un utilisateur en ligne**. On laisse donc
  l'appel partir et on **mappe l'échec réseau** sur un message clair « nécessite une connexion Internet ».

### 2.4 Enregistrement (séquence, l'ordre compte)

1. `updateUser({ password })` — échec → message d'erreur, **on reste sur l'écran**, session conservée
   (l'utilisateur peut réessayer).
2. `signOut()` — **un seul appel suffit**. Vérifié dans `@supabase/auth-js` (types + doc de
   `GoTrueClient.signOut`) : le **scope par défaut est `global`**, qui révoque les refresh tokens de
   **tous les appareils** *et* efface la session locale (l'événement `SIGNED_OUT` est bien émis — il ne
   l'est pas avec le scope `others`). On obtient donc exactement la décision de cadrage (autres appareils
   révoqués + déconnexion locale) sans enchaîner deux appels ni dépendre d'un ordre fragile.
   **Ne pas** appeler `powerSync.disconnectAndClear()` : c'est le **même utilisateur**, on ne jette ni la
   base locale ni les écritures en attente de synchro. (Contraste avec CONF-02, où la purge est le but.)
3. Retombée sur `(auth)/sign-in` avec un message de succès : « **Mot de passe modifié.** Connecte-toi avec
   ton nouveau mot de passe. »

> ⚠️ **Constat hors périmètre, à traiter séparément** : ce même défaut `global` s'applique au bouton
> **« Se déconnecter »** des Réglages ([auth-store.ts](../../../../apps/mobile/src/stores/auth-store.ts)
> `signOut`), qui déconnecte donc l'utilisateur **de tous ses appareils** — comportement inattendu pour une
> déconnexion ordinaire (la doc `auth-js` le signale elle-même comme surprenant et recommande
> `{ scope: 'local' }`). **CONF-08 n'y touche pas** (ce serait un changement de comportement existant, à
> décider et recetter à part) — voir le suivi ouvert dans [TODO.md](../../../../TODO.md) §🐞.

### 2.5 Règles / garde-fous

- Le drapeau `recoveryPending` est **en mémoire uniquement** (store Zustand), retombé à la déconnexion et
  après un enregistrement réussi.
- **Conséquence assumée et à documenter** : si l'utilisateur **tue l'app** pendant qu'il est sur l'écran
  Nouveau mot de passe, la session (persistée en SecureStore) survit et le lancement suivant l'amène
  **normalement dans l'app**, mot de passe inchangé. C'est **accepté** : il a prouvé qu'il possède
  l'adresse e-mail, donc l'accès n'est pas illégitime ; et rendre le gate persistant risquerait de
  **piéger** un utilisateur hors de son compte. Il pourra relancer un reset.
- Un deep link de récupération reçu **alors qu'une session est déjà ouverte** (utilisateur connecté qui
  clique un vieux lien) : on applique la **même règle** — `setSession` avec les jetons du lien + gate. Le
  lien fait autorité, il est plus récent.

## 3. Modèle de données & migration

**Aucune migration, aucun changement de schéma.** Tout est côté client + config Supabase.

🔧 **Config Supabase (à faire par Florian avant recette)** : Authentication → URL Configuration →
**Redirect URLs** → ajouter `wellness://password-reset`. `wellness://auth-callback` (confirmation) et le
Site URL restent inchangés.

> Sans cette entrée, Supabase **ignore** le `redirectTo` et retombe sur le Site URL → on reproduit
> exactement le bug d'origine. C'est le **premier point à vérifier** si la recette échoue.

## 4. Client mobile

| Fichier | Nature | Rôle |
|---|---|---|
| `packages/shared/src/password.ts` (+ test) | **nouveau, pur** | `MIN_PASSWORD_LENGTH = 8` + `validatePasswordPair(password, confirm)` → `'too-short' \| 'mismatch' \| null`. Réutilisé par l'inscription **et** le reset. |
| `packages/shared/src/root-route.ts` (+ test) | **modifié, pur** | Nouvel état `'password-recovery'`, nouvelle entrée optionnelle `recoveryPending?: boolean`, évaluée **juste après** `deletionPending` (donc avant `profileLoading`/onboarding). Champ optionnel ⇒ **non-régression** des appels existants. |
| `apps/mobile/src/lib/auth-redirect.ts` (+ test) | **modifié, pur** | `PASSWORD_RESET_REDIRECT_URL = 'wellness://password-reset'` ; `parseAuthDeepLink(url)` qui renvoie un objet discriminé : `{ kind: 'tokens', tokens, isRecovery }`, `{ kind: 'error', code }` ou `null`. `parseAuthTokensFromUrl` **conservée** (utilisée par la confirmation, déjà recettée). |
| `apps/mobile/src/stores/auth-store.ts` | modifié | `resetPassword` → `{ redirectTo: PASSWORD_RESET_REDIRECT_URL }` ; nouvelle action `completePasswordRecovery(password)` (séquence §2.4) ; drapeau `recoveryPending` + `clearRecovery()`. |
| `apps/mobile/src/hooks/useAuthDeepLink.ts` | modifié | Route selon le `kind` : `tokens` → `setSession` (+ `recoveryPending = true` si récupération) ; `error` → expose le code d'erreur pour l'écran de connexion ; `null` → no-op (inchangé). |
| `apps/mobile/src/app/password-reset.tsx` | **nouveau** | Écran §2.3 **de niveau racine** (nom aligné sur le chemin du deep link — cf. §2.3) (à côté de `deletion-pending.tsx`), sur `FormScreen` + `TextField` + `Button` + `ScreenHeader` (composants existants). |
| `apps/mobile/src/app/_layout.tsx` | modifié | Passe `recoveryPending` à `resolveRootRoute` ; branche `route === 'password-recovery'` → `router.replace('/password-reset')` (patron `deletion-pending`, l. 181-186) ; déclaration `Stack.Screen` avec `headerShown: false, gestureEnabled: false`. |
| `apps/mobile/src/app/(auth)/sign-in.tsx` | modifié | Affiche le message de succès après reset **et** le message d'erreur « lien expiré » (§2.2). |
| `apps/mobile/src/app/(auth)/sign-up.tsx` | modifié | Bascule sur `validatePasswordPair` — **iso-comportement**, constante locale supprimée. |

**Découpage attendu** (bonnes pratiques : logique pure testée / I-O isolée / composant contrôlé) : le
parsing du deep link et la règle de mot de passe sont **purs et testés** ; les appels Supabase restent dans
le store ; l'écran ne fait que de l'affichage et de la saisie.

⚠️ **Expo SDK 57** : `expo-linking` et `expo-router` sont déjà en place (aucun module natif ajouté → **pas
de nouveau dev build nécessaire**). Vérifier les API contre la doc versionnée
<https://docs.expo.dev/versions/v57.0.0/> au moment du plan (consigne [AGENTS.md](../../../../apps/mobile/AGENTS.md)).

## 5. i18n (FR + EN)

Nouveau bloc `auth.newPassword.*` : `title`, `subtitle`, `field`, `confirmField`, `cta`, `cancel`,
`tooShort` (avec `{{count}}`), `mismatch`, `updateFailed`, `offline`.
Ajouts dans `auth.signIn.*` : `passwordResetSuccess`, `resetLinkExpired`.
**Parité FR/EN obligatoire**, aucune chaîne en dur. Les clés `auth.signUp.passwordTooShort` /
`passwordMismatch` existantes sont **conservées** (réutilisées via le helper mutualisé) pour ne pas casser
l'inscription.

## 6. Sécurité

- **Anti-énumération** : le message de `forgot-password` reste **neutre** (§2.1) — inchangé.
- **Révocation des autres sessions** activée (arbitrage §0) → un accès frauduleux concomitant est coupé.
- Le mot de passe n'est **jamais** journalisé ; les `console.warn` se limitent aux messages d'erreur
  Supabase (patron `[auth]` existant).
- Aucun secret ajouté : `wellness://password-reset` est une URL de scheme public, versionnable.
- La session de récupération est une session Supabase **standard** : sa durée de vie et son renouvellement
  ne sont pas modifiés.

## 7. Cas limites

| Cas | Comportement attendu |
|---|---|
| Lien **expiré** ou **déjà utilisé** | Pas de session ; retour connexion + « lien expiré ou déjà utilisé, demande un nouveau lien » (§2.2). |
| Lien ouvert sur un **autre appareil** (PC) | Le navigateur ne sait pas ouvrir `wellness://` → page d'erreur du navigateur. **Accepté en V1** (la page web de repli est hors périmètre). À signaler dans le mail/FAQ si Florian le souhaite. |
| **App non installée** sur le téléphone | Idem : le scheme n'est pas résolu. Accepté (cas marginal : on vient de demander le reset **depuis** l'app). |
| Nouveau mot de passe **identique à l'ancien** | Supabase peut le refuser selon la config du projet → le message d'erreur remonté est affiché tel quel, l'utilisateur reste sur l'écran. Ne pas ajouter de règle maison. |
| **Hors-ligne** sur l'écran Nouveau mot de passe | L'appel part et échoue → message « nécessite une connexion Internet », on reste sur l'écran, réessai possible. Le mot de passe n'est **jamais** mis en file d'attente (action serveur, jamais offline). Bouton **non** désactivé (voir §2.3). |
| Compte créé **via Google** (CONF-04) | `resetPasswordForEmail` n'envoie rien d'utile (pas de mot de passe local). Message neutre inchangé ; **ne pas** essayer de détecter le provider (fuite d'information). Documenté en FAQ (US 1.22) plutôt qu'en code. |
| Utilisateur **banni** (8.8b) | Le gate de bannissement reste prioritaire côté serveur ; le reset n'est pas un contournement (le mot de passe change, l'accès reste refusé). |
| Suppression de compte **en attente** (CONF-02) | `deletionPending` reste évalué **avant** `recoveryPending` : la gate de suppression garde la priorité (elle offre l'annulation, qui est l'action utile). |
| Double tap sur « Enregistrer » | Bouton en état `loading` (patron existant) → un seul appel. |

## 8. Definition of Done

- [ ] `resetPassword` envoie `redirectTo` ; le mail ouvre l'app sur `wellness://password-reset`.
- [ ] Un lien de récupération **ne fait jamais entrer dans l'app** sans passage par l'écran de saisie.
- [ ] Écran Nouveau mot de passe : validations, erreurs, Annuler, désactivation hors-ligne.
- [ ] Séquence §2.4 respectée dans l'ordre (`updateUser` → `signOut(others)` → `signOut`), échec de la
      révocation **non bloquant**.
- [ ] `resolveRootRoute` : état `password-recovery` testé, `deletionPending` prioritaire, **non-régression**
      des cas existants (champ optionnel).
- [ ] Helpers **purs testés** : `parseAuthDeepLink` (jetons / récupération / erreur / bruit) et
      `validatePasswordPair`.
- [ ] Inscription **iso-comportement** après mutualisation de la règle de mot de passe.
- [ ] i18n FR + EN à parité, aucune chaîne en dur.
- [ ] `npm run typecheck` + `npm run lint` + `npm test` verts (shared **et** mobile).
- [ ] Aucune migration ; **aucun nouveau module natif** (pas de rebuild).
- [ ] PR relue par les deux devs.

## 9. Critères d'acceptation (recette device)

> Prérequis : `wellness://password-reset` ajouté aux Redirect URLs Supabase (§3).

1. **Chemin nominal** — « Mot de passe oublié ? » → mail reçu → clic **depuis le téléphone** → l'app
   s'ouvre sur **Nouveau mot de passe** (et **pas** sur le dashboard) → saisie de deux mots de passe
   identiques ≥ 8 → succès → retour connexion avec le message → **connexion réussie avec le nouveau mot de
   passe**, et **échec avec l'ancien**.
2. **Révocation** — un **2ᵉ appareil** (ou une 2ᵉ install) connecté au même compte est **déconnecté** après
   le changement (au plus tard au renouvellement du jeton).
3. **Validations** — mot de passe de 7 caractères → « 8 caractères minimum » ; deux champs différents →
   « ne correspondent pas » ; aucun appel réseau dans les deux cas.
4. **Annuler** — le bouton renvoie à la connexion, **l'ancien mot de passe fonctionne toujours**.
5. **Lien expiré** — attendre l'expiration (ou réutiliser un lien déjà consommé) → message « lien expiré ou
   déjà utilisé », **pas** d'écran Nouveau mot de passe, pas d'entrée dans l'app.
6. **App fermée vs ouverte** — le scénario 1 fonctionne dans les deux cas (app tuée / app en arrière-plan).
7. **Hors-ligne** — en mode avion sur l'écran Nouveau mot de passe : bouton désactivé + message ; retour du
   réseau → l'enregistrement fonctionne.
8. **Non-régression confirmation d'inscription** — le flux du 25/07 (`wellness://auth-callback`) fonctionne
   **toujours** : nouveau compte → clic du lien → app rouverte, connecté.
9. **Non-régression inscription** — création de compte avec mot de passe court / non concordant : mêmes
   messages qu'avant.
