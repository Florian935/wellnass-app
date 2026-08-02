---
id: RUN-F2c
titre: "Blocs fractionné / intervalles"
roadmap: [5.9]
catalogue: []
etape: recette
branche: feature/runf2c-blocs-fractionne
maj: 03/08/2026
---

# US RUN-F2c — Blocs fractionné / intervalles

> **3ᵉ des 4 candidats issus du découpage de RUN-F2** (BACKLOG.md), après RUN-F2a (annonces
> audio, livrée) et RUN-F2b (cible en direct, livrée). Roadmap 5.9 : « Blocs rapides / récupération
> (ex. 6×400 m à 95 % VMA). » **Le plus gros morceau des quatre** — cartographie du 02/08/2026 :
> aucune notion de bloc n'existe nulle part (ni colonne, ni table, ni éditeur admin, ni éditeur
> mobile). `session_type='fractionne'` n'est aujourd'hui qu'une étiquette parmi 5, avec une plage
> d'allure globale calculée (`sessionTargetPace`), sans structure de répétitions.

## 0. Le patron de référence : `exercise_plans`, pas un modèle inventé

Le projet a déjà **exactement** ce besoin côté musculation : une séance a une liste ordonnée
d'éléments structurés (`exercise_plans`, `session_id` + `order_index`), chacun avec ses propres
cibles (`target_sets`, `target_reps`, `target_weight_kg`). Un exercice « 3 séries de 10 » est **une
seule ligne** avec `target_sets=3`, pas 3 lignes répétées. RUN-F2c reproduit ce patron à
l'identique pour le fractionné : **une ligne = un bloc de répétitions**, avec un compteur `reps`,
plutôt que d'expanser chaque répétition en ligne séparée ou d'inventer un format différent.

« 6×400 m à 95 % VMA avec 200 m de récup » devient donc **une seule ligne** :
`reps=6, fast_distance_m=400, fast_pace_pct_vma=95, recovery_distance_m=200`. Un échauffement (« 1
km facile ») est aussi une ligne, avec `reps=1` et aucune récup. Une séance peut avoir plusieurs
lignes dans l'ordre (échauffement → série principale → retour au calme), exactement comme une
séance muscu enchaîne plusieurs exercices.

## 1. Le modèle de données

