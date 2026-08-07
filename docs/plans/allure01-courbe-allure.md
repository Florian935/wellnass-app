# Plan d'implémentation — ALLURE-01

> Spec : [allure01-courbe-allure.md](../specs/functional/us/allure01-courbe-allure.md)
> Branche : `feature/allure01-courbe-allure` · Créée depuis `origin/dev` le 07/08/2026
> Lot de **4 analyses** du catalogue (RUN-11, RUN-20, RUN-17, RUN-08).

## 0. Ce que ce plan garantit d'emblée

| Question | Réponse |
|---|---|
| Migration base ? | ✅ **Non** — toutes les colonnes existent (spec §5, vérifiées) |
| Sync rule / schéma local ? | ✅ **Non** |
| Dépendance native neuve ? | ✅ **Non** → **recettable sur l'APK existant** |
| Réseau / écriture ? | ✅ **Aucun** — lecture seule |
| Requête SQL neuve ? | **Une seule** (polarisation, §Lot 5). Les 3 autres analyses partent de données **déjà chargées** |
| Nombres inventés ? | **Trois seuils**, dont un seul vraiment arbitraire (`FADE_MIN_DISTANCE_KM`) |

⚠️ **`nvm use 24`** avant toute commande de test. **`packages/shared` est à 100 %** : TDD strict.

**Ce lot est le moins risqué des trois derniers**, et pour une raison mesurable : `run/summary.tsx`
**décode déjà la trace et calcule déjà les splits** (l.225 et l.238). Trois des quatre analyses sont
donc du calcul pur sur un tableau **déjà en mémoire** — pas une requête, pas un décodage.

## 1. Ordre de build

Du plus contraint au plus libre. **Les zones d'abord** : elles portent la seule décision de conception
du lot (D1), et deux analyses en dépendent. Si la partition est fausse, autant le savoir avant
d'écrire ce qui la consomme.

```
Lot 1   Le modèle de zones d'allure          shared    D1 — porte la décision, 2 analyses en dépendent
Lot 2   RUN-11 negative split                shared    calcul pur sur les splits
Lot 3   RUN-20 fade (quartiles)              shared    idem
Lot 4   RUN-17 distribution par zone         shared    consomme le lot 1
Lot 5   RUN-08 polarisation (requête)        mobile    la SEULE requête neuve
Lot 6   Les surfaces (résumé + historique)   mobile
Lot 7   i18n FR + EN
Lot 8   Vérification + suivi
```

---

## Lot 1 — Le modèle de zones (D1)

**Fichier neuf** : `packages/shared/src/pace-zones.ts` + test.

```ts
export const PACE_ZONES = ['vma', 'seuil', 'tempo', 'endurance', 'recuperation'] as const;
export type PaceZone = (typeof PACE_ZONES)[number];

/**
 * Classe une allure (s/km) dans sa zone, depuis l'allure de référence 5 km.
 * `null` si la référence est absente — aucune zone n'est calculable (spec R4).
 */
export function paceZoneOf(paceSPerKm: number, ref5kPaceSPerKm: number | null): PaceZone | null;

/** Les bornes des 5 zones, dérivées de `sessionTargetPace`. Aucun nombre neuf (D1). */
export function paceZoneBounds(ref5kPaceSPerKm: number): Record<PaceZone, { maxSPerKm: number }>;
```

🔴 **La règle qui tient ce lot** : les bornes se **dérivent** de `sessionTargetPace` et de
`derivedVmaPace`, elles ne se recopient pas en littéraux. Un test le prouve en changeant la référence
et en vérifiant que **toutes** les bornes suivent. Recopier `ref + 60` en dur marcherait aujourd'hui
et divergerait au premier ajustement de `sessionTargetPace` — sans que rien n'échoue.

⚠️ **Une allure plus rapide est un nombre plus PETIT** (secondes par km). C'est le piège de tout ce
lot : `paceSPerKm < vma` signifie « plus rapide que la VMA ». Chaque comparaison doit être relue avec
ça en tête, et deux tests l'exercent explicitement.

