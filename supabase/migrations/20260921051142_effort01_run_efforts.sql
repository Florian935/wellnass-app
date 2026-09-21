-- US EFFORT-01 — le **journal des efforts** d'une course.
-- Réf. : docs/specs/functional/us/effort01-meilleurs-efforts-sortie.md §4
--
-- ── Pourquoi une table neuve plutôt qu'élargir `running_pace_records` ───────────────────────────
-- `running_pace_records` porte un **index unique `(user_id, distance_key)`** : une seule ligne par
-- distance, le meilleur temps, point. C'est un **palmarès**, et c'est sa raison d'être. L'app était
-- donc structurellement incapable de dire « 2ᵉ meilleur temps » — un classement suppose
-- l'historique des efforts, qui n'existait nulle part. Deux objets différents, deux tables.
--
-- 🔴 **Le palmarès garde CINQ distances, ce journal en couvre HUIT** (spec R9 bis / D8).
-- La première version de la spec élargissait la contrainte `check` de
-- `running_pace_records.distance_key` aux huit clés : c'était une erreur, trouvée en écrivant le
-- code. `computeRunRecords` alimente cette table, et lui faire rendre '400m' aurait fait **échouer
-- la remontée vers Postgres** dès la première course — silencieusement côté SQLite local. Le record
-- d'une distance neuve se lit comme le **minimum de ce journal**, là où vit déjà son rang.
-- Conséquence : **aucune table existante n'est modifiée**, hors la colonne marqueur plus bas.
--
-- 🔴 **Le rang n'est PAS stocké** (spec R7), et ce n'est pas un oubli : un effort classé 2ᵉ devient
-- 3ᵉ à la course suivante **sans que sa propre ligne ait bougé**. Le journal est matérialisé, le
-- classement est dérivé à la lecture.

create table if not exists public.run_efforts (
  id              uuid primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,

  -- `cascade` **voulu** : un effort n'a aucun sens sans sa course. C'est l'inverse exact de
  -- `runs.ghost_run_id` (FANT-01), qui est en `set null` parce que la course qui a servi de fantôme
  -- peut disparaître sans emporter celle qui l'a affrontée.
  run_id          uuid not null references public.runs (id) on delete cascade,

  -- **Sans CHECK**, délibérément — patron `activities.activity_type` (AUTRE-01) et
  -- `pain_reports.zone`. Le catalogue des distances est applicatif et vient de grossir de 5 à 8 ;
  -- il grossira encore. Une clé inconnue venue d'un client plus récent **bloquerait la file
  -- d'upload de toutes les tables**, ce qui est infiniment pire que d'accepter une ligne inutile.
  distance_key    text not null,

  -- Le meilleur segment glissant de cette distance, dans cette course.
  time_seconds    numeric not null check (time_seconds > 0),

  -- Les bornes de la fenêtre gagnante dans la trace. Le calcul les trouvait déjà puis les jetait
  -- (`bestSegmentTimeFromSamples` ne rendait qu'un nombre de secondes) : sans elles, impossible de
  -- poser une médaille à l'endroit où l'effort a eu lieu.
  start_index     integer not null check (start_index >= 0),
  end_index       integer not null check (end_index > start_index),

  -- Milieu de la fenêtre — le point qui porte la médaille (spec R10). Le **milieu** et non
  -- l'arrivée : deux distances imbriquées (1 km et 1 mile) pointeraient sinon le même endroit.
  -- Nullable : une course sans trace exploitable n'a pas de position.
  mid_lat         numeric,
  mid_lng         numeric,

  achieved_at     timestamptz not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- Une course ne produit qu'un effort par distance : rejouer l'évaluation (rattrapage, remontage
-- d'écran) ne doit pas créer de doublon. Partiel, pour que le soft delete reste possible.
create unique index if not exists run_efforts_run_distance_uidx
  on public.run_efforts (run_id, distance_key)
  where deleted_at is null;

-- L'index du **classement** : c'est LA requête de l'écran (tous mes efforts sur une distance,
-- du plus rapide au plus lent). Sans lui, chaque ouverture de sortie balaierait tout le journal.
create index if not exists run_efforts_user_distance_time_idx
  on public.run_efforts (user_id, distance_key, time_seconds)
  where deleted_at is null;

create trigger set_updated_at before update on public.run_efforts
  for each row execute function public.set_updated_at();

alter table public.run_efforts enable row level security;

-- Pas de politique `delete` : soft delete, comme partout dans ce schéma.
create policy run_efforts_select on public.run_efforts
  for select using (user_id = auth.uid());
create policy run_efforts_insert on public.run_efforts
  for insert with check (user_id = auth.uid());
create policy run_efforts_update on public.run_efforts
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Le marqueur d'idempotence du rattrapage (spec R19/R20) ──────────────────────────────────────
-- Les courses déjà enregistrées n'ont aucun effort. Sans rattrapage, le premier effort de chaque
-- distance s'afficherait « 1ᵉʳ » à quelqu'un qui a déjà couru quarante fois — c'est exactement le
-- piège découvert par IMPORT-01 sur `personal_records`, qui n'est pas dérivée.
--
-- `null` = jamais traitée. Une course traitée et **sans aucun effort** (tapis, trace trop courte)
-- est quand même marquée : sinon le rattrapage la reprendrait à chaque démarrage, pour rien.
alter table public.runs
  add column if not exists efforts_computed_at timestamptz;
