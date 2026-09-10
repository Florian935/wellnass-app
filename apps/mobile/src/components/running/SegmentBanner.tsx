/**
 * US CARDIO-UX01 (R5 / constat F10) — le bandeau de segment de l'écran de course.
 *
 * ── Ce qu'il répare ──────────────────────────────────────────────────────────────────────────────
 * Une séance structurée (RUN-F4 : segments typés, rampes d'allure, groupes imbriqués) était
 * pilotée **uniquement à la voix**. L'écran de suivi affichait distance, chrono, deux allures et
 * une allure cible — et **jamais** dans quel segment on était, quelle répétition, ce qui restait,
 * ni ce qui venait après. Écouteurs retirés, musique forte, annonce manquée : le coureur était
 * aveugle au milieu de sa propre séance, alors que l'app savait tout.
 *
 * ── Ce qu'il affiche, et dans cet ordre ──────────────────────────────────────────────────────────
 *  1. **la nature du segment** et la répétition (« Fraction 3 / 6 ») — l'identité de ce qu'on fait ;
 *  2. **ce qui reste** (250 m, ou 0:40) — le seul chiffre qui compte dans l'instant ;
 *  3. la **cible** du segment ;
 *  4. **ce qui suit**, pour ne pas être surpris ;
 *  5. l'**avancement de la séance** entière.
 *
 * Il ne calcule rien : tout vient de `resolveSegmentBanner` (`@wellness/shared`, testé), qui se
 * reconstruit depuis le curseur de phase déjà persisté par RUN-F2d. Aucune seconde source de
 * vérité sur « où en est la séance » (règle R5-1).
 *
 * Rend `null` quand il n'y a rien à dire — course libre, séance sans structure, guidage pas encore
 * démarré. Même règle que `SessionAdaptationCard` et `PolarisationSection` : **rien à dire, rien à
 * l'écran** ; un bandeau vide serait pire qu'une absence.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RunSegmentBanner } from '@wellness/shared';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { useUnits } from '@/hooks/useUnits';

type Props = {
  banner: RunSegmentBanner | null;
  /** Course en pause : le bandeau se grise, comme le chiffre en héros. */
  paused: boolean;
};

/**
 * Nomme le segment courant.
 *
 * La **nature** (`segmentKind`) prime sur le rôle (`kind`) : « Échauffement » est plus parlant que
 * « Effort », et c'est le mot qu'emploie le plan d'entraînement. Le rôle ne sert que pour la
 * récupération à l'intérieur d'un bloc de travail, où la nature vaut `work` mais où le coureur
 * trotte.
 */
function segmentLabelKey(banner: Extract<RunSegmentBanner, { state: 'running' }>): string {
  if (banner.kind === 'recovery') return 'running.segmentKind.recovery';
  return `running.segmentKind.${banner.segmentKind}`;
}

