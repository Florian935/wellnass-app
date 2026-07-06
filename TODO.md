# TODO — Wellness App

Suivi **vivant** des tâches. On y ajoute les US au fur et à mesure qu'elles entrent dans le
pipeline ; la commande [`/commit`](.claude/commands/commit.md) coche ce qui vient d'être livré.

- Légende : `[ ]` à faire · `[~]` en cours · `[x]` fait
- Le **backlog complet** (179 US, V0.1 → V1.1) vit dans
  [docs/roadmap/roadmap.md](docs/roadmap/roadmap.md) — ne pas le recopier ici, seulement
  remonter les US actives.
- Rappel workflow (voir [CLAUDE.md](CLAUDE.md)) : **spec → plan → design → validation → code**.
  Chaque US = une branche (`feature/…`, `fix/…`, `chore/…`).

*Dernière mise à jour : 06/07/2026*

---

## 🔴 Bloquant — infra cloud (accès **Damien**)

> **US1 mergée dans `dev` (`248e2b2`) mais NON activée** : l'app buildée depuis `dev` marche en
> local/offline, mais **la synchro PowerSync échoue** tant que le cloud n'a pas le schéma. À régler
> en priorité — nécessite les accès Supabase/PowerSync (Damien).

- [ ] **Appliquer les migrations Supabase cloud** — `supabase db push` (fichiers
  `20260706120000_socle_muscu_tables.sql` + `20260706120001_socle_muscu_rls.sql`) **+ vérifier /
  créer la publication `powersync`** (`create publication powersync;` si absente).
- [ ] **Déployer les sync rules** sur le dashboard PowerSync depuis
  [powersync-sync-rules.yaml](docs/specs/technical/powersync-sync-rules.yaml).
- [ ] **`npm run db:types`** une fois les tables appliquées (régénère `packages/shared/database.types.ts`).
- [ ] **Appliquer le seed** des 16 exercices (`supabase db reset` local, ou insert cloud) pour
  peupler la bibliothèque.
- [ ] **Vérif device US1 (Task 22)** : écriture/lecture mode avion, sync montante, sync descendante,
  **RLS sur 2 appareils**, i18n FR/EN.
- [ ] **Relecture a posteriori par Damien** — le merge US1 a court-circuité la relecture à deux
  (zones sync/sécurité) sur décision explicite de Florian ; à repasser.
- [ ] **US2 (une fois intégrée)** : appliquer les migrations `20260706130000_programmes_tables.sql`
  (+ FK workouts) et `20260706130001_programmes_rls.sql` sur le cloud, **redéployer les sync rules**
  (elles incluent désormais les 4 tables programmes), rejouer le seed (programme éditorial), **vérif
  device US2** (créer/dupliquer/activer un programme, démarrer une séance depuis un programme).

---

## 🚧 En cours

