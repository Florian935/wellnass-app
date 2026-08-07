# Plan d'implémentation — COLLIS-01, correctif « veille hors semaine »

> Spec : [collis01-detecteur-collisions.md](../specs/functional/us/collis01-detecteur-collisions.md)
> (rouverte le 07/08/2026 — D7, §4.1, R7)
> Plan initial de l'US, toujours valable pour le reste : [collis01-detecteur-collisions.md](collis01-detecteur-collisions.md)
> Branche : `fix/collis01-conflit-veille-hors-semaine` · Créée depuis `origin/dev` le 07/08/2026

## 0. Ce que ce plan garantit d'emblée

| Question | Réponse |
|---|---|
| Migration base ? | ✅ **Non** — on lit **plus de lignes** de la même colonne, pas une colonne neuve |
| Sync rule PowerSync ? | ✅ **Non** |
| Schéma PowerSync local ? | ✅ **Non** — aucun champ nouveau |
| Types régénérés (`db:types`) ? | ✅ **Non** — le schéma ne bouge pas |
| Dépendance native neuve ? | Non → recettable sur l'APK existant |
| i18n neuve ? | ✅ **Non** — voir §4, c'est un résultat, pas un oubli |
| Nouveau composant ? | Non — le bandeau et l'écran sont inchangés |
| Fichiers applicatifs touchés | **2** (+ 2 fichiers de tests) |

⚠️ **`nvm use 24`** avant toute commande de test (`.nvmrc` = Node 24 depuis le chantier `node:sqlite`).

**Ce correctif est petit et son risque est concentré en un seul point** : il est possible de corriger
le moteur, d'avoir 100 % de tests verts, et que **rien ne change sur le device**. Le §1 est ordonné
pour rendre ce mode d'échec impossible à atteindre silencieusement.

## 1. Ordre de build

Contrairement au plan initial, **le moteur n'est pas le premier lot**. La raison est dans R7 : le
moteur seul ne peut pas prouver le correctif. Si on le corrige d'abord, on obtient une suite verte
qui ne dit rien de la fonctionnalité, et c'est précisément l'illusion contre laquelle ce plan est
construit. On commence donc par **le test qui échoue au bon endroit**.

```
Lot 1   Le test SQL du repository qui échoue      mobile     ROUGE d'abord — il prouve le vrai bug
Lot 2   La fenêtre élargie du repository          mobile     rend le lot 1 vert
Lot 3   Le moteur : la veille dérivée             shared     TDD strict, 100 %
Lot 4   Les non-régressions verrouillées          les deux   DOUL-01, useWeekPlan, les 6 autres jours
Lot 5   Vérification + suivi
```

---

## Lot 1 — Le test qui échoue d'abord (et pas dans le moteur)

**Fichier neuf** : `apps/mobile/src/data/repositories/__tests__/session-conflicts-window.test.ts`

> ⚠️ **Corrigé en cours d'exécution le 07/08/2026.** Ce lot devait s'ajouter à
> `session-conflicts-sql.test.ts` et semer des lignes dans le harness SQLite. **C'était le mauvais
> instrument** : `SELECT_PLANNED_MUSCLE_SETS` prend ses bornes **en paramètres liés**, donc elle
> fonctionne déjà pour n'importe quelle fenêtre. Un test SQL qui lui passe `09/08 → 16/08` prouve que
> SQLite sait comparer des dates — pas que le hook demande la bonne fenêtre. Or **c'est le hook qui
> porte le bug**. Le test a donc été écrit sur le hook, ce qui est le seul niveau où la borne se
> décide.

`useQuery` est mocké globalement ([jest.setup.ts:18](../../apps/mobile/jest.setup.ts)) : on rend le
hook avec `renderHook`, puis on inspecte les **paramètres liés réellement passés** à chaque requête.
Six cas :

