# Plan d'implémentation — VIE-01

> Spec : [vie01-mode-vie-reelle.md](../specs/functional/us/vie01-mode-vie-reelle.md)
> Branche : `feature/vie01-mode-vie-reelle` · créée depuis `origin/dev` le 05/08/2026
> 4 arbitrages Florian du 05/08/2026 (D1 → D4) **acquis** · 2 décisions de cadrage (D5, D6) validées
> le 05/08/2026.

## ✅ État au 05/08/2026 — code complet et vérifié

**Tous les lots sont livrés.** Vérification passée : **typecheck à 0 sur les 3 workspaces**,
**2 885 tests verts** (181 admin + 824 mobile + 1 880 shared), **lint à 0 erreur**.

✅ **Les 2 migrations sont poussées** (05/08/2026, par Florian — le classifieur avait refusé la
commande, la cible étant la base cloud partagée). Le CLI a émis `failed to cache migrations catalog`,
**le même warning qu'au push de REPAS-01** : il porte sur la mise en cache du catalogue pg-delta, pas
sur l'exécution. Démenti par `npm run db:types`, qui rapatrie `real_life_periods` et ses 7 colonnes
depuis le cloud — et dont le diff ne contient **que** ces 38 lignes, donc aucune dérive au passage.

🔴 **Une seule étape reste, et ce n'est pas du code** : **déployer la sync rule PowerSync à la main**
(table neuve). La ligne est déjà dans le YAML ; il faut le coller dans le dashboard et cliquer
« Deploy ». Étape **déjà oubliée deux fois** (BIEN-01, RUN-F2c).

Puis la recette device : **22 critères** dans [RECETTES.md](../../RECETTES.md) §33.

### Ce que l'implémentation a appris

| Découverte | Conséquence |
|---|---|
| `useDayCalorieTarget(dayKey)` et `useGoalAdherenceForRange` servent des **jours passés** | La cible ne peut pas être « en période aujourd'hui ? » mais « ce **jour-là** était-il en période ? ». `targetBase` est devenu une **fonction du jour** dans les deux, sinon l'adhérence et le bilan calorique auraient été faussés sur toute la fenêtre. |
| `real-life-repository` → `dashboard-repository` → `real-life-repository` | **Import circulaire** créé puis défait : `useMinimalWeekTargets` vit finalement dans `dashboard-repository` (où la chaîne nutrition existe déjà), et seule la requête SQL est exportée depuis `real-life-repository`. |
| Le cliquet `MAX_HOME_WIDGETS` d'INSIGHTS-02 a **cassé la CI** | Exactement son rôle. Arbitrage assumé **7 → 8**, motivé dans le commentaire de la constante, et 🟠 **à confirmer par Florian** (critère de recette 21). Le compte **visible** typique reste 5-6, dans la fourchette d'ADR-007. |
| `widget-destinations.ts` exige une destination pour **tout** widget d'accueil | `HOME_WIDGET_IDS_V1` est un **snapshot figé** (21 entrées, figées par un test) : y ajouter `real-life` aurait réécrit l'histoire. D'où la liste compagne `HOME_WIDGET_IDS_POST_V1` et l'union `HOME_WIDGET_IDS_WITH_DESTINATION`. |
| Le delta `cut` vaut **−400**, pas −350 | Le chiffre de la maquette, du plan et d'un test était faux. Corrigé partout — sinon la recette aurait vérifié un mauvais nombre. |
| Un test à moi était faux, pas le code | « activeToday=false pendant une période » ne mettait en pause que `TODAY` en attendant une série de 12 : les jours intermédiaires restaient des trous réels, donc la série tombait bien à 0. Corrigé côté test. |

### Les fichiers

