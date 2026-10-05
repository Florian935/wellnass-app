import { describe, expect, it } from 'vitest';
import {
  AI_DAILY_QUOTA,
  AI_LOW_CONFIDENCE,
  MEAL_ITEMS_MAX,
  MEAL_TEXT_MAX_CHARS,
  matchPhotoItems,
  needsPrismeConsent,
  parseAiJson,
  parseMealTextResult,
  photoMealTotals,
  prismeStatusSchema,
  stepPortion,
  mealPhotoResultSchema,
  type CatalogCandidate,
  type PrismeStatus,
} from './ai-assist';

const salmon: CatalogCandidate = { id: 'f-salmon', name: 'Saumon cuit', kcal100: 206, protein100: 22, carbs100: 0, fat100: 13 };
const rice: CatalogCandidate = { id: 'f-rice', name: 'Riz basmati cuit', kcal100: 131, protein100: 2.7, carbs100: 28, fat100: 0.3 };

describe('parseAiJson (US DASH-01, §7 — la sortie du modèle est une donnée non fiable)', () => {
  it('extrait le premier objet JSON, même entouré de texte', () => {
    const raw = 'Voici : {"items":[{"name":"Saumon","grams":140,"confidence":0.91}]} fin';
    expect(parseAiJson(mealPhotoResultSchema, raw)).toEqual({
      items: [{ name: 'Saumon', grams: 140, confidence: 0.91 }],
    });
  });

  it('JSON invalide → null', () => {
    expect(parseAiJson(mealPhotoResultSchema, '{"items": [')).toBeNull();
    // Entre accolades mais illisible : c'est `JSON.parse` qui échoue, pas la recherche d'accolades.
    expect(parseAiJson(mealPhotoResultSchema, '{"items": [}')).toBeNull();
  });

  it('forme non conforme (grammes négatifs, confiance > 1) → null', () => {
    expect(parseAiJson(mealPhotoResultSchema, '{"items":[{"name":"x","grams":-5,"confidence":0.5}]}')).toBeNull();
    expect(parseAiJson(mealPhotoResultSchema, '{"items":[{"name":"x","grams":50,"confidence":3}]}')).toBeNull();
  });

  it('pas d’objet du tout → null', () => {
    expect(parseAiJson(mealPhotoResultSchema, 'désolé')).toBeNull();
  });
});

describe('matchPhotoItems — les calories viennent du catalogue, jamais du modèle (R5)', () => {
  const lookup = (name: string) => (name.toLowerCase().includes('saumon') ? [salmon] : name.toLowerCase().includes('riz') ? [rice] : []);

  it('rapproche chaque aliment et calcule ses calories à partir des grammes', () => {
    const matched = matchPhotoItems(
      [
        { name: 'Saumon', grams: 140, confidence: 0.91 },
        { name: 'Riz basmati', grams: 160, confidence: 0.72 },
      ],
      lookup,
    );
    expect(matched[0]).toEqual({
      name: 'Saumon',
      food: salmon,
      grams: 140,
      kcal: 288,
      lowConfidence: false,
    });
    expect(matched[1]!.kcal).toBe(210);
    expect(matched[1]!.lowConfidence).toBe(true);
  });

  it(`sous ${AI_LOW_CONFIDENCE} de confiance, l’aliment est signalé`, () => {
    expect(matchPhotoItems([{ name: 'Saumon', grams: 100, confidence: AI_LOW_CONFIDENCE - 0.01 }], lookup)[0]!.lowConfidence).toBe(true);
  });

  it('aucun aliment du catalogue → food null, calories null (rien d’inventé)', () => {
    expect(matchPhotoItems([{ name: 'Chose étrange', grams: 80, confidence: 0.9 }], lookup)[0]).toMatchObject({
      food: null,
      kcal: null,
    });
  });
});

describe('photoMealTotals', () => {
  it('additionne ce qui est rapproché et compte ce qui ne l’est pas', () => {
    expect(
      photoMealTotals([
        { name: 'Saumon', food: salmon, grams: 140, kcal: 288, lowConfidence: false },
        { name: 'Riz', food: rice, grams: 200, kcal: 262, lowConfidence: true },
        { name: '?', food: null, grams: 50, kcal: null, lowConfidence: false },
      ]),
    ).toEqual({ kcal: 550, proteinG: 36, carbsG: 56, fatG: 19, unmatched: 1 });
  });
});

