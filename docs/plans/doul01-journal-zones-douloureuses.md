# Plan d'implémentation — DOUL-01

> Spec : [doul01-journal-zones-douloureuses.md](../specs/functional/us/doul01-journal-zones-douloureuses.md)
> Branche : `feature/doul01-journal-zones-douloureuses` · créée depuis `origin/dev` le 06/08/2026
> 4 arbitrages Florian du 06/08/2026 (D1 → D4) **acquis** · 2 décisions de cadrage (D5, D6) à confirmer.

## 0. Ce que ce plan garantit d'emblée

| Question | Réponse |
|---|---|
| Migration base ? | **Oui, trois** — la table `pain_reports`, sa publication, et la colonne d'opt-in |
| Sync rule PowerSync ? | 🔴 **OUI** — table **neuve**. Redéploiement **manuel** sur le dashboard |
| Schéma PowerSync **local** ? | 🔴 **OUI** — table **et** colonne, sinon l'écriture échoue **en silence** |
| Export RGPD à compléter ? | 🔴 **OUI** — donnée de santé : l'omettre est un manquement, pas un oubli |
| Dépendance native neuve ? | ✅ **Non** (`react-native-svg` est déjà là) → **recettable sur l'APK existant** |
| Health Connect ? | ✅ **Non, et c'est le point** — déclaration « Health apps » inchangée, aucun délai Google |
| Nouveau calcul métier ? | Oui : `pain-zones.ts` (fraîcheur, projection, choix du signal) |

⚠️ **`nvm use 24`** avant toute commande de test.

### Le risque réel de ce chantier

**`<BodyMap/>` est en lecture seule, et trois écrans en dépendent.** Vérifié le 06/08/2026 :

```ts
type BodyMapProps = { full: FineMuscle[]; reduced: FineMuscle[] };   // aucun onPress
<Svg … accessible={false}>                                            // aucune a11y par zone
const MUSCLE_PATHS: Record<FineMuscle, string>                        // 10 muscles, 0 articulation
```

Consommateurs : `app/exercises/[id].tsx`, `app/programs/[id].tsx`, `app/review.tsx` — dont **deux
appartiennent à des US en recette** (MUSC-F1b, BILAN-01).

🔴 **On ne rend donc PAS `BodyMap` interactif.** On crée un `PainBodyMap` distinct qui **réutilise la
géométrie** (`MUSCLE_PATHS` simplement exporté) et ajoute ses propres tracés articulaires, sa gestion
du tap et son accessibilité. `BodyMap` garde son API **au caractère près** : zéro risque de
régression sur trois écrans qui marchent, pour le prix d'un fichier de plus.

## 1. Ordre de build

```
Lot 0   Migrations + sync rule + schéma local + export RGPD   à lancer EN PREMIER (délai humain)
Lot 1   Vocabulaire et moteur pur (pain-zones.ts)             shared, TDD strict
Lot 2   Repository + test SQL                                 mobile
Lot 3   PainBodyMap (tracés articulaires, tap, a11y)          mobile — le plus gros morceau d'UI
Lot 4   Écran de saisie + historique                          mobile
Lot 5   Le signal factuel sur la séance planifiée             mobile
Lot 6   Réglage opt-in                                        mobile
Lot 7   i18n FR + EN (18 zones + 3 niveaux)
Lot 8   Vérification, roadmap, RECETTES, archivage IDEAS
```

Le lot 0 d'abord pour la même raison que sur VIE-01 : la sync rule d'une table neuve demande une
action **manuelle** sur le dashboard PowerSync, donc à délai humain. RUN-F2c est bloquée pour l'avoir
gardée pour la fin.

---

## Lot 0 — Migrations, sync rule, schéma local, export RGPD

```bash
npm run db:new doul01_pain_reports
npm run db:new doul01_pain_reports_publication
npm run db:new doul01_pain_journal_opt_in
npm run db:push:dry && npm run db:push && npm run db:types
```

```sql
create table public.pain_reports (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  zone text not null,
  level text not null check (level in ('discomfort', 'pain', 'blocking')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- R2 : une ligne par (jour, zone). Index **partiel** — une ligne soft-deletée ne doit pas empêcher
-- d'en recréer une (patron `daily_wellbeing`, `body_measurements`, `streak_jokers`).
create unique index pain_reports_user_day_zone_uq
  on public.pain_reports (user_id, log_date, zone)
  where deleted_at is null;

create index pain_reports_user_date_idx on public.pain_reports (user_id, log_date desc);
```

