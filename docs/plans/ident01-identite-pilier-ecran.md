# Plan — IDENT-01 · L'identité de pilier appartient à l'écran, pas à l'onglet

Spec : [ident01-identite-pilier-ecran.md](../specs/functional/us/ident01-identite-pilier-ecran.md) ·
23/10/2026 · branche `fix/ident01-identite-pilier-ecran` (worktree `.expo/claude-worktrees/ident-01`,
créé depuis `origin/dev` à `d604dec2`). Poussé par `git fetch origin` → `git rebase origin/dev` →
`git push origin HEAD:dev`, jamais de `checkout dev`, jamais de force.

✅ **Validé par Florian le 23/10/2026** avec la spec (D1 à D12 telles que proposées). Écrit sur les
propositions de la spec : **D1** (le contenu décide, jamais la porte), **D2** (Corps = Musculation), **D3** (Mensurations = Musculation),
**D4** (profils et Réglages › Séance = leur pilier), **D5** (Autres activités transverses), **D6**
(transverses sans déclaration), **D7** (seul un onglet pose `focusedMenu`), **D8** (déclaration au
montage, pile avec legs), **D9** (garde exhaustif), **D10** (Bien-être et Labo → IDENT-02), **D11**
(la redirection déclare), **D12** (retrait du `StatusBar` forcé de l'onglet Labo). Une autre réponse
change le plan ainsi :

- **D5 Nutrition** : `activities.tsx` et `activity.tsx` passent de `SANS_PILIER` à la table
  Nutrition, +2 lignes à l'étape 4.
- **D6 « home »** : 15 écrans transverses gagnent `useMenuFocus('home')` (étape 4 bis), dont
  `settings.tsx` et `review.tsx`, que touche aussi ACCES-IA → rebase attendu avec conflit.
- **D7 non** : l'étape 1 ne garde que D8 ; le défaut de barre d'état et de boucles s'étend aux deux
  piliers — à noter au BACKLOG.
- **D8 non** : l'étape 1 ne garde que D7 ; les écrans transverses, Bien-être et Labo changent de
  couleur au retour d'un écran qui déclare (régression connue, à noter au BACKLOG).
- **D12 non** : l'étape 5 ne touche pas `lab.tsx` ; BARRE-01 au BACKLOG mentionne l'onglet Labo.
- **D2 / D3 transverses** : les fichiers concernés passent dans `SANS_PILIER`, −4 ou −1 ligne.

**Aucune migration, aucune sync rule, aucun `db:types`, aucune dépendance, aucun déploiement, aucun
build** (spec §12). Aucune action sur le cloud. **Pas de RECETTES.md ni d'étape `recette`** (règle du
23/10/2026) : l'US passe de `code` à `close` dans le commit qui livre.

## Ordre de build

Un lot, six étapes. Chacune laisse `npm run typecheck`, `npm run lint` et `npm run test` verts (code de
sortie lu **sans pipe**), sauf les tests écrits rouges exprès, qui le sont à la fin de leur étape.
Commit unique ou un par étape, au choix de Florian (CLAV-01 : un seul, à sa demande).

| # | Étape | Fichiers | Tests |
|---|---|---|---|
| 0 | `npm install` dans le worktree (Node 24), base verte | — | typecheck, lint, suite : état de départ noté |
| 1 | **Le hook** : filet, règles rouges, puis D7 + D8 | `useMenuFocus.ts`, 2 tests | 3 cas filet verts → cas D7/D8 rouges → tous verts |
| 2 | **Le garde** exhaustif | `pillar-identity.test.ts` | 32 échecs nommés, le reste vert |
| 3 | **Musculation** : 22 écrans + mocks de tests | 22 écrans, 16 tests | garde vert pour `strength` |
| 4 | **Nutrition** : 10 écrans + mocks de tests | 10 écrans, 10 tests | garde entièrement vert |
| 5 | Commentaires réalignés ; D12 | `menu-accent-store.ts`, `useTheme.ts`, `lab.tsx` | — |
| 6 | Vérification finale, docs, push | suivi | suite complète |

## Étape 0 — base

`npm install` à la racine du worktree (Node 24). Puis `npm run typecheck`, `npm run lint`,
`npm run test` : on note le nombre de tests verts de départ, pour comparer à la fin. Si la base n'est
pas verte, on s'arrête et on le signale — ce n'est pas à IDENT-01 de le réparer.

## Étape 1 — le hook (D7, D8)

