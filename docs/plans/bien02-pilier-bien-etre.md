# Plan — BIEN-02 · Le pilier Bien-être : la maison

> Spec : [bien02-pilier-bien-etre.md](../specs/functional/us/bien02-pilier-bien-etre.md) · roadmap 1.31 ·
> toile [design/pilier-bien-etre-2026-10/](../../design/pilier-bien-etre-2026-10/).
> **Lot en une vague** avec BIEN-03 → BIEN-07 (décision de Florian du 01/10/2026), sur `dev`.

## Ordre de build (tel que livré)

Les six US partagent une migration, un schéma local et un écran : elles ont été construites **par
couche**, pas US par US.

1. **Données** — une migration additive `20261001084709_bien02_pilier_bien_etre.sql` (6 colonnes
   `user_settings`, 13 colonnes `daily_wellbeing`), poussée par le CLI, types régénérés, colonnes
   déclarées dans `powersync/schema.ts`. Aucune sync rule (`select *`).
2. **Briques pures** (`packages/shared`) — `wellbeing.ts` étendu, `wellbeing-sleep.ts`,
   `wellbeing-links.ts`, `wellbeing-section.ts`, `wellbeing-day.ts` ; `readiness.ts`,
   `session-adaptation.ts`, `cross-links.ts` complétés. Tests Vitest à chaque brique.
3. **Repositories** — `settings-repository` (table des six interrupteurs), `daily-wellbeing-repository`
   (réécrit : écriture partielle, nuits lues), `wellbeing-pillar-repository` (nouveau),
   `cross-links-repository`, `dashboard-repository`, `session-adaptation-repository`.
4. **Thème** — `colors.ts` (`pillarWellbeing`), `theme/pillar.ts`, `theme/stage.ts`, couleurs de menu.
5. **Écrans** — barre d'onglets, hub et ses trois sections, feuille du check-in, réglages du pilier,
   entrées (onboarding, Réglages, actions rapides), ligne contexte des bilans, lien du Labo.
6. **Health Connect** — `READ_SLEEP`, import, déclenchement au premier plan.
7. **i18n** FR + EN (fusion scriptée avec détection de conflit), **tests mobiles**, documentation.

## Ce que porte BIEN-02 dans cet ordre

| Étape | Fichiers |
|---|---|
| Drapeau du pilier | `user_settings.wellbeing_pillar_enabled` · `settings-repository.ts` (`WELLBEING_SETTING_COLUMNS`, une seule table pour la lecture, l'écriture et le test) |
| Consentement | `components/wellbeing/wellbeing-consent.ts` (`toggleWellbeingPillar`, `confirmWellbeingActivation`) |
| Entrées | `app/(onboarding)/pillars.tsx`, `app/settings.tsx`, `components/dashboard/QuickActions.tsx` |
| Identité | `theme/colors.ts`, `theme/pillar.ts`, `theme/stage.ts`, `stores/menu-accent-store.ts`, `components/AccentHalo.tsx` |
| Barre d'onglets (D2) | `app/(tabs)/_layout.tsx` (onglet `wellbeing-hub`, libellés 10 px au-delà de 5) |
| Hub | `app/(tabs)/wellbeing-hub.tsx`, `components/wellbeing/WellbeingHeader.tsx`, `WellbeingStageSummary.tsx`, `stores/wellbeing-section-store.ts`, `shared/wellbeing-section.ts` |
| Journal | `components/wellbeing/sections/JournalSection.tsx` |
| Garde-fou (D7) | `shared/wellbeing.ts` (`shouldShowLowMoodCard`), `components/wellbeing/LowMoodCard.tsx`, `stores/low-mood-store.ts` |
| Réglages du pilier | `app/wellbeing-settings.tsx` (enregistré dans `app/_layout.tsx`) |
| Historique BIEN-01 | `app/wellbeing.tsx` (nouvelles échelles pilier allumé) |

## Tests

- Shared : `wellbeing-pillar.test.ts` (garde-fou : règle, fenêtre, silence de 14 jours ; sections).
- Mobile : `settings-sql.test.ts` (six colonnes sur le vrai schéma, défauts OFF, pilier hors
  `active_pillars`, éteindre n'efface rien), `tabs-layout.test.tsx` (onglet masqué tant que les
  réglages ne sont pas chargés, D2, libellés), `wellbeing-hub-screen.test.tsx` (onglet affiché,
  paramètre lu une fois, pilier éteint), `wellbeing-cards.test.tsx` (garde-fou),
  `journal-section.test.tsx`, `contrast.test.ts` (exception de chroma documentée).

## Risques et parades

| Risque | Parade |
|---|---|
| Colonne absente du schéma local → écriture avalée (panne CYCLE-01) | test sur le vrai SQLite, une ligne par colonne |
| Un `'wellbeing'` dans `active_pillars` lu par un vieux client | drapeau à part, test-garde |
| Garde-fou mal calibré | seuil nommé, relecture humaine exigée en tête de recette |
