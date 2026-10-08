# Plan — NORYN-01 · Noryn lit la journée et la semaine

Spec : [noryn01-noryn-context.md](../specs/functional/us/noryn01-noryn-context.md) · 08/10/2026, validé
par Florian le même jour ·
branche `feature/noryn01-noryn-context` · contrat : Noryn `docs/08-WELLNESS-CONTRACT.md` (TASK-013).

Les propositions de la spec ont été retenues le 08/10/2026 (**D1-A** : cibles et verdict à `null`, **D2** :
bundle construit au déploiement, **D3** et **D9** : reçu de synchro posé pour chaque compte, **D8** :
fenêtre J−8…J+15). Une autre réponse à D1 ou D2 change les étapes 2, 9 et 10 ; à D9, l'étape 1 ; le
reste tient.

Un seul lot de recette, onze étapes. Le fichier de migration d'abord (écrit, **pas poussé** : c'est
Florian qui le pousse), les briques pures ensuite (TDD, Vitest), le serveur, et la coquille Deno en
dernier. **Aucun écran, aucune chaîne i18n, aucune sync rule.**

## Ordre de build

| # | Étape | Fichiers | Tests |
|---|---|---|---|
| 1 | **Migration** : reçu de synchro | `supabase/migrations/<horodatage>_noryn01_sync_receipts.sql` **(neuf)**, `supabase/MIGRATIONS.md` | — (SQL) ; recette 14 à 16 et 19 |
| 2 | **Refactors sans effet** : garde de piliers et volume d'une course planifiée sortis vers `shared` | `packages/shared/src/pillar.ts`, `running-hub.ts` ; `apps/mobile/src/data/repositories/settings-repository.ts`, `apps/mobile/src/app/(tabs)/running.tsx` | `pillar.test.ts`, `running-hub.test.ts` (+ cas) ; tests d'écran existants inchangés |
| 3 | **Dates de Paris** | `packages/shared/src/noryn/paris-date.ts` **(neuf)** | `paris-date.test.ts` **(neuf)** |
| 4 | **Le contrat** en zod strict | `noryn/contract.ts` **(neuf)** | `contract.test.ts` **(neuf)** |
| 5 | **Une séance** : type, intensité, étiquettes, durée | `noryn/sessions.ts` **(neuf)** | `sessions.test.ts` **(neuf)** |
| 6 | **La journée et la semaine** à partir d'un instantané | `noryn/day.ts`, `noryn/week.ts`, `noryn/snapshot.ts` **(neufs)** | `day.test.ts`, `week.test.ts` **(neufs)** |
| 7 | **Accès** : jeton, chemin, paramètres, fenêtre | `noryn/auth.ts`, `noryn/request.ts` **(neufs)** | `auth.test.ts`, `request.test.ts` **(neufs)** |
| 8 | **La source** : requêtes du propriétaire, double barrière | `noryn/source.ts` **(neuf)** | `source.test.ts` **(neuf)** — isolation à deux utilisateurs, test-garde des colonnes |
| 9 | **Le gestionnaire** et le point d'entrée du bundle | `noryn/handler.ts`, `noryn/index.ts` **(neufs)** | `handler.test.ts` **(neuf)** — matrice d'accès, en-têtes, jamais synchronisé |
| 10 | **Le bundle** | `scripts/noryn-context-bundle.mjs` (+ `.d.mts`) **(neufs)**, `packages/shared/package.json` (`esbuild` exact), `package.json` racine (`noryn:build`, `noryn:deploy`), `.gitignore` | `noryn/bundle.test.ts` **(neuf)** — construit en mémoire et exécute le bundle sous Node |
| 11 | **La coquille Deno**, la config, les docs | `supabase/functions/noryn-context/index.ts` **(neuf)**, `supabase/config.toml`, spec (`etape: recette`), `RECETTES.md`, roadmap | recette |

## Étape 1 — la migration

