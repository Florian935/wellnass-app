# Spike VBT-01 — vitesse de barre à la caméra

> **Ce document n'est pas une spec.** C'est le compte rendu d'un **essai de faisabilité**, dont la
> seule sortie est un **go / no-go**. Tant qu'il n'est pas tranché, aucune US n'est cadrée — c'est la
> règle posée par l'[analyse d'innovation §6.4](../../product/analyse-innovation-2026-09.md) le
> 13/09/2026 et reprise au [BACKLOG](../../../BACKLOG.md) (candidate VBT-01, P2).
>
> Démarré le **19/09/2026** à la demande de Florian.
>
> 🔴 **La branche `spike/vbt01-camera` a été fusionnée dans `dev` le 19/09/2026**, à la demande de
> Florian, pour qu'un **seul APK** porte l'essai en salle. `dev` embarque donc désormais
> `react-native-vision-camera` et l'écran d'essai. **Les deux doivent être retirés avant le build de
> soumission Play** — entrée P0 au [BACKLOG](../../../BACKLOG.md), pour que ça ne tienne pas à la
> mémoire de quelqu'un. Rien d'autre ne change : aucune permission nouvelle, aucun écran produit
> touché, le spike reste un spike.

## 1. La question

Peut-on mesurer la vitesse de chaque répétition avec le téléphone posé de profil, assez bien pour
dire **quand arrêter la série** ? Les critères de sortie, fixés d'avance :

| # | Critère | Statut |
|---|---|---|
| C1 | ≥ 95 % des répétitions détectées (squat, développé couché, soulevé de terre) | 🟢 **tenu sur trace simulée** (100 %), à confirmer sur device |
| C2 | Écart ≤ 0,05 m/s avec une référence | 🟡 **tenu si le suivi est précis à ±3 px**, perdu à ±8 px — voir §4 |
| C3 | ≥ 30 i/s de traitement sur un Android milieu de gamme | ⬜ **ouvert** — ne se mesure que sur device |
| C4 | Pas de chauffe gênante sur 5 séries | ⬜ **ouvert** — ne se mesure que sur device |

## 2. Le découpage qui rend l'essai utile

La chaîne complète a **deux moitiés de risque très inégales** :

| Moitié | Ce qu'elle fait | Où se mesure le risque |
|---|---|---|
| **Capture** | Suivre un point (pastille ou disque) image par image | Sur device uniquement : caméra, cadence, chauffe |
| **Calcul** | Trajectoire → répétitions → vitesses → décision d'arrêt | **Ici, tout de suite**, sur des trajectoires simulées |

Les traiter ensemble serait la façon la plus chère de découvrir un problème : un écart de 0,1 m/s
constaté en salle ne dirait pas s'il vient de la caméra ou de l'arithmétique. **La moitié calcul est
donc traitée d'abord, et séparément** — elle ne coûte rien à écrire et elle transforme la question
posée à la caméra en **exigence chiffrée**.

## 3. Ce qui est livré (moitié calcul)

[`packages/shared/src/bar-velocity.ts`](../../../packages/shared/src/bar-velocity.ts) — module pur,
32 tests. Il ne voit aucune image : il prend une suite de positions et rend des vitesses.

- `metersPerPixel(diamètreDuDisquePx)` — l'échelle de la scène, étalonnée sur les 45 cm d'un disque
  olympique ;
- `analyseSet(échantillons, options)` — répétitions détectées, vitesse moyenne concentrique (MCV) et
  vitesse de pointe de chacune, **qualité de la trace**, perte de vitesse et **signal d'arrêt** ;
- `estimateRir(vitesse, profil)` — répétitions en réserve, **`null` sans profil mesuré** (§6).

[`packages/shared/src/bar-tracker.ts`](../../../packages/shared/src/bar-tracker.ts) — le **suivi**
du point sur une image, 10 tests. Centre de gravité **pondéré par la luminance** (donc
sous-pixellique : c'est ce qui sépare un suivi à ±1 px d'un suivi à ±5 px), **accroché à la position
précédente** (sans quoi le néon du plafond vole le suivi à la première image), et qui rend `null`
plutôt qu'une position douteuse.

