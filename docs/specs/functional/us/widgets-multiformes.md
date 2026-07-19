# US Widgets — Grille multi-formes (accueil · muscu · course)

> **Chantier Widgets modulaires.** Généralise le système de personnalisation du dashboard
> (US 7.1/7.2/7.3/7.11/7.12) en un **moteur de widgets multi-formes** partagé par les **3 hubs** :
> accueil, muscu, course. Chaque module devient un widget que l'utilisateur peut poser en
> **3 formes** (petit carré demi-largeur, rectangle pleine largeur, grand carré pleine largeur),
> réordonner et masquer.
> Branche : `feature/widgets-multiformes` · Date : 19/07/2026 · **Statut : à valider (pas de code avant validation).**
> **Migration : aucune migration SQL** (Option A §6 verrouillée — JSON étendu, rétro-compatible).

## 0. Contexte

Aujourd'hui seul l'**accueil** ([(tabs)/index.tsx](../../../../apps/mobile/src/app/%28tabs%29/index.tsx))
possède un système de widgets :

- Registre + logique pure dans [packages/shared/src/dashboard.ts](../../../../packages/shared/src/dashboard.ts) :
  `DASHBOARD_WIDGET_IDS` (9 widgets), `WidgetSize = 'full' | 'compact'`, `resolveDashboardLayout`,
  `moveWidget`, filtrage par piliers actifs (`WIDGET_PILLARS`).
- Persistance dans `user_settings.dashboard_layout` (JSON TEXT PowerSync), via
  [dashboard-layout-repository.ts](../../../../apps/mobile/src/data/repositories/dashboard-layout-repository.ts) —
  **aucune migration** (colonne déjà présente), offline-first.
- Édition : liste **1 colonne**, drag-to-reorder ([SortableDashboard](../../../../apps/mobile/src/components/dashboard/SortableDashboard.tsx)),
  masquer/afficher + **bascule de taille binaire** `compact ↔ full` ([DashboardEditControls](../../../../apps/mobile/src/components/dashboard/DashboardEditControls.tsx)).
  Les deux tailles actuelles sont **pleine largeur** (`full` = carte normale, `compact` = ligne fine).

Les hubs **muscu** ([(tabs)/strength.tsx](../../../../apps/mobile/src/app/%28tabs%29/strength.tsx)) et
**course** ([(tabs)/running.tsx](../../../../apps/mobile/src/app/%28tabs%29/running.tsx)) sont, eux,
**codés en dur** : une carte d'action contextuelle en tête, puis une pile de `ModulePreviewCard`
non personnalisable.

**Décisions de cadrage (Damien, 19/07/2026) :**
- **Périmètre = les 3 hubs d'un coup** (accueil + muscu + course).
- **Remplacer** le modèle `full | compact` par **3 formes** `small` (petit carré) / `wide` (rectangle) /
  `large` (grand carré). **Migration** de l'existant : `full → wide`, `compact → small`.
- Muscu / course : **réutiliser les cartes existantes** (les `ModulePreviewCard` deviennent des widgets).

## 1. Périmètre à livrer

- **Moteur de widgets générique** dans `packages/shared` (logique pure, testée Vitest) : nouveau modèle
  de tailles à 3 formes, packing en grille 2 colonnes, résolution/masquage/réordonnancement **par hub**.
- **3 registres de widgets** (un par hub), consommés par un composant de grille partagé.
- **Migration douce** du layout stocké (ancien `full|compact` 1 colonne → nouveau modèle 3 formes),
  **sans perte** et **sans migration SQL** (§6).
- **Grille de rendu 2 colonnes** avec packing des `small` (2 côte à côte), `wide`/`large` pleine largeur.
- **Édition** : réordonnancement (drag), masquer/afficher, **sélecteur de forme à 3 états**.
- **Câblage des 3 hubs** : accueil (9 widgets existants), muscu (4 modules), course (3 modules),
  cartes d'action contextuelles **épinglées** hors grille (§2.4).
- **i18n** FR/EN de tous les nouveaux libellés ; **offline-first**.

