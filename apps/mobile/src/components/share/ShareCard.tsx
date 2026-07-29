/**
 * US PARTAGE-01 — la carte partageable elle-même (course ou séance).
 *
 * ── Une seule vue, deux usages ────────────────────────────────────────────────────────────────────
 * Ce composant est à la fois **l'aperçu à l'écran** et **la source de la capture**. Tout est
 * dimensionné **proportionnellement à `size`** : dessinée à 320 dp elle sert d'aperçu, capturée à
 * 1080 px elle donne l'image partagée, sans deuxième mise en page à maintenir.
 *
 * ── Le tracé est du SVG, pas une capture de carte (décision D5) ──────────────────────────────────
 * `RouteMap` repose sur **MapLibre natif**, et capturer une vue native de carte donne une image
 * **noire ou vide**. Le tracé est donc reprojeté par `projectTrack` (@wellness/shared, 21 tests).
 * Bénéfice collatéral : aucune tuile à télécharger, donc **aucune clé MapTiler et aucun réseau**.
 *
 * ── Ce que la carte ne montre JAMAIS (décision D7) ───────────────────────────────────────────────
 * Ni poids, ni mensuration, ni indicateur de bien-être. Ce sont des données de santé, et une image
 * partie sur un réseau public ne se rattrape pas. Uniquement de l'activité.
 */

import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  formatDayFull,
  isDrawableTrack,
  projectTrack,
  sampleTrack,
  SHARE_CARD_SIZE,
  trackPath,
  type TrackPoint,
} from '@wellness/shared';

import { fontFamily } from '@/theme/fonts';

/** Charte de la carte : bordeaux + doré, comme le bandeau de célébration du résumé de course. */
const CARD_BG = '#6b0028';
const CARD_ACCENT = '#c9a96e';
const CARD_TEXT = '#fdf6ec';
const CARD_MUTED = '#d9b9c4';

/** Nom affiché en pied de carte (décision D2 : discret, mais présent). */
const BRAND = 'Wellness';

export type ShareCardData =
  | {
      kind: 'run';
      /** Points GPS décodés. Vide ou dégénéré → carte sans tracé. */
      points: TrackPoint[];
      startedAtMs: number;
      /** Chiffres **déjà formatés** dans les unités de l'utilisateur. */
      stats: { distance: string; duration: string; pace: string };
    }
  | {
      kind: 'workout';
      startedAtMs: number;
      stats: { exercises: number; sets: number; volume: string; duration: string };
      /** Libellés des records battus. Vide → aucune section records (pas de section vide). */
      records: string[];
    };

type Props = {
  data: ShareCardData;
  /** Côté de la carte en points logiques. La capture demande 1080 px indépendamment. */
  size: number;
};

/**
 * `forwardRef` : `captureRef` a besoin d'une référence sur la **vue racine** de la carte.
 */
export const ShareCard = forwardRef<View, Props>(function ShareCard({ data, size }, ref) {
  const { t } = useTranslation();

  // Toutes les dimensions dérivent de `size` : une seule mise en page pour l'aperçu et la capture.
  const pad = size * 0.075;
  const s = (ratio: number): number => Math.round(size * ratio);

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.card, { width: size, height: size, padding: pad, backgroundColor: CARD_BG }]}
    >
      <View style={styles.header}>
        <Text
          style={[styles.title, { color: CARD_ACCENT, fontSize: s(0.042) }]}
          maxFontSizeMultiplier={1}
          numberOfLines={1}
        >
          {t(`share.${data.kind}.title`).toUpperCase()}
        </Text>
        <Text
          style={[styles.date, { color: CARD_MUTED, fontSize: s(0.032) }]}
          maxFontSizeMultiplier={1}
        >
          {formatDayFull(new Date(data.startedAtMs).toISOString())}
        </Text>
      </View>

      <View style={styles.body}>
        {data.kind === 'run' ? (
          <RunBody points={data.points} size={size} />
        ) : (
          <WorkoutBody records={data.records} size={size} />
        )}
      </View>

      {/* Les chiffres : c'est le contenu, jamais une décoration. */}
      <View style={styles.stats}>
        {data.kind === 'run' ? (
          <>
            <Stat value={data.stats.distance} label={t('share.run.distance')} size={size} big />
            <Stat value={data.stats.duration} label={t('share.run.duration')} size={size} />
            <Stat value={data.stats.pace} label={t('share.run.pace')} size={size} />
          </>
        ) : (
          <>
            <Stat value={data.stats.volume} label={t('share.workout.volume')} size={size} big />
            <Stat
              value={String(data.stats.exercises)}
              label={t('share.workout.exercises')}
              size={size}
            />
            <Stat value={String(data.stats.sets)} label={t('share.workout.sets')} size={size} />
            <Stat value={data.stats.duration} label={t('share.workout.duration')} size={size} />
          </>
        )}
      </View>

      <Text
        style={[styles.brand, { color: CARD_MUTED, fontSize: s(0.026) }]}
        maxFontSizeMultiplier={1}
      >
        {BRAND}
      </Text>
    </View>
  );
});

