# Plan d'implémentation — LABO-04 « Apprendre, et le verdict figé »

Spec : [labo04-apprendre.md](../specs/functional/us/labo04-apprendre.md) · Branche :
**`feature/labo-carrefour`** · Roadmap 7.41. Une seule vague avec les quatre autres US du chantier :
l'ordre d'ensemble est dans le [plan de LIENS-01](liens01-registre-liens.md) §1.

## 1. Étapes

1. **Moteur** — `packages/shared/src/lab-experiments.ts` : `LabExperimentRecord.frozenVerdict`,
   `experimentVerdict` rend le verdict figé d'une expérience close, `shouldFreezeExperiment`.
2. **Schéma** — colonne `lab_experiments.verdict` (migration commune avec LIENS-01), schéma PowerSync.
3. **Repository** — `lab-experiment-repository.ts` : lecture défensive (`isFrozenVerdict`),
   `finishLabExperiment(id, verdict = null)` qui n'écrit qu'un verdict figeable.
4. **Clôture automatique** — `useCrossLinksWrites` (`cross-links-repository.tsx`) clôt, avec leur
   verdict du jour, les expériences dont la fenêtre est passée (garde `LAB_WRITE_READY`).
5. **Onglet** — `app/(tabs)/lab.tsx` : Apprendre = `LabWhyPanel` + `LabKnownPanel` sous une phrase de
   tête ; clôture **avec verdict** à la relance. `LabWhyPanel.tsx` : `onOpenLink` + `availableLinks`
   (un suspect n'ouvre sa fiche que si le lien existe).

## 2. Tests

- `lab-experiments.test.ts` (Vitest) : verdict figé, `shouldFreezeExperiment`.
- `lab-experiment-write.test.ts` : écriture du verdict figeable ; lecture d'un verdict valide, et
  d'un verdict illisible (ignoré).
- `lab-sql.test.tsx` : `useLabCore` rend le verdict figé.
- `lab-screen.test.tsx` : lancement le lundi suivant, pas de double lancement, clôture avec verdict,
  arrêt, suspect → fiche, pas de fiche pour un lien absent.

## 3. Vérification

Suites vertes ; **sur téléphone** (RECETTES §89) : suspect → fiche → retour « Apprendre », expérience
lancée, arrêtée ; la clôture automatique ne se voit qu'au bout de 28 jours (vérifiable avec le jeu de
données `supabase/scripts/labo-dataset.sql` en antidatant une expérience).
