---
id: STREAK-01
titre: "Joker de série (gel d'un jour manqué)"
roadmap: [7.14]
catalogue: []
etape: recette
branche: feature/streak01-joker
maj: 29/07/2026
---

# US STREAK-01 — Joker de série

> **Décisions produit arbitrées par Florian le 29/07/2026**, sur les 4 questions posées avant tout
> code. Roadmap **7.14** (V0.9, P1, ~3 h). **Gratuit en V1** (arbitrage D) et **sans boucle de jeu**
> (arbitrage C) : un joker n'est pas une récompense qu'on gagne, c'est un filet qu'on utilise.
>
> **Vérifié avant d'écrire** : aucun joker n'existe dans le code.

## 0. Ce que le code décide déjà — hors périmètre de discussion

Deux règles sont **déjà** en place et ne changent pas :

1. **Ce qui rend un jour actif** : une séance muscu **ou** une sortie **ou** un repas journalisé **ou**
   l'objectif de pas atteint ([streak.ts:70](../../../../packages/shared/src/streak.ts#L70)).
2. **Une tolérance existe déjà pour le jour courant** : si rien n'a été fait aujourd'hui mais que hier
   était actif, la série tient — la journée n'est pas finie
   ([streak.ts:29](../../../../packages/shared/src/streak.ts#L29)). Le joker ne concerne donc que les
   jours **révolus**.

## 1. Décisions arbitrées

| # | Question | Décision | Pourquoi |
|---|---|---|---|
| **D1** | Déclenchement | **Manuel, rétroactif à l'ouverture** : l'app détecte la rupture et propose « hier tu n'as rien enregistré, ta série de 12 jours est tombée — utiliser ton joker ? » | Reste un **acte délibéré**, donc la série garde son sens. Et ça fonctionne dans le cas le plus fréquent : on a manqué sa journée **parce qu'on n'a pas ouvert l'app**. Un joker automatique rendrait la série sourdement inbrisable — la même erreur que si le check-in de BIEN-01 comptait dans la série |
| **D2** | Recharge | **1 par mois calendaire**, remis à zéro le 1er | La formulation du backlog, la plus lisible et la plus simple à annoncer. L'effet de bord (manquer le 31 puis le 1er = 2 jokers en 24 h) est assumé : il joue en faveur de l'utilisateur |
| **D3** | Effet sur les autres statistiques | **La série uniquement** | Le joker protège **le compteur**, il ne fabrique pas d'activité. L'adhérence, la complétion du journal et les corrélations post-V1 continuent de voir un jour vide **parce qu'il l'est**. Falsifier la donnée pour sauver un affichage serait le pire des choix |
| **D4** | Jours consécutifs | **Un seul joker par trou** | Un joker sauve **un** jour isolé. Deux jours d'affilée sans rien, c'est une interruption réelle. C'est ce qui distingue l'accident de l'arrêt |
| **D5** | Fenêtre de rattrapage | **7 jours**, et seul le **trou le plus récent** est proposé | *Dérivée, tranchée par moi.* Ressusciter une série interrompue depuis deux semaines n'aurait pas de sens |
| **D6** | Stockage | Table dédiée **`streak_jokers`**, une ligne par joker consommé | *Dérivée.* Rend le décompte mensuel trivial (`count` sur le mois) et l'usage **auditable**, là où un champ JSON sur les réglages serait opaque et pénible à faire évoluer |

## 2. Périmètre

**Dans le périmètre** : table `streak_jokers`, calcul de série tenant compte des jokers, détection du
trou rattrapable, proposition dans le widget de série, consommation en un tap, i18n FR + EN.

**Hors périmètre, explicitement**

- **Récompenser** l'obtention d'un joker (notification, badge, animation) → arbitrage C.
- **Acheter** ou gagner des jokers supplémentaires → arbitrage D (gratuit en V1).
- **Annuler** un joker déjà consommé. Un filet qu'on peut retirer après coup n'en est pas un ; et le
  soft delete garde de toute façon la trace si un correctif s'avérait nécessaire.
- Toute **statistique** sur l'usage des jokers.

## 3. Comportement

- Le widget de série affiche, comme aujourd'hui, le nombre de jours consécutifs.
- **Quand un trou rattrapable est détecté** (un seul jour manqué, dans les 7 derniers jours, un joker
  disponible ce mois-ci), le widget propose de l'utiliser, en annonçant **ce qu'on sauve** : « ta
  série de 12 jours ». Sans ce chiffre, la proposition n'a pas d'enjeu.
- Un tap consomme le joker : le jour est enregistré dans `streak_jokers`, la série est **recalculée
  immédiatement** et repart de sa valeur d'avant la rupture, augmentée des jours écoulés depuis.
- Aucun joker disponible ce mois-ci → **rien n'est proposé**, et rien n'est expliqué non plus : on
  n'affiche pas une action impossible, et le widget ne sait de toute façon pas distinguer « aucun
  trou » de « un trou mais plus de joker » — `findRestorableGap` renvoie `null` dans les deux cas.
  **Choix assumé** : la règle (« 1 joker par mois, un jour isolé ») est affichée **dans la proposition
  elle-même**, c'est-à-dire au seul moment où elle compte.
- Un joker déjà consommé sur un jour est **définitif** (hors périmètre : l'annulation).

## 4. Modèle de données

```sql
create table public.streak_jokers (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,          -- le jour manqué que le joker couvre
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

- **Index unique partiel** `(user_id, log_date) where deleted_at is null` : un même jour ne peut pas
  consommer deux jokers.
- Index de lecture `(user_id, log_date desc)`.
- RLS `select` / `insert` / `update` sur `auth.uid()`, **pas de `delete`** (soft delete).
- `on delete cascade` → purge de compte (CONF-02) couverte sans toucher `purge_expired_accounts()`.
- ⚠️ **Deux migrations** (table puis `alter publication powersync`) et **sync rule à déployer à la
  main** — bucket `user_data`.

## 5. Règles de calcul

C'est ici que tout se joue, et ces règles vivent dans une brique **pure et testée** :

- Un jour compte dans la série s'il est **actif** *ou* **couvert par un joker**.
- ⚠️ **Deux jours couverts par un joker ne peuvent pas se suivre** (D4). Garde-fou **dans le calcul**,
  pas seulement à la consommation : si l'état de la base contenait deux jokers consécutifs, la série
  doit s'arrêter là plutôt que de propager une valeur fausse.
- Le **trou rattrapable** est le jour manqué le plus récent tel que : c'est un **seul** jour (le jour
  précédent est actif), il est dans les **7 jours**, et il n'est pas déjà couvert.
- Le **décompte mensuel** compte les jokers vivants dont `log_date` **et** la consommation tombent
  dans le mois calendaire courant. On compte sur `log_date` : c'est la date que l'utilisateur voit.

## 6. i18n (FR + EN)

Clés ajoutées sous `home.streak` : titre, proposition (avec le nombre de jours sauvés **et** la date
du jour manqué), bouton, rappel de la règle, message d'erreur, libellé d'accessibilité. Aucune chaîne
en dur, pluriels gérés.

## 7. Offline

Écriture locale d'abord (UUID client, UTC, soft delete). Le calcul est **100 % local** : le joker
fonctionne hors ligne. ⚠️ Sync rule manuelle après la migration.

## 8. Cas limites

| Situation | Comportement |
|---|---|
| Aucun trou | Rien n'est proposé. |
| Trou de 2 jours ou plus | Rien n'est proposé (D4) — c'est une interruption réelle. |
| Trou de plus de 7 jours | Rien n'est proposé (D5). |
| Joker déjà utilisé ce mois-ci | Rien n'est proposé, et la règle est expliquée. |
| Deux jokers consécutifs en base (anomalie) | Le calcul **s'arrête** au second plutôt que de propager une série fausse. |
| Joker sur un jour finalement devenu actif (séance saisie en retard) | Sans effet : le jour est actif de toute façon. Le joker reste consommé — on n'invente pas un remboursement. |
| Changement de mois entre la détection et le tap | Le décompte est relu à la consommation, pas figé à l'affichage. |
| Hors-ligne | Fonctionne à l'identique. |

## 9. Definition of Done

- [ ] 2 migrations poussées + cochées au registre + `db:types`.
- [ ] **Sync rule déployée à la main** (bucket `user_data`).
- [ ] Table dans `powersync/schema.ts` et dans l'**export RGPD**.
- [ ] Brique de calcul **pure et testée**, garde-fou des jokers consécutifs compris.
- [ ] i18n FR + EN.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test` verts.
- [ ] Roadmap 7.14 → ✅ (ou 🟡 si la recette device reste à faire).

## 10. Critères d'acceptation (recette device)

1. Manquer un jour, ouvrir l'app le lendemain : la proposition apparaît et **annonce le nombre de
   jours sauvés**.
2. Utiliser le joker : la série repart de sa valeur d'avant la rupture, sans repasser par 0.
3. Le mois même, manquer un autre jour : **plus de proposition** (la règle, elle, est rappelée dans la
   proposition quand elle apparaît — voir §3).
4. Manquer deux jours d'affilée : aucune proposition (interruption réelle).
5. Le jour couvert reste **vide** dans le journal et les statistiques (D3) — vérifier l'adhérence.
6. Au 1er du mois suivant, un joker est de nouveau disponible.
7. En mode avion : proposition et consommation fonctionnent, remontée au retour du réseau.
8. L'export RGPD contient les jokers consommés.
