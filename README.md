# Wellness App

Écosystème bien-être mobile où **3 piliers se parlent** — Musculation, Running, Nutrition —
pour remplacer le trio Strava + MyFitnessPal + Strong/Hevy. Différenciateur : **l'intégration**.

> **État (26/07/2026)** : les 3 piliers sont fonctionnels, l'app tourne **offline avec synchro
> cloud**, le back-office existe. Reste avant publication : Health Connect, accessibilité et la
> soumission au Play Store. → **[ETAT.md](ETAT.md)** pour le détail à jour.

## Par où commencer

| Je veux… | Aller voir |
|---|---|
| savoir **où on en est** | [ETAT.md](ETAT.md) — généré, toujours à jour |
| savoir **ce qu'il reste à faire** | [BACKLOG.md](BACKLOG.md) |
| voir le **périmètre complet** | [roadmap](docs/roadmap/roadmap.md) |
| **contribuer** (workflow, branches, migrations) | [CLAUDE.md](CLAUDE.md) |
| comprendre **pourquoi** telle décision | [docs/adr/](docs/adr/) · [SYNTHESE-CADRAGE.md](SYNTHESE-CADRAGE.md) |
| déposer une **idée** | [IDEAS.md](IDEAS.md) |

## Démarrer

```bash
npm install
npm run typecheck && npm run lint && npm run test
npm run mobile          # serveur de dev Expo — nécessite un dev build (module natif PowerSync)
node scripts/etat.mjs   # régénère ETAT.md
```

Node ≥ 20 (voir [.nvmrc](.nvmrc)). Monorepo npm workspaces : `apps/mobile` (Expo),
`apps/admin` (back-office React+Vite), `packages/shared` (types, Zod, briques pures).

## Documentation

- [docs/product/](docs/product/) — vision, PRD, personas, métriques, catalogue d'analyses.
- [docs/specs/functional/](docs/specs/functional/) — specs par pilier + [74 specs d'US](docs/specs/functional/us/).
- [docs/specs/technical/](docs/specs/technical/) — architecture, offline-sync, modèle de données, i18n, bonnes pratiques.
- [docs/adr/](docs/adr/) — décisions d'architecture (une par fichier).
- [CHANGELOG.md](CHANGELOG.md) — trace par commit · [docs/journal/](docs/journal/) — archives gelées.

## Stack

React Native + Expo + TypeScript · Supabase (Postgres/Auth/RLS) · PowerSync (offline-first) ·
MapLibre + MapTiler · RevenueCat (prévu, inactif en V1) · **Android d'abord**.
