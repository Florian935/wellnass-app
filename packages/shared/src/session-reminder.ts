/**
 * US HORAIRE-01 — instant de convocation d'une séance planifiée (roadmap 2.4).
 *
 * ── Convocation ≠ échéance ──────────────────────────────────────────────────────────────────────
 * Le rappel de séance existant (MUSC-F8) est une **échéance** : « la journée avance, ta séance n'est
 * pas faite », posée à l'heure apprise sur les fins de séance passées. La roadmap 2.4 demande autre
 * chose — une **convocation** : « ça commence dans 30 minutes ». Les deux répondent à des questions
 * différentes, et la seconde n'a de sens que si l'heure de début est connue.
 *
 * Cette fonction ne calcule **que** la convocation. Le repli sur l'échéance apprise est une décision
 * d'orchestration (règle R5), pas d'arithmétique : on renvoie `null` et l'appelant sait quoi faire.
 */

/**
 * Minutes d'avance de la convocation (décision D4).
 *
 * **Constante, pas réglage** : la roadmap dit 30, et un réglage de plus serait à traduire, tester et
 * recetter pour un gain non démontré. Nommer la valeur ici rend le passage à un réglage trivial le
 * jour où il se justifie.
 */
export const SESSION_LEAD_MINUTES = 30;

/** `HH:MM` ou `HH:MM:SS` — un `time` Postgres se lit dans les deux formes selon le pilote. */
const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** `AAAA-MM-JJ`, la même convention que `scheduled_date`. */
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Instant auquel la notification de convocation doit partir, ou `null` s'il n'y a **rien à
 * programmer**.
 *
 * `null` couvre quatre situations, et c'est volontaire — l'appelant n'a pas à les distinguer :
 *  - aucune heure sur la séance (le cas le plus courant aujourd'hui) ;
 *  - heure ou date **malformée** (la valeur vient de la base, donc d'un autre appareil ou d'une
 *    version antérieure : on ne lève pas, sinon le calcul des autres rappels tombe avec) ;
 *  - convocation **déjà passée** — 🔴 c'est la règle R3, et le vrai piège : renvoyer un instant
 *    passé ferait déclencher la notification **immédiatement**, annonçant « ça commence dans
 *    30 min » alors que la séance a commencé ;
 *  - convocation **pile maintenant**, qui n'a plus d'avance à donner.
 *
 * ⚠️ **L'heure est locale** (décision D8) : `new Date(y, m, d, h, min)` construit dans le fuseau de
 * l'appareil, comme il faut — une séance à 18 h reste à 18 h où qu'on soit. Passer par `Date.parse`
 * d'une chaîne ISO la décalerait.
 *
 * Le calcul **traverse minuit** naturellement : `setMinutes(-30)` d'un 00 h 15 rend 23 h 45 la
 * veille, sans arithmétique de calendrier à écrire.
 *
 * Pure — `now` est un paramètre, jamais une lecture d'horloge (règle `no-frozen-clock` du dépôt).
 */
export function computeSessionCallTime(params: {
  /** Jour planifié, `AAAA-MM-JJ`. */
  scheduledDate: string;
  /** Heure locale de début, `HH:MM` ou `HH:MM:SS`. `null` = pas d'heure définie. */
  scheduledTime: string | null;
  now: Date;
}): Date | null {
  const { scheduledDate, scheduledTime, now } = params;
  if (scheduledTime === null) return null;

  const date = DATE_PATTERN.exec(scheduledDate);
  const time = TIME_PATTERN.exec(scheduledTime.trim());
  if (date === null || time === null) return null;

  const hours = Number(time[1]);
  const minutes = Number(time[2]);
  if (hours > 23 || minutes > 59) return null;

  const start = new Date(
    Number(date[1]),
    Number(date[2]) - 1,
    Number(date[3]),
    hours,
    minutes,
    0,
    0,
  );
  // Une date invalide (31/02) survit à la regex mais pas à `Date` : elle glisse au mois suivant.
  // On préfère ne rien programmer plutôt que de convoquer un jour que personne n'a choisi.
  if (Number.isNaN(start.getTime())) return null;

  const call = new Date(start.getTime() - SESSION_LEAD_MINUTES * 60_000);

  // R3 — strictement dans le futur. `<=` et non `<` : à l'instant exact, la convocation n'a plus
  // d'avance à donner, et l'envoyer reviendrait à annoncer un début imminent déjà atteint.
  if (call.getTime() <= now.getTime()) return null;

  return call;
}
