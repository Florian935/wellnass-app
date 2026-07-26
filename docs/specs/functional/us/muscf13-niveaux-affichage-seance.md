---
id: MUSC-F13
titre: "Niveaux d'affichage de la séance (Simplifiée / Normale / Détaillée)"
roadmap: [3.43]
catalogue: []
etape: close
branche: feature/muscf13-niveaux-affichage-seance
maj: 23/07/2026
---
# US MUSC-F13 — Niveaux d'affichage de la séance (Simplifiée / Normale / Détaillée)

> **Adapter la densité de l'écran de séance en cours au niveau de l'utilisateur** : trois niveaux
> d'affichage — **Simplifiée** (débutant), **Normale** (intermédiaire / confirmé), **Détaillée** (avancé) —
> qui pilotent **la visibilité des champs** de la carte « série en cours » (`CurrentSetCard`). Le débutant
> n'est pas noyé ; l'avancé n'est pas bridé. Réglage **synchronisé** stocké dans le profil, réglable dans les
> **Réglages** et **choisi à l'onboarding** (étape dédiée avec aperçu visuel).
> Promu depuis [IDEAS.md](../../../../IDEAS.md) (idée du 23/07/2026), après la refonte de l'écran de séance
> (US-C, [analyse](../../../refonte-muscu/analyse-seance-en-cours.md)). S'appuie sur `CurrentSetCard` (C1/C2/C3).
> Branche : `feature/muscf13-niveaux-affichage-seance` · Date : 23/07/2026 ·
> **Statut : à valider (pas de code avant validation Florian/Damien).**
> **🔴 Migration cloud requise** (colonne `profiles.workout_display_level`).

## 0. Contexte

Depuis la refonte US-C, la carte « série en cours » ([`CurrentSetCard`](../../../../apps/mobile/src/components/workout/CurrentSetCard.tsx))
affiche **tous** les champs à tout le monde : nom d'exercice, progression « Série X/Y », note d'exercice 📝,
sélecteur de types de série (dropset/échec/durée/poids de corps + 🔥 échauffement), lien superset,
« dernière fois », suggestion de progression 💡, reps/durée, charge + steppers, charge planifiée vs réalisée
(+ delta), repos, RPE par série (masqué derrière « ＋ RPE »), bouton Valider.

Pour un **débutant**, cette densité est un frein (surcharge cognitive → abandon) : il ne connaît ni le RPE, ni
le dropset, ni le superset. Il veut qu'on lui **dise quoi faire** (l'objectif du plan), pas qu'on lui demande
d'**analyser** un écart. À l'inverse, l'**avancé** (RPE/RIR, supersets, dropsets, notes de réglage) veut de la
**densité et du contrôle**. La même UI ne peut pas servir les deux.

Décisions de cadrage (brainstorming Florian, 23/07/2026) :
- **3 niveaux** pilotant la **visibilité de champs existants** — la mise en page n'est pas repensée, aucun
  nouveau champ métier n'est créé.
