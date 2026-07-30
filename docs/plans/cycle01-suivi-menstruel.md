# Plan — CYCLE-01 · Suivi du cycle menstruel

Spec : [cycle01-suivi-menstruel.md](../specs/functional/us/cycle01-suivi-menstruel.md) · branche
`feature/cycle01-suivi-menstruel` · roadmap **1.25 / 1.26**.

> **US large** (~30 h) : 2 tables, 4 surfaces, une intégration Health Connect et une catégorie de
> données sensible. Le découpage ci-dessous est fait pour que **chaque étape soit livrable seule** —
> si l'arbitrage change en cours de route, on s'arrête à une étape cohérente plutôt qu'au milieu.

## Étape 0 — Les deux démarches externes, lancées AVANT le code *(humain)*

⚠️ **À déclencher le jour où la spec est validée, pas quand le code est fini.** Ces deux délais sont
sur le chemin critique de la publication ; les lancer en retard, c'est les payer deux fois.

1. Étendre la **déclaration Health apps** à 6 types (textes de justification prêts, spec §4) →
   [health-connect-play-declaration.md](../specs/technical/health-connect-play-declaration.md).
2. Envoyer le **paragraphe cycle** de la politique de confidentialité à la relecture juridique, avec
   le reste des textes — un seul aller-retour.

## Étape 1 — Le socle de données *(≈ 4 h)*

- `npm run db:new cycle01_menstrual_tracking` → les 2 tables de la spec §2, avec RLS par `user_id`,
  index sur `(user_id, started_on)` et `(user_id, log_date)`, unicité partielle sur
  `(user_id, log_date) where deleted_at is null`.
- `npm run db:push` → `npm run db:types` → **cocher** [MIGRATIONS.md](../../supabase/MIGRATIONS.md).
- 🔴 **Ajouter les 2 tables à [powersync-sync-rules.yaml](../specs/technical/powersync-sync-rules.yaml)
  et redéployer dans le dashboard PowerSync.** Étape **manuelle**, déjà oubliée une fois — sans elle
  la recette échouera pour une raison sans rapport avec le code.
- Déclarer les tables dans `powersync/schema.ts`.
- **Ajouter les 2 tables à `EXPORT_TABLES`** ([data-export.ts](../../apps/mobile/src/lib/data-export.ts),
  28 → 30) — R18, c'est une obligation RGPD, pas une finition.

## Étape 2 — Les calculs purs, avant toute UI *(≈ 5 h)*

`packages/shared/src/menstrual-cycle.ts` — **tout le raisonnement de cette US vit ici**, testable sans
device. Tests écrits **d'abord**.

| Fonction | Règle | Test qui compte |
|---|---|---|
| `closeOpenPeriod(periods, newStart)` | R2 | nouveau début sans clôture → l'ancienne se clôt la veille |
| `autoCloseStalePeriods(periods, today)` | R3 | ouverte depuis 16 j → close à J+15, marquée |
| `cycleLengths(periods)` | R5 | intervalle **début → début**, pas fin → début |
| `usableCycleLengths(lengths)` | R6 | 120 j **exclu du calcul**, mais renvoyé comme « ignoré » |
| `predictNextPeriod(periods)` | R8/R9/R10 | 2 cycles → `null` · 3 réguliers → date **+ écart-type** · écart-type > 7 j → **pas de date** |
| `phaseForDate(date, periods, avgLength)` | R12 | J1 = menstruelle ; jour sans donnée → `null`, jamais une phase inventée |
| `crossPhaseAverages(phaseDays, metric)` | R13/R14 | sous le seuil → `insufficient`, jamais une moyenne sur 4 points |

⚠️ **Aucune de ces fonctions ne formule de phrase.** Elles renvoient des nombres et des états ; les
libellés vivent dans l'i18n. C'est ce qui garantit qu'on peut relire toutes les formulations d'un
coup (critère de recette 14) sans fouiller le calcul.

## Étape 3 — Repository + réglage opt-in *(≈ 3 h)*

- `menstrual-repository.ts` sur le patron de `daily-wellbeing-write` : UUID client, UTC, soft delete,
  paramètres liés, `user_id` sur toute écriture.
- Réglage `cycleTrackingEnabled` dans `user_settings`, **`false` par défaut**, sans filtre sur `sex`
  (R16). Désactivé ⇒ **aucune écriture possible**, garde au niveau repository et non seulement en UI.
- Désactivation → proposition de suppression (R17).

## Étape 4 — Journal et calendrier *(≈ 6 h)*

Écran `app/cycle/index.tsx` : calendrier mensuel, saisie du jour (flux + symptômes), historique.
Réutiliser les composants existants ; **ne pas** introduire de librairie de calendrier — la grille de
7 jours du planning est un patron déjà présent.

Le bandeau d'avertissement (§0 de la spec) est posé ici, **visible sans défilement**.

## Étape 5 — Prédiction *(≈ 3 h)*

Affichage seul — le calcul est fait à l'étape 2. Les 3 états sont distincts : *pas assez de cycles* ·
*estimation avec fourchette* · *trop irrégulier pour estimer*. **Aucune notification** (R11).

## Étape 6 — Croisement *(≈ 6 h)*

Lit `daily_wellbeing`, `workouts`, `runs`, `food_entries` **déjà présents** (R15) et les regroupe par
phase. Chaque bloc a son état « pas assez de données », et le vérifier **par métrique** : l'énergie
peut être exploitable quand la performance ne l'est pas encore.

## Étape 7 — Health Connect *(≈ 4 h)*

- 2 permissions dans `app.json` → **`expo prebuild` puis nouveau build** (permissions natives).
- Lecture/écriture `MenstruationPeriod` + `MenstruationFlow` dans `lib/health-connect.ts`.
- Déduplication sur `started_on`, `source` distingue l'origine, **la saisie manuelle gagne** (R21).
- Double opt-in (R20). Permission refusée → le journal marche normalement (critère 17).

## Étape 8 — Solde *(≈ 1 h)*

Roadmap **1.25 / 1.26** (lignes à créer) · retrait d'IDEAS.md si l'idée y est déposée · mise à jour de
[lance00-fiche-play-et-confidentialite.md](../specs/technical/lance00-fiche-play-et-confidentialite.md)
(§3 formulaire + politique) · CHANGELOG + `etat.mjs` via `/commit`.

## Migration / sync rules

**1 migration** (2 tables). **Sync rules à redéployer — obligatoire.**
**Nouveau build requis** (permissions natives Health Connect) : la recette ne se fait **pas** sur
l'APK actuel.

## Risques

- 🔴 **Le ton.** Le risque dominant n'est pas technique. Une formulation qui laisse croire à une
  fiabilité contraceptive est un défaut grave. D'où les calculs sans phrases (étape 2) et le critère 14.
- 🔴 **Délais externes** (étape 0) : ~2 semaines de déclaration Health Connect **en série**. Non
  compressibles.
- 🟠 **L'export RGPD** est facile à oublier et c'est un manquement réglementaire — traité dès l'étape 1.
- 🟠 **Sync rules manuelles** — déjà oubliées une fois sur ce projet.
- 🟢 Offline et calculs : sans risque, tout est pur et local.
