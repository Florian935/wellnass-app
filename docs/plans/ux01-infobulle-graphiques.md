# US UX-01 — Infobulle de valeur au tap sur les graphiques — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans. Steps en cases `- [ ]`.
> ⚠️ **Workflow projet** : ne PAS exécuter avant validation des 3 livrables (spec + plan + maquette).
> ✅ **Aucune migration. Aucun module natif. Aucune nouvelle dépendance** → reload Metro suffit.
> ⚠️ **Vérifier les commandes de qualité SANS pipe** (`npm run typecheck; echo $?`) : un `| tail -N` renvoie
> le code de sortie de `tail` et masque l'échec (leçon de la CI rouge du 25/07).

**Goal :** taper un point ou une barre affiche sa valeur exacte et sa date, sur les **6 surfaces
graphiques** de l'app, via **une seule** infobulle partagée.

**Architecture :** la logique de formatage sort dans un **helper pur testé** (`@wellness/shared`) ; un
**composant d'infobulle unique** (`ChartTooltip`) est branché sur les deux wrappers de graphique —
`pointerConfig`/`pointerLabelComponent` côté `LineChart`, `focusBarOnPress`/`renderTooltip` côté `BarChart`.
`DataPoint` gagne un champ **optionnel** `detail` (date complète), renseigné par les appelants datés.

**Tech stack :** TypeScript, RN + Expo (SDK 57), `react-native-gifted-charts` ^1.4.77 (déjà installé),
i18next, Vitest (shared) + jest-expo (mobile).

**Spec :** [docs/specs/functional/us/ux01-infobulle-graphiques.md](../specs/functional/us/ux01-infobulle-graphiques.md)

**Ordre :** pur d'abord (formatage) → composant d'infobulle → courbes → histogrammes → câblage des
appelants → clôture. Chaque task est livrable et vérifiable seule.

---

## Structure des fichiers

**Créer :**
- `packages/shared/src/chart-tooltip.ts` (+ `chart-tooltip.test.ts`) — `formatTooltipValue` (**pur, testé**).
- `apps/mobile/src/components/charts/ChartTooltip.tsx` (+ smoke) — infobulle **partagée**, présentationnelle.

**Modifier :**
- `packages/shared/src/index.ts` — export du nouveau module.
- `apps/mobile/src/components/charts/ProgressLineChart.tsx` — `detail?` + `pointerConfig`.
- `apps/mobile/src/components/charts/MuscleVolumeBarChart.tsx` — `detail?` + `focusBarOnPress`/`renderTooltip`.
- `apps/mobile/src/app/progress/index.tsx` — `detail` sur la courbe muscu + fermeture au changement de métrique/période.
- `apps/mobile/src/app/nutrition-stats.tsx` — `detail` sur les courbes poids et apports.
- `apps/mobile/src/app/running-history/index.tsx` — `detail` sur la courbe d'allure + fermeture au changement de période.
- `apps/mobile/src/i18n/locales/{fr,en}.json` — le strict nécessaire (voir Task 5).

---

## Task 1 : Formatage de la valeur (pur, TDD)

**Files:** `packages/shared/src/chart-tooltip.ts`, `packages/shared/src/chart-tooltip.test.ts`,
`packages/shared/src/index.ts`

- [ ] **Step 1 : test qui échoue** — `chart-tooltip.test.ts` :
  ```ts
  import { describe, it, expect } from 'vitest';
  import { formatTooltipValue } from './chart-tooltip';

  describe('formatTooltipValue', () => {
    it('formateur fourni → prioritaire, unité accolée', () => {
      expect(formatTooltipValue(412, { formatValue: (s) => '6:52', unit: '/km' })).toBe('6:52 /km');
    });
    it('sans formateur → 1 décimale maximum', () => {
      expect(formatTooltipValue(82.46, { unit: 'kg' })).toBe('82,5 kg');
      expect(formatTooltipValue(82.44, { unit: 'kg' })).toBe('82,4 kg');
    });
    it('pas de décimale inutile', () => {
      expect(formatTooltipValue(82, { unit: 'kg' })).toBe('82 kg');
      expect(formatTooltipValue(82.0, { unit: 'kg' })).toBe('82 kg');
    });
    it('séparateur décimal selon la locale', () => {
      expect(formatTooltipValue(82.5, { unit: 'kg', locale: 'fr' })).toBe('82,5 kg');
      expect(formatTooltipValue(82.5, { unit: 'kg', locale: 'en' })).toBe('82.5 kg');
    });
    it('sans unité → valeur seule (cas équilibre musculaire)', () => {
      expect(formatTooltipValue(18, {})).toBe('18');
    });
    it('zéro affiché, jamais masqué', () => {
      expect(formatTooltipValue(0, { unit: 'kcal' })).toBe('0 kcal');
    });
    it('grande valeur : pas de séparateur de milliers surprise', () => {
      expect(formatTooltipValue(2340, { unit: 'kcal' })).toBe('2340 kcal');
    });
  });
  ```
  > ⚠️ **Le dernier cas est une décision à assumer** : `2340 kcal` (brut) plutôt que `2 340 kcal`. Motif :
  > les libellés d'axe existants n'ont pas de séparateur de milliers → cohérence visuelle. Si vous
  > préférez l'espace fine, changez **le test d'abord**.
