-- US FANT-01 — Le Fantôme : la course passée qu'on affronte pendant la course en cours.
-- Spec : docs/specs/functional/us/fant01-fantome-course.md (R8)
--
-- Additive et NULLABLE : aucune course existante n'est touchée, aucun rejeu, et une course sans
-- fantôme se comporte exactement comme avant (spec R5 de l'écran : sans fantôme, rien ne change).
--
-- `on delete set null` et NON cascade, délibérément (R9) : supprimer la course qui servait de
-- fantôme ne doit pas emporter la course qui l'a affrontée. Le résumé garde alors son écart
-- enregistré, sans lien vers une course disparue.
--
-- ⚠️ `runs` est DÉJÀ dans la publication logique `powersync` (migration 20260707120000) : cette
-- colonne suit la synchro existante. Aucune sync rule à redéployer côté dashboard PowerSync —
-- l'étape manuelle ne concerne que l'ajout d'une TABLE synchronisée, pas d'une colonne.

alter table public.runs
  add column if not exists ghost_run_id uuid null references public.runs (id) on delete set null;

comment on column public.runs.ghost_run_id is
  'US FANT-01 — course passée affrontée comme « fantôme » pendant cette course. Posée au démarrage, jamais modifiée ensuite.';
