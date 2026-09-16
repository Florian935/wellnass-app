---
id: FANT-01
titre: "Le Fantôme — courir contre soi-même sur le même parcours"
roadmap: [5.41]
catalogue: []
etape: spec
branche: dev
maj: 15/09/2026
---

# US FANT-01 — Le Fantôme

> Issue de la salve « carnet d'innovation » du 13/09/2026, idée **(18)**, lot 1 —
> [analyse](../../../product/analyse-innovation-2026-09.md). Retenue parce qu'elle ne demande
> **ni réseau, ni IA, ni donnée nouvelle** : la trace GPS, les annonces vocales et le suivi de cible
> existent déjà.
>
> ⚠️ **Travail directement sur `dev`** (décision Florian, 15/09/2026), par exception à la règle
> « une branche par US » de CLAUDE.md.

## 1. Le problème

L'app sait comparer une course **à un objectif** (RUN-F2b) et **à une allure cible** (RUN-F4 lot E).
Elle ne sait pas comparer une course **à une autre course**. C'est pourtant la comparaison que le
coureur fait spontanément — « est-ce que je suis mieux que la dernière fois sur cette boucle ? » — et
il ne peut aujourd'hui y répondre qu'**après**, dans l'historique.

## 2. Ce que fait la fonctionnalité

Avant de démarrer, le coureur peut choisir une de ses courses passées comme **fantôme**. Pendant la
course, l'écran affiche en permanence **l'écart, en mètres**, entre lui et ce fantôme au même temps
écoulé ; la voix l'annonce aux mêmes moments que les annonces de distance. Au résumé, l'écart final
est rappelé.

**Hors périmètre, explicitement :**

- la comparaison **automatique** sans choix du coureur (le fantôme est toujours choisi à la main) ;
- le fantôme d'**un autre utilisateur** (pas de social — V2) ;
- le fantôme en **son spatial** (idée 19, horizon 3) ;
- l'affichage du fantôme **sur la carte** : on compare des distances parcourues, pas des positions
  géographiques — voir R4 ;
- le rapprochement **phase par phase** sur une séance à blocs : le fantôme est autorisé sur un
  fractionné, mais il ne compare que la distance.

## 3. Surfaçage (ADR-007)

| Surface | Ce qui apparaît |
|---|---|
| Écran de départ (`run/index.tsx`) | Une ligne « Courir contre un fantôme » : rien de sélectionné par défaut, jusqu'à 3 propositions + « Choisir une autre course » |
| Écran de suivi (`run/active.tsx`) | Une **bande** sous les stats secondaires : écart en mètres, date du fantôme, état (devant / derrière / terminé) |
| Résumé (`run/summary.tsx`) | Une ligne « Contre ton fantôme du JJ/MM : +42 m » |
| Historique | Rien de neuf en V1 |

**Aucun widget d'accueil** : le plafond de l'accueil est déjà atteint (ADR-007) et la fonctionnalité
n'existe que pendant une course.

## 4. Décisions de cadrage

| # | Question | Décision |
|---|---|---|
| **D1** | Choix automatique du fantôme ? | **Non.** Proposition, jamais imposition (décision H). Sans choix explicite, la course se déroule exactement comme aujourd'hui. |
| **D2** | On compare quoi ? | **La distance parcourue à temps égal**, en mètres. C'est la seule comparaison juste quand les deux traces ne suivent pas exactement le même tracé. La conversion en secondes est **dérivée**, affichée en second. |
| **D3** | Quelles courses sont proposées ? | Celles qui ont une **trace GPS** et dont le **départ est à moins de 300 m** du départ actuel ; les 3 plus récentes (R2). |
| **D4** | Le fantôme est-il rejouable après coup ? | **Non en V1** : pas de rejeu, pas d'animation sur la carte. |
| **D5** | Que fait-on des pauses du fantôme ? | Un trou de plus de **60 s** entre deux points est traité comme une pause et **retiré** du temps du fantôme (R3). Sinon on comparerait un temps net à un temps d'horloge. |

## 5. Règles métier

