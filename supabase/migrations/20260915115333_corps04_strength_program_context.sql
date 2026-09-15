-- US CORPS-04 — contexte durable utilisé pour recommander un programme de musculation compatible.
--
-- Les deux colonnes sont additives et nullable : `null` signifie que la contrainte n'a jamais été
-- choisie. Le tableau d'équipement vide est invalide ; « tout le matériel » est représenté par
-- `null`. La table `profiles` est déjà publiée et synchronisée via `select *`, donc aucune nouvelle
-- règle PowerSync ni publication n'est nécessaire.

alter table public.profiles
  add column if not exists strength_session_minutes integer null,
  add column if not exists strength_equipment jsonb null;

alter table public.profiles
  add constraint profiles_strength_session_minutes_ck
  check (
    strength_session_minutes is null
    or strength_session_minutes in (30, 45, 60, 75, 90)
  );

alter table public.profiles
  add constraint profiles_strength_equipment_ck
  check (
    strength_equipment is null
    or (
      jsonb_typeof(strength_equipment) = 'array'
      and jsonb_array_length(strength_equipment) > 0
    )
  );

comment on column public.profiles.strength_session_minutes is
  'US CORPS-04 — durée disponible par séance de musculation (30, 45, 60, 75 ou 90 minutes). null = jamais choisie.';

comment on column public.profiles.strength_equipment is
  'US CORPS-04 — équipements disponibles, tableau non vide. null = jamais choisi / tout autorisé.';
