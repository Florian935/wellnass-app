# US CONF-02 — Suppression du compte (RGPD, exigé par les stores)

> Permettre à l'utilisateur de **supprimer définitivement son compte et toutes ses données** depuis
> l'app, avec **double confirmation** (avertissement + **ré-authentification par mot de passe**) et un
> **délai de grâce de 30 jours** (récupérable en se reconnectant), au terme duquel un **purge serveur**
> efface tout. Obligation **RGPD** (droit à l'effacement) et **exigence des stores** (Google Play).
> Roadmap [1.19](../../../roadmap/roadmap.md). Réutilise le patron RPC `SECURITY DEFINER` de
> [`ban_user`](../../../../supabase/migrations/20260716150753_user_bans.sql).
> Branche : `feature/conf02-suppression-compte` · Date : 23/07/2026 ·
> **Statut : à valider (pas de code avant validation Florian/Damien).**
> **🔴 Migration cloud requise** (table `account_deletion_requests`, RPC, extension `pg_cron` + job).

## 0. Contexte

Aujourd'hui, les Réglags ([settings.tsx](../../../../apps/mobile/src/app/settings.tsx)) n'offrent que la
**déconnexion** (`signOut`). Il n'existe aucun moyen de supprimer son compte — ce qui **bloque la
publication Play Store** (politique « suppression de compte ») et viole le **droit à l'effacement RGPD**.

Contraintes d'architecture (vérifiées) :
- Le client mobile utilise la **clé anon** : supprimer un compte `auth.users` exige un droit serveur. On
  reproduit le patron `ban_user` : **RPC `SECURITY DEFINER`** (propriétaire postgres) qui touche `auth.users`.
- **Toutes les tables de données utilisateur** référencent `auth.users(id) **ON DELETE CASCADE**` →
  supprimer la ligne `auth.users` **purge automatiquement toutes les données** (workouts, runs, nutrition,
  profils, records, contenu perso `owner_id`…). Aucune purge table-par-table à écrire. Le contenu
  **éditorial** (`owner_id` NULL) n'appartient pas à l'utilisateur → **non supprimé**.
- Action **serveur → connexion requise** : la suppression n'est **pas** offline-first (exception assumée,
  comme toute action d'authentification).

Décisions de cadrage (brainstorming Florian, 23/07/2026) :
- **Délai de grâce 30 j récupérable** : à la confirmation, verrouillage immédiat (déconnexion + purge locale)
  et purge serveur programmée à **J+30** ; se reconnecter pendant la fenêtre propose **d'annuler**.
- **Double confirmation = avertissement + ré-authentification par mot de passe** (bloque une suppression sur
  téléphone déverrouillé laissé sans surveillance ; tous les comptes V1 sont email+mot de passe).
- **Purge = hard delete** via cascade FK (droit à l'effacement) ; **pas** d'anonymisation.
- **Planificateur du purge = `pg_cron`** (job SQL quotidien), pas d'Edge Function.
- **Verrou applicatif, pas ban GoTrue** : on **n'utilise pas** `banned_until` (il bloquerait la reconnexion,
  donc l'annulation). Le verrou pendant la grâce est un **gate côté app**.

## 1. Périmètre à livrer

- **Serveur** : table `account_deletion_requests` + RPC `request_account_deletion()` /
  `cancel_account_deletion()` (`SECURITY DEFINER`) + extension `pg_cron` et **job quotidien de purge**.
- **Client — déclenchement** : zone « Danger » dans les Réglages → flux de suppression (avertissement →
  ré-auth mot de passe → confirmation → RPC → déconnexion + purge locale).
- **Client — récupération** : à la reconnexion pendant la grâce, **écran-gate** bloquant proposant
  d'**annuler** la suppression ou de **se déconnecter**.
- **i18n** FR/EN ; états d'erreur ; connexion requise (désactivé hors-ligne).

**Hors périmètre (à ne pas implémenter ici) :**
- **Export des données** avant suppression (CONF-01, US séparée) — le flux **mentionnera** l'export quand
  CONF-01 existera, sans le bloquer.
- **OAuth Google** (CONF-04, non livré) — la ré-auth par mot de passe couvre tous les comptes V1.
- **RevenueCat / abonnements** — entitlements inactifs en V1, rien à résilier (à traiter quand la
  monétisation sera activée).
- Suppression déclenchée **hors app** (page web RGPD) — la suppression in-app suffit à Google Play ;
  documentation store hors périmètre code.

## 2. Comportement attendu

### 2.1 Déclenchement (Réglages → Danger)
- Une section **« Zone de danger »** en bas des Réglages, visuellement distincte, avec un bouton
  **« Supprimer mon compte »** (accent rouge/destructif).
- Le bouton est **désactivé hors-ligne** (via `useStatus().connected`, déjà utilisé par `SyncStatus`) +
  message « nécessite une connexion Internet ».
- Tap → **écran/feuille d'avertissement** : explique que l'action est **irréversible**, **ce qui sera
  supprimé** (toutes les données des 3 piliers, profils, historiques, contenu perso), le **délai de 30 j**
  et la **date d'échéance**, et invite à **exporter ses données au préalable** (mention ; actif quand
  CONF-01 existera).
- Poursuivre → **ré-authentification** : saisie du **mot de passe** (l'e-mail du compte est connu). Vérif
  via une ré-connexion silencieuse (`signInWithPassword` sur l'e-mail courant). Mauvais mot de passe →
  message d'erreur, **aucune** suppression.
- Succès → appel **`request_account_deletion()`** → **déconnexion** + **purge de la base locale**
  (SQLite PowerSync + secureStorage) → écran de confirmation « Suppression programmée le **JJ/MM/AAAA** —
  reconnecte-toi avant cette date pour annuler ».

### 2.2 Fenêtre de récupération (reconnexion pendant la grâce)
- La connexion **reste possible** pendant les 30 j (aucun `banned_until`).
- Au démarrage/à la connexion, l'app **vérifie s'il existe une demande `pending`** pour l'utilisateur
  (lecture directe autorisée par RLS `select` sur `account_deletion_requests`).
- Si oui → **écran-gate bloquant** (l'accès normal à l'app est **empêché**) : « Ton compte sera supprimé le
  **JJ/MM/AAAA** » + **[Annuler la suppression]** et **[Se déconnecter]**.
- **Annuler** → `cancel_account_deletion()` → la demande passe `cancelled` → **accès normal restauré**,
  **données intactes** (rien n'a été supprimé pendant la grâce).
- Se déconnecter → retour à l'écran de connexion (la demande reste `pending`).

### 2.3 Purge serveur (J+30)
- Un **job `pg_cron` quotidien** supprime les comptes dont la demande est **échue** :
  `delete from auth.users where id in (select user_id from account_deletion_requests where status = 'pending' and scheduled_at <= now())` → **cascade FK = purge totale** (données + lignes `auth.*`).
- Après purge, le compte n'existe plus : toute connexion échoue (traité comme compte inexistant).

### 2.4 Règles / garde-fous
- `request_account_deletion()` : agit sur `auth.uid()` (jamais un autre compte) ; si une demande `pending`
  existe déjà, **ne pas dupliquer** (renvoyer la demande existante / no-op idempotent).
- `cancel_account_deletion()` : n'annule qu'une demande `pending` de `auth.uid()` **non échue**
  (`scheduled_at > now()`) — après l'échéance, le cron **a priorité** (annulation refusée).
- RPC réservées à `authenticated` (revoke `public`/`anon`), comme `ban_user`.
- La table est écrite **uniquement** par les RPC (definer) ; le client anon n'a que le `select` de sa propre
  ligne (RLS `user_id = auth.uid()`).

## 3. Modèle de données & migration

Nouvelle migration (cycle CLAUDE.md `db:new` → `db:push:dry` → `db:push` → `db:types` → `MIGRATIONS.md`) :

```sql
create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'cancelled')),
  requested_at timestamptz not null default now(),
  scheduled_at timestamptz not null,
  cancelled_at timestamptz
);
-- Au plus une demande pending par utilisateur (idempotence + gate).
create unique index account_deletion_pending_uniq
  on public.account_deletion_requests (user_id) where status = 'pending';

alter table public.account_deletion_requests enable row level security;
-- L'utilisateur lit uniquement SA demande (pour le gate). Aucune policy write → seules les RPC écrivent.
create policy adr_select_own on public.account_deletion_requests
  for select using (user_id = auth.uid());
```

- **RPC** `request_account_deletion()` / `cancel_account_deletion()` : `SECURITY DEFINER`, `set search_path
  = public`, revoke `public`/`anon` + grant `authenticated` (patron `ban_user`). `request_…` idempotente
  (`insert … on conflict do nothing` sur l'index unique partiel, ou `if exists` en tête).
- **🔴 Correctif FK préalable (bloquant purge)** : `user_bans.acted_by` référence `auth.users(id)` **sans
  `on delete`** ([user_bans.sql:16](../../../../supabase/migrations/20260716150753_user_bans.sql#L16)).
  Supprimer un compte **admin ayant banni** violerait cette FK. Migration : passer `acted_by` en
  **`on delete set null`** (`alter table public.user_bans drop constraint <fk> , add constraint … references
  auth.users(id) on delete set null`).
- **Purge résilient par ligne (obligatoire)** : ne **PAS** purger par un `delete … where id in (…)`
  ensembliste (une seule ligne fautive ferait échouer **tout** le lot → plus aucun compte purgé, silencieux).
  Créer une fonction `purge_expired_accounts()` (`SECURITY DEFINER`, propriétaire postgres) qui **boucle
  par utilisateur échu** et supprime **chaque** `auth.users` dans un bloc `begin … exception when others
  then … end` (log + continue) → une suppression fautive n'empêche pas les autres. Robuste face à toute FK
  non-cascade future.
- **pg_cron** : `create extension if not exists pg_cron;` + `select cron.schedule('purge-deleted-accounts',
  '0 3 * * *', $$ select public.purge_expired_accounts(); $$);` (03:00 UTC, à confirmer). ⚠️ **À vérifier au
  push** : disponibilité/activation de `pg_cron` sur le projet cloud `nsxzflxsgovriwwvflxe` ; si l'activation
  via migration échoue (droit réservé), l'activer une fois dans le dashboard (Database → Extensions) puis
  re-pousser le `cron.schedule`. Le job tourne avec les droits du rôle cron (propriétaire) — la fonction
  `SECURITY DEFINER` garantit les droits de suppression sur `auth.users`.
- **PowerSync** : `account_deletion_requests` n'a **pas** besoin d'être synchronisée par PowerSync (lecture
  ponctuelle via le client Supabase suffit pour le gate) → **pas** ajoutée au schéma PowerSync ni aux sync
  rules. (À confirmer en plan : lecture via `supabase.from(...)` plutôt que requête SQLite locale.)
- `db:types` régénère `database.types.ts`.

## 4. Client mobile

- **`auth-store`** : ajouter `requestAccountDeletion()` (RPC → **purge locale** → `signOut`) et
  `cancelAccountDeletion()` ; helper de **ré-auth** par `signInWithPassword({ email: session.user.email,
  password })`. NB : `reauthenticate()` **ne convient pas** (envoie un OTP, ne vérifie pas un mot de passe).
  Effet de bord à connaître : un `signInWithPassword` réussi réémet des tokens (`onAuthStateChange`) — bénin
  car on enchaîne immédiatement RPC + purge + signOut ; un échec (mauvais mdp) **n'invalide pas** la session
  (→ aucune suppression, conforme §7).
- **Détection du gate** : au démarrage (après résolution de session), interroger
  `supabase.from('account_deletion_requests').select()` (status `pending`, RLS `user_id = auth.uid()` — table
  hors PowerSync, lecture réseau ponctuelle). Alimente le routage : étendre la fonction pure
  [`resolveRootRoute`](../../../../packages/shared/src/root-route.ts) avec `deletionCheckLoading` +
  `deletionPending` et une route `'deletion-pending'` **prioritaire sur `onboarding` et `app`** (un compte en
  suppression, même onboarding non fini, voit le gate). Tant que le check n'a pas répondu → route d'attente
  (garder le splash, éviter le flash de l'app). **Hors-ligne au démarrage** : le check échoue → **fail-open**
  (laisser entrer ; le gate s'appliquera au prochain démarrage en ligne) — cohérent avec « suppression non
  offline-first ».
- **Purge locale** : à la déconnexion de suppression, appeler **`powerSync.disconnectAndClear()`** (efface la
  SQLite locale `wellness.db` + l'état de sync) **avant** le `signOut`/reset navigation. Réservé au **chemin
  suppression** (ne pas généraliser à tout `signOut`, pour ne pas jeter d'écritures non synchronisées d'une
  déconnexion ordinaire). Les clés d'auth de `secureStorage` sont déjà purgées par `supabase.auth.signOut()`.
- **Compte purgé à distance** (device resté connecté jusqu'à J+30) : au prochain refresh, le token échoue
  (utilisateur supprimé) → prévoir un **`signOut` gracieux** sur erreur d'auth irrécupérable (évite un état
  bloqué / sync en erreur).
- **Écrans** : section Danger (Réglages), feuille d'avertissement + ré-auth, écran-gate de récupération.

## 5. i18n (FR + EN)

Nouvelles clés (namespaces indicatifs) : `settings.dangerZone.*` (titre, bouton, offline),
`account.delete.*` (avertissement, ce qui sera supprimé, délai, ré-auth, erreurs, confirmation programmée),
`account.deletePending.*` (gate : titre, date, annuler, se déconnecter). Aucune chaîne en dur ; parité stricte.

Exemples FR→EN : « Supprimer mon compte » → « Delete my account » ; « Zone de danger » → « Danger zone » ;
« Suppression programmée le {{date}} » → « Deletion scheduled for {{date}} » ; « Annuler la suppression » →
« Cancel deletion ».

## 6. Sécurité & RGPD

- Ré-authentification obligatoire avant déclenchement (preuve d'identité).
- RPC scopées `auth.uid()` (impossible de supprimer/annuler le compte d'autrui) ; écriture table réservée aux
  RPC definer ; `select` RLS limité à sa propre ligne.
- **Hard delete** effectif à J+30 (droit à l'effacement) ; aucune donnée conservée après purge.
- Pendant la grâce : la session reste techniquement valide (verrou applicatif) → la sync PowerSync peut
  continuer, mais c'est **le compte de l'utilisateur** et **récupérable** ; documenté et assumé.

## 7. Cas limites

- **Hors-ligne** au déclenchement → bouton désactivé + message (pas d'appel).
- **Mot de passe erroné** → erreur, pas de suppression.
- **Demande déjà pending** → pas de doublon (index unique + RPC idempotente).
- **Annulation après échéance** (`scheduled_at <= now()`) → refusée (le cron purge).
- **Reconnexion après purge** (J+31, compte supprimé) → échec de connexion normal (compte inexistant).
- **`pg_cron` indisponible** → escalade humaine (activer l'extension dans le dashboard) ; sans job, la table
  se remplit mais rien n'est purgé → **bloquant conformité**, à traiter au push.

## 8. Definition of Done

- Migration appliquée cloud (table + correctif FK `acted_by` + RPC + `purge_expired_accounts()` +
  pg_cron/job) + `db:types` + **`MIGRATIONS.md` coché** ; job de purge **vérifié planifié**
  (`select * from cron.job`).
- Flux de suppression complet (Danger → avertissement → ré-auth → RPC → déconnexion + purge locale).
- Gate de récupération fonctionnel (annuler / se déconnecter) ; accès restauré après annulation.
- i18n FR/EN complète ; `typecheck` + `lint` + tests (shared le cas échéant + smoke mobile) verts.
- Maquette (design/) validée Florian/Damien avant code.

## 9. Critères d'acceptation (recette)

1. **Déclenchement** : Réglages → Zone de danger → « Supprimer mon compte » → avertissement clair (irréversible,
   contenu, délai + date) → ré-auth mot de passe → confirmation → déconnecté, message « programmée le JJ/MM ».
2. **Mot de passe faux** → erreur, **rien n'est supprimé** (revenir dans l'app avec un autre compte le prouve).
3. **Récupération** : se reconnecter avec le compte en suppression → **écran-gate** (pas d'accès à l'app) →
   « Annuler la suppression » → accès normal **restauré**, **données intactes**.
4. **Se déconnecter depuis le gate** → retour connexion ; en se reconnectant, le gate réapparaît (demande toujours pending).
5. **Hors-ligne** → bouton « Supprimer mon compte » désactivé + message.
6. **Purge J+30** (vérif technique : compte de test **avec un exercice perso utilisé dans un workout** — couvre
   la FK `workout_sets.exercise_id` NO ACTION ; forcer `scheduled_at` dans le passé, lancer
   `purge_expired_accounts()`) → `auth.users` supprimé + **toutes les tables du user vidées** (cascade), le
   contenu **éditorial intact** ; la connexion de ce compte échoue ensuite. Vérifier aussi qu'un **compte
   admin ayant banni** se purge sans geler le lot (FK `acted_by` → `set null`).
7. **i18n** : tout le flux traduit en anglais.
