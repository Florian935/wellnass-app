import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  type MicronutrientKey,
  type Micronutrients,
  saltFromSodiumMg,
  scaleMicronutrients,
} from '@wellness/shared';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Unit = 'mg' | 'ug';

/** Regroupement d'affichage du socle (spec 4.33 §5, calé sur la maquette Micronutriments). */
const GROUPS: { key: string; items: { key: MicronutrientKey; unit: Unit }[] }[] = [
  { key: 'lipids', items: [{ key: 'cholesterol_mg', unit: 'mg' }] },
  {
    key: 'minerals',
    items: [
      { key: 'sodium_mg', unit: 'mg' },
      { key: 'magnesium_mg', unit: 'mg' },
      { key: 'potassium_mg', unit: 'mg' },
      { key: 'calcium_mg', unit: 'mg' },
      { key: 'iron_mg', unit: 'mg' },
    ],
  },
  {
    key: 'vitamins',
    items: [
      { key: 'vitamin_c_mg', unit: 'mg' },
      { key: 'vitamin_d_ug', unit: 'ug' },
      { key: 'vitamin_b9_ug', unit: 'ug' },
      { key: 'vitamin_b12_ug', unit: 'ug' },
    ],
  },
];

/** Format lisible : entier ≥ 10, sinon 1 décimale ; virgule décimale en FR. */
function fmt(n: number, lang: string, decimals?: number): string {
  const d = decimals ?? (n >= 10 ? 0 : 1);
  const s = n.toFixed(d);
  return lang === 'fr' ? s.replace('.', ',') : s;
}

/**
 * Section repliable « Valeurs détaillées » : liste les micronutriments **présents** d'un
 * aliment, mis à l'échelle pour `grams`, avec la valeur pour 100 g en secondaire et le sel
 * dérivé sous le sodium. Rien de renseigné → état vide. (Spec 4.33.)
 */
export function MicronutrientDetails({
  micronutrients,
  grams,
  defaultOpen = false,
  showPer100 = true,
}: {
  micronutrients: Micronutrients;
  grams: number;
  defaultOpen?: boolean;
  /**
   * Affiche la valeur de référence « pour 100 g » sous chaque nutriment.
   * Mettre à `false` quand `micronutrients` est déjà un snapshot mis à l'échelle
   * (détail d'une entrée de journal, 4.34) — la ligne « pour 100 g » n'aurait pas de sens.
   */
  showPer100?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const lang = i18n.language === 'en' ? 'en' : 'fr';
  const [open, setOpen] = useState(defaultOpen);

  const scaled = scaleMicronutrients(micronutrients, grams);
  const unitLabel = (u: Unit) => (u === 'mg' ? t('nutrition.micros.units.mg') : t('nutrition.micros.units.ug'));

  const groups = GROUPS.map((g) => ({
    key: g.key,
    items: g.items.filter((it) => micronutrients[it.key] != null),
  })).filter((g) => g.items.length > 0);
  const isEmpty = groups.length === 0;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        style={[styles.header, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('nutrition.micros.title')}</Text>
          <Text style={[styles.headerSub, { color: colors.textMuted }]}>{t('nutrition.micros.subtitle')}</Text>
        </View>
        <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={20} color={colors.textMuted} />
      </Pressable>

      {open ? (
        isEmpty ? (
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('nutrition.micros.empty.title')}</Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>{t('nutrition.micros.empty.body')}</Text>
          </View>
        ) : (
          <View style={styles.groups}>
            {groups.map((g) => (
              <View key={g.key}>
                <Text style={[styles.groupTitle, { color: colors.accent }]}>{t(`nutrition.micros.groups.${g.key}`)}</Text>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {g.items.map((it) => {
                    const per100 = micronutrients[it.key] as number;
                    const val = scaled[it.key] as number;
                    return (
                      <View key={it.key} style={[styles.item, { borderBottomColor: colors.border }]}>
                        <View style={styles.itemRow}>
                          <Text style={[styles.itemLabel, { color: colors.textMuted }]}>{t(`nutrition.micros.labels.${it.key}`)}</Text>
                          <Text style={styles.itemValueWrap}>
                            <Text style={[styles.itemValue, { color: colors.text }]}>{fmt(val, lang)}</Text>
                            <Text style={[styles.itemUnit, { color: colors.textMuted }]}> {unitLabel(it.unit)}</Text>
                          </Text>
                        </View>
                        {showPer100 ? (
                          <Text style={[styles.per100, { color: colors.textMuted }]}>
                            {t('nutrition.micros.per100', { value: fmt(per100, lang), unit: unitLabel(it.unit) })}
                          </Text>
                        ) : null}
                        {it.key === 'sodium_mg' ? (
                          <View style={[styles.sub, { borderTopColor: colors.border }]}>
                            <Text style={[styles.subLabel, { color: colors.textMuted }]}>
                              {t('nutrition.micros.labels.salt')} <Text style={styles.derived}>· {t('nutrition.micros.derived')}</Text>
                            </Text>
                            <Text style={styles.itemValueWrap}>
                              <Text style={[styles.subValue, { color: colors.textMuted }]}>{fmt(saltFromSodiumMg(val), lang, 2)}</Text>
                              <Text style={[styles.itemUnit, { color: colors.textMuted }]}> {t('nutrition.micros.units.g')}</Text>
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 15, gap: 12 },
  headerTitle: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  headerSub: { fontFamily: fontFamily.body, fontSize: 12.5, marginTop: 1 },
  groups: { gap: 18 },
  groupTitle: { fontFamily: fontFamily.monoBold, fontSize: 11, letterSpacing: 0.8, marginBottom: 8, marginLeft: 2 },
  card: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 16 },
  item: { paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  itemRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  itemLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13.5, flexShrink: 1 },
  itemValueWrap: { flexShrink: 0 },
  itemValue: { fontFamily: fontFamily.displayBold, fontSize: 17 },
  itemUnit: { fontFamily: fontFamily.mono, fontSize: 11 },
  per100: { fontFamily: fontFamily.mono, fontSize: 10.5, textAlign: 'right', marginTop: 2 },
  sub: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  subLabel: { fontFamily: fontFamily.body, fontSize: 12.5 },
  derived: { fontFamily: fontFamily.body, fontSize: 10.5 },
  subValue: { fontFamily: fontFamily.displayBold, fontSize: 15 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 18, paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center', gap: 6 },
  emptyTitle: { fontFamily: fontFamily.displayBold, fontSize: 15, textAlign: 'center' },
  emptyBody: { fontFamily: fontFamily.body, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
