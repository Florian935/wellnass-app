---
id: ACCUEIL-07
titre: "L'accueil dit vrai — six erreurs de logique corrigées, le check-in en visages, la teinte Aurore"
roadmap: [7.44]
catalogue: []
etape: close
branche: fix/accueil07-accueil-dit-vrai
maj: 25/10/2026
---

# US ACCUEIL-07 — L'accueil dit vrai

> **Demande** : Florian, 25/10/2026 — premier des trois lots de la refonte « Ta journée », cadrée le
> 24/10 et validée le 25/10 (décisions D1 à D6, non rediscutées ici). Brief :
> [design/accueil-2026-10/README.md](../../../../design/accueil-2026-10/README.md) ; référence de
> comportement : le `<script>` de `design/accueil-2026-10/Phone.dc.html` ; toile en ligne
> https://claude.ai/artifact/GMpz8mpVdQPrxRX4vdvzsb ; compte rendu
> https://claude.ai/artifact/Y8xf61ESXKWk4uBfWi9LAJ.
> **Absorbe** VIE-02 (retirée du BACKLOG).
> **Workflow** : dev direct (23/10/2026) — spec écrite avec le code, close au commit qui livre.
> **Suite** : ACCUEIL-08 (« Ta journée » : cadrans, fil, semaine, repères, « + ») et ACCUEIL-09 (le
> mouvement), enchaînées dans la même session.

## 1. Ce que l'US corrige

Six erreurs de logique, vérifiées dans le code le 24/10/2026 (§1 du brief), plus trois défauts de
la même famille.

| # | Constat | Correction |
|---|---|---|
| 1 | Un seul repas noté = « Ta journée est faite » ; le déjeuner et le dîner ne sont plus jamais réclamés (`useMealLoggedToday` ≥ 1 entrée + `hasDoneSomething`) | Les repas se lisent **un par un**, chacun à son heure apprise (`resolveMealSlots`). La journée n'est faite que si la séance prévue est faite (ou rien de prévu) **et** chaque repas du jour noté. |
| 2 | « Créer un programme » (haltère) quand rien n'est prévu, même un jour de repos avec programme, même pour un compte nutrition seule | `RestSuggestion` : un programme **seulement** si la musculation est active sans programme ; sinon le premier repas (nutrition, rien de noté) ou une activité (« Jour de repos »). |
| 3 | La pesée réclamée à tous, chaque jour, dès l'échéance | Garde d'habitude : au moins une pesée sur 30 jours (`useWeighInHabit`), même règle que le bien-être. |
| 4 | « Reprise en douceur » → route `/real-life` inexistante (VIE-02) | Plus de navigation : la période démarre, la scène relit la période et dit « Semaine allégée jusqu'au … ». |
| 5 | « Sauver ma série » ouvre `/planning`, qui ne sauve rien | Trois vrais gestes (`streakRescueOptions`) : marcher (objectif de pas), noter une activité, le joker sur aujourd'hui. |
| 6 | Le titre répète la carte mot pour mot ; le prénom n'apparaît jamais | Deux lignes : la **salutation** (« Bonjour Florian », « Bon après-midi », « Bonsoir », « Content de te revoir », « Bienvenue ») et la **phrase du jour** (`daySentence`), qui dit le contexte (kcal restantes, compte à rebours), jamais le titre de la carte. |
| 9 | Check-in « 1 2 3 4 5 » sans libellé ; l'indication annonçait « humeur, énergie, stress » | Cinq visages, chacun avec son mot (`wellbeing.levels.energy.*`) ; indication « Ton énergie, en un geste ». |
| 16 | `useNowAction` monté deux fois (écran + carte) malgré le commentaire de l'écran | L'écran calcule la décision **une fois** et la passe à `NowCard` par props. |
| D1 | La teinte de l'accueil | **Aurore** sur la scène, l'onglet et les accents (§4). |

## 2. Règles métier

