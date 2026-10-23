# Plan — ACCES-IA : Prisme réservé aux testeurs

> **Spec** : [docs/specs/functional/us/acces-ia-testeurs.md](../specs/functional/us/acces-ia-testeurs.md) ·
> **Maquette** : [design/acces-ia-testeurs/](../../design/acces-ia-testeurs/) ·
> **Branche** : `feature/acces-ia-testeurs` (worktree `.expo/claude-worktrees/acces-ia`).
> Écrit le 23/10/2026 sur `origin/dev` (`d604dec2`), relu le même jour (spec §15). Les éléments marqués
> *(QA1)* tombent si Florian limite le verrou à Prisme.

## Ordre de build

| # | Étape | Fichiers | Tests |
|---|---|---|---|
| 1 | **La règle**, pure, et les contrats partagés | `packages/shared/src/ai-access.ts` **(neuf)**, `ai-assist.ts`, `audit.ts`, `index.ts` | `ai-access.test.ts` **(neuf)**, `ai-assist.test.ts`, `audit.test.ts` |
| 2 | **La copie serveur** de la règle, sous test-garde | `supabase/functions/ai-assist/access.ts` **(neuf)** | `ai-access.test.ts` (garde) |
| 3 | **La migration** | `supabase/migrations/<horodatage>_acces_ia_ai_testers.sql` **(neuf)**, `supabase/MIGRATIONS.md`, `packages/shared/src/database.types.ts` | — (cloud, étape 9) |
| 4 | **La fonction** `ai-assist` | `supabase/functions/ai-assist/index.ts` | — (pas de runner Deno ; étape 9) |
| 5 | **Back-office, données** | `apps/admin/src/data/ai-testers.ts` **(neuf)**, `test-utils/supabase-mock.ts` | `ai-testers.test.ts` **(neuf)** |
| 6 | **Back-office, écrans** | `screens/AiTestersScreen.tsx` **(neuf)**, `screens/UserDetailScreen.tsx`, `App.tsx`, `components/AdminLayout.tsx`, `i18n/fr.ts` | `AiTestersScreen.test.tsx` **(neuf)**, `UserDetailScreen.test.tsx`, `AdminLayout.test.tsx` **(neuf)** |
| 7 | **App, Prisme** | `lib/ai/ai-client.ts`, `lib/ai/prisme.ts`, `hooks/useAiAccess.ts` **(neuf)**, `hooks/usePrismeVisibility.ts`, `stores/prisme-store.ts`, `stores/auth-store.ts`, `components/prisme/PrismeSettingsSection.tsx`, `i18n/locales/{fr,en}.json` | `ai-client.test.ts`, `prisme.test.ts`, `useAiAccess.test.ts` **(neuf)**, `usePrismeVisibility.test.ts`, `PrismeSettingsSection.test.tsx`, `ai-error-messages.test.ts` **(neuf)** |
| 8 | **App, Labo IA** *(QA1)* | `hooks/useLabNarrationAllowed.ts` **(neuf)**, `components/AiLabSection.tsx`, `app/(tabs)/lab.tsx`, `components/dashboard/CouncilSheet.tsx`, `app/ai-lab.tsx`, locales | `useLabNarrationAllowed.test.ts` **(neuf)**, `AiLabSection.test.tsx` **(neuf)**, `ai-lab-screen.test.tsx` **(neuf)**, `CouncilSheet.test.tsx` |
| 9 | **Docs, puis déploiement** (gestes de Florian) | `BACKLOG.md`, `docs/specs/technical/lance00-fiche-play-et-confidentialite.md`, spec PRISME-01 §4 et §11, roadmap | contrôles cloud listés ci-dessous |

Chaque étape : test d'abord (rouge), code, vert ; `npm run typecheck`, `npm run lint` et
`npm run test` à la fin de chaque étape qui touche du code. `npm install` dans le worktree au passage en
code (Node 24).

## Étape 1 — la règle, pure

