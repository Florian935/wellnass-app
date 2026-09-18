/**
 * US RESERV-01 — la carte « Réservoir » (spec §3, §9).
 *
 * Ne rend **rien** sans poids connu (R9) : une capacité inventée vaudrait moins que rien.
 *
 * ⚠️ **Estimation, pas mesure** : la mention est permanente, et le bouton « Pourquoi ? » (DASH-01)
 * ouvre la chaîne de calcul. C'est la règle « preuve avant promesse » du carnet d'innovation.
 *
 * ⚠️ **Descriptif, jamais prescriptif** (D6) : « ton fractionné démarrerait à 24 % », jamais « tu dois
 * manger ». Même ton que FUEL-01.
 */

import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/Card';
import { ExplainButton } from '@/components/explain/ExplainButton';
import { ExplainSheet } from '@/components/explain/ExplainSheet';
import { lowZoneG, useFuelTank } from '@/data/repositories/fuel-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import type { FuelPoint } from '@wellness/shared';

const CHART_W = 300;
const CHART_H = 96;

/** Courbe → tracé SVG. Les heures occupent toute la largeur, les grammes toute la hauteur. */
export function buildPath(points: readonly FuelPoint[], capacityG: number): string {
  if (points.length === 0 || capacityG <= 0) return '';
  return points
    .map((p, i) => {
      const x = (p.hour / 24) * CHART_W;
      const y = CHART_H - (Math.min(p.grams, capacityG) / capacityG) * CHART_H;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

/** Heure décimale → « 18 h 30 » / « 18:30 », selon la langue. */
export function formatHour(hour: number, language: string): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return language.startsWith('fr') ? `${h} h ${mm}` : `${hh}:${mm}`;
}

export function FuelTankCard({ dayKey, atHour }: { dayKey: string; atHour: number }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { tank } = useFuelTank(dayKey, atHour);
  // §6.1 de DASH-01 : la feuille « Pourquoi ? », ouverte à la demande.
  const [explaining, setExplaining] = useState(false);

  if (tank === null) return null;

  const percent = Math.round(tank.nowShare * 100);
  const lowG = lowZoneG(tank.capacityG);
  const lowY = CHART_H - (lowG / tank.capacityG) * CHART_H;
  const nowX = (atHour / 24) * CHART_W;

  // Équivalent textuel de la courbe (spec §9) : niveau, minimum projeté et son heure.
  const a11y = t('nutrition.fuelTank.a11y', {
    percent: String(percent),
    lowest: String(Math.round((tank.lowest.grams / tank.capacityG) * 100)),
    hour: formatHour(tank.lowest.hour, i18n.language),
  });

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.headerTexts}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('nutrition.fuelTank.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('nutrition.fuelTank.subtitle')}
          </Text>
        </View>
        <ExplainButton
          onPress={() => setExplaining(true)}
          color={colors.textMuted}
          subject={t('nutrition.fuelTank.title')}
        />
      </View>

      <View accessible accessibilityLabel={a11y} style={styles.gaugeRow}>
        <View style={[styles.tank, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <View
            style={[
              styles.liquid,
              { height: `${Math.max(0, Math.min(100, percent))}%`, backgroundColor: colors.chartGreen },
            ]}
          />
        </View>
        <View style={styles.figures}>
          <Text style={[styles.level, { color: colors.text }]} maxFontSizeMultiplier={1.4}>
            {t('nutrition.fuelTank.level', { percent: String(percent) })}
          </Text>
          <Text style={[styles.grams, { color: colors.textMuted }]}>
            {t('nutrition.fuelTank.grams', {
              grams: String(Math.round(tank.nowG)),
              capacity: String(tank.capacityG),
            })}
          </Text>
          <View style={[styles.chip, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.chipText, { color: colors.accent }]}>
              {t('nutrition.fuelTank.estimate')}
            </Text>
          </View>
        </View>
      </View>

      <Svg width={CHART_W} height={CHART_H} style={styles.chart}>
        {/* Zone basse : une bande, doublée par le texte de l'action — jamais la couleur seule. */}
        <Rect x={0} y={lowY} width={CHART_W} height={CHART_H - lowY} fill={colors.track} />
        <Line x1={0} y1={lowY} x2={CHART_W} y2={lowY} stroke={colors.accent} strokeWidth={1} strokeDasharray="3 3" />
        {tank.curveWithSnack ? (
          <Path
            d={buildPath(tank.curveWithSnack, tank.capacityG)}
            stroke={colors.chartGreen}
            strokeWidth={2}
            strokeDasharray="4 4"
            fill="none"
          />
        ) : null}
        <Path d={buildPath(tank.curve, tank.capacityG)} stroke={colors.chartGreen} strokeWidth={2.5} fill="none" />
        <Line x1={nowX} y1={0} x2={nowX} y2={CHART_H} stroke={colors.text} strokeWidth={1} />
      </Svg>

      {tank.mealsCount === 0 ? (
        <Text style={[styles.note, { color: colors.textMuted }]}>
          {t('nutrition.fuelTank.noMeal')}
        </Text>
      ) : null}

      {tank.snackG !== null && tank.nextSessionHour !== null ? (
        <View style={[styles.action, { backgroundColor: colors.panel }]}>
          <Text style={[styles.actionTitle, { color: colors.panelText }]}>
            {t('nutrition.fuelTank.action.title', { grams: String(tank.snackG) })}
          </Text>
          <Text style={[styles.actionBody, { color: colors.panelMuted }]}>
            {t('nutrition.fuelTank.action.body', {
              time: formatHour(tank.nextSessionHour, i18n.language),
              percent: String(Math.round((tank.lowest.grams / tank.capacityG) * 100)),
            })}
          </Text>
          <View style={styles.actionHint}>
            <Ionicons name="nutrition-outline" size={14} color={colors.panelAccent} />
            <Text style={[styles.actionHintText, { color: colors.panelAccent }]}>
              {t('nutrition.fuelTank.action.hint')}
            </Text>
          </View>
        </View>
      ) : null}
      <ExplainSheet
        visible={explaining}
        title={t('nutrition.fuelTank.level', { percent: String(percent) })}
        explanation={tank.explanation}
        // Toutes les étapes sont des grammes : on le dit, plutôt que de laisser un entier nu.
        formatValue={(step) =>
          step.value == null ? null : t('nutrition.fuelTank.gramsUnit', { grams: String(step.value) })
        }
        onClose={() => setExplaining(false)}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headerTexts: { flex: 1, gap: 1 },
  title: { fontFamily: fontFamily.displaySemi, fontSize: 17, letterSpacing: -0.3 },
  subtitle: { fontFamily: fontFamily.body, fontSize: 13 },
  gaugeRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  // Pas de hauteur figée sur les textes : la carte grandit avec la police système (recette à 1,5×).
  tank: {
    width: 56,
    height: 84,
    borderWidth: 2,
    borderRadius: 18,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  liquid: { width: '100%' },
  figures: { flex: 1, gap: 2 },
  level: { fontFamily: fontFamily.displayXBold, fontSize: 30, letterSpacing: -1 },
  grams: { fontFamily: fontFamily.mono, fontSize: 12 },
  chip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginTop: 4 },
  chipText: { fontFamily: fontFamily.bodyBold, fontSize: 10.5, letterSpacing: 0.6 },
  chart: { marginTop: 12, alignSelf: 'center' },
  note: { fontFamily: fontFamily.body, fontSize: 13, marginTop: 8 },
  action: { borderRadius: 18, padding: 14, marginTop: 12, gap: 4 },
  actionTitle: { fontFamily: fontFamily.displaySemi, fontSize: 16, letterSpacing: -0.3 },
  actionBody: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  actionHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  actionHintText: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
});
