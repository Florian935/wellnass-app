# FitTrio — Refonte du pilier Nutrition

Fichier : `FitTrio - Nutrition.dc.html` — une maquette unique, navigable, clair + sombre.
Navigation : le rail de gauche liste les 10 écrans et les états particuliers (journée vide,
bilan anneau/chiffres, objectif absent, états de scan). La navigation in-app fonctionne aussi
(tap sur un aliment → détail, « + » d'un repas → sélection, etc.).

## Les 2 variantes de la carte « Bilan du jour »
Basculables en direct via le bouton ↻ dans la carte, ou depuis le rail.
- **Anneau** — anneau calorique SVG, restant au centre, consommé/objectif/restant à droite. Lecture en un coup d'œil.
- **Chiffres** — le restant en très gros (Bricolage 70px), barre de consommation, séance incluse. Plus typographique.

Les deux portent le badge terracotta « Jour de séance · +250 kcal ».

## Arbitrage : les 3 modes d'ajout
Affordance retenue (une seule, argumentée) : **chaque en-tête de repas porte un « + Ajouter un
aliment »** qui ouvre le bottom sheet de sélection ; ce sheet expose les 3 modes en haut
(Rechercher · Scanner · Texte libre). Pas de FAB flottant.

Pourquoi : l'ajout reste contextuel (on sait dans quel repas on ajoute), l'action n'est pas
répétée 6× à l'écran, et les 3 modes cohabitent au même endroit sans surcharger le journal.
Un FAB aurait perdu le contexte du repas ; répéter 3 boutons par repas aurait saturé la densité.

## Composants nouveaux introduits
- **Carte Bilan du jour** (2 variantes) — nouveau héros nutrition, remplace le bloc plat de chiffres.
- **Grille micronutriments à couverture** — mini-anneaux SVG + code couleur sobre (vert ≥70 %, ambre 45–69 %, terracotta <45 %), au lieu d'une liste terne.
- **Ligne d'aliment avec swipe** (Modifier / Supprimer) + menu par repas (Copier / Enregistrer comme modèle).
- **Sheet de sélection à 3 modes** (recherche / scan / texte) avec repli OpenFoodFacts.
- **Écran scan** : viseur + 5 états (recherche, inconnu, fiche partielle, réseau, permission).
- **Liste de révision** de la saisie rapide (lignes reconnues vs non reconnues en rouge).
- **Carte TDEE → objectif** + état « aucun objectif défini ».
- **Stats** : anneaux adhérence / complétude, courbes poids et apports.

## Réutilisés du design system existant
Tokens sémantiques clair/sombre, cadre 392×812 (bordure 9px, rayon 46px), typos Bricolage /
Hanken / Space Mono, carte héros sombre à halo accent, anneaux et barres SVG, chips 999px,
segments, boutons CTA terracotta, accordéons (repris de « Micronutriments »), barre d'onglets
basse 4 icônes, bottom sheet, states vides/skeleton (repris de « Composants »).

## Contraintes respectées
- Aucune fonctionnalité nouvelle ; toutes les fonctions décrites sont présentes.
- Libellés FR, formulés court pour encaisser +30 % en traduction EN.
- Portable React Native : flexbox, dégradés linéaires simples, ombres, SVG — pas de `backdrop-filter`.
- Contrastes renforcés : textes atténués assombris (`--mut`, `--sub`), texte toujours `#fff` sur accent.