**`packages/shared/src/ai-access.ts`** (aucun import) :

```ts
export const AI_ACCESS_MODES = ['testers', 'open'] as const;
export type AiAccessMode = (typeof AI_ACCESS_MODES)[number];

/** D1 / R2 — seule « open » ouvre ; absent, vide ou inconnu ferme. */
export function parseAiAccess(raw: string | null | undefined): AiAccessMode;

/**
 * R4 — le verrou laisse-t-il passer cet appel ? Ouverts à tous : `status`, et `consent` avec
 * `grant === false`. Tout le reste — types inconnus compris — exige d'être testeur en mode `testers`.
 */
export function aiAccessAllows(
  request: { kind: string; grant?: unknown },
  mode: AiAccessMode,
  isTester: boolean,
): boolean;

/** D4 / R5 — la raison de `status`, dans l'ordre : fermé, âge, fournisseur. */
export function prismeStatusReason(input: {
  closed: boolean;
  minor: boolean;
  provider: 'ok' | 'provider' | 'unconfigured';
}): 'closed' | 'age' | 'provider' | 'unconfigured' | null;
```

Sans *(QA1)*, `aiAccessAllows` laisse aussi passer `coach`, `photo` et `ask`.

Tests (`ai-access.test.ts`) — critères 1 à 4 de la spec, en tableau :
- `parseAiAccess` : `'open'`, `' Open '`, `'OPEN'` → `open` ; `undefined`, `''`, `'  '`, `'ouvert'`,
  `'true'`, `'testers'` → `testers` ;
- `aiAccessAllows` : les 7 types × {testeur, non-testeur} × {`open`, `testers`} ; `consent` avec `grant`
  `true` / `false` / absent / `'false'` (chaîne : fermé) ; un type inconnu (`'chat'`) fermé ;
- `prismeStatusReason` : les 12 combinaisons, dont « fermé + mineur → `closed` » et « mineur + fournisseur
  absent → `age` ».

**`ai-assist.ts`** : `prismeStatusSchema.reason` gagne `'closed'` ; champ `access:
z.enum(AI_ACCESS_MODES).optional()`. Tests : statut fermé valide ; statut sans `access` valide (fonction
pas encore redéployée) ; `access: 'ouvert'` rejeté.

**`audit.ts`** : `'ai_tester.grant'`, `'ai_tester.revoke'` dans `AUDIT_ACTIONS`. Le test existant
(libellé de chaque action, pas de doublon) les couvre ; un cas explicite de plus pour les deux.

**`index.ts`** : export de `ai-access`.

## Étape 2 — la copie serveur, sous garde

La fonction Edge ne partage pas le bundle de l'app (même raison que `DAILY_QUOTA`). Plutôt qu'un miroir
tenu de mémoire, **`supabase/functions/ai-assist/access.ts`** est une copie **vérifiée** :

- les deux fichiers portent leur propre en-tête, puis la même ligne repère
  `// ─── règle ACCES-IA (copie vérifiée par packages/shared/src/ai-access.test.ts) ───` ;
- sous ce repère, le code est **identique** ;
- `ai-access.test.ts` lit les deux fichiers (`node:fs` + `import.meta.url`, patron
  `noryn/targets.test.ts`), **normalise les fins de ligne** (`\r\n` → `\n`) et compare ce qui suit le
  repère, au caractère près. Le message d'échec dit quoi recopier.

Le code sous le repère n'importe rien et n'utilise rien de Node ni de Deno : il tourne tel quel dans les
deux. *(Le précédent par bundle, `scripts/noryn-context-bundle.mjs`, n'est pas repris : un fichier sans
import ne le justifie pas.)*

## Étape 3 — la migration

`npm run db:new acces_ia_ai_testers`, puis :