**Tests d'abord** — `hooks/__tests__/useMenuFocus.test.tsx` (neuf). Mock d'`expo-router` :
`useFocusEffect` **capture** l'effet sans l'exécuter pendant le rendu (on l'appelle après
`renderHook`, comme le fait le vrai fork d'`expo-router`, qui attend un rendu de plus) ;
`useNavigation` renvoie `{ getState: () => ({ type }) }` avec `type` réglable par test. Les
démontages passent par `unmount()` de `renderHook` ; pour « deux écrans fermés d'un coup », deux
hooks rendus dans un même arbre et retirés ensemble (un composant parent qui cesse de rendre ses deux
enfants), pour obtenir l'ordre réel de React — de bas en haut.

| Cas | Attendu | Sur le code d'aujourd'hui |
|---|---|---|
| F1 onglet — focus | `activeMenu` et `focusedMenu` = le menu | vert (filet) |
| F2 onglet — perte de focus | `focusedMenu` libéré, `activeMenu` gardé | vert (filet) |
| F3 onglet — focus repris par un autre onglet entre-temps | la perte de focus ne le libère pas | vert (filet) |
| E1 empilé — montage, **avant** tout focus | `activeMenu` = le menu | **rouge** |
| E2 empilé — focus | `focusedMenu` **inchangé**, quelle que soit sa valeur | **rouge** |
| E3 empilé — démontage, seul | `activeMenu` revient à l'identité trouvée au montage | **rouge** |
| E4 remplacement — A démonté et B monté dans la même mise à jour | B trouve l'identité qu'A avait trouvée ; démonter B la rend | **rouge** |
| E5 deux empilés démontés ensemble (bas puis haut) | `activeMenu` = l'identité trouvée par le plus bas | **rouge** |
| E6 un empilé retiré sous un autre | `activeMenu` inchangé ; démonter ensuite celui du dessus rend l'identité trouvée par celui du dessous | **rouge** |
| E7 onglet — démontage | `activeMenu` inchangé, la pile n'est pas touchée | vert |

`useLoopActive.test.tsx` : son mock d'`expo-router` gagne
`useNavigation: () => ({ getState: () => ({ type: 'tab' }) })` — son test de `useMenuFocus` décrit un
onglet.

**Puis le hook** — `hooks/useMenuFocus.ts` (esquisse, noms définitifs à l'écriture) :

```ts
/** D8 — les écrans empilés qui se déclarent, du plus bas au plus haut, et l'identité trouvée par chacun. */
const pile: { menu: MenuKey; trouvee: MenuKey }[] = [];

export function useMenuFocus(menu: MenuKey): void {
  const navigation = useNavigation();

  // D8 — avant la première image : retenir l'identité trouvée, poser la sienne. Au démontage, la rendre
  // si l'écran est au sommet, sinon la léguer à l'écran juste au-dessus (React démonte de bas en haut).
  useLayoutEffect(() => {
    if (navigation.getState()?.type === 'tab') return;
    const store = useMenuAccent.getState();
    const entree = { menu, trouvee: store.activeMenu };
    pile.push(entree);
    store.setActiveMenu(menu);
    return () => {
      const i = pile.indexOf(entree);
      if (i === -1) return;
      pile.splice(i, 1);
      if (i < pile.length) pile[i]!.trouvee = entree.trouvee;
      else useMenuAccent.getState().setActiveMenu(entree.trouvee);
    };
  }, [navigation, menu]);

  useFocusEffect(
    useCallback(() => {
      const store = useMenuAccent.getState();
      store.setActiveMenu(menu);
      // D7 — seul un onglet est « au premier plan » (DASH-01 R4).
      if (navigation.getState()?.type !== 'tab') return;
      store.setFocusedMenu(menu);
      return () => useMenuAccent.getState().clearFocusedMenu(menu);
    }, [navigation, menu]),
  );
}
```

Points tenus par l'esquisse : `getState()` n'est lu que dans les effets (react-navigation déconseille
de le lire au rendu) ; la déclaration et la lecture de l'identité trouvée sont dans un effet de mise en
page, donc dans un remplacement le nettoyage du remplacé (phase de mutation) passe avant le montage du
remplaçant (phase de mise en page) ; la redéclaration au focus reste, pour les onglets et pour un
écran empilé retrouvé. L'en-tête du hook est réécrit : les trois comportements du §4 de la spec, et
**pourquoi** — le fork `useFocusEffect` d'`expo-router` qui déclare un rendu trop tard, l'ordre
« démontage avant montage » de React, l'ordre « de bas en haut » des démontages frères.

Vérifié dans le code installé : `TabRouter` pose `type: 'tab'`, `StackRouter` `type: 'stack'`, et
`(tabs)/_layout.tsx` utilise le `Tabs` d'`expo-router` (onglets du bas).

⚠️ Les tests d'onglet et des écrans Course **mockent le hook entier** : ils ne voient pas la
différence, et c'est voulu — le comportement vit dans les tests du hook.

## Étape 2 — le garde exhaustif (D9, D10, D11)

`app/__tests__/pillar-identity.test.ts` — l'en-tête « portée volontairement limitée au pilier Course »
est remplacé par l'historique (CARDIO-UX02 → IDENT-01) et la règle D1.

- **`PILIERS`** (dossiers) : + `exercises`, `templates`, `programs`, `history`, `progress` →
  `strength` ; + `meal-plan` → `nutrition`.
- **`FICHIERS`** : + `workout`, `workout-brief`, `workout-summary`, `session-preview`, `exercises`,
  `strength-lifts`, `strength-profile`, `settings-session`, `body`, `body-shape`, `body-training`,
  `body-training-programs`, `measurements` → `strength` ; + `food-picker`, `food-custom`,
  `food-scan`, `meal-quick-entry`, `nutrition-day`, `nutrition-meals`, `nutrition-profile`,
  `nutrition-stats`, `recipe-edit` → `nutrition`.
- **`SANS_PILIER`** (neuf), chemin → raison :
  `planning` (dossier), `goals`, `insights`, `review`, `activities`, `activity`, `steps`, `settings`,
  `profile`, `help`, `account-delete`, `deletion-pending`, `password-reset`, `ai-lab` → « transverse —
  hérite de l'écran qui l'ouvre (D6) » ; `wellbeing`, `wellbeing-settings`, `pain`, `cycle` (dossier),
  `lab-link` → « IDENT-02 — Bien-être / Labo, hors périmètre (D10) » ; `spike-corps-3d`, `spike-vbt`
  → « spike, hors produit (LANCE-02) ».

Tests :

1. chaque écran des tables déclare `useMenuFocus('<pilier>')` — la boucle existante ;
2. **neuf** — chaque fichier d'écran de `app/` hors `(auth)`, `(onboarding)`, `(tabs)`, `_layout.tsx`
   et `__tests__` est classé **une et une seule fois** ; message d'échec : « nouvel écran non classé :
   déclare son pilier, ou ajoute-le à `SANS_PILIER` avec la raison » ;
3. **neuf** — un écran `SANS_PILIER` n'appelle **pas** `useMenuFocus` (sinon : le ranger dans sa
   table) ;
4. les **six onglets** déclarent leur menu (remplace le test du seul onglet Course) — le hook en
   dépend pour D7 ;
5. le garde-fou du garde-fou devient : **chaque** entrée de `PILIERS` trouve au moins un écran, et le
   classement compte **66** fichiers au moins (un renommage de dossier ne peut plus vider une
   boucle en silence).

Fin d'étape : **32 échecs**, un par écran à corriger, nommés ; tout le reste vert.

## Étape 3 — Musculation (22 écrans)

Dans chaque fichier : `import { useMenuFocus } from '@/hooks/useMenuFocus';` à sa place dans les
imports `@/hooks`, puis `useMenuFocus('strength');` en **première ligne** du composant exporté par
défaut — avant tout retour anticipé, comme dans `session-preview.tsx` et les écrans Course. Rien
d'autre (R6).

`workout.tsx` · `workout-brief.tsx` · `workout-summary.tsx` · `exercises.tsx` · `exercises/[id].tsx` ·
`templates/index.tsx` · `templates/[id].tsx` · `templates/edit.tsx` · `programs/index.tsx` ·
`programs/[id].tsx` · `programs/edit.tsx` · `history/index.tsx` (redirection, D11) ·
`history/[id].tsx` · `progress/index.tsx` · `strength-lifts.tsx` · `strength-profile.tsx` ·
`settings-session.tsx` · `body.tsx` · `body-shape.tsx` · `body-training.tsx` ·
`body-training-programs.tsx` · `measurements.tsx`.

Tests d'écran dont le mock d'`expo-router` n'expose pas `useFocusEffect` ou `useNavigation` — ajout de
`jest.mock('@/hooks/useMenuFocus', () => ({ useMenuFocus: jest.fn() }));` avec le commentaire de
CARDIO-UX02 :
`workout-screen`, `workout-summary-screen`, `exercises-screen`, `exercise-detail-smoke`,
`template-detail-screen`, `programs-screen`, `program-detail-screen`, `program-edit-screen`,
`history-screen`, `workout-detail-screen`, `progress-screen`, `body-screen`, `body-shape-screen`,
`body-training-screen`, `body-training-programs-screen`, `measurements-screen`. La liste exacte est
celle que la suite rend rouge : on n'ajoute pas de mock à un test qui passe.

## Étape 4 — Nutrition (10 écrans)

Même geste, `useMenuFocus('nutrition')` :
`food-picker.tsx` · `food-custom.tsx` · `food-scan.tsx` · `meal-quick-entry.tsx` ·
`meal-plan/index.tsx` · `meal-plan/shopping.tsx` · `nutrition-meals.tsx` · `nutrition-profile.tsx` ·
`nutrition-stats.tsx` · `recipe-edit.tsx`.

Tests : `food-picker-screen`, `food-custom-screen`, `food-scan-screen`, `meal-quick-entry-screen`,
`meal-plan-screen`, `meal-plan-targets`, `shopping-screen`, `nutrition-meals-hydration`,
`nutrition-profile-screen`, `nutrition-stats-screen` — même règle : seulement ceux que la suite rend
rouges.

Fin d'étape : garde entièrement vert.

## Étape 5 — commentaires, et D12

`stores/menu-accent-store.ts` (`activeMenu` « piloté par le focus des onglets ») et
`theme/useTheme.ts` (« les écrans empilés au-dessus d'un onglet héritent du pilier… toute la branche
muscu reste en muscu ») : réécrits pour dire la règle du §4. **Aucune ligne de code** n'y change.

**Si D12** : `app/(tabs)/lab.tsx` perd `<StatusBar style="light" />` et son import, avec une ligne de
commentaire qui renvoie à `(tabs)/_layout.tsx`. `lab-screen.test.tsx` est relu : s'il vérifie la barre
d'état, son attendu change à cette étape et seulement là.

## Étape 6 — vérification, docs, push

1. `npm run typecheck`, `npm run lint`, `npm run test` — code de sortie lu **sans pipe** ; comparer au
   nombre de départ (+ les tests du hook et du garde).
2. Spec : `etape: close`, bandeau « codée le … » ; écarts au plan en fin de ce plan.
3. **Roadmap** 3.63 et 4.46 : une phrase chacune (IDENT-01, livrée) ; le Récapitulatif ne bouge pas
   (lignes déjà ✅).
4. **BACKLOG** : IDENT-02, BARRE-01 et VIE-02 sont déjà posés au cadrage ; retirer de BARRE-01 la
   mention de l'onglet Labo si D12 est livrée.
5. `/commit` : CHANGELOG, ETAT, puis `git fetch origin` → `git rebase origin/dev` →
   `git push origin HEAD:dev`. Aux conflits sur CHANGELOG, roadmap, BACKLOG ou ETAT : garder les deux
   côtés, recompter le Récapitulatif, régénérer ETAT. **Ne jamais recréer RECETTES.md.**

## Sessions parallèles (23/10/2026)

- **ACCES-IA** peut toucher `meal-quick-entry.tsx` (recours Prisme) : IDENT-01 n'y ajoute qu'un import
  et une ligne. `settings.tsx` et `review.tsx` ne sont **pas** touchés (D6).
- **CARDIO-02** peut ajouter un écran Course : après rebase, le test d'exhaustivité le signalera — on
  le range dans la table `running` (une ligne de test, aucun fichier Course modifié par IDENT-01).
- **CARDIO-08** (`run/analysis.tsx`) et **CIBLE-04** (`lab-repository.ts`) : aucun fichier commun.
  `lab.tsx` (D12) n'est touché par aucune des quatre autres sessions d'après leurs périmètres.
- Tout nouvel écran poussé sur `dev` entre-temps : même traitement que CARDIO-02 — le classer, sans
  toucher à son fichier s'il n'est ni Musculation ni Nutrition.

## Ce que le plan ne fait pas

- Aucun écran Course, transverse, Bien-être ou Labo empilé n'est modifié.
- Aucune couleur écrite en dur n'est corrigée (spec §13).
- La barre d'état des écrans à fond sombre fixe (séance immersive, brief) n'est pas traitée (BARRE-01).
- Pas de test d'intégration de navigation (monter un vrai `Stack` + `Tabs` demanderait PowerSync,
  l'auth et les polices pour vérifier un ordre d'effets) : l'ordre est établi par lecture du code
  installé (spec §1.3), le comportement par les tests du hook, la couverture par le garde.

## Écarts au plan

*(à remplir à l'implémentation)*
