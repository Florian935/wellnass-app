# Plan d'implémentation — CARDIO-02 (les quatre portes vers l'allure de référence)

Spec : [docs/specs/functional/us/cardio02-allure-reference.md](../specs/functional/us/cardio02-allure-reference.md) ·
Maquette : [design/cardio02-allure-reference/](../../design/cardio02-allure-reference/) ·
Branche : `feature/cardio02-allure-reference` (worktree `.expo/claude-worktrees/cardio-02`).

Ce que le plan ne touche pas :
- **aucune migration, aucune table, aucune sync rule PowerSync, aucune dépendance native**
  (`expo-speech` et `Vibration` servent déjà au guidage de course) ;
- `run/analysis.tsx` et `summarizeIntervalSeries` (CARDIO-08), les écrans Muscu et Nutrition, Prisme,
  `lab-repository.ts` (CIBLE-04) ;
- la colonne `ref_5k_pace_s_per_km` : même nom, même unité, Noryn la lit sans changement.

Ce qu'il ajoute : un module pur, deux routes (`/running-pace`, `/running-welcome`), une préférence
locale (le marqueur du test), cinq composants, deux règles de mise à jour dans les repositories, et
des chaînes FR + EN sous `running.*` (test de parité existant).

Chaque étape se termine au vert : `npm run lint`, `npm run typecheck`, `npm run test`,
`npm run agents:check`, code de sortie lu **sans pipe**. TDD : le test d'abord, vu rouge, puis le
code. Références `R*` et `D*` : la spec. Un `/commit` par étape ; pour pousser, jamais
`git checkout dev` : `git fetch origin`, `git rebase origin/dev`, `git push origin HEAD:dev` (cinq
sessions travaillent en parallèle sur les mêmes fichiers de suivi).

Au passage en code : `npm install` dans le worktree (Node 24).

## Étape 0 — Cadrage

Spec, plan, maquette (`design/cardio02-allure-reference/` + toile), ligne **5.45** de la roadmap
(⬜, hors cadrage) et renvoi depuis **5.40**, CARDIO-02 retiré du BACKLOG (entré au pipeline),
`etape: validation`, ETAT régénéré.

## Étape 1 — Briques pures (`packages/shared`, Vitest)

Nouveau fichier `src/reference-pace.ts`, exporté par `src/index.ts`. Les deux fonctions existantes
(`referencePaceFromRaceTime`, `referencePaceFromCooperTest`) restent dans `running-hub.ts`.

| Élément | Contenu | Tests (`reference-pace.test.ts`) |
|---|---|---|
| `REFERENCE_PACE_BOUNDS` | `{ minSPerKm: 150, maxSPerKm: 720 }` (R4). `units.ts` : `parsePaceToSPerKm` lit cette constante au lieu de ses deux littéraux ; `parsePaceText(text, system)` **sans bornes** est extrait, pour distinguer « illisible » de « hors bornes ». | Garde : `parsePaceToSPerKm` refuse exactement hors bornes ; `parsePaceText` lit `1:59` et `13:00`. Tests existants de `units` verts. |
| `RACE_DISTANCES`, `RACE_CUSTOM_RANGE_M` | 5 km, 10 km, semi, marathon (mètres de `RUNNING_RECORD_DISTANCES`) ; `{ min: 1000, max: 42195 }` (R2) ; exemple de temps par distance (R3). | Les quatre clés ont un libellé dans `RECORD_DISTANCE_I18N_KEY`. |
| `classifyReferencePace(sPerKm)` | Valeur **brute** → `ok`, `tooFast`, `tooSlow` ; arrondi à la seconde (R1). | Bornes 149/150/720/721 ; arrondi. |
| `evaluateReferenceDoor(input)` | `{ door: 'race', distanceM, timeSeconds } \| { door: 'test', distanceM } \| { door: 'known', sPerKm }` → `{ status: 'empty' \| 'unreadable' \| 'badDistance' \| 'tooFast' \| 'tooSlow' \| 'ok', sPerKm? }`. Le test passe par `referencePaceFromRaceTime(d, 720)` pour qu'un test de 300 m soit `tooSlow`, pas `empty`. | 10 km 52:30 → 302 ; 5 km 25:00 → 300 ; test 2 400 m → 314 ; test 300 m et 1 000 m → `tooSlow` ; 999 m et 42 196 m → `badDistance` ; semi « 1:45 » → `tooFast`. |
| `trainingPaceBands(ref)` | Les quatre types (endurance, sortie longue, récupération, fractionné) et leurs plages via `sessionTargetPace`, dans l'ordre du profil actuel. | 302 → 6:02–6:32, 5:32–6:02, 6:32–7:02, 4:47–5:02. |
| `shouldRecordUpdateReference(current, recordSeconds5k)` | R18 : `current == null \|\| round(t ÷ 5) < current`. | Sans allure, plus rapide, égal, plus lent. |
| `referencePaceOrigin({ refSPerKm, record5k })` | R21 : `{ kind: 'none' } \| { kind: 'record', timeSeconds, achievedAt } \| { kind: 'declared' }`. | Égalité avec `round(t ÷ 5)`, écart d'une seconde, sans record, sans allure. |
| `COOPER_TEST`, `cooperPhase`, `cooperRemainingS`, `cooperCue` | `{ durationS: 720, lastMinuteS: 660 }` ; phase `running \| lastMinute \| done \| interrupted` ; `cooperCue(previous, current)` → `'lastMinute' \| 'done' \| null`, `null` quand `previous` est `null` (adoption au montage, R10) ou que le test est interrompu. | Bornes 659/660/719/720 ; aucune annonce au montage ; une seule par passage ; saut `running` → `done` = `done` seul ; rien après interruption. |
| `measureCooperTest(points, { interrupted })` | R11-R12 : `cumulativeDistances` interpolée à `t = 720` → `{ status: 'ok' \| 'tooFast' \| 'tooSlow', distanceM, sPerKm } \| { status: 'incomplete', lastSeconds } \| { status: 'interrupted' } \| { status: 'noTrack' }`, dans l'ordre de R12. | Trace régulière ; trou GPS au milieu (temps compté) ; point aberrant filtré ; arrêt à 9:40 ; interrompu ; < 2 points ; distance arrondie au mètre. |
| `shouldOpenRunningWelcome(input)` | R14 : `{ online, syncedThisLaunch, profileLoading, hasProfile, hasActiveRun, alreadyOpened }` → booléen. | Table de vérité : un seul cas `true`. |
| `voiceChoicePatch(choice)` | R16 : `'all' \| 'intervals' \| 'none'` → `{ voiceAnnouncementsEnabled, intervalGuidanceEnabled }`. | Les trois couples. |

