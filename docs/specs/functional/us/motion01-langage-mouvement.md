---
id: MOTION-01
titre: "Langage de mouvement — une physique par pilier, socle partagé, 19 effets livrés"
roadmap: [3.60]
catalogue: []
etape: recette
branche: feature/motion01-langage-mouvement
maj: 12/09/2026
---

# US MOTION-01 — Langage de mouvement

> **Analyse + maquettes validées par Florian le 12/09/2026.**
> Traité en **un seul lot** sur décision de Florian, là où l'analyse proposait cinq lots successifs :
> « je te laisse tout faire d'un seul lot en entier et comme ça je fais un recettage final ».
> Analyse : livrée en **artefact** (compte rendu « Le mouvement manquant » : relevé du code,
> langage de mouvement, catalogue des 45 effets, garde-fous, ordre de livraison). Son contenu utile
> est repris ici même ; les **maquettes**, elles, sont versionnées :
> [design/motion-01/](../../../../design/motion-01/) — 6 planches **animées**, un brief sur le
> mouvement ne se jugeant pas sur des images fixes.
> Branche `feature/motion01-langage-mouvement`, créée depuis `dev`, développée dans un
> **worktree isolé** — `feature/muscu-ux02-bilan-seance` travaille en parallèle sur l'écran récap.

## 0. Contexte — l'outillage était là, il n'a jamais été branché

Le constat de départ de Florian : « l'application manque de pep's, il n'y a pas d'animation, pas
d'effet visuel sympa ». Le relevé fait sur le dépôt dit quelque chose de plus précis, et de plus
encourageant : ce n'est pas qu'il manque des animations, c'est que **rien n'a jamais été câblé**
alors que tout est installé.

| Constat | Mesure |
|---|---|
| `react-native-reanimated` 4.5 + `react-native-worklets` | installés, utilisés par **2 fichiers** sur ~80 écrans (glisser-déposer du planning) |
| Composants réellement animés | **1** — `CelebrationCard`, en API `Animated` historique |
| Fichiers gérant « réduire les animations » | **1** — le même |
| `Button` | un appui ne produit qu'un `opacity: 0.85`. Ni enfoncement, ni retour haptique |
| `RingGauge` | `strokeDashoffset` calculé une fois : l'anneau apparaît déjà rempli |
| `RestOverlay` | le repos est **un texte qui décrémente**, sur l'écran où l'on reste le plus longtemps immobile |
| Haptiques (`hapticConfirm` / `Milestone` / `Select`) | écrites, documentées sur 30 lignes, appelées depuis **2 fichiers**, tous deux en muscu |
| Pilier Course, pilier Nutrition | **aucun** retour haptique |

Et surtout : [`design/design-system.md`](../../../../design/design-system.md) § « Animations clés »
nomme **cinq animations** validées en maquette — `prpop`, `sheetup`, `pulsedot`, `dashmove`,
`fadeslide`. **Aucune n'existe dans le code.** Une bonne moitié de cette US ne propose donc rien de
neuf : elle livre ce qui avait déjà été tranché.

## 1. Le principe — une physique par pilier

Suggestion de Florian, retenue : *« pourquoi pas adapter les effets & animations à chaque pilier ».*
C'est le seul angle qui évite le catalogue d'effets interchangeables, et l'infrastructure est déjà à
moitié posée — `menu-accent-store` définit une couleur par pilier, `MENU_HALO` une géométrie de halo
par module.

| Pilier | Métaphore | Physique | Paramètres |
|---|---|---|---|
| **Musculation** | L'impact | Court, franc, déjà fini quand l'œil arrive. On encaisse une charge. | spring `damping 18 / stiffness 420 / mass .7` ≈ 180 ms |
| **Course** | Le flux | Continu, régulier, sans à-coup. Rien ne démarre ni ne s'arrête. | `linear` / `inOut(sin)`, boucles 1,1 – 2,4 s |
| **Nutrition** | Le remplissage | Ça monte et ça se pose. **Jamais de rebond.** | `bezier(.22,.61,.36,1)`, 420 – 600 ms, overshoot 0 |
| **Accueil / bien-être** | Le souffle | Lent au point qu'on ne le remarque pas. | `inOut(sin)`, 2,4 – 6 s, amplitude ≤ 6 % |

### Quatre niveaux, et un budget pour chacun

Sans hiérarchie, « ajouter des animations » finit en soupe : tout bouge, donc plus rien ne ressort.

| Niveau | Ce que le mouvement dit | Durée | Budget |
|---|---|---|---|
| **0 · Réponse** | « J'ai senti ton doigt. » | 90 ms | à chaque appui — le seul autorisé partout |
| **1 · Continuité** | « Ça vient de là, ça va là. » | 160 – 280 ms | à chaque écran |
| **2 · Sens** | « Ce chiffre a bougé, et voilà de combien. » | 420 – 800 ms | quand la donnée change |
| **3 · Célébration** | « Ça, c'est arrivé une fois. » | 600 – 1200 ms | **1× par séance max** |

## 2. Règles métier — les invariants

