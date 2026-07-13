# US — Détail programme : séances repliables (expansion inline)

_Spec fonctionnelle. Statut : à valider (brainstorming du 13/07/2026). Branche cible :
`feature/detail-programme-seances-repliables` (depuis `dev`)._

## 1. Contexte & problème

Sur les écrans de **détail d'un programme**, chaque séance est rendue dans une carte qui affiche
**tout son contenu en permanence** :
- **Muscu** ([programs/[id].tsx](../../../../apps/mobile/src/app/programs/[id].tsx), `SessionCard`) :
  nom + liste des exercices (chaque `PlanRow` = nom + objectifs séries/reps/charge/repos) + bouton
  « Démarrer cette séance ».
- **Running** ([running-programs/[id].tsx](../../../../apps/mobile/src/app/running-programs/[id].tsx),
  `RunningSessionCard`) : nom + puces (type de séance, cible distance/durée) + allure cible dérivée.

Deux gênes, remontées par Florian le 13/07/2026 (capture device) :
1. **Nom d'exercice tronqué à ~1 caractère** (« T… », « P… ») dans `PlanRow` (muscu) : le nom
   (`flex: 1`, `numberOfLines={1}`) partage **la même ligne** que les objectifs (`flexShrink: 0`) en
   `space-between` ; les objectifs ne rétrécissent pas et écrasent le nom → on ne lit plus le contenu.
2. **Pas de repli** : pour un programme à plusieurs séances, tout le contenu est déployé d'un coup →
   écran chargé, difficile à parcourir.

## 2. Objectif

Rendre chaque **carte de séance repliable** (repliée par défaut) : un en-tête tappable dévoile le
détail de la séance à la demande, et corriger l'affichage tronqué des noms d'exercices (muscu).
Lecture seule, aucune donnée nouvelle, offline-first inchangé.

## 3. Périmètre

- **Inclus** : écran détail programme **muscu** ET **running**. Motif d'interaction commun ; contenu
  du résumé/détail **adapté au pilier**.
- **Exclu** : détail enrichi (notes, média d'exercice — bloqué par US 8.3), édition, persistance de
  l'état d'ouverture entre visites, animation avancée. Écrans d'édition de programme (`edit.tsx`).

## 4. Comportement (commun aux deux piliers)

- **État initial** : toutes les séances **repliées** au montage de l'écran.
- **État éphémère** : l'ouverture/fermeture n'est **pas persistée** — se réinitialise à chaque
  entrée sur l'écran (état local composant, `useState`).
- **Ouverture indépendante** : chaque séance s'ouvre/se ferme séparément ; **plusieurs** peuvent être
  dépliées simultanément (pas d'accordéon).
- **Zone tappable** : **toute la ligne d'en-tête** (nom + résumé + chevron) bascule replié/déplié.
- **Indicateur** : chevron `▸` (replié) → `▾` (déplié), avec rotation.
- **Accessibilité** : en-tête `accessibilityRole="button"` + `accessibilityState={{ expanded }}`.
- **Animation** : sobre (rotation du chevron + apparition de la liste). Implémentation au choix du
  dev (rendu conditionnel + reanimated léger ou `LayoutAnimation`) ; ne doit pas bloquer si l'anim
  n'est pas dispo (dégrader en toggle instantané).

## 5. Muscu — `SessionCard`

- **En-tête (toujours visible)** : `Nom de séance` (gauche) · `N exercices` + chevron (droite).
- **Bouton « Démarrer cette séance »** : **toujours visible** (replié comme déplié), rendu **hors**
  de la zone tappable d'expansion (élément séparé, sous l'en-tête) → aucun conflit de geste. Le
  bouton n'apparaît que si la séance a ≥ 1 exercice (comportement actuel conservé).
- **Contenu déplié** : la **liste des exercices** (`PlanRow`) apparaît entre l'en-tête et le bouton.
- **Séance sans exercice** : en-tête affiche `0 exercice` ; dépliée → message vide existant
  (`programs.detail.emptyPlans`) ; pas de bouton Démarrer (inchangé).
- **Fix bug #1 (nom tronqué)** dans `PlanRow` : passer nom et objectifs sur **deux lignes** —
  nom sur sa propre ligne (`numberOfLines={2}`, pleine largeur), objectifs (`3 séries · 3 reps ·
  … · 10 s repos`) **en dessous** en `textMuted`. Suppression du `space-between` sur une seule ligne.

## 6. Running — `RunningSessionCard`

- **En-tête (toujours visible)** : `Nom de séance` (gauche) · **résumé = type + cible** (ex.
  « Endurance · 8 km », séparés par ` · `) + chevron (droite). Chaque partie est omise si absente
  (type seul, cible seule, ou rien).
- **Pas de bouton Démarrer** : les actions sont au niveau **programme** (activer / éditer / dupliquer
  / supprimer) — inchangées, hors des cartes.
- **Contenu déplié** : les **puces** (type + cible distance/durée) + la ligne d'**allure cible**
  dérivée (ou le hint « profil coureur requis » quand `ref5kPaceSPerKm` est absent) — soit le contenu
  actuel de la carte.

## 7. i18n

- Nouvelle clé pluralisée **`programs.detail.exerciseCount`** (muscu) : FR « {{count}} exercice » /
  « {{count}} exercices » ; EN « {{count}} exercise » / « {{count}} exercises ».
- Running : réutiliser les libellés existants (`running.sessionType.*`) pour le résumé d'en-tête ;
  pas de nouvelle clé attendue.
- **Aucune chaîne en dur** ; parité FR/EN maintenue.

## 8. Données / offline

- Aucune table, migration, requête ni dépendance native. Compteur muscu = `session.plans.length`.
- 100 % lecture locale, offline-first inchangé. **Pas de checkpoint cloud.**

## 9. Tests

- Pas de logique métier nouvelle → **smoke test** que la carte se rend en replié puis en déplié
  (muscu et running) sans crash.
- Parité i18n (nouvelle clé présente FR + EN).
- Le risque principal est **visuel** (layout replié/déplié, fix nom 2 lignes) → validé à la
  **maquette** (Claude Design) puis en **recette device**.

## 10. Décisions & points ouverts

- **Décidé** (brainstorming) : repliées par défaut · en-tête tappable · ouverture indépendante ·
  état éphémère · Démarrer toujours accessible (muscu) · running aligné sur le même motif.
- **Tranché** (13/07/2026) : le **résumé d'en-tête running** = **type + cible** (« Endurance · 8 km »),
  chaque partie omise si absente.

## 11. Definition of Done

- Séances repliées par défaut, dépliables indépendamment, sur les 2 écrans (muscu + running).
- Bouton Démarrer (muscu) accessible en replié ; noms d'exercices non tronqués en déplié.
- typecheck / lint / tests verts ; parité i18n. Maquette validée + recette device.
