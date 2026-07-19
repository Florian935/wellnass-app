# US Refonte-C1 — Écran de séance en cours : cœur du flux guidé + garde-fous

> **Chantier refonte Muscu**, US-C **découpée en 3 sous-US** (C1 → C2 → C3). **C1 = le socle** : rendre
> l'écran de séance **guidé, rapide et sûr**. Corrige le **problème 4** de l'[audit](../../../refonte-muscu/audit-flux.md).
> Base de findings : [analyse-seance-en-cours.md](../../../refonte-muscu/analyse-seance-en-cours.md) (22 points).
> Dépend d'US-A/US-B (livrées : lien occurrence ↔ séance, démarrage lié). Branche : `feature/refonte-muscu-c1` ·
> Date : 19/07/2026 · **Statut : à valider (pas de code avant validation).** **Aucune migration** (réutilise
> `workouts.rpe` + `workouts.notes` existants).

## 0. Contexte

L'écran de séance actuel ([workout.tsx](../../../../apps/mobile/src/app/workout.tsx)) est une **liste plate** :
tous les exercices, tous les champs ouverts, « valider » = simple coche, saisie clavier, repos figé 90 s en
barre basse, **✕ qui supprime la séance sans confirmation**, « Terminer » qui saute ressenti/note. Cf. spec
[musculation.md §4](../musculation.md).

Décisions de cadrage (brainstorming Florian, 19/07/2026) :
- **Disposition** : carte **« série en cours »** (focus) + **liste repliée** des exercices (aperçu + saut).
- **Validation** : « Valider la série » = **enregistre + démarre le repos + avance** le focus. Pré-remplissage
  par priorité **cible du plan → dernière perf → série précédente**. Steppers **− / +**.
- **Repos** : durée du plan sinon **90 s**, **plein écran** + **vibration** + Passer / **Prolonger (+15 s)**,
  **éditable en direct par exercice** (portée **session**, non persistée au plan).
- **Garde-fous** : ✕ → dialogue **Continuer / Pause / Abandonner** ; **keep-awake** ; « Terminer » direct avec
  **avertissement si 0 série validée**.
- **Fin** : **résumé rendu éditable** — ressenti **5 étoiles** + note **après coup**.

## 1. Périmètre à livrer (C1)

- **Refonte de [workout.tsx](../../../../apps/mobile/src/app/workout.tsx)** : carte focus + liste repliée +
  steppers + pré-remplissage + validation (log + repos + avance).
- **Repos plein écran** configurable (plan/90 s), vibration, Passer/Prolonger, édition en direct par exercice (session).
- **Keep-awake** pendant la séance.
- **Dialogue ✕** Continuer / Pause / Abandonner (Abandonner = 2ᵉ confirmation).
- **Fin** : garde 0 série + **résumé éditable** (ressenti 5★ via `workouts.rpe` 1-5, note via `workouts.notes`).
- **i18n** FR/EN ; offline-first.

**Hors périmètre (→ C2/C3, à ne pas implémenter ici) :**
- **C2** : types de séries (échauffement auto-exclu, superset, dropset, échec, durée, poids de corps),
  **RPE par série**, **charge planifiée vs réalisée** (migrations).
- **C3** : réorganiser, « machine prise » (sauter/revenir), remplacer par variante, note par exercice,
  accès démo pendant la séance, suggestion de progression.
- **Déféré (hors C1/C2/C3 pour l'instant)** : clôture automatique à 3 h + fenêtre de reprise 4 h (§4.4/§8) —
  la reprise « de facto » (séance `active` qui réapparaît en « Reprendre ») suffit à C1.

## 2. Comportement attendu

### 2.1 Disposition
- En-tête : **✕** (gauche) · **chrono de séance** (mm:ss) · **Terminer** (droite).
- **Carte « Série en cours »** : nom de l'exercice · « Série N/M » · ligne **« La dernière fois : … »** (masquée
  si indisponible) · champ **reps** · champ **charge** encadré de **− / +** · bouton **« Valider la série »**.
- **Liste repliée** (sous la carte) : un rang par exercice (nom + « k/M ✓ »), **tap = déplier / sauter** à cet
  exercice (la carte focus bascule dessus). Exercice entièrement validé = marqué ✓.
- **« Ajouter un exercice »** (bas) → modal `exercises` existant → revient sur la séance (1 série pré-remplie
  depuis la dernière perf si dispo, sinon vide).

