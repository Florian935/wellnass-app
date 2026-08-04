---
id: MUSCPWR-01
titre: "Module force — intensité relative (%1RM), force relative (DOTS) et total SBD avec projection"
roadmap: []
catalogue: [MUSC-16, MUSC-27, MUSC-29]
etape: validation
branche: feature/muscpwr01-module-force
maj: 04/08/2026
---

# MUSCPWR-01 — Module force

> **Origine** : trois items du [catalogue d'analyses](../../../product/analyses-donnees.md) —
> **MUSC-16** (progression au %1RM), **MUSC-27** (points de force relative), **MUSC-29** (total SBD
> et projection). Le catalogue les rattache tous les trois au même sujet
> (« IDEAS module-powerlifting »), et [IDEAS.md](../../../../IDEAS.md) en fait « une brique de
> **positionnement**, pas une petite US ». Regroupés ici par arbitrage Florian du 04/08/2026.
>
> **Contexte de l'audit du 04/08/2026** : sur les 9 items du catalogue que je pensais livrables,
> **7 étaient déjà faits ou hors périmètre**. Ces trois-là sont réellement absents du code —
> vérifié : aucune occurrence de `wilks`, `dots`, `sbd` ni de calcul d'intensité relative.

## 0. Point de départ — ce qui existe déjà

| Brique | État | Conséquence |
|---|---|---|
| `estimate1RM(weightKg, reps)` (`records.ts`) | ✅ livré | Le 1RM estimé **existe déjà** : rien à réinventer pour MUSC-16 et MUSC-29. |
| `sessionBestEstimated1RM` | ✅ livré | Meilleur e1RM d'une séance, par exercice. |
| `personal_records` (`type in ('max_weight','estimated_1rm','best_volume')`, `achieved_at`) | ✅ livré | Historique daté des 1RM → **la matière de la projection** (MUSC-29). |
| `linearRegression` (utilisé par `weightTrend`, `paceTrend`) | ✅ livré | La pente de progression est un **appel**, pas un algorithme à écrire. |
| `body_weight_entries` | ✅ livré | Poids de corps daté → dénominateur du DOTS. |
| `profiles.sex` (`'female' \| 'male' \| 'unspecified'`) | ✅ livré | ⚠️ `unspecified` est possible → **le DOTS n'est alors pas calculable** (R6). |
| Bibliothèque : **Squat**, **Développé couché**, **Soulevé de terre** | ✅ en base (seed) | Les 3 mouvements SBD existent → **valeurs par défaut** de la désignation (D3). |
| Écran `/progress` | ✅ livré, déjà structuré en sections | Point d'accroche **Tier 1**. ⚠️ ADR-007 : au-delà de ~4-5 sections, il faut du repliable. |
| Désignation des mouvements SBD | ❌ absente | Seule migration de l'US (D3). |

## 1. Périmètre et surfaçage (ADR-007, règle 5)

Trois analyses, **une seule section repliable « Force »** sur l'écran Progression — pas trois
sections, pas un widget de dashboard.

| Analyse | Tier | Condition d'affichage (conditionnel par défaut) |
|---|---|---|
| **Intensité relative (%1RM)** — MUSC-16 | **1** | Au moins **un 1RM connu** sur l'exercice consulté. |
| **Force relative (DOTS)** — MUSC-27 | **1** | Sexe renseigné (≠ `unspecified`) **et** un poids de corps **et** un 1RM. |
| **Total SBD + projection** — MUSC-29 | **1** | Les **3 mouvements désignés** (D3) **et** un 1RM sur chacun. La projection exige en plus **≥ 3 points sur 8 semaines** (R8). |

**La section entière est absente** si aucune des trois conditions n'est réunie. C'est un module pour
pratiquants de force : il ne doit **rien coûter** à quelqu'un qui fait du renforcement général — et
la désignation des 3 mouvements fait office d'**opt-in implicite** pour le plus spécialisé des trois.

**Hors périmètre, explicitement** :

- **Wilks et IPF GL** : une seule formule en V1 (**D2**).
- **Répartition des essais de compétition** (le catalogue la mentionne pour MUSC-29) : proposer une
  ouverture et des 2ᵉ/3ᵉ essais suppose de connaître les règles d'une fédération et relève du
  **conseil d'entraîneur**, pas d'une statistique. Écarté (**D7**).
- **Aucune notification.** Ce module se consulte, il n'alerte pas.
- **Aucun objectif de compétition** (date, catégorie de poids, fédération) : ce serait une US à part.
- **Aucun %1RM affiché pendant la séance** : l'écran de séance est déjà dense, et l'intensité
  relative est une analyse de fond, pas une information de série (**D5**).

## 2. Modèle de données

Une seule migration, additive :

```sql
-- Désignation par l'utilisateur de SES trois mouvements de force (D3). JSON et non 3 colonnes :
-- la liste des mouvements pourrait s'étendre (strict-curl, overhead press) sans migration.
-- `{"squat": "<uuid>", "bench": "<uuid>", "deadlift": "<uuid>"}` — chaque clé est facultative.
alter table public.user_settings add column if not exists sbd_lifts jsonb;
```

**Rien d'autre.** Les trois analyses sont **entièrement dérivées** de `personal_records`,
`workout_sets`, `body_weight_entries` et `profiles` : aucun score, aucune projection, aucun %1RM
n'est stocké. Conséquences voulues : le calcul est local (donc hors ligne), il n'existe aucune valeur
à recalculer après coup, et corriger une série passée corrige immédiatement l'analyse.

## 3. Règles métier

- **R1 — Le 1RM de référence est le meilleur connu, pas le dernier.** Pour un exercice donné,
  l'intensité relative se calcule contre le **`estimated_1rm` le plus élevé** de
  `personal_records`. Prendre le plus récent ferait bondir les pourcentages après une séance légère
  — « 95 % du max » sur un footing de récupération n'a aucun sens.
- **R2 — Aucun 1RM connu → aucun pourcentage.** Pas d'estimation de secours à partir d'une série
  isolée : afficher « 87 % » calculé sur un maximum inventé est pire que ne rien afficher.
- **R3 — Le %1RM est borné à l'affichage, jamais tronqué en donnée.** Une série au-dessus du 1RM
  connu affiche **> 100 %** (c'est un nouveau record, l'information est juste) ; on ne rabat pas à
  100 %.
- **R4 — L'intensité relative d'une séance est une moyenne pondérée par les répétitions**, pas une
  moyenne simple des séries. Une série de 1 rep à 95 % et une de 10 reps à 60 % ne pèsent pas pareil
  dans la charge réelle de la séance.
- **R5 — Les séries d'échauffement sont exclues** du calcul d'intensité (`set_type = 'warmup'`) :
  elles tireraient la moyenne vers le bas et fausseraient la lecture d'une séance lourde.
- **R6 — Sans sexe renseigné, pas de DOTS.** Les coefficients diffèrent selon le sexe, et il n'y a
  pas de valeur neutre : `unspecified` → l'analyse **ne s'affiche pas**, avec une invitation à
  compléter le profil. Inventer un sexe pour produire un score serait à la fois faux et intrusif.
- **R7 — Le poids de corps du DOTS est celui **le plus proche** de la date du record**, pas le poids
  actuel. Un total réalisé à 75 kg il y a six mois ne se normalise pas avec les 82 kg d'aujourd'hui —
  c'est précisément ce que le score sert à corriger.
- **R8 — Une projection exige de la matière et s'annonce comme une estimation.** Il faut **≥ 3 points
  de total SBD** répartis sur **≥ 8 semaines**. En dessous : le total s'affiche, **pas** la
  projection. Une droite tracée sur deux points est une illusion de précision.
- **R9 — Une projection ne dépasse pas 12 semaines** et n'est jamais présentée comme un objectif.
  Extrapoler un an de progression linéaire est physiologiquement faux ; le libellé dit « au rythme
  actuel », jamais « tu atteindras ».
- **R10 — Une pente négative ou nulle est affichée telle quelle.** Si la progression stagne ou
  recule, l'app le dit — masquer une mauvaise nouvelle décrédibilise les bonnes.
- **R11 — Le total SBD n'additionne que les mouvements désignés**, et affiche **quels mouvements
  manquent** s'ils ne sont pas tous renseignés. Un total partiel annoncé comme total serait faux.
- **R12 — Un mouvement désigné puis supprimé (exercice archivé) casse le total, pas l'écran.** Le
  mouvement est signalé comme à re-désigner ; le reste continue de fonctionner.
- **R13 — Tout est dérivé, donc corrigeable.** Modifier une série passée, corriger un poids de corps
  ou re-désigner un mouvement met immédiatement les trois analyses à jour, sans recalcul différé.

## 4. Décisions

| # | Question | Décision | Motif |
|---|---|---|---|
| **D1** | Regrouper les 3 items en une US ? | **Oui.** | Ils partagent le 1RM comme socle, la même section d'écran et le même public. Trois US produiraient trois sections concurrentes sur `/progress`, ce qu'ADR-007 interdit explicitement. |
| **D2** | Wilks, DOTS ou IPF GL ? | **DOTS seul.** | **Wilks est déprécié** (l'IPF ne l'utilise plus depuis 2020) ; **IPF GL** exige de distinguer équipé/non-équipé et le type de compétition, que nous ne modélisons pas — l'afficher supposerait des données qu'on n'a pas. **DOTS** ne dépend que du poids de corps et du sexe : c'est le seul des trois calculable **honnêtement** avec notre modèle. Ajouter les autres plus tard ne coûte qu'une fonction. |
| **D3** | Comment identifier les 3 mouvements SBD ? | **Désignation par l'utilisateur**, pré-remplie avec les 3 exercices de la bibliothèque (Squat, Développé couché, Soulevé de terre). | La correspondance par nom échouerait sur toute variante (« Squat barre basse », « Bench avec pause ») et sur les exercices perso — or c'est précisément ce que fait un pratiquant de force. La désignation gère tous les cas, et sert d'**opt-in** au module. |
| **D4** | Où vit l'analyse ? | **Tier 1**, une **section repliable « Force »** sur `/progress`. Aucun widget de dashboard. | ADR-007 : le Tier 0 est plafonné à 4-6 widgets et réservé à l'actionnable du jour. Un score DOTS ne se regarde pas chaque matin. |
| **D5** | %1RM pendant la séance ? | **Non.** | L'écran de séance est déjà dense (RPE, repos, progression, deload). L'intensité relative est une analyse de fond ; l'y ajouter dégraderait l'écran le plus utilisé pour servir une minorité. |
| **D6** | 1RM réel ou estimé ? | **Estimé** (`estimated_1rm`), déjà calculé par `estimate1RM`. | Personne ne teste son vrai maximum chaque semaine. Le e1RM est la convention du milieu et il est déjà stocké. |
| **D7** | Répartition des essais de compétition ? | **Écartée.** | Suppose les règles d'une fédération et relève du conseil d'entraîneur. Hors de ce que des statistiques peuvent affirmer. |
| **D8** | Projeter au-delà de 12 semaines ? | **Non** (R9). | Une extrapolation linéaire longue est physiologiquement fausse. Le produit ne doit pas promettre ce que le corps ne fait pas. |
| **D9** | Unités | Stockage **kg** (convention projet), affichage converti par `useUnits`. Le DOTS **se calcule toujours en kg** — c'est sa définition. | Calculer un DOTS sur des livres donnerait un score faux d'un facteur 2,2. |

**Reste à trancher par Florian ou Damien** (aucune ne bloque le démarrage) :

- **P1 — Faut-il afficher le DOTS par mouvement, ou seulement sur le total SBD ?** Je propose **les
  deux** : par mouvement, il permet de comparer un développé couché à celui d'un ami plus lourd ; sur
  le total, c'est la métrique de compétition. Coût quasi nul (même fonction).
- **P2 — Le libellé « DOTS ».** C'est le nom technique, connu des pratiquants mais opaque pour les
  autres. Je propose de l'afficher tel quel avec un sous-titre (« score de force relative au poids de
  corps »), puisque la section n'apparaît que pour un public qui le connaît.