**R1 — Profil du fantôme.** À partir de la trace décodée (`decodeTrack`), on construit une suite
croissante `(tNet, distanceCumulée)` : `tNet` est le temps net écoulé depuis le premier point,
`distanceCumulée` la somme des distances haversine entre points consécutifs. La distance du fantôme
à un instant donné est **interpolée linéairement** entre les deux échantillons qui l'encadrent.

**R2 — Sélection.** Une course est proposable si : `status = 'completed'`, `deleted_at is null`,
`gps_track` non vide et décodable en **au moins 2 points**, `distance_m ≥ 500`, et distance haversine
entre son premier point et la position actuelle **< 300 m**. Les trois plus récentes sont proposées ;
le coureur peut ouvrir la liste complète des courses proposables.
⚠️ Sans position GPS acquise, **aucune** proposition n'est affichée — on ne propose pas une liste au
hasard.

**R3 — Pauses du fantôme.** Un écart de plus de `GHOST_PAUSE_GAP_S = 60` entre deux points compte
pour **0 seconde** de temps net ; la distance, elle, est conservée. Même convention que la durée nette
affichée pendant la course (CARDIO-UX01, R1a).

**R4 — Écart.** `écart = distance du coureur − distance du fantôme au même temps net`, en mètres,
arrondi à l'unité. Positif = devant. La conversion en secondes utilise **l'allure moyenne courante du
coureur** : `secondes = écart ÷ vitesse moyenne`. Elle n'est affichée que si cette allure existe
(distance > 0 et durée > 0).

**R5 — Fin du fantôme.** Quand le temps net dépasse la durée du fantôme, l'écart est **figé** à sa
dernière valeur et l'état passe à `finished` : la bande dit « fantôme terminé » et plus aucune
annonce de dépassement ne tombe. On n'extrapole jamais un fantôme au-delà de sa propre course.

**R6 — Annonces vocales.** Deux déclencheurs, jamais plus d'une annonce par **60 s** :

1. **aux seuils de distance existants** (RUN-F2a) : l'écart est ajouté à l'annonce déjà prononcée ;
2. **au changement de statut** devant ↔ derrière, une seule fois par changement.

Elles suivent le réglage `voiceAnnouncements` du profil coureur : **aucun nouveau réglage**. Comme
RUN-F2a et RUN-F4 lot E, elles sont déclenchées **depuis l'écran**, jamais depuis la tâche de fond —
donc pas d'annonce écran éteint, limite assumée et identique aux trois autres.

**R7 — Remontage d'écran.** Au montage, l'état d'annonce est initialisé depuis l'écart courant, pas
depuis zéro : revenir sur l'écran ne doit pas déclencher une annonce immédiate (même règle que
RUN-F2a).

**R8 — Persistance.** Le fantôme choisi est écrit sur la course (`runs.ghost_run_id`) au démarrage et
n'est plus modifié ensuite. Il alimente le résumé et survit à un redémarrage de l'app.

**R9 — Fantôme supprimé.** Si la course fantôme est supprimée (soft delete) après coup, le résumé
affiche l'écart enregistré mais **sans lien** vers elle ; la bande ne casse pas.

**R10 — Coût.** Décodage de la trace et construction du profil **une seule fois** au démarrage
(`useMemo`), jamais à chaque point GPS ; recherche dans le profil par **dichotomie**.

## 6. Cas limites

| Cas | Comportement |
|---|---|
| Aucune course passée proposable | La ligne dit « aucune course comparable ici » et ne bloque rien |
| Position GPS non acquise | Aucune proposition (R2) ; la ligne réapparaît au premier point valide |
| Trace corrompue ou tronquée | `decodeTrack` ignore les segments illisibles ; moins de 2 points ⇒ course non proposable |
| Course manuelle (`source = 'manual'`) | Jamais proposable (pas de trace) |
| Fantôme plus court que ma course | R5 : écart figé, état `finished` |
| Fantôme plus long | L'écart peut rester négatif jusqu'à la fin, sans traitement particulier |
| Ma course en pause | Le temps net ne défile plus, donc l'écart ne bouge plus : c'est juste |
| Course sans fantôme | Écran **identique à aujourd'hui** : aucune bande, aucune annonce |
| Distance du coureur nulle (départ) | Écart = −distance du fantôme ; pas de conversion en secondes (R4) |

