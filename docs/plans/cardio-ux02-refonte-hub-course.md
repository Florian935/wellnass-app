# Plan d'implémentation — CARDIO-UX02 · Refonte du hub Course

> Spec : [cardio-ux02-refonte-hub-course.md](../specs/functional/us/cardio-ux02-refonte-hub-course.md)
> Branche : **`dev`** (décision Florian) · Livré le 19/09/2026 en une passe.
>
> ⚠️ Ce plan a été **écrit avec le code**, pas avant : Florian a demandé le lot entier d'un coup,
> les retours étant reportés à la recette. C'est le raccourci assumé décrit dans la spec ; il est
> tracé ici pour qu'on ne le prenne pas pour un oubli de workflow.

## Ordre de build, et pourquoi

Le socle **pur** d'abord, l'assemblage ensuite : une brique testée sans React se relit et se
corrige sans monter un écran, et c'est elle qui fixe le vocabulaire (`goalCount`, `PaceProgress`)
que tout le reste emploie.

### Étape 1 — Les briques pures (`packages/shared`)

| Fichier | Nature | Tests |
|---|---|---|
| `pace-progress.ts` | **neuf** — `computePaceProgress`, `paceDirection` | `pace-progress.test.ts`, 9 tests |
| `running-hub.ts` | `RunWeekSummary.goalCount` + son calcul | +3 tests dans `running-hub.test.ts` |
| `insight-adapters.ts` | 3 adaptateurs course | +9 tests |
| `insights.ts` | 3 ids dans `INSIGHT_ORDER` | `insights.test.ts` : 13 → 16 |
| `index.ts` | export de `pace-progress` | — |

⚠️ **Collision de nom attrapée au typecheck** : `PACE_MIN_RUNS` existait déjà dans
`lab-investigations.ts`. `index.ts` réexporte tout à plat — renommé `PACE_PROGRESS_MIN_RUNS`, et la
raison est écrite sur la constante.

### Étape 2 — Le thème (`apps/mobile/src/theme`)

| Fichier | Changement |
|---|---|
| `pillar.ts` | `TINT_GAIN` par pilier (`running: 1.5`), borné à 1 au calcul |
| `components/stage/PillarPanel.tsx` | **neuf** — panneau au dégradé du pilier + `PanelGlass` + `usePanelInk` |

Le gain **seul** ne suffisait pas et le plan l'a acté après mesure : à chroma égale, il manquait une
**grande surface** bleue dans le corps de la page. D'où le panneau, réservé à la carte dominante.

### Étape 3 — Le repository (`data/repositories/run-cards-repository.ts`, neuf)

`usePaceProgress` · `useRunLifetime` · `useRunningThread`. Que du câblage : les trois sources sont
des hooks existants (`usePaceTrend`, `usePolarisation`, `useRunningRecords`, `useRunHistory`) et
les règles vivent dans `shared`.

🔴 Le fil **ne réutilise pas** `useInsights()` : l'accueil agrège huit hooks pour le nourrir, le
remonter ici doublerait l'union. `selectInsights` ne calcule rien — on lui remet nos candidats.

### Étape 4 — Les composants (`components/running/`)

Six fichiers neufs : `RunThread`, `PaceProgressCard`, `RunWeekCard`, `RunEngineCard`,
`RunRecordWall`, `RunLifetimeLine`, `RunDirectorySheet`.
Deux supprimés : `RunWeekBand.tsx`, `../widgets/running-widgets.tsx` (+ son test).

### Étape 5 — L'écran (`app/(tabs)/running.tsx`)

Le corps est recomposé ; **la scène, la résolution d'état et la semaine ne bougent pas** — seul le
libellé de semaine passe de `plannedCount` à `goalCount`. Sortent `WidgetGrid`, `CustomizeButton`,
`editing`, `dragging`, `renderWidget`, `isWidgetActive`.

### Étape 6 — L'identité par route

`useMenuFocus('running')` ajouté aux **9 écrans empilés** du pilier + garde
`app/__tests__/pillar-identity.test.ts`. Le bandeau bordeaux de `run/summary.tsx` prend les couleurs
de la scène Course.

### Étape 7 — i18n, puis vérification

FR + EN, additif. Puis typecheck → lint → suite entière.

## Fichiers touchés

**Neufs (13)** — `pace-progress.ts` + test · `run-cards-repository.ts` · `PillarPanel.tsx` ·
6 composants course · `running-screen.test.tsx` · `run-hub-cards-ux02.test.tsx` ·
`pillar-identity.test.ts`.

**Modifiés (29)** — dont 9 écrans course (identité), 9 fichiers de test course (mock du hook),
`running.tsx`, `pillar.ts`, les 2 locales, 5 fichiers `shared`.

**Supprimés (3)** — `RunWeekBand.tsx`, `running-widgets.tsx`, `running-widgets.test.tsx`.

## Ce que les tests ont attrapé pendant l'implémentation

1. **La collision `PACE_MIN_RUNS`** — typecheck, avant tout test.
2. **Neuf suites de tests course cassées** par l'ajout de `useMenuFocus` : leurs mocks
   d'`expo-router` n'exposent pas `useFocusEffect`. Mock du hook ajouté, comme le font déjà les
   quatre tests d'onglet.
3. **Une fabrique `jest.mock` référençant une variable de module** (`sonde`) : interdit par jest, et
   l'erreur ne se voyait que par un `render` qui ne rendait rien. Fabriques réécrites en entier.
4. **`render` est asynchrone ici** (React 19 + RNTL) : sans `await`, `screen` reste détaché et
   l'échec ressemble à « render n'a pas été appelé ». Le test d'onglet muscu `await` déjà.
5. **Une attente fausse de ma part** dans le test d'allure (`5:22` au lieu de `5:44` pour la
   fenêtre précédente) — corrigée dans le test, pas dans le code.

## Vérification finale

```
npm run typecheck   → 0 (3 workspaces)
npm run lint        → 0, sans warning
npm run test        → code de sortie 0, LU SANS PIPE
                      Vitest : 160 fichiers, 3 286 tests
                      Jest   : 224 suites, 3 741 tests
```

Test de garde vu **rouge** avant correctif : `goalCount` remisé (`git stash`) → le test
« la scène et la carte affichent le MÊME n faites sur m » échoue, les 5 autres passent.

## Ce qui n'a PAS été fait

- **Les maquettes `/design`** : le skill est réservé à une invocation explicite de Florian et n'est
  pas invocable depuis une session d'agent. Rien n'a été produit à la place — le skill interdit
  explicitement de reproduire son travail par un autre moyen.
- **L'identité par écran sur les piliers Muscu et Nutrition** : même défaut, hors périmètre, porté
  au backlog. Le test de garde est prêt à les accueillir (une ligne par dossier).
- **Le nettoyage de `RUNNING_WIDGET_IDS`** dans `shared` : inerte mais conservé, comme côté muscu.
