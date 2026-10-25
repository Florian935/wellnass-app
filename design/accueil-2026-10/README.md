# Accueil « Ta journée » — maquettes et cadrage (24-25/10/2026)

Passe UX/UI complète sur l'accueil (onglet `index`), demandée par Florian le 23/10/2026 :
« pas assez utile, pas assez clair, ne donne pas envie d'y rester ». Analyse faite dans le code
(aucun appareil branché), proposition validée par Florian le 25/10/2026, **décisions D1 à D6
tranchées** (§2). Rien n'est codé à cette date.

- **Toile en ligne** (prototype jouable, planches, teintes, animations) :
  https://claude.ai/artifact/GMpz8mpVdQPrxRX4vdvzsb
- **Compte rendu** (Claude Docs : 16 constats, proposition, couleur, décisions, lots) :
  https://claude.ai/artifact/Y8xf61ESXKWk4uBfWi9LAJ

Les `.dc.html` de ce dossier sont les sources de la toile (format Design : `canvas.json` + une
planche par fichier, `Phone.dc.html` étant le composant importé par toutes les autres). Ils ne
s'ouvrent pas tels quels hors de claude.ai : la **logique du prototype** (données des journées,
règles du fil, calcul des cadrans, palettes) se lit directement dans le `<script>` de
`Phone.dc.html` — c'est la référence la plus précise du comportement attendu.

| Fichier | Contenu |
|---|---|
| `Teintes.dc.html` | Page « 0 · La couleur » : la roue des teintes prises et les 3 teintes libres, en clair et en sombre |
| `Avant.dc.html` | L'accueil actuel reproduit, avec le pli de l'écran et 9 pastilles numérotées |
| `Main.dc.html` | Le prototype jouable : journée, teinte, heure, thème |
| `Phone.dc.html` | Le composant écran (props `scenario`, `hour`, `dark`, `teinte`, `full`) |
| `Anatomie.dc.html` | L'écran entier à 12:40, sans défilement |
| `Matin`, `AvantSeance`, `Soir`, `SombreSoir` | Une journée de séance, heure par heure (12:40 = `Phone`) |
| `Repos`, `Serie`, `PremierJour`, `Retour`, `NutritionSeule`, `SeanceEnCours` | Les autres journées |
| `Anim.dc.html` | Les 4 animations en boucle (cadrans, repas noté, lueurs selon l'heure, check-in) |

## 1. Le diagnostic, en bref

L'accueil empile 12 blocs (~1 850 px, 2,4 écrans) ; la moitié redisent la série (×2), la semaine
(×3), la forme (×3) ou l'assiette (×3), et rien ne répond d'un coup d'œil à « où j'en suis
aujourd'hui ? ». Six erreurs de logique, vérifiées dans le code :

1. **Un seul repas noté = « Ta journée est faite »** — `useMealLoggedToday` (≥ 1 entrée) +
   `hasDoneSomething` (`packages/shared/src/now-action.ts`) ; et `meal-due` ne relance plus jamais
   le déjeuner ni le dîner une fois un repas noté.
2. **« Créer un programme » (haltère) quand rien n'est prévu** — cas `idle` de `NowCard`, y compris
   un jour de repos avec programme actif, et pour un compte nutrition seule (décision H).
3. **La pesée est réclamée à tous dès 10 h** — `weighInDue` dans `useNowAction`, sans garde
   d'habitude (contrairement au bien-être, gardé par 30 jours d'historique).
4. **« Reprise en douceur » → route `/real-life` inexistante** (VIE-02 au BACKLOG).
5. **« Sauver ma série » ouvre `/planning`**, qui ne sauve rien.
6. **Le titre répète la carte** (`home-headline.ts` ↔ `home.now.*.title`, mot pour mot pour
   `idle`, `day-done`, `wellbeing-due`) ; les clés `home.headline.*` n'ont pas de `{{name}}`, le
   prénom n'apparaît jamais.

