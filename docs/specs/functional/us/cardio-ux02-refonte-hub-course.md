---
id: CARDIO-UX02
titre: "Refonte du hub Course — le bleu partout, et un écran qui sait où en est le coureur"
roadmap: [5.42]
catalogue: [RUN-03, RUN-05, RUN-08, RUN-13]
etape: recette
branche: dev
maj: 19/09/2026
---

# US CARDIO-UX02 — Refonte du hub Course

> Demande de Florian le 19/09/2026, captures d'écran à l'appui, **le jour même** de la livraison de
> MUSCU-UX05 sur le pilier voisin : « refais la même passe sur le cardio ».
>
> ⚠️ **Travail directement sur `dev`** (décision Florian, cf. MUSCU-UX05).
> ⚠️ **Étape design non franchie par l'agent** : le skill `/design` est réservé à une invocation
> explicite de Florian et ne peut pas être lancé depuis une session d'agent. La spec a donc été
> écrite **avec** le code, et les maquettes restent à produire — voir §8.

## 1. Le problème

Deux demandes, dans les mots de Florian :

1. « Le héros du cardio est super cool avec ce petit bleu bien sympathique. Le problème c'est que
   **ce n'est pas repris sur tous les autres écrans** du pilier cardio. »
2. « Le dashboard du pilier cardio, **je le trouve pas probant**. Il faut que ce soit plus utile :
   qu'on arrive dessus et qu'on sache **où on en est, ce qu'il reste à faire**, la vision globale
   de nos progrès. »

L'audit a trouvé **six défauts et une cause**.

| # | Constat | Mesure |
|---|---|---|
| 1 | Le hub et sa propre carte se contredisent | La scène affiche « 2 / 0 faites », la carte « 2 / 3 faites », sur la **même** semaine |
| 2 | La question du coureur n'a aucune surface | RUN-05 livrée le 29/07, visible uniquement dans `/running-history` |
| 3 | Le plus gros chiffre mesure le passé | 34 px pour la distance de la **dernière** sortie, dans un widget |
| 4 | Le bas de l'écran est de l'administration | 4 tuiles : un nom de plan, un mini-calendrier, une distance, un total d'heures |
| 5 | L'identité du pilier s'arrête à la scène | Surface teintée en **chroma 16**, sous les 18 de la surface neutre non teintée |
| 6 | Le haut change cinq fois, le bas jamais | La scène a 5 états ; le corps rendait les mêmes blocs dans les 5 cas |

**La cause, sous les six** : sur **25 analyses course** au catalogue, **15 sont livrées** — le hub
en montrait **4** (splits RUN-10, prédictions RUN-14, charge RUN-18, volumes RUN-01/02/09).
ALLURE-01 en avait livré **quatre d'un coup** le 07/08 (RUN-08, RUN-11, RUN-17, RUN-20) ; aucune
n'est jamais remontée. Et `selectInsights` (INSIGHTS-01), qui sait choisir les analyses pertinentes
de l'instant **par pilier**, n'était appelé nulle part côté course.

C'est **mot pour mot** le diagnostic de MUSCU-UX05, onze jours après CARDIO-UX01 et onze heures
après la refonte du hub muscu.

### 1 bis. Le défaut 1, en détail — parce qu'il est le seul qui MENT

`RunStage` recevait `weekSessionsLabel = t('running.week.count', { done, total: week.plannedCount })`.
`RunWeekBand`, deux blocs plus bas, calculait `goal = targetFrequency ?? plannedCount`.

Le repli vivait **dans le composant** : il ne pouvait donc valoir que pour lui. Sur un compte sans
programme (donc `plannedCount = 0`) mais avec une fréquence visée déclarée à 3, l'écran affichait
« 2 / 0 faites » en haut et « 2 / 3 faites » en bas. Visible sur la capture du 19/09.

### 1 ter. Le défaut 5, en détail — parce qu'il est mesurable, pas affaire de goût

MUSCU-UX04 (19/09, la veille au matin) a donné une palette à chaque pilier. Les surfaces sont
teintées **à luminance constante**, ce qui protège tous les contrastes — et qui, pour une teinte
**froide**, désature. Chroma (écart max−min des canaux) de la surface sombre teintée, contre la
surface neutre `#30271e` dont la chroma vaut **18** :

