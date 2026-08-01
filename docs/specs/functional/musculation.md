# Spécification fonctionnelle — Musculation

> Base documentaire unifiée · Pilier Musculation (premier pilier construit).
> Fusion de « Musculation » (Dams, très complet) + epics muscu du PRD Flo (E3–E9).
> Sources : cadrages de Damien et Florian (fusionnés) · [../../../SYNTHESE-CADRAGE.md](../../../SYNTHESE-CADRAGE.md).
> Décisions actées appliquées ici : **C** (streak/records conservés, pas de boucle de jeu), **G** (contenu FR + EN), **H** (module utile seul).
> Statut : à jour · Date : 04/07/2026.

---

## 1. Objectif du document

Décrire le pilier Musculation : programmes, bibliothèque d'exercices, suivi de séance en live, historique, progression et records. C'est le **cœur de valeur** du produit et le premier pilier construit (zéro dépendance externe, utile seul).

**Correspondance avec les epics du PRD Flo :** E3 (bibliothèque d'exercices), E4 (séances & templates), E5 (logging live), E6 (historique), E7 (progression & records), E8 (mesures corporelles & photos), E9 (graphiques avancés).

**Note de périmètre (décision C) :** on conserve **streak, records et notifications de célébration** (motivation). Pas de badges de jeu / boucle d'énergie en V1. L'historique horodaté de toutes les séances constitue un journal d'événements sur lequel une future couche jeu (V3/V4) pourra se brancher.

---

## 2. Programmes de musculation

Un programme est un plan d'entraînement structuré sur plusieurs semaines. L'utilisateur peut suivre un programme de la bibliothèque ou en créer un custom.

### 2.1 Fiche programme

| Champ | Description |
|---|---|
| Nom | Titre du programme |
| Résumé | 1 à 3 phrases de présentation |
| Objectif | Prise de masse / Force / Endurance musculaire / Remise en forme |
| Niveau | Débutant / Intermédiaire / Avancé |
| Durée | Nombre de semaines |
| Créateur | Utilisateur ou « Bibliothèque app » |
| Fréquence | Nombre de séances par semaine |

### 2.2 Bibliothèque de programmes

- Programmes **pré-construits** fournis par l'app (non modifiables, mais **« dupliquer pour personnaliser »**).
- Filtrables par objectif, niveau, durée, équipement disponible.
- Contenu **bilingue FR + EN** (décision G).

### 2.3 Création d'un programme custom

1. Renseigner les métadonnées (nom, objectif, niveau, durée).
2. Définir la semaine type : quels jours → quels groupes musculaires.
3. Composer chaque séance en ajoutant des exercices depuis la bibliothèque.
4. Définir séries / reps / repos pour chaque exercice.
5. Optionnel : activer la **progression automatique** (ex. +2,5 kg par semaine sur les exercices composés).

### 2.4 Planning calendrier

- Une fois un programme actif, l'app génère automatiquement les séances dans un **calendrier**.
- Jours d'entraînement et de repos visualisés par couleur.
- **Décalage** d'une séance possible (glisser-déposer dans le calendrier).
- Séance manquée : proposer de la **reporter** ou de la **sauter**.

---

## 3. Exercices (E3)

### 3.1 Fiche exercice

| Champ | Description |
|---|---|
| Nom | Ex. « Développé couché barre » |
| Muscles ciblés | Principal + secondaires (ex. Pectoraux > Triceps, Épaules) — alimente les graphiques de volume (§ 6.4) |
| Matériel requis | Barre / Haltères / Machine / Poids de corps / Élastique |
| Difficulté | 1 à 5 étoiles |
| Type de mouvement | Poussée / Tirage / Squat / Charnière / Gainage / Isolation |
| Mode de mesure | Charge × reps (défaut) / Durée en secondes (gainage) / Poids de corps avec lest (+ kg) ou assistance (− kg) optionnels |
| Consignes techniques | Description textuelle des points clés |
| Variantes | Liste des exercices alternatifs (même groupe musculaire) |

### 3.2 Bibliothèque d'exercices

- **Catalogue préchargé** fourni par l'app (non modifiable), catégorisé par groupe musculaire et équipement.
- L'utilisateur peut **créer ses propres exercices** (champs libres + photo personnelle optionnelle).
- **Recherche** par nom, muscle, matériel ; **filtrage**.
- **Exercices favoris** (étoile).
- Contenu **bilingue FR + EN** (décision G).

### 3.3 Démonstrations visuelles (GIF/vidéo) — abandonné

> **Décision Florian/Damien (20/07/2026) : abandonné.** L'idée d'un GIF/vidéo animé par exercice (sourcing
> d'une base externe, import, hébergement, affichage sur la fiche, accès pendant la séance) est jugée **trop
> complexe pour la valeur apportée** et **retirée du périmètre**. Concerne les items roadmap **6.1** (GIF par
> exercice), **3.18** (affichage sur la fiche), **6.3** (accès démo pendant la séance) et **8.3** (upload média
> admin) — tous marqués ❌ dans la [roadmap](../../roadmap/roadmap.md). La colonne `media_url` reste en base
> (déjà présente, inoffensive) mais ne sera jamais renseignée ni rendue. Les **muscles ciblés sur schéma SVG**
> (6.2) sont un sujet **distinct** (pas de média animé) et restent ouverts.
>
> Section conservée pour trace historique (contenu original ci-dessous, non retenu) :
>
> Bases open source candidates envisagées : `exercises-dataset` (433 exercices, GIF + instructions FR/EN),
> `free-exercise-db` (800+, images), `ExerciseDB API` (11 000+, GIF + muscles ciblés). Import GIF via l'admin,
> hébergement sur notre stockage. Options écartées avant même le choix d'une source.

### 3.4 Données de progression par exercice

- Historique de **tous les sets** réalisés sur cet exercice.
- **Record personnel** : meilleur 1RM estimé et meilleur poids × reps.
- **Courbe d'évolution** de la charge sur 30 / 90 derniers jours.
- **Volume total** (kg × reps × séries) par semaine.

---

## 4. Suivi d'une séance (E5)

Écran principal pendant l'entraînement. Doit être **rapide, lisible, utilisable d'une main**, et **fonctionner intégralement hors-ligne** (écriture locale immédiate, synchro en arrière-plan).

### 4.1 Deux modes de démarrage (E4)

- **Séance planifiée** : depuis le programme actif ou le calendrier — le plan est **pré-rempli**.
- **Séance libre** : bouton « Séance libre » depuis l'onglet Muscu — on démarre à vide et on ajoute les exercices au fil de l'eau. Comptabilisée dans l'historique, le volume, les records et le streak comme n'importe quelle séance.

Les **templates de séances** (routines réutilisables) permettent de composer une liste ordonnée d'exercices avec séries cibles, puis de démarrer depuis ce template ou à blanc. Édition / duplication / suppression des templates disponibles. Quelques templates de démarrage peuvent être fournis pour le débutant.

### 4.2 Avant de démarrer

- Affichage du plan de séance : liste des exercices avec séries / reps / charge prévus.
- Temps prévu estimé.
- Bouton « Démarrer la séance ».

### 4.3 Pendant la séance

**Vue exercice en cours**
- Nom de l'exercice.
- Série en cours (ex. « Série 2 / 4 »).
- Charge et reps prévues.
- **Dernière performance** sur cet exercice, affichée au-dessus de la saisie (ex. « La dernière fois : 80 kg × 8 / 8 / 7 »).
- Bouton **« Valider la série »** → enregistre reps réelles + charge réelle.
- Champs reps et charge **pré-remplis** avec les valeurs prévues (modifiables en 2 taps).

**Ajustement rapide de la charge (en cours de série)**
- Boutons **− / +** de part et d'autre de la charge pour l'ajuster sans clavier : un tap = un incrément.
- **Incrément configurable par exercice** (défaut : 2,5 kg barre / 1 kg haltère / 0,5 kg si unité fine) ; **appui long = double incrément**.
- Saisie directe au clavier toujours possible (tap sur la valeur).
- L'ajustement s'applique **à la série en cours** ; à la validation, l'app propose de **reporter la nouvelle charge sur les séries suivantes** du même exercice (Oui / seulement cette série).
- Conversion automatique **kg ↔ lb** selon l'unité active — l'incrément suit l'unité affichée.

**Types de séries**
- **Normale** (défaut).
- **Échauffement** : marquée distinctement, **exclue** du volume, des records et de la progression automatique.
- **Superset** : deux exercices enchaînés sans repos — le chrono de repos se déclenche **après la paire**.
- **Dropset** : réduction de charge enchaînée sans repos (issue du PRD Flo E5).
- **Échec** : série menée jusqu'à l'échec musculaire (marqueur, issue du PRD Flo E5).
- **Exercice en durée** : saisie en secondes (gainage, isométrie).
- **Poids de corps** : reps seules, avec lest (+ kg) ou assistance (− kg) optionnels.

**Chrono de repos**
- Se déclenche **automatiquement** après validation d'une série (démarrage manuel aussi possible).
- Durée **configurable par exercice** (défaut : 90 s muscu, 120 s composés).
- Alerte **visuelle + vibration** à la fin du repos.
- Possibilité d'**ignorer / prolonger** le chrono.

**Ajustements en direct**
- Ajouter une série supplémentaire à un exercice.
- Supprimer la prochaine série.
- Modifier charge ou reps de la série suivante.
- Remplacer un exercice par un **alternatif** (depuis la liste de variantes).
- Réorganiser l'ordre des exercices restants.

**Notes**
- **Note de séance** : champ texte libre (sensation, contexte, remarques).
- **Note par exercice** : **persistante** d'une séance à l'autre (réglage de siège, position machine…) — affichée sous le nom de l'exercice en séance.

### 4.4 Fin de séance

**Écran résumé**
- Durée totale.
- Volume total soulevé (kg).
- Nombre de séries validées.
- **Records battus** (si applicable) → animation de célébration + notification (décision C, motivation).
- Champ **« Ressenti global »** (1 à 5, ou RPE 1-10).
- Bouton « Terminer et enregistrer ».

**Abandon de séance / reprise** *(US MUSC-F6, réconcilié le 01/08/2026)*
- Quitter l'écran de séance en cours ne demande **aucune confirmation** : la séance reste
  `active` en base, sans état « pause » distinct.
- Elle est **reprenable** via le bouton « Reprendre » du hub muscu jusqu'à sa **clôture
  automatique après 3h d'inactivité** (US 3.37, `WORKOUT_AUTO_CLOSE_SECONDS`) — vérifiée au
  démarrage de l'app, pas par un minuteur en tâche de fond.

---

## 5. Mesures corporelles & photos (E8)

- Suivi du **poids de corps** (a minima) — partagé avec le pilier Alimentation et le profil (voir [compte-profil-onboarding.md](./compte-profil-onboarding.md)).
- **Mesures corporelles optionnelles** : tour de bras, taille, tour de poitrine, cuisses, etc.
- **Photos de progression** : galerie **privée** (Storage privé, protégé par RLS).
- **Courbes d'évolution** du poids de corps et des mesures.

---

## 6. Historique & Progression (E6, E7, E9)

### 6.1 Liste des séances passées (E6)

- Tri par date (plus récent en premier).
- Filtre par programme ou groupe musculaire.
- Aperçu : date, nom, durée, volume total.
- Tap → détail complet de la séance.
- **Édition / suppression** d'une séance passée.
- Accessible **hors-ligne**.

### 6.2 Courbes d'évolution (E7)

- Par exercice : charge max, volume total, estimation 1RM.
- Sélecteur de période : 4 sem / 3 mois / 1 an / tout.
- Format graphique simple (courbe linéaire).

### 6.3 Records personnels (E7)

- Liste des **PR** par exercice : charge max, meilleur reps × charge, **meilleur 1RM estimé**, PR par plage de reps.
- **Date** du record.
- **Notification push + animation** lors d'un nouveau PR (décision C, motivation).

### 6.4 Volume par groupe musculaire / semaine (E9)

- Visualisation **heatmap ou barres** (pectoraux / dos / épaules / bras / jambes / abdos).
- Répartition de l'entraînement (groupes travaillés, fréquence).
- **Alerte** si déséquilibre flagrant détecté (ex. 0 set dos vs 12 sets pecs sur 2 semaines).

### 6.5 Surcharge progressive assistée (E7)

- Suggestion de la **prochaine charge / prochaines reps** à partir des dernières performances (et du RPE si renseigné).
- **Suggérée, jamais imposée** (principe « sans imposition »).

---

## 7. Streak & motivation (décision C)

- **Streak d'assiduité** : une séance muscu terminée (planifiée ou libre) compte comme jour actif (voir définition complète dans [navigation-ux.md](./navigation-ux.md) § Streak).
- **Records personnels** auto-détectés (§ 6.3).
- **Notifications de célébration** (nouveau record).
- Pas de mécanique de jeu (points, énergie, déblocage) en V1.

---

## 8. Règles métier

- Un **programme ne peut être actif qu'un à la fois** (par pilier). Changer de programme en cours désactive le précédent **sans perdre l'historique**.
- Les charges sont **enregistrées en kg** (conversion en lb si unité impériale activée).
- Une séance dure **au maximum 3 heures** — au-delà, elle est automatiquement clôturée avec les données saisies.
- Le **1RM estimé** utilise la **formule d'Epley** : `charge × (1 + reps / 30)`.
- La **progression automatique** ne s'applique que si la séance précédente a été complétée à **≥ 80 %** des séries prévues.
- Les **séries d'échauffement** sont **exclues** du volume, des records et de la progression automatique.
- **Deload** : si un exercice échoue (< 80 % des reps prévues) **deux semaines consécutives**, l'app propose une **réduction de charge de 10 %** — suggérée, jamais imposée.
- Pour les exercices au **poids de corps**, le volume est calculé avec le **poids corporel courant** (± lest / assistance).
- **Offline-first** : aucune perte de séance ; écriture locale immédiate, synchro PowerSync en arrière-plan.

---

## 9. Adaptations liées aux décisions actées

- **Décision C (gamification)** : conservé streak + records + notifications de célébration (motivation) ; retiré toute boucle de jeu / système de badges-énergie. L'historique horodaté reste compatible avec un ajout ultérieur (V3/V4).
- **Décision G (FR + EN)** : bibliothèques exercices et programmes, consignes techniques et libellés bilingues dès le lancement.
- **Décision H (sans imposition)** : suggestions (surcharge, deload, macros) proposées et jamais imposées ; module utile seul.
- **Fusion PRD Flo** : types de séries **dropset** et **échec** ajoutés (E5) ; mesures corporelles & photos (E8) et graphiques avancés (E9) intégrés au détail Dams.
