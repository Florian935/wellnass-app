# Fix — Precision GPS & records d'allure (marche/course lente)

> **Bug device (12/07/2026)** : une marche de 1,01 km n'a produit **aucun record** (section « Records
> d'allure » à « — », pas de badge 1 km) ; la carte du récapitulatif montre un point aberrant à (0,0)
> reliant la France au golfe de Guinée. Branche : `fix/running-gps-precision-records`.
> Méthode : `superpowers:systematic-debugging` (cause racine avant tout correctif).

## 1. Cause racine (Phase 1-2)

Trois causes, la (C) étant **dominante** pour le symptôme « pas de record » :

**(A) Point (0,0) « null island » ingéré sans filtre.** `toGpsPoints` (`tracker-task.ts:174-180`) mappe
`loc.coords.latitude/longitude` **sans aucune validation**. Un fix GPS dégradé (coords 0/0, accuracy
énorme) entre dans la trace → tracé aberrant sur la carte. Effet de bord distance : les segments
`A→(0,0)` et `(0,0)→B` dépassent `MAX_PLAUSIBLE_SPEED_MS` (12 m/s) → comptés 0 m **dans le live ET
dans la trace décodée** → la distance réelle `dist(A,B)` est **perdue des deux côtés**.

**(B) Auto-pause trop agressive sur mouvement lent.** Seuil `AUTO_PAUSE_SPEED_MS = 0,5 m/s` (~1,8 km/h),
`AUTO_PAUSE_DELAY_S = 8 s` (`tracker-task.ts:54-57`). À 23:05/km ≈ **0,72 m/s**, l'utilisateur est
au-dessus du seuil en moyenne, mais le bruit GPS fait plonger la vitesse instantanée sous 0,5 m/s → la
fenêtre de vitesse basse s'arme et de faux passages en pause écartent des points de la trace encodée
(`s.paused` → `continue` avant `kept.push`, `tracker-task.ts:209-215`).

**(C) DOMINANTE — quantification d'encodage 1e-5 trop grossière pour un pas lent.**
`encodeCoords` (`running.ts:235-248`) arrondit `lat/lng * 1e5` → grille **~1,1 m**. Pour une marche à
0,72 m/s, deux points GPS consécutifs (~1 Hz) sont distants de **~0,7 m**, soit **sous la maille**.
Après arrondi, des points consécutifs retombent souvent sur la **même cellule** → 0 m entre eux →
la trace **décodée** sous-compte systématiquement la distance. Le tracker, lui, calcule
`cumulativeDistanceM` sur des **flottants pleine précision** (`loc.coords.latitude`, avant tout encodage)
→ 1,01 km live. D'où la **divergence** : `distance_m` stocké = 1010 m, mais `decodeTrack` →
`cumulativeDistances` totalise **< 1000 m**.

Chaîne d'échec du record : trace décodée < 1000 m → `bestSegmentTimeFromSamples` retourne `null`
(garde `cum[n-1] < targetDistanceM`, `pace-records.ts:37`) → `computeRunRecords` ne pose **aucune** clé
`'1k'` → `detectAndStoreRunRecords` `continue` sur chaque clé (`running-record-repository.ts:192-193`)
→ **rien inséré, aucun badge, section « — »**. Les maths de records et le câblage détection/backfill
sont **corrects** ; le défaut est en amont (fidélité de la trace relue).

### Écarté (Phase 1)
- `source='manual'` / `gps_track` null : non (carte GPS tracée + 1,01 km affiché).
- Backfill jamais déclenché : non — il s'exécute mais rejoue `detectAndStoreRunRecords` qui renvoie `[]`
  pour la même raison (trace < 1 km).
- Requête de lecture des records fautive : non — `SELECT_CURRENT` lit bien tous les records ; rien n'est
  jamais **inséré**.

### ⚠️ Correction d'une hypothèse initiale
« Recalculer `distance_m` depuis la trace décodée à la clôture » a été **écartée** : la trace décodée
sous-comptant (cause C), cela **dégraderait** l'affichage (montrerait ~0,99 km au lieu de 1,01 km) sans
garantir le record. Le bon principe est l'**inverse** : rendre la trace décodée **fidèle** (précision)
pour que les records calculés dessus soient justes, et **conserver** `distance_m` live comme source de
vérité d'affichage — les deux convergent alors naturellement.

## 2. Correctif (3 volets)

### Volet A — Filtre des fixes invalides à l'ingestion
Dans `tracker-task.ts` (`toGpsPoints` / avant `kept.push`), **rejeter** tout point GPS où :
- `coords` absent ; ou `latitude === 0 && longitude === 0` (null island) ; ou
- `|latitude| > 90` / `|longitude| > 180` (hors bornes) ; ou
- `accuracy` présent et `> ACCURACY_MAX_M` (seuil, ex. **50 m**).