- [x] **Session persistante & chiffrée** (1.5/9.8) — SecureStore/Keystore — mergé, **testé sur device** (persistance OK après fermeture) (05/07/2026)
- [x] **PowerSync** (9.13/9.3) — SQLite local (op-sqlite) + connecteur Supabase + sync streams — mergé, **« Synchronisé » vert sur device** (05/07/2026)
- [x] **Légal + consentement + âge 16+** (1.21) — CGU/confidentialité (brouillon) + contrôle d'âge — mergé, testé device (05/07/2026)
- [x] **🏷️ Tag v0.1.0** — fin de version V0.1 (05/07/2026)
- [x] **V0.2 — Onboarding skippable** (1.7-1.11) — parcours 5 étapes + store profil — mergé, testé device (05/07/2026)
- [x] **V0.2 — Profil persistant & éditable** (1.12) — persistance SecureStore + profil éditable + accueil perso + relance onboarding — mergé, testé device (05/07/2026)
- [x] **V0.2 — Séance libre (muscu)** — bibliothèque/recherche/favoris/perso (3.13-3.16), séance libre + validation + chrono repos + édition séries (3.23/3.25/3.28/3.30/3.31), résumé (3.35) — mergé (PR #13), testé device (06/07/2026). ⚠️ stores persistés **local Zustand** (dette data adressée par le cadrage ci-dessous).
- [x] **Cadrage — Schéma de données socle & muscu (PowerSync)** — spec [schema-donnees-muscu.md](docs/specs/technical/schema-donnees-muscu.md) + plan [us1-socle-data-muscu.md](docs/plans/us1-socle-data-muscu.md), tous deux revus et **validés**. Découpé en 3 US. (06/07/2026)
- [x] **US1 — Socle data (bascule PowerSync)** — **code mergé dans `dev`** (`248e2b2`, 06/07/2026) : `packages/shared` (schémas Zod + logique, 127 tests), 4 repositories, schéma PowerSync local, migrations+RLS+seed+sync rules, bascule de tous les écrans + gate offline, jest-expo, suppression des stores Zustand (dette soldée). typecheck/lint/test verts, 2 revues + fix offline-first. **Activation cloud + vérif device = section 🔴 en haut.**
- [~] **US2 — Programmes muscu** (`feature/programmes-muscu`) — **code terminé** (13 commits) : schémas shared (+47 tests), migrations+RLS+seed+sync rules, schéma local, `program-repository`, écrans biblio/création/détail/activation + démarrer depuis programme (3.1-3.6, 3.12, 3.24). typecheck/lint/test verts, revue repo + revue finale **GO**. **Reste** : intégration (PR/merge) + activation cloud + vérif device (section 🔴). (Planning/progression/notifs → US2b.)

---

## ⏭️ À faire prochainement (avant / début V0.1)

### Décisions bloquantes à trancher
- [x] Confirmer **PowerSync** via le spike ([spike-001](docs/specs/technical/spike-001-powersync.md)) — ✅ **validé le 05/07/2026** (voir [ADR-001](docs/adr/ADR-001-moteur-sync-offline.md)), débloque le modèle de données
- [ ] Trancher **Mapbox vs MapLibre** (fournisseur de cartes, running V0.5)
- [ ] Source des **GIF d'exercices** — exercises-dataset vs ExerciseDB (avant V0.2)
- [ ] Source de la **base d'aliments** — CIQUAL + OpenFoodFacts + plan de traduction EN (avant V0.4)

### Scaffolding (fondations, à poser avant tout code fonctionnel)
- [x] Initialiser le **monorepo** (`apps/mobile`, `apps/admin`, `packages/shared`) — npm workspaces (05/07/2026)
- [x] Créer l'**app Expo** (React Native + TypeScript + Expo Router + Zustand) — SDK 57, Metro monorepo (05/07/2026)
- [x] Poser l'infra **i18n** (i18next + expo-localization, FR + EN, aucune chaîne en dur) (05/07/2026)
- [x] Renseigner la section **Commandes** de [CLAUDE.md](CLAUDE.md) (05/07/2026)
- [x] Câbler un **runner de tests** — Vitest sur `packages/shared` (couverture 100 %) + `npm run test` (05/07/2026)
- [x] **Dev build Expo** (EAS) — profils `eas.json`, `eas init`, **1er build `build:dev` réussi** (APK dev client) (05/07/2026)
- [~] **Socle Supabase local** — `supabase/` (config, migration conventions, seed), client typé mobile + `.env.example`, scripts `db:*`. Reste : `db:start` (Docker) + provisioning cloud + schéma métier (avec les US)
- [x] Câbler les **tests mobile** (jest-expo) — fait avec l'US1 (mocks PowerSync + smoke) (06/07/2026)
- [x] Provisionner **Supabase cloud** (projet) + instance **PowerSync** — provisionné (confirmé 06/07/2026). Reste : pousser tables + RLS + sync rules (US1)
- [~] Intégrer **PowerSync** dans l'app (SQLite local, sync rules, repository) — plomberie posée (schéma jouet `todos`, connecteur générique) ; vrai schéma métier = US1

### Modèle de données & bascule PowerSync — pilier muscu (spec [schema-donnees-muscu.md](docs/specs/technical/schema-donnees-muscu.md))
- [x] **US1 — Socle data** — mergée dans `dev` (`248e2b2`, 06/07/2026). Activation cloud + device = section 🔴 en haut.
- [~] **US2 — Programmes muscu** (`feature/programmes-muscu`) : `programs`/`program_translations`/`sessions`/`exercise_plans` (V0.3) — plan approuvé, implémentation en cours.
- [ ] **US3 — Historique & records** (`feature/historique-records-muscu`) : `personal_records` + courbes/historique (V0.3)

---

## 📋 Backlog par version

Voir [docs/roadmap/roadmap.md](docs/roadmap/roadmap.md). Ordre de build :
**V0.1** socle & compte → **V0.2/V0.3** muscu → **V0.4** alimentation → **V0.5** running →
**V0.6** dashboard & sync cloud → **V0.7** admin → **V0.8** bêta → **V1.0** lancement → **V1.1** post-lancement.

Les US remontent ici (dans « À faire prochainement » puis « En cours ») dès qu'elles
démarrent leur cycle spec → plan → design → validation → code.

---

## ✅ Fait

- [x] Phase de cadrage : fusion des cadrages Florian + Damien, arbitrages A→H, roadmap versionnée (04/07/2026)
- [x] Process de travail : workflow spec→plan→design→validation→code, branches, `/commit` (revue + CHANGELOG + push `dev`) (05/07/2026)
- [x] Fichiers de config dépôt : `.gitignore` + `.gitattributes` (normalisation LF) (05/07/2026)
- [x] Bundle design FitTrio (handoff Claude Design) importé dans `design/` (05/07/2026)
- [x] Scaffolding monorepo : npm workspaces + Expo (SDK 57, Router, Zustand, i18n FR/EN) + `packages/shared` (Zod) + stub `apps/admin` — typecheck ✅, bundle web ✅ (05/07/2026)
- [x] Runner de tests : Vitest sur `packages/shared`, 15 tests, couverture **100 %** (05/07/2026)
- [x] **V0.1 — Shell de navigation** : onglets + masquage piliers (2.1/2.2), thème (1.16), états vides (2.10), i18n FR/EN — mergé, **testé sur device** (05/07/2026)
- [x] **V0.1 — Polices custom** : Bricolage / Hanken / Space Mono d'après la maquette — mergé, testé sur device (05/07/2026)
- [x] **V0.1 — Unités (1.15) + blocs dashboard** : métrique/impérial (conversions 100 %) + accueil étoffé — mergé, testé sur device (05/07/2026)
- [x] **Écrans piliers** : en-tête structuré (`ScreenHeader`) + tagline — mergé (05/07/2026)
- [x] **V0.1 — Auth Supabase** (1.1/1.4/1.5/1.6/9.5) : inscription, connexion, session, reset, déconnexion — mergé, testé sur device (05/07/2026)
- [x] ESLint mobile (eslint-config-expo, flat config) + config EAS (`eas.json`) + `eas init` (05/07/2026)
- [x] CI GitHub Actions : typecheck + lint + tests sur chaque PR `dev`/`main` (05/07/2026)
