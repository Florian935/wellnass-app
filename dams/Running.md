# Running

## Profil coureur

Configuré lors de l'onboarding, modifiable dans les paramètres du pilier.

| Champ | Description |
|---|---|
| Objectif | 5 km / 10 km / Semi-marathon / Marathon / Perte de poids / Endurance générale |
| Niveau | Débutant (< 3 mois de pratique) / Régulier (3-12 mois) / Confirmé (> 1 an) |
| Allure de référence | Allure actuelle sur 5 km (saisie manuelle ou calculée depuis l'historique) |
| Fréquence hebdo visée | 1 à 7 jours par semaine |
| Fréquence cardiaque max | Optionnel — préparé pour les zones cardio (V2, avec wearables). En V1, aucune source de FC : toutes les cibles sont exprimées en allure |

---

## Programmes de course

Un programme guide l'utilisateur sur plusieurs semaines avec des séances progressives.

### Fiche programme

| Champ | Description |
|---|---|
| Nom | Ex. "5 km en 8 semaines", "Prépa semi-marathon" |
| Résumé | Présentation courte |
| Objectif | Distance cible ou type de bénéfice |
| Niveau requis | Débutant / Régulier / Confirmé |
| Durée | Nombre de semaines |
| Fréquence | Séances par semaine |
| Créateur | App (bibliothèque) ou Utilisateur |

### Bibliothèque de programmes
- Programmes pré-construits pour les objectifs les plus courants
- Filtrables par objectif, niveau, durée
- Visualisation de la progression (volume / semaine sur la durée du programme)

### Création d'un programme custom
1. Définir les métadonnées
2. Composer la semaine type : quels jours → quel type de séance
3. Pour chaque semaine, ajuster le volume (distance ou durée cible)
4. L'app propose une progression automatique selon les principes de charge progressive

### Planning calendrier
- Les séances sont placées dans le calendrier selon la semaine type
- Synchronisé avec le calendrier muscu pour éviter les doublons (alerte si chevauchement)
- Décalage de séance possible (glisser-déposer)
- Si séance manquée : proposer de reporter ou sauter

---

## Types de séance

> **Cibles en allure** : sans capteur de FC en V1, toutes les intensités sont exprimées en allure, dérivée de l'allure de référence du profil. Les équivalents FC (indiqués entre parenthèses) serviront en V2 avec les wearables.

### Endurance fondamentale
- Allure lente et constante : allure de référence + 60 à 90 s/km (équiv. 60-70 % FCmax)
- Objectif : construire la base aérobie
- Durée : 30 à 90 min selon le niveau

### Fractionné / Intervalles (VMA)
- Alternance blocs rapides / récupération
- Structure définie en détail : ex. "6 × 400 m à 95 % VMA, récup 1 min 30"
- Alerte automatique lors du changement de bloc (son + vibration)

### Sortie longue
- La séance la plus longue de la semaine
- Allure modérée : allure de référence + 30 à 60 s/km (équiv. 65-75 % FCmax)
- Croît de 10 % max par semaine (règle de progression)

### Récupération active
- Course très lente : allure de référence + 90 s/km ou plus (équiv. < 60 % FCmax), 20-30 min max
- Placée après une séance intense ou le lendemain d'une longue

### Course libre
- Démarrage GPS + chrono sans séance planifiée ni structure de blocs
- Comptabilisée dans l'historique, les statistiques, les records et le streak

### Détail d'une séance
| Champ | Description |
|---|---|
| Type | Enum ci-dessus |
| Distance cible | En km (ou durée si durée prioritaire) |
| Allure cible | En min/km (ou zone cardio si cardio disponible) |
| Structure | Liste de blocs ordonnés (échauffement / blocs principaux / retour au calme) |
| Description | Consignes textuelles |

---

## Suivi d'une séance

### Avant de démarrer
- Affichage de la séance planifiée : type, distance cible, structure des blocs
- Indication de l'allure ou zone cardio cible par bloc
- Bouton "Démarrer" → activation GPS + chrono

### Pendant la séance

**Écran de suivi en temps réel**
- Distance parcourue (en grand, lisible à l'œil)
- Temps écoulé
- Allure instantanée (dernière minute glissante)
- Allure moyenne depuis le départ
- Carte du parcours en direct (si GPS actif)
- Bloc en cours (pour les fractionnés) + chrono du bloc

**Guidage fractionné**
- Annonce vocale + vibration au changement de bloc
- Ex. "Bloc rapide — allez !" puis "Récupération — 90 secondes"
- Compte à rebours du bloc en cours

**Annonces audio périodiques**
- À chaque kilomètre (paramétrable : 0,5 / 1 / 2 km ou désactivé) : distance, temps écoulé, allure moyenne
- Indépendantes du guidage fractionné

**Auto-pause**
- Chrono et GPS mis en pause automatiquement quand l'utilisateur s'arrête (feu rouge, lacet…), reprise automatique au redémarrage
- Activable / désactivable dans les réglages running

**Écran verrouillé**
- Données de course visibles et contrôlables sans déverrouiller le téléphone
- iOS : Live Activity (écran de verrouillage + Dynamic Island) · Android : notification persistante avec actions pause / reprise

**Ajustements en direct**
- Raccourcir la séance (terminer maintenant)
- Prolonger librement (mode "libre" après la distance cible atteinte)
- Mettre en pause (GPS en arrêt, chrono suspendu)

**Note**
- Champ texte libre disponible pendant ou après la séance

### Fin de séance

**Validation**
- Ressenti (RPE 1-10 ou 5 étoiles)
- Conditions : météo (ensoleillé / nuageux / pluvieux / vent) + terrain (route / chemin / piste)

**Résumé post-séance**
- Distance réelle, durée, allure moyenne
- Carte du parcours avec tracé
- Dénivelé positif / négatif
- Découpage par km (tableau pace/km)
- Comparaison avec objectif de la séance
- Records battus (si applicable)
- Bouton "Enregistrer"

---

## Historique & Progression

### Liste des séances passées
- Tri par date, filtre par type de séance ou programme
- Aperçu : date, distance, allure moyenne, durée
- Tap → détail + carte du parcours
- Export GPX d'une sortie (partage ou import dans Strava et autres)

### Statistiques globales
- Distance totale : semaine / mois / depuis le début
- Dénivelé cumulé : semaine / mois / depuis le début
- Temps total de course
- Nombre de séances par type (endurance / fractionné / sortie longue / récupération)

### Évolution de l'allure
- Courbe de l'allure moyenne sur les 30 / 90 derniers jours (par type de séance pour ne pas mélanger fractionné et footing)
- Tendance (amélioration ou régression)

### Records personnels
- Meilleure allure sur 1 km / 5 km / 10 km / Semi / Marathon
- Calculé automatiquement depuis les données GPS (meilleur segment glissant au sein de n'importe quelle sortie — un record 5 km peut être battu pendant un 12 km)
- Notification + animation lors d'un nouveau record

---

## Règles métier

- Le GPS est requis pour le suivi de distance. Si GPS indisponible : mode manuel (durée seule, distance saisie à la main en fin de séance si connue).
- Une séance en mode manuel n'enregistre pas de carte mais compte pour le streak, l'historique et les statistiques de durée. Elle est exclue des records d'allure (données non vérifiables).
- La règle des 10 % (augmentation max du volume hebdomadaire) est suggérée, pas imposée — l'utilisateur reste libre.
- L'allure de référence est mise à jour automatiquement si l'utilisateur bat son record sur 5 km.
- Les données GPS sont conservées localement et dans le cloud. La carte est rendue côté app (pas de dépendance à Google Maps en runtime).
- Un programme ne peut être actif qu'un à la fois. Changer de programme désactive le précédent sans perdre l'historique.
