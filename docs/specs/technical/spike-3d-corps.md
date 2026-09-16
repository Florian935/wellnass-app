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

## Résultats obtenus **avant** le téléphone (16/09/2026)

Quatre des six inconnues sont tombées à la construction du spike. Elles sont consignées ici parce
qu'elles changent déjà la décision, indépendamment de ce que le device dira.

### ① Le plafond des 8 est réel, et il est muet — **confirmé par exécution**

Le code `WebGLMorphtargets` de r128 a été extrait du build et **exécuté** sur le maillage à
14 cibles, avec 14 poids non nuls plausibles : **8 emplacements remplis, 6 morphs ignorés sans la
moindre erreur ni alerte** (les plus faibles en valeur absolue — `prop_chest`, `prop_hips`,
`prop_arms`, `prop_calves`, `goal_back`, `goal_thighs`). Sur la variante découpée : 7/7, 3/3, 4/4,
**rien d'ignoré**.

> 🔴 **Découverte annexe, et elle est structurante** : le plafond **tombe à 4** si l'on morphe aussi
> les **normales** (`USE_MORPHNORMALS` : 4 attributs de position + 4 de normale). Or morpher les
> normales est exactement ce qu'il faut pour que l'éclairage reste juste sur une zone déformée.
> Toute solution qui veut un rendu correct divise donc le budget par deux **une seconde fois**.

### ② Le poids d'un morph est linéaire et connu

Mesuré sur fichiers, même maillage (2 885 sommets, 5 728 triangles) :

| morphs | poids | Δ |
|---:|---:|---|
| 0 | 102 Ko | — |
| 1 | 136 Ko | +34,1 Ko |
| 8 | 375 Ko | +34,1 Ko |
| 14 | 579 Ko | +34,1 Ko |

Soit **sommets × 12 octets par morph**. Les accesseurs *sparse* divisent le **disque** par 7
(14 morphs : 65 Ko au lieu de 477 Ko), mais ⚠️ **r128 envoie toujours les cibles denses en VRAM** :
le gain est disque et bundle seulement.

Projection pour un maillage réaliste (⚠️ **extrapolation**, pas une mesure) : ~1,4 Mo à 6 900
sommets, ~2,8 Mo à 13 400, ~5,1 Mo à 25 000 — en dense ; environ ÷3,5 en sparse.

### ③ Le maillage entre par le bundle DOM, en base64

`assetExts` d'Expo 57 ne contient ni `glb` ni `gltf` ni `bin`, et un asset React Native est exposé
par une URI que la WebView n'a aucune garantie de pouvoir lire. Le maillage est donc **importé dans
le composant DOM**, inliné en base64 — et surtout **pas passé en prop** : le pont est fait pour un
état de quelques centaines d'octets, pas pour 464 Ko d'asset à chaque montage. ⚠️ La voie
`assetExts` reste **non testée** ; si le spike conclut au feu vert, c'est la première chose à
instruire, parce qu'elle éviterait le surcoût du base64 (~4/3 du binaire).

### ④ Un second composant DOM **duplique** three — mesuré

`npx expo export --platform android` produit **deux** bundles DOM distincts :

| bundle | poids |
|---|---:|
| Labo (`LabScene3D.dom`) | **1 004 Ko** |
| Spike corps (`BodySpikeScene3D.dom`) | **1 468 Ko** (dont 464 Ko de maillage base64) |

Il n'y a **aucun partage** : chaque composant DOM emporte sa copie de three. Un éditeur livré
ajouterait donc ~1 Mo au bundle, en plus de ses assets. 🔴 C'est un argument sérieux pour
**fusionner les deux scènes dans un seul composant DOM paramétré** plutôt que d'en créer un second,
le jour où l'éditeur passe en production.

### ⑦ Un maillage anatomique réel pèse moins que projeté — mesuré sur la v2

La première version (2 885 sommets, tubes et coques interpénétrées) mesurait le plafond des morphs ;
elle ne ressemblait pas à un corps, et Florian l'a dit. La **v2** est anatomiquement lisible —
deltoïdes, pectoraux, abdominaux, dorsaux en V, fessiers, quadriceps, ischio-jambiers, mollets,
mains à cinq doigts, bras **soudés** au torse — pour **27 044 triangles / 13 515 sommets**.