Ce sont les règles qu'aucun effet ne peut enfreindre. Elles priment sur toute considération
esthétique, et un effet qui les viole est retiré, pas corrigé.

- **R1 — Le mouvement ne porte jamais d'information.** Couper toutes les animations doit laisser
  l'écran dire exactement la même chose. Corollaire : aucun état (pause, erreur, dépassement) n'est
  signalé par la seule couleur ou le seul mouvement — toujours doublé d'un texte ou d'une icône.
- **R2 — L'état change avant le mouvement.** Valider une série est répété 30 à 40 fois par séance :
  l'écriture en base et le rendu du nouvel état ne sont **jamais** retardés par une animation.
  L'animation décore après coup. Aucun effet n'ajoute de latence perçue à un geste.
- **R3 — Tout sur le thread UI.** Les valeurs animées sont des `SharedValue` pilotées par des
  worklets. Aucun `setState` par image, aucune animation pilotée depuis le thread JS.
- **R4 — Les boucles s'arrêtent.** Toute animation `repeat(-1)` (halo qui respire, pulsation GPS)
  est annulée dès que l'app passe en arrière-plan, via `useIsAppActive`. Sur une sortie d'une heure
  en GPS, écran éteint, une boucle oubliée se paie en batterie.
  > ⚠️ **`useFocusEffect` / `useIsFocused` ont été essayés et écartés** : ils **lèvent** une
  > exception hors conteneur de navigation (« Couldn't find a navigation object »), et un halo
  > décoratif n'a aucune raison de faire planter l'écran qui l'héberge — le défaut s'est manifesté
  > dès qu'un test a rendu une carte isolément. `AppState` couvre le cas qui coûte vraiment de la
  > batterie (app en arrière-plan) sans aucune dépendance. Compromis assumé : un écran monté mais
  > masqué par un autre continue d'animer.
- **R5 — Une valeur animée part de la précédente, jamais de zéro.** Un anneau de calories qui
  repart de 0 à chaque ajout d'aliment cache justement ce qu'on veut montrer : la portion ajoutée.
- **R6 — Overshoot interdit sur une donnée surveillée.** Une jauge de calories ou de macros qui
  dépasse puis revient affiche un chiffre faux pendant une fraction de seconde. Pilier Nutrition :
  décélération pure.

## 3. Accessibilité — la condition de tout le reste

C'est le point qui rend cette US acceptable après le travail de CONF-07.

- **Réglage système.** Toutes les primitives lisent `useReducedMotion()` de Reanimated — synchrone,
  sans l'écouteur manuel que `CelebrationCard` réinvente aujourd'hui. Quand il est actif, chaque
  primitive rend **l'état final immédiatement**, sans transition. Grâce à R1, rien n'est perdu.
- **Réglage applicatif.** `navigation-ux.md` §4.2 exige « animation + son (**désactivable**) » :
  un interrupteur « Animations » est ajouté aux Réglages, sur le patron de `menuColors`
  (préférence locale device, `secureStorage`, non synchronisée, aucune migration). Trois états
  effectifs : réglage app coupé **ou** réglage système actif ⇒ pas d'animation.
- **Le mouvement n'est jamais annoncé.** Les éléments purement décoratifs (halo, onde, balayage)
  portent `pointerEvents="none"` et sont masqués aux lecteurs d'écran.
- **Aucun contraste modifié.** Les couleurs de CONF-07 sont reprises telles quelles ; aucun effet
  n'introduit de texte sur un fond non validé.

## 4. Périmètre livré — **19 effets sur les 45 analysés**

Référence visuelle complète : [maquettes](../../../../design/motion-01/). Le détail cochable est en
[RECETTES.md](../../../../RECETTES.md) §60.

> **Le socle, lui, est complet.** C'est ce qui compte pour la suite : les effets restants ne sont
> plus que du branchement sur des primitives écrites, testées et documentées.

### Socle transverse (S1 – S14)

✅ **Livré** — `theme/motion.ts` (durées, ressorts, courbes), `useAppReducedMotion` (système +
réglage app), `useIsAppActive` (garde-fou R4), `PressableScale` (S1), `StaggerIn` (S2),
`AnimatedNumber` (S3), `RingGauge` animé (S4 — les **38** appelants en héritent sans changer
d'API), `AnimatedBar` (S5), `TabBarIcon` (S7), halo qui respire (S11), interrupteur « Animations »
des Réglages.

⬜ **Reste** — S6 (écarté, §4.6), S8 à S10, S12 à S14.

### Musculation — l'impact (M1 – M11)

✅ **Livré** — validation de série qui encaisse le coup (M1), **anneau du timer de repos** (M3, le
manque le plus criant du pilier), virage au vert à T−5 s (M4), steppers poids/reps (M8),
**`prpop` de célébration** (M7, via `CelebrationCard` partagé).

⬜ **Reste** — M2, M5, M6, M9, M10 · M11 écarté (§4.6).

### Course — le flux (C1 – C10)

✅ **Livré** — **point GPS pulsant** (C1, le `pulsedot` de la maquette), célébration de record au
résumé (héritée du composant partagé).

⬜ **Reste** — C3 à C10 · C2 (`dashmove`) écarté (§4.6).

> ⚠️ Le pilier n'émet toujours **aucun retour haptique** : C3 (kilomètre franchi) reste le premier
> candidat du lot suivant.

### Nutrition — le remplissage (N1 – N9)

✅ **Livré** — **ajout d'aliment** : l'anneau monte depuis sa valeur précédente et le chiffre
central roule (N1) · macros en cascade, décalées de 60 ms (N2) · halo de la carte héros qui respire.

⬜ **Reste** — N3, N5 à N9.

### Accueil & bien-être — le souffle (A1 – A6)

✅ **Livré** — chiffre du streak qui transite (A1), carte « Séance du jour » qui respire (A4),
cascade d'entrée de la grille de widgets (S2 appliqué ici).

⬜ **Reste** — A2, A3, A5, A6.

### 4.6 — Les quatre effets écartés, et pourquoi

Ceux-ci ne sont pas « à faire plus tard » : ils demandent autre chose que du mouvement.

- **S6 — pastille d'onglet glissante.** Demande de remplacer la barre d'onglets d'`expo-router` par
  une barre maison, qui porte déjà le masquage des piliers désactivés (`href: null`, décision H),
  la couleur d'accent par menu et les libellés i18n. C'est de la reconstruction, pas du mouvement.
- **C2 — `dashmove`.** `line-dasharray` est une propriété de **style de carte** MapLibre : l'animer
  exigerait un rafraîchissement JS par image, ce que la règle R3 interdit — sur l'écran qui tourne
  le plus longtemps de toute l'app.
- **M7 en séance (toast de record live).** Les records ne sont évalués qu'à la **clôture** de la
  séance (`evaluateWorkoutRecords`). Un toast en direct demanderait une évaluation par série :
  c'est du travail de données, pas d'animation. La célébration existe, au résumé.
- **M11 — transition séance → résumé.** `workout-summary.tsx` est réécrit en parallèle par
  MUSCU-UX02. Y toucher aurait garanti un conflit de fusion pénible, pour un gain esthétique.

## 5. Ce qui est explicitement exclu

- **Confettis** — trope générique, hors sujet sur un produit où l'on soulève de la fonte.
- **Shimmer sur les squelettes** — données en SQLite local, attente de quelques dizaines de ms :
  l'argument écrit dans `WidgetSkeleton` tient, la pulsation se lirait comme un scintillement.
- **Parallaxe au scroll** — déplace ce qu'on essaie de lire sur des écrans de données.
- **Gamification** — aucun badge, aucun palier, aucune dette créée envers l'app (décision C).
- **Lottie, Skia, toute dépendance native nouvelle** — voir §6.

## 6. Contraintes techniques

- **Offline-first** : sans objet. Aucun accès données, aucune écriture, aucune table. Les effets
  consomment des valeurs déjà rendues par les écrans.
- **Migrations / sync rules** : **aucune**. Le seul état persisté est la préférence locale
  « Animations », dans `secureStorage` comme `menu_accent_enabled`.
- **i18n** : deux clés neuves (`settings.motion.title`, `settings.motion.enable`), FR + EN.
  Aucun effet ne porte de texte.
- **Dépendances** : **aucune à ajouter**. `react-native-reanimated` 4.5, `react-native-worklets`,
  `expo-haptics`, `react-native-svg`, `expo-linear-gradient` sont déjà au `package.json`. Donc
  **aucun nouveau build EAS** n'est nécessaire pour recetter — ce qui compte quand le quota est la
  ressource rare.
- **Performance** : cible 60 fps. Les animations de la vue GPS live et de la séance sont les seules
  à tourner en continu ; R4 les borne.

## 7. Critères d'acceptation

Détail cochable dans [RECETTES.md](../../../../RECETTES.md) §60 (24 critères). En résumé :

1. Couper « Animations » dans les Réglages **ou** activer « réduire les animations » du système
   supprime tout mouvement **sans rien cacher** — c'est le critère qui conditionne tous les autres.
2. Les **vibrations survivent** à cette coupure : couper le mouvement visuel n'est pas couper le
   retour tactile.
3. Chaque appui sur un bouton produit un enfoncement visible **et** une vibration, sans ajouter la
   moindre latence au geste.
4. Le timer de repos affiche un anneau qui se vide régulièrement et vire au vert à T−5 s ;
   « + 15 s » le **remplit** au lieu de le faire sauter.
5. Ajouter un aliment fait monter l'anneau **depuis sa valeur précédente**, pas depuis zéro, et le
   chiffre central roule vers la nouvelle valeur.
6. La position GPS pulse en continu pendant toute la course, et **s'arrête** quand l'app passe en
   arrière-plan.
7. Un record affiche la célébration en ressort avec ses deux ondes, au résumé de séance comme de
   course.
8. En anglais, les chiffres animés utilisent `1,234.5` et non `1 234,5`.
9. Aucune régression de contraste ni d'annonce de lecteur d'écran — en particulier, aucun chiffre
   annoncé deux fois.
