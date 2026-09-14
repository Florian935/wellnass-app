# Mon corps — analyse et proposition d'évolution

Analyse initiale du 12/09/2026, direction validée par Florian. Le diagnostic ci-dessous décrit
le code avant refonte. Au 13/09/2026, **CORPS-01 et CORPS-02 sont implémentés et validés sur
téléphone**. CORPS-03 réalise le premier incrément du lot 3 : priorités confirmées et lecture
du programme. L'adaptation automatique avec contraintes reste l'incrément suivant.

Suivi courant : [CORPS-01](../specs/functional/us/corps01-explorateur.md),
[CORPS-02](../specs/functional/us/corps02-morphologie.md),
[CORPS-03](../specs/functional/us/corps03-priorites-entrainement.md).

Demande : remplacer le schéma humain actuel par un modèle anatomique élégant, explorer les muscles au toucher, personnaliser la morphologie et exprimer des objectifs visuels qui pourront orienter un entraînement.

## 1. Recommandation

Construire progressivement un espace **Mon corps**, accessible depuis Musculation. Commencer par une carte anatomique de qualité, face et dos, interactive et réutilisable dans les écrans existants. Ajouter ensuite un avatar dont les proportions sont ajustables, puis une traduction des intentions visuelles en priorités d'entraînement.

La direction visuelle proposée : un **mannequin anatomique sculpté**, aux volumes humains continus, avec une surface ivoire mate et des groupes musculaires lisibles. La référence fournie guide les proportions et la position des muscles. Le rendu conserve beaucoup moins de détails : visage neutre, pas de fibres musculaires ni d'os apparents, relief discret et terracotta uniquement sur les zones pertinentes.

Les quatre écrans de conception sont réunis dans deux planches : [exploration](../../design/mon-corps-2026-09/01-explorer.png) et [morphologie / objectifs](../../design/mon-corps-2026-09/02-morphologie-objectifs.png). Ce sont des images de conception, pas un prototype cliquable ni un modèle 3D exploitable.

## 2. Où se trouve le schéma actuel ?

Parcours relevés dans le code local ; ils n'ont pas été rejoués sur l'APK installé sur le téléphone.

| Endroit | Chemin dans l'interface | Implantation |
|---|---|---|
| Fiche d'exercice | Musculation → tout en bas, **Exercices, programmes, templates** → ouvrir un exercice | [exercises/[id].tsx](../../apps/mobile/src/app/exercises/[id].tsx), ligne 176 |
| Séance d'un programme | Ouvrir un programme → **déplier une séance contenant des exercices** | [programs/[id].tsx](../../apps/mobile/src/app/programs/[id].tsx), ligne 325 |
| Bilan hebdomadaire | Réglages → **Suivi → Bilan de la semaine** → **Muscles sollicités** ; également depuis la carte de régularité de l'accueil si elle est affichée | [review.tsx](../../apps/mobile/src/app/review.tsx), ligne 196 |
| Zones sensibles | Réglages → activer **Journal des zones sensibles** → **Signaler une zone** | [pain.tsx](../../apps/mobile/src/app/pain.tsx), ligne 86 |

Il n'existe pas de destination dédiée « Mon corps ». Le schéma est actuellement un complément au milieu d'autres contenus. Le détail d'une séance de programme est repliable, et les accès au bilan / journal sont peu évocateurs d'une carte musculaire : cela explique en partie la difficulté à le retrouver.

## 3. Diagnostic : ce qui existe et ce qui manque

### Le problème visuel est dans la géométrie

[BodyMap.tsx](../../apps/mobile/src/components/body/BodyMap.tsx) dessine deux petits SVG de 100 × 168, avec une ellipse pour la tête, un rectangle pour le cou et **11 tracés essentiellement rectangulaires** pour 10 groupes. Les quadriceps forment par exemple une bande allant presque jusqu'aux pieds ; le biceps est une longue bande qui ne distingue pas bras et avant-bras. Une nouvelle couleur ou une ombre ne suffira pas : les contours et proportions doivent être refaits.

La [spécification initiale](../specs/functional/us/muscf1b-schema-muscles.md) exigeait déjà une relecture anatomique. L'état généré du projet indique encore cette US en recette. Il faut donc valider le nouveau dessin à sa taille réelle d'affichage, muscle par muscle.

### Des fondations sont réutilisables