> ⚠️ **`zone` sans `CHECK`**, contrairement à `level`. La liste des 18 zones est **applicative** et
> vouée à bouger (D1 l'a déjà étendue une fois) ; un `CHECK` en base imposerait une migration à chaque
> ajout, et surtout **une violation bloquerait la file d'upload PowerSync** si un client d'une version
> plus récente écrivait une zone que le serveur ne connaît pas encore. Même raisonnement que
> `meal_key` sans `CHECK` (REPAS-01) et `food_entries.meal_type` depuis 4.15.
>
> `level` **garde** son `CHECK` : 3 valeurs, fermées par D3, et une valeur inconnue y serait un bug,
> pas une évolution.

**Opt-in** (R7) : `alter table public.user_settings add column if not exists pain_journal_enabled boolean not null default false;`
`default false` — donnée de santé, opt-in strict, comme `cycle_tracking_enabled`.

**Puis les quatre endroits qu'impose une table neuve** (checklist éprouvée sur VIE-01) :

1. 🔴 `powersync-sync-rules.yaml` + **déploiement manuel** sur le dashboard.
2. 🔴 `apps/mobile/src/powersync/schema.ts` — la **table** *et* la **colonne** de `user_settings`.
3. 🔴 `apps/mobile/src/lib/data-export.ts` — **donnée de santé**, l'omettre est un manquement RGPD
   (c'est exactement ce que CYCLE-01 a écrit dans sa spec §178).
4. **Cocher** dans [MIGRATIONS.md](../../supabase/MIGRATIONS.md).

⚠️ Et les **quatre points d'édition de `settings-repository.ts`** que COLLIS-01 avait recensés pour sa
propre colonne : `userSettingsRowSchema` (`packages/shared/src/settings.ts`, avec `.default(false)`),
`database.types.ts` régénéré, puis `SettingsDbRow` / `decode*` / `rowToSettings` / `inputToColumns`.

---

## Lot 1 — Vocabulaire et moteur pur

**Fichier neuf** : `packages/shared/src/pain-zones.ts` (+ `.test.ts`). TDD strict, 100 % instructions.

```ts
/** Les 18 zones (D1). Muscles ET articulations — les douleurs d'entraînement sont surtout articulaires. */
export const PAIN_ZONES = [
  // Muscles — projetables vers FINE_MUSCLES, donc capables de produire un signal.
  'chest','back','shoulders','biceps','triceps','abs','glutes','quadriceps','hamstrings','calves',
  // Articulations — journalisables, mais AUCUN signal : on ne sait pas quel exercice charge un genou.
  'neck','shoulder_joint','elbow','wrist','lower_back','hip','knee','ankle',
] as const;

export const PAIN_LEVELS = ['discomfort', 'pain', 'blocking'] as const;

/** Fraîcheur du signal (R3). Au-delà, la zone sort du signal sans rien effacer. */
export const PAIN_FRESHNESS_DAYS = 7;

/** Niveaux qui déclenchent un signal (D6) — `discomfort` est une courbature, pas une alerte. */
export const SIGNALLING_LEVELS: ReadonlyArray<PainLevel> = ['pain', 'blocking'];

/**
 * Projection **partielle** vers les muscles. Le cœur honnête du dispositif : une zone absente de
 * cette table est journalisable mais **muette**, parce que rien dans nos données ne relie un
 * exercice à une articulation (spec §0.1).
 */
export const PAIN_ZONE_TO_MUSCLE: Partial<Record<PainZone, FineMuscle>>;

export function isSignallingZone(zone: PainZone): boolean;
export function freshPainZones(reports, todayKey): PainReport[];      // R3 + D6
export function pickSessionPainSignal(input: {
  reports; sessionMuscles: FineMuscle[]; todayKey: string;
}): { zone: PainZone; level: PainLevel; daysAgo: number } | null;      // R4 + cas limite « une seule »
```

**Les tests qui portent les règles** (les autres sont mécaniques) :

| Test | Ce qu'il fige |
|---|---|
| `PAIN_ZONES` contient 18 entrées, toutes distinctes | D1 |
| **toute** zone de `PAIN_ZONE_TO_MUSCLE` est dans `PAIN_ZONES`, et sa cible dans `FINE_MUSCLES` | cohérence des deux vocabulaires |
| les 8 articulations **n'ont aucune** projection | §0.2 — le test qui empêche qu'on « corrige » l'asymétrie par erreur |
| `discomfort` ne déclenche jamais | D6 |
| une zone à J-7 déclenche, à J-8 non | R3, borne incluse |
| deux zones sensibles → **une seule**, la plus grave ; à égalité, la plus récente | R4 / §5 |
| zone articulaire `blocking` + séance ciblant tout → `null` | §0.2, le cas le plus contre-intuitif |
| aucune `Date` construite : tout passe par `todayKey` | contrat |

---

## Lot 2 — Repository

`pain-repository.ts` : `usePainReports()`, `useFreshPainZones()`, `reportPain(zone, level, logDate?)`
(**upsert** sur `(log_date, zone)`, R2), `deletePainReport(id)`, `deleteAllPainReports()` (R14).

⚠️ **Ne jamais `void` l'écriture** — c'est ce qui a rendu la panne de CYCLE-01 invisible.

**Test SQL** (patron `real-life-sql.test.ts`, 12 cas) : il prouve que la table est bien dans le schéma
local. Cas à couvrir : upsert du même jour, deux zones le même jour, soft delete, suppression totale.

---

## Lot 3 — `PainBodyMap` ⚠️ le morceau

**Fichier neuf**, `components/body/PainBodyMap.tsx`. `BodyMap.tsx` n'est modifié que pour **exporter
`MUSCLE_PATHS`** — aucune autre ligne.

À produire :

1. **8 tracés articulaires** (`d` SVG) dans le même `viewBox='0 0 112 188'`, au même niveau de détail
   assumé que l'existant (« rectangles à main levée, pas une planche d'anatomie »).
   ⚠️ `shoulders` et `shoulder_joint` doivent être **distinguables visuellement** (critère 4) : le
   deltoïde est une plaque, l'articulation un petit cercle en bout d'épaule.
2. **Le tap par zone** : `<Path onPress>` (supporté par `react-native-svg`), zones de tap élargies
   pour les petites articulations — un poignet de 6 px n'est pas tapable.
3. **L'accessibilité** : le `<Svg>` de `BodyMap` est `accessible={false}`. Ici chaque zone porte
   `accessibilityRole="button"`, son libellé et son état. CONF-07 vient de solder les
   non-conformités WCAG — ne pas en réintroduire sur un écran neuf.
4. **Rendu du niveau** : 3 niveaux = 3 intensités. `BodyMap` n'en a que 2 (`full` / `reduced` à 0,35)
   et sa spec dit « deux niveaux, pas de 3ᵉ (illisible) ». À trancher en maquette : couleur plutôt
   qu'opacité, sinon on retombe sur le problème que MUSC-F1b avait déjà constaté.

---

## Lot 4 — Saisie et historique

Écran `/pain` : schéma (face/dos), sélection du niveau, liste de l'historique (R5 — **la suite des
niveaux, jamais une moyenne**), suppression.

