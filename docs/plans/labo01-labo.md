# Plan d'implémentation — LABO-01 « Le Labo »

Spec : [labo01-labo.md](../specs/functional/us/labo01-labo.md) · Branche : **`dev`** · Roadmap 7.30.

> Écrit le 15/09/2026 dans un **worktree isolé** (`feature/labo01-labo`) parce que trois autres
> sessions travaillaient en parallèle sur `C:\wellness-app`, puis **reporté sur `dev` par une fusion
> à trois points** — jamais par copie de fichier : douze fichiers étaient touchés des deux côtés
> (i18n, roadmap, RECETTES, registre des migrations, export RGPD…), et une copie aurait effacé le
> travail des autres sessions en silence.

> **Une seule vague**, sur demande explicite de Florian le 15/09/2026 (« On va tout coder ICI d'un
> seul coup sec, d'une seule vague et avant le Play Store »). Le plan est donc écrit **avec** le code
> et sert d'ordre de relecture, pas d'ordre de livraison.

## 1. Ordre de construction

| # | Étape | Pourquoi dans cet ordre |
|---|---|---|
| 1 | **Moteurs purs** dans `packages/shared` | Ils ne dépendent de rien et sont testés sous Vitest. Tout ce qui décide vit là. |
| 2 | **Migrations** (sommeil + expériences) | La couche data ne peut pas être écrite avant le schéma. |
| 3 | **Schéma PowerSync local + sync rules** | Sans la table locale, chaque requête échouerait **en silence** (`useQuery` avale l'erreur). |
| 4 | **Repositories** | Ils assemblent l'historique et appellent les moteurs. |
| 5 | **Scène 3D** (portage + frontière) | Isolée derrière `scene-state.ts`, pur et testé. |
| 6 | **Écran et panneaux** | Ne décide de rien d'autre que les gestes et la feuille. |
| 7 | **Check-in : la note de nuit** | Alimente le pilier « sommeil » du Labo. |
| 8 | **i18n, thème, onglet, tests, docs** | |

## 2. Fichiers

### `packages/shared` — les moteurs (4 fichiers, 100 % couverts)

| Fichier | Contenu |
|---|---|
| `lab-week.ts` | `buildLabWeek()` : jours, progression, **7 familles de propositions** (ordre de priorité, plafond à 5), `LabAction`. Réutilise GARDE-01, META-19, MN-02, COLLIS-01, MN-06, FUEL-01. |
| `lab-composer.ts` | `LabDoses`, `stepDose`, `composeLab()` (projection SBD via `projectWhatIf`, charge, kcal, protéines, glucides, croisements), `bestLabSteps()`, `LAB_WRITABLE_LEVERS`. |
| `lab-investigations.ts` | `buildLabQuestions()` : détecte `liftPlateau` / `paceFade` / `weightPlateau`, classe **8 familles de suspects** sur 21 j vs 21 j, sépare `cleared` et `missing`. |
| `lab-experiments.ts` | Tirage des semaines, progression, **verdict scellé**, adhérence sans saisie, `buildLabKnowledge()` (cartes d'association avec minimum de cas). |

Retouches : `wellbeing.ts` (bornes de sommeil, `isSleepMinutes`, `isEmptyCheckin` accepte une nuit
seule), `session-adaptation.ts` (export de `REPS_REDUCTION_PCT` / `PACE_SLOWDOWN_S_PER_KM`),
`index.ts`.

### `supabase/migrations`

1. `20260915151307_labo01_sommeil_et_experiences.sql` — colonne + table + RLS + index unique partiel.
2. `20260915151316_labo01_lab_experiments_publication.sql` — publication `powersync`.

### `apps/mobile`

| Fichier | Rôle |
|---|---|
| `src/powersync/schema.ts` | `sleep_minutes` + table `lab_experiments`. |
| `src/data/repositories/lab-repository.ts` | `useLabWeek`, `useLabQuestions`, `useLabKnowledge`, `useLabComposer`, `useLabObjective`, `useLabPillars`, `nextMondayKey`. Deux requêtes nouvelles (séries de force, muscles travaillés), fenêtre `LAB_HISTORY_DAYS = 56`. |
| `src/data/repositories/lab-experiment-repository.ts` | Lecture + `start` / `stop` / `delete`. Tirage **à l'écriture**. |
| `src/data/repositories/daily-wellbeing-repository.ts` | Lecture/écriture du sommeil. |
| `src/components/lab/scene/engine.js` | Portage du prototype (three r128), `setLabels` / `setPillars` / `dispose`. |
| `src/components/lab/scene/LabScene3D.dom.tsx` | Composant DOM (`'use dom'`). |
| `src/components/lab/scene/LabScene2D.tsx` | Repli SVG. |
| `src/components/lab/scene/scene-state.ts` | **Mappers purs** : tout ce que la scène décide sort ici pour être testé. |
| `src/components/lab/LabStage.tsx` | Hauteur fixe, bascule 3D → 2D sur `ok: false`. |
| `src/components/lab/Lab{Week,Composer,Why,Known}Panel.tsx`, `LabApplySheet.tsx`, `Lens.tsx`, `Stepper.tsx`, `lab-format.ts` | Les quatre onglets et la feuille. |
| `src/app/(tabs)/lab.tsx` | L'écran : onglets, « prêt » / « appliqué », feuille, expériences. |
| `src/components/wellbeing/WellbeingCheckinSheet.tsx` | La note de nuit. |
| Thème / navigation | `theme/colors.ts` (`pillarLab`), `theme/stage.ts`, `stores/menu-accent-store.ts`, `components/AccentHalo.tsx`, `app/settings.tsx`, `app/(tabs)/_layout.tsx`. |
| i18n | Section `lab.*` complète + `tabs.lab` + `wellbeing.sleep*`, FR **et** EN. |

## 3. Tests prévus (et écrits)

| Filet | Couvre |
|---|---|
| Vitest `lab-week` / `lab-composer` / `lab-investigations` / `lab-experiments` | Toutes les règles. **100 %** sur les 4 fichiers. |
| Jest `scene-state.test.ts` | Les mappers de la scène, dont la **sérialisabilité** de l'état qui franchit la frontière DOM. |
| Jest `lab-format.test.ts` | Durées, allures, décimales, dates sans décalage de fuseau. |
| Jest `lab-screen.test.tsx` (20 tests) | **R4** surtout : rien ne s'écrit sans la feuille ; une proposition qui n'écrit rien navigue ; les bonnes écritures aux bons identifiants ; l'expérience démarre le lundi suivant. |
| Jest `lab-experiment-write.test.ts` | Le tirage est écrit **une fois**, équilibré, et refuse d'écrire sans session. |
| Jest `checkin-sleep.test.tsx` | La nuit est facultative, le premier « + » pose 7 h, « effacer » ramène à non renseignée. |
| `sql-prepare-sweep.test.ts` (existant) | Prépare automatiquement les nouvelles requêtes contre le schéma local. |
| `contrast.test.ts` (existant) | 4 paires ajoutées pour `pillarLab`. |

**Exclusion de couverture** : `**/*.dom.tsx`. Un composant DOM n'est pas exécuté par React Native
mais chargé dans une WebView ; le monter sous jest-expo ne testerait rien de ce qu'il fait — ce qui
est testable en a été sorti.

## 4. Points de vigilance

1. **`useQuery` avale les erreurs SQL** : une colonne fantôme donnerait un écran « pas de donnée »
   parfaitement crédible. D'où le passage obligé par le sweep SQL.
2. **Pas d'horloge dans un corps de hook/composant** (React Compiler) : `useTodayKey()`,
   `nextMondayKey(todayKey)`. Le garde-fou `no-frozen-clock.test.ts` le vérifie.
3. **Sync rules non versionnées côté outil** : à coller à la main après `db:push`.
4. **`db:push` à faire valider** : une migration `corps02` d'une autre session est en attente sur le
   dépôt principal — `db:push:dry` d'abord, jamais de push à l'aveugle.
5. **Le worktree partage la pile de `git stash`** avec le dépôt principal : ne jamais `git stash` nu.

## 5. Ce qui reste hors de ce plan

- Le déploiement des sync rules et `db:push` (gestes humains).
- La recette device ([RECETTES.md](../../RECETTES.md)).
- Le bundling web (`expo export --platform web`) échoue sur `better-sqlite3` **avant** cette US et
  indépendamment d'elle (rendu statique qui tire le build Node d'`op-sqlite`) ; le smoke-test retenu
  est donc `expo export --platform android`, qui passe et **embarque bien la scène DOM**
  (`www.bundle/*.html` + le JS de three).
