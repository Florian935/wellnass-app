---
id: BIEN-03
titre: "Le check-in en deux temps — matin et soir, qualité de nuit, envie, étiquettes"
roadmap: [1.32]
catalogue: []
etape: recette
branche: dev
maj: 01/10/2026
---

# US BIEN-03 — Le check-in en deux temps

> Chantier « pilier Bien-être » — contexte et décisions dans [BIEN-02](bien02-pilier-bien-etre.md).
> Décisions appliquées ici : **D4** (deux moments) et **D5** (deux échelles, quatre étiquettes).
> Toile : planche « 04a · Le check-in du matin » de
> [design/pilier-bien-etre-2026-10/](../../../../design/pilier-bien-etre-2026-10/).
> Plan : [docs/plans/bien03-checkin-deux-temps.md](../../../plans/bien03-checkin-deux-temps.md).

## 1. Le problème

La feuille de BIEN-01 posait tout le matin : humeur, énergie, stress, nuit. Or l'humeur et le stress
**de la journée** ne se connaissent que le soir, et la nuit ne se connaît que le matin. Une seule
feuille obligeait à répondre de travers (« stress : celui d'hier ? d'aujourd'hui ? ») et à rallonger
le rituel au-delà des 10 secondes.

## 2. Ce que fait l'US

Chaque moment répond à **une question** et tient en **dix secondes** :

| Moment | Question | Ce qu'il pose |
|---|---|---|
| **Matin** | « que faire aujourd'hui ? » | la nuit (durée, au pas d'un quart d'heure, 7 h au premier « + »), **qualité de la nuit** (1-5), énergie, **envie de s'entraîner** (1-5) ; étiquettes **malade**, **en voyage** ; poids du jour (facultatif, comme BIEN-01) ; « Courbatures » ouvre le journal des douleurs (DOUL-01) |
| **Soir** | « comment s'est passée la journée ? » | humeur, stress ; étiquettes **journée chargée**, **soirée** ; les modules allumés ([BIEN-07](bien07-modules.md)) |

- **Le moment de l'heure est mis en avant** dans l'onglet Aujourd'hui : avant 12 h le matin, à partir
  de 17 h le soir, entre les deux celui qui n'est pas encore fait (`suggestCheckinMoment`). Les deux
  restent ouvrables à tout moment.
- **Le matin rattrape la veille** : si le soir d'hier manque (et qu'il est dans la fenêtre de saisie),
  la feuille du matin propose « Hier soir non noté » en un geste.
- Les deux moments écrivent **la même ligne** `daily_wellbeing` du jour (une ligne par jour civil
  local, comme BIEN-01).

## 3. Règles métier

1. **Une feuille n'écrit que les champs de son moment.** Le soir n'envoie ni la nuit ni l'énergie ; le
   matin n'envoie ni l'humeur ni le stress. Un champ vidé part à `null` (effacer reste possible), un
   champ qui n'appartient pas au moment n'est pas envoyé du tout (une mise à jour partielle n'efface
   pas ce qu'elle ne porte pas — règle du correctif LABO-01).
2. **Une nuit lue dans Health Connect et non touchée ne part pas** : la renvoyer la marquerait
   « saisie à la main » et la lecture suivante ne pourrait plus la compléter. Corrigée avec − / +, elle
   devient la nuit de l'utilisateur (`sleep_source = 'manual'`).
3. **« Non renseignée » reste atteignable** pour une nuit saisie (lien « effacer »). Pas pour une nuit
   lue : effacée, la lecture suivante la réécrirait ; elle se corrige.
4. **Rien d'obligatoire** : une feuille vide n'enregistre rien. Sur une ligne **existante**, une entrée
   « vide » s'écrit quand même (décocher « malade », retirer la seule humeur saisie) — avant, retirer le
   dernier indicateur d'un jour était ignoré en silence.
5. **Étiquettes** : liste fermée, une colonne booléenne par étiquette (`sick`, `busy_day`,
   `late_night`, `travel`). Une étiquette décochée seule ne **crée** pas de ligne.
6. « Courbatures » **n'est pas une étiquette** : c'est la « gêne » du journal des douleurs, ouvert en
   un tap (visible si le journal des douleurs est activé) — jamais un second endroit pour dire la même
   chose.
7. Fenêtre de saisie inchangée (BIEN-01 D4) : J-6 → aujourd'hui, jamais le futur.

## 4. Données

Migration `20261001084709_bien02_pilier_bien_etre` (poussée le 01/10/2026), **additive** :
`daily_wellbeing.sleep_quality`, `motivation` (smallint 1-5), `sick`, `busy_day`, `late_night`,
`travel` (boolean, défaut false), plus les colonnes des modules et de la nuit lue (BIEN-06, BIEN-07).
Toutes déclarées dans le schéma PowerSync local. **Aucune sync rule à redéployer** (`select *`).

## 5. Cas limites

| Cas | Comportement |
|---|---|
| Soir fait avant le matin | la ligne existe déjà ; le matin la complète sans toucher l'humeur |
| Matin fait deux fois | la seconde corrige la première (même ligne) |
| Nuit lue puis check-in du matin sans toucher la nuit | la nuit reste « health_connect » |
| Échec d'écriture | message d'erreur dans la feuille, qui ne se ferme pas |
| Ligne d'avant le pilier (colonnes neuves à NULL) | se relit « non renseigné » ; les étiquettes « non coché » |
| Pilier éteint | la feuille de BIEN-01 reste celle de l'accueil, inchangée |

## 6. Offline

Écriture locale (repository → SQLite PowerSync), synchronisée en arrière-plan.

## 7. i18n

FR + EN : `wellbeing.moments.*` (titres, surtitres, rattrapage, badge « lue par Health Connect »,
courbatures), `wellbeing.indicators.{sleepQuality,motivation}`, `wellbeing.levels.{sleepQuality,motivation}`
(libellés des dix nouveaux niveaux), `wellbeing.tags.*`.

## 8. Ce qui n'est pas fait

- Le chronométrage « dix secondes par moment » se fait **en recette**, téléphone en main.
- Pas de rappel (notification) du check-in du soir : à décider après usage.

## 9. Critères d'acceptation

[RECETTES.md](../../../../RECETTES.md) §90 B.
