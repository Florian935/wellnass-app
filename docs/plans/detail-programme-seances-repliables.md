# Détail programme — séances repliables — Plan d'implémentation

> **Pour l'exécutant :** implémenter tâche par tâche (cases `- [ ]`), TDD, commits fréquents.
> Spec : [detail-programme-seances-repliables.md](../specs/functional/us/detail-programme-seances-repliables.md).

**Goal :** rendre les cartes de séance repliables (repliées par défaut, ouverture indépendante) sur
les écrans détail programme muscu + running, et corriger le nom d'exercice tronqué (muscu).

**Architecture :** un composant présentational partagé `CollapsibleCard` encapsule l'en-tête
tappable (titre + résumé + chevron), le toggle d'expansion (état local, éphémère), le contenu
dépliable (`children`) et un `footer` toujours visible. Les deux écrans le consomment en passant
leur résumé/détail/footer propres au pilier. Aucune donnée nouvelle, lecture seule.

**Tech Stack :** React Native + Expo Router, TypeScript, i18next, jest-expo + @testing-library/react-native.

---

## Structure des fichiers

- **Créer** `apps/mobile/src/components/CollapsibleCard.tsx` — carte repliable réutilisable (UI + toggle).
- **Créer** `apps/mobile/src/components/__tests__/CollapsibleCard.test.tsx` — test unitaire du repli.
- **Modifier** `apps/mobile/src/app/programs/[id].tsx` — `SessionCard` via `CollapsibleCard` ; fix `PlanRow` 2 lignes.
- **Modifier** `apps/mobile/src/app/running-programs/[id].tsx` — `RunningSessionCard` via `CollapsibleCard`.
- **Modifier** `apps/mobile/src/i18n/locales/{fr,en}.json` — clé `programs.detail.exerciseCount`.

---

## Task 1 : clé i18n `exerciseCount` (compteur muscu)

**Files:** Modify `apps/mobile/src/i18n/locales/fr.json`, `.../en.json`.

- [ ] **Step 1** — Ajouter sous `programs.detail` la clé pluralisée. FR :
  `"exerciseCount_one": "{{count}} exercice", "exerciseCount_other": "{{count}} exercices"`.
  EN : `"exerciseCount_one": "{{count}} exercise", "exerciseCount_other": "{{count}} exercises"`.
  (i18next v23 : suffixes `_one`/`_other`.)
- [ ] **Step 2** — Vérifier la parité :
  `node -e "const f=require('./apps/mobile/src/i18n/locales/fr.json'),e=require('./apps/mobile/src/i18n/locales/en.json');const c=o=>{let n=0;(function w(x){for(const k in x){typeof x[k]==='object'&&x[k]?w(x[k]):n++}})(o);return n};console.log(c(f),c(e))"`
  Attendu : deux nombres **égaux**.
- [ ] **Step 3 — Commit** : `git commit -m "feat(i18n): clé exerciseCount (compteur séance muscu) fr+en"`.

---

## Task 2 : composant `CollapsibleCard` (TDD)

**Files:** Create `apps/mobile/src/components/CollapsibleCard.tsx` + `__tests__/CollapsibleCard.test.tsx`.

Interface :
```tsx
type CollapsibleCardProps = {
  title: string;
  summary?: string;          // résumé affiché dans l'en-tête (ex. « 5 exercices »)
  children?: React.ReactNode; // détail révélé au dépli
  footer?: React.ReactNode;   // toujours visible (ex. bouton Démarrer)
  defaultExpanded?: boolean;  // défaut false
};
```

- [ ] **Step 1 — Test qui échoue** (`CollapsibleCard.test.tsx`) :

```tsx
import { render, fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { CollapsibleCard } from '@/components/CollapsibleCard';

// (réutiliser le mock de thème des smoke tests existants si nécessaire)
describe('CollapsibleCard', () => {
  it('cache children replié, révèle au tap sur l’en-tête, garde footer visible', () => {
    render(
      <CollapsibleCard title="Séance A" summary="5 exercices"
        footer={<Text>Démarrer</Text>}>
        <Text>Détail exercice</Text>
      </CollapsibleCard>,
    );
    expect(screen.getByText('Démarrer')).toBeTruthy();       // footer toujours là
    expect(screen.queryByText('Détail exercice')).toBeNull(); // replié par défaut
    fireEvent.press(screen.getByRole('button', { name: /Séance A/ }));
    expect(screen.getByText('Détail exercice')).toBeTruthy(); // déplié
  });
});
```

- [ ] **Step 2 — Lancer, vérifier l'échec** : `npm run test --workspace @wellness/mobile -- CollapsibleCard`
  Attendu : FAIL (module introuvable).