**Hors périmètre :**
- Nouveaux widgets métier (on réutilise l'existant ; §3).
- Nutrition (l'onglet nutrition n'entre pas dans ce lot).
- Drag-and-drop **en grille 2D** libre (déplacement case par case) — le réordonnancement reste **linéaire**
  (voir §2.3, note MVP) ; le packing 2 colonnes est **dérivé** de l'ordre.
- Redimensionnement au geste (pincer/étirer) — la forme se change via le sélecteur à 3 états.

## 2. Comportement attendu

### 2.1 Les 3 formes

| Forme | `WidgetSize` | Largeur | Gabarit | Par ligne |
|---|---|---|---|---|
| Petit carré | `small` | **½ écran** (moins la gouttière) | ~carré (ratio ≈ 1:1) | **2 côte à côte** |
| Rectangle | `wide` | **pleine largeur** | bas (rectangle horizontal) | 1 |
| Grand carré | `large` | **pleine largeur** | haut (~carré plein) | 1 |

Chaque composant widget reçoit `size` et **adapte son contenu** à la forme : `small` = version condensée
(titre + 1 métrique clé), `wide` = version linéaire riche (comportement des cartes actuelles), `large` =
version développée (titre + métrique + aperçu étendu / graphe si disponible).

### 2.2 Packing de la grille (mode affichage)

La liste **ordonnée + visible** est parcourue dans l'ordre et coulée dans une grille **2 colonnes** :

- un `small` occupe **1 colonne** ; deux `small` **consécutifs** se placent **sur la même ligne** ;
- un `wide` ou `large` occupe **les 2 colonnes** (pleine largeur) et **force le passage à une nouvelle ligne** ;
- un `small` **isolé** (suivi d'un widget pleine largeur, ou dernier de la liste) occupe la **colonne
  gauche**, la colonne droite reste **vide** (pas de réagencement qui casserait l'ordre choisi) ;
- gouttière verticale et horizontale = **14 px** (constante `SPACING` déjà utilisée).

> Le packing est **déterministe** et dérivé du seul **ordre** : réordonner suffit à apparier/désapparier
> deux `small`. Aucune notion de « position dans la grille » n'est stockée — seulement `ordre + forme`.

### 2.3 Édition

Bouton **Personnaliser** (comme l'accueil aujourd'hui) sur **chacun des 3 hubs**. En édition :

- chaque widget montre son cadre pointillé + la barre de contrôles ([DashboardWidgetRow](../../../../apps/mobile/src/components/dashboard/DashboardWidgetRow.tsx)) ;
- **poignée de drag** pour réordonner ; **œil** pour masquer/afficher (masquabilité uniforme) ;
- **sélecteur de forme à 3 états** (remplace la bascule binaire) : `small → wide → large → small`,
  avec 3 icônes distinctes et libellés i18n (§4).

> **Note MVP (réordonnancement).** Le drag reste **linéaire** (réordonnancement de la séquence), comme
> aujourd'hui : en édition on présente les widgets **en 1 colonne** (chaque widget à sa forme, mais
> empilé) pour un geste de tri simple et fiable ; le **packing 2 colonnes ne s'applique qu'en mode
> affichage**. Cela réutilise intégralement [SortableDashboard](../../../../apps/mobile/src/components/dashboard/SortableDashboard.tsx)
> sans réécrire un moteur de drag 2D (hors périmètre, §1). À rediscuter si l'ergonomie le justifie.

### 2.4 Cartes d'action contextuelles (muscu / course)

La **carte d'action** en tête des hubs muscu (Reprendre / Séance du jour / Séance libre — cf. US Refonte-B)
et course (Reprendre / Démarrer) **n'est pas un widget** : elle reste **épinglée en haut**, hors grille,
non masquable, non redimensionnable. Seuls les **modules-aperçu** deviennent des widgets.

### 2.5 Persistance & offline

- Écriture **immédiate au drop / au changement de forme / de visibilité** (pas de débounce), locale
  d'abord (PowerSync), comme le repository actuel.
- Chaque hub a **sa propre disposition** ; changer l'un n'affecte pas les autres.
- **Filtrage par piliers** conservé : un widget dont aucun pilier n'est actif est masqué (comme
  `WIDGET_PILLARS` aujourd'hui) — surtout pertinent pour l'accueil transverse.

## 3. Inventaire des widgets par hub (réutilisation de l'existant)

**Accueil** (9, inchangés en identité — seule la forme évolue) : `today-session`, `nutrition-summary`,
`streak`, `weight`, `record-recent`, `muscle-volume`, `running-week`, `deficit-volume`, `training-time`.

**Muscu** (4 — issus des `ModulePreviewCard` actuels) : `strength-programs` (programme actif),
`strength-planning` (mini-calendrier), `strength-history` (2 dernières séances), `strength-progress`
(volume semaine + variation).

**Course** (3) : `running-programs` (programme running actif), `running-planning` (mini-calendrier),
`running-history` (dernière course : distance · durée · allure).

> Le **planning** apparaît sur muscu **et** course : les IDs sont **scopés par hub**
> (`strength-planning` ≠ `running-planning`), chaque hub garde sa disposition indépendante.

## 4. i18n (FR / EN)

Réutiliser l'espace `home.customize.*`, en **généralisant** hors « home » si besoin (ex.
`widgets.customize.*`). Nouveaux libellés à prévoir :

| Clé (proposée) | FR | EN |
|---|---|---|
| `widgets.customize.shapeSmall` | Petit carré | Small square |
| `widgets.customize.shapeWide` | Rectangle | Wide |
| `widgets.customize.shapeLarge` | Grand carré | Large square |
| `widgets.customize.shapeCycle` | Changer la forme | Change shape |

Les libellés existants (`edit`, `done`, `drag`, `hide`, `show`, `hiddenBadge`, `editHint`, `empty`) sont
réutilisés et rendus disponibles aux 3 hubs. **Aucune chaîne en dur** ; parité FR/EN obligatoire.

## 5. Cas limites

- **Layout stocké ancien format** (`{ widgets:[…] }`, tailles `full|compact`) → migré à la lecture :
  `full → wide`, `compact → small`, interprété comme la disposition **de l'accueil** (§6).
- **Widget inconnu** dans le stored (module retiré) → ignoré sans planter (déjà géré).
- **Widget connu absent** du stored (forward-compat) → ajouté en fin, `visible:true`, forme par défaut.
- **Forme invalide** dans le JSON → repli sur la forme par défaut (`wide` pour l'accueil migré, sinon §7).
- **Aucun widget visible** sur un hub → message vide (`empty`) comme aujourd'hui.
- **Pilier inactif** → widgets du pilier filtrés (course masquée si running non activé, cf. `running.tsx`).
- **`small` isolé en fin de liste** → colonne gauche seule (§2.2), pas de plantage de grille.

## 6. Persistance — décision de stockage (à valider)

Trois dispositions à stocker (accueil / muscu / course). **Décision : Option A (verrouillée §9).**

- **Option A (recommandée) — JSON étendu, rétro-compatible.** On stocke les 3 hubs dans la colonne
  existante `user_settings.dashboard_layout`, en passant du format `{ widgets:[…] }` à
  `{ screens: { home:{widgets…}, strength:{widgets…}, running:{widgets…} } }`. Le parseur accepte
  **les deux formes** : un ancien `{ widgets:[…] }` est lu comme `screens.home`. **Zéro migration SQL**,
  offline-first, cohérent avec l'existant (`parseDashboardLayout` déjà tolérant).
- **Option B — colonnes dédiées.** Ajouter `strength_layout` / `running_layout` (migration SQL +
  régénération des types + checkpoint cloud). Plus explicite mais impose une migration et de la
  plomberie PowerSync.

## 7. Formes par défaut (à valider avec le design)

À trancher à l'étape design (maquette) :
- **Accueil** : migration `full → wide` / `compact → small` ; nouveaux widgets ajoutés en `wide`.
- **Muscu / course** : disposition initiale des modules (tout `wide` pour coller au rendu actuel ? ou
  un mix `small` pour Programmes/Historique et `wide` pour Planning ?).

## 8. Definition of Done

- Logique pure du moteur (tailles, packing, résolution par hub, migration) **testée Vitest**.
- Les 3 hubs affichent leurs widgets en grille et sont **personnalisables** (drag, forme, visibilité).
- Migration douce **vérifiée** (un ancien layout `full|compact` s'ouvre sans perte).
- `npm run typecheck` + `npm run lint -w @wellness/mobile` + `npm run test` **verts**.
- i18n FR/EN complet ; offline-first respecté ; aucune régression sur l'accueil existant.
- Roadmap + TODO mis à jour par `/commit`.

## 9. Décisions verrouillées (Damien, 19/07/2026)

1. **Stockage = Option A** (§6) — JSON étendu `{ screens: { home, strength, running } }` dans la
   colonne existante, parseur rétro-compatible, **sans migration SQL**.
2. **Réordonnancement = drag linéaire (MVP)** (§2.3) — édition en 1 colonne, packing 2 colonnes en
   affichage. Le drag 2D en grille est **hors périmètre** de ce lot.
3. **Formes par défaut muscu/course = mix proposé au design** (§7) — la maquette propose un mélange
   `small`/`wide` ; arbitrage final à la validation du design.
4. **Carte d'action épinglée hors grille** (§2.4) — confirmée : elle ne devient pas un widget.
