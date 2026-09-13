/**
 * US DASH-01 — le brief du matin **sans IA** (spec §6.2).
 *
 * Trois phrases au plus, lues à voix haute. Elles sont construites à partir de **faits déjà calculés**
 * (score de forme, séance du jour, record à portée, écart de protéines, série) et de clés i18n : pas
 * de réseau, pas de consentement, et une traduction anglaise exacte (décision G).
 *
 * ── Ordre ─────────────────────────────────────────────────────────────────────────────────────────
 *  1. Comment tu vas (verdict TRI-03) — ou une phrase douce pendant une période « vie réelle ».
 *  2. Ce qui t'attend (séance du jour).
 *  3. Ce qui est à portée (record) — sinon ce qui manque dans l'assiette.
 *  Si le brief tient en moins de deux phrases, la série vient le compléter.
 */

export type BriefFacts = {
  verdict: 'rest' | 'ok' | 'push' | null;
  todaySession: { title: string; time: string | null } | null;
  nearRecord: { exerciseName: string; gapKind: 'kg' | 'reps'; gap: number } | null;
  proteinGapG: number | null;
  streak: number;
  realLifeActive: boolean;
};

export type BriefSentence = { key: string; params: Record<string, string | number> };

export const BRIEF_MAX_SENTENCES = 3;
/** Un écart de protéines sous 20 g ne mérite pas une phrase lue à voix haute. */
const PROTEIN_GAP_MIN_G = 20;

export function buildMorningBrief(facts: BriefFacts): BriefSentence[] {
  const sentences: BriefSentence[] = [];

  if (facts.realLifeActive) sentences.push({ key: 'brief.gentle', params: {} });
  else if (facts.verdict !== null) sentences.push({ key: `brief.verdict.${facts.verdict}`, params: {} });

  if (facts.todaySession) {
    sentences.push(
      facts.todaySession.time
        ? { key: 'brief.sessionAt', params: { title: facts.todaySession.title, time: facts.todaySession.time } }
        : { key: 'brief.session', params: { title: facts.todaySession.title } },
    );
  }

  if (facts.nearRecord) {
    sentences.push({
      key: facts.nearRecord.gapKind === 'kg' ? 'brief.nearRecordKg' : 'brief.nearRecordReps',
      params: { exercise: facts.nearRecord.exerciseName, gap: facts.nearRecord.gap },
    });
  } else if (facts.proteinGapG !== null && facts.proteinGapG >= PROTEIN_GAP_MIN_G) {
    sentences.push({ key: 'brief.protein', params: { grams: Math.round(facts.proteinGapG / 5) * 5 } });
  }

  if (sentences.length < 2 && facts.streak >= 2) {
    sentences.push({ key: 'brief.streak', params: { days: facts.streak } });
  }

  return sentences.slice(0, BRIEF_MAX_SENTENCES);
}