[`bar-velocity-chain.test.ts`](../../../packages/shared/src/bar-velocity-chain.test.ts) — les deux
moitiés **branchées l'une sur l'autre** sur une vidéo fabriquée image par image (5 tests). C'est là
que se logent les fautes de raccord, invisibles dans chaque moitié prise isolément : l'axe vertical
inversé entre le repère image et le monde, l'échelle pixels → mètres, le décalage d'une ligne à
l'autre. À 30 i/s, la chaîne complète retrouve les vitesses jouées à moins de 0,05 m/s.

Trois comportements valent d'être notés, parce qu'ils viennent chacun d'un cas réel :

1. **Le point de blocage ne coupe pas la répétition en deux.** Un squat lourd s'arrête presque à
   mi-course ; sans tolérance, la rep la plus intéressante de la série serait comptée double et sa
   vitesse surestimée deux fois.
2. **Les images perdues sont traitées, pas ignorées.** Trou court (≤ 200 ms) : interpolé, et la rep
   est marquée comme telle. Trou long : la trace est **coupée** plutôt que de fabriquer une
   trajectoire plausible et fausse.
3. **La trace porte son propre verdict** (`quality.usable`). Une série filmée à 12 i/s avec un tiers
   d'images perdues rend des vitesses d'allure crédible : il faut donc un refus fondé sur la
   **trace**, pas sur le résultat.

## 4. Les mesures — ce que le banc dit

Protocole : trajectoires synthétiques à vitesse **connue** (8 répétitions de 0,85 à 0,22 m/s, profil
de vitesse en cloche, pause en bas), échantillonnées comme le ferait une caméra, avec un tremblement
de suivi reproductible. **Cinq tirages de bruit par condition** — avec un seul, on mesure la chance.

| Condition | Reps détectées | Écart médian | Écart max | Perte de vitesse : écart max |
|---|:---:|:---:|:---:|:---:|
| squat/SDT 0,60 m · 60 i/s · suivi parfait | 40/40 | 0,036 m/s | 0,043 m/s | 0,1 pt |
| squat/SDT 0,60 m · 60 i/s · ±3 px | 40/40 | 0,030 m/s | 0,056 m/s | 1,3 pt |
| **squat/SDT 0,60 m · 60 i/s · ±8 px** | 40/40 | 0,037 m/s | **0,437 m/s** | **8,9 pt** |
| squat/SDT 0,60 m · 30 i/s · ±3 px | 40/40 | 0,035 m/s | 0,082 m/s | 2,1 pt |
| squat/SDT 0,60 m · 24 i/s · ±3 px | 40/40 | 0,030 m/s | 0,056 m/s | 1,9 pt |
| développé couché 0,25 m · 60 i/s · ±3 px | 40/40 | 0,020 m/s | 0,051 m/s | 4,8 pt |
| développé couché 0,25 m · 30 i/s · ±3 px | 40/40 | 0,023 m/s | 0,059 m/s | 4,5 pt |

### 4.1 Le résultat qui compte

🔴 **La décision est plus juste que l'affichage.** La vitesse absolue d'une répétition porte 0,02 à
0,08 m/s d'erreur selon les conditions ; la **perte de vitesse** — le rapport entre deux répétitions
de la même série, c'est-à-dire ce qui déclenche « pose la barre » — reste à **1 à 5 points** près
partout. Les biais de mesure sont les mêmes d'une rep à l'autre et **se simplifient dans un rapport**.

Conséquence produit, à trancher au cadrage : le **seuil −20 %** est solide bien avant que le
« 0,41 m/s » affiché ne le soit. Une V1 qui montre la courbe et le signal d'arrêt, sans prétendre à
la précision d'un capteur linéaire, est donc défendable — et c'est l'inverse de ce que la maquette
laisse entendre aujourd'hui.