```sql
create table public.sync_receipts (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  received_at timestamptz not null
);
alter table public.sync_receipts enable row level security;   -- aucune politique
revoke all on public.sync_receipts from anon, authenticated;
grant select on public.sync_receipts to service_role;          -- 🔴 sinon 503 permanent (config.toml)

-- Corps commun : poser le reçu de `writer` s'il écrit SA ligne. Ne lève jamais.
create or replace function public.note_sync_receipt_for(row_owner uuid)
returns void language plpgsql security definer set search_path = '' set lock_timeout = '200ms' as $$
declare
  writer uuid;
begin
  writer := auth.uid();                       -- DANS le bloc protégé : un `sub` invalide ne casse rien
  if writer is not null and row_owner = writer then
    insert into public.sync_receipts as r (user_id, received_at) values (writer, now())
    on conflict (user_id) do update set received_at = greatest(r.received_at, excluded.received_at);
  end if;
exception when others then
  null;   -- 🔴 jamais d'échec : sinon toute la file d'envoi PowerSync du téléphone se bloque
end $$;
revoke execute on function public.note_sync_receipt_for(uuid) from public, anon, authenticated;

create or replace function public.note_sync_receipt_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform public.note_sync_receipt_for(case tg_op when 'DELETE' then old.user_id else new.user_id end);
  exception when others then null;
  end;
  return null;
end $$;
-- note_sync_receipt_owner() : idem avec owner_id.

create trigger noryn_sync_receipt after insert or update or delete on public.daily_steps
  for each row execute function public.note_sync_receipt_user();
-- … user_id : food_entries, water_entries, daily_wellbeing, workouts, runs, profiles,
--   nutrition_profiles, user_settings, running_profiles, activities, body_weight_entries,
--   real_life_periods ;
-- … owner_id (note_sync_receipt_owner) : planned_sessions, programs, sessions, exercise_plans,
--   session_intervals, exercises.
```

- Chaque fonction lit **sa** colonne propriétaire (`new.user_id`, `old.owner_id`…) : aucune
  sérialisation de la ligne (`to_jsonb` copierait une trace GPS ou des micronutriments à chaque
  écriture).
- `lock_timeout` : une attente de verrou sur le reçu devient une erreur 55P03, rattrapée ; un
  `statement_timeout` (57014) ne l'est pas, mais il viserait alors l'écriture entière, pas le reçu.
- `note_sync_receipt_for` n'est **pas** exposée en RPC (`revoke execute`) : personne ne peut poser un
  reçu à la main.
