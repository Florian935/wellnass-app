# Compte & Profil Utilisateur

## Création de compte / Authentification

### Inscription
- Email + mot de passe, ou connexion via Google / Apple
- Vérification email obligatoire avant accès complet
- Pas de compte invité : les données sont liées au compte pour la synchronisation
- Acceptation des CGU et de la politique de confidentialité à l'inscription (case à cocher, documents consultables)
- Âge minimum : 16 ans (contrôle déclaratif via la date de naissance — exigence RGPD)

### Connexion
- Session persistante sur l'appareil (pas de reconnexion à chaque ouverture)
- Récupération de mot de passe par email

---

## Onboarding

Séquence de configuration au premier lancement, étape par étape. Peut être sautée et complétée plus tard depuis les paramètres.

### Étape 1 — Informations de base
- Prénom (affiché dans l'app)
- Date de naissance
- Sexe (optionnel, utilisé pour calculs TDEE)
- Poids actuel + taille

### Étape 2 — Activités pratiquées
- Sélection des piliers actifs : Musculation / Running / Les deux
- Fréquence hebdomadaire envisagée par pilier

### Étape 3 — Objectif principal
- Prise de masse / Perte de poids / Performance running / Santé générale
- Influence les recommandations de programmes et le calcul calorique

### Étape 4 — Alimentation (optionnel)
- Activer le suivi alimentaire : Oui / Non / Plus tard
- Si oui : restrictions (végétarien, sans gluten, allergies)

### Étape 5 — Récapitulatif & confirmation
- Résumé des choix : piliers actifs, objectif, TDEE calculé (si suivi alimentaire activé)
- Bouton "C'est parti" → arrive sur le tableau de bord avec une suggestion de premier programme adapté au profil

---

## Profil utilisateur

### Données personnelles
| Champ | Type | Modifiable |
|---|---|---|
| Prénom | Texte | Oui |
| Email | Texte | Oui (re-vérification) |
| Date de naissance | Date | Oui |
| Sexe | Enum | Oui |
| Poids | Nombre (kg) | Oui (historisé) |
| Taille | Nombre (cm) | Oui |

### Données fitness
- Objectif principal (recalcule le TDEE et les recommandations)
- Niveau déclaré par pilier (débutant / intermédiaire / avancé)
- Fréquence hebdo visée (muscu + running séparément)

### Préférences
- Unités : métrique / impérial
- Langue : FR / EN (V1 : FR uniquement — détection de la locale système, override manuel, changement à chaud ; voir [[Internationalisation & Traductions]])
- Notifications : activées / désactivées par type (rappel séance, rappel repas, streak en danger, nouveau record — voir [[Navigation & UX Globale]])
- Thème de l'app : clair / sombre / système

---

## Poids corporel

- Saisie manuelle du poids (depuis le profil ou le tableau de bord alimentation)
- Historique des pesées avec courbe d'évolution
- Rappel optionnel (ex. "Se peser chaque lundi matin")
- Lien avec le calcul TDEE (mise à jour automatique si poids change)

---

## Paramètres & compte

- Modifier les informations du profil
- Changer le mot de passe
- Gérer les notifications
- Export des données (JSON ou CSV)
- **Import de données** depuis d'autres apps : GPX (Strava…), CSV (Hevy, Strong, MyFitnessPal) — reprise de l'historique pour ne pas repartir de zéro
- Aide & support : FAQ + formulaire de contact / signalement de bug
- Mentions légales : CGU, politique de confidentialité
- Suppression du compte (avec confirmation double, suppression irréversible sous 30 jours)
- Déconnexion

---

## Règles métier

- Le poids est obligatoire pour activer le suivi alimentaire (calcul TDEE)
- La taille est obligatoire pour le calcul TDEE
- Si l'utilisateur modifie son objectif principal, les macros recalculées sont proposées à l'utilisateur (pas imposées)
- Les données de poids sont conservées même si le suivi alimentaire est désactivé