/** Tracé de la course, ou rien du tout si le tracé n'est pas dessinable. */
function RunBody({ points, size }: { points: TrackPoint[]; size: number }) {
  // Pas de tracé exploitable (course manuelle, GPS bloqué) → on n'affiche RIEN plutôt qu'un artefact
  // d'un pixel. Les chiffres portent alors seuls la carte.
  if (!isDrawableTrack(points)) return null;

  // Le viewBox est en unités 1080 : la projection est calculée une fois pour toutes, et le SVG met à
  // l'échelle. C'est ce qui rend l'aperçu et la capture identiques au pixel près.
  const box = SHARE_CARD_SIZE;
  const projected = projectTrack(sampleTrack(points), {
    width: box,
    height: box * 0.62,
    padding: box * 0.06,
  });
  const d = trackPath(projected);
  const last = projected[projected.length - 1];

  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${box} ${box * 0.62}`}>
      <Path
        d={d}
        stroke={CARD_ACCENT}
        strokeWidth={box * 0.011}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Point d'arrivée : repère de lecture du sens du parcours. */}
      {last !== undefined && (
        <Circle cx={last.x} cy={last.y} r={box * 0.016} fill={CARD_TEXT} />
      )}
    </Svg>
  );
}

/** Records battus, ou rien : une séance sans record n'affiche pas de section vide. */
function WorkoutBody({ records, size }: { records: string[]; size: number }) {
  const { t } = useTranslation();
  const s = (ratio: number): number => Math.round(size * ratio);

  if (records.length === 0) return null;

  return (
    <View style={styles.records}>
      <Text
        style={[styles.recordsTitle, { color: CARD_ACCENT, fontSize: s(0.034) }]}
        maxFontSizeMultiplier={1}
      >
        {t('share.workout.records')}
      </Text>
      {/* Trois au maximum : au-delà, la carte devient une liste illisible. */}
      {records.slice(0, 3).map((record) => (
        <Text
          key={record}
          style={[styles.recordLine, { color: CARD_TEXT, fontSize: s(0.038) }]}
          numberOfLines={1}
          maxFontSizeMultiplier={1}
        >
          {record}
        </Text>
      ))}
    </View>
  );
}

function Stat({
  value,
  label,
  size,
  big = false,
}: {
  value: string;
  label: string;
  size: number;
  big?: boolean;
}) {
  const s = (ratio: number): number => Math.round(size * ratio);
  return (
    <View style={styles.stat}>
      <Text
        style={[styles.statValue, { color: CARD_TEXT, fontSize: s(big ? 0.082 : 0.05) }]}
        numberOfLines={1}
        maxFontSizeMultiplier={1}
      >
        {value}
      </Text>
      <Text
        style={[styles.statLabel, { color: CARD_MUTED, fontSize: s(0.024) }]}
        numberOfLines={1}
        maxFontSizeMultiplier={1}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { justifyContent: 'space-between', overflow: 'hidden' },
  header: { gap: 2 },
  title: { fontFamily: fontFamily.displayBold, letterSpacing: 1.5 },
  date: { fontFamily: fontFamily.body },
  body: { flex: 1, justifyContent: 'center' },
  records: { gap: 4 },
  recordsTitle: { fontFamily: fontFamily.bodySemi, letterSpacing: 1 },
  recordLine: { fontFamily: fontFamily.displayBold },
  stats: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' },
  stat: { gap: 1 },
  statValue: { fontFamily: fontFamily.displayBold },
  statLabel: { fontFamily: fontFamily.bodySemi, letterSpacing: 0.8 },
  brand: { fontFamily: fontFamily.bodySemi, letterSpacing: 1.2, textAlign: 'right' },
});
