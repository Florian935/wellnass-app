# Mon corps — maquettes de conception

13/09/2026 · Direction et version Android CORPS-01 / CORPS-02 validées par Florian.

Analyse complète : [Mon corps — diagnostic et plan d'évolution](../../docs/product/analyse-mon-corps-2026-09.md).

## Planches

1. [Explorer les muscles](01-explorer.png) — carte face/dos et détail d'une épaule après sélection / zoom.
2. [Morphologie et objectifs](02-morphologie-objectifs.png) — silhouette de départ et édition d'une intention visuelle.

Les planches contiennent quatre écrans au total. Elles restent des images statiques de conception ; le premier lot implémente l'exploration avec un dessin vectoriel anatomique ombré. Les mensurations sont des exemples fictifs. CORPS-02 implémente désormais la morphologie et les objectifs avec un renderer SVG paramétrique ; aucun maillage 3D n'est livré.

## Rendu de la silhouette

- [Éditeur FR/EN, clair/sombre et petit écran](morphology-editor-qa.png), issu du vrai JSX.
- [Vingt états de silhouette](morphology-qa.png) et [détail](morphology-detail.png).
- [Validation globale sur téléphone et scénarios archivés](../../docs/recette/mon-corps-2026-09.md).

## Priorités et entraînement — CORPS-03

- [Maquette de conception](training-priorities.html) et [planche](training-priorities.png) :
  suggestion à confirmer, lecture du programme et objectif modifié en sombre. Valeurs fictives.
- [Contrôle du vrai JSX](training-qa.png), reproductible avec
  `node design/mon-corps-2026-09/render-training-qa.cjs` : FR/EN, clair/sombre et 320 px.
- [Grande police à 320 px](training-qa-large-text.png), via la même commande avec `--large-text`.
  Approximation RN Web du texte à ×1,6, sans débordement constaté ; le réglage Android et
  TalkBack restent à recetter sur téléphone. Les données de programme sont fictives.

## Rendu du premier lot

- [Contrôle clair / sombre et articulations](anatomy-qa.png), issu du vrai composant `AnatomyFigure`.
- [Sélection et conservation du contexte](anatomy-context-qa.png) : une sélection neutre devient terracotta ; les couleurs d'un exercice restent conservées quand on sélectionne un autre muscle.
- [Version SVG/HTML](anatomy-qa.html) et contrôle du contexte, générés par `node design/mon-corps-2026-09/render-anatomy-qa.cjs`.

Ce contrôle DOM utilise les mêmes tracés, styles et dégradés que le renderer natif. Il ne valide pas les gestes, TalkBack ou les performances Android. La licence et la révision des tracés tiers sont conservées dans [vendor](../../apps/mobile/src/components/body/vendor/README.md).

Accès dans l'application du worktree : **Musculation → Suivre → Mon corps**, également depuis Progression → Mon corps et Mensurations. Les fiches d'exercices, séances de programme et le bilan proposent « Explorer les muscles » avec leur contexte.

## Direction artistique

Mannequin humain en ivoire mat, anatomie simplifiée, proportions crédibles, muscles lisibles par leurs volumes. La référence anatomique fournie par l'utilisateur guide la structure générale ; elle n'est pas reproduite comme planche médicale. La palette reprend le thème de wellness-app : crème `#f7eede`, surface `#fffaf2`, cacao `#33291f`, terracotta `#b14f2b`.

La première planche détaille les reliefs musculaires pour l'exploration. La seconde montre une surface plus lisse pour représenter une morphologie personnelle. En production, ces deux niveaux de détail devront dériver d'une source cohérente, avec les mêmes repères anatomiques.

## Points à fixer avant intégration

- La légende « Principal / Secondaire » de la première image est une illustration de contexte d'exercice. Le code actuel ne connaît pas ces rôles pour chaque muscle fin : la vue générale doit rester neutre, et afficher « Muscles ciblés » lorsque le rôle n'est pas disponible. L'exercice / la période source doivent être nommés lorsqu'une coloration représente une activité.
- La maquette d'objectif ne constitue pas une prévision du résultat physique. L'avatar de départ, les mesures saisies et l'intention visuelle doivent rester séparés.
- Le contour pointillé des épaules reste indicatif dans l'image générée. Il n'est pas une comparaison géométrique calibrée ; l'éditeur réel devra aligner exactement départ et objectif et dessiner leurs contours à partir des modèles correspondants.
- La morphologie masculine reprend le sujet de la référence, sans limiter le produit futur à une seule base corporelle.
- Les fessiers doivent rester identifiables et sélectionnables dans les assets de production, même si la présentation emploie un short neutre.
- La planche d'exploration utilise un cadre de téléphone stylisé avec certains éléments iOS. Ce cadre est illustratif ; la réalisation suit les composants et comportements Android du projet.
- Le thème sombre, les grandes polices, les cibles tactiles et le parcours TalkBack doivent être maquettés / vérifiés avant livraison.

## Génération et provenance

Images créées avec l'outil intégré **ImageGen**, sans CLI ni appel à une API configurée dans le dépôt. Les prompts complets et le prompt de correction sont conservés dans [PROMPTS.md](PROMPTS.md).

Les originaux sont conservés dans le dossier de génération de Codex. Les deux versions retenues sont copiées ici pour que les références de l'analyse soient autonomes dans le workspace.

Vérification effectuée : lecture visuelle des planches et contrôle des fichiers. Cela ne vaut ni recette de l'application, ni validation anatomique professionnelle.