describe('stepPortion', () => {
  it('pas de 20 g, borné entre 10 et 1500 g', () => {
    expect(stepPortion(160, 1)).toBe(180);
    expect(stepPortion(160, -1)).toBe(140);
    expect(stepPortion(10, -1)).toBe(10);
    expect(stepPortion(1490, 1)).toBe(1500);
  });

  it('pas de 10 g pour les petites portions (< 60 g)', () => {
    expect(stepPortion(40, 1)).toBe(50);
    expect(stepPortion(50, -1)).toBe(40);
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// US PRISME-01 — quotas, statut du serveur, accord, repas décrit
// ───────────────────────────────────────────────────────────────────────────────────────────────

describe('quotas de la bêta Prisme (DD9)', () => {
  it('6 bilans et 6 repas décrits par jour ; le Labo IA garde ses 20', () => {
    expect(AI_DAILY_QUOTA.narrate).toBe(6);
    expect(AI_DAILY_QUOTA.meal_text).toBe(6);
    expect(AI_DAILY_QUOTA.coach).toBe(20);
  });
});

const GROQ: PrismeStatus = {
  available: true,
  reason: null,
  provider: { id: 'groq', label: 'Groq', country: 'US', trains: false, retentionDays: 30 },
  consent: { at: '2026-10-03T19:00:00.000Z', provider: 'groq' },
  remaining: { narrate: 5, meal_text: 6 },
};

describe('prismeStatusSchema — ce que le serveur dit de Prisme (DD6)', () => {
  it('valide un statut disponible', () => {
    expect(prismeStatusSchema.parse(GROQ)).toEqual(GROQ);
  });

  it('🔴 refuse un fournisseur qui entraîne : ce statut ne peut pas exister côté app', () => {
    const trains = { ...GROQ, provider: { ...GROQ.provider!, trains: true } };
    expect(prismeStatusSchema.safeParse(trains).success).toBe(false);
  });

  it('un statut indisponible n’a pas de fournisseur', () => {
    const off = { ...GROQ, available: false, reason: 'provider', provider: null };
    expect(prismeStatusSchema.parse(off).provider).toBeNull();
  });
});

describe('needsPrismeConsent — on consent à un destinataire précis (R6)', () => {
  it('pas d’accord → il faut le demander', () => {
    expect(needsPrismeConsent({ at: null, provider: null }, GROQ)).toBe(true);
  });

  it('accord donné à ce fournisseur → rien à demander', () => {
    expect(needsPrismeConsent({ at: '2026-10-03T19:00:00.000Z', provider: 'groq' }, GROQ)).toBe(false);
  });

  it('🔴 accord donné à un autre fournisseur → redemandé', () => {
    const mistral: PrismeStatus = { ...GROQ, provider: { ...GROQ.provider!, id: 'mistral', label: 'Mistral AI', country: 'FR' } };
    expect(needsPrismeConsent({ at: '2026-10-03T19:00:00.000Z', provider: 'groq' }, mistral)).toBe(true);
  });

  it('Prisme indisponible (aucun fournisseur) : l’accord ne peut pas être tenu pour donné', () => {
    const off: PrismeStatus = { ...GROQ, available: false, reason: 'provider', provider: null };
    expect(needsPrismeConsent({ at: '2026-10-03T19:00:00.000Z', provider: 'groq' }, off)).toBe(true);
  });

  it('statut inconnu (hors ligne au démarrage) : l’accord local fait foi', () => {
    expect(needsPrismeConsent({ at: '2026-10-03T19:00:00.000Z', provider: 'groq' }, null)).toBe(false);
    expect(needsPrismeConsent({ at: null, provider: null }, null)).toBe(true);
  });
});

describe('parseMealTextResult — le repas décrit (spec R8, R9)', () => {
  const item = (name: string) => ({ name, grams: 100, confidence: 0.8 });

  it('rend les aliments et leurs grammes, sans calorie', () => {
    const raw = JSON.stringify({ items: [item('Riz blanc cuit'), item('Saumon cru')] });
    expect(parseMealTextResult(raw)).toEqual({ items: [item('Riz blanc cuit'), item('Saumon cru')], truncated: false });
  });

  it(`🔴 coupe à ${MEAL_ITEMS_MAX} aliments AVANT de valider, et le signale`, () => {
    // Le schéma de la photo borne à 12 : valider d'abord jetterait toute une réponse de 14 aliments.
    const raw = JSON.stringify({ items: Array.from({ length: 14 }, (_, i) => item(`Aliment ${i}`)) });
    const parsed = parseMealTextResult(raw);
    expect(parsed?.items).toHaveLength(MEAL_ITEMS_MAX);
    expect(parsed?.truncated).toBe(true);
  });

  it('une réponse illisible ou mal formée → null', () => {
    expect(parseMealTextResult('désolé')).toBeNull();
    expect(parseMealTextResult('{"items": [')).toBeNull();
    expect(parseMealTextResult('{"items": [}')).toBeNull();
    expect(parseMealTextResult('{"items":[{"name":"","grams":50,"confidence":0.5}]}')).toBeNull();
    expect(parseMealTextResult('{"aliments":[]}')).toBeNull();
  });

  it('aucun aliment reconnu → une liste vide, pas une erreur', () => {
    expect(parseMealTextResult('{"items":[]}')).toEqual({ items: [], truncated: false });
  });

  it('le texte envoyé est borné à 300 caractères', () => {
    expect(MEAL_TEXT_MAX_CHARS).toBe(300);
  });
});
