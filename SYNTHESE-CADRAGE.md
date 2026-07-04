# Synthèse des deux cadrages — Flo vs Dams

> Mise en commun des cadrages réalisés séparément par Florian et Damien (désormais fusionnés dans `docs/`).
> Objectif : identifier ce qui converge, et acter les arbitrages sur ce qui divergeait.
> Créé le 04/07/2026 · Arbitrages actés le 04/07/2026.

---

## 1. Vue d'ensemble

Les deux cadrages décrivent **le même produit** : une app mobile bien-être « tout-en-un »
où plusieurs piliers (muscu, running, nutrition…) se parlent, pour remplacer le trio
Strava + MyFitnessPal + Strong/Hevy. Même différenciateur revendiqué : **l'intégration**.

La différence n'était pas la vision, mais la **façon de cadrer** :

| | **Flo** | **Dams** |
|---|---|---|
| Nature du doc | Décisionnel : journal de décisions (D1→D10), PRD, ADR | Exhaustif : CDC par pilier, 179 fonctionnalités chiffrées, roadmap versionnée |
| Force | Vision, philosophie produit, stratégie de monétisation, priorisation | Couverture fonctionnelle, plan d'exécution, standards d'ingénierie |

**Base de travail retenue** : socle stratégique de Flo (ADR sync, monétisation, principe
« intégration sans imposition ») **greffé sur** la machinerie d'exécution de Dams
(roadmap versionnée, Definition of Done, skills Claude Code, services tiers).

---

## 2. Ce qui converge (entériné)

Points alignés dans les deux cadrages :

1. **Vision produit** : app unique multi-piliers interconnectés, contre les apps silos.
2. **Stack mobile** : React Native + Expo + TypeScript.
3. **Backend** : Supabase (Auth + Postgres), isolation par utilisateur (RLS).
4. **Offline-first structurant** : SQLite local d'abord, synchro cloud en arrière-plan.
   À concevoir **dès le jour 1**, non rétrofittable.
5. **Monorepo, découpage par feature** (pas par type de fichier).
6. **Muscu = premier pilier construit** (cœur de valeur, zéro dépendance externe).
7. **Persona** : pratiquant 3–6×/semaine, intermédiaire, + débutant capté ; « conçu pour
   l'exigeant, utilisable par le débutant ».
8. **Fonctionnel muscu** : quasi identique des deux côtés —
   bibliothèque d'exercices (préchargée + custom), séance libre **et** programmes/templates,
   logging poids×reps + RPE, timer de repos, types de séries (échauffement, superset/dropset,
   durée, poids de corps ± lest), historique éditable, records auto (1RM Epley),
   courbes, volume par groupe musculaire, surcharge progressive assistée, deload,
   notes de séance + notes par exercice, dernière perf affichée.
9. **Motivation** : streak de régularité + records personnels + notifications de célébration.
10. **i18n câblé dès le départ** (aucune chaîne en dur).
11. **Méthode** : dev porté par Claude Code, incréments bornés, PR relues à deux,
    `CLAUDE.md` + skills projet.

---

## 3. Arbitrages sur les points qui divergeaient

### ✅ A. Périmètre du premier livrable — **DÉCIDÉ : muscu + running + nutrition**
- Positions initiales : Flo = muscu seul · Dams = 3 piliers.
- **Décision** : on part sur les **3 piliers** (muscu + running + nutrition), comme le cadrage de Dams.
- **Conséquences à assumer** :
  - Le plan de référence devient la **roadmap versionnée de Dams** (V0.1 → V1.1, ~179 fonctionnalités / ~470 h).
  - Deux gros risques techniques au lieu d'un : la **synchro offline** (voir B) **et** le
    **GPS running en arrière-plan** (batterie, écran verrouillé). À aborder avec une base stable
    (running en dernier des piliers, comme prévu par Dams).
  - **Impératif** : livrer **par versions** (ne pas attendre que les 3 piliers soient finis pour
    tester avec de vrais utilisateurs). Chaque fin de version = un build installable.

### ✅ B. Moteur de synchro offline — **DÉCIDÉ : PowerSync**
- Positions initiales : Flo = PowerSync (managé) · Dams = synchro maison last-write-wins.
- **Décision** : **PowerSync** (SQLite local + synchro bidirectionnelle managée avec Supabase, conflits inclus).
- **Conséquences** :
  - Décision **à confirmer par un spike** avant de figer le modèle de données (repli : Legend-State, puis WatermelonDB) — voir `docs/adr/ADR-001-moteur-sync-offline.md`.
  - **Dev build Expo obligatoire** dès le départ (Expo Go insuffisant).
  - À valider tôt : comportement de PowerSync sur les **données volumineuses** (traces GPS running).

### ✅ C. Gamification — **DÉCIDÉ : reportée en V3/V4**
- Positions initiales : Flo = graine légère dès le MVP1 · Dams = V3/V4.
- **Décision** : **pas de gamification en V1**, réévaluation en **V3/V4** selon les métriques de rétention.
- **Précision** : on garde quand même **streak + records + notifications de célébration** (classés
  « motivation », pas « jeu ») — ils sont dans le périmètre convergent (§2.9).
- L'architecture doit rester **compatible** avec un ajout ultérieur (historique horodaté de toutes
  les activités = journal d'événements sur lequel une future couche jeu pourra se brancher).

