---
id: MOTION-01
titre: "Langage de mouvement — une physique par pilier, 45 effets, socle partagé"
roadmap: [3.60]
catalogue: []
etape: code
branche: feature/motion01-langage-mouvement
maj: 12/09/2026
---

# US MOTION-01 — Langage de mouvement

> **Analyse + maquettes validées par Florian le 12/09/2026.**
> Traité en **un seul lot** sur décision de Florian, là où l'analyse proposait cinq lots successifs :
> « je te laisse tout faire d'un seul lot en entier et comme ça je fais un recettage final ».
> Analyse : [analyse-motion-2026-09.md](../../../product/analyse-motion-2026-09.md) ·
> Maquettes : [design/motion-01/](../../../../design/motion-01/) (6 planches animées).
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
- **R4 — Les boucles s'arrêtent.** Toute animation `repeat(-1)` (halo qui respire, pulsation GPS,
  vagues d'hydratation) est annulée dès que l'écran perd le focus (`useFocusEffect`). Sur une sortie
  d'une heure en GPS, une boucle oubliée se paie en batterie.
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

## 4. Périmètre livré — 45 effets

Référence complète et détail visuel : [maquettes](../../../../design/motion-01/).

### Socle transverse (S1 – S14)

`theme/motion.ts` (durées, ressorts, courbes), `useAppReducedMotion` (système + réglage app),
`PressableScale` (enfoncement 0,97 + haptique), `AnimatedNumber` (compteur qui roule, chiffres à
chasse fixe), `AnimatedRing` (`RingGauge` qui anime son arc depuis la valeur précédente),
`AnimatedBar`, `StaggerIn` (cascade d'entrée +12 px / 40 ms / plafond 6), pastille d'onglet
glissante colorée par pilier, icône d'onglet qui « pop », sheets en ressort, transitions d'écran
assumées, fondu squelette → contenu, halo qui respire, listes qui se réagencent, état de synchro
lisible, bascule de thème en fondu.

### Musculation — l'impact (M1 – M11)

Validation de série (encaissement + balayage vert + coche qui se dessine), montée de la série
suivante, **anneau du timer de repos** (le manque le plus criant), virage au vert à T−5 s, éclat de
fin de repos, repli de l'overlay en barre, **toast de record** (`prpop`), stepper poids/reps, barre
d'avancement de séance, schéma de muscles qui s'allume, transition séance → résumé.

### Course — le flux (C1 – C10)

**Point GPS pulsant** (`pulsedot`), **tracé qui défile** (`dashmove`), kilomètre franchi qui entre
par la droite + haptique (le pilier n'en avait aucun), **auto-pause par désaturation**, barre du
bloc de fractionné, compte à rebours 3-2-1, courbe d'allure qui se dessine, recentrage de carte
animé, résumé de sortie, chiffre d'allure vivant.

### Nutrition — le remplissage (N1 – N9)

**Ajout d'aliment enchaîné** (ligne + anneau + compteur liés), macros en cascade, dépassement
d'objectif, **hydratation liquide**, détection du code-barres, balayage de visée, suppression qui se
replie, grille de micronutriments en cascade, objectif calorique atteint.

### Accueil & bien-être — le souffle (A1 – A6)

Streak qui avance, réagencement de widgets poli, sélection du ressenti, carte « Séance du jour » qui
respire, états vides habités, étapes d'onboarding (`fadeslide`).

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

Détail cochable dans [RECETTES.md](../../../../RECETTES.md) § MOTION-01. En résumé :

1. Chaque appui sur un bouton ou une carte cliquable produit un enfoncement visible + une vibration.
2. Le timer de repos affiche un anneau qui se vide, vire au vert à T−5 s, et éclate à zéro.
3. Un record affiche le toast `prpop` avec ses deux ondes ; **une seule fois** par séance.
4. Ajouter un aliment fait monter l'anneau **depuis sa valeur précédente**, pas depuis zéro.
5. La position GPS pulse en continu et le tracé défile pendant toute la course.
6. L'auto-pause désature l'écran **et** affiche un texte.
7. Couper « Animations » dans les Réglages **ou** activer « réduire les animations » du système
   supprime tout mouvement sans rien cacher.
8. Aucune régression de contraste ni d'annonce de lecteur d'écran.
