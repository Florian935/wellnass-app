---
id: EXEC-01
titre: "Écart entre le prévu et le réalisé — lot d'analyses d'exécution muscu"
roadmap: [3.58]
catalogue: [MUSC-33, MUSC-26, MUSC-13, MUSC-21]
etape: recette
branche: feature/exec01-prevu-vs-realise
maj: 07/08/2026
---

# EXEC-01 — Écart entre le prévu et le réalisé

> **Lot d'analyses**, pas une fonctionnalité unique. Regroupe **4 items du catalogue** sous un même
> thème et une même section d'écran, parce qu'ils répondent tous à la même question et lisent tous
> les mêmes tables. Les livrer séparément coûterait 4 fois la reprise de contexte pour le même
> résultat.
>
> **Choisi par Florian le 07/08/2026** sur trois pistes proposées, avec un coût connu et accepté :
> **+1 US dans une file de recette déjà à 49**.

## 0. Ce que ça résout

L'app sait dire **ce que tu as fait** (tonnage, volume, records, régularité — 7 sections sur
[progress](../../../../apps/mobile/src/app/progress/index.tsx)). Elle ne sait rien dire de
**l'écart entre ce que tu avais prévu et ce que tu as fait**.

Or c'est là que vit l'information utile pour quelqu'un qui suit un programme : une séance faite à
80 % de la charge prescrite, une prescription systématiquement dépassée (le programme est trop
facile), des séances qui s'allongent de 20 minutes, un exercice favori plus touché depuis six
semaines. Rien de tout ça n'est visible aujourd'hui.

## 1. Le lot — 4 analyses, et une écartée

| Réf | Analyse | Ce qu'elle dit | État vérifié le 07/08/2026 |
|---|---|---|---|
| **MUSC-33** | Prescrit vs réalisé | Taux d'exécution de la charge et des répétitions, par séance et en tendance | 🆕 rien dans `packages/shared` |
| **MUSC-26** | Durée de séance & tendance | Durée moyenne, évolution, séances anormalement longues ou courtes | 🆕 rien |
| **MUSC-13** | Répartition par type de série | Part de normal / échauffement / superset / durée / poids de corps | 🆕 rien |
| **MUSC-21** | Exercices délaissés | Favoris non pratiqués depuis N semaines | 🟡 **moitié déjà livrée** — voir §1.2 |

### 1.1 🔴 MUSC-14 (repos réel vs configuré) sort du lot

**Le catalogue la donne pour faisable ; elle ne l'est pas aujourd'hui.** Le repos configuré existe
(`exercise_plans.rest_seconds`), mais le repos **réel** se déduirait de l'écart entre deux
validations de série — et **`workout_sets` ne porte aucun horodatage de validation**. Vérifié : le
seul `completed_at` du schéma est sur `planned_sessions`, pas sur les séries.

Il reste `created_at` et `updated_at`. S'en servir serait pire que de ne rien faire :
`updated_at` bouge à **chaque édition ultérieure** d'une série. Corriger une charge saisie de
travers trois jours plus tard réécrirait le « repos réel » de la séance, et rien à l'écran ne
permettrait de s'en apercevoir. Une analyse fausse et silencieusement fausse.

**Coût réel pour la faire rentrer** : une migration (`completed_at` sur `workout_sets`) + la colonne
dans `powersync/schema.ts` + l'écriture au moment de la validation. Mais surtout — et c'est ce qui
tranche — **la donnée n'existe pas rétroactivement**. Au lancement, l'analyse serait **vide pour
tout le monde**, et le resterait jusqu'à ce que chacun ait accumulé assez de séances *postérieures*
à la migration. Livrer une carte vide dans un lot dont l'argument est « les données sont déjà là »
n'a pas de sens.

→ À reprendre séparément **si** on décide d'instrumenter la validation de série. La colonne est
utile à autre chose (densité réelle, temps sous tension), donc ce n'est pas de l'énergie perdue.

### 1.2 ⚠️ MUSC-21 est à moitié livrée — on ne garde que la moitié neuve

Le catalogue décrit deux choses sous un seul numéro : « favoris/habituels non faits depuis N sem. »
**et** « groupes non travaillés récemment ». La seconde **existe déjà** — `muscle_neglected` est dans
`INSIGHT_ORDER` et `MuscleBalanceSection` est sur l'écran de progression.

**On ne livre donc que le niveau exercice**, et l'analyse doit explicitement **ne pas** redire ce que
la carte d'équilibre musculaire dit déjà. C'est le genre de doublon que le catalogue produit quand on
le lit comme une liste de courses.

