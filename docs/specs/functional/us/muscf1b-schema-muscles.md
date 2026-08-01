---
id: MUSC-F1b
titre: "Muscles ciblés sur schéma corporel — anatomie fine"
roadmap: [6.2]
catalogue: []
etape: recette
branche: feature/muscf1b-schema-muscles
maj: 02/08/2026
---

# US MUSC-F1b — Muscles ciblés sur schéma corporel (Voie B)

> **Recadrage du 01/08/2026.** La première version de cette spec (30/07/2026) recommandait la
> **Voie A** (6 zones larges, celles que la base connaît déjà) plutôt qu'une anatomie fine, pour
> deux raisons : le coût d'une nouvelle taxonomie, et une bibliothèque d'exercices jugée « encore
> vide ». **La seconde raison n'est plus exacte** — CONTENU-01 a livré 16 exercices le 29/07/2026,
> avant même la première rédaction de cette spec. Florian a validé la **Voie B** (anatomie fine) en
> connaissance de cause. Cette version remplace entièrement la précédente.

## 0. Le vrai risque de la Voie B, et comment on l'évite

**Le système actuel de 6 groupes larges (`musclePrimary`/`musclesSecondary`,
[exercise.ts](../../../../packages/shared/src/exercise.ts)) est utilisé dans 18 fichiers** :
l'alerte de déséquilibre musculaire (MUSC-05, `muscle-balance.ts`), le graphique de volume par
groupe (`MuscleVolumeCard`), le remplacement d'exercice (`exercise-substitution.ts`), le filtre de
bibliothèque (`exercise-filter.ts`), l'écran admin. **Remplacer ce système** par une anatomie fine
ferait dépendre toutes ces fonctionnalités déjà livrées et recettées d'une nouvelle taxonomie — le
même risque que REFACTO-01 a évité en touchant le moins de code possible.

**Décision de conception (posée, pas à valider — elle découle directement du risque ci-dessus)** :
cette US est **additive**. Les 6 groupes larges ne bougent pas, ne sont pas dépréciés, continuent de
servir exactement ce qu'ils servent aujourd'hui. Une **nouvelle colonne indépendante**
`muscles_fine` porte l'anatomie fine, utilisée **uniquement** par le nouveau schéma corporel.

## 1. La taxonomie — reprise, pas inventée

`docs/specs/functional/administration.md` §3.3 décrit depuis le 04/07/2026, **jamais implémenté**,
un référentiel de 10 muscles en français courant :

> Pectoraux, Dos, Épaules, Biceps, Triceps, Abdominaux, Fessiers, Quadriceps, Ischio-jambiers,
> Mollets.

C'est cette liste, pas une invention à 15-20 muscles. Elle est délibérément plus grossière qu'une
planche d'anatomie (pas de deltoïde antérieur/moyen/postérieur, pas d'adducteurs séparés) — le
niveau choisi par le produit en juillet, avant même que ce sujet ne soit rouvert.

| Clé technique | Label FR | Label EN | Vue(s) où le muscle s'affiche |
|---|---|---|---|
| `chest` | Pectoraux | Chest | face |
| `back` | Dos | Back | dos |
| `shoulders` | Épaules | Shoulders | face **et** dos |
| `biceps` | Biceps | Biceps | face |
| `triceps` | Triceps | Triceps | dos |
| `abs` | Abdominaux | Abs | face |
| `glutes` | Fessiers | Glutes | dos |
| `quadriceps` | Quadriceps | Quadriceps | face |
| `hamstrings` | Ischio-jambiers | Hamstrings | dos |
| `calves` | Mollets | Calves | dos |

**Conséquence utile** : seuls les épaules apparaissent sur les deux vues → **11 tracés SVG au
total** (5 en face, 6 au dos), pas 20. Nettement plus tractable que l'anatomie complète envisagée
au premier abord.

⚠️ `chest`/`back`/`shoulders` portent **la même clé** que leur équivalent dans `MUSCLE_GROUPS` (les
6 groupes larges) — ce sont deux champs distincts (`musclePrimary` vs `musclesFine`), aucune
collision de code, mais à garder en tête en relisant les diffs.

## 2. Le lien avec les 6 groupes larges — une seule fonction de résolution

Chaque groupe large **s'étend** vers un ou plusieurs muscles fins :

```ts
const BROAD_TO_FINE: Record<MuscleGroup, FineMuscle[]> = {
  chest: ['chest'],
  back: ['back'],
  shoulders: ['shoulders'],
  arms: ['biceps', 'triceps'],       // on ne sait pas lequel spécifiquement → les deux
  legs: ['quadriceps', 'hamstrings', 'calves'],
  core: ['abs'],
};
```

