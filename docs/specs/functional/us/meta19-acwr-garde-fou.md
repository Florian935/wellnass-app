---
id: META-19
titre: "Garde-fou surentraînement (ACWR combiné)"
roadmap: []
catalogue: [META-19]
etape: validation
branche: feature/meta19-acwr-garde-fou
maj: 02/08/2026
---

# US META-19 — Garde-fou surentraînement (ACWR combiné)

> **US d'analyse — aucune ligne roadmap (correction du 02/08/2026).** `docs/roadmap/roadmap.md`
> documente explicitement que les US du [catalogue d'analyses](../../product/analyses-donnees.md)
> ne reçoivent jamais de ligne : leur statut vit **uniquement** dans ce catalogue, pour ne pas
> dupliquer un backlog dans l'autre. (RUN-14/NUTR-16/MUSC-09 avaient reçu une ligne par erreur avant
> que cette règle ne soit retrouvée — corrigé, non reproduit ici.)

## 0. Recommandation officielle du catalogue

`analyses-donnees.md` §« Pistes de priorisation » liste **10 candidats déjà livrés** et **un seul
encore ouvert** : META-19, explicitement décrit comme la **brique commune** à trois autres analyses
non cadrées (RUN-18, MR-10, TRI-12). La construire maintenant évite de la recoder trois fois.

## 1. Surfaçage (ADR-007, obligatoire pour toute US d'analyse)

**Tier 2 — Alerte contextuelle, conditionnelle.** Widget dashboard (accueil), rendu `null` hors de
la condition de risque — **exactement le patron déjà établi par `DeficitVolumeAlertCard` (MN-02,
4.32)**, pas un nouveau Tier 0 permanent. L'ADR est explicite : « Tier 0 plafonné, on ne
l'agrandit pas — ajouter un widget coûte un arbitrage, pas un +1. » Ce n'est **pas** un ajout au
Tier 0 : le widget n'existe à l'écran que quand il a quelque chose à dire.

**Condition d'affichage** : uniquement quand le ratio dépasse la zone saine **haute** (> 1,3, spec
R4) — jamais pour la zone basse (< 0,8, spec R5, hors périmètre de ce garde-fou).

## 2. Ce qui existe déjà

