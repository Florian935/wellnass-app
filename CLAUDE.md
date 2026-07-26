# CLAUDE.md

Guidage pour Claude Code (claude.ai/code) sur ce dépôt.

## État du projet

👉 **Ne devine pas où on en est : lance [`/etat`](.claude/commands/etat.md)** (ou lis
[ETAT.md](ETAT.md), qu'il régénère). C'est la **première chose à faire dans une session**.

En résumé, au 26/07/2026 : **l'app est quasi complète**. Les 3 piliers (Musculation, Running,
Nutrition) sont fonctionnels, l'app tourne **offline avec synchro cloud réelle** (PowerSync +
Supabase), le **back-office** existe (15 écrans), le dev build EAS et le build local Android
fonctionnent. Il reste **3 items bloquants** avant publication : Health Connect (9.9),
accessibilité (9.11/9.12) et la publication Play Store (9.2).

### Où se trouve quoi

| Besoin | Fichier | Nature |
|---|---|---|
| **Où on en est, maintenant** | [ETAT.md](ETAT.md) | 🤖 **généré** — ne jamais éditer à la main |
| **Ce qu'il reste à faire** | [BACKLOG.md](BACKLOG.md) | candidats priorisés P0/P1/P2, **sans spec encore** |
| **État d'une US précise** | le **front-matter** de sa [spec](docs/specs/functional/us/) | source de vérité par US |
| **Le périmètre complet** | [roadmap](docs/roadmap/roadmap.md) | ~194 fonctionnalités, colonne Statut |
| **Les analyses de données** | [catalogue](docs/product/analyses-donnees.md) | 2ᵉ backlog, 220 items |
| **Les idées non cadrées** | [IDEAS.md](IDEAS.md) | boîte de dépôt, avant tout cadrage |
| **L'historique** | [CHANGELOG.md](CHANGELOG.md) · [docs/journal/](docs/journal/) | trace par commit + archives gelées |

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
   par incréments bornés.
6. **Clôture** — **la recette validée par Florian ou Damien suffit à clôturer l'US.** La relecture
   croisée par l'autre dev **n'est pas requise** : elle reste possible à la demande, jamais bloquante.

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
- **fait avancer le `etape:` du front-matter** de la spec d'US concernée — c'est **la** source de
  vérité de l'avancement d'une US ;
