---
id: OBJ-01
titre: "Objectifs personnels à échéance"
roadmap: [7.15]
catalogue: []
etape: code
branche: feature/obj01-objectifs
maj: 29/07/2026
---

# US OBJ-01 — Objectifs personnels à échéance

> **4 décisions produit arbitrées par Florian le 29/07/2026** avant tout code. Roadmap **7.15**
> (V0.9, P1, ~6 h — le plus gros item du reste). **Non social** et **mono-objectif** :
> l'[objectif hybride à arbitrage de compromis](../../../../IDEAS.md) et les défis entre amis restent
> post-V1.
>
> **Vérifié avant d'écrire** : rien n'existe (aucune table, aucun écran).
>
> ⚠️ **État au 29/07/2026 — US NON LIVRÉE, partiellement implémentée.** Sont faits : ce cadrage et la
> **brique de progression pure** (`goals.ts`, 21 tests) qui encode toutes les règles du §5. Restent :
> les 2 migrations, le repository, l'écran liste/création, le widget et l'i18n. La roadmap 7.15 reste
> donc **⬜**, pas 🟡 : rien n'est utilisable par un utilisateur à ce stade.

## 0. La contrainte structurante

Le backlog l'énonce et elle commande toute la conception : **la progression doit se brancher sur les
agrégats existants, pas en créer de nouveaux.** Inventaire de ce qui est disponible :

| Source | Brique | Ce qu'elle permet de viser |
|---|---|---|
| Distance / durée de course par période | `aggregateRunStats` | « 50 km ce mois » |
| Force sur un exercice | `estimate1RM`, `sessionBestEstimated1RM` | « +5 kg au développé » |
| Volume muscu | `computeVolume` | (post-V1) |
| Poids de corps | `weightTrend`, `computeWeightGoalProgress` | (déjà couvert par 4.30 / NUTR-11) |
| Pas | `daily_steps` | (post-V1) |

## 1. Décisions arbitrées

