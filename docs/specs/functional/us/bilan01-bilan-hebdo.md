---
id: BILAN-01
titre: "Bilan hebdomadaire automatique"
roadmap: [7.16]
catalogue: [MR-22, TRI-07, NUTR-18]
etape: recette
branche: feature/bilan01-bilan-hebdo
maj: 29/07/2026
---

# US BILAN-01 — Bilan hebdomadaire automatique

> **4 décisions produit arbitrées par Florian le 29/07/2026** avant tout code, **+ 3 dérivées**
> tranchées par moi et signalées comme telles. Roadmap **7.16** (V0.9, P1, ~5 h). Fait descendre
> **MR-22**, **TRI-07** et **NUTR-18** du [catalogue d'analyses](../../../product/analyses-donnees.md).
>
> **Vérifié avant d'écrire** : aucun bilan n'existe (aucune brique, aucun écran, aucun widget). En
> revanche **l'infra notifications est complète** (canal, permission, DND, plafond/jour, préférences
> typées à parseur tolérant) et **tous les agrégats nécessaires existent et sont testés**.

## 0. La contrainte structurante, et la contradiction qu'elle cache

Le backlog l'énonce : **aucune narration sans les chiffres affichés à côté.** Texte assemblé depuis
des clés i18n, agrégats calculés localement, **pas d'IA**.

Mais il y a une contradiction que le backlog ne dit pas. Le récap est calculé **localement**, donc
il ne peut être calculé que **quand l'app tourne**. Or la notification doit partir en début de
semaine, app fermée. Les deux sont incompatibles : soit on planifie un texte **pré-calculé** — et on
prend le risque d'annoncer un chiffre faux si l'utilisateur a couru entre le calcul et l'envoi —,
soit la notification n'est qu'un **déclencheur** et le calcul se fait à l'ouverture.

C'est **D1**, et elle commande tout le reste.

## 1. Décisions arbitrées

| # | Question | Décision | Pourquoi |
|---|---|---|---|
| **D1** | Calcul et notification | **Notification sobre + calcul à l'ouverture.** La notification dit « ton bilan de la semaine est prêt » ; l'écran calcule tout à l'affichage | Les chiffres sont **toujours frais**, donc jamais faux. Et surtout : cela **neutralise le doze mode Android**, qui est le point dur annoncé. Une notification retardée d'une heure — ou de six — reste exacte, parce qu'elle ne contient aucun chiffre. Un texte pré-calculé, lui, périme |
| **D2** | Choix de la « seule décision » | **Règles ordonnées, priorité fixe, la première qui déclenche gagne** | Déterministe, testable, et **explicable** : on peut répondre à « pourquoi ce conseil ? ». Un score d'urgence par signal aurait des pondérations arbitraires, impossibles à justifier et à tester. Changer l'ordre ne touche pas au calcul |
| **D3** | Surface | **Écran dédié + widget d'accueil** | Le widget porte la décision de la semaine et ouvre l'écran ; l'écran porte les chiffres. Le bilan reste **consultable en semaine**, pas seulement au moment de la notification — sans quoi il n'existe que pour ceux qui tapent la notif |
| **D4** | Semaine vide | **Aucune notification. L'écran reste consultable**, avec un message neutre | Une notification qui dit « tu n'as rien fait » est punitive, et c'est le genre de message qui fait désinstaller. Le silence respecte l'utilisateur ; s'il vient de lui-même, il trouve une reprise en douceur |
| **D5** | Période couverte | *Dérivée.* **La dernière semaine ISO close** (lundi → dimanche), notification le **lundi** | Un bilan sur une semaine close est **définitif** : il ne bougera plus, même raisonnement que le verdict d'OBJ-01. La comparaison S vs S-1 devient propre (deux semaines complètes). Et « la décision pour la semaine à venir » arrive **au début de la semaine où elle s'applique**, pas la veille |
| **D6** | Cohérence des chiffres | *Dérivée.* **Tous les agrégats sont bornés sur la MÊME fenêtre** — donc on n'utilise **pas** les hooks glissants existants | `useWeeklyVolumeComparison` porte sur **7 jours glissants** et `useMuscleBalance` sur **14 jours**. Les réutiliser afficherait, sous un titre « semaine du 20 au 26 juillet », des chiffres portant sur une autre période. Ce serait exactement la narration non adossée aux chiffres que la roadmap interdit. Le coût est quelques requêtes bornées de plus ; le bénéfice est un bilan qui ne ment pas |
| **D7** | Stockage | *Dérivée.* **Aucune migration, aucune table, aucune sync rule** | Le bilan est **entièrement dérivé** (conséquence de D1) et les préférences vont dans `user_settings.notifications`, dont le parseur est déjà **tolérant** : deux champs de plus sont lus avec un défaut, sans migration. Le déclencheur `WEEKLY` est **récurrent côté OS**, donc il n'y a même pas de « dernière semaine notifiée » à mémoriser |

