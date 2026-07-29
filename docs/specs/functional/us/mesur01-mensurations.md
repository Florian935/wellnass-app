---
id: MESUR-01
titre: "Mensurations corporelles"
roadmap: [3.51]
catalogue: []
etape: recette
branche: feature/mesur01-mensurations
maj: 29/07/2026
---

# US MESUR-01 — Mensurations corporelles

> **Validée par Florian le 29/07/2026** (« go pour le dev MESUR-01 »), livrables d'amont et code
> couverts par le même go, mes recommandations valant arbitrage. Roadmap **3.51** (V0.9, P1, ~5 h).
>
> **Vérifié avant d'écrire** — et contrairement aux trois items précédents, **rien n'existe** :
> aucune table dans `database.types.ts`, aucun écran, aucun repository.

## 0. Contexte

Cette US fait enfin descendre **E8** de la [spec musculation §5](../musculation.md#L184), cadrée le
04/07/2026 en **quatre lignes** et jamais passée en US — donc jamais dotée d'un modèle de données :

> - Suivi du **poids de corps** (a minima) […]
> - **Mesures corporelles optionnelles** : tour de bras, taille, tour de poitrine, cuisses, etc.
> - **Photos de progression** : galerie **privée** (Storage privé, protégé par RLS).
> - **Courbes d'évolution** du poids de corps et des mesures.

Le poids et ses courbes existent (4.30). Les **mensurations** n'existent pas du tout. Et elles
partagent la propriété qui a fait passer BIEN-01 en premier : **la donnée est historisée, donc chaque
mois non mesuré est perdu définitivement.** C'est ce qui justifie de la livrer avant les US de
rétention qui, elles, exploiteront des données déjà là.

### Ce qui existe et qu'on réutilise

| Brique | Où | Usage ici |
|---|---|---|
| Courbe + lissage + infobulle | `ProgressLineChart` (prop `smooth`), `movingAverage`, UX-01 | une courbe par mesure |
| Conversion d'unités | `useUnits()`, `CM_PER_IN` dans [units.ts](../../../../packages/shared/src/units.ts) | cm ↔ pouces |
| Patron « une ligne par jour » offline-first | [migration BIEN-01](../../../../supabase/migrations/20260728185757_bien01_daily_wellbeing.sql) | index unique partiel, RLS sans `delete`, soft delete |
| Feuille de saisie | `WellbeingCheckinSheet` (BIEN-01) | même patron de conteneur |
| Écran de progression muscu | [progress/index.tsx](../../../../apps/mobile/src/app/progress/index.tsx) | point d'entrée (E8 est un epic **muscu**) |

⚠️ **`formatHeight()` ne convient pas.** Il rend l'impérial en **pieds-pouces** (« 5 ft 9 in »), ce
qui est juste pour une taille humaine et absurde pour un tour de bras : 35 cm s'afficherait
« 1 ft 1.8 in » au lieu de **13,8 in**. Il faut un helper dédié aux **circonférences**, et
`cmToIn` / `inToCm` n'existent pas encore dans `units.ts`.

## 1. Décisions de cadrage

| # | Question | Décision retenue | Pourquoi |
|---|---|---|---|
| **D1** | Table **large** (une colonne par mesure) ou **normalisée** (une ligne par mesure) ? | **Normalisée** : une ligne par `(log_date, kind, value_cm)` | **C'est la décision structurante.** La liste des mesures a vocation à bouger — la spec E8 dit elle-même « etc. ». En large, **chaque ajout de mesure = une migration**, et la table serait majoritairement `NULL` (personne ne mesure tout). En normalisé, ajouter « mollet » ou « avant-bras » ne coûte **rien en base**. Et « une courbe par mesure » devient une requête naturelle. Divergence assumée avec BIEN-01, qui est large **parce que** ses 3 indicateurs sont figés par la roadmap |
| **D2** | Quelles mesures au lancement ? | **6** : taille, poitrine, hanches, bras, cuisse, mollet | Couvre le « tour de bras, taille, tour de poitrine, cuisses » de E8 + hanches (indispensable au ratio taille/hanches) et mollet (demandé en muscu). Au-delà, on encombre la saisie pour des mesures que peu suivent |
| **D3** | Gauche / droite pour les membres ? | **Non**, une seule valeur par type | Doubler la liste pour une précision que presque personne ne suit. L'asymétrie est un sujet d'**analyse** post-V1. Et grâce à D1, l'ajouter plus tard **ne coûtera aucune migration** — c'est exactement le bénéfice qu'on achète |
| **D4** | Fenêtre de rattrapage, comme la D4 de BIEN-01 ? | **Non : toute date passée est modifiable**, jamais le futur | **Divergence argumentée.** BIEN-01 borne à J-6 parce que réécrire un ressenti *subjectif* trois semaines plus tard le fabrique. Un tour de taille est une mesure **objective**, relevée au mètre, qu'on saisit très légitimement en retard depuis une note. Interdire serait un garde-fou sans objet |
| **D5** | Un widget d'accueil ? | **Non**, l'écran suffit | L'accueil porte déjà 11 widgets. Une mesure **mensuelle** ne justifie pas une place permanente sur un écran quotidien. Point d'entrée : l'écran **Progression** muscu, là où un pratiquant suit l'évolution de son corps |
| **D6** | Une ligne « session » ou des mesures indépendantes ? | **Indépendantes**, regroupées par date à l'affichage | On mesure parfois le bras seul. Exiger un relevé complet ferait abandonner ; le regroupement par date est un travail d'affichage, pas de modèle |

## 2. Périmètre à livrer

**Dans le périmètre**

1. Table **`body_measurements`** normalisée, offline-first, historisée.
2. **Feuille de saisie** : les 6 mesures, toutes optionnelles, pré-remplies avec le dernier relevé.
3. **Écran d'historique** : sélecteur de mesure + courbe + liste des relevés par date, avec le
   **delta depuis le relevé précédent**.
4. **Point d'entrée** depuis l'écran Progression, avec un lien vers la courbe de poids existante.
   ⚠️ Saisie **du jour uniquement** en V1 — voir la limite en §3.1.
5. Helpers d'unités : `cmToIn` / `inToCm` (purs, testés) + `formatCircumference` /
   `parseCircumferenceToCm` dans `useUnits`.
6. **i18n FR + EN** complet, noms des 6 mesures compris.

**Hors périmètre, explicitement**

- **Photos de progression** (E8) : Storage privé + RLS + gestion de quota + suppression RGPD. C'est
  un sous-lot à part entière, **post-V1** — l'annoncer ici serait le sous-estimer.
- **Le poids** : il reste dans `body_weight_entries` et sa courbe existe (4.30). On y **renvoie**.
- Toute **analyse dérivée** (ratio taille/hanches, % de masse grasse estimé, asymétrie
  gauche/droite) : cette US **produit la donnée**, elle ne l'interprète pas.
- **Rappel programmé** de prise de mesures → même famille que NUTR-F1 / MUSC-F8.

## 3. Comportement attendu

### 3.1 Saisie

- Feuille ouverte depuis l'écran Progression, sur le patron de `WellbeingCheckinSheet`.
- Les 6 champs sont **numériques et optionnels**, chacun pré-rempli avec **la dernière valeur connue**
  — on mesure rarement du premier coup, et repartir du dernier relevé fait gagner du temps tout en
  montrant l'écart en direct.
- La date est celle du **jour**. ⚠️ **Limite de la V1 livrée le 29/07/2026** : la feuille n'expose
  **pas** de sélecteur de date. Le repository accepte pourtant n'importe quelle date passée (D4,
  couvert par un test) — il ne manque que le contrôle d'UI. Assumé plutôt que bâclé en fin de lot :
  un sélecteur de date mal testé sur une saisie de 6 champs coûterait plus qu'il n'apporte. À ouvrir
  dès qu'un besoin de rattrapage se manifeste en usage réel.