```sql
-- US ACCES-IA (7.43) — la liste des testeurs de l'IA. Réf. : docs/specs/functional/us/acces-ia-testeurs.md §7.

create table public.ai_testers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  added_by   uuid references auth.users (id) on delete set null,   -- leçon user_bans.acted_by (CONF-02)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index ai_testers_active_user_uidx on public.ai_testers (user_id) where deleted_at is null;
create trigger set_updated_at before update on public.ai_testers
  for each row execute function public.set_updated_at();

-- RLS sans politique : invisible pour anon et authenticated (patron ai_usage, sync_receipts).
alter table public.ai_testers enable row level security;
revoke all on public.ai_testers from anon, authenticated;
grant select on public.ai_testers to service_role;   -- auto_expose_new_tables : explicite (NORYN-01)

-- grant_ai_tester(target_user_id uuid) returns text            -- 'added' | 'already'
--   security definer, set search_path = public ; paramètre nommé target_user_id (pas user_id : ambigu) ;
--   1. if not can_manage_users() then raise exception 'non autorisé' ;
--   2. if not exists (select 1 from auth.users where id = target_user_id) then raise 'compte introuvable' ;
--   3. insert (user_id, added_by) values (target_user_id, auth.uid())
--        on conflict (user_id) where deleted_at is null do nothing ;
--   4. found → 'added', sinon 'already' (deux ajouts simultanés : le second attend, puis « already »).
-- grant_ai_tester_by_email(target_email text) returns table (outcome text, user_id uuid)
--   même garde ; select id from auth.users where lower(email) = lower(btrim(target_email)) ;
--   aucun → ('not_found', null) ; sinon → (grant_ai_tester(id), id). Égalité, jamais de motif.
-- revoke_ai_tester(target_user_id uuid) returns text           -- 'removed' | 'absent'
--   même garde ; update … set deleted_at = now() where user_id = target_user_id and deleted_at is null.
-- revoke execute … from public, anon ; grant execute … to authenticated (les trois).

-- Vue admin_ai_testers (security_barrier, where t.deleted_at is null and public.can_manage_users()) :
--   id, user_id, email, first_name, created_at, added_by_email,
--   last_used_on = max(ai_usage.usage_date) où count > 0,
--   calls_7d     = somme de ai_usage.count sur les 7 derniers jours UTC.
-- Aux droits du propriétaire (patron admin_users) : aucun droit à donner sur ai_usage ni ai_testers.
-- revoke all from anon ; grant select to authenticated.

-- PAS de publication powersync, PAS de sync rule (spec D9).
```

- Commentaires de table, de colonnes et de fonctions (patron `prisme_consent_quota`), dont celui de la
  vue : *Security Advisor* — signalement attendu et accepté, comme `admin_users`.
- `supabase/MIGRATIONS.md` : ligne **non cochée** jusqu'au push.
- **`database.types.ts`** : régénéré par `npm run db:types` **après** le push. Si Florian n'a pas encore
  autorisé le push quand les étapes 5-6 commencent, les entrées (table, vue, trois fonctions) sont
  écrites à la main **au format du générateur**, puis le fichier est régénéré à l'étape 9 et le diff doit
  être vide — sinon on corrige le code, pas le fichier.
- **Aucune sync rule à redéployer** : la table ne descend sur aucun téléphone.

## Étape 4 — la fonction `ai-assist`

Dans `index.ts`, après la lecture du JWT et la validation du `kind` :

1. `const mode = parseAiAccess(env('AI_ACCESS'))` ;
2. en mode `testers`, `readIsTester(admin, userId)` → `true` | `false` | `'error'` (`ai_testers`,
   `user_id`, `deleted_at is null`, `limit 1`). Sur `'error'` : `console.error('[ai-assist] liste des
   testeurs illisible', error.message)` **sans contenu**, puis (D16) `status` → 503 `ai_unavailable`, et
   tout appel que le verrou fermerait → 503 `ai_unavailable` ; le retrait d'accord passe toujours ;
3. `const allowed = aiAccessAllows(body, mode, isTester)` ; `closed` (pour le statut) =
   `!aiAccessAllows({ kind: 'narrate' }, mode, isTester)` ;
