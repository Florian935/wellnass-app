# Stratégie de tests

> Cadrage établi le **03/08/2026**. Complète [bonnes-pratiques.md §4](./bonnes-pratiques.md), qui
> pose la pyramide ; ce document dit **où on en est réellement**, **ce qui manque**, et **dans quel
> ordre le combler**. Les chiffres sont mesurés, pas estimés (`npm run test:coverage`).

## 1. Constat

| Workspace | Suites | Tests | Couverture (instructions) | Verdict |
|---|---:|---:|---:|---|
| `packages/shared` | 67 | 1 405 | **99,2 %** (branches 95,1 %) | ✅ conforme à l'objectif « 100 % sur le pur » |
| `apps/mobile` | 51 | 291 | **15,0 %** (branches 12,8 %) | ⚠️ le gros du risque est ici |
| `apps/admin` | 0 | 0 | — (**aucun runner installé**) | ❌ 9 716 lignes non testées |

Détail mobile, par ordre de volume de code non couvert :

| Dossier | Couverture | Instructions | Ce qu'on ne teste pas |
|---|---:|---:|---|
| `src/data/repositories` | **9 %** | 2 334 | 34 fichiers, 12 157 lignes — **le SQL de toute l'app** |
| `src/app` (écrans) | **5 %** | 1 525 + ~1 400 en sous-dossiers | parcours, états vides, erreurs |
| `src/components` | ~23 % | ~1 800 | rendu conditionnel, formats |
| `src/lib` | 28 % | 629 | Health Connect (997 l.), notifications, exports |
| `src/hooks` | 29 % | 175 | |
| `src/stores` | 16 % | 160 | `auth-store` (216 l.) non testé |
| `src/powersync` | 17 % | 89 | connector (partiel), schéma |
| `src/running` | 44 % | 172 | |

**Le diagnostic tient en une phrase** : la logique *pure* est irréprochable parce qu'elle vit dans
`packages/shared` ; tout ce qui touche à la **base locale**, aux **modules natifs** et à
**l'écran** est essentiellement non testé. Ce n'est pas un hasard : jusqu'ici on ne savait pas
tester ces couches autrement qu'en mockant `powerSync` de bout en bout — ce qui vérifie *qu'on a
appelé une fonction*, jamais *que la requête est juste*.

Conséquence concrète et vérifiable : **31 US attendent une recette humaine** ([RECETTES.md](../../../RECETTES.md)),
et le bug de la recette du 31/07/2026 (`cycle_tracking_enabled` absent du schéma PowerSync local,
écriture avalée en silence, interrupteur qui reste éteint) était **invisible** pour la suite de
tests. C'est exactement le type de panne que la §3 rend désormais détectable sans device.

## 2. Où va quel test

Quatre niveaux, du moins au plus coûteux. **La règle : un test se pose au niveau le plus bas
capable de l'attraper.**

| Niveau | Ce qu'on y met | Outil | Objectif |
|---|---|---|---|
| **1. Pur** | calcul métier, formats, règles, conversions | Vitest — `packages/shared` | **100 %**, tenu (99,2 %) |
| **2. Base locale** | requêtes SQL des repositories, écritures, soft delete, idempotence, transactions | Jest + **harness SQLite en mémoire** (§3) | **80 %** sur `data/repositories` |
| **3. Rendu** | états d'un écran/composant : vide, chargement, erreur, i18n, accessibilité | Jest + `@testing-library/react-native` | pas de % cible — **cibler les écrans à état** |
| **4. Device** | ce qu'aucun test ne peut simuler (§6) | Le téléphone, via [RECETTES.md](../../../RECETTES.md) | **la plus courte liste possible** |

Le but du plan n'est pas « monter le pourcentage ». C'est de **faire descendre du niveau 4 vers les
niveaux 2 et 3** tout ce qui peut l'être, pour que la recette sur téléphone ne porte plus que sur
ce qui l'exige vraiment. Aujourd'hui la recette absorbe des vérifications (une ligne bien écrite,
un doublon évité, une date refusée) qui coûtent une manipulation à Damien ou Florian alors
qu'elles coûteraient 3 secondes de CI.

## 3. Le socle technique — en place

### 3.1 Harness SQLite en mémoire — [`src/test-utils/sqlite-harness.ts`](../../../apps/mobile/src/test-utils/sqlite-harness.ts)

