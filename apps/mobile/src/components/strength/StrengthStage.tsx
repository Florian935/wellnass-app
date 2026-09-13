/**
 * US DASH-01 — la scène du pilier Musculation : « l'impact » (spec §4.4).
 *
 * Les **quatre états** de `resolveHubState` sont conservés tels quels (reprendre / séance du jour /
 * repos / démarrage) ; la scène leur ajoute le moment **après la séance** — une séance terminée
 * aujourd'hui. C'est le seul instant où le pilier a quelque chose à célébrer, et le hub le traitait
 * jusqu'ici comme un jour de repos ordinaire.
 *
 * ── La matière, et le « bug visuel » qu'elle a failli être (D6) ───────────────────────────────────
 * `ImpactSilhouette` allume les muscles de la séance **une seule fois**, à l'arrivée sur l'onglet.
 * La maquette les faisait clignoter en boucle : relu sur device, ça ressemblait à un néon qui
 * grésille. L'impact joue, puis se pose — et ne rejoue qu'au prochain retour sur le pilier.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { WORKOUT_DISPLAY_MODES, type MuscleGroup } from '@wellness/shared';
import { AnimatedNumber, useLocaleSeparators } from '@/components/motion/AnimatedNumber';
import { PillarStage, useStageTheme } from '@/components/stage/PillarStage';
import { StageButton } from '@/components/stage/StageButton';
import { StageIconButton } from '@/components/stage/StageIconButton';
import { ImpactSilhouette, type SilhouetteZone } from '@/components/stage/matter/ImpactSilhouette';
import { useLoopActive } from '@/hooks/useLoopActive';
import { useSessionMode } from '@/stores/session-mode-store';
import { fontFamily } from '@/theme/fonts';

/** Les six groupes de `MUSCLE_GROUPS` sont exactement les six zones de la silhouette. */
const ZONES: readonly SilhouetteZone[] = ['chest', 'shoulders', 'arms', 'back', 'legs', 'core'];

export type StrengthScene =
  /** Une séance tourne : la seule situation où l'on peut perdre quelque chose. */
  | { kind: 'resume'; doneSets: number; totalSets: number }
  /** Une séance a été terminée aujourd'hui — le moment d'après. */
  | {
      kind: 'after-session';
      name: string | null;
      tonnageKg: number;
      exerciseCount: number;
      recordsBeaten: number;
    }
  /** La séance du jour, avec ce qu'elle contient. */
  | {
      kind: 'today';
      name: string | null;
      /** Rang de la séance dans le programme, 0-based (le repli quand elle n'a pas de nom). */
      orderIndex: number;
      programName: string | null;
      exerciseCount: number;
      estimatedMinutes: number | null;
      previewExercises: readonly string[];
    }
  /** Programme en cours, rien aujourd'hui (ou déjà fait, sans détail de séance). */
  | { kind: 'rest'; doneToday: boolean; nextLabel: string | null }
  /** Aucun programme : on propose d'en choisir un, la séance libre passe second. */
  | { kind: 'onboarding' };

/** Le record à portée du jour, tel que la scène le dit — une phrase, pas un tableau. */
export type StageNearRecord = {
  exerciseName: string;
  gapKind: 'kg' | 'reps' | 'beaten';
  gap: number;
};

type Props = {
  scene: StrengthScene;
  /** Muscles travaillés par la séance du jour (ou celle qui vient de finir). */
  muscles: readonly MuscleGroup[];
  nearRecord: StageNearRecord | null;
  weekLabel: string | null;
  /** Vrai pendant le démarrage d'une séance : le geste principal passe en attente. */
  busy?: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
  onPlanning: () => void;
  onDirectory: () => void;
};