4. **`prismeStatus` reçoit `mode` et `closed`** — et ses **deux** appelants les passent : `status` et la
   réponse de `prismeConsent` (R5). Sa raison vient de `prismeStatusReason` ; la réponse porte
   `access: mode` ; fermé → `provider: null` ;
5. `consent` : `if (!allowed) return json({ error: 'ai_closed' }, 403)` **avant** la validation de
   `grant` (R4) ; le retrait passe toujours ;
6. tous les autres types : même refus **avant** `readPrismeProviderConfig` / `readProviderConfig` et
   avant `ai_reserve_quota` (R3).

En-tête du fichier : la section « Déploiement » gagne `AI_ACCESS` (absent = testeurs, `open` pour ouvrir,
effet sans redéploiement) et un « garde zéro » dans la liste des gardes. `access.ts` importé en
`./access.ts`.

## Étape 5 — back-office, données

**`apps/admin/src/data/ai-testers.ts`** (patron `users.ts` / `roles.ts`, erreurs rendues, jamais levées) :

| Fonction | Ce qu'elle fait |
|---|---|
| `listAiTesters()` | `admin_ai_testers`, tri `created_at` décroissant |
| `getAiTester(userId)` | la ligne de la vue pour ce compte, ou `null` (fiche utilisateur) |
| `addAiTesterByEmail(email)` | saisie `trim()` vide → rien n'est appelé ; `rpc('grant_ai_tester_by_email')` ; `added` → `logAudit({ action: 'ai_tester.grant', targetTable: 'auth.users', targetId: user_id })` — **aucun e-mail, aucun libellé** (spec D12) ; rend `added` / `already` / `not_found` / erreur |
| `addAiTester(userId)` | idem par identifiant (`grant_ai_tester`), pour la fiche |
| `removeAiTester(userId)` | `rpc('revoke_ai_tester')` → `logAudit('ai_tester.revoke', auth.users, userId)` seulement si `removed` |
| `readAiAccessMode()` | `functions.invoke('ai-assist', { body: { kind: 'status' } })` → `access`, ou `null` (fonction ancienne, réseau, erreur) |

**`test-utils/supabase-mock.ts`** : il n'a pas de `functions` — ajouter un `functions.invoke`
programmable.

Tests (`ai-testers.test.ts`) — critères 13 et 14 : chaque issue ; l'audit appelé ou non ; **l'entrée
d'audit ne contient l'e-mail nulle part** (ni `targetLabel`, ni `details`) ; saisie vide ou blanche → aucun
appel ; `readAiAccessMode` rend `null` sans `access` et sur erreur.

## Étape 6 — back-office, écrans

- **`AiTestersScreen`** (`/ai-testers`) — maquette, planche « Testeurs IA » : bandeau du mode
  (`testers` : « Mode en service : bêta fermée » ; `open` : « ouvert à tous — la liste est ignorée » ;
  `null` : « Mode inconnu — fonction à redéployer ? ») ; formulaire e-mail ; messages `role="alert"` /
  `role="status"` ; liste ; « Retirer » + `window.confirm` ; rappel « le testeur voit Prisme au prochain
  démarrage de l'app » (D13).
- **`App.tsx`** : route sous `RequireCanManageUsers`. **`AdminLayout`** : entrée de menu sous
  « Utilisateurs », `canManageUsers`.
- **`UserDetailScreen`** : section « Bêta IA » entre « Profil » et « Modération » — maquette, planche
  « Fiche utilisateur » ; retrait confirmé par `window.confirm`.
- **`fr.ts`** : `aiTesters.*`, `users.aiBeta.*`, `audit.action['ai_tester.grant' | 'ai_tester.revoke']`
  (« Ajout d'un testeur IA », « Retrait d'un testeur IA »). L'écran d'audit affiche déjà
  `target_table target_id` quand il n'y a pas de libellé : rien à y changer.