Puis : anneaux sans légende et vides sans planning (`useWeekRings`) ; check-in « 1 2 3 4 5 » sans
libellé ; « Demande-moi » qui cache des réponses déjà calculées ; actions rapides au pli (780 px) ;
parcours 7 jours enterré (6ᵉ de la grille) ; aucun croisement de piliers à l'accueil ; cartes
beiges de même poids ; « Ça se complique ? » permanent ; `useNowAction` monté deux fois (écran +
`NowCard`) et `useStreakData` ×5 (l'historique complet relu ~10 fois par synchro).

## 2. Décisions de Florian (25/10/2026)

| # | Décision |
|---|---|
| D1 | **Teinte Aurore** pour l'accueil (§4). Le terracotta ne reste que la couleur de marque (réglages, onboarding). |
| D2 | Trois cadrans transverses **Bouger · Manger · Récupérer** ; un cadran n'apparaît que si son pilier est actif. |
| D3 | **« Demande-moi » est retiré** (ses trois réponses sont à l'écran). |
| D4 | **Bouton « + » flottant** sur l'accueil seulement. |
| D5 | La grille devient **« Tes repères »** (tuiles compactes, personnalisables), plafond de 8 inchangé ; amendement court d'ADR-007. |
| D6 | **Les trois lots maintenant, avant la publication Play Store.** |

« Le reste c'est top » : la structure, les règles et les textes de la toile valent validation.

## 3. La cible

De haut en bas (voir `Anatomie.dc.html`) :

1. **Le ciel** (la scène) — date, « Bonjour Florian » (Bon après-midi / Bonsoir selon l'heure ;
   « Content de te revoir » au retour ; « Bienvenue » au premier jour), **la phrase du jour**
   (calculée, jamais d'IA : elle dérive de l'action du moment et des faits du jour), bouton
   « Écouter mon brief » le matin (le brief actuel, `buildMorningBrief` + `expo-speech`), puis
   **les trois cadrans** dans un encart translucide :
   - **Bouger** : séances de la semaine en segments (rouge muscu, bleu course ; celle du jour en
     pâle tant qu'elle n'est pas faite) — « 3/5 séances · cette semaine » ;
   - **Manger** : kcal restantes (anneau continu) + « prot. 80 / 140 g » ;
   - **Récupérer** : le verdict TRI-03 existant en 3 segments (charge, nutrition, bien-être, colorés
     positif / neutre / négatif) ; au toucher, la feuille « Pourquoi ? » ; le matin sans check-in,
     « ? » et renvoi vers le check-in.
   - Nutrition seule : Manger + **Marcher** (pas du jour / objectif). Jour 1 : la carte
     « Premiers pas » (parcours 7 jours) remplace les cadrans. Retour : la carte « 9 jours de pause ·
     rien n'est perdu » avec « En douceur » / « Mon plan normal ». Séance en cours : bandeau rouge
     « Reprendre la séance » au-dessus des cadrans.
2. **Ta journée** (le fil) — les gestes du jour horodatés, tous piliers : check-in, pesée, repas
   aux heures apprises, séance/sortie à son heure, collation suggérée, point du soir. Ce qui est
   fait se **replie** (« 3 faits · check-in · pesée · petit-déj », touchable) ; l'**action du
   moment** est dépliée en carte sombre avec son bouton (visages au check-in, « Ajouter mon
   déjeuner » + scanner, « Démarrer la séance » + aperçu…) ; la suite tient en **3 lignes** puis
   « +n plus tard ». Les **astuces croisées** sont dans la carte du moment (« Jambes ce soir : un bon
   féculent ce midi », « +250 kcal gagnés par ta séance », « Squat : tente 102,5 kg »). Journée
   bouclée : « Ta journée est faite » + « Prisme raconte ma journée ». Série en jeu le soir : la
   carte propose **marcher 15 min (objectif de pas)**, **noter une activité**, **utiliser le joker**.
3. **Ta semaine** — 7 colonnes L→D, une pastille par pilier actif (plein = fait, pointillé =
   prévu), aujourd'hui encadré, la série en pastille, « 3 séances sur 5 · 3 jours dans ta cible »,
   lien Bilan. Remplace anneaux, Régularité, « La suite » et le bilan du lundi.
4. **Du nouveau** — 2 cartes au plus : record battu (ou « record à portée » avant la séance),
   objectif le plus proche, lien du Labo, « depuis ta dernière visite », conflit d'objectifs.
5. **Tes repères** — l'ancienne grille en tuiles compactes 2 colonnes (poids + courbe, pas + barre,
   sommeil, eau, cycle…), « Personnaliser ».
6. Pied : « Semaine chargée ? Allège-la » (vie réelle) et « Personnaliser l'accueil ».
7. **Bouton « + »** flottant → feuille « Noter » : le repas du moment, scanner, pesée, check-in,
   eau, activité, course libre, séance libre (filtrés par piliers actifs).

Ce qui disparaît de l'accueil : `AskCard`, `QuickActions`, `UpNext`, `StreakCard`, les anneaux
`BreathRings`, `MorningBriefCard` (remplacé par le bouton Écouter), `EveningCard` (le fil + Prisme
la remplacent), `NowCard` sous sa forme actuelle.

### Règles du fil (référence : `data()` et `renderVals()` de `Phone.dc.html`)

- Un geste est **dû** quand son heure est passée et qu'il n'est pas fait ; l'action du moment =
  le premier geste non fait, les suggestions (collation, marche) seulement dans leur fenêtre.
- **Journée faite** = la séance/sortie prévue faite (ou rien de prévu) **et** chaque repas dont
  l'heure apprise est passée noté. Un repas ne suffit plus.
- Pesée et check-ins n'apparaissent que si la personne les pratique (même garde que le bien-être :
  une entrée sur 30 jours), jamais imposés.
