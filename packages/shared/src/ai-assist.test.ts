import { describe, expect, it } from 'vitest';
import {
  AI_LOW_CONFIDENCE,
  matchPhotoItems,
  parseAiJson,
  photoMealTotals,
  stepPortion,
  mealPhotoResultSchema,
  type CatalogCandidate,
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
