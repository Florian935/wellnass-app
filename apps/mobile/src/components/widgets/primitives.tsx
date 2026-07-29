/**
 * Primitives visuelles des widgets multi-formes (galerie « FitTrio · Widgets »).
 *
 * Mini-graphes légers en `react-native-svg` — sans axes ni mesure de layout, pensés pour
 * tenir dans une cellule de widget et suivre l'accent dynamique du menu actif :
 *  - `RingGauge`  : anneau de progression (calories, temps) avec contenu centré ;
 *  - `Sparkline`  : courbe (poids, progression) + zone dégradée + point de fin optionnels ;
 *  - `MiniBars`   : mini-barres verticales (semaine running, volume) avec index mis en avant ;
 *  - `HBars`      : barres horizontales étiquetées (volume par groupe musculaire) ;
 *  - `WeekDots`   : bande de 7 jours (streak, planning) avec états.
 *
 * Purement présentationnels : aucune récupération de données, aucune chaîne en dur.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Polygon,
  Polyline,
  Stop,
} from 'react-native-svg';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { withAlpha } from '@/theme/color-utils';

/** Compteur d'ids uniques pour les dégradés SVG (évite les collisions entre instances). */
let gradientSeq = 0;
function nextGradientId(prefix: string): string {
  gradientSeq += 1;
  return `${prefix}-${gradientSeq}`;
}

// ---------------------------------------------------------------------------
// RingGauge — anneau de progression
// ---------------------------------------------------------------------------