| # | Ce qui est vérifié | Pourquoi |
|---|---|---|
| 1 | `useSessionConflicts` lit les **séances** depuis la veille | Le bug du backlog |
| 2 | …et les **séries par muscle** depuis la veille aussi | Élargir une seule des deux ne sert à rien |
| 3 | Réglage éteint → `owner_id` vide sur les deux | La fenêtre élargie n'a pas contourné l'opt-in (R2) |
| 4 | `useWeekPlan` garde ses **7 jours** | Sinon une 8ᵉ carte apparaît sur `/planning` |
| 5 | `useWeekPainSignals` garde ses **7 jours** | DOUL-01 partage la requête, pas le besoin |
| 6 | La constante SQL contient toujours `BETWEEN ? AND ?` | Une fenêtre codée en dur contaminerait DOUL-01 |

Ce test doit être **rouge avant toute autre modification**. C'est le seul artefact du chantier qui
distingue « le moteur est corrigé » de « la fonctionnalité marche ».

> 🔴 **Pourquoi pas dans le moteur.** Le moteur ne voit que ce qu'on lui donne. Un test de moteur qui
> lui passe une séance la veille et vérifie qu'il la juge **prouve le moteur, pas la chaîne**. Si la
> requête du repository garde ses 7 jours, ce test reste vert et l'app ne détecte toujours rien.

⚠️ Les variables capturées par une factory `jest.mock` doivent être **préfixées par `mock`** — Babel
refuse tout autre nom (`settingsMock` échoue, `mockSettings` passe).

---

## Lot 2 — La fenêtre élargie, sans toucher au contrat de `useWeekPlan`

**Fichier** : `apps/mobile/src/data/repositories/planned-session-repository.ts`

Trois modifications, et **une seule ligne de SQL n'est réécrite** :

1. **Extraire de `useWeekPlan` un hook de fenêtre** prenant ses deux bornes, sur
   `SELECT_PLANNED_BETWEEN` (qui les prend déjà en paramètres liés). `useWeekPlan(weekStartDate)`
   devient un appel de ce hook avec `weekStart → weekStart+6` — **son contrat public ne change pas**.
2. Dans `useSessionConflicts`, calculer `eveKey = weekStart − 1 jour` et lire la fenêtre
   `eveKey → weekEnd` au lieu de `useWeekPlan(weekStartDate)`.
3. Passer `eveKey` en borne basse de l'appel à `SELECT_PLANNED_MUSCLE_SETS` — **la constante SQL
   n'est pas modifiée**, seuls ses paramètres liés changent.

```ts
// useSessionConflicts — les deux lectures s'élargissent d'un jour en amont, ensemble.
const weekStartDateObj = new Date(y!, m! - 1, d!);
const eveKey  = localDayKey(addDays(weekStartDateObj, -1));
const weekEnd = localDayKey(addDays(weekStartDateObj, 6));

const { items, isLoading: planLoading } = usePlannedBetween(eveKey, weekEnd);
const { data: setsRows, isLoading: setsLoading } = useQuery<MuscleSetsRow>(
  SELECT_PLANNED_MUSCLE_SETS,
  [enabled ? userId : '', eveKey, weekEnd],
);
```

> ⚠️ **Les deux lectures s'élargissent, ou aucune.** Élargir les séances sans élargir les séries
> donnerait une séance de jambes la veille **avec `setsByMuscle` vide** → `isHeavyLegSession` rend
> `false` → aucun conflit, et le symptôme est **identique à celui d'avant correctif**. Deux lignes,
> et l'oubli de l'une annule l'autre en silence.

> ⚠️ **Ne pas élargir `useWeekPlan` lui-même.** Il alimente les cartes de jour de `/planning` : lui
> faire rendre 8 jours ajouterait une carte hors semaine en haut de l'écran (critère de recette 19).
> Et **ne pas toucher `SELECT_PLANNED_MUSCLE_SETS`** : DOUL-01 (`useWeekPainSignals`) la partage et
> garde ses 7 jours (critère 21).

⚠️ `addDays(…, -1)` : vérifier qu'il accepte un décalage négatif. Si ce n'est pas le cas, la
construction se fait composant par composant comme partout ailleurs dans le fichier — **jamais**
`new Date('AAAA-MM-JJ')`, interprété UTC et décalé d'un jour à l'ouest de Greenwich.

