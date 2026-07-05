# CLAUDE.md

Guidage pour Claude Code (claude.ai/code) sur ce dépôt.

## État du projet

**Cadrage terminé, scaffolding du monorepo posé.** Les deux cadrages initiaux (Florian et
Damien) ont été **fusionnés** en une base documentaire unique sous [`docs/`](docs/). La stack et
les grandes décisions sont figées (voir ci-dessous). Le **monorepo npm workspaces** est
initialisé (`apps/mobile` Expo, `apps/admin` stub, `packages/shared`) ; l'app mobile bundle et
le typecheck passe. **Restent à poser** : dev build Expo (EAS), Supabase, intégration PowerSync
(voir [TODO.md](TODO.md)).

### Sources de vérité (à lire avant toute décision produit ou archi)
- [SYNTHESE-CADRAGE.md](SYNTHESE-CADRAGE.md) — journal des 8 arbitrages tranchés le 04/07/2026.
- [docs/product/](docs/product/) — vision, PRD, personas, métriques.
- [docs/adr/](docs/adr/) — décisions d'architecture (1 fichier par décision).
- [docs/roadmap/roadmap.md](docs/roadmap/roadmap.md) — plan de versions (V0.1 → V1.1).

## Vision (en une phrase)

Écosystème bien-être mobile où **3 piliers se parlent** — Musculation, Running, Nutrition —
pour remplacer le trio Strava + MyFitnessPal + Strong/Hevy. Différenciateur = **l'intégration**.

## Stack figée

- **Mobile** : React Native + Expo + TypeScript. **Android d'abord** (iOS plus tard). Expo Router, state Zustand.
- **Offline / base locale** : **PowerSync** (SQLite local + synchro managée avec Supabase, conflits gérés par l'outil) — **à confirmer par le spike 001**. Impose un **dev build Expo** (Expo Go insuffisant).
- **Backend** : Supabase (Postgres + Auth + Storage + Row-Level Security).
- **Monétisation** : RevenueCat — **câblé mais inactif en V1** (app 100 % gratuite au lancement).
- **i18n** : i18next + expo-localization — **FR + EN dès le lancement** (UI + contenu + bases).
- **Course / GPS** : Expo Location + Mapbox ou MapLibre (fournisseur à trancher).

Organisation cible : **monorepo** (`apps/mobile`, `apps/admin`, `packages/shared`), **une seule
app modulaire** (feature-modules côté front, monolithe modulaire côté back).

## Contraintes d'architecture structurantes

- **Offline-first via PowerSync (décision B).** Tout doit marcher hors-ligne ; synchro en arrière-plan.
  Conçu dès le jour 1 : UUID côté client, timestamps UTC, soft delete, écriture via repository.
  Voir [docs/specs/technical/offline-sync.md](docs/specs/technical/offline-sync.md).
- **i18n FR + EN dès le départ (décision G).** Aucune chaîne en dur ; contenu et bases bilingues.
- **RevenueCat câblé tôt, inactif (décision D).** Entitlements posés mais aucun paywall en V1.
- **Intégration sans imposition (décision H).** Chaque pilier est utile seul ; l'intégration
  inter-piliers (calories ↔ entraînement, planning unifié) est une couche **opt-in**. Les onglets
  des piliers non activés sont masqués.
- **Android d'abord (décision E).** Play Store au lancement ; rester cross-platform pour ne pas
  fermer iOS (pas d'OAuth Apple ni d'App Store au lancement).
- **Gamification hors V1 (décision C).** On garde streak + records + notifications ; boucle de jeu
  réévaluée en V3/V4. Historique horodaté = journal d'événements compatible avec un ajout futur.

## Périmètre V1

3 piliers (Musculation, Running, Nutrition) + socle transverse (compte, navigation, dashboard,
streak) + back-office d'administration. Détail : [docs/specs/functional/](docs/specs/functional/).
Ordre de build : muscu d'abord (zéro dépendance externe), **running en dernier** (GPS arrière-plan
= plus gros risque avec la synchro).

## Workflow obligatoire par fonctionnalité (PRIMORDIAL)

**Aucune ligne de code applicatif n'est écrite avant d'avoir franchi ces étapes, dans cet
ordre.** Toute nouvelle fonctionnalité / user story suit ce parcours :

1. **Spec** — rédiger la spécification du dev : ce que fait la fonctionnalité, règles métier,
   cas limites, i18n (FR+EN), comportement offline. Vit dans
   [docs/specs/functional/](docs/specs/functional/) ou [docs/specs/technical/](docs/specs/technical/).
2. **Plan d'implémentation** — rédiger le plan : découpage en étapes, fichiers touchés, tests
   prévus, ordre de build.
3. **Design / maquette** — produire la maquette dans `design/<fonctionnalité>/`, **créée et
   exportée depuis Claude Design**.
4. **Validation** — les 3 livrables ci-dessus sont **validés par Damien ou Florian**.
   **Pas de code tant que ce n'est pas validé.**