| Lot | Fichiers |
|---|---|
| 0 | 2 migrations, `powersync-sync-rules.yaml`, `powersync/schema.ts`, `lib/data-export.ts`, `MIGRATIONS.md` |
| 1 | `packages/shared/src/real-life.ts` + `.test.ts` (**38 cas**), `index.ts` |
| 2 | `streak-joker.ts` + `.test.ts` (**11 cas neufs**) |
| 3 | `insights.ts`, `weekly-review.ts` + leurs `.test.ts` |
| 4 | `nutrition.ts` (`effectiveNutritionObjective`) + **7 appels câblés dans 5 fichiers**, dont 2 volontairement exclus |
| 5 | `real-life-repository.ts` + `__tests__/real-life-sql.test.ts` (**12 cas**) |
| 6 | `RealLifeSheet.tsx`, `RealLifeCard.tsx`, `dashboard-widgets.tsx`, `widgets.ts`, `widget-destinations.ts` |
| 7 | `app/review.tsx` (annotation) |
| 8 | `i18n/locales/fr.json`, `en.json` (**30 clés × 2**, parité vérifiée) |

⚠️ **Aucune API Expo n'a été utilisée** ([apps/mobile/AGENTS.md](../../apps/mobile/AGENTS.md) impose
d'en lire les docs avant) : la feuille et la carte n'emploient que `react-native` et les composants
locaux du dépôt, et le sélecteur de date a été évité exprès — patron `GoalFormSheet`, qui préserve la
promesse « recettable sur l'APK existant ».

## 0. Ce que ce plan garantit d'emblée

| Question | Réponse |
|---|---|
| Migration base ? | **Oui, deux** — la table `real_life_periods` + sa publication |
| Sync rule PowerSync ? | 🔴 **OUI** — table **neuve**. Redéploiement **manuel** sur le dashboard |
| Schéma PowerSync **local** ? | 🔴 **OUI** — `powersync/schema.ts`, sinon l'écriture échoue **en silence** |
| Export RGPD à compléter ? | 🔴 **OUI** — `data-export.ts`, sinon le test de complétude CONF-01 casse |
| Dépendance native neuve ? | ✅ **Non** → **recettable sur l'APK existant** |
| Réseau ? | Non — tout est local et pur |
| Nouveau calcul métier ? | Oui, un seul module : `real-life.ts` |
| Modules existants **modifiés** ? | 3 — `streak-joker.ts`, `insights.ts`, `weekly-review.ts` |

