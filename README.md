# Wellness App

Écosystème bien-être mobile où **3 piliers se parlent** — Musculation, Running, Nutrition —
pour remplacer le trio Strava + MyFitnessPal + Strong/Hevy. Différenciateur : **l'intégration**.

> **État** : phase de cadrage terminée, base documentaire fusionnée. Le code applicatif n'est
> pas encore initialisé.

## Documentation

- [CLAUDE.md](CLAUDE.md) — point d'entrée : stack, décisions, structure, méthode de travail.
- [SYNTHESE-CADRAGE.md](SYNTHESE-CADRAGE.md) — les 8 arbitrages tranchés (décisions A→H).
- [docs/product/](docs/product/) — vision, PRD, personas, métriques de succès.
- [docs/specs/functional/](docs/specs/functional/) — specs par pilier + socle transverse.
- [docs/specs/technical/](docs/specs/technical/) — architecture, offline-sync, modèle de données, i18n, bonnes pratiques.
- [docs/adr/](docs/adr/) — décisions d'architecture (1 fichier par décision).
- [docs/roadmap/roadmap.md](docs/roadmap/roadmap.md) — plan de versions (V0.1 → V1.1).

## Stack

React Native + Expo + TypeScript · Supabase (Postgres/Auth/Storage/RLS) · PowerSync (offline-first) ·
RevenueCat (câblé, inactif en V1) · Android d'abord.
