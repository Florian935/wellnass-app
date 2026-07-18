# Audit des flux — Pilier Musculation

> **Source de vérité du chantier « Refonte Muscu ».** Diagnostic figé — il ne bouge plus ;
> les décisions et l'avancement vivent dans [TODO.md](../../TODO.md) (§ Chantier refonte Muscu).
> Date : 18/07/2026 · Établi par Claude, **problèmes validés par Florian** (liste identique de son côté).
> Méthode : trace des flux de bout en bout, **spec vs code réel** (lecture des écrans + repository).

## 1. Contexte

Le pilier Musculation est le **premier pilier construit** et sert de **référence** aux deux autres
(Running, Nutrition). Les écrans existent tous (programmes, historique, planning, progression,
séance à démarrer), mais **plusieurs flux sont illogiques ou peu intuitifs**. Comme Running réutilise
déjà une partie de ces patrons (planning, hub, activation de programme), les défauts **se propagent**
— d'où l'intérêt de les traiter **avant** d'avancer sur le reste de la roadmap.

Référence spec : [docs/specs/functional/musculation.md](../specs/functional/musculation.md).

**Légende gravité** : **[S]** structurel (défaut d'architecture / de modèle — à corriger avant
propagation) · **[P]** polish (finition, confort).

## 2. Les 5 problèmes

### Problème 1 — [S] Le planning et le logging ne se parlent pas (deux mondes parallèles)

**Constat.** Il existe deux parcours qui ne communiquent pas :
1. **Programme → séance → workout** : logging réel (séries, volume, historique, records).
2. **Planning / calendrier → « Marquer fait / Reporter / Sauter »** : statut passif, **aucun logging**.

