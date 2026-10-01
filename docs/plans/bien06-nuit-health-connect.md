# Plan — BIEN-06 · La nuit lue dans Health Connect

> Spec : [bien06-nuit-health-connect.md](../specs/functional/us/bien06-nuit-health-connect.md) · roadmap 1.35.
> Lot en une vague avec BIEN-02 → BIEN-07 (voir le [plan de BIEN-02](bien02-pilier-bien-etre.md)).

## Étapes

1. **Colonnes** : `user_settings.sleep_health_connect_enabled` ; `daily_wellbeing.sleep_source`
   (`manual` | `health_connect`), `sleep_start_at`, `sleep_end_at`.
2. **Shared** `wellbeing-sleep.ts` (nouveau, pur) : `nightsFromSleepSessions` (matin du réveil 3 h-14 h,
   ≥ 3 h, phases d'éveil 1/3/7 retirées, sessions d'un même réveil additionnées, borne 14 h),
   `canWriteImportedNight`, `bedtimeSpread` (5 nuits sur 14 jours).
3. **Repository** : `upsertImportedNights` (jamais sur une saisie manuelle, J-6 → aujourd'hui, pas de
   réécriture identique) ; `getSleepImportSettings`.
4. **Service** `lib/health-connect.ts` : `SLEEP_PERMISSIONS` (à part), `hasSleepPermissions`,
   `requestSleepPermissions`, `getSleepState`, `readySleep`, `importSleep(7)`, `importSleepIfDue`
   (1 h), compte rendu `kind: 'sleep'`.
5. **Déclenchement** : `hooks/useHealthConnectImports.ts` (retour au premier plan).
6. **Natif** : `app.json` → `android.permission.health.READ_SLEEP` (**nouvel APK requis**).
7. **Écran** : section « La nuit lue dans Health Connect » de `app/wellbeing-settings.tsx` ; badge
   dans `MomentCheckinSheet`.
8. **Hors-code** : déclaration Play à 7 types, politique de confidentialité.

## Tests

- Shared : `wellbeing-sleep.test.ts` (matin du réveil, sieste, éveil retiré, nuit coupée, fuseau,
  borne, priorité manuelle, régularité).
- Mobile : `health-connect-sleep.test.ts` (permission à part, garde pilier + interrupteur, import et
  fenêtre, sessions de l'app ignorées, « aucune session », throttle 1 h), `daily-wellbeing-write.test.ts`
  et `daily-wellbeing-sql.test.ts` (`upsertImportedNights` : manuel jamais écrasé, fenêtre, identique),
  `app-state-hooks.test.tsx` (mock).