export function SegmentBanner({ banner, paused }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();

  if (banner === null) return null;

  // Séance terminée : on l'annonce plutôt que d'afficher « fraction 15 sur 14 » (spec §3).
  if (banner.state === 'done') {
    return (
      <View style={[styles.wrap, { backgroundColor: colors.panel }]}>
        <View style={styles.doneRow}>
          <Text style={[styles.doneTitle, { color: colors.panelText }]}>
            {t('running.segment.sessionDone')}
          </Text>
          <Text style={[styles.doneBody, { color: colors.panelMuted }]}>
            {t('running.segment.sessionDoneBody', { count: banner.totalPhases })}
          </Text>
        </View>
      </View>
    );
  }

  const name = t(segmentLabelKey(banner));
  const showRep = banner.totalReps > 1;

  const remainingValue =
    banner.remaining === null
      ? null
      : banner.remaining.axis === 'distance'
        ? units.formatDistanceShort(banner.remaining.meters)
        : formatMmSs(banner.remaining.seconds);

  const nextLabel =
    banner.next === null
      ? null
      : t('running.segment.next', {
          name:
            banner.next.kind === 'recovery'
              ? t('running.segmentKind.recovery')
              : t(`running.segmentKind.${banner.next.segmentKind}`),
          amount:
            banner.next.distanceM != null
              ? units.formatDistanceShort(banner.next.distanceM)
              : banner.next.durationSeconds != null
                ? formatMmSs(banner.next.durationSeconds)
                : '',
        }).trim();

  const dim = paused ? 0.55 : 1;

  // Une seule étiquette d'accessibilité pour tout le bandeau : lu élément par élément, il
  // s'annoncerait comme une suite de nombres sans lien.
  const a11y = [
    name,
    showRep ? t('running.segment.repA11y', { rep: banner.rep, total: banner.totalReps }) : null,
    remainingValue ? t('running.segment.remainingA11y', { value: remainingValue }) : null,
    banner.targetRange
      ? t('running.segment.targetA11y', {
          value:
            banner.targetRange.minSPerKm === banner.targetRange.maxSPerKm
              ? units.formatPace(banner.targetRange.minSPerKm)
              : t('running.paceGuidance.range', {
                  min: units.formatPace(banner.targetRange.minSPerKm),
                  max: units.formatPace(banner.targetRange.maxSPerKm),
                }),
        })
      : null,
    nextLabel,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <View
      style={[styles.wrap, { backgroundColor: colors.panel, opacity: dim }]}
      accessible
      accessibilityLabel={a11y}
    >
      {/* Nature + répétition · ce qui reste */}
      <View style={styles.headRow}>
        <View style={styles.headLeft}>
          <View style={[styles.dot, { backgroundColor: colors.panelAccent }]} />
          <Text style={[styles.name, { color: colors.panelText }]} numberOfLines={1}>
            {banner.label?.trim() || name}
          </Text>
          {showRep ? (
            <Text style={[styles.rep, { color: colors.panelMuted }]}>
              {banner.rep} / {banner.totalReps}
            </Text>
          ) : null}
        </View>

        {remainingValue !== null ? (
          <View style={styles.remainingBox}>
            <Text style={[styles.remainingValue, { color: colors.panelText }]}>
              {remainingValue}
            </Text>
            <Text style={[styles.remainingLabel, { color: colors.panelMuted }]}>
              {t('running.segment.remaining')}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Avancement DANS le segment */}
      {banner.progress !== null ? (
        <View style={[styles.track, { backgroundColor: 'rgba(240,228,208,0.18)' }]}>
          <View
            style={[
              styles.fill,
              { width: `${Math.round(banner.progress * 100)}%`, backgroundColor: colors.panelAccent },
            ]}
          />
        </View>
      ) : null}

      {/* Cible du segment · ce qui suit */}
      <View style={styles.footRow}>
        {banner.targetRange ? (
          <View style={styles.footLeft}>
            <Text style={[styles.footLabel, { color: colors.panelMuted }]}>
              {t('running.segment.target')}
            </Text>
            <Text style={[styles.footValue, { color: colors.panelText }]}>
              {banner.targetRange.minSPerKm === banner.targetRange.maxSPerKm
                ? units.formatPace(banner.targetRange.minSPerKm)
                : t('running.paceGuidance.range', {
                    min: units.formatPace(banner.targetRange.minSPerKm),
                    max: units.formatPace(banner.targetRange.maxSPerKm),
                  })}
            </Text>
          </View>
        ) : (
          <View style={styles.footLeft} />
        )}

        {nextLabel ? (
          <Text style={[styles.nextLabel, { color: colors.panelMuted }]} numberOfLines={1}>
            {nextLabel}
          </Text>
        ) : null}
      </View>

      {/* Avancement de la séance entière */}
      <View style={[styles.sessionTrack, { backgroundColor: 'rgba(240,228,208,0.14)' }]}>
        <View
          style={[
            styles.sessionFill,
            {
              width: `${Math.round(banner.sessionProgress * 100)}%`,
              backgroundColor: colors.panelAccent,
            },
          ]}
        />
      </View>
    </View>
  );
}

/** `m:ss` — les décomptes de segment se lisent en minutes:secondes, jamais en secondes brutes. */
function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 20,
    marginBottom: 4,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 10,
  },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  headLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  name: { fontFamily: fontFamily.displayBold, fontSize: 19, letterSpacing: -0.4, flexShrink: 1 },
  rep: { fontFamily: fontFamily.mono, fontSize: 15 },
  remainingBox: { alignItems: 'flex-end' },
  remainingValue: { fontFamily: fontFamily.monoBold, fontSize: 22, lineHeight: 24 },
  remainingLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  footRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  footLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  footValue: { fontFamily: fontFamily.monoBold, fontSize: 14 },
  nextLabel: { fontFamily: fontFamily.body, fontSize: 12, flexShrink: 1, textAlign: 'right' },
  sessionTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  sessionFill: { height: '100%', borderRadius: 2 },
  doneRow: { gap: 2 },
  doneTitle: { fontFamily: fontFamily.displayBold, fontSize: 18, letterSpacing: -0.3 },
  doneBody: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
});
