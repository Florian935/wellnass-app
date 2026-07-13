import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FOOD_CATEGORIES,
  MICRONUTRIENT_KEYS,
  validateFoodInput,
  type FoodCategory,
  type FoodFormInput,
} from '@wellness/shared';
import { getFood, saveFood } from '../data/foods';
import { fr } from '../i18n/fr';
import { theme } from '../theme';

/** Clés macro du formulaire (ordre d'affichage), miroir de `FoodFormValues`. */
const MACRO_KEYS = [
  'proteinPer100g',
  'carbsPer100g',
  'sugarsPer100g',
  'fatPer100g',
  'saturatedFatPer100g',
  'fiberPer100g',
] as const;
type MacroKey = (typeof MACRO_KEYS)[number];
type MicroKey = (typeof MICRONUTRIENT_KEYS)[number];

const emptyMacros = (): Record<MacroKey, string> =>
  Object.fromEntries(MACRO_KEYS.map((k) => [k, ''])) as Record<MacroKey, string>;
const emptyMicros = (): Record<MicroKey, string> =>
  Object.fromEntries(MICRONUTRIENT_KEYS.map((k) => [k, ''])) as Record<MicroKey, string>;

const numToStr = (n: number | null | undefined): string => (n == null ? '' : String(n));

/**
 * Formulaire de création / édition d'un aliment éditorial (US 8.5). Nom FR + EN (requis),
 * catégorie, calories, macros (6) et micronutriments (10). Validation via `validateFoodInput`
 * (partagé) avec erreurs par champ. Enregistrement via `saveFood` → retour à la liste. FR.
 */
