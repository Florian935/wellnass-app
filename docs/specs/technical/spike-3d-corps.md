# Spike — la silhouette corporelle en 3D temps réel

- **Date** : 16/09/2026
- **Demandé par** : Florian
- **Nature** : **spike technique jetable**, pas une fonctionnalité. Aucune spec produit, aucune
  maquette, aucune entrée de roadmap. Le code livré ici est fait pour être **supprimé** — d'un seul
  `git revert` — dès que la mesure est faite.
- **Lié à** : [ADR-008](../../adr/ADR-008-scene-3d-composant-dom.md) · [CORPS-02](../functional/us/corps02-morphologie.md)
  · [analyse Mon corps §6](../../product/analyse-mon-corps-2026-09.md)

---

## Pourquoi un spike, et pas directement une US

L'[analyse Mon corps](../../product/analyse-mon-corps-2026-09.md) (§6) recommandait « source 3D,
affichage 2D d'abord, 3D dans l'éditeur ensuite », en supposant la 3D temps réel coûteuse à
intégrer. Cette prémisse a changé le **15/09/2026** : LABO-01 a livré une scène three.js r128 qui
tourne dans l'app via un composant DOM Expo, avec rotation au doigt et sélection par raycast. Le
coût d'intégration est donc **déjà payé**.

Mais ce qui a été démontré, c'est qu'une **scène décorative interactive** tient. Un **éditeur** est
autre chose : il déforme un maillage en temps réel depuis 14 curseurs. Entre les deux, six
inconnues, dont **aucune n'est levée aujourd'hui** — et l'une d'elles est un mur connu.

Cadrer une US maintenant reviendrait à spécifier un écran dont on ignore s'il peut exister. Le
spike coûte 4 à 6 jours ; se tromper de lot en coûte 30.

## Le mur, d'abord

`node_modules/three/build/three.js` (r128), autour de la ligne 11654 :

```js
const morphInfluences = new Float32Array( 8 );
for ( let i = 0; i < 8; i ++ ) { workInfluences[ i ] = [ i, 0 ]; }
...
influences.sort( absNumericalSort );   // garde les 8 plus fortes, met les autres à zéro
```

**three r128 n'applique que 8 influences de morph simultanées par maillage.** Au-delà, il trie par
influence absolue et **ignore le reste sans lever d'erreur** : le corps est simplement faux, en
silence.

Or [CORPS-02](../functional/us/corps02-morphologie.md) définit **7 proportions** (`shoulders`,
`chest`, `waist`, `hips`, `arms`, `thighs`, `calves`, chacune dans `[-2, +2]`) et **7 intentions**
(`shoulders`, `chest`, `back`, `arms`, `glutes`, `thighs`, `calves`, chacune dans `[0, 4]`). Soit
**14 paramètres**, tous non nuls en même temps dans le cas normal.

14 > 8. Ce n'est pas un réglage, c'est une contrainte d'architecture.

## Les six inconnues, et ce que chacune décide

| # | Inconnue | Ce que la réponse décide |
|---|---|---|
| 1 | **Le plafond des 8 morphs** est-il rédhibitoire, ou un découpage en 3 maillages tient-il les jonctions ? | Si le découpage tient : on reste en r128, ADR-008 intact. Sinon il faut **monter three**, ce qui touche le moteur du Labo et **rouvre l'ADR** — décision, pas détail. |
| 2 | **Combien pèse** un `.glb` morphé, et combien l'APK prend-il ? | Chiffre inexistant aujourd'hui. Au-delà d'un certain poids, la 3D embarquée n'est plus défendable face au rendu 2D précalculé. |
| 3 | **Comment le maillage entre-t-il** dans la WebView ? | Vérifié : `assetExts` d'Expo 57 ne contient ni `glb` ni `gltf` ni `bin`. Aujourd'hui **aucune voie n'est ouverte**. Soit on étend `assetExts`, soit on inline en base64 dans le bundle DOM. |
| 4 | Un **second composant DOM** duplique-t-il `three` dans le bundle ? | +0 ou +1 Mo. Personne ne sait. |
| 5 | Quel **fps et quelle chauffe** sur un Android modeste, morphs actifs ? | C'est le critère d'arrêt. Une silhouette qui saccade sous le doigt ne se livre pas. |
| 6 | Le **conflit rotation ↔ défilement** se règle-t-il autrement qu'en figeant la hauteur ? | Contraint la **maquette**, donc doit être connu avant le design, pas après. |

## Ce que le spike construit

Un écran de debug, volontairement moche, atteignable mais hors du produit :

- un maillage humanoïde jetable, généré par le calcul (aucun asset tiers, donc aucune question de
  licence à ce stade) ;
- **deux variantes** : un maillage unique portant les 14 morphs — le cas qui doit déclencher le
  plafond — et une version découpée en trois maillages de ≤ 8 morphs, jonctions comprises ;
- 14 curseurs bruts, un par paramètre, plus un basculement entre les deux variantes ;
- une **instrumentation visible à l'écran** : fps, temps d'ouverture, nombre de morphs réellement
  appliqués, poids chargé.

Rien d'autre. Pas de direction artistique, pas de post-production, pas de persistance, pas de
lecture de `body_visual_state`. Un écran laid qui donne six chiffres.

## Protocole de mesure sur téléphone

À jouer sur l'appareil Android de référence, APK de release installé, **hors ligne**.

1. Ouvrir l'écran de debug. Noter le **temps d'ouverture** annoncé.
2. Variante « maillage unique, 14 morphs ». Pousser les 14 curseurs à une valeur non nulle.
   **Compter les zones qui bougent réellement.** Si seules 8 répondent, le plafond est confirmé à
   l'œil, et l'inconnue 1 est tranchée.
3. Même manœuvre sur la variante découpée. Vérifier que les 14 répondent **et** regarder les
   jonctions cou / taille / hanches : trou, décrochement, arête visible ?
4. Faire tourner la silhouette au doigt pendant qu'un curseur bouge. Noter le **fps**.
5. Ouvrir et quitter l'écran **dix fois**. Le fps se dégrade-t-il ? Le téléphone chauffe-t-il ?
6. Placer l'écran dans une vue qui défile et tenter la rotation : le geste part-il à la scène ou au
   défilement ?

## Critères de décision

- **fps ≥ 30 pendant le glissé, sur la variante découpée, sans dégradation après dix ouvertures**
  → la 3D temps réel dans l'éditeur est retenue, on cadre l'US.
- **Jonctions visiblement cassées et non corrigeables simplement** → on tranche entre monter three
  (et rouvrir l'ADR-008) et la déformation par os.
- **fps insuffisant, ou poids d'asset disproportionné** → retour à l'option « source 3D + rendu 2D
  précalculé » du §6 de l'analyse, et le 2D SVG existant reste la seule chose livrée.

## Ce que le spike ne dit rien de

L'esthétique, l'anatomie, la licence d'un modèle réel, l'accessibilité de l'éditeur final, la
migration de `body_visual_state`. Autant de questions réelles, mais qui ne se posent que si la
mesure passe.
