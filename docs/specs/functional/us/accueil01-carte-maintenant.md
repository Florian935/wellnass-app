---
id: ACCUEIL-01
titre: "La carte « maintenant » — l'accueil a enfin une priorité"
roadmap: [7.23]
catalogue: []
etape: close
branche: feature/accueil-refonte
maj: 10/09/2026
---

# ACCUEIL-01 — La carte « maintenant »

> Première des six US de la **refonte de l'accueil**, toutes livrées dans un **lot unique** sur
> `feature/accueil-refonte` (arbitrage de Florian, 09/09/2026 : « TOUT faire d'un seul gros lot
> d'implémentation, je ferai le recettage à la toute fin »).
>
> Analyse d'origine : `design/accueil-refonte/Refonte-accueil-analyse.pdf` (10 pages, 20 défauts
> référencés au fichier et à la ligne). Maquettes validées : canvas « Accueil FitTrio », 6 planches.

## 1. Le défaut

L'accueil était un **conteneur générique** : la même `WidgetGrid` que les hubs Muscu et Course,
sans rien d'épinglé. Tout y était déplaçable et masquable, donc **rien n'y était garanti à
l'écran** — alors que les deux hubs pilier ont, eux, une carte d'action épinglée hors grille qui
décide de sa propre priorité.

Trois conséquences mesurées :

| Constat | Vérification |
|---|---|
| Aucune hiérarchie : 5-6 rectangles de poids visuel identique | `uniformSize(HOME_WIDGET_IDS, 'wide')` |
| La séance de **course** du jour n'apparaissait jamais | `useTodaySession('strength')` en dur, `TodaySessionCard.tsx:27` |
| L'**heure** de la séance n'était jamais affichée | `planned_sessions.scheduled_time`, remontée par aucun hook |

Ironie du deuxième point : le **widget d'écran d'accueil Android** (LAUNCHER-01) balayait
correctement les deux piliers (`computeTodaySessionMetric`). Le tableau de bord *hors* de l'app
était donc plus juste que celui *dedans*.

## 2. Ce qui est livré

Une carte **épinglée hors grille** (zone 1 de l'accueil), qui affiche **un seul sujet** : la
prochaine action. Elle remplace le widget `today-session`, retiré du registre.

### 2.1 La décision est pure et testée

`resolveNowAction(input): NowAction` dans `packages/shared/src/now-action.ts` — aucune lecture
d'horloge, aucun accès aux données, aucune dépendance React. Le composant ne fait que peindre.

**R1 · L'ordre de `NOW_ACTION_ORDER` EST la priorité** (même parti pris qu'`INSIGHT_ORDER`, et
pour la même raison : une priorité écrite une fois se relit en revue, un score se discute sans se
prouver) :

```
workout-active → run-active → session-today → meal-due → weigh-in-due
  → wellbeing-due → day-done → idle
```

Le raisonnement : ce qui **tourne déjà** passe avant tout (laisser une séance en cours hors de
l'accueil est le pire cas possible) ; puis l'**engagement pris** (le planning du jour) ; puis les
**saisies dues**, dans l'ordre de ce qu'elles coûtent si on les oublie ; puis le check-in du soir ;
puis on **rend compte** au lieu de réclamer.

### 2.2 Règles

- **R2 · Les deux piliers d'entraînement.** `todayTrainings` reçoit la séance muscu **et** la
  séance de course. À deux séances le même jour, la **plus proche** gagne (`sortTrainingsByTime`) ;
  les séances sans heure passent en dernier ; à heure égale, la musculation d'abord (choix
  arbitraire mais **stable**).
- **R3 · L'heure est affichée** quand l'occurrence en porte une, dans le sur-titre.
- **R4 · Ne rend jamais `null`.** Une carte épinglée qui disparaît réintroduit le trou de mise en
  page que la grille a mis quatre tentatives à corriger. Au pire, l'état `idle`.
