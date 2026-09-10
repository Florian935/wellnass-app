# Plan d'implémentation — CARDIO-UX01

> Spec : [cardio-ux01-refonte-pilier-course.md](../specs/functional/us/cardio-ux01-refonte-pilier-course.md)
> Branche : `feature/cardio-refonte-ux` · Maquettes : [design/audit-course/](../../design/audit-course/)

## Principe d'ordonnancement

**La justesse avant l'ergonomie.** Les lots 1 et 2 corrigent des chiffres faux et des données
perdues ; ils sont livrables et recettables seuls. Les lots suivants ne peuvent pas casser ce qui
précède parce que chaque brique de calcul est **pure et testée** dans `packages/shared` avant
d'être branchée à un écran.

Chaque lot finit sur `npm run typecheck && npm run lint && npm run test` verts.

---

## Lot 1 — Le temps (R1a, R1b, F16)

**Briques pures** — `packages/shared/src/run-clock.ts` (neuf)
- `displayedNetSeconds({ flushedDurationS, lastFlushAtMs, nowMs, paused })` — la règle R1a-1, seule
  et testable : durée nette du dernier flush + delta local si non en pause, jamais de repli sur
  l'horloge murale.
- Tests : en marche, en pause, avant le premier flush, flush en retard, valeurs négatives.

**Tracker** — `apps/mobile/src/running/tracker-task.ts`
- Sortir `s.netDurationS += dt` de la branche « segment fiable » (règle R1a-2). La distance garde
  son filtre `MAX_PLAUSIBLE_SPEED_MS`, la durée ne le partage plus.
- Exposer `lastFlushAtMs` dans `trackerState` + un émetteur, pour que l'écran ait le repère local.
- **Chrono du mode manuel** : un compteur local dans le tracker, sans GPS ni permission —
  `startManualClock(runId, startedAtMs)`, `pauseManualClock`, `resumeManualClock`,
  `stopManualClock()` qui flushe la durée nette via `flushTrack` (sans segment de trace).

**Repository** — `run-repository.ts`
- `flushTrack` accepte un flush **sans** `segmentEncoded` (durée seule, mode manuel).
- `setManualRunDuration(runId, seconds)` — édition de la durée au résumé, recalcule `avg_pace`.
- `finishRun` : si `duration_seconds` est `null` et la source est `manual`, retomber sur la durée
  nette transmise par l'appelant plutôt que d'écrire `null`.

**Écrans**
- `run/active.tsx` : le chrono passe sur `displayedNetSeconds`, mot « net » affiché, bandeau de
  pause visible, chrono figé et grisé en pause.
- `run/index.tsx` : le mode manuel démarre le chrono local.
- `run/summary.tsx` : champ **durée** éditable pour une course manuelle, à côté de la distance ;
  ligne d'explication de l'écart écoulé / net quand il y a eu des pauses.

---

## Lot 2 — La boucle et les issues (R1c, R1d)

**Repository**
- `finishRun` appelle `markPlannedSessionDone` quand `planned_session_id` est présent (R1c-1,
  idempotent, dans la même transaction logique).
- `unlinkPlannedSession(runId)` — dé-validation depuis le résumé (R1c-2).
- `deleteRun(runId)` — soft delete + retrait des records portés + recalcul de l'allure de référence
  + remise en `planned` de la séance liée (R1d-1). Une fonction, une transaction.
- `updateRunCore(runId, { distanceM, terrain, startedAt })` — la correction (F19).

**Écrans**
- `run/active.tsx` : Stop devient **deux temps**. Un appui → `pauseTracking()` + panneau d'issues
  (Reprendre · Terminer · Supprimer). Le verrou d'écran est un état local qui neutralise les gestes
  et n'affiche qu'un bouton de déverrouillage.
- `run/summary.tsx` : bandeau « Séance de mardi validée » + *Annuler*, actions *Corriger* et
  *Supprimer*.
- `running-history/index.tsx` : balayage → Corriger / Supprimer.

