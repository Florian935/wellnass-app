# Plan — RUN-F3 · Résumé de course enrichi

Spec : [runf3-resume-course-enrichi.md](../specs/functional/us/runf3-resume-course-enrichi.md) ·
branche `feature/runf3-resume-course-enrichi` · roadmap **5.24 / 5.25**.

> Ce plan couvre **5.25 seul** (comparaison à l'objectif) + **D3** (terrain), conformément à la
> recommandation de scission de la spec §0. La partie **5.24 (météo)** n'est pas planifiée ici : elle
> dépend d'un arbitrage qui touche la **politique de confidentialité** de LANCE-00.

## Étape 0 — Lever l'inconnue, avant de planifier le reste *(≈ 1 h)*

⛔ **À faire en premier, et le résultat change le plan.** Déterminer, **en lisant le code** et non en
supposant, si une course est rattachable à sa `planned_session` (spec §3).

- Lire le parcours « démarrer une séance planifiée de course » → jusqu'à l'écriture dans `runs`.
- **Issue (a)** — le lien est reconstituable : poursuivre à l'étape 1, **aucune migration**, ~3 h.
- **Issue (b)** — il ne l'est pas : insérer une **étape 0 bis** — migration ajoutant
  `planned_session_id` à `runs`, `npm run db:new` → `db:push` → `db:types` → cocher
  [MIGRATIONS.md](../../supabase/MIGRATIONS.md), **puis redéployer les sync rules PowerSync**
  (coller [powersync-sync-rules.yaml](../specs/technical/powersync-sync-rules.yaml) dans le
  dashboard). ⚠️ Étape manuelle **déjà oubliée une fois** sur ce projet.

**Ne pas commencer l'étape 1 avant d'avoir tranché.** C'est ce qui distingue une US de 3 h d'une US
de 6 h avec migration.

## Étape 1 — Le calcul, pur et testé *(≈ 1 h)*

`packages/shared/src/run-target.ts` — aucune dépendance, aucun accès données :

```ts
compareToTarget({ distanceM, durationS }, { targetDistanceM, targetDurationS })
  → { distance?: {...}, duration?: {...} }   // absent si non visé (R3)
```

**Tests, écrits d'abord** :
- 5,2 km / 5 km → dépassé ; 4,1 km / 5 km → en deçà, **statut neutre** (R4).
- **4,95 km / 5 km → `reached`** — la tolérance de 2 % (R5). Le test qui compte : sans lui, une séance
  réussie s'affiche presque toujours comme manquée.
- 5,10 km / 5 km → `reached` également (la tolérance joue **dans les deux sens**).
- Cible partielle (durée seule) → la clé `distance` est **absente**, pas à zéro (R3).
- Aucune cible → objet vide, et l'UI n'affiche rien (R1).
- Tolérance **relative** → un test en unités impériales donne le même verdict (R6).

## Étape 2 — L'affichage *(≈ 1 h 30)*

- Bloc dans l'écran de résumé de course, **monté seulement si** le résultat est non vide (R1).
- Phrases à variables dans les deux locales (`{{done}}` / `{{target}}`), **jamais** de concaténation
  — l'ordre des mots diffère entre FR et EN.
- Ton : `success` pour atteint/dépassé, **neutre** (`textMuted`) pour en deçà. **Jamais `danger`** (R4).
- ⚠️ Utiliser la palette **issue de CONF-07** : `success` change de valeur en thème clair.

## Étape 3 — Terrain (D3, si retenu) *(≈ 1 h 30)*

- Migration : `runs.terrain text null` + contrainte sur 4 valeurs. `db:new` → `db:push` → `db:types`
  → **sync rules à redéployer** → cocher le registre.
- Sélecteur à 4 choix sur l'écran de fin de course, **facultatif** — une course sans terrain reste
  parfaitement valide.
- 4 clés i18n.

## Étape 4 — Solde *(≈ 30 min)*

Roadmap **5.25 → ✅**. **5.24 reste ⬜** et part en candidat distinct au BACKLOG, avec les 3 questions
de la spec §4 D2 recopiées — sinon elles seront reperdues.
CHANGELOG + `etat.mjs` via `/commit`.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `packages/shared/src/run-target.ts` + `.test.ts` | **nouveau** — le calcul |
| écran de résumé de course | montage du bloc |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | 6 clés (+4 si D3) |
| `supabase/migrations/…` | **seulement** si issue (b) ou si D3 |

## Migration / sync rules

**Aucune si issue (a) et D3 écartée.** Sinon migration **et** redéploiement des sync rules — jamais
l'un sans l'autre.

## Risques

- 🔴 **L'étape 0 est un vrai risque de planning** : (a) → 3 h, (b) → le double, plus une étape
  manuelle sur le dashboard PowerSync.
- 🟠 **La tolérance de R5 est un choix produit déguisé en détail technique.** 2 % est un point de
  départ ; à confirmer en recette sur de vraies courses.
- 🟢 5.25 ne touche aucune donnée existante : purement additif.
