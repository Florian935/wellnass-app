-- US NUTRI-UX01 (R1.3) — `nutrition_profiles.activity_level` devient NULLABLE.
--
-- ── Pourquoi ────────────────────────────────────────────────────────────────────────────────
-- La colonne était `not null default 'moderate'`. Conséquence : l'app ne pouvait pas distinguer
-- « l'utilisateur a choisi *modérément actif* » de « personne n'a jamais posé la question ».
--
-- Or c'est exactement la distinction qui manquait, et elle n'est pas cosmétique : le niveau
-- d'activité est le **multiplicateur du TDEE** (×1,2 à ×1,9). Un sédentaire à qui l'on applique
-- ×1,55 par défaut reçoit un objectif surestimé de ~614 kcal/jour — de quoi annuler tout un
-- déficit de sèche — et l'écran de réglage affichait « Modérément actif » comme une sélection
-- radio, exactement comme s'il l'avait cochée lui-même.
--
-- `null` signifie désormais **« pas encore répondu »**. Les lecteurs conservent tous leur repli
-- `?? 'moderate'` : le comportement de calcul ne change pas, c'est le **repli qui devient
-- visible** à l'écran, au lieu de se faire passer pour un choix.
--
-- ⚠️ Additive et sans perte : les lignes existantes gardent leur valeur. Un compte qui a déjà
-- réglé quoi que ce soit dans son profil nutritionnel porte donc 'moderate' en base et sera
-- considéré comme ayant choisi — on ne réécrit pas l'histoire. Les comptes qui n'ont jamais
-- ouvert ces réglages n'ont, eux, aucune ligne : ils tombent naturellement dans le cas « jamais
-- répondu ».
--
-- ✅ Aucune sync rule : `nutrition_profiles` est déjà publiée et lue en `select *`.

alter table public.nutrition_profiles
  alter column activity_level drop not null,
  alter column activity_level drop default;