| Brique | Constat dans le dépôt | Apport au projet |
|---|---|---|
| Référentiel musculaire | 6 groupes larges et 10 groupes plus précis dans [exercise.ts](../../packages/shared/src/exercise.ts) | Identifiants à conserver ; plusieurs pièces graphiques peuvent correspondre au même identifiant |
| Muscles associés aux exercices | `musclePrimary`, `musclesSecondary`, `musclesFine`, avec repli si le marquage fin manque | Alimenter la carte et la liste d'exercices associés |
| Carte interactive | [PainBodyMap.tsx](../../apps/mobile/src/components/body/PainBodyMap.tsx) reçoit déjà `onSelect` | Expérience de sélection existante, avec parcours textuel accessible |
| Mensurations | Taille abdominale, poitrine, hanches, bras, cuisse, mollet | Repères facultatifs pour personnaliser l'avatar |
| Profil et poids | Taille dans le profil ; historique du poids dans `body_weight_entries` | Réutiliser les sources existantes, sans créer un second historique de poids |
| Données d'entraînement | Exercices, séries, charges, répétitions et RPE selon les saisies | Décrire le réalisé et, plus tard, contextualiser les priorités |
| Socle technique | Expo 57, React Native, SVG, Gesture Handler, Reanimated, PowerSync / Supabase | Carte 2D locale possible avec les dépendances présentes |

La présence d'un champ ne prouve pas qu'il est rempli dans le catalogue réel. La **couverture et la qualité du marquage musculaire** restent à auditer sur les données avant de promettre des statistiques fines.

### Trois limites sémantiques à traiter

1. **Les deux intensités actuelles ne sont pas des mesures physiologiques.** Pour un exercice tagué fin, tous ses muscles sont en pleine emphase. Le modèle ne conserve pas un rôle principal / secondaire pour chaque muscle fin. La légende doit dépendre du contexte : « muscles ciblés » si le rôle n'est pas connu, et principal / secondaire uniquement lorsqu'il est disponible.
2. **Le bilan n'affiche pas un continuum d'intensité.** `resolveTonnageFineMuscles` donne la pleine emphase aux muscles au tonnage maximal, et une emphase réduite aux autres muscles de tonnage positif. Le tonnage d'un exercice est attribué à chacun des muscles associés. Ce n'est ni une part additive du volume total, ni une mesure de croissance ou de récupération.
3. **Les nouvelles analyses ne doivent pas contredire les anciennes.** Un module de répartition par groupe primaire est présent dans le travail local en cours ([session-muscle-split.ts](../../packages/shared/src/session-muscle-split.ts)). Son statut n'a pas été validé ici. Ses comptes ne sont pas interchangeables avec ceux du bilan hebdomadaire. Chaque vue doit nommer ce qu'elle compte et sa période.

## 4. Positionnement : ce qui pourrait faire la différence

