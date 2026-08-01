-- US NUTR-F2 — portions de référence des aliments de bibliothèque.
--
-- 50 des 80 aliments de la bibliothèque CIQUAL n'avaient aucune portion déclarée (`portions = '[]'`).
-- Constaté en recette device du 01/08/2026 : les suggestions « combler un macro » sortaient toutes à
-- exactement 200 g — la borne de repli appliquée faute de portion connue
-- (`SUGGESTION_NO_PORTION_MAX_G`). Le plafonnement par portion ne pouvait donc pas jouer son rôle.
--
-- Ces portions servent deux usages : plafond de quantité des suggestions de macro, et raccourci de
-- saisie au journal. Ce sont des **portions usuelles**, pas des maxima.
--
-- Idempotente : `update` ciblé par id, rejouable sans effet de bord. La source de vérité reste
-- supabase/scripts/enrich-ciqual/foods-catalog.json, mis à jour en même temps — une régénération du
-- seed conservera donc ces valeurs.
--
-- Les aliments qui avaient déjà une portion sont réécrits à l'identique (l'UPDATE porte sur les 80),
-- ce qui garde le fichier aligné sur le catalogue plutôt que sur un sous-ensemble à retenir.

update public.foods as f
set portions = v.portions,
    updated_at = now()
from (
values
  ('d1000001-0000-4000-8000-000000000000', '[{"labelFr": "1 blanc", "labelEn": "1 breast", "grams": 120}]'::jsonb), -- Poulet (blanc, cuit)
  ('d1000002-0000-4000-8000-000000000000', '[{"labelFr": "1 steak", "labelEn": "1 patty", "grams": 125}]'::jsonb), -- Bœuf haché 5%
  ('d1000003-0000-4000-8000-000000000000', '[{"labelFr":"1 tranche","labelEn":"1 slice","grams":40}]'::jsonb), -- Jambon blanc
  ('d1000004-0000-4000-8000-000000000000', '[{"labelFr":"1 steak","labelEn":"1 steak","grams":150}]'::jsonb), -- Steak de bœuf
  ('d1000005-0000-4000-8000-000000000000', '[{"labelFr": "1 escalope", "labelEn": "1 cutlet", "grams": 120}]'::jsonb), -- Escalope de dinde
  ('d1000006-0000-4000-8000-000000000000', '[{"labelFr":"1 pavé","labelEn":"1 fillet","grams":130}]'::jsonb), -- Saumon
  ('d1000007-0000-4000-8000-000000000000', '[{"labelFr":"1 boîte","labelEn":"1 can","grams":112}]'::jsonb), -- Thon au naturel
  ('d1000008-0000-4000-8000-000000000000', '[{"labelFr": "1 pavé", "labelEn": "1 fillet", "grams": 130}]'::jsonb), -- Cabillaud
  ('d1000009-0000-4000-8000-000000000000', '[{"labelFr": "1 portion", "labelEn": "1 serving", "grams": 100}]'::jsonb), -- Crevettes
  ('d1000010-0000-4000-8000-000000000000', '[{"labelFr":"1 bol","labelEn":"1 bowl","grams":150}]'::jsonb), -- Riz blanc cuit
  ('d1000011-0000-4000-8000-000000000000', '[{"labelFr":"1 assiette","labelEn":"1 plate","grams":200}]'::jsonb), -- Pâtes cuites
  ('d1000012-0000-4000-8000-000000000000', '[{"labelFr":"1 tranche","labelEn":"1 slice","grams":30}]'::jsonb), -- Pain complet
  ('d1000013-0000-4000-8000-000000000000', '[{"labelFr":"1 tranche","labelEn":"1 slice","grams":25}]'::jsonb), -- Pain de mie
  ('d1000014-0000-4000-8000-000000000000', '[{"labelFr":"1 baguette","labelEn":"1 baguette","grams":250}]'::jsonb), -- Baguette
  ('d1000015-0000-4000-8000-000000000000', '[{"labelFr": "1 pomme de terre", "labelEn": "1 potato", "grams": 150}]'::jsonb), -- Pomme de terre cuite
  ('d1000016-0000-4000-8000-000000000000', '[{"labelFr":"1 bol","labelEn":"1 bowl","grams":40}]'::jsonb), -- Flocons d'avoine
  ('d1000017-0000-4000-8000-000000000000', '[{"labelFr": "1 portion", "labelEn": "1 serving", "grams": 150}]'::jsonb), -- Quinoa cuit
  ('d1000018-0000-4000-8000-000000000000', '[{"labelFr": "1 portion", "labelEn": "1 serving", "grams": 150}]'::jsonb), -- Semoule cuite
  ('d1000019-0000-4000-8000-000000000000', '[{"labelFr": "1 portion", "labelEn": "1 serving", "grams": 150}]'::jsonb), -- Lentilles cuites
  ('d1000020-0000-4000-8000-000000000000', '[{"labelFr": "1 portion", "labelEn": "1 serving", "grams": 150}]'::jsonb), -- Brocoli
  ('d1000021-0000-4000-8000-000000000000', '[{"labelFr":"1 carotte","labelEn":"1 carrot","grams":80}]'::jsonb), -- Carotte
  ('d1000022-0000-4000-8000-000000000000', '[{"labelFr":"1 tomate","labelEn":"1 tomato","grams":120}]'::jsonb), -- Tomate
  ('d1000023-0000-4000-8000-000000000000', '[{"labelFr": "1 courgette", "labelEn": "1 zucchini", "grams": 200}]'::jsonb), -- Courgette
  ('d1000024-0000-4000-8000-000000000000', '[{"labelFr": "1 portion", "labelEn": "1 serving", "grams": 150}]'::jsonb), -- Épinards
  ('d1000025-0000-4000-8000-000000000000', '[{"labelFr": "1 portion", "labelEn": "1 serving", "grams": 150}]'::jsonb), -- Haricots verts
  ('d1000026-0000-4000-8000-000000000000', '[{"labelFr":"1 poivron","labelEn":"1 pepper","grams":150}]'::jsonb), -- Poivron
  ('d1000027-0000-4000-8000-000000000000', '[{"labelFr": "1 portion", "labelEn": "1 serving", "grams": 50}]'::jsonb), -- Salade verte
  ('d1000028-0000-4000-8000-000000000000', '[{"labelFr":"1 banane","labelEn":"1 banana","grams":120}]'::jsonb), -- Banane
  ('d1000029-0000-4000-8000-000000000000', '[{"labelFr":"1 pomme","labelEn":"1 apple","grams":150}]'::jsonb), -- Pomme
  ('d1000030-0000-4000-8000-000000000000', '[{"labelFr":"1 orange","labelEn":"1 orange","grams":130}]'::jsonb), -- Orange
  ('d1000031-0000-4000-8000-000000000000', '[{"labelFr": "1 portion", "labelEn": "1 serving", "grams": 150}]'::jsonb), -- Fraises
  ('d1000032-0000-4000-8000-000000000000', '[{"labelFr": "1 portion", "labelEn": "1 serving", "grams": 100}]'::jsonb), -- Myrtilles
  ('d1000033-0000-4000-8000-000000000000', '[{"labelFr":"1 kiwi","labelEn":"1 kiwi","grams":75}]'::jsonb), -- Kiwi
  ('d1000034-0000-4000-8000-000000000000', '[{"labelFr": "1 portion", "labelEn": "1 serving", "grams": 150}]'::jsonb), -- Raisin
  ('d1000035-0000-4000-8000-000000000000', '[{"labelFr": "1 tranche", "labelEn": "1 slice", "grams": 100}]'::jsonb), -- Ananas
  ('d1000036-0000-4000-8000-000000000000', '[{"labelFr":"1 œuf","labelEn":"1 egg","grams":60}]'::jsonb), -- Œuf
  ('d1000037-0000-4000-8000-000000000000', '[{"labelFr":"1 verre","labelEn":"1 glass","grams":200}]'::jsonb), -- Lait demi-écrémé
  ('d1000038-0000-4000-8000-000000000000', '[{"labelFr":"1 pot","labelEn":"1 pot","grams":125}]'::jsonb), -- Yaourt nature
  ('d1000039-0000-4000-8000-000000000000', '[{"labelFr":"1 pot","labelEn":"1 pot","grams":100}]'::jsonb), -- Fromage blanc 0%
  ('d1000040-0000-4000-8000-000000000000', '[{"labelFr":"1 portion","labelEn":"1 portion","grams":30}]'::jsonb), -- Emmental
  ('d1000041-0000-4000-8000-000000000000', '[{"labelFr": "1 boule", "labelEn": "1 ball", "grams": 125}]'::jsonb), -- Mozzarella
  ('d1000042-0000-4000-8000-000000000000', '[{"labelFr":"1 poignée","labelEn":"1 handful","grams":30}]'::jsonb), -- Amandes
  ('d1000043-0000-4000-8000-000000000000', '[{"labelFr":"1 c. à soupe","labelEn":"1 tbsp","grams":15}]'::jsonb), -- Beurre de cacahuète
  ('d1000044-0000-4000-8000-000000000000', '[{"labelFr": "1 poignée", "labelEn": "1 handful", "grams": 30}]'::jsonb), -- Noix
  ('d1000045-0000-4000-8000-000000000000', '[{"labelFr":"1 verre","labelEn":"1 glass","grams":200}]'::jsonb), -- Jus d'orange
  ('d1000046-0000-4000-8000-000000000000', '[{"labelFr":"1 tasse","labelEn":"1 cup","grams":100}]'::jsonb), -- Café noir
  ('d1000047-0000-4000-8000-000000000000', '[{"labelFr":"1 canette","labelEn":"1 can","grams":330}]'::jsonb), -- Coca-Cola
  ('d1000048-0000-4000-8000-000000000000', '[{"labelFr":"1 c. à soupe","labelEn":"1 tbsp","grams":10}]'::jsonb), -- Huile d'olive
  ('d1000049-0000-4000-8000-000000000000', '[{"labelFr":"1 carré","labelEn":"1 square","grams":10}]'::jsonb), -- Chocolat noir
  ('d1000050-0000-4000-8000-000000000000', '[{"labelFr":"1 c. à café","labelEn":"1 tsp","grams":5}]'::jsonb), -- Sucre
  ('d1000051-0000-4000-8000-000000000000', '[{"labelFr": "1 poire", "labelEn": "1 pear", "grams": 150}]'::jsonb), -- Poire
  ('d1000052-0000-4000-8000-000000000000', '[{"labelFr": "1 pêche", "labelEn": "1 peach", "grams": 150}]'::jsonb), -- Pêche
  ('d1000053-0000-4000-8000-000000000000', '[{"labelFr": "1 abricot", "labelEn": "1 apricot", "grams": 50}]'::jsonb), -- Abricot
  ('d1000054-0000-4000-8000-000000000000', '[{"labelFr": "1 portion", "labelEn": "1 serving", "grams": 100}]'::jsonb), -- Cerise
  ('d1000055-0000-4000-8000-000000000000', '[{"labelFr": "1 tranche", "labelEn": "1 slice", "grams": 200}]'::jsonb), -- Pastèque
  ('d1000056-0000-4000-8000-000000000000', '[{"labelFr": "1 portion", "labelEn": "1 serving", "grams": 200}]'::jsonb), -- Melon
  ('d1000057-0000-4000-8000-000000000000', '[{"labelFr": "1 mangue", "labelEn": "1 mango", "grams": 200}]'::jsonb), -- Mangue
  ('d1000058-0000-4000-8000-000000000000', '[{"labelFr": "1 portion", "labelEn": "1 serving", "grams": 100}]'::jsonb), -- Framboise
  ('d1000059-0000-4000-8000-000000000000', '[{"labelFr": "1 citron", "labelEn": "1 lemon", "grams": 100}]'::jsonb), -- Citron
  ('d1000060-0000-4000-8000-000000000000', '[{"labelFr": "1 avocat", "labelEn": "1 avocado", "grams": 150}]'::jsonb), -- Avocat
  ('d1000061-0000-4000-8000-000000000000', '[{"labelFr": "1 portion", "labelEn": "1 serving", "grams": 100}]'::jsonb), -- Concombre
  ('d1000062-0000-4000-8000-000000000000', '[{"labelFr": "1 oignon", "labelEn": "1 onion", "grams": 100}]'::jsonb), -- Oignon
  ('d1000063-0000-4000-8000-000000000000', '[{"labelFr": "1 portion", "labelEn": "1 serving", "grams": 100}]'::jsonb), -- Champignon de Paris
  ('d1000064-0000-4000-8000-000000000000', '[{"labelFr": "1 portion", "labelEn": "1 serving", "grams": 150}]'::jsonb), -- Aubergine
  ('d1000065-0000-4000-8000-000000000000', '[{"labelFr": "1 portion", "labelEn": "1 serving", "grams": 150}]'::jsonb), -- Chou-fleur
  ('d1000066-0000-4000-8000-000000000000', '[{"labelFr": "1 poireau", "labelEn": "1 leek", "grams": 100}]'::jsonb), -- Poireau
  ('d1000067-0000-4000-8000-000000000000', '[{"labelFr": "1 portion", "labelEn": "1 serving", "grams": 150}]'::jsonb), -- Petits pois
  ('d1000068-0000-4000-8000-000000000000', '[{"labelFr": "1 portion", "labelEn": "1 serving", "grams": 100}]'::jsonb), -- Maïs doux
  ('d1000069-0000-4000-8000-000000000000', '[{"labelFr": "1 portion", "labelEn": "1 serving", "grams": 100}]'::jsonb), -- Betterave rouge
  ('d1000070-0000-4000-8000-000000000000', '[{"labelFr": "1 patate douce", "labelEn": "1 sweet potato", "grams": 150}]'::jsonb), -- Patate douce
  ('d1000071-0000-4000-8000-000000000000', '[{"labelFr": "1 côte", "labelEn": "1 chop", "grams": 150}]'::jsonb), -- Côte de porc
  ('d1000072-0000-4000-8000-000000000000', '[{"labelFr": "1 boîte", "labelEn": "1 can", "grams": 100}]'::jsonb), -- Sardine
  ('d1000073-0000-4000-8000-000000000000', '[{"labelFr": "1 filet", "labelEn": "1 fillet", "grams": 100}]'::jsonb), -- Maquereau
  ('d1000074-0000-4000-8000-000000000000', '[{"labelFr": "1 filet", "labelEn": "1 fillet", "grams": 120}]'::jsonb), -- Truite
  ('d1000075-0000-4000-8000-000000000000', '[{"labelFr": "1 cuisse", "labelEn": "1 thigh", "grams": 150}]'::jsonb), -- Cuisse de poulet
  ('d1000076-0000-4000-8000-000000000000', '[{"labelFr": "1 portion", "labelEn": "1 serving", "grams": 150}]'::jsonb), -- Pois chiches
  ('d1000077-0000-4000-8000-000000000000', '[{"labelFr": "1 portion", "labelEn": "1 serving", "grams": 150}]'::jsonb), -- Haricots rouges
  ('d1000078-0000-4000-8000-000000000000', '[{"labelFr": "1 portion", "labelEn": "1 serving", "grams": 100}]'::jsonb), -- Tofu
  ('d1000079-0000-4000-8000-000000000000', '[{"labelFr": "1 poignée", "labelEn": "1 handful", "grams": 30}]'::jsonb), -- Noisette
  ('d1000080-0000-4000-8000-000000000000', '[{"labelFr": "1 poignée", "labelEn": "1 handful", "grams": 30}]'::jsonb)  -- Noix de cajou
) as v(id, portions)
where f.id = v.id::uuid
  and f.source = 'library';
