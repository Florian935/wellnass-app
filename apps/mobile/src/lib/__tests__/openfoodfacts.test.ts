import { interpretOffProduct, mapOffMicronutrients } from '@/lib/openfoodfacts';

describe('mapOffMicronutrients (4.33)', () => {
  it('normalise les grammes OFF vers mg (×1000) et µg (×1e6)', () => {
    // OFF stocke les _100g en grammes : 0.079 g de magnésium → 79 mg ; 0.0000024 g B12 → 2,4 µg
    expect(
      mapOffMicronutrients({
        magnesium_100g: 0.079,
        sodium_100g: 0.3,
        'vitamin-c_100g': 0.05,
        'vitamin-d_100g': 0.00001,
        'vitamin-b12_100g': 0.0000024,
      }),
    ).toEqual({
      magnesium_mg: 79,
      sodium_mg: 300,
      vitamin_c_mg: 50,
      vitamin_d_ug: 10,
      vitamin_b12_ug: 2.4,
    });
  });

  it('omet les champs absents ou ≤ 0 (jamais 0 par défaut)', () => {
    expect(mapOffMicronutrients({ magnesium_100g: 0, iron_100g: 0.002 })).toEqual({
      iron_mg: 2,
    });
    expect(mapOffMicronutrients({})).toEqual({});
  });

  it('accepte les valeurs sous forme de chaîne et l’alias folates', () => {
    expect(mapOffMicronutrients({ folates_100g: '0.000194', calcium_100g: '0.099' })).toEqual({
      vitamin_b9_ug: 194,
      calcium_mg: 99,
    });
  });

  it('mappe les nutriments étendus (AG en g ×1, minéraux ×1000, µg ×1e6)', () => {
    expect(
      mapOffMicronutrients({
        'omega-3-fat_100g': 1.2,
        zinc_100g: 0.005,
        selenium_100g: 0.00002,
        'vitamin-b1_100g': 0.0012,
        'vitamin-pp_100g': 0.016, // B3 (niacine)
      }),
    ).toEqual({ omega_3_g: 1.2, zinc_mg: 5, selenium_ug: 20, vitamin_b1_mg: 1.2, vitamin_b3_mg: 16 });
  });

  it('omet la vitamine A quand OFF la donne en IU (unité non massique)', () => {
    expect(mapOffMicronutrients({ 'vitamin-a_100g': 400, 'vitamin-a_unit': 'IU' })).toEqual({});
  });

  it('mappe la vitamine A quand l’unité est massique (g → µg)', () => {
    expect(mapOffMicronutrients({ 'vitamin-a_100g': 0.0008, 'vitamin-a_unit': 'µg' })).toEqual({
      vitamin_a_ug: 800,
    });
  });
});

describe('interpretOffProduct (4.10 — cause d’échec)', () => {
  it('produit valide (nom + kcal) → found, avec repli du code-barres + sous-macros', () => {
    const res = interpretOffProduct(
      {
        status: 1,
        product: {
          code: '3017620422003',
          product_name_fr: 'Nutella',
          nutriments: {
            'energy-kcal_100g': 539,
            proteins_100g: 6.3,
            carbohydrates_100g: 57.5,
            fat_100g: 30.9,
            sugars_100g: 56.3,
            'saturated-fat_100g': 10.6,
          },
        },
      },
      'fr',
      '3017620422003',
    );
    expect(res.kind).toBe('found');
    if (res.kind === 'found') {
      expect(res.food.name).toBe('Nutella');
      expect(res.food.kcalPer100g).toBe(539);
      expect(res.food.barcode).toBe('3017620422003');
      // Sous-macros captées (4.10 — afficher un maximum d'info au scan) ; fibres absentes → null.
      expect(res.food.sugarsPer100g).toBe(56.3);
      expect(res.food.saturatedFatPer100g).toBe(10.6);
      expect(res.food.fiberPer100g).toBeNull();
    }
  });

  it('replie sur le code scanné quand la fiche ne porte pas son code', () => {
    const res = interpretOffProduct(
      { status: 1, product: { product_name: 'Eau', nutriments: { 'energy-kcal_100g': 0 } } },
      'fr',
      '1234567890123',
    );
    // kcal 0 reste exploitable (num renvoie 0, non null) → found, code replié
    expect(res).toEqual(expect.objectContaining({ kind: 'found' }));
    if (res.kind === 'found') expect(res.food.barcode).toBe('1234567890123');
  });

  it('status 0 (OFF ne connaît pas le code) → notFound', () => {
    expect(interpretOffProduct({ status: 0 }, 'fr', '0000000000000')).toEqual({ kind: 'notFound' });
  });

  it('produit présent mais sans calories exploitables → incomplete', () => {
    expect(
      interpretOffProduct({ status: 1, product: { product_name_fr: 'Truc', nutriments: {} } }, 'fr', '3017620422003'),
    ).toEqual({ kind: 'incomplete' });
  });

  it('produit sans nom → incomplete', () => {
    expect(
      interpretOffProduct({ status: 1, product: { nutriments: { 'energy-kcal_100g': 42 } } }, 'fr', '3017620422003'),
    ).toEqual({ kind: 'incomplete' });
  });
});
