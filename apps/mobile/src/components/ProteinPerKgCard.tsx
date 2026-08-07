/**
 * Carte « Macros par kg » — apport protéique (MN-06) et glucidique (FUEL-01) en g/kg de poids de
 * corps, chacun face à sa fourchette de référence.
 *
 * Auto-portante : lit `useProteinPerKg` et `useCarbsPerKg`, aucune prop. Bascule 7 j / 30 j partagée.
 *
 * ⚠️ **Le nom du fichier et du composant reste `ProteinPerKgCard`** alors que la carte porte deux
 * macros : renommer aurait touché tous ses points d'import pour un gain nul, sur un écran que trois
 * recettes en attente traversent (NUTR-10, NUTR-17, NUTR-18). Seul le libellé affiché change (FUEL-01,
 * décision D2 — la ligne glucides se **fond** dans cette carte plutôt que d'ajouter un 9ᵉ bloc à un
 * écran qu'ADR-007 §2 voudrait à 4-5).
 *
 * 🔴 **Rien ici ne pilote une cible.** Les deux lignes affichent un fait mesuré et un repère. La
 * cible du journal reste celle de MN-04 (spec FUEL-01, règle R1).
 */
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CarbsPerKgStatus, ProteinPerKgStatus } from '@wellness/shared';
import { Card } from '@/components/Card';
import { Segment } from '@/components/Segment';
import {
  useCarbsPerKg,
  useProteinPerKg,
  type ProteinWindow,
} from '@/data/repositories/nutrition-repository';
import type { Palette } from '@/theme/colors';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const WINDOW_OPTIONS: readonly ProteinWindow[] = ['7d', '30d'];

/**
 * Statut → couleur : low = doré littéral (comme MN-05) ; in = accent ; high = grisé.
 * Partagé par les deux macros — deux vocabulaires de couleur dans une même carte se liraient comme
 * deux échelles différentes. Aucune couleur nouvelle n'est introduite (spec §8).
 */
function statusColor(status: ProteinPerKgStatus | CarbsPerKgStatus, colors: Palette): string {
  if (status === 'low') return '#c9a96e';
  if (status === 'high') return colors.textMuted;
  return colors.accent;
}

/** Nombre FR : 1 décimale, virgule. */
function fmt1(n: number): string {
  return n.toFixed(1).replace('.', ',');
}

/**
 * Une ligne de macro : libellé, valeur en g/kg, puce de statut, et sa référence en dessous.
 * La brique « jauge valeur vs cible » qu'ADR-007 §3 demande de mutualiser plutôt que de dupliquer.
 */
function MacroRow(props: {
  label: string;
  gPerKg: number;
  status: ProteinPerKgStatus | CarbsPerKgStatus;
  reference: string;
  accessibilityLabel: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const color = statusColor(props.status, colors);

  return (
    <View accessible accessibilityLabel={props.accessibilityLabel} style={styles.macroRow}>
      <Text style={[styles.macroLabel, { color: colors.textMuted }]}>{props.label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: colors.text }]}>
          {fmt1(props.gPerKg)} {t('stats.protein.perKgUnit')}
        </Text>
        <View style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderColor: color }]}>
          <Text style={[styles.chipLabel, { color }]}>
            {t(`stats.protein.status.${props.status}`)}
          </Text>
        </View>
      </View>
      <Text style={[styles.target, { color: colors.textMuted }]}>{props.reference}</Text>
    </View>
  );
}

export function ProteinPerKgCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [window, setWindow] = useState<ProteinWindow>('7d');
  const { result, objective, hasWeight, isLoading } = useProteinPerKg(window);
  const carbs = useCarbsPerKg(window);

  /** Ligne glucides — rendue seulement si les 4 conditions du §2 sont réunies (le hook les résout). */
  const renderCarbs = () => {
    if (carbs.result == null || carbs.level == null) return null;
    const load = t(`stats.macrosPerKg.load.${carbs.level}`);
    const reference = t('stats.macrosPerKg.carbsReference', {
      min: fmt1(carbs.result.target.min),
      max: fmt1(carbs.result.target.max),
      load,
    });
    return (
      <>
        <MacroRow
          label={t('stats.macrosPerKg.carbs')}
          gPerKg={carbs.result.gPerKg}
          status={carbs.result.status}
          reference={reference}
          accessibilityLabel={`${t('stats.macrosPerKg.carbs')} ${fmt1(carbs.result.gPerKg)} ${t(
            'stats.protein.perKgUnit',
          )}, ${reference}, ${t(`stats.protein.status.${carbs.result.status}`)}`}
        />
        {carbs.dayKind !== 'unavailable' ? (
          <Text style={[styles.dayNote, { color: colors.text, backgroundColor: colors.surfaceAlt }]}>
            {t(`stats.macrosPerKg.day.${carbs.dayKind}`)}
          </Text>
        ) : null}
      </>
    );
  };

  const renderBody = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.accent} />
        </View>
      );
    }
    if (!hasWeight) {
      return <Text style={[styles.hint, { color: colors.textMuted }]}>{t('stats.protein.noWeight')}</Text>;
    }
    if (result == null) {
      return <Text style={[styles.hint, { color: colors.textMuted }]}>{t('stats.protein.noData')}</Text>;
    }
    const proteinReference = t('stats.protein.target', {
      min: fmt1(result.target.min),
      max: fmt1(result.target.max),
      objective: t(`stats.protein.objective.${objective}`),
    });
    return (
      <>
        <MacroRow
          label={t('stats.macrosPerKg.protein')}
          gPerKg={result.gPerKg}
          status={result.status}
          reference={proteinReference}
          accessibilityLabel={`${t('stats.macrosPerKg.protein')} ${fmt1(result.gPerKg)} ${t(
            'stats.protein.perKgUnit',
          )}, ${proteinReference}, ${t(`stats.protein.status.${result.status}`)}`}
        />
        {renderCarbs()}
      </>
    );
  };

  return (
    <>
      <Text style={[styles.section, { color: colors.textMuted }]}>{t('stats.macrosPerKg.title')}</Text>
      <Card>
        <Segment
          options={WINDOW_OPTIONS}
          value={window}
          onChange={setWindow}
          label={(o) => t(`stats.ranges.${o}`)}
        />
        {renderBody()}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: fontFamily.bodySemi, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  loadingRow: { paddingVertical: 16, alignItems: 'center' },
  hint: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 19 },
  macroRow: { marginTop: 10 },
  macroLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13, marginBottom: 2 },
  valueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  value: { fontFamily: fontFamily.displayBold, fontSize: 26, letterSpacing: -0.4 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  chipLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  target: { fontFamily: fontFamily.body, fontSize: 13, marginTop: 6 },
  dayNote: { fontFamily: fontFamily.body, fontSize: 12.5, marginTop: 12, paddingVertical: 9, paddingHorizontal: 11, borderRadius: 9, overflow: 'hidden' },
});
