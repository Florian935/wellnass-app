/**
 * `useUnits` — la couche qui décide de **ce que l'utilisateur lit**.
 *
 * Ce hook ne calcule rien : il délègue à `@wellness/shared/units`, déjà couvert à 100 %. Ce qu'il
 * décide, c'est **quel formateur appliquer à quoi**, et c'est là que se logent les défauts —
 * chacun de ceux listés ci-dessous a été constaté :
 *
 *  1. **`formatHeight` ≠ `formatCircumference`.** Le premier rend l'impérial en pieds-pouces, ce
 *     qui est juste pour une taille humaine et **absurde pour un tour de bras** : 35 cm
 *     s'afficherait « 1 ft 1.8 in » au lieu de 13,8 in.
 *  2. **`formatAxisNumber` ≠ `*InputValue`.** Les seconds passent par `String(Number(...))`, donc
 *     un **point** décimal : juste dans un champ de saisie, faux à l'affichage. C'est ce mélange
 *     qui donnait un axe « 90.2 | 67.7 » en français (recette du 01/08/2026).
 *  3. **Chaque formateur a son nombre de décimales** — 1 pour un poids, 2 pour une distance, 0 pour
 *     une taille en cm. Les uniformiser afficherait « 5,00 km » ou « 178,00 cm ».
 *  4. **`null` n'est pas `0`.** Toute valeur absente rend un tiret, jamais un zéro formaté.
 *
 * Le fichier couvrait deux cas nominaux (metric+FR, imperial+EN) : il couvre désormais les
 * **branches**, qui sont l'essentiel du risque ici — chaque fonction en a au moins deux, et une
 * seule des deux était exercée.
 */
import { renderHook } from '@testing-library/react-native';
import { useUnits } from '../useUnits';

// Les fabriques `jest.mock` sont hoistées par Babel avant `const`/`let` : `var` permet aux objets
// mutables d'être atteignables depuis elles (hoisting au même niveau).
// eslint-disable-next-line no-var
var settingsMock = { units: 'metric' };
// eslint-disable-next-line no-var
var langMock = { language: 'fr' };