À l'issue du lot 2, **le test du lot 1 passe au vert** et le moteur, lui, n'a pas encore bougé : il
reçoit désormais la séance du dimanche et **l'ignore toujours**. C'est l'état attendu.

---

## Lot 3 — Le moteur : dériver la veille, aux deux endroits

**Fichier** : `packages/shared/src/session-conflicts.ts`

La veille se **dérive** de `weekStartKey`, elle n'entre pas en paramètre (R7) — une seconde source de
vérité pour le même fait se désynchronise au premier copier-coller, et le moteur deviendrait borgne
sans qu'un seul test le voie.

```ts
const weekKeys = weekDayKeys(weekStartKey);          // les 7 jours affichés — borne du REPLI
const scanKeys = [previousDayKeyOf(weekStartKey), ...weekKeys];  // 8 jours — borne de la DÉTECTION
```

Deux bornes, deux usages, et c'est **le cœur du correctif** :

| Usage | Clés à utiliser | Pourquoi |
|---|---|---|
| Chercher la veille d'une **course** | `scanKeys` | Hier existe même hors écran (§4.1 n° 1) |
| Chercher la veille d'un **jour candidat au repli** | `scanKeys` | Sinon lundi est proposé sans vérification (§4.1 n° 2) |
| Énumérer les **candidats** au repli (`after` / `before`) | `weekKeys` | Un repli hors écran est incompréhensible (D7) |
| Boucler sur les **courses à juger** | `weekKeys` | La veille est **lue, pas jugée** (§8) |

### Le piège d'implémentation, nommé

`findFallbackDay` calcule `runIndex = weekKeys.indexOf(runDayKey)` **sans garde `=== -1`**, et son
commentaire justifie cette absence par un invariant : « l'appelant n'entre ici qu'après un
`previousDayKey` non nul, qui exige déjà un index ≥ 1 ».

🔴 **Cet invariant change de nature avec la fenêtre élargie.** `sessions` contient maintenant les
séances de la veille ; `sessions.filter(isQualityRun)` peut donc retenir une **course de qualité le
jour de la veille**, dont l'index dans `weekKeys` vaut **−1**. Le garde-fou actuel tient encore *par
accident* — `previousDayKey(eveKey, scanKeys)` rend `null` sur l'index 0, donc la boucle `continue`
avant d'appeler `findFallbackDay`. **Un garde-fou accidentel n'est pas un garde-fou.**

La parade est de rendre l'invariant **local et explicite** plutôt qu'émergent : filtrer les courses à
juger sur `weekKeys.includes(run.dayKey)` dans la boucle de détection. Deux bénéfices : le cas §8
« course de qualité le jour de la veille » devient impossible par construction, et le commentaire de
`findFallbackDay` redevient vrai pour la raison qu'il énonce.

⚠️ **Mettre à jour ce commentaire dans le même commit.** Un commentaire qui justifie une absence de
garde par un invariant devenu faux est pire que pas de commentaire : il décourage la prochaine
lecture.

### Tests à écrire d'abord (TDD strict — `packages/shared` est à 100 %)

| # | Cas | Attendu |
|---|---|---|
| A | Jambes 12 séries **la veille**, sortie longue **lundi** | **1 conflit**, `strengthDayKey` = la veille |
| B | Idem mais 5 séries la veille | `[]` — le seuil ne change pas selon le côté de la frontière |
| C | Idem mais course `endurance` lundi | `[]` |
| D | Idem mais jambes `skipped` / `done` la veille | `[]` |
| E | Idem mais dos dominant la veille | `[]` — la dominance ne change pas non plus |
| F | **Course de qualité le jour de la veille**, rien d'autre | `[]` — la veille est lue, pas jugée |
| G | Jambes lourdes la veille, course **mardi**, lundi vide | Repli ≠ lundi (**§4.1 n° 2**) |
| H | Jambes lourdes la veille **et** mercredi, course jeudi | Un conflit, la plus lourde (R5 inchangée) |
| I | Jambes lourdes la veille **et** dimanche affiché, deux courses de qualité | 2 conflits distincts |
| J | Le repli reste **dans la semaine affichée** | Jamais une clé hors `weekKeys` |
| K | Semaine sans aucune séance la veille | Comportement **identique** à avant correctif |