> 🔴 **Point de vigilance sur les coefficients DOTS.** La formule est publique et stable, mais je
> **ne peux pas vérifier ses coefficients depuis ce poste**. Ils seront inscrits **en clair et
> commentés** dans le code, et ancrés par des **tests à valeurs de référence** (un total connu → un
> score connu) plutôt que par des cas inventés. **À faire relire par quelqu'un qui pratique** avant
> clôture : un coefficient faux produit un score plausible mais faux, donc invisible en recette.
> C'est la même précaution que pour les alias de colonnes d'IMPORT-01 — quand une constante vient de
> l'extérieur, on l'ancre sur une référence externe.

## 5. Cas limites

| Situation | Comportement attendu |
|---|---|
| Aucun record, aucune séance | **Section « Force » absente** (pas une section vide). |
| Un seul mouvement désigné sur trois | Total **non affiché** ; la liste dit lesquels manquent (R11). |
| Mouvement désigné dont l'exercice est archivé | Signalé « à re-désigner » ; les deux autres restent lisibles (R12). |
| Sexe `unspecified` | DOTS masqué + invitation à compléter le profil (R6). %1RM et total SBD restent affichés. |
| Aucun poids de corps enregistré | DOTS masqué. Le total SBD, lui, ne dépend pas du poids. |
| Poids de corps postérieur au record uniquement | Le plus proche disponible est utilisé (R7), et la date du poids retenu est **affichée** — sinon le score semble sorti de nulle part. |
| Série au-dessus du 1RM connu | Affiche **> 100 %** (R3). |
| Séance entièrement composée d'échauffements | Aucune intensité relative pour cette séance (R5), pas 0 %. |
| Deux records le même jour | Le plus élevé prime (R1). |
| Progression négative | Pente négative affichée, projection descendante (R10). |
| 2 points de total seulement | Total affiché, **projection absente** (R8), avec la raison (« encore 1 mesure »). |
| Points sur 3 semaines seulement | Idem : la fenêtre de 8 semaines n'est pas atteinte. |
| 1RM aberrant (série mal saisie, 500 kg) | Aucun filtrage automatique — mais le total et la projection sont **dérivés**, donc corriger la série corrige tout (R13). Un filtre de plausibilité écarterait de vrais records. |
| Unités impériales | Affichage en lb, **DOTS calculé en kg** (D9). |

