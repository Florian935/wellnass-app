---
id: ACCUEIL-02
titre: "En-tête utile & moment de la journée — et la fin du petit-déjeuner à 20 h"
roadmap: [7.24]
catalogue: []
etape: close
branche: feature/accueil-refonte
maj: 10/09/2026
---

# ACCUEIL-02 — En-tête utile & moment de la journée

> Deuxième des six US de la refonte de l'accueil (lot unique, `feature/accueil-refonte`).
> C'est la plus petite, et c'est elle qui corrige le défaut le plus concrètement gênant du lot.

## 1. Le défaut

L'en-tête livré portait, dans cet ordre : « Bonjour {prénom} 👋 », **le nom de l'application en
Bricolage 28 px extra-bold**, la pastille de synchronisation, un bouton « Personnaliser » et
l'avatar. Trois problèmes dans un seul bloc :

1. **le pixel le plus visible de l'écran le plus ouvert** affichait une information que
   l'utilisateur possède déjà — il sait dans quelle app il est ;
2. **aucune date** : un tableau de bord « du jour » qui ne disait jamais quel jour. La maquette
   validée, elle, affichait « Jeudi 4 juillet » depuis l'origine ;
3. le salut était **figé** dans le JSON i18n (`"Bonjour 👋"`), donc affiché tel quel à 22 h.

Et un quatrième, ailleurs mais de même nature — **le plus gênant au quotidien** : le widget
nutrition ouvrait `/food-picker` avec `meal: 'breakfast'` **en dur**
(`NutritionSummaryCard.tsx:71`). À 20 h comme à 7 h. Le geste le plus fréquent du pilier nutrition
était donc systématiquement à reprendre dans l'écran suivant.

## 2. Ce qui est livré

### 2.1 Deux fonctions pures (`packages/shared/src/day-moment.ts`)

- **`dayMoment(hour)`** → `morning` | `afternoon` | `evening`. Bascules à 12 h et 18 h, exportées
  en constantes pour que le test porte sur elles et non sur des littéraux recopiés.
  **Trois moments et non cinq** : chacun doit correspondre à une formulation distincte de
  l'accroche, et au-delà de trois on écrit des variantes que personne ne distingue.
- **`mealForHour(hour)`** → le repas à présélectionner. Fenêtres : petit-déjeuner 5-11, déjeuner
  11-15, **collation 15-18**, dîner 18-23. Hors fenêtre (23 h → 5 h) → `snack`, repli
  volontairement neutre : à 2 h du matin, proposer « dîner » serait un pari.

⚠️ Ces bornes **ne sont pas des rappels**. Le produit sait déjà *apprendre* l'heure de saisie
(`resolveReminderDeadline`, NUTR-F1) et c'est cette heure qui déclenche une notification. Ici il ne
s'agit que de **présélectionner** un repas, immédiatement corrigeable dans l'écran d'ajout — d'où
des bornes fixes et lisibles plutôt qu'un second mécanisme d'apprentissage.

**R1 · Aucune de ces fonctions ne lève**, quelle que soit l'entrée (`NaN`, `Infinity`, négatif,
fractionnaire). Elles alimentent l'en-tête de l'écran le plus ouvert : elles ne doivent pas pouvoir
le faire tomber.

### 2.2 L'en-tête (zone 0)

- Ligne 1 : **la date en clair** (`toLocaleDateString`, langue courante) + état de synchronisation
  + avatar vers les réglages.
- Ligne 2 : une **accroche contextuelle** (`headlineKey`), dérivée de **la même décision** que la
  carte « maintenant » — de sorte que l'en-tête et la carte ne puissent pas se contredire.
- **R2 · « Personnaliser » descend en zone 4.** C'est une action qu'on fait une fois : elle n'a pas
  à occuper le coin haut-droit en permanence.
- **R3 · L'accroche est le titre de l'écran** (`accessibilityRole="header"`), annoncée avec le
  salut du moment.

### 2.3 La correction du repas

`NutritionSummaryCard` et `QuickActions` ouvrent désormais `/food-picker` sur
`mealForHour(heure courante)`.

## 3. i18n

`home.greetingMoment.*`, `home.headline.*`, `home.quick.meal.*` — FR et EN. La date est formatée en
`fr-FR` ou `en-GB` selon la langue : formater en français pour un anglophone afficherait un ordre de
mots faux.

## 4. Offline

Aucune donnée réseau. L'heure vient de `useTodayDate()`, seule source réactive autorisée : un
`new Date().getHours()` dans un corps de composant serait figé au montage par React Compiler
(défaut documenté dans `useTodayKey`, invisible hors build release).

## 5. Cas limites

| Cas | Comportement |
|---|---|
| Prénom absent du profil | l'accroche fonctionne sans nom ; le salut aussi |
| 23 h → 5 h | repas = collation, moment = soir (23 h) ou matin (0-4 h) |
| Grande taille de police système | accroche sur 2 lignes max, `maxFontSizeMultiplier` borné |
| Langue EN | date en `en-GB`, heures d'échéance au format `20:00` |

## 6. Recette

- [ ] La date du jour s'affiche en clair, en haut, dans la bonne langue.
- [ ] Le nom de l'application **n'apparaît plus** en titre.
- [ ] L'accroche correspond à ce que dit la carte en dessous (pas de contradiction).
- [ ] À 7 h, « + Repas » ouvre le **petit-déjeuner** ; à 13 h le **déjeuner** ; à 20 h le **dîner**.
- [ ] Un appui sur la **carte nutrition** ouvre le même repas que la pastille (plus `breakfast`).
- [ ] Basculer l'app en anglais : date et accroche sont traduites, sans chaîne en dur.
