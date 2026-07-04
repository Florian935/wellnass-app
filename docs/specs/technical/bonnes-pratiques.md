# Bonnes Pratiques Techniques

> Règles d'ingénierie applicables à **tous les développements** de la V1 (3 piliers) au post-lancement. Complète [architecture.md](./architecture.md) (le *quoi*) par le *comment*.
> Reprises du cadrage Dams et **adaptées aux décisions actées** (SYNTHESE-CADRAGE, 04/07/2026) : synchro = **PowerSync** (plus de queue de sync maison à écrire), **i18n FR+EN dès le départ**, **Android d'abord (EAS → Play Store)**, **aucun paywall en V1**.

---

## 1. Organisation du code

- **Monorepo** : `apps/mobile` (Expo), `apps/admin` (web back-office), `packages/shared` (types, validation Zod, calculs métier communs, locales i18n).
- **Découpage par feature, pas par type** : `features/workout/`, `features/running/`, `features/nutrition/`… chacune avec ses écrans, hooks, stores et repositories — pas de dossiers fourre-tout `components/` géants.
- **La logique métier vit dans des fonctions pures** (TDEE Mifflin-St Jeor, 1RM Epley, calcul de streak, records par segment glissant) dans `packages/shared` — testables sans React Native, réutilisables par l'admin et le backend.
- **TypeScript strict** partout : `strict: true`, pas de `any` non justifié, **types générés depuis le schéma Supabase** (pas de duplication manuelle).

## 2. Qualité & style