## 6. i18n (FR + EN)

Namespace **`strength.*`** (pas `powerlifting` : le module sert aussi qui suit un programme en
pourcentages sans faire de compétition).

- `strength.section.title` / `.subtitle`, `strength.section.empty` (invitation quand rien n'est encore
  calculable).
- `strength.intensity.*` : `.title`, `.percentOfMax` (`{{percent}} % du max`), `.sessionAverage`,
  `.noMax` (aucun 1RM connu), `.warmupExcluded`.
- `strength.dots.*` : `.title`, `.subtitle` (« score de force relative au poids de corps »),
  `.value`, `.atBodyweight` (`à {{weight}} le {{date}}` — R7), `.missingSex` (+ lien vers le profil),
  `.missingWeight`.
- `strength.sbd.*` : `.title`, `.total`, `.missingLifts` (**pluralisable**), `.lifts.squat` /
  `.bench` / `.deadlift`, `.reassign` (mouvement archivé), `.designate` (écran de désignation).
- `strength.projection.*` : `.title`, `.atCurrentRate` (« au rythme actuel : {{value}} dans
  {{weeks}} semaines »), `.notEnoughData` (**avec ce qui manque**), `.declining`, `.disclaimer`
  (« estimation, pas un objectif » — R9).
- **« DOTS » et « SBD » ne sont pas traduits** : ce sont des termes techniques identiques en FR et EN.

