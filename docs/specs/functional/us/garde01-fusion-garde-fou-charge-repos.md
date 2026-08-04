---
id: GARDE-01
titre: "Garde-fou unifié charge & récupération (fusion TRI-12 + MR-14)"
roadmap: []
catalogue: [TRI-12, MR-14]
etape: recette
branche: refactor/garde01-fusion-garde-fou
maj: 04/08/2026
---

# US GARDE-01 — Garde-fou unifié charge & récupération (fusion TRI-12 + MR-14)

> **Spec fonctionnelle — ✅ validée par Florian le 04/08/2026** (spec + plan + maquette, D1 → D4
> tranchées conformément aux recommandations). **Code livré (TDD) le 04/08/2026** — reste la recette
> device (§11, liste consolidée qui remplace celles de TRI-12 et MR-14).
>
> **US de refactor** — ne livre **aucune fonctionnalité nouvelle** : elle unifie deux widgets
> existants ([TRI-12](tri12-garde-fou-global.md) et [MR-14](mr14-jours-consecutifs-sans-repos.md),
> livrées le 02 et le 04/08/2026) en un seul. Aucune ligne roadmap ; vit dans le
> [catalogue d'analyses](../../product/analyses-donnees.md) via ses deux parents.

## 0. Le vrai problème : le code contient une contradiction

Ce n'est pas qu'un défaut d'affichage. Les deux US livrées **se contredisent sur le fond**, et la
revue de code de MR-14 l'a rendu visible :

| | TRI-12 (livrée 02/08) | MR-14 (livrée 04/08) |
|---|---|---|
| Un streak de charge **seul** justifie-t-il une alerte ? | **Non** — R4 : « une charge sans repos seule n'est pas cette US » | **Oui** — c'est toute sa thèse (§0) |
| Un widget d'alerte doit-il en masquer un autre ? | **Non** — §1 : « les faire disparaître l'un l'autre masquerait un vrai signal composite. Pas de mécanisme de priorité entre eux en V1 » | **Oui** — D1, masquage mutuel, validé le 04/08 |
| Gating | 3 piliers, « pas de dégradation partielle » (R5) | 2 piliers |

**Les deux positions ont été validées, à deux jours d'écart.** MR-14 D1 a introduit précisément le
mécanisme de priorité que TRI-12 §1 avait écarté par principe. Tant que les deux widgets coexistent,
le code applique les deux règles contradictoires en même temps.

**Conséquence mesurée en revue** (algèbre, avec P = muscu∧course, N = nutrition, S = streak ≥ 6 j,
D = déficit persistant) :

```
TRI-12  ⟺  P ∧ N ∧ S ∧ D
MR-14   ⟺  P ∧ S ∧ ¬(P ∧ N ∧ S ∧ D)
──────────────────────────────────
union   ⟺  P ∧ S
```

Une carte s'affiche donc **toujours** dès que muscu+course sont actifs et le streak atteint 6 jours.
Le déficit ne décide plus *si* une alerte apparaît, seulement **laquelle** — ce qui vide R4 de son
sens en tant que règle d'affichage, et fait de TRI-12 une simple variante de message de MR-14.
**Cette US assume cette réalité et l'exprime directement**, au lieu de la laisser émerger de
l'interaction de deux règles opposées.

Effets de bord concrets, tous supprimés par la fusion :
1. **Swap de carte** — l'utilisateur log son dîner, le déficit repasse sous son seuil : TRI-12
   disparaît, MR-14 apparaît, dans la même session, sans qu'aucune donnée d'entraînement n'ait bougé.
2. **Saut de position** — `overtraining-guard` est à l'index 16 du registre, `load-streak-alert` à
   l'index 20 : la carte descend d'environ 4 cases en changeant d'identité. Les deux cartes étant
   des clones visuels, ça se lit comme « mon alerte a changé de titre et de place ».
3. **`show` non monotone** — MR-14 dépend de la **négation** d'un signal asynchrone : c'est le
   premier widget conditionnel capable de passer vrai → faux pendant l'hydratation PowerSync, d'où
   un flash + saut de mise en page à chaque ouverture de l'onglet Accueil.
4. **Calcul du streak dupliqué** en deux copies (MR-14 §3, duplication assumée faute de mieux).
5. **Double instanciation** des requêtes surveillées de TRI-12 (MR-14 §7).

Bénéfice fonctionnel en plus : aujourd'hui un utilisateur **3 piliers** avec un streak de 9 jours
mais des apports corrects ne voit **TRI-12 jamais** (R4) et **MR-14 jamais non plus** (D1 ne joue
pas, mais R5 de TRI-12 ne s'applique pas à MR-14 — en fait il le voit, via MR-14). Après fusion, le
cas est traité explicitement par un niveau de sévérité, plus par l'interaction de deux règles.

## 1. Décisions de cadrage — ✅ TRANCHÉES par Florian le 04/08/2026

| # | Question | Recommandation | Pourquoi |
|---|---|---|---|
| **D1** | Quel identifiant de widget survit ? | **`overtraining-guard`** (celui de TRI-12) ; `load-streak-alert` est **retiré** du registre | `overtraining-guard` est à l'index 16 depuis le 02/08 et **peut déjà figurer dans des layouts personnalisés** ; le garder préserve la position choisie par l'utilisateur. `load-streak-alert` a été ajouté **aujourd'hui**, il n'est dans aucun layout stocké. Retrait sans migration : `resolveScreenLayout` (`widgets.ts:481`) **ignore silencieusement** tout id inconnu d'un layout stocké — vérifié avant d'écrire cette spec |
| **D2** | Gating du widget fusionné : 2 ou 3 piliers ? | **2 piliers** (`strength`+`running`), la nutrition **dégradant par composante** à l'intérieur du hook | Garder 3 piliers annulerait la raison d'être de MR-14 (couvrir l'utilisateur muscu+course sans nutrition). La dégradation par composante a déjà un précédent assumé dans le projet : **TRI-03 D2** (`useReadiness`), où un pilier inactif rend sa composante `unavailable` sans bloquer les autres. C'est donc un patron du projet, pas une invention |
| **D3** | Un niveau de message ou deux ? | **Deux niveaux de sévérité** : `streak` (repos seul) et `streakAndDeficit` (les deux signaux) | Les deux messages existants sont déjà écrits, testés et validés — les conserver tels quels préserve l'apport de TRI-12 (le diagnostic composite reste distinct et plus riche) tout en donnant à MR-14 son niveau de base. Un message unique diluerait le signal fort de TRI-12 dans une formulation générique |
| **D4** | Que deviennent les specs TRI-12 et MR-14 (toutes deux à `etape: recette`) ? | **Passées à `close`** avec une note « comportement repris par GARDE-01 » ; **GARDE-01 porte la recette consolidée** | Leurs critères de recette décrivent un comportement qui n'existera plus (deux cartes, masquage mutuel). Les laisser à `recette` avec des critères périmés ferait recetter du faux. Une seule liste de critères, un seul endroit — la règle du modèle de suivi (CLAUDE.md). Même esprit que les absorptions déjà pratiquées au catalogue (MR-10 → META-19, MR-23 → TRI-03), à la nuance près qu'ici **aucun comportement n'est perdu** : les deux survivent comme niveaux |

## 2. Surfaçage (ADR-007)

**Inchangé : Tier 2, alerte conditionnelle, widget dashboard, ton `"warn"`.** Cette US **réduit** la
pression sur le budget Tier 0 : le registre passe de **21 à 20** widgets (un id retiré, aucun
ajouté). C'est la première US depuis longtemps à faire baisser ce compteur.

**Condition d'affichage** : `strength` **et** `running` actifs **et** streak de charge ≥ 6 jours.
Le niveau de sévérité (D3) dépend en plus du déficit persistant, qui exige `nutrition` actif.

## 3. Ce qui existe déjà et ce qui devient quoi

| Brique existante | Devenir |
|---|---|
| `computeOvertrainingGuard` (`training-time.ts`, TRI-12) | **Étendue** : renvoie un niveau de sévérité au lieu d'un booléen, et n'exige plus les deux signaux pour `show` |
| `computeLoadStreakAlert` (`training-time.ts`, MR-14, livrée aujourd'hui) | **Supprimée** — son rôle (seuil + D1) est absorbé par la fonction ci-dessus |
| `useOvertrainingGuardAlert` (`dashboard-repository.ts`) | **Étendue** : gating 2 piliers, nutrition en dégradation par composante |
| `useLoadStreakAlert` (`dashboard-repository.ts`, livrée aujourd'hui) | **Supprimée** — le calcul du streak dupliqué disparaît avec elle (résout MR-14 §3) |
| `OvertrainingGuardCard.tsx` | **Étendue** : message variable selon le niveau |
| `LoadStreakAlertCard.tsx` (livrée aujourd'hui) | **Supprimée** |
| `OVERTRAINING_LOAD_STREAK_DAYS` (6), `OVERTRAINING_DEFICIT_DAYS_REQUIRED` (4), `DEFICIT_ALERT_RATIO` (15 %) | **Inchangées** — aucun seuil ne bouge dans cette US |
| `countDeficitDaysInWindow`, `computeStreak`, `sessionLoad` | **Inchangées** |
| i18n `home.overtrainingGuard.*` / `home.loadStreakAlert.*` | **Fusionnées** sous `home.overtrainingGuard.*`, une clé par niveau |

**Aucune donnée nouvelle, aucune migration base, aucun seuil modifié.**

## 4. Les règles

**R1 — Un seul widget, un seul emplacement.** `overtraining-guard` (D1). Plus aucun masquage
mutuel, plus aucun swap possible : la carte ne change jamais d'identité ni de position, seul son
**contenu** varie.

**R2 — Visible dès que le streak de charge atteint le seuil**, muscu et course actifs
(`OVERTRAINING_LOAD_STREAK_DAYS` = 6, inchangé). C'est la position de MR-14, qui **remplace** R4 de
TRI-12 (« un seul signal ne suffit jamais ») — arbitrage explicite de la contradiction du §0.

**R3 — Deux niveaux de sévérité (D3), même carte :**

| Niveau | Condition | Contenu |
|---|---|---|
| `streak` | streak ≥ 6 j, et **pas** de déficit persistant (ou `nutrition` inactive) | Titre « {{days}} jours sans repos », message et recommandation de repos (textes de MR-14) |
| `streakAndDeficit` | streak ≥ 6 j **et** déficit persistant (exige `nutrition` actif) | Titre « Signal de surcharge », message et recommandation enrichis (textes de TRI-12, inchangés) |

**R4 — La nutrition dégrade par composante, elle ne garde pas le widget (D2).** `nutrition`
inactive → le niveau `streakAndDeficit` est simplement inatteignable ; le widget reste visible au
niveau `streak`. Même patron que `useReadiness` (TRI-03 D2). Remplace R5 de TRI-12 (« pas de
dégradation partielle »).

**R5 — Monotonie de `show` restaurée.** `show` ne dépend plus de la **négation** d'un signal
asynchrone : il ne dépend que du streak. Le déficit ne peut plus faire disparaître la carte, il ne
peut que **relever** son niveau — donc plus de flash ni de saut de mise en page pendant
l'hydratation PowerSync (§0, effet 3).

**R6 — Aucun seuil, aucune formule, aucun texte modifiés.** Les deux messages existants sont
repris **mot pour mot**. Cette US ne rejoue aucune décision de contenu déjà validée.

**R7 — Ton factuel, aucune action automatique.** Reprend R6/R7 de TRI-12 et R5 de MR-14, identiques
entre eux.

## 5. Périmètre

**Dans le périmètre :**
1. `computeOvertrainingGuard` étendue (niveau de sévérité), `computeLoadStreakAlert` supprimée.
2. `useOvertrainingGuardAlert` étendue (2 piliers, dégradation nutrition), `useLoadStreakAlert`
   supprimée — la duplication du calcul de streak disparaît.
3. `OvertrainingGuardCard` à message variable, `LoadStreakAlertCard` supprimée.
4. `load-streak-alert` retiré du registre (21 → 20), de `dashboard-widgets.tsx` et de
   `isWidgetActive`.
5. i18n fusionnée FR + EN (textes existants réutilisés tels quels).
6. Specs TRI-12 et MR-14 passées à `close` avec renvoi vers cette US (D4).

**Hors périmètre, explicitement :**
- Tout changement de **seuil**, de **formule** ou de **texte** (R6).
- Le cas limite « jour de repos en cours » (MR-14 §9 : `computeStreak` tolère « hier », l'alerte
  reste visible le jour où l'utilisateur se repose) — **conservé tel quel**, corriger demanderait de
  changer la sémantique de `computeStreak` pour TRI-01/TRI-12 aussi. Reste tracé dans cette spec §9.
- La coexistence avec `DeficitVolumeAlertCard` (MN-02) et `TrainingLoadAlertCard` (META-19) —
  TRI-12 §1 avait tranché « pas de mécanisme de priorité entre eux en V1 », et **cette US ne
  revient pas là-dessus** : elle ne fusionne que les deux widgets qui se contredisaient.

## 6. i18n (FR + EN)

Famille `home.overtrainingGuard.*` réorganisée en deux niveaux. **Aucun texte n'est réécrit** —
seules les clés bougent :

| Clé | Provenance | Valeur |
|---|---|---|
| `eyebrow` | TRI-12, inchangée | « Charge & récupération » / « Load & recovery » |
| `streak.title` | MR-14 `loadStreakAlert.title` | « {{days}} jours sans repos » / « {{days}} days without rest » |
| `streak.message` | MR-14 | « Tu t'entraînes (muscu et course confondues) depuis plusieurs jours sans jour de repos. » / EN existant |
| `streak.recommend` | MR-14 | « Un jour de repos peut aider ta récupération. » / EN existant |
| `deficit.title` | TRI-12 `overtrainingGuard.title` | « Signal de surcharge » / « Overload signal » |
| `deficit.message` | TRI-12 | « Tu enchaînes les séances sans repos depuis plusieurs jours, avec des apports régulièrement sous ta cible. » / EN existant |
| `deficit.recommend` | TRI-12 | « Un jour de repos et un repas plus complet peuvent t'aider à repartir du bon pied. » / EN existant |

L'eyebrow de MR-14 (« Repos & récupération ») **disparaît** : il n'existait que pour distinguer deux
cartes qui n'en font plus qu'une.

## 7. Comportement offline

**Total, et amélioré.** Lecture PowerSync locale, calcul pur. La suppression de `useLoadStreakAlert`
**retire** la double instanciation des requêtes surveillées de TRI-12 introduite par MR-14 (sa spec
§7) — moins d'abonnements actifs sur l'onglet Accueil qu'avant cette US.

## 8. Accessibilité

Inchangée : bloc `accessible` unique par forme, label composé titre + message + recommandation du
niveau courant. Un widget de moins à énoncer pour TalkBack.

## 9. Cas limites

| Situation | Comportement attendu |
|---|---|
| Streak < 6 jours | Widget masqué, quel que soit le déficit |
| Streak ≥ 6 j, déficit persistant, 3 piliers | Niveau `streakAndDeficit` (comportement TRI-12 préservé) |
| Streak ≥ 6 j, apports dans la cible, 3 piliers | Niveau `streak` — **change par rapport à aujourd'hui** : TRI-12 seule n'affichait rien (R4) |
| Streak ≥ 6 j, `nutrition` inactive | Niveau `streak` (R4/D2), `streakAndDeficit` inatteignable |
| Déficit repasse sous son seuil pendant la session | La carte **reste en place**, seul son niveau retombe de `streakAndDeficit` à `streak` — plus de swap ni de saut de position (§0) |
| `strength` ou `running` inactif | Widget masqué |
| Layout personnalisé contenant encore `load-streak-alert` | Id ignoré silencieusement par `resolveScreenLayout` (D1), aucun trou de grille |
| **Jour de repos en cours** (streak ≥ 6 jusqu'à hier, rien fait aujourd'hui) | Widget encore visible — **conservé tel quel** de MR-14 §9, hors périmètre (§5) |
| Passage au niveau surcharge | ⚠️ **Le compteur de jours disparaît du titre** : « 8 jours sans repos » → « Signal de surcharge ». Conséquence directe de D3 (conserver les deux titres validés tels quels) — le titre de TRI-12 n'a jamais eu de compteur. **Assumé**, relevé en revue de code comme le point le plus susceptible d'être remonté à tort comme un bug en recette (voir §11 pt 7) |
| Mode avion | Fonctionne normalement |

## 10. Definition of Done

- [x] D1 → D4 arbitrées par Florian le 04/08/2026.
- [x] `computeOvertrainingGuard` étendue et testée (10 tests) : les deux niveaux, le seuil de streak,
      le cas `nutrition` inactive, et la **non-régression des cas de TRI-12** — ses 4 tests d'origine
      conservés et adaptés, pas supprimés. Dont le test « streak 6 + déficit 3 » qui change
      **volontairement** de valeur attendue (R2 remplace R4), documenté sur place.
- [x] `computeLoadStreakAlert`, `useLoadStreakAlert`, `LoadStreakAlertCard` (+ son test) supprimées ;
      aucune référence résiduelle — `grep` de contrôle vérifié en revue, ne restent que des
      commentaires de traçabilité et les tests qui vérifient l'absence.
- [x] `load-streak-alert` retiré du registre (`HOME_WIDGET_IDS` 21 → 20), de `dashboard-widgets.tsx`
      et de `isWidgetActive` ; les 5 compteurs de `widgets.test.ts` ajustés à la baisse (aucun
      oublié, vérifié en revue).
- [x] Un test vérifie qu'un layout stocké mentionnant `load-streak-alert` est résolu **sans trou** —
      renforcé après revue pour porter sur un layout **complet** (20 widgets positionnés) plutôt que
      3 entrées, et pour contrôler l'absence de doublon et le compte final.
- [x] i18n FR + EN fusionnée, textes repris **mot pour mot** (R6) — vérifié **octet par octet** en
      revue sur les 7 chaînes, FR et EN : seule disparition, l'eyebrow de MR-14 (prévu §6).
- [x] `npm run lint`, `npm run typecheck`, `npm run test` verts (670 tests mobile / 72 suites +
      1503 shared + 157 admin ; 47 warnings lint strictement identiques au baseline).
- [x] Specs TRI-12 et MR-14 passées à `close` avec renvoi ici ; entrée IDEAS.md passée à ✅ promue et
      descendue dans « Archives ».
- [x] Aucune ligne roadmap à toucher ; catalogue TRI-12 + MR-14 mis à jour vers cette US.
- [x] **Non-régression de couverture confirmée en revue** : l'union des deux anciens widgets valait
      `P∧S`, le widget fusionné s'affiche exactement à `P∧S` — aucun utilisateur ne perd une alerte
      qu'il voyait. Le seul changement de contenu est celui voulu (§9, ligne « apports dans la cible »).

## 11. Critères d'acceptation (recette device) — liste consolidée TRI-12 + MR-14

Cette liste **remplace** les critères de recette de TRI-12 (§8) et MR-14 (§11) — D4.

1. Streak ≥ 6 j de charge **et** ≥ 4 jours sur 7 en déficit ≥ 15 % → carte au niveau **surcharge**
   (titre « Signal de surcharge », message et recommandation enrichis).
2. Streak ≥ 6 j de charge, apports **dans la cible** → carte au niveau **repos** (titre
   « N jours sans repos »). *Nouveau comportement : TRI-12 seule n'affichait rien.*
3. `nutrition` désactivée, streak ≥ 6 j → carte au niveau **repos**, jamais le niveau surcharge.
4. Streak < 6 j → aucune carte, quel que soit le déficit.
5. `strength` ou `running` désactivé → aucune carte.
6. **Le déficit passe sous son seuil pendant la session** (log d'un repas) → la carte **ne bouge
   pas de place** et **ne disparaît pas** : seul son texte retombe au niveau repos. *C'est le
   défaut que cette US corrige — critère le plus important de la liste.*
7. Le nombre de jours affiché au niveau repos correspond au streak réel. ⚠️ **Au niveau surcharge,
   il n'y a volontairement pas de compteur** (« Signal de surcharge ») : le titre de TRI-12 n'en a
   jamais eu et D3 le conserve tel quel — **ce n'est pas un bug**, ne pas le remonter comme tel.
8. Un jour sans RPE renseigné ne compte pas comme repos s'il existe une autre séance à charge ce
   jour-là (R1 de TRI-12, préservé).
9. Un jour de nutrition non loggé ne fait pas à lui seul retomber sous le seuil de 4 (R3 de TRI-12,
   préservé).
10. Aucun trou dans la grille du dashboard, en affichage **et** en mode édition.
11. Un dashboard personnalisé avant cette US retrouve ses widgets, sans trou ni doublon.
12. Mode avion : fonctionne normalement.
13. En **EN** : les deux niveaux sont grammaticaux.
14. TalkBack énonce la carte comme un bloc cohérent, à chacun des deux niveaux.