- On **ne peut pas démarrer une vraie séance depuis le calendrier** : le modal d'une séance planifiée
  n'offre que Marquer fait / Reporter / Sauter — cf.
  [planning/index.tsx:252](../../apps/mobile/src/app/planning/index.tsx#L252).
- **Faire une vraie séance ne met jamais à jour le calendrier** : `startWorkoutFromSession` rattache le
  workout à `session_id` + `program_id` mais **jamais à la séance planifiée** (`planned_session`), et
  `finishWorkout` ne rebascule aucune séance du planning — cf.
  [workout-repository.ts:381](../../apps/mobile/src/data/repositories/workout-repository.ts#L381) et
  [workout-repository.ts:479](../../apps/mobile/src/data/repositories/workout-repository.ts#L479).

**Conséquence.** Deux façons de « compléter » une séance, avec des états qui divergent : soit
l'historique/volume/records restent vides (« Marquer fait »), soit le calendrier reste « planifié »
puis « manqué » alors que la séance a réellement été faite. Contraire à la spec §4.1 (« démarrer depuis
le calendrier »). **Déjà propagé à Running** (même `planned_session`).

**Roadmap.** Non tracé (3.9 planning ✅, 3.11 séance manquée ✅, 3.24 plan avant démarrage ✅ existent,
mais **jamais le lien** planning ↔ logging). → **Nouveau.**

### Problème 2 — [S] « Activer » vs « Planifier » : deux concepts qui se recouvrent

**Constat.** La spec §2.4 promet : « une fois un programme actif, l'app **génère automatiquement**
les séances dans un calendrier ». En réalité :
- `activateProgram` ne génère **rien** de visible — cf.
  [programs/[id].tsx:63](../../apps/mobile/src/app/programs/%5Bid%5D.tsx#L63) ;
- il faut une action séparée « Planifier » (durée + affectation manuelle de chaque séance à un jour) —
  cf. [planning/plan.tsx](../../apps/mobile/src/app/planning/plan.tsx) ;
- on peut planifier sans activer, et activer sans planifier.

**Conséquence.** Modèle mental confus : « programme actif » ≠ « programme dans le calendrier », sans que
le lien soit lisible. **Même schéma sur Running.**

**Roadmap.** Non tracé comme problème (3.12 un actif à la fois ✅, 3.9 planning auto ✅). → **Nouveau.**

### Problème 3 — [S] L'action la plus utile est enfouie ; la moins structurée est le bouton principal

**Constat.** Le hub muscu ([(tabs)/strength.tsx](../../apps/mobile/src/app/%28tabs%29/strength.tsx))
met en avant un gros bouton **« Séance libre »** + 4 cartes-aperçu. Pour démarrer **la séance planifiée
du jour** : hub → carte Programmes → programme → déplier la carte de séance → « Démarrer la séance »
(**4-5 taps**, bouton planqué dans le pied d'une carte repliée). **Aucun raccourci « séance du jour »**
sur le hub muscu, alors qu'un `TodaySessionCard` existe déjà côté dashboard (7.4).

**Conséquence.** L'action contextuelle forte (« aujourd'hui = tel jour de programme, go ») est absente
de l'accueil du pilier. Dépend du Problème 1 (raccourci du jour = lien planning ↔ séance).

**Roadmap.** Widget dashboard 7.4 ✅, mais rien sur le hub muscu. → **Nouveau.**

### Problème 4 — [S/P] L'écran de séance en cours (cœur de valeur) est en-deçà de la spec §4.3

**Constat.** [workout.tsx](../../apps/mobile/src/app/workout.tsx) affiche une **liste plate** de tous
les exercices, tous les champs ouverts simultanément, au lieu du **flux guidé série par série** de la
spec. Manquent notamment :
- **[S]** « La dernière fois : 80 kg × 8/8/7 » au-dessus de la saisie (§4.3) ;
- **[S]** steppers **− / +** de charge + report sur les séries suivantes ;
- **[S]** types de série (échauffement, superset, dropset, échec, durée, poids de corps) — **le modèle
  porte pourtant `set_type`**, l'UI ne l'expose pas ;
- **[S]** **pause / reprise** (§4.4, reprise sous 4 h) — quitter = annuler et **perdre** la séance ;
- **[P]** repos figé à 90 s (`REST_SECONDS = 90`,
  [workout.tsx:23](../../apps/mobile/src/app/workout.tsx#L23)) au lieu de configurable/exercice + vibration.

À noter : le **pré-remplissage partiel** fonctionne déjà (charge cible + nb de séries repris, reps
laissées vides à dessein) — cf. `startWorkoutFromSession`.

**Nature du problème.** Ce n'est pas « ajouter des features une par une » : c'est **l'architecture de
l'écran (liste plate vs flux guidé) qui est à repenser**.

**Roadmap.** Sous-points **déjà** au backlog en P1 : **MUSC-F4** (3.26 dernière perf, 3.29 vibration,
2.3 écran actif, 6.3 démo), **MUSC-F5** (3.27 types de séries, 3.28 chrono config, 3.32 remplacer
exercice, 3.33 notes, 3.34 RPE, 3.17 note persistante), **MUSC-F6** (3.36 pause, 3.37 clôture auto).
→ **US-C ne les duplique pas : elle les regroupe** sous une refonte de flux qui leur donne un cadre.

### Problème 5 — [S] Pas de templates de séance libre (spec §4.1)

**Constat.** La séance libre repart de **zéro** à chaque fois. Impossible de sauvegarder « mon push
habituel » sans créer un programme complet. Il manque un cran intermédiaire entre « libre » et
« programme structuré » — les *templates de séances (routines réutilisables)* de la spec §4.1.

**Roadmap.** Pas d'item muscu dédié (4.26 = templates nutrition). → **Nouveau (arbitrable).**

## 3. Découpage en US de refonte (validé Florian, 18/07/2026)

| US | Portée | Problèmes | Dépend de | Nature |
|---|---|---|---|---|
| **US-A** | Unifier programme → planning → séance (démarrer depuis le calendrier ; une séance faite met à jour le planning ; clarifier « activer » vs « planifier ») | 1 + 2 | — | Socle |
| **US-B** | Séance du jour en accès direct sur le hub muscu | 3 | US-A | Navigation |
| **US-C** | Refonte du flux de l'écran de séance en cours (**absorbe MUSC-F4 / F5 / F6**) | 4 | — | Le plus gros |
| **US-D** | Templates de séance libre | 5 | — | Arbitrable |

**Ordre proposé** : A → B → C → D. A et B sont structurels et déjà propagés à Running (priorité) ;
C est indépendant mais volumineux ; D est arbitrable.

## 4. Suite

Chaque US suit le **workflow obligatoire** (voir [CLAUDE.md](../../CLAUDE.md)) :
**spec → plan → design → validation (Florian/Damien) → branche → code**. On ne rédige la spec détaillée
d'une US qu'au moment de l'attaquer. Le suivi actif est dans [TODO.md](../../TODO.md)
(§ Chantier refonte Muscu).
