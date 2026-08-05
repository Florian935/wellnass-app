# Plan d'implémentation — COLLIS-01

> Spec : [collis01-detecteur-collisions.md](../specs/functional/us/collis01-detecteur-collisions.md)
> Branche : `feature/collis01-detecteur-collisions` · Créée depuis `origin/dev` le 05/08/2026
> Design brainstormé et validé le 05/08/2026 — les 6 décisions du §3 sont acquises.

## 0. Ce que ce plan garantit d'emblée

| Question | Réponse |
|---|---|
| Migration base ? | **Oui, une** — la colonne du réglage opt-in sur `user_settings` |
| Sync rule PowerSync ? | ✅ **Non** — `user_settings` est lue en `select *` ([sync-rules:20](../specs/technical/powersync-sync-rules.yaml)) |
| Schéma PowerSync **local** ? | 🔴 **OUI** — `powersync/schema.ts`, sinon l'écriture échoue en silence |
| Dépendance native neuve ? | Non → recettable sur l'APK existant |
| Réseau ? | Non — tout est local |
| Écriture métier neuve ? | Non — `reschedulePlannedSession` existe (MUSC-F9) |

⚠️ **`nvm use 24`** avant toute commande de test.
⚠️ **Le chantier touche `/planning`**, où MUSC-F9 est en recette : risque de **conflit de merge**,
pas de régression fonctionnelle.

## 1. Ordre de build

Du pur vers l'impur. **Le moteur d'abord** : il ne dépend de rien, se teste seul, et porte toute la
règle. La justification initiale du lot 0 en tête — « la migration a un délai externe » — **est
tombée avec le fantôme de la sync rule** : il n'y a plus de délai, le lot 0 se réduit à trois lignes
mécaniques.

```
Lot 1   Le moteur pur                         shared       TDD strict, 100 %
Lot 0   Migration + schéma local              supabase     3 lignes, plus aucun délai externe
Lot 2   Enrichissement du planning            mobile       la seule requête neuve
Lot 3   Le bandeau + l'échange                mobile
Lot 4   Le réglage opt-in                     mobile
Lot 5   i18n FR + EN
Lot 6   Vérification + archivage IDEAS
```

---

## Lot 0 — Migration et schéma local

```bash
npm run db:new collis01_session_conflicts_opt_in
# → alter table public.user_settings add column session_conflicts_enabled boolean not null default false;
npm run db:push:dry && npm run db:push && npm run db:types
```

Puis **cocher** dans [MIGRATIONS.md](../../supabase/MIGRATIONS.md).