**Une seule fonction pure** décide quoi éclairer sur le schéma, pour n'importe quel exercice :

```ts
function resolveFineMuscles(exercise: {
  musclePrimary: MuscleGroup;
  musclesSecondary: MuscleGroup[];
  musclesFine: FineMuscle[];
}): { full: FineMuscle[]; reduced: FineMuscle[] } {
  if (exercise.musclesFine.length > 0) {
    // Tagué fin : tout à pleine émphase — la précision EST la nuance, pas besoin d'un 2ᵉ niveau.
    return { full: exercise.musclesFine, reduced: [] };
  }
  // Pas encore tagué : repli sur les groupes larges, même émphase à deux niveaux qu'avant (R1
  // de la version précédente de cette spec) — primaire plein, secondaires à ~35 %.
  return {
    full: BROAD_TO_FINE[exercise.musclePrimary],
    reduced: exercise.musclesSecondary.flatMap((m) => BROAD_TO_FINE[m]),
  };
}
```

**C'est ce qui résout le problème d'honnêteté de la version précédente** (§0 de la v1 : « sur un
curl, il faudrait éclairer tout le bras, triceps compris ») — mais **seulement une fois l'exercice
tagué fin**. Tant qu'il ne l'est pas, le repli reproduit fidèlement l'ancien défaut (un curl non
tagué éclaire biceps **et** triceps) — c'est le prix de l'amélioration progressive, assumé et
documenté, pas caché.

**Un seul chemin de rendu** (fiche, aperçu de séance, bilan hebdo) : chacun agrège des
`resolveFineMuscles(...)` par exercice, jamais deux logiques de rendu séparées « fin » et
« large ».

## 3. Périmètre

**Dans le périmètre** :
1. **`muscles_fine` sur `exercises`** — colonne `jsonb`, `default '[]'`, additive (migration
   symétrique à celle de `muscles_secondary`, US MUSC-F10c-1). **Aucune sync rule à redéployer** :
   la sync rule de `exercises` est `select *` ([powersync-sync-rules.yaml](../../technical/powersync-sync-rules.yaml)), une colonne en plus n'exige rien de plus.
2. **Écran admin** — section « Muscles fins (optionnel) » sur la fiche exercice, **groupée
   visuellement par région** (Haut du corps : Pectoraux/Dos/Épaules/Biceps/Triceps · Bas du corps :
   Quadriceps/Ischio-jambiers/Mollets/Fessiers · Tronc : Abdominaux) — 10 checkboxes seraient un mur
   illisible en vrac (constaté en cartographiant l'écran actuel), le regroupement est nécessaire.
3. **`<BodyMap />`** — composant `react-native-svg` (déjà présent, aucune dépendance nouvelle),
   deux vues (face/dos), 11 tracés à main levée, rendu à deux niveaux d'émphase (`full`/`reduced`,
   §2). Utilisé aux 3 endroits déjà prévus par la v1 :
   - fiche d'exercice (un exercice) ;
   - aperçu de séance avant démarrage (union des exercices de la séance) ;
   - bilan hebdomadaire (intensité relative au **tonnage** de la semaine, R3 ci-dessous).
4. **Tagging des 16 exercices existants par un coach** (Florian/Damien, ou toute personne
   compétente) — **hors dev, hors code**. ~1-2h pour 16 exercices (2-4 muscles chacun en moyenne).
   L'US **ne bloque pas** sur ce travail : elle livre et fonctionne (en repli large) avant qu'il ne
   soit fait, et s'améliore exercice par exercice au fur et à mesure du tagging.

**Hors périmètre**, inchangé depuis la v1 : l'animation du mouvement (6.1, abandonné), la vue
latérale, la distinction gauche/droite. **Nouveau, explicitement exclu** : remplacer les 6 groupes
larges dans l'alerte de déséquilibre / le filtre / le remplacement d'exercice — voir §0.

## 4. Règles

**R1 — Deux niveaux d'émphase au repli large, un seul niveau une fois tagué fin.** Voir §2. Pas de
troisième niveau : illisible à la taille d'affichage (héritée de la v1).

**R2 — Un muscle non sollicité n'est pas « éteint », il est neutre.** Inchangé depuis la v1.