Tests — critères 15 à 17 : rendu de la liste, mode affiché dans les trois cas, ajout (succès, déjà,
inconnu), retrait confirmé et annulé, bloc de la fiche dans les deux états. **`AdminLayout.test.tsx`**
(neuf — aucun test du menu n'existe) : l'entrée « Testeurs IA » pour `canManageUsers` vrai, absente sinon.

## Étape 7 — app, Prisme

- **`ai-client.ts`** : `ai_closed` → code `'closed'` (`AiErrorCode`).
- **`prisme.ts`** : `afterServerFailure` **ne relit pas** le statut sur `'closed'` (spec R10 : relire
  démonterait la surface et son message) ; `'consent-required'` inchangé.
- **`stores/prisme-store.ts`** : `reset()` (statut, demande en cours, textes). **`auth-store.ts`** : le
  store de Prisme est remis à zéro à la déconnexion (D17).
- **`hooks/useAiAccess.ts`** **(neuf)** : reprend depuis `usePrismeVisibility` la lecture du statut ;
  rend `{ access: 'allowed' | 'closed' | 'unknown', mode, status }` (`mode` = `status.access`). Tant que
  l'état est `unknown`, chaque montage redemande le statut, **une seule requête en vol** (drapeau du
  store) ; une fois connu, plus d'appel dans la session (D15, D13). `usePrismeVisibility` s'appuie dessus
  et rend aussi `access` ; sa règle `visible` ne change pas.
- **`PrismeSettingsSection`** — tableau §4.1 de la spec : `closed` sans accord → `null` ; `closed` avec
  accord → carte réduite (`prisme.settings.closed`, bouton « Retirer mon accord » →
  `revokePrismeConsent`) ; `unknown` sans accord → `null` ; `unknown` avec accord → la section
  d'aujourd'hui ; `allowed` et `mode === 'testers'` → ligne `prisme.settings.betaTester`. Le commentaire
  de tête (« Toujours visible ») est réécrit.
- **Locales** : clés du §9 de la spec, FR et EN, dont les trois `aiLab.errors.*` manquantes.
- **`ai-error-messages.test.ts`** **(neuf)** : chaque `AiErrorCode` a `prisme.errors.<code>` et
  `aiLab.errors.<code>` en FR et en EN (la liste des codes est exportée par `ai-client.ts` pour que le
  test la lise au lieu de la recopier).

Tests — critères 7 à 10 et 12 : `useAiAccess` (trois états, redemande tant qu'inconnu, une seule requête,
remise à zéro) ; `usePrismeVisibility` (fermé → invisible) ; la section dans ses cinq cas ; `ai-client`
(`ai_closed`) ; `prisme.test.ts` (`closed` ne relit pas le statut, `consent-required` toujours) ; les
tests de `EveningCard`, `PrismeWeek` et `PrismeMealRecourse` gagnent chacun un cas « statut fermé → rien
de Prisme » — **sans toucher aux écrans** qui les montent.

## Étape 8 — app, Labo IA *(QA1)*

- **`hooks/useLabNarrationAllowed.ts`** **(neuf)** : `aiConsentAt != null && access === 'allowed'`. Un
  seul crochet pour les deux appelants, testé une fois.
- **`app/(tabs)/lab.tsx`** : `canNarrate={useLabNarrationAllowed()}`. **`CouncilSheet`** : même crochet
  autour de `LabNarration`.
- **`AiLabSection`** — tableau §4.1 : `allowed` → la section d'aujourd'hui ; `closed` avec accord →
  carte réduite (`aiLab.settings.closed`, bouton `aiLab.settings.withdraw`) ; `unknown` avec accord →
  l'interrupteur (pour retirer) ; sans accord, hors `allowed` → `null`.
- **`app/ai-lab.tsx`** : `closed` → `aiLab.closed` ; `unknown` → `aiLab.unknown` ; à la place du
  formulaire. Un refus `closed` en cours de session s'affiche par `aiLab.errors.closed` (R10), comme dans
  `LabNarration`, qui lit déjà `aiLab.errors.<code>`.