## Étape 2 — Données et préférence locale (`apps/mobile/src`)

| Fichier | Changement | Tests |
|---|---|---|
| `data/repositories/running-record-repository.ts` | `detectAndStoreRunRecords(runId, { updateReference = true })` : l'allure n'est écrite que si `updateReference` **et** `shouldRecordUpdateReference` (R18). `backfillRunningRecords` passe `updateReference: false` (R19) et, si un recalcul tourne déjà, **attend sa fin puis repasse** (promesse en cours chaînée, au lieu du retour immédiat du verrou). | `running-record-sql.test.ts` : **vu rouge d'abord** — allure donnée 302, premier record 5 km à 6:30 → l'allure reste 302 ; record à 4:55 → 295 ; sans allure → posée ; le recalcul n'écrit jamais l'allure ; deux recalculs simultanés → le second repasse. |
| `data/repositories/run-repository.ts` | `deleteRun` (R20) : lit l'allure **avant** le recalcul ; après, si elle valait le record 5 km supprimé ÷ 5, elle prend le nouveau record 5 km ÷ 5, ou `null`. Commentaire de tête (effet 4) réécrit. | `run-sql.test.ts` : record suivant adopté ; aucun 5 km restant → effacée ; allure donnée → intacte, même face à un record restant plus rapide. |
| `data/repositories/running-profile-repository.ts` | Rien de neuf côté écriture ; l'arrondi (R1) se fait dans `evaluateReferenceDoor`. Vérifier que `upsertRunnerProfile({})` insère la ligne avec le seul `user_id` (lu dans `_sql.ts`). | Test du marqueur vide sur le harnais SQLite. |
| `stores/cooper-test-store.ts` (nouveau) | Marqueur du test (R8) : `{ runId, interrupted }` dans `secureStorage` ; `hydrate`, `mark(runId)`, `interrupt()`, `clear()`. Même patron que `run-start-mode-store`. | Défaut `null`, écriture, relecture, valeur corrompue, échec de stockage silencieux. |

## Étape 3 — L'écran des portes