⚠️ Route à déclarer dans `_layout.tsx`. **Leçon PAS-01** : un écran ajouté sans son `Stack.Screen`
n'a pas d'en-tête, et « ni le typecheck ni les tests ne le voient — seul un œil sur l'écran ».

---

## Lot 5 — Le signal

Sur la carte de séance planifiée (muscu). Rend un **fait daté**, `pickSessionPainSignal` décide.
**Aucun bouton** (D2). Réutiliser la requête d'enrichissement des muscles d'une séance planifiée
livrée par COLLIS-01 plutôt que d'en écrire une seconde.

⚠️ **Résolution des libellés par une fonction unique**, jamais `zone` brute — c'est le défaut du
05/08/2026 (« Tu délaisses : back ») qui vivait sur trois surfaces faute d'un point unique.

---

## Lot 6-7 — Opt-in et i18n

Réglage dans la section Suivi, à côté du cycle. 18 zones + 3 niveaux + le signal, FR et EN.
**Test de vocabulaire interdit** (R6) : parcourir les clés `pain.*` et échouer sur « blessure »,
« repos conseillé », « consulte », « guérison » — patron du test équivalent de MUSC-F14.

---

## Lot 8 — Vérification et clôture

```bash
nvm use 24 && npm run typecheck && npm run lint && npm run test
```
⚠️ **Lire les codes de sortie sans pipe.**

Puis : roadmap **1.29** (numéro vérifié libre le 06/08/2026), IDEAS → ✅ promue + archives,
RECETTES §34, `node scripts/etat.mjs`.

## 2. Ce que ce plan ne fait pas

- **Aucune suggestion de substitution** (D4) — il manque l'articulation sollicitée et le schéma de
  mouvement sur `exercises`. Tracé en spec §8, non promis.
- **Aucune écriture Health Connect** — c'est ce qui garde la déclaration « Health apps » à 6 types et
  évite un délai externe.
- **Aucune notification** (R8).
- **Aucune modification de `BodyMap`** hormis un `export`.
- **Aucun conseil, aucun diagnostic** (D2, R6).