| # | Cas | Attendu |
|---|---|---|
| 1 | Référence `null` | `null` — pas de zone |
| 2 | Allure = `ref × 0,95` (VMA pile) | `seuil` (borne inclusive côté lent) |
| 3 | Allure plus rapide que la VMA | `vma` |
| 4 | Allure = `ref` pile | `tempo` |
| 5 | Allure = `ref + 60` | `endurance` |
| 6 | Allure = `ref + 90` | `recuperation` |
| 7 | Allure très lente (marche) | `recuperation`, pas d'erreur |
| 8 | **Les 5 zones couvrent tout** : balayage de `vma/2` à `ref × 3` | jamais `null` avec une réf |
| 9 | Changer `ref` de 300 à 360 | **toutes** les bornes bougent proportionnellement |
| 10 | Allure ≤ 0 ou non finie | `null` — jamais une zone inventée |

---

## Lot 2 — RUN-11, negative split

**Fichier neuf** : `packages/shared/src/split-balance.ts` + test.

```ts
/** Tolérance d'égalité, en % de l'allure de la 1ʳᵉ moitié. Sous ce seuil : « even » (D4). */
export const EVEN_SPLIT_TOLERANCE_PCT = 2;
/** Kilomètres pleins minimum — sous 2, il n'y a pas deux moitiés. */
export const MIN_KM_FOR_SPLIT_BALANCE = 2;

export type SplitVerdict = 'negative' | 'even' | 'positive';
export type SplitBalance = {
  verdict: SplitVerdict;
  firstHalfPaceSPerKm: number;
  secondHalfPaceSPerKm: number;
  /** Écart en % — négatif = 2ᵉ moitié plus rapide. Le chiffre que la carte affiche (R2). */
  deltaPct: number;
} | null;

export function computeSplitBalance(splits: ReadonlyArray<KmSplit>): SplitBalance;
```

⚠️ **Nombre impair de km : le km central va à la 1ʳᵉ moitié.** Arbitraire, donc **figé par un test**
et écrit dans la spec (§4) — sans quoi la prochaine lecture du code hésitera et pourra l'inverser en
croyant corriger un bug.

| # | Cas | Attendu |
|---|---|---|
| 1 | 0 ou 1 km | `null` |
| 2 | 2 km, 2ᵉ plus rapide de 10 % | `negative`, `deltaPct` ≈ −10 |
| 3 | 2 km, 2ᵉ plus lent de 10 % | `positive` |
| 4 | 2 km identiques | `even`, `deltaPct` = 0 |
| 5 | Écart de 1 % (sous tolérance) | `even` |
| 6 | Écart de 3 % (au-dessus) | verdict tranché |
| 7 | **5 km** (impair) | le 3ᵉ km compte dans la 1ʳᵉ moitié — figé |
| 8 | Un split à 0 s (donnée absurde) | `null`, jamais une division par zéro |
| 9 | Le seuil est exporté | `EVEN_SPLIT_TOLERANCE_PCT === 2` |

---

## Lot 3 — RUN-20, fade

**Fichier neuf** : `packages/shared/src/pace-fade.ts` + test.

```ts
/** Distance minimale (km pleins) au-delà de laquelle la dérive a un sens (D2). */
export const FADE_MIN_DISTANCE_KM = 10;

export type PaceFade = {
  /** % de perte du 1ᵉʳ au dernier quart. Positif = ralentissement. */
  fadePct: number;
  firstQuarterPaceSPerKm: number;
  lastQuarterPaceSPerKm: number;
} | null;

export function computePaceFade(splits: ReadonlyArray<KmSplit>): PaceFade;
```

**Quarts et non kilomètres** (R6) : comparer le 1ᵉʳ km au dernier serait à la merci d'un feu rouge.
Les quarts se découpent par `Math.floor(n / 4)` km à chaque bout — le reste central est ignoré, ce qui
est exactement l'intention.

