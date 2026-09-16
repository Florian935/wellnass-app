# Dépense & activités — maquettes

15/09/2026 · exploration, **non validée pour implémentation**. Aucune ligne de code applicatif écrite.

Analyse, chiffres et décisions : [docs/product/analyse-depense-activites-2026-09.md](../../docs/product/analyse-depense-activites-2026-09.md) ·
toile publiée : https://claude.ai/artifact/JzRGWW3ze6NbhgMP7MiNw9

## Contenu

Les sources sont les `.dc.html` et `canvas.json`. La page assemblée
(`depense-et-activites.html`, ~2,5 Mo d'éditeur embarqué) est **régénérée** à partir d'elles —
inutile de la versionner.

| Planche | Sujet |
|---|---|
| [Main.dc.html](Main.dc.html) | Compte rendu visuel : constats, le double comptage chiffré, le modèle, le plan, les 9 décisions |
| [FinSeance.dc.html](FinSeance.dc.html) | Bilan de séance muscu : « ≈ 370 kcal », fourchette, effet sur la journée |
| [DOuVient.dc.html](DOuVient.dc.html) | Feuille « D'où vient ce chiffre » : les 4 étapes, la confiance, la montre, le niveau |
| [FinCourse.dc.html](FinCourse.dc.html) | Résumé de course : dénivelé compté, cas du tapis sans GPS |
| [Journee.dc.html](Journee.dc.html) | Scène Nutrition + « Ta journée en énergie » (socle, objectif, activités, reste) |
| [AjoutActivite.dc.html](AjoutActivite.dc.html) | Saisie d'une activité : type, durée, intensité au test de la parole |
| [ActiviteEnregistree.dc.html](ActiviteEnregistree.dc.html) | « Ce que ça change » : cible, série, charge, jour d'entraînement, Health Connect |
| [Reglage.dc.html](Reglage.dc.html) | Le réglage qui répare le double comptage, avec aperçu avant / après |
| [Variantes.dc.html](Variantes.dc.html) | Trois façons d'afficher une estimation, dont une **écartée** (l'équivalent pizza) |
| [Prototype.dc.html](Prototype.dc.html) | **Jouable** : profil réglable (âge, taille, poids, sexe), séance, activité, journée, calcul visible |

## Ce que les maquettes supposent

- Le **modèle proposé** de l'analyse (§4) : socle hors sport + dépense nette au bas de la fourchette.
  Rien de tout cela n'existe dans l'app aujourd'hui.
- Les **MET du Compendium 2011**, à revérifier dans la table 2024 avant toute spec.
- Le **régime de guidage** (GUID-01, livré) pour le ton des suggestions.

## Direction

Tokens de l'app (`apps/mobile/src/theme/`) : crème `#f7eede`, surface `#fffaf2`, cacao `#33291f`,
terracotta `#b14f2b` ; scènes de pilier `#6b0028` (muscu), `#2a64ad` (course), `#22301a` (nutrition).
Bricolage Grotesque (titres, gros chiffres), Hanken Grotesk (corps), Space Mono (chiffres).
Icônes SVG dessinées, sans emoji.

## Limites

Thème clair seulement, **français seulement**, **données fictives** (profil A : homme, 30 ans,
180 cm, 80 kg). Pas de passe d'accessibilité (TalkBack, grandes polices). Le bilan de séance réel
(`WorkoutReport`) est résumé, pas reproduit bloc par bloc. Le prototype applique les formules de
l'analyse, **pas** le code de l'app. Contrôlé par capture d'écran à la taille réelle : ce n'est ni
une recette ni une validation produit.
