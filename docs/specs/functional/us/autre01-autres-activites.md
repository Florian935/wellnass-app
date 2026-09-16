---
id: AUTRE-01
titre: "Les autres activités : vélo, natation, rando… saisies à la main"
roadmap: [4.42]
catalogue: [TRI-05]
etape: recette
branche: dev
maj: 15/09/2026
---

# US AUTRE-01 — Les autres activités

> ⚠️ **Spec écrite avec le code** (lot en une passe du 15/09/2026). Cadrage :
> [analyse-depense-activites-2026-09.md](../../../product/analyse-depense-activites-2026-09.md) §6.

## 0. Le défaut

L'application ne connaissait que **deux** types d'activité, **partout** : la série, le jour
d'entraînement, la charge (ACWR, garde-fou), le temps d'entraînement et Health Connect. Trois heures
de vélo un dimanche comptaient pour un **jour de repos** — et cassaient la série.

## 1. La saisie

Un écran, cinq gestes : **tes habituelles** (combinaisons répétées, un tap) → **type** (8 fréquents,
« Tout voir » pour les 22) → **durée** (stepper 5 min + préréglages 30/45/60/90) → **intensité** →
deux champs facultatifs (**distance**, **chiffre de la montre**). L'estimation se recalcule à chaque
geste, avant même d'enregistrer.

- **R1 — L'intensité se déclare au test de la parole** : *tu peux chanter / parler / quelques mots*.
  Personne ne sait dire « 7/10 » sans cardiofréquencemètre.
- **R2 — Le ressenti est prérempli depuis l'intensité** (3 / 5 / 8). 🔴 Sans ressenti, la charge sRPE
  de l'activité vaudrait **zéro** : trois heures de vélo ne pèseraient rien dans l'ACWR, et l'app
  dirait « repos » à quelqu'un qui vient de rouler 90 km.
- **R3 — Ni course ni musculation au catalogue** (décision D5) : elles ont leur pilier, leurs records
  et leur historique. Les dupliquer créerait des doublons que rien ne saurait dédoublonner.
- **R4 — Ni ménage, ni jardinage** : ces dépenses sont dans le **socle hors sport**. Les compter en
  plus rouvrirait le double comptage par une autre porte.
- **R5 — L'heure de fin est « maintenant »** ; le début s'en déduit par la durée. Le rattachement au
  jour se fait sur la **clé locale** (une sortie finie à 23 h 30 appartient à ce jour-là).

## 2. Ce que ça change — l'écran de confirmation

Après enregistrement, l'écran montre les **quatre effets réels**, parce qu'une activité notée sans
effet visible aurait l'air d'être notée dans le vide :

| Effet | Détail |
|---|---|
| **Cible du jour** | + bas de fourchette, **en mode « Selon ce que tu fais » seulement** ; sinon l'écran dit pourquoi elle ne bouge pas |
| **Série** | le jour devient actif (`DayActivity.other`) |
| **Charge de la semaine** | ressenti × minutes, dans l'ACWR, le garde-fou et le score de forme |
| **Health Connect** | séance du bon type, **sans calories** |

## 3. Intégrations (le cœur de l'US)

| Surface | Avant | Après |
|---|---|---|
| Série (`activeDayKeys`) | muscu · course · nutrition · pas | **+ autre activité** |
| Jour d'entraînement (`useIsTrainingDay`) | séance ou course terminée | **+ activité du jour** |
| Charge ACWR / garde-fou / readiness | `workouts ∪ runs` | **+ `activityLoadSessions`** |
| Temps d'entraînement (MR-06) | muscu + course | **+ 3ᵉ poste, sans gating** |
| Health Connect | 2 types (70, 56) | **+ le type du catalogue** |
| Export RGPD | 30 tables | **+ `activities`** |

🔴 **Aucun gating par pilier** sur la charge et le temps : une activité n'appartient à aucun pilier,
et une sortie vélo fatigue autant que le reste, que la course soit activée ou non.

## 4. Données

Table **`activities`** (migration `20260915165803`) : `activity_type` (**sans CHECK** — catalogue
applicatif évolutif, patron `pain_reports.zone`), `started_at`, `duration_seconds`, `intensity`
(CHECK, 3 valeurs fermées), `rpe`, `distance_m`, `device_kcal`, `notes`, soft delete.

🔴 **La dépense n'est pas stockée** (décision D3) : recalculée à la lecture avec le **poids à la
date**. Seul `device_kcal` est conservé — c'est une mesure, pas une estimation.

⚠️ **Sync rule à coller à la main** dans le dashboard PowerSync (bucket `user_data`) : sans elle, le
vélo du dimanche reste sur un seul téléphone **sans aucune erreur visible**, et la cible calorique
diffère d'un appareil à l'autre.

## 5. Portes d'entrée (décision D9)

1. **Journal nutrition** — carte « Ta journée en énergie » → « Ajouter une activité » ;
2. **Réglages › Suivi › Mes autres activités** — la porte transverse, pour qui n'a pas activé la
   nutrition ;
3. l'historique lui-même (`/activities`), qui porte le bouton d'ajout.

> ⚠️ **Pas d'entrée dans la barre d'actions rapides de l'accueil** : elle est documentée à **4
> pastilles maximum** (US ACCUEIL-03, au-delà le libellé casse aux grandes polices). Écart assumé
> par rapport à la décision D9, à rediscuter si la saisie s'avère trop enfouie en recette.

## 6. Fichiers

`activity.ts` (shared) · `activity-repository.ts` · `app/activity.tsx` (saisie + confirmation) ·
`app/activities.tsx` (historique) · `health-connect.ts` (`buildActivitySessionRecord`, `pushActivity`)
· `dashboard-repository.ts` (série, jour d'entraînement, charge, temps) · `data-export.ts`.

## 7. Ce qui n'est pas fait

- **L'édition ne réécrit pas Health Connect** (le record initial reste tel quel).
- **Aucune activité planifiable** : on note ce qui a eu lieu, jamais ce qui est prévu.
- **Pas de récurrence** (« vélotaf tous les mardis ») — seulement « tes habituelles », qui préremplit.
- **Pas d'import depuis une montre** (dédoublonnage non trivial, horizon 2).
- **Collisions (COLLIS-01)** : le catalogue porte déjà `focus` (jambes / haut / global), mais le
  détecteur ne le lit pas encore.
