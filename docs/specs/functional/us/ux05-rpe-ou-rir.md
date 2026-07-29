---
id: UX-05
titre: "Intensité en RPE ou en RIR, au choix"
roadmap: [3.55]
catalogue: []
etape: recette
branche: feature/ux05-rpe-ou-rir
maj: 29/07/2026
---

# US UX-05 — Intensité en RPE ou en RIR, au choix

> **3 décisions produit arbitrées par Florian le 29/07/2026** avant tout code, **+ 2 dérivées**
> tranchées par moi et signalées comme telles. Roadmap **3.55** (P2, ~2 h). Beaucoup de pratiquants
> raisonnent en *reps in reserve* plutôt qu'en effort perçu.

## 0. Ce que l'inventaire a révélé, et qui a changé le périmètre

**Le RPE existe à trois endroits, avec deux échelles différentes :**

| Où | Colonne | Échelle | Libellé avant cette US |
|---|---|---|---|
| **Par série** de musculation | `workout_sets.rpe` | 1-10 | « RPE 8 » |
| Ressenti de séance | `workouts.rpe` | **5 étoiles** (borné 1-5) | « Ressenti 4 / 5 » |
| Ressenti de course | `runs.rpe` | 1-10 | « Effort perçu : 7 / 10 » |

Le RIR signifie **« répétitions en réserve »**. Cela n'a de sens que pour une **série de musculation** :
convertir un ressenti global de séance en répétitions en réserve n'a pas de signification, et sur une
sortie de 10 km encore moins. De plus le ressenti de séance est sur une échelle **1-5**, où la formule
`RIR = 10 − RPE` serait arithmétiquement fausse.

**D'où le périmètre retenu (D1) : le RPE par série uniquement.**

## 1. Décisions

| # | Question | Décision | Pourquoi |
|---|---|---|---|
| **D1** | Périmètre | **Le RPE par série uniquement.** Le ressenti de séance (5 étoiles) et le ressenti de course sont **inchangés** | Voir §0 : « répétitions en réserve » n'a aucun sens pour eux, et l'échelle 1-5 du ressenti de séance rendrait la conversion fausse |
| **D2** | Plage en mode RIR | **Inversion pure : RIR 0 → 9** (les 10 valeurs restent saisissables) | Restreindre à la plage réellement utilisée (0-4) aurait rendu **inaffichables** les RPE de 1 à 5 déjà saisis, et repasser en mode RPE ne les aurait pas retrouvés. Ici la bascule est **réversible et sans perte**, ce qu'un test vérifie sur les 10 valeurs |
| **D3** | Affichage | **Seulement l'échelle choisie**, jamais les deux | C'est le but du réglage : parler la langue de l'utilisateur, pas lui rappeler l'autre à chaque ligne d'historique |
| **D4** | Où vit la préférence | *Dérivée.* **`user_settings.intensity_scale`**, juste à côté de `units` | C'est **le même patron** : « stockage toujours en métrique (SI), conversion à l'affichage ». Ici : stockage toujours en RPE, conversion à l'affichage. Et `user_settings` est déjà lue en `select *` par les sync rules → **aucune sync rule à redéployer** (précédent vérifié : `health_connect_enabled`) |
| **D5** | Absence de valeur | *Dérivée.* **`null` reste `null`** | La conversion naïve `10 - (rpe ?? 0)` transformerait une intensité **non saisie** en « RIR 10 », c'est-à-dire en information inventée. Deux tests verrouillent ce cas, dont un au niveau du composant |

## 2. Périmètre

**Dans le périmètre** : 1 colonne, brique de conversion **pure et testée**, saisie par série dans
l'échelle choisie, affichage dans l'historique détaillé, réglage dans les paramètres, i18n FR + EN.

**Hors périmètre, explicitement**

- Le **ressenti de séance** (5 étoiles) et le **ressenti de course** (D1).
- Une **troisième échelle** (%1RM par exemple). Le `check` SQL est écrit pour l'accueillir sans
  migration de données, mais elle n'est pas dans ce lot.
- **Convertir les données en base** : rien n'est converti, jamais — c'est tout le principe.

## 3. Comportement

- Un réglage **Échelle d'intensité** dans les paramètres, juste après les unités : `RPE` ou `RIR`.
- **Saisie par série** (carte « série en cours », niveau `detailed`) : les valeurs proposées sont
  celles de l'échelle choisie — RPE **1 → 10**, RIR **0 → 9**. La valeur choisie est **reconvertie en
  RPE** avant d'être stockée.
- **Ordre de lecture** : chaque échelle se lit de gauche à droite comme l'utilisateur la pense. En
  RPE l'effort croît vers la droite ; en RIR la réserve croît vers la droite, donc l'effort décroît.
  Présenter le RIR en 9 → 0 « pour garder l'ordre du RPE » serait déroutant.
- **Historique détaillé** : la série affiche « RPE 8 » ou « RIR 2 » selon le réglage.
- **Basculer d'échelle ne modifie aucune donnée.** Une série enregistrée à RPE 8 hier s'affiche
  « RIR 2 » après bascule, et « RPE 8 » de nouveau si on revient.
- Une intensité **non saisie** reste vide dans les deux échelles (D5).

## 4. Modèle de données

