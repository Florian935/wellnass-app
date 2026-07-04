# Vision & Contexte

## Concept

Application mobile de suivi fitness tout-en-un, couvrant trois piliers : **musculation, alimentation, running**.

L'idée centrale : **une seule app où les trois piliers se parlent**. Les calories cibles s'adaptent aux jours d'entraînement, le planning running tient compte des séances muscu, le poids corporel alimente les calculs nutritionnels. L'utilisateur ne jongle plus entre 3-4 apps qui s'ignorent.

> ⏳ **Gamification reportée** — la couche jeu (conversion activité → ressources, missions, RPG) est retirée du périmètre. À réévaluer en V3/V4 une fois le socle tracker validé par de vrais utilisateurs. L'architecture doit rester compatible avec un ajout ultérieur (voir [[Architecture Technique]]).

---

## Positionnement

| Concurrent | Ce qu'il fait bien | Ce qui manque |
|---|---|---|
| Strava | Running, social | Muscu, nutrition |
| MyFitnessPal | Nutrition | Muscu, running |
| Strong / Hevy | Musculation | Running, nutrition |

**Notre différenciateur** : centraliser les trois piliers et les **connecter entre eux** — données croisées (calories ↔ entraînement), planning unifié (muscu + running dans le même calendrier), progression globale visible au même endroit.

---

## Utilisateur cible

**Profil principal**
- 20-35 ans
- Pratique déjà 2 ou 3 activités (salle + running + alimentation surveillée)
- Lassé de jongler entre plusieurs apps
- Veut être motivé (records, régularité, courbes), pas seulement tracké

**Profil secondaire**
- Débutant motivé qui cherche une structure de départ claire
- Veut un programme guidé + un suivi simple

---

## Objectifs produit

1. **Centraliser** — remplacer Strava + Strong + MyFitnessPal par une seule app
2. **Motiver sur le long terme** — records personnels, streak de régularité, courbes de progression, notifications de célébration
3. **Être simple à utiliser en séance** — écran de suivi one-tap, pas de friction
4. **Connecter les piliers** — les données muscu / running / nutrition s'informent mutuellement (calories adaptées aux jours d'entraînement, alerte déficit sur semaine à fort volume, coordination des plannings)

---

## Périmètre V1

**Inclus**
- Musculation : programmes, suivi de séance (planifiée ou libre), historique, records
- Running : programmes, suivi GPS, historique, records
- Alimentation : profil nutritionnel, journal alimentaire, recettes, planning repas
- Motivation : streak de régularité, records personnels, notifications de progression
- Intégrations : Apple Health / Health Connect (écriture des séances, lecture du poids), import GPX / CSV depuis les apps concurrentes

**Hors périmètre V1**
- Gamification / mini-jeu (V3 ou V4, si le besoin se confirme)
- Wearables / smartwatch et zones cardio FC (V2 — en V1 les intensités running sont exprimées en allure)
- Social / défis entre amis (V2)
- Suivi de l'hydratation (V2)
- Coach IA personnalisé
- Synchronisation continue avec Strava ou Garmin (l'import ponctuel GPX est en V1)
- Animations 3D des exercices (démonstration par GIF animé en V1)

---

## Hypothèses clés

- L'utilisateur s'entraîne 3 à 6 fois par semaine (pas un ultra-athlète, pas un sédentaire complet)
- L'app est utilisée principalement sur mobile (iOS + Android)
- Les données sont stockées localement avec synchronisation cloud (compte requis)
- Le streak et les records suffisent comme moteur de motivation en V1 — la gamification complète ne sera envisagée que si les métriques de rétention le justifient