| Fichier | Rôle | Tests |
|---|---|---|
| `components/running/TrainingPaceList.tsx` (extrait du profil) | Les quatre allures d'une référence, en aperçu ou en carte. | Quatre lignes, unités impériales. |
| `components/running/ReferencePaceDoors.tsx` | Les quatre portes (§3.1) en boutons radio, champs de `@/components/keyboard`, pastilles de distance, meilleurs temps (`useRunningRecords`), distance pré-remplie depuis le marqueur du test (R8, après vérification que la course existe et mesure), aperçu annoncé (`accessibilityLiveRegion`), messages R2-R4. Props : `currentSPerKm`, `allowGuidedTest`, `onChange(result)`, `onStartTest`. | Chaque porte ; meilleurs temps ; pré-remplissage ; messages ; « Je ne sais pas encore » absent avec une allure ; « Le faire maintenant » absent sans `allowGuidedTest` ; rôles et états d'accessibilité. |
| `app/running-pace.tsx` (nouveau) | Écran modal : `useMenuFocus('running')`, `KeyboardAwareScrollView` (`keyboardShouldPersistTaps`), `ReferencePaceDoors`, « Retenir cette allure » (R6) ; « Lancer le test » → `/run?test=cooper`. | `running-pace-screen.test.tsx` : rien d'écrit avant « Retenir », une écriture arrondie, « Avant », bouton inactif hors bornes, « Lancer le test ». |
| `app/_layout.tsx` | `Stack.Screen` `running-pace` (modal, en-tête titré, comme `running-profile`). | `route-declarations.test.ts`. |
| Gardes | `pillar-identity.test.ts` : `running-pace.tsx` ajouté à `FICHIERS` (liste tenue à la main) ; `keyboard-coverage-guard.test.ts` : `running-pace.tsx` en `self`. | Les deux gardes. |

## Étape 4 — Le profil et les portes d'entrée

| Fichier | Changement | Tests |
|---|---|---|
| `components/running/ReferencePaceCard.tsx` (nouveau) | §3.4 : valeur, provenance (`referencePaceOrigin` + `useRunningRecords`), `TrainingPaceList`, « Changer » / « La donner ». | Deux provenances, sans allure. |
| `app/running-profile.tsx` | La carte remplace le champ, sous le guidage ; « Mes allures » s'y fond ; **bouton « Retour » retiré** (F39). Plus de champ texte : sortie de l'`INVENTORY` clavier si la garde l'exige. | `running-profile-screen.test.tsx` : tests du champ (l. 234-290) → tests de la carte ; test du « Retour » (l. 422) → vérifie son absence. |
| `components/running/RefPaceNudge.tsx` (extrait de `RunMomentCard`) | La ligne « Ton allure de référence · La donner », réutilisée par deux états de la carte. | Rendu, appui. |
| `components/running/RunMomentCard.tsx`, `app/(tabs)/running.tsx` | État Premiers pas : prop `onRefPace` → `/running-pace` (D7). État séance du jour : la même ligne quand le type a une bande dérivée, sans allure explicite, et que l'allure manque (§3.5). L'icône Profil de l'en-tête ne change pas. | `running-screen.test.tsx` : l. 436-438 attendent `/running-pace` ; séance du jour sans allure → ligne présente ; avec allure ou allure explicite → absente. |
| `components/running/RefPaceBanner.tsx` (nouveau), `app/planning/index.tsx`, `app/planning/plan.tsx`, `app/running-programs/[id].tsx` | **Un** bandeau en tête de liste dès qu'une séance est concernée (§3.5) ; le message des lignes reste, non touchable. | Un test par écran : bandeau présent une fois, absent avec une allure. |
| `components/running/RunningSessionEditor.tsx`, `components/run/PaceCurveCards.tsx` | Message touchable → `/running-pace`. | Tests existants complétés. |

## Étape 5 — L'accueil du pilier

| Fichier | Rôle | Tests |
|---|---|---|
| `components/OnboardingScaffold.tsx` | Props facultatives `onSkipAll`, `continueLabel`, `stepLabel` (défauts : le comportement actuel de l'onboarding de l'app). | Onboarding de l'app inchangé (tests existants). |
| `app/running-welcome.tsx` (nouveau, **route**, pas une `Modal`) | Trois pages dans un écran (état local), `useMenuFocus('running')`. Au montage : `upsertRunnerProfile({})` (R15). Page 1 : objectif + fréquence ; page 2 : `ReferencePaceDoors` sans test guidé ; page 3 : trois choix de voix (`voiceChoicePatch`). Chaque « Continuer » écrit sa page (R16) ; « Plus tard » n'écrit rien ; « Passer », « Terminer » et le retour Android → `router.back()`. | `running-welcome-screen.test.tsx` : marqueur au montage, écritures page par page, rien sur « Plus tard » / « Passer », « Terminer », « question N sur 3 ». |
| `hooks/useRunningWelcome.ts` (nouveau) | Dans le hub : `useStatus()` (`connected`, `lastSyncedAt` comparé à l'heure de démarrage de l'app, constante de module), `useRunnerProfile`, `useActiveRun`, garde « une fois par lancement » → `router.push('/running-welcome')` quand `shouldOpenRunningWelcome`. | Hook : ouvre une fois ; jamais hors ligne, jamais sans synchro de ce lancement, jamais avec profil ni pendant une course. |
| `app/(tabs)/running.tsx`, `app/_layout.tsx` | Appel du hook ; `Stack.Screen` `running-welcome` (modal plein écran, sans en-tête). | `running-screen.test.tsx` : **le hook est mocké** (le mock global du profil est `null`, sans quoi l'accueil s'ouvrirait dans tous les tests du hub) ; `route-declarations` ; `pillar-identity` (ajout à `FICHIERS`) ; garde clavier (`self` ; `ReferencePaceDoors` couvert par ses **deux** importeurs exacts). |