```sql
alter table public.user_settings add column intensity_scale text not null default 'rpe';
alter table public.user_settings add constraint user_settings_intensity_scale_check
  check (intensity_scale in ('rpe', 'rir'));
```

- **`workout_sets.rpe` est inchangée** et reste la seule vérité. Le RIR **n'est jamais stocké**.
- `check` plutôt qu'un enum (même raison que `personal_goals.kind`) : une troisième échelle ne
  demandera que de remplacer le check.
- **`not null default 'rpe'`** : les lignes existantes prennent le comportement d'avant l'US.
- ⚠️ **Une seule migration, et aucune sync rule à déployer** (D4).

## 5. Règles de calcul

Dans une brique **pure et testée** (`intensity.ts`) :

- `RIR = 10 − RPE`. Le RPE mesure la proximité de l'échec (10 = plus aucune répétition possible) ; le
  RIR mesure la même chose par l'autre bout.
- `toDisplayIntensity` / `fromDisplayIntensity` sont **réciproques exactes** — un aller-retour ne
  dérive pas, ce qui est la propriété qui rend la bascule non destructrice.
- `null` / `undefined` / valeur non finie → **`null`**, jamais une valeur convertie (D5).
- `intensityChoices` rend les 10 valeurs dans l'ordre de lecture de l'échelle.
- `parseIntensityScale` est **tolérant** : toute valeur inconnue retombe sur `rpe`. Les lignes locales
  antérieures à la migration n'ont pas la colonne et doivent continuer de fonctionner.

## 6. i18n (FR + EN)

Namespace `intensity` : libellé court (« RPE » / « RIR »), nom complet, aide par échelle, libellé et
aide du réglage.

⚠️ **4 clés existantes deviennent paramétrées** par `{{scale}}` : `workout.rpeAdd`,
`workout.rpeValue`, `workout.rpeLabel` et `history.detail.setRpe`. Un test qui verrouillait l'ancien
libellé en dur a été mis au nouveau contrat.

## 7. Accessibilité

Chaque valeur proposée porte un `accessibilityLabel` complet (« RIR 2 ») et non le seul chiffre :
hors contexte, « 2 » ne dit pas dans quelle échelle on se trouve. Cibles inchangées (déjà ≥ 48 dp).

## 8. Offline

La préférence est écrite localement puis synchronisée comme le reste de `user_settings`. La conversion
est **purement locale et instantanée** : aucun aller-retour réseau, rien à recalculer en base.

## 9. Cas limites

| Situation | Comportement |
|---|---|
| Réglages non encore chargés / synchronisés | Repli sur **RPE** (comportement d'avant l'US). Testé. |
| Ligne locale antérieure à la migration (colonne absente) | Parse tolérant → **RPE**. Testé. |
| Intensité non saisie | Reste vide dans les deux échelles — **jamais « RIR 10 »**. Testé 2 fois. |
| RPE déjà saisi à 3, bascule en RIR | S'affiche « RIR 7 ». Aucune perte (D2). |
| Retour en mode RPE | Réaffiche « RPE 3 » à l'identique. Testé sur les 10 valeurs. |
| Valeur en base hors 1-10 (donnée corrompue) | Convertie telle quelle ; aucune plantée, aucun `NaN`. |
| Ressenti de séance / de course | **Inchangés** (D1). |

## 10. Definition of Done

- [x] 1 migration poussée + cochée au registre + `db:types`.
- [x] **Aucune sync rule à déployer** — vérifié (`user_settings` en `select *`).
- [x] Colonne dans `powersync/schema.ts` + schéma Zod + mapping du repository (parse tolérant).
- [x] Brique `intensity.ts` **pure et testée** — **14 tests**, dont la réciprocité sur les 10 valeurs.
- [x] Saisie par série dans l'échelle choisie (**6 tests** de composant).
- [x] Affichage dans l'historique détaillé.
- [x] Réglage dans les paramètres, avec l'aide de l'échelle active.
- [x] i18n FR + EN ; 4 clés existantes paramétrées, test associé mis au nouveau contrat.
- [x] `npm run lint` (0 erreur), `npm run typecheck` (0 erreur), `npm run test` (**1286**) verts.
- [x] Roadmap 3.55 → 🟡 (recette device à faire).
- [ ] Recette device (9 critères ci-dessous).

## 11. Critères d'acceptation (recette device)

1. Réglages → **Échelle d'intensité** : les deux choix sont présents, avec l'aide de l'échelle active.
2. En mode **RPE** : la saisie par série propose **1 → 10**, l'affichage dit « RPE 8 ».
3. En mode **RIR** : la saisie propose **0 → 9**, l'affichage dit « RIR 2 » pour la même série.
4. **Le test qui compte** : saisir une série à RPE 8, basculer en RIR → elle affiche « RIR 2 ».
   Rebasculer en RPE → elle affiche « RPE 8 ». **Aucune donnée n'a bougé.**
5. Une série **sans** intensité reste sans intensité dans les deux modes (pas de « RIR 10 »).
6. L'historique détaillé d'une séance affiche l'échelle choisie.
7. Le **ressenti de séance** (5 étoiles) et le **ressenti de course** sont **inchangés** — c'est
   volontaire, à vérifier explicitement.
8. En **EN** : « RIR » et son aide sont en anglais.
9. Mode avion : le changement d'échelle s'applique immédiatement, et remonte au retour du réseau.