> ✅ **Aucune sync rule à redéployer.** `user_settings` est déjà publiée et lue en `select *` :
> y ajouter une colonne ne change pas une ligne du YAML. La migration `20260804210516` — la veille,
> sur cette même table — le dit déjà. *(La première rédaction de ce plan affirmait le contraire et
> en faisait son risque n° 1 : c'était faux.)*
>
> 🔴 **L'étape réellement critique est ailleurs : `apps/mobile/src/powersync/schema.ts`.** Toute
> colonne absente du schéma **local** n'existe pas dans la base SQLite embarquée — l'écriture échoue
> et `void updateSettings()` **avale l'erreur** : l'interrupteur reste éteint sans message. C'est la
> panne exacte de CYCLE-01 (recette device du 31/07/2026). Le harness SQLite des tests génère son DDL
> depuis ce même schéma, donc un test d'écriture du réglage attrape le défaut avant le device.
>
> Et **quatre autres endroits** que la première rédaction avait manqués, en rejouant le parcours réel
> de `cycleTrackingEnabled` : le champ dans `userSettingsRowSchema`
> (`packages/shared/src/settings.ts`, avec `.default(false)`), `database.types.ts` régénéré, et
> dans `settings-repository.ts` les quatre points d'édition — type `SettingsDbRow`, `decode*`,
> `rowToSettings`, `inputToColumns`.

**Défaut `false`** : opt-in strict (D6). Un `default true` ouvrirait la fonctionnalité à tout le
monde à la première synchro.

---

## Lot 1 — Le moteur pur

**Fichier neuf** : `packages/shared/src/session-conflicts.ts` + son test.

```ts
/** Le seul nombre inventé du dispositif — exporté pour être calibrable, pas enfoui. */
export const LEG_SETS_CONFLICT_THRESHOLD = 8;
/** Types de course « de qualité » : les seuls en conflit (endurance/récup sont neutres). */
export const CONFLICTING_RUN_TYPES = ['sortie_longue', 'fractionne'] as const;

/** Une séance de la semaine, réduite à ce dont la règle a besoin. */
export type ScheduledSession = {
  id: string;
  dayKey: string;
  pillar: Pillar;
  status: 'planned' | 'done' | 'skipped';
  /** Course seulement. */
  runType: ProgramSessionType | null;
  /** Muscu seulement : séries par groupe, déjà agrégées par le repository. */
  setsByMuscle: Partial<Record<MuscleGroup, number>> | null;
};

export type SessionConflict = {
  /** La course, c'est elle qu'on propose de déplacer. */
  runSessionId: string;
  runDayKey: string;
  runType: ProgramSessionType;
  /** La séance de muscu, qui ne bouge jamais. */
  strengthSessionId: string;
  strengthDayKey: string;
  legSets: number;
  /** Jour de repli, ou `null` si aucun ne convient (spec §4). */
  suggestedDayKey: string | null;
};

export function isHeavyLegSession(setsByMuscle): boolean;
export function findSessionConflicts(input: {
  sessions: ReadonlyArray<ScheduledSession>;
  weekStartKey: string;
  weekEndKey: string;
  /** 🔴 Requis : un repli antérieur à ce jour rendrait la course « manquée » à l'instant même. */
  todayKey: string;
}): SessionConflict[];
```

### Tests à écrire d'abord

| # | Cas | Attendu |
|---|---|---|
| 1 | Semaine vide | `[]` |
| 2 | Jambes majoritaires, 12 séries, sortie longue le lendemain | 1 conflit |
| 3 | Même chose mais 5 séries | `[]` — sous le seuil |
| 4 | 12 séries de jambes, mais le dos domine | `[]` — part non dominante |
| 5 | Seuil à 8 pile | **conflit** (borne inclusive, à figer) |
| 6 | Course `endurance` le lendemain | `[]` |
| 7 | Course `recuperation` le lendemain | `[]` |
| 8 | Course **le surlendemain** | `[]` — la règle est « le lendemain » |
| 9 | Course `status: 'done'` | `[]` — on ne commente pas le passé |
| 10 | Séance muscu sans exercices (`setsByMuscle` vide) | `[]` |
| 11 | Repli : jour libre après | `suggestedDayKey` = ce jour |
| 12 | Repli : rien après, un jour libre avant | le jour d'avant |
| 13 | Repli : semaine pleine | `suggestedDayKey: null` |
| 14 | Repli : le seul jour libre **recrée** le conflit | écarté → jour suivant, ou `null` |
| 15 | Conflit le dernier jour de la semaine ISO | cherche **avant** seulement |
| 16 | Deux conflits distincts la même semaine | 2 entrées |
| 17 | Deux séances muscu lourdes avant la même course | **1** conflit, la plus lourde (R5) |
| 18 | Repli qui tomberait **avant `todayKey`** | écarté — sinon la course naît « manquée » |
| 19 | Séance de muscu `skipped` ou `done` | `[]` — une séance sautée n'a fatigué personne |
| 20 | Deux groupes à égalité de séries | `[]` — aucun dominant |
| 21 | Toutes les `target_sets` du muscle à NULL | `[]` — non chiffré ne veut pas dire lourd |

> Le test « même entrée jouée 2× → sortie identique » de la première rédaction a été **retiré** :
> il vérifiait que JavaScript est déterministe sur une fonction pure sans horloge ni aléa. Les
> quatre cas ci-dessus le remplacent, et eux couvrent de vrais modes d'échec.

⚠️ **Cliquet** : `packages/shared` est à 100 % instructions/fonctions/lignes. TDD strict.

**Réutiliser plutôt que réécrire** : `startOfWeek` (`date.ts`, déjà appelé par l'écran de planning)
et surtout **`weekDayKeys`** (`meal-plan.ts`) rendent déjà les 7 clés d'une semaine — le balayage du
repli n'a rien à réinventer. `lastClosedWeek` (`weekly-review.ts`) n'est en revanche **pas**
pertinent : il vise la semaine **close**, pas la semaine courante.

---

## Lot 2 — Enrichir le planning

**Fichier modifié** : `apps/mobile/src/data/repositories/planned-session-repository.ts`

Une requête neuve, **et une seule** : les séries par groupe musculaire des séances de muscu de la
semaine affichée.

```sql
SELECT ps.id AS planned_session_id, e.muscle_primary AS muscle, SUM(ep.target_sets) AS sets
FROM planned_sessions ps
JOIN exercise_plans ep ON ep.session_id = ps.session_id AND ep.deleted_at IS NULL
JOIN exercises e       ON e.id = ep.exercise_id   -- PAS de filtre deleted_at : voir ci-dessous
WHERE ps.owner_id = ? AND ps.deleted_at IS NULL AND ps.scheduled_date BETWEEN ? AND ?
GROUP BY ps.id, e.muscle_primary
```

**Garde au niveau du rendu**, pas de la requête. La première rédaction exigeait que la requête ne
soit « pas montée » quand le réglage est éteint — c'était cher pour rien : `useQuery` s'exécute même
avec un paramètre vidé, il aurait fallu une sentinelle (`AND 1 = ?` à 0), le tout pour éviter un
`GROUP BY` sur une vingtaine de lignes dans une base SQLite embarquée. Ni observable en recette, ni
mesurable. On garde donc le patron déjà en place pour le widget cycle : la donnée se charge, le
rendu se garde.

⚠️ **`target_sets` est nullable, et le premier raisonnement s'annulait lui-même** : « `SUM` ignore
les NULL » donne exactement le même total que les compter à 0 (`SUM(3, NULL, 4) = 7`). La question
reste donc entière et **doit être tranchée** : un exercice planifié sans nombre de séries **compte
pour 0**, c'est-à-dire qu'il ne rapproche pas du seuil. Deux conséquences à figer par test :
si **tous** les plans d'un muscle sont NULL, `SUM` renvoie **NULL** et non 0 — le type doit être
`sets: number | null` côté TS ; et une séance jambes entièrement non chiffrée ne déclenche jamais.

⚠️ `ps.owner_id = ?` n'est pas optionnel : les **six** autres requêtes du fichier le portent, et le
harness SQLite sème plusieurs utilisateurs. Sans lui le test passe au vert en local **et** la
convention est cassée.

⚠️ Le `JOIN exercises … AND e.deleted_at IS NULL` **exclurait les exercices archivés**, alors qu'ils
sont volontairement répliqués en local. Un programme qui en contient sous-compterait ses jambes :
il faut donc **ne pas** filtrer `deleted_at` ici (l'utilisateur fera la séance quand même).

Test SQL avec le harness SQLite (`*-sql.test.ts`), convention du dépôt.

---

## Lot 3 — Bandeau et échange

**Fichiers** : `apps/mobile/src/components/planning/SessionConflictBanner.tsx` (neuf),
`apps/mobile/src/app/planning/index.tsx` (modifié).

Bandeau sur la carte du jour de la **course**. Ton « warn », patron de `TrainingLoadAlertCard`.
Bouton « Déplacer au {{jour}} » → `reschedulePlannedSession`, déjà éprouvée par MUSC-F9.
Sans repli : bandeau sans bouton, avec sa raison.

Accessibilité dès l'écriture : bandeau `accessible` d'un bloc, bouton atteignable séparément,
hauteur libre (police 1,5×), contrastes AA en clair et sombre.

---

## Lot 4 — Le réglage

Section « Analyses croisées » dans `settings.tsx`, patron du réglage de cycle (le seul autre opt-in
strict). Écriture via `settings-repository`.

---

## Lot 5 — i18n

Clés du §9 de la spec, FR + EN symétriques.

⚠️ **Pas `formatDayFull`** : il rend `JJ/MM/AAAA`, identique en FR et en EN, et ce n'est pas un nom
de jour — or la clé dit « Déplacer au **{{day}}** ». Le mécanisme existe déjà :
`common.weekday.mon…sun`, déjà consommé par `app/planning/index.tsx`. Ses valeurs sont **abrégées**
(« Lun », « Mar ») : soit on l'accepte, soit on ajoute des clés en toutes lettres — **arbitrage à
poser, pas à découvrir en codant**.

---

## Lot 6 — Vérification

```bash
nvm use 24
npm run typecheck && npm run lint && npm run test:coverage
```

Codes de sortie **sans pipe**, et **3 workspaces relancés séparément** (le run agrégé n'a pas
toujours restitué les trois — constaté le 05/08/2026).

Puis : archiver l'idée dans [IDEAS.md](../../IDEAS.md) avec la décision, CHANGELOG, front-matter,
roadmap 3.57, RECETTES.md (16 critères, **dont la sync rule**), ETAT.

## 2. Fichiers touchés

**Neufs** : `packages/shared/src/session-conflicts.ts` (+ test) ·
`apps/mobile/src/components/planning/SessionConflictBanner.tsx` ·
la migration `supabase/migrations/*_collis01_*.sql`

**Modifiés** : `packages/shared/src/index.ts` · `planned-session-repository.ts` (+ test SQL) ·
`app/planning/index.tsx` · `settings.tsx` · `settings-repository.ts` ·
`powersync/schema.ts` · `i18n/locales/*.json` · `supabase/MIGRATIONS.md` · `IDEAS.md`

## 3. Risques

| Risque | Parade |
|---|---|
| 🔴 **Colonne oubliée dans `powersync/schema.ts`** → l'interrupteur reste éteint **en silence** | Lot 0 explicite, test d'écriture sur le harness, critère de recette 15 (réinstallation) |
| Le seuil de 8 séries est faux | Constante exportée et nommée ; critère de recette 16 le fait juger par un pratiquant |
| Le repli déplace le problème | Test 14 : un jour qui recrée le conflit est écarté |
| Repli proposé dans le passé | `todayKey` requis par la signature + test 18 |
| `target_sets` nul sous-estime une séance | Figé par un test du lot 2 |
| Conflit de merge sur `/planning` (MUSC-F9 en recette) | Caler le moment avec Florian ; aucune régression fonctionnelle attendue |
| Faux positifs → l'utilisateur désactive tout | Une seule règle, deux conditions cumulatives, opt-in strict |