| # | Cas | Attendu |
|---|---|---|
| 1 | Moins de `FADE_MIN_DISTANCE_KM` km | `null` |
| 2 | 12 km, allure constante | `fadePct` ≈ 0 |
| 3 | 12 km, dernier quart 10 % plus lent | `fadePct` ≈ +10 |
| 4 | 12 km, dernier quart plus **rapide** | `fadePct` **négatif**, pas plafonné à 0 |
| 5 | Un seul km très lent **au milieu** | n'affecte **pas** le fade — c'est le point de R6 |
| 6 | 10 km pile (borne) | calculé, borne inclusive |
| 7 | Splits à 0 s | `null` |
| 8 | Le seuil est exporté | `FADE_MIN_DISTANCE_KM === 10` |

---

## Lot 4 — RUN-17, distribution par zone

**Fichier neuf** : `packages/shared/src/pace-zone-mix.ts` + test.

Classe chaque km via `paceZoneOf` et rend les parts. **Reprend la mécanique d'arrondi de
`computeSetTypeMix`** (EXEC-01) : les parts somment à 100, reliquat sur la plus grosse.

⚠️ **Ne pas réécrire cette mécanique** : elle est déjà testée et son piège (33+33+33 = 99) déjà
documenté. Soit on la factorise, soit on la reproduit à l'identique **avec** ses tests. Le plan
recommande de **factoriser** un helper `sharesOf<T>()` et de faire suivre les deux appelants — un
même arrondi implémenté deux fois divergera.

| # | Cas | Attendu |
|---|---|---|
| 1 | Aucun split | `null` |
| 2 | Référence `null` | `null` — R4, l'écran affiche le remède |
| 3 | 4 km en endurance | 100 % `endurance` |
| 4 | 3 zones à parts égales | somme = **100** |
| 5 | Tri | de la zone la plus représentée à la moins |
| 6 | Zones vides | **absentes** du résultat, pas à 0 % |
| 7 | Refactor : `computeSetTypeMix` inchangé fonctionnellement | ses 11 tests passent toujours |

---

## Lot 5 — RUN-08, polarisation (la seule requête neuve)

