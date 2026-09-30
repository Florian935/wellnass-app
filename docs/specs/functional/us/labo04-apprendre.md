---
id: LABO-04
titre: "Le Labo › Apprendre — enquêtes, expériences, et un verdict qui ne se désapprend pas"
roadmap: [7.41]
catalogue: []
etape: recette
branche: feature/labo-carrefour
maj: 30/09/2026
---
# US LABO-04 — Apprendre, et le verdict figé

> **Parcours** : chantier « le Labo, carrefour des piliers », livré en une vague le 30/09/2026 sur demande
> explicite de Florian. Voir l'en-tête de [LIENS-01](liens01-registre-liens.md).
> Plan : [labo04-apprendre.md](../../../plans/labo04-apprendre.md). Maquette de référence : planche
> `L11Apprendre`. Solde le constat 🔴 n° 1 laissé ouvert par [LABO-01](labo01-labo.md) (§4 bis).

## 0. Contexte

LABO-01 avait deux onglets pour ce qu'on apprend de soi : **Pourquoi ?** (quand une courbe cale, les
causes classées dans tes données, et l'expérience qui tranche) et **Acquis** (ce que le Labo sait de
toi, et les expériences en cours). Deux onglets pour un même geste — comprendre — et aucun chemin d'un
suspect vers le lien qu'il met en cause.

Et un défaut de fond, relevé en revue le 15/09/2026 : **un acquis pouvait se désapprendre**. Le verdict
d'une expérience était recalculé à chaque rendu sur une fenêtre **glissante** de 56 jours ; une
expérience dure 28 jours ; 28 jours après la fin, ses premières semaines sortaient de la fenêtre et
« vérifié » redevenait « pas assez de mesures ».

## 1. Ce que l'US livre

### Un onglet Apprendre

Pourquoi ? et Acquis réunis, dans cet ordre : une phrase de tête (« Ton Labo apprend de toi. »),
les **enquêtes** (une question qui cale, ses suspects classés, ce qui est écarté, ce qui manque,
l'expérience qui tranche — inchangés depuis LABO-01, NARR-01 compris), puis **ce que le Labo sait de
toi** et les **expériences en cours**.

### Chaque suspect ouvre sa fiche

Un suspect (« jambes lourdes avant la qualité », « protéines basses », « nuits courtes »…) porte
« Voir le lien : <question> » vers la fiche du lien qu'il met en cause (`SUSPECT_LINK`, dans le registre), avec
`&from=learn` : la fiche le dit sur son bouton retour. Si le lien n'existe pas (pilier désactivé), le
bouton n'est **pas** proposé — une fiche vide derrière un bouton serait une impasse.

| Suspect | Fiche |
|---|---|
| Jambes lourdes avant la qualité | Tes deux sports se gênent-ils ? |
| Protéines basses · Déficit | Manges-tu assez pour ta muscu ? |
| Nuits courtes · Charge élevée | Récupères-tu assez ? |
| Surplus du week-end · Journal troué | Ton poids suit-il ton assiette ? |
| Glucides bas les jours durs | Ton carburant suit-il tes kilomètres ? |

Dans l'autre sens, Croiser et les fiches mènent à Apprendre (« Comprendre dans Apprendre », les
associations en apprentissage de la section « à découvrir »), par `/lab?section=learn`.

### Le verdict figé à la clôture

- Colonne **`lab_experiments.verdict`** (jsonb, migration `20260930135304`). Écrite **une fois**, à la
  clôture de l'expérience, avec le verdict calculé ce jour-là.
- `experimentVerdict` rend le verdict **figé** pour une expérience close qui en a un ; il ne le
  recalcule plus jamais. Une expérience close **avant** cette US (sans verdict figé) garde le calcul
  d'avant — on n'invente pas un verdict qu'on n'a pas écrit.
- Seuls les verdicts qui disent quelque chose se figent (`effect`, `noEffect`, `insufficient`) : un
  verdict encore « scellé » ou « arrêté » n'a rien à retenir.
- **Deux chemins de clôture**, tous deux avec le verdict :
  1. **automatique** : dès que la fenêtre de 28 jours est passée (`shouldFreezeExperiment`),
     `CrossLinksProvider` clôt l'expérience avec son verdict du jour — sans attendre que l'utilisateur
     rouvre le Labo ou relance une expérience ;
  2. **à la relance** : relancer un modèle dont l'ancienne expérience est finie la clôt d'abord, avec
     son verdict (l'index unique partiel n'admet qu'une ligne `running` par modèle).
- Un verdict figé illisible (JSON d'une forme inconnue, écrit par un client plus récent) est ignoré à la
  lecture (`isFrozenVerdict`) : on retombe sur le calcul, on ne plante pas.

## 2. Règles

- **R1** — Un acquis ne se désapprend pas parce que le temps passe.
- **R2** — L'expérience démarre **le lundi suivant**, jamais aujourd'hui (LABO-01, inchangé).
- **R3** — Le verdict reste **scellé** jusqu'au bout (LABO-01, inchangé).
- **R4** — Aucune expérience sur les calories (LABO-01 R6, inchangé).
- **R5** — Écrire une clôture passe par le garde `LAB_WRITE_READY` (patron CARDIO-UX01).

## 3. Offline

La clôture automatique s'écrit en local (PowerSync) et part à la reconnexion ; deux appareils qui
clôturent la même expérience écrivent la même ligne (même identifiant), la seconde écriture remplace la
première avec un verdict calculé sur les mêmes données.

## 4. i18n

`lab.learn.*` (dont `lab.learn.seeLink`), `lab.tabs.learn`, FR et EN. Les textes des enquêtes et des acquis sont ceux de LABO-01.

## 5. Tests

`lab-experiments.test.ts` (Vitest) : verdict figé rendu tel quel, jamais recalculé ; expérience close
sans verdict figé → calcul ; `shouldFreezeExperiment`. `lab-experiment-write.test.ts` : `finishLabExperiment`
écrit le verdict figeable, écrit `null` sinon ; lecture d'un verdict illisible. `lab-sql.test.tsx` :
`useLabCore` rend le verdict figé d'une expérience de juin (qui n'a plus aucune observation dans la
fenêtre). `lab-screen.test.tsx` : lancement le lundi suivant, pas de double lancement, clôture **avec**
verdict à la relance, arrêt depuis Apprendre, suspect → fiche (`from=learn`), pas de fiche pour un lien
absent.

## 6. Écarts assumés et ce qui n'est pas fait

- Les expériences **déjà closes** avant le 30/09/2026 n'ont pas de verdict figé : on ne réécrit pas le
  passé. En pratique, la recette de LABO-01 n'en a pas encore produit.
- Les constats LABO-01 §4 bis **n° 3** (assiette pleine sans protéines saisies) et **n° 5** (`loadRisk`
  muet en mono-pilier) restent ouverts : hors du périmètre de ce chantier.

## 7. Revue de code du 30/09/2026

- 🔴 Le verdict figé partait vers Postgres **en chaîne JSON** (colonne absente de `JSON_COLUMNS` du
  connecteur, comme `schedule` depuis LABO-01) : corrigé, testé, et les lignes déjà écrites réparées par
  la migration `20260930201419` (aucune ligne `lab_experiments` n'était touchée sur le cloud).
- La clôture automatique n'écrit qu'après la première synchro et le chargement complet (voir
  [LIENS-01 §8](liens01-registre-liens.md)) ; elle est désormais couverte par
  `cross-links-writes.test.tsx`, comme la lecture d'un verdict illisible (`lab-experiment-write.test.ts`).