**R3 — Bilan hebdomadaire : échelle relative au tonnage de la semaine.** Le muscle fin le plus
sollicité (tonnage agrégé de tous les exercices qui le ciblent, via `resolveFineMuscles`) = pleine
émphase ; les autres au prorata. Inchangé en esprit depuis la v1, calculé maintenant en espace
« muscle fin » plutôt qu'en espace « groupe large ».

**R4 — Les vues face et dos sont toutes les deux nécessaires.** `back`, `triceps`, `glutes`,
`hamstrings`, `calves` n'existent que sur la vue de dos ; `chest`, `biceps`, `abs`, `quadriceps`
que sur la vue de face ; `shoulders` sur les deux (§1).

**R5 — Le schéma reste un complément, jamais le seul porteur d'information.** La liste textuelle
des muscles sollicités reste affichée à côté (inchangé depuis la v1, condition de l'accessibilité
§6).

## 5. Rendu SVG — le vrai risque de cette US

`react-native-svg` (déjà présent) suffit techniquement. Le risque n'est pas la bibliothèque, c'est
la **justesse anatomique** des 11 tracés : contrairement aux 6 zones larges et stylisées de la v1,
une silhouette où « biceps » et « triceps » sont visuellement confondus, ou où « quadriceps » et
« ischio-jambiers » se chevauchent sur la vue de face, **rate l'objectif même de la Voie B**.

→ **Une maquette dédiée** (`design/muscf1b-schema-muscles/`) est produite **avant** le code,
montrant les 11 tracés sur les deux vues, chaque muscle isolé et nommé — pour que la relecture
anatomique (critère de recette 12) se fasse sur le dessin, pas sur l'app une fois codée.

## 6. i18n

Nouvelle famille `muscleFine.*` (10 clés, FR+EN, §1). Plus les 2 clés d'accessibilité déjà prévues
par la v1 : `bodyMap.a11yLabel`, `bodyMap.frontBack`.

## 7. Accessibilité

Inchangé depuis la v1 : `accessibilityLabel` énonçant les muscles sollicités, liste textuelle
toujours présente (R5), contraste de remplissage 3:1 contre la silhouette (palette CONF-07).

## 8. Comportement offline

**Total.** Tracés SVG en dur dans le bundle, données (`musclesFine` compris) lues depuis PowerSync
local. Aucun réseau, aucune image distante.

## 9. Critères de recette

- [ ] 1. Fiche d'un exercice **non tagué fin** (les 16 actuels, au départ) : repli large identique
      au comportement décrit par la v1 (primaire plein, secondaires à ~35 %).
- [ ] 2. Un coach tague un exercice (ex. Curl biceps → `biceps`) : sa fiche affiche **seulement**
      biceps, plus le triceps qu'affichait le repli large.
- [ ] 3. Fiche d'un exercice sans secondaire : un seul muscle éclairé, aucun résidu.
- [ ] 4. Aperçu d'une séance mêlant exercices tagués et non tagués : l'union se fait correctement
      dans les deux cas, sans doublon d'émphase.
- [ ] 5. Bilan hebdo : le muscle le plus travaillé (par tonnage agrégé) est le plus marqué (R3).
- [ ] 6. Semaine vide : silhouette neutre, pas d'écran cassé ni de division par zéro.
- [ ] 7. Vue de dos atteignable et correcte — sans elle, 6 des 10 muscles ne s'affichent nulle part
      (R4).
- [ ] 8. Thème clair et sombre : la silhouette reste lisible dans les deux.
- [ ] 9. TalkBack énonce les muscles sollicités ; la liste textuelle est là (R5).
- [ ] 10. Mode avion : le schéma s'affiche (aucune ressource distante).
- [ ] 11. En EN : « Front »/« Back », les 10 noms de `muscleFine.*` et l'annonce d'accessibilité
      sont en anglais.
- [ ] 12. 🔴 **Le critère qui juge tout le reste** : montrer les deux vues (maquette §5, puis l'app
      une fois codée) à quelqu'un qui connaît l'anatomie. S'il dit « ça ne ressemble pas à des
      biceps » ou « je ne distingue pas quadriceps et ischio-jambiers », c'est un rejet — retour au
      dessin, pas au modèle de données.
- [ ] 13. Écran admin : les 10 checkboxes sont groupées par région (Haut du corps / Bas du corps /
      Tronc), pas un mur en vrac.

## 10. Ce qui reste hors code

Le tagging des 16 exercices (§3.4) — travail de coach, à faire à son rythme, sans bloquer la
recette du reste. Le critère de recette 1 (repli large) et le critère 2 (une fois tagué) peuvent
donc être vérifiés **avant** que le tagging ne soit terminé.