- **Pas** d'ajout à la publication `powersync`, **pas** de sync rule, **pas** de colonne dans le schéma
  PowerSync local (`sql-prepare-sweep` n'est pas concerné).
- Les noms de colonnes propriétaires des 19 tables sont vérifiés dans `database.types.ts`.
- 🔴 **Cloud** : `npm run db:push` puis `npm run db:types` **par Florian, ou avec son accord explicite**.
  Puis cocher `supabase/MIGRATIONS.md`.

## Étape 2 — les deux refactors sans effet

- `isPillarArray` quitte `settings-repository.ts` pour `packages/shared/src/pillar.ts` (exportée) ; le
  mobile l'importe. Le serveur décode `active_pillars` exactement comme l'app :
  `parseJsonColumn(value, [...PILLARS], isPillarArray)`.
- `plannedRunDistanceM(blocks, targetDistanceM)` sort du `useMemo` de `(tabs)/running.tsx` vers
  `running-hub.ts`, **à la ligne près** : `Σ max(1, reps) × ((fastDistanceM ?? 0) +
  (recoveryDistanceM ?? 0))`, repli sur la distance cible si le total vaut 0 ou s'il n'y a aucun bloc.
  L'écran l'appelle.
- Tests : cas de la fonction neuve (structure, repli, blocs vides) ; les tests d'écran Course et de
  réglages existants passent sans modification.

## Étape 3 — dates de Paris

`PARIS_TIME_ZONE = 'Europe/Paris'`. `parisDayKey(instant)` via `Intl.DateTimeFormat(…, { timeZone,
year, month, day }).formatToParts` (comme Noryn — ne pas dépendre du format d'une langue) ;
`addDayKeys(key, n)` et `daysBetween` en arithmétique UTC sur clés (jamais `Date` local : le serveur
tourne en UTC) ; `isValidDayKey` (vraie date du calendrier), `isMondayKey`, `parisDayStartUtc(key)`
(minuit à Paris en instant, pour borner `finished_at`) ; `inServedWindow(key, today)` (J−8…J+15, D8)
et `weekOverlapsServedWindow(start, today)`.

Tests : 29/03/2026 et 25/10/2026 (minuit Paris en UTC, journée de 23 h et de 25 h) ; **des instants
qui tombent un autre jour en UTC et à Paris** — lundi 26/10/2026 00 h 30 Paris (= 25/10 23 h 30 UTC),
lundi 30/03/2026 00 h 30 Paris (= 29/03 22 h 30 UTC), 25/10/2026 00 h 30 Paris encore en heure d'été
(= 24/10 22 h 30 UTC) — qu'une mise en œuvre en UTC ferait échouer ; `2026-02-29` refusé ; bornes
J−8 / J+15 incluses, J−9 / J+16 exclues ; semaine recoupant la fenêtre par un seul jour.

## Étape 4 — le contrat

`noryn/contract.ts` : `NorynDaySchema`, `NorynWeekSchema` en `.strict()` (zod 3 du paquet), mêmes règles
que `wellness-source.ts` de Noryn : bornes, entiers, `energy_kcal`/`protein_g` nuls ensemble, `nights`
nul ⇔ `average_minutes` nul, séances du jour à la bonne date, 6 par jour, 42 en tout, identifiants
uniques en UUID canonique minuscule, étiquettes distinctes (4 au plus), `synced_at ≤ generated_at`,
règle « jamais synchronisé », 7 jours dans l'ordre. Constantes : types, intensités, statuts,
étiquettes, verdicts.

Tests : les deux exemples de `docs/08` passent tels quels (**exemples de référence**, recopiés avec
leur source) ; un champ en plus, un flottant, une borne dépassée, un `synced_at` après `generated_at`,
un identifiant en majuscules, une séance d'un autre jour, une semaine de 6 jours → refusés.

## Étape 5 — une séance

`toNorynSession(input)` : entrée = séance planifiée + séance + pilier + plans d'exercices (séries,
repos, muscle principal) + blocs + allure de référence ; sortie = séance du contrat ou `null` (écartée).
Réutilise `estimateSessionMinutes`, `estimateRunMinutes`, `plannedRunDistanceM`, `isHeavyLegSession`,
`isIntenseSessionType` — **aucune** formule réécrite. `sortAndCapSessions(list)` : heure (nulles en
dernier), `order_index`, `id`, 6 par jour.

Deux listes de plans d'exercices en entrée, **une par règle** (spec §4.2) : pour la durée, plans non
supprimés d'exercices non supprimés (la carte du hub) ; pour `heavy_lower`, plans non supprimés,
exercices archivés compris, muscle principal renseigné (COLLIS-01).

Tests : chaque type de course → intensité et étiquette ; type inconnu, vide et `course_libre` (R14) ;
muscu → `null` (D6), `heavy_lower` au seuil exact (8 séries dominantes) et juste en dessous, égalité
jambes / dos ; **un exercice de jambes archivé compte pour `heavy_lower` et pas pour la durée** ;
jamais `upper_body` ; durée muscu identique à la carte du hub sur le même plan ; course par durée cible,
par volume, sans allure → `null` ; `estimated_minutes` 0 ou > 600 → `null` ; `start_time`
`18:30:00` → `18:30`, `7:00` / `25:00` → `null` ; identifiant majuscule → minuscule, non UUID → écartée ;
pilier ou statut inconnus → écartée ; 7 séances → 6, dans l'ordre.

## Étape 6 — la journée et la semaine

`snapshot.ts` : le type `OwnerSnapshot` (lignes typées, colonnes du §4 de la spec seulement) et
`trackedDomains(snapshot)` (D5). `buildDay(snapshot, { date, now })` et
`buildWeek(snapshot, { start, now })` — purs, **aucune lecture d'horloge** (`now` injecté).

Tests (TDD, un `describe` par champ) :
- les trois `null` : domaine non suivi (Health Connect éteint, pilier Nutrition éteint), rien de saisi,
  jamais synchronisé (§4.4 de la spec, chaque champ vérifié) ;
- aujourd'hui, un jour passé, un jour futur ;
- sommes arrondies (`0,4 + 0,4` → 1), kcal hors bornes → les deux `null` ;
- plusieurs lignes `daily_steps` → la plus grande ;
- `intensity_on_hold` : malade + pilier allumé / éteint, ligne supprimée, jamais synchronisé ;
- objectifs : `normalizeStepGoal` (absent → 8 000, hors bornes → borné), eau absente ou hors
  1–10 000 → 2 000 ;
- `synced_at` borné ; microsecondes **tronquées par le texte** avant lecture
  (`2026-10-08T11:40:00.123456+00:00` → `2026-10-08T11:40:00.123Z`), jamais arrondies vers le haut ;
- semaine : 7 dates du lundi au dimanche, nuits et moyenne arrondie, `done` par jour **à Paris** en
  bord de semaine (course finie le lundi 26/10/2026 à 00 h 30 Paris → semaine du 26/10 ; le lundi
  30/03/2026 à 00 h 30 Paris → semaine du 30/03), séance libre comptée, séance `cancelled` non
  comptée, plafond 50 ;
- chaque sortie passe `contract.ts`.

## Étape 7 — accès

- `auth.ts` : `parseBearer(header)` (schéma insensible à la casse, 16–4 096 ASCII visibles),
  `normalizeTokenHash(value)` (64 hexadécimaux, ramenés en minuscules, sinon `null`), `sameHash(a, b)`
  (temps constant : XOR sur toute la longueur, aucune sortie anticipée), `checkToken(header,
  expectedHash, sha256Hex)`.
- `request.ts` : `parseNorynRequest({ method, url })` → `{ kind: 'day', date } | { kind: 'week', start }
  | { error: 405 | 404 | 400 }`. Chemin accepté :
  `^(?:/functions/v1)?/noryn-context/context/(day|week)$`.

Tests : en-tête absent, `Basic …`, `Bearer` seul, jeton de 15 et de 4 097 caractères, caractère non
ASCII, JWT bien formé mais faux, empreinte posée en majuscules acceptée (normalisée), empreinte de 63
caractères ou non hexadécimale refusée ; paramètres dupliqués,
en trop, vides, date impossible, `start` un mercredi ; chemins voisins (`/context/days`,
`/context/day/`).

## Étape 8 — la source

`createNorynSource(client)` : `load(owner, range)` → `OwnerSnapshot`. Le client est **structurel**
(`from().select().eq().in().gte().lt().is()`), satisfait par `supabase-js` sans l'importer.

- Toutes les lectures en parallèle (une dizaine), chacune avec ses colonnes nommées et le filtre du
  propriétaire ; le contenu lié par `in('id', …)` **et** `or('owner_id.is.null,owner_id.eq.<owner>')`.
- `assertOwned(snapshot, owner)` : la double barrière (R7) — une ligne d'une table de l'utilisateur
  qui n'est pas au propriétaire **lève** ; un contenu lié étranger est **écarté** avec sa séance.
- `READ_COLUMNS` : la liste blanche des colonnes lues, par table (R8).

Tests :
- **isolation** : une fausse base en mémoire avec **deux** utilisateurs aux mêmes dates et des valeurs
  reconnaissables pour le second (99 999 pas, 7 777 kcal, ses UUID) → `buildDay` / `buildWeek` ne
  contiennent **aucune** de ces valeurs ni aucun de ces identifiants (balayage du JSON sérialisé) ;
- **enregistreur** : chaque requête vers une table d'utilisateur porte `eq(<colonne propriétaire>,
  owner)` ; une requête qui l'oublierait fait échouer le test ;
- **fausse base défaillante** qui ignore le filtre du propriétaire → `assertOwned` lève, rien n'est
  composé ;
- contenu de bibliothèque gardé ; séance planifiée de Florian pointant vers la séance privée d'un autre
  compte → écartée, sans erreur ;
- **test-garde** : chaque sélection égale, nom exact par nom exact, la liste blanche de sa table ;
  aucun `*` ; et, en v1, aucune des colonnes que la spec R8 exclut ;
- erreur renvoyée par le client → erreur levée.

## Étape 9 — le gestionnaire

`handleNorynRequest(req, deps)` avec `deps = { tokenHash, ownerId, now, sha256Hex, source }` : l'ordre
R1 de la spec, puis `buildDay` / `buildWeek`, validation `contract.ts`, taille ≤ 64 Kio, réponse.
`index.ts` (point d'entrée du bundle) n'exporte que `createNorynHandler(env, deps)`.

Tests — la matrice du brief §5, et plus :

| Cas | Attendu |
|---|---|
| sans `Authorization`, ou mal formé — que l'empreinte soit posée ou non | 401 + `WWW-Authenticate: Bearer` |
| `Bearer` bien formé, empreinte absente / mal formée | 503 |
| mauvais jeton · JWT d'utilisateur · `apikey` seule | 401 + `WWW-Authenticate: Bearer` |
| bon jeton, propriétaire absent | 503 |
| bon jeton, `POST` / `HEAD` / `OPTIONS` | 405 + `Allow: GET` |
| sans jeton, `POST` | 401 (le jeton passe avant) |
| chemin inconnu | 404 |
| paramètres invalides | 400 `bad_request` |
| J−9, J+16, semaine hors fenêtre | 400 `out_of_window` |
| J−8, J−7, J, J+14, J+15, semaine recoupant la fenêtre d'un jour | 200 |
| source en erreur, ligne étrangère | 503 |
| réponse hors contrat (instantané trafiqué), réponse > 64 Kio | 500 |
| toutes les réponses | `application/json`, `no-store`, aucun `Access-Control-*`, corps JSON |

Et : jamais synchronisé de bout en bout ; aucune journalisation (la fonction de journal injectée n'est
appelée qu'avec un code fixe).

## Étape 10 — le bundle

- `scripts/noryn-context-bundle.mjs` : `buildNorynBundle({ write })` avec esbuild — entrée
  `packages/shared/src/noryn/index.ts`, `bundle: true`, `format: 'esm'`, `platform: 'neutral'`,
  `mainFields: ['module', 'main']`, `target: 'es2022'`, sortie
  `supabase/functions/noryn-context/core.bundle.js`, bannière « fichier généré — ne pas éditer » avec
  le **SHA du commit**. Appelé en ligne de commande par `npm run noryn:build`, qui **refuse** de
  construire si `packages/shared` ou `supabase/functions/noryn-context` ont des modifications non
  commitées : ce qui part en production est toujours un état versionné.
- La CLI lit les fichiers sur le disque, sans consulter `.gitignore` (vérifié dans son code, §7 de la
  spec) : le bundle ignoré par git est bien téléversé.
- `package.json` racine : `"noryn:build"` et `"noryn:deploy": "npm run noryn:build && supabase
  functions deploy noryn-context --use-api"`.