### 2.2 Saisie & validation
- Champs **pré-remplis** par priorité : **cible du plan** (si la séance découle d'un programme) → **dernière
  perf** de l'exercice (historique) → **série précédente** de la séance. Sinon vides.
- **Steppers − / +** : incrément **2,5 kg** par défaut (kg) ; conversion selon l'unité active ; saisie clavier
  possible (tap sur la valeur).
- **« Valider la série »** : enregistre reps + charge affichés (`done = true`) → **démarre le repos** (§2.3) →
  **avance le focus** à la série suivante ; si c'était la dernière série de l'exercice, avance à l'**exercice
  suivant** non terminé. **Dé-valider** reste possible depuis la liste (sans re-déclencher de repos).
- **État de fin** : quand **toutes les séries de tous les exercices** sont validées, la carte focus laisse place
  à un état « Séance terminée ? » incitant à **Terminer** (le bouton Terminer de l'en-tête reste disponible à
  tout moment ; ajouter un exercice reste possible).

### 2.3 Repos
- Déclenché **à la validation**. Durée = `exercise_plans.rest_seconds` de la séance planifiée si présent, sinon
  **90 s**. ⚠️ Ce `rest_seconds` **n'est pas** copié dans `workout_sets` par `startWorkoutFromSession` (US-A ne
  seed que `set_type`/`target_sets`/`target_weight_kg`), et la requête « séance active » actuelle n'expose pas
  `session_id` → **prévoir une extension** (helper/hook qui rejoint `exercise_plans` via la séance) pour lire le
  repos prévu par exercice ; à défaut, **90 s**.