- Enregistrer n'écrit que les champs **renseignés et modifiés**. Ré-enregistrer la même date **met à
  jour** la valeur de chaque mesure (jamais de doublon).
- Vider un champ **supprime** (soft delete) la mesure de cette date : c'est le seul moyen de corriger
  une saisie erronée.

### 3.2 Historique

- **Une courbe à la fois**, sélecteur de mesure — même raison que BIEN-01 : six courbes superposées
  sur un téléphone sont illisibles. Fenêtres 3 mois / 1 an / tout.
- Lissage disponible, **valeur brute dans l'infobulle** (règle UX-01).
- Liste des relevés par date, chacun avec son **delta** depuis le relevé précédent de la même mesure
  (« 82,0 cm · −1,5 »). Le signe est porté par **le texte**, pas seulement par la couleur.
- Un jour non mesuré est un **trou** : aucune interpolation, aucun zéro.

### 3.3 Unités

- Stockage **toujours en centimètres**. La conversion est un fait d'affichage, jamais de stockage —
  sinon un changement de réglage réécrirait l'historique.
- Affichage et saisie en cm ou en **pouces** selon `user_settings.units`, via les nouveaux helpers.

## 4. Modèle de données

```sql
create table public.body_measurements (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  kind text not null check (kind in ('waist','chest','hips','arm','thigh','calf')),
  value_cm numeric(5,1) not null check (value_cm > 0 and value_cm < 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

- **Index unique partiel** `(user_id, log_date, kind) where deleted_at is null` : une seule valeur
  vivante par mesure et par jour, et une ligne soft-deletée n'empêche pas d'en recréer une.
- Index de lecture `(user_id, kind, log_date desc)` : l'usage dominant est « l'historique d'**une**
  mesure », c'est-à-dire exactement ce que trace une courbe.
- `check` sur `kind` **plutôt qu'un enum Postgres** : ajouter une valeur à un enum est une migration
  pénible, remplacer un `check` est trivial. Cohérent avec D1 (rester ouvert à l'ajout).
- Bornes `> 0` et `< 300` cm : écarte une saisie manifestement fausse (virgule oubliée) sans juger
  la morphologie de personne.
- **RLS** `select` / `insert` / `update` sur `auth.uid()`, **pas de `delete`** (soft delete), FK
  `on delete cascade` → la purge de compte (CONF-02) est couverte sans toucher
  `purge_expired_accounts()`.

⚠️ **Deux migrations**, comme PAS-01 et BIEN-01 : la table, **puis**
`alter publication powersync add table`.

## 5. Offline

- Écriture locale d'abord, via un repository dédié. **UUID client**, timestamps **UTC**, soft delete.
- `log_date` est une **date civile locale**, pas un instant.
- Conflit multi-appareils : dernière écriture gagnante (PowerSync, [ADR-001](../../../adr/ADR-001-moteur-sync-offline.md)).
- ⚠️ **Sync rule à déployer À LA MAIN** après la migration — étape manuelle **déjà oubliée une fois**
  le 24/07. En DoD et en critère de recette.

## 6. i18n (FR + EN)

Namespace `measurements` : titres, libellés des **6 mesures**, unité, delta, états vides, erreurs.
Aucune chaîne en dur. Pluriels via `_one` / `_other`.

## 7. Accessibilité

- Champs numériques avec `accessibilityLabel` explicite incluant l'unité courante.
- Cibles **≥ 48 dp**, `hitSlop` si le visuel est plus petit.
- `maxFontSizeMultiplier` sur les libellés courts (6 lignes de saisie dans une feuille contrainte).
- Le **delta** est annoncé en texte (« moins 1,5 centimètre »), jamais par la seule couleur.

## 8. Cas limites

| Situation | Comportement attendu |
|---|---|
| Aucun relevé | Écran en état vide invitant. Aucune courbe. |
| Une seule date mesurée | Pas de courbe (un point n'est pas une tendance) ; la valeur est affichée. |
| Relevé partiel (le bras seul) | Accepté (D6). Les autres courbes ont un trou à cette date. |
| Deux relevés de la même mesure le même jour | Le second **met à jour** (index unique partiel). |
| Champ vidé sur une date existante | La mesure de cette date est **soft-deletée**. |
| Valeur hors bornes (0, 500 cm) | Refusée avec un message, pas un échec silencieux. |
| Virgule vs point décimal | Les deux acceptés à la saisie (`parseCircumferenceToCm`). |
| Changement de système d'unités | L'historique est **inchangé** (stocké en cm) ; seul l'affichage bascule. |
| Date future | Impossible : jamais proposée. |
| Hors-ligne total | Saisie possible, remontée à la reconnexion. |
| Sync rule non déployée | Données locales seulement, **aucune erreur visible** — d'où la DoD. |

## 9. Definition of Done

- [ ] 2 migrations poussées (`db:push`) + **cochées** au registre + `db:types` rejoué.
- [ ] **Sync rule déployée à la main** et vérifiée.
- [ ] Table déclarée dans `powersync/schema.ts`.
- [ ] `body_measurements` ajoutée à l'**export RGPD** (liste explicite de `data-export.ts`).
- [ ] `cmToIn` / `inToCm` + agrégats **purs et testés** dans `packages/shared`.
- [ ] i18n FR + EN complètes, 6 mesures comprises.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test` verts.
- [ ] Roadmap 3.51 → ✅ (ou 🟡 si la recette device reste à faire).

## 10. Critères d'acceptation (recette device)

1. Saisir 3 mesures, enregistrer, les retrouver dans l'historique à la bonne date.
2. Ré-ouvrir la feuille : les champs sont pré-remplis avec le dernier relevé.
3. Ré-enregistrer la même date **met à jour** — aucun doublon dans la liste.
4. Vider un champ retire cette mesure de cette date, et **elle seule**.
5. Saisir un relevé partiel : la courbe de cette mesure a un point, les autres un trou.
6. Basculer en impérial : les valeurs s'affichent en **pouces** (13,8 in, pas 1 ft 1,8 in), et
   l'historique est **inchangé** au retour en métrique.
7. Une valeur aberrante (500) est refusée avec un message.
8. La saisie porte sur **aujourd'hui** (pas de sélecteur de date en V1, voir §3.1). Une date future
   est impossible **par construction**.
9. En mode avion : saisie possible, données présentes après redémarrage, remontée au retour du réseau.
10. Le delta est lisible **sans la couleur** (texte « −1,5 »).
11. TalkBack annonce chaque champ avec son unité.
12. L'export RGPD contient les mensurations.
