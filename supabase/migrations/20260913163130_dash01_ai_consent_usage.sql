-- US DASH-01 (§7) — l'assistant IA : le consentement et le compteur d'usage.
--
-- Deux objets, et pas un de plus. **Aucune donnée envoyée au modèle n'est stockée ici** : ni la
-- photo, ni la question, ni la réponse. C'est ce qui permet à la politique de confidentialité de
-- dire « rien n'est conservé » sans réserve, et à la déclaration Google Play « Données collectées »
-- de ne pas gagner une septième catégorie.
--
-- ── ① `user_settings.ai_consent_at` — l'opt-in ────────────────────────────────────────────────────
-- Un **horodatage**, pas un booléen : le RGPD demande de pouvoir prouver *quand* le consentement a
-- été donné, et `null` dit « jamais consenti » sans ambiguïté. Révoquer repose `null` (patron
-- `activation_path_dismissed_at`). Désactivé par défaut, comme toute donnée qui sort de l'appareil —
-- même règle que `cycle_tracking_enabled` (CYCLE-01) et `pain_journal_enabled` (DOUL-01).
--
-- ✅ **Aucune sync rule à redéployer** : `user_settings` est déjà publiée et lue en `select *`. C'est
-- la 6ᵉ colonne de cette table dans ce cas, après `pain_journal_enabled`, `session_conflicts_enabled`,
-- `sbd_lifts`, `intensity_scale` et `cycle_tracking_enabled`.
--
-- 🔴 **La colonne DOIT être déclarée dans `apps/mobile/src/powersync/schema.ts`** et dans les points
-- d'édition de `settings-repository.ts`. Absente du schéma **local**, elle n'existe pas dans la base
-- SQLite embarquée : l'écriture échoue, l'erreur est avalée, et l'interrupteur revient à « éteint »
-- sans le moindre message. C'est la panne exacte de CYCLE-01, constatée en recette le 31/07/2026.
--
-- ── ② `ai_usage` — le quota, côté serveur ─────────────────────────────────────────────────────────
-- Une ligne par (utilisateur, jour, type d'appel), avec un compteur. Le quota **doit** vivre côté
-- serveur : compté dans l'app, il suffirait de réinstaller pour le remettre à zéro, et c'est la
-- facture du fournisseur qui paierait la naïveté.
--
-- ⚠️ **Aucune politique RLS n'est créée, et c'est délibéré** : RLS est activée, donc sans politique
-- **personne** n'y accède — ni le client anonyme, ni l'utilisateur connecté. Seule la fonction Edge,
-- qui utilise la clé `service_role` (laquelle contourne RLS), lit et écrit ce compteur. Une table de
-- quota lisible par son porteur serait une table de quota modifiable par son porteur.
--
-- ⚠️ **Table volontairement NON publiée** (pas d'`alter publication powersync`) : elle n'a rien à
-- faire sur l'appareil. Donc, pour une fois, **aucune sync rule à déployer à la main** — l'étape
-- oubliée trois fois (BIEN-01, RUN-F2c, VIE-01) ne s'applique pas ici.

alter table public.user_settings
  add column if not exists ai_consent_at timestamptz;

comment on column public.user_settings.ai_consent_at is
  'US DASH-01 §7 — instant du consentement à l''assistant IA. NULL = jamais consenti (défaut). Révoquer repose NULL.';

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Jour **UTC** : le quota est une protection de coût, pas une promesse produit. Le calculer dans
  -- le fuseau du client le rendrait remettable à zéro en changeant de fuseau.
  usage_date date not null default (now() at time zone 'utc')::date,
  -- `photo` | `ask`. Sans `CHECK` : la liste est applicative et évolutive, et une valeur inconnue
  -- doit faire échouer *l'appel*, jamais bloquer une file d'écriture (leçon `meal_type`, `zone`).
  kind text not null,
  count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ai_usage is
  'US DASH-01 §7 — compteur de quota IA par (utilisateur, jour UTC, type). Écrit UNIQUEMENT par la fonction Edge (service_role). Ne contient ni question, ni photo, ni réponse.';

-- Le compteur est lu et incrémenté par (utilisateur, jour, type) : l'unicité est la clé d'accès,
-- et elle rend l'`upsert` de la fonction Edge atomique.
create unique index if not exists ai_usage_user_date_kind_idx
  on public.ai_usage (user_id, usage_date, kind);

alter table public.ai_usage enable row level security;

-- ⚠️ Aucune politique : RLS activée sans politique = accès refusé à tout le monde sauf `service_role`.