| | v1 | v2 |
|---|---:|---:|
| triangles | 5 728 | **27 044** |
| maillage unique, 14 morphs | 172 Ko | **953 Ko** |
| découpé 7/3/4 | 175 Ko | **960 Ko** |
| base64 dans le bundle DOM | 464 Ko | **2 551 Ko** |
| bundle DOM du spike | 1 468 Ko | **3 555 Ko** |

🔴 **La projection de l'inconnue ② était pessimiste d'un facteur 3.** Elle annonçait ~2,8 Mo pour un
maillage de 13 400 sommets en dense ; le sparse le ramène à **953 Ko** — 471 Ko de morphs au lieu de
2,27 Mo. Le coût réel d'un corps crédible tient donc dans le Mo, pas dans les trois.

⚠️ Obtenu **sans aucun modèle tiers** : le corps est un champ de distance (~110 primitives fusionnées
en lisse) extrait par *surface nets*, généré par un script du dépôt (`scripts/spike3d/v2/`). Aucune
question de licence, et le maillage est **régénérable et ajustable** — la finesse de grille est un
paramètre. Vérifié : 0 face retournée, 0 dégénérée à toutes les valeurs extrêmes et aux
combinaisons, maillage fermé, jonctions du découpé exactes (78 et 138 sommets partagés, 0 normale
divergente).

⚠️ Ce qui reste faible, et qui est assumé : la **tête** est un ovale avec nez et oreilles, sans
menton ni yeux ; le style est « argile lisse » — les muscles se lisent en **volumes**, pas en fibres
ni en insertions. C'est une figurine anatomique stylisée, pas un écorché. Pour une app de muscu,
c'est probablement le bon niveau ; c'est à trancher sur image, pas au jugé.

### Ce qu'il reste au téléphone, et à lui seul

Les inconnues **⑤ fps / chauffe** et **⑥ conflit rotation ↔ défilement**, plus la **confirmation
visuelle** de ① : voir de ses yeux 6 zones rester immobiles en maillage unique, et les 14 répondre
en découpé — ainsi que l'état réel des **jonctions** entre les trois maillages.

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

## Deux décisions prises en construisant le spike

**Une proportion signée = UNE cible de morph, avec une influence négative** — et non deux cibles
opposées. Vérifié dans r128 : ni le tri des influences ni le shader n'écrêtent les valeurs
négatives, et une mise à l'échelle radiale étant linéaire, `-1` donne exactement l'inverse de `+1`.
Deux cibles par proportion porteraient le total à **21**, feraient compter les sept « moins » dans
les huit emplacements, et coûteraient 7 × 34 Ko. ⚠️ Le prix : la déformation devient **symétrique**
(maigre = miroir de large), ce qui est une approximation anatomique. Un paramètre qui devrait être
asymétrique pourra repasser à deux cibles au cas par cas — au prix d'un emplacement.

**Les anneaux de jonction du maillage découpé sont immobiles pour les 14 morphs.** C'est ce qui
permet à chaque partie de ne porter que ses propres cibles sans dupliquer celles qui traversent une
couture. 32 sommets partagés au cou, 32 à la taille, coordonnées **et** normales identiques.
⚠️ Ce choix engage : sur un vrai maillage, il faudra soit **placer les coutures en zone neutre**,
soit **dupliquer les morphs qui les traversent** — et les compter alors dans les deux budgets de 8.

## Ce que le spike ne dit rien de

L'esthétique, l'anatomie, la licence d'un modèle réel, l'accessibilité de l'éditeur final, la
migration de `body_visual_state`. Autant de questions réelles, mais qui ne se posent que si la
mesure passe.

**La troisième sortie n'est pas couverte** : la déformation par **squelette** (échelle non uniforme
sur des os d'épaule, de cuisse, de mollet), qui n'a aucun plafond de 8. Le maillage du spike n'a pas
d'os. Le spike ne compare donc que « monter three » et « découper ». Si les deux échouent, cette
piste reste entière et demande son propre essai.

⚠️ **Le maillage est grossier et le revendique** : coques de bras interpénétrées, pas d'UV, pas de
squelette, fessiers et mollets schématiques. À `prop_shoulders = -1`, les bras rentrent de 6,5 cm
dans le torse, et un pli apparaît à l'aine. **Ces artefacts sont ceux de l'asset de test, pas de la
technique** — ne pas les lire comme un verdict sur la 3D. Ce qu'on regarde, c'est combien de zones
bougent et à quelle vitesse, pas si le corps est beau.