## 2. Périmètre

**Dans le périmètre** : brique pure de synthèse **testée** (chiffres + signaux ordonnés + décision),
requêtes bornées sur la semaine ISO, écran dédié, widget d'accueil, notification hebdomadaire
récurrente respectant DND et le plafond/jour, préférences (activation + heure), i18n FR + EN.

**Hors périmètre, explicitement**

- **Toute IA / tout texte libre.** Le texte est **assemblé depuis des clés i18n** avec des nombres
  interpolés. C'est ce qui garantit la traduction, la cohérence et l'absence d'invention.
- **Le bilan mensuel** et le « wrapped » annuel → post-V1 (voir [IDEAS.md](../../../../IDEAS.md)).
- **L'historique des bilans passés** : on ne stocke rien (D7), donc on ne consulte que la dernière
  semaine close. Naviguer dans les semaines antérieures est un sous-lot post-V1 — et il sera gratuit,
  puisque le calcul est déjà paramétré par la fenêtre.
- **Le partage du bilan** → PARTAGE-01.
- **iOS** : le déclencheur `WEEKLY` est documenté côté **Android** dans le SDK 57 ; iOS demanderait un
  `CalendarNotificationTrigger`. Hors périmètre (décision E, Android d'abord). L'écran et le widget
  fonctionnent partout — **seule la notification est Android**.

## 3. Comportement

### 3.1 La fenêtre

Le bilan porte sur la **dernière semaine ISO close** : du lundi au dimanche précédant le jour de
consultation. Si on est **dimanche**, la semaine en cours n'est pas finie : on montre donc encore
celle d'avant. La comparaison porte sur la **semaine précédant celle-là**.

### 3.2 Les chiffres (toujours affichés, jamais implicites)

| Bloc | Contenu | Comparé à S-1 |
|---|---|:---:|
| Musculation | séances terminées, tonnage | ✅ |
| Course | sorties, distance | ✅ |
| Nutrition | jours journalisés, jours dans la cible (si une cible existe) | ✅ |
| Régularité | jours actifs sur 7 | ✅ |
| Records | records battus dans la semaine | — |
| Objectifs | progression de chaque objectif en cours | — |

Un bloc dont le pilier n'est **pas activé** est absent (arbitrage H, intégration sans imposition).
Un chiffre non calculable (aucune cible nutritionnelle définie, par exemple) est **omis**, jamais
affiché à zéro.

### 3.3 La décision unique — l'ordre de priorité

La **première** règle qui déclenche donne la décision. L'ordre est un choix produit, documenté ici
pour pouvoir être discuté sans relire le code :

| # | Signal | Déclenche quand | Pourquoi à ce rang |
|---|---|---|---|
| 1 | **Objectif en retard** | la progression est en retard sur le temps écoulé, d'au moins 15 points | C'est un engagement que l'utilisateur a pris **lui-même**, avec une échéance. Rien n'est plus actionnable |
| 2 | **Régularité qui décroche** | 0 jour actif, ou une chute d'au moins 3 jours vs S-1 | La constance est le seul prédicteur qui compte à long terme. Une semaine à 1 séance mérite d'être nommée avant un déséquilibre musculaire |
| 3 | **Déséquilibre musculaire** | un groupe musculaire est nettement sous-travaillé sur la fenêtre | Concret, corrigeable en une séance, et c'est ce qui cause les blessures |
| 4 | **Volume ou distance en forte baisse** | −25 % ou plus vs S-1, sur un pilier actif | Signale un décrochage réel, mais moins urgent que l'absence de régularité |
| 5 | **Adhérence nutrition qui décroche** | moins de la moitié des jours journalisés dans la cible, cible définie | Dernier rang parce que le plus sensible : on ne veut pas ouvrir chaque semaine sur l'alimentation |
| 6 | **Rien à signaler** | aucun des précédents | On **nomme le point fort** de la semaine plutôt que d'inventer un problème. Une semaine réussie doit se lire comme telle |

Chaque signal transporte **les chiffres qui le justifient** : l'UI les affiche à côté du texte. Un
signal sans ses chiffres n'est pas affichable — c'est vérifié par le type, pas par la discipline.

### 3.4 La notification

- Déclencheur **`WEEKLY` récurrent** (lundi, heure configurable, défaut **9 h**), identifiant stable
  → au plus une notification de bilan en attente, re-planifier remplace.
- **Respecte le DND** et le plafond/jour existants : mêmes règles que le rappel de série.
- **Contenu volontairement non chiffré** (D1) : « Ton bilan de la semaine est prêt. »
- Désactivable indépendamment du rappel de série (préférence dédiée).
- ⚠️ **Semaine vide → pas de notification** (D4). Comme le contenu ne peut pas être connu à
  l'avance, la planification est **révisée à chaque ouverture de l'app** : s'il n'y a rien à dire
  pour la semaine close, le rendez-vous est annulé ; sinon il est (re)posé.

## 4. Modèle de données

**Aucune migration. Aucune table. Aucune sync rule à déployer.** (D7)

Deux champs s'ajoutent à `NotificationPrefs`, persistés dans `user_settings.notifications` (colonne
JSON **déjà synchronisée**, parseur déjà tolérant) :