- **met à jour le statut de la [roadmap](docs/roadmap/roadmap.md)** — étape **obligatoire** dès
  qu'un commit livre (ou fait avancer) une fonctionnalité : passer la colonne **Statut** à
  ✅ Livré / 🟡 Partiel selon le réel du code, ajuster les compteurs du
  [Récapitulatif](docs/roadmap/roadmap.md#récapitulatif), et ajouter une entrée courte au journal
  des réconciliations. **Si la fonctionnalité n'a pas de ligne, la créer** dans la section
  « Hors périmètre de cadrage » — ne jamais laisser du livré invisible ;
- **régénère [ETAT.md](ETAT.md)** (`node scripts/etat.mjs`) ;
- crée un **commit conventionnel** en français ;
- **pousse la branche sur `dev` distant** (fast-forward/merge puis `git push origin dev`).

### Suivi de l'avancement — le modèle en 4 niveaux

Refondu le **26/07/2026** : l'ancien `TODO.md` était devenu un journal append-only de 1592 lignes,
illisible, et la roadmap ignorait 15 fonctionnalités pourtant livrées. Le principe qui remplace
tout ça : **chaque information a un seul endroit, et cet endroit se remplace au lieu de grossir.**

1. **[ETAT.md](ETAT.md)** — *où on en est, maintenant*. 🤖 **Généré** par `node scripts/etat.mjs`
   (skill [`/etat`](.claude/commands/etat.md)). **Ne jamais l'éditer à la main** : si une ligne est
   fausse, la source est fausse. C'est le premier fichier à lire dans une session.
2. **Le front-matter de chaque [spec d'US](docs/specs/functional/us/)** — *l'état d'une US*.
   Champ `etape:` ∈ `spec` `plan` `design` `validation` `code` `recette` `relecture` `close`,
   plus `id`, `titre`, `roadmap:`, `catalogue:`, `branche`, `maj`. C'est ce que le générateur lit.
3. **[BACKLOG.md](BACKLOG.md)** — *ce qu'il reste à faire*. Une ligne par candidat **sans spec
   encore**, priorisé P0 (bloquant lancement) / P1 (finition visible) / P2 (confort). Dès qu'un
   candidat entre dans le pipeline via [`/us`](.claude/commands/us.md), il quitte le backlog.
4. **[roadmap](docs/roadmap/roadmap.md)** — *la photo d'ensemble du périmètre* (~194 fonctionnalités,
   **MVP1 = V1.0 complète**). Colonne Statut ✅ 🟡 ⬜ ⏳ ❌. Audit périodique par
   [`/reconcilier`](.claude/commands/reconcilier.md).

À côté : le **[catalogue d'analyses](docs/product/analyses-donnees.md)** (2ᵉ backlog, 220 items,
source de vérité des US META/MN/MR/NUTR/RN — ne pas les dupliquer dans la roadmap), le
**[CHANGELOG](CHANGELOG.md)** (historique par commit, a vocation à grossir), et
**[docs/journal/](docs/journal/)** (archives gelées).

> **La règle qui compte** : un fichier de suivi qui ne fait que grossir a cessé d'être un tableau
> de bord. Si tu ajoutes sans jamais retirer, tu es en train de recréer l'ancien TODO.

### Idées — IDEAS.md
[IDEAS.md](IDEAS.md) à la racine est la **boîte de dépôt** des idées brutes captées au fil de
l'eau, **avant** tout cadrage. Ce n'est pas le pipeline : on y note vite, on relit
régulièrement pour trier. Une idée retenue devient une US via [`/us`](.claude/commands/us.md)
(spec → plan → design → validation) et rejoint la roadmap ; l'idée est alors archivée dans
IDEAS.md avec la décision.

### Migrations base de données (OBLIGATOIRE)

**Jamais de SQL collé à la main dans la console Supabase.** Coller du SQL dans le dashboard
n'écrit rien dans l'historique CLI (`supabase_migrations.schema_migrations`) : le schéma change
mais le CLI l'ignore, et repo ↔ cloud divergent silencieusement. Toute évolution de schéma passe
par un fichier de migration versionné et par le CLI.

> **Contexte actuel : les deux devs (Florian, Damien) n'ont pas Docker.** On développe donc
> **directement sur la base cloud** (`nsxzflxsgovriwwvflxe`) ; il n'y a **pas de base locale**.
> L'étape « test en local » (`db:reset`) est donc **sautée** — voir l'encadré Docker plus bas.

Cycle **sans Docker** :

1. **Créer** la migration : `npm run db:new <nom>` (génère le fichier horodaté dans
   [supabase/migrations/](supabase/migrations/)) — puis écrire le SQL dedans.
2. **Prévisualiser** : `npm run db:push:dry` (liste les migrations qui vont partir, sans les jouer).
3. **Pousser sur le cloud** : `npm run db:push`. Le CLI ne joue que les migrations manquantes, dans
   l'ordre, chacune en transaction (une erreur = rollback propre de cette migration). **À faire dès
   que la migration est créée** — c'est ce qui remplace le copier-coller dans la console.
4. **Régénérer les types** : `npm run db:types`.
5. **Cocher** la migration dans le registre [supabase/MIGRATIONS.md](supabase/MIGRATIONS.md)
   (case + date) : on sait ainsi, d'un coup d'œil, ce qui a réellement été appliqué sur le cloud.

> **Si un jour Docker est installé** : intercaler un `npm run db:reset` entre les étapes 1 et 2
> pour tester la séquence complète (base locale jetable + seed) **avant** de pousser sur le cloud.
> ⚠️ Ne **jamais** ajouter `--linked` à `db reset` : cela viserait le **cloud** et effacerait
> toutes les données.

> Les migrations ne sont **pas** idempotentes par défaut (`create table` / `create policy` sans
> garde). Ne jamais rejouer une migration déjà appliquée. Si une migration a été exécutée
> manuellement (hors CLI), réconcilier l'historique sans rejouer le SQL :
> `supabase migration repair --status applied <version>`, puis cocher dans le registre.

## Méthode de travail attendue

- Suivre la [roadmap versionnée](docs/roadmap/roadmap.md) : livrer **par versions** (chaque fin de
  version = un build installable), ne pas attendre les 3 piliers pour tester.
- Travailler par **incréments bornés** (une fonctionnalité de la roadmap = une user story + tests + PR).
- Respecter la **Definition of Done** et les standards de
  [docs/specs/technical/bonnes-pratiques.md](docs/specs/technical/bonnes-pratiques.md).
- Découpage fin. **Une seule validation suffit** (Florian ou Damien) : pas de relecture croisée
  obligatoire pour clôturer.

## Structure de la documentation

```
/ETAT.md                    → 🤖 GÉNÉRÉ — où on en est (scripts/etat.mjs, skill /etat). NE PAS ÉDITER
/BACKLOG.md                 → reste-à-faire priorisé P0/P1/P2 (candidats sans spec)
/IDEAS.md                   → boîte de dépôt des idées brutes à trier (avant cadrage en US)
/CHANGELOG.md               → trace des modifications par commit (tenu par /commit)
/supabase/MIGRATIONS.md     → registre coché des migrations poussées sur le cloud
/SYNTHESE-CADRAGE.md        → arbitrages tranchés (décisions A→H)
/scripts/etat.mjs           → générateur de ETAT.md (`node scripts/etat.mjs [--check]`)
/design                     → maquettes par fonctionnalité (exportées de Claude Design)
/apps
  /mobile                   → app Expo (React Native, Expo Router, Zustand, i18n) — 3 piliers livrés
  /admin                    → back-office web React+Vite (15 écrans : exercices, programmes,
                              aliments, import CSV, utilisateurs, rôles, audit)
/packages
  /shared                   → types + schémas Zod + briques pures testées (+ database.types générés)
/supabase                   → config, migrations (44), seed. ⚠️ seed.sql n'est joué que par
                              `db:reset` (Docker) — non utilisé aujourd'hui, voir BACKLOG
/docs
  /journal                  → 🧊 archives gelées du suivi (ancien TODO.md)
  /product                  → vision, prd, personas, metriques-succes, analyses-donnees (catalogue),
                              ia-integration-analyse
  /specs
    /functional             → specs par pilier + /us : 74 specs d'US (front-matter = état de l'US)
    /technical              → architecture, offline-sync, modele-donnees, i18n, bonnes-pratiques,
                              powersync-sync-rules.yaml, dev-build-android-local, environnement-dev-local
  /plans                    → 72 plans d'implémentation (1 par US)
  /adr                      → ADR-001 (sync) … ADR-007 (surfaçage des analyses)
  /roadmap                  → roadmap.md (V0.1 → V1.1 + hors cadrage)
```

### Skills du dépôt (`.claude/commands/`)

| Skill | Quand |
|---|---|
| [`/etat`](.claude/commands/etat.md) | **Début de session** — régénère ETAT.md et dit où on en est. |
| [`/us`](.claude/commands/us.md) | Démarrer une US : branche + spec + plan + maquette + front-matter. S'arrête à la validation. |
| [`/commit`](.claude/commands/commit.md) | Commiter : revue de diff, CHANGELOG, front-matter, roadmap, ETAT, push sur `dev`. |
| [`/reconcilier`](.claude/commands/reconcilier.md) | Mensuel / avant jalon — audite l'écart code ↔ documentation. |

## Commandes

**Monorepo npm workspaces** (Node ≥ 20, voir [.nvmrc](.nvmrc)). Depuis la racine :

| Commande | Effet |
|---|---|
| `npm install` | Installe toutes les dépendances (hoistées à la racine). |
| `npm run typecheck` | `tsc --noEmit` sur tous les workspaces. |
| `npm run lint` | Lint des workspaces qui l'exposent (`expo lint` + eslint-config-expo côté mobile). |
| `npm run test` | Tests des workspaces : **Vitest** sur `packages/shared` (~860) + **Jest** sur `apps/mobile` (~116). ⚠️ **lire le code de sortie sans pipe** — un `\| tail` en aval renvoie 0 même si un test échoue. |
| `npm run mobile` | Raccourci → démarre le serveur de dev Expo de `apps/mobile`. |
| `node scripts/etat.mjs` | Régénère [ETAT.md](ETAT.md). `--check` = échoue si le fichier est périmé. |

**App mobile** (`apps/mobile`, package `@wellness/mobile`) :

| Commande (dans `apps/mobile`) | Effet |
|---|---|
| `npx expo start` | Serveur de dev (nécessitera un **dev build**, pas Expo Go — module natif PowerSync). |
| `npx expo start --android` | Ouvre sur Android. |
| `npx expo export --platform web` | Bundle web (utilisé comme smoke-test de bundling). |
| `npx expo install --check` | Vérifie l'alignement des versions avec le SDK Expo. |
| `npm run build:dev` | Build EAS **dev client** (APK, requis pour PowerSync) — nécessite `eas login` + `eas init`. |
| `npm run build:preview` / `build:prod` | Build EAS bêta interne (APK) / Play Store (AAB). |

**Supabase** (CLI `supabase` via `npx supabase`). Dev **directement sur le cloud** (pas de Docker
chez les devs) ; les commandes `db:start`/`db:stop`/`db:reset` visent une stack **locale** et
**requièrent Docker Desktop** — non utilisées actuellement.

| Commande (racine) | Effet | Docker requis |
|---|---|:---:|
| `npm run db:new <nom>` | Crée un fichier de migration horodaté dans `supabase/migrations/`. | non |
| `npm run db:push` / `db:push:dry` | Pousse les migrations manquantes sur le **cloud** / liste-les sans les jouer. | non |
| `npm run db:types` | Régénère `packages/shared/src/database.types.ts` depuis le schéma **cloud**. | non |
| `npm run db:status` | Affiche l'état de la stack locale (URL + clés). | oui |
| `npm run db:start` / `db:stop` | Démarre / arrête la stack Supabase locale. | oui |
| `npm run db:reset` | Recrée la base **locale** + rejoue les migrations + `seed.sql`. | oui |

> **Structure** : `apps/mobile` (Expo Router, Zustand, i18n i18next FR/EN, PowerSync),
> `apps/admin` (back-office React+Vite, 15 écrans), `packages/shared` (types, schémas Zod, briques
> pures testées). Config Metro monorepo dans [apps/mobile/metro.config.js](apps/mobile/metro.config.js).
> **CI** : GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) exécute
> typecheck + lint + tests sur chaque PR vers `dev`/`main`.
> **EAS** : profils de build ([eas.json](apps/mobile/eas.json)) opérationnels. Le **build local
> Android** (`gradlew assembleRelease`) est documenté dans
> [dev-build-android-local.md](docs/specs/technical/dev-build-android-local.md) et
> [environnement-dev-local.md](docs/specs/technical/environnement-dev-local.md) — utile quand le
> quota EAS est épuisé.
> **Supabase** : projet **cloud** (`nsxzflxsgovriwwvflxe`), 44 migrations appliquées et suivies dans
> [supabase/MIGRATIONS.md](supabase/MIGRATIONS.md). Dev directement sur le cloud (pas de base
> locale — Docker non installé). Client typé mobile
> ([src/lib/supabase.ts](apps/mobile/src/lib/supabase.ts), Auth).
> **PowerSync** : intégré et opérationnel (SQLite local + synchro bidirectionnelle,
> [powersync/system.ts](apps/mobile/src/powersync/system.ts)). ⚠️ **Les sync rules ne sont pas
> versionnées côté outil** : après une migration qui ajoute une table synchronisée, coller
> [powersync-sync-rules.yaml](docs/specs/technical/powersync-sync-rules.yaml) dans le dashboard
> PowerSync et déployer — **étape manuelle, déjà oubliée une fois** (une note d'exercice n'aurait
> pas survécu à une resynchro).

## Langue

Projet et documentation en **français**. Dates au format JJ/MM/AAAA. Rédige docs, commits et échanges en français.
