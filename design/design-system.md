# FitTrio — Maquette de référence & design system

> Maquette globale exportée de **Claude Design** (projet « FitTrio »), couvrant l'ensemble
> de l'app WellNass. Sert de **référence visuelle validée** (étape 3 du workflow — voir
> [CLAUDE.md](../CLAUDE.md)) à recréer plus tard en **React Native + Expo**. Ce n'est **pas**
> du code de production : le medium est HTML/CSS/JS, on en reproduit le **rendu**, pas la structure.

## Fichiers du bundle

| Fichier | Rôle |
|---|---|
| [FitTrio.dc.html](FitTrio.dc.html) | La maquette principale : 14 écrans + logique d'états (balise `<x-dc>`) |
| [FitTrio - Composants.dc.html](FitTrio%20-%20Composants.dc.html) | Bibliothèque de composants du design system (extraits réutilisables) |
| [FitTrio - Micronutriments.dc.html](FitTrio%20-%20Micronutriments.dc.html) | **US 4.33** — détail aliment (section « Valeurs détaillées ») + aliment perso (saisie micros). Clair & sombre, accordéons. |
| [FitTrio - Nutrition.dc.html](FitTrio%20-%20Nutrition.dc.html) | **Refonte du pilier Nutrition** (30/07/2026) — les 10 écrans nutrition + états particuliers, rail de navigation à gauche. Clair & sombre. Notes de conception : [FitTrio - Nutrition.README.md](FitTrio%20-%20Nutrition.README.md) · aperçu : [.preview.webp](FitTrio%20-%20Nutrition.preview.webp) |
| [support.js](support.js) | Le **`dc-runtime`** de Claude Design que les maquettes chargent (`<script src="./support.js">`). Généré, ne pas éditer. |
| [Architecture Applicative.md](Architecture%20Applicative.md) / [.jpg](Architecture%20Applicative.jpg) | Arborescence des écrans + descriptif des fonctionnalités, pilier par pilier. |
| [FitTrio.preview.webp](FitTrio.preview.webp) · [screenshots/](screenshots/) | Aperçus rendus des maquettes |
| [README.md](README.md) | Note de handoff auto-générée par Claude Design |

> ℹ️ Toutes les maquettes sont **à plat** dans ce dossier et chargent le même `support.js` (les
> ouvrir via un serveur HTTP local, voir ci-dessous).

## Ouvrir la maquette

Servir le dossier en HTTP (le runtime fait un `fetch` du fichier) et ouvrir `FitTrio.dc.html` :

```bash
cd design && python -m http.server 8080   # puis http://localhost:8080/FitTrio.dc.html
```

L'écran de départ est le **splash** ; toute la navigation est cliquable. Thème clair/sombre
mémorisé dans `localStorage` (`fittrio-theme`).

---

## Inventaire des écrans (14)

Pilotés par `state.screen` dans la logique (`<script data-dc-script>` de la maquette).

| `screen` | Écran | Notes |
|---|---|---|
| `splash` | Accueil / pitch | « Trois piliers. Une routine. » |
| `auth` | Inscription | Google / Apple / e-mail, consentement 16 ans |
| `onb` | Onboarding | **5 étapes** (`onbStep` 0→4) : infos → activités → objectif → alim → récap |
| `home` | Dashboard | Séance du jour, nutrition (anneau), poids, streak/régularité |
| `muscu` | Musculation — accueil | Programme actif PPL, prochaine séance, raccourcis, volume/groupe |
| `muscuLive` | **Séance live** (star) | Séries, validation, timer de repos (sheet), toast record (PR) |
| `muscuResume` | Résumé post-séance | Stats, record, ressenti (emojis) |
| `exoFiche` | Fiche exercice | Muscles, GIF (placeholder), courbe charge, 1RM Epley, consignes |
| `exoBiblio` | Bibliothèque exercices | Recherche, filtres, liste, création perso |
| `muscuHist` | Progression & historique | 1RM estimé, records récents, heatmap volume/groupe |
| `run` | Running — accueil | Prochaine sortie, course libre, stats semaine, évolution allure |
| `runLive` | **Suivi GPS live** | Carte (SVG animée), distance/temps/allure, contrôles, auto-pause |
| `alim` | Journal alimentaire | Bilan calorique (anneau), macros, repas — ⚠️ **remplacé par la refonte Nutrition**, voir ci-dessous |
| `profil` | Profil | Apparence (clair/sombre), poids, TDEE, notifs, import/export, déconnexion |