### 4.2 Le vrai facteur limitant n'est pas la cadence

C'est la **précision du suivi**. À ±3 px (≈ 4,5 mm à l'échelle de test), tout tient, y compris à
24 i/s. À ±8 px, l'écart maximal explose à 0,437 m/s et la perte de vitesse devient inexploitable.

**Exigence à transmettre à la moitié caméra** : le suivi doit tenir le point à **±3 px**, avec au
moins **300 px pour 45 cm** dans le cadre (donc téléphone assez près, ou disque bien visible).
Une cadence de 30 i/s suffit ; 60 i/s donne de la marge.

### 4.3 Deux essais négatifs, gardés parce qu'ils coûtent cher à refaire

- **Affiner les bornes entre deux images** (parabole passant par trois points) : **dégrade**. La
  borne d'une répétition est un **coin** — pause immobile puis poussée — pas un extremum lisse ;
  l'ajustement extrapole à côté. Écart max au banc : 0,069 → 0,122 m/s à 30 i/s.
- **Borner la montée sur un dénivelé fixe** (1 mm par image) : **dégrade**, et dans les deux sens à
  la fois. Le tremblement du suivi ressemble à un mouvement pendant la pause (rep rapide allongée de
  13 %) tandis que les extrémités lentes d'une rep d'échec passent sous le seuil (rep lente
  raccourcie de 17 %). Deux erreurs opposées, donc irrattrapables par une correction unique. Le seuil
  retenu est **relatif à la vitesse de pointe de la répétition** (8 %), qui n'a ni l'un ni l'autre
  défaut.
- **Lisser sur un nombre fixe d'images** : juste à 60 i/s, désastreux en dessous — 5 images à 30 i/s
  couvrent 167 ms, soit plus de la moitié d'un développé couché rapide, dont les deux extrêmes sont
  rabotés. Le lissage est donc exprimé en **durée** (80 ms), converti en images selon la cadence.

> ⚠️ **Ces constantes sont des réglages, pas des vérités.** Elles ont été ajustées sur des
> trajectoires simulées ; la première tâche de l'essai device est de les **réétalonner sur des
> traces réelles**, avec une référence.

## 5. Ce qui reste : la moitié caméra

### 5.1 Le chemin technique, installé et compilé le 19/09/2026

