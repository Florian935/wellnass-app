# Plan d'implémentation — US BIEN-01 (check-in quotidien & journal de bien-être)

Spec : [bien01-checkin-bien-etre.md](../specs/functional/us/bien01-checkin-bien-etre.md) ·
Roadmap **1.24** · Branche `feature/bien01-checkin-bien-etre` · Estimation roadmap ~5 h.

> ⚠️ **Ce plan ne démarre pas** tant que les décisions **D1 → D6** de la spec §1 ne sont pas
> arbitrées. D2 (échelle 1-5) et D5 (le check-in ne compte pas dans la série) changent le code ;
> D6 (rappel) change le périmètre.

## Maquette

[design/bien01-checkin-bien-etre/](../../design/bien01-checkin-bien-etre/) — écran de check-in,
widget dans ses 3 formes, écran d'historique.

## Fichiers touchés

**Créés**

| Fichier | Rôle |
|---|---|
| `supabase/migrations/<ts>_bien01_daily_wellbeing.sql` | Table, index partiel, RLS |
| `supabase/migrations/<ts>_bien01_daily_wellbeing_publication.sql` | `alter publication powersync` |
| `packages/shared/src/wellbeing.ts` | Briques **pures** : bornes d'échelle, agrégats, séries à trous |
| `packages/shared/src/wellbeing.test.ts` | Tests des briques (Vitest) |
| `apps/mobile/src/data/repositories/daily-wellbeing-repository.ts` | Lecture/écriture locale |
| `apps/mobile/src/components/dashboard/WellbeingCard.tsx` | Widget, 3 formes |
| `apps/mobile/src/app/wellbeing.tsx` | Écran d'historique + courbe |
| `apps/mobile/src/app/wellbeing-checkin.tsx` | Écran (ou feuille) de saisie |

**Modifiés**

| Fichier | Modification |
|---|---|
| `apps/mobile/src/powersync/schema.ts` | Déclarer `daily_wellbeing` |
| `docs/specs/technical/powersync-sync-rules.yaml` | Une ligne `select * from daily_wellbeing …` |
| `packages/shared/src/widgets.ts` | `wellbeing` en **fin** de `HOME_WIDGET_IDS`, `pillars: 'always'` |
| `packages/shared/src/widgets.test.ts` | Registre + gating transverse |
| `apps/mobile/src/components/dashboard/dashboard-widgets.tsx` | Brancher le widget |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | Namespace `wellbeing` (dont **15 libellés de niveaux**) |
| `apps/mobile/src/lib/data-export.ts` | Ajouter `daily_wellbeing` à la liste de tables |
| `packages/shared/src/database.types.ts` | Régénéré (`npm run db:types`) |
| `supabase/MIGRATIONS.md` | 2 lignes cochées |
| `docs/roadmap/roadmap.md` | 1.24 → ✅ |

**Volontairement non touchés** : `streak.ts` (D5 — le check-in ne compte pas dans la série),
`bodyweight-repository.ts` (réutilisé **tel quel**, via son API existante), `notifications.ts` (D6).

---

### Tâche 1 — Briques pures `wellbeing.ts` (TDD)

Écrire les tests **d'abord**. Aucune dépendance React, aucun accès base : du calcul.

