# Stratégie de tests

> Cadrage établi le **03/08/2026**. Complète [bonnes-pratiques.md §4](./bonnes-pratiques.md), qui
> pose la pyramide ; ce document dit **où on en est réellement**, **ce qui manque**, et **dans quel
> ordre le combler**. Les chiffres sont mesurés, pas estimés (`npm run test:coverage`).

## 1. Constat

| Workspace | Suites | Tests | Couverture (instructions) | Verdict |
|---|---:|---:|---:|---|
| `packages/shared` | 67 | 1 405 | **99,2 %** (branches 95,1 %) | ✅ conforme à l'objectif « 100 % sur le pur » |

> **Mise à jour du 04/08/2026** — `packages/shared` est à **100 %** d'instructions, de fonctions et
> de lignes (**1 615 tests**), branches à **97,35 %**. Voir §5 bis pour l'arbitrage du seuil de
> branches et §8 pour ce qui reste.
| `apps/mobile` | 51 | 291 | **15,0 %** (branches 12,8 %) | ⚠️ le gros du risque est ici |
| `apps/admin` | 0 | 0 | — (**aucun runner installé**) | ❌ 9 716 lignes non testées |

> **Mise à jour du 03/08/2026** — `apps/admin` a désormais un runner (Vitest) et **157 tests** :
> **61,3 %** d'instructions et **87,4 % de branches** sur `src/data` + `src/lib`, dont **100 % sur
> `src/lib`**. Voir §3.4.

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

### 3.4 Côté back-office — double de test Supabase

`apps/admin` ne parle **pas** à une base locale : il passe par le réseau (supabase-js + RLS). Il
n'y a donc pas d'équivalent au harness SQLite. Ce qu'on teste sans réseau, c'est **la requête
émise** et **ce qu'on fait de la réponse** — et c'est précisément là que vivent les défauts qui
coûtent cher ici : l'admin écrit dans le contenu **partagé par tous les utilisateurs**, un filtre
oublié ne casse pas un compte, il en casse des milliers.

[`src/test-utils/supabase-mock.ts`](../../../apps/admin/src/test-utils/supabase-mock.ts) fournit un
client simulé qui enregistre, pour chaque requête : la **table**, l'**opération**, **tous les
filtres dans l'ordre** (`eq`, `is`, `in`, `not`…), les **lignes** écrites et les **options**
(`onConflict`). Le builder est *thenable*, donc insensible à la longueur de la chaîne.

```ts
const mock = createSupabaseMock();
vi.mock('../lib/supabase', () => ({ supabase: mock.client }));
// `await import()` APRÈS le mock : le module testé capture `supabase` à son chargement.
const { archiveFood } = await import('./foods');

mock.setResponse('foods.update', { error: new Error('rls') }); // réponse programmée
expect(mock.hasFilter(mock.lastQuery('foods', 'update'), 'is', 'owner_id', null)).toBe(true);
```

⚠️ **Les identifiants de test doivent être des UUID valides.** `auditEntrySchema` valide `targetId`
en `z.string().uuid()` et `logAudit` est best-effort : un id fantaisiste ne fait pas échouer le
test, il fait **disparaître l'entrée d'audit** — l'assertion passe alors au vert pour la mauvaise
raison. Constaté en écrivant `foods.test.ts`.

Environnement `node` : on teste la couche data et les briques pures. Les **écrans** demanderont
`jsdom` + Testing Library — à ajouter le jour où on les couvre, pas avant.

### 3.5 Imports dynamiques — le piège du faux vert

`health-connect.ts` charge son module natif par `await import('react-native-health-connect')`,
jamais au niveau du fichier : c'est ce qui permet à l'app de démarrer sans Health Connect installé.

**Jest ne sait pas exécuter un `import()` non transpilé** (« A dynamic import callback was invoked
without `--experimental-vm-modules` »). Or ce module entoure ses appels natifs de `try/catch` : la
fonction ne plantait pas, elle **partait dans son chemin d'erreur** et renvoyait la valeur de repli.
Un test écrit sans le savoir passe alors au vert en ayant vérifié le cas dégradé — le pire type de
faux positif, puisqu'il ressemble à une couverture.

Corrigé dans [`babel.config.js`](../../../apps/mobile/babel.config.js) : le plugin
`dynamic-import-node` convertit ces imports en `require`, **uniquement quand `NODE_ENV=test`**. Le
bundle Metro n'est pas concerné, le chargement paresseux reste intact en production.

⚠️ Après un changement de configuration Babel, **vider le cache** (`npx jest --clearCache`) : une
transformation périmée produit des échecs qui n'ont rien à voir avec le code.

### 3.6 Tester un effet — **`await` le rendu, tout simplement**

`render()` et `renderHook()` de RNTL 14 renvoient des **promesses**. C'est l'`await` qui exécute
les effets de montage :

```ts
const { getByText } = await render(<MonEcran />);   // effets exécutés
const { result }    = await renderHook(() => useMonHook());
```

**Sans `await`, le composant est monté mais aucun `useEffect` n'a tourné** — et le test passe. Un
composant dont le seul rôle est d'appeler un espion dans un `useEffect(() => …, [])` laisse
l'espion à zéro appel. C'est la même famille de faux positif que §3.5 : le test ne protège rien
tout en occupant la place d'un vrai test.

