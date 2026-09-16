---
id: DEPENSE-00
titre: "La cible calorique qui suit les dépenses réelles (fin du double comptage)"
roadmap: [4.43]
catalogue: [RN-02, RN-04, NUTR-23]
etape: recette
branche: dev
maj: 15/09/2026
---

# US DEPENSE-00 — Le socle hors sport

> ⚠️ **Spec écrite avec le code** (lot en une passe du 15/09/2026). Cadrage et chiffres :
> [analyse-depense-activites-2026-09.md](../../../product/analyse-depense-activites-2026-09.md) §3 et §5.

## 0. Le défaut réparé, chiffré

La cible part de `tdee()` = métabolisme de base × **facteur d'activité**, et les paliers de ce
facteur sont définis par la **fréquence d'entraînement** (RN-03 : « modéré » dès 3 séances/semaine).
Le sport est donc déjà dans la cible — et le mode `auto` (RN-02) le rajoute par-dessus.

Profil A (80 kg, 180 cm, 30 ans), quatre fois 10 km par semaine, déclaré « modérément actif » :

| | kcal/j (moyenne semaine) |
|---|---|
| Sédentaire | 2 136 |
| **Modérément actif** | **2 759** — dont 623 kcal/j qui *sont* son entraînement |
| + bonus Auto (4 × 823 kcal étalés) | **3 229** |
| **Proposé** — socle hors sport (×1,375) + courses au bas de fourchette | **2 848** |

**381 kcal/j d'écart, soit 2 667 kcal/semaine — 95 % du déficit d'une sèche (−2 800).** En mode Auto,
ce coureur croit être en sèche ; sur la semaine, il est presque au maintien.

## 1. Le troisième mode

| Mode | Cible |
|---|---|
| `fixed` (défaut, **inchangé**) | la même chaque jour ; le niveau d'activité compte déjà le sport |
| `auto` (RN-02, **inchangé**) | + dépense des courses les jours de sortie, repli forfait |
| **`activities`** (neuf) | **socle hors sport** + toutes les dépenses réelles du jour, au bas de leur fourchette |

- **R1 — Le mode `activities` change AUSSI le socle**, il n'ajoute pas qu'un bonus : `sportFreeTdee`
  remplace `tdee` (facteur `seated` 1,2 / `standing` 1,375 / `physical` 1,55). Sans ça, on aggraverait
  le double comptage au lieu de le corriger.
- **R2 — Aucun repli en mode `activities`** : un jour sans rien de saisi vaut 0 de bonus, et c'est
  exact — pas un défaut à compenser par un forfait.
- **R3 — `sportFreeLevel` à `null` = la question n'a jamais été posée** (leçon d'`activity_level`,
  dont le repli silencieux ×1,55 valait ~614 kcal/j de trop à un sédentaire). L'écran la pose, et
  affiche le repli **comme un repli**.
- **R4 — Personne ne bascule tout seul.** Aucune migration de données : un compte en `auto` reste en
  `auto`. Changer une cible calorique en silence serait exactement le défaut qu'on répare.
- **R5 — L'avertissement de double comptage** ne s'affiche qu'en mode `auto` **et** à partir du
  palier « modérément actif » : la combinaison exacte qui compte deux fois.
- **R6 — La même règle vaut pour le rétroactif** : l'adhérence (NUTR-10) et le bilan (NUTR-18)
  passent par le même socle et les mêmes dépenses par jour, sinon l'app comparerait les apports
  passés à une cible que plus aucun écran ne sait justifier.

## 2. La journée en énergie (DEPENSE-03)

Carte du journal nutrition : chaque dépense de la journée (séance, course, activité), puis le calcul
— **socle + objectif → + dépenses → cible → mangé → reste**.

⚠️ **Deux chiffres par ligne, volontairement** : l'estimation centrale (« ≈ 370 ») est ce que
l'activité a coûté ; le « +260 » est ce que la cible autorise en plus. Les confondre reviendrait soit
à mentir sur la dépense, soit à rendre 40 % de calories peut-être jamais brûlées.

Quand la cible ne suit pas encore les dépenses, la carte le dit et propose le réglage — c'est le
chemin de découverte du mode.

## 3. Le réglage d'affichage (DEPENSE-02)

`user_settings.show_energy_estimates`, défaut **vrai**. 🔴 **Masquer n'éteint pas le calcul** : la
cible continue de suivre les dépenses. On retire l'affichage, pas le moteur — sinon un réglage
d'affichage changerait en silence ce qu'on peut manger. Motif : pour qui a un rapport compliqué à la
nourriture, « tu as brûlé 780 kcal » nourrit la logique de compensation.

## 4. Fichiers

`nutrition.ts` (`SPORT_FREE_LEVELS`, `sportFreeTdee`, `dayCalorieBonus` mode `activities`) ·
`dashboard-repository.ts` (`useDayCalorieTarget`, `useDailyCalorieTargets`) ·
`DayEnergyCard.tsx` · `nutrition-profile.tsx` · `settings.tsx` ·
migration `20260915165806_depense00_energy_targets.sql`.

## 5. Tests

`nutrition.test.ts` : mode `activities` (somme, pas de repli, arrondi, non-négatif), **non-régression
`fixed`/`auto`** (les deux ignorent totalement les dépenses), socle hors sport sur le profil A
(2 136 / 2 448 / 2 759 vs `tdee` « modéré » = 2 759 — le double comptage rendu visible par un test).

## 6. Ce qui n'est pas fait

- **Les paliers hors sport reprennent provisoirement les multiplicateurs existants** (1,2 / 1,375 /
  1,55), réinterprétés comme un quotidien **hors entraînement**. À sourcer proprement.
- **Aucun aperçu avant/après chiffré** au moment du basculement (la maquette en montrait un) : le
  réglage affiche les libellés et l'avertissement, pas la simulation des trois cas.
- **Aucune calibration du socle par le poids** (l'horizon 2 de l'analyse : « l'app apprend ton vrai
  socle »).
- **Pas d'anticipation** : une séance planifiée ne relève pas la cible du matin en mode `activities`
  (seul le réalisé compte). Les modes `fixed`/`auto` gardent leur anticipation (4.7b).
- ⚠️ **Surveillances PowerSync redondantes** : `DayEnergyCard` appelle `useDayEnergy` **et**
  `useDayCalorieTarget`, qui appelle lui-même `useDayEnergy` — les mêmes requêtes sont donc
  surveillées deux fois sur cet écran. Sans effet fonctionnel, mais c'est exactement le défaut que
  le bilan de séance avait corrigé (« une seule lecture pour tout l'écran », MUSCU-UX02 R11). À
  reprendre si la recette montre une latence sur le journal.
