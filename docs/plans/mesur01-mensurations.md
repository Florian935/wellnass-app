# Plan d'implémentation — US MESUR-01 (mensurations corporelles)

Spec : [mesur01-mensurations.md](../specs/functional/us/mesur01-mensurations.md) ·
Roadmap **3.51** · Branche `feature/mesur01-mensurations` · Estimation roadmap ~5 h.

> **D1 est déjà tranchée : modèle normalisé.** C'est elle qui donne sa forme à tout le lot — la
> table, les requêtes de courbe et les agrégats en découlent. La revenir en arrière après coup
> coûterait une migration de données, pas un refactor.

## Maquette

[design/mesur01-mensurations/](../../design/mesur01-mensurations/) — feuille de saisie, historique
avec sélecteur et courbe, liste des relevés avec delta.

## Fichiers touchés

**Créés**

| Fichier | Rôle |
|---|---|
| `supabase/migrations/<ts>_mesur01_body_measurements.sql` | Table, index unique partiel, RLS |
| `supabase/migrations/<ts>_mesur01_body_measurements_publication.sql` | `alter publication powersync` |
| `packages/shared/src/measurements.ts` | Types des 6 mesures + agrégats **purs** (séries, derniers relevés, delta) |
| `packages/shared/src/measurements.test.ts` | Tests (Vitest) |
| `apps/mobile/src/data/repositories/body-measurement-repository.ts` | Lecture/écriture locale |
| `apps/mobile/src/data/repositories/__tests__/body-measurement-write.test.ts` | Tests d'écriture |
| `apps/mobile/src/components/measurements/MeasurementSheet.tsx` | Feuille de saisie |
| `apps/mobile/src/app/measurements.tsx` | Historique + courbe |

**Modifiés**

| Fichier | Modification |
|---|---|
| `packages/shared/src/units.ts` | `cmToIn` / `inToCm` (+ tests) — **absents aujourd'hui** |
| `apps/mobile/src/hooks/useUnits.ts` | `formatCircumference` / `parseCircumferenceToCm` |
| `apps/mobile/src/powersync/schema.ts` | Déclarer `body_measurements` |
| `docs/specs/technical/powersync-sync-rules.yaml` | Une ligne dans `user_data` |
| `apps/mobile/src/app/progress/index.tsx` | Point d'entrée vers l'écran |
| `apps/mobile/src/lib/data-export.ts` | Table ajoutée à l'export RGPD |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | Namespace `measurements` |
| `packages/shared/src/database.types.ts` | Régénéré |
| `supabase/MIGRATIONS.md` · `docs/roadmap/roadmap.md` | 2 lignes cochées · 3.51 |

**Volontairement non touchés** : `bodyweight-repository` (le poids reste chez lui, on y **renvoie**),
et rien côté Storage — les photos sont hors périmètre.

---

### Tâche 1 — Briques pures (TDD)

Tests d'abord. Aucune dépendance React, aucun accès base.

1. `units.ts` : `cmToIn(cm)` / `inToCm(in)` via `CM_PER_IN` déjà présent. Aller-retour stable à
   l'arrondi près — c'est le test qui compte, une conversion asymétrique fabriquerait une dérive de
   l'historique à chaque bascule de réglage.
2. `measurements.ts` :
   - `MEASUREMENT_KINDS` (les 6 de D2) et le type dérivé ;
   - `isValidMeasurementCm(v)` — bornes `> 0` et `< 300` ;
   - `measurementSeries(rows, kind, days, todayKey)` — série d'**une** mesure, **trous conservés** ;
   - `latestByKind(rows)` — dernière valeur connue de chaque mesure (pré-remplissage de la feuille) ;
   - `measurementDeltas(rows, kind)` — delta de chaque relevé vs le **précédent de la même mesure**.

Cas de test à ne pas oublier : une seule date (delta `null`, pas `0` — l'absence de comparaison n'est
pas une stagnation), relevé partiel, ligne soft-deletée ignorée, valeur hors bornes, série vide.

### Tâche 2 — Migrations, schéma, sync rule

1. `npm run db:new mesur01_body_measurements` → SQL de la spec §4.
2. `npm run db:new mesur01_body_measurements_publication` → `alter publication`, gardé par
   `pg_publication_tables` (copier BIEN-01).
