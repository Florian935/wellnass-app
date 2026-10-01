# Plan — BIEN-07 · Les modules

> Spec : [bien07-modules.md](../specs/functional/us/bien07-modules.md) · roadmap 1.36.
> Lot en une vague avec BIEN-02 → BIEN-07 (voir le [plan de BIEN-02](bien02-pilier-bien-etre.md)).

## Étapes

1. **Colonnes** : `user_settings.wellbeing_{alcohol,caffeine,nap,cravings}_enabled` (défaut false) ;
   `daily_wellbeing.alcohol_drinks` (0-3), `late_caffeine`, `nap_minutes` (0-180), `cravings` (1-5).
   Bornes du code = bornes des `check` Postgres (`ALCOHOL_DRINKS_MAX`, `NAP_MINUTES_MAX`).
2. **Shared** : `isAlcoholDrinks`, `isNapMinutes`, `cravings` dans les échelles ; liens `alcoholRunning`,
   `alcoholNight`, `caffeineNight` (BIEN-05).
3. **Repository** : modules lus par `useWellbeingPillar().modules` ; colonnes écrites seulement si la
   feuille les porte.
4. **Écrans** : interrupteurs dans `app/wellbeing-settings.tsx` ; questions du soir dans
   `MomentCheckinSheet` ; réponses relues au jour dans `sections/JournalSection.tsx`.
5. **i18n** : `wellbeing.modules.*`, `wellbeingSettings.modules.*`, `wellbeingHub.journal.{alcohol,…}`.

## Tests

- Mobile : `moment-checkin-sheet.test.tsx` (modules éteints : aucune question, aucune colonne ;
  allumés : chaque réponse part ; retaper retire), `settings-sql.test.ts` (quatre colonnes),
  `journal-section.test.tsx` (réponses relues au jour).
- Shared : `wellbeing-pillar.test.ts` (bornes), `wellbeing-links.test.ts` (croisements des modules).
