# Spécification fonctionnelle — Navigation & UX Globale

> Base documentaire unifiée · Pilier transverse.
> Source : cadrage de Damien (fusionné dans cette base).
> Décisions actées appliquées ici : **B** (synchro PowerSync), **C** (gamification retirée V1 — streak/records conservés), **E** (Android d'abord), **G** (FR + EN), **H** (intégration sans imposition).
> Statut : à jour · Date : 04/07/2026.

---

## 1. Objectif du document

Décrire la structure de navigation de l'app, le tableau de bord d'accueil, les principes UX transverses (rapidité en séance, feedback, états vides), les notifications, l'indicateur hors-ligne et l'accessibilité. Ce document est **transverse** aux trois piliers (Musculation, Running, Alimentation).

**Note de périmètre (décision C) :** aucune boucle de gamification en V1 (énergie / exploration / déblocage). On conserve uniquement, classés « motivation » : **streak de régularité**, **records personnels** et **notifications de célébration**. Toute référence à une boucle de jeu est hors V1 (réévaluation V3/V4).

---

## 2. Structure de l'application

L'app s'articule autour d'une **barre de navigation principale** (bottom tab bar) avec jusqu'à 4 onglets :

```
[ Accueil ] [ Muscu ] [ Running ] [ Alim ]
```

- **Accueil** — tableau de bord du jour.
- **Muscu** — pilier musculation.
- **Running** — pilier running.
- **Alim** — pilier alimentation.

### 2.1 Masquage des onglets non activés (décision H — « intégration sans imposition »)

- Les piliers **non activés** (dans l'onboarding ou les paramètres) sont **masqués** de la barre de navigation.
- La barre est **réductible** : si un seul pilier est activé, on peut n'avoir que 2 onglets (Accueil + le pilier).
- Un pilier peut être **activé plus tard** depuis les paramètres — son onglet **apparaît** alors.
- Corollaire : **chaque module est utile seul** ; l'intégration inter-piliers (ex. adaptation calorique les jours d'entraînement) est une couche **opt-in**, jamais un prérequis.

---

## 3. Tableau de bord (Accueil)

Vue synthétique de la journée. Pas de navigation complexe — l'essentiel visible d'un coup d'œil. Max **4 blocs** en accueil.

### 3.1 Blocs affichés

**Bloc Séance du jour**
- Prochaine séance planifiée (muscu ou running) : nom + heure prévue.
- Bouton **« Démarrer »** → ouvre directement le suivi de séance.
- Si aucune séance : « Pas d'entraînement prévu aujourd'hui — repos actif ✓ ».

**Bloc Nutrition** (si pilier Alimentation actif)
- Calories consommées / objectif (ex. 1 840 / 2 500 kcal).
- Barre de progression macros (P / G / L) en une ligne.
- Bouton **« Ajouter un repas »**.

**Bloc Streak / Régularité** (motivation — conservé malgré le retrait gamification)
- Nombre de jours consécutifs avec au moins une activité validée.
- Calendrier de la semaine (L M M J V S D) avec indicateurs colorés.
- Un jour de repos prévu par le programme ne casse pas le streak.

**Bloc Poids corporel** (si suivi alimentaire actif)
- Dernière pesée + tendance sur 7 jours (↑ ↓ =).
- Lien vers la courbe complète.

### 3.2 Définition du streak

- **Jour actif** = au moins une **séance terminée** (muscu ou running, planifiée ou libre) **ou** une **journée nutrition complétée** (tous les repas actifs saisis).
- Un **jour de repos prévu** par le programme actif est **neutre** : il ne casse pas le streak et ne l'incrémente pas.
- Le jour bascule à **minuit, fuseau local de l'appareil**. Un changement de fuseau ne peut **jamais casser** un streak rétroactivement (en cas d'ambiguïté, le calcul le plus favorable à l'utilisateur est retenu).

### 3.3 Comportement

- Le tableau de bord se met à jour **en temps réel** pendant une séance.
- Blocs **réorganisables, masquables et configurables**. Widgets additionnels disponibles : record récent, volume muscu de la semaine, résumé running de la semaine.
- Premier lancement : le dashboard **guide vers la première action utile** selon les piliers activés (voir États vides).

---

## 4. Principes UX

### 4.1 Rapidité d'accès en séance

- Depuis l'accueil → séance active en **1 tap** (bouton « Démarrer »).
- Pendant la séance, l'écran **reste actif** (pas de mise en veille).
- Actions en séance : **grosses zones tactiles**, lisibles à bout de bras.
- Offline-first : la saisie en séance ne dépend **jamais** du réseau (écriture locale immédiate ; synchro en arrière-plan).

### 4.2 Feedback immédiat

- Chaque **série validée** → animation + son (désactivable).
- **Record personnel battu** → animation de célébration.
- **Fin de séance** → écran de résumé avant de quitter.

> Ces feedbacks relèvent de la **motivation** (streak / records / célébration), pas d'une boucle de gamification. Aucune mécanique de points, d'énergie ou de déblocage en V1 (décision C).

### 4.3 Hiérarchie visuelle

- Priorité à **l'action du moment** (bouton principal toujours visible).
- Données secondaires accessibles mais pas au premier plan.
- Pas de tableau de bord surchargé : **max 4 blocs** en accueil.

### 4.4 États vides

- Chaque écran sans données affiche un **état vide soigné** : illustration légère + phrase d'explication + CTA (ex. historique vide → « Démarre ta première séance »).
- **Jamais** de tableau, liste ou graphique vide sans explication ni action proposée.
- Premier lancement : le dashboard guide vers la première action utile selon les piliers activés.

---

## 5. Notifications

### 5.1 Types

| Notification | Moment | Désactivable |
|---|---|---|
| Rappel séance | 30 min avant séance planifiée | Oui |
| Rappel repas | Heure définie (ex. 12h30) | Oui |
| Rappel pesée | Jour + heure définis (ex. lundi 7h) | Oui |
| Streak en danger | Fin de journée si aucune activité | Oui |
| Nouveau record | Immédiat après séance | Oui |

> « Nouveau record » et « Streak en danger » sont les **notifications de célébration / motivation** conservées en V1 (décision C). Pas de notification liée à une mécanique de jeu.

### 5.2 Règles

- Pas plus de **3 notifications push par jour** (regroupement si besoin).
- Mode **« Ne pas déranger »** : aucune notification entre 22h et 7h (paramétrable).
- Chaque type est activable / désactivable indépendamment (voir [compte-profil-onboarding.md](./compte-profil-onboarding.md) § Préférences).

---

## 6. Navigation interne par pilier

Chaque pilier suit le même schéma :

```
Liste / Accueil pilier
  └─ Détail (programme, exercice, séance…)
       └─ Écran actif (suivi en temps réel)
            └─ Résumé post-séance
```

Retour toujours possible via la flèche ou le geste **swipe-back**, **sauf pendant une séance active** où une **confirmation** est demandée.

---

## 7. Écran de chargement / hors-ligne

- L'app fonctionne **entièrement hors-ligne** (données locales SQLite).
- **Synchronisation cloud en arrière-plan** dès connexion disponible, via **PowerSync** (décision B — synchro bidirectionnelle managée avec Supabase, gestion de conflits incluse ; requiert un **dev build Expo**).
- **Indicateur discret hors-ligne** : bandeau en haut de l'écran quand l'appareil n'a pas de réseau ; disparaît au retour de la connexion.
- Un indicateur de **synchro en cours / à jour** peut accompagner le bandeau (rassure sur la sauvegarde cloud).

> La gestion de conflits est déléguée à PowerSync (remplace la stratégie « last-write-wins maison » initialement envisagée par Dams). Le comportement précis sur les données volumineuses (traces GPS running) est à valider par le spike PowerSync avant de figer le modèle de données.

---

## 8. Accessibilité

- **Taille de texte** : suit les réglages système (mise à l'échelle dynamique).
- **Contraste** : respect **WCAG AA** minimum.
- **Pas de couleur seule** comme unique indicateur d'état (toujours accompagnée d'icône ou de texte).
- Cibles tactiles suffisamment grandes (usage à la salle, à bout de bras).

---

## 9. Adaptations liées aux décisions actées

- **Décision C (gamification)** : toute référence à une **boucle de gamification** retirée du périmètre V1 ; seuls **streak + records + notifications de célébration** sont conservés (classés motivation).
- **Décision B (PowerSync)** : la section hors-ligne remplace « last-write-wins maison » par la **synchro managée PowerSync** (dev build Expo requis).
- **Décision H (sans imposition)** : masquage des onglets des piliers non activés explicité comme principe transverse.
- **Décision E (Android d'abord)** : les mentions spécifiques iOS (ex. Dynamic Type / Live Activity) relèvent du portage iOS ultérieur ; en V1 on cible Android (mise à l'échelle texte système Android, notification persistante).
- **Décision G (FR + EN)** : tous les libellés d'UI et états vides existent en FR et EN (aucune chaîne en dur).
