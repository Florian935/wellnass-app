---
id: CONTENU-01
titre: "Seed des bibliothèques de programmes (muscu + course)"
roadmap: [3.1, 5.2]
catalogue: []
etape: validation
branche: docs/contenu-01-spec
maj: 25/07/2026
---
# US CONTENU-01 — Seed des bibliothèques de programmes (muscu + course)

> Backlog MVP1 (P1 — contenu éditorial). Rédigée par le fil autonome (25/07/2026) **pour validation
> Damien/Florian** — c'est une US de **contenu** : le squelette technique et le catalogue proposé ci-dessous
> doivent être **tranchés avant tout code/donnée**. Branche de cette spec : `docs/contenu-01-spec`.
> **Statut : à valider.** Roadmap : **3.1** (biblio programmes muscu) + **5.2** (biblio programmes course),
> aujourd'hui 🟡 (écrans + filtres OK, **catalogue vide**).

## 0. Contexte

Les écrans de bibliothèque de programmes existent et fonctionnent :
- **Muscu** : [programs/index.tsx](../../../../apps/mobile/src/app/programs/index.tsx) — section « Bibliothèque »
  (`useProgramLibrary` : `owner_id IS NULL AND status = 'published'`) + « Mes programmes » + duplication.
- **Course** : [running-programs/index.tsx](../../../../apps/mobile/src/app/running-programs/index.tsx) — même
  patron.

Mais le **catalogue éditorial est quasi vide** : un seul programme muscu placeholder (« Full Body Débutant »,
[seed.sql](../../../../supabase/seed.sql#L103)) et **rien en course**. Le parcours « adopter un programme »
(dupliquer → planifier → activer) — corrigé récemment côté activation
([`fix/activation-programme-owner-scope`]) — n'a donc **presque rien à proposer**. C'est un **bloquant de valeur**
pour la bêta : sans catalogue, la promesse « programmes pré-conçus » est vide.

## 1. Objectif

Peupler les deux bibliothèques éditoriales d'un **catalogue de départ crédible**, **bilingue FR+EN**, prêt à
être **dupliqué** par l'utilisateur, offline-first (répliqué par PowerSync comme le placeholder actuel).

## 2. Décision structurante — méthode de seed *(à trancher)*

Deux voies, non exclusives :

| Option | Description | Pour | Contre |
|---|---|---|---|
| **A — Migration SQL idempotente** *(recommandé pour le 1ᵉʳ seed)* | Un fichier de migration versionné (précédent : [`20260714120000_seed_library_foods_ciqual.sql`](../../../../supabase/migrations/) pour les aliments CIQUAL), UUID déterministes, `on conflict (id) do nothing`, exécuté sous service role (bypass RLS car `owner_id null`). | Reproductible, versionné, revu en PR, rejouable sans doublon, identique cloud↔futurs environnements. | Édition de contenu = éditer du SQL (peu ergonomique pour itérer le contenu). |
| **B — Constructeur admin (8.4, livré)** | Saisie manuelle des programmes dans le back-office web. | Ergonomique pour créer/ajuster le contenu ; c'est le **pipeline cible** à terme. | Non versionné (données cloud only), non reproductible, pas de trace PR, risque d'écart entre environnements. |

**Recommandation** : **Option A pour le catalogue de lancement** (traçable, reproductible, aligné sur le
précédent CIQUAL), puis **Option B** comme pipeline d'entretien/enrichissement continu. À confirmer.

## 3. Modèle de données (rappel, inchangé — aucune migration de schéma)

Par programme éditorial (`owner_id null`, `status 'published'`, `is_active false`) :
- **`programs`** : pilier, niveau (`level`), objectif (`goal`), durée (`duration_weeks`).
- **`program_translations`** : **FR + EN** (name, summary, description) — bilingue obligatoire.
- **`sessions`** : les séances du programme (ordonnées, `order_index`), + champs course (`session_type`,
  `target_distance_m`, `target_duration_seconds`) pour le pilier running.
- **`exercise_plans`** (muscu) : exercices planifiés par séance (référencent des `exercises` **existants** —
  cf. bibliothèque d'exercices seedée), séries/reps/repos cibles.

⚠️ **Contrainte** : les `exercise_plans` doivent référencer des `exercises` **déjà seedés** (Développé couché,
Squat, etc. — présents). Tout exercice manquant du catalogue muscu devra être ajouté au seed exercices d'abord.

## 4. Catalogue de départ proposé *(à valider / ajuster — contenu)*

> Volumes indicatifs, à arbitrer avec Florian (coach). Chaque programme = FR + EN.

### 4.1 Musculation
1. **Full Body Débutant — 3 séances/sem** *(existe déjà — placeholder à consolider)* — 8 sem, débutant, prise de masse.
2. **Push / Pull / Legs — Intermédiaire** — 8 sem, 6 séances/sem (ou 3 en alternance), hypertrophie.
3. **Half Body — Haut/Bas** — 8 sem, 4 séances/sem, intermédiaire.
4. *(optionnel)* **Force 5×5 — Débutant/Interm.** — squat/bench/deadlift/OHP/row, 12 sem.

### 4.2 Course
1. **5 km en 8 semaines — Débutant** — 3 sorties/sem (endurance + fractionné léger).
2. **10 km — sub-50 / Intermédiaire** — 10 sem, 3 sorties/sem (VMA + seuil + sortie longue).
3. **Prépa semi-marathon** — 12 sem, 3-4 sorties/sem.

## 5. Règles métier & exigences

- **Bilingue FR+EN** : chaque programme et chaque séance a ses traductions (name/summary/description). Aucun
  texte en dur ; repli FR si EN absent (patron `COALESCE(tl, tfr)` déjà en place).
- **Éditorial en lecture seule côté app** : `owner_id null`, jamais activable/planifiable directement (garde
  `isOwned` posée par le fix activation) → l'utilisateur **duplique** puis planifie sa copie.
- **`is_active = false`** sur tout l'éditorial (un programme éditorial n'est jamais « actif »).
- **Idempotence** (option A) : UUID déterministes + `on conflict do nothing` → rejouable, pas de doublon.
- **Offline** : répliqué par PowerSync via les sync rules existantes (le placeholder l'est déjà).
- **Cohérence exercices** : les `exercise_plans` ne référencent que des exercices seedés existants.

## 6. Hors périmètre

- Constructeur admin enrichi (option B) au-delà de l'existant 8.4.
- Génération IA de programmes (idée séparée dans IDEAS.md).
- Progression automatique de charge (MUSC-F7) — indépendant.

## 7. Décisions ouvertes à trancher (Damien/Florian)

1. **Méthode** : Option A (migration) pour le lancement ? (recommandé)
2. **Catalogue** : liste ci-dessus validée / ajustée ? Combien de programmes au lancement (MVP = 2-3/pilier ?) ?
3. **Contenu détaillé** : qui fournit les séances/exos/reps (Florian coach) ? Format d'entrée (tableur → SQL ?).
4. **Exercices manquants** : lister les exos référencés absents du seed → à ajouter d'abord.

## 8. Definition of Done

- [ ] Méthode + catalogue validés (§2, §4, §7).
- [ ] Programmes éditoriaux seedés (FR+EN), visibles dans les 2 bibliothèques, **duplicables**.
- [ ] Parcours complet vérifié device : biblio → dupliquer → planifier la copie → activer (sur la copie).
- [ ] Roadmap 3.1 + 5.2 → ✅ (ou 🟡 si catalogue volontairement partiel au lancement).
- [ ] Aucune migration de **schéma** ; migration de **données** idempotente (option A) rejouable.