### Graphe de navigation

- **Onboarding** : `splash → auth → onb(0..4) → home`. `onbPrev` sur l'étape 0 revient à `auth`.
- **Barre d'onglets** (`showTabs`) visible sur : `home, muscu, run, alim, profil, exoBiblio, muscuHist`.
  Masquée sur splash/auth/onb et les écrans **live** (`muscuLive`, `runLive`) et résumé/fiche.
- **Famille Muscu** (onglet Muscu actif) : `muscu, exoBiblio, exoFiche, muscuHist`.
- 4 onglets : Accueil · Muscu · Running · Alim (le profil s'ouvre via l'avatar du dashboard).

> Rappel produit ([CLAUDE.md](../CLAUDE.md), décision H) : les piliers sont **opt-in** ; les
> onglets des piliers non activés doivent être **masqués**. Dans la maquette les 3 sont actifs.

### Refonte Nutrition (30/07/2026)

L'écran `alim` de la maquette principale ne couvrait que le journal, en cartes plates. La maquette
[FitTrio - Nutrition.dc.html](FitTrio%20-%20Nutrition.dc.html) le **remplace** et étend le pilier à
ses **10 écrans** : journal · détail d'entrée (sheet) · sélection d'aliment · scan code-barres ·
saisie rapide en texte · aliment perso · recette · profil nutritionnel · statistiques · gestion des
repas. États particuliers navigables depuis le rail de gauche : journée vide, objectif absent, et
les **5 états de scan** (recherche, produit inconnu, fiche partielle, réseau, permission).

Décisions structurantes actées par la maquette (détail dans son
[README](FitTrio%20-%20Nutrition.README.md)) :

- **Carte « Bilan du jour »** en 2 variantes basculables (**anneau** calorique SVG vs **chiffres**
  typographiques, restant en Bricolage 70px) — *le choix entre les deux reste à trancher*.
- **Ajout d'aliment contextuel** : pas de FAB. Chaque en-tête de repas porte « + Ajouter un
  aliment » et ouvre un **sheet exposant les 3 modes** (Rechercher · Scanner · Texte libre).
- **Grille micronutriments à couverture** : mini-anneaux + code couleur (vert ≥ 70 %, ambre
  45–69 %, terracotta < 45 %) à la place de la liste de valeurs.
- **Contrastes renforcés** : textes atténués assombris (`--mut`, `--sub`), texte toujours `#fff`
  sur fond accent — cf. l'exigence WCAG AA (US 9.12).

---

## Design tokens

### Typographies (Google Fonts)

| Rôle | Police | Graisses | Usage |
|---|---|---|---|
| Display / titres | **Bricolage Grotesque** | 500–800 | h1/h2, gros chiffres. `letter-spacing` serré (−.6 à −1.5px) |
| Corps / UI | **Hanken Grotesk** | 400–700 | Textes, boutons, labels |
| Mono / chiffres | **Space Mono** | 400/700 | Heure, kg, reps, chronos, badges numériques |

### Couleurs sémantiques (clair / sombre)

Le thème bascule via `:root[data-theme="dark"]`. Tokens sémantiques :

| Token | Clair | Sombre | Rôle |
|---|---|---|---|
| `--txt` | `#33291f` | `#f4ecdd` | Texte principal |
| `--panel` | `#33291f` | `#30271e` | Fond des cartes « sombres » (héros) |
| `--acc` | `#c0562f` | `#dd6e40` | Accent (terracotta) — CTA, actifs |
| `--acc-rgb` | `192,86,47` | `221,110,64` | Accent en RGB (ombres/halos `rgba`) |
| `--grn-t` | `#7c8a5b` | `#a9ba7e` | Vert « tint » (succès, tendances +) |
| `--grn-s` | `#7c8a5b` | `#8ca063` | Vert « solid » (validations) |
| `--scrim` | `#2a2118` | `#16100b` | Fond plein écran des vues **live** |
| `--fsh` | `rgba(60,40,20,.55)` | `rgba(0,0,0,.62)` | Ombre portée du téléphone |
| `--desk1/2/3` | beiges | bruns foncés | Dégradé du fond « bureau » (hors app) |

