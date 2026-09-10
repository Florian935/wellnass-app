-- US NUTRI-UX01 (R6.7) — `foods.preparation_state` : cru ou cuit.
--
-- ── Pourquoi une colonne ────────────────────────────────────────────────────────────────────
-- 100 g de riz cru = ~330 kcal ; 100 g de riz cuit = ~110. Un facteur 3 sur l'aliment le plus
-- courant d'une assiette française, et la première source d'erreur de saisie de la catégorie.
-- La règle métier §8 exige « une mention **cru / cuit** sur les aliments concernés » : elle
-- n'était appliquée nulle part, et un aliment perso ou scanné n'avait aucun moyen de la porter.
--
-- ── Pourquoi elle est nullable, et pourquoi on ne migre PAS les données ─────────────────────
-- Les 80 aliments de la bibliothèque portent déjà l'information — mais **dans leur nom**
-- (« Poulet (blanc, cuit) »). Plutôt que de réécrire ces lignes, l'app la **dérive** du nom
-- quand la colonne est nulle (`resolvePreparationState`, brique pure testée). La colonne porte
-- donc l'état **déclaré**, le nom sert de repli : le badge apparaît immédiatement sur toute la
-- bibliothèque, sans une seule ligne de données touchée.
--
-- ✅ Aucune sync rule : `foods` est déjà publiée et lue en `select *`.
-- 🔴 Colonne à déclarer dans `powersync/schema.ts`, sinon l'écriture locale échoue en silence.

alter table public.foods
  add column preparation_state text
  check (preparation_state in ('raw', 'cooked'));