Exécute les requêtes des repositories **pour de bon**, sur une base SQLite créée **à partir du
schéma PowerSync de l'app** (`@/powersync/schema`). Moteur : `node:sqlite`, intégré à Node —
aucune dépendance ajoutée.

Ce que ça attrape et que le mock laissait passer :

- une **colonne absente du schéma local** → l'insertion échoue, le test rougit (le bug du 31/07) ;
- un `WHERE deleted_at IS NULL` **oublié** ;
- une **idempotence** annoncée mais fausse (deux appels → deux lignes) ;
- un `ORDER BY` inversé, une jointure fausse, un `LIMIT` mal placé ;
- l'**atomicité réelle** d'une écriture multi-tables (`BEGIN`/`COMMIT`/`ROLLBACK` sont exécutés).

Usage :

```ts
import { testPowerSync, resetTestDb, seed, rowsOf } from '@/test-utils/sqlite-harness';

// Remplace le mock global de jest.setup.ts. Sans ce bloc, le harness n'est pas branché.
jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

beforeEach(() => resetTestDb());
```

`seed(table, rows)` complète les champs de synchro (`id`, `created_at`, `updated_at`,
`deleted_at`) ; `rowsOf(table)` relit la table pour assertion, `rowsOf(table, true)` inclut les
lignes en soft delete.

**Référence d'usage** :
[`menstrual-cycle-sql.test.ts`](../../../apps/mobile/src/data/repositories/__tests__/menstrual-cycle-sql.test.ts)
— 15 tests sur les écritures d'US CYCLE-01 (garde d'activation, idempotence, clôture automatique,
saisie vide, soft delete global). À copier pour tout nouveau test de repository.

### 3.3 Tester une requête de **lecture** — constantes SQL exportées

Les lectures passent par des hooks `useQuery`, **non exécutables hors React**. La technique
retenue (décidée le 03/08/2026) : **exporter la constante SQL** et l'exécuter directement contre
le harness. C'est le seul choix qui teste le SQL réellement embarqué plutôt qu'une copie.

Ces constantes portent un commentaire `Requêtes — exportées pour être testables` : elles ne sont
consommées que par les hooks de leur propre fichier, l'`export` n'existe que pour les tests. Ne
pas les importer depuis du code applicatif.

Référence :
[`weekly-review-sql.test.ts`](../../../apps/mobile/src/data/repositories/__tests__/weekly-review-sql.test.ts).
Ce que ces tests attrapent et qu'un device de recette ne peut pas produire : plusieurs
**propriétaires**, plusieurs **piliers** et plusieurs **langues** en base — un téléphone n'a
qu'un compte, un programme actif et une langue.

### 3.2 Corrections apportées en même temps

- **`expo-crypto` mocké** dans `jest.setup.ts`. Sans lui, `generateId()` renvoyait `undefined` en
  test : toute ligne insérée recevait un `id` nul et les `WHERE id = ?` suivants ne matchaient
  rien. Panne muette qui rendait **intestable tout parcours écriture → relecture**.
- **Node passé de 20 à 24** ([.nvmrc](../../../.nvmrc), `engines`). `node:sqlite` n'existe pas en
  Node 20 et exige un drapeau en 22 ; en 24 il est disponible tel quel.
  ⚠️ **Action pour les devs** : `nvm use 24` (ou `nvm install 24`) avant de relancer les tests.
- `npm run test:coverage` ajouté à la racine et sur `apps/mobile`.

## 4. Conventions

- **Emplacement** : `__tests__/` à côté du code testé. Nom : `<sujet>.test.ts(x)`.
  Suffixe `-sql` pour les tests de niveau 2 (`menstrual-cycle-sql.test.ts`).
- **Une règle métier se teste une seule fois, dans `packages/shared`.** Le test de repository ne
  rejoue pas la règle : il vérifie la **plomberie** (bonnes colonnes, bon `id`, bonne ligne).
- **Chaque test cite sa règle de spec** (`R2`, `R16`…) dans son libellé ou son en-tête. C'est ce
  qui permet, plus tard, de rayer une ligne de RECETTES.md en sachant laquelle.
- **Tout bug corrigé = un test de non-régression** posé avec le fix, au niveau le plus bas
  possible (règle déjà en vigueur, [bonnes-pratiques §4](./bonnes-pratiques.md)).