export function RingGauge({
  size,
  stroke,
  pct,
  color,
  trackColor,
  milestones,
  children,
}: {
  /** Diamètre en px. */
  size: number;
  /** Épaisseur de l'anneau en px. */
  stroke: number;
  /** Progression 0–1 (bornée). */
  pct: number;
  /** Couleur de l'arc rempli (défaut : accent). */
  color?: string;
  /** Couleur de la piste (défaut : `track`). */
  trackColor?: string;
  /**
   * Repères visuels sur l'anneau, en fractions 0–1 (US OBJ-01 : 25 / 50 / 75 %).
   *
   * Dessinés en **couleur de fond**, donc lus comme des *encoches* qui découpent l'anneau : le
   * repère reste visible que la portion soit remplie ou non. Ce sont des **repères, pas des
   * récompenses** — aucune célébration n'y est attachée (arbitrage C, pas de gamification en V1).
   */
  milestones?: readonly number[];
  /** Contenu centré (chiffre + libellé). */
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const arc = Math.max(0, Math.min(1, Number.isFinite(pct) ? pct : 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const center = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={trackColor ?? colors.track}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={color ?? colors.accent}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - arc)}
          transform={`rotate(-90 ${center} ${center})`}
        />
        {(milestones ?? []).map((m) => {
          // L'arc démarre à 12 h et tourne dans le sens horaire, comme le `rotate(-90)` ci-dessus.
          const theta = (-90 + 360 * m) * (Math.PI / 180);
          const inner = r - stroke / 2;
          const outer = r + stroke / 2;
          return (
            <Line
              key={`ms-${m}`}
              x1={center + inner * Math.cos(theta)}
              y1={center + inner * Math.sin(theta)}
              x2={center + outer * Math.cos(theta)}
              y2={center + outer * Math.sin(theta)}
              stroke={colors.background}
              strokeWidth={2}
            />
          );
        })}
      </Svg>
      {children != null ? (
        <View style={[StyleSheet.absoluteFill, styles.ringCenter]}>{children}</View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sparkline — courbe normalisée
// ---------------------------------------------------------------------------

export function Sparkline({
  values,
  height,
  color,
  area = false,
  showDot = false,
  strokeWidth = 3,
}: {
  /** Série de valeurs (≥ 2 pour tracer). */
  values: number[];
  /** Hauteur en px (largeur = 100 % du conteneur). */
  height: number;
  color?: string;
  /** Ajoute une zone dégradée sous la courbe. */
  area?: boolean;
  /** Ajoute un point plein en fin de courbe. */
  showDot?: boolean;
  strokeWidth?: number;
}) {
  const { colors } = useTheme();
  const stroke = color ?? colors.accent;

  if (values.length < 2) {
    return <View style={{ height }} />;
  }

  // ViewBox normalisé 100×H, non-préservé pour s'étirer à la largeur du conteneur.
  const W = 100;
  const pad = strokeWidth; // marge verticale pour ne pas rogner la courbe
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = W / (values.length - 1);

  const pts = values.map((v, i) => {
    const x = i * stepX;
    const y = pad + (1 - (v - min) / span) * (height - 2 * pad);
    return { x, y };
  });
  const line = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const last = pts[pts.length - 1]!;
  const gradId = nextGradientId('spark');

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none">
      {area ? (
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={stroke} stopOpacity={0.22} />
            <Stop offset="1" stopColor={stroke} stopOpacity={0} />
          </LinearGradient>
        </Defs>
      ) : null}
      {area ? (
        <Polygon points={`${line} ${last.x},${height} 0,${height}`} fill={`url(#${gradId})`} />
      ) : null}
      <Polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {showDot ? <Circle cx={last.x} cy={last.y} r={4} fill={stroke} /> : null}
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// MiniBars — mini-barres verticales
// ---------------------------------------------------------------------------

export function MiniBars({
  values,
  height,
  color,
  trackColor,
  highlightIndex,
  labels,
}: {
  values: number[];
  height: number;
  /** Couleur des barres mises en avant (défaut : accent). Les autres utilisent `track`. */
  color?: string;
  trackColor?: string;
  /**
   * Index de la barre accentuée. `'max'` = la plus haute ; `'all'` = toutes ;
   * `undefined` = aucune (toutes en `track`). Un tableau = ces index précis.
   */
  highlightIndex?: number | number[] | 'max' | 'all';
  /** Étiquettes sous chaque barre (jours). */
  labels?: string[];
}) {
  const { colors } = useTheme();
  const accent = color ?? colors.accent;
  const track = trackColor ?? colors.track;
  const max = Math.max(1, ...values);

  const isHi = (i: number): boolean => {
    if (highlightIndex === 'all') return true;
    if (highlightIndex === 'max') return values[i] === Math.max(...values);
    if (Array.isArray(highlightIndex)) return highlightIndex.includes(i);
    return highlightIndex === i;
  };

  return (
    <View style={styles.barsRow}>
      {values.map((v, i) => (
        <View key={i} style={styles.barCol}>
          <View style={[styles.barTrack, { height }]}>
            <View
              style={{
                height: `${Math.max(4, (v / max) * 100)}%`,
                backgroundColor: isHi(i) ? accent : track,
                borderRadius: 5,
              }}
            />
          </View>
          {labels ? (
            <Text style={[styles.barLabel, { color: colors.textMuted }]}>{labels[i] ?? ''}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// HBars — barres horizontales étiquetées
// ---------------------------------------------------------------------------

export function HBars({
  rows,
}: {
  rows: { label: string; pct: number; value: string; color?: string }[];
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.hbars}>
      {rows.map((row, i) => (
        <View key={i} style={styles.hbarRow}>
          <Text style={[styles.hbarLabel, { color: colors.textMuted }]} numberOfLines={1}>
            {row.label}
          </Text>
          <View style={[styles.hbarTrack, { backgroundColor: colors.track }]}>
            <View
              style={{
                height: '100%',
                width: `${Math.max(0, Math.min(100, row.pct))}%`,
                backgroundColor: row.color ?? colors.accent,
                borderRadius: 7,
              }}
            />
          </View>
          <Text style={[styles.hbarValue, { color: colors.textMuted }]}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// WeekDots — bande de 7 jours
// ---------------------------------------------------------------------------

export type DayState = 'done' | 'rest' | 'today' | 'future' | 'empty';

export function WeekDots({
  days,
  tile = 30,
}: {
  days: { label: string; state: DayState; glyph?: string }[];
  /** Côté de la pastille en px. */
  tile?: number;
}) {
  const { colors } = useTheme();

  const bgFor = (s: DayState): string => {
    switch (s) {
      case 'done':
        return colors.accent;
      case 'rest':
        return withAlpha(colors.success, 0.22);
      case 'future':
        return colors.track;
      case 'today':
        return withAlpha(colors.accent, 0.14);
      default:
        return colors.surfaceAlt;
    }
  };

  return (
    <View style={styles.weekRow}>
      {days.map((d, i) => (
        <View key={i} style={styles.weekCol}>
          <View
            style={[
              styles.weekTile,
              { width: tile, height: tile, backgroundColor: bgFor(d.state) },
              d.state === 'today' && { borderWidth: 2, borderColor: colors.accent },
            ]}
          >
            {d.glyph ? (
              <Text style={[styles.weekGlyph, { fontSize: tile * 0.46 }]}>{d.glyph}</Text>
            ) : d.state === 'rest' ? (
              <Text style={[styles.weekRest, { color: colors.success, fontSize: tile * 0.4 }]}>
                R
              </Text>
            ) : null}
          </View>
          <Text
            style={[
              styles.weekLabel,
              { color: d.state === 'today' ? colors.accent : colors.textMuted },
              d.state === 'today' && styles.weekLabelToday,
            ]}
          >
            {d.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  // MiniBars
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, flex: 1 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { width: '100%', justifyContent: 'flex-end' },
  barLabel: { fontFamily: fontFamily.bodySemi, fontSize: 10 },
  // HBars
  hbars: { gap: 12 },
  hbarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hbarLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12, width: 58 },
  hbarTrack: { flex: 1, height: 12, borderRadius: 7, overflow: 'hidden' },
  hbarValue: { fontFamily: fontFamily.mono, fontSize: 12, width: 40, textAlign: 'right' },
  // WeekDots
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekCol: { alignItems: 'center', gap: 5 },
  weekTile: { borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  weekGlyph: { color: '#fff' },
  weekRest: { fontFamily: fontFamily.bodyBold },
  weekLabel: { fontFamily: fontFamily.bodySemi, fontSize: 10 },
  weekLabelToday: { fontFamily: fontFamily.bodyBold },
});