**Tests** — `run-sql.test.ts` : le test du mode manuel qui simulait le tracker à la main est
**réécrit** pour passer par le vrai chemin (c'est lui qui masquait F15).

---

## Lot 3 — Le hub et l'entrée (R2, R3)

**Briques pures** — `packages/shared/src/running-hub.ts` (neuf, calqué sur `strength-hub.ts`)
- `resolveRunHubState(input)` → `resume` | `today` | `rest` | `onboarding` (R3-1).
- `resolveWeekSummary({ runs, plannedCount, targetFrequency })` — Ma semaine (F37).
- `paceFromRaceTime(distanceM, timeS)` — Riegel inversé pour R2b, sur `predictRaceTime` existant.
- `resolveHeroMetric(sessionType, override)` — R5-2, utilisé au lot 5.

**Widgets** — `packages/shared/src/widgets.ts`
- `MAX_RUNNING_WIDGETS = 4` + test qui échoue si le registre grossit.
- `isActive` passé à la grille depuis le hub course.

**Écrans**
- `(tabs)/running.tsx` : zone Agir à quatre états, Ma semaine, carte d'adaptation avec action,
  entrée Profil dans l'en-tête.
- `running-profile.tsx` : `ScreenHeader`, bouton Retour retiré, quatre portes vers l'allure de
  référence, fréquence hebdo lue par Ma semaine.
- `app/(onboarding)/` : trois questions du pilier (R2c), chacune ignorable.
- `SessionAdaptationCard.tsx` : bouton « Appliquer aujourd'hui » →
  `applyAdaptationForToday(plannedSessionId, proposal)` qui écrit une **variante datée** (R3-3).

---

## Lot 4 — Partir (R4)

- Réglages : `lastRunSource`, `countdownSeconds` sur `settings` (colonnes existantes du JSON de
  réglages, aucune migration).
- `running/tracker.ts` : `probeGpsFix()` — un abonnement court qui rend la précision courante sans
  démarrer la course (F6).
- `run/index.tsx` réécrit en **écran de préparation** : contexte de séance (F7), état du fix (F6),
  mode mémorisé (F4), compte à rebours (F5), permission demandée avant `startRun` (F8), et l'entrée
  « Ajouter une course passée » (F26).
- `run/past.tsx` (neuf) : formulaire de saisie rétroactive → `createPastRun`.
- Le hub démarre directement (F4) : `router.push('/run?auto=1')` saute la préparation quand le fix
  est déjà bon et qu'aucune séance n'a de consigne à relire.

---

## Lot 5 — Courir (R5)

**Briques pures** — `packages/shared/src/run-segment-banner.ts` (neuf)
- `resolveSegmentBanner({ blocks, phaseIndex, phaseStartD, phaseStartT, distanceM, durationS, vma })`
  → `{ kind, repLabel, rep, totalReps, remaining: {axis, value}, targetRange, next, progress }` ou
  `null`. Se reconstruit **uniquement** depuis le curseur persisté (R5-1).
- Tests : première phase, phase courante, dernière phase franchie, curseur `null`, blocs vides,
  phase bornée en durée, groupe répété.

**Écran** — `run/active.tsx`
- Bandeau de segment en haut (F10), progression de séance, segment suivant.
- Héros adaptatif (F13) via `resolveHeroMetric`, avec bascule au tap.
- Jauge d'écart sur l'échelle de la plage cible.

---

## Lot 6 — Clore et analyser (R6)

- `run/summary.tsx` scindé : l'écran garde le premier temps (« C'est fait »), le second temps passe
  dans `run/analysis.tsx` (neuf), qui reçoit l'id.
- Ressenti nommé : réutilisation directe de `workout-feeling.ts` (`WORKOUT_FEELINGS`,
  `feelingToStoredRpe`, `feelingFromStoredRpe`) — aucune brique neuve, aucune migration.
- Tableau des fractions : grille `74px 1fr 62px`, plage complète du prévu (F21).

---

## Lot 7 — Historique (R7)

- `running-history/index.tsx` → trois onglets, chaque onglet dans son composant :
  `RunJournalTab` · `RunProgressTab` · `RunRecordsTab`.