- **Plein écran** (ou overlay dominant) : **compte à rebours**, **vibration** en fin via **`Vibration` (React
  Native core)** — *pas* `expo-haptics* (éviterait un rebuild natif) —, boutons **Passer** et **Prolonger
  (+15 s)**. Démarrage manuel possible aussi (bouton repos sur la carte).
- **Éditable en direct par exercice** : tap sur la durée → ajuster ; s'applique aux repos **suivants de cet
  exercice pour la séance en cours** (état de session en mémoire ; **non** persisté dans le plan en C1).

### 2.4 Garde-fous & cycle de vie
- **✕** → **dialogue 3 choix** : **Continuer** (ferme le dialogue) · **Pause** (quitte l'écran **sans rien
  supprimer** ; la séance reste `active` → « Reprendre » depuis le hub/dashboard) · **Abandonner** → **2ᵉ
  confirmation** → `cancelWorkout` (suppression). Le geste retour natif reste désactivé (`gestureEnabled:false`).
- **Keep-awake** actif tout au long de la séance (libéré à la sortie), à l'image de `run/active.tsx`.
- **Reprise** : à la réouverture d'une séance `active`, le focus se pose sur la **1ʳᵉ série non validée**.

### 2.5 Fin & résumé
- **« Terminer »** : si **aucune série validée**, **avertir** (« Aucune série validée — terminer quand même ? »).
  Sinon clôture (`finishWorkout`) → navigue vers le **résumé**.
- **Résumé rendu éditable** ([workout-summary.tsx](../../../../apps/mobile/src/app/workout-summary.tsx)) : garde
  durée / volume / séries / records 🏆, **plus** un **ressenti global (5 étoiles, 1-5)** et une **note de séance**,
  éditables **après coup** et **persistés au fil de la saisie** (`patch` sur `workouts` : `rpe` 1-5, `notes`).
- Bouton « Retour à l'accueil » conservé.

## 3. Règles métier

- **Une seule séance active** (garde existante) : Pause ne crée pas de doublon, la séance reste l'unique active.
- **Pré-remplissage** : la « dernière perf » lit l'historique de l'exercice (dernière séance terminée où il
  apparaît). N'inclut pas les futures notions C2 (types de séries) — en C1 toutes les séries comptent comme
  « normales » (comportement actuel inchangé ; l'exclusion échauffement viendra en C2).
- **Repos édité en direct** : portée session (perdu si l'app redémarre et qu'on reprend → revient au défaut/plan).
- **Ressenti** : `workouts.rpe` réutilisé sur l'échelle **1-5** (étoiles) pour le ressenti **global**. ⚠️ En C2,
  le **RPE par série** (échelle 1-10, sur `workout_sets`) sera distinct — ne pas confondre les deux échelles ;
  à réévaluer en C2 si le global doit lui aussi passer en 1-10 (décision reportée, hors C1).
- **Offline-first** : toutes les écritures optimistes locales (déjà le cas). Aucune perte de séance.

## 4. Architecture

- **`workout.tsx`** refondu (le fichier grossit → envisager d'extraire des sous-composants) :
  - `CurrentSetCard` (carte focus : dernière perf, steppers, valider) ;
  - `ExerciseList` repliée (aperçu + saut) ;
  - `RestOverlay` (plein écran : compte à rebours, vibration **`Vibration` de `react-native`**, Passer/Prolonger) ;
  - état local : index exercice/série courant, map `exerciseId → restSeconds` (override session), `restEndsAt`.
- **Pré-remplissage** : helper repository « dernière perf d'un exercice » (dernière séance terminée) +
  cible du plan (déjà seed dans `workout_sets.weight_kg` par `startWorkoutFromSession` d'US-A). Exposer une
  fonction/hook dédié plutôt que de charger tout l'historique.
- **Repos prévu par exercice** : étendre la lecture de la séance active (ou un helper dédié) pour exposer
  `session_id` puis le `rest_seconds` du plan de chaque exercice ; défaut 90 s si absent. (Le repository actuel
  ne remonte ni `session_id` ni `rest_seconds`.)
- **Steppers / unités** : réutiliser `useUnits` (incrément 2,5 kg, conversion kg↔lb).
- **Validation** : `updateSet(setId, { reps, weightKg, done:true })` (existant) + démarrage repos + avance focus.
- **Keep-awake** : `expo-keep-awake` (`useKeepAwake()` ou `activate/deactivate`), monté sur `workout.tsx`
  (miroir de `run/active.tsx`).
- **Dialogue ✕** : `Alert` 3 boutons (Continuer / Pause / Abandonner) ; Abandonner → 2ᵉ `Alert` de confirmation
  → `cancelWorkout`. Pause → `router.back()`/`/(tabs)` sans mutation.
- **Résumé éditable** : ajouter au `workout-summary.tsx` un sélecteur **5 étoiles** et un champ **note**,
  pré-remplis depuis la séance, écrivant via une **nouvelle fonction repository** `setWorkoutFeedback(id, { rpe,
  notes })` (dans `workout-repository.ts`) — **ne pas** importer `_sql`/`patch` dans l'écran ; débounce léger
  sur la note.
- **Données** : **aucune migration** — `workouts.rpe` (integer) et `workouts.notes` (text) existent déjà et sont
  déjà acceptés par `finishWorkout(opts)`.
- **i18n** : nouvelles clés `workout.*` (série N/M, dernière perf, valider, repos plein écran/prolonger/passer,
  dialogue continuer/pause/abandonner + confirmation, avertissement 0 série, ressenti/note du résumé), FR + EN.

## 5. Offline & données

- Lecture/écriture **locales** (offline-first) ; aucune écriture nouvelle hors `updateSet`/`patch(workouts)`
  déjà en place. **Aucune migration, aucun checkpoint cloud.**
- **Pas de nouvelle dépendance native** : `expo-keep-awake` est déjà utilisé (`run/active.tsx`), et la vibration
  passe par **`Vibration` de `react-native`** (core) → **aucun rebuild**. (Ne pas introduire `expo-haptics` qui,
  lui, imposerait `expo install` + rebuild.)

## 6. Definition of Done

- [ ] Spec + plan + **maquette** validés (pas de code avant).
- [ ] Écran refondu : carte focus (série en cours + dernière perf + steppers) + liste repliée (aperçu/saut).
- [ ] Pré-remplissage cible plan → dernière perf → série précédente ; steppers − / + (2,5 kg, unités).
- [ ] « Valider » = log + repos + avance auto ; dé-valider possible sans relancer le repos.
- [ ] Repos plein écran (plan/90 s) + vibration + Passer/Prolonger + édition en direct par exercice (session).
- [ ] Keep-awake actif pendant la séance.
- [ ] ✕ → Continuer / Pause / Abandonner (2ᵉ confirmation) ; plus jamais de suppression en un tap.
- [ ] « Terminer » avec garde 0 série ; **résumé éditable** (ressenti 5★ + note, persistés).
- [ ] i18n FR+EN (parité) ; offline-first ; typecheck/lint/tests verts ; non-régression (démarrage US-A/B, résumé).
- [ ] Maquette validée + PR relue par les deux devs.

## 7. Explicitement différé

- **C2** : types de séries (dont échauffement exclu du volume/records), RPE par série, charge planifiée vs
  réalisée (migrations).
- **C3** : réorganiser / machine prise / superset (enchaînement + repos après la paire) / remplacer par variante /
  note par exercice persistante / accès démo en séance / suggestion de progression.
- **Déféré** : clôture auto 3 h + fenêtre de reprise 4 h explicite ; persistance du repos personnalisé dans le plan.
