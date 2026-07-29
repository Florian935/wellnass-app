---
id: CONTENU-01
titre: "Seed des bibliothèques de programmes (muscu + course)"
roadmap: [3.1, 5.2]
catalogue: []
etape: recette
branche: docs/contenu-01-spec
maj: 29/07/2026
---
# US CONTENU-01 — Seed des bibliothèques de programmes (muscu + course)

> Backlog MVP1 (P1 — contenu éditorial). Rédigée par le fil autonome (25/07/2026) **pour validation
> Damien/Florian** — c'est une US de **contenu** : le squelette technique et le catalogue proposé ci-dessous
> doivent être **tranchés avant tout code/donnée**. Branche de cette spec : `docs/contenu-01-spec`.
> **Statut : contenu livré le 29/07/2026, en recette.** Roadmap **3.1** et **5.2** → ✅.
> Contenu délégué par Florian (« fais ce qu'il te semble cohérent », 29/07) — donc **écrit sans sa voix
> de coach** : à relire avant publication. Voir §7 pour ce qui a été tranché.

## 0. Contexte

Les écrans de bibliothèque de programmes existent et fonctionnent :
- **Muscu** : [programs/index.tsx](../../../../apps/mobile/src/app/programs/index.tsx) — section « Bibliothèque »
  (`useProgramLibrary` : `owner_id IS NULL AND status = 'published'`) + « Mes programmes » + duplication.
- **Course** : [running-programs/index.tsx](../../../../apps/mobile/src/app/running-programs/index.tsx) — même
  patron.

⚠️ **Ce paragraphe était faux, corrigé le 29/07/2026 après inventaire du cloud.** Il annonçait « un seul
programme muscu placeholder et **rien en course** ». La réalité constatée en base :

| Pilier | État au 29/07/2026, avant cette US |
|---|---|
| **Course** | **3 programmes complets** et bilingues (10 km/8 sem, Prépa semi-marathon, Reprise en douceur), séances typées avec distances cibles. Le catalogue n'était **pas** vide. |
| **Muscu** | **1 seul** programme complet (« Full Body Débutant », 3 séances / 9 exercices). |

Et un problème que la spec n'avait pas vu, plus urgent que le manque de contenu : **4 programmes de
test** traînaient dans la bibliothèque, dont **2 publiés** — « Test admin programme » (muscu) et
« Run run » (course) — donc **visibles par les utilisateurs** dans l'app au lancement.

La leçon vaut au-delà de cette US : une spec de contenu écrite sans inventorier la base décrit un état
supposé. **Inventorier d'abord.**

## 1. Objectif

Peupler les deux bibliothèques éditoriales d'un **catalogue de départ crédible**, **bilingue FR+EN**, prêt à
être **dupliqué** par l'utilisateur, offline-first (répliqué par PowerSync comme le placeholder actuel).

## 2. Décision structurante — méthode de seed *(TRANCHÉE le 28/07/2026)*

> ✅ **Arbitrage Florian, 28/07/2026 : Option A — migration SQL idempotente.** Le catalogue de
> lancement passe par un fichier de migration versionné (patron du seed CIQUAL), donc tracé dans le
> dépôt, rejouable sans doublon et identique sur toute base future. L'**Option B** (constructeur admin
> 8.4) reste le pipeline d'**entretien et d'enrichissement** ultérieur, pas celui du seed initial.
> Conséquences à respecter à l'implémentation : **UUID déterministes**, `on conflict (id) do nothing`,
> contenu **FR + EN obligatoire** dans `program_translations`, et **cocher la migration** dans
> [supabase/MIGRATIONS.md](../../../../supabase/MIGRATIONS.md) après `npm run db:push`.

Deux voies, non exclusives :

| Option | Description | Pour | Contre |
|---|---|---|---|
| **A — Migration SQL idempotente** *(recommandé pour le 1ᵉʳ seed)* | Un fichier de migration versionné (précédent : [`20260714120000_seed_library_foods_ciqual.sql`](../../../../supabase/migrations/) pour les aliments CIQUAL), UUID déterministes, `on conflict (id) do nothing`, exécuté sous service role (bypass RLS car `owner_id null`). | Reproductible, versionné, revu en PR, rejouable sans doublon, identique cloud↔futurs environnements. | Édition de contenu = éditer du SQL (peu ergonomique pour itérer le contenu). |
| **B — Constructeur admin (8.4, livré)** | Saisie manuelle des programmes dans le back-office web. | Ergonomique pour créer/ajuster le contenu ; c'est le **pipeline cible** à terme. | Non versionné (données cloud only), non reproductible, pas de trace PR, risque d'écart entre environnements. |

**Recommandation** : **Option A pour le catalogue de lancement** (traçable, reproductible, aligné sur le
précédent CIQUAL), puis **Option B** comme pipeline d'entretien/enrichissement continu.
→ **Retenue telle quelle** (Florian, 28/07/2026, voir l'encadré ci-dessus).

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

1. ~~**Méthode** : Option A (migration) pour le lancement ?~~ → ✅ **tranchée le 28/07/2026 (Florian) :
   Option A**, migration SQL idempotente. Voir §2.
2. ~~**Catalogue** : combien de programmes au lancement ?~~ → ✅ **tranché : 3 par pilier.** La course en
   avait déjà 3 ; la muscu passe de 1 à 3 (PPL + Half Body). Le « Force 5×5 » optionnel de §4.1 est
   **écarté** : il recouvre largement le PPL et la bibliothèque de 16 exercices ne permet pas de le
   différencier vraiment.
3. ~~**Contenu détaillé** : qui fournit les séances/exos/reps ?~~ → ✅ **délégué (Florian, 29/07)**.
   Écrit sans sa voix de coach : séries, fourchettes de reps et temps de repos sont des valeurs
   standard défendables, **à relire avant publication**.
4. ~~**Exercices manquants**~~ → ✅ **aucun.** Les 16 exercices de bibliothèque (vérifiés présents en
   base, UUID `a1000001` → `a1000016`) couvrent les 6 groupes et suffisent aux 3 programmes muscu.
5. 🆕 **Limite constatée — les noms de séance ne sont pas bilingues.** `sessions.name` est une colonne
   texte simple : il n'existe **pas** de `session_translations`. Les noms retenus sont donc lisibles
   dans les deux langues (« Push », « Pull », « Legs », « Upper », « Lower ») plutôt que français seuls
   comme le seed initial (« Séance A/B/C »). Une vraie i18n des séances demanderait une table dédiée →
   **à ouvrir si le besoin se confirme**, hors périmètre ici.

## 8. Definition of Done

- [x] Méthode + catalogue validés (§2, §4, §7).
- [x] Programmes éditoriaux seedés (FR+EN) : **3 muscu + 3 course publiés**, vérifiés en base.
- [x] Bruit éditorial retiré du publié (2 programmes de test → `draft`).
- [ ] Visibles dans les 2 bibliothèques et **duplicables** — à confirmer en recette.
- [ ] Parcours complet vérifié device : biblio → dupliquer → planifier la copie → activer (sur la copie).
- [x] Roadmap 3.1 + 5.2 → ✅.
- [x] Aucune migration de **schéma** ; migration de **données** idempotente rejouable (`20260729075443`).
