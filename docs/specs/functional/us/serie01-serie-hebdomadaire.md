---
id: SERIE-01
titre: "La régularité dite en semaines — série hebdomadaire et objectif récurrent transverse"
roadmap: [7.36]
catalogue: []
etape: code
branche: dev
maj: 21/09/2026
---

# US SERIE-01 — La régularité, dite en semaines

> Issue de l'**analyse Strava du 20/09/2026** —
> [analyse-strava-2026-09.md](../../../product/analyse-strava-2026-09.md), candidats **S13** et
> **S7**, observations **O1**, **O4** et **O23**. C'était la conclusion la plus inattendue de
> l'analyse : *« le meilleur rapport impact / coût de tout ce document, et ce n'était pas dans mon
> premier jet »*.
>
> ⚠️ **Travail directement sur `dev`** (décision Florian, cf. FANT-01, CARDIO-UX02, EFFORT-01).
>
> ⚠️ **Étape design non franchie par l'agent** : `/design` est réservé à une invocation explicite de
> Florian. Le brief à coller est en **§10** ; **rien n'a été produit à la place**.

## 1. Le problème

**Notre série est quotidienne, donc fragile par construction.** Rater un mardi la casse.

Et on l'a déjà reconnu, deux fois, en construisant **deux mécanismes correctifs par-dessus** :

- **STREAK-01** (roadmap 7.14) — le **joker** : un par mois, qui gèle *un jour isolé*, avec trois
  règles de crédibilité pour qu'il ne devienne pas un compteur qui ne mesure plus rien ;
- **VIE-01** (roadmap 1.28) — les **jours en pause** : un **troisième état de jour** dans le modèle,
  « ni cassé ni allongé ».

Deux US, un état supplémentaire dans le calcul, et **le problème reste un problème** : la série
casse toujours au deuxième jour manqué, et un jour de repos reste un jour perdu.

**Strava répond autrement, et sa réponse est plus simple que nos deux pansements : il compte en
semaines.** Confirmé par deux captures indépendantes — « 0 **Semaines** » sur le profil (O1), et la
notification qui dit noir sur blanc : *« Faites preuve de régularité en enregistrant une activité
**une fois par semaine**  »* (O23).

Une semaine laisse **sept occasions de la sauver**. Elle tolère la grippe, le déplacement, et
surtout le **jour de repos que nos propres programmes recommandent**. Notre série quotidienne est,
littéralement, en contradiction avec les plans d'entraînement que l'app propose.

## 2. Cinq constats vérifiés dans le code

**C1 — La série compte des jours consécutifs.**
[`computeStreak`](../../../../packages/shared/src/streak.ts) remonte jour par jour depuis
aujourd'hui (ou hier si aujourd'hui est encore inactif).