- [ ] **Step 2 : lancer → échec** `npm run test -w @wellness/shared -- chart-tooltip`.
- [ ] **Step 3 : implémenter** — signature :
  ```ts
  export type TooltipValueOptions = {
    /** Formateur de l'appelant (ex. allure secondes → « 6:52 »). Prioritaire sur l'arrondi par défaut. */
    formatValue?: (value: number) => string;
    /** Unité déjà convertie en amont (kg/lb, kcal, /km…). Absente = valeur seule. */
    unit?: string;
    /** Locale active ; seul le séparateur décimal en dépend. Défaut 'fr'. */
    locale?: string;
  };

  export function formatTooltipValue(value: number, options: TooltipValueOptions): string
  ```
  Règles : `formatValue` prioritaire ; sinon arrondi à 1 décimale **puis** suppression du `,0` ;
  séparateur `,` si locale FR, `.` sinon ; unité accolée après une espace, omise si absente.
  **Aucune conversion d'unité ici** (déjà faite par `useUnits()` en amont).
- [ ] **Step 4 : exporter** `export * from './chart-tooltip';` dans `packages/shared/src/index.ts`.
- [ ] **Step 5 : vérifier** `npm run test -w @wellness/shared -- chart-tooltip` puis
  `npm run typecheck; echo $?` → **0** attendu.
- [ ] **Step 6 : commit** `feat(ux01): formatage de la valeur d'infobulle (pur, testé)`

---

## Task 2 : Composant d'infobulle partagé

**Files:** `apps/mobile/src/components/charts/ChartTooltip.tsx`,
`apps/mobile/src/components/charts/__tests__/chart-tooltip-smoke.test.tsx`

- [ ] **Step 1 : implémenter** — présentationnel **pur**, aucune logique de graphique :
  ```tsx
  type ChartTooltipProps = {
    /** Ligne 1 : date complète JJ/MM/AAAA, ou libellé d'axe si le point n'est pas daté. */
    heading: string;
    /** Ligne 2 : valeur déjà formatée (via formatTooltipValue). */
    value: string;
  };
  ```
  - deux `Text` ; `heading` en `textMuted` petite taille, `value` en `text` accentuée ;
  - fond `colors.surface`, bordure `colors.border`, rayon 10, ombre discrète, padding 8/10 ;
  - **`maxWidth` contraint** (≈ 140) + `numberOfLines={1}` sur chaque ligne → jamais de bulle géante ;
  - **ne pas figer la taille de police en dur au point de casser avec le Dynamic Type** : laisser le texte
    grandir, la bulle s'adapte (prépare 9.11).
- [ ] **Step 2 : smoke test** — rendu des deux lignes, en thème clair puis sombre (mock `useTheme`, patron
  des smokes existants). `await fireEvent…` si interaction (patron maison — sinon les états ne sont pas vidés).
- [ ] **Step 3 : vérifier** `npx jest chart-tooltip` + `npm run typecheck; echo $?`.
- [ ] **Step 4 : commit** `feat(ux01): composant d'infobulle de graphique partagé`

---

## Task 3 : Courbes — `pointerConfig`

**Files:** `apps/mobile/src/components/charts/ProgressLineChart.tsx`

