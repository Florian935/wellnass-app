# Plan — SERIE-01 · La régularité, dite en semaines

Spec : [serie01-serie-hebdomadaire.md](../specs/functional/us/serie01-serie-hebdomadaire.md) ·
Analyse : [analyse-strava-2026-09.md](../product/analyse-strava-2026-09.md), candidats **S13** et **S7**.

Travail **directement sur `dev`**. **Aucune table neuve, aucune sync rule à redéployer** — deux
colonnes additives sur `user_settings`, déjà publiée et lue en `select *`.

## Ordre de build

1. **Le moteur pur** — la série hebdomadaire et la progression de l'objectif, en TDD.
2. **La migration** — deux colonnes nullables, plus les **trois gestes** qu'une colonne exige.
3. **Le réglage** — unité de série et objectif, écrits via `settings-repository`.
4. **Les écrans** — la carte de série, l'objectif, la carte de bascule.

L'ordre est contraint par le risque, pas par le confort : **le moteur d'abord**, parce que la règle
R3 (« la semaine courante ne casse jamais la série tant qu'elle n'est pas finie ») est *la* règle
qui, ratée, fait tomber la série de tout le monde à zéro le lundi matin. Elle se prouve par un test,
pas par un écran.

---

## Étape 1 — le moteur pur (TDD)

`packages/shared/src/streak-week.ts` — **fichier neuf, à côté de `streak.ts`** plutôt que dedans.
La série quotidienne et ses deux pansements (joker, jours en pause) sont en recette : on n'ouvre pas
un module que quelqu'un vérifie en ce moment.

**1.1 — `weekKey(dayKey)` → `AAAA-Www`**
La clé de semaine d'un jour, lundi → dimanche, dérivée de `startOfWeek` (déjà en vigueur, spec C4).
*Tests* : un lundi et le dimanche suivant partagent la même clé · un dimanche et le lundi suivant
non · passage d'année · passage de mois.

**1.2 — `computeWeeklyStreak(activeWeeks, currentWeekKey)` → `{ current, activeThisWeek }`**
Même forme que `computeStreak` — on garde la symétrie pour que les deux se lisent ensemble.

🔴 **La règle R3 est ici, et c'est elle qui compte.** La semaine courante inactive ne casse pas la
série : on repart de la semaine précédente. C'est exactement le `if (activeToday) … else
prevKey(…)` de `computeStreak`, transposé.

*Tests* : semaine courante active → comptée · semaine courante **inactive** mais précédente active →
la série **tient** (le test qui prouve R3) · deux semaines vides d'affilée → série à 0 · compte neuf
→ 0 et non 1 (R12) · liste vide → 0.

**1.3 — `activeWeekKeys(activities, pausedDays)` → `Set<string>`**
Pendant hebdomadaire d'`activeDayKeys`.
⚠️ **R5, la seule vraie subtilité** : une semaine dont **tous** les jours sont en pause et qui ne
porte **aucune** activité est **transparente** — ni active, ni cassante. La fonction rend donc deux
ensembles (`active`, `transparent`), et `computeWeeklyStreak` traverse le second.
⚠️ **D3** : les **pas** n'entrent pas, contrairement à la série quotidienne.
*Tests* : semaine entièrement en pause sans activité → transparente · semaine entièrement en pause
**avec** une activité → active (l'activité prime, comme le cas C de VIE-01) · semaine
**partiellement** en pause → ordinaire · une journée de pas seule → semaine **non** active.

**1.4 — `weeklyGoalProgress(activities, currentWeekKey, goal)` → `{ done, total, met }`**
`goal` à `null` rend `total: null` : la carte affiche alors le **compte**, jamais une cible inventée
(R9). Rien n'est stocké (R8).
*Tests* : objectif `null` → `total` nul et `done` juste · objectif atteint · objectif dépassé (on ne
plafonne pas `done`) · lundi → `done` repart à 0.

**1.5 — `weeklyGoalConflict(goal, runningFrequency)` → `boolean`**
Vrai quand l'objectif transverse est **strictement inférieur** à la fréquence coureur (R10). Une
fonction d'une ligne, mais nommée : c'est elle qui rend la règle relisible, et elle garantit qu'on
**signale sans corriger**.

---

## Étape 2 — la migration

`npm run db:new serie01_streak_unit_and_weekly_goal` :

```sql
alter table public.user_settings
  add column if not exists streak_unit text
    check (streak_unit in ('day', 'week'));
