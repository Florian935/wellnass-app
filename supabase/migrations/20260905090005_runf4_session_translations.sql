-- US RUN-F4 (lot I) — la table de traduction qui manquait aux séances.
-- Réf. : docs/product/analyse-seances-structurees-running.md (mur M11)
--
-- `sessions.name` est une colonne texte simple — le seed CONTENU-01 le note explicitement :
-- « il n'existe **pas** de `session_translations` ». Conséquence : la bibliothèque de
-- programmes est bilingue au niveau du PROGRAMME (`program_translations`) mais monolingue au
-- niveau de la SÉANCE, ce qui contredit la décision G (i18n FR+EN dès le départ).
--
-- Miroir structurel exact de `program_translations` (20260706130000) : même colonnes, même
-- unicité (entité, langue), même RLS « contenu partageable » à `owner_id` nullable.
--
-- ⚠️ **Additive, jamais substitutive** : `sessions.name` n'est ni supprimée ni migrée. La
-- résolution applicative est COALESCE(traduction langue courante, traduction fr, sessions.name)
-- — les 3 programmes éditoriaux déjà publiés et toutes les séances personnelles existantes
-- continuent donc de s'afficher sans qu'une seule ligne soit écrite ici.

create table if not exists public.session_translations (
  id           uuid primary key,
  session_id   uuid not null references public.sessions (id) on delete cascade,
  owner_id     uuid references auth.users (id) on delete cascade,
  lang         text not null,
  name         text,
  description  text,
  instructions text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (session_id, lang)
);

create index if not exists session_translations_session_idx
  on public.session_translations (session_id)
  where deleted_at is null;

-- Trigger updated_at (fonction définie dans 20260705150000_init_conventions.sql)
drop trigger if exists set_updated_at on public.session_translations;
create trigger set_updated_at before update on public.session_translations
  for each row execute function public.set_updated_at();

-- RLS — patron « contenu partageable » identique à `program_translations` :
-- select si owner_id is null (éditorial) ou owner_id = auth.uid() (contenu perso) ;
-- insert/update uniquement sur son propre contenu. Pas de delete (soft delete).
alter table public.session_translations enable row level security;

drop policy if exists session_translations_select on public.session_translations;
drop policy if exists session_translations_insert on public.session_translations;
drop policy if exists session_translations_update on public.session_translations;

create policy session_translations_select on public.session_translations
  for select using (owner_id is null or owner_id = auth.uid());
create policy session_translations_insert on public.session_translations
  for insert with check (owner_id = auth.uid());
create policy session_translations_update on public.session_translations
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
