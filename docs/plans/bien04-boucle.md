# Plan — BIEN-04 · La boucle

> Spec : [bien04-boucle.md](../specs/functional/us/bien04-boucle.md) · roadmap 1.33.
> Lot en une vague avec BIEN-02 → BIEN-07 (voir le [plan de BIEN-02](bien02-pilier-bien-etre.md)).

## Étapes

1. **Shared** :
   - `wellbeing.ts` — `isPoorNight` (moins de `SHORT_NIGHT_MINUTES` ou qualité ≤ 2 ; `null` si rien) ;
   - `readiness.ts` — `classifyWellbeingComponent({ energy, stress, poorNight?, sick? })` ;
   - `session-adaptation.ts` — raisons `sick` (report), `short_night` (même traitement que l'énergie
     basse), `low_motivation` (info) ;
   - `wellbeing-day.ts` (nouveau) — `buildWellbeingDay` : signaux du jour, conseil par séance prévue
     (décaler, alléger, version courte, go), note de l'assiette ; `canWriteLighten` réservé à la course
     intense non adaptée.
2. **Repositories** : `dashboard-repository.ts` (`useReadiness` lit nuit et « malade » pilier allumé),
   `session-adaptation-repository.ts` (mêmes signaux), `wellbeing-pillar-repository.ts`
   (`useWellbeingDay`).
3. **Écrans** : `WellbeingStageSummary.tsx` (verdict + raisons), `sections/TodaySection.tsx` (« ce que
   ça change », feuille `LabApplySheet` → `reschedulePlannedSession` / `applyAdaptationForToday`),
   `WellbeingContextLine.tsx` insérée dans `app/workout-summary.tsx`, `app/run/summary.tsx`,
   `app/nutrition-day.tsx`, `app/history/[id].tsx`.
4. **i18n** : `wellbeingHub.today.*`, `wellbeingHub.signals.*`, `wellbeingHub.context.*`,
   `home.readiness.wellbeing.negative`.

## Tests

- Shared : `readiness.test.ts`, `session-adaptation.test.ts`, `wellbeing-day.test.ts`.
- Mobile : `wellbeing-cards.test.tsx` (ligne contexte : rien pilier éteint ou sans check-in, « d'habitude »
  seulement après une nuit courte et un lien probable/solide, lien du pilier du bilan) ; mocks ajoutés
  aux tests d'écran des quatre bilans.

## Point d'attention

La séance de muscu ne lit pas d'adaptation écrite : « alléger » y reste un conseil. Écrire une version
courte de muscu demanderait que la séance sache lire `adapted_reps_pct` — hors périmètre.
