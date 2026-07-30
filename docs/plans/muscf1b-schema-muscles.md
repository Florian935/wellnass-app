# Plan — MUSC-F1b · Muscles ciblés sur schéma corporel

Spec : [muscf1b-schema-muscles.md](../specs/functional/us/muscf1b-schema-muscles.md) · branche
`feature/muscf1b-schema-muscles` · roadmap **6.2**.

> ⛔ **Ne rien démarrer avant l'arbitrage voie A / voie B** (spec §0). Dessiner avant de savoir quelle
> granularité on assume, c'est garantir de tout redessiner. Ce plan couvre la **voie A**.

## Ordre de build

### Étape 1 — Les tracés, seuls et sans données *(≈ 3 h)*

`apps/mobile/src/components/body/BodyMap.tsx` — un composant **muet** : il reçoit
`Record<MuscleGroup, number>` (0 = neutre, 1 = plein) et dessine. Aucun accès repository.

- 12 `<Path>` dans un `viewBox` unique, deux silhouettes côte à côte (face + dos, R4).
- Coordonnées en dur, écrites à la main. **Pas d'asset importé** (licence + granularité, spec §3).
- Développer avec une page de démo qui allume les 6 groupes un par un — c'est la seule façon de voir
  qu'un tracé déborde.
- ⚠️ Rester **franchement stylisé**. Le critère de recette n°11 échoue si le dessin ressemble à une
  planche d'anatomie : plus c'est détaillé, plus le décalage avec 6 groupes se voit.

### Étape 2 — Le calcul d'intensité, pur et testé *(≈ 2 h)*

`packages/shared/src/body-map.ts` :

- `groupsFromExercise(primary, secondary)` → primaire 1, secondaires 0,35 (R1).
- `groupsFromSession(exercises[])` → union, **max** et non somme : deux exercices de pectoraux
  n'allument pas « plus que plein ».
- `groupsFromWeek(tonnagePerGroup)` → normalisation **relative au max de la semaine** (R3).
- **Tests** : semaine vide → tous à 0, **aucune division par zéro** (critère 5) ; un seul groupe
  travaillé → il vaut 1 ; primaire présent aussi en secondaire → reste 1 (l'invariant
  `normalizeSecondaryMuscles` l'exclut déjà, mais le calcul ne doit pas en dépendre).

### Étape 3 — Les trois points de montage *(≈ 2 h)*

Fiche d'exercice → aperçu de séance → bilan hebdomadaire. Dans cet ordre : le premier est le plus
simple et valide le composant avant de le brancher sur des agrégats.

- La **liste textuelle des groupes reste affichée** partout (R5) — ne pas la remplacer par le schéma.
- `accessibilityLabel` sur le SVG, `accessible={false}` sur les tracés internes.

### Étape 4 — Solde *(≈ 30 min)*

Roadmap 6.2 → ✅ · retrait du BACKLOG · CHANGELOG + `etat.mjs` via `/commit`.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `apps/mobile/src/components/body/BodyMap.tsx` | **nouveau** — les 12 tracés |
| `packages/shared/src/body-map.ts` + `.test.ts` | **nouveau** — calcul pur |
| fiche d'exercice · aperçu de séance · bilan hebdo | 3 points de montage |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | 2 clés d'accessibilité |

## Migration / sync rules

**Aucune, en voie A** — c'est l'argument principal en sa faveur. En voie B : nouvelle table de
muscles fins, re-tag de toute la bibliothèque, **et sync rules à redéployer**.

## Dépendances

`react-native-svg` **déjà présent**. Aucun paquet nouveau → **recettable sur l'APK existant**.

## Risques

- 🔴 **Le décalage entre le dessin et la donnée** (spec §0) : seul un arbitrage préalable l'évite.
- 🟠 **Contraste** du remplissage sur la silhouette (3:1, non textuel) — à vérifier contre la palette
  **issue de CONF-07**, sinon la vérification sera à refaire.
- 🟢 Aucun risque de données : rien n'est écrit, tout est dérivé.