## Étape 6 — Le test de 12 minutes guidé

| Fichier | Changement | Tests |
|---|---|---|
| `app/run/index.tsx` | Paramètre `test=cooper` (additif) : titre, sous-titre et protocole du test, **GPS imposé** (bascule masquée), pas de fantôme ni de séance, « Lancer le test », **mode retenu ni lu ni écrit** ; au départ réel, `startTracking(runId, { autoPause: false })` puis `cooperTest.mark(runId)`. Permission refusée : `cancelRun`, message, pas de repli sans GPS (R9). | `run-start-screen.test.tsx` : titre, pas de bascule, `autoPause: false`, pas de `setSource`, marqueur posé, refus → annulation + message. Tests existants (séance, Recourir, course libre) verts. |
| `running/cooper-guidance.ts` (nouveau) | `useCooperTest({ runId, netSeconds, paused })` → `{ active, phase, remainingS }` ; parle et vibre sur `cooperCue` (R10) **sans** lire le réglage des annonces ; une pause avant 720 s appelle `cooperTest.interrupt()`. Même architecture que `ghost-guidance.ts` (écran de suivi, jamais la tâche de fond). | Annonces 11:00 et 12:00 une fois, aucune au montage, rien pour une autre course ; pause avant 12:00 → interrompu, silence ensuite ; pause après 12:00 → sans effet. |
| `components/running/CooperBand.tsx` (nouveau) | Bandeau « reste 7:42 » → « Plus qu'une minute » → « Test terminé » → ou « Test interrompu par la pause ». | Rendu des quatre états. |
| `app/run/active.tsx` | Rend `CooperBand` quand le marqueur désigne la course active. Rien d'autre ne change. | `run-active.test.tsx` : bandeau présent / absent. |
| `components/running/CooperResultCard.tsx` (nouveau), `app/run/summary.tsx` | En tête de « C'est fait » quand le marqueur désigne la course : `measureCooperTest(decodeTrack(run.gpsTrack), { interrupted })`, aperçu (`TrainingPaceList`), « Retenir cette allure » (`upsertRunnerProfile`, puis confirmation) / « Pas cette fois » ; marqueur effacé **au choix seulement** (R8). | `run-summary-screen.test.tsx` : carte et aperçu, « Retenir » écrit 314 pour 2 400 m et efface le marqueur, incomplet / interrompu / `noTrack` sans bouton, autre course sans carte, sortie sans choix → marqueur gardé. |

## Étape 7 — Clôture

- i18n FR + EN (§6 de la spec), `node scripts/check-i18n-parity.mjs` ; clés remplacées retirées.
- Notes d'implémentation dans la spec ; roadmap **5.45** → ✅ et renvoi dans **5.40** (R2b, R2c
  livrées ; 5.40 reste 🟡 tant que CARDIO-03 à 07 sont au BACKLOG), Récapitulatif recompté, entrée au
  journal des réconciliations ; BACKLOG : retirer ce qui est livré, ajouter ce qui est découvert.
- `etape: close` dans le commit qui livre le code complet (règle du 23/10/2026 : pas d'étape de
  recette). La vérification sur device se demande ensuite dans la conversation.

## Risques et points de vigilance

- **R18-R20 changent un comportement de données** : ce sont les seuls changements qui touchent des
  comptes existants. Tests vus rouges avant le correctif ; le commentaire de `deleteRun` réécrit pour
  que l'effet 4 dise la vérité.
- **L'accueil écrit une ligne de profil automatiquement** : la garde R14 (en ligne + synchro de ce
  lancement) est ce qui empêche un second téléphone de créer une seconde ligne, refusée par
  l'unicité de `user_id`, et de bloquer toute sa synchronisation. Ne pas l'alléger.
- **Le test se mesure sur la trace, pas sur le chrono** : un écart de quelques mètres avec la distance
  affichée en course est normal ; le bandeau n'affiche donc pas de distance à 12:00.
- **Garde clavier CLAV-01** : trois fichiers à champ neufs et un fichier qui en perd ; l'`INVENTORY`
  se met à jour dans la même étape que le code.
- **Rebase** : `run/index.tsx` et `planning/` peuvent bouger dans les sessions parallèles ; rebaser
  avant chaque push, jamais de force.