- [ ] **Step 1 : étendre `DataPoint`** :
  ```ts
  type DataPoint = {
    label: string;
    value: number;
    /** Libellé riche pour l'infobulle (date complète JJ/MM/AAAA). Repli sur `label` si absent. */
    detail?: string;
  };
  ```
  ⚠️ **Propager `detail` dans `chartData`** (aujourd'hui le `.map` ne garde que `value` et `label`) —
  sinon `pointerLabelComponent` ne le verra jamais. **C'est l'oubli le plus probable de cette task.**
- [ ] **Step 2 : ajouter `pointerConfig`** :
  ```ts
  pointerConfig={{
    activatePointersInstantlyOnTouch: true, // tap, pas d'appui long
    persistPointer: true,                   // reste affichée après le relâchement
    pointerVanishDelay: 0,                  // pas d'auto-disparition
    autoAdjustPointerLabelPosition: true,   // recalage dans les bornes (bords du graphe)
    pointerColor: colors.accent,
    showPointerStrip: true,
    pointerStripColor: colors.border,
    pointerStripUptoDataPoint: true,
    pointerLabelWidth: 150,
    pointerLabelComponent: (items: { value: number; label: string; detail?: string }[]) => {
      const point = items[0]; // série BRUTE (data) : jamais la lissée (data2) — décision de cadrage
      if (!point) return null;
      return (
        <ChartTooltip
          heading={point.detail ?? point.label}
          value={formatTooltipValue(point.value, { formatValue: formatYLabel, unit, locale: i18n.language })}
        />
      );
    },
  }}
  ```
  > **Pourquoi `items[0]`** : avec le lissage, deux séries sont passées (`data` brute, `data2` lissée).
  > `items` les contient dans cet ordre → l'index 0 est la brute. Vérifier ce contrat au premier essai
  > device et **le documenter en commentaire** ; s'il s'avère inversé, corriger là et **seulement là**.
- [ ] **Step 3 : lisibilité de la valeur formatée** — récupérer la locale active (`useTranslation().i18n.language`
  ou `i18n.language`) pour le séparateur décimal. Ne pas dupliquer la règle : elle vit dans le helper (Task 1).
- [ ] **Step 4 : fermeture au tap hors point** — envelopper le graphe d'un `Pressable` (ou `View`
  `onStartShouldSetResponder`) qui remet l'infobulle à zéro.
  > ⚠️ **Seul vrai inconnu technique de l'US** : `gifted-charts` gère l'index du pointeur en interne. Si
  > aucune API propre ne permet de le réinitialiser, **le repli assumé** est : l'infobulle reste jusqu'au
  > tap suivant (elle ne gêne pas, elle est petite). Dans ce cas → **noter le repli dans le CHANGELOG et
  > amender la spec §2.4**, sans bricoler un remontage forcé (`key`) qui relancerait l'animation.
- [ ] **Step 5 : non-régression visuelle** — au premier rendu, **aucun changement** : `pointerConfig` ne
  s'active qu'au toucher. Vérifier les 4 courbes (muscu, poids, apports, allure) et **le cas allure**
  (échelle imposée `maxValue`/`yAxisOffset`/`stepValue` + `yAxisLabelTexts` intacts).
- [ ] **Step 6 : vérifier** `npx jest` (mobile) + `npm run typecheck; echo $?` + `npm run lint; echo $?`.
- [ ] **Step 7 : commit** `feat(ux01): infobulle au tap sur les courbes (pointerConfig)`

---

## Task 4 : Histogrammes — `focusBarOnPress` + `renderTooltip`

**Files:** `apps/mobile/src/components/charts/MuscleVolumeBarChart.tsx`

- [ ] **Step 1 : étendre `DataPoint`** de la même façon (`detail?: string`) et **le propager** dans `chartData`.
- [ ] **Step 2 : brancher** :
  ```ts
  focusBarOnPress
  focusedBarConfig={{ color: colors.accent }}  // mise en avant sobre
  renderTooltip={(item: { value: number; label: string; detail?: string }) => (
    <ChartTooltip
      heading={item.detail ?? item.label}
      value={formatTooltipValue(item.value, { unit, locale: i18n.language })}
    />
  )}
  ```
- [ ] **Step 3 : préserver les couleurs sémantiques** — l'équilibre musculaire colore chaque barre
  (délaissé = doré, équilibré = bordeaux, sur-représenté = grisé) via `frontColor`. La mise en avant **ne
  doit pas** rendre ces couleurs indistinguables : privilégier un **contour / une opacité** plutôt qu'un
  aplat accentué si le rendu écrase la sémantique. À juger sur device.
- [ ] **Step 4 : vérifier** les 2 histogrammes (volume hebdo, équilibre musculaire) + typecheck/lint/tests.
- [ ] **Step 5 : commit** `feat(ux01): infobulle au tap sur les histogrammes`

---

## Task 5 : Câblage des appelants (dates complètes + fermeture)

**Files:** `apps/mobile/src/app/progress/index.tsx`, `apps/mobile/src/app/nutrition-stats.tsx`,
`apps/mobile/src/app/running-history/index.tsx`, `apps/mobile/src/i18n/locales/{fr,en}.json`

- [ ] **Step 1 : renseigner `detail`** sur les **4 surfaces datées**, au format **JJ/MM/AAAA** (convention
  projet). Les sources sont déjà disponibles au point d'appel :
  - `progress/index.tsx` (courbe muscu) — `p.date` (aujourd'hui réduit à `formatDateShort(p.date)` pour `label`) ;
  - `nutrition-stats.tsx` — `e.logDate` (poids) et `d.logDate` (apports) ;
  - `running-history/index.tsx` — `p.dayKey`.
  Réutiliser un formateur de date **existant** s'il y en a un (chercher `formatDate`/`formatDateFr` dans
  `shared` et l'app avant d'en écrire un — `deletion-pending.tsx` en a un local `formatDateFr`).
  ⚠️ **Ne pas toucher aux `label`** d'axe : ils restent abrégés.