- **R1 — Les repas du jour.** `resolveMealSlots` (`packages/shared/src/meal-slots.ts`) :
  - historique = saisies des 14 derniers jours **hors aujourd'hui**, première saisie de chaque
    (repas, jour), filtre anti-rétroactif (jour local de `created_at` = `log_date`) ;
  - **débutant** (moins de 5 jours saisis) → les trois repas par défaut présents dans la config, à
    8 h, 12 h 30 et 19 h 30 (la collation n'est jamais réclamée par défaut) ;
  - **habitué** → les repas notés **plus d'un jour sur deux** (et au moins 3 jours), à leur heure
    **médiane**, arrondie au quart d'heure ; si aucun n'atteint ce seuil, repli sur les défauts ;
  - un repas **noté aujourd'hui** hors habitude apparaît aussi (déjà fait) ;
  - seules les clés de la configuration de repas comptent (repas personnalisés compris, libellé de
    la config ; un repas supprimé depuis n'est plus réclamé).
- **R2 — Le repas du moment.** Dû = heure passée, pas noté, et moins de 3 h après son heure
  (`MEAL_DUE_WINDOW_HOURS`) ; s'il y en a deux, le plus récent. Prochain = le premier repas pas encore
  arrivé. Manqué = fenêtre passée sans saisie.
- **R3 — La table de priorité** (`NOW_ACTION_ORDER`) : séance en cours → course en cours → séance du
  jour → **repas dû** → pesée (à qui se pèse) → **prochain repas** → point du soir → **repas manqué**
  → journée faite → rien de prévu.
- **R4 — Journée faite** = aucune séance prévue restante **et** chaque repas du jour noté **et** au
  moins une trace (séance, course ou repas). Un repas ne suffit plus.
- **R5 — Rien de prévu** : `program` si musculation active sans programme ; sinon `meal` si
  nutrition active et rien de noté ; sinon `activity`.
- **R6 — Pesée** réclamée seulement s'il existe une pesée sur les 30 derniers jours.
- **R7 — Série en jeu le soir** seulement si aujourd'hui n'est **pas déjà couvert** : un joker posé
  sur aujourd'hui, ou un jour de période « vie réelle », retire le moment `evening-at-risk`
  (`resolveHomeMoment`, champ `coveredToday`).
- **R8 — Les sorties de la série** (`streakRescueOptions`, dans l'ordre) : marcher si les pas sont
  suivis (au moins une journée de pas sur 7 jours) et l'objectif pas atteint — durée annoncée à
  ~120 pas/min, arrondie à 5 min ; noter une activité, toujours ; le joker s'il en reste un ce mois-ci,
  si aujourd'hui n'est pas couvert et si **hier n'est pas déjà un joker** (deux jokers d'affilée
  cassent la série, règle 2 de STREAK-01). Le joker se **confirme** (il n'y en a qu'un par mois).
- **R9 — Retour** : « En douceur » écrit une période « vie réelle » d'une semaine et reste sur
  l'accueil ; « Mon plan normal » n'écrit rien et se souvient du choix pour la journée (mémoire de
  session, `home-comeback-store`).
- **R10 — Salutation** : « Content de te revoir » au retour (moment `comeback`), « Bienvenue » sans
  aucun historique (jamais pendant la lecture), sinon selon l'heure. Sans prénom, la variante nue.

## 3. Teinte Aurore (D1)

- **Scène** (`theme/stage.ts`, clé `home`) : sombre dans les deux thèmes, fond `#13203A → #0A0E1C`,
  lueur turquoise `rgba(45,212,191,a)` en haut à gauche et framboise `rgba(236,72,153,b)` en haut à
  droite (`AuroraGlows`, deux `RadialGradient`), dosage par moment (`AURORA_DOSES` : aube 0,38/0,20 ·
  journée 0,36/0,34 · heure dorée 0,30/0,46 · soirée 0,24/0,52 · nuit 0,14/0,16). Encre `#FFFFFF`,
  encre secondaire `#DBE3F7`, verre `rgba(255,255,255,0.09)`. Bouton plein en dégradé `#5EEAD4 →
  #F9A8D4`, texte `#151024`.
- **Contraste** : `stage.test.ts` mesure l'encre contre les surfaces **mêlées** (chaque lueur à son
  dosage le plus fort, la zone de croisement), l'encre principale contre le verre posé dessus, le
  libellé du bouton contre chaque arrêt du dégradé, et garde le plafond turquoise ≤ 0,38 (à 0,45, le
  texte secondaire tombe sous 4,5:1 — vérifié par le test).
- **Accents** : `pillarHome` = `#0F766E` (clair) / `#5EEAD4` (sombre) ; carte « maintenant »
  `#141A2E` / `#0F1426`, texte `#EEF1FB` / `#B7C0DC` ; cartes de l'accueil teintées vers le turquoise
  (gain 1,7, mesuré pour que la carte sombre gagne +9 de chroma, dans la bande des autres piliers) ;
  `DEFAULT_MENU_COLORS.home` = `#5EEAD4` ; barre d'état claire sur l'accueil.
- **Terracotta = couleur de marque** : nouvelle identité `brand` (`theme/pillar.ts`, token `brand`).
  `useTheme` la choisit quand l'identité héritée est `home` **sans** que l'onglet Accueil soit au
  premier plan — onboarding, Réglages et écrans transverses ouverts depuis l'accueil gardent donc le
  terracotta. La préférence « Couleurs des menus » ne s'applique pas à `brand`.

## 4. Cas limites

- Compte neuf (aucune saisie) : trois repas par défaut ; « Bienvenue » ; rien de prévu → programme
  (muscu active sans programme) ou premier repas.
- Repas personnalisé sans libellé : « Repas » (jamais la clé technique).
- Petit-déj sauté un jour : il apparaît en rattrapage (`meal-missed`) une fois le reste dit, et la
  journée n'est pas « faite » tant qu'il manque — règle validée (R4). Le CTA permet de le noter.
- Pilier nutrition éteint : aucun repas dans la décision ; la séance faite suffit à « journée faite ».
- Joker déjà utilisé ce mois-ci, ou hier : pas d'option joker. Health Connect absent : pas de marche.
- Période « vie réelle » active pendant le retour : la scène dit la date de fin au lieu de proposer.
- Horloge à l'heure (`useCurrentHour`) : un repas de 12 h 30 devient « dû » à 13 h ; avant, il est
  annoncé « Prochain repas · vers 12:30 ».

## 5. i18n (FR + EN)

Nouvelles clés : `home.greet.*` (5 salutations × avec/sans prénom), `home.sentence.*` (20 phrases),
`home.now.meal.{name.*, eyebrowDue, eyebrowDueDefault, eyebrowNext, eyebrowMissed, metaKcal,
metaReached, metaNoTarget, metaMissed, ctaCustom, nameFallback}`, `home.now.idle.{title,meta,cta}.{program,meal,activity}`,
`home.checkin.*`, `stage.home.rescue.*`, `stage.home.{comebackLine, comebackBody, gentleDone,
normalDone}`. Retirées : `home.greeting*`, `home.headline.*`, les anciens libellés de repas et de
repli de `home.now`, `stage.home.{saveStreak, jokerLeft, jokerNone, comeback}`. Kcal et pas mis en
forme par la langue (`useKcalFormat`). Parité vérifiée par `locale-parity.test.ts`.

## 6. Offline

Tout est local : deux lectures SQLite neuves sur `food_entries` (saisies de la fenêtre avec leur
repas, repas notés aujourd'hui) et une sur `body_weight_entries` (pesées sur 30 jours), testées sur le
harnais SQLite (`accueil07-habits-sql.test.ts`). Écritures existantes réutilisées : `startRealLifePeriod`,
`consumeJoker`, `saveWellbeing`. **Aucune migration, aucune sync rule, aucun appel réseau.**

## 7. Décisions prises en route

- **D-a** — Heure de repas = **médiane** par repas (habitude affichée « d'habitude vers … »), et non le
  p90 des notifications (échéance). Les rappels programmés ne changent pas.
- **D-b** — Habitude = plus d'un jour sur deux (et ≥ 3 jours) : quelqu'un qui saute le petit-déj un
  jour sur deux ne se le voit pas réclamer.
- **D-c** — Le joker se pose sur **aujourd'hui** (prototype validé : « Série gelée pour aujourd'hui »),
  après confirmation, et jamais au lendemain d'un autre joker.
- **D-d** — « Pas suivis » = au moins une journée de pas sur 7 jours (donnée locale), plutôt que l'état
  asynchrone de Health Connect.
- **D-e** — Identité `brand` pour garder le terracotta hors de l'accueil (D1), sans toucher à la règle
  d'IDENT-01 pour les écrans de pilier.
- **D-f** — Cartes de l'accueil teintées vers le turquoise (et non laissées crème comme sur la toile) :
  le contrat d'identité de MUSCU-UX04 l'exige, et son test-garde (chroma) aussi.
- **D-g** — Les lueurs sont posées au dosage du moment de l'heure courante, **statiques** : le souffle
  et l'heure qui glisse arrivent avec ACCUEIL-09.

## 8. Ce qui n'est pas fait (ici)

- La légende des anneaux (constat 7) : les anneaux disparaissent avec ACCUEIL-08 (« Ta semaine »).
- Le fil du jour, les cadrans, la carte semaine, les repères, le « + », le retrait de « Demande-moi »
  et des actions rapides : **ACCUEIL-08**.
- Les lueurs qui respirent, les animations, la carte record partageable, Prisme au bout du fil :
  **ACCUEIL-09**.
- `useStreakData` reste appelé par plusieurs hooks de l'accueil (constat 16, second volet) : traité
  avec la refonte de la collecte dans ACCUEIL-08.