## 7. Comportement offline

- **100 % dérivé, donc 100 % local.** Aucune écriture hors la désignation des mouvements (une ligne
  `user_settings`). Les trois analyses se calculent depuis la base locale : elles fonctionnent en
  mode avion, sans exception.
- ✅ **Aucune sync rule à redéployer** : `user_settings` est déjà publiée et lue en `select *` — même
  situation que `intensity_scale` (UX-05) et `cycle_tracking_enabled`.
- ⚠️ **`sbd_lifts` doit être ajoutée au schéma PowerSync local** (`powersync/schema.ts`). Une colonne
  absente de ce fichier fait échouer l'écriture **en silence** — panne CYCLE-01 du 31/07, puis
  `daily_step_goal` le 03/08. Deux précédents, même cause.
- Export RGPD : rien à ajouter (`user_settings` y est déjà ; aucune table neuve).

## 8. Critères de recette

**Aucun nouveau build requis** (aucune dépendance native).

1. Avec un compte neuf sans séance : la section « Force » est **absente** de Progression.
2. Après une séance sur un exercice, la section apparaît avec l'intensité relative.
3. Le %1RM d'une série se calcule bien contre le **meilleur** 1RM connu, pas le dernier (faire une
   séance légère après une lourde : les pourcentages ne doivent pas bondir).
