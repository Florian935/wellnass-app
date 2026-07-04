# Spécification fonctionnelle — Compte, Profil & Onboarding

> Base documentaire unifiée · Pilier transverse.
> Fusion de « Compte & Profil Utilisateur » (Dams) + décision F sur l'onboarding + apports Flo (E1, E2).
> Sources : [../../../SYNTHESE-CADRAGE.md](../../../SYNTHESE-CADRAGE.md) · cadrages de Damien et Florian (fusionnés).
> Décisions actées appliquées ici : **E** (Android d'abord — retrait OAuth Apple), **F** (onboarding minimal + parcours guidé skippable), **G** (FR + EN dès le lancement).
> Statut : à jour · Date : 04/07/2026.

---

## 1. Objectif du document

Décrire le socle « identité utilisateur » de l'application : comment un utilisateur crée un compte, s'authentifie, configure (ou non) son profil, gère ses données personnelles et ses préférences. Ce pilier est **transverse** : il alimente tous les autres (Musculation, Running, Alimentation) en données de profil (poids, taille, âge, sexe, objectif, unités, langue).

Principe directeur repris du cadrage : **intégration sans imposition**. Aucun réglage n'est bloquant ; tout est différable et modifiable ensuite depuis les paramètres.

---

## 2. Création de compte & authentification

Authentification portée par **Supabase Auth**. Isolation stricte des données par utilisateur via Row-Level Security (RLS). La session et les données locales sont rattachées au compte pour permettre la synchronisation multi-appareils (voir moteur de synchro PowerSync, décision B).

### 2.1 Inscription

- **Email + mot de passe** (méthode principale).
- **OAuth Google** : proposé (connexion via compte Google).
- **OAuth Apple** : **retiré du lancement** — Android d'abord (décision E). À réintégrer avec le portage **iOS plus tard**. Le bouton n'est pas affiché en V1.
- **Vérification email obligatoire** avant accès complet à l'app (l'utilisateur peut parcourir un état limité mais la synchro et certaines actions ne s'activent qu'après vérification).
- **Pas de compte invité** : les données sont liées au compte pour la synchronisation.
- **Acceptation des CGU et de la politique de confidentialité** à l'inscription (case à cocher explicite, documents consultables avant validation).
- **Âge minimum : 16 ans** — contrôle déclaratif via la date de naissance (exigence RGPD).

### 2.2 Connexion

- **Session persistante** sur l'appareil : pas de reconnexion à chaque ouverture (token rafraîchi automatiquement).
- **Récupération de mot de passe** par email (lien / code de réinitialisation).
- **Déconnexion** disponible depuis les paramètres (les données locales restent, ré-associées à la reconnexion du même compte ; purge locale sur déconnexion explicite selon réglage de sécurité).

### 2.3 Règles d'authentification

- Un email = un compte.
- Changement d'email → **re-vérification** du nouvel email.
- Le mot de passe respecte une politique minimale (longueur, complexité) définie côté Supabase.

---

## 3. Onboarding (décision F)

**Principe** : onboarding **le plus minimal possible par défaut**. Après inscription, l'utilisateur **entre directement** dans l'app. Un **parcours guidé en 5 étapes** existe mais reste **optionnel, non bloquant et skippable** : un bouton **« Passer »** est présent **à chaque étape** pour aller directement à l'app. Toute la configuration reste accessible et modifiable ensuite depuis les paramètres.

### 3.1 Comportement par défaut (minimal)

- À la première ouverture après inscription : proposition de démarrer le parcours guidé **ou** d'entrer directement (« Passer / Configurer plus tard »).
- Si l'utilisateur passe : il arrive sur le tableau de bord, avec un état guidé vers la première action utile (voir [navigation-ux.md](./navigation-ux.md), § États vides).
- Aucune donnée de profil n'est requise pour utiliser le tracker de base (muscu en séance libre notamment).

### 3.2 Parcours guidé — 5 étapes (optionnel, skippable)

Chaque étape affiche un bouton **« Passer »** (saute l'étape courante) et **« Passer tout »** (sort du parcours vers l'app). La progression est indiquée (ex. « Étape 2 / 5 »).