- `.gitignore` : `supabase/functions/noryn-context/core.bundle.js`.
- `packages/shared/package.json` : `"esbuild": "0.21.5"` (exact) en `devDependencies`.
- `bundle.test.ts` : construit en mémoire (`write: false`), vérifie qu'**aucun import** ne reste dans la
  sortie (tout est embarqué), l'écrit dans un dossier temporaire **en `.mjs`** (un `.js` hors paquet
  `type: module` serait lu en CommonJS par Node), l'importe et appelle le gestionnaire (401 sans jeton,
  200 avec une fausse source) : le bundle tient seul, sans API propre à Node.
- `noryn/index.ts` a **son propre test direct** : le code exécuté depuis le bundle n'est pas instrumenté
  par la couverture, et le seuil de lignes du paquet est à 100 %.

## Étape 11 — la coquille Deno, la config, les docs

```ts
// supabase/functions/noryn-context/index.ts — une coquille : secrets, client, Deno.serve. Rien d'autre.
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { createNorynHandler } from './core.bundle.js';
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY : fournis d'office. NORYN_* : secrets posés par Florian.
// sha256Hex via crypto.subtle ; journal : console.error d'un code fixe seulement.
```

- `supabase/config.toml` : `[functions.noryn-context]` + `verify_jwt = false`.
- Spec : `etape: recette` ; `RECETTES.md` : nouvelle section avec les 20 critères de la spec §15 ;
  roadmap 9.17 ; CHANGELOG par `/commit`.
