# Musculation

## Programmes de musculation

Un programme est un plan d'entraînement structuré sur plusieurs semaines. L'utilisateur peut suivre un programme existant (bibliothèque) ou en créer un custom.

### Fiche programme

| Champ | Description |
|---|---|
| Nom | Titre du programme |
| Résumé | 1-3 phrases de présentation |
| Objectif | Prise de masse / Force / Endurance musculaire / Remise en forme |
| Niveau | Débutant / Intermédiaire / Avancé |
| Durée | Nombre de semaines |
| Créateur | Utilisateur ou "Bibliothèque app" |
| Fréquence | Nombre de séances par semaine |

### Bibliothèque de programmes
- Programmes pré-construits fournis par l'app (non modifiables, mais "dupliquer pour personnaliser")
- Filtrables par objectif, niveau, durée, équipement disponible

### Création d'un programme custom
1. Renseigner les métadonnées (nom, objectif, niveau, durée)
2. Définir la semaine type : quels jours → quels groupes musculaires
3. Composer chaque séance en ajoutant des exercices depuis la bibliothèque
4. Définir séries / reps / repos pour chaque exercice
5. Optionnel : activer la progression automatique (ex. +2,5 kg par semaine sur les exercices composés)

### Planning calendrier
- Une fois un programme actif, l'app génère automatiquement les séances dans un calendrier
- Les jours d'entraînement et de repos sont visualisés par couleur
- Possibilité de décaler une séance (glisser-déposer dans le calendrier)
- Si l'utilisateur manque une séance : proposer de la reporter ou de la sauter

---

## Exercices

### Fiche exercice

| Champ | Description |
|---|---|
| Nom | Ex. "Développé couché barre" |
| Muscles ciblés | Principal + secondaires (ex. Pectoraux > Triceps, Épaules) |
| Matériel requis | Barre / Haltères / Machine / Poids de corps / Élastique |
| Difficulté | 1 à 5 étoiles |
| Type de mouvement | Poussée / Tirage / Squat / Charnière / Gainage / Isolation |
| Mode de mesure | Charge × reps (défaut) / Durée en secondes (gainage) / Poids de corps avec lest (+ kg) ou assistance (− kg) optionnels |
| Démonstration | GIF animé en boucle du mouvement correct (voir « Source des démonstrations » ci-dessous) |
| Consignes techniques | Description textuelle des points clés |
| Variantes | Liste des exercices alternatifs (même groupe musculaire) |

