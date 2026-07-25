-- MUSC-F3 — Recherche d'exercices multi-critères.
-- Contrainte de liste contrôlée sur `exercises.equipment` (colonne déjà existante et
-- nullable ; aucune colonne ajoutée). Aligne le matériel sur l'enum `EQUIPMENTS` de
-- `packages/shared` (désormais branché : admin `<select>`, i18n mobile, filtre du picker).
-- Réf. : docs/specs/functional/us/muscf3-recherche-multicriteres.md §4.1.
--
-- ⚠️ Non idempotente (`add constraint` échoue si rejouée) — conforme à la règle projet
--    « jamais rejouer une migration appliquée ».
-- ⚠️ Vérifier AVANT de pousser qu'aucune valeur `equipment` hors liste n'existe déjà sur le
--    cloud (sinon l'ajout de contrainte échoue) :
--      select distinct equipment from exercises where equipment is not null;

alter table public.exercises
  add constraint exercises_equipment_check
  check (
    equipment is null
    or equipment in (
      'barbell', 'dumbbell', 'machine', 'cable',
      'bodyweight', 'kettlebell', 'band', 'other'
    )
  );
