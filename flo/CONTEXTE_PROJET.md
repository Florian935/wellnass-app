# Contexte projet — Application bien-être (fitness / nutrition / lifestyle / gamification)

> Document de passation. Il résume les échanges de cadrage déjà eus et l'état d'avancement, pour reprendre le travail sans reperdre le contexte.

---

## 1. Vision générale

Construire un **écosystème bien-être mobile**, pensé comme un **vrai produit** (utilisateurs + monétisation, objectif : dégager des revenus récurrents). L'app s'organise autour de plusieurs piliers interconnectés :

- **Fitness / force** : musculation, powerlifting, weightlifting, street lifting, haltérophilie, + **course à pied avec tracking GPS**.
- **Nutrition** : suivi des macros et des calories.
- **Lifestyle** : sommeil, stress perçu sur la journée, nombre de pas.
- **Gamification** : moteur de rétention inspiré de **Walkr** (boucle pas → énergie → exploration / déblocage de contenu). Thème "planète / spatial" envisagé mais **non figé**.
- **Couche sociale** : réseau interne inspiré de **Strava**, **scopé strictement aux disciplines fitness/course ci-dessus** (pas de vélo, pas de sports collectifs — c'est un choix assumé pour rester focalisé).

### Référence produit
- **Walkr** = inspiration gamification (boucle simple et addictive).
- **Strava** = inspiration couche sociale (feed, follows, kudos), mais limitée aux disciplines visées.

---

## 2. Équipe & contraintes

- **2 développeurs** (le porteur du projet + un ami développeur), tous deux à l'aise sur l'ensemble de la stack.
- Développement assisté / majoritairement délégué à **Claude Code**.
- **Android d'abord** (iOS plus tard).
- Objectif : produit poli, orienté utilisateurs réels et monétisation.

---

## 3. Décisions actées

### Architecture produit
- **UNE seule application modulaire** (et non plusieurs apps interconnectées). Les "modules" (fitness, nutrition, lifestyle, gamification, social) sont des **features d'une même app**, pas des apps séparées.
- Architecture **modulaire à l'intérieur** : feature-modules côté front, monolithe modulaire côté back.
- **Monorepo** (app mobile + fonctions backend + types partagés).

### Stack technique (figée)
- **Mobile** : **React Native + Expo + TypeScript**
  - Raison : écosystème le plus mature pour fitness + abonnements + données santé ; bon support de RevenueCat, du background-geolocation et de Health Connect ; updates OTA pour itérer vite.
- **Backend** : **Supabase** (Postgres + Auth + Realtime + Storage + Row-Level Security)
  - Raison : données très relationnelles (séances, sets, aliments, follows, feed) → SQL plus adapté que du NoSQL pour le social ; TypeScript des deux côtés → types partagés front/back.
- **Monétisation** : **RevenueCat** (gestion des abonnements Play Store, puis App Store).
- **Données santé** : **Health Connect** (Android) pour pas/sommeil (HealthKit pour iOS plus tard).
- **Course / GPS** : lib de **background-geolocation** dédiée + **Mapbox ou Google Maps** pour l'affichage des tracés.

### Arbitrage noté (à revisiter si besoin)
- Si la **gamification très animée** (exploration façon Walkr) devient le **cœur de l'identité produit**, Flutter aurait un léger avantage sur les animations custom.
- Décision actuelle : **rester sur React Native** (Reanimated/Skia couvrent largement le besoin). À rediscuter uniquement si l'aspect "jeu animé" devient central.

---

## 4. Setup pour un travail autonome de Claude Code

### Élément clé
- Un fichier **`CLAUDE.md` à la racine du repo** (lu automatiquement par Claude Code). Doit contenir :
  - overview du projet,
  - architecture,
  - conventions de code,
  - **commandes** (build, test, lint, typecheck) → indispensables pour que Claude Code vérifie son propre travail.

### Structure de documentation proposée
```
/CLAUDE.md
/docs
  /product      → vision, CDC/PRD, positionnement, personas
  /specs
    /functional → specs fonctionnelles par module
    /technical  → archi, modèle de données, contrats d'API
  /adr          → décisions techniques (1 fichier par décision)
  /stories      → epics → user stories avec critères d'acceptation
```

### Règle de travail
- Claude Code est le plus fiable sur des **incréments bornés** : une user story claire, avec critères d'acceptation + tests.
- **Éviter** les consignes type "construis-moi tout le module nutrition" en autonomie totale.
- Découpage fin + relecture des PR par les deux devs.

---

## 5. Nommage (en cours, non décidé)

Le nom découlera du positionnement (pas encore tranché) + vérif de dispo (Play Store, domaine, @Instagram).

Candidats favoris : **Atlas** et **Orbit** (les deux portent à la fois la force *et* l'idée de territoire/exploration → tiennent que le thème spatial soit retenu ou non).

Autres pistes évoquées : Forge/Forgr, Vigor, Stryde (force/énergie) ; Odyssey, Nova, Comet (exploration) ; Kairos, Pulse, Momentum (brandables).

**Décision reportée** jusqu'au choix du positionnement.

---

## 6. Plan de travail convenu

1. **Positionnement + choix du module phare** ← **ÉTAPE EN COURS, point d'arrêt**
2. Stack figée ✅ (fait)
3. CDC + specs + premières US **pour le MVP uniquement**
4. Setup repo + `CLAUDE.md`, puis début du build

### Mise en garde importante
- Ne **pas** écrire un CDC pour "tout l'écosystème" → ça donnerait un document fantasme.
- Le cadrage doit cibler le **MVP / module phare d'abord**.

---

## 7. Où on s'est arrêtés (reprendre ici)

La prochaine étape bloquante n'est **pas** technique mais le **positionnement** et le **choix du module phare**, car c'est lui qui dictera le contenu du CDC et des premières US.

**Question centrale à résoudre** :
> Qu'est-ce qui fait que quelqu'un télécharge *cette* app plutôt que d'utiliser Strava + MyFitnessPal qu'il a déjà ?

Hypothèse de valeur évoquée : l'**intégration des piliers** + une **gamification orientée force/course** (créneau moins saturé que le running pur).

**Action suivante** : le porteur du projet va exposer ses idées de positionnement / fonctionnalités. À partir de là : définir l'angle unique → choisir le module phare → écrire le PRD du MVP.