- Journal : `FlatList` avec `SectionList` par mois, filtres type / période, ligne enrichie (F24),
  balayage vers Corriger / Supprimer.
- **Brique pure** — `groupRunsByMonth(runs)` et `filterRuns(runs, filters)` dans
  `packages/shared/src/run-history.ts`, testées.

---

## Lot 8 — Préparer (R8)

**Briques pures** — `packages/shared/src/session-line.ts` (neuf)
- `parseSessionLine(text)` → `{ segments } | { error }` (R8-1). Grammaire close, refus explicite.
- `formatSegmentSummary(block)` → `Corps · 6 × 400 m @ 4:05 · R 200 m` pour la ligne repliée.
- `SESSION_TEMPLATES` — catalogue court (`6x400`, `10x400`, `3x1000`, `2x(3x300)`, pyramide,
  tempo 20 min), chacun une liste de segments.
- Tests : chaque forme de la grammaire, lignes invalides, aller-retour parse → format.

**Composants**
- `IntervalBlockEditor.tsx` réécrit sur `CollapsibleCard` : replié / essentiel / réglages fins.
  Durées en **secondes** (F30), distance de segment via `useUnits` (F31).
- `RunningSessionEditor.tsx` : sections repliables, « Répéter la sélection » (F28), duplication de
  segment, modèles et saisie en une ligne (F34).
- `running-programs/[id].tsx` : un seul bouton « Suivre ce programme », duplication implicite
  annoncée après coup (F38).

---

## Lot 9 — Le modèle (R9)

- Migration `supabase/migrations/<ts>_cardio_ux01_sessions_week_index.sql` :
  `alter table public.sessions add column if not exists week_index integer;`
- **Brique pure** — `generatePlannedSessions` étendu : une séance sans `week_index` est répétée
  chaque semaine, une séance qui en porte une n'est générée qu'à cette semaine (R9-1). Tests
  ajoutés à `planning.test.ts`.
- `program-repository.ts` : lecture tolérante (`week_index` absent → `null`), écriture depuis
  l'éditeur.
- `running-programs/edit.tsx` : vue par semaine, « Dupliquer la semaine ».
- Registre `MIGRATIONS.md` : ligne ajoutée, case **non cochée**.

---

## Lot 10 — Import (R10)

- **Brique pure** — `packages/shared/src/gpx-import.ts` : `parseGpx(xml)` →
  `{ points, startedAtMs, distanceM, durationS } | { error }`. Tests sur des traces
  d'`import-samples/`.
- `lib/health-connect.ts` : deux permissions de lecture ajoutées **derrière un réglage**, et
  `importRunsIfDue()` sur le patron de `importStepsIfDue`.
- `run/import.tsx` (neuf) : choisir un fichier GPX, aperçu, confirmation.
- Dédoublonnage `isDuplicateRun(startedAtMs, existing)` (R10-1), testé.

---

## Ordre de livraison et points de contrôle

| Lot | Sujet | Recettable seul | Risque |
|---|---|:---:|---|
| 1 | Le temps | oui | faible — briques pures |
| 2 | Boucle et issues | oui | moyen — `deleteRun` touche records et planning |
| 3 | Hub et entrée | oui | faible |
| 4 | Partir | oui | moyen — permissions et fix GPS, non testables hors device |
| 5 | Courir | oui | faible — se branche sur un curseur déjà persisté |
| 6 | Clore | oui | faible |
| 7 | Historique | oui | faible |
| 8 | Préparer | oui | moyen — réécriture de deux gros éditeurs |
| 9 | Modèle | non — migration non poussée | **élevé** — schéma |
| 10 | Import | partiellement — GPX oui, Health Connect non | **élevé** — déclaration Play |

## Ce que je ne fais pas

- `npm run db:push` (lot 9) — vise le cloud de production.
- Activer la lecture Health Connect en production (lot 10) — la déclaration Play doit être mise à
  jour d'abord.
- La recette sur device : la seule étape qu'un agent ne peut pas franchir.