- `workouts.rpe` et `runs.rpe` : RPE de séance, entier 1-10, nullable (déjà saisi par
  l'utilisateur, aucune nouvelle saisie requise).
- `workouts.durationSeconds` / `runs.durationSeconds` : déjà en base.
- `useWorkoutHistory()` / `useRunHistory()` exposent déjà `{ rpe, durationSeconds, finishedAt }` par
  séance — **aucune nouvelle requête de base**, une nouvelle fonction d'agrégation pure suffit.
- Gating pilier (`['strength', 'running']`) : même patron que `training-time` (MR-06).

**Aucune donnée nouvelle, aucune migration.**

## 3. La méthode — charge combinée par séance (sRPE), pas une invention

**R1 — Charge d'une séance = RPE × durée en minutes** (méthode de la « session-RPE », Foster —
c'est la méthode standard citée par le catalogue, pas une formule inventée pour cette US). Une
séance sans RPE **ou** sans durée contribue **zéro** à la charge du jour — elle n'est pas ignorée
du calcul, elle est simplement neutre (cohérent avec R2 de MUSC-09/NUTR-16 : une donnée absente
n'est jamais forcée à une valeur qui fausserait le résultat).

**R2 — La charge combine muscu et course, jour par jour.** Chaque jour, charge = Σ (charge des
séances muscu terminées ce jour) + Σ (charge des courses terminées ce jour). C'est la version
**combinée** de l'ACWR (distincte d'un ACWR par pilier, RUN-18/futur, hors périmètre ici).

**R3 — Les fenêtres sont des jours calendaires fixes (7 et 28), pas des jours d'activité.**
⚠️ **Divergence assumée avec le reste de l'app** : NUTR-16/RUN-F3 divisent par les jours
*renseignés* (jamais par la longueur calendaire). L'ACWR est une méthode **normée**
(sport-science) où le repos compte explicitement dans la moyenne — un jour de repos fait
légitimement baisser la charge moyenne, c'est le principe même de l'indicateur. Diviser par les
seuls jours actifs changerait sa nature.
- Charge aiguë = Σ charge des 7 derniers jours ÷ 7.
- Charge chronique = Σ charge des 28 derniers jours ÷ 28.
- ACWR = charge aiguë ÷ charge chronique.

**R4 — Zone de risque : ACWR > 1,3.** Seuil standard de la littérature (cité par le catalogue). Le
garde-fou s'affiche **uniquement** dans ce cas, avec une suggestion de jour de repos — **jamais
imposée** (même principe que MUSC-07/MUSC-08 : suggérée, pas prescrite).

**R5 — La zone basse (< 0,8) est explicitement hors périmètre.** Un ACWR bas signale un
sous-entraînement/désentraînement, pas un risque de surcharge — ce n'est pas ce que « garde-fou
surentraînement » veut dire. L'inclure inviterait à suggérer un jour de repos à quelqu'un qui vient
déjà d'en prendre plusieurs, contradiction que la spec du catalogue elle-même n'a pas vue (sa
formulation « hors zone sûre = risque » couvre les deux zones en une phrase, ce qui est trop large
pour un garde-fou dont l'action proposée — se reposer — n'a de sens que dans un seul sens).

**R6 — Pas de charge chronique (aucune séance sur 28 j) → pas d'alerte, pas de ratio affiché.**
Un compte neuf ou une reprise après une longue pause n'a pas de base de comparaison ; afficher un
ratio dans ce cas (division par une charge quasi nulle) produirait un chiffre absurde plutôt qu'une
absence de donnée.

## 4. Périmètre

**Dans le périmètre** :
- Fonction pure de calcul (packages/shared).
- Widget dashboard conditionnel (Tier 2), gating `['strength', 'running']`.

**Hors périmètre** :
- ACWR par pilier séparé (RUN-18, futur candidat distinct — cette US construit la brique commune,
  pas les déclinaisons).
- Toute action automatique (report de séance, notification) — un affichage informatif seulement,
  cohérent avec MUSC-07/MUSC-08.
- La zone basse (R5).

## 5. i18n

Nouvelle famille `home.trainingLoad.*`, FR + EN :
- `eyebrow` — « Charge d'entraînement » / « Training load ».
- `title` — « Charge élevée cette semaine » / « High training load this week ».
- `message` — « Ta charge combinée est nettement au-dessus de ta moyenne des 4 dernières semaines. »
  / « Your combined load is well above your average over the last 4 weeks. »
- `recommend` — « Un jour de repos supplémentaire peut aider à récupérer. » / « An extra rest day
  can help you recover. »

## 6. Comportement offline

**Total.** Lecture PowerSync locale (`workout_sets`/`workouts`/`runs` déjà synchronisés),
agrégation pure. Aucun réseau.

## 7. Accessibilité

Le widget est un bloc `accessible` unique (titre + message + recommandation) — pas des `Text`
disjoints. Ton factuel, jamais alarmiste (même exigence que R4 de RUN-F3 : pas de rouge, pas de mot
comme « échec » ou « danger »).

## 8. Critères de recette

- [ ] 1. Charge des 7 derniers jours nettement supérieure à la moyenne des 28 derniers → le widget
      s'affiche avec le message + la recommandation.
- [ ] 2. Ratio dans la zone saine (0,8-1,3) → le widget **ne s'affiche pas** (`null`), pas un
      affichage neutre.
- [ ] 3. Ratio bas (< 0,8) → le widget **ne s'affiche pas** non plus (R5, hors périmètre).
- [ ] 4. Aucune séance sur les 28 derniers jours (compte neuf) → pas de widget, pas d'erreur, pas de
      division par zéro (R6).
- [ ] 5. Une séance sans RPE renseigné ne fausse pas le calcul vers le haut ni vers le bas — elle
      contribue zéro (R1).
- [ ] 6. Seul un pilier actif (muscu **ou** course, pas les deux) → le widget ne s'affiche jamais,
      quelle que soit la charge.
- [ ] 7. **Mode avion** : le widget s'affiche normalement s'il y a lieu (aucun réseau requis).
- [ ] 8. En **EN** : le message et la recommandation sont grammaticaux.
- [ ] 9. TalkBack énonce le widget comme un bloc cohérent, pas des fragments disjoints.