- Rien de prévu : on dit « Jour de repos » et on propose ce qui a du sens (marche, repas), jamais
  « Créer un programme » à qui n'a pas la muscu ou a un programme.

## 4. La teinte Aurore (D1)

| Rôle | Valeur |
|---|---|
| Fond de scène | dégradé `#13203A` → `#0A0E1C` |
| Lueur 1 (turquoise, ~172°) | `rgba(45,212,191,a)`, coin haut gauche |
| Lueur 2 (framboise, ~330°) | `rgba(236,72,153,b)`, haut droit |
| Dosage (a, b) selon l'heure | aube 0,38/0,20 · journée 0,36/0,34 · heure dorée 0,30/0,46 · soirée 0,24/0,52 · nuit 0,14/0,16 |
| Encre / encre secondaire | `#FFFFFF` / `#DBE3F7` |
| Accent (texte, onglet, liens) | `#0F766E` clair · `#5EEAD4` sombre |
| Bouton principal et « + » | dégradé `#5EEAD4` → `#F9A8D4` (texte `#151024`) ; « + » `#2DD4BF` → `#F472B6` |
| Carte « maintenant » | `#141A2E` clair · `#0F1426` sombre, texte `#EEF1FB` / `#B7C0DC` |

⚠️ **Contraste** : la lueur turquoise doit rester **≤ 0,38** là où passe du texte (au-delà, le texte
secondaire tombe sous 4,5:1 en haut à gauche). Les surfaces mêlées sont à ajouter à `surfaces`
dans `theme/stage.ts` pour que `__tests__/stage.test.ts` les mesure. La scène est sombre dans les
deux thèmes, comme muscu/course/nutrition. Les lueurs sont la **matière** de la scène : elles
respirent (seul élément vivant au repos, R2 de DASH-01) — en RN, deux disques `RadialGradient`
(`react-native-svg`) derrière le contenu, sur un `LinearGradient` de base. Jetons à toucher :
`HOME_LIGHT`/`HOME_DARK` (`theme/stage.ts`), `pillarHome` (`theme/colors.ts`),
`DEFAULT_MENU_COLORS.home` (`stores/menu-accent-store.ts`).

## 5. Les trois US proposées (toutes avant la publication)

| US | Contenu |
|---|---|
| **ACCUEIL-07 — L'accueil dit vrai** | Constats 1 à 6 + check-in avec visages et libellés + `useNowAction` calculé une fois + **teinte Aurore** (scène, onglet, accents). Absorbe **VIE-02** (à retirer du BACKLOG). |
| **ACCUEIL-08 — Ta journée** | Brique pure `buildDayTimeline` dans `packages/shared` (testée comme `resolveNowAction`) ; les trois cadrans ; le fil ; la carte semaine ; Du nouveau ; Tes repères ; le « + » ; retrait des composants listés au §3 ; amendement d'ADR-007. Aucune migration : tout est déjà en base. |
| **ACCUEIL-09 — Le mouvement** | Lueurs Aurore dosées par l'heure, les 6 animations (cadrans à l'arrivée, ligne cochée + anneau qui suit, carte du moment qui entre, visages, feuille « Noter », lueurs qui respirent), astuces croisées enrichies, carte record partageable, Prisme du soir au bout du fil. |

Animations : MOTION-01 et DASH-01 (R1 le mouvement ne porte aucune information, R2 un seul élément
vivant au repos, R3 rien par image côté JS, R4 boucles coupées hors focus) ; briques existantes
`AnimatedNumber`, `AnimatedBar`, `Breathe`, `StaggerIn`, `PressableScale`, `useAppReducedMotion`.

Contraintes : i18n FR + EN pour toute chaîne ; offline-first (aucune lecture réseau) ; décision H ;
identité de pilier par écran (`useMenuFocus('home')`, garde `pillar-identity.test.ts`) ; plafond
de widgets testé (`widgets.test.ts`).
