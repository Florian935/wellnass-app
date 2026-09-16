-- US DEPENSE-00 / DEPENSE-02 — la cible calorique qui suit les dépenses réelles, et le réglage
-- d'affichage des calories dépensées.
--
-- ── 1. Un troisième mode de bonus : `activities` ─────────────────────────────────────────────────
-- `fixed` (forfait) et `auto` (dépense des courses, RN-02) restent **inchangés**. Le mode neuf est le
-- seul qui ne compte pas le sport deux fois : il pose un socle **hors sport** et y ajoute les
-- dépenses réelles de la journée (musculation + course + activités), au bas de leur fourchette.
--
-- Le défaut que ça répare, mesuré dans l'analyse (§3) : un coureur déclaré « modérément actif » voit
-- son entraînement compté une première fois dans le facteur d'activité (×1,55), puis une seconde fois
-- par le bonus `auto` — jusqu'à **95 % du déficit d'une sèche effacé**, sans la moindre alerte.
--
-- 🔴 Aucune migration de données : personne ne bascule tout seul. Un utilisateur en `auto` reste en
-- `auto` tant qu'il n'a pas vu l'aperçu avant/après et confirmé (décision D1). Changer une cible
-- calorique en silence serait exactement ce qu'il ne faut pas faire.
--
-- ── 2. `sport_free_level` — le mode de vie HORS sport ────────────────────────────────────────────
-- `null` = la question n'a jamais été posée. L'écran la pose au moment du basculement ; sans réponse,
-- le mode `activities` ne peut pas être choisi.
--
-- ── 3. `show_energy_estimates` — masquer les chiffres de dépense ─────────────────────────────────
-- Défaut `true` (comportement attendu). Sujet sensible : pour qui a un rapport compliqué à la
-- nourriture, voir « tu as brûlé 780 kcal » nourrit la logique de compensation. Masqué, **la cible
-- s'ajuste quand même** — on retire l'affichage, pas le calcul.

alter table public.nutrition_profiles
  drop constraint if exists nutrition_profiles_training_bonus_mode_check;

alter table public.nutrition_profiles
  add constraint nutrition_profiles_training_bonus_mode_check
  check (training_bonus_mode in ('fixed', 'auto', 'activities'));

alter table public.nutrition_profiles
  add column if not exists sport_free_level text
    check (sport_free_level in ('seated', 'standing', 'physical'));

comment on column public.nutrition_profiles.sport_free_level is
  'US DEPENSE-00 — mode de vie hors sport, facteur du socle en mode `activities`. NULL = jamais demandé.';
comment on column public.nutrition_profiles.training_bonus_mode is
  'fixed (forfait) · auto (dépense des courses, RN-02) · activities (socle hors sport + dépenses réelles, DEPENSE-00).';

alter table public.user_settings
  add column if not exists show_energy_estimates boolean not null default true;

comment on column public.user_settings.show_energy_estimates is
  'US DEPENSE-02 — afficher les calories dépensées. Masquées, la cible s''ajuste quand même : on retire l''affichage, pas le calcul.';
