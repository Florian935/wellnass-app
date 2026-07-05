# Runbook — Provisioning du spike PowerSync

> Pas-à-pas pour préparer les comptes **avant** le spike ([spike-001](./spike-001-powersync.md)).
> ⚠️ Les **libellés exacts** des consoles Supabase / PowerSync peuvent évoluer. Si un écran ne correspond
> pas à ce qui est décrit, **colle-moi une capture ou le texte** et je te réoriente.
> Docs officielles de référence : `supabase.com/docs` · `docs.powersync.com` (guide « Supabase + PowerSync »).

**Secrets — règle d'or :**
- ✅ Tu peux me transmettre : **Project URL** Supabase, **anon key** Supabase, **URL de l'instance PowerSync** (ce sont des valeurs client, non sensibles).
- 🔒 Tu ne partages JAMAIS (ni à moi, ni dans git) : le **mot de passe de la base**, la **service_role key**. Ils restent dans la console PowerSync et/ou un `.env` local.

---

## Phase 1 — Supabase

### 1.1 Créer le projet
- [ ] Crée un compte sur **supabase.com** → **New project**.
- [ ] Nom : `wellness-spike` (peu importe, c'est jetable).
- [ ] **Region** : la plus proche (ex. *West EU (Paris/Frankfurt)*).
- [ ] **Database Password** : génère-en un fort, **note-le précieusement** (servira pour PowerSync).
- [ ] Attends la fin du provisioning (~2 min).

### 1.2 Récupérer les clés client
- [ ] Menu **Project Settings → API**.
- [ ] Note **Project URL** (ex. `https://xxxx.supabase.co`).
- [ ] Note **anon public key** (clé `anon`).
- [ ] *(Ne touche pas à la `service_role` — secrète.)*

### 1.3 Créer la table jouet + sécurité
- [ ] Menu **SQL Editor → New query**, colle puis **Run** :

```sql
-- Table jouet du spike
create table public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sécurité : chaque utilisateur ne voit/modifie que SES lignes
alter table public.todos enable row level security;

create policy "Users manage own todos"
on public.todos for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Publication lue par PowerSync (réplication logique)
create publication powersync for table public.todos;

-- Rôle de réplication DÉDIÉ pour PowerSync (⚠️ requis — ne PAS utiliser le user `postgres`).
-- Remplace <MDP_FORT> par un mot de passe fort : tu le saisiras dans PowerSync en 2.2.
-- (Nouveau secret, différent du mot de passe DB — à garder pour toi.)
create role powersync_role with replication bypassrls login password '<MDP_FORT>';
grant select on all tables in schema public to powersync_role;
alter default privileges in schema public grant select on tables to powersync_role;
```

### 1.4 Créer un utilisateur de test
> Un **seul** compte de test, qu'on utilisera **sur le téléphone** (et qu'on pourra rouvrir sur un 2ᵉ device pour le test de conflit).
- [ ] Menu **Authentication → Sign In / Providers** : vérifie que **Email** est activé.
- [ ] Pour éviter la vérification d'email pendant le spike : **Authentication → Sign In / Providers → Email** → désactive temporairement **Confirm email** (option « Confirm email » sur OFF).
- [ ] Menu **Authentication → Users → Add user → Create new user** :
  - Email : `spike@test.dev` (ou ce que tu veux)
  - Password : un mot de passe simple que tu retiens
  - [ ] Coche « Auto Confirm User » si proposé.

### 1.5 Récupérer la connexion base (pour PowerSync)
- [ ] Menu **Project Settings → Database → Connection string** (ou **Connect** en haut).
- [ ] Repère le mode **Direct connection** (host type `db.xxxx.supabase.co`, port `5432`).
- [ ] Note : **host**, **port (5432)**, **database (`postgres`)**, **user (`postgres`)**. Le **mot de passe** = celui de l'étape 1.1.
- [ ] *(Si seul un « pooler » IPv4 est proposé et que PowerSync refuse la connexion directe, on basculera sur les infos du pooler — on verra ça ensemble si ça coince.)*

✅ **Fin Phase 1** — tu dois avoir : Project URL, anon key, mot de passe DB, host de connexion, + un user de test.

---

## Phase 2 — PowerSync

