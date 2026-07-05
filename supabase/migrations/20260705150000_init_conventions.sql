-- Migration fondation — conventions transverses (aucune table métier ici).
-- Les tables de domaine viendront avec leurs US (cycle spec → plan → design → validation → code).
-- Réf. : docs/specs/technical/modele-donnees.md §1, offline-sync.md §6.

-- gen_random_uuid() pour les identifiants générés côté serveur (les entités synchronisées
-- utilisent surtout des UUID générés côté client, mais on garde l'extension disponible).
create extension if not exists pgcrypto;

-- Convention offline-first : updated_at maintenu automatiquement (UTC) sur chaque UPDATE.
-- À attacher à toute table synchronisée :
--   create trigger set_updated_at before update on public.<table>
--     for each row execute function public.set_updated_at();
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger BEFORE UPDATE : met à jour updated_at en UTC. À attacher à chaque table synchronisée (modele-donnees.md §1).';