**C2 — Les deux pansements sont réels, et coûteux.**
[`streak-joker.ts`](../../../../packages/shared/src/streak-joker.ts) porte trois règles rien que pour
empêcher le joker de dénaturer la série (« un joker ne couvre qu'un jour **isolé** », « deux jours
couverts ne peuvent pas se suivre », « un joker n'affecte **que** la série »). VIE-01 y ajoute un
troisième état de jour.

**C3 — 🔴 La série est transverse, la cible hebdomadaire ne l'est pas.**
[`useStreakData`](../../../../apps/mobile/src/data/repositories/dashboard-repository.ts) agrège
**musculation + course + autres activités + pas**. Mais `weekly_frequency` n'existe que sur
**`running_profiles`** : la musculation et la nutrition n'ont **aucune** cible hebdomadaire. Le hub
Course affiche « 2 / 3 faites » ; les deux autres piliers n'ont rien d'équivalent.

**C4 — La semaine du dépôt commence le lundi.**
[`startOfWeek`](../../../../packages/shared/src/date.ts) rend le lundi ; `useStreakData` documente
déjà sa bande de 7 jours comme « semaine ISO courante (lundi → dimanche) ». **Aucune convention
nouvelle à inventer.**

**C5 — GUID-01 n'est pas un objectif concurrent.**
[`guidance.ts`](../../../../packages/shared/src/guidance.ts) est une **couche de politique** : elle
répond à « cette décision-là, je l'applique, je la propose, ou je me tais ? », et ne produit
**aucune** recommandation. Elle ne rivalise donc pas avec un objectif hebdomadaire — elle décide
**comment il parle**. *(Rectification : l'analyse parlait de « quatre systèmes qui se
contrediraient » ; après lecture du code, il n'y en a que deux — la série et la fréquence coureur —
plus une couche de politique au-dessus.)*

## 3. Ce que fait cette US

1. **Une série hebdomadaire**, calculée à côté de la quotidienne.
2. **Un objectif hebdomadaire récurrent et transverse**, en **nombre d'activités** — ce que la
   musculation et la nutrition n'ont jamais eu.
3. **L'articulation** des deux avec la fréquence visée du coureur et le régime de guidage.

**Hors périmètre** : la mise en scène sociale de la série (Strava en fait un post dans le fil des
autres — O1 ; c'est **écarté** par l'analyse §9), les défis, les trophées.

## 4. Règles métier

### 4.1 La série hebdomadaire

**R1** — Une **semaine est active** si elle porte **au moins une** activité : musculation, course,
**nutrition**, ou autre activité saisie. Semaine **lundi → dimanche**, convention déjà en vigueur (C4).

⚠️ **Correction du 21/09/2026, trouvée en écrivant le moteur.** La première version de cette règle
omettait la **nutrition**. C'était une erreur : la série **quotidienne** la compte déjà, et l'exclure
aurait privé de **toute** série hebdomadaire quelqu'un qui n'utilise que ce pilier — contraire à la
décision de cadrage **H** (chaque pilier est utile seul).

La ligne juste n'est pas « entraînement contre le reste », c'est **le geste délibéré contre la mesure
passive** : noter un repas est un acte, le téléphone qui compte des pas n'en est pas un. C'est ce qui
justifie d'inclure la nutrition **et** d'exclure les pas (D3), sans contradiction.

**R2** — La série hebdomadaire est le nombre de **semaines actives consécutives**, en remontant.

**R3** — 🔴 **La semaine courante ne casse jamais la série tant qu'elle n'est pas finie.** C'est la
transposition exacte de la règle du quotidien (« aujourd'hui inactif ne casse pas encore »). Sans
elle, **la série de tout le monde tomberait à zéro tous les lundis matin** — le défaut le plus
visible qu'on puisse livrer.

**R4** — **Ni joker ni jour en pause ne s'appliquent à la série hebdomadaire.** Ils existent pour
réparer la fragilité du quotidien ; l'hebdomadaire n'en a pas besoin. Ils restent **intégralement en
vigueur** pour la série quotidienne, qui ne change pas d'un iota.

**R5** — ⚠️ **Exception à R4 — une semaine entièrement en pause est traversée.** Si **tous** les
jours d'une semaine sont couverts par une période « vie réelle » (VIE-01) et qu'aucune activité n'y
est enregistrée, la semaine est **transparente** : la série la franchit sans la compter, ni la
casser. C'est la règle D4 de VIE-01 (« ni cassée, ni allongée »), transposée à l'échelle de la
semaine. Une semaine **partiellement** en pause reste une semaine ordinaire.

**R6** — Les deux séries **coexistent** ; l'unité affichée est un réglage (§7, **D1**). Les deux
sont calculées dans tous les cas — c'est ce qui permet de basculer sans rien perdre.

### 4.2 L'objectif hebdomadaire

**R7** — L'objectif est un **nombre d'activités par semaine**, de **1 à 14**. En activités et non en
kilomètres ou en minutes : c'est ce qui le rend **transverse** aux trois piliers, et c'est le choix
de Strava (O4 : « Objectif hebdomadaire — 1 activité / 4 »). Un objectif d'**habitude**, pas de
performance.

**R8** — Il **se réarme seul** chaque lundi. **Rien n'est stocké par semaine** : la progression est
dérivée des activités de la semaine courante, comme les objectifs d'OBJ-01 (décision D5 :
« aucune progression n'est stockée, tout est recalculé à l'affichage »). Donc juste hors-ligne,
et juste rétroactivement.

**R9** — 🔴 **Aucune valeur par défaut.** `null` signifie « **la question n'a jamais été posée** »,
jamais « 3 ». C'est la leçon de `activity_level` (NUTRI-UX01) : un repli affiché comme un choix a
produit une cible calorique surestimée de ~614 kcal/jour, en silence. Sans objectif, la carte
affiche le **compte** (« 3 activités cette semaine ») au lieu d'inventer une cible.

**R10** — Il **ne remplace pas** `running_profiles.weekly_frequency`, qui reste la cible du **pilier
Course** et alimente le hub Course. Les deux vivent à des échelles différentes : l'un compte les
sorties, l'autre les activités, toutes disciplines confondues.
⚠️ **Incohérence à signaler, pas à corriger** : si l'objectif transverse est **inférieur** à la
fréquence coureur (« 2 activités » alors que le profil vise 3 sorties), l'app le **dit** — elle ne
réécrit ni l'un ni l'autre. Décider à la place de l'utilisateur serait exactement le défaut que
GUID-01 cherche à éviter.

**R11** — Le **régime de guidage** (GUID-01) décide comment l'objectif parle, pas ce qu'il vaut :
`guided` peut **proposer** une valeur à l'onboarding, `assisted` la propose sans insister,
`autonomous` ne demande rien. Aucun régime n'écrit l'objectif sans accord.

### 4.3 Cas limites

**R12** — **Compte neuf** : aucune semaine passée, donc série à 0 et non « 1 » — une semaine
commencée n'est pas une semaine tenue.

**R13** — **Changement de fuseau horaire** : les clés de jour sont déjà locales (`localDayKey`) ; la
semaine hérite de la même convention. Aucun traitement particulier, et surtout aucune conversion
UTC qui ferait sauter une frontière de semaine.

**R14** — **Activité antidatée** (saisie manuelle d'une sortie de la semaine dernière) : elle
**réactive** sa semaine et peut donc **rallonger** la série rétroactivement. C'est voulu — la série
décrit ce qui s'est passé, pas ce que l'app a vu passer.

**R15** — Les **pas** (PAS-01) comptent pour la série **quotidienne** quand l'objectif de pas est
atteint. ⚠️ **À trancher (§7, D3)** : comptent-ils pour la semaine ? Une semaine « active » parce
qu'on a marché n'est pas la même promesse qu'une semaine où l'on s'est entraîné.

## 5. Modèle de données

Deux colonnes **additives et nullables**, aucune table neuve, **aucune sync rule à redéployer** :

```
user_settings.streak_unit          text null   check (streak_unit in ('day','week'))
user_settings.weekly_activity_goal integer null check (between 1 and 14)
```

`user_settings` est **déjà publiée et lue en `select *`** — le réflexe « migration ⇒ sync rule à la
main » ne vaut que pour une **table neuve**.

🔴 **Les deux colonnes doivent être déclarées dans
[`powersync/schema.ts`](../../../../apps/mobile/src/powersync/schema.ts) ET dans
`settings-repository.ts`**, sous peine de panne silencieuse : l'écriture échoue, `void
updateSettings()` avale l'erreur, et l'interrupteur revient à sa valeur précédente sans message.
C'est la panne exacte de `cycle_tracking_enabled` (31/07) et de `daily_step_goal` (03/08).

**Aucune migration de données** : `null` partout, y compris pour les comptes existants (R9).

## 6. Comportement offline

Conforme à [offline-sync.md](../../technical/offline-sync.md), sans exception. **Tout est dérivé** :
la série comme la progression de l'objectif se recalculent depuis les activités déjà en SQLite —
aucune table de compteur, donc rien à réconcilier entre deux appareils. Deux téléphones hors réseau
qui enregistrent chacun une activité la même semaine **s'additionnent** au retour du réseau, au lieu
de s'écraser.

## 7. Décisions demandées

| # | Décision | Ma recommandation |
|---|---|---|
| **D1** | **Quelle unité par défaut ?** | 🔴 **La semaine pour les comptes neufs, le jour pour les comptes existants** — la migration pose `'day'` explicitement. Basculer la série de quelqu'un qui en tient une de 40 jours, sans le prévenir, serait le pire accueil possible pour cette US. Une carte unique, une fois, propose la bascule. |
| **D2** | **Affiche-t-on les deux séries en même temps ?** | **Non.** Deux compteurs de régularité côte à côte, c'est deux fois moins lisible et ça contredit [ADR-007](../../../adr/ADR-007-surfacage-analyses.md). L'autre unité se lit au détail. |
| **D3** | **Les pas font-ils une semaine active ? (R15)** | **Non.** La série quotidienne les compte déjà ; à l'échelle de la semaine, « j'ai marché » et « je me suis entraîné » ne sont pas la même promesse, et la confusion viderait la série de son sens. ⚠️ *Le critère retenu est le **geste délibéré** : la nutrition compte (on note son repas), les pas non (le téléphone les compte tout seul). Voir la correction de R1.* |
| **D4** | **Propose-t-on une valeur d'objectif à l'onboarding ?** | **Oui, mais jamais écrite sans accord** (R9, R11) : la proposition vient de `weekly_frequency` si le pilier Course est actif, sinon de rien. |
| **D5** | **Le joker devient-il inutile ?** | **Non, et on n'y touche pas.** Il reste attaché à la série quotidienne, qui continue d'exister. Si la semaine devient l'unité de tout le monde un jour, ce sera une autre US — pas un effet de bord de celle-ci. |

## 8. i18n — FR + EN

| Clé | FR | EN |
|---|---|---|
| `streak.unit.day` | Jours | Days |
| `streak.unit.week` | Semaines | Weeks |
| `streak.weekly.count` | {{count}} semaine d'affilée | {{count}} week in a row |
| `streak.weekly.count_other` | {{count}} semaines d'affilée | {{count}} weeks in a row |
| `streak.weekly.none` | Aucune semaine encore | No week yet |
| `streak.weekly.safe` | Cette semaine est validée | This week is done |
| `streak.weekly.atRisk` | Il te reste {{days}} jours pour valider la semaine | {{days}} days left to keep the streak |
| `weeklyGoal.title` | Ton objectif de la semaine | Your weekly goal |
| `weeklyGoal.progress` | {{done}} activités sur {{total}} | {{done}} of {{total}} activities |
| `weeklyGoal.none` | {{count}} activité cette semaine | {{count}} activity this week |
| `weeklyGoal.conflict` | Ton objectif ({{goal}}) est sous ta fréquence de course visée ({{frequency}}). | Your goal ({{goal}}) is below your target running frequency ({{frequency}}). |

⚠️ **Le pluriel n'est pas une concaténation** : `count` est une variable **réservée** d'i18next et
déclenche la pluralisation — c'est ce qu'on veut ici, avec les suffixes `_one` / `_other`.
*(Leçon de PARTAGE-02 : `ordinal` est également réservé, et l'utiliser comme variable
d'interpolation ne compile pas.)*

## 9. Critères de recette

- [ ] Une semaine avec **une seule** activité compte comme active.
- [ ] 🔴 **Lundi matin, la série ne tombe pas à zéro** (R3). Le critère le plus important de cette US.
- [ ] Deux semaines consécutives actives → série à 2.
- [ ] Une semaine **vide** au milieu casse la série.
- [ ] Une **semaine entièrement en pause** (VIE-01) est traversée, sans casser ni allonger (R5).
- [ ] Une semaine **partiellement** en pause se comporte comme une semaine ordinaire.
- [ ] Le **joker** ne change rien à la série hebdomadaire (R4), et continue de fonctionner sur la quotidienne.
- [ ] Une activité **antidatée** rallonge la série rétroactivement (R14).
- [ ] **Sans objectif réglé**, la carte affiche le **compte**, jamais une cible inventée (R9).
- [ ] Avec un objectif, la progression est juste et se **réarme le lundi** (R8).
- [ ] Un objectif **inférieur** à la fréquence coureur est **signalé**, et rien n'est réécrit (R10).
- [ ] Les **pas seuls** ne rendent pas une semaine active (D3).
- [ ] **Un compte existant garde sa série quotidienne** et son unité, sans surprise au premier lancement (D1).
- [ ] **Mode avion** : série et objectif corrects.
- [ ] Deux appareils hors réseau, une activité chacun la même semaine → les deux comptent après synchro.
- [ ] **EN** : le pluriel est correct à 1 et à 2 semaines.
- [ ] **Lecteur d'écran** : la série s'annonce en toutes lettres, pas seulement le chiffre.

## 10. Le brief `/design` à coller

```
/design Wellness — la régularité en semaines (SERIE-01). Charte de l'app :
crème #f7eede, terracotta #b14f2b, Bricolage Grotesque + Hanken Grotesk +
Space Mono, mobile 390px. Planches animées.

1. LA CARTE DE SÉRIE, EN SEMAINES — la flamme, le nombre, et une bande de
   semaines (pas de jours). Trois états : semaine validée, semaine en cours
   encore à valider, série à zéro.
2. LA BASCULE — la carte unique qui propose de passer du jour à la semaine,
   avec les deux compteurs côte à côte pour que le choix soit éclairé.
   Elle n'apparaît QU'UNE fois.
3. L'OBJECTIF DE LA SEMAINE — anneau de progression, « 2 activités sur 4 »,
   en nombre d'activités et non en kilomètres. Et l'état SANS objectif réglé :
   le compte nu, « 3 activités cette semaine », sans cible inventée.
4. LE RÉGLAGE — choisir l'unité de série et le nombre d'activités visé.
5. L'INCOHÉRENCE — le message quand l'objectif transverse est sous la
   fréquence de course visée. Il signale, il ne corrige pas.
```

## 11. Ce que cette US ne fait pas

- **Aucune mise en scène sociale** de la série (Strava en fait un post chez les autres — écarté).
- **Ne touche pas au joker** ni aux jours en pause : la série quotidienne est inchangée.
- **Ne supprime pas** `weekly_frequency` du profil coureur.
- Aucun **défi**, aucun **trophée** — gamification hors V1 ([ADR-005](../../../adr/ADR-005-gamification.md)).
