-- US LETTRE-01 — le mot écrit à son futur soi, scellé avec l'objectif.
-- Spec : docs/specs/functional/us/lettre01-lettre-futur-moi.md (R1)
--
-- Trois colonnes ADDITIVES et NULLABLES sur une table déjà synchronisée : aucune ligne existante
-- n'est touchée, aucun rejeu, et un objectif sans lettre se comporte exactement comme avant (R5).
--
-- `letter_opened_at` n'est posé que par les TROIS déclencheurs de R3 (échéance, objectif atteint,
-- suppression) — pas par une relecture volontaire. La colonne existe pour ne pas reproposer
-- éternellement la même ouverture, pas pour compter les lectures.
--
-- ⚠️ `personal_goals` est DÉJÀ dans la publication `powersync` (migration 20260729131013) : aucune
-- sync rule à redéployer. En revanche les trois colonnes doivent être déclarées dans
-- `apps/mobile/src/powersync/schema.ts`, sans quoi elles existent en base et restent invisibles du
-- client — la panne silencieuse de CYCLE-01, re-rencontrée le 18/09 sur FANT-01.

alter table public.personal_goals
  add column if not exists letter_text text,
  add column if not exists letter_written_at timestamptz,
  add column if not exists letter_opened_at timestamptz;

-- `not valid` : toutes les lignes existantes ont `letter_text is null`, il n'y a rien à revalider.
-- La contrainte protège les écritures futures — le plafond est aussi tenu côté app (D6), mais une
-- limite qui n'existe que dans l'UI n'est pas une limite.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'personal_goals_letter_text_len'
  ) then
    alter table public.personal_goals
      add constraint personal_goals_letter_text_len
      check (letter_text is null or length(letter_text) <= 1000) not valid;
  end if;
end $$;

comment on column public.personal_goals.letter_text is
  'US LETTRE-01 — mot écrit à son futur soi en fixant l''objectif (1 000 caractères max). Jamais analysé, jamais envoyé à un tiers.';
comment on column public.personal_goals.letter_opened_at is
  'US LETTRE-01 — première ouverture par un DÉCLENCHEUR (échéance, objectif atteint, suppression) ; une relecture volontaire ne l''écrase pas.';