## 7. i18n (FR + EN)

Espace de clés `running.ghost.*` — aucune chaîne en dur.

| Clé | FR | EN |
|---|---|---|
| `ghost.cta` | « Courir contre un fantôme » | “Race a ghost” |
| `ghost.none` | « Aucune course comparable ici » | “No comparable run here” |
| `ghost.pick` | « Choisir une autre course » | “Pick another run” |
| `ghost.option` | « {{date}} · {{distance}} en {{duration}} » | “{{date}} · {{distance}} in {{duration}}” |
| `ghost.selected` | « Fantôme · {{date}} » | “Ghost · {{date}}” |
| `ghost.ahead` | « +{{meters}} m d'avance » | “{{meters}} m ahead” |
| `ghost.behind` | « {{meters}} m de retard » | “{{meters}} m behind” |
| `ghost.level` | « Au coude à coude » | “Neck and neck” |
| `ghost.finished` | « Fantôme terminé · {{gap}} » | “Ghost finished · {{gap}}” |
| `ghost.seconds` | « soit {{seconds}} s » | “that's {{seconds}} s” |
| `ghost.voice.ahead` | « Tu as {{meters}} mètres d'avance sur ton fantôme. » | “You are {{meters}} metres ahead of your ghost.” |
| `ghost.voice.behind` | « Tu as {{meters}} mètres de retard sur ton fantôme. » | “You are {{meters}} metres behind your ghost.” |
| `ghost.voice.passed` | « Tu viens de passer devant ton fantôme. » | “You just passed your ghost.” |
| `ghost.voice.overtaken` | « Ton fantôme vient de passer devant. » | “Your ghost just passed you.” |
| `ghost.summary` | « Contre ton fantôme du {{date}} » | “Against your ghost from {{date}}” |

⚠️ Les nombres sont formatés **avant** `t()` (piège n° 3 de
[bonnes-pratiques.md](../../technical/bonnes-pratiques.md)). Les unités suivent `useUnits()` : en
réglage impérial l'écart s'affiche en **yards**, à l'écran comme à la voix.

## 8. Comportement offline

**Tout est local.** Traces, sélection et écart se calculent depuis SQLite ; aucun appel réseau. La
colonne `ghost_run_id` suit la synchro PowerSync de `runs`, **table déjà publiée** : aucune sync rule
à redéployer. Une course faite hors ligne garde son fantôme et se synchronise plus tard.

## 9. Accessibilité

- La bande est annoncée d'un bloc par TalkBack : « fantôme du 25 août, 42 mètres d'avance ».
- L'information n'est **jamais portée par la seule couleur** : le signe et le mot (avance / retard)
  sont écrits. Cible tactile ≥ 48 dp sur la ligne de choix.
- Le texte grandit avec la police système (test à 1,5×) : la bande passe sur deux lignes sans couper.

## 10. Critères de recette (device)

1. Sans fantôme choisi, l'écran de suivi est **strictement identique** à aujourd'hui.
2. Sur une boucle déjà courue, l'écran de départ propose la bonne course (date et distance justes).
3. À 100 m du départ d'une autre ville, **aucune** proposition n'apparaît.
4. L'écart affiché est cohérent : au départ il vaut à peu près l'opposé de la distance du fantôme,
   puis il évolue dans le bon sens quand on accélère ou qu'on ralentit.
5. Le passage devant / derrière déclenche **une** annonce, pas deux.
6. Deux annonces ne tombent jamais à moins de 60 s d'intervalle.
7. Mettre la course en pause fige l'écart ; la reprise le fait repartir.
8. Quand le fantôme a fini sa course, la bande le dit et se fige.
9. Quitter l'écran et y revenir ne déclenche pas d'annonce et n'efface pas l'écart.
10. Le résumé affiche l'écart final et la date du fantôme.
11. Mode avion : tout fonctionne.
12. TalkBack lit la bande d'un bloc ; à 1,5× de police, rien n'est coupé.
13. En réglage impérial, l'écart est en yards à l'écran **et** à la voix.
