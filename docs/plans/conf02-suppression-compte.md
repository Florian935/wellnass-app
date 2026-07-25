# CONF-02 — Suppression du compte — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans. Steps en cases `- [ ]`.
> ⚠️ **Workflow projet** : ne PAS exécuter avant validation des 3 livrables (spec ✅ + plan + maquette).
> **Task 1 = checkpoint cloud 🔴** (migration + `pg_cron`, geste dashboard possible) : go explicite Florian/Damien.

**Goal :** permettre la suppression définitive du compte + données (RGPD), avec double confirmation, délai de
grâce 30 j récupérable, et purge serveur planifiée.

**Architecture :** RPC `SECURITY DEFINER` (patron `ban_user`) + table `account_deletion_requests` + purge
résiliente par ligne planifiée par `pg_cron` (la cascade FK `on delete cascade` sur `auth.users` purge toutes
les données). Côté client : zone Danger (Réglages) → ré-auth mot de passe → RPC + `disconnectAndClear` +
`signOut` ; **gate de récupération** au routage racine (extension de `resolveRootRoute`, prioritaire sur
onboarding), interrogeant la table hors-PowerSync via le client Supabase.

**Tech stack :** Supabase (SQL, RPC, RLS, pg_cron), TypeScript, Zustand (`auth-store`), PowerSync
(`disconnectAndClear`), Expo Router, i18next, Vitest (`resolveRootRoute`) + jest-expo.

**Spec :** [docs/specs/functional/us/conf02-suppression-compte.md](../specs/functional/us/conf02-suppression-compte.md)

---

## Structure des fichiers

**Créer :**
- `supabase/migrations/<horodaté>_conf02_account_deletion.sql` — table + FK fix + RPC + purge + pg_cron.
- `apps/mobile/src/data/repositories/account-deletion-repository.ts` — accès table (query pending) + wrappers RPC.
- `apps/mobile/src/app/account-delete.tsx` — écran flux suppression (avertissement + ré-auth).
- `apps/mobile/src/app/deletion-pending.tsx` — écran-gate de récupération.

**Modifier :**
- `packages/shared/src/root-route.ts` (+ `root-route.test.ts`) — route `'deletion-pending'`.
- `apps/mobile/src/stores/auth-store.ts` — `requestAccountDeletion`, `cancelAccountDeletion`, `reauthenticate`.
- `apps/mobile/src/app/_layout.tsx` — hook de détection + gate + Stack.Screen + signOut gracieux.
- `apps/mobile/src/app/settings.tsx` — zone « Danger » + bouton (désactivé hors-ligne).
- `apps/mobile/src/i18n/locales/fr.json` + `en.json`.
- `supabase/MIGRATIONS.md`.

---

## Task 1 : Migration serveur (table + FK fix + RPC + purge + pg_cron) 🔴

**Files:** `supabase/migrations/<horodaté>_conf02_account_deletion.sql`, `supabase/MIGRATIONS.md`, `packages/shared/src/database.types.ts` (généré)

- [ ] **Step 1 : créer la migration** — `npm run db:new conf02_account_deletion`, puis écrire :

