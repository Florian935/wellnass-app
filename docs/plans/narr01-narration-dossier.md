# Plan — NARR-01 · La narration du dossier d'enquête

Spec : [narr01-narration-dossier.md](../specs/functional/us/narr01-narration-dossier.md) ·
19/09/2026 · travail direct sur `dev` (décision Florian).

## Ordre de build

| # | Étape | Fichiers | Tests |
|---|---|---|---|
| 1 | **Le garde-fou**, pur : extraction des nombres d'un texte, valeurs autorisées, verdict | `packages/shared/src/ai-narration.ts` (+ `index.ts`) | `ai-narration.test.ts` (Vitest) |
| 2 | **L'invite** : dossier structuré → contexte + question, FR/EN | idem | idem |
| 3 | **Le chemin app** : appel `coach` + vérification + traduction en états d'UI | `apps/mobile/src/lib/ai/narrate.ts` | `narrate.test.ts` (Jest, `callAiAssist` bouchonné) |
| 4 | **L'écran** : bouton, chargement, résumé, refus | `components/lab/LabWhyPanel.tsx`, `app/(tabs)/lab.tsx` | test de composant |
| 5 | **i18n FR + EN**, RECETTES §, front-matter, CHANGELOG, roadmap, ETAT | — | parité i18n |

## Ce qui n'est PAS touché

- **Aucune migration**, aucune sync rule, aucun secret : le type `coach` de la fonction Edge existe
  et est déployé depuis IA-LAB-01. Recettable sur un APK construit depuis `dev`.
- **Aucun calcul nouveau** : `buildLabQuestions` reste l'unique source des suspects et de leurs
  chiffres.

## Étape 1 — le garde-fou

```ts
export function extractNumbers(text: string): number[];          // « −34 % » → 34 ; « 5:32 » → 5, 32
export function expandAllowedNumbers(values: readonly number[]): number[]; // arrondis, ×100, |v|
export function checkNarration(text: string, allowed: readonly number[]): NarrationVerdict;
```

Le point dur n'est pas l'extraction, c'est **le taux de faux refus** : un garde-fou qui rejette un
résumé juste est aussi inutile qu'un garde-fou absent. D'où `expandAllowedNumbers`, qui admet les
formes d'écriture d'une même valeur (0,34 ↔ 34 %, 82,47 ↔ 82,5), et une tolérance d'arrondi.

Le refus est **total** : un seul nombre inconnu jette tout le résumé. Un résumé à moitié fiable
demanderait au lecteur de deviner quelle moitié.

## Étape 3 — les états rendus à l'écran

| État | Origine |
|---|---|
| `ok` | réponse vérifiée |
| `rejected` | un nombre du texte n'est pas dans le dossier (R2) |
| `invalid` | réponse vide, tronquée ou trop longue |
| `offline` / `quota-exceeded` / `consent-required` / … | codes d'IA-LAB-01, traduits tels quels |

## Ce que le plan ne fait pas

Le dialogue, la mémoire (idée 10), le stockage du résumé, le résumé automatique, et le Conseil des
trois (CONS-01).