jest.mock('@/data/repositories/settings-repository', () => ({
  useSettings: () => ({ settings: settingsMock, isLoading: false }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: langMock }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

type Units = ReturnType<typeof useUnits>;

/** Monte le hook dans un système et une locale donnés. */
const unites = async (units: 'metric' | 'imperial', language = 'fr'): Promise<Units> => {
  settingsMock.units = units;
  langMock.language = language;
  const { result } = await renderHook(() => useUnits());
  return result.current;
};

/** Les deux systèmes, pour les règles qui doivent tenir dans les deux. */
const LES_DEUX = ['metric', 'imperial'] as const;

beforeEach(() => {
  settingsMock.units = 'metric';
  langMock.language = 'fr';
});

// ---------------------------------------------------------------------------
// Cas nominaux (conservés du smoke test d'origine)
// ---------------------------------------------------------------------------

describe('cas nominaux', () => {
  it('metric + FR : virgule décimale, symboles SI', async () => {
    const u = await unites('metric', 'fr');

    expect(u.formatWeight(72.5)).toBe('72,5 kg');
    expect(u.formatDistance(5.2)).toBe('5,20 km');
    expect(u.formatHeight(178)).toBe('178 cm');
    expect(u.formatPace(300)).toBe('5:00 /km');
    expect(u.parseWeightToKg('72,5')).toBeCloseTo(72.5, 5);
  });

  it('imperial + EN : point décimal, conversions lb/mi/ft-in', async () => {
    const u = await unites('imperial', 'en');

    expect(u.formatWeight(72.5)).toBe('159.8 lb');
    expect(u.formatDistance(5.2)).toBe('3.23 mi');
    expect(u.formatHeight(178)).toBe('5 ft 10 in');
    expect(u.formatPace(300)).toBe('8:03 /mi');
    expect(u.parseWeightToKg('160')).toBeCloseTo(72.57, 1);
  });

  it('🔴 le réglage ABSENT retombe sur le métrique', async () => {
    settingsMock.units = undefined as unknown as string;
    const { result } = await renderHook(() => useUnits());

    // Réglages pas encore synchronisés : l'impérial par défaut afficherait des livres à un
    // utilisateur français pendant les premières secondes de l'app.
    expect(result.current.system).toBe('metric');
    expect(result.current.formatWeight(72.5)).toBe('72,5 kg');
  });
});

// ---------------------------------------------------------------------------
// L'absence de donnée
// ---------------------------------------------------------------------------

describe('valeur absente', () => {
  it.each(LES_DEUX)('🔴 en %s, `null` rend un tiret — jamais un zéro', async (system) => {
    const u = await unites(system);

    // « 0,0 kg » se lit comme une mesure ; le tiret dit qu'il n'y en a pas. La distinction porte
    // tout l'affichage des historiques, où les trous sont fréquents.
    expect(u.formatWeight(null)).toBe('—');
    expect(u.formatDistance(null)).toBe('—');
    expect(u.formatDistanceValue(null)).toBe('—');
    expect(u.formatCircumference(null)).toBe('—');
    expect(u.formatHeight(null)).toBe('—');
  });

  it('`undefined` est traité comme `null`', async () => {
    const u = await unites('metric');

    // Un champ optionnel non renseigné arrive en `undefined` depuis la base : le distinguer de
    // `null` produirait « undefined kg ».
    expect(u.formatWeight(undefined)).toBe('—');
    expect(u.formatHeight(undefined)).toBe('—');
    expect(u.heightPartsFromCm(undefined)).toEqual({ a: '', b: '' });
    expect(u.paceInputValue(undefined)).toBe('');
    expect(u.weightInputValue(undefined)).toBe('');
    expect(u.distanceInputValue(undefined)).toBe('');
  });

  it.each([null, 0, -30, Number.NaN, Number.POSITIVE_INFINITY])(
    '🔴 une allure « %s » n’est pas une allure',
    async (valeur) => {
      const u = await unites('metric');

      // Garde explicite plutôt qu'une comparaison au sentinelle de `formatPaceMMSS` : une allure
      // nulle ou négative viendrait d'une distance à zéro, et « 0:00 /km » se lirait comme une
      // performance surhumaine.
      expect(u.formatPace(valeur as number)).toBe('running.active.noData');
    },
  );
});

// ---------------------------------------------------------------------------
// Circonférence : le piège de `formatHeight`
// ---------------------------------------------------------------------------

describe('circonférence corporelle', () => {
  it('🔴 en impérial, une circonférence est en POUCES DÉCIMAUX, pas en pieds-pouces', async () => {
    const u = await unites('imperial', 'en');

    // C'est le piège documenté : `formatHeight(35)` donnerait « 1 ft 1.8 in » pour un tour de
    // bras. Les deux fonctions existent précisément pour ne pas être confondues.
    expect(u.formatCircumference(35)).toBe('13.8 in');
    // `formatHeight` arrondit les pouces à l'entier : « 1 ft 2 in » pour un tour de bras — un
    // affichage à la fois faux de précision et absurde de forme.
    expect(u.formatHeight(35)).toBe('1 ft 2 in');
  });

  it('en métrique, la circonférence garde ses centimètres et une décimale', async () => {
    const u = await unites('metric', 'fr');

    expect(u.formatCircumference(81.5)).toBe('81,5 cm');
    expect(u.circumferenceSymbol).toBe('cm');
  });

  it('le symbole suit le système', async () => {
    expect((await unites('imperial')).circumferenceSymbol).toBe('in');
    expect((await unites('metric')).circumferenceSymbol).toBe('cm');
  });

  it('🔴 la valeur de champ est ARRONDIE au dixième', async () => {
    const u = await unites('imperial');

    // 35 cm = 13,779… in : pré-remplir un champ avec quinze décimales rendrait la saisie
    // illisible et la moindre réécriture ferait dériver la valeur.
    expect(u.toCircumferenceValue(35)).toBe(13.8);
    expect((await unites('metric')).toCircumferenceValue(35)).toBe(35);
  });
});

// ---------------------------------------------------------------------------
// Saisie de circonférence
// ---------------------------------------------------------------------------

describe('parseCircumferenceToCm', () => {
  it('🔴 la VIRGULE est acceptée autant que le point', async () => {
    const u = await unites('metric');

    // Le clavier français produit une virgule : la refuser rendrait la saisie impossible pour la
    // moitié des utilisateurs.
    expect(u.parseCircumferenceToCm('81,5')).toBe(81.5);
    expect(u.parseCircumferenceToCm('81.5')).toBe(81.5);
  });

  it.each(['', '   ', 'abc', '0', '-5'])('🔴 « %s » n’est pas une mesure', async (saisie) => {
    const u = await unites('metric');

    // Une circonférence nulle ou négative n'existe pas ; `null` laisse le champ visiblement vide
    // plutôt que d'enregistrer une valeur que rien ne pourra expliquer.
    expect(u.parseCircumferenceToCm(saisie)).toBeNull();
  });

  it('les espaces autour sont ignorés', async () => {
    const u = await unites('metric');

    expect(u.parseCircumferenceToCm('  81,5  ')).toBe(81.5);
  });

  it('🔴 en impérial, la saisie est CONVERTIE puis arrondie au dixième', async () => {
    const u = await unites('imperial');

    // La colonne est `numeric(5,1)` : transporter plus de précision serait perdu à l'écriture, et
    // ferait diverger l'affichage de ce qui est stocké.
    expect(u.parseCircumferenceToCm('13.8')).toBe(35.1);
  });
});

// ---------------------------------------------------------------------------
// Le piège des libellés d'axe
// ---------------------------------------------------------------------------

describe('formatAxisNumber', () => {
  it('🔴 il LOCALISE le séparateur, contrairement aux valeurs de champ', async () => {
    const u = await unites('metric', 'fr');

    // Défaut de recette du 01/08/2026 : les `*InputValue` passent par `String(Number(...))`, donc
    // un point — juste dans un champ, faux sur un axe. Un graphe français affichait « 90.2 ».
    expect(u.formatAxisNumber(90.2)).toBe('90,2');
    expect(u.weightInputValue(90.2)).toBe('90.2');
  });

  it('🔴 un ENTIER n’affiche pas de décimale', async () => {
    const u = await unites('metric', 'fr');

    // « 90,0 » sur un axe suggère une précision au dixième que la mesure n'a pas.
    expect(u.formatAxisNumber(90)).toBe('90');
    expect(u.formatAxisNumber(90.2)).toBe('90,2');
  });

  it('en anglais, le point est le bon séparateur', async () => {
    const u = await unites('metric', 'en');

    expect(u.formatAxisNumber(90.2)).toBe('90.2');
  });
});

// ---------------------------------------------------------------------------
// Décimales par grandeur
// ---------------------------------------------------------------------------

describe('nombre de décimales', () => {
  it('🔴 poids : 1 décimale, distance : 2, taille : 0', async () => {
    const u = await unites('metric', 'fr');

    // Les uniformiser donnerait « 5,00 km » (faux niveau de précision) ou « 178,00 cm » (absurde).
    expect(u.formatWeight(72)).toBe('72,0 kg');
    expect(u.formatDistance(5)).toBe('5,00 km');
    expect(u.formatHeight(178)).toBe('178 cm');
  });

  it('🔴 la valeur de distance sans symbole garde ses deux décimales', async () => {
    const u = await unites('metric', 'fr');

    // Utilisée par les mises en page « grand nombre + petite unité » : le symbole est ailleurs,
    // la précision doit rester la même qu'avec.
    expect(u.formatDistanceValue(5.2)).toBe('5,20');
    expect((await unites('imperial', 'en')).formatDistanceValue(5.2)).toBe('3.23');
  });

  it('🔴 la taille en cm est ARRONDIE, jamais tronquée à l’affichage', async () => {
    const u = await unites('metric', 'fr');

    expect(u.formatHeight(177.6)).toBe('178 cm');
  });
});

// ---------------------------------------------------------------------------
// Valeurs de pré-remplissage
// ---------------------------------------------------------------------------

describe('valeurs de champ', () => {
  it('🔴 elles ne portent PAS de zéro décimal inutile', async () => {
    const u = await unites('metric');

    // `String(Number(...))` retire le zéro final : « 72.0 » dans un champ de saisie invite à
    // corriger une décimale qui n'a pas de sens.
    expect(u.weightInputValue(72)).toBe('72');
    expect(u.weightInputValue(72.5)).toBe('72.5');
    expect(u.distanceInputValue(5)).toBe('5');
  });

  it('en impérial, elles sont converties', async () => {
    const u = await unites('imperial');

    expect(u.weightInputValue(72.5)).toBe('159.8');
    expect(u.distanceInputValue(5.2)).toBe('3.23');
  });

  it('🔴 la taille impériale est éclatée en DEUX champs', async () => {
    const u = await unites('imperial');

    // Une taille en pouces seuls n'est pas la façon dont on l'énonce : pieds et pouces sont deux
    // champs, comme sur une balance américaine.
    expect(u.heightPartsFromCm(178)).toEqual({ a: '5', b: '10' });
  });

  it('en métrique, le second champ reste vide', async () => {
    const u = await unites('metric');

    // Un « 0 » dans le champ des pouces se lirait comme une valeur saisie.
    expect(u.heightPartsFromCm(178)).toEqual({ a: '178', b: '' });
  });

  it('la taille métrique de champ est arrondie', async () => {
    const u = await unites('metric');

    expect(u.heightPartsFromCm(177.6)).toEqual({ a: '178', b: '' });
  });

  it('l’allure de champ est vide sans valeur, formatée sinon', async () => {
    const u = await unites('metric');

    expect(u.paceInputValue(null)).toBe('');
    expect(u.paceInputValue(300)).toBe('5:00');
  });
});

// ---------------------------------------------------------------------------
// Valeurs brutes pour les graphes
// ---------------------------------------------------------------------------

describe('valeurs pour les graphes', () => {
  it('🔴 elles sont CONVERTIES mais NI arrondies NI formatées', async () => {
    const u = await unites('imperial');

    // Un graphe trace des nombres, pas des chaînes : arrondir ici écraserait les variations
    // fines qu'on vient justement observer.
    expect(u.toWeightValue(72.5)).toBeCloseTo(159.83, 1);
    expect(u.toDistanceValue(5.2)).toBeCloseTo(3.23, 2);
  });

  it('en métrique, elles sont l’identité', async () => {
    const u = await unites('metric');

    // Le système métrique EST le stockage : un facteur ici masquerait les erreurs de conversion
    // au lieu de les révéler.
    expect(u.toWeightValue(72.5)).toBe(72.5);
    expect(u.toDistanceValue(5.2)).toBe(5.2);
  });
});

// ---------------------------------------------------------------------------
// Symboles
// ---------------------------------------------------------------------------

describe('symboles', () => {
  it('les symboles suivent le système', async () => {
    const metrique = await unites('metric');
    expect([metrique.weightSymbol, metrique.distanceSymbol]).toEqual(['kg', 'km']);

    const imperial = await unites('imperial');
    expect([imperial.weightSymbol, imperial.distanceSymbol]).toEqual(['lb', 'mi']);
  });

  it('🔴 l’allure porte le symbole de DISTANCE, pas celui de poids', async () => {
    const u = await unites('imperial', 'en');

    // Une allure est un temps *par unité de distance* : « 8:03 /lb » n'aurait aucun sens, et
    // l'erreur est facile puisque les deux symboles viennent du même objet.
    expect(u.formatPace(300)).toBe('8:03 /mi');
  });
});