export function FoodEditScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [nameFr, setNameFr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [category, setCategory] = useState<FoodCategory>(FOOD_CATEGORIES[0]);
  const [kcal, setKcal] = useState('');
  const [macros, setMacros] = useState<Record<MacroKey, string>>(emptyMacros);
  const [micros, setMicros] = useState<Record<MicroKey, string>>(emptyMicros);
  const [importKey, setImportKey] = useState<string | null>(null);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { food, error } = await getFood(id);
    if (error || !food) {
      setFormError(fr.foods.notFound);
      setLoading(false);
      return;
    }
    setNameFr(food.nameFr);
    setNameEn(food.nameEn);
    setCategory(food.category);
    setKcal(numToStr(food.kcalPer100g));
    setMacros({
      proteinPer100g: numToStr(food.proteinPer100g),
      carbsPer100g: numToStr(food.carbsPer100g),
      sugarsPer100g: numToStr(food.sugarsPer100g),
      fatPer100g: numToStr(food.fatPer100g),
      saturatedFatPer100g: numToStr(food.saturatedFatPer100g),
      fiberPer100g: numToStr(food.fiberPer100g),
    });
    setMicros(
      Object.fromEntries(
        MICRONUTRIENT_KEYS.map((k) => [k, numToStr(food.micronutrients[k])]),
      ) as Record<MicroKey, string>,
    );
    setImportKey(food.importKey);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const input = useMemo<FoodFormInput>(
    () => ({ nameFr, nameEn, category, kcalPer100g: kcal, ...macros, ...micros }),
    [nameFr, nameEn, category, kcal, macros, micros],
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const { values, errors } = validateFoodInput(input);
    if (!values) {
      const map: Record<string, string> = {};
      for (const err of errors) map[err.field] = err.reason;
      setFieldErrors(map);
      return;
    }

    setSaving(true);
    const { error } = await saveFood({ ...values, id });
    setSaving(false);
    if (error) {
      setFormError(fr.foods.saveError);
      return;
    }
    navigate('/foods');
  }

  return (
    <div style={styles.wrap}>
      <section style={styles.panel}>
        <div style={styles.header}>
          <h2 style={styles.h2}>{isEdit ? fr.foods.formEditTitle : fr.foods.formNewTitle}</h2>
          <button type="button" style={styles.back} onClick={() => navigate('/foods')}>
            {fr.foods.cancel}
          </button>
        </div>

        {loading ? (
          <p style={styles.muted}>{fr.foods.loading}</p>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            {formError && (
              <div style={styles.error} role="alert">
                {formError}
              </div>
            )}

            <div style={styles.row}>
              <Field label={fr.foods.nameFr} error={fieldErrors.nameFr}>
                <input type="text" value={nameFr} onChange={(e) => setNameFr(e.target.value)} style={styles.input} />
              </Field>
              <Field label={fr.foods.nameEn} error={fieldErrors.nameEn}>
                <input type="text" value={nameEn} onChange={(e) => setNameEn(e.target.value)} style={styles.input} />
              </Field>
            </div>

            <div style={styles.row}>
              <Field label={fr.foods.category} error={fieldErrors.category}>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as FoodCategory)}
                  style={styles.input}
                >
                  {FOOD_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {fr.foods.categoryNames[c]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={fr.foods.kcal} error={fieldErrors.kcalPer100g}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={kcal}
                  onChange={(e) => setKcal(e.target.value)}
                  style={styles.input}
                />
              </Field>
            </div>

            {importKey != null && (
              <Field label={fr.foods.importKeyLabel}>
                <input type="text" value={importKey} readOnly style={{ ...styles.input, ...styles.readonly }} />
              </Field>
            )}

            <fieldset style={styles.fieldset}>
              <legend style={styles.legend}>{fr.foods.macrosTitle}</legend>
              <div style={styles.grid}>
                {MACRO_KEYS.map((k) => (
                  <Field key={k} label={fr.foods.macroNames[k]} error={fieldErrors[k]}>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={macros[k]}
                      onChange={(e) => setMacros((m) => ({ ...m, [k]: e.target.value }))}
                      style={styles.input}
                    />
                  </Field>
                ))}
              </div>
            </fieldset>

            <fieldset style={styles.fieldset}>
              <legend style={styles.legend}>{fr.foods.microsTitle}</legend>
              <div style={styles.grid}>
                {MICRONUTRIENT_KEYS.map((k) => (
                  <Field key={k} label={fr.foods.microNames[k]} error={fieldErrors[k]}>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={micros[k]}
                      onChange={(e) => setMicros((m) => ({ ...m, [k]: e.target.value }))}
                      style={styles.input}
                    />
                  </Field>
                ))}
              </div>
            </fieldset>

            <button type="submit" style={styles.primary} disabled={saving}>
              {saving ? fr.foods.saving : fr.foods.save}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

/** Champ de formulaire : label + contenu + éventuel message d'erreur. */
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ ...styles.field, flex: 1, minWidth: 160 }}>
      <label style={styles.label}>{label}</label>
      {children}
      {error && <span style={styles.fieldError}>{error}</span>}
    </div>
  );
}

const { colors, radius, font } = theme;

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 },
  panel: {
    background: colors.panel,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    padding: 20,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },
  h2: { margin: 0, fontSize: 15 },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  row: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column' },
  label: { display: 'block', fontSize: 12, color: colors.muted, marginBottom: 4, fontWeight: 600 },
  fieldError: { color: colors.danger, fontSize: 11.5, marginTop: 4 },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: '9px 11px',
    fontSize: 14,
    background: colors.field,
    color: colors.ink,
    fontFamily: font,
  },
  readonly: { background: colors.bg, color: colors.muted },
  fieldset: {
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: '12px 14px',
    margin: 0,
  },
  legend: { fontSize: 12, fontWeight: 700, color: colors.ink, padding: '0 6px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 },
  error: {
    background: colors.dangerBg,
    border: `1px solid ${colors.dangerBorder}`,
    color: colors.danger,
    fontSize: 12.5,
    borderRadius: radius.sm,
    padding: '8px 10px',
  },
  muted: { color: colors.muted, fontSize: 13, margin: 0 },
  primary: {
    alignSelf: 'flex-start',
    border: 'none',
    borderRadius: radius.md,
    padding: '9px 16px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    background: colors.accent,
    color: colors.accentInk,
    fontFamily: font,
  },
  back: {
    border: `1px solid ${colors.border}`,
    background: '#fff',
    borderRadius: radius.sm,
    padding: '6px 11px',
    fontSize: 12,
    fontWeight: 600,
    color: colors.ink,
    cursor: 'pointer',
    fontFamily: font,
  },
};
