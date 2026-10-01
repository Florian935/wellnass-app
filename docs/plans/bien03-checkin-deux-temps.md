# Plan — BIEN-03 · Le check-in en deux temps

> Spec : [bien03-checkin-deux-temps.md](../specs/functional/us/bien03-checkin-deux-temps.md) · roadmap 1.32.
> Lot en une vague avec BIEN-02 → BIEN-07 (ordre par couche : voir le
> [plan de BIEN-02](bien02-pilier-bien-etre.md)).

## Étapes

1. **Colonnes** `sleep_quality`, `motivation` (1-5), `sick`, `busy_day`, `late_night`, `travel`
   (booléens) — migration du chantier ; schéma PowerSync local.
2. **Shared** (`wellbeing.ts`) : `WELLBEING_SCALE_KEYS` élargi, `WELLBEING_TAGS`, `CheckinMoment`,
   `suggestCheckinMoment` (12 h / 17 h), `hasMorningCheckin`, `hasEveningCheckin`, `isEmptyCheckin`
   étendu.
3. **Repository** (`daily-wellbeing-repository.ts`) : `presentColumns` n'écrit **que les clés
   présentes** ; une ligne existante accepte une entrée « vide » (décocher) ; `sleep_source = 'manual'`
   à la saisie d'une nuit.
4. **Feuille** `components/wellbeing/MomentCheckinSheet.tsx` : matin / soir, `payload()` limité aux
   champs du moment, nuit lue non renvoyée tant qu'elle n'est pas touchée, « effacer » pour une nuit
   saisie seulement, rattrapage de la veille, « Courbatures » → `/pain`.
5. **Branchements** : onglet Aujourd'hui (moment de l'heure en tête), Journal (corriger un jour),
   écran `/wellbeing`.
6. **i18n** : `wellbeing.moments.*`, `wellbeing.indicators.*`, `wellbeing.levels.*`, `wellbeing.tags.*`.

## Tests

- Shared : `wellbeing-pillar.test.ts` (moment suggéré, check-in vide, étiquettes).
- Mobile : `moment-checkin-sheet.test.tsx` (champs du moment seulement, nuit lue non renvoyée,
  corrigée → envoyée, « effacer », modules, échec visible), `daily-wellbeing-write.test.ts`
  (colonnes, mise à jour partielle, étiquette décochée), `daily-wellbeing-sql.test.ts` (matin + soir
  sur une ligne, sur le vrai schéma).