alter table public.user_settings
  add column if not exists weekly_activity_goal integer
    check (weekly_activity_goal between 1 and 14);
```

🔴 **Aucune valeur `default`, délibérément** (spec R9) : `null` doit vouloir dire « jamais demandé »,
jamais « la valeur par défaut ». C'est la leçon d'`activity_level` (NUTRI-UX01), qui retombait sur
`'moderate'` et s'affichait comme un **choix** — ~614 kcal/jour d'écart, en silence.

✅ **Aucune sync rule à déployer** : `user_settings` est publiée et lue en `select *`.
🔴 **Mais les trois gestes d'une colonne restent obligatoires** : la migration, le **schéma PowerSync
local**, et `settings-repository.ts`. Sans le deuxième, l'écriture échoue et `void updateSettings()`
avale l'erreur — panne exacte de `cycle_tracking_enabled` (31/07) et `daily_step_goal` (03/08).

⚠️ **D1 impose un traitement des comptes existants** : la migration laisse `null`, et c'est **le
code** qui interprète `null` comme `'day'` pour un compte qui a déjà un historique, `'week'` pour un
compte neuf. Poser `'day'` en SQL pour tout le monde priverait les comptes neufs du défaut voulu.

Puis `db:push:dry`, `db:push`, `db:types`, et **cocher** [MIGRATIONS.md](../../supabase/MIGRATIONS.md).

---

## Étape 3 — le réglage

`settings-repository.ts` : les deux clés dans le type d'entrée, la lecture et l'écriture.
⚠️ **`profile-columns-guard.test.ts` garde `ProfileInput`, pas `SettingsInput`** — vérifier s'il
existe un garde équivalent pour les réglages ; sinon, ce lot est le bon moment pour en poser un, le
piège étant rigoureusement le même.

*Tests* : sur le harnais `sqlite-harness`, donc contre le **vrai schéma local** — une colonne absente
fait échouer le test au lieu d'attendre la recette.

---

## Étape 4 — les écrans

**4.1 — La carte de série** (`components/dashboard/StreakCard.tsx`)
La carte existe en trois formats (`small`, `wide`, `large`) et affiche une bande de 7 jours. En
unité « semaine », la bande devient une bande de **semaines**. ⚠️ **Ne pas dupliquer le composant** :
une prop d'unité, et les mêmes trois formats — sans quoi on maintiendra deux cartes qui divergeront.

**4.2 — L'objectif de la semaine**
Nouveau bloc, ou extension de la carte de série (à trancher à la maquette). ⚠️ Budget d'écran :
[ADR-007](../adr/ADR-007-surfacage-analyses.md) et INSIGHTS-02 viennent de dégonfler l'accueil —
ce bloc **remplace** ou **s'intègre**, il ne s'ajoute pas.

**4.3 — La carte de bascule** (D1)
Une seule fois, avec les **deux** compteurs côte à côte pour que le choix soit éclairé. Elle
disparaît dès que l'utilisateur a choisi. Marqueur : `streak_unit` cesse d'être `null`.

**4.4 — Le réglage** dans les paramètres : unité, et objectif hebdomadaire.

---

## i18n

11 clés (spec §8) en FR **et** EN.
⚠️ `count` est une variable **réservée** d'i18next et déclenche la pluralisation (`_one` /
`_other`) : c'est ce qu'on veut, mais il faut le savoir. *(Leçon de PARTAGE-02 : `ordinal` est
réservé aussi, et l'utiliser comme variable d'interpolation ne compile pas.)*

---

## Vérification avant de déclarer fini

`npm run typecheck` · `npm run lint` · `npm run test` — **code de sortie lu sans pipe**. Puis
`node scripts/etat.mjs`.

## Ce que le plan ne fait pas

- **Ne touche pas** à `streak.ts`, au joker, ni aux jours en pause : la série quotidienne est
  inchangée, et elle est en recette.
- **Ne supprime pas** `running_profiles.weekly_frequency`.
- Aucune **mise en scène sociale** de la série.
- Aucun **défi** ni **trophée** ([ADR-005](../adr/ADR-005-gamification.md)).