### 2.1 Créer le compte + l'instance
- [ ] Crée un compte sur **powersync.com** (console PowerSync / JourneyApps).
- [ ] Crée une **nouvelle instance** (offre gratuite « dev »).

### 2.2 Connecter PowerSync à Supabase (Database Connection)
> L'UI actuelle ne propose pas de wizard « Connect to Supabase » : c'est un **formulaire Postgres générique**. Remplis-le à la main.
- [ ] **Host** : la connexion **Direct** de Supabase (`db.xxxx.supabase.co`, port `5432`) fonctionne — PowerSync Cloud joint bien l'IPv6. *(Si la connexion directe est refusée, bascule sur le **Session pooler** IPv4 : host `aws-<region>.pooler.supabase.com`, port `5432`, et user suffixé `powersync_role.<project-ref>`.)*
- [ ] **Database Name** : `postgres` · **SSL Mode** : `verify-full` (PowerSync embarque le CA Supabase, aucun certif à fournir).
- [ ] **Username** : `powersync_role` · **Password** : le `<MDP_FORT>` créé en 1.3. **(Pas le user `postgres`.)**
- [ ] **Test Connection** → puis **Save Connection**. PowerSync doit passer **replicating**.

### 2.2b Auth client (⚠️ piège vécu au spike — 401 `PSYNC_S2101`)
> Supabase signe ses JWT avec des **clés asymétriques ES256** (nouveau *JWT Signing Keys*). Sans ce réglage, le streaming est rejeté en **401** : l'upload marche quand même (il tape direct sur Supabase) mais **rien ne descend**, ce qui masque la cause.
- [ ] Menu **Client Auth** de l'instance → **coche « Use Supabase Auth »**.
- [ ] Laisse le champ **« Supabase JWT Secret » VIDE** (inutile avec les clés asymétriques).
- [ ] **Save and Deploy** → PowerSync auto-détecte le JWKS (`/auth/v1/.well-known/jwks.json`) et l'audience `authenticated`.

### 2.3 Définir le Sync Stream
> L'UI actuelle utilise le nouveau format **« Sync Streams » (`edition: 3`)**, plus le YAML `bucket_definitions` legacy.
> ⚠️ **Piège vécu au spike** : en edition 3, un stream **n'est PAS synchronisé automatiquement** — il faut **`auto_subscribe: true`**, sinon le client ne s'abonne à rien et **ne reçoit aucune donnée descendante** (alors que la connexion paraît saine).
- [ ] Dans l'instance, ouvre **Sync Streams** et colle ceci :

```yaml
config:
  edition: 3

streams:
  user_todos:
    auto_subscribe: true
    query: SELECT * FROM todos WHERE user_id = auth.user_id()
```

- [ ] **Deploy** le stream.

### 2.4 Récupérer l'URL de l'instance
- [ ] Note l'**URL de l'instance PowerSync** (du type `https://xxxxx.powersync.journeyapps.com`).

✅ **Fin Phase 2** — connexion Supabase « replicating » + sync rules déployées + URL d'instance notée.

---

## Phase 3 — Téléphone Android (Pixel 6a)

> On lancera un **dev build Expo** dessus (Expo Go ne suffit pas). Deux modes possibles ; le plus simple :
- [ ] **Activer le mode développeur** : Réglages → À propos du téléphone → tape 7× sur **Numéro de build**.
- [ ] **Activer le débogage USB** : Réglages → Système → Options pour les développeurs → **Débogage USB** ON.
- [ ] Garde un **câble USB** sous la main (connexion filaire = le plus fiable pour un premier dev build).
- [ ] *(Alternative sans fil possible plus tard via Expo Dev Client sur le même Wi-Fi — on verra selon ce qui marche le mieux.)*

✅ **Fin Phase 3** — téléphone en mode dev, débogage USB prêt.

---

## Phase 4 — Ce que tu me transmets pour que je code

Quand les phases 1–2 sont faites, donne-moi (ici, sans risque) :
- [ ] **Supabase Project URL**
- [ ] **Supabase anon key**
- [ ] **PowerSync instance URL**

Et garde pour toi (tu les saisiras toi-même quand je te le dirai, dans un `.env` local) :
- 🔒 mot de passe DB · 🔒 service_role key

→ Ensuite **je scaffolde la mini-app Expo jetable** et on déroule les 6 critères du spike.