### ✅ D. Monétisation — **DÉCIDÉ : RevenueCat retenu, mais aucune monétisation en V1**
- Positions initiales : Flo = RevenueCat multi-paliers câblé dès le départ · Dams = décision ouverte.
- **Décision** : **RevenueCat** est la solution retenue, mais **aucun palier payant / paywall en V1** —
  l'app est **entièrement gratuite au lancement**. La monétisation viendra **bien plus tard**.
- **Conséquence pratique** : câbler les *entitlements* tôt reste peu coûteux et évite une refonte ;
  mais rien n'est activé commercialement en V1. À rediscuter le moment venu (grille de prix, paliers).

### ✅ E. Plateforme de lancement — **DÉCIDÉ : Android d'abord**
- Positions initiales : Flo = Android d'abord · Dams = iOS + Android ensemble.
- **Décision** : **Android dès le début**, **iOS plus tard**.
- **Conséquences** : pas de compte Apple Developer requis au lancement ; éviter tout choix technique
  qui fermerait la porte à iOS ensuite (rester sur des libs cross-platform). La connexion Apple
  (OAuth) et la publication App Store sortent du périmètre initial.

### ✅ F. Onboarding — **DÉCIDÉ : minimal, avec parcours guidé optionnel**
- Positions initiales : Flo = minimal (entrée directe, config différable) · Dams = 5 étapes guidées.
- **Décision** : onboarding **le plus minimal possible par défaut**, tout en **laissant la possibilité**
  de suivre les 5 étapes guidées (infos, piliers, objectif, alim, récap). Un **bouton « Passer »**
  présent à chaque étape pour aller direct à l'app.
- **Conséquence** : le parcours guidé existe mais n'est jamais bloquant ; toute la config reste
  accessible et modifiable plus tard depuis les paramètres.

### ✅ G. Anglais au lancement — **DÉCIDÉ : FR + EN dès le départ**
- Positions initiales : Flo = FR + EN dès le départ · Dams = FR seul en V1, EN en V2.
- **Décision** : **français + anglais dès le lancement**.
- **Conséquence** : au-delà de l'infra i18n (déjà actée), le **contenu doit être bilingue dès la V1** —
  UI **et** contenu éditorial (exercices, programmes) et bases de données (ex. traduction EN des
  aliments CIQUAL, FR à l'origine). À intégrer dans la charge de chaque version, pas en fin de projet.

### ✅ H. Back-office / administration — **DÉCIDÉ : on prend celui de Dams**
- Ce n'était pas un désaccord (Flo ne l'avait pas cadré). On adopte le **pilier Administration de Dams**
  (back-office web, CRUD exercices/programmes/aliments, rôles, modération) — nécessaire pour gérer le contenu.
- On y ajoute le principe transverse de Flo : **« intégration sans imposition »** (chaque module utile
  seul, l'intégration inter-piliers est une couche opt-in).

### ⚪ I. À récupérer de chaque côté (pas de conflit)
- **De Dams** : state management (Zustand/Redux), navigation (Expo Router), services tiers
  (OpenFoodFacts + CIQUAL, Mapbox/MapLibre, Sentry, PostHog, Health Connect),
  sources de données exercices (GIF), Definition of Done, skills Claude Code, budgets de perf.
- **De Flo** : PRD formel, ADR, métriques de succès, registre de risques, principe « sans imposition ».
- **Nommage** : pistes de Flo (Atlas / Orbit) ; non bloquant.

---

## 4. Décisions — récapitulatif

| # | Sujet | Décision |
|---|---|---|
| A | Périmètre 1er livrable | ✅ Muscu + Running + Nutrition |
| B | Moteur de synchro | ✅ PowerSync (à confirmer par spike) |
| C | Gamification | ✅ Reportée V3/V4 (streak + records conservés) |
| D | Monétisation | ✅ RevenueCat retenu, mais 0 monétisation en V1 |
| E | Plateforme | ✅ Android d'abord, iOS plus tard |
| F | Onboarding | ✅ Minimal par défaut + parcours guidé optionnel (bouton « Passer ») |
| G | Anglais au lancement | ✅ FR + EN dès le départ (UI + contenu + bases) |
| H | Back-office | ✅ Repris de Dams + principe « sans imposition » de Flo |

---

## 5. Prochaines étapes

Les 8 arbitrages (A→H) sont **tous tranchés**. Reste à exécuter :

1. **Fusionner** les deux cadrages en une base documentaire unique :
   socle stratégique de Flo (PRD, ADR, principe « sans imposition », métriques, risques)
   + machinerie de Dams (roadmap versionnée, DoD, skills Claude Code, services tiers).
2. **Adapter la roadmap de Dams** aux décisions actées :
   - retirer la **gamification** du périmètre V1 (→ V3/V4) ;
   - retirer **iOS / OAuth Apple / publication App Store** du lancement (Android d'abord) ;
   - retirer tout **paywall / palier payant** de la V1 (RevenueCat câblé mais inactif) ;
   - ajouter **PowerSync + dev build Expo** dès la V0.1 (remplace la synchro maison) ;
   - intégrer le **bilingue FR + EN** dans chaque version (UI + contenu + bases).
3. Lancer le **spike PowerSync** (confirme B avant de figer le modèle de données).
4. Rédiger le **`CLAUDE.md` à la racine** (stack, structure monorepo, conventions, DoD, commandes).
5. Initialiser le **scaffolding** : monorepo, app Expo (dev build), Supabase, packages partagés.
