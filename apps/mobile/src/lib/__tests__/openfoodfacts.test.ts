import { mapOffMicronutrients } from '@/lib/openfoodfacts';

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
});