- [ ] **Step 2 : ne rien renseigner** sur les 2 histogrammes musculaires (le libellé d'axe = nom du groupe,
  qui est déjà le bon en-tête d'infobulle).
- [ ] **Step 3 : fermeture au changement de contexte** — quand la **période** (7 j / 30 j / tout) ou la
  **métrique** (charge max / 1RM / volume) ou l'**exercice** change, l'infobulle ne doit pas pointer une
  donnée disparue. Le plus simple et le plus sûr : laisser le composant se réinitialiser sur changement de
  série (`resetPointerOnDataChange` si l'option couvre le cas ; sinon vérifier le comportement observé
  avant d'ajouter du code).
- [ ] **Step 4 : i18n** — n'ajouter **que** ce qui est nécessaire. Point ouvert de la spec (§7) : afficher
  « 18 séries » plutôt que « 18 » sur l'équilibre musculaire → si oui, passer `unit={t('progress.balance.setsUnit')}`
  au composant et ajouter la clé **FR + EN**. Sinon, **aucune clé**.
- [ ] **Step 5 : vérifier** — typecheck/lint/tests, exit codes lus **sans pipe**. Parité i18n si clés ajoutées.
- [ ] **Step 6 : commit** `feat(ux01): dates complètes dans les infobulles + fermeture au changement de contexte`

---

## Task 6 : Revue finale et clôture

- [ ] **Step 1 : suite complète, exit codes vérifiés sans pipe** :
  ```bash
  npm run typecheck; echo "TC=$?"
  npm run lint; echo "LINT=$?"
  npm run test; echo "SHARED=$?"
  cd apps/mobile && npx jest; echo "MOBILE=$?"
  ```
  Les quatre doivent afficher **0**.
- [ ] **Step 2 : parité i18n** — script de comparaison des clés FR/EN (même méthode que CONF-08) si des clés
  ont été ajoutées.
- [ ] **Step 3 : revue finale** — checklist :
  - **une seule** infobulle partagée (pas deux styles) ;
  - valeur **brute** sur les courbes lissées ;
  - allure en `M:SS` (jamais les secondes) ;
  - **aucun débordement** au premier et au dernier point, dans les 2 thèmes ;
  - rendu **inchangé** au chargement des 6 écrans ;
  - couleurs sémantiques de l'équilibre musculaire toujours distinguables ;
  - aucune chaîne en dur ; aucune conversion d'unité dans l'infobulle.
- [ ] **Step 4 : clôture** — `TODO.md` (bloc recette), `CHANGELOG.md`, **IDEAS.md** : passer l'idée du
  16/07 en **✅ promue** et la descendre dans « Archives » avec la référence de l'US (c'est la règle du
  fichier, souvent oubliée). **Roadmap : aucune ligne concernée** → étape statut sautée, à signaler.
  Push via `/commit`.

---

## Notes de test

- **Pur testé** : `formatTooltipValue` (formateur prioritaire, arrondi, `,0` supprimé, locale, sans unité,
  zéro, grande valeur).
- **Smoke** : `ChartTooltip` (2 lignes, 2 thèmes).
- **Non testable unitairement** : le geste réel sur `LineChart`/`BarChart` (touches natives + rendu SVG) →
  couvert par la **recette device** (spec §9). Ne pas chercher à simuler `pointerConfig` en Jest.
- **Non-régression à surveiller** : les smokes de graphiques existants
  (`components/charts/__tests__/charts-smoke.test.tsx`) doivent rester verts **sans modification**.

## Points d'attention

- **L'oubli le plus probable** : ne pas propager `detail` dans le `.map` de `chartData` → l'infobulle
  affiche le libellé abrégé au lieu de la date, silencieusement.
- **`items[0]` = série brute** avec le lissage : contrat à confirmer sur device et à commenter.
- **Fermeture au tap ailleurs** : seul inconnu technique. Repli assumé documenté (Task 3, Step 4) plutôt
  qu'un remontage forcé qui relancerait l'animation.
- **Ne pas réintroduire de débordement** : tout le travail de largeur mesurée (`onLayout`, `Y_AXIS_LABEL_WIDTH`,
  `END_SPACING`) existe précisément pour ça — `autoAdjustPointerLabelPosition` doit être vérifié aux deux bords.
- **Vérifier les codes de sortie sans pipe** (leçon CI du 25/07).