```sql
-- CONF-02 — Suppression de compte (RGPD). Table de demandes + RPC + purge pg_cron.

-- 1. Correctif FK bloquant : user_bans.acted_by doit se dénuller quand l'acteur est supprimé
--    (sinon supprimer un compte admin ayant banni viole la FK et gèle la purge). Vérifier le nom
--    réel de la contrainte (\d public.user_bans) — auto-nommée user_bans_acted_by_fkey a priori.
alter table public.user_bans drop constraint user_bans_acted_by_fkey;
alter table public.user_bans
  add constraint user_bans_acted_by_fkey foreign key (acted_by)
  references auth.users (id) on delete set null;

-- 2. Table des demandes de suppression (au plus une pending par user).
create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'cancelled')),
  requested_at timestamptz not null default now(),
  scheduled_at timestamptz not null,
  cancelled_at timestamptz
);
create unique index account_deletion_pending_uniq
  on public.account_deletion_requests (user_id) where status = 'pending';

alter table public.account_deletion_requests enable row level security;
create policy adr_select_own on public.account_deletion_requests
  for select using (user_id = auth.uid());

-- 3. RPC : demander la suppression (idempotent, race-safe) → renvoie la date d'échéance.
create or replace function public.request_account_deletion()
  returns timestamptz language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); sched timestamptz;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  -- on conflict sur l'index partiel (user_id) where status='pending' → pas de doublon même en
  -- appels concurrents (pas d'exception remontée, contrairement à un select+insert).
  insert into public.account_deletion_requests (user_id, scheduled_at)
    values (uid, now() + interval '30 days')
    on conflict (user_id) where status = 'pending' do nothing;
  select scheduled_at into sched from public.account_deletion_requests
    where user_id = uid and status = 'pending';                 -- échéance (nouvelle ou préexistante)
  return sched;
end; $$;

-- 4. RPC : annuler (seulement une demande pending NON échue ; sinon le cron a priorité).
create or replace function public.cancel_account_deletion()
  returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'non authentifié'; end if;
  update public.account_deletion_requests
    set status = 'cancelled', cancelled_at = now()
    where user_id = uid and status = 'pending' and scheduled_at > now();
end; $$;

-- 5. Purge RÉSILIENTE PAR LIGNE (une suppression fautive n'empêche pas les autres).
create or replace function public.purge_expired_accounts()
  returns integer language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select user_id from public.account_deletion_requests
           where status = 'pending' and scheduled_at <= now() loop
    begin
      delete from auth.users where id = r.user_id;   -- cascade FK = purge totale
      n := n + 1;
    exception when others then
      raise warning 'purge compte % échouée : %', r.user_id, sqlerrm;
    end;
  end loop;
  return n;
end; $$;

-- 6. Privilèges (patron ban_user) : RPC user réservées à authenticated ; purge jamais exposée.
revoke execute on function public.request_account_deletion() from public, anon;
revoke execute on function public.cancel_account_deletion() from public, anon;
revoke execute on function public.purge_expired_accounts() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;

-- 7. Planification quotidienne (03:00 UTC).
create extension if not exists pg_cron;
select cron.schedule('purge-deleted-accounts', '0 3 * * *',
  $$ select public.purge_expired_accounts(); $$);
```

- [ ] **Step 2 : prévisualiser** — `npm run db:push:dry`.
- [ ] **Step 3 : 🔴 CHECKPOINT go Florian/Damien puis pousser** — `npm run db:push`. **Si `create extension
  pg_cron` échoue** (droit réservé) : l'activer dans le dashboard Supabase (Database → Extensions → `pg_cron`),
  retirer temporairement la ligne `create extension` de la migration si besoin, re-pousser. Vérifier le nom
  réel de la contrainte FK (`user_bans_acted_by_fkey`) avant push ; corriger si différent.
- [ ] **Step 4 : vérifier le job** — `select * from cron.job;` (SQL editor) → `purge-deleted-accounts` présent.
- [ ] **Step 5 : régénérer les types** — `npm run db:types`.
- [ ] **Step 6 : cocher** `supabase/MIGRATIONS.md` (+ note pg_cron).
- [ ] **Step 7 : commit** `git add supabase/migrations … packages/shared/src/database.types.ts supabase/MIGRATIONS.md && git commit -m "feat(conf02): migration suppression compte (table + RPC + purge pg_cron + fix FK acted_by)"`

> **Pas de schéma PowerSync** : `account_deletion_requests` reste hors-sync (lecture ponctuelle via le client Supabase).

---

## Task 2 : Route de gate `resolveRootRoute` (shared, pure)

**Files:** `packages/shared/src/root-route.ts`, `packages/shared/src/root-route.test.ts`

- [ ] **Step 1 : écrire les tests qui échouent** (append à `root-route.test.ts`) :

```ts
it('compte en suppression → deletion-pending, prioritaire sur onboarding', () => {
  expect(resolveRootRoute({
    fontsReady: true, authInitializing: false, hasSession: true,
    profileLoading: false, hasProfile: false, onboardingCompletedAt: null,
    settingsLoading: false, hasSynced: true,
    deletionCheckLoading: false, deletionPending: true,
  })).toBe('deletion-pending');
});
it('check suppression en cours (en ligne) → wait', () => {
  expect(resolveRootRoute({ /* …session ok… */ deletionCheckLoading: true, deletionPending: false /* +champs */ })).toBe('wait');
});
it('pas de demande → route normale (onboarding/app inchangés)', () => {
  expect(resolveRootRoute({ /* …onboarding fini… */ deletionCheckLoading: false, deletionPending: false })).toBe('app');
});
```