### Bibliothèque d'exercices
- Base d'exercices fournie par l'app (non modifiable)
- L'utilisateur peut créer ses propres exercices (champs libres + photo personnelle optionnelle)
- Recherche par nom, muscle, matériel
- Exercices favoris (étoile)
- La démonstration est accessible pendant la séance (modal depuis l'écran de suivi, sans couper le chrono de repos)

### Source des démonstrations (GIF)

Bases open source candidates — décision à prendre avant import :

| Solution | Exercices | Format | Licence |
|---|---|---|---|
| **exercises-dataset** | 433 + GIF + instructions FR/EN | JSON + GIF | Open source — [GitHub](https://github.com/hasaneyldrm/exercises-dataset) |
| **free-exercise-db** | 800+ + images | JSON + images | Domaine public — [GitHub](https://github.com/yuhonas/free-exercise-db) |
| **ExerciseDB API** | 11 000+ + GIF + muscles ciblés | API REST / self-host | Open source — [GitHub](https://github.com/ExerciseDB/exercisedb-api) |

**Recommandation** : `exercises-dataset` (433 exercices avec instructions FR, suffisant pour démarrer) ou `ExerciseDB` self-hosted si on veut du volume. Les GIF sont importés via l'admin et hébergés sur notre stockage (pas de dépendance runtime à un service externe). Le choix des animations 3D (muscles en surbrillance) a été écarté — trop coûteux pour le gain.

### Données de progression par exercice
- Historique de tous les sets réalisés sur cet exercice
- Record personnel : meilleur 1RM estimé et meilleur poids × reps
- Courbe d'évolution de la charge sur les 30 / 90 derniers jours
- Volume total (kg × reps × séries) par semaine

---

## Suivi d'une séance

Écran principal pendant l'entraînement. Doit être rapide, lisible, utilisable d'une main.

### Deux modes de démarrage
- **Séance planifiée** : depuis le programme actif ou le calendrier — le plan est pré-rempli
- **Séance libre** : bouton "Séance libre" depuis l'onglet Muscu — on démarre à vide et on ajoute les exercices au fil de l'eau. Comptabilisée dans l'historique, le volume, les records et le streak comme n'importe quelle séance

### Avant de démarrer
- Affichage du plan de séance : liste des exercices avec séries / reps / charge prévus
- Temps prévu estimé
- Bouton "Démarrer la séance"

### Pendant la séance

**Vue exercice en cours**
- Nom de l'exercice
- Série en cours (ex. "Série 2 / 4")
- Charge et reps prévues
- **Dernière performance** sur cet exercice, affichée au-dessus de la saisie (ex. "La dernière fois : 80 kg × 8 / 8 / 7")
- Bouton "Valider la série" → enregistre reps réelles + charge réelle
- Champ reps réelles et charge réelle pré-remplis avec les valeurs prévues (modifiables en 2 taps)

**Ajustement rapide de la charge (en cours de série)**
- Boutons **− / +** de part et d'autre de la charge pour l'ajuster sans ouvrir le clavier : un tap = un incrément
- **Incrément configurable** par exercice (défaut : 2,5 kg barre / 1 kg haltère / 0,5 kg si unité fine) ; appui long = double incrément
- Saisie directe au clavier toujours possible (tap sur la valeur) pour un poids précis
- L'ajustement s'applique **à la série en cours** ; à la validation, l'app propose de **reporter la nouvelle charge sur les séries suivantes** du même exercice (Oui / seulement cette série)
- Conversion automatique kg ↔ lb selon l'unité active — l'incrément suit l'unité affichée

**Types de séries**
- Série normale (défaut)
- Série d'échauffement : marquée distinctement, exclue du volume, des records et de la progression automatique
- Superset : deux exercices enchaînés sans repos — le chrono de repos se déclenche après la paire
- Exercice en durée : saisie en secondes (gainage, isométrie)
- Poids de corps : reps seules, avec lest (+ kg) ou assistance (− kg) optionnels

**Chrono de repos**
- Se déclenche automatiquement après validation d'une série
- Durée configurable par exercice (défaut : 90 s muscu, 120 s composés)
- Alerte visuelle + vibration à la fin du repos
- Possibilité d'ignorer / prolonger le chrono

**Ajustements en direct**
- Ajouter une série supplémentaire à un exercice
- Supprimer la prochaine série
- Modifier charge ou reps de la série suivante
- Remplacer un exercice par un alternatif (depuis la liste de variantes)
- Réorganiser l'ordre des exercices restants

**Notes**
- Note de séance : champ texte libre (sensation, contexte, remarques)
- Note par exercice : persistante d'une séance à l'autre (réglage de siège, position machine…) — affichée sous le nom de l'exercice en séance

### Fin de séance

**Écran résumé**
- Durée totale
- Volume total soulevé (kg)
- Nombre de séries validées
- Records battus (si applicable)
- Champ "Ressenti global" (1 à 5, ou RPE 1-10)
- Bouton "Terminer et enregistrer"

**Abandon de séance**
- Si l'utilisateur quitte en cours : popup "Abandonner" ou "Pause" (met en pause, sauvegarde l'état)
- Une séance en pause peut être reprise dans les 4 heures

---

## Historique & Progression

### Liste des séances passées
- Tri par date (plus récent en premier)
- Filtre par programme ou groupe musculaire
- Aperçu : date, nom, durée, volume total
- Tap → détail complet de la séance

### Courbes d'évolution
- Par exercice : charge max, volume total, estimation 1RM
- Sélecteur de période : 4 sem / 3 mois / 1 an / tout
- Format graphique simple (courbe linéaire)

### Records personnels
- Liste des PRs par exercice (charge max, meilleur reps × charge)
- Date du record
- Notification push + animation lors d'un nouveau PR

### Volume par groupe musculaire / semaine
- Visualisation heatmap ou barres (pectoraux / dos / épaules / bras / jambes / abdos)
- Alerte si déséquilibre flagrant détecté (ex. 0 sets dos vs 12 sets pecs sur 2 semaines)

---

## Règles métier

- Un programme ne peut être actif qu'un à la fois (par pilier). Changer de programme en cours désactive le précédent sans perdre l'historique.
- Les charges sont enregistrées en kg (conversion en lbs si unité impériale activée).
- Une séance dure au maximum 3 heures — au-delà, elle est automatiquement clôturée avec les données saisies.
- Le 1RM estimé utilise la formule d'Epley : `charge × (1 + reps / 30)`.
- La progression automatique ne s'applique que si la séance précédente a été complétée à ≥ 80 % des séries prévues.
- Les séries d'échauffement sont exclues du volume, des records et de la progression automatique.
- **Deload** : si un exercice échoue (< 80 % des reps prévues) deux semaines consécutives, l'app propose une réduction de charge de 10 % — suggérée, jamais imposée.
- Pour les exercices au poids de corps, le volume est calculé avec le poids corporel courant (± lest / assistance).
