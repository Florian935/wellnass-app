---
id: DEPENSE-01
titre: "Le moteur de dépense énergétique (muscu, course, activité)"
roadmap: [4.41]
catalogue: [RN-01, TRI-06]
etape: recette
branche: dev
maj: 15/09/2026
---

# US DEPENSE-01 — Le moteur de dépense

> ⚠️ **Spec écrite avec le code**, pas avant (lot en une passe demandé par Florian le 15/09/2026, cf.
> [[florian-lot-oneshot-retours-recette]]). Le raccourci est assumé et tracé ici : le cadrage vient de
> l'analyse [analyse-depense-activites-2026-09.md](../../../product/analyse-depense-activites-2026-09.md)
> (§4), validée en séance le même jour.

## 0. Pourquoi

L'app savait estimer la dépense d'**une course** (RN-01) et rien d'autre. La musculation n'avait
qu'un forfait fixe, identique pour 20 minutes de gainage et 1 h 30 de jambes ; les autres activités
n'existaient pas. Cette US pose **une seule formule** pour les trois sources, pure et testée.

## 1. La formule

> **dépense nette = (MET − 1) × métabolisme de repos par heure × heures actives**

- **MET** : intensité de l'effort, 1 = repos (Compendium of Physical Activities).
- **« − 1 »** : on retire le repos, déjà compté dans la cible calorique — convention *nette* déjà
  retenue par RN-01, appliquée partout pour ne pas avoir deux définitions de « dépense ».
- **repos/h** : métabolisme de base Mifflin-St Jeor ÷ 24. **C'est là, et seulement là, qu'entrent
  l'âge, la taille, le poids et le sexe.**

| La même heure de muscu à 6 MET | repos/h | dépense nette |
|---|---|---|
| MET standard (1 kcal/kg/h), 80 kg | 80 | 400 kcal |
| Profil A — H, 30 ans, 180 cm, 80 kg | 74,2 | **370 kcal** |
| Profil B — F, 45 ans, 165 cm, 60 kg | 51,9 | **260 kcal** |

## 2. Règles

- **R1 — Le niveau d'entraînement n'entre pas dans le calcul.** Un confirmé ne dépense pas plus
  *parce qu'il est* confirmé : il soulève plus lourd, enchaîne plus vite, court plus vite — déjà
  mesuré par les entrées. Un facteur de niveau compterait deux fois la même chose. **Figé par un
  test**, parce que la tentation reviendra à chaque relecture.
- **R2 — Sans poids, aucune estimation.** `null`, et l'écran affiche le remède. Il n'existe aucune
  valeur neutre (70 kg par défaut produirait un chiffre faux et crédible — règle de MN-10).
- **R3 — Sans âge ni taille, on n'échoue pas** : repli sur le MET standard (1 kcal/kg/h),
  `personalised: false`, confiance **basse** — et l'écran le dit.
- **R4 — Tout sort en fourchette** `{kcal, low, high, confidence}`, arrondi à 10 kcal. Largeurs :
  course avec GPS ±15 %, sans GPS ±25 %, activité ±25 %, **musculation ±30 %** (la plus incertaine
  sans fréquence cardiaque).
- **R5 — La cible calorique ne retient que `low`** (décision D2 de l'analyse) : les MET surestiment
  plus souvent qu'ils ne sous-estiment, et une surestimation efface un déficit sans bruit.
- **R6 — La confiance ne dépasse jamais `low` quand le profil est incomplet.**

### Musculation

| Signal | MET |
|---|---|
| ressenti ≤ 5 | 3,5 |
| ressenti 6-7 · **ou ressenti absent** | 5,0 |
| ressenti ≥ 8 | 6,0 |
| repos moyen < 60 s | +1,5 (plafond 8,0) |
| repos moyen 60-120 s | +0,5 |

- **Temps actif plafonné à 4 min par série.** Une séance oubliée ouverte se clôt à 3 h
  (`WORKOUT_AUTO_CLOSE_SECONDS`) : sans ce plafond, elle ajouterait > 1 000 kcal à la cible du jour
  pour 20 minutes de travail réel.
- Le nombre de séries compte **les échauffements** (ils coûtent du temps et de l'énergie) mais
  **seulement les séries validées** (`done = 1`) : une séance interrompue garde ses séries prévues.

### Course

- **Dénivelé** : 100 m de D+ = 1 km d'effort (« kilomètre-effort », usuel en trail). La descente est
  ignorée. 🔴 L'allure se calcule sur la **distance réelle**, jamais sur la distance-effort — sinon le
  dénivelé est payé deux fois.
- **Sans distance** (tapis, mode sans GPS — roadmap 5.21) : MET de course selon le ressenti
  (7,0 / 8,3 / 9,8 / 11,0) × durée, au lieu de rendre `0`.
- **Non-régression RN-01** : sans dénivelé, le résultat est celui d'`estimateRunCalories` à l'arrondi
  près. Test de garde sur trois distances.

### Activité libre

- MET du catalogue × intensité déclarée (test de la parole), **affiné par la vitesse** quand la
  distance est saisie (vélo, marche).
- **`deviceKcal` court-circuite tout** : un chiffre lu sur une montre est une mesure, pas une
  estimation — `low = kcal = high`, confiance haute, `source: 'device'`.

## 3. Explication (« D'où vient ce chiffre »)

`explainEnergy` alimente la feuille existante de DASH-01 : repos → intensité → temps actif →
résultat, puis **deux phrases qui désamorcent les malentendus garantis** — la montre (elle compte le
repos, déjà dans la cible) et le niveau (il n'entre pas). La confiance **vient de l'estimation** :
l'explication ne peut pas être plus sûre que le chiffre qu'elle explique.

## 4. Fichiers

| Fichier | Rôle |
|---|---|
| [packages/shared/src/energy.ts](../../../../packages/shared/src/energy.ts) | le moteur (pur) |
| [packages/shared/src/activity.ts](../../../../packages/shared/src/activity.ts) | catalogue + ligne de données |
| [packages/shared/src/bodyweight.ts](../../../../packages/shared/src/bodyweight.ts) | `weightAtDate` (constat C6) |
| [packages/shared/src/explain.ts](../../../../packages/shared/src/explain.ts) | `explainEnergy` |
| [apps/mobile/src/data/repositories/energy-repository.ts](../../../../apps/mobile/src/data/repositories/energy-repository.ts) | assemblage (jour, poids à la date) |

## 5. Tests

`energy.test.ts` (38 cas) + `activity.test.ts` (18) + `explainEnergy` (4) + `weightAtDate` (4).
**100 % lignes / branches / fonctions** sur les deux fichiers neufs. Valeurs dorées : profils A et B
de l'analyse, non-régression RN-01, plafond de la séance oubliée, tapis sans GPS.

## 6. Ce qui n'est pas fait

- **Les MET ne sont pas revérifiés dans la table Herrmann 2024** : valeurs de l'édition 2011.
- **Aucune calibration** contre une mesure réelle : les largeurs de fourchette sont des ordres de
  grandeur, à confirmer en recette contre une montre cardio.
- **Densité et plafond par série sont des heuristiques**, nommées et exportées pour être recalibrées
  d'un seul endroit.
- Pas d'estimation par **fréquence cardiaque** (horizon 2, demanderait une permission Health Connect
  de plus).