Un point rejeté n'entre ni dans `kept` (pas encodé), ni dans le cumul distance/durée, ni ne devient
`lastPoint`. Extraire un helper pur **`isValidFix(loc)`** (testable). Tester : (0,0) rejeté, coords
hors bornes rejetées, accuracy > seuil rejetée, fix nominal accepté.

### Volet B — Auto-pause moins sensible au bruit lent
Objectif : ne pas auto-pauser un déplacement lent **réel**. Deux leviers (à confirmer par test) :
- Abaisser le seuil de déclenchement (ex. `AUTO_PAUSE_SPEED_MS` 0,5 → **0,3 m/s** ≈ 1,1 km/h : réservé
  au quasi-arrêt) ; **et/ou**
- exiger que la vitesse soit basse **de façon soutenue** en la mesurant sur une **fenêtre lissée**
  (moyenne des N derniers points) plutôt que sur la vitesse instantanée point-à-point (très bruitée).

Garder l'auto-reprise instantanée. Tester : une marche synthétique bruitée à 0,72 m/s moyenne (avec des
creux instantanés < 0,5 m/s) **ne déclenche pas** l'auto-pause ; un vrai arrêt prolongé la déclenche
toujours ; la reprise fonctionne.

### Volet C — Précision d'encodage 1e-5 → 1e-6 (avec marqueur de version)
Porter la précision coords de `1e-5` (~1,1 m) à **`1e-6`** (~0,11 m) dans `encodeCoords`/`decodeCoords`
(`running.ts`). Coût : ~1 caractère de plus par coordonnée (deltas 10× plus grands — le varint absorbe),
soit ~+30 % de taille de trace, acceptable.

**Compat ascendante obligatoire** : les traces déjà enregistrées sont encodées en 1e-5. Introduire un
**marqueur de version de format** afin que `decodeTrack` relise correctement l'ancien **et** le nouveau
format (pas de perte des courses de test dev). Piste retenue : préfixer chaque **segment** encodé d'un
tag de version (le format piste `<len>:<seg>` permet un décodage segment par segment ; la version peut
vivre dans l'en-tête de segment). `encodeSegment` émet la version courante ; `decodeTrack` lit la version
par segment et applique le facteur `1e-5` ou `1e-6` en conséquence. **Aucune migration DB** (format
applicatif dans la colonne texte `gps_track`). Tester : round-trip 1e-6 fidèle ; un segment 1e-5 hérité
se décode toujours correctement ; une trace mixte (segments 1e-5 puis 1e-6) se décode dans l'ordre.

## 3. Test de reproduction (Phase 4, à écrire EN PREMIER — doit échouer avant fix)

Dans `@wellness/shared` (Vitest) : générer une trace synthétique « marche lente » — ~1400 points à
1 Hz avançant de ~0,72 m chacun le long d'un méridien (soit ~1010 m réels sur ~1400 s), plus un point
(0,0) inséré. Encoder puis décoder la trace, calculer `cumulativeDistances`.
- **Avant fix** : distance décodée **< 1000 m** → `computeRunRecords` **sans** clé `'1k'` (échec attendu).
- **Après fix (C + filtre 0,0)** : distance décodée **≥ 1000 m** (≈ 1010 m à la tolérance de 1e-6 près)
  → `computeRunRecords` **pose** `'1k'`.

## 4. Fichiers touchés

- `packages/shared/src/running.ts` — précision 1e-6 + versionnage segment (encode/decode).
- `packages/shared/src/*.test.ts` — test reproduction (trace lente) + round-trip versionné.
- `apps/mobile/src/running/tracker-task.ts` — helper `isValidFix` + filtre ingestion ; retune auto-pause.
- (Éventuel) `packages/shared/src/running.ts` — `isValidFix` si placé côté shared pour testabilité.
- **Aucune migration, aucun cloud, aucune sync rule.** `distance_m` d'affichage **inchangé** (live).

## 5. Definition of Done

- [ ] Test de repro écrit **d'abord**, rouge avant fix, vert après.
- [ ] Volet A : `isValidFix` testé ; (0,0)/hors-bornes/accuracy dégradée rejetés à l'ingestion.
- [ ] Volet B : auto-pause ne coupe plus une marche lente réaliste ; arrêt réel toujours détecté ;
      reprise OK (tests).
- [ ] Volet C : round-trip 1e-6 fidèle ; **décodage des traces héritées 1e-5 préservé** (compat) ; trace
      mixte décodée correctement.
- [ ] `computeRunRecords` pose `'1k'` sur la trace de repro ; pas de régression sur les autres records.
- [ ] `distance_m` affiché inchangé (reste le cumul live) ; affichage et records **cohérents**.
- [ ] typecheck/lint/tests verts. Rebuild preview pour recette device (badge 1 km attendu).
- [ ] PR relue.

## 6. Explicitement différé
Réglage fin des seuils auto-pause d'après données terrain réelles ; lissage de l'allure instantanée ;
recompute d'anciens records sur données de prod (backfill idempotent suffit).