| # | Question | Décision | Pourquoi |
|---|---|---|---|
| **D1** | Types au lancement | **2** : `run_distance` (distance de course sur une fenêtre) et `exercise_1rm` (force sur un exercice) | Les deux exemples de la roadmap, et surtout **deux formes de progression radicalement différentes** : un **cumul** qui part de zéro, et un **record** qui part d'une valeur existante. Valider l'architecture sur ces deux cas, c'est la valider sur les cas durs — un seul type aurait mal dimensionné le modèle |
| **D2** | Nombre simultané | **3 maximum** | Viser un objectif de course **et** un de force en parallèle est le cas d'usage naturel : ils ne se concurrencent pas. Le plafond évite la liste de bonnes résolutions que plus personne ne suit |
| **D3** | À l'échéance | **Clôturé et conservé**, avec son verdict atteint / non atteint | Un objectif manqué qu'on efface n'apprend rien. Et garder la trace est ce qui rendra une analyse post-V1 possible |
| **D4** | Jalons et célébration | **Jalons visuels seuls** (repères à 25/50/75 % sur l'anneau) + un **état visuel distinct à 100 %**. Aucune notification, aucune animation, aucun badge | Respecte la roadmap (qui mentionne jalons et célébration) **et** l'arbitrage C : le progrès se **voit**, il ne se fête pas. Évite aussi une dépendance à l'infra de notifications, qui appartient à MUSC-F8 / NUTR-F1 |
| **D5** | Calcul du verdict | **Fonction pure de la fenêtre `[début, échéance]`** — aucune écriture à l'échéance | *Dérivée, tranchée par moi.* Trois bénéfices : **aucun travail de fond** à déclencher (pas de cron, pas de job au démarrage) ; un record battu deux mois plus tard ne peut pas « réussir » rétroactivement un objectif passé ; et **ça marche hors ligne**. Un `status` stocké aurait demandé un écrivain, donc un moment où l'app doit tourner |
| **D6** | Valeur de départ | **Figée à la création** pour `exercise_1rm`, inutile pour `run_distance` | *Dérivée.* « +5 kg au développé » n'a de sens que par rapport au 1RM **du jour où l'objectif est posé**. Même patron que `start_weight_kg` (NUTR-11). Un cumul de course, lui, part de zéro par construction |

## 2. Périmètre

**Dans le périmètre** : table `personal_goals`, brique de progression **pure et testée** par type,
écran liste + création, anneaux de progression avec jalons visuels, i18n FR + EN.

**Hors périmètre, explicitement**

- **Tout aspect social** : partage, comparaison, défis entre amis → V2 et au-delà.
- **Objectif composite** à arbitrage de compromis (« courir un 10 km **tout en** gardant mon squat ») →
  c'est l'[objectif hybride unifié](../../../../IDEAS.md) d'IDEAS, une brique de positionnement, pas
  cette US.
- **Notifications** de jalon ou d'échéance approchante (D4) → famille MUSC-F8 / NUTR-F1.
- Les **autres types** (volume, poids, pas, nombre de séances). Le modèle est conçu pour les accueillir
  sans migration — voir §4.
- **Modifier la cible** d'un objectif en cours : cela viderait de sens l'engagement. On supprime et on
  recrée.

## 3. Comportement

- Jusqu'à **3 objectifs actifs**. Au-delà, la création est refusée avec un message explicite.
- Un objectif porte : un **type**, une **cible**, une **date de début** (par défaut aujourd'hui) et une
  **échéance**. Pour `exercise_1rm`, il porte aussi l'**exercice visé** et le **1RM de départ**, figé.
- L'anneau de progression affiche le pourcentage atteint, borné à 100 %, avec des **repères visuels** à
  25/50/75 %. À 100 %, l'anneau prend un état distinct.
- **Après l'échéance**, l'objectif quitte la liste active et rejoint une section « terminés », marqué
  **atteint** ou **non atteint**. Le verdict ne bouge plus, puisqu'il ne porte que sur la fenêtre.
- La progression est **toujours recalculée à l'affichage** : aucune valeur de progression n'est stockée,
  seule la cible et le point de départ le sont.

## 4. Modèle de données

```sql
create table public.personal_goals (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('run_distance', 'exercise_1rm')),
  -- Cible : mètres pour run_distance, kilogrammes pour exercise_1rm.
  target_value numeric(10, 2) not null check (target_value > 0),
  -- Valeur de départ figée (D6) : le 1RM du jour de création. NULL pour un cumul.
  start_value numeric(10, 2),
  -- Exercice visé, requis pour exercise_1rm, NULL sinon.
  exercise_id uuid references public.exercises (id) on delete set null,
  start_date date not null,
  deadline date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

- `check (deadline >= start_date)` : une échéance antérieure au début serait ininterprétable.
- `check` sur `kind` **plutôt qu'un enum** : ajouter un type plus tard ne demandera que de remplacer
  le check — c'est ce qui rend les types différés de §2 accessibles **sans migration de données**.
- `exercise_id` en `on delete set null` : si un exercice éditorial disparaît, l'objectif ne doit pas
  être supprimé en cascade. Il devient simplement non calculable, et l'UI le dit.
- Index `(user_id, deadline desc)` : l'affichage trie par échéance.
- RLS `select` / `insert` / `update` sur `auth.uid()`, **pas de `delete`** (soft delete).
- ⚠️ **Deux migrations** (table puis `alter publication powersync`) et **sync rule à déployer à la
  main** — bucket `user_data`.

**Pas de colonne `status` ni `progress`** : les deux sont **dérivables** (D5), et les stocker créerait
une seconde vérité à maintenir — plus un écrivain à déclencher.

## 5. Règles de calcul

Dans une brique **pure et testée** :

- **`run_distance`** : somme des distances des courses **terminées dans la fenêtre**
  `[start_date, min(aujourd'hui, deadline)]`. Progression = somme / cible.
- **`exercise_1rm`** : meilleur 1RM estimé **atteint dans la fenêtre**, comparé à `start_value`.
  Progression = (meilleur − départ) / (cible − départ). Une cible ≤ départ est refusée à la création :
  un objectif déjà atteint n'engage rien.
- **Progression bornée à [0, 1]** pour l'affichage, mais la valeur brute reste disponible : dépasser
  sa cible est une information, pas un débordement à masquer.
- **Verdict** : `atteint` si la progression brute ≥ 1 **au terme de la fenêtre**. Avant l'échéance,
  l'objectif est `en cours` même à 100 % — il reste possible de continuer d'accumuler.
- **Exercice supprimé** (`exercise_id` devenu NULL) → progression **non calculable**, et l'UI le dit
  plutôt que d'afficher 0 %.

## 6. i18n (FR + EN)

Namespace `goals` : titres, libellés des 2 types, formulation des cibles avec unité, échéance, verdict,
états vides, erreurs (plafond atteint, cible invalide). Aucune chaîne en dur, pluriels gérés.

## 7. Accessibilité

L'anneau ne porte **jamais** seul l'information : le pourcentage et la valeur sont écrits en texte à
côté. Cibles ≥ 48 dp, `maxFontSizeMultiplier` sur les libellés courts, verdict annoncé en mots
(« atteint », « non atteint ») et pas seulement par une couleur.

## 8. Offline

Écriture locale d'abord (UUID client, UTC, soft delete). **Tout le calcul est local** — conséquence
directe de D5. ⚠️ Sync rule manuelle après la migration.

## 9. Cas limites

| Situation | Comportement |
|---|---|
| Aucun objectif | État vide invitant. |
| 3 objectifs actifs, tentative de création | Refusée, avec un message expliquant le plafond. |
| Cible ≤ valeur de départ (`exercise_1rm`) | Refusée à la création : un objectif déjà atteint n'engage rien. |
| Échéance antérieure au début | Refusée (contrainte SQL **et** contrôle applicatif). |
| Échéance atteinte aujourd'hui | L'objectif est encore **actif** aujourd'hui ; il se clôt demain. |
| Cible dépassée avant l'échéance | Anneau à 100 %, statut **en cours** — on peut continuer d'accumuler. |
| Exercice de l'objectif supprimé | Progression non calculable, affichée comme telle. |
| Aucune course / séance dans la fenêtre | Progression 0 %, ce qui est exact. |
| Hors-ligne | Fonctionne à l'identique. |

## 10. Definition of Done

- [ ] 2 migrations poussées + cochées au registre + `db:types`.
- [ ] **Sync rule déployée à la main** (bucket `user_data`).
- [ ] Table dans `powersync/schema.ts` et dans l'**export RGPD**.
- [ ] Brique de progression **pure et testée** pour les 2 types, verdict compris.
- [ ] Écran liste + création, anneaux avec jalons visuels.
- [ ] i18n FR + EN.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test` verts.
- [ ] Roadmap 7.15 → ✅ (ou 🟡 si la recette device reste à faire).

## 11. Critères d'acceptation (recette device)

1. Créer « 50 km d'ici la fin du mois » : l'anneau reflète les courses déjà faites dans la fenêtre.
2. Créer « +5 kg au développé couché d'ici 8 semaines » : le 1RM de départ est celui du jour.
3. Enregistrer une course puis revenir : la progression a **augmenté** sans action de l'utilisateur.
4. Tenter un 4ᵉ objectif : refus avec message.
5. Tenter une cible de force **inférieure** au 1RM actuel : refus avec message.
6. Un objectif dont l'échéance est passée apparaît en « terminé » avec son verdict.
7. Le verdict d'un objectif terminé **ne change pas** après un nouveau record hors fenêtre.
8. Le pourcentage et la valeur sont lisibles **sans l'anneau** (accessibilité).
9. En mode avion : création et progression fonctionnent.
10. L'export RGPD contient les objectifs.
