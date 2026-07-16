# US — Sélecteur de langue dans les Réglages — Plan d'implémentation

> Tâche par tâche (cases `- [ ]`), commits fréquents. Spec :
> [langue-selecteur-reglages.md](../specs/functional/us/langue-selecteur-reglages.md).

**Goal :** exposer un sélecteur FR/EN dans les Réglages (la persistance + la réaction i18next existent
déjà). **Architecture :** `Segment` dans `settings.tsx` → `updateSettings({ language })` + clés i18n.
**100 % client, aucune migration, aucun test unitaire nouveau (UI pure).**

## Structure des fichiers
- **Modifier** `apps/mobile/src/i18n/locales/fr.json` + `en.json` — `settings.language.*`.
- **Modifier** `apps/mobile/src/app/settings.tsx` — section « Langue » (`Segment`).

---

## Task 1 : i18n `settings.language.*`

**Files:** Modify `fr.json` + `en.json`.

- [ ] **Step 1** — Ajouter dans le namespace `settings` (à côté de `appearance`/`units`), **des deux
  côtés** :
  ```json
  "language": { "title": "Langue", "fr": "Français", "en": "English" }
  ```
  (EN : `"title": "Language"`, mêmes endonymes `fr`/`en`.)
- [ ] **Step 2** — Vérifier parité (diff manuel) + `node -e "JSON.parse(...)"` sur les 2 fichiers.
- [ ] **Step 3 — Commit** : `git commit -m "i18n: settings.language (FR/EN)"`.

---

## Task 2 : section « Langue » dans `settings.tsx`

**Files:** Modify `apps/mobile/src/app/settings.tsx`.

- [ ] **Step 1** — Imports : ajouter `LOCALES` et le type `Locale` à l'import `@wellness/shared`
  (déjà source de `PILLARS`/`UNIT_SYSTEMS`/types) ; `getAppLanguage` depuis `@/i18n`.
- [ ] **Step 2** — Valeur courante : `const language = settings?.language ?? getAppLanguage();`
  (avec les autres `const theme/units` en tête de composant).
- [ ] **Step 3** — Rendu : ajouter une section après Unités (avant Notifications) :
  ```tsx
  {/* Langue */}
  <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 28 }]}>
    {t('settings.language.title')}
  </Text>
  <Segment
    options={LOCALES}
    value={language}
    onChange={(next: Locale) => void updateSettings({ language: next })}
    label={(option) => t(`settings.language.${option}`)}
  />
  ```
  ⚠️ `LOCALES` est `readonly ['fr','en']` — compatible avec `Segment<T extends string>` (voir
  `UNIT_SYSTEMS` déjà passé ainsi). `updateSettings` accepte déjà `{ language }` (`SettingsInput`).
- [ ] **Step 4 — Vérifier** : `npm run typecheck --workspace @wellness/mobile` + `npm run lint` → verts.
- [ ] **Step 5 — Commit** : `git commit -m "feat(mobile): sélecteur de langue FR/EN dans les Réglages"`.

---

## Task 3 : clôture
- [ ] **Step 1** — `TODO.md` : cocher `[x]` le bug §🐞 « aucun sélecteur de langue » (corrigé, branche,
  date) ; MàJ date.
- [ ] **Step 2 — Vérifs** : `npm run typecheck` + `npm run lint` verts.
- [ ] **Step 3 — Commit** : `git commit -m "docs(todo): sélecteur de langue livré"`.

## Notes
- **Reste recette device (Florian)** : FR↔EN dans Réglages → UI bascule immédiatement ; relancer l'app →
  langue conservée ; (optionnel) 2ᵉ appareil → langue synchronisée. **Pas de checkpoint 🔴.**
