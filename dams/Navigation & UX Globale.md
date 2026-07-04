# Navigation & UX Globale

## Structure de l'application

L'app s'articule autour d'une **barre de navigation principale** (bottom tab bar) avec 4 onglets :

```
[ Accueil ] [ Muscu ] [ Running ] [ Alim ]
```

- **Accueil** — tableau de bord du jour
- **Muscu** — pilier musculation
- **Running** — pilier running
- **Alim** — pilier alimentation

Les piliers non activés dans l'onboarding sont masqués de la nav bar (réductible à 2 onglets si un seul pilier est activé). Un pilier peut être activé plus tard depuis les paramètres — son onglet apparaît alors.

---

## Tableau de bord (Accueil)

Vue synthétique de la journée. Pas de navigation complexe — tout est visible d'un coup d'œil.

### Blocs affichés

**Bloc Séance du jour**
- Prochaine séance planifiée (muscu ou running) avec nom + heure prévue
- Bouton "Démarrer" → ouvre directement le suivi de séance
- Si aucune séance : "Pas d'entraînement prévu aujourd'hui — repos actif ✓"

**Bloc Nutrition**
- Calories consommées / objectif (ex. 1 840 / 2 500 kcal)
- Barre de progression macros (P / G / L) en une ligne
- Bouton "Ajouter un repas"

**Bloc Streak / Régularité**
- Nombre de jours consécutifs avec au moins une activité validée
- Calendrier de la semaine (L M M J V S D) avec indicateurs colorés
- Un jour de repos prévu par le programme ne casse pas le streak

### Définition du streak
- **Jour actif** = au moins une séance terminée (muscu ou running, planifiée ou libre) **ou** une journée nutrition complétée (tous les repas actifs saisis)
- Un jour de repos prévu par le programme actif est **neutre** : il ne casse pas le streak et ne l'incrémente pas
- Le jour bascule à minuit, **fuseau local de l'appareil**. Un changement de fuseau ne peut jamais casser un streak rétroactivement (en cas d'ambiguïté, le calcul le plus favorable à l'utilisateur est retenu)

**Bloc Poids corporel** (si suivi alimentaire actif)
- Dernière pesée + tendance sur 7 jours (↑ ↓ =)
- Lien vers la courbe complète

### Comportement
- Le tableau de bord se met à jour en temps réel pendant une séance
- Blocs réorganisables, masquables et configurables — voir la section « Dashboard personnalisable » de [[Validation Fonctionnalités]] (widgets additionnels : record récent, volume muscu de la semaine, résumé running de la semaine)

---

## Principes UX

### Rapidité d'accès en séance
- Depuis l'accueil → séance active en 1 tap (bouton "Démarrer")
- Pendant la séance, l'écran reste actif (pas de mise en veille)
- Actions en séance : grosses zones tactiles, lisibles à bout de bras

### Feedback immédiat
- Chaque série validée → animation + son (désactivable)
- Record personnel battu → animation de célébration
- Fin de séance → écran de résumé avant de quitter

### Hiérarchie visuelle
- Priorité à l'action du moment (bouton principal toujours visible)
- Données secondaires accessibles mais pas en premier plan
- Pas de tableau de bord surchargé : max 4 blocs en accueil

### États vides
- Chaque écran sans données affiche un état vide soigné : illustration légère + phrase d'explication + CTA (ex. historique vide → "Démarre ta première séance")
- Jamais de tableau, liste ou graphique vide sans explication ni action proposée
- Premier lancement : le dashboard guide vers la première action utile selon les piliers activés

---

## Notifications

### Types
| Notification | Moment | Désactivable |
|---|---|---|
| Rappel séance | 30 min avant séance planifiée | Oui |
| Rappel repas | Heure définie (ex. 12h30) | Oui |
| Rappel pesée | Jour + heure définis (ex. lundi 7h) | Oui |
| Streak en danger | Fin de journée si aucune activité | Oui |
| Nouveau record | Immédiat après séance | Oui |

### Règles
- Pas plus de 3 notifications push par jour (regroupement si besoin)
- Mode "Ne pas déranger" : aucune notification entre 22h et 7h (paramétrable)

---

## Navigation interne par pilier

Chaque pilier suit le même schéma de navigation :

```
Liste / Accueil pilier
  └─ Détail (programme, exercice, séance…)
       └─ Écran actif (suivi en temps réel)
            └─ Résumé post-séance
```

Retour toujours possible via la flèche ou le geste swipe-back (sauf pendant une séance active où une confirmation est demandée).

---

## Écran de chargement / hors-ligne

- L'app fonctionne entièrement hors-ligne (données locales)
- Synchronisation cloud en arrière-plan dès connexion disponible
- Indicateur discret si hors-ligne (bandeau en haut)
- En cas de conflit de sync : la version la plus récente gagne (last-write-wins)

---

## Accessibilité

- Taille de texte : suit les réglages système (Dynamic Type sur iOS)
- Contraste : respect WCAG AA minimum
- Pas de couleur seule comme seul indicateur d'état (toujours accompagnée d'icône ou texte)