| pilier | teinte | surface | chroma |
|---|---|---|---|
| accueil | `#b14f2b` | `#3b2317` | 36 |
| labo | `#8a6419` | `#332713` | 32 |
| musculation | `#7c2734` | `#3c211f` | 29 |
| nutrition | `#2e4419` | `#292a19` | 17 |
| **course** | `#1d4586` | `#242934` | **16** |

La course est le seul pilier dont la surface teintée est **moins colorée que celle qu'elle
remplace** : le bleu enlève le brun sans rien mettre à la place. Quatre piliers sur cinq n'avaient
donc rien révélé.

**Et un second mécanisme, indépendant** : `useMenuFocus` n'était appelé que par les **cinq écrans
d'onglet**. Les écrans empilés héritaient du dernier onglet visité. Or l'Accueil pousse vers `/run`
(`QuickActions`), `/run/active` (`NowCard`) et `/running-history` (`RecordRecentCard`) : entrer dans
le pilier Course par l'Accueil le rendait **entièrement en terracotta**. Rien n'échoue, rien ne se
voit en revue de diff.

**Et un troisième, ponctuel** : le bandeau de célébration de `run/summary.tsx` était en dur à
`#7c2734` — la teinte exacte de la **scène Musculation**. Un record de course se célébrait en
bordeaux.

## 2. La contrainte qui tient la refonte

CARDIO-UX01 avait déjà resserré ce hub le 10/09. « Plus utile » ne peut donc pas vouloir dire
« plus de blocs », sinon on refait l'inflation qu'on vient de couper — même raisonnement que
MUSCU-UX05, même budget.

**Dix surfaces deviennent sept cartes et trois lignes.**

## 3. Les règles

- **R1.** Une carte **se tait** quand elle n'a rien à dire. Aucune ne s'excuse.
- **R2.** Un seul bloc change tous les jours — le fil — et il porte **un** insight, jamais trois.
- **R3.** La carte dominante répond à *est-ce que je cours plus vite ?*, et à rien d'autre.
- **R4.** Aucune carte n'invente de donnée : chacune est branchée sur une brique déjà livrée.
- **R5.** Le rythme vertical est **cassé une fois** (la bande horizontale des records), pas en
  variant les rayons de bordure.
- **R6.** Le hub n'a plus de grille de widgets. Voir §6.
- **R7.** L'identité d'un pilier appartient à **l'écran**, jamais au chemin qui y mène.

## 4. Ce qui est livré

### Sortant