**Étape 1 — Informations de base**
- Prénom (affiché dans l'app).
- Date de naissance.
- Sexe (optionnel, utilisé pour les calculs TDEE côté Alimentation).
- Poids actuel + taille.

**Étape 2 — Activités pratiquées (piliers)**
- Sélection des piliers actifs : **Musculation / Running / Alimentation** (un, deux ou trois — combinaisons libres).
- Fréquence hebdomadaire envisagée par pilier.
- Conséquence : les onglets des piliers non activés sont **masqués** de la barre de navigation (principe « sans imposition », décision H ; voir [navigation-ux.md](./navigation-ux.md)).

**Étape 3 — Objectif principal**
- Prise de masse / Perte de poids / Performance running / Santé générale.
- Influence les recommandations de programmes et le calcul calorique (Alimentation).

**Étape 4 — Alimentation (optionnel)**
- Activer le suivi alimentaire : Oui / Non / Plus tard.
- Si oui : restrictions (végétarien, sans gluten, allergies…) — détail dans [alimentation.md](./alimentation.md).

**Étape 5 — Récapitulatif & confirmation**
- Résumé des choix : piliers actifs, objectif, TDEE calculé (si suivi alimentaire activé).
- Bouton **« C'est parti »** → tableau de bord, avec une suggestion de premier programme adapté au profil.

### 3.3 Règles d'onboarding

- Le parcours guidé n'est **jamais bloquant** : « Passer » disponible partout.
- Un parcours partiellement complété enregistre les champs déjà saisis ; les champs sautés restent modifiables plus tard.
- Le parcours peut être **relancé** ou complété étape par étape depuis les paramètres.
- **Bilingue (décision G)** : tous les libellés du parcours existent en FR **et** EN dès le lancement (aucune chaîne en dur ; voir § Préférences / langue).

---

## 4. Profil utilisateur

### 4.1 Données personnelles

| Champ | Type | Modifiable |
|---|---|---|
| Prénom | Texte | Oui |
| Email | Texte | Oui (re-vérification requise) |
| Date de naissance | Date | Oui |
| Sexe | Enum (homme / femme / non renseigné) | Oui |
| Poids | Nombre (kg) | Oui (historisé, voir § Poids corporel) |
| Taille | Nombre (cm) | Oui |

### 4.2 Données fitness

- **Objectif principal** (recalcule le TDEE et les recommandations côté Alimentation).
- **Niveau déclaré par pilier** : débutant / intermédiaire (ou régulier) / avancé (ou confirmé).
- **Fréquence hebdo visée** par pilier (muscu et running séparément).

Ces données sont partagées avec les piliers concernés (ex. le niveau running alimente le profil coureur — voir [running.md](./running.md)).

### 4.3 Préférences

- **Unités** : métrique (kg / km) / impérial (lb / miles). Défaut : métrique (kg). Conversion automatique à l'affichage ; les charges muscu et données GPS sont stockées en unité canonique (kg, mètres) et converties à l'affichage.
- **Langue : FR / EN — les deux disponibles dès le lancement (décision G).** Détection de la locale système au premier lancement, **override manuel** dans les préférences, **changement à chaud** (sans redémarrage). Toute l'UI **et** le contenu éditorial (exercices, programmes) et les bases (aliments) sont bilingues.
- **Notifications** : activables / désactivables **par type** (rappel séance, rappel repas, rappel pesée, streak en danger, nouveau record) — voir [navigation-ux.md](./navigation-ux.md) § Notifications.
- **Thème de l'app** : clair / sombre / système.

---

## 5. Poids corporel

- Saisie manuelle du poids (depuis le profil **ou** depuis le tableau de bord Alimentation).
- **Historique des pesées** avec courbe d'évolution.
- Rappel optionnel (ex. « Se peser chaque lundi matin » — notification paramétrable).
- **Lien avec le calcul TDEE** : mise à jour automatique du TDEE si le poids change (les macros recalculées sont **proposées**, pas imposées — voir règles métier).
- Les données de poids sont **conservées même si le suivi alimentaire est désactivé** (le poids sert aussi au volume muscu au poids de corps — voir [musculation.md](./musculation.md)).

---

## 6. Paramètres & compte

- Modifier les informations du profil (données perso, fitness, préférences).
- Changer le mot de passe.
- Gérer les notifications (par type).
- Activer / désactiver un pilier a posteriori (son onglet apparaît / disparaît de la nav bar).
- **Export des données (RGPD)** : export complet des données personnelles au format **JSON ou CSV** (droit à la portabilité).
- **Import de données** depuis d'autres apps, pour reprendre l'historique et ne pas repartir de zéro :
  - **GPX** (Strava et autres) → historique running.
  - **CSV** (Hevy, Strong) → historique muscu.
  - **CSV** (MyFitnessPal) → historique alimentaire.
- **Aide & support** : FAQ + formulaire de contact / signalement de bug.
- **Mentions légales** : CGU, politique de confidentialité.
- **Suppression du compte** : confirmation **double**, suppression **irréversible sous 30 jours** (droit à l'effacement RGPD).
- **Déconnexion**.

---

## 7. Règles métier

- Le **poids est obligatoire** pour activer le suivi alimentaire (nécessaire au calcul TDEE).
- La **taille est obligatoire** pour le calcul TDEE.
- Si l'utilisateur modifie son **objectif principal**, les macros recalculées sont **proposées** (jamais imposées).
- Les **données de poids sont conservées** même si le suivi alimentaire est désactivé.
- Aucun réglage de profil / onboarding n'est bloquant pour l'usage du tracker de base (offline-first : l'app est utilisable avant même d'avoir du réseau).
- **Âge minimum 16 ans** (contrôle déclaratif RGPD).
- Toute donnée personnelle sensible (poids, photos de progression) est protégée par **RLS** côté Supabase et par un stockage **privé** côté Storage.

---

## 8. Adaptations liées aux décisions actées

- **Décision E (Android d'abord)** : OAuth Apple **retiré du lancement** (à réintroduire au portage iOS) ; OAuth Google conservé.
- **Décision F (onboarding)** : le parcours 5 étapes de Dams est conservé mais rendu **optionnel et skippable** (bouton « Passer » à chaque étape) ; entrée directe par défaut.
- **Décision G (FR + EN)** : langue plus limitée à FR — **FR + EN disponibles dès le lancement**, UI et contenu.
- **Décision D (RevenueCat sans paywall)** : aucun écran d'abonnement / palier payant dans le parcours compte ou onboarding en V1 (câblage technique uniquement, invisible pour l'utilisateur).