**Fichier modifié** : `run-repository.ts` (ou `records-repository.ts` selon où vivent les stats
running — **à vérifier avant d'écrire**, ne pas créer un troisième endroit).

```sql
SELECT r.gps_track, r.distance_m
FROM runs r
WHERE r.status = 'completed' AND r.deleted_at IS NULL
  AND r.started_at >= ?
  AND r.gps_track IS NOT NULL
ORDER BY r.started_at ASC
```

**Moteur** : `packages/shared/src/pace-polarisation.ts`. Agrège les zones de **toutes** les courses de
la fenêtre en deux groupes : faible intensité (`endurance` + `recuperation`) et haute (`tempo` +
`seuil` + `vma`).

🔴 **Pondération par kilomètres, pas par courses** (R9) : une sortie de 20 km doit peser 4 fois un
5 km. Compter les courses donnerait le même poids à chacune et rendrait le 80/20 ininterprétable.
Test dédié — c'est l'erreur la plus facile à commettre ici.

⚠️ **Coût à surveiller** : décoder les traces de 4 semaines de courses à chaque rendu de l'historique.
Le `useMemo` doit dépendre des **lignes**, pas d'un objet reconstruit à chaque passe. Si la mesure
montre un ralentissement en recette, la parade est de borner le nombre de courses décodées et de
**le dire** à l'écran — jamais de tronquer en silence.

| # | Cas | Attendu |
|---|---|---|
| 1 | Aucune course | `null` |
| 2 | 1 course | `null` (R3) |
| 3 | 20 km endurance + 5 km seuil | 80 / 20, **pondéré km** |
| 4 | Même chose comptée par course | **50/50** — le test qui prouve la pondération |
| 5 | Référence absente | `null` (R4) |
| 6 | Courses sans trace | ignorées, sans planter |
| 7 | Parts somment à 100 | figé |

---

## Lot 6 — Les surfaces

**`apps/mobile/src/app/run/summary.tsx`** (845 lignes) — trois cartes.
🔴 **Réutiliser `splits`, déjà calculé l.238.** Un second `decodeTrack` doublerait le coût du plus
gros calcul de l'écran pour rien ; la DoD le vérifie.

**`apps/mobile/src/app/running-history/index.tsx`** (654 lignes, 6 sections) — une section de plus,
au patron des existantes. Elle rend `null` quand la polarisation se tait.

⚠️ **La carte des zones affiche l'indisponibilité et son remède** quand l'allure de référence manque
(R4), avec un lien vers le profil coureur. Patron de `StrengthSection` (MUSCPWR-01 R6) : jamais un
« — ». **Ne pas** se contenter de masquer la carte, sinon l'utilisateur ne saura jamais qu'il lui
manque un réglage.

Accessibilité dès l'écriture : chaque carte annoncée d'un bloc avec son chiffre, hauteurs libres
(police 1,5×), contrastes AA clair et sombre.

---

## Lot 7 — i18n

Clés du §6 de la spec, FR + EN symétriques. Les allures passent par **`useUnits().formatPace`**, déjà
en place — ne pas écrire un second formateur (il gérerait mal l'impérial).

---

## Lot 8 — Vérification

```bash
nvm use 24
npm run typecheck && npm run lint && npm run test:coverage
```

Codes de sortie **sans pipe**, et **3 workspaces séparément** (le run agrégé a déjà renvoyé un faux
255 le 07/08/2026).

Puis : catalogue (RUN-11, RUN-20, RUN-17, RUN-08 → ✅), CHANGELOG, front-matter, roadmap **5.35**,
RECETTES.md, ETAT.

## 2. Fichiers touchés

**Neufs** : `pace-zones.ts` · `split-balance.ts` · `pace-fade.ts` · `pace-zone-mix.ts` ·
`pace-polarisation.ts` (+ 5 tests) · 1 test SQL

**Modifiés** : `packages/shared/src/index.ts` · le repository running (+ test SQL) ·
`app/run/summary.tsx` · `app/running-history/index.tsx` · `i18n/locales/*.json` · catalogue · roadmap
· éventuellement `set-type-mix.ts` (factorisation de l'arrondi)

**Non touchés, et c'est un résultat** : `insights.ts`, `insights-repository.ts`, le registre
d'accueil, `powersync/schema.ts`, `supabase/migrations/`, ADR-007.

## 3. Risques

| Risque | Parade |
|---|---|
| 🔴 **Une allure plus rapide est un nombre plus PETIT** — inversion de comparaison | Deux tests explicites au lot 1 ; le piège est nommé dans le fichier |
| 🔴 **Polarisation pondérée par courses** au lieu de kilomètres | Test 4 du lot 5, écrit pour échouer sur cette erreur précise |
| 🔴 **Bornes de zones recopiées en dur** au lieu d'être dérivées | Test 9 du lot 1 : changer `ref` doit déplacer **toutes** les bornes |
| Second `decodeTrack` sur le résumé | Réutiliser `splits` (l.238) ; vérifié en DoD |
| Arrondi des parts implémenté deux fois → divergence | Factoriser `sharesOf` et faire suivre `computeSetTypeMix` avec ses tests |
| Km central d'un nombre impair inversé par une relecture | Figé par test + écrit en spec §4 |
| Carte de zones simplement masquée sans le remède | R4 + critère de recette 8 |
| Coût de décodage sur 4 semaines | `useMemo` sur les lignes ; si mesuré lent, borner **et le dire** |
| `FADE_MIN_DISTANCE_KM` mal calibré | Constante exportée + critère de recette 22 (jugement de pratiquant) |
| Conflit de merge sur les écrans running | Damien est sur `chore/socle-tests-unitaires`, dont le §8 vise `run/active.tsx` et `running-history/` 🔴 **à recouper avant le lot 6** |