Le schéma musculaire et les zones cliquables existent déjà sur le marché : Hevy documente une carte des muscles travaillés et des statistiques par groupe ; Fitbod documente un avatar face/dos, l'historique d'un groupe sélectionné et une estimation de récupération. [Source Hevy](https://www.hevyapp.com/features/training-chart/), [source Fitbod](https://help.fitbod.me/hc/en-us/articles/360006269014-Muscle-Recovery).

**Hypothèse de différenciation à tester :** permettre à quelqu'un d'exprimer simplement « j'aimerais développer cette zone », puis relier cette intention à des choix d'entraînement compréhensibles et à ses propres observations dans le temps. Cette recherche ciblée ne démontre pas l'absence de concurrents proposant déjà un éditeur morphologique.

La boucle produit envisagée : **se représenter → exprimer une intention → choisir des priorités → pratiquer → observer → ajuster**. L'intégration avec les trois piliers de FitTrio peut renforcer ce parcours, tout en restant facultative conformément au cadrage existant.

## 5. Expérience proposée

### Accès et navigation

- Une entrée explicite **Mon corps** dans la section « Suivre » du hub Musculation, disponible même sans historique. Le placement doit être testé dans le hub existant, sans ajouter un nouvel onglet principal.
- Une version compacte du même dessin dans les fiches d'exercices, les séances de programme et le bilan. Un toucher ouvre l'explorateur avec le muscle et le contexte déjà sélectionnés.
- Un accès secondaire depuis les mensurations. Le parcours initial reste utilisable sans se mesurer et sans personnaliser un avatar.
- Le journal de zones sensibles conserve son usage propre. Une douleur déclarée n'est pas affichée comme une priorité de développement musculaire.

### Écran A — Explorer

Deux vues face / dos sur une grande surface, une seule zone sélectionnée à la fois, noms affichés à la demande. Un bouton permet de passer en grand format ; le zoom au pincement s'accompagne de boutons + / − et « Recentrer ». Dans les petites cartes, les deux vues restent côte à côte ; en grand format, une bascule face / dos libère de la place.

Un toucher ouvre une fiche courte : nom courant, nom anatomique utile, exercices associés et, si les données le permettent, activité récente avec période explicite. Les gestes de navigation / zoom doivent rester distincts de l'édition de proportions : déplacer la caméra ne modifie jamais le corps.

La liste textuelle des muscles constitue un parcours complet équivalent, utilisable avec TalkBack. Elle permet aussi de sélectionner facilement une petite région sans viser un minuscule tracé.

### Écran B — Ma silhouette de départ

Une base humaine neutre, puis des réglages facultatifs de proportions. Proposer à terme plusieurs morphologies de base, sans imposer un corps très sec et musclé. Leur choix reste indépendant du champ de sexe utilisé ailleurs par l'application.

Les mensurations déjà enregistrées peuvent servir de **repères datés**. Elles ne déterminent pas à elles seules une forme 3D unique : plusieurs corps peuvent partager les mêmes circonférences. Tant qu'une calibration géométrique n'est pas validée, afficher une silhouette personnalisée approximative, et non prétendre qu'un chiffre en cm est exactement reproduit par le maillage.

Éditer l'avatar ne réécrit jamais les mesures enregistrées. Les mesures anciennes ou absentes restent identifiées comme telles ; aucune valeur inventée n'est enregistrée pour compléter le modèle.

### Écran C — Mon objectif visuel

À partir d'une copie de la silhouette de départ : sélectionner les épaules, les bras, la poitrine, le dos, les fessiers ou les jambes ; ajuster progressivement leur volume visuel avec un curseur. Réglage symétrique au premier lot. Annuler, réinitialiser une zone, comparer départ / objectif dans la même pose et enregistrer explicitement.

Le mode « départ » ajuste la représentation des proportions actuelles. Le mode « objectif » modifie seulement les volumes retenus pour exprimer une intention ; il ne propose pas de changer les longueurs osseuses comme résultat d'entraînement. Les changements de silhouette globale demandent un cadrage distinct, sans transformer une réduction locale dessinée en promesse d'action locale d'un exercice.

Les réglages sont des paramètres de dessin. « +20 % » sur un curseur ne deviendrait donc ni « +20 % de muscle » ni une date d'obtention. La copie produit proposée est **Illustration d'intention**. La première version peut employer des graduations qualitatives plutôt que des pourcentages.

### Écran D — Mes priorités d'entraînement, ultérieurement

L'utilisateur confirme les priorités déduites de son dessin : par exemple épaules en priorité et maintien d'un travail global. Le programme dépend aussi de l'expérience, du temps disponible, du matériel, du programme actuel et des contraintes déclarées.

Le système commence par proposer des adaptations explicables de programmes existants. Il montre ce qu'il change et pourquoi, avant application. Un moteur de règles et des contenus relus suffisent pour cette étape ; une IA générative n'est pas un prérequis. Les éventuelles interactions avec la course et la nutrition utilisent les opt-in du produit.

## 6. Trois approches techniques

| Approche | Points forts | Coûts et limites | Choix proposé |
|---|---|---|---|
| Dessin vectoriel 2D / SVG | Léger, hors-ligne, précis au toucher, déjà intégré | Déformation complexe à maintenir simultanément de face et de dos ; pas de rotation libre | Excellent pour un premier remplacement visuel |
| **Source 3D commune, affichage 2D d'abord, 3D dans l'éditeur ensuite** | Qualité visuelle, cohérence face/dos, réutilisation de la source pour les déformations futures | Exige une vraie production graphique ; images, masques et modèle doivent rester alignés | **Recommandé pour la vision complète** |
| 3D temps réel partout dès le départ | Rotation et déformation disponibles dans tous les contextes | Intégration native, chargement, GPU / batterie, tests device, travail sur le modèle ; disproportionné pour les petites cartes | À réserver à l'éditeur tant que sa valeur n'est pas démontrée ailleurs |

**Ce que signifie l'option recommandée :** créer ou acquérir une source 3D éditable avec droits de modification et de distribution adaptés, en tirer deux vues orthographiques de qualité et leurs masques musculaires, puis n'embarquer au premier lot que ces assets 2D. Les zones sélectionnables sont exportées / calées avec les mêmes caméras ; elles ne sont pas redessinées approximativement au-dessus d'une image différente.

Le futur modèle 3D est déformé par des formes préparées, souvent appelées *morph targets* : le curseur interpole vers une forme d'épaule plus ou moins volumineuse. Les combinaisons de paramètres nécessitent des corrections pour conserver des jonctions naturelles. Le format glTF peut porter ces déformations et Three.js expose leurs influences. [Export glTF de Blender](https://docs.blender.org/manual/en/4.1/addons/import_export/scene_gltf2.html), [Mesh dans Three.js](https://threejs.org/docs/pages/Mesh.html).

React Three Fiber documente un point d'entrée React Native utilisant Expo GL ; Expo propose GLView pour le SDK 57. C'est une **piste technique documentée, pas une compatibilité déjà démontrée dans ce dépôt**. Le choix de versions, les gestes, les assets, les déformations et la stabilité devront être testés dans le dev build Android réel. [React Three Fiber](https://r3f.docs.pmnd.rs/getting-started/installation), [Expo GLView 57](https://docs.expo.dev/versions/v57.0.0/sdk/gl-view/).

Les PNG générés pour cette analyse définissent une direction artistique. Ils ne remplacent pas le travail de création d'un SVG anatomique, d'un maillage propre, des masques et des déformations contrôlées.

## 7. Découpage de l'architecture

Garder le dessin, les données corporelles et les décisions d'entraînement indépendants.

| Bloc proposé | Responsabilité | Dépendances |
|---|---|---|
| Référentiel anatomique | Identifiants stables, noms FR/EN, vues, correspondance vers les 6 / 10 groupes existants | `@wellness/shared` |
| Assets corporels versionnés | Images face/dos, contours de sélection, puis maillage et morph targets | Source graphique et contrat d'identifiants |
| Rendu de carte | Affichage, sélection et zoom ; versions compacte et explorateur | Assets + état fourni par l'appelant, sans accès direct à la base |
| Adaptateurs de contexte | Convertir fiche d'exercice, séance, bilan ou journal de sensibilité en état d'affichage | Repositories et règles actuels |
| Profil visuel | Paramètres choisis, base utilisée, version d'asset, date et provenance | Repository dédié si persistance activée |
| Intention visuelle | Copie de départ référencée, modifications et priorités confirmées | Profil visuel ; séparé des mesures réelles |
| Recommandations | Transformer les priorités confirmées et contraintes en proposition de plan | Catalogue, programmation, historique ; indépendant du renderer |

Les futures tables personnelles passeront par les repositories, migrations versionnées, règles d'accès et synchronisation PowerSync habituels. Prévoir des sauvegardes atomiques par version d'avatar, un brouillon local pendant le déplacement des curseurs et une migration explicite des paramètres si l'asset change.

**Dépendance à ne pas rater :** `PainBodyMap` importe directement `MUSCLE_PATHS` depuis `BodyMap` et fixe les articulations dans le même repère. Changer ces tracés seuls déplacerait les muscles sous des pastilles articulaires restées à l'ancienne position. Extraire une géométrie commune versionnée, puis recaler les articulations et vérifier ce parcours séparément.

Les 10 groupes suffisent à démarrer. Le dessin peut montrer plusieurs subdivisions pour leur donner une forme crédible sans inventer autant de nouvelles catégories en base. Séparer ensuite trapèzes / dorsaux ou les faisceaux du deltoïde demanderait une évolution du référentiel et un marquage fiable du catalogue ; ce serait un lot distinct.

## 8. Plan d'analyse et de livraison progressive

Les charges ci-dessous sont des **ordres de grandeur en jours de travail humain**, pas des délais garantis ni une estimation du temps d'un agent. Elles supposent un développeur connaissant le dépôt, une contribution de design / modélisation et des relectures produit / anatomie. Les retours, l'acquisition d'assets et les tests sur appareils peuvent allonger le calendrier.

| Lot | Travail | Résultat / décision de sortie | Ordre de grandeur |
|---|---|---|---|
| **0 — Cadrage graphique et essai technique** | Rejouer les accès sur APK ; auditer le marquage ; fixer le style et le niveau anatomique ; essayer un modèle local, sa sélection et une déformation sur Android | Dessin validable à taille réelle, source exploitable, décision sur 2D / 3D | 3–5 jours |
| **1 — Carte anatomique et exploration** | Produire les assets ; remplacer le dessin aux 3 emplacements ; recaler le journal sensible ; créer l'accès Mon corps, fiche muscle et zoom | Première version utile, esthétique et entièrement hors-ligne | 8–15 jours |
| **2 — Morphologie et intention visuelle** | Bases corporelles, paramètres, combinaisons, éditeur, comparaison, repères de mensurations, persistance et synchro | L'utilisateur peut se représenter et enregistrer une intention | 15–30 jours |
| **3 — Priorités vers entraînement** | Règles relues, adaptation de programmes, contraintes, explications, confirmation et suivi | Une proposition de plan cohérente avec les priorités | 10–20 jours |

Le premier palier représente environ **11–20 jours de travail** avec le cadrage. La vision complète représente **36–70 jours**, à réestimer après le lot 0 ; elle dépasse une simple refonte de composant. Un modèle artistique complexe ou une reconstruction à partir de photos ferait sortir de cette fourchette.

La proposition de première spécification à rédiger est donc : **« Refonte de la carte anatomique et explorateur Mon corps »**. La morphologie, les objectifs visuels et la programmation seront cadrés séparément, chacun à partir du résultat du lot précédent.

## 9. Ce qu'il faut vérifier avant chaque palier

- **Compréhension et accès :** tester avec quelques personnes si elles trouvent Mon corps, identifient face / dos et ouvrent le bon muscle. Cible de test proposée : atteindre l'espace en deux actions depuis Musculation, sans explication orale.
- **Dessin :** relecture humaine de chaque zone, aux petites et grandes tailles, en clair et sombre ; vérifier notamment deltoïdes, bras / avant-bras, genoux, quadriceps / mollets et fessiers.
- **Interaction :** sélection fiable dans les deux vues, zoom sans modification de forme, retour / recentrage, liste accessible complète, tailles de texte agrandies.
- **Données :** exercice tagué / non tagué, données absentes, période vide, séries incomplètes et exercices au poids de corps / tonnage nul ; pas d'invention de rôle principal fin ni de récupération. Toute statistique expose ce qu'elle compte.
- **Régressions :** les 3 écrans consommateurs et le journal sensible gardent leurs informations et comportements. Les articulations suivent la nouvelle géométrie.
- **Morphologie :** extrêmes et combinaisons de curseurs, absence de trous ou de chevauchements, continuité face / dos, annulation, restauration après redémarrage et cohérence de version après synchro.
- **Android :** démarrage hors-ligne, chargement à froid, fluidité pendant les gestes, mémoire, chauffe et mise en arrière-plan. Cible initiale de l'essai : interaction à au moins 30 images/s sur l'appareil Android modeste retenu ; budget d'asset et délai d'ouverture fixés après mesure.
- **Valeur produit :** observer le passage d'un muscle aux exercices, puis des intentions confirmées à un plan réellement suivi. Distinguer plaisir de modeler et utilité pour s'entraîner.

## 10. Périmètre de cette analyse et décisions proposées

Cette passe a couvert le code local, les points d'accès, les données disponibles, la direction visuelle, les possibilités techniques documentées et un contrôle concurrentiel ciblé. Elle ne constitue pas un audit du catalogue cloud, un test de l'APK, une mesure de performance ou une validation anatomique.

Décisions proposées pour la suite : **entrée Mon corps dans Musculation ; mannequin anatomique clair ; 10 groupes conservés au premier lot ; rendu 2D de qualité dans les cartes ; 3D réservée d'abord à l'éditeur ; silhouette réelle approchée, intention visuelle et entraînement stockés séparément.**

Les maquettes montrent une morphologie masculine pour faire écho à la référence. Ce n'est pas une décision de limiter le produit à ce modèle. Une déclinaison avec plusieurs bases et le thème sombre feront partie du travail de design du premier palier.

Aucun code applicatif n'a été modifié pour cette analyse. Le travail local de bilan de séance présent au début de l'audit n'a pas été intégré, validé ou remanié.
