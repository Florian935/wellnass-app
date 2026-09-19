---
id: MUSCU-FIX01
titre: "Les flux de la séance de musculation — séance libre, ajout d'exercice, annuaire, silhouette"
roadmap: [3.59]
catalogue: []
etape: recette
branche: dev
maj: 19/09/2026
---

# US MUSCU-FIX01 — Les flux de la séance de musculation

> Issue de la **recette du 19/09/2026** (Florian, sur device) : trois défauts qui se cumulaient sur
> le même parcours — « Séance libre » depuis le hub muscu — plus la silhouette de la scène.
>
> ⚠️ **Travail directement sur `dev`** (décision Florian).
>
> 🔎 **Aucune fonctionnalité nouvelle, aucune écriture nouvelle.** Trois chemins qui existaient déjà
> et qui ne menaient nulle part.

## 1. Le problème

Appuyer sur « Séance libre » donnait : un écran noir pendant plusieurs secondes, puis « Aucune
séance en cours » avec un bouton de retour, puis enfin la séance — vide, sans aucun moyen visible
d'y ajouter un exercice. Et le démarrage depuis un modèle, possible auparavant, avait disparu.

### 1.1 « Chargement » était confondu avec « absent »

`useActiveWorkout()` renvoie `{ workout, isLoading }`. Quatre écrans ne lisaient que `workout` :

| Écran | Conséquence |
|---|---|
| `app/workout.tsx` | « Aucune séance en cours » **sur la séance qu'on venait de créer** — l'écran noir |
| `app/exercises.tsx` | la garde `if (active)` **avalait l'appui en silence** : ni ajout, ni retour, ni message |
| `app/planning/index.tsx` | le bouton affichait « Démarrer » puis basculait sur « Reprendre » sous le doigt |
| `app/workout-brief.tsx` | sans effet : l'écriture est protégée en amont (démarrage idempotent) |

Le patron correct existait déjà dans le dépôt (`strength-hub-repository.ts`,
`dashboard-repository.ts`, `app/templates/index.tsx`), et le mock de `workout-screen.test.tsx`
renvoyait déjà `isLoading: false` — la suite avait été écrite pour un écran qui lit ce champ.

### 1.2 La séance vide n'avait pas de barre d'action

`workout.tsx` : `current ? <SetActionBar/> : entries.length > 0 ? <barre de clôture/> : null`. À zéro
exercice, la troisième branche rendait `null`. Or **une séance libre démarre toujours à zéro
exercice** : son écran d'arrivée était un cul-de-sac. Le seul « + Ajouter un exercice » vivait
derrière les trois points.

### 1.3 Les templates n'avaient plus aucun point d'entrée

`/templates` n'était atteignable que par le choix « Depuis un template » de la séance libre — qui ne
s'affiche **qu'à partir d'un template** (arbitrage délibéré : pas de choix à une seule issue,
verrouillé par un test). Or l'unique écran permettant d'en créer un est `/templates` lui-même.
**À zéro template — l'état de tout compte neuf — la fonctionnalité était inatteignable.**

US MUSCU-UX01 (10/09/2026) avait retiré le widget `strength-templates` du hub en désignant
explicitement « la ligne d'annuaire *Exercices, programmes, templates* » comme destination de repli.
Cette ligne existe — c'est l'icône 📚 de la scène — elle porte ce libellé exact dans `fr.json`, et
elle ouvrait `/exercises?mode=browse` : un annuaire d'exercices seuls. **La destination promise n'a
jamais été construite.**

### 1.4 La silhouette de la scène

« C'est tout carré, c'est tout segmenté. » Le tracé était un mannequin : segments rectangulaires
séparés par des trous, arêtes droites, entrejambe à 126 sur 190 (jambes trop courtes sous un buste
trop large).

## 2. Les règles

- **R1.** Un écran qui dépend d'une requête ne doit jamais présenter « pas de données » tant que la
  requête n'a pas répondu. Il attend, visiblement.
- **R2.** Un écran de séance porte **toujours** le geste suivant dans sa barre d'action, y compris à
  zéro exercice.
- **R3.** Un appui sur une liste d'ajout n'est **jamais** avalé en silence : soit la liste attend,
  soit l'ajout se fait.
- **R4.** L'annuaire tient son libellé : « Exercices, programmes, templates » mène aux trois.
- **R5.** Les templates ont un point d'entrée **permanent**, indépendant du nombre de templates —
  celui que l'US Refonte-D leur avait donné le 22/07/2026.
- **R6.** La règle « pas de choix à une seule issue » sur la séance libre **n'est pas touchée** :
  c'est un arbitrage délibéré, et le problème n'était pas là.
- **R7.** La silhouette : canon 7,5 têtes, formes qui se chevauchent sous un même remplissage
  (aucune couture possible), **aucune arête droite**, zones musculaires détourées par le corps.

## 3. Ce qui est livré

| Fichier | Changement |
|---|---|
| `app/workout.tsx` | lit `isLoading` ; indicateur d'attente ; barre « + Ajouter un exercice » à zéro exercice |
| `app/exercises.tsx` | lit `isLoading` : la liste n'est pas tapable tant que la séance n'est pas connue |
| `app/planning/index.tsx` | bouton en attente tant que la séance n'est pas connue |
| `components/strength/DirectorySheet.tsx` | **neuf** — les trois destinations de l'annuaire |
| `app/(tabs)/strength.tsx` | l'icône 📚 ouvre la feuille au lieu d'aller aux seuls exercices |
| `components/stage/matter/ImpactSilhouette.tsx` | corps redessiné, zones détourées, id de détourage unique |
| `i18n fr/en` | `strengthHub.directorySheet.*` |

## 4. Tests-gardes

6 tests ajoutés, un par défaut corrigé : chargement ≠ absence (`workout`, `exercises`), ajout visible
à zéro exercice, et les trois destinations de l'annuaire (dont templates **à zéro template**).

## 5. Recette

[RECETTES.md §76](../../../../RECETTES.md) — 12 critères.
