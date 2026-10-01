/**
 * US LABO-03 — le graphique d'une fiche de lien.
 *
 * ── Les règles tenues ici ────────────────────────────────────────────────────────────────────────
 *  - **Jamais de double axe.** Deux mesures d'échelles différentes (protéines et force) sont deux
 *    panneaux alignés sur les mêmes semaines, chacun avec son échelle.
 *  - **Le repère est nommé, pas prescrit** (FUEL-01, APPORT-01) : une bande « ta fourchette », « zone
 *    saine », « repère pour ton volume » — jamais « objectif à atteindre ».
 *  - **Un point absent est un trou**, jamais un zéro : pas de barre, pas de segment de courbe.
 *  - **Une lecture accessible** : la ligne au-dessus du graphique dit en mots la semaine choisie ;
 *    le dessin est caché aux lecteurs d'écran, les colonnes touchables portent leur libellé.
 *
 * Le dessin se fait dans un repère de 326 de large, mis à l'échelle de la carte.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { CYCLE_PHASES, WELLBEING_LINK_THRESHOLDS, type CrossLinkChart as Chart } from '@wellness/shared';

import { dayMonth, formatDecimal, formatPace } from './lab-format';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const W = 326;
const COL = 36;
/** US BIEN-05 — combien de fois le seuil de bruit remplit une barre d'écart. */
const EFFECT_FULL_THRESHOLDS = 3;
const X0 = 30;
const colX = (i: number) => X0 + COL * (i + 0.5);

/** Le haut arrondi d'une barre, la base carrée (une barre part de son axe). */
function barPath(x: number, w: number, y: number, base: number): string {
  if (base - y < 0.5) return '';
  const r = Math.min(4, (base - y) / 2);
  return `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${base} Z`;
}

/** Une courbe qui saute les trous : un segment ne relie jamais deux semaines séparées par un vide. */
function linePath(points: ({ x: number; y: number } | null)[]): string {
  let d = '';
  let open = false;
  for (const p of points) {
    if (p === null) {
      open = false;
      continue;
    }
    d += `${open ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)} `;
    open = true;
  }
  return d.trim();
}

type Props = { chart: Chart };

