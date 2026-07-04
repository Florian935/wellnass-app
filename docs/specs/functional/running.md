# Spécification fonctionnelle — Running

> Base documentaire unifiée · Pilier Running.
> Source : cadrage de Damien (fusionné dans cette base).
> Décisions actées appliquées ici : **A** (running dans le périmètre V1, construit en dernier des piliers), **B** (PowerSync — attention données GPS volumineuses), **C** (streak/records conservés), **E** (Android d'abord), **G** (FR + EN), **H** (module utile seul).
> Statut : à jour · Date : 04/07/2026.

---

## 1. Objectif du document

Décrire le pilier Running : profil coureur, programmes de course, types de séance, suivi GPS en temps réel, historique et progression. Ce pilier est dans le périmètre V1 (décision A) mais **construit en dernier** des trois piliers, car il porte le **risque technique majeur** du **GPS en arrière-plan** (batterie, écran verrouillé) — à aborder sur une base stable.

**Points d'attention V1 (décisions actées) :**
- **Cibles exprimées en allure** : pas de fréquence cardiaque ni de wearables en V1. Toutes les intensités sont dérivées de l'allure de référence. Les équivalents FC ne servent qu'en V2.
- **Cartes** : fournisseur à trancher (Mapbox / MapLibre) ; rendu de la carte **côté app** (pas de dépendance runtime à Google Maps).
- **GPS arrière-plan = risque technique majeur** : comportement à valider tôt (écran verrouillé, batterie). Le comportement de **PowerSync sur les données GPS volumineuses** (traces) est à valider par le spike avant de figer le modèle de données (décision B).

---

## 2. Profil coureur

Configuré lors de l'onboarding, modifiable dans les paramètres du pilier.

| Champ | Description |
|---|---|
| Objectif | 5 km / 10 km / Semi-marathon / Marathon / Perte de poids / Endurance générale |
| Niveau | Débutant (< 3 mois de pratique) / Régulier (3-12 mois) / Confirmé (> 1 an) |
| Allure de référence | Allure actuelle sur 5 km (saisie manuelle ou calculée depuis l'historique) |
| Fréquence hebdo visée | 1 à 7 jours par semaine |
| Fréquence cardiaque max | Optionnel — préparé pour les zones cardio (V2, avec wearables). **En V1, aucune source de FC : toutes les cibles sont exprimées en allure.** |

---

## 3. Programmes de course

Un programme guide l'utilisateur sur plusieurs semaines avec des séances progressives.

### 3.1 Fiche programme

| Champ | Description |
|---|---|
| Nom | Ex. « 5 km en 8 semaines », « Prépa semi-marathon » |
| Résumé | Présentation courte |
| Objectif | Distance cible ou type de bénéfice |
| Niveau requis | Débutant / Régulier / Confirmé |
| Durée | Nombre de semaines |
| Fréquence | Séances par semaine |
| Créateur | App (bibliothèque) ou Utilisateur |

### 3.2 Bibliothèque de programmes

- Programmes pré-construits pour les objectifs les plus courants.
- Filtrables par objectif, niveau, durée.
- Visualisation de la progression (volume / semaine sur la durée du programme).
- Contenu **bilingue FR + EN** (décision G).

### 3.3 Création d'un programme custom

1. Définir les métadonnées.
2. Composer la semaine type : quels jours → quel type de séance.
3. Pour chaque semaine, ajuster le volume (distance ou durée cible).
4. L'app propose une **progression automatique** selon les principes de charge progressive.

### 3.4 Planning calendrier

- Les séances sont placées dans le calendrier selon la semaine type.
- **Synchronisé avec le calendrier muscu** pour éviter les doublons (alerte si chevauchement) — intégration opt-in (décision H).
- Décalage de séance possible (glisser-déposer).
- Séance manquée : proposer de **reporter** ou **sauter**.

---

## 4. Types de séance

> **Cibles en allure (V1)** : sans capteur de FC, toutes les intensités sont exprimées en **allure**, dérivée de l'allure de référence du profil. Les équivalents FC (entre parenthèses) serviront en V2 avec les wearables.

### 4.1 Endurance fondamentale
- Allure lente et constante : allure de référence + 60 à 90 s/km (équiv. 60-70 % FCmax).
- Objectif : construire la base aérobie.
- Durée : 30 à 90 min selon le niveau.

### 4.2 Fractionné / Intervalles (VMA)
- Alternance blocs rapides / récupération.
- Structure détaillée : ex. « 6 × 400 m à 95 % VMA, récup 1 min 30 ».
- **Alerte automatique** lors du changement de bloc (son + vibration).

### 4.3 Sortie longue
- La séance la plus longue de la semaine.
- Allure modérée : allure de référence + 30 à 60 s/km (équiv. 65-75 % FCmax).
- Croît de **10 % max par semaine** (règle de progression).

### 4.4 Récupération active
- Course très lente : allure de référence + 90 s/km ou plus (équiv. < 60 % FCmax), 20-30 min max.
- Placée après une séance intense ou le lendemain d'une longue.

### 4.5 Course libre
- Démarrage GPS + chrono sans séance planifiée ni structure de blocs.
- Comptabilisée dans l'historique, les statistiques, les records et le streak.

### 4.6 Détail d'une séance

| Champ | Description |
|---|---|
| Type | Enum ci-dessus |
| Distance cible | En km (ou durée si durée prioritaire) |
| Allure cible | En min/km (zone cardio en V2 si disponible) |
| Structure | Liste de blocs ordonnés (échauffement / blocs principaux / retour au calme) |
| Description | Consignes textuelles |

---

## 5. Suivi d'une séance

### 5.1 Avant de démarrer
- Affichage de la séance planifiée : type, distance cible, structure des blocs.
- Indication de l'**allure cible** par bloc (zone cardio en V2).
- Bouton « Démarrer » → activation GPS + chrono.

### 5.2 Pendant la séance

**Écran de suivi en temps réel**
- Distance parcourue (en grand, lisible à l'œil).
- Temps écoulé.
- Allure instantanée (dernière minute glissante).
- Allure moyenne depuis le départ.
- **Carte du parcours en direct** (si GPS actif) — fournisseur à trancher (Mapbox / MapLibre), rendu côté app.
- Bloc en cours (fractionnés) + chrono du bloc.

**Guidage fractionné**
- Annonce vocale + vibration au changement de bloc.
- Ex. « Bloc rapide — allez ! » puis « Récupération — 90 secondes ».
- Compte à rebours du bloc en cours.

**Annonces audio périodiques**
- À chaque kilomètre (paramétrable : 0,5 / 1 / 2 km ou désactivé) : distance, temps écoulé, allure moyenne.
- Indépendantes du guidage fractionné.

**Auto-pause**
- Chrono et GPS mis en pause automatiquement à l'arrêt (feu rouge, lacet…), reprise automatique au redémarrage.
- Activable / désactivable dans les réglages running.

**Écran verrouillé**
- Données de course visibles et contrôlables sans déverrouiller le téléphone.
- **Android (V1)** : notification persistante avec actions **pause / reprise**.
- **iOS (plus tard, décision E)** : Live Activity (écran de verrouillage + Dynamic Island) — hors périmètre V1.
- Point de vigilance : **GPS en arrière-plan** (batterie, écran verrouillé) = risque technique majeur à valider tôt.

**Ajustements en direct**
- Raccourcir la séance (terminer maintenant).
- Prolonger librement (mode « libre » après la distance cible atteinte).
- Mettre en pause (GPS arrêté, chrono suspendu).

**Note**
- Champ texte libre disponible pendant ou après la séance.

### 5.3 Fin de séance

**Validation**
- Ressenti (RPE 1-10 ou 5 étoiles).
- Conditions : météo (ensoleillé / nuageux / pluvieux / vent) + terrain (route / chemin / piste).

**Résumé post-séance**
- Distance réelle, durée, allure moyenne.
- Carte du parcours avec tracé.
- Dénivelé positif / négatif.
- Découpage par km (tableau pace/km).
- Comparaison avec l'objectif de la séance.
- **Records battus** (si applicable) → animation + notification (décision C, motivation).
- Bouton « Enregistrer ».

---

## 6. Historique & Progression

### 6.1 Liste des séances passées
- Tri par date, filtre par type de séance ou programme.
- Aperçu : date, distance, allure moyenne, durée.
- Tap → détail + carte du parcours.
- **Export GPX** d'une sortie (partage ou import dans Strava et autres).

### 6.2 Statistiques globales
- Distance totale : semaine / mois / depuis le début.
- Dénivelé cumulé : semaine / mois / depuis le début.
- Temps total de course.
- Nombre de séances par type (endurance / fractionné / sortie longue / récupération).

### 6.3 Évolution de l'allure
- Courbe de l'allure moyenne sur 30 / 90 derniers jours (par type de séance pour ne pas mélanger fractionné et footing).
- Tendance (amélioration ou régression).

### 6.4 Records personnels
- Meilleure allure sur 1 km / 5 km / 10 km / Semi / Marathon.
- Calculé automatiquement depuis les données GPS (**meilleur segment glissant** au sein de n'importe quelle sortie — un record 5 km peut être battu pendant un 12 km).
- **Notification + animation** lors d'un nouveau record (décision C, motivation).

---

## 7. Streak & motivation (décision C)

- Une **séance running terminée** (planifiée ou libre) compte comme jour actif du streak (voir [navigation-ux.md](./navigation-ux.md) § Streak).
- Records d'allure auto-détectés (§ 6.4) + notifications de célébration.
- Pas de mécanique de jeu en V1.

---

## 8. Règles métier

- Le **GPS est requis** pour le suivi de distance. Si GPS indisponible : **mode manuel** (durée seule, distance saisie à la main en fin de séance si connue).
- Une séance en **mode manuel** n'enregistre pas de carte mais compte pour le **streak, l'historique et les statistiques de durée**. Elle est **exclue des records d'allure** (données non vérifiables).
- La **règle des 10 %** (augmentation max du volume hebdo) est **suggérée, pas imposée**.
- L'**allure de référence** est mise à jour automatiquement si l'utilisateur bat son record sur 5 km.
- Les **données GPS** sont conservées localement et dans le cloud. La **carte est rendue côté app** (pas de dépendance à Google Maps en runtime).
- Un **programme ne peut être actif qu'un à la fois**. Changer de programme désactive le précédent sans perdre l'historique.
- **Offline-first** : la séance et sa trace GPS sont écrites localement puis synchronisées via PowerSync (volumétrie des traces à valider — décision B).

---

## 9. Adaptations liées aux décisions actées

- **Décision A** : running maintenu dans le périmètre V1, à construire **en dernier** (base stable avant d'affronter le GPS arrière-plan).
- **Décision B (PowerSync)** : point de vigilance explicite sur la **volumétrie des traces GPS** en synchro (à valider par le spike).
- **Décision C** : streak + records d'allure + notifications de célébration conservés ; pas de boucle de jeu.
- **Décision E (Android d'abord)** : écran verrouillé = **notification persistante Android** en V1 ; Live Activity iOS repoussée.
- **Décision G (FR + EN)** : programmes, types de séance et libellés bilingues.
- **Cartes** : fournisseur (Mapbox / MapLibre) reste à trancher ; rendu côté app.