**Nouvelle table `session_intervals`** (miroir structurel d'`exercise_plans`) :
- `id`, `session_id` (FK `sessions`), `owner_id`, `order_index`.
- `reps integer not null default 1` — nombre de répétitions du couple rapide/récup, **toujours
  ≥ 1** (un bloc décrit au moins un passage).
- `fast_distance_m integer` / `fast_duration_seconds integer` — **exactement l'un des deux**
  (jamais les deux, jamais aucun — même règle que `hasRunningSessionTarget` déjà utilisée pour la
  cible globale d'une séance, appliquée ici par bloc). **Vérifiée côté application uniquement**,
  pas par une contrainte SQL — même niveau d'exigence que `hasRunningSessionTarget` aujourd'hui
  (la migration `sessions` actuelle n'a elle-même aucun CHECK de ce type) ; pas une inconsistance
  introduite par cette US, un choix déjà en place que RUN-F2c reconduit à l'identique.
- `fast_pace_pct_vma integer` — pourcentage de VMA visé pour la phase rapide, **nullable** (un
  échauffement n'a pas de cible d'allure précise).
- `recovery_distance_m integer` / `recovery_duration_seconds integer` — **la récupération est
  entièrement optionnelle** (les deux `null` = pas de récup, ex. échauffement/retour au calme) ;
  si l'une des deux est renseignée, l'autre doit être absente (même règle que la phase rapide).
- `created_at`, `updated_at`, `deleted_at`.

**Pourquoi une allure relative (%VMA) et non une allure absolue (s/km)** : la VMA est déjà dérivée
de l'allure de référence 5 km (`derivedVmaPace`, `running-paces.ts`), elle-même mise à jour
automatiquement à chaque record battu (RUN-04, roadmap 5.31). Stocker un pourcentage relatif fait
que la cible du bloc **s'actualise automatiquement** avec la progression du coureur, sans jamais
devenir une valeur figée et périmée — cohérent avec `sessionTargetPace` qui fonctionne déjà ainsi
pour la plage globale d'un type de séance.

**Étendue au fractionné uniquement** : les blocs ne sont éditables/affichés que pour
`session_type='fractionne'`. Les autres types (endurance, sortie longue, récupération) gardent
inchangée la cible globale simple (distance/durée) — pas de blocs pour eux, ce n'est pas leur usage.

**Coexistence avec la cible globale de séance** : `target_distance_m`/`target_duration_seconds`
(déjà sur `sessions`) restent **inchangés, additifs, jamais forcés à vide**. Une séance fractionné
avec des blocs peut aussi avoir une cible globale (ex. distance totale approximative de la séance,
utile pour RUN-F2b/la comparaison en direct) — les deux coexistent, aucune règle de cohérence
automatique entre elles en V1 (pas de somme des blocs qui écraserait la cible globale saisie).

## 2. Ce qui existe déjà, réutilisé tel quel

- `insertWithSyncFields`/`patch`/`softDelete`/`nextOrderIndex`/`txInsert` (`_sql.ts`) : les mêmes
  primitives que `program-repository.ts` utilise déjà pour `exercise_plans`.
- `derivedVmaPace(ref5kPaceSPerKm)` (`running-paces.ts`) : pace estimée à 100 % VMA, déjà là.
- `SortableList` (admin, `apps/admin/src/components/`) : composant de réordonnancement drag & drop
  déjà utilisé pour `exercise_plans` — réutilisé tel quel pour les blocs côté admin.
- `SessionDetail`/`PlanItem` (`program-repository.ts`) : patron de type à étendre
  (`intervals: IntervalBlockItem[]`), pas à réinventer.

**Seule fonction pure neuve** : `paceAtVmaPercent(vmaPaceSPerKm, pct)` (`running-paces.ts`) —
`vmaPaceSPerKm / (pct / 100)`. Un pourcentage de VMA **inférieur** à 100 donne une allure **plus
lente** (chiffre s/km plus grand) : courir à 95 % de sa vitesse maximale, pas 95 % de son allure.
Testée avec les valeurs déjà connues du fichier (`running-paces.test.ts`) pour rester cohérente.

## 3. Les règles

**R1 — Une ligne = un bloc de répétitions, jamais une ligne par répétition individuelle** (spec §0).

**R2 — Phase rapide : exactement une des deux cibles (distance ou durée), jamais les deux, jamais
aucune.** Même règle que `hasRunningSessionTarget` pour la cible de séance, appliquée par bloc.

**R3 — Récupération entièrement optionnelle ; si présente, exactement une des deux cibles.** Un
bloc sans récup (`recovery_distance_m`/`recovery_duration_seconds` tous deux `null`) est valide —
c'est le cas d'un échauffement ou d'un retour au calme.

**R4 — `fast_pace_pct_vma` est nullable, jamais une valeur inventée par défaut.** Un bloc
d'échauffement n'a pas de cible d'allure précise — l'absence est un vrai état, pas une donnée
manquante à combler (convention « absent, jamais zéro » déjà établie ce jour).

**R5 — Blocs limités au type `fractionne`.** Changer le type de séance d'une séance fractionné
avec des blocs vers un autre type **ne supprime pas** les blocs existants (soft-supprimés
seulement à la suppression explicite ou de la séance) — ils redeviennent simplement invisibles/
non pertinents tant que le type reste différent, cohérent avec le principe offline-first de ne
jamais perdre de données silencieusement sur un changement de champ adjacent.

**R6 — Pas de réordonnancement côté mobile, comme `exercise_plans` aujourd'hui.** L'ordre d'ajout
est l'ordre final sur mobile (patron déjà établi, ni la muscu ni le running mobile ne
réordonnent) ; seul l'admin réordonne (déjà équipé de `SortableList`).

**R7 — Aucune règle de cohérence automatique entre les blocs et la cible globale de séance.** Pas
de somme calculée qui écraserait `target_distance_m` (spec §1, coexistence) — une US future
pourrait proposer un calcul suggéré, pas celle-ci.

## 4. Ce qui est explicitement hors périmètre

- **Guidage vocal / annonce de changement de bloc pendant la course** — RUN-F2d, candidat
  distinct, dépend de celle-ci (blocs) et de RUN-F2a (vocal).
- **Écran d'aperçu de la séance juste avant de démarrer** — n'existe pour aucun type de séance
  aujourd'hui (cartographie du 02/08 : `run/index.tsx` ne montre aucun contenu avant de lancer le
  tracker) ; l'ajouter serait un chantier transverse, pas spécifique aux blocs.
- **Réordonnancement des blocs côté mobile** (R6).
- **Calcul suggéré de cible globale à partir des blocs** (R7).
- **Validation stricte empêchant des répétitions sans récup** — laissé à l'appréciation de
  l'utilisateur/coach (cohérent avec l'absence de validation similaire côté muscu).