- [ ] **Step 2 : lancer → échec** `npm run test -w @wellness/shared`.

- [ ] **Step 3 : implémenter** — ajouter au type `RootRoute` la valeur `'deletion-pending'` ; ajouter **deux
  entrées d'input OPTIONNELLES** `deletionCheckLoading?: boolean` et `deletionPending?: boolean`. ⚠️
  **Obligatoirement optionnelles** : sinon les 8 appels du test existant + l'appel de `_layout.tsx:77`
  (pas encore mis à jour avant Task 5) manqueraient les champs → `npm run typecheck` **rouge** sur toute la
  fenêtre Task 2→5. Optionnelles = falsy par défaut, logique inerte tant que non branchée.
  Insérer la logique **juste après** `if (!hasSession) return 'auth';` (donc **avant** la garde anti-race
  `!hasProfile && !hasSynced` et l'onboarding — strictement prioritaire) :

```ts
  // Gate suppression de compte (CONF-02), prioritaire sur onboarding/app.
  // deletionCheckLoading = le check réseau ponctuel n'a pas répondu (fail-open géré côté contrôleur :
  // hors-ligne, il passera à false sans pending). Placé avant la garde anti-race pour que le gate
  // s'affiche même sur une réinstallation d'un compte en suppression.
  if (deletionCheckLoading) return 'wait';
  if (deletionPending) return 'deletion-pending';
```

- [ ] **Step 3bis : ne PAS toucher `base` du test** — grâce aux champs optionnels, les 8 tests existants
  compilent et passent sans modification. Les 3 nouveaux tests fournissent explicitement les 2 champs.

- [ ] **Step 4 : lancer → succès** + `npm run typecheck`.
- [ ] **Step 5 : commit** `feat(conf02): route deletion-pending dans resolveRootRoute (shared)`

---

## Task 3 : Repository d'accès (query + RPC)

**Files:** `apps/mobile/src/data/repositories/account-deletion-repository.ts`

- [ ] **Step 1 : implémenter** (client Supabase, table hors-PowerSync) :

```ts
import { supabase } from '@/lib/supabase';

/** Demande pending de l'utilisateur courant, ou null. Lecture réseau (RLS user_id=auth.uid()). */
export async function fetchPendingDeletion(): Promise<{ scheduledAt: string } | null> {
  const { data, error } = await supabase
    .from('account_deletion_requests')
    .select('scheduled_at')
    .eq('status', 'pending')
    .maybeSingle();
  if (error) throw error;
  return data ? { scheduledAt: data.scheduled_at } : null;
}

/** Programme la suppression → renvoie la date d'échéance (ISO). */
export async function requestAccountDeletion(): Promise<string> {
  const { data, error } = await supabase.rpc('request_account_deletion');
  if (error) throw error;
  return data as string;
}

/** Annule la suppression pending (no-op si échue/inexistante). */
export async function cancelAccountDeletion(): Promise<void> {
  const { error } = await supabase.rpc('cancel_account_deletion');
  if (error) throw error;
}
```

- [ ] **Step 2 : vérifier** `npm run typecheck` (les RPC existent dans `database.types.ts` après Task 1).
- [ ] **Step 3 : commit** `feat(conf02): repository account-deletion (query pending + RPC)`

---

## Task 4 : Actions `auth-store` (ré-auth + déclenchement + purge locale)

**Files:** `apps/mobile/src/stores/auth-store.ts`

- [ ] **Step 1 : ajouter au type + store** :

```ts
  /** Vérifie le mot de passe de l'utilisateur courant (ré-auth avant action sensible). */
  reauthenticate: (password: string) => Promise<AuthResult>;
  /** Programme la suppression du compte : RPC → purge locale → signOut. Renvoie l'échéance ou une erreur. */
  requestAccountDeletion: () => Promise<{ error: string | null; scheduledAt?: string }>;
  /** Annule la suppression pending. */
  cancelAccountDeletion: () => Promise<AuthResult>;
```

  Implémentations :

```ts
  reauthenticate: async (password) => {
    const email = useAuthStore.getState().session?.user.email;
    if (!email) return { error: 'Aucune session active.' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  },
  requestAccountDeletion: async () => {
    try {
      const scheduledAt = await requestAccountDeletionRpc();       // repo (RPC), import aliasé
      await powerSync.disconnectAndClear();                        // purge SQLite locale
      await supabase.auth.signOut();                               // purge clés secureStorage
      return { error: null, scheduledAt };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Échec de la suppression.' };
    }
  },
  cancelAccountDeletion: async () => {
    try { await cancelAccountDeletionRpc(); return { error: null }; }
    catch (e) { return { error: e instanceof Error ? e.message : 'Échec de l’annulation.' }; }
  },
```

  Importer `powerSync` (`@/powersync/system`) et les fns du repository (Task 3) **avec un alias** pour éviter
  la collision avec les méthodes du store de même nom :
  `import { requestAccountDeletion as requestAccountDeletionRpc, cancelAccountDeletion as cancelAccountDeletionRpc } from '@/data/repositories/account-deletion-repository';`.
  ⚠️ `disconnectAndClear` **avant** `signOut` ; réservé à ce chemin (ne pas toucher le `signOut` normal).

- [ ] **Step 2 : vérifier** `npm run typecheck`.
- [ ] **Step 3 : commit** `feat(conf02): actions auth-store (reauth + request/cancel suppression + purge locale)`

---

## Task 5 : Détection + gate dans `_layout.tsx`

**Files:** `apps/mobile/src/app/_layout.tsx`

- [ ] **Step 1 : hook de détection** — après résolution de session, interroger la table (une fois par session).
  Ajouter dans `RootNavigator` un petit état local :

```ts
  // ⚠️ Keyer sur session.user.id (STABLE entre refreshes de token), PAS sur l'objet `session` :
  // auth-store réémet un nouvel objet session à chaque TOKEN_REFRESHED/foreground → sinon on
  // rebasculerait deletion.loading=true → route 'wait' → RootNavigator return null → flash/remontage
  // du Stack en pleine utilisation. On ne vérifie donc QU'UNE FOIS par utilisateur (ref).
  const userId = session?.user?.id ?? null;
  const [deletion, setDeletion] = useState<{ loading: boolean; pending: boolean }>({ loading: true, pending: false });
  const deletionCheckedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!userId) { deletionCheckedFor.current = null; setDeletion({ loading: false, pending: false }); return; }
    if (deletionCheckedFor.current === userId) return;   // déjà vérifié pour cet utilisateur
    deletionCheckedFor.current = userId;
    let cancelled = false;
    setDeletion({ loading: true, pending: false });
    fetchPendingDeletion()
      .then((r) => { if (!cancelled) setDeletion({ loading: false, pending: r != null }); })
      .catch(() => { if (!cancelled) setDeletion({ loading: false, pending: false }); }); // fail-open (hors-ligne / timeout)
    return () => { cancelled = true; };
  }, [userId]);
```

> Après une **annulation** (gate → « Annuler »), forcer un recheck en réinitialisant `deletionCheckedFor.current = null` (ou exposer un `refresh()` depuis le repo) pour que le routage repasse en `'app'`.

- [ ] **Step 2 : brancher `resolveRootRoute`** — passer `deletionCheckLoading: deletion.loading` et
  `deletionPending: deletion.pending`. Étendre l'`useEffect` de redirection : si `route === 'deletion-pending'`
  et qu'on n'est pas déjà sur l'écran → `router.replace('/deletion-pending')`.
- [ ] **Step 3 : enregistrer l'écran** — `<Stack.Screen name="deletion-pending" options={{ headerShown: false, gestureEnabled: false }} />` ; idem `account-delete` (modal, header) dans le Stack.
- [ ] **Step 4 : signOut gracieux (compte purgé à distance)** — dans le connecteur/écoute d'auth (voir
  `powersync/connector.ts` : PowerSync remonte les erreurs d'auth), sur erreur de refresh irrécupérable
  (utilisateur supprimé), déclencher `supabase.auth.signOut()`. (Si non trivial, le noter comme sous-tâche et
  ne pas bloquer le reste — cas de bord J+30.)
- [ ] **Step 5 : vérifier** `npm run typecheck` + `npm run test -w @wellness/mobile` (routing inchangé pour les cas existants).
- [ ] **Step 6 : commit** `feat(conf02): détection + gate deletion-pending dans le routage racine`

---

## Task 6 : Écrans + i18n (zone Danger, flux suppression, gate)

**Files:** `settings.tsx`, `account-delete.tsx`, `deletion-pending.tsx`, `fr.json`, `en.json`

- [ ] **Step 1 : i18n** (FR + EN, parité) — namespaces :
  `settings.dangerZone.{title,delete,offline}` ; `account.delete.{title,warning,whatDeleted,graceInfo,exportHint,
  passwordLabel,confirm,cancel,errorWrongPassword,scheduled}` (avec `{{date}}`) ;
  `account.deletePending.{title,scheduledFor,cancel,signOut}` (avec `{{date}}`).

- [ ] **Step 2 : zone Danger dans `settings.tsx`** — après le bloc signOut (≈ ligne 446), ajouter une section
  visuellement distincte (bordure/texte accent destructif). Bouton « Supprimer mon compte » **désactivé
  hors-ligne** via `useStatus().connected` (importer `useStatus` de `@powersync/react`) → `router.push('/account-delete')`.

- [ ] **Step 3 : écran `account-delete.tsx`** — avertissement (irréversible + `whatDeleted` + `graceInfo` +
  `exportHint`) → champ **mot de passe** → bouton confirmer. Au confirmer : `reauthenticate(password)` ;
  si erreur → message `errorWrongPassword` ; sinon `requestAccountDeletion()` → à la réussite, l'app est
  déconnectée (le routage renverra vers `(auth)`), afficher un message/alert `scheduled` (date). Gérer l'état
  chargement + erreurs. Utiliser `FormScreen`/`Button` existants ; aucune chaîne en dur.

- [ ] **Step 4 : écran `deletion-pending.tsx`** — plein écran, bloquant (pas de retour) : titre + `scheduledFor`
  (date lue via `fetchPendingDeletion`), bouton **Annuler la suppression** (`cancelAccountDeletion()` → succès →
  forcer un recheck / `router.replace('/(tabs)')`), bouton **Se déconnecter** (`signOut`). Gérer erreurs.

- [ ] **Step 5 : vérifier** — `npm run typecheck` + `npm run lint` + `npm run test -w @wellness/mobile` verts ;
  JSON i18n valide + parité.
- [ ] **Step 6 : commit** `feat(conf02): écrans suppression (zone Danger, flux, gate) + i18n`

---

## Task 7 : Parité i18n + suite complète + clôture

- [ ] **Step 1 : parité FR/EN** des clés `settings.dangerZone.*`, `account.delete.*`, `account.deletePending.*`.
- [ ] **Step 2 : suite complète** — `npm run typecheck` + `npm run lint` + `npm run test` (shared + mobile) verts.
- [ ] **Step 3 : revue finale** (offline-first : action en ligne assumée ; sécurité RPC scopées `auth.uid()` ;
  purge locale au bon endroit ; aucune chaîne en dur).
- [ ] **Step 4 : clôture** — `TODO.md` (Code `[x]`), push via `/commit`.

---

## Notes de test

- **`resolveRootRoute`** : Vitest exhaustif (deletion prioritaire, wait pendant check, fail-open).
- **Recette manuelle** (spec §9) : déclenchement + ré-auth (bon/mauvais mdp), gate + annulation (données
  intactes), se déconnecter du gate, hors-ligne (bouton désactivé), **purge J+30** sur compte de test
  (forcer `scheduled_at`, lancer `select public.purge_expired_accounts();`) — inclure **un exercice perso
  utilisé dans un workout** et **un compte admin ayant banni** (FK `acted_by`).

## Points d'attention

- **Task 1 = écriture cloud + pg_cron** : go explicite Florian/Damien ; activation pg_cron possiblement
  manuelle (dashboard). Sans le job, la table se remplit mais rien n'est purgé → conformité non tenue.
- **Vérifier le nom de contrainte** `user_bans_acted_by_fkey` avant l'`alter` (sinon adapter).
- **Ordre des tâches** : migration (1) → shared route (2) → repo (3) → auth-store (4) → routage (5) →
  écrans+i18n (6) → clôture (7). Tasks 2-6 sont 100 % JS (reload Metro).
- **Fail-open hors-ligne** au démarrage : un compte en suppression peut utiliser l'app hors-ligne ; le gate
  s'applique au prochain démarrage en ligne (assumé, cohérent « suppression non offline-first »).