Tests — critère 11. ⚠️ `CouncilSheet` est aussi dans le périmètre de **CIBLE-04** (session parallèle) :
changement limité à la condition d'affichage, conflit éventuel résolu au rebase.

## Étape 9 — docs, puis déploiement

**Docs** (dans le commit qui livre) :
- `BACKLOG.md` — dette : « Export RGPD et tables serveur » (`ai_testers`, `ai_usage`, `user_bans`,
  `account_deletion_requests`, `sync_receipts` : hors export local, art. 15 servi sur demande — à
  arbitrer d'ensemble), spec D10 ;
- `lance00-fiche-play-et-confidentialite.md` — une phrase dans le brouillon de politique : le statut de
  testeur de la bêta IA, sa finalité, sa durée ;
- spec PRISME-01 — §4 (« Réglages › Prisme : toujours ») et §11 (« ACCES-IA livrée ») annotés, avec
  renvoi ;
- roadmap 7.43, CHANGELOG, ETAT — par `/commit`.

**Déploiement — chaque geste avec l'accord explicite de Florian** (spec §12) :

1. `npm run db:push:dry`, puis `npm run db:push` ; `npm run db:types` (diff vide si les types avaient été
   écrits à la main) ; cocher `MIGRATIONS.md`.
2. Back-office en local (`npm run dev --workspace @wellness/admin`) : ajouter Florian, Damien et les
   testeurs actuels. Le bandeau dit « mode inconnu » tant que la fonction n'est pas redéployée.
3. `npx supabase functions deploy ai-assist --use-api` (`AI_ACCESS` absent = testeurs).
4. Contrôles, dans l'ordre :
   - back-office : le bandeau dit « bêta fermée » ;
   - un compte testeur : Prisme comme avant, Réglages « tu fais partie des testeurs » ;
   - un compte non testeur : rien de Prisme ni du Labo IA *(QA1)* ; un appel direct à `narrate` répond
     403 `ai_closed` et `ai_usage` ne bouge pas (requête de lecture) ;
   - le compte testeur ne passe pas l'écran « Accès refusé » du back-office (R6) ;
   - avec un JWT de non-admin : `select` sur `ai_testers` → refusé ; les trois fonctions SQL → « non
     autorisé » ;
   - le journal d'audit : les lignes du jour portent des identifiants, aucun e-mail ;
   - `secrets set AI_ACCESS=open` : le non-testeur voit Prisme au redémarrage ; remettre `testers`.
5. `/commit` : `etape: close`, roadmap 7.43 ✅.

## Ce que le plan ne fait pas

- Pas de synchronisation PowerSync, pas d'entrée dans l'export de l'app (D9, D10).
- Pas de relecture du statut une fois connu, ni au retour au premier plan (D13).
- Pas de test automatique de la fonction Deno elle-même : sa règle est testée en `shared` et sa copie
  gardée ; le câblage est contrôlé au déploiement.
- Pas de retouche du contraste du back-office (spec §13).
- Rien sur le pilier Course, les écrans Muscu et Nutrition, ni `lab-repository.ts`.

## Risques

| Risque | Parade |
|---|---|
| Déployer la fonction avant d'avoir rempli la liste éteint Prisme chez les testeurs | Ordre de l'étape 9 ; et au pire, `secrets set AI_ACCESS=open` le rallume en une commande |
| La copie serveur dérive de la règle testée | Test-garde au caractère près (étape 2) |
| Un e-mail désigne un autre compte | Égalité côté serveur, aucun motif (étape 3) |
| Un e-mail écrit à vie dans le journal | Identifiant seul ; test « aucun e-mail dans l'entrée » (étape 5) |
| Un testeur cru administrateur | Table dédiée, aucune fonction de garde n'y lit ; contrôle cloud (étape 9) |
| Types générés absents avant le push | Écrits au format du générateur, régénérés et comparés (étape 3) |
| Conflits avec les sessions parallèles (locales, `CouncilSheet`, `database.types.ts`, `MIGRATIONS.md`) | Rebase sur `origin/dev` avant de pousser ; garder les deux côtés ; relancer les tests |

## Écarts au plan (code du 23/10/2026)

Des moyens, pas des règles — la spec n'a pas bougé.

| Plan | Fait | Pourquoi |
|---|---|---|
| `grant_ai_tester_by_email` rend `(outcome, user_id)` | rend `(outcome, target_user_id)` | En PL/pgSQL, une colonne de sortie nommée `user_id` devient une variable, ambiguë avec la colonne de `ai_testers` |
| Égalité sur l'e-mail | + comptes SSO et comptes supprimés de GoTrue écartés (`is_sso_user = false`, `deleted_at is null`) | L'index unique de GoTrue sur l'e-mail ne vaut que pour les comptes non SSO : l'égalité désigne alors un seul compte |
| Bloc « Bêta IA » dans `UserDetailScreen` | composant à part, `components/AiBetaSection.tsx`, avec son test ; la fiche le monte entre Profil et Modération | La fiche garde ses tests existants intacts ; le bloc se teste seul (5 cas) |
| `statusRequested` (« une fois par session ») | renommé `statusLoading` (« une requête en vol ») | D15 : tant qu'il est inconnu, le statut est redemandé ; le drapeau ne dit plus « déjà demandé » mais « en cours » |
| Remise à zéro du store « à la déconnexion » | à tout **changement de compte** vu par `onAuthStateChange` (déconnexion comprise) ; un jeton rafraîchi pour le même compte ne touche à rien | Couvre aussi une connexion directe à un autre compte |
| Un cas « statut fermé » dans les tests de `EveningCard`, `PrismeWeek`, `PrismeMealRecourse` | prouvé une fois, dans `usePrismeVisibility.test.ts` (« bêta fermée → invisible, même avec un accord ») | Ces trois tests remplacent `usePrismeVisibility` par un double qui ne lit que `visible` : un cas « fermé » y redirait leur test « invisible » existant |
| Ligne « bêta » des Réglages | + une pastille `BÊTA` (`prisme.settings.betaBadge`) | Maquette |
| `useLabNarrationAllowed` dans `CouncilSheet` | le test du Conseil remplace le crochet par un double ; la règle est testée dans `useLabNarrationAllowed.test.ts` | Un seul endroit pour la règle (critère 11) |
| `lab.tsx` | `useSettings` n'y servait qu'à `canNarrate` : remplacé par le crochet, import retiré | — |
| Le verdict du verrou composé dans `index.ts` | **`aiGate(request, mode, tester)`** dans la règle partagée (et sa copie) : `pass` / `closed` / `unavailable`, testé sur toute la matrice ; `index.ts` ne fait que le traduire | Revue de code : la partie qui décide de la facture n'avait aucun test (pas de runner Deno) |
| Liste illisible + retrait d'accord → statut « fermé » | le retrait est écrit, puis la réponse est `503 ai_unavailable` (`statusReadable: false`) | D16 : ne jamais dire « bêta fermée » à un testeur à cause d'une panne |
| `reset()` à la déconnexion | + une **époque** dans le store : une demande de statut (ou un accord) partie avant un changement de compte n'écrit rien à son retour | Revue de code : la réponse destinée au compte A devenait le statut du compte B, plus jamais redemandé |
| Une requête de statut en vol | + **délai de 10 s** qui libère le drapeau ; `useAiAccess` rend `loading` — `/ai-lab` attend au lieu de dire « il faut le réseau » pendant la première demande | Une requête qui pend (portail captif) bloquait D15 pour la session |
| `select … into v_id` | `select … into strict` : zéro compte → `not_found`, deux → refus | Jamais un compte pris au hasard |
| Messages du back-office | « Déjà testeur » / « déjà retiré » dans la fiche ; message de retrait à part sur l'écran (pas « erreur de chargement ») | Revue de code |