5. **Implémentation** — seulement après validation, sur une branche dédiée (voir ci-dessous),
   par incréments bornés, PR relue par les deux devs.

### Branches
Chaque US = **une nouvelle branche** créée depuis `dev`, préfixée par type :
`feature/xxx`, `fix/xxx`, `chore/xxx`, `docs/xxx`, `refactor/xxx`. **Jamais de travail
directement sur `main` ni sur `dev`.**

Modèle de branches : `main` = branche protégée (release) · **`dev` = branche d'intégration**
(cible de tout le travail courant) · `feature/*` etc. = branches de travail.

### Commits
Utiliser la commande **`/commit`** (voir [.claude/commands/commit.md](.claude/commands/commit.md)).
En une passe, elle :
- analyse et **relit le `git diff`** (revue de code : bugs, secrets, specs, offline-first, i18n) ;
- applique le **garde-fou confidentialité** (jamais de secrets) ;
- tient le **[CHANGELOG.md](CHANGELOG.md)** — une entrée par commit, construite à partir du diff,
  pour garder la **trace complète** des modifications (traçabilité devs / débogage) ;
- coche le **[TODO.md](TODO.md)** ;
- crée un **commit conventionnel** en français ;
- **pousse la branche sur `dev` distant** (fast-forward/merge puis `git push origin dev`).

### Suivi — TODO.md
[TODO.md](TODO.md) à la racine est le **suivi vivant** de tout ce qui reste à faire. On y
ajoute les US au fur et à mesure qu'elles entrent dans le pipeline ; `/commit` coche ce qui
vient d'être livré.

## Méthode de travail attendue

- Suivre la [roadmap versionnée](docs/roadmap/roadmap.md) : livrer **par versions** (chaque fin de
  version = un build installable), ne pas attendre les 3 piliers pour tester.
- Travailler par **incréments bornés** (une fonctionnalité de la roadmap = une user story + tests + PR).
- Respecter la **Definition of Done** et les standards de
  [docs/specs/technical/bonnes-pratiques.md](docs/specs/technical/bonnes-pratiques.md).
- Découpage fin, relecture des PR par les deux devs.

## Structure de la documentation

```
/TODO.md                    → suivi vivant des tâches (coché par /commit)
/CHANGELOG.md               → trace des modifications par commit (tenu par /commit)
/SYNTHESE-CADRAGE.md        → arbitrages tranchés (décisions A→H)
/design                     → maquettes par fonctionnalité (exportées de Claude Design)
/apps
  /mobile                   → app Expo (React Native, Expo Router, Zustand, i18n)
  /admin                    → back-office web (stub, V0.7)
/packages
  /shared                   → types + schémas Zod partagés
/docs
  /product                  → vision, prd, personas, metriques-succes
  /specs
    /functional             → compte-profil-onboarding, navigation-ux, musculation, running, alimentation, administration
    /technical              → architecture, offline-sync, modele-donnees, i18n, bonnes-pratiques, spike-001-powersync, runbook-provisioning-spike
  /adr                      → ADR-001 (sync) … ADR-005 (gamification)
  /roadmap                  → roadmap.md (V0.1 → V1.1)
```

## Commandes

**Monorepo npm workspaces** (Node ≥ 20, voir [.nvmrc](.nvmrc)). Depuis la racine :

| Commande | Effet |
|---|---|
| `npm install` | Installe toutes les dépendances (hoistées à la racine). |
| `npm run typecheck` | `tsc --noEmit` sur tous les workspaces. |
| `npm run lint` | Lint des workspaces qui l'exposent (`expo lint` côté mobile). |
| `npm run test` | Tests des workspaces (aucun runner câblé pour l'instant). |
| `npm run mobile` | Raccourci → démarre le serveur de dev Expo de `apps/mobile`. |

**App mobile** (`apps/mobile`, package `@wellness/mobile`) :

| Commande (dans `apps/mobile`) | Effet |
|---|---|
| `npx expo start` | Serveur de dev (nécessitera un **dev build**, pas Expo Go — module natif PowerSync). |
| `npx expo start --android` | Ouvre sur Android. |
| `npx expo export --platform web` | Bundle web (utilisé comme smoke-test de bundling). |
| `npx expo install --check` | Vérifie l'alignement des versions avec le SDK Expo. |

> **Structure** : `apps/mobile` (Expo Router, state Zustand, i18n i18next FR/EN),
> `apps/admin` (stub back-office, V0.7), `packages/shared` (types + schémas Zod partagés).
> Config Metro monorepo dans [apps/mobile/metro.config.js](apps/mobile/metro.config.js).
> **Pas encore câblés** : EAS (dev build), tests (Jest/Vitest), Supabase/PowerSync — à ajouter
> avec les US correspondantes.

## Langue

Projet et documentation en **français**. Dates au format JJ/MM/AAAA. Rédige docs, commits et échanges en français.