- [ ] **Step 3 — Implémenter** `CollapsibleCard.tsx` : `useState(defaultExpanded ?? false)` ;
  en-tête `Pressable` (`accessibilityRole="button"`, `accessibilityLabel={title}`,
  `accessibilityState={{ expanded }}`) affichant `title` + `summary` + chevron
  (`Ionicons` `chevron-down` / `chevron-forward`) ; `onPress` : `LayoutAnimation.configureNext(
  LayoutAnimation.Presets.easeInEaseOut)` (dans un `try` — dégrade en toggle instantané) puis
  `setExpanded(v => !v)` ; rend `children` **uniquement si `expanded`** ; rend `footer` toujours.
  Styles alignés sur `sessionCard` existant (surface, bordure, rayon) via `useTheme`.
- [ ] **Step 4 — Lancer, vérifier le succès** : même commande → PASS.
- [ ] **Step 5 — Commit** : `git commit -m "feat(mobile): composant CollapsibleCard (carte séance repliable)"`.

---

## Task 3 : muscu — `SessionCard` repliable + fix nom tronqué

**Files:** Modify `apps/mobile/src/app/programs/[id].tsx`.

- [ ] **Step 1** — `SessionCard` : remplacer le `View` racine par
  `<CollapsibleCard title={sessionName} summary={t('programs.detail.exerciseCount', { count: session.plans.length })} footer={session.plans.length > 0 ? <Button label=… onPress={onStart} …/> : null}>` ;
  le `children` = la liste des `PlanRow` (ou le message `emptyPlans` si vide). Retirer l'ancien
  `sessionName`/wrapper redondant (désormais fournis par `CollapsibleCard`).
- [ ] **Step 2 — Fix bug #1 dans `PlanRow`** : passer en **2 lignes** — `View` colonne : nom
  (`numberOfLines={2}`, pleine largeur) sur une ligne, puis `planTargets` (`targets.join(' · ')`)
  en dessous en `textMuted`. Supprimer le `flexDirection:'row' / space-between` de `planRow` et
  le `numberOfLines={1}` du nom. Adapter les styles (`planRow`, `planName`, `planTargets`).
- [ ] **Step 3 — Vérifs** : `npm run typecheck --workspace @wellness/mobile` (0 erreur) ;
  `npm run lint` (0 erreur).
- [ ] **Step 4 — Commit** : `git commit -m "feat(mobile): séances muscu repliables + fix nom exercice tronqué"`.

---

## Task 4 : running — `RunningSessionCard` repliable (résumé type + cible)

**Files:** Modify `apps/mobile/src/app/running-programs/[id].tsx`.

- [ ] **Step 1** — Construire le **résumé d'en-tête** : `[typeLabel, targetLabel].filter(Boolean).join(' · ')`
  (ex. « Endurance · 8 km » ; partie omise si absente ; `undefined` si les deux absents).
- [ ] **Step 2** — Remplacer le `View` racine de `RunningSessionCard` par
  `<CollapsibleCard title={sessionName} summary={summary}>` avec `children` = le `chipsRow`
  (type + cible) + la ligne d'allure (`paceLabel`). **Pas de `footer`** (aucun bouton par séance).
  Retirer l'ancien `sessionName`/wrapper redondant.
- [ ] **Step 3 — Vérifs** : `npm run typecheck --workspace @wellness/mobile` + `npm run lint` (0 erreur).
- [ ] **Step 4 — Commit** : `git commit -m "feat(mobile): séances running repliables (résumé type + cible)"`.

---

## Task 5 : vérification d'ensemble

**Files:** aucun (vérification).

- [ ] **Step 1** — `npm run typecheck` (tous workspaces) : **0 erreur**.
- [ ] **Step 2** — `npm run test --workspace @wellness/mobile` : vert (dont `CollapsibleCard`).
- [ ] **Step 3** — `npm run lint` : 0 erreur.
- [ ] **Step 4** — Parité i18n fr/en (commande Task 1 Step 2) : nombres égaux.
- [ ] **Step 5** — Relire le diff (revue : offline-first respecté, aucune chaîne en dur, pas de
  régression du démarrage de séance muscu). Rien à committer si tout est déjà commité.

---

## Notes

- **Gate CLAUDE.md avant code** : ce plan + la spec + la **maquette (Claude Design)** doivent être
  **validés par Damien ou Florian**. Ne pas démarrer l'implémentation avant validation.
- **Recette device** attendue (risque visuel) : repli/dépli sur les 2 écrans, plusieurs séances
  ouvertes, nom d'exercice non tronqué, bouton Démarrer accessible en replié (muscu).
- **100 % client** : aucune migration, aucun redéploiement sync rules, aucune dépendance native
  nouvelle (`LayoutAnimation`/`Ionicons`/`reanimated` déjà présents). Pas de checkpoint 🔴.