4. Une série qui dépasse le 1RM connu affiche **> 100 %**, pas 100 %.
5. Les séries d'échauffement ne tirent pas la moyenne de séance vers le bas.
6. Profil avec sexe **non renseigné** : le DOTS est masqué, avec l'invitation à compléter le profil.
   Le renseigner le fait apparaître.
7. Sans poids de corps : DOTS masqué, total SBD toujours affiché.
8. Le DOTS affiche **à quel poids et à quelle date** il a été calculé.
9. Désigner les 3 mouvements : le total SBD apparaît, égal à la somme des 3 e1RM.
10. N'en désigner que 2 : le total **n'est pas affiché**, et l'écran dit lequel manque.
11. Archiver un exercice désigné : signalé « à re-désigner », les autres analyses continuent.
12. Avec 2 mesures de total seulement : **pas de projection**, et la raison est affichée.
13. Avec ≥ 3 mesures sur ≥ 8 semaines : projection affichée, **libellée comme une estimation**, à
    12 semaines maximum.
14. Progression en baisse : la projection descend au lieu de disparaître.
15. Corriger une série passée met à jour les trois analyses **immédiatement** (rien n'est figé).
16. Basculer en unités impériales : les charges s'affichent en lb, **le DOTS ne change pas** (il se
    calcule en kg).
17. **Mode avion** : tout est calculé et affiché normalement.
18. FR → EN : tous les libellés changent ; « DOTS » et « SBD » restent tels quels.
19. Police 1,5× : la section reste lisible, aucune troncature sur les scores.
20. TalkBack : la section repliable, les scores et la projection sont annoncés.
21. 🔴 **Relecture par un pratiquant** : les valeurs de DOTS sont-elles crédibles pour des totaux
    connus ? (Point de vigilance §4.)

## 9. Ce que cette US ne fait pas

- Wilks · IPF GL · répartition des essais · objectif de compétition daté · catégories de poids ·
  %1RM pendant la séance · planification en pourcentages (« programme 5×5 à 80 % ») — cette dernière
  devient possible **grâce** à celle-ci, et reste une US à part.
- Elle **n'écrit aucune analyse en base** : tout est dérivé, donc rien à migrer ni à recalculer.
