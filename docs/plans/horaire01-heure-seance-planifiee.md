# Plan — HORAIRE-01 : heure d'une séance planifiée et rappel de convocation

Spec : [horaire01-heure-seance-planifiee.md](../specs/functional/us/horaire01-heure-seance-planifiee.md).
Roadmap **2.4** (🟡 → ✅ visé). Branche `feature/horaire01-heure-seance`.

## Ordre de build

Six étapes, dans cet ordre, **parce que chacune est vérifiable seule** et que la première est celle
qui peut faire perdre des données si elle est bâclée.

---

### Étape 1 — Migration + sync rules (⚠️ l'étape à risque)

**Fichiers**
- `supabase/migrations/<horodaté>_planned_sessions_scheduled_time.sql` (nouveau)
- `docs/specs/technical/powersync-sync-rules.yaml`
- `supabase/MIGRATIONS.md`
- `apps/mobile/src/powersync/schema.ts`
- `packages/shared/src/database.types.ts` (régénéré)

```sql
alter table public.planned_sessions
  add column scheduled_time time;
```

Nullable, sans défaut — c'est la décision **D1** traduite en SQL. Pas d'index : la colonne ne filtre
rien, elle est lue avec la ligne.

**Séquence exacte** (CLAUDE.md, dev sans Docker) — ✅ **faite le 12/08/2026** :
1. `npm run db:new planned_sessions_scheduled_time` → `20260812061859_…`
2. écrire le SQL
3. `npm run db:push:dry` puis `npm run db:push`
4. `npm run db:types`
5. cocher dans [MIGRATIONS.md](../../supabase/MIGRATIONS.md)
6. déclarer la colonne dans `powersync/schema.ts`

> ✅ **Correction du plan initial : il n'y a AUCUNE sync rule à redéployer.** Le plan annonçait une
> étape 6 « coller le YAML dans le dashboard » et en faisait le risque n° 1. **C'était faux** :
> `planned_sessions` est lue en **`select *`**
> ([powersync-sync-rules.yaml:89](../specs/technical/powersync-sync-rules.yaml)), donc une colonne
> ajoutée descend **automatiquement**. Le réflexe « migration ⇒ sync rule à la main » ne vaut que
> pour une **table neuve**. ⚠️ **Le cadrage de COLLIS-01 avait commis exactement la même erreur**, et
> en avait fait le même risque n° 1 avant d'être démenti par la relecture.
>
> 🔴 **Le vrai risque n° 1 est l'étape 6 telle que réécrite** : la colonne doit être déclarée dans le
> **schéma client**. Sans elle, l'écriture échoue, l'erreur est avalée, et l'heure ne se pose jamais
> **sans aucun message** — panne exacte de CYCLE-01 (recette du 31/07/2026). D'où le test
> d'écriture-relecture à l'étape 3.

**Vérification faite** : `scheduled_time: string | null` présent dans `database.types.ts` régénéré
**depuis le cloud**, et `db:push:dry` répond « Remote database is up to date ».
⚠️ Le push a affiché le warning `pg-delta`/certificat déjà rencontré **trois fois** (REPAS-01,
VIE-01, DOUL-01) : il porte sur la mise en cache du catalogue, **pas** sur l'application du SQL.

---

### Étape 2 — Brique pure du calcul de convocation

**Fichier** : `packages/shared/src/session-reminder.ts` (nouveau) + son test.

```ts
export const SESSION_LEAD_MINUTES = 30;

/** Instant de convocation, ou `null` s'il n'y a rien à programmer. */
export function computeSessionCallTime(params: {
  scheduledDate: string;      // AAAA-MM-JJ
  scheduledTime: string | null; // HH:MM, null = pas d'heure
  now: Date;
}): Date | null;
```