**Palette brute auto-thémée.** En plus des sémantiques, la maquette définit ~50 tokens
`--c_<hex>` (ex. `--c_fffaf2`, `--c_ece0cd`) qui portent leur valeur claire **et** une valeur
sombre remappée. Surfaces et bordures les plus fréquentes :

| Token | Rôle |
|---|---|
| `--c_fffaf2` | Surface de carte claire (crème) |
| `--c_ece0cd` / `--c_e8dcc9` | Bordures de cartes / séparateurs |
| `--c_e0d0b6` | Bordure de champs de saisie |
| `--c_eadcc6` | Fond des barres de progression |
| `--c_96856f` / `--c_8a7458` | Textes secondaires / atténués |
| `--c_3a2e22` / `--c_5c4a35` | Textes quasi-noirs sur fond clair |
| `--c_f3ddd0` + `--c_a34e2c` | Fond « tint accent » + texte accent foncé (badges records, surbrillance) |
| `--c_f0e4d0` / `--c_c9b79a` / `--c_d9a888` | Textes clairs / atténués / accent-clair **sur `--panel`** |

> Pour le portage RN, préférer **régénérer une échelle nommée** (surface/border/text/…) plutôt
> que reporter les `--c_<hex>` ; ne conserver que le mapping clair↔sombre.

### Rayons, tailles, ombres

- **Cadre téléphone** : 392×812, `border:9px` (`--c_241c15`), `border-radius:46px`.
- **Cartes** : 20–24px · **tuiles/stats** : 14–18px · **champs/segments** : 14–16px.
- **Boutons** : hauteur 48–56px, rayon 14–18px · **puces/chips** : `999px` · **icônes** : 11–15px.
- **CTA accent** : `background:var(--acc); color:#fff; box-shadow:0 10px 24px -8px rgba(var(--acc-rgb),.55)`.
- Animations clés : `prpop` (toast record), `sheetup` (bottom sheet timer), `pulsedot` +
  `dashmove` (carte GPS), `fadeslide` (étapes onboarding).

### Composants récurrents

- **Carte héros** (`--panel`, texte clair, halo accent en overflow) — séance du jour, sorties, bilan calorique.
- **Carte claire** (`--c_fffaf2` + bordure `--c_ece0cd`) — tuiles de stats, listes, repas.
- **Anneau de progression** (SVG `circle` + `stroke-dasharray/offset`) — calories, timer de repos.
- **Barre de progression** (piste `--c_eadcc6` + remplissage `--acc`) — programme, macros, volume.
- **Chips/pills** (`999px`) — filtres, restrictions, tags muscles.
- **Barre d'onglets** basse — 4 icônes SVG, couleur active `--acc` / inactive `--c_a8967d`.
- **Bottom sheet** (timer de repos) + **toast** (record) en overlay `position:absolute` dans le cadre.

---

## Repères pour l'implémentation RN (plus tard, après validation)

Aide-mémoire — **rien à coder maintenant** :

- **Tokens → thème** : porter les sémantiques (`txt`, `panel`, `acc`, `grn`, `scrim`) + le
  mapping clair/sombre dans un thème (ex. Zustand + provider), pas en variables CSS.
- **Polices** : charger Bricolage Grotesque / Hanken Grotesk / Space Mono via `expo-font`.
- **i18n** ([CLAUDE.md](../CLAUDE.md), décision G) : la maquette est **en dur en français**.
  Toutes les chaînes (« Créer mon compte », « Séance du jour », labels…) devront passer par
  i18next **FR + EN** — aucune string en dur.
- **Offline-first** (décision B) : les données affichées (séries, repas, poids, records) sont
  factices ; à brancher sur le repository/PowerSync, pas d'appel direct.
- **Piliers opt-in** (décision H) : masquer dynamiquement les onglets des piliers non activés.
- **SVG** : icônes et graphes (anneaux, courbes, carte) → `react-native-svg`.
- **Écrans live** (`muscuLive`, `runLive`) = les plus riches (timers, GPS, animations) ; le
  running est prévu **en dernier** dans l'ordre de build (risque GPS + synchro).
