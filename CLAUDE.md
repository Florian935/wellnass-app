# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## État du projet

**Phase de cadrage — aucun code n'existe encore.** Le repo ne contient que de la documentation produit. La stack et les grandes décisions d'architecture sont figées (voir ci-dessous) mais le scaffolding (monorepo, app mobile, backend) n'a pas encore été initialisé. Quand tu poseras les premières fondations, mets à jour ce fichier avec les vraies commandes (build / test / lint / typecheck).

Sources de vérité, à lire avant toute décision produit ou archi :
- [CONTEXTE_PROJET.md](CONTEXTE_PROJET.md) — passation initiale (vision, stack, contraintes).
- [docs/product/cadrage.md](docs/product/cadrage.md) — journal **vivant** des décisions de cadrage (D1…D8). À mettre à jour après chaque décision validée.

## Vision (en une phrase)

Écosystème bien-être mobile (fitness / nutrition / lifestyle / gamification) pensé comme un vrai produit monétisé. **MVP1 = module Fitness / musculation seul**, qui doit être excellent en autonomie. Tous les autres piliers (course/GPS, nutrition, lifestyle, social, boucle de gamification complète) sont **hors MVP1**.

## Stack figée

- **Mobile** : React Native + Expo + TypeScript (Android d'abord, iOS plus tard). Updates OTA pour itérer vite.
- **Backend** : Supabase (Postgres + Auth + Realtime + Storage + Row-Level Security). Types TypeScript partagés front/back.
- **Monétisation** : RevenueCat.
- **Données santé** (post-MVP1) : Health Connect (Android).
- **Course / GPS** (post-MVP1) : background-geolocation + Mapbox ou Google Maps.

Organisation cible : **monorepo** (app mobile + fonctions backend + types partagés), **une seule app modulaire** (les « modules » fitness/nutrition/etc. sont des feature-modules d'une même app, pas des apps séparées) — monolithe modulaire côté back, feature-modules côté front.

## Contraintes d'architecture structurantes

Ces décisions conditionnent le modèle de données et l'ordre de build dès le départ — beaucoup moins coûteuses à intégrer maintenant qu'après coup :

- **Offline-first complet (D8, non-négociable).** Logging de séance, historique, templates : tout doit marcher 100 % hors-ligne (réseau souvent absent en salle). Synchro Supabase en arrière-plan au retour du réseau. Cela impose une **persistance locale + couche de synchro avec gestion de conflits** dès le premier jour.
- **RevenueCat multi-paliers dès le MVP1 (D7).** Câbler les *entitlements* en plusieurs paliers (Premium muscu → Écosystème → IA) même si un seul palier payant est lancé. But : ajouter les paliers suivants = config, pas refonte.
- **Freemium « utile seul / sans imposition » (D2, D7).** Chaque module est autonome et utile seul ; l'intégration inter-modules est une couche opt-in par-dessus, jamais un prérequis. Le tracker de base est gratuit ; on fait payer la *profondeur* et l'*intégration*, jamais l'accès de base.

## Périmètre MVP1 (module muscu)

Inclus : auth Supabase (synchro multi-appareils), bibliothèque d'exercices préchargée + custom, templates de séances, logging live (poids × reps, timer de repos, RPE/RIR optionnel), historique éditable, progression (records auto, courbes, volume, mesures corporelles), surcharge progressive assistée, notes + photos de progression, graphiques avancés. Plus une **graine légère de gamification** : streaks, badges simples, feedback de progression (pas la boucle « énergie → exploration » complète, qui est post-MVP1).

## Méthode de travail attendue

- Travailler par **incréments bornés** : une user story claire avec critères d'acceptation + tests. Éviter les consignes du type « construis tout le module nutrition » en autonomie.
- Découpage fin, relecture des PR par les deux devs.
- Structure de doc cible : `docs/product` (vision, PRD, personas), `docs/specs/functional` & `docs/specs/technical`, `docs/adr` (1 fichier par décision technique), `docs/stories` (epics → user stories).

## Langue

Le projet et sa documentation sont en **français** — rédige docs, commits et échanges en français.