export function StrengthStage({
  scene,
  muscles,
  nearRecord,
  weekLabel,
  busy = false,
  onPrimary,
  onSecondary,
  onPlanning,
  onDirectory,
}: Props) {
  const { t } = useTranslation();
  const stage = useStageTheme('strength');
  const active = useLoopActive('strength');
  const { groupSeparator, decimalSeparator } = useLocaleSeparators();

  const zones = ZONES.filter((zone) => muscles.includes(zone));

  return (
    <PillarStage
      pillar="strength"
      testID="strength-stage"
      matter={<ImpactSilhouette zones={zones} play={active} color={stage.accent} />}
    >
      <View style={styles.topRow}>
        <Text style={[styles.eyebrow, { color: stage.inkMuted }]} numberOfLines={1}>
          {t(`stage.strength.eyebrow.${scene.kind}`)}
        </Text>
        <View style={styles.icons}>
          <StageIconButton
            icon="calendar-outline"
            label={t('planning.title')}
            onPress={onPlanning}
            color={stage.ink}
          />
          <StageIconButton
            icon="library-outline"
            label={t('strengthHub.directory')}
            onPress={onDirectory}
            color={stage.ink}
          />
        </View>
      </View>

      {scene.kind === 'after-session' ? (
        <View style={styles.block}>
          <View style={styles.bigRow}>
            <AnimatedNumber
              testID="strength-tonnage"
              value={scene.tonnageKg}
              groupSeparator={groupSeparator}
              decimalSeparator={decimalSeparator}
              style={[styles.big, { color: stage.ink }]}
              accessibilityLabel={t('stage.strength.tonnageA11y', { kg: Math.round(scene.tonnageKg) })}
            />
            <Text style={[styles.unit, { color: stage.inkMuted }]}>{t('stage.strength.kg')}</Text>
          </View>
          <Text style={[styles.sub, { color: stage.inkMuted }]}>
            {t('stage.strength.afterMeta', {
              name: scene.name ?? t('stage.strength.freeSession'),
              exercises: scene.exerciseCount,
            })}
          </Text>
          {scene.recordsBeaten > 0 ? (
            <Text style={[styles.record, { color: stage.ink }]}>
              {t('stage.strength.recordsBeaten', { count: scene.recordsBeaten })}
            </Text>
          ) : null}
        </View>
      ) : scene.kind === 'resume' ? (
        <View style={styles.block}>
          <Text style={[styles.title, { color: stage.ink }]}>{t('workout.resumeTitle')}</Text>
          <Text style={[styles.sub, { color: stage.inkMuted }]}>
            {t('stage.strength.setsProgress', { done: scene.doneSets, total: scene.totalSets })}
          </Text>
        </View>
      ) : scene.kind === 'today' ? (
        <View style={styles.block}>
          <Text style={[styles.title, { color: stage.ink }]} numberOfLines={2}>
            {scene.name?.trim() ||
              t('programs.detail.sessionFallback', { index: scene.orderIndex + 1 })}
          </Text>
          <Text style={[styles.sub, { color: stage.inkMuted }]} numberOfLines={2}>
            {[
              scene.programName,
              t('stage.strength.exercises', { count: scene.exerciseCount }),
              scene.estimatedMinutes != null
                ? t('strengthHub.minutesShort', { count: scene.estimatedMinutes })
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {scene.previewExercises.length > 0 ? (
            <View style={styles.chips}>
              {scene.previewExercises.map((name) => (
                <View
                  key={name}
                  style={[styles.chip, { backgroundColor: stage.glass, borderColor: stage.glassBorder }]}
                >
                  <Text style={[styles.chipText, { color: stage.ink }]} numberOfLines={1}>
                    {name}
                  </Text>
                </View>
              ))}
              {/* Le reste de la séance, compté : trois noms ne disent pas s'il en reste cinq. */}
              {scene.exerciseCount > scene.previewExercises.length ? (
                <View
                  style={[styles.chip, { backgroundColor: stage.glass, borderColor: stage.glassBorder }]}
                >
                  <Text style={[styles.chipText, { color: stage.inkMuted }]}>
                    {t('strengthHub.today.more', {
                      count: scene.exerciseCount - scene.previewExercises.length,
                    })}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : scene.kind === 'rest' ? (
        <View style={styles.block}>
          <Text style={[styles.title, { color: stage.ink }]}>
            {scene.doneToday ? t('strengthHub.rest.doneTitle') : t('strengthHub.rest.title')}
          </Text>
          <Text style={[styles.sub, { color: stage.inkMuted }]}>
            {scene.nextLabel ?? t('strengthHub.rest.noNext')}
          </Text>
        </View>
      ) : (
        <View style={styles.block}>
          <Text style={[styles.title, { color: stage.ink }]}>{t('strengthHub.onboarding.title')}</Text>
          <Text style={[styles.sub, { color: stage.inkMuted }]}>{t('strengthHub.onboarding.subtitle')}</Text>
        </View>
      )}

      {/* Le record à portée : la seule phrase du hub qui donne envie d'y aller aujourd'hui. */}
      {nearRecord ? (
        <View style={styles.nearRow}>
          <Ionicons name="flame-outline" size={15} color={stage.accent} />
          <Text style={[styles.nearText, { color: stage.ink }]} numberOfLines={2}>
            {t(`stage.strength.near.${nearRecord.gapKind}`, {
              exercise: nearRecord.exerciseName,
              gap: nearRecord.gap,
            })}
          </Text>
        </View>
      ) : weekLabel ? (
        <View style={styles.nearRow}>
          <Ionicons name="albums-outline" size={15} color={stage.inkMuted} />
          <Text style={[styles.nearText, { color: stage.inkMuted }]} numberOfLines={1}>
            {weekLabel}
          </Text>
        </View>
      ) : null}

      {/* Le mode d'affichage se choisit **juste au-dessus du bouton de départ** (US MUSCU-UX03,
          R-MO-2) : c'est le seul endroit où la question se pose vraiment, au moment de partir.
          Les scènes « reprise », « repos », « après-séance » et « premiers pas » n'en portent
          pas — on n'y démarre pas une séance de programme. */}
      {scene.kind === 'today' ? <ModeSelector /> : null}

      <View style={styles.ctaRow}>
        <StageButton
          pillar="strength"
          icon={PRIMARY_ICON[scene.kind]}
          label={t(`stage.strength.primary.${scene.kind}`)}
          onPress={onPrimary}
          disabled={busy}
          haptic={scene.kind === 'today' || scene.kind === 'resume' ? 'milestone' : 'confirm'}
          style={styles.flex}
        />
        <StageButton
          pillar="strength"
          variant="glass"
          label={t(`stage.strength.secondary.${scene.kind}`)}
          onPress={onSecondary}
          style={styles.flex}
        />
      </View>
    </PillarStage>
  );
}

const PRIMARY_ICON: Record<StrengthScene['kind'], keyof typeof Ionicons.glyphMap> = {
  resume: 'play',
  'after-session': 'share-social-outline',
  today: 'play',
  rest: 'barbell-outline',
  onboarding: 'compass-outline',
};

/**
 * Le sélecteur **Classique · Immersif** (US MUSCU-UX03, R-MO-2).
 *
 * Il écrit la préférence tout de suite : ce n'est pas un choix « pour cette séance », c'est
 * **le** mode. Le changer ici, c'est le changer partout — et c'est ce qu'on veut, parce que
 * personne n'ira le chercher dans les Réglages.
 */
function ModeSelector() {
  const { t } = useTranslation();
  const stage = useStageTheme('strength');
  const mode = useSessionMode((s) => s.mode);
  const setMode = useSessionMode((s) => s.setMode);

  return (
    <View style={[styles.modeRow, { backgroundColor: stage.glass, borderColor: stage.glassBorder }]}>
      {WORKOUT_DISPLAY_MODES.map((option) => {
        const selected = option === mode;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => setMode(option)}
            style={[styles.modeItem, selected && { backgroundColor: stage.solid }]}
          >
            <Text
              style={[styles.modeLabel, { color: selected ? stage.onSolid : stage.inkMuted }]}
            >
              {t(`workoutMode.${option}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  modeRow: { flexDirection: 'row', borderRadius: 13, borderWidth: 1, padding: 3, gap: 3 },
  modeItem: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  eyebrow: {
    fontFamily: fontFamily.monoBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  icons: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  block: { gap: 8, marginTop: 18 },
  title: { fontFamily: fontFamily.displayXBold, fontSize: 30, letterSpacing: -1 },
  sub: { fontFamily: fontFamily.bodyMedium, fontSize: 13.5, lineHeight: 19 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  big: { fontFamily: fontFamily.displayXBold, fontSize: 58, letterSpacing: -2.6, lineHeight: 62 },
  unit: { fontFamily: fontFamily.bodySemi, fontSize: 16 },
  record: { fontFamily: fontFamily.displayBold, fontSize: 15, letterSpacing: -0.3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 9, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 5, maxWidth: '100%' },
  chipText: { fontFamily: fontFamily.bodyMedium, fontSize: 12 },
  nearRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14 },
  nearText: { fontFamily: fontFamily.bodySemi, fontSize: 13, flexShrink: 1 },
  ctaRow: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
