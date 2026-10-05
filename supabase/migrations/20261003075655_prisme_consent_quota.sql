-- US PRISME-01 — Prisme, l'assistant IA : son accord, et un quota qu'on ne contourne plus.
-- Réf. : docs/specs/functional/us/prisme01-prisme-raconte.md §10 · docs/plans/prisme01-prisme-raconte.md §5.
--
-- ── ① `user_settings.prisme_consent_at` / `prisme_consent_provider` — l'accord à Prisme ───────────
-- **Distinct** de `ai_consent_at` (Labo IA, IA-LAB-01) : ce dernier a été donné sur un texte « données
-- factices, le fournisseur gratuit peut s'en servir pour s'entraîner ». Le réutiliser pour de vraies
-- données serait un consentement donné à autre chose (spec DD3).
-- L'accord porte son **instant** (RGPD : prouver *quand*) et son **destinataire** : l'identifiant du
-- fournisseur auquel on a consenti. Si le serveur en change, l'accord est redemandé (spec R6).
-- Écrit par la fonction Edge (`kind: 'consent'`) à l'accord — la remontée PowerSync est différée, et le
-- premier appel juste après « Activer » prendrait sinon un refus ; **retiré** par l'app, même hors ligne.
--
-- ✅ **Aucune sync rule à redéployer** : `user_settings` est publiée et lue en `select *`.
-- 🔴 **Les deux colonnes DOIVENT être déclarées dans `apps/mobile/src/powersync/schema.ts`** et dans
-- `settings-repository.ts` — absente du schéma local, une colonne n'existe pas dans SQLite : l'écriture
-- échoue en silence (panne de CYCLE-01, 31/07/2026).
--
-- ── ② `ai_reserve_quota` / `ai_release_quota` — le quota, réservé avant l'appel ──────────────────
-- Jusqu'ici, la fonction Edge **lisait** le compteur, appelait le modèle, puis écrivait `used + 1` :
-- deux appels simultanés passaient tous les deux, et un double appui suffisait à dépasser le quota
-- (constat de la relecture du 02/10/2026). Le palier gratuit étant commun à tout le projet, c'est
-- précisément ce qu'il fallait empêcher.
-- `ai_reserve_quota` incrémente **en une seule instruction** (`insert … on conflict do update … where
-- count < quota`) : la ligne est verrouillée par l'upsert, il n'y a plus de fenêtre entre la lecture et
-- l'écriture. Elle renvoie le nouveau compte, ou `null` si le plafond est atteint.
-- `ai_release_quota` rend une réservation quand le fournisseur échoue : un quota consommé par une panne
-- serait une double peine (règle déjà écrite dans la fonction Edge).
-- Le jour est **passé par la fonction Edge** : la réservation et sa restitution portent sur la même
-- ligne même si minuit UTC tombe entre les deux.
--
-- 🔒 Réservées au rôle `service_role` (la fonction Edge) : un utilisateur qui pourrait les appeler
-- pourrait rendre ses propres réservations, donc remettre son quota à zéro.

alter table public.user_settings
  add column if not exists prisme_consent_at timestamptz,
  add column if not exists prisme_consent_provider text;

comment on column public.user_settings.prisme_consent_at is
  'US PRISME-01 — instant de l''accord à Prisme (assistant IA, vraies données). NULL = pas d''accord (défaut). Distinct de ai_consent_at (Labo IA, données factices).';
comment on column public.user_settings.prisme_consent_provider is
  'US PRISME-01 — identifiant du fournisseur IA auquel l''accord a été donné (groq, mistral…). Un autre fournisseur = accord redemandé.';

create or replace function public.ai_reserve_quota(p_user uuid, p_kind text, p_quota integer, p_day date)
  returns integer
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_count integer;
begin
  if p_quota is null or p_quota <= 0 then
    return null;
  end if;

  insert into public.ai_usage (user_id, usage_date, kind, count)
  values (p_user, p_day, p_kind, 1)
  on conflict (user_id, usage_date, kind)
  do update set count = public.ai_usage.count + 1, updated_at = now()
    where public.ai_usage.count < p_quota
  returning count into v_count;

  -- Plafond atteint : la clause `where` a empêché la mise à jour, rien n'est renvoyé → NULL.
  return v_count;
end;
$$;

comment on function public.ai_reserve_quota(uuid, text, integer, date) is
  'US PRISME-01 — réserve une unité de quota IA, atomiquement. Renvoie le nouveau compte, ou NULL si le plafond est atteint. service_role uniquement.';

create or replace function public.ai_release_quota(p_user uuid, p_kind text, p_day date)
  returns void
  language sql
  security definer
  set search_path = public
as $$
  update public.ai_usage
     set count = count - 1, updated_at = now()
   where user_id = p_user and usage_date = p_day and kind = p_kind and count > 0;
$$;

comment on function public.ai_release_quota(uuid, text, date) is
  'US PRISME-01 — rend une réservation de quota quand le fournisseur a échoué. service_role uniquement.';

revoke all on function public.ai_reserve_quota(uuid, text, integer, date) from public, anon, authenticated;
revoke all on function public.ai_release_quota(uuid, text, date) from public, anon, authenticated;
grant execute on function public.ai_reserve_quota(uuid, text, integer, date) to service_role;
grant execute on function public.ai_release_quota(uuid, text, date) to service_role;