> 🔴 **Le test existant « ne déclenche pas sur une course le premier jour de la semaine — pas de
> veille » (`session-conflicts.test.ts:147`) figeait le bug.** Il ne se supprime pas en silence : il
> se **réécrit**, pour dire que le premier jour de la semaine **a** une veille, hors semaine. Un test
> retiré sans trace laisse croire que le cas n'a jamais été couvert ; un test réécrit dit qu'on a
> changé d'avis, et pourquoi.

---

## Lot 4 — Verrouiller ce qui ne doit pas bouger

Ce correctif touche une requête partagée et un hook partagé. Les non-régressions ne se constatent pas
en recette, elles se figent :

- **`useWeekPlan` rend 7 jours.** Test sur le hook de fenêtre extrait : `useWeekPlan('2026-08-10')`
  ne remonte **aucune** séance du 09/08.
- **DOUL-01 garde 7 jours.** `useWeekPainSignals` ne produit aucun signal pour une séance de la
  veille.
- **Les six autres jours sont intacts.** Les tests du 05/08 sur le conflit nominal en milieu de
  semaine tournent inchangés — s'ils demandent une retouche, c'est le signe qu'on a changé plus que
  la fenêtre.

---

## Lot 5 — Vérification

```bash
nvm use 24
npm run typecheck && npm run lint && npm run test:coverage
```

Codes de sortie **sans pipe** (`| tail` renvoie 0 même sur échec — piège documenté dans CLAUDE.md),
et **3 workspaces relancés séparément** (le run agrégé n'a pas toujours restitué les trois, constaté
le 05/08/2026).

Puis : CHANGELOG, front-matter (`etape`), roadmap 3.57 (reste ✅ Livré — la ligne ne régresse pas, la
fonctionnalité existait), RECETTES.md (**§ COLLIS-01 : 16 → 21 critères**), ETAT.

## 2. Fichiers touchés

**Aucun fichier neuf.**

| Fichier | Nature |
|---|---|
| `packages/shared/src/session-conflicts.ts` | La veille dérivée, deux bornes, filtre des courses jugées |
| `packages/shared/src/session-conflicts.test.ts` | 11 cas neufs + **1 test réécrit** |
| `apps/mobile/src/data/repositories/planned-session-repository.ts` | Hook de fenêtre extrait, 2 lectures élargies |
| `apps/mobile/src/data/repositories/__tests__/session-conflicts-sql.test.ts` | Le test rouge du lot 1 + non-régression DOUL-01 |

**Non touchés, et c'est un résultat** : `SessionConflictBanner.tsx`, `app/planning/index.tsx`,
`i18n/locales/*.json`, `powersync/schema.ts`, `settings.ts`, aucune migration.

## 3. Risques

| Risque | Parade |
|---|---|
| 🔴 **Moteur corrigé, appelant non élargi** → suite verte, device inchangé | Lot 1 **avant** le lot 3 : le test rouge part de la base, pas du moteur |
| 🔴 **Une seule des deux lectures élargie** → séance vue mais non chiffrée, symptôme identique à avant | Les deux lignes sont dans le même lot et le même `useMemo` ; cas A du lot 3 |
| 🔴 **Le repli propose lundi** et fabrique le conflit | `scanKeys` pour la veille d'un candidat ; cas G ; critère de recette 18 |
| `indexOf === -1` sans garde, invariant devenu faux | Filtre explicite `weekKeys.includes(run.dayKey)` + commentaire corrigé dans le même commit |
| 8ᵉ carte de jour sur `/planning` | `useWeekPlan` garde son contrat ; test du lot 4 ; critère 19 |
| DOUL-01 régresse via la requête partagée | La constante SQL n'est pas modifiée ; test du lot 4 ; critère 21 |
| Décalage de fuseau sur `weekStart − 1` | Construction composant par composant, jamais `new Date('AAAA-MM-JJ')` |
| Conflit de merge sur `/planning` | Aucun : l'écran n'est **pas** touché par ce correctif |