- **Pas de `--silent | tail`** pour juger d'une suite : le pipe renvoie 0 même en échec. Lire le
  code de sortie (rappel déjà présent dans [CLAUDE.md](../../../CLAUDE.md)).
- **Pas d'horloge figée** : `src/hooks/__tests__/no-frozen-clock.test.ts` garde déjà cette règle.

## 5. Plan par lots

Priorisé par **risque × coût de la recette manuelle**, pas par taille.

| Lot | Périmètre | Pourquoi d'abord | Effort |
|---|---|---|---|
| **0 — fait** | Harness SQLite, mock `expo-crypto`, Node 24, preuve CYCLE-01 (15 tests) | Sans le socle, rien d'autre n'est possible | ✅ |
| **1 — fait** | Repositories d'**écriture** des US en recette : `menstrual-cycle` (15), `workout` (44), `run` (22), `planned-session` (16), `records` (17), `goal` + `streak-joker` (21), `body-measurement` (11, réécrit sur SQL) | Ce sont les 31 US bloquées : chaque test posé ici **retire une ligne de RECETTES.md** | ✅ 146 tests |
| **2 — fait** | Repositories de **lecture** à SQL complexe : `weekly-review` (25), `dashboard` (20), `program` (24), `journal` + `nutrition` (34) | Requêtes d'agrégation — les plus faciles à casser sans s'en apercevoir | ✅ 103 tests |
| **3** | `src/stores` + `src/lib` : `auth-store`, `notifications` (planification), `health-connect` (mapping des records, **pas** l'accès natif), `data-export`, `gpx-export` | Logique séquentielle isolable, aucun device requis | ~8 fichiers |
| **4** | **`apps/admin`** : installer Vitest + jsdom + Testing Library, puis couvrir `src/lib` et `src/data` (import CSV / papaparse en tête) | 9 716 lignes, **zéro filet**, et c'est l'outil qui écrit dans la base de contenu | setup + ~6 fichiers |
| **5** | Écrans mobiles à état : séance en cours, saisie nutrition, résumé de course, onboarding | Niveau 3 — viser les écrans **à état**, pas le pourcentage | continu |
| **6** | Garde-fous CI : seuils de couverture par dossier | Une fois les lots 1–4 passés, pour que ça ne redescende pas | petit |

**Seuils proposés pour le lot 6** (`coverageThreshold` par chemin, pas un seuil global qui ne veut
rien dire) : `packages/shared` 95 % · `apps/mobile/src/data/repositories` 80 % ·
`apps/mobile/src/lib` + `src/stores` 70 % · reste non contraint.

## 6. Ce qui reste au téléphone — et pourquoi

À garder en recette humaine, définitivement : **aucun de ces points n'est simulable**, et prétendre
le contraire donnerait un vert mensonger.

- **Permissions Android** réelles (localisation en arrière-plan, notifications, Health Connect).
- **GPS en conditions réelles** : dérive, perte de signal, tunnel, écran éteint, veille système.
- **Notifications** effectivement délivrées par le système, et leur comportement au réveil.
- **Health Connect** : lecture/écriture contre l'app Google réelle.
- **Synchro PowerSync bout en bout** : mode avion, retour du réseau, deux appareils en conflit.
- **Rendu réel** : typographies, contrastes, tailles, TalkBack (US CONF-07), thème sombre.
- **Batterie / performance** sur une course longue.

Tout le reste — règles métier, contenu écrit en base, idempotence, formats, états d'écran,
i18n FR/EN — **doit** descendre aux niveaux 1 à 3. Le téléphone reste à disposition ; l'objectif
est justement d'avoir moins souvent besoin de l'utiliser.

## 7. Vérification

```bash
npm run typecheck          # 3 workspaces
npm run test               # shared (vitest) + mobile (jest) — lire le code de sortie, sans pipe
npm run test:coverage      # rapport par fichier
```

État au 03/08/2026, **lots 0, 1 et 2 terminés** : **1 405 (shared) + 517 (mobile) = 1 922 tests,
tous verts**, typecheck et lint propres. Couverture mobile **15,0 % → 21,4 %** d'instructions, et
surtout `src/data/repositories` **9 % → 31 %** — c'est là que portait l'effort.

**Le plus gros trou restant est `apps/admin`** (lot 4) : 9 716 lignes, **aucun runner de test
installé**, et c'est l'outil qui écrit dans la base de contenu partagée par tous les
utilisateurs.