| Surface | Pourquoi |
|---|---|
| Bouton « Personnaliser » | Il n'existait que pour la grille |
| Grille de 4 widgets (Historique, Programmes, Planning, Temps d'entraînement) | Trois raccourcis d'administration déguisés en indicateurs (défaut 4) ; le quatrième est rendu deux fois dans l'app |
| `RunWeekBand` | Absorbée par `RunWeekCard`, qui dit en plus **ce qu'il reste** |

Fichiers supprimés : `components/widgets/running-widgets.tsx` (+ son test),
`components/running/RunWeekBand.tsx`.

### Entrant

| Ordre | Surface | Analyse | Ce qu'elle répond |
|---|---|---|---|
| 3 | `RunThread` | INSIGHTS-01 + RUN-03/05/08 | « qu'est-ce qui a changé aujourd'hui ? » |
| 4 | `PaceProgressCard` | **RUN-05** | « est-ce que je cours plus vite ? » |
| 5 | `RunWeekCard` | RUN-01/02/09 + **RUN-13** | « où j'en suis, et ce qu'il me reste » |
| 7 | `RunEngineCard` | **RUN-08** | « où part mon intensité ? » |
| 8 | `RunRecordWall` | **RUN-03** | « qu'est-ce que j'ai déjà gagné ? » |
| 11 | `RunLifetimeLine` | RUN-01/02 | « combien j'ai couru, en tout » |
| 12 | Ligne d'annuaire + `RunDirectorySheet` | — | ce que la grille faisait, sans les faux indicateurs |

Restent en place, réordonnés : `SessionAdaptationCard` (2), `RunPredictionsCard` (6),
`RunLoadCard` (9, **descendue** : un garde-fou n'est pas un progrès), `RunSplitsCard` (10).

### La carte dominante, en détail

`computePaceProgress` (`packages/shared/src/pace-progress.ts`, 9 tests) — **deux visages choisis
par les données**, jamais par un réglage :

- `onboarding` : meilleure allure tenue **depuis le début** + volume parcouru. Un débutant n'a pas
  deux fenêtres de 30 jours à comparer, mais il a des kilomètres.
- `established` : allure **médiane** des 30 derniers jours contre les 30 précédents, + la tendance
  longue (90 j) de RUN-05 en second plan.

Trois règles anti-bruit : **médiane jamais moyenne** (une sortie de récup à 7:30/km ne déplace pas
le titre) · **deux fenêtres pleines ou rien** (3 sorties minimum dans chacune) · **plancher de
3 s/km** sous lequel on dit « stable » plutôt que d'afficher une précision qu'on n'a pas.

Et deux détails de lecture qui n'en sont pas : la courbe est **retournée** (une allure qui baisse
est un progrès, donc une ligne qui monte), et `deltaSPerKm` est **positif quand on accélère**, alors
que le nombre brut est négatif.

### L'identité du pilier — les quatre correctifs

1. **`TINT_GAIN`** (`theme/pillar.ts`) : un gain de teinte **par pilier**, `running: 1.5`, qui
   amène la surface sombre à `#1f293c` (chroma 29 — la bande des autres, pas au-delà). Le contrat
   de lisibilité est intact **par construction** : le gain ne change que `amount`, et
   `tintPreservingLuminance` conserve la luminance quel que soit `amount`.
2. **`PillarPanel`** (`components/stage/PillarPanel.tsx`) : une **grande surface colorée** dans le
   corps de la page, réservée à **une** carte par écran. Monter le gain ne suffisait pas — il
   manquait une surface, pas de la saturation. Ses encres viennent de `stageTheme`, pas de la
   palette : `colors.text` serait illisible sur un bleu profond.
3. **`useMenuFocus('running')` sur les 10 écrans du pilier**, plus un **test de garde**
   (`app/__tests__/pillar-identity.test.ts`) qui lit les sources et échoue si un écran l'oublie.
4. **Le bandeau de célébration** de `run/summary.tsx` prend les couleurs de `stageTheme('running')`
   au lieu du bordeaux muscu écrit en dur.

## 5. Le fil du jour — trois sources neuves

`insight-adapters.ts` gagne trois adaptateurs, et `INSIGHT_ORDER` trois identifiants :

| id | famille | source | position |
|---|---|---|---|
| `run_record_recent` | celebration | RUN-03 | juste derrière `record_recent` |
| `pace_trend` | change | RUN-05 (via `pace-progress`) | **devant** `tonnage_change` / `distance_change` |
| `polarisation` | change | RUN-08 | dernier |

`pace_trend` passe devant les variations de volume parce qu'un coureur mesure son progrès en
vitesse, pas en kilomètres cumulés — la même hiérarchie que « Tes charges » vs le tonnage
hebdomadaire côté muscu.

🔴 **La polarisation est dite, jamais jugée.** Le repère ~80/20 part en métrique à côté de la part
réelle ; la formulation ne dit pas lequel est « bon ». C'est la réserve inscrite au catalogue sur
RUN-08 (décision D5 d'ALLURE-01), reportée telle quelle : un coureur qui prépare un 5 km a de
bonnes raisons d'être à 70/30.

## 6. Ce que la refonte RETIRE

⚠️ **Le hub course perd sa grille de widgets, donc sa personnalisation** (ordre et taille des
tuiles). Aucune migration : les préférences `running` du registre deviennent inertes, exactement
comme celles du hub muscu depuis MUSCU-UX05. `RUNNING_WIDGET_IDS` et `MAX_RUNNING_WIDGETS` restent
dans `packages/shared/src/widgets.ts` — les retirer toucherait le registre, les destinations et les
préférences enregistrées pour un gain nul. **C'est le seul point du lot qui retire une capacité :
à confirmer en recette.**

## 7. Règles métier

- **Le dénominateur de la semaine** (`RunWeekSummary.goalCount`) est `targetFrequency`, à défaut
  `plannedCount`. Il vit dans `resolveRunWeek`, **une seule fois**, et les deux surfaces le lisent.
  Quand les deux manquent, il vaut `0` et les surfaces affichent le nombre de sorties **sans
  dénominateur** : inventer un objectif serait prêter une intention.
- **Fenêtres d'allure** : `[J−29, J]` contre `[J−59, J−30]`, accolées et fermées. Une sortie datée
  du futur (horloge en avance, import) est **écartée**, pas rangée dans la fenêtre courante.
- **Records** : `running_pace_records` ne garde qu'une ligne par distance — il n'y a **pas**
  d'historique, donc pas d'écart avec le record précédent. On dit le chrono et sa date, rien de plus.

## 8. Cas limites

| Cas | Comportement |
|---|---|
| Compte neuf, 0 course | Toutes les cartes se taisent ; la scène reste (état `onboarding`) |
| 1 à 5 courses | « Ton allure » en visage `onboarding` ; le reste se tait |
| Aucune allure de référence au profil | « Ton moteur » se tait (`computePolarisation` rend `null`) |
| Courses manuelles uniquement (sans trace) | « Ton moteur », « Tes records » et « Km par km » se taisent ; « Ton allure » fonctionne (l'allure moyenne existe sans trace) |
| Écart d'allure < 3 s/km | « stable », pas de fil `pace_trend` |
| Semaine vide (ni prévu ni couru) | « Ma semaine » se tait |

## 9. Offline

Aucune écriture, aucune migration, aucune sync rule. Toutes les lectures passent par les hooks
PowerSync existants (`useRunHistory`, `usePaceTrend`, `usePolarisation`, `useRunningRecords`,
`useWeekPlan`) — aucune requête SQL neuve.

## 10. i18n

`runningHub.*` (FR + EN), plus trois entrées `insights.cards.*`. Les titres à variante utilisent le
mécanisme **`context` natif d'i18next** (`title_up` / `title_down`), la même forme que les
`body_up` / `body_down` déjà en place — pas un second schéma de suffixe.

138 lignes ajoutées par locale, **aucune ligne modifiée ou supprimée**.

## 11. Definition of Done

- [x] typecheck 3 workspaces à 0
- [x] lint à 0, **sans warning**
- [x] 224 suites Jest / 3 741 tests + 160 fichiers Vitest / 3 286 tests — **verts, code de sortie lu sans pipe**
- [x] test de garde vu **rouge** sans le correctif (`goalCount` remisé → 1 test échoue)
- [x] parité i18n FR/EN — `scripts/check-i18n-parity.mjs` ne signale **aucune** clé manquante ni
      valeur vide issue de ce lot. Il reste rouge sur **4 valeurs vides préexistantes**
      (`coach.{motivant,sobre}.verdict.warmup`), vérifiées identiques avant et après le lot
- [ ] **maquettes `/design`** — non produites : le skill est réservé à une invocation explicite
- [ ] **recette device** → [RECETTES.md](../../../../RECETTES.md)

## 12. Hors périmètre

- **L'identité par écran pour les piliers Musculation et Nutrition.** Le défaut est identique
  (`/workout`, `/exercises`, `/nutrition-stats`… n'appellent pas `useMenuFocus`) et **constaté, non
  corrigé** : l'élargir toucherait trente écrans sans recette. Porté au [BACKLOG](../../../../BACKLOG.md).
  Le test de garde est écrit pour accueillir les deux autres piliers en une ligne.
- **RUN-07** (séances par type) reste ⏳ : `runs` ne porte pas de `session_type`, et c'est ce mur qui
  fait que l'allure médiane de « Ton allure » mélange fractionnés et sorties longues. Assumé et
  documenté dans l'en-tête de `pace-progress.ts`.
- **RUN-11, RUN-17, RUN-20** (negative split, zones d'allure, dégradation) restent dans
  `/running-history` : les remonter aussi aurait crevé le budget de blocs.