```ts
weeklyReview: boolean;      // défaut true
weeklyReviewHour: number;   // 0-23, défaut 9
```

`parseNotificationPrefs` retombe sur les défauts pour toute valeur absente ou invalide : les
réglages existants des utilisateurs continuent de fonctionner sans conversion.

> ⚠️ **Invariant à préserver** : `weeklyReviewHour` (9) doit rester **hors** de la fenêtre DND par
> défaut `[22, 7)`, sinon le bilan serait systématiquement supprimé par le filtre. Même invariant
> que `reminderHour` (20), et il est testé.

## 5. Règles de calcul

Dans une brique **pure et testée** (`weekly-review.ts`), qui reçoit un input **déjà agrégé** et rend
`{ period, metrics, decision }` :

- **Fenêtre** : `[lundi, dimanche]` de la dernière semaine ISO close ; comparaison sur les 7 jours
  précédents.
- **Retard d'objectif** : `tempsÉcoulé/tempsTotal − progression ≥ 0,15`. La marge de 15 points évite
  de crier au retard sur une fluctuation normale.
- **Variation** : via `percentChange` (brique existante), qui gère déjà la division par zéro.
- **Signaux** : évalués dans l'ordre du §3.3, le premier qui déclenche gagne. **Aucun signal ne peut
  exister sans ses chiffres** (garanti par le type).
- **Semaine vide** = aucune séance, aucune sortie, aucun jour journalisé, aucun pas au-dessus de
  l'objectif → `decision = null` et `isEmpty = true`.
- Un pilier **non activé** ne produit ni chiffre ni signal.

## 6. i18n (FR + EN)

Namespace `review` : titre, libellé de période, libellés des blocs de chiffres, **un texte par
signal** avec ses nombres interpolés, message de semaine vide, contenu de la notification, libellés
de préférences. Aucune chaîne en dur, pluriels gérés.

## 7. Accessibilité

Les chiffres sont du **texte**, jamais seulement des barres. Les variations sont annoncées en mots
(« en hausse de 12 % ») et pas seulement par une couleur ou une flèche. Cibles ≥ 48 dp,
`maxFontSizeMultiplier` sur les libellés courts. La décision est un paragraphe lisible par TalkBack,
suivi de ses chiffres.

## 8. Offline

**Tout est local** — conséquence directe de D1 : les requêtes portent sur la base SQLite locale et le
calcul se fait à l'affichage. Le bilan fonctionne en mode avion à l'identique. **Rien à écrire, donc
rien à synchroniser.**

