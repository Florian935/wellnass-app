# Plan — LETTRE-01 · Lettre à ton futur toi

Spec : [lettre01-lettre-futur-moi.md](../specs/functional/us/lettre01-lettre-futur-moi.md) ·
18/09/2026 · travail direct sur `dev` (décision Florian).

## Ordre de build

| # | Étape | Fichiers | Tests |
|---|---|---|---|
| 1 | **Règles pures** : longueur, texte vide, ancienneté | `packages/shared/src/goal-letter.ts` (+ `index.ts`) | `goal-letter.test.ts` (Vitest) |
| 2 | **Migration** : 3 colonnes sur `personal_goals` **+ schéma PowerSync** | migration, `MIGRATIONS.md`, `powersync/schema.ts`, `database.types.ts` | `sql-prepare-sweep` |
| 3 | **Données** : lecture et écriture de la lettre | `goal-repository.ts` | tests d'écran existants |
| 4 | **Écrans** : champ replié, enveloppe, feuille de lecture, déclencheurs | `GoalFormSheet.tsx`, `GoalCard.tsx`, `GoalLetterSheet.tsx`, écran objectifs | test de composant |
| 5 | **i18n FR + EN**, RECETTES §, front-matter, CHANGELOG, roadmap, ETAT | — | parité i18n |

🔴 **Le piège de l'étape 2, déjà payé deux fois** (CYCLE-01, puis FANT-01 ce matin) : une colonne
ajoutée en base mais **absente de `powersync/schema.ts`** existe côté serveur et reste invisible côté
client — l'écriture part dans le vide, sans la moindre erreur. `sql-prepare-sweep` l'attrape, à
condition que la colonne soit citée dans une requête du repository.

## Étape 1 — les règles pures

```ts
export const LETTER_MAX_LENGTH = 1000;      // D6
export const LETTER_COUNTER_FROM = 800;     // D6 — le compteur n'apparaît qu'ensuite
export function normaliseLetter(text: string): string | null;  // vide/blanc → null (cas limite)
export function letterAgeDays(writtenAt: string, now: Date): number;
export function shouldShowCounter(length: number): boolean;
```

## Étape 2 — migration

```sql
alter table public.personal_goals
  add column if not exists letter_text text,
  add column if not exists letter_written_at timestamptz,
  add column if not exists letter_opened_at timestamptz;
alter table public.personal_goals
  add constraint personal_goals_letter_text_len check (letter_text is null or length(letter_text) <= 1000) not valid;
```

Additive, nullable, `not valid` sur la contrainte (aucune ligne existante à revalider — elles sont
toutes `null`). `personal_goals` est **déjà** publiée : aucune sync rule à redéployer.

## Étape 4 — les trois déclencheurs (R3)

| Déclencheur | Où | Comportement |
|---|---|---|
| Échéance passée | carte d'objectif, section « Terminés » | la carte propose « Relire ton mot » |
| Objectif atteint | carte d'objectif à 100 % | même proposition |
| Suppression | confirmation de suppression | « Relire ton mot avant de supprimer ? » |

`letter_opened_at` n'est posé que par **ces trois chemins** — une relecture volontaire depuis la
carte ne l'écrase pas (R3).

> 🔴 **Corrigé le 18/09 pendant l'implémentation** : le déclencheur « échéance » était censé
> s'appuyer sur une notification d'OBJ-01. Elle **n'existe pas** — OBJ-01 l'a écartée (D4). Le
> déclencheur devient in-app, porté par la carte de l'objectif terminé ; aucune notification n'est
> ajoutée. Spec mise à jour en conséquence.

## Ce que le plan ne fait pas

La voix (permission micro, déclaration Play — D1), la lettre hors objectif, le partage, et toute
notification nouvelle.
