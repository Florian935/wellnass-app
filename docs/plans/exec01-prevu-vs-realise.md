# Plan d'implémentation — EXEC-01

> Spec : [exec01-prevu-vs-realise.md](../specs/functional/us/exec01-prevu-vs-realise.md)
> Branche : `feature/exec01-prevu-vs-realise` · Créée depuis `origin/dev` le 07/08/2026
> Lot de **4 analyses** du catalogue (MUSC-33, MUSC-26, MUSC-13, MUSC-21) ; MUSC-14 écartée (spec §1.1).

## 0. Ce que ce plan garantit d'emblée

| Question | Réponse |
|---|---|
| Migration base ? | ✅ **Non** — toutes les colonnes existent (spec §5, vérifiées le 07/08/2026) |
| Sync rule PowerSync ? | ✅ **Non** |
| Schéma PowerSync local ? | ✅ **Non** — aucun champ nouveau |
| `db:types` à régénérer ? | ✅ **Non** |
| Dépendance native neuve ? | ✅ **Non** → **recettable sur l'APK existant** |
| Réseau ? | ✅ **Non** — lecture locale seule |
| Écriture ? | ✅ **Aucune** — le lot est en **lecture seule** |
| Moteur de sélection d'insights touché ? | ✅ **Non** (spec §3) — `MAX_INSIGHTS`, `INSIGHT_ORDER`, `selectInsights` intacts |

⚠️ **`nvm use 24`** avant toute commande de test.
⚠️ **`packages/shared` est à 100 %** (instructions / fonctions / lignes) : TDD strict, pas de branche
non exercée.

## 1. Ordre de build

Du pur vers l'impur, et **une analyse à la fois de bout en bout**. Les 4 sont indépendantes : rien
n'oblige à écrire les 4 moteurs avant la première requête, et tout pousse à valider la chaîne
complète sur la plus risquée d'abord.

```
Lot 1   MUSC-33 — prescrit vs réalisé      shared + mobile   LA PLUS RISQUÉE : on commence par elle
Lot 2   MUSC-26 — durée de séance          shared + mobile
Lot 3   MUSC-13 — types de série           shared + mobile
Lot 4   MUSC-21 — exercices délaissés      shared + mobile
Lot 5   La section d'écran                 mobile            assemble les 4
Lot 6   i18n FR + EN
Lot 7   Vérification + suivi
```

**Pourquoi MUSC-33 en premier alors qu'elle est la plus dure.** C'est la seule des quatre qui porte
des règles non triviales (R4 séances libres, R5 séries non validées, R6 parsing tolérant, R7 source
de la prescription). Si une de ces règles s'avère infaisable, il vaut mieux le découvrir avant
d'avoir écrit trois analyses et une section d'écran autour d'elle. Les trois autres sont des
agrégations directes : leur risque est proche de zéro.

---

## Lot 1 — MUSC-33, prescrit vs réalisé

**Fichier neuf** : `packages/shared/src/execution-compliance.ts` + son test.

Deux taux, **deux dénominateurs distincts et tous deux rendus** (spec R6) : le parsing des reps
échoue plus souvent que celui de la charge, et masquer cet écart de base rendrait les deux chiffres
incomparables.

```ts
/** Seuil de données sous lequel l'analyse se tait — une moyenne sur n=1 n'est pas une tendance. */
export const MIN_SESSIONS_FOR_COMPLIANCE = 3;

export type CompliancePlannedSet = {
  /** 🔴 La prescription au moment de la séance (R7), PAS `exercise_plans.target_weight_kg`. */
  plannedWeightKg: number | null;
  weightKg: number | null;
  reps: number | null;
  /** Texte libre (R6) : « 10 », « 8-12 », « AMRAP », vide… */
  targetReps: string | null;
  done: boolean;
};

export type ComplianceInput = {
  /** Une entrée par séance **de programme** — les séances libres sont exclues en amont (R4). */
  sessions: ReadonlyArray<{ sets: ReadonlyArray<CompliancePlannedSet> }>;
};

export type ComplianceResult = {
  /** Ratio réalisé/prescrit de la charge. `null` = non calculable. */
  loadRatio: number | null;
  loadSetCount: number;
  repsRatio: number | null;
  repsSetCount: number;
  sessionCount: number;
} | null;

export function computeExecutionCompliance(input: ComplianceInput): ComplianceResult;

/** Parse une cible de reps en fourchette. `null` = inexploitable → série exclue, en silence (R6). */
export function parseTargetReps(raw: string | null): { min: number; max: number } | null;
```