## 5. Surfaçage

- **Édition mobile** (`RunningSessionEditor.tsx`, ou composant dédié `IntervalBlockEditor` monté à
  côté quand `sessionType === 'fractionne'`) : liste des blocs, ajout (valeurs par défaut
  raisonnables : reps=1, pas de récup), édition inline par bloc (commit au blur, même patron que
  `ExercisePlanEditor`), suppression.
- **Édition admin** (`ProgramEditScreen.tsx`, branche `isRunning` de `SessionCard`) : bouton
  d'ajout d'un bloc + `SortableList` des blocs (avec édition inline et suppression par ligne)
  quand `sessionType === 'fractionne'` — même patron complet (ajout/édition/suppression/
  réordonnancement) que la liste d'exercices muscu, pas seulement le réordonnancement. Point
  d'attention relevé en relecture : la branche `isRunning` de `SessionCard` est aujourd'hui un
  simple bloc de 3 champs sans aucune liste (`if/else` mutuellement exclusif avec la branche
  muscu) — le `SortableList` de blocs y est une intégration nouvelle, pas un ajout à côté d'un
  mécanisme de liste déjà présent dans cette branche.
- **Affichage lecture seule** : `RunningSessionCard` (détail programme,
  `running-programs/[id].tsx`) et `PlanSessionCard` (`planning/plan.tsx`) affichent la liste des
  blocs sous les chips existants (type/cible/allure), quand des blocs existent — sinon rien de
  nouveau (comportement actuel inchangé pour une séance fractionné sans bloc défini).

## 6. i18n

Nouvelle famille `running.intervals.*`, FR + EN :
- `title` — « Structure de la séance » / « Session structure ».
- `blockSummary` — « {{reps}} × {{fastLabel}} à {{pct}} % VMA, récup {{recoveryLabel}} » (variante
  sans `{{pct}}` si pas de cible d'allure, variante sans la partie récup si absente — 3-4
  gabarits à trancher au plan selon les combinaisons réellement possibles).
- `addBlock` — « Ajouter un bloc » / « Add a block ».
- `reps`, `fastPhase`, `recoveryPhase`, `pctVma` — libellés de champs de l'éditeur.

## 7. Comportement offline

**Total.** Même patron que `exercise_plans` : écriture PowerSync locale immédiate, synchro en
arrière-plan. Aucune sync rule à redéployer si `sessions`/nouvelle table sont en `select *` (à
vérifier au plan).

## 8. Accessibilité

Chaque ligne de bloc dans l'éditeur et dans l'affichage lecture seule est un ensemble cohérent
(répétitions + phase rapide + récup), même exigence de regroupement que les autres blocs
d'affichage de cette session de travail (META-19, RUN-18).

## 9. Critères de recette

- [ ] 1. Ajouter un bloc « 6×400 m, 95 % VMA, récup 200 m » à une séance fractionné, le retrouver
      affiché correctement sur l'écran de détail du programme.
- [ ] 2. Un bloc échauffement (reps=1, distance seule, pas de %VMA, pas de récup) s'affiche sans
      ligne d'allure ni de récup vide.
- [ ] 3. Changer le type de séance de fractionné vers endurance masque les blocs sans les
      supprimer ; revenir à fractionné les fait réapparaître intacts.
- [ ] 4. Réordonner les blocs dans l'admin persiste l'ordre ; l'app mobile affiche le nouvel ordre
      sans permettre de le modifier elle-même (R6).
- [ ] 5. Supprimer un bloc côté mobile ou admin ne supprime pas les autres blocs de la même séance.
- [ ] 6. **Mode avion** : ajout/édition/suppression de blocs fonctionne normalement côté mobile.
- [ ] 7. En **EN** : les gabarits de résumé de bloc (avec/sans allure, avec/sans récup) sont tous
      grammaticaux.
- [ ] 8. TalkBack énonce chaque bloc comme un ensemble cohérent.
