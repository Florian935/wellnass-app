# Bonnes Pratiques Techniques

Règles d'ingénierie applicables à **tous les développements** de la roadmap ([[Validation Fonctionnalités]]), de la V0.1 au post-lancement. Complète [[Architecture Technique]] (le *quoi*) par le *comment*.

---

## 1. Organisation du code

- **Monorepo** : `apps/mobile` (Expo), `apps/admin` (web), `packages/shared` (types, validation, calculs métier communs)
- **Découpage par feature, pas par type** : `features/workout/`, `features/nutrition/`… chacune contenant ses écrans, hooks, stores et repositories — pas de dossiers fourre-tout `components/` géants
- **La logique métier vit dans des fonctions pures** (TDEE, 1RM Epley, calcul de streak, records par segment glissant) dans `packages/shared` — testables sans React Native, réutilisables par l'admin et le backend
- **TypeScript strict** partout : `strict: true`, pas de `any` non justifié, types générés depuis le schéma DB (pas de duplication manuelle)

## 2. Qualité & style

- **ESLint + Prettier** avec pre-commit hooks (husky + lint-staged) — aucun code non formaté ne rentre
- **Composants d'affichage purs** ; la logique dans des hooks custom (`useWorkoutSession`, `useStreak`)
- **Aucune chaîne en dur dans l'UI** : i18n dès la V0.1 (fichiers de traduction même en FR-only) — le passage EN en V2 devient trivial
- **Aucun nombre magique métier dans le code** : les constantes (facteurs d'activité, ratios macros, seuil deload 80 %, règle des 10 %) sont centralisées dans un module de configuration documenté

## 3. Git & workflow

- **Branches courtes nommées d'après la roadmap** : `feat/3.23-seance-libre`, `fix/5.16-auto-pause` — traçabilité directe avec [[Validation Fonctionnalités]]
- **Conventional commits** (`feat:`, `fix:`, `chore:`…) → changelog généré automatiquement
- **PR petites** (une fonctionnalité de la roadmap = une PR idéalement), CI verte obligatoire avant merge
- **Jamais de commit direct sur `main`** ; `main` doit toujours être livrable

## 4. Tests

Pyramide de tests, du plus au moins nombreux :

| Niveau | Cible | Outil | Exigence |
|---|---|---|---|
| Unitaire | Calculs métier purs (TDEE, 1RM, streak, records, conversions d'unités, macros) | Vitest / Jest | **100 % sur `packages/shared`** — ce sont des fonctions pures, aucune excuse |
| Intégration | Repositories SQLite, queue de sync, migrations | Jest + SQLite in-memory | Chaque migration testée montée **et** descendue |
| E2E | Parcours critiques : inscription, séance muscu complète, ajout d'un repas, course GPS simulée | Maestro | Les 4-5 parcours cœur, pas plus — exécutés en CI sur chaque release |

- **Tout bug corrigé = un test de non-régression** ajouté avec le fix
- Les cas limites métier identifiés dans les specs (minuit/fuseau pour le streak, séance > 3h, GPS perdu en course) ont chacun leur test explicite

## 5. Données & synchronisation

- **Migrations versionnées** (numérotées, immuables une fois mergées) — jamais de modification directe du schéma
- **UUID générés côté client** : indispensable en offline-first (pas d'attente du serveur pour créer une entité)
- **Timestamps en UTC partout** ; la conversion au fuseau local se fait uniquement à l'affichage et pour le calcul du "jour" (streak, journal)
- **Soft delete** (`deleted_at`) sur toutes les entités synchronisées — une suppression doit pouvoir se propager entre appareils
- **Toute écriture passe par un repository** — pas de SQL dans les composants ni les hooks d'écran
- **Queue de sync idempotente** : chaque opération rejouable sans effet de bord, retry avec backoff exponentiel, jamais de perte silencieuse (les échecs définitifs remontent à Sentry)

## 6. Sécurité

- **Aucun secret dans le repo** : variables d'environnement + EAS Secrets ; les clés (Mapbox, OAuth) ne transitent jamais par Git
- **Validation des entrées côté serveur systématique** — schémas Zod définis dans `packages/shared`, partagés client/serveur (le client valide pour l'UX, le serveur valide pour la sécurité)
- **RLS testée** : un test d'intégration vérifie qu'un utilisateur A ne peut pas lire les données d'un utilisateur B — rejoué à chaque modification de policy
- **Moindre privilège** pour les rôles admin ([[Outils d'Administration]]) : `content_editor` ne touche jamais aux utilisateurs
- Mises à jour de dépendances régulières (Dependabot/Renovate) ; audit avant chaque release store

## 7. Performance

Budgets chiffrés dans [[Architecture Technique]] (cold start < 2 s, 60 fps en séance). En pratique :

- **FlashList** (pas FlatList) pour toutes les listes longues (historique, base d'aliments)
- **Downsampling des points GPS** pour le rendu carte (algorithme Douglas-Peucker) — on stocke tout, on n'affiche pas tout
- **GIF d'exercices** : téléchargés à la demande + cache disque, jamais bundlés intégralement
- Re-renders maîtrisés : sélecteurs Zustand fins, memoization uniquement là où un profiling l'a justifiée
- **Écran de séance = zone critique** : profiler à chaque modification, aucune écriture DB bloquante sur le fil UI

## 8. Robustesse & UX technique

- **Optimistic UI** : toute écriture locale est instantanée à l'écran — jamais de spinner pour une action offline-first
- **Toute erreur est capturée** : remontée Sentry + message utilisateur actionnable ("Réessayer", "Passer en mode sans GPS") — jamais de crash silencieux ni d'alerte technique brute
- **Le suivi de séance survit à tout** : kill de l'app, redémarrage du téléphone, batterie vide → l'état de la séance est persisté en continu (voir 3.36 / 5.20)
- **Accessibilité dès la conception** : labels sur chaque élément interactif, Dynamic Type et contraste vérifiés par feature — pas de rattrapage en V0.8 (la 9.11/9.12 n'est qu'une validation finale)

## 9. Observabilité

- **Sentry** : crashs + erreurs JS/natives, avec release tracking (source maps uploadées par la CI)
- **Analytics first-party** (9.10) : convention de nommage `pilier.action` (`muscu.seance_terminee`, `nutrition.repas_ajoute`) — un événement se déclare dans un fichier unique typé, jamais de chaîne libre dispersée
- Logs serveur structurés (JSON) avec `userId` + `requestId` pour tracer un problème de sync de bout en bout

## 10. CI/CD & releases

- **GitHub Actions sur chaque PR** : typecheck + lint + tests unitaires/intégration (< 10 min)
- **EAS Build par canal** : `development` (dev client) / `preview` (bêta interne) / `production`
- **EAS Update (OTA)** pour les correctifs JS entre deux releases store — réservé aux fixes, jamais aux features
- **SemVer** + changelog généré depuis les conventional commits
- Chaque fin de version de la roadmap (V0.2, V0.3…) = un tag + un build `preview` installable — le jalon est testable, pas théorique

## 11. Documentation & décisions

- **ADR** (Architecture Decision Records) : chaque décision structurante (source GIF, base d'aliments, Mapbox vs MapLibre, stratégie de sync) = un fichier court daté avec le contexte et les alternatives écartées
- Les règles métier restent documentées dans ce vault (fichiers par pilier) — le code y renvoie en commentaire quand une règle n'est pas évidente
- README par package : comment lancer, tester, builder

## 12. Definition of Done

Une fonctionnalité de [[Validation Fonctionnalités]] n'est terminée que si :

- [ ] Code mergé sur `main`, CI verte
- [ ] Tests écrits (unitaires sur la logique, cas limites des specs couverts)
- [ ] **Fonctionne offline** (vérifié en mode avion)
- [ ] État vide traité (2.10)
- [ ] Accessibilité de base : labels + Dynamic Type + contraste
- [ ] Erreurs gérées (message utilisateur + Sentry)
- [ ] Chaînes passées par i18n, constantes métier centralisées
- [ ] Doc du vault mise à jour si la règle métier a bougé

---

## 13. Skills Claude Code à prévoir

Le développement sera largement porté par Claude Code (166 fonctionnalités 🟢 sur 179 — voir [[Validation Fonctionnalités]]). Pour industrialiser ce travail, le repo embarque un `CLAUDE.md` et des **skills projet** (`.claude/skills/`) qui encodent les workflows répétitifs. À créer dès la V0.1, à enrichir au fil des versions.

### CLAUDE.md (mémoire projet)

Fichier à la racine du repo, lu par Claude à chaque session. Contenu :
- Stack et structure du monorepo (où vivent les features, les calculs partagés, les migrations)
- Conventions : nommage des branches (`feat/<id-roadmap>-<slug>`), conventional commits, i18n obligatoire
- Lien vers la Definition of Done (section 12) et les règles métier du vault
- Commandes usuelles : lancer l'app, les tests, une migration, le seed

### Skills projet à créer

| Skill | Rôle | Ce qu'il encode |
|---|---|---|
| `/new-feature <id>` | Démarrer une fonctionnalité de la roadmap | Lit la ligne correspondante dans [[Validation Fonctionnalités]] + la spec du pilier concerné, crée la branche `feat/<id>-<slug>`, scaffolde le dossier feature (écran, hook, repository, test) |
| `/verify <id>` | Vérifier une fonctionnalité avant PR | Déroule la Definition of Done : tests, mode avion (offline), état vide, accessibilité, i18n — et lance l'app pour tester le parcours réel |
| `/migrate <nom>` | Créer une migration | Génère la paire SQLite + Postgres, le test montée/descente, met à jour les types générés |
| `/seed` | (Re)générer les données de dev | Exercices, programmes, aliments de test — même contenu que les scripts de seed pré-admin (V0.2-V0.6) |
| `/sync-check` | Tester la synchronisation | Rejoue la suite de tests de conflits (2 appareils simulés), vérifie l'idempotence de la queue |
| `/release <canal>` | Livrer un jalon | Bump SemVer, changelog depuis les commits, build EAS (`preview` en fin de version roadmap, `production` pour les stores), tag Git |
| `/update-roadmap <id> <statut>` | Tenir la roadmap à jour | Met à jour la colonne Statut dans [[Validation Fonctionnalités]] après merge, recalcule le récapitulatif |

### Hooks & garde-fous

- **Hook pre-commit** (côté repo, pas Claude) : lint + typecheck — garantit que le code généré respecte les standards sans dépendre de la vigilance de la session
- **Permissions Claude Code** (`.claude/settings.json`) : autoriser les commandes récurrentes en lecture (tests, lint, expo) pour limiter les frictions ; les commandes destructives (reset DB, déploiement) restent sur confirmation
- **Revue systématique** : `/code-review` avant chaque merge — Claude écrit, Claude relit, l'humain tranche sur les PR sensibles (sync, sécurité, calculs métier)

### Répartition humain / Claude (rappel)

- 🟢 **166 fonctionnalités** : Claude développe de bout en bout (spec du vault → PR verte → `/verify`)
- 🟡 **11 fonctionnalités** : Claude développe, l'humain fournit une clé/du contenu ou valide visuellement (OAuth, contenu éditorial, WCAG, carte)
- 🔴 **2 décisions** : source de la base d'aliments et des GIF — décisions humaines, Claude exécute ensuite
- Les **4 décisions bloquantes** de la roadmap doivent être tranchées *avant* la version qui en dépend, sinon Claude sera bloqué en cours de version