### Tests à écrire d'abord

| # | Cas | Attendu |
|---|---|---|
| 1 | Aucune séance | `null` |
| 2 | 2 séances (< seuil) | `null` — R3 |
| 3 | 3 séances, charges tenues | `loadRatio` = 1, `sessionCount` = 3 |
| 4 | Charges **dépassées** | ratio **> 1**, jamais plafonné (spec §4) |
| 5 | Séries `done: false` | **ignorées** — R5 |
| 6 | Toutes les séries `done: false` | `null`, pas 0 |
| 7 | `plannedWeightKg` nul partout | `loadRatio: null` **mais `repsRatio` calculé** — R6 |
| 8 | `targetReps` = « AMRAP » partout | `repsRatio: null` **mais `loadRatio` calculé** — R6 |
| 9 | `targetReps` = « 8-12 », réalisé 10 | **conforme** (ratio 1 sur cette série) |
| 10 | `targetReps` = « 8-12 », réalisé 6 | **écart** compté |
| 11 | `targetReps` = « 8 à 12 » / « 3x10 » / « max » / « » | inexploitables → exclues **sans erreur** |
| 12 | `targetReps` = « 10 », réalisé 10 | conforme |
| 13 | Un seul type exploitable → les deux `setCount` diffèrent | les deux sont rendus (R6) |
| 14 | `weightKg` ou `reps` nuls sur une série faite | série exclue du taux concerné, pas comptée en écart |
| 15 | Poids du corps (`weightKg` = 0, `plannedWeightKg` = 0) | pas de division par zéro → série exclue |

⚠️ **Le cas 15 est le piège arithmétique du lot** : un ratio `0/0` donne `NaN`, et un `NaN` affiché
tel quel (ou pire, arrondi à 0) donne une carte mensongère. Précédent réel dans ce dépôt —
`bestSegmentTimeFromSamples` a écrit un record « NaN seconde » en base (corrigé le 04/08/2026).
`hasUsableMetrics` (insights.ts) existe pour cette raison ; le même réflexe s'applique ici.

### La requête

