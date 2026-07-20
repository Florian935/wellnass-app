# Analyse du flux — Écran de séance en cours (pré-spec US-C)

> **Document vivant — en cours d'enrichissement.** Base de findings pour la future **US-C** (refonte de
> l'écran de séance en cours, problème 4 de l'[audit](./audit-flux.md)). **Ce n'est pas la spec** : on
> collecte et on croise les retours (Claude + Florian) ; la spec US-C sera rédigée **une fois la liste
> stabilisée**. Date d'ouverture : 19/07/2026.
> **MàJ 19/07/2026 : liste jugée stabilisée** (§1 Claude + §2 compléments Florian + §3 idées UX terrain, tous
> validés Florian) → **prête à passer en spec US-C**.
> Méthode : trace du flux réel (démarrage → suivi → fin → résumé) vs spec [musculation.md §4](../specs/functional/musculation.md).

Fichiers concernés : [workout.tsx](../../apps/mobile/src/app/workout.tsx),
[workout-summary.tsx](../../apps/mobile/src/app/workout-summary.tsx),
[exercises.tsx](../../apps/mobile/src/app/exercises.tsx),
[workout-repository.ts](../../apps/mobile/src/data/repositories/workout-repository.ts).

**Tags** : **[Flux]** logique/navigation · **[Métier]** règle faussée · **[Ergo]** confort (§4 « utilisable d'une main »).

## 1. Findings Claude (analyse du 19/07/2026)

### 🔴 Urgent
1. **[Flux] Abandon destructif sans confirmation.** La croix « ✕ »
   ([workout.tsx:117](../../apps/mobile/src/app/workout.tsx#L117)) → `cancelWorkout` (soft-delete séance +
   toutes les séries) + retour accueil, **sans popup**. Contraire à §4.4 (popup « Abandonner / Pause »).
   Zone du geste retour réflexe → séance perdue en un tap.

### 🟠 Cœur : écran plat vs flux guidé
2. **[Flux/Ergo] Liste plate** de tous les exercices, tous champs ouverts, au lieu d'une **vue exercice /
   série en cours** (§4.3 « Série 2/4 »). Pas utilisable d'une main sur une grosse séance.
3. **[Flux] « Valider la série » = simple coche** (toggle) : pas de progression visuelle, re-clic dé-valide,
   (dé)validation relance/annule le chrono de façon ambiguë. **Pas de « dernière fois : 80 kg × 8/8/7 »**
   (§4.3) → saisie à l'aveugle.
4. **[Ergo] Pas de steppers − / +** pour la charge (§4.3), ni report de la charge sur les séries suivantes.
   Clavier obligatoire. *(Bon point existant : `addSet` pré-remplit depuis la série précédente ;
   la 1ʳᵉ série d'un exercice ajouté en cours est vide.)*

### 🟠 Règles métier faussées
5. **[Métier] Types de séries absents de l'UI** (échauffement/superset/dropset/échec/durée/poids de corps —
   §4.3). `set_type` existe en base mais non exposé → **les séries d'échauffement comptent dans le volume et
   les records** (résumé), alors que §8 les **exclut**. Records potentiellement faussés.
6. **[Métier] Exercice en durée / poids de corps non gérés** dans l'UI (seulement reps + charge) — §3.1.

### 🟠 Fin de séance incomplète
7. **[Flux] « Terminer » saute ressenti ET note.** `onFinish` = `finishWorkout(id)` sans rpe ni notes
   ([workout.tsx:93](../../apps/mobile/src/app/workout.tsx#L93)) → va direct au résumé. §4.4 prévoit un
   **ressenti global (RPE)** + une **note de séance**.
8. **[Flux] Terminer sans aucune série validée** possible (volume 0), sans garde-fou.

### 🟡 Chrono de repos
9. **[Ergo] Repos figé à 90 s** (`REST_SECONDS = 90`, [workout.tsx:23](../../apps/mobile/src/app/workout.tsx#L23)),
   non configurable par exercice (§4.3). Pas de **vibration/alerte** de fin, pas de **prolonger (+15 s)**.

### 🟡 Ajustements en direct & cycle de vie
10. **[Flux] Manquent** (§4.3) : **réorganiser** les exercices, **remplacer** par une variante, **note par
    exercice** persistante (§3.17). ~~Accès démo de l'exercice pendant la séance (§6.3)~~ — **abandonné**
    (décision Florian/Damien, 20/07/2026 : GIF/vidéos de démo écartés, trop complexe pour la valeur apportée ;
    voir [musculation.md §3.3](../specs/functional/musculation.md#33-démonstrations-visuelles-gifvidéo--abandonné)) ;
    retiré du périmètre C3.
11. **[Flux] Pas de « Pause » explicite ni de clôture auto à 3 h** (§4.4/§8). *(Nuance : quitter l'app laisse
    la séance `active` → réapparaît en « Reprendre » ; reprise de facto OK.)*

### 🟡 Résumé
12. [workout-summary.tsx](../../apps/mobile/src/app/workout-summary.tsx) correct (durée, exercices, séries,
    volume, records 🏆) mais : **ressenti absent** (non collecté, pt 7) ; **volume/records incluent
    l'échauffement** (pt 5) ; « exercices » compte les exercices ayant **≥ 1 série même non validée**
    ([:38](../../apps/mobile/src/app/workout-summary.tsx#L38)) ; séance de quelques secondes → « 1 min » (mineur).

## 2. Compléments Florian (19/07/2026)

13. **[Flux/Métier] RPE par série** (par exercice) — pouvoir saisir un RPE **au niveau de chaque série**,
    pas seulement (ou en plus) du ressenti global de fin de séance. → implication données : ajouter `rpe`
    sur `workout_sets` (migration) ; à articuler avec le ressenti global §4.4 (pt 7) lors de la spec.
14. **[Flux] Charge planifiée ET charge réalisée** — distinguer, sur l'écran de séance, la **charge prévue**
    (cible du plan) de la **charge réellement faite**. Aujourd'hui une seule valeur (`workout_sets.weight_kg`,
    pré-remplie depuis `exercise_plans.target_weight_kg` puis écrasée → la cible disparaît). → afficher la
    cible en référence à côté du réalisé, et/ou **figer la charge planifiée** sur la série (snapshot) pour
    comparer prévu vs réalisé. À trancher en spec/brainstorm (affichage seul vs colonne dédiée).

## 3. Idées UX terrain — mise en situation « à la salle » (validées Florian, 19/07/2026)

> Parcours en immersion (téléphone dans une main, entre deux séries, salle bondée). Ces 8 idées enrichissent
> le **workflow d'une séance live** sans redite avec §1/§2. **Toutes validées par Florian.**

15. **[Ergo] Focus sur l'exercice/série en cours + aperçu « à suivre ».** Mettre l'exercice courant en avant
    (au lieu de la liste plate) et annoncer le suivant (« à suivre : développé couché »).
16. **[Ergo] Boutons − / + avec incréments « plaque » (2,5 / 5 kg)** plutôt que clavier (mains moites, rapidité).
    Précise le pt 4.
17. **[Ergo] Repos = gros compte à rebours (quasi plein écran) + vibration**, lançable / prolongeable d'un tap.
    Précise le pt 9 (on ne fixe pas l'écran à la salle).
18. **[Métier/Ergo] Marquer une série « échauffement » en direct, en 1 tap** (sans l'avoir planifiée), auto-exclue
    du volume/records. Angle « live » du pt 5.
19. **[Flux] « Machine prise » : sauter un exercice et y revenir** (réordonnancement à la volée). Précise le pt 10.
20. **[Flux] Superset / circuit** : enchaîner 2 exercices, **repos après la paire** (pas entre les deux). UX du
    type superset (§4.3).
21. **[Ergo] Garder l'écran actif** pendant la séance (keep-awake — existe déjà côté running, spec 2.3 ; absent
    en muscu → l'écran se met en veille entre deux séries et on perd le fil). **[NOUVEAU vs §1/§2]**
22. **[Flux] Suggestion de progression discrète** (« la dernière fois 80×8 → tente 82,5 ou 9 reps », surcharge
    progressive §6.5) — **suggérée, jamais imposée**. **[NOUVEAU vs §1/§2]**

## 4. Suite

- **Liste stabilisée** (22 points : §1 + §2 + §3), tous validés Florian → on peut **rédiger la spec US-C**
  (workflow habituel : spec → plan → design → validation → code). US-C **absorbe** MUSC-F4 / MUSC-F5 / MUSC-F6
  du backlog (voir [TODO.md](../../TODO.md)).
- ⚠️ **Ampleur** : US-C est volumineuse (flux guidé + garde-fous + types de séries + RPE/série + charge
  planifiée/réalisée + repos configurable + réorg/superset/remplacement + pause + keep-awake + fin de séance
  ressenti/note + suggestion de progression). À l'ouverture de la spec, **évaluer un découpage** en sous-US
  cohérentes (ex. cœur flux guidé + garde-fous / saisie enrichie (types, RPE, planifié-réalisé) / ajustements
  en direct / cycle de vie & fin) plutôt qu'une seule US monolithique.
- Rappel de cadrage : US-C n'est pas « ajouter des features » mais **repenser l'écran en flux guidé** avec
  garde-fous. Migrations pressenties : `workout_sets.rpe` (pt 13), éventuellement charge planifiée (pt 14),
  `set_type` déjà présent.