- **Réglage dans les Réglages uniquement** (pas de bascule rapide en séance : le niveau est un trait stable,
  et l'écran de séance est déjà dense). **Synchronisé** entre appareils.
- **Défaut = Normale.** Une **étape d'onboarding inconditionnelle** demande le niveau souhaité, avec explication
  courte + **aperçu visuel** de chaque niveau ; défaut Normale si l'étape est sautée.
- **« Dernière fois » visible aux 3 niveaux** (le débutant s'en sert pour gérer ses charges).
- **RPE en Détaillée uniquement** (« Normale » reste sans jargon d'intensité).
- **Nature ≠ technique** : `durée` et `poids de corps` ne sont pas des notions avancées mais la **nature de
  l'exercice** → jamais masquées ; seul le **sélecteur manuel** de types (dropset/échec) est réservé à Détaillée.
- **Périmètre Musculation** (l'écran de séance = muscu). Réglage réutilisable plus tard par le futur module
  Powerlifting.

## 1. Périmètre à livrer

- **Réglage `workout_display_level`** (`simplified` / `normal` / `detailed`) stocké dans `profiles`,
  **synchronisé**, défaut `normal`. Migration + `db:types` + schéma PowerSync + champ Zod `ProfileRow` (shared).
- **Pilotage de `CurrentSetCard`** : nouveau prop `level` ; `workout.tsx` lit `profile.workoutDisplayLevel`
  (⚠️ `workout.tsx` **n'importe pas encore `useProfile`** — c'est un ajout) et le transmet. Chaque élément
  apparaît ou non selon le **tableau §2.1**.
- **Écran Réglages** : entrée « Niveau d'affichage de la séance » (3 choix, sélection immédiate, persistée).
- **Onboarding** : nouvelle étape (compteur **3 → 4**) proposant les 3 niveaux avec aperçu visuel ; écrit
  `workout_display_level` ; défaut `normal` si sautée.
- **i18n** FR/EN (aucune chaîne en dur) ; **offline-first** (écriture locale, colonne synchronisée).

**Hors périmètre (à ne pas implémenter ici) :**
- Bascule rapide du niveau **depuis l'écran de séance** (décision : réglage profil seulement).
- Application du niveau au **résumé de fin** (`workout-summary`), à l'historique, à la liste `ExerciseList`
  dépliée, ou au **pilier Running**. Le niveau ne pilote **que** la carte `CurrentSetCard`.
- **Pilotage par un niveau d'expérience déclaré** en profil (idée « profils enrichis », non cadrée) : le
  réglage est **autonome** pour l'instant.

## 2. Comportement attendu

### 2.1 Les trois niveaux — matrice des champs

`✅` = affiché · `❌` = masqué. Éléments de la carte `CurrentSetCard`, dans l'ordre d'apparition.

| Élément | Simplifiée | Normale | Détaillée |
|---|:---:|:---:|:---:|
| Nom d'exercice + « Série X/Y » | ✅ | ✅ | ✅ |
| Reps **ou** durée (selon la nature de la série) | ✅ | ✅ | ✅ |
| Charge + steppers −/+ | ✅ | ✅ | ✅ |
| Champ lest optionnel (série au poids de corps) | ✅ | ✅ | ✅ |
| Chrono de repos (saisie + steppers) | ✅ | ✅ | ✅ |
| Bouton **Valider** | ✅ | ✅ | ✅ |
| **Consigne** du plan (« objectif 20 kg × 8 ») | ✅ | ✅ | ✅ |
| « Dernière fois : 80 kg × 8/8/7 » | ✅ | ✅ | ✅ |
| **Écart** planifié/réalisé (badge delta ▲/▼/=) | ❌ | ✅ | ✅ |
| Suggestion de progression 💡 | ❌ | ✅ | ✅ |
| Échauffement 🔥 (raccourci 1 tap) | ❌ | ✅ | ✅ |
| Sélecteur de types (Normale / Dropset / Échec / Durée / Poids de corps) | ❌ | ❌ | ✅ |
| RPE par série (« ＋ RPE ») | ❌ | ❌ | ✅ |
| Note par exercice 📝 | ❌ | ❌ | ✅ |
| Superset (lier / délier / orphelin) | ❌ | ❌ | ✅ |

### 2.2 Règles fines (pièges à respecter)

1. **Nature de l'exercice jamais masquée.** Le tableau masque le **sélecteur manuel** de types en
   Simplifiée/Normale, mais **pas la saisie adaptée** : si la série courante est déjà `duration` (héritée du
   plan) → afficher le champ **durée** (mm:ss) ; si `bodyweight` → afficher le champ **lest optionnel**. Une
   série `dropset`/`failure` héritée du plan est saisie normalement, son marqueur peut rester discret ; seul le
   **choix/changement de type** est indisponible hors Détaillée.
2. **Consigne vs analyse.** La **consigne** du plan (valeur cible « objectif X kg × Y reps ») est affichée aux
   3 niveaux comme guide. Le **badge d'écart** (delta ▲/▼/=, réalisé − planifié) n'apparaît qu'en **Normale+**
   (c'est de l'analyse). En Simplifiée : consigne visible, pas de delta.
3. **Échauffement dès Normale.** Le raccourci 🔥 (bascule `warmup` ↔ `normal`) est visible en Normale et
   Détaillée — un intermédiaire échauffe et veut ses records propres. Il est masqué en Simplifiée.
4. **RPE, note, superset = Détaillée seulement.** Cohérent avec « Normale sans jargon d'intensité ».
5. **Masquer ≠ effacer.** Masquer un champ n'altère **aucune donnée** : une note, un RPE ou un type déjà saisis
   (ex. depuis un autre appareil en Détaillée, ou hérités du plan) restent **persistés** ; ils sont simplement
   non affichés / non éditables au niveau courant. Repasser en Détaillée les ré-expose intacts.
6. **Découpage du conteneur `typeRow` (note d'implémentation).** Dans `CurrentSetCard`, le sélecteur de types
   (chips) et le raccourci échauffement 🔥 partagent **le même conteneur** (`typeRow`) mais relèvent de niveaux
   différents (chips = Détaillée ; 🔥 = Normale+). Le gating se fait **à l'intérieur** du conteneur (rendre
   séparément la `ScrollView` de chips et le `Pressable` 🔥), et ne pas rendre le conteneur du tout en
   Simplifiée. De même, le **badge delta** est imbriqué dans le bloc « planifié » : garder la consigne (tous
   niveaux), ne gater **que** le badge (Normale+).

### 2.3 Réglage dans les Réglages

- Entrée « Niveau d'affichage de la séance » (libellé i18n) proposant les 3 niveaux avec une courte description
  chacun. Sélection **immédiate** (pas de bouton « enregistrer »), persistée via `upsertProfile`.
- Modifiable à tout moment. Si l'utilisateur change de niveau **pendant** une séance en cours, la carte se met
  à jour **réactivement** (le profil est lu via `useProfile`) — pas de rechargement requis.
- **Patron d'UI** : les Réglages ([settings.tsx](../../../../apps/mobile/src/app/settings.tsx)) utilisent
  `Segment` (thème, unités, langue) et `Switch` (couleurs de menu). ⚠️ Un `Segment` nu **ne porte pas de
  description** ; comme on veut une courte explication par niveau, prévoir un **sélecteur en cartes** (patron
  de [goal.tsx](../../../../apps/mobile/src/app/(onboarding)/goal.tsx) : liste de `Pressable` libellé +
  description) plutôt qu'un `Segment` simple. (La « marge d'adhérence » n'est **pas** dans cet écran — elle vit
  dans le profil nutritionnel ; ne pas la prendre comme référence.)

### 2.4 Étape d'onboarding

- **Nouvelle étape inconditionnelle** insérée dans le flux `(onboarding)`. L'ordre des écrans vient du
  chaînage `NEXT` de chaque écran (pas d'un `_layout` : c'est un `<Stack>` nu) : `intro → infos(1) → pillars(2)
  → goal(3) → summary`. Insertion **entre `goal` et `summary`** (nouvel écran `step={4}`) :
  - créer l'écran sur le patron de [goal.tsx](../../../../apps/mobile/src/app/(onboarding)/goal.tsx) ;
  - **rewirer la chaîne** : `goal.tsx` `NEXT` `/summary` → `/(onboarding)/displayLevel` ; le nouvel écran
    `NEXT` → `/summary` ;
  - passer `TOTAL_STEPS` de **3 à 4** — constante **unique** dans
    [OnboardingScaffold.tsx](../../../../apps/mobile/src/components/OnboardingScaffold.tsx). Les badges des
    étapes 1/2/3 existantes restent valides (seul le dénominateur « / 4 » change, via la constante).
- Contenu : titre + sous-titre explicatif, 3 options sélectionnables (patron de `goal.tsx`), chaque option
  accompagnée d'une **courte explication** et d'un **aperçu visuel** de la carte de séance correspondante (voir
  maquette) pour que l'utilisateur se fasse une idée concrète.
- Écrit `workout_display_level` via `upsertProfile`. **« Passer »** (skip de l'étape) **ou** « Passer tout »
  laissent le défaut `normal` (aucune écriture forcée).
- Texte formulé **génériquement** (« l'affichage de tes séances »), indépendamment du pilier Muscu activé ou non.

### 2.5 Défaut & comptes existants

- Défaut applicatif : `normal`. Une ligne `profiles` dont `workout_display_level` est **NULL** (comptes créés
  avant la migration, ou onboarding sauté) est traitée comme `normal` par le mapping du repository.
- La colonne cloud peut porter un `DEFAULT 'normal'` ; le mapping applicatif **ne dépend pas** de ce défaut SQL
  (il coerce NULL → `normal`), pour rester correct hors-ligne avant première synchro.

## 3. Modèle de données & migration

- **Migration additive** : `ALTER TABLE profiles ADD COLUMN workout_display_level text` (+ `DEFAULT 'normal'` ;
  contrainte `CHECK (workout_display_level IN ('simplified','normal','detailed'))` **tolérant NULL**).
- `npm run db:types` pour régénérer `packages/shared/src/database.types.ts`.
- **Schéma PowerSync** ([schema.ts](../../../../apps/mobile/src/powersync/schema.ts)) : la table `profiles`
  liste ses colonnes **explicitement** → ajouter `workout_display_level: column.text` (comme `main_goal`).
- **Sync rules** ([powersync-sync-rules.yaml](../../../technical/powersync-sync-rules.yaml)) : `profiles` est
  répliquée par **`select * from profiles …`** → une colonne ajoutée descend automatiquement, **aucun
  redéploiement manuel des sync rules n'est nécessaire**.
- **Zod partagé `ProfileRow`** ([profile.ts](../../../../packages/shared/src/profile.ts)) : champ
  `workoutDisplayLevel` déclaré `workoutDisplayLevelSchema.nullable().default(null)` — **même patron que
  `mainGoal`** (`goalSchema.nullable().default(null)`), le schéma **ne coerce pas** (il reste nullable pour
  rester cohérent avec les autres champs). Ajouter `WORKOUT_DISPLAY_LEVELS` (const + `z.enum`) et le type
  exporté `WorkoutDisplayLevel` (exporté aussi depuis `index.ts`), avec tests Vitest (enum + parité valeurs,
  comme `GOALS`/`SEXES`).
- **`profile-repository.ts`** : c'est le **lecteur unique** de la table (`SELECT *`, aucun autre lecteur direct
  dans le mobile). La **coercition NULL / valeur inconnue → `normal` se fait ici**, dans `rowToProfile` (pas
  dans le Zod). Ajouter aussi le champ à `ProfileDbRow`, `inputToColumns` et `ProfileInput`.

> Migration **non idempotente** par défaut : suivre le cycle CLAUDE.md (`db:new` → `db:push:dry` → `db:push` →
> `db:types` → cocher [MIGRATIONS.md](../../../../supabase/MIGRATIONS.md)). Pas de redéploiement des sync rules
> (voir ci-dessus, `profiles` en `select *`).

## 4. i18n (FR + EN)

Nouvelles clés (namespaces indicatifs) :
- `settings.workoutDisplayLevel.title` + `.description` ; libellés + descriptions des 3 niveaux :
  `…levels.simplified.{label,hint}`, `…levels.normal.{…}`, `…levels.detailed.{…}`.
- `onboarding.displayLevel.{title,subtitle}` + réutilisation des libellés de niveaux ci-dessus.
- Aucune chaîne en dur ; parité FR/EN stricte.

Exemples FR → EN : « Niveau d'affichage de la séance » → « Session display level » ; « Simplifiée » →
« Simplified » ; « Normale » → « Standard » ; « Détaillée » → « Detailed ».

## 5. Offline-first

- Écriture 100 % locale (`upsertProfile`), synchro en arrière-plan par PowerSync ; aucun appel réseau bloquant.
- Lecture réactive via `useProfile` (déjà offline-first : `isLoading` ne dépend que de SQLite).
- Conflit multi-appareils : dernière écriture gagne (comportement `profiles` standard) ; sans enjeu (préférence
  d'affichage, pas de donnée métier).

## 6. Cas limites

- **Profil non encore chargé** (`useProfile().isLoading`) : afficher la carte en **Normale** (défaut) sans
  flash, puis se caler sur la valeur dès résolution locale.
- **Valeur inconnue** en base (donnée corrompue / future valeur) : coercition défensive → `normal`.
- **Changement de niveau en séance** : mise à jour réactive, l'état d'édition en cours de la série n'est pas
  perdu (l'édition est rattachée à l'`id` de série, indépendante du niveau).
- **Série `duration`/`bodyweight` en Simplifiée** : le bon champ s'affiche (règle §2.2-1), le sélecteur reste
  masqué.
- **Aucun plan (séance libre)** : pas de consigne ni de delta à afficher — inchangé quel que soit le niveau.

## 7. Definition of Done

- Migration appliquée cloud + `db:types` + `MIGRATIONS.md` coché ; schéma PowerSync (et sync rules si besoin).
- `CurrentSetCard` pilotée par `level` conforme à la matrice §2.1 + règles §2.2 ; `workout.tsx` transmet le
  niveau lu au profil.
- Réglage fonctionnel dans les Réglages (persistance + réactivité en séance).
- Étape d'onboarding inconditionnelle (compteur 4, badges à jour) écrivant le niveau ; skip → `normal`.
- i18n FR/EN complète ; parité vérifiée.
- `npm run typecheck` + `npm run lint` verts ; tests shared (enum/coercition) + smoke mobile ; parité i18n.
- Maquette (design/) validée Florian/Damien avant code.

## 8. Critères d'acceptation (recette)

1. **Simplifiée** : la carte n'affiche que nom+série, reps/charge/repos, consigne du plan, « dernière fois »,
   Valider. **Pas** de delta, suggestion, échauffement, types, RPE, note, superset.
2. **Normale** : ajoute delta ▲/▼, suggestion 💡, échauffement 🔥. **Pas** de sélecteur de types, RPE, note,
   superset.
3. **Détaillée** : tout est présent (comportement actuel).
4. **Nature** : un exercice en durée ou au poids de corps affiche le bon champ **même en Simplifiée**.
5. **Réglage** : changer le niveau dans les Réglages met à jour la carte **immédiatement**, y compris pendant
   une séance ; la valeur **survit** au redémarrage et **se synchronise** sur un 2ᵉ appareil.
6. **Onboarding** : l'étape « niveau d'affichage » apparaît (Étape x / 4) avec aperçu des 3 niveaux ; le choix
   est appliqué ; sauter l'étape laisse **Normale**.
7. **Non-destructif** : une note / un RPE saisis en Détaillée puis masqués en Normale **réapparaissent** intacts
   en repassant en Détaillée.
8. **i18n** : en anglais, tous les libellés (réglage, niveaux, onboarding) sont traduits.