- **Gestes humains** (dans cet ordre, aucun par un agent sans accord explicite) :
  1. générer le jeton hors de git (brief §7) et calculer son empreinte SHA-256 ;
  2. `npx supabase secrets set NORYN_TOKEN_SHA256=… NORYN_OWNER_USER_ID=…` ;
  3. `npm run db:push`, `npm run db:types`, cocher `MIGRATIONS.md` ;
  4. `npm run noryn:deploy` ;
  5. recette (spec §15) ; puis le jeton et l'URL côté Noryn quand TASK-014 est livrée.

## Ce que la CI vérifie

`npm run typecheck` (le code de `shared/src/noryn`), `npm run test:coverage` (Vitest : toutes les
étapes 2 à 10, seuils de `packages/shared` à 100 % instructions / fonctions / lignes et 98 % branches),
`npm run lint`. La coquille Deno est hors runner, comme `ai-assist` : elle est volontairement réduite à
quelques lignes, et c'est la recette qui la couvre.

## Volume estimé

~10 fichiers neufs dans `shared/src/noryn` (≈ 700 lignes) et autant de tests (≈ 1 000 lignes, ~150
cas), 1 migration, 1 coquille Deno, 1 script, 2 refactors de quelques lignes.

## Après : NORYN-02 (si D1-A)

Les cibles et le verdict, sans duplication :

1. trancher l'écart E4 (base des protéines en mode `activities`) ;
2. extraire en fonctions pures, **sans changement de calcul**, la composition de `useDayEnergy`,
   `useDayCalorieTarget`, `useDayNutritionTargets` et `useReadiness` — les hooks n'y gardent que leurs
   lectures ; tests de non-régression sur les mêmes entrées ;
3. la source lit en plus : profil (poids, taille, naissance, sexe, objectif), dernière pesée,
   autres activités, périodes « vie réelle », séances et courses des 28 derniers jours, journal des
   7 derniers jours, check-ins des 3 derniers jours (énergie et stress **lus, jamais envoyés**) ;
4. `energy_target_kcal`, `protein_target_g` pour toute date de la fenêtre ; `readiness` pour
   **aujourd'hui** seulement (l'app ne le calcule pas pour un autre jour), si `show` est vrai.

Le reçu de synchro (étape 1) couvre déjà ces tables : aucune autre migration.
