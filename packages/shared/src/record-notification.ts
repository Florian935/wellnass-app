/**
 * Contenu du push « nouveau record » — US MUSC-F8 (roadmap 3.42, 2.7), décision D10.
 *
 * ── Un push, pas quinze ────────────────────────────────────────────────────────────────────────────
 * `computeWorkoutRecords` émet jusqu'à 3 candidats par exercice, et sur un exercice jamais travaillé
 * les 3 sont battus : une première séance de 5 exercices produit 15 lignes `personal_records` en un
 * seul appel. Une notification par ligne rendrait la fonctionnalité insupportable. Cette brique
 * agrège toutes les lignes battues par une séance en un contenu de notification **unique**.
 *
 * ── Deux dédoublonnages distincts, à ne pas fusionner ─────────────────────────────────────────────
 * - le **décompte** (`count`, et le choix `titleOne`/`titleMany`) dédoublonne sur `exerciseId` : 3
 *   types battus sur le même exercice comptent pour 1, sinon « 3 records battus ! » pour un seul
 *   mouvement travaillé serait perçu comme gonflé ;
 * - la **liste de noms** dédoublonne sur le libellé (`exerciseName`) : deux `exerciseId` différents
 *   peuvent porter le même nom (exercice custom dupliqué, ou archivé puis recréé). Sans ce second
 *   dédoublonnage, deux enregistrements du même mouvement afficheraient « Squat, Squat ».
 *
 * Le titre nomme explicitement l'unité comptée (« Records battus sur N exercices ! ») plutôt que de
 * dire juste « N records » : annoncer un nombre de *records* pour un décompte d'*exercices* serait
 * l'erreur symétrique — sous-vendre une séance où plusieurs exercices ont chacun battu 3 types.
 *
 * Aucune dépendance native, aucune traduction ici : la brique rend des clés i18n et des paramètres
 * (patron `intensityLabelKey`), l'appelant traduit.
 */

/** Un record battu, résumé pour la notification (valeur déjà formatée par l'appelant). */
export interface BeatenRecordSummary {
  exerciseId: string;
  /** Peut être `''` — exercice custom sans traduction ni repli `fr`. Voir `buildRecordPushContent`. */
  exerciseName: string;
  formattedValue: string;
}

/** Nombre maximal d'exercices nommés dans le corps de la notification. Au-delà, le système tronque. */
export const RECORD_PUSH_MAX_NAMED = 3;

export type RecordPushContent =
  | {
      titleKey: 'notifications.record.titleOne';
      titleParams: Record<string, never>;
      bodyKey: 'notifications.record.bodyOne';
      bodyParams: { exercise: string; value: string };
    }
  | {
      titleKey: 'notifications.record.titleMany';
      titleParams: { count: number };
      bodyKey: 'notifications.record.bodyMany';
      bodyParams: { names: string };
    }
  | {
      titleKey: 'notifications.record.titleMany';
      titleParams: { count: number };
      bodyKey: 'notifications.record.bodyManyOverflow';
      bodyParams: { names: string; rest: number };
    }
  | null;

/**
 * Construit le contenu du push à partir des records battus par une séance.
 *
 * `null` si `records` est vide — l'appelant n'envoie alors rien. Un `exerciseName` vide est exclu de
 * la liste de noms mais reste compté dans `count` : le record existe, il a juste perdu son libellé.
 */
export function buildRecordPushContent(records: BeatenRecordSummary[]): RecordPushContent {
  if (records.length === 0) return null;

  // Un exercice par entrée, dans l'ordre de première apparition — déterministe, testable.
  const byExercise = new Map<string, BeatenRecordSummary>();
  for (const r of records) {
    if (!byExercise.has(r.exerciseId)) byExercise.set(r.exerciseId, r);
  }
  const exercises = [...byExercise.values()];
  const count = exercises.length;

  if (count === 1) {
    const only = exercises[0]!;
    return {
      titleKey: 'notifications.record.titleOne',
      titleParams: {},
      bodyKey: 'notifications.record.bodyOne',
      bodyParams: { exercise: only.exerciseName, value: only.formattedValue },
    };
  }

  // Dédoublonnage par LIBELLÉ pour la liste — distinct du dédoublonnage par id ci-dessus.
  const names: string[] = [];
  const seenNames = new Set<string>();
  for (const ex of exercises) {
    if (ex.exerciseName === '') continue; // exclu de la liste, déjà compté dans `count`
    if (seenNames.has(ex.exerciseName)) continue;
    seenNames.add(ex.exerciseName);
    names.push(ex.exerciseName);
  }

  if (names.length <= RECORD_PUSH_MAX_NAMED) {
    return {
      titleKey: 'notifications.record.titleMany',
      titleParams: { count },
      bodyKey: 'notifications.record.bodyMany',
      bodyParams: { names: names.join(', ') },
    };
  }

  const named = names.slice(0, RECORD_PUSH_MAX_NAMED);
  const rest = names.length - RECORD_PUSH_MAX_NAMED;
  return {
    titleKey: 'notifications.record.titleMany',
    titleParams: { count },
    bodyKey: 'notifications.record.bodyManyOverflow',
    bodyParams: { names: named.join(', '), rest },
  };
}
