# ADR-008 — Rendre une scène 3D dans l'app : composant DOM Expo plutôt que `expo-gl` / react-three-fiber

- **Statut** : ✅ **Accepté** (Florian, 15/09/2026)
- **Date** : 15/09/2026
- **Décideurs** : Florian.
- **Lié à** : [US LABO-01](../specs/functional/us/labo01-labo.md) · roadmap 7.30 ·
  [ADR-007 — Surfaçage des analyses](./ADR-007-surfacage-analyses.md) ·
  [offline-sync.md](../specs/technical/offline-sync.md) (décision B, offline-first).

---

## Contexte

Le Labo a besoin d'une **image centrale** : trois disques matiérés (pile de fonte, piste
d'athlétisme, assiette compartimentée) posés sur un podium, avec des lampes-nuits, des médailles de
croisement, une lumière de salle et une post-production. Cette scène a été **prototypée, itérée
quatre fois et validée à l'écran** (15/09/2026) en **three.js r128**, hors de l'app.

La question n'est pas « faut-il de la 3D » — c'est tranché — mais **comment la faire tourner dans une
app React Native Expo** sans la réécrire.

Ce que la scène utilise, et qui pèse dans la décision :

- des **textures dessinées au canvas 2D** (le « 25 » de la pelouse, les gravures des disques, les
  chiffres du pacer, la marque du podium) ;
- une **post-production** maison : `WebGLMultisampleRenderTarget` + `HalfFloat`, halo à seuil, mélange
  personnalisé qui laisse l'alpha intact pour composer sur un fond transparent, tonalité filmique
  ACES dans un shader de composition ;
- un environnement **PMREM** de studio, des `InstancedMesh`, des `LatheGeometry` dont l'orientation
  du profil a demandé une correction (normales rentrantes → aspect « gâteau »).

## Options

### A — Réécrire en `expo-gl` + `expo-three`

Le chemin « natif ». Mais `expo-gl` n'expose **pas de canvas 2D** : toutes les textures dessinées
seraient à refaire (atlas d'images, ou rendu de texte via une bibliothèque tierce), l'éclairage
serait à recalibrer, et la chaîne de post-production à reprendre. Beaucoup de travail pour rendre
**moins** que ce qui marche déjà, et une seconde version de la scène à maintenir en face du
prototype.

### B — Réécrire en `react-three-fiber` (+ `expo-gl`)

Même problème de fond qu'en A (c'est `expo-gl` en dessous), plus une réécriture complète en JSX
déclaratif d'une scène écrite impérativement, avec des animations qui pilotent directement les
matériaux.

### C — WebView + page HTML distante

Écarté d'emblée : l'app est **offline-first** (décision B). Une scène qui a besoin du réseau pour
s'afficher ne s'afficherait pas au bon moment.

### D — **Composant DOM Expo** (`'use dom'`) — retenu

Expo SDK 53+ permet de marquer un composant React `'use dom'` : il est **bundlé à part** et rendu
dans une WebView locale par `@expo/dom-webview` (déjà présent, dépendance transitive d'`expo` 57 —
aucun `react-native-webview` à ajouter). Les props traversent un pont : elles doivent être
**sérialisables**, et les fonctions passées deviennent asynchrones.

## Décision

**La scène 3D du Labo est un composant DOM Expo** (`LabScene3D.dom.tsx`), qui charge le moteur
three.js **à l'identique du prototype validé**.

## Conséquences

### Positives

- La scène validée est livrée **telle quelle** : ce que Florian a vu est ce qui est dans l'app.
- **Tout part avec le bundle**, donc hors ligne : le smoke-test `expo export --platform android`
  produit bien `www.bundle/<hash>.html` + son JS (≈ 1 Mo, three compris) à côté du bundle Hermes.
- Le moteur reste en **JavaScript** : c'est un portage relu, pas du code neuf ; le retyper en
  TypeScript strict l'aurait réécrit ligne à ligne sans gain de sûreté, puisqu'il ne tourne que dans
  la WebView et que son contrat public est typé côté appelant.

### Contraintes, et comment on les tient

| Contrainte | Ce qu'on fait |
|---|---|
| L'état doit être **sérialisable** | Il est fabriqué par des mappers purs (`scene-state.ts`), et un test vérifie que `JSON.parse(JSON.stringify(state))` est identique — une fonction ou un `undefined` traverserait le pont **sans erreur** et sans valeur. |
| La scène n'est pas testable sous Jest | Tout ce qu'elle *décide* en a été sorti ; `**/*.dom.tsx` est exclu de la couverture, avec la raison écrite dans `jest.config.js`. |
| Une WebView dans une liste qui défile **vole les gestes** | La scène est de **hauteur fixe**, le corps défile dessous. |
| WebGL peut manquer ou lâcher | La scène dit `ok: false` et l'écran bascule sur un repli **2D** (`react-native-svg`). |
| Une WebView n'hérite ni du thème ni de la langue | L'app lui **pousse** son fond (`background`) et **tous ses textes** (`setLabels`) : aucune chaîne en dur dans le moteur. |
| Poids du bundle | ≈ 1 Mo compressible pour three + le moteur, chargé **seulement** quand l'onglet Labo est ouvert. |

### Portée

Cette décision vaut pour **cette scène**. Elle ne dit pas que toute 3D future doit passer par un
composant DOM : une scène écrite pour l'app dès le départ, sans canvas 2D ni post-production, n'aurait
pas les mêmes contraintes et mériterait qu'on repose la question.