**TDD — les cas d'abord** :
1. heure posée, convocation à venir → `date − 30 min` ;
2. 🔴 **convocation déjà passée → `null`** (R3) — le cas qui compte, et le plus facile à rater ;
3. `scheduledTime = null` → `null` (le repli d'échéance n'est pas l'affaire de cette fonction) ;
4. 🔴 **séance à 00 h 15 → convocation la veille à 23 h 45** : le calcul traverse minuit ;
5. heure malformée (`'25:00'`, `''`) → `null`, sans lever ;
6. le seuil exact (`now` == convocation) → programmé, pas écarté.

Pure, sans horloge implicite (`now` est un paramètre — règle `no-frozen-clock` du dépôt).

---

### Étape 3 — Lecture : la prochaine séance planifiée avec heure

**Fichier** : `apps/mobile/src/data/repositories/planned-session-repository.ts` + test SQL.

Requête exportée (patron `SELECT_*` du dépôt, testée sur vrai SQLite) : occurrences du jour,
`status = 'planned'`, `deleted_at IS NULL`, **ordonnées par `scheduled_time`**, `NULL` en dernier.

**Tests SQL** : occurrence sans heure exclue du tri de convocation · séance faite exclue ·
soft-deleted exclue · deux séances → la plus proche à venir sort en tête (**D6**).

---

### Étape 4 — Scheduler : les deux régimes, exclusifs

**Fichiers** : `notification-repository.ts`, `lib/notifications.ts`, i18n.

L'entrée `SESSION_REMINDER_ID` du `plan` existant devient conditionnelle :

- heure connue et convocation à venir → `scheduleDatedReminder` à l'instant calculé, libellé
  `notifications.sessionSoon.*` ;
- sinon → **exactement le code actuel** (échéance apprise, `useSessionDeadline`).

> ⚠️ **Un seul identifiant** (`SESSION_REMINDER_ID`) pour les deux régimes : c'est ce qui garantit
> mécaniquement **R5** (jamais deux notifications). Basculer de régime **annule** l'autre.

**Tests** (patron `programmed-reminders-scheduler.test.tsx`) :
- heure posée → convocation programmée, **échéance apprise non programmée** ;
- pas d'heure → échéance apprise, comme avant (**non-régression, le test le plus important**) ;
- convocation passée → **rien** (R3) ;
- séance faite → rien ; `sessionReminder` off → rien ; quota atteint → rien ;
- changement d'heure → annulation puis reprogrammation.

🔴 **Contre-épreuve obligatoire** (§8 de [strategie-tests.md](../specs/technical/strategie-tests.md)) :
retirer la garde R3 à la main et **voir le test passer au rouge**. Sans ça, il ne prouve rien.

---

### Étape 5 — Saisie de l'heure (UI)

**Fichiers** : détail d'une occurrence planifiée, composant de sélection, i18n.

- Ligne « Heure de la séance » : valeur ou « Pas d'heure définie ».
- Sélecteur natif (`@react-native-community/datetimepicker`, déjà présent au dépôt — **à confirmer
  à l'implémentation**, sinon saisie `HH:MM` contrôlée plutôt qu'une dépendance nouvelle).
- Action **« Retirer l'heure »** visible seulement si une heure existe (D7).
- Mention `planning.timeHint` sous le champ (conséquence de D5, spec §4).
- Écriture via le repository, jamais en SQL direct depuis l'écran.

**Tests d'écran** : afficher / poser / retirer, et le libellé de repli.

---

### Étape 6 — Affichage et reprogrammation

- L'heure apparaît là où l'occurrence est listée (planning, hub muscu, widget du jour), formatée
  par l'i18n — jamais `HH:MM:SS` brut (**R8**).
- Le glisser-déposer de **MUSC-F9** conserve l'heure et reprogramme le rappel (**R7**).

**Test** : déplacer une occurrence datée conserve `scheduled_time`.

---

## Fichiers touchés (récapitulatif)

| Fichier | Nature |
|---|---|
| `supabase/migrations/<...>_planned_sessions_scheduled_time.sql` | nouveau |
| `docs/specs/technical/powersync-sync-rules.yaml` | modifié → **à redéployer à la main** |
| `supabase/MIGRATIONS.md` | coché |
| `apps/mobile/src/powersync/schema.ts` | + `scheduled_time` |
| `packages/shared/src/session-reminder.ts` (+ test) | nouveau |
| `apps/mobile/src/data/repositories/planned-session-repository.ts` (+ test SQL) | modifié |
| `apps/mobile/src/data/repositories/notification-repository.ts` (+ test) | modifié |
| `apps/mobile/src/lib/notifications.ts` | libellés de convocation |
| Écran de détail d'occurrence + composant de saisie | modifié / nouveau |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | 7 clés |

## Ce que ce plan ne fait pas

- Aucune **permission Android nouvelle** (D5) — c'est un choix lié au calendrier de publication,
  pas un oubli.
- Aucun **réglage** du délai (D4) : constante `SESSION_LEAD_MINUTES`.
- **Le rappel reste muscu** alors que la colonne sert aux deux piliers. Écart **volontaire** (spec
  §2) : brancher le running ici mélangerait deux familles de notification.

## Risques

| Risque | Parade |
|---|---|
| 🔴 **Colonne absente du schéma PowerSync client** → écriture qui échoue **sans message** (panne CYCLE-01) | Déclarée à l'étape 1 point 6, **et** test d'écriture-relecture à l'étape 3. |
| ~~Sync rules oubliées~~ | ✅ **Sans objet** : `select *` sur `planned_sessions`, la colonne descend seule. Risque imaginaire du premier cadrage. |
| Rappel dans le passé, ou immédiat | R3 testée **et contre-éprouvée** (étape 4). |
| Régression du rappel actuel pour les séances sans heure | Test de non-régression explicite (étape 4), écrit **avant** de toucher au scheduler. |
| Dépendance UI nouvelle pour le sélecteur | Vérifier l'existant d'abord ; repli sur une saisie contrôlée. |