3. `db:push:dry`, `db:push`, `db:types`, **cocher les 2 lignes** au registre.
4. Déclarer la table dans `powersync/schema.ts` (`value_cm` en `column.real`).
5. Ligne dans `powersync-sync-rules.yaml` (bucket **`user_data`** : c'est une donnée personnelle),
   puis **coller le fichier dans le dashboard PowerSync et déployer**. ⚠️ Sans cette étape, tout
   marche en local et **rien ne remonte** — sans aucune erreur. Vérifier avant de continuer.

### Tâche 3 — Repository

- `useMeasurements(sinceDate?)` → lignes locales, pour les agrégats de la tâche 1.
- `useLatestMeasurements()` → dernière valeur par mesure (pré-remplissage).
- `saveMeasurements(logDate, values)` → pour chaque mesure fournie : **update** si une ligne vivante
  existe pour `(log_date, kind)`, sinon insert. Une valeur **vidée** → `softDelete`.
- Refuse une date future et une valeur hors bornes en **levant**, pas en échouant en silence.
- Test d'écriture : insert, update du même jour+kind, soft delete sur champ vidé, refus de date
  future, refus de valeur aberrante.

### Tâche 4 — Helpers d'unités côté app

`formatCircumference(cm)` → `« 82,0 cm »` / `« 32,3 in »`, et `parseCircumferenceToCm(text)` qui
accepte **virgule et point**. ⚠️ **Ne pas réutiliser `formatHeight`** : il rend l'impérial en
pieds-pouces, ce qui donnerait « 1 ft 1,8 in » pour un tour de bras.

### Tâche 5 — Écrans

- **Feuille** (patron `WellbeingCheckinSheet`) : date modifiable, 6 champs numériques optionnels
  pré-remplis avec le dernier relevé, bouton d'enregistrement actif dès qu'un champ change.
- **Historique** : sélecteur de mesure (une courbe à la fois), fenêtres 3 mois / 1 an / tout, courbe
  lissée avec valeur brute en infobulle, liste des relevés par date avec **delta en texte**.
- **Point d'entrée** sur `/progress` (E8 est un epic muscu), + lien vers la courbe de poids (4.30)
  pour ne pas la dupliquer.
- Accessibilité **dès l'écriture** : labels avec l'unité, cibles ≥ 48 dp, `maxFontSizeMultiplier`,
  delta annoncé en texte.

### Tâche 6 — i18n et RGPD

Namespace `measurements` FR + EN (6 libellés de mesure compris) ; `body_measurements` ajoutée à la
liste **explicite** de `data-export.ts` — une table absente de cette liste est une donnée non
exportable, donc une non-conformité.

---

## Ordre de build et pourquoi

1. **Tâche 1** — les briques figent les règles (trous, delta `null`, bornes) avant toute UI, et se
   testent sans base ni device.
2. **Tâche 2** — tout le reste en dépend, et l'**étape manuelle** de sync rule doit être franchie tôt
   pour ne pas découvrir la panne silencieuse en recette.
3. **Tâche 4** avant la **5** : la feuille ne peut pas s'écrire sans savoir formater et parser.
4. **Tâche 3** puis **5** — la porte d'écriture avant les écrans qui l'appellent.
5. **Tâche 6** en dernier, mais **dans la DoD**.

## Tests prévus

| Niveau | Quoi |
|---|---|
| Vitest (`shared`) | `cmToIn`/`inToCm` : aller-retour stable, valeurs de référence (2,54) |
| Vitest (`shared`) | `measurementSeries` (trous), `latestByKind`, `measurementDeltas` (**delta `null`** au premier relevé), bornes, lignes soft-deletées |
| Jest (mobile) | Écriture : insert, update même (jour, kind), soft delete sur champ vidé, refus date future / valeur aberrante |
| Jest (mobile) | Smoke de l'écran d'historique (états vides : aucun relevé, un seul point) |
| Recette device | Les 12 critères de la spec §10 — dont la bascule d'unités **sans altérer l'historique** |

## Risques

| Risque | Parade |
|---|---|
| 🔴 **Sync rule non déployée** → données locales seules, **aucune erreur** | Étape 5 de la tâche 2, franchie **avant** l'UI ; en DoD ; critère de recette 9 |
| Dérive de l'historique à chaque bascule d'unité | **Stockage toujours en cm** (spec §3.3) ; test d'aller-retour de conversion |
| `formatHeight` réutilisé par réflexe → « 1 ft 1,8 in » | Helpers dédiés (tâche 4) + critère de recette 6 |
| Delta `0` affiché au premier relevé (faux : il n'y a pas de comparaison) | `null` explicite dans la brique pure, testé |
| Saisie de 6 champs jugée fastidieuse | Tous optionnels (D6) + **pré-remplissage** par le dernier relevé |
| Modèle large réintroduit « pour simplifier » | D1 argumentée dans la spec ; le coût du retour arrière est une migration de données |
| Photos ajoutées « vite fait » | Hors périmètre explicite : Storage privé, RLS, quota et RGPD en font un lot à part |