- **R5 · « Journée faite » n'est jamais un mensonge** : l'état `day-done` exige au moins une trace
  réelle du jour (`hasDoneSomething`). Une série de 12 jours ne compte pas comme une trace
  d'aujourd'hui.
- **R6 · Aucun bouton sur `day-done`.** C'est un compte rendu ; un bouton en ferait une injonction.
- **R7 · Le check-in de bien-être n'est proposé que le soir**, et seulement à qui le pratique déjà
  (au moins une entrée dans les 30 derniers jours). ⚠️ Il n'existe **aucun réglage**
  `wellbeingEnabled` : BIEN-01 n'a pas d'interrupteur. On observe donc un usage au lieu de lire une
  intention déclarée.
- **R8 · Le verrou d'action.** Le démarrage de séance passe par `useActionLock` — seizième site du
  défaut de double appui, corrigé le 14/08/2026 : deux appuis du même cycle de rendu créaient deux
  séances, dont une orpheline.

### 2.3 Ce que cette US rend visible pour la première fois

`useMealDeadline`, `useWeighInDeadline` et `useSessionDeadline` (NUTR-F1, MUSC-F8) existaient et ne
servaient **qu'à programmer des notifications**. L'app savait, à l'heure près et **par
apprentissage**, ce qu'il restait à faire aujourd'hui — sans jamais le montrer à l'ouverture. La
carte affiche désormais « À saisir · d'habitude vers 20 h ».

## 3. `today-session` n'a pas disparu : il a été promu

Le registre passe de 8 à… 8. `today-session` quitte `HOME_WIDGET_IDS`, `weight` y revient
(ACCUEIL-04). **`MAX_HOME_WIDGETS` n'a donc pas eu à bouger** — contrairement à ce que l'analyse
recommandait initialement (8 → 9).

Sa destination est déclarée `{ kind: 'home-pinned', zone: … }`, un **nouveau type** dans
`widget-destinations.ts`. La distinction avec `home` n'est pas cosmétique : un widget de grille est
masquable par l'utilisateur, une zone épinglée est garantie. Le signal est donc **mieux** exposé
qu'avant, et l'assertion `KEPT_ON_HOME === HOME_WIDGET_IDS` reste vraie.

## 4. i18n

Toutes les chaînes sous `home.now.*`, FR **et** EN (décision G). Parité vérifiée : 240 clés de part
et d'autre sous `home`. Pluriels i18next pour `sessions` / `runs` / `streak`.

## 5. Offline

Aucune requête réseau, aucune migration, aucune sync rule. Tout vient de SQLite local via les hooks
existants. Le démarrage de séance est une écriture locale (offline-first).

## 6. Cas limites

| Cas | Comportement |
|---|---|
| Séance muscu **et** course le même jour | la plus proche en heure ; muscu si égalité |
| Occurrence sans heure | affichée sans heure, et passe après celles qui en ont une |
| Heure malformée en base | traitée comme absente (jamais de désordre de tri) |
| Séance du jour déjà faite | `useTodaySession` ne la remonte pas → on passe à la suite |
| Pilier course inactif | la séance de course n'entre pas dans les candidats |
| Chargement | la carte rend l'état `idle` plutôt que rien |

## 7. Recette

- [ ] Un jour avec séance muscu planifiée **à une heure** : la carte affiche le nom **et** l'heure.
- [ ] « Démarrer la séance » ouvre bien la séance, **une seule fois** en double appui rapide.
- [ ] Un jour avec **sortie de course** planifiée et **aucune** séance muscu : la carte affiche la
      course (c'était le défaut principal) et « Démarrer la course » ouvre le suivi GPS.
- [ ] Deux séances le même jour : c'est **la plus proche** qui s'affiche.
- [ ] Pendant une séance en cours : la carte propose « Reprendre », jamais « Démarrer ».
- [ ] Le soir, repas non saisi après l'heure habituelle : la carte le réclame, avec l'heure apprise.
- [ ] Après une journée complète : la carte **rend compte** et ne propose aucun bouton.
- [ ] Journée totalement vide à 22 h : elle ne prétend **pas** que la journée est faite.