**Fichier modifié** : `apps/mobile/src/data/repositories/records-repository.ts` (c'est lui qui sert
déjà l'écran de progression, avec `planned-session-repository` pour la régularité).

```sql
SELECT w.id AS workout_id, ws.planned_weight_kg, ws.weight_kg, ws.reps, ws.done,
       ep.target_reps
FROM workouts w
JOIN workout_sets ws ON ws.workout_id = w.id AND ws.deleted_at IS NULL
LEFT JOIN exercise_plans ep ON ep.session_id = w.session_id
                           AND ep.exercise_id = ws.exercise_id
                           AND ep.deleted_at IS NULL
WHERE w.user_id = ? AND w.deleted_at IS NULL
  AND w.session_id IS NOT NULL          -- R4 : séances de programme uniquement
  AND w.started_at >= ?                 -- fenêtre d'analyse
```

⚠️ **`LEFT JOIN` et non `JOIN`** sur `exercise_plans` : un exercice ajouté en cours de séance n'a
aucun plan. Un `JOIN` strict le ferait disparaître du taux de **charge** aussi, alors qu'il porte un
`planned_weight_kg` parfaitement exploitable.

⚠️ **`w.user_id = ?`** n'est pas optionnel : le harness SQLite sème plusieurs utilisateurs, et
toutes les autres requêtes du fichier le portent.

⚠️ La jointure sur `(session_id, exercise_id)` peut rendre **plusieurs plans** pour un même exercice
présent deux fois dans une séance. À figer par un test SQL : soit on déduplique, soit on accepte —
mais on le décide, on ne le découvre pas.

---

## Lot 2 — MUSC-26, durée de séance

**Fichier neuf** : `packages/shared/src/session-duration.ts` + test.

**Médiane, pas moyenne** (spec R9) : une séance de 3 h oubliée ouverte tirerait la moyenne et
rendrait toutes les autres « courtes ».

```ts
export const MIN_SESSIONS_FOR_DURATION = 5;
/** Bornes de plausibilité — au-delà, la séance a été oubliée ouverte (R10). */
export const MIN_PLAUSIBLE_SESSION_SECONDS = 5 * 60;
export const MAX_PLAUSIBLE_SESSION_SECONDS = 4 * 60 * 60;
```

Rend : médiane, tendance (comparaison de deux demi-fenêtres), nombre de séances **écartées** — ce
dernier est **affiché** dès qu'il est non nul (R10), sinon l'utilisateur voit une médiane calculée
sur moins de séances qu'il n'en a faites, sans explication.

| # | Cas | Attendu |
|---|---|---|
| 1 | < 5 séances | `null` |
| 2 | Durées 30/40/50/60/70 min | médiane 50 min |
| 3 | Une séance de 6 h | **écartée**, `excludedCount` = 1 |
| 4 | Une séance de 2 min | écartée |
| 5 | `duration_seconds` nul | écartée |
| 6 | Toutes écartées | `null`, pas une médiane de rien |
| 7 | Nombre pair de séances | médiane = moyenne des deux centrales |
| 8 | Demi-fenêtre récente plus longue | tendance à la hausse |

---

## Lot 3 — MUSC-13, répartition par type de série

**Fichier neuf** : `packages/shared/src/set-type-mix.ts` + test.

L'agrégation la plus simple des quatre : compte par `set_type` sur les séries `done`, rendu en parts.

| # | Cas | Attendu |
|---|---|---|
| 1 | Aucune série | `null` |
| 2 | 3 normal / 1 échauffement | parts 75 / 25 |
| 3 | Les parts **somment à 100** malgré les arrondis | figé par test — trois tiers ne font pas 99 |
| 4 | Séries `done: false` | exclues (R5) |
| 5 | `set_type` inconnu (valeur future) | regroupé, jamais perdu ni planté |

⚠️ Le cas 3 est le seul vrai piège : arrondir trois parts égales à l'entier donne 33+33+33 = 99. La
carte doit afficher 100.

---

## Lot 4 — MUSC-21, exercices délaissés

**Fichier neuf** : `packages/shared/src/neglected-exercises.ts` + test.

```ts
/** Semaines sans pratique au-delà desquelles un favori est « délaissé ». À calibrer en recette. */
export const NEGLECTED_AFTER_WEEKS = 4;
```

⚠️ **Ne pas redire `MuscleBalanceSection`** (spec §1.2) : on raisonne **exercice**, jamais groupe
musculaire. La moitié « groupes non travaillés » de MUSC-21 est déjà livrée.

| # | Cas | Attendu |
|---|---|---|
| 1 | Aucun favori | `[]` — l'analyse se tait (R8) |
| 2 | Favori pratiqué hier | pas délaissé |
| 3 | Favori pratiqué il y a 6 semaines | délaissé, avec le nombre de semaines |
| 4 | Favori **créé** il y a 2 jours, jamais pratiqué | **pas** délaissé (spec §4) |
| 5 | Favori créé il y a 3 mois, jamais pratiqué | délaissé, compté depuis la création |
| 6 | Favori d'un exercice archivé | **exclu** |
| 7 | Pratiqué mais toutes séries `done: false` | délaissé — une série non validée n'est pas une pratique |
| 8 | Tri | du plus délaissé au moins délaissé |

Requête : `exercise_favorites` (non supprimés) ⟕ dernière série `done` par exercice.

---

## Lot 5 — La section d'écran

**Fichier modifié** : `apps/mobile/src/app/progress/index.tsx` (931 lignes, 7 sections).

Une `ExecutionSection` de plus, **au patron des existantes** (`WeeklyVolumeSection`,
`RegularitySection`… sont des fonctions locales du même fichier — on suit, on n'invente pas une
architecture pour une section).

Chaque analyse qui rend `null` **n'affiche rien** ; si les quatre se taisent, la section entière
disparaît (R3). Accessibilité dès l'écriture : chaque chiffre annoncé avec sa base, hauteurs libres
(police 1,5×), contrastes AA en clair et sombre.

🔴 **Ne rien toucher à `insights.ts` ni à `insights-repository.ts`** (spec §3). Un test le vérifie au
lot 7.

---

## Lot 6 — i18n

Clés du §6 de la spec, FR + EN symétriques. Nombres **formatés avant** `t()`.
Réutiliser les libellés de `set_type` existants plutôt que d'en créer un second jeu.

---

## Lot 7 — Vérification

```bash
nvm use 24
npm run typecheck && npm run lint && npm run test:coverage
```

Codes de sortie **sans pipe** (`| tail` renvoie 0 même sur échec), et **3 workspaces relancés
séparément** — le run agrégé a déjà renvoyé un faux 255 (07/08/2026, COLLIS-01).

Puis : catalogue (MUSC-33/26/13 → ✅, MUSC-21 → ✅ avec la note §1.2, **MUSC-14 reste ⏳** avec son
motif), CHANGELOG, front-matter, roadmap **3.58**, RECETTES.md (22 critères), ETAT.

## 2. Fichiers touchés

**Neufs** : `execution-compliance.ts` · `session-duration.ts` · `set-type-mix.ts` ·
`neglected-exercises.ts` (+ 4 tests) · 1 test SQL de repository

**Modifiés** : `packages/shared/src/index.ts` · `records-repository.ts` (+ test SQL) ·
`app/progress/index.tsx` · `i18n/locales/{fr,en}.json` · catalogue · roadmap

**Non touchés, et c'est un résultat** : `insights.ts`, `insights-repository.ts`, `powersync/schema.ts`,
`supabase/migrations/`, ADR-007.

## 3. Risques

| Risque | Parade |
|---|---|
| 🔴 `NaN` / division par zéro sur un ratio (poids du corps, prescription nulle) | Test 15 du lot 1 ; réflexe `hasUsableMetrics` déjà en place dans le dépôt |
| 🔴 Parsing de `target_reps` trop zélé → écarts fantômes sur les bons programmes | R6 : échec **silencieux**, tests 8/11 ; jamais compter un inexploitable comme un écart |
| Comparer à une prescription **modifiée depuis** | R7 : `planned_weight_kg` de la série, jamais le plan ; test dédié + critère de recette 9 |
| Séances libres au dénominateur → taux effondré | R4 : `w.session_id IS NOT NULL` dans la requête ; critère de recette 4 |
| `LEFT JOIN` rendant plusieurs plans pour un exercice répété | Décidé et figé par test SQL, pas découvert en recette |
| Parts qui somment à 99 % | Test 3 du lot 3 |
| Doublon avec `MuscleBalanceSection` | Niveau **exercice** uniquement (§1.2) ; critère de recette 16 |
| Section muette perçue comme un bug | R3 assumée : rien plutôt qu'un zéro trompeur — mais le critère 1 la recette explicitement |
| Régression de l'écran Insights | Rien n'y touche ; critère de recette 22 |
| Conflit de merge sur `progress/index.tsx` | Vérifier que Damien n'y est pas — il est sur `chore/socle-tests-unitaires`, dont le §8 vise les **écrans à état** (`workout.tsx`, `run/active.tsx`, `running-history/`). `progress/` n'y est pas, mais **le recouper avant de commencer le lot 5** |
