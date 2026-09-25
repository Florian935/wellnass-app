/**
 * « La dernière fois » en une ligne — US MUSCU-UX07, règle R3.
 *
 * Le hub muscu montre, avant même de démarrer, ce qu'on a soulevé la dernière fois sur chaque
 * exercice de la séance du jour : c'est la question qu'on se pose devant la barre. La ligne doit
 * tenir sur un téléphone et se lire d'un coup d'œil, d'où une règle de regroupement :
 *
 *  - une seule charge sur toutes les séries → la charge une fois : « 80 kg × 8 · 8 · 7 · 6 » ;
 *  - des charges différentes → chaque série, l'unité une fois en fin : « 80 × 8 · 77,5 × 8 kg » ;
 *  - poids du corps : « PdC × 12 · 10 » ; lesté : « +10 kg × 10 · 9 » ; assisté : « −20 kg × 8 » ;
 *  - durée, en m:ss comme la séance : « 0:45 · 0:40 », lestée : « +10 kg · 0:45 · 0:40 » ;
 *  - types mêlés → chaque série en entier ;
 *  - au-delà de `maxSets` séries (5) → les premières, puis « +N ».
 *
 * La brique ne connaît ni la langue ni les unités : l'appelant lui passe de quoi écrire une charge
 * (convertie, sans zéro inutile), l'unité, le libellé du poids du corps et une durée.
 */

/** Une série telle que `useLastPerformance` la rend. */
export type LastPerfSet = {
  setType: string;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
};

export type LastPerfFormat = {
  /** Une charge en kg → nombre affiché dans l'unité de l'utilisateur, sans unité (« 80 », « 77,5 »). */
  load: (kg: number) => string;
  /** Symbole de l'unité de charge (« kg », « lb »). */
  unit: string;
  /** Libellé du poids du corps (« PdC », « BW »). */
  bodyweight: string;
  /** Une durée en secondes → « m:ss ». */
  duration: (seconds: number) => string;
  /** Nombre de séries écrites avant « +N ». Défaut : 5. */
  maxSets?: number;
};

const SEP = ' · ';
/** Signe moins typographique (U+2212) : le tiret « - » se lit mal devant un chiffre. */
const MINUS = '−';

type Kind = 'load' | 'bodyweight' | 'duration';

function kindOf(set: LastPerfSet): Kind {
  if (set.setType === 'duration') return 'duration';
  if (set.setType === 'bodyweight') return 'bodyweight';
  return 'load';
}

/** Un lest ou une assistance, signé, avec son unité : « +10 kg », « −20 kg ». */
function signed(kg: number, f: LastPerfFormat): string {
  return `${kg < 0 ? MINUS : '+'}${f.load(Math.abs(kg))} ${f.unit}`;
}

/** Ce qui s'ajoute au poids du corps : le libellé nu sans lest, le lest signé sinon. */
function bodyweightPrefix(kg: number | null, f: LastPerfFormat): string {
  return kg === null || kg === 0 ? f.bodyweight : signed(kg, f);
}

/** Tous les éléments égaux (`null` compris) ? */
function allEqual<T>(values: readonly T[]): boolean {
  return values.every((v) => v === values[0]);
}

/** Une série « charge × répétitions » sans unité, pour la forme listée. */
function loadItem(set: LastPerfSet, f: LastPerfFormat): string {
  if (set.weightKg === null) return set.reps === null ? '—' : `× ${set.reps}`;
  if (set.reps === null) return f.load(set.weightKg);
  return `${f.load(set.weightKg)} × ${set.reps}`;
}

/** Une série écrite en entier, unité comprise : la forme des types mêlés. */
function fullItem(set: LastPerfSet, f: LastPerfFormat): string {
  switch (kindOf(set)) {
    case 'duration': {
      const time = set.durationSeconds === null ? '—' : f.duration(set.durationSeconds);
      return set.weightKg === null || set.weightKg === 0 ? time : `${time} (${signed(set.weightKg, f)})`;
    }
    case 'bodyweight':
      return `${bodyweightPrefix(set.weightKg, f)} × ${set.reps ?? '—'}`;
    default:
      return set.weightKg === null ? loadItem(set, f) : `${loadItem(set, f)} ${f.unit}`;
  }
}

/**
 * La dernière fois d'un exercice, en une ligne. `null` quand il n'y a aucune série de travail : à
 * l'appelant d'écrire « Première fois ».
 */
export function formatLastPerformance(
  sets: readonly LastPerfSet[],
  f: LastPerfFormat,
): string | null {
  const working = sets.filter((s) => s.setType !== 'warmup');
  if (working.length === 0) return null;

  const max = f.maxSets ?? 5;
  const shown = working.slice(0, max);
  const rest = working.length - shown.length;
  const tail = rest > 0 ? `${SEP}+${rest}` : '';

  const kinds = shown.map(kindOf);
  if (!allEqual(kinds)) return shown.map((s) => fullItem(s, f)).join(SEP) + tail;

  const weights = shown.map((s) => s.weightKg);
  const sameWeight = allEqual(weights);

  switch (kinds[0]) {
    case 'duration': {
      if (!sameWeight) return shown.map((s) => fullItem(s, f)).join(SEP) + tail;
      const times = shown.map((s) => (s.durationSeconds === null ? '—' : f.duration(s.durationSeconds)));
      const lest = weights[0];
      const head = lest === null || lest === 0 || lest === undefined ? '' : `${signed(lest, f)}${SEP}`;
      return head + times.join(SEP) + tail;
    }
    case 'bodyweight': {
      const reps = shown.map((s) => s.reps);
      if (!sameWeight || reps.some((r) => r === null)) {
        return shown.map((s) => fullItem(s, f)).join(SEP) + tail;
      }
      return `${bodyweightPrefix(weights[0] ?? null, f)} × ${reps.join(SEP)}` + tail;
    }
    default: {
      const reps = shown.map((s) => s.reps);
      const groupable = sameWeight && reps.every((r) => r !== null);
      if (groupable) {
        const weight = weights[0] ?? null;
        return weight === null
          ? `× ${reps.join(SEP)}${tail}`
          : `${f.load(weight)} ${f.unit} × ${reps.join(SEP)}${tail}`;
      }
      const items = shown.map((s) => loadItem(s, f)).join(SEP);
      const hasLoad = weights.some((w) => w !== null);
      return (hasLoad ? `${items} ${f.unit}` : items) + tail;
    }
  }
}

/**
 * La date commune à plusieurs « dernière fois » — l'en-tête « LA DERNIÈRE FOIS · JEU. 17/09 ».
 * Les exercices jamais faits (`null`) sont ignorés ; des dates différentes → `null`, et chaque
 * ligne porte alors la sienne.
 */
export function commonDayKey(dayKeys: readonly (string | null)[]): string | null {
  const known = dayKeys.filter((k): k is string => k !== null);
  if (known.length === 0) return null;
  return allEqual(known) ? known[0]! : null;
}
