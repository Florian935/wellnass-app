---
id: MUSC-F7
titre: "Progression assistée — deload sur stagnation"
roadmap: [3.8]
catalogue: []
etape: recette
branche: feature/muscf7-deload
maj: 01/08/2026
---

# US MUSC-F7 — Progression assistée

## 0. Le backlog en couvre deux, très inégaux — on n'en cadre qu'un

Le [BACKLOG.md](../../../../BACKLOG.md) décrit MUSC-F7 comme « progression auto de charge au niveau
programme (3.7) + câblage du deload (3.8) ». Ce sont **deux chantiers de taille radicalement
différente**, et les traiter dans la même US serait une erreur de cadrage :

### Volet A (3.7) — progression au niveau du programme : **hors périmètre de cette US**

« Charge cible +X d'une semaine à l'autre, si ≥ 80 % complété » suppose des briques qui
**n'existent pas** :
- `exercise_plans.target_weight_kg` est une valeur **unique et figée** par plan
  ([migration 20260706130000](../../../../supabase/migrations/20260706130000_programmes_tables.sql)) —
  aucune ligne par semaine, aucune notion de cible qui évolue.
- `planned_sessions.week_index` est posé **une fois**, à la génération du planning
  ([`generatePlannedSessions`](../../../../packages/shared/src/planning.ts)) — ce n'est pas un
  curseur de progression relu ensuite.
- **Aucun taux de complétion par semaine n'est calculé nulle part** (recherche exhaustive :
  aucune occurrence de « 80 % » / `completionRate` dans le code applicatif).
- La spec Refonte-C3 avait déjà exclu ce sujet, pour la même raison : « nécessiterait une tendance
  multi-séances, pas juste la dernière fois ».

Ce n'est pas un signal manquant sur un mécanisme existant (comme le Volet B) — c'est un **concept de
données à inventer** : où stocker une cible qui évolue (muter `exercise_plans` du programme
personnel actif ? nouvelle table d'historique ?), quelle fenêtre de « semaine » utiliser, quand
déclencher le recalcul, comment l'exposer. Rien de tout ça n'est tranché. L'estimation actuelle du
roadmap (« Moyen, 3h ») est calibrée sur l'hypothèse optimiste du Volet B — elle sous-évalue
largement ce que 3.7 impliquerait réellement.

**Recommandation : traiter 3.7 comme un futur candidat séparé**, avec son propre cadrage produit
(quelle cible ? quelle fenêtre ? quel stockage ?), pas comme un sous-lot de MUSC-F7.

### Volet B (3.8) — deload sur stagnation : **le périmètre de cette US**

Tout le contraire : la brique de calcul est **déjà livrée et testée**
([`computeProgressionSuggestion`](../../../../packages/shared/src/workout.ts), kind `deload`,
5 tests dans `workout.test.ts`), l'UI de restitution **existe déjà** dans
[workout.tsx](../../../../apps/mobile/src/app/workout.tsx) (branche `suggestion.kind === 'deload'`),
et les deux chaînes i18n sont **déjà écrites** en FR et EN (`workout.suggestion.deload`). Il manque
un seul signal, `previousStruggled` — jamais fourni par l'appel actuel — qui rend la branche deload
**inatteignable en pratique** aujourd'hui, malgré tout ce travail déjà fait.

## 1. Ce que fait la règle (déjà écrite, à activer)

Une séance sur un exercice est « difficile » si une série qualifiante est en échec, ou si son RPE
atteint 8+ (`sessionStruggled`, actuellement privée dans `workout.ts`). Si la **dernière** séance sur
l'exercice est difficile **et** que l'**avant-dernière** l'était aussi → suggestion (jamais imposée)
de baisser la charge de 10 % (arrondi au pas de 0,5 kg), affichée exactement comme les autres
suggestions de progression (même composant, même style, aucune UI nouvelle).

## 2. Ce qui manque, précisément

- **`sessionStruggled` n'est pas exportée** de `workout.ts` — nécessaire pour être réutilisée côté
  repository mobile sans dupliquer la règle.
- **Aucune requête ne regarde l'avant-dernière séance qualifiante.**
  [`useLastPerformance`](../../../../apps/mobile/src/data/repositories/workout-repository.ts) ne
  regarde que la dernière (`SELECT_LAST_PERFORMANCE`, sous-requête `ORDER BY finished_at DESC LIMIT 1`).
  Il faut son symétrique avec `OFFSET 1`.
- **L'appel dans `workout.tsx`** ne passe jamais `previousStruggled` à
  `computeProgressionSuggestion` → défaut `false` → la branche deload ne se déclenche jamais.

## 3. Décision à valider (D1)

**Confirmer la règle telle qu'écrite** avant de l'activer réellement en production (elle est
dormante depuis Refonte-C3, jamais revue depuis) :
- 2 séances d'affilée sur le **même exercice**, chacune avec échec **ou** RPE ≥ 8.
- Baisse de **10 %**, arrondi au pas de 0,5 kg.
- Restitution **identique** aux autres suggestions (texte discret sous la série, jamais un
  changement forcé de la charge pré-remplie).

Aucune alternative n'est proposée ici : la règle et son affichage sont déjà entièrement écrits et
copywrités ; le seul choix réel est de les activer ou de les laisser dormants. Si Florian veut un
seuil différent (RPE, nombre de séances, facteur de baisse), ce sont des paramètres nommés
(`opts.deloadFactor`, etc.) — à ajuster sans rouvrir la conception.

## 4. i18n / offline / notifications

Aucune nouvelle chaîne (les 2 clés `workout.suggestion.deload` FR/EN existent déjà). Offline total :
lecture locale PowerSync, aucun réseau. Aucune notification (cohérent avec le reste des suggestions
de progression, jamais poussées).

## 5. Critères de recette

- [ ] Deux séances d'affilée en échec/RPE ≥ 8 sur un même exercice → la 3ᵉ fois qu'on l'aborde, la
      suggestion affichée est bien « 2 séances difficiles de suite — tu peux alléger à X kg ».
- [ ] Une seule séance difficile (la précédente était correcte) → aucune suggestion de deload.
- [ ] Exercice au poids du corps (pas de charge) → jamais de suggestion de deload, même si difficile
      deux fois de suite.
- [ ] La suggestion reste **une proposition** : rien ne pré-remplit la série à la baisse
      automatiquement.