- **ESLint + Prettier** avec pre-commit hooks (husky + lint-staged) — aucun code non formaté ne rentre.
- **Composants d'affichage purs** ; la logique dans des hooks custom (`useWorkoutSession`, `useStreak`).
- **Aucune chaîne en dur dans l'UI** : i18n **FR + EN dès le départ** (décision G) — chaque clé écrite en FR **et** EN dans la même PR (voir [i18n.md](./i18n.md)).
- **Aucun nombre magique métier dans le code** : les constantes (facteurs d'activité, ratios macros, seuil deload 80 %, règle des 10 %) centralisées dans un module de configuration documenté.

## 3. Git & workflow

- **Branches courtes nommées d'après la roadmap** : `feat/3.23-seance-libre`, `fix/5.16-auto-pause` — traçabilité directe avec la roadmap versionnée.
- **Conventional commits** (`feat:`, `fix:`, `chore:`…) → changelog généré automatiquement.
- **PR petites** (une fonctionnalité = une PR idéalement), CI verte obligatoire avant merge.
- **Jamais de commit direct sur `main`** ; `main` doit toujours être livrable.
- **PR relues à deux** (les deux devs) sur les zones sensibles (sync, sécurité, calculs métier).

## 4. Tests

Pyramide de tests, du plus au moins nombreux :

| Niveau | Cible | Outil | Exigence |
|---|---|---|---|
| Unitaire | Calculs métier purs (TDEE, 1RM, streak, records, conversions d'unités, macros) | Vitest / Jest | **100 % sur `packages/shared`** — fonctions pures, aucune excuse |
| Intégration | Repositories SQLite, **synchro PowerSync (offline/conflits)**, migrations | Jest + SQLite in-memory | Chaque migration testée montée **et** descendue |
| E2E | Parcours critiques : inscription, séance muscu complète, ajout d'un repas, course GPS simulée | Maestro | Les 4-5 parcours cœur, exécutés en CI sur chaque release |

- **Tests de synchro / conflits** : on ne teste plus une queue maison (elle n'existe plus), mais on **valide le comportement PowerSync** — écriture offline persistée, remontée au retour du réseau, redescente, et **résolution de conflit** (2 appareils simulés) conforme au verdict du spike ([offline-sync.md](./offline-sync.md)).
- **Tout bug corrigé = un test de non-régression** ajouté avec le fix.
- Cas limites métier des specs (minuit/fuseau pour le streak, séance > 3h, GPS perdu en course) : chacun son test explicite.

## 5. Données & synchronisation

> **Changement majeur vs Dams** : la synchro est **PowerSync** (managée). On **n'écrit pas** de queue de sync idempotente maison, pas de protocole d'upload/retry, pas de logique de conflit last-write-wins à la main. On garde en revanche les fondations data ci-dessous, **nécessaires** à PowerSync.

- **UUID générés côté client** : indispensable en offline-first (pas d'attente du serveur pour créer une entité) ; clé de réconciliation PowerSync.
- **Timestamps en UTC partout** ; conversion au fuseau local uniquement à l'affichage et pour le calcul du « jour » (streak, journal).
- **Soft delete** (`deleted_at`) sur toutes les entités synchronisées — une suppression doit se propager entre appareils.
- **Toute écriture passe par un repository** — pas de SQL dans les composants ni les hooks d'écran. Le repository écrit dans le SQLite local géré par PowerSync ; la synchro est transparente.
- **Migrations versionnées** (numérotées, immuables une fois mergées) côté Postgres, cohérentes avec le schéma local répliqué.
- **Sync rules par utilisateur** (un bucket par `user_id`) ; contenu global (exercices/programmes/aliments) répliqué en lecture seule — voir [offline-sync.md](./offline-sync.md) §3.

## 6. Sécurité

- **Aucun secret dans le repo** : variables d'environnement + EAS Secrets ; clés (Mapbox, RevenueCat), mot de passe DB et `service_role` ne transitent jamais par Git.
- **Validation des entrées côté serveur systématique** — schémas **Zod** dans `packages/shared`, partagés client/serveur (client pour l'UX, serveur pour la sécurité).
- **RLS testée** : un test d'intégration vérifie qu'un utilisateur A ne peut pas lire les données d'un utilisateur B — rejoué à chaque modification de policy. La RLS conditionne aussi les sync rules PowerSync.
- **Moindre privilège** pour les rôles back-office : `content_editor` ne touche jamais aux utilisateurs ; log d'audit immuable des actions admin.
- Mises à jour de dépendances régulières (Dependabot/Renovate) ; audit avant chaque release Play Store.

## 7. Performance

Budgets chiffrés dans [architecture.md](./architecture.md) §8 (cold start < 2 s, 60 fps en séance). En pratique :

- **FlashList** (pas FlatList) pour toutes les listes longues (historique, base d'aliments).
- **Downsampling des points GPS** pour le rendu carte (Douglas-Peucker) — on stocke tout, on n'affiche pas tout. Volume GPS à valider avec PowerSync (spike).
- **GIF d'exercices** : téléchargés à la demande + cache disque, jamais bundlés intégralement.
- Re-renders maîtrisés : sélecteurs Zustand fins, memoization uniquement là où un profiling l'a justifiée.
- **Écran de séance = zone critique** : profiler à chaque modification, aucune écriture DB bloquante sur le fil UI.

## 8. Robustesse & UX technique

- **Optimistic UI** : toute écriture locale est instantanée à l'écran — jamais de spinner pour une action offline-first (PowerSync remonte en arrière-plan).
- **Toute erreur est capturée** : remontée Sentry + message utilisateur actionnable (« Réessayer », « Passer en mode sans GPS ») — jamais de crash silencieux ni d'alerte technique brute.
- **Le suivi de séance survit à tout** : kill de l'app, redémarrage, batterie vide → l'état de la séance est persisté en continu (SQLite local).
- **Accessibilité dès la conception** : labels sur chaque élément interactif, Dynamic Type et contraste WCAG AA vérifiés par feature — pas de rattrapage final.

## 9. Observabilité

- **Sentry** : crashs + erreurs JS/natives, release tracking (source maps uploadées par la CI).
- **Analytics first-party (PostHog)** : convention de nommage `pilier.action` (`muscu.seance_terminee`, `nutrition.repas_ajoute`) — un événement déclaré dans un fichier unique typé, jamais de chaîne libre dispersée. Indispensable pour arbitrer les évolutions (dont la gamification V3/V4).
- Logs serveur structurés (JSON) avec `userId` + `requestId` pour tracer un problème de sync de bout en bout.

## 10. CI/CD & releases

- **GitHub Actions sur chaque PR** : typecheck + lint + tests unitaires/intégration (< 10 min).
- **EAS Build par canal** : `development` (**dev client requis pour PowerSync**) / `preview` (bêta interne) / `production`.
- **Distribution de lancement : Play Store uniquement** (décision E) ; bêta via Google Play Internal Track. **iOS (TestFlight/App Store) plus tard** — rester cross-platform.
- **EAS Update (OTA)** pour les correctifs JS entre deux releases store — **réservé aux fixes, jamais aux features**.
- **SemVer** + changelog depuis les conventional commits.
- Chaque fin de version de la roadmap = un tag + un build `preview` installable (jalon testable, pas théorique).

## 11. Documentation & décisions

- **ADR** (Architecture Decision Records) : chaque décision structurante = un fichier court daté avec contexte et alternatives écartées. La décision de synchro est actée dans [ADR-001](../../adr/ADR-001-moteur-sync-offline.md) (PowerSync, à confirmer par spike).
- Les règles métier restent documentées ; le code y renvoie en commentaire quand une règle n'est pas évidente.
- README par package : comment lancer, tester, builder.

## 12. Definition of Done

Une fonctionnalité n'est terminée que si :

- [ ] Code mergé sur `main`, CI verte.
- [ ] Tests écrits (unitaires sur la logique, cas limites des specs couverts).
- [ ] **Fonctionne offline** (vérifié en mode avion) et **se synchronise correctement** au retour du réseau (PowerSync).
- [ ] État vide traité.
- [ ] Accessibilité de base : labels + Dynamic Type + contraste.
- [ ] Erreurs gérées (message utilisateur + Sentry).
- [ ] Chaînes passées par i18n **en FR ET EN** (décision G), constantes métier centralisées.
- [ ] Doc mise à jour si la règle métier a bougé.
- [ ] **Aucun paywall / palier payant activé** (décision D) — RevenueCat reste câblé mais inactif en V1.

---

## 13. Skills Claude Code à prévoir

Le développement sera largement porté par Claude Code. Le repo embarque un `CLAUDE.md` (racine) et des **skills projet** (`.claude/skills/`) qui encodent les workflows répétitifs. À créer dès les fondations, à enrichir au fil des versions.

### CLAUDE.md (mémoire projet)
Fichier racine lu à chaque session : stack et structure du monorepo, conventions (branches `feat/<id-roadmap>-<slug>`, conventional commits, **i18n FR+EN obligatoire**), lien vers la Definition of Done (§12), commandes usuelles (lancer l'app en **dev build**, tests, migration, seed).

### Skills projet à créer

| Skill | Rôle | Ce qu'il encode |
|---|---|---|
| `/new-feature <id>` | Démarrer une fonctionnalité de la roadmap | Lit la ligne de roadmap + la spec du pilier, crée la branche, scaffolde le dossier feature (écran, hook, repository, test), **prépare les clés i18n FR+EN** |
| `/verify <id>` | Vérifier avant PR | Déroule la Definition of Done : tests, mode avion (offline) **+ synchro PowerSync**, état vide, accessibilité, i18n FR+EN — lance l'app (dev build) pour tester le parcours réel |
| `/migrate <nom>` | Créer une migration | Génère la migration Postgres + met à jour les types générés + test montée/descente ; cohérence avec le schéma répliqué PowerSync |
| `/seed` | (Re)générer les données de dev | Exercices, programmes, aliments de test (bilingues FR+EN) |
| `/sync-check` | Tester la synchronisation | Rejoue les tests de conflits PowerSync (2 appareils simulés), vérifie écriture offline / remontée / redescente |
| `/release <canal>` | Livrer un jalon | Bump SemVer, changelog, build EAS (`preview` en fin de version, `production` pour le **Play Store**), tag Git |
| `/update-roadmap <id> <statut>` | Tenir la roadmap à jour | Met à jour le statut après merge, recalcule le récapitulatif |

### Hooks & garde-fous
- **Hook pre-commit** (repo) : lint + typecheck — garantit le respect des standards sans dépendre de la vigilance de la session.
- **Permissions Claude Code** (`.claude/settings.json`) : autoriser les commandes récurrentes en lecture (tests, lint, expo) ; les commandes destructives (reset DB, déploiement) restent sur confirmation.
- **Revue systématique** : `/code-review` avant chaque merge — Claude écrit, Claude relit, l'humain tranche sur les PR sensibles (sync, sécurité, calculs métier).