> ⚠️ Tout ce qui suit est **dans `dev`** depuis la fusion du 19/09 (voir l'encadré en tête). La
> branche `spike/vbt01-camera` reste poussée, comme point de retour si l'on veut isoler à nouveau.

- ❌ **`expo-camera` ne peut pas faire ce travail.** Vérifié dans l'API installée (SDK 57) : les
  seuls rappels exposés sont `onBarcodeScanned`, `onCameraReady`, `onPictureSaved`… **aucun accès aux
  images**. Pas de contournement : `takePictureAsync` en boucle plafonne à quelques images/s.
- ✅ **`react-native-vision-camera` 5.2.3** installé, avec `react-native-nitro-modules` (0.37.1),
  `react-native-nitro-image` (0.15.2) et `react-native-vision-camera-worklets` (5.2.3), que le
  traitement d'images exige. Aucun conflit de version avec Expo 57 / RN 0.86.
- 🟢 **Découverte qui change le coût du chantier : aucun module natif à écrire.** L'API v5 donne les
  pixels **depuis un worklet JavaScript** — `frame.getPlanes()[0].getPixelBuffer()` rend un
  `ArrayBuffer` sur le plan de luminance. L'[analyse du 13/09](../../product/analyse-innovation-2026-09.md)
  prévoyait « un traitement natif branché sur les frame processors (OpenCV ou ML Kit), la friction
  connue sous Expo » : ce n'est plus nécessaire. Le suivi tient dans
  [`bar-tracker.ts`](../../../packages/shared/src/bar-tracker.ts), en TypeScript, testé au sol.
- ✅ **Pas de plugin de config à déclarer** : la v5 s'appuie sur l'autolinking
  (`react-native.config.js`), et `prebuild` la prend donc telle quelle. ⚠️ **Nouveau dev build
  obligatoire** — dépendance native.
- ✅ **Aucune permission nouvelle** : `CAMERA` est déjà déclarée (plugin `expo-camera`, pour le scan
  de codes-barres). ⚠️ En revanche le **texte** de la permission devra être élargi le jour d'une
  livraison — il ne parle aujourd'hui que des codes-barres.

### 5.1 bis L'écran d'essai

[`apps/mobile/src/app/spike-vbt.tsx`](../../../apps/mobile/src/app/spike-vbt.tsx) — caméra, suivi
image par image dans un worklet, et l'analyse à l'arrêt de la série : cadence tenue, images perdues,
vitesse de chaque rep, perte, verdict d'exploitabilité.

**Tout se règle à l'écran** : seuil de luminance et diamètre du disque, avec un **retour vivant du
suivi** (position, nombre de pixels retenus, taille de l'image, et un « POINT PERDU » bien visible).
Figés dans le code, ces deux réglages condamneraient le déplacement — on ne recompile pas une app
entre deux séries.

⚠️ **L'unité des horodatages de la caméra est détectée automatiquement**
(`rescaleToMilliseconds`) : selon l'appareil, elle peut être en nanosecondes, microsecondes,
millisecondes ou secondes. Lue de travers, elle rend des vitesses fausses d'un facteur mille ou un
million **sans que la forme de la courbe ne trahisse quoi que ce soit** — donc une séance perdue,
constatée seulement au retour.

🔴 **Écrit contre l'API réelle (lue dans le paquet installé) et compilé — mais jamais exécuté**,
faute de device dans la boucle. Le raccord caméra → worklet est donc **la première chose à déboguer**,
pas la mesure : la chaîne logicielle, elle, est couverte par 47 tests.

Pour le faire tourner :

```sh
git pull                                   # dev contient tout depuis le 19/09
npm install                                # dépendances natives neuves
cd apps/mobile && npm run build:preview    # APK autonome — PAS build:dev, qui exige Metro en salle
```

⚠️ **`build:preview` et non `build:dev`** : le dev client a besoin d'un serveur Metro joignable,
ce qu'on n'a pas au milieu d'une salle de sport. Si le quota EAS est épuisé, le build local Android
est documenté dans [dev-build-android-local.md](./dev-build-android-local.md).

**Où le trouver dans l'app** : Réglages → tout en bas, « Essai vitesse de barre » → *Ouvrir*.

### 5.1 ter Le protocole en salle, en six gestes

1. **Poser** le téléphone de profil, perpendiculaire au plan du mouvement, à 1,5–2 m, vers la
   mi-hauteur du trajet. Fixe : sol, banc, sac. Jamais tenu.
2. **Fixer une marque** sur l'extrémité de la barre ou au centre du disque, bien visible de
   l'objectif. Une pastille fluo est l'idéal, mais **n'importe quoi de petit et de contrasté fait
   l'affaire** : scotch blanc, post-it plié, bout de papier, élastique clair. À défaut de clair, un
   scotch **noir** sur une barre chromée marche aussi — l'écran a une bascule « inverser ».
   🔴 **Ne jamais viser le disque entier** : le suivi est un centre de gravité de luminance, pas un
   détecteur de cercle. Une tache qui remplit la fenêtre de recherche a son centre de gravité au
   centre de la fenêtre, c'est-à-dire à la position précédente — le suivi se fige et rend une barre
   parfaitement immobile, avec une trajectoire lisse et des vitesses plausibles. L'écran refuse
   désormais ce cas (couverture > 60 % de la fenêtre) et le dit en toutes lettres, mais la bonne
   réponse reste : **une petite marque**.
3. **Régler le seuil** avant de charger : monter jusqu'à ce que la ligne du haut passe au vert et
   ne montre plus que la pastille (~40 à 400 px retenus). Si elle saute au plafond, baisser.
4. **Relever le diamètre du disque en pixels** : bouger le réglage « disque » jusqu'à ce que
   l'amplitude affichée après une rep corresponde à la réalité (un squat complet ≈ 0,5–0,7 m). Une
   erreur ici fausse **toutes** les vitesses proportionnellement.
5. **Une série par mouvement** : squat, développé couché, soulevé de terre. Noter à la main le
   nombre de reps réellement faites, pour le comparer au nombre détecté.
6. **Noter** après chaque série : cadence affichée, images perdues, verdict exploitable ou non, et
   si le téléphone chauffe au bout de cinq séries.

### 5.2 Ce que l'essai device doit mesurer

1. **Le suivi tient-il ±3 px** sur un disque, en salle, avec un éclairage ordinaire ? (§4.2)
2. Combien d'images par seconde le traitement tient-il réellement (C3) ?
3. Chauffe sur 5 séries (C4) ?
4. Combien de répétitions manquées sur les trois mouvements (C1) ?
5. Écart avec une référence : comptage manuel d'images sur une vidéo à 60 i/s, ou capteur du
   commerce si l'un de vous y a accès (C2).

**Protocole minimal** : téléphone fixe, de profil, perpendiculaire au plan du mouvement, à 1–3 m,
mi-hauteur du trajet. Pastille contrastée d'abord (la chaîne la moins chère à valider), disque nu
ensuite. Trois mouvements, 5 séries, une seule personne suffit.

### 5.3 La règle de décision

| Résultat | Décision |
|---|---|
| C1 à C4 tenus | **Go** : on cadre l'US (spec → plan → maquette → validation) |
| Suivi à ±3 px hors d'atteinte | **No-go** sur la mesure ; l'idée retombe au BACKLOG |
| Suivi bon mais < 30 i/s ou chauffe | **Go partiel** : mesure en différé sur une vidéo courte gardée **sur le téléphone**, jamais envoyée |

## 6. Ce que le spike a déjà changé dans la compréhension du produit

1. **La maquette promet un RIR que la mesure ne peut pas tenir.**
   [`VitesseBarre.dc.html`](../../../design/innovation-2026-09/VitesseBarre.dc.html) affiche « RIR ≈ 1 ».
   Or convertir une vitesse en répétitions en réserve exige une **vitesse d'échec propre à la personne
   et à l'exercice**, qui ne s'obtient qu'en menant une série à l'échec une fois. Le module rend donc
   `null` sans profil mesuré. Trois issues au cadrage : faire calibrer (une série à l'échec par
   exercice), n'afficher que la perte de vitesse, ou afficher un RIR **explicitement estimé**. Le
   dépôt a déjà payé le troisième travers (coefficient d'allure inventé du prototype Labo, 15/09) :
   un nombre faux coûte plus cher qu'un nombre absent.
2. **Le diamètre du disque est le point de fragilité n° 1.** Un disque de 35 cm pris pour un 45
   fausse **toutes** les vitesses de 29 %, sans que rien ne le signale. Il devra être saisi ou
   détecté, jamais supposé par défaut.
3. **Le développé couché est le cas le plus dur**, pas le squat : son amplitude courte (25 cm) rend
   la même erreur de bornes deux fois plus coûteuse en pourcentage.
4. **Ce qu'on stocke reste minuscule** : quelques vitesses par série. Aucune vidéo, aucun fichier,
   aucun appel d'IA — la conclusion de l'[analyse §6.2](../../product/analyse-innovation-2026-09.md)
   tient telle quelle.

## 7. État

| Moitié | État |
|---|---|
| Calcul | ✅ **Livrée et prouvée** (19/09/2026) — 32 tests de mesure + 10 de suivi + 5 de bout en bout |
| Caméra — logiciel | ✅ **Écrit et compilé** sur `spike/vbt01-camera` : aucun module natif nécessaire |
| Caméra — device | ⬜ **Ouverte** — dev build + essai en salle, jamais exécuté à ce jour |
| Décision go/no-go | ⏳ **En attente de l'essai device** |
