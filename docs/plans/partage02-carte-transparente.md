# Plan — PARTAGE-02 · La carte de partage transparente

Spec : [partage02-carte-transparente.md](../specs/functional/us/partage02-carte-transparente.md) ·
Maquette : <https://claude.ai/artifact/Fp7sCrnKZ3YbVink6RBt5U> (planche 5, et onglet *Partage* de la
planche 10) · Analyse : [analyse-strava-2026-09.md](../product/analyse-strava-2026-09.md) §7.6.

Travail **directement sur `dev`**. **Aucune migration, aucune sync rule, aucune dépendance native
nouvelle.** Indépendant d'EFFORT-01 : les deux peuvent avancer en parallèle.

## Ordre de build

1. **Le risque d'abord.** L'alpha traverse-t-il `captureRef` sur Android ? Tant que ce n'est pas
   vérifié **sur appareil**, tout le reste est du travail à l'aveugle (spec R12, D5).
2. La variante dans le composant.
3. Le sélecteur et l'aperçu.
4. L'i18n et les tests.

⚠️ L'ordre est délibérément inverse du confort : l'étape 1 est la moins agréable et la plus courte,
mais c'est **la seule qui peut annuler l'US**. La faire en dernier serait la faire trop tard.

---

## Étape 1 — l'essai d'alpha (avant toute autre ligne)

Un écran jetable, ou le spike le plus court possible : rendre un `<View>` à fond `transparent`
contenant un texte, appeler `captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' })`, puis
**ouvrir le fichier sur l'appareil** et le coller sur une photo claire.

Trois issues :
- **l'alpha passe** → on continue ;
- **l'alpha est aplati en noir** → tenter l'option de fond transparent explicite de
  `react-native-view-shot` ; si ça ne suffit pas ;
- **rien ne marche** → **on retire la variante** (spec D5) et l'US s'arrête là, honnêtement.

🔴 Cet essai se fait **sur un vrai téléphone**, pas en émulateur : c'est le compositeur de fenêtre
Android qui est en cause, et il ne se comporte pas pareil.

---

## Étape 2 — la variante dans `ShareCard`

`apps/mobile/src/components/share/ShareCard.tsx` gagne une prop `variant: 'full' | 'transparent'`
(défaut `'full'`).

- `variant === 'full'` → **exactement le code actuel**. Aucune ligne déplacée.
- `variant === 'transparent'` → `backgroundColor: 'transparent'`, et chaque texte + le tracé portent
  le halo (`textShadowColor` / `textShadowRadius` pour le texte, `shadowColor` sur le SVG du tracé),
  opacité ~0,55, rayon proportionnel à `size` comme le reste du composant (`s(…)`).

🔴 **Test de garde de non-régression (spec R2)** : un test de rendu vérifie que `variant: 'full'`
produit le même arbre qu'avant l'US. PARTAGE-01 est **en recette** — la recette de Florian doit
rester valable.

*Tests* : rendu `full` inchangé · rendu `transparent` sans `backgroundColor` opaque · halo présent
sur chaque nœud de texte · course sans tracé → pas de trou (spec R10).

`packages/shared` : rien à ajouter — `shareCardFileName` gagne au plus un suffixe de variante pour
que deux exports ne s'écrasent pas dans le cache. *Test* dans le paquet partagé.

---

## Étape 3 — le sélecteur et l'aperçu

`apps/mobile/src/components/share/ShareCardSheet.tsx` :

- un `useState` de variante, **non persisté** (spec R4) et remis à `'full'` à chaque ouverture ;
- deux pastilles de choix, vrais `<button>` accessibles, état sélectionné annoncé (pas seulement
  coloré) ;
- l'aperçu de la transparente est posé sur un **damier** (spec R8) — deux gris alternés, dessinés
  en fond de la zone d'aperçu, pas dans la carte ;
- la pastille **TRANSPARENT** en coin (spec R9), non traduite.

`share-card-export.ts` : la capture reçoit la variante pour nommer le fichier. Le contrat d'erreur
existant (`'unavailable' | 'failed'`) **ne change pas** (spec R11).

*Tests* : ouverture → `full` · bascule → aperçu damier · fermeture / réouverture → retour à `full` ·
les deux pastilles sont atteignables au clavier et annoncent leur état.

---

## Étape 4 — i18n

Quatre clés (spec §6) en FR **et** EN. `share.variant.transparentHint` sert de sous-titre à la
pastille — c'est elle qui explique l'usage en trois mots, et c'est la seule chose qui évite
l'incompréhension « pourquoi mon image est vide ».

---

## Les deux écrans concernés

`ShareCardSheet` est monté depuis **`run/analysis.tsx`** *et* **`workout-summary.tsx`** : la variante
arrive donc aussi sur la musculation, gratuitement. À vérifier en recette des deux côtés
(dernier critère de la spec).

## Vérification avant de déclarer fini

`npm run typecheck` · `npm run lint` · `npm run test` — **code de sortie lu sans pipe**. Puis
`node scripts/etat.mjs`.

## Ce que le plan ne fait pas

- Les **cinq autres formats** de Strava (déclinaisons de mise en page).
- Le **format 9:16** vertical : la carte est carrée, et le rester est un choix de PARTAGE-01.
- Les **destinations nommées** (Stories, WhatsApp…) : la feuille de partage de l'OS les propose
  déjà, et les recréer nous ferait afficher des marques tierces.
