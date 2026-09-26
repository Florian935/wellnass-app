/**
 * Les micronutriments suivis du jour (4.35) et les repères de qualité (NUTRI-UX01 R3.5).
 *
 * Sortis de `app/(tabs)/nutrition.tsx` par NUTRI-UX03, sans changement de comportement.
 */

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { countReportedMicros, saltFromSodiumMg, sumMicronutrients, type MicronutrientKey } from '@wellness/shared';
import { MicroCoverageGrid, type MicroCell } from '@/components/nutrition/MicroCoverageGrid';
import { QualityCard } from '@/components/nutrition/QualityCard';
import { useLibraryPresence } from '@/data/repositories/food-repository';
import { useDayQuality, type JournalEntry } from '@/data/repositories/journal-repository';
import { useTrackedMicros } from '@/stores/tracked-micros';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Unité d'un micronutriment déduite du suffixe de sa clé (`_mg` / `_ug`). */
const microUnit = (key: MicronutrientKey): 'mg' | 'ug' => (key.endsWith('_ug') ? 'ug' : 'mg');

/** Format micro : entier ≥ 10, sinon 1 décimale ; virgule décimale en FR (cf. MicronutrientDetails). */
function fmtMicro(n: number, lang: 'fr' | 'en', decimals?: number): string {
  const d = decimals ?? (n >= 10 ? 0 : 1);
  const s = n.toFixed(d);
  return lang === 'fr' ? s.replace('.', ',') : s;
}

/**
 * Repères de qualité du jour (R3.5).
 *
 * Se tait tant que rien n'est calculable : sans aliment identifié, les trois valeurs seraient
 * des zéros trompeurs plutôt qu'une information (les sous-macros vivent sur `foods`, pas sur
 * l'entrée de journal — voir `useDayQuality`).
 */
export function DayQualitySection({ day, targetKcal }: { day: string; targetKcal: number | null }) {
  const { quality } = useDayQuality(day);
  if (quality.coverageRatio === 0) return null;
  return (
    <QualityCard
      compact
      targetKcal={targetKcal}
      values={{
        fiber: quality.fiber,
        sugars: quality.sugars,
        saturatedFat: quality.saturatedFat,
      }}
    />
  );
}

/** Micronutriments suivis du jour, en grille de couverture (4.35). */
export function TrackedMicrosRecap({ entries }: { entries: JournalEntry[] }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  // F6 — la cause réelle de l'absence de micros : une base vide n'est pas une saisie imparfaite.
  const library = useLibraryPresence();
  const tracked = useTrackedMicros((s) => s.tracked);
  const dayMicros = useMemo(() => sumMicronutrients(entries.map((e) => e.micronutrients)), [entries]);
  const lang = i18n.language === 'en' ? 'en' : 'fr';

  const cells = useMemo<MicroCell[]>(() => {
    const list: MicroCell[] = tracked.map((key) => ({
      key,
      label: t(`nutrition.micros.labels.${key}`),
      value: fmtMicro(dayMicros[key] ?? 0, lang),
      unit: t(`nutrition.micros.units.${microUnit(key)}`),
      amount: dayMicros[key] ?? 0,
    }));
    // Le sel est dérivé du sodium et n'a pas de VNR : il reste affiché, sans anneau.
    if (tracked.includes('sodium_mg')) {
      list.push({
        key: 'salt',
        label: t('nutrition.micros.labels.salt'),
        value: fmtMicro(saltFromSodiumMg(dayMicros.sodium_mg ?? 0), lang, 2),
        unit: t('nutrition.micros.units.g'),
        amount: null,
      });
    }
    return list;
  }, [tracked, dayMicros, lang, t]);

  /**
   * US NUTRI-UX02 — six pastilles à « 0,0 mg » valent moins que rien.
   *
   * `sumMicronutrients` respecte la règle de NUTR-07 (« une clé n'apparaît que si renseignée,
   * jamais forcée à 0 ») ; c'est la lecture `dayMicros[key] ?? 0` juste au-dessus qui fabriquait
   * les zéros. Sur une journée saisie en texte libre ou en ajout rapide — c'est-à-dire toute
   * journée d'un appareil où la bibliothèque n'est pas descendue — l'écran affirmait « 0,0 mg de
   * fer » là où la vérité est « je n'en sais rien ». Un zéro faux coûte la confiance dans tous
   * les autres chiffres de l'écran.
   *
   * 🔴 Le seuil est **aucun**, pas « peu » : si trois micros sur six sont connus, les trois autres
   * à zéro sont une information juste (« tu n'as pas eu de vitamine D aujourd'hui ») et la grille
   * reste. Seul le cas « rien n'est connu » ment, et lui seul est remplacé par son explication.
   */
  const reported = countReportedMicros(dayMicros, tracked);

  if (tracked.length === 0) return null;
  if (reported === 0) {
    /*
     * Passe 2 — F6 : ne pas donner un conseil impossible à suivre.
     *
     * Le message disait « cherche l'aliment dans la base pour les suivre ». Juste dans l'absolu —
     * et faux sur un appareil où la bibliothèque n'est pas descendue, c'est-à-dire précisément
     * celui où le cas se produit le plus souvent. On envoyait l'utilisateur dans un mur, en lui
     * laissant croire que le problème venait de sa saisie.
     */
    const cause = library.isEmpty ? 'unknownNoLibrary' : entries.length === 0 ? 'unknownEmptyDay' : 'unknownFreeText';
    return (
      <View style={[styles.microsUnknown, { borderColor: colors.border }]} testID="micros-unknown">
        <Ionicons name="help-circle-outline" size={17} color={colors.textMuted} />
        <Text style={[styles.microsUnknownText, { color: colors.textMuted }]}>{t(`nutrition.micros.${cause}`)}</Text>
      </View>
    );
  }
  return <MicroCoverageGrid cells={cells} />;
}

const styles = StyleSheet.create({
  // US NUTRI-UX02 — l'explication qui remplace les pastilles à zéro. Contour pointillé et non
  // carte pleine : ce n'est pas une donnée de plus, c'est l'absence de donnée, dite.
  microsUnknown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  microsUnknownText: { flex: 1, fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19 },
});