Un `act` explicite ne reste nécessaire que pour les déclencheurs **hors React** — appeler à la
main un gestionnaire d'`AppState` ou de deep link :

```ts
await act(async () => { handler({ url: 'wellness://…' }); });
```

`waitFor` ne convient pas pour ça (essayé : l'assertion échoue).

Références :
[`useAuthDeepLink.test.tsx`](../../../apps/mobile/src/hooks/__tests__/useAuthDeepLink.test.tsx) ·
[`app-state-hooks.test.tsx`](../../../apps/mobile/src/hooks/__tests__/app-state-hooks.test.tsx).

> **Bruit résiduel connu** : quelques avertissements « overlapping act() calls » apparaissent quand
> un `act` explicite coexiste avec celui de RNTL. Sans effet sur les assertions — ne pas chercher à
> les faire taire en retirant les `act` autour des déclencheurs hors React.

> 🕳️ **Deux fausses pistes écartées, à ne pas rouvrir.**
> 1. `globalThis.IS_REACT_ACT_ENVIRONMENT = true` dans `jest.setup.ts` : sans effet, RNTL le pose
>    déjà elle-même. Ne pas le rajouter.
> 2. **Un helper « rendre dans un `act` »** a été écrit puis supprimé le 06/08/2026 : il
>    contournait un problème qui n'existait pas. Le diagnostic initial (« RNTL enveloppe le montage
>    dans un `act` asynchrone qu'il faut laisser passer ») était faux — il venait d'un `await`
>    oublié dans la sonde. **Les `*-smoke.test.tsx` existants font tous `await render(...)` : leurs
>    effets s'exécutent bel et bien.**

### 3.7 Tester un écran — **monter le vrai écran, pas une coquille**

Trois `*-smoke.test.tsx` du dépôt ne montaient pas l'écran : ils **réécrivaient** sa logique dans un
composant `…Shell` local, puis testaient cette réécriture — l'un d'eux l'assumait même
explicitement (« on compose un composant de test minimal »).

**Ces tests valident la copie, jamais le code qui tourne sur le téléphone.** Ils ne détectent aucune
régression de l'écran réel : on peut supprimer l'écran entier, ils restent verts. C'est une
quatrième famille de faux vert, après le `powerSync` mocké (§3.3), l'import dynamique non transpilé
(§3.5) et le rendu non attendu (§3.6).

> ✅ **Les trois sont remplacés depuis le 08/08/2026** par des montages du vrai écran :
> [`history-screen`](../../../apps/mobile/src/app/history/__tests__/history-screen.test.tsx) (15),
> [`programs-screen`](../../../apps/mobile/src/app/programs/__tests__/programs-screen.test.tsx) (15),
> [`run-summary-screen`](../../../apps/mobile/src/app/run/__tests__/run-summary-screen.test.tsx) (18).
> **La conversion a immédiatement trouvé un défaut** — le verrou de duplication de programme, voir
> §3.2. Douze `*-smoke.test.tsx` subsistent : ils montent bien leur composant, ils sont légitimes.

Le patron correct est celui de
[`run-active.test.tsx`](../../../apps/mobile/src/app/run/__tests__/run-active.test.tsx) : importer
le composant **exporté par la route**, et ne mocker que ce qui ne peut pas tourner hors device —
modules natifs (tracker, GPS, voix, carte), navigation, i18n, thème, et les hooks de données. Les
fonctions pures de `@wellness/shared` tournent pour de vrai : elles sont testées chez elles, les
mocker ne ferait que masquer un mauvais branchement.

Ce que ça a rapporté dès le premier écran : **la garde de double appui de `run/active.tsx` ne
gardait rien** (voir la correction du 07/08/2026, §3.2).

> ⚠️ **Un `Button` en état `loading` n'affiche plus son texte** : il ne rend qu'un
> `ActivityIndicator` et ne porte plus son libellé que comme `accessibilityLabel`. Le chercher avec
> `getByText` échoue. Utiliser `getByLabelText` — c'est aussi ce que lit TalkBack (US CONF-07).
>
> ⚠️ **Ne jamais appeler `unmount()` au milieu d'un test.** Démonter puis re-rendre laisse `screen`
> pointer sur un arbre mort, et fait tomber les tests **suivants** du fichier — pas celui qui
> contient l'appel, qui passe très bien isolément. Rencontré **trois fois** (09 et 11/08/2026) :
> sept tests cassés, puis treize, puis huit — la troisième **le jour même où cette règle a été
> écrite**. C'est le genre d'erreur qu'on refait en la connaissant, précisément parce que le test
> fautif passe isolément.
>
> **Un scénario par `it`**, et on laisse RNTL nettoyer. Pour balayer plusieurs variantes, `it.each`
> sur le produit des cas, jamais une boucle interne. Pour **comparer deux rendus**, un helper qui
> rend et sérialise sans démonter — voir `serialiser()` dans
> [`primitives.test.tsx`](../../../apps/mobile/src/components/widgets/__tests__/primitives.test.tsx).
>
> ⚠️ **Un `fireEvent.press` hors `act` ne rafraîchit pas l'écran.** Envelopper chaque appui dans
> `await act(async () => …)` — sinon la requête suivante voit encore l'état d'avant. Et deux appuis
> **dans le même `act`** ne sont pas la même chose que deux appuis dans deux `act` successifs : le
> premier cas teste la garde applicative, le second teste le `disabled` du bouton. Les deux
> comptent, ils ne se remplacent pas.

### 3.2 Corrections apportées en même temps

- **`expo-crypto` mocké** dans `jest.setup.ts`. Sans lui, `generateId()` renvoyait `undefined` en
  test : toute ligne insérée recevait un `id` nul et les `WHERE id = ?` suivants ne matchaient
  rien. Panne muette qui rendait **intestable tout parcours écriture → relecture**.
- **Node passé de 20 à 24** ([.nvmrc](../../../.nvmrc), `engines`). `node:sqlite` n'existe pas en
  Node 20 et exige un drapeau en 22 ; en 24 il est disponible tel quel.
  ⚠️ **Action pour les devs** : `nvm use 24` (ou `nvm install 24`) avant de relancer les tests.
- `npm run test:coverage` ajouté à la racine et sur `apps/mobile`.
- **🔴 `run/active.tsx` — la garde de double appui ne gardait rien** (07/08/2026, trouvée en
  écrivant le premier test d'écran réel). `onStop` testait `if (stopping) return`, où `stopping` est
  un **état React** : deux appuis rapides tombent dans le même cycle de rendu, donc dans la même
  fermeture où `stopping` vaut encore `false`, et le bouton n'a pas encore eu le temps de se
  désactiver. La séquence d'arrêt partait deux fois — double `stopTracking`, double `finishRun`,
  double navigation. Remplacé par une **ref**, écrite et relue sans attendre un rendu.
  **Le même défaut existait sur `workout.tsx`** (`doFinish`, sans aucune garde : double clôture,
  double évaluation des records, donc possible double notification de record) — corrigé de la même
  façon. ✅ **Les deux correctifs sont couverts** depuis
  [`workout-screen.test.tsx`](../../../apps/mobile/src/app/__tests__/workout-screen.test.tsx)
  (même jour). Les deux tests ont été **vérifiés en retirant la garde** : ils passent de vert à
  rouge. Un test de non-régression qu'on n'a jamais vu échouer n'est pas encore un test.
- **🔴 `programs/index.tsx` — même défaut, troisième occurrence** (08/08/2026, trouvée en
  convertissant `programs-smoke` en montage réel). `onDuplicate` testait `if (duplicating) return`
  sur un **état React** : deux appuis rapides créaient **deux copies** du programme, dont une
  orpheline que l'utilisateur ne verra jamais, et naviguaient deux fois. Remplacé par une ref.
  **Trois écrans sur trois portaient ce défaut.**
- **🔴 Audit systématique du patron, et extraction d'un hook** (08/08/2026). Une recherche de
  `if (<état>) return` dans les gestionnaires asynchrones a remonté **neuf occurrences de plus** :
  détail de programme (démarrer une séance, dupliquer, supprimer), détail de modèle de séance
  (idem), détail et liste de programmes de course (dupliquer, créer), et `runWrite` de
  `ProgramEditScreen` côté back-office — où deux gestes enchaînés auraient produit **deux séances
  au même `order_index`** ou deux réordonnancements concurrents.
  Toutes corrigées, et le patron est désormais porté par un hook unique,
  [`useActionLock`](../../../apps/mobile/src/hooks/useActionLock.ts) (8 tests) : c'est là que
  l'explication vit, une fois, au lieu d'être recopiée douze fois.
  **La leçon générale** : dès qu'un défaut se répète sur trois sites, le chercher partout coûte
  une commande `grep` et rapporte davantage que le troisième correctif.
- **🔴 Un dixième site, raté par le `grep`** (11/08/2026) : « Ajouter un bloc » de
  `RunningSessionEditor` gardait sur `addingBlock` — un nom **métier**, absent de la liste
  `busy|saving|loading|…` de l'audit. Deux appuis créaient deux blocs au même `order_index`.
  **Corollaire de la leçon précédente** : un `grep` sur les noms usuels rate ceux qui portent un
  nom propre au domaine. Écrire le test reste le seul filet qui ne dépende pas du vocabulaire.

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
| **3 — fait** | `src/stores` + `src/lib` : `notifications` (21), `health-connect` état + throttles (31), `auth-store` (25), `data-export` (15), `gpx-export` (10). `analytics` était déjà couvert | Logique séquentielle isolable, aucun device requis | ✅ 102 tests · `lib` **54 %**, `stores` **48 %** |
| **4 — fait** | **`apps/admin`** : Vitest, double de test Supabase, `foods` (29), `programs` (37), `users` + `roles` + `audit` (36), `exercises` + `usage-counts` (19), `archive-confirm` (7) , puis 07/08 : détail et écriture d'exercice (27), détail et contenu de programme (41), lectures d'aliments et de comptes + modération (29) | 9 716 lignes, **zéro filet** jusqu'ici, et c'est l'outil qui écrit dans la base de contenu | ✅ 278 tests · **97,7 %** — la couche data du back-office est couverte |
| **5 — en cours** | Hooks et écrans à état. Fait : `useAuthDeepLink` (10), `useAppOpenedAnalytics` + `useTodayKey` + `useHealthConnectImports` (17), effets de montage de `cycle` et `help` (4), `buildSummary` du résumé de séance (11), `workout-template` (20), `settings` (23), `food` (26), `profile` + `recipe` (24), `running-record` (19), `bodyweight` + `meal-template` + `running-profile` (20), planificateurs de notifications (24), candidats de substitution d'exercice (12), **machine à états du focus de séance** (42) et
et **trois écrans réellement montés** : course en cours (20), séance (20), historique de
course (30). Les trois cibles à état du lot sont faites. ⚠️ La « reprise des `*-smoke.test.tsx` » annoncée le 03/08 **n'a pas lieu d'être** : ils font tous `await render(...)`, leurs effets s'exécutent (§3.6) | Niveau 3 — viser les écrans **à état**, pas le pourcentage | 🟡 322 tests |
| **6 — fait** | Seuils de couverture appliqués **en CI** (voir §5 bis) | Une fois les lots 1–4 passés, pour que ça ne redescende pas | ✅ |

### 5 bis. Les seuils — des cliquets, pas des objectifs

Posés le **03/08/2026**, et **appliqués par la CI** : l'étape « Tests » du
[workflow](../../../.github/workflows/ci.yml) lance `npm run test:coverage` et non `npm run test`.
Sans ce `--coverage`, un seuil déclaré est du texte mort — c'est exactement ce qui s'était produit
(voir l'avertissement plus bas).

| Périmètre | Instructions | Branches | Fonctions |
|---|---:|---:|---:|
| `packages/shared` | **100** | **98** | **100** |
| `apps/mobile/src/data/repositories/` | **44** | **33** | **39** |
| `apps/mobile/src/lib/` | **52** | **51** | 64 |
| `apps/mobile/src/stores/` | **47** | **36** | **46** |
| `apps/mobile` — reste (écrans, composants) | **37** | **35** | **31** |
| `apps/admin` (`src/data` + `src/lib`) | **97** | **89** | **98** |
| `apps/admin` — écrans React | **57** | **78** | **56** |

> **Les cliquets mobiles ont été resserrés le 07/08/2026** (repositories 28→44, `lib` 50→52,
> `stores` 45→47, reste 12→18) : les lots suivants avaient fait monter le réel bien au-dessus du cliquet, qui
> ne protégeait donc plus rien. Un cliquet qu'on ne remonte pas cesse d'être un cliquet — il faut
> le recaler sous le réel **à chaque lot**, sinon on peut supprimer 15 points de couverture sans
> que la CI bronche.

Trois principes derrière ces chiffres :

- **Par chemin, jamais un seuil global unique.** La moyenne d'un dossier d'écrans à 6 % et d'une
  couche data à 31 % ne veut rien dire, et un seuil global se satisfait de n'importe quel équilibre
  entre les deux : on pourrait laisser pourrir le SQL en couvrant des composants.
- **Calés sous le réel du jour.** Leur rôle est d'interdire la régression, pas de fixer une cible.
  Une PR qui les fait rougir a **retiré** de la couverture ; la réponse est d'en ajouter, **pas de
  baisser le seuil**.
- **Le seuil du reste est volontairement bas.** Le monter bloquerait l'ajout de tout nouvel écran,
  ce qui pousserait à contourner le garde-fou — un seuil qu'on désactive ne protège rien.

> ✅ **`packages/shared` atteint les 100 % exigés** par [bonnes-pratiques §4](./bonnes-pratiques.md)
> **sur les instructions, les fonctions et les lignes**, depuis le **04/08/2026** (99,35 % → 100 %).
> Ces trois axes sont désormais **verrouillés à 100 %** dans le cliquet, et ne doivent plus
> redescendre. 1 503 → 1 615 tests.
>
> ⚠️ **Les branches sont arbitrées à 97 %** (réel : 97,35 %, contre 95,12 % avant), et c'est une
> **décision** — celle que le BACKLOG demandait de prendre, pas un renoncement. Les ~2,5 % restants
> ont été audités un par un : ils ne relèvent pas d'un manque de tests mais de **code défensif
> inatteignable**, de deux familles seulement :
>
> 1. **cas d'égalité de comparateurs de tri appliqués à des clés de `Map`** — uniques par
>    construction, donc l'égalité ne peut jamais survenir (`learned-hour.ts`, `steps.ts`) ;
> 2. **replis `?? 0` sur des `Map.get`** dont la clé vient d'être écrite quelques lignes plus haut
>    (`training-nutrition.ts`, `weekly-review.ts`, `workout.ts`).
>
> Les couvrir demanderait soit des tests figeant des comportements absurdes, soit de **retirer ces
> filets** : on échangerait une métrique contre une protection réelle contre les évolutions futures.
> **Là où supprimer du code mort corrigeait un vrai défaut, ça a été fait** — voir le lot du
> 04/08/2026 : `bestSegmentTimeFromSamples` renvoyait `NaN` pour une distance cible ≤ 0 (soit un
> record de « NaN seconde » écrivable en base), et le `return null` final de `bucketOf`
> (`training-nutrition.ts`) était prouvé inatteignable.
>
> 🔁 **Réaudité le 09/08/2026 : 97 → 98 %.** L'arbitrage de 97 était juste **au jour de l'audit**,
> et c'est sa limite : `dev` a livré depuis ALLURE-01, FUEL-01 et RUN-19, dont une partie apportait
> des branches **réellement atteignables** restées nues. `running.ts` est passé de **91,4 % à
> 98,6 %** — traces GPS abîmées (points au même horodatage, sauts de position impossibles) et
> surtout le **décodage d'une trace tronquée**, qui doit rendre ce qu'il sait lire au lieu de lever
> au milieu de l'écran de résumé. **Un seuil arbitré « au-dessus, c'est du code mort » se périme :
> le code qui arrive ensuite s'y engouffre. Réauditer à chaque palier.**
>
> **La leçon de ce lot** : viser 100 % de branches sur du code écrit défensivement fait apparaître
> une frontière utile. D'un côté les trous qui cachent un vrai défaut ou un cas métier oublié — et
> il y en avait : les suggestions de **glucides** n'étaient exercées nulle part, ni les fractionnés
> définis **en durée**, ni le throttle d'import du cycle. De l'autre, des gardes qu'aucun appel
> sensé n'atteint. Le premier groupe justifie l'effort ; le second justifie un seuil < 100.
>
> Au passage, `src/database.types.ts` (2 589 lignes **générées** par `npm run db:types`) est sorti
> de la mesure : la compter n'apprenait rien et faussait le total.

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

### 6 bis. Le lint doit rester à **zéro avertissement**

Ramené de **97 à 0** le 09/08/2026. Le principe est le même que pour les cliquets de couverture :
un garde-fou qu'on apprend à ignorer ne protège plus rien. Aucun de ces 97 n'était une erreur, la
CI restait donc verte — et c'est précisément ce qui rendait la sortie inutile.

Deux familles, deux traitements :

- **Ce que la règle décrit mal** → exception de configuration, **motivée dans le fichier de
  config**. `import/first` et `no-require-imports` sont désactivées sur les fichiers de test :
  `jest.mock()` est hissé au-dessus des imports, donc l'ordre que la première réclame casse le
  test, et la seconde interdit la seule forme que Jest accepte dans une fabrique. 70 avertissements
  qui ne décrivaient rien de vrai.
- **Ce que la règle décrit bien** → on corrige. Les 27 restants étaient des imports morts, une
  variable morte, trois `Array<T>` hors convention et un double import.

> ⚠️ **Ne jamais résoudre un avertissement par un `eslint-disable` ponctuel** quand il y en a plus
> de deux ou trois du même type : c'est le signe que la règle est mal ciblée, pas que le code est
> fautif. Un commentaire de désactivation finit toujours par masquer autre chose que ce qu'il
> visait.

## 7. Vérification

```bash
npm run typecheck          # 3 workspaces
npm run test               # shared + mobile + admin — lire le code de sortie, SANS pipe
npm run test:coverage      # idem + application des seuils (§5 bis) — ce que lance la CI
```

État au 14/08/2026, **lots 0 à 4 et 6 terminés**, lot 5 en cours : **2 194
(shared) + 2 239 (mobile) + 583 (admin) = 5 016 tests, tous verts**, typecheck, lint et **seuils de
couverture** propres. **Le lot 5 côté back-office est terminé** : les sept écrans qui restaient
(`ProgramsScreen`, `ExerciseEditScreen`, `FoodEditScreen`, `ProgramCreateScreen`, `LoginScreen`,
`AccessDenied`, le layout) ont été couverts en parallèle sur `feature/horaire01-heure-seance`.

| | Départ | Maintenant |
|---|---:|---:|
| Couverture mobile | 15,0 % | **57,1 %** |
| `apps/mobile/src/data/repositories` | 9 % | **45,4 %** |
| `apps/mobile/src/lib` · `src/stores` | 28 % · 16 % | **53,5 % · 48,1 %** |
| `apps/admin` | aucun runner | **583 tests** · data **97,7 %** · **les 15 écrans React couverts** |

## 8. Reprise — par où continuer

> Point de reprise au **07/08/2026**. Branche `chore/socle-tests-unitaires`, intégrée sur `dev`.
> Rien en cours, rien de non commité : on peut reprendre n'importe où.
>
> **Les repositories sont finis** — au sens où tout ce qui reste dans `src/data/repositories` est
> exclusivement composé de hooks `useQuery`, sans constante SQL ni fonction pure à extraire. Les
> extraire une par une (§3.3) reste possible, mais le rendement décroît : les requêtes restantes
> sont des `SELECT … WHERE deleted_at IS NULL` simples, où le mock ne mentirait pas beaucoup.
> **Le prochain gisement réel, ce sont les écrans à état** (point 1 ci-dessous).

### ⚠️ À faire avant de lancer quoi que ce soit

**`nvm use 24`.** `.nvmrc` est passé de 20 à 24 (`node:sqlite` n'existe pas en Node 20). Sur une
version antérieure, la suite mobile échoue à l'import du harness — l'erreur ne dit pas pourquoi.

### L'ordre conseillé

1. **Lot 5 — écrans à état.** L'idiome est établi (§3.6) : `await render(...)` suffit, `act`
   explicite uniquement pour un déclencheur hors React. Copier
   [`useAuthDeepLink.test.tsx`](../../../apps/mobile/src/hooks/__tests__/useAuthDeepLink.test.tsx).
   **`run/active.tsx` est fait** (20 tests, écran réellement monté — patron §3.7), et sa
   **machine à états du focus** de `workout.tsx` aussi (42 tests, fonctions pures exportées).
   **`workout.tsx`** (20 tests : clôture, repos, bascule superset, les trois `Alert` de sortie) et
   **`running-history/index.tsx`** (26 tests : garde de chargement, six sections, six états vides)
   sont montés aussi. Les composants lourds y sont remplacés par des sondes minimales — patron à
   copier pour tout écran à `Alert` ou à sections.

   **Les trois écrans à état identifiés sont faits.** La suite côté mobile, c'est le reste de
   `src/app` (écrans de saisie et de réglages) et `src/components` — plus nombreux mais moins
   risqués, à prendre par ordre de risque et non de taille. Côté admin, il faudra en plus `jsdom`
   + Testing Library.

   ⚠️ **Un avertissement répété trois fois dans le code est un test qui manque.** `_layout.tsx`
   portait trois fois la même phrase, écrite après trois défauts distincts (PAS-01, INSIGHTS-01,
   REPAS-01) : « une route non déclarée ici n'échoue ni au typecheck ni aux tests — seul l'œil voit
   l'en-tête manquant ». Le 14/08/2026, ce constat est devenu
   [`route-declarations.test.ts`](../../../apps/mobile/src/app/__tests__/route-declarations.test.ts),
   qui **compare le contenu de `src/app` à la liste des `<Stack.Screen>`** — et a immédiatement
   trouvé une quatrième occurrence : **`cycle`**, deux écrans livrés et recettés dont le titre se
   dessinait sous la barre d'état.

   Deux choses à retenir. D'abord, **ce test lit le fichier, il ne le rend pas** : monter le Stack
   demanderait PowerSync, l'auth, les polices et vingt hooks pour vérifier une liste de chaînes, et
   un mock mal posé le rendrait vert à tort. La lecture statique est ici *plus* fiable que le rendu.
   Ensuite, quand un commentaire dit « ça ne se teste pas », il décrit presque toujours ce qui ne se
   teste pas *par le chemin habituel* — pas ce qui échappe à toute vérification.

   ⚠️ **RNTL 14 a supprimé `createNodeMock`** — et avec lui le seul levier pour donner une géométrie
   aux composants hôtes sous Jest. Conséquence pour tout code qui appelle `ref.measureInWindow`
   (glisser-déposer, mesures de zones) : la `ref` vaut `null`, les zones sortent à **hauteur 0**, et
   **tous** les tests de dépôt passent au vert sans rien exécuter — y compris ceux censés vérifier
   qu'on n'écrit *pas*. C'est la sixième famille de faux vert, et la plus traître : elle rend verts
   les tests de non-action. Le remplacement, posé dans
   [`planning-screen.test.tsx`](../../../apps/mobile/src/app/planning/__tests__/planning-screen.test.tsx),
   est un `jest.mock('react-native')` par **Proxy** qui ne substitue que `View` par une version
   `forwardRef` exposant `measureInWindow` via `useImperativeHandle`. Le Proxy évite d'étaler les
   exports paresseux de React Native, qui déclencheraient tous les `require` natifs.

   **La contre-épreuve était obligatoire ici** : la garde R3 (`target === item.scheduledDate`) a été
   retirée à la main, et le test est bien passé au rouge. Sans cette vérification, quatre tests de
   glisser-déposer auraient été verts pour la mauvaise raison — c'est ce qui s'est produit à la
   première exécution.

   **Plus aucun composant de `src/components` n'est à 0 %** (11/08/2026). Les cinq derniers
   — `NutritionSummaryCard`, `RealLifeCard`, `ActivationPathCard`, `CycleTrackingSection`,
   `RouteMap` — ont livré **deux rejets de promesse non capturés** : `void p.finally(…)` **relaie**
   le rejet, il ne le capture pas. À retenir pour tout `void`-appel : `.catch` **avant** `.finally`,
   sans quoi le premier échec réseau produit une rejection non capturée que RN remonte en
   avertissement global. Le test ne l'a pas déduit — il est **tombé dessus**, la promesse rejetée
   faisant échouer le test entier.

   `RouteMap` portait en en-tête « aucun test unitaire (module natif) ». C'était vrai du **rendu**,
   jamais de ce que le fichier décide : état affiché, GeoJSON produit, cadrage de la caméra. Le
   module natif passe en **sonde** (props sérialisées dans `accessibilityValue`), et le fichier est
   couvert. **Un « module natif » n'est presque jamais une raison de ne pas tester** — c'est une
   raison de ne pas tester *son rendu*.

   **Les verrous de double appui corrigés le 08/08/2026 sont TOUS couverts** — pour de bon.
   ⚠️ La note écrite plus tôt le 11/08 (« les neuf sont couverts », après `programs/[id]` et
   `templates/[id]`) était **fausse** : elle comptait les fichiers `programs/` et oubliait
   `running-programs/index.tsx` et `[id].tsx`, tous deux à 0 %, qui en portent quatre. Le compte
   réel est de **treize `useActionLock` sur huit fichiers** — vérifiable en une commande :

   ```bash
   grep -rn "= useActionLock()" apps/mobile/src --include=*.tsx
   ```

   La leçon vaut plus que le chiffre : **une affirmation de couverture qui n'est pas adossée à une
   commande reproductible est une estimation**. Compter de mémoire les fichiers touchés par un
   correctif de la semaine précédente donne un nombre plausible et faux.

   ⚠️ **Et le compte a encore bougé : un QUATORZIÈME site a été trouvé le 11/08/2026**, dans
   `running-programs/edit.tsx` — `onAddSession` gardait sur `if (addingSession) return`. Le `grep`
   ci-dessus ne pouvait pas le voir : il cherche `useActionLock`, c'est-à-dire les sites **déjà
   corrigés**. **Le bon filet, c'est le test de l'écran, pas la recherche textuelle** : celui-ci a
   été trouvé en écrivant la couverture d'un écran à 0 %, exactement comme le dixième l'avait été
   en août. Tant qu'il reste des écrans non couverts, il faut supposer qu'il en reste.

   ⚠️ **Vérifier qu'un test de non-régression échoue vraiment.** Les deux gardes de double appui
   ont été retirées à la main pour voir les tests passer au rouge. Un test écrit **après** le
   correctif n'a jamais rien démontré tant qu'on ne l'a pas vu échouer — c'est le seul moyen de
   distinguer « ça protège » de « ça passe ».
2. ~~**Reprendre les `*-smoke.test.tsx` existants**~~ — ⚠️ **constat périmé, vérifié le 04/08/2026 :
   ce chantier n'existe plus.** Les **15** fichiers `*-smoke.test.tsx` utilisent tous `await render`
   ou `await act` (vérifié fichier par fichier, 47 appels sur 47), et plusieurs assertent
   explicitement des effets — `cycle-index-smoke` vérifie une redirection, ce qui échouerait si les
   effets ne tournaient pas. L'avertissement du §3.6 décrit l'état du 03/08/2026 au matin ; les
   tests ont été écrits ou corrigés avec l'idiome depuis. **Ne pas repartir sur cette piste** : le
   vrai manque côté mobile est ailleurs (écrans **sans aucun** test, pas smoke tests à reprendre).
3. ~~**Combler l'écart aux 100 % de `packages/shared`**~~ — ✅ **fait le 04/08/2026.** Instructions,
   fonctions et lignes à **100 %** (verrouillées) ; branches à **97,35 %**, seuil arbitré à 97 avec
   la justification détaillée au §5 bis. Trois vrais trous fonctionnels trouvés au passage
   (suggestions de glucides, fractionnés en durée, throttle d'import du cycle) et deux défauts de
   code corrigés (`NaN` retourné comme record de course, code mort prouvé).
4. ~~**Reste de `apps/admin/src/data`**~~ — ✅ **fait le 07/08/2026 : 68,88 % → 97,71 %**
   (181 → 278 tests), cliquet relevé à 96/89/96. `exercises.ts` 49,8 → **99,1 %**, `programs.ts`
   57,8 → **96,9 %**, `foods.ts` et `users.ts` à **100 %**. **La couche data du back-office est
   couverte** ; le seuil est assez haut pour qu'un nouveau fichier non testé le fasse rougir.
   Le fil conducteur des trois fichiers ajoutés : **`owner_id IS NULL` sur chaque lecture comme sur
   chaque écriture** (l'admin parle à Supabase avec la clé anon — sans ce filtre, une action
   d'administration déborde sur les données **créées par les utilisateurs**), le **bornage au
   parent** des réordonnancements, et la **coercion des `numeric`** que PostgREST rend en chaîne.
5. **Écrans React du back-office** — **socle posé le 07/08/2026** : `jsdom` + Testing Library
   installés, environnement choisi **par l'extension du fichier de test** (`.test.ts` → `node`,
   `.test.tsx` → `jsdom`, via `environmentMatchGlobs`), nettoyage du DOM entre deux tests dans
   [`setup-dom.ts`](../../../apps/admin/src/test-utils/setup-dom.ts).
   **Trois écrans couverts** (74 tests) — à copier pour les suivants :
   [`ExercisesScreen`](../../../apps/admin/src/screens/ExercisesScreen.test.tsx) (29, liste +
   archivage), [`UserDetailScreen`](../../../apps/admin/src/screens/UserDetailScreen.test.tsx)
   (30, modération + sobriété RGPD),
   [`FoodImportScreen`](../../../apps/admin/src/screens/FoodImportScreen.test.tsx) (15, import CSV).
   **`ProgramEditScreen`** (1 458 lignes, le plus gros du dépôt) est couvert depuis le 08/08 sur
   ce qui porte son risque — l'**orchestration** (`runWrite` / `runReorder`), pas chaque champ de
   chaque formulaire, dont les écritures sont déjà testées dans `programs-detail.test.ts`.

   ✅ **Terminé le 12/08/2026 — plus aucun écran du back-office n'est à 0 %.** Les 6 restants ont
   été couverts en **138 tests** : `LoginScreen` (17, **100 %**), `ExerciseEditScreen` (36,
   **100 %**), `FoodEditScreen` (24, **100 %**), `ProgramCreateScreen` (25, 99,1 %),
   `ProgramsScreen` (31, 99,4 %) et `AccessDenied` (5, **100 %**).
   Couverture `apps/admin` : **68,37 % → 93,26 %** (`screens` 58,33 % → **91,74 %**).
   **Reste uniquement** `ProgramEditScreen` à 73,1 %, volontairement — le compléter champ par champ
   duplique `programs-detail.test.ts` pour un gain faible.

   🔴 **Le motif du rejet non capturé a resservi une troisième fois.** `AccessDenied.handleLogout`
   était en `try/finally` **sans `catch`** : le `finally` rendait bien la main, mais l'erreur
   remontait hors du gestionnaire `onClick`. Même cause que les deux `void p.finally(…)` du 11/08,
   même remède — **capturer avant de nettoyer**. Trouvé de la même façon que les précédents : pas
   déduit, mais **rencontré**, le test échouant sur le rejet avant d'échouer sur une assertion.
   ⚠️ Le symptôme est un **code de sortie à 1 avec tous les tests au vert** — invisible si on lit
   le résumé plutôt que le code de sortie. Une raison de plus de le relever sans pipe.

   ⚠️ **Deux observations d'accessibilité relevées en passant, non corrigées** (ce lot couvre, il
   ne redessine pas) : les **26 champs de `FoodEditScreen` n'ont aucun label associé** (le
   composant `Field` rend un `<label>` sans `htmlFor` et sans envelopper son contenu), et trois
   libellés d'`ExerciseEditScreen` sont **ambigus** — « Pectoraux », « Dos » et « Épaules »
   désignent à la fois un groupe secondaire et un muscle fin, donc deux cases s'annoncent pareil.

   🟠 **Un défaut fonctionnel figé plutôt que corrigé** : la recherche de variantes d'exercice est
   **sensible aux accents** (`'développé'.includes('dev')` est faux). Un test documente le
   comportement actuel ; le correctif tiendrait en un `.normalize('NFD')` des deux côtés.

   ⚠️ **Un pourcentage de branches peut BAISSER quand on couvre un gros fichier.** Avec le
   fournisseur v8, un fichier jamais chargé par un test contribue **zéro branche au dénominateur** :
   le couvrir à 75 % ajoute d'un coup ses centaines de branches au total, et le pourcentage global
   recule alors que la protection réelle a augmenté. Les cliquets `apps/admin` ont donc été
   **recalibrés à la baisse sur les branches et les fonctions** en même temps qu'à la hausse sur
   les instructions — ne pas lire un seuil qui recule comme une régression sans regarder ce qui
   vient d'entrer dans la mesure.

   ⚠️ **`Blob.prototype.text` et `arrayBuffer` n'existent pas dans jsdom**, même en v26
   (jsdom#2555) — ce n'est pas une question de version. Le complément est posé dans
   [`setup-dom.ts`](../../../apps/admin/src/test-utils/setup-dom.ts), via `FileReader` que jsdom
   fournit, lui. Sans lui, tout écran qui lit un fichier casse **là où on ne regarde pas** :
   `await file.text()` rejette, le gestionnaire `onChange` avale l'erreur, et l'écran reste figé
   sur son état initial.

   ⚠️ **Deux pièges du DOM, rencontrés dès le premier écran** :
   - **les libellés existent en double** — une fois dans un `<option>` de filtre, une fois dans le
     tableau. Borner la requête avec `within(screen.getByRole('table'))`, sinon
     « Found multiple elements » ;
   - **un mock de couche data au mauvais type ne lève pas où on croit.** `fetchUsageSummary` mocké
     avec une forme inventée faisait planter `archiveConfirmMessage` **dans le gestionnaire de
     clic** : la promesse était rejetée en silence, rien ne se passait, et quatre tests
     échouaient sur « la fonction n'a pas été appelée » — un symptôme à trois pas de la cause.
     Construire les objets de test à partir du **type réel**. Même famille sur `UserDetailScreen` :
     `parseActivePillars` remplacé par un double `undefined` faisait planter le **rendu**, et les
     30 tests échouaient sur « élément introuvable ». **Une fonction pure se reprend telle quelle**
     (`vi.mock(…, importOriginal)`), on ne la stubbe pas.

⚠️ **En touchant à la couverture** : les seuils sont appliqués par la CI (§5 bis). Un seuil rouge
signifie qu'on a retiré de la couverture — ajouter des tests, ne pas baisser le chiffre.

### Ce qui n'est volontairement pas fait

- **`weekly-review-repository` n'a pas de test d'écriture** : il n'en expose aucune, le bilan est
  entièrement dérivé (D1/D7).
- **Aucune ligne de RECETTES.md n'a été cochée.** Un test unitaire ne vaut pas recette : il
  couvre la règle, pas le rendu ni le device. Les tests posés **réduisent le risque** derrière ces
  recettes, ils ne les remplacent pas.
- **Aucun front-matter d'US ni statut de roadmap n'a bougé** — ce chantier est de l'outillage, il
  ne livre aucune fonctionnalité produit.