## 9. Cas limites

| Situation | Comportement |
|---|---|
| Semaine vide | Aucune notification (D4) ; écran consultable avec un message neutre de reprise. |
| Première semaine d'utilisation (pas de S-1) | Les chiffres s'affichent **sans comparaison** — pas de « +100 % » trompeur depuis zéro. |
| Aucun pilier activé | Écran avec message neutre, aucune notification. |
| Cible nutritionnelle non définie | Le bloc « jours dans la cible » est **omis**, pas affiché à 0. |
| Aucun objectif en cours | Le signal 1 ne peut pas déclencher ; on passe au suivant. |
| Objectif non calculable (exercice supprimé) | Ignoré par le signal 1 — un retard indéterminable n'est pas un retard. |
| Permission de notification refusée | L'écran et le widget fonctionnent ; aucune notification, aucun crash (contrat existant du wrapper). |
| DND couvre l'heure du bilan | Pas de notification cette semaine-là ; le bilan reste consultable. |
| Doze mode Android | La notification peut arriver en retard — **sans conséquence**, elle ne contient aucun chiffre (D1). |
| Consultation un dimanche | Montre la semaine close précédente, pas la semaine en cours incomplète (D5). |

## 10. Definition of Done

- [x] Brique `weekly-review.ts` **pure et testée** : chiffres, ordre des signaux, décision, semaine
      vide — **26 tests**, dont un qui vérifie que les 6 cas couvrent les 6 signaux **dans l'ordre**.
- [x] Requêtes **bornées sur la fenêtre ISO** (D6). `useGoalAdherenceForRange` a été **extrait** de
      `useGoalAdherence` pour que l'adhérence nutrition porte sur la même semaine que le reste.
- [x] Écran dédié (`app/review.tsx`) + widget d'accueil aux 3 formes (**6 tests**).
- [x] Notification `WEEKLY` récurrente (lundi), DND respecté, **révisée à chaque ouverture**.
- [x] 2 préférences (activation + heure) exposées dans les réglages + invariant DND **testé**.
- [x] i18n FR + EN, aucune chaîne en dur.
- [x] **Aucune migration, aucune table, aucune sync rule** — vérifié : rien à déployer côté PowerSync.
- [x] `npm run lint` (0 erreur), `npm run typecheck` (0 erreur), `npm run test` (**1239**) verts.
- [x] Roadmap 7.16 → 🟡 (recette device à faire).
- [ ] Recette device (12 critères ci-dessous).

### Limite assumée, à connaître

Le rendez-vous hebdomadaire est révisé **à l'ouverture de l'app** (aucune tâche d'arrière-plan). Si
l'utilisateur n'ouvre jamais l'app pendant une semaine vide, la notification posée la semaine
précédente se déclenchera quand même — et tombera sur un écran « rien à résumer ». C'est neutre, et
surtout **jamais un chiffre faux** : c'est exactement ce que D1 achète.

## 11. Critères d'acceptation (recette device)

1. Après une semaine avec des séances : l'écran affiche les chiffres **de cette semaine-là**, avec
   ses dates, et la comparaison à la semaine précédente.
2. **Une seule décision** est affichée, et les chiffres qui la justifient sont **à côté**.
3. Changer les données (ajouter une séance dans la semaine close) puis rouvrir : les chiffres suivent.
4. Semaine vide : **aucune notification**, mais l'écran s'ouvre avec un message de reprise.
5. Première semaine d'utilisation : aucune comparaison affichée (pas de « +100 % »).
6. Pilier nutrition désactivé : aucun chiffre nutritionnel, ni dans l'écran ni dans la décision.
7. Désactiver la préférence « bilan hebdomadaire » : plus aucune notification, écran toujours
   accessible.
8. Régler l'heure du bilan **dans** la fenêtre DND : aucune notification (comportement attendu, pas
   un bug) — et le vérifier explicitement.
9. Le widget d'accueil montre la décision de la semaine et ouvre l'écran.
10. Les variations sont lisibles **sans la couleur** (texte « en hausse de … »).
11. En mode avion : tout fonctionne à l'identique.
12. TalkBack lit la décision puis ses chiffres.