⚠️ **`nvm use 24`** avant toute commande de test (`.nvmrc` est passé à 24 pour `node:sqlite` ;
sinon la suite mobile échoue à l'import du harness sans dire pourquoi).

### Les deux risques réels de ce chantier

**1. `targetCalories` a sept appels dans cinq fichiers**, et **deux ne doivent PAS recevoir R4**.
Vérifié le 05/08/2026 :

| Fichier | Ligne(s) | R4 ? | Pourquoi |
|---|---|:---:|---|
| `data/repositories/dashboard-repository.ts` | 394, 1348 | ✅ oui | cible **du jour** |
| `widgets/home-widget-data.ts` | 243 | ✅ oui | cible **du jour** (widget launcher) |
| `app/(tabs)/nutrition.tsx` | 120 | ✅ oui | cible **du jour** |
| `app/meal-plan/index.tsx` | 112 | ✅ oui | cible **du jour** |
| `app/nutrition-profile.tsx` | 91, 92 | 🔴 **non** | **écran de réglage de l'objectif**, pas d'affichage du jour |

**La distinction est la règle** : un écran qui affiche **la cible du jour** applique R4 ; l'écran où
l'utilisateur **configure son objectif** ne l'applique pas. Afficher « maintien » sur l'écran où
quelqu'un est en train de régler un `cut` serait incompréhensible — il croirait que son réglage n'a pas
pris. `nutrition-profile.tsx:91` (`autoTarget`) et `:92` (`target`) montrent le calcul **de
l'objectif**, pas celui de la journée.

Si un seul des **cinq** appels concernés est oublié, **l'accueil affichera 2 250 kcal et l'onglet
Nutrition 1 850** (delta `cut` = −400) — un défaut bien plus visible que l'absence de la fonctionnalité. Un test doit
**prouver** que les cinq s'accordent, et un autre **figer** que `nutrition-profile` diverge
volontairement (sinon quelqu'un le « corrigera »).

**2. `decide()` doit être filtré, pas seulement `selectInsights`.** Cinq des six natures de décision
hebdo sont des reproches (spec R7). Ne toucher que les insights laisserait l'écran de bilan dire « ton
volume a chuté de 40 % » pendant que les cartes se taisent.

## 1. Ordre de build

Du pur vers l'impur, **sauf le lot 0** : la sync rule d'une table neuve exige une action **manuelle sur
le dashboard PowerSync**, donc à délai humain. RUN-F2c est aujourd'hui **bloquée avant recette** pour
avoir gardé cette étape pour la fin — on ne refait pas l'erreur.

```
Lot 0   Migration + sync rule + schéma local        supabase/mobile   à lancer EN PREMIER (délai humain)
Lot 1   Le moteur pur real-life.ts                  shared            TDD strict, 100 %
Lot 2   La série en pause                           shared + mobile   modifie streak-joker.ts
Lot 3   Les signaux muets                           shared            insights.ts + weekly-review.ts
Lot 4   Le déficit suspendu                         mobile            ⚠️ les 6 appelants
Lot 5   Le repository des périodes                  mobile            CRUD + export RGPD
Lot 6   L'UI : carte, déclaration, prolonger        mobile
Lot 7   L'annotation du bilan hebdo                 mobile
Lot 8   i18n FR + EN
Lot 9   Vérification, roadmap, archivage IDEAS
```

---

## Lot 0 — Migration, sync rule, schéma local

```bash
npm run db:new vie01_real_life_periods
npm run db:new vie01_real_life_periods_publication
npm run db:push:dry && npm run db:push && npm run db:types
```

**SQL** (patron `streak01_jokers`) :

```sql
create table public.real_life_periods (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  started_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index real_life_periods_user_start_idx
  on public.real_life_periods (user_id, started_on desc);

alter table public.real_life_periods enable row level security;

create policy real_life_periods_select on public.real_life_periods
  for select using (user_id = auth.uid());
create policy real_life_periods_insert on public.real_life_periods
  for insert with check (user_id = auth.uid());
create policy real_life_periods_update on public.real_life_periods
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
```

> ⚠️ **Aucune contrainte `check (ends_on >= started_on)`, aucune contrainte d'exclusion de plages.**
> C'est la décision R1 de la spec, et elle vient de REPAS-01 (D6) : **une violation de contrainte
> bloque la file d'upload PowerSync**. Deux appareils hors réseau peuvent déclarer des périodes qui se
> chevauchent ; la validation est **applicative**, la base absorbe. Un mode dont l'activation casse la
> synchro serait pire que le problème qu'il résout.
>
> Pas de politique `delete` : soft delete, comme partout.

**Puis, dans l'ordre, les quatre endroits qu'une table neuve impose :**

1. 🔴 **`docs/specs/technical/powersync-sync-rules.yaml`** — une ligne dans `user_data` :
   ```yaml
   # US VIE-01 : périodes « vie réelle ». L'historique est conservé — c'est lui qui permet
   # d'annoter les analyses passées (décision D2) ; une période échue n'a plus d'effet actif.
   - select * from real_life_periods    where user_id = bucket.user_id and deleted_at is null
   ```
   **puis coller le YAML dans le dashboard PowerSync et cliquer « Deploy ».** Étape **manuelle**, déjà
   oubliée deux fois (BIEN-01, puis RUN-F2c). **À faire dès le lot 0, pas en fin de chantier.**
2. 🔴 **`apps/mobile/src/powersync/schema.ts`** — déclarer la table. Ce qui n'y est pas n'existe pas
   dans la base SQLite embarquée : l'écriture échoue et l'erreur est avalée. Panne exacte de CYCLE-01
   (recette device du 31/07/2026, suivi **impossible à activer**, aucun message).
3. 🔴 **`apps/mobile/src/lib/data-export.ts`** — ajouter la table à l'export RGPD. Le test de
   complétude de CONF-01 le vérifie : c'est lui qui a trouvé `session_intervals` manquante le
   03/08/2026.
4. **Cocher** dans [MIGRATIONS.md](../../supabase/MIGRATIONS.md) (case + date).

**Test du lot** : une écriture puis une relecture via le repository, sur le harness SQLite — il génère
son DDL depuis `powersync/schema.ts`, donc il attrape l'oubli n° 2 **avant** le device.

---

## Lot 1 — Le moteur pur

**Fichier neuf** : `packages/shared/src/real-life.ts` (+ `real-life.test.ts`). TDD strict, **100 %
instructions / fonctions / lignes** (seuil du paquet), branches ≥ 97.

Contrat, dans l'esprit de `session-conflicts.ts` — **aucune lecture d'horloge**, `todayKey` par
paramètre :

```ts
/** Borne de rétro-déclaration (D5). Réutilise JOKER_MAX_AGE_DAYS : même question, même borne. */
export const REAL_LIFE_MAX_BACKDATE_DAYS = 7;

/** Durées proposées à l'activation (D3). */
export const REAL_LIFE_DURATIONS = [3, 7, 14] as const;

export type RealLifePeriod = { id: string; startedOn: string; endsOn: string };

/** Jours couverts par au moins une période — UNION, jamais d'erreur sur un chevauchement (R1). */
export function realLifeDayKeys(periods: ReadonlyArray<RealLifePeriod>): Set<string>;

/** La période qui couvre `todayKey`, ou null. La plus récemment commencée si plusieurs. */
export function activeRealLifePeriod(
  periods: ReadonlyArray<RealLifePeriod>, todayKey: string,
): RealLifePeriod | null;

/** Jours restants, bornes incluses. 0 le dernier jour, jamais négatif. */
export function realLifeDaysRemaining(period: RealLifePeriod, todayKey: string): number;

/** Nombre de jours d'une période tombant dans [weekStart, weekEnd] — l'annotation R7. */
export function realLifeDaysInWeek(
  periods: ReadonlyArray<RealLifePeriod>, weekStart: string, weekEnd: string,
): number;

/** Cible de semaine minimale (R3). Ne produit que les piliers actifs. */
export function minimalWeekTargets(input: {
  activePillars: { strength: boolean; running: boolean; nutrition: boolean };
  habitualStrengthSessions: number;
  proteinTargetG: number | null;
}): { strengthSessions: number | null; runs: number | null; proteinG: number | null };

/** null si valide, sinon le code d'erreur que l'UI traduit. */
export function validateRealLifePeriod(input: {
  startedOn: string; endsOn: string; todayKey: string;
}): 'ends_before_start' | 'backdated_too_far' | null;
```

**Cas de test qui portent les règles** (les autres sont mécaniques) :

| Test | Ce qu'il fige |
|---|---|
| deux périodes qui se chevauchent → union des jours, aucune exception | R1 |
| `minimalWeekTargets` avec 2 séances habituelles → **1**, pas 2 (plancher) | R3 |
| `minimalWeekTargets` avec 0 séance planifiée → **1** (plancher) | R3 |
| pilier inactif → `null` sur sa ligne, les autres inchangées | R3 + décision H |
| `realLifeDaysRemaining` le **dernier** jour → `0`, pas `-1` ni `1` | bornes incluses |
| `realLifeDaysInWeek` sur une période à cheval → décompte **par semaine** | R7 |
| rétro-déclaration à J-7 valide, J-8 → `backdated_too_far` | D5 |
| `endsOn < startedOn` → `ends_before_start` | R1 |
| aucune `Date` construite : les 8 fonctions passent avec `todayKey` figé | contrat |

---

## Lot 2 — La série en pause

**Modifie** `packages/shared/src/streak-joker.ts`. Deux signatures évoluent, de façon **additive** —
paramètre optionnel, défaut « ensemble vide » : aucun appelant existant ne change de comportement.

```ts
export function computeStreakWithJokers(
  activeDays: ReadonlySet<string>,
  jokerDays: ReadonlySet<string>,
  todayKey: string,
  pausedDays?: ReadonlySet<string>,   // ← neuf (R5)
): { current: number; activeToday: boolean };
```

**La règle du parcours arrière** (spec R5) : un jour `paused ∧ ¬active` est **transparent** — le
curseur avance, le compteur non. Un jour `paused ∧ active` compte normalement.

⚠️ **Le point délicat est la condition de sortie de boucle.** Aujourd'hui elle est
`while (counts(cursor))`. Un jour transparent n'est pas « compté » mais ne doit pas **arrêter** la
boucle : la condition devient `counts(cursor) || paused(cursor)`. Un test doit figer le cas qui
casserait sinon : **période au milieu de la série** (actif · période vide · actif) → la série
traverse.

`findRestorableGap` reçoit le même ensemble et **ignore les jours en période** : proposer de brûler le
joker du mois sur un jour de vacances déjà couvert le gaspillerait.

**Appelants à câbler** (vérifiés) : `dashboard-repository.ts:614` et `:617`,
`widgets/home-widget-data.ts:155`.

**Tests** : les 6 cas de la table R5, plus « période au milieu de la série », plus « aucun joker
proposé sur un jour en période ».

---

## Lot 3 — Les signaux muets

**`packages/shared/src/insights.ts`** — `selectInsights` reçoit `inRealLifePeriod: boolean` et écarte
un sous-ensemble **nommé et exporté** (pas une condition enfouie) :

```ts
/** Signaux qui se lisent comme un reproche quand la semaine est déclarée dégradée (R6). */
export const REAL_LIFE_MUTED_INSIGHTS = [
  'muscle_neglected', 'activity_level', 'deficit_volume',
] as const;
```

`tonnage_change` et `distance_change` sont un cas à part : **muets à la baisse seulement**. Une hausse
pendant la période est une vraie bonne nouvelle — le filtre lit le signe de `metrics`.

**`packages/shared/src/weekly-review.ts`** — `decide()` (via `buildWeeklyReview`) reçoit le même
booléen et saute `consistency_drop`, `volume_drop`, `muscle_imbalance`, `nutrition_drift`.

🔴 **`goal_behind` est CONSERVÉ**, et c'est un choix, pas un oubli : D6 dit qu'une période ne décale
pas une échéance, donc masquer qu'un objectif décroche serait un piège. Le test doit **figer** ce
comportement, avec le motif en commentaire — sinon quelqu'un le « corrigera » comme une incohérence.

Le repli naturel de la semaine devient `all_good`, ce qui est le bon message : la semaine allégée
s'est passée comme prévu.

**Appelants** : `insights-repository.ts:123`, et le chemin de `buildWeeklyReview`.

---

## Lot 4 — Le déficit suspendu ⚠️

**Une seule fonction neuve**, dans `packages/shared/src/nutrition.ts` :

```ts
/**
 * Objectif nutritionnel effectif du jour (R4). Pendant une période « vie réelle », le delta de
 * l'objectif est neutralisé — dans les DEUX sens : un `cut` ne creuse plus, et un `bulk` ne charge
 * plus (un surplus pris sans s'entraîner n'est pas une prise de masse).
 */
export function effectiveNutritionObjective(
  objective: NutritionObjective,
  inRealLifePeriod: boolean,
): NutritionObjective {
  return inRealLifePeriod ? 'maintain' : objective;
}
```

**`targetCalories` n'est pas modifiée.** Le `manualOverride` continue de primer, sans une ligne de
plus — c'est déjà son contrat (spec nutrition §2.2 / 4.3).

Puis **les cinq appels de la cible du jour** — et **pas** les deux de `nutrition-profile.tsx`
(voir §0 : la distinction cible-du-jour / réglage-de-l'objectif est une règle, pas un oubli).

Deux tests, et le second est aussi important que le premier :
1. **cohérence** — pour un même profil en période, la cible calculée par le chemin dashboard et par le
   chemin nutrition sont **égales**. C'est le seul test qui attrape un appel oublié ;
2. **divergence volontaire** — `nutrition-profile` continue d'afficher la cible de l'objectif réel
   pendant une période, avec le motif en commentaire.

---

## Lot 5 — Le repository des périodes

`apps/mobile/src/data/repositories/real-life-repository.ts` :

| Fonction | Notes |
|---|---|
| `listRealLifePeriods()` | Toutes les périodes non supprimées. L'historique sert à l'annotation (D2). |
| `startRealLifePeriod({ durationDays, startedOn })` | UUID **client**, `validateRealLifePeriod` avant écriture. |
| `extendRealLifePeriod(id, endsOn)` | Met à jour `ends_on` + `updated_at`. |
| `stopRealLifePeriod(id, todayKey)` | Pose `ends_on = todayKey`. **Pas** un soft delete : la période a existé, elle doit continuer d'annoter. |

⚠️ **Ne jamais `void` l'écriture.** C'est ce qui a rendu la panne de CYCLE-01 invisible : l'erreur
était avalée et l'interrupteur restait éteint sans message. L'appelant doit pouvoir afficher l'échec.

Un `useRealLifePeriods()` (Zustand + requête watchée) expose `activePeriod`, `pausedDays` et
`inRealLifePeriod` aux lots 2 → 4.

---

## Lot 6 — L'UI

- **Point d'entrée** : une ligne sur l'accueil, discrète, hors période (`realLife.cta`).
- **Feuille de déclaration** : les 3 durées (D3), une date de début modifiable **bornée à J-7** (D5),
  un bouton. Un tap suffit pour le cas nominal.
- **Carte de période active** : date de fin, jours restants, l'objectif de semaine minimal (R3), et
  les deux actions « Prolonger » / « Reprendre le plan normal ».
- **Aucune notification** (R8). Rien à câbler côté `notifications.ts`.
- Accessibilité : libellés TalkBack sur les 3 chips de durée et les 2 actions (CONF-07 vient de solder
  les non-conformités — ne pas en réintroduire).

⚠️ Le widget d'accueil doit **s'auto-masquer** hors période : patron `isWidgetActive`
(`app/(tabs)/index.tsx`), et INSIGHTS-02 vient de ramener le Tier 0 de 21 à 7 entrées — **ne pas
regonfler l'accueil**. Une ligne conditionnelle, pas une carte permanente.

---

## Lot 7 — L'annotation du bilan hebdo

`realLifeDaysInWeek` (lot 1) alimente la mention sur l'écran de bilan et sur la carte. Une période à
cheval annote les deux semaines, chacune avec son décompte.

⚠️ **Réutiliser `decision-subject.ts`** pour tout libellé de groupe musculaire. C'est la leçon du
05/08/2026 : la même clé brute (`back` au lieu de « Dos ») s'affichait sur trois surfaces, et c'est
le savoir dupliqué qui avait laissé le défaut vivre.

---

## Lot 8 — i18n

Les 14 clés `realLife.*` du §6 de la spec, **FR et EN**, avec pluriels i18next (`_one` / `_other`) sur
`active.remaining`, `target.strength` et `review.annotation`.

Relecture de ton (R9) : aucun « seulement », « manqué », « raté », aucun compteur d'écart négatif.

---

## Lot 9 — Vérification et clôture

```bash
nvm use 24
npm run typecheck && npm run lint && npm run test
```

⚠️ **Lire le code de sortie sans pipe** : un `| tail` en aval renvoie 0 même si un test échoue.

Puis :
- **roadmap** : ligne **1.28** (numéro vérifié libre le 05/08/2026) dans « Hors périmètre de
  cadrage », statut selon le réel ;
- **IDEAS.md** : passer la fiche du 25/07/2026 en ✅ **promue**, avec la décision, et la descendre en
  Archives — patron de COLLIS-01 ;
- **RECETTES.md** : les 20 critères du §10 ;
- `node scripts/etat.mjs`.

## 2. Ce que ce plan ne fait pas

- Il ne réécrit **aucun** programme ni séance (D1).
- Il n'ajoute **aucune** donnée de santé : la période ne porte pas de motif (spec §9) — un champ
  « malade » rouvrirait la déclaration Google Play « Health apps », déjà passée à 6 types par
  CYCLE-01 et sur le chemin critique du lancement.
- Il ne retire **rien** des moyennes, tendances et ACWR (D2).
- Il ne touche pas aux objectifs à échéance (D6).
- Il ne livre pas la variante « voyage » : elle demande du contenu de coach, comme CONTENU-01.