> ⚠️ **Le catalogue n'est pas une source de vérité sur ce qui est livré**, et il le dit lui-même
> (deux réconciliations, **8 lignes corrigées**). Les 4 analyses retenues ont donc été vérifiées
> **dans le code** avant d'entrer dans cette spec, pas seulement lues.

### 1.3 Hors périmètre

- **Le RPE prescrit.** MUSC-33 demande « charge/reps/**RPE** ». Or `exercise_plans` **n'a pas de
  colonne de RPE cible** : il n'y a rien à comparer. On ne compare que ce qui est prescrit (§2.1).
- **Toute prescription nouvelle.** On mesure l'écart, on ne modifie pas les programmes.
- **Toute suggestion.** « Ton programme est trop facile, augmente » est un conseil de coach : hors
  périmètre, même ton que GARDE-01 et DOUL-01 — **on constate, on ne prescrit pas**.
- **Les courses.** Lot muscu uniquement ; l'équivalent running (réalisé vs objectif) est déjà livré
  par RUN-F3 (`compareToTarget`).

## 2. Les règles

### R1 — Quatre moteurs purs, zéro React, zéro base, zéro horloge

Tout vit dans `packages/shared` et reçoit `todayKey` en paramètre. Même discipline que
`selectInsights` et `findSessionConflicts` : lire l'heure dans un hook la ferait geler par React
Compiler dans un slot mount-only.

### R2 — Aucune analyse ne s'affiche sans son chiffre

Reprise de la contrainte d'`InsightCandidate` (INSIGHTS-01 R1) et de `ReviewDecision` (BILAN-01) :
une carte porte toujours les nombres qui la justifient. « Tu suis mal ton programme » ne vaut rien
sans « 78 % de la charge prescrite sur 12 séances ».

### R3 — Sous le seuil de données, l'analyse se tait — elle ne montre pas zéro

Chaque moteur a un **minimum d'observations** en dessous duquel il rend `null`, et l'écran n'affiche
alors rien. Un taux d'exécution calculé sur une séance n'est pas une tendance, c'est un accident.
Zéro est une réponse valable (INSIGHTS-01 R4) ; une moyenne sur n=1 est un mensonge.

### R4 — 🔴 Les séances libres ne comptent pas dans MUSC-33

`workouts.planned_session_id`, `program_id` et `session_id` sont **tous nullables** : une séance
libre n'a aucune prescription. Les inclure au dénominateur ferait chuter le taux d'exécution de
quelqu'un qui s'entraîne beaucoup **hors** programme — soit exactement l'inverse du signal.

Conséquence à afficher : la carte dit **sur combien de séances** elle se prononce, jamais un
pourcentage nu.

### R5 — Une série non faite n'est pas une série ratée

`workout_sets.done` distingue la série **validée** de la série simplement présente. Seules les
séries `done` entrent dans le réalisé. Une séance abandonnée en cours de route ne doit pas produire
un taux d'exécution de 20 % : elle relève de l'assiduité (RegularitySection, déjà livrée), pas de
l'exécution.

### R6 — Les répétitions cibles sont du **texte libre**, et le parsing échoue en silence

Vérifié : `exercise_plans.target_reps` est un `string` nullable, saisi à la main dans
`ExercisePlanEditor` sans validation de format. On y trouvera « 10 », « 8-12 », « 8 à 12 »,
« AMRAP », « max », « 3x10 », et du vide.

La règle : **parsing tolérant, échec silencieux**. Un entier → comparaison directe. Une fourchette
`a-b` → réalisé dans l'intervalle = conforme. **Tout le reste → la série est exclue du calcul des
reps**, sans message et sans être comptée comme un écart. Inventer une interprétation d'« AMRAP »
produirait des écarts fantômes sur les programmes les mieux écrits.

Conséquence assumée : le taux d'exécution des reps porte sur **moins de séries** que celui de la
charge. Les deux dénominateurs sont donc distincts et **tous deux affichés**.

### R7 — La charge prescrite se lit sur la série, pas sur le plan

`workout_sets.planned_weight_kg` **existe déjà** et porte la charge prescrite au moment où la série
a été générée. C'est elle qui fait foi, **pas** `exercise_plans.target_weight_kg` : le plan a pu
changer depuis, et comparer un réalisé d'il y a trois semaines à une prescription modifiée hier
produirait un écart qui n'a jamais existé.

C'est aussi ce qui rend MUSC-33 réalisable sans jointure : la comparaison se fait sur une seule
ligne.

### R8 — « Délaissé » se mesure sur les favoris, et jamais sur ce que dit déjà l'équilibre musculaire

Un exercice est délaissé s'il est dans `exercise_favorites` (non supprimé) et n'apparaît dans aucune
série `done` depuis **N semaines**. Le seuil est une **constante nommée et exportée** — même
discipline que `LEG_SETS_CONFLICT_THRESHOLD` (COLLIS-01) : un seuil enfoui dans une condition ne se
rediscute jamais.

⚠️ **Sans favoris, l'analyse se tait.** On ne se rabat pas sur « les exercices les plus pratiqués » :
ce serait deviner une intention que l'utilisateur n'a pas exprimée.

### R9 — Une séance « anormale » se définit par rapport à soi, pas à une norme

MUSC-26 ne compare à aucune durée idéale. Une séance est signalée longue ou courte par rapport à
**la médiane de l'utilisateur**. La médiane et non la moyenne : une seule séance de 3 h oubliée sans
la fermer tirerait la moyenne et rendrait toutes les autres « courtes ».

### R10 — Les durées nulles ou aberrantes sont écartées avant calcul

`workouts.duration_seconds` est nullable, et une séance oubliée ouverte peut porter une durée de
plusieurs heures. Un plafond et un plancher explicites, nommés, écartent ces lignes du calcul — et
la carte dit **combien** de séances ont été écartées si le nombre n'est pas nul. Le précédent est
documenté : `bestSegmentTimeFromSamples` écrivait un record « NaN seconde » en base (corrigé le
04/08/2026).

## 3. Où ça s'affiche — et pourquoi pas en insight

**Une nouvelle section sur [progress](../../../../apps/mobile/src/app/progress/index.tsx)**, aux
côtés des 7 existantes (ExerciseSection, LifetimeTonnageSection, MuscleBalanceSection,
MuscleVolumeBarChart, RegularitySection, StrengthSection, WeeklyVolumeSection).

🔴 **Et surtout pas en candidats d'insight.** Vérifié : `MAX_INSIGHTS = 3` et `INSIGHT_ORDER` compte
déjà **13 identifiants**, avec un quota par famille. Ajouter 4 candidats à un pool qui n'en montre
que 3 reviendrait à écrire quatre analyses **structurellement invisibles** — et à dégrader la
sélection existante au passage, puisque chaque nouveau candidat prend la place d'un autre.

C'est la leçon d'INSIGHTS-02, qui a dû **dégonfler** l'accueil de 21 à 7 widgets : la place
d'affichage est une ressource rare, et une analyse qu'on ne voit pas n'a pas été livrée.

**Conséquence** : le plafond du Tier 0 n'est pas touché, et le moteur de sélection reste tel quel.

### 3.1 ⚠️ Mais l'écran de progression est déjà au seuil de repli d'ADR-007

Trouvé en implémentant, et **cette spec l'avait négligé** : `progress/index.tsx` porte un commentaire
explicite — « 5ᵉ section de cet écran, **seuil de repli ADR-007 (~4-5 sections) atteint** ». C'est
pour cette raison que **MUSCPWR-01 s'est replié** : sa section « ne sert qu'aux pratiquants de force »
et **rend `null`** tant que rien n'est calculable, « donc elle ne coûte rien aux autres ».

**On suit le même patron, et il tombe juste** : la section EXEC-01 est un composant autonome qui rend
son propre titre et **retourne `null` quand les quatre analyses se taisent**. R3 le donnait déjà
gratuitement — ce qui était une règle de justesse statistique se trouve être aussi la réponse au
plafond d'ADR-007.

Autrement dit : un compte neuf ne voit **aucune** section supplémentaire ; elle n'apparaît que pour
quelqu'un qui a assez d'historique pour qu'elle dise quelque chose. Le coût pour les autres est nul,
au sens littéral.

## 4. Cas limites

| Cas | Comportement |
|---|---|
| Aucune séance de programme | MUSC-33 se tait (R3/R4) — l'utilisateur libre n'a rien à exécuter |
| Séance libre uniquement | MUSC-33 se tait ; MUSC-26 et MUSC-13 fonctionnent (ils ne dépendent d'aucune prescription) |
| `planned_weight_kg` nul sur toutes les séries | Taux de charge non calculable → se tait, sans affecter le taux de reps |
| `target_reps` inexploitable partout (« AMRAP ») | Taux de reps non calculable → se tait, sans affecter le taux de charge (R6) |
| Séance abandonnée (séries non `done`) | Les séries non validées sont ignorées (R5), pas comptées en échec |
| Charge réalisée **supérieure** à la prescription | Taux > 100 %, **affiché tel quel** — c'est un signal utile (programme trop facile), pas une anomalie à plafonner |
| Une seule séance dans la fenêtre | Toutes les analyses se taisent (R3) |
| `duration_seconds` nul ou aberrant | Ligne écartée, et le nombre d'écartées est dit (R10) |
| Aucun favori | MUSC-21 se tait (R8) |
| Favori créé il y a 2 jours, jamais pratiqué | **Pas délaissé** — on ne reproche pas un favori plus récent que le seuil |
| Favori d'un exercice archivé (`deleted_at`) | Exclu : on ne propose pas de reprendre un exercice retiré |
| Utilisateur sans pilier muscu actif | Aucune section (décision H) |
| Mode avion | Identique — tout est local |
| Période « vie réelle » déclarée (VIE-01) | ⚠️ À trancher en plan : ces analyses **constatent** sans reprocher, mais « tu suis ton programme à 60 % » pendant une période déclarée est un reproche déguisé. Voir §7 |

## 5. Données

**Aucune migration. Aucune sync rule. Aucun schéma PowerSync local. Aucune dépendance native.**
Le lot lit exclusivement des colonnes qui existent, vérifiées le 07/08/2026 :

| Table | Colonnes utilisées |
|---|---|
| `workouts` | `planned_session_id`, `program_id`, `session_id`, `duration_seconds`, `started_at`, `finished_at`, `status`, `deleted_at` |
| `workout_sets` | `planned_weight_kg`, `weight_kg`, `reps`, `set_type`, `done`, `exercise_id`, `workout_id` |
| `exercise_plans` | `target_reps`, `session_id`, `exercise_id` |
| `exercise_favorites` | `exercise_id`, `user_id`, `deleted_at` |

→ **Recettable sur l'APK existant.** C'est un critère de choix du lot, pas une coïncidence.

## 6. i18n — FR + EN

```
progress.execution.title / .subtitle
progress.execution.compliance.load        // « {{pct}} % de la charge prescrite »
progress.execution.compliance.reps
progress.execution.compliance.basis       // « sur {{count}} séances de programme »
progress.execution.duration.median / .trend / .outliers
progress.execution.setTypes.<setType>
progress.execution.neglected.title / .item / .empty
progress.execution.empty                  // pas assez de données (R3)
```

Nombres **formatés avant** `t()` — i18next n'a aucun formatage par défaut (piège n° 3 de
[bonnes-pratiques](../../technical/bonnes-pratiques.md)). Les libellés de type de série réutilisent
les clés existantes de `set_type` plutôt que d'en créer un second jeu.

## 7. Comportement offline

**Intégralement local.** Aucun appel réseau, aucune dépendance native, aucune écriture. Le lot est
en **lecture seule** : c'est ce qui en fait le lot le moins risqué des trois pistes proposées.

## 8. Décisions — validées par Florian le 07/08/2026

| # | Décision | Statut |
|---|---|---|
| D1 | **Seuil « délaissé » = 4 semaines** (R8), calibrable en recette comme celui de COLLIS-01 | ✅ validé |
| D2 | **Fenêtre d'analyse = 12 semaines**, cohérent avec les autres sections de l'écran | ✅ validé |
| D3 | **MUSC-33 se tait pendant une période « vie réelle »** (VIE-01) ; les trois autres restent — c'est le seul des quatre qui puisse se lire comme un reproche | ✅ validé |
| D4 | **MUSC-14 hors du lot** (§1.1) | ✅ **validé** — Florian, 07/08/2026, après explication |

### D4 — pourquoi MUSC-14 reste dehors

Florian avait validé le lot **sauf** ce point, en demandant l'explication, puis **tranché : elle reste
dehors**. Le raisonnement, pour ne pas avoir à le refaire :

1. Le repos réel se déduit de l'écart entre deux **validations de série**. Cette heure n'est stockée
   nulle part : `created_at` date de la **génération** de la séance (toutes les séries partagent la
   même valeur, tous les écarts valent zéro), et `updated_at` est écrasé par **toute** modification
   ultérieure.
2. Le mode d'échec de `updated_at` est concret : séance faite lundi en respectant 90 s de repos,
   correction d'une charge mal saisie le jeudi → l'app calcule **3 jours** de repos entre deux
   séries, et **−3 jours** entre les deux suivantes. Faux, et **silencieusement** faux.
3. Le correctif (`completed_at` sur `workout_sets`) est petit — mais la donnée **n'existe pas
   rétroactivement**. L'analyse serait **vide pour tout le monde** au lancement, et le resterait
   plusieurs semaines.

**Ce n'est donc pas « trop dur », c'est « rien à montrer avant plusieurs semaines d'usage ».**

**Forme recommandée** : une US séparée « instrumenter la validation de série », qui pose
`completed_at`. La colonne sert aussi à la densité réelle et au temps sous tension ; MUSC-14 devient
alors quasi gratuite, une fois qu'il y a de la donnée.

**L'ajout reste purement additif** : un 5ᵉ moteur et sa migration ne changent rien aux 4 autres.
Le développement des 4 validées a donc démarré sans attendre la réponse.

## 9. Critères de recette

1. Compte neuf, aucune séance → **aucune section** n'apparaît (R3).
2. Une seule séance de programme → la section reste muette.
3. Après ≥ 3 séances de programme : le taux d'exécution **de la charge** apparaît, avec le **nombre
   de séances** sur lequel il porte (R2/R4).
4. Faire une séance **libre** → elle n'entre pas dans le taux d'exécution (R4).
5. Faire une séance en **dépassant** les charges prescrites → taux **> 100 %**, affiché tel quel.
6. Abandonner une séance en cours (séries non validées) → **pas** de chute du taux d'exécution (R5).
7. Programme avec `target_reps` = « AMRAP » → **aucun** taux de reps, **et le taux de charge reste
   affiché** (R6). C'est le critère qui exerce le parsing tolérant.
8. Programme avec `target_reps` = « 8-12 », réalisé à 10 → compté **conforme**, pas en écart.
9. Modifier la charge cible d'un programme **après** avoir fait la séance → le taux passé **ne bouge
   pas** (R7). C'est le critère qui prouve qu'on lit `planned_weight_kg` et non le plan.
10. Durée : la médiane s'affiche après assez de séances ; une séance laissée ouverte des heures est
    **écartée** et le nombre d'écartées est dit (R9/R10).
11. Répartition par type de série : les parts somment à 100 % et les libellés sont traduits.
12. Ajouter un favori pratiqué hier → **pas** délaissé.
13. Favori non pratiqué au-delà du seuil → apparaît ; le pratiquer → disparaît.
14. Archiver un exercice favori → il **sort** de la liste des délaissés.
15. Aucun favori → la sous-section « délaissés » se tait, les trois autres restent (R8).
16. La section **ne redit pas** ce que dit `MuscleBalanceSection` (§1.2).
17. Désactiver le pilier muscu → aucune section (décision H).
18. FR ⇄ EN → aucune chaîne brute ; pourcentages et durées formatés selon la locale.
19. Police 1,5× et thème sombre → lisible, non tronqué, contrastes AA.
20. TalkBack → chaque analyse est annoncée avec son chiffre et sa base.
21. Mode avion → identique.
22. **L'écran Insights n'a pas changé** : toujours au plus 3 cartes, même sélection qu'avant (§3).

## 10. Definition of Done

- [ ] `typecheck`, `lint`, `test:coverage` verts, cliquets tenus — codes de sortie **sans pipe**.
- [ ] 4 moteurs **purs** dans `packages/shared` : zéro React, zéro base, zéro lecture d'horloge (R1).
- [ ] `packages/shared` reste à **100 %** (instructions / fonctions / lignes).
- [ ] Chaque moteur rend `null` sous son seuil de données, et un test le fige (R3).
- [ ] Les seuils sont des **constantes nommées et exportées**, pas des littéraux enfouis (R8).
- [ ] Le parsing de `target_reps` échoue **en silence** et un test fige « AMRAP » (R6).
- [ ] Un test fige que la charge prescrite vient de `planned_weight_kg` et **non** du plan (R7).
- [ ] Aucune migration, aucune sync rule, aucun ajout à `powersync/schema.ts`.
- [ ] `MAX_INSIGHTS`, `INSIGHT_ORDER` et `selectInsights` **non modifiés** (§3).
- [ ] FR + EN symétriques, nombres formatés avant interpolation.
- [ ] Catalogue mis à jour : MUSC-33, MUSC-26, MUSC-13 → ✅ ; MUSC-21 → ✅ avec la note du §1.2 ;
      **MUSC-14 reste ⏳** avec le motif du §1.1.
- [ ] CHANGELOG, front-matter, roadmap 3.58, RECETTES.md, ETAT.