export function CrossLinkChart({ chart }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const locale = i18n.language;
  const [width, setWidth] = useState(W);
  const [sel, setSel] = useState<number | null>(null);
  // Revue du 30/09/2026 — le tableau du cycle suit le système d'unités (une allure au mile en
  // impérial), comme le faisait l'ancien écran « Croisement ».
  const units = useUnits();
  const k = width / W;
  const dec = (v: number, digits = 1) => formatDecimal(v, locale, digits);
  const muted = colors.textMuted;
  const grid = colors.border;

  if (chart.type === 'phases') {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="lab-chart-phases">
        <View style={styles.head}>
          <Text style={[styles.overline, { color: colors.pillarLab }]}>{t('lab.fiche.chart.phasesTitle')}</Text>
          <Text style={[styles.hint, { color: muted }]}>{t('lab.fiche.chart.phasesHint')}</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={[styles.tableHeadCell, styles.tableFirst, { color: muted }]} />
          {CYCLE_PHASES.map((ph) => (
            <Text key={ph} style={[styles.tableHeadCell, { color: muted }]} numberOfLines={1}>
              {t(`cycle.phase.${ph}`)}
            </Text>
          ))}
        </View>
        {chart.metrics.map((m) => (
          <View key={m.metric} style={[styles.tableRow, { borderTopColor: grid, borderTopWidth: 1 }]}>
            <Text style={[styles.tableCell, styles.tableFirst, { color: colors.text }]}>{t(`cycle.insights.metrics.${m.metric}`)}</Text>
            {CYCLE_PHASES.map((ph) => {
              const v = m.byPhase[ph];
              const shown =
                m.metric === 'pace'
                  ? units.formatPace(v)
                  : m.metric === 'calories'
                    ? `${Math.round(v)} ${t('nutrition.kcal')}`
                    : m.metric === 'tonnage'
                      ? String(Math.round(v))
                      : dec(v);
              return (
                <Text key={ph} style={[styles.tableCell, styles.tableValue, { color: colors.text }]}>
                  {shown}
                </Text>
              );
            })}
          </View>
        ))}
      </View>
    );
  }

  // US BIEN-05 — les écarts des croisements Bien-être : une ligne par croisement, un axe zéro, l'écart
  // signé de part et d'autre, les cas de chaque côté. Pas de semaines ici : un écart se lit sur la
  // fenêtre entière (90 jours), une semaine n'a pas assez de nuits courtes pour en dire quoi que ce soit.
  if (chart.type === 'effects') {
    const unitText = (unit: string, delta: number) => {
      const digits = unit === 'points' ? 1 : 0;
      const abs = dec(Math.abs(delta), digits);
      const signed = delta > 0 ? `+${abs}` : delta < 0 ? `−${abs}` : abs;
      return t(`lab.fiche.chart.effectsUnit.${unit}`, { value: signed });
    };
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="lab-chart-effects">
        <View style={styles.head}>
          <Text style={[styles.overline, { color: colors.pillarWellbeing }]}>{t('lab.fiche.chart.effectsTitle')}</Text>
          <Text style={[styles.hint, { color: muted }]}>{t('lab.fiche.chart.effectsHint')}</Text>
        </View>
        {chart.items.map((item) => {
          // Des unités différentes (%, s/km, kcal) n'ont pas d'échelle commune : chaque barre est
          // rapportée au **seuil de bruit de son unité** (`WELLBEING_LINK_THRESHOLDS`). Un écart au seuil
          // remplit un tiers de la demi-piste, trois fois le seuil la remplit. Les longueurs se comparent
          // alors d'une ligne à l'autre : « combien au-dessus du bruit ».
          const width = Math.max(4, Math.min(100, (Math.abs(item.delta) / (EFFECT_FULL_THRESHOLDS * WELLBEING_LINK_THRESHOLDS[item.unit])) * 100));
          const tone = item.status === 'noLink' ? grid : item.adverse === true ? colors.amber : colors.pillarWellbeing;
          return (
            <View
              key={item.id}
              style={[styles.effectRow, { borderTopColor: grid }]}
              accessible
              accessibilityLabel={t('lab.fiche.chart.effectsA11y', {
                label: t(`lab.fiche.chart.effects.${item.id}`),
                value: unitText(item.unit, item.delta),
                exposed: item.exposed,
                other: item.other,
              })}
            >
              <View style={styles.effectHead}>
                <Text style={[styles.effectLabel, { color: colors.text }]}>{t(`lab.fiche.chart.effects.${item.id}`)}</Text>
                <Text style={[styles.effectValue, { color: colors.text }]}>
                  {item.status === 'noLink' ? t('lab.fiche.chart.effectsNone') : unitText(item.unit, item.delta)}
                </Text>
              </View>
              <View style={styles.effectTrack}>
                <View style={[styles.effectHalf, { alignItems: 'flex-end' }]}>
                  {item.delta < 0 ? <View testID={`lab-effect-bar-${item.id}`} style={[styles.effectBar, { width: `${width}%`, backgroundColor: tone }]} /> : null}
                </View>
                <View style={[styles.effectAxis, { backgroundColor: colors.text }]} />
                <View style={styles.effectHalf}>
                  {item.delta > 0 ? <View testID={`lab-effect-bar-${item.id}`} style={[styles.effectBar, { width: `${width}%`, backgroundColor: tone }]} /> : null}
                </View>
              </View>
              <Text style={[styles.hint, { color: muted }]}>{t('lab.fiche.chart.effectsCases', { exposed: item.exposed, other: item.other })}</Text>
            </View>
          );
        })}
      </View>
    );
  }

  const weeks = 'weeks' in chart ? chart.weeks : [];
  const s = sel ?? weeks.length - 1;
  const weekLabel = (i: number) => (weeks[i] === undefined ? '' : dayMonth(weeks[i]!));
  const noValue = t('lab.fiche.chart.noValue');
  const xLabels = [0, 2, 4, 6, 7].filter((i) => i < weeks.length);

  let height = 176;
  let overline = '';
  let hint = '';
  let readout = '';
  let note: string | null = null;
  let body: React.ReactNode = null;
  let columns: { label: string }[] = [];

  if (chart.type === 'pair') {
    height = 252;
    overline = t('lab.fiche.chart.overline');
    hint = t('lab.fiche.chart.hintWeek');
    note = t('lab.fiche.chart.pairNote');
    const protein = chart.protein;
    const lift = chart.lift.values;
    const aMax = Math.max(chart.band[1] + 0.2, ...protein.filter((v): v is number => v !== null));
    const yA = (v: number) => 110 - (v / aMax) * 80;
    const liftVals = lift.filter((v): v is number => v !== null);
    const bMin = Math.floor((Math.min(...liftVals) - 5) / 5) * 5;
    const bMax = Math.ceil((Math.max(...liftVals) + 5) / 5) * 5;
    const yB = (v: number) => 226 - ((v - bMin) / Math.max(1, bMax - bMin)) * 74;
    const pv = protein[s];
    const lv = lift[s];
    readout = t('lab.fiche.chart.pairReadout', {
      week: weekLabel(s),
      protein: pv === null || pv === undefined ? noValue : dec(pv),
      lift: lv === null || lv === undefined ? noValue : String(lv),
    });
    columns = weeks.map((_, i) => ({
      label: t('lab.fiche.chart.pairReadout', {
        week: weekLabel(i),
        protein: protein[i] === null ? noValue : dec(protein[i]!),
        lift: lift[i] === null ? noValue : String(lift[i]),
      }),
    }));
    const plateauX = chart.lift.plateauFrom === null ? null : X0 + COL * chart.lift.plateauFrom;
    body = (
      <>
        <Circle cx={33} cy={10} r={4} fill={colors.pillarNutrition} />
        <SvgText x={41} y={13.5} fontSize={9.5} fontWeight="700" fill={muted}>
          {t('lab.fiche.chart.proteinTitle').toUpperCase()}
        </SvgText>
        <Rect x={X0} y={yA(chart.band[1])} width={W - X0 - 8} height={yA(chart.band[0]) - yA(chart.band[1])} fill={colors.pillarNutrition} fillOpacity={0.12} />
        <SvgText x={W - 10} y={yA(chart.band[1]) + 11} fontSize={9.5} fontWeight="600" fill={muted} textAnchor="end">
          {t('lab.fiche.chart.band', { min: dec(chart.band[0]), max: dec(chart.band[1]) })}
        </SvgText>
        <Line x1={X0} y1={110} x2={W - 8} y2={110} stroke={grid} strokeWidth={1} />
        <SvgText x={25} y={113} fontSize={9} fill={muted} textAnchor="end">
          0
        </SvgText>
        {protein.map((v, i) =>
          v === null ? null : <Path key={i} d={barPath(colX(i) - 9, 18, yA(v), 110)} fill={colors.pillarNutrition} fillOpacity={i === s ? 1 : 0.6} />,
        )}
        <Circle cx={33} cy={134} r={4} fill={colors.pillarStrength} />
        <SvgText x={41} y={137.5} fontSize={9.5} fontWeight="700" fill={muted}>
          {t('lab.fiche.chart.liftTitle', { name: chart.lift.name }).toUpperCase()}
        </SvgText>
        {plateauX !== null ? (
          <>
            <Rect x={plateauX} y={146} width={W - 8 - plateauX} height={82} fill={colors.amber} fillOpacity={0.14} />
            <SvgText x={W - 10} y={158} fontSize={9.5} fontWeight="600" fill={colors.warnText} textAnchor="end">
              {t('lab.fiche.chart.plateau')}
            </SvgText>
          </>
        ) : null}
        {[bMin, bMax].map((g) => (
          <SvgText key={g} x={25} y={yB(g) + 3} fontSize={9} fill={muted} textAnchor="end">
            {String(g)}
          </SvgText>
        ))}
        <Path d={linePath(lift.map((v, i) => (v === null ? null : { x: colX(i), y: yB(v) })))} fill="none" stroke={colors.pillarStrength} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {lift.map((v, i) =>
          v === null ? null : <Circle key={i} cx={colX(i)} cy={yB(v)} r={i === s ? 5.5 : 4} fill={colors.pillarStrength} stroke={colors.surface} strokeWidth={2} />,
        )}
        <Line x1={colX(s)} y1={20} x2={colX(s)} y2={228} stroke={colors.text} strokeOpacity={0.25} strokeWidth={1} />
      </>
    );
  }

  if (chart.type === 'split') {
    height = 180;
    overline = t('lab.fiche.chart.splitTitle');
    hint = t('lab.fiche.chart.splitHint');
    note = t('lab.fiche.chart.splitNote');
    const all = [...chart.exposed, ...chart.other];
    const lo = Math.floor((Math.min(...all) - 3) / 5) * 5;
    const hi = Math.ceil((Math.max(...all) + 3) / 5) * 5;
    const xs = (v: number) => 24 + ((v - lo) / Math.max(1, hi - lo)) * 286;
    const mean = (xs2: number[]) => xs2.reduce((a, b) => a + b, 0) / xs2.length;
    const mE = mean(chart.exposed);
    const mO = mean(chart.other);
    const delta = Math.round(mE - mO);
    readout = t('lab.fiche.chart.splitReadout', { delta: delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : '0', exposed: chart.exposed.length, other: chart.other.length });
    const rows = [
      { label: t('lab.fiche.chart.splitExposed'), vals: chart.exposed, y: 58, m: mE },
      { label: t('lab.fiche.chart.splitOther'), vals: chart.other, y: 124, m: mO },
    ];
    const ticks: number[] = [];
    for (let v = lo; v <= hi; v += 5) ticks.push(v);
    body = (
      <>
        {rows.map((r) => {
          const seen = new Map<number, number>();
          return (
            <G key={r.label}>
              <SvgText x={24} y={r.y - 20} fontSize={11.5} fontWeight="700" fill={colors.text}>
                {r.label}
              </SvgText>
              <SvgText x={310} y={r.y - 20} fontSize={10} fontWeight="700" fill={colors.text} textAnchor="end">
                {t('lab.fiche.chart.splitMean', { pace: formatPace(r.m) })}
              </SvgText>
              <Line x1={24} y1={r.y} x2={310} y2={r.y} stroke={grid} strokeWidth={1} />
              {r.vals.map((v, i) => {
                const n = seen.get(v) ?? 0;
                seen.set(v, n + 1);
                return <Circle key={i} cx={xs(v)} cy={r.y + (n === 0 ? 0 : n % 2 ? 7 : -7)} r={5} fill={colors.pillarRunning} fillOpacity={0.85} stroke={colors.surface} strokeWidth={2} />;
              })}
              <Line x1={xs(r.m)} y1={r.y - 13} x2={xs(r.m)} y2={r.y + 13} stroke={colors.text} strokeWidth={2} strokeLinecap="round" />
            </G>
          );
        })}
        <Line x1={24} y1={158} x2={310} y2={158} stroke={grid} strokeWidth={1} />
        {ticks.map((v) => (
          <SvgText key={v} x={xs(v)} y={172} fontSize={9} fill={muted} textAnchor="middle">
            {formatPace(v)}
          </SvgText>
        ))}
      </>
    );
  }

  if (chart.type === 'groups') {
    height = 180;
    overline = t('lab.fiche.chart.groupsTitle');
    hint = t('lab.fiche.chart.groupsHint');
    readout = t('lab.fiche.chart.groupsReadout', { hard: dec(chart.hard), easy: dec(chart.easy) });
    const top = Math.max(8, chart.band[1] + 1, chart.hard + 1, chart.easy + 1);
    const ys = (v: number) => 140 - (v / top) * 120;
    const bars = [
      { label: t('lab.fiche.chart.groupsHard'), v: chart.hard, n: t('lab.fiche.chart.groupsDays', { count: chart.hardDays }), cx: 125 },
      { label: t('lab.fiche.chart.groupsEasy'), v: chart.easy, n: t('lab.fiche.chart.groupsDays', { count: chart.easyDays }), cx: 235 },
    ];
    body = (
      <>
        <Rect x={40} y={ys(chart.band[1])} width={278} height={ys(chart.band[0]) - ys(chart.band[1])} fill={colors.pillarNutrition} fillOpacity={0.12} />
        <SvgText x={316} y={ys(chart.band[1]) - 4} fontSize={9.5} fontWeight="600" fill={muted} textAnchor="end">
          {t('lab.fiche.chart.groupsBand', { min: dec(chart.band[0]), max: dec(chart.band[1]) })}
        </SvgText>
        <Line x1={40} y1={140} x2={318} y2={140} stroke={grid} strokeWidth={1} />
        {bars.map((b) => (
          <G key={b.label}>
            <Path d={barPath(b.cx - 12, 24, ys(b.v), 140)} fill={colors.pillarNutrition} />
            <SvgText x={b.cx} y={ys(b.v) - 7} fontSize={12} fontWeight="700" fill={colors.text} textAnchor="middle">
              {dec(b.v)}
            </SvgText>
            <SvgText x={b.cx} y={156} fontSize={11.5} fontWeight="700" fill={colors.text} textAnchor="middle">
              {b.label}
            </SvgText>
            <SvgText x={b.cx} y={170} fontSize={10.5} fill={muted} textAnchor="middle">
              {b.n}
            </SvgText>
          </G>
        ))}
      </>
    );
  }

  if (chart.type === 'band' || chart.type === 'line') {
    const values = chart.values;
    const present = values.filter((v): v is number => v !== null);
    const isBand = chart.type === 'band';
    height = isBand ? 178 : 162;
    overline = isBand ? t('lab.fiche.chart.bandTitle') : chart.metric === 'weightKg' ? t('lab.fiche.chart.weightTitle') : t('lab.fiche.chart.sbdTitle');
    hint = t('lab.fiche.chart.hintWeek');
    const lo = isBand ? 0.6 : Math.floor(Math.min(...present) - 1);
    const hi = isBand ? Math.max(1.6, ...present.map((v) => v + 0.1)) : Math.ceil(Math.max(...present) + 1);
    const top = 16;
    const base = isBand ? 152 : 136;
    const ys = (v: number) => base - ((v - lo) / Math.max(0.01, hi - lo)) * (base - top);
    const color = isBand ? colors.pillarLab : chart.type === 'line' && chart.metric === 'sbdTotal' ? colors.pillarStrength : colors.text;
    const fmt = (v: number) => (isBand ? dec(v, 2) : chart.type === 'line' && chart.metric === 'weightKg' ? `${dec(v)} kg` : `${Math.round(v)} kg`);
    const v = values[s];
    readout = t(isBand ? 'lab.fiche.chart.bandReadout' : 'lab.fiche.chart.lineReadout', { week: weekLabel(s), value: v === null || v === undefined ? noValue : fmt(v) });
    columns = weeks.map((_, i) => ({
      label: t(isBand ? 'lab.fiche.chart.bandReadout' : 'lab.fiche.chart.lineReadout', { week: weekLabel(i), value: values[i] === null ? noValue : fmt(values[i]!) }),
    }));
    body = (
      <>
        {isBand ? (
          <>
            <Rect x={X0} y={ys(1.3)} width={W - X0 - 8} height={ys(0.8) - ys(1.3)} fill={colors.pillarLab} fillOpacity={0.1} />
            <SvgText x={X0 + 6} y={ys(0.8) - 5} fontSize={9.5} fontWeight="600" fill={muted}>
              {t('lab.fiche.chart.bandZone')}
            </SvgText>
            <Line x1={X0} y1={ys(1.3)} x2={W - 8} y2={ys(1.3)} stroke={colors.danger} strokeWidth={1.2} strokeDasharray="4 3" />
            <SvgText x={W - 10} y={ys(1.3) - 4} fontSize={9.5} fontWeight="600" fill={colors.danger} textAnchor="end">
              {t('lab.fiche.chart.bandLimit')}
            </SvgText>
            {[0.8, 1.0, 1.3].map((g) => (
              <SvgText key={g} x={25} y={ys(g) + 3} fontSize={9} fill={muted} textAnchor="end">
                {dec(g, 1)}
              </SvgText>
            ))}
          </>
        ) : (
          [lo + 1, hi - 1].map((g) => (
            <G key={g}>
              <Line x1={X0} y1={ys(g)} x2={W - 8} y2={ys(g)} stroke={grid} strokeWidth={1} />
              <SvgText x={25} y={ys(g) + 3} fontSize={9} fill={muted} textAnchor="end">
                {String(g)}
              </SvgText>
            </G>
          ))
        )}
        <Path d={linePath(values.map((val, i) => (val === null ? null : { x: colX(i), y: ys(val) })))} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {values.map((val, i) =>
          val === null ? null : <Circle key={i} cx={colX(i)} cy={ys(val)} r={i === s ? 5.5 : 4} fill={color} stroke={colors.surface} strokeWidth={2} />,
        )}
        <Line x1={colX(s)} y1={top} x2={colX(s)} y2={base} stroke={colors.text} strokeOpacity={0.25} strokeWidth={1} />
      </>
    );
  }

  if (chart.type === 'grid') {
    overline = t('lab.fiche.chart.gridTitle');
    hint = t('lab.fiche.chart.gridHint');
    height = 20 + chart.rows.length * 34;
    const tone = { strength: colors.pillarStrength, running: colors.pillarRunning, nutrition: colors.pillarNutrition };
    readout = t('lab.fiche.chart.gridReadout', {
      week: weekLabel(weeks.length - 1),
      summary: chart.rows.map((r) => `${t(`lab.fiche.chart.gridRow.${r.pillar}`)} ${r.values[r.values.length - 1] ?? noValue}`).join(' · '),
    });
    body = (
      <>
        {chart.rows.map((r, ri) => {
          const y = 4 + ri * 34;
          return (
            <G key={r.pillar}>
              <SvgText x={0} y={y + 17} fontSize={11.5} fontWeight="700" fill={colors.text}>
                {t(`lab.fiche.chart.gridRow.${r.pillar}`)}
              </SvgText>
              {r.values.map((v, i) => {
                const op = v === null ? 0 : 0.14 + 0.86 * Math.min(1, v / 7);
                return (
                  <G key={i}>
                    <Rect x={62 + i * 32} y={y} width={28} height={26} rx={6} fill={tone[r.pillar]} fillOpacity={op} stroke={v === null ? grid : 'none'} strokeDasharray={v === null ? '3 3' : undefined} />
                    <SvgText x={76 + i * 32} y={y + 17} fontSize={10} fontWeight="700" fill={op > 0.55 ? '#ffffff' : colors.text} textAnchor="middle">
                      {v === null ? '' : String(v)}
                    </SvgText>
                  </G>
                );
              })}
            </G>
          );
        })}
      </>
    );
  }

  const gridChart = chart.type === 'grid';
  const labelsY = height - 4;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} testID={`lab-chart-${chart.type}`}>
      <View style={styles.head}>
        <Text style={[styles.overline, { color: colors.pillarLab }]}>{overline.toUpperCase()}</Text>
        <Text style={[styles.hint, { color: muted }]}>{hint}</Text>
      </View>
      <Text style={[styles.readout, { color: colors.text }]} accessibilityLiveRegion="polite">
        {readout}
      </Text>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <Svg width={width} height={(height + (weeks.length > 0 ? 12 : 0)) * k} viewBox={`0 0 ${W} ${height + (weeks.length > 0 ? 12 : 0)}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {body}
          {xLabels.map((i) => (
            <SvgText key={i} x={gridChart ? 76 + i * 32 : colX(i)} y={labelsY + 12} fontSize={9} fill={muted} textAnchor="middle">
              {weekLabel(i)}
            </SvgText>
          ))}
        </Svg>
        {columns.map((c, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={c.label}
            onPress={() => setSel(i)}
            style={[styles.col, { left: (X0 + COL * i) * k, width: COL * k }]}
          />
        ))}
      </View>
      {note !== null ? <Text style={[styles.note, { color: muted }]}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, padding: 16, gap: 8 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  overline: { fontFamily: fontFamily.monoBold, fontSize: 11, letterSpacing: 1.4 },
  hint: { fontFamily: fontFamily.body, fontSize: 11.5 },
  // US BIEN-05 — le graphique des écarts.
  effectRow: { borderTopWidth: 1, paddingTop: 10, marginTop: 10, gap: 6 },
  effectHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  effectLabel: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 13 },
  effectValue: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  effectTrack: { flexDirection: 'row', alignItems: 'center', height: 14 },
  effectHalf: { flex: 1, height: 10, justifyContent: 'center' },
  effectBar: { height: 10, borderRadius: 5 },
  effectAxis: { width: 2, height: 14, opacity: 0.5 },
  readout: { fontFamily: fontFamily.bodySemi, fontSize: 13.5, minHeight: 19 },
  note: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17 },
  col: { position: 'absolute', top: 0, bottom: 0 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  tableHeadCell: { flex: 1, fontFamily: fontFamily.monoBold, fontSize: 9.5, textAlign: 'center' },
  tableCell: { flex: 1, fontFamily: fontFamily.body, fontSize: 12.5 },
  tableFirst: { flex: 1.6, textAlign: 'left' },
  tableValue: { fontFamily: fontFamily.monoBold, textAlign: 'center' },
});