1. `WELLBEING_SCALE_MIN/MAX` (1 / 5) et validation d'une valeur.
2. `isEmptyCheckin(input)` — les 3 indicateurs nuls ⇒ ne rien écrire (spec §4).
3. `wellbeingSeries(rows, indicator, days, todayKey)` — série datée pour la courbe, **trous
   conservés** (un jour non renseigné n'est **pas** un 0, aucune interpolation).
4. `wellbeingAverages(rows, days)` — moyenne par indicateur sur les **jours renseignés seulement**
   (patron `averageIntake` : les jours vides ne tirent pas la moyenne vers le bas).
5. `canEditDay(logDate, todayKey)` — fenêtre de rattrapage **J-6 → J**, futur refusé (D4).

Cas de test à ne pas oublier : jour unique (pas de tendance), tous les indicateurs nuls, date
future, date à J-7 (refusée) et J-6 (acceptée), série entièrement vide.

### Tâche 2 — Migration, schéma PowerSync et sync rule

1. `npm run db:new bien01_daily_wellbeing` → écrire le SQL de la spec §4.
2. `npm run db:new bien01_daily_wellbeing_publication` → `alter publication powersync add table`,
   gardé par `pg_publication_tables` (copier `20260728132601`).
3. `npm run db:push:dry` puis `npm run db:push`.
4. `npm run db:types`.
5. Cocher les **2** lignes dans `supabase/MIGRATIONS.md`.
6. Déclarer la table dans `powersync/schema.ts` (colonnes `text` pour les dates, `integer` pour les
   échelles — calquer `daily_steps`).
7. Ajouter la ligne dans `powersync-sync-rules.yaml`, **coller le fichier dans le dashboard
   PowerSync et déployer**. ⚠️ Étape **manuelle** : sans elle, tout fonctionne en local et rien ne
   remonte — panne silencieuse. Vérifier avant de continuer.

### Tâche 3 — Repository `daily-wellbeing-repository.ts`

- `useWellbeing(sinceDate?)` → lignes locales, anté-chronologiques.
- `useTodayWellbeing()` → la ligne du jour ou `null` (alimente l'état du widget).
- `upsertWellbeing(input)` → UUID client si création, `updated_at` UTC, **update** si une ligne
  vivante existe pour ce `log_date`. Refuse une entrée vide (tâche 1.2) et hors fenêtre (tâche 1.5).
- Le **poids** n'est pas géré ici : l'écran appelle l'API existante de `bodyweight-repository`.
  Interdit de dupliquer la logique de pesée.
- Test d'écriture dédié (patron `__tests__/daily-steps-write.test.ts`) : création, mise à jour du
  même jour, refus d'entrée vide.

### Tâche 4 — Écran de check-in

- 3 échelles 1-5 (pictogramme + libellé + état sélectionné), un champ poids optionnel pré-rempli,
  un bouton de validation.
- Accessibilité **dès l'écriture**, pas après : `accessibilityRole="radio"`, label explicite par
  niveau, cible ≥ 48 dp avec `hitSlop`, `maxFontSizeMultiplier` sur les libellés courts.
- Aucune couleur seule porteuse de sens ; l'échelle de **stress** se lit à l'envers → libellés
  désambiguïsants.
- Le poids passe par le repository existant : si une pesée du jour existe, on la **met à jour**.

### Tâche 5 — Widget `wellbeing` (3 formes)

- `small` : état du jour ou invitation. `wide` : les 3 valeurs du jour. `large` : + mini-tendance 7 j.
- `pillars: 'always'` et ajout **en fin** de `HOME_WIDGET_IDS` → `resolveScreenLayout` complète les
  layouts stockés, **aucune migration de `dashboard_layout`** (précédent PAS-01).
- Test de registre : présent, transverse, visible avec `active_pillars = ['nutrition']` seul.

### Tâche 6 — Écran d'historique

- Liste anté-chronologique + **sélecteur d'indicateur** (une courbe à la fois), fenêtres 30 j / 90 j
  / 1 an.
- `ProgressLineChart` avec `smooth` ; l'infobulle (UX-01) affiche la **valeur brute**.
- États vides explicites : aucun check-in / un seul jour.
- **Pas de courbe de poids ici** : lien vers l'existante (4.30).

### Tâche 7 — i18n, export RGPD, purge

1. Namespace `wellbeing` en FR **et** EN, dont les **15 libellés de niveaux**. Pluriels `_one`/`_other`.
2. `daily_wellbeing` ajoutée à la liste de tables de `data-export.ts` — sinon donnée non exportable,
   donc non conforme.
3. Vérifier que la **cascade FK** purge bien à la suppression de compte (ne pas le supposer).
4. Compléter le texte de **politique de confidentialité** (humeur / énergie / stress) — à faire
   **avant** la relecture juridique, qui est sur le chemin critique de LANCE-00.

---

## Ordre de build et pourquoi

1. **Tâche 1** (briques pures) — testables sans base ni device, elles figent les règles (fenêtre de
   rattrapage, trous, moyennes) avant toute UI.
2. **Tâche 2** (migration + sync rule) — tout le reste en dépend, et l'étape manuelle doit être
   franchie **tôt** pour ne pas découvrir la panne silencieuse en recette.
3. **Tâche 3** (repository) — la seule porte d'écriture.
4. **Tâche 4** (check-in) puis **5** (widget) — le chemin de saisie avant l'affichage.
5. **Tâche 6** (historique) — n'a de sens qu'avec quelques jours de données.
6. **Tâche 7** (i18n, RGPD) — en dernier mais **dans la DoD**, pas en option.

## Tests prévus

| Niveau | Quoi |
|---|---|
| Vitest (`shared`) | `wellbeing.test.ts` : échelles, entrée vide, séries à trous, moyennes sur jours renseignés, fenêtre de rattrapage (J-6 oui / J-7 non / futur non) |
| Vitest (`shared`) | `widgets.test.ts` : `wellbeing` présent, `'always'`, visible en nutrition seule |
| Jest (mobile) | Écriture repository : création, update du même jour, refus d'entrée vide, poids délégué à `bodyweight-repository` |
| Jest (mobile) | Smoke du widget dans ses 3 formes et de l'écran d'historique (états vides inclus) |
| Recette device | Les 11 critères de la spec §11 — dont le **chronomètre à 10 s** et la vérification que la **série ne bouge pas** |

## Risques

| Risque | Parade |
|---|---|
| **Sync rule non déployée** → données locales seulement, **aucune erreur visible** | Étape 7 de la tâche 2, franchie et vérifiée **avant** de coder l'UI ; en DoD ; critère de recette 5 |
| Le rituel dépasse 10 s → abandonné en 3 jours | 3 échelles maximum (D1), 1 tap par échelle (D2), saisie partielle acceptée (D3) ; **critère de recette chronométré** |
| Doublon de poids (2ᵈᵉ table ou 2ᵈᵉ entrée du jour) | Aucune colonne poids dans la table ; l'écran passe par `bodyweight-repository` ; critère de recette 4 |
| Streak dévalorisé par des check-ins | D5 : `streak.ts` **non touché** ; critère de recette 6 |
| Dérive vers un 4ᵉ pilier | Aucune entrée dans `active_pillars`, aucun onglet, widget `'always'` |
| Échelle de stress lue à l'envers | Libellés explicites, couleur jamais seule porteuse de sens |
| Politique de confidentialité devenue fausse | Tâche 7.4, **dans la DoD** — et à passer avant la relecture juridique de LANCE-00 |
| Trous d'historique lus comme des zéros | Règle posée dans la brique pure (tâche 1.3) et testée, pas dans le composant |
