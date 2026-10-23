/**
 * Les quatre portes vers l'allure de référence (US CARDIO-02, §3.1, D1).
 *
 * Un seul composant pour deux écrans : « Ton allure de référence » (`/running-pace`) et la question 2
 * de l'accueil du pilier (`/running-welcome`). L'état vit dans `useReferenceDoors`, tenu par l'écran :
 * c'est lui qui décide quoi faire de l'allure (la retenir, passer à la question suivante).
 *
 * Toute la décision — ce que rend une saisie, la borne, l'arrondi — est dans `@wellness/shared`
 * (`evaluateReferenceDoor`). Ici, on affiche, et on montre les allures **avant** qu'elles soient
 * retenues : rien n'est écrit par ce composant.
 */

import {
  PLAUSIBLE_PACE_S_PER_KM,
  RACE_DISTANCE_KEYS,
  RACE_TIME_EXAMPLE_S,
  RECORD_DISTANCE_I18N_KEY,
  evaluateReferenceDoor,
  formatMmSs,
  type RaceDistanceKey,
  type ReferencePaceEvaluation,
} from '@wellness/shared';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { TrainingPaceList } from '@/components/running/TrainingPaceList';
import { useRunningRecords } from '@/data/repositories/running-record-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export type ReferenceDoorKey = 'race' | 'test' | 'known' | 'unknown';
export type CooperDoorMode = 'done' | 'now';

const METERS_PER_MILE = 1609.344;

/** Lit le paramètre de route `door` ; toute autre valeur = aucune porte choisie. */
export function parseReferenceDoor(raw: string | string[] | undefined): ReferenceDoorKey | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === 'race' || value === 'test' || value === 'known' || value === 'unknown' ? value : null;
}

/** « 03/10 » et « 03/10/2026 », en heure locale. */
function dayMonth(iso: string): { short: string; long: string } {
  const date = new Date(iso);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return { short: `${dd}/${mm}`, long: `${dd}/${mm}/${date.getFullYear()}` };
}

/**
 * L'état des portes, tenu par l'écran.
 *
 * Les champs « non touchés » valent `null` : ils retombent alors sur une valeur venue d'ailleurs —
 * l'allure actuelle pour la porte « je connais mon allure », la mesure d'un test guidé non retenu
 * pour la porte du test (R8). Ces valeurs arrivent de requêtes asynchrones : tant que le coureur n'a
 * rien tapé, le champ les suit.
 */
export function useReferenceDoors(opts: {
  currentSPerKm: number | null;
  initialDoor?: ReferenceDoorKey | null;
  /** Distance mesurée d'un test guidé dont l'allure n'a pas encore été retenue (R8). */
  pendingTestDistanceM?: number | null;
  allowGuidedTest: boolean;
}) {
  const units = useUnits();
  const [door, setDoor] = useState<ReferenceDoorKey | null>(opts.initialDoor ?? null);
  const [distance, setDistance] = useState<RaceDistanceKey | 'other'>('10k');
  const [customDistanceText, setCustomDistanceText] = useState('');
  const [timeText, setTimeText] = useState('');
  const [chosenTestMode, setTestMode] = useState<CooperDoorMode | null>(null);
  const [testDistanceText, setTestDistanceText] = useState<string | null>(null);
  const [paceText, setPaceText] = useState<string | null>(null);

  const pending = opts.pendingTestDistanceM ?? null;
  const pendingText =
    pending == null
      ? ''
      : units.system === 'imperial'
        ? (pending / METERS_PER_MILE).toFixed(2)
        : String(Math.round(pending));
  const testMode: CooperDoorMode =
    !opts.allowGuidedTest ? 'done' : (chosenTestMode ?? (pending != null ? 'done' : 'now'));
  const effectiveTestText = testDistanceText ?? pendingText;
  const usesPendingTest = pending != null && testDistanceText === null;
  const effectivePaceText = paceText ?? units.paceInputValue(opts.currentSPerKm);

  const evaluation: ReferencePaceEvaluation | null = useMemo(() => {
    switch (door) {
      case 'race':
        return evaluateReferenceDoor({ door: 'race', distance, customDistanceText, timeText, system: units.system });
      case 'test':
        if (testMode !== 'done') return null;
        // La mesure retrouvée s'évalue en mètres, telle qu'à l'arrivée : en impérial, le champ l'arrondit
        // au centième de mile, ce qui pouvait décaler l'allure d'une seconde.
        return usesPendingTest
          ? evaluateReferenceDoor({ door: 'test', distanceText: String(Math.round(pending!)), system: 'metric' })
          : evaluateReferenceDoor({ door: 'test', distanceText: effectiveTestText, system: units.system });
      case 'known':
        return evaluateReferenceDoor({ door: 'known', paceText: effectivePaceText, system: units.system });
      default:
        return null;
    }
  }, [door, distance, customDistanceText, timeText, testMode, usesPendingTest, pending, effectiveTestText, effectivePaceText, units.system]);

  return {
    door,
    setDoor,
    distance,
    setDistance,
    customDistanceText,
    setCustomDistanceText,
    timeText,
    setTimeText,
    testMode,
    setTestMode,
    testDistanceText: effectiveTestText,
    setTestDistanceText,
    usesPendingTest,
    paceText: effectivePaceText,
    setPaceText,
    evaluation,
  };
}

export type ReferenceDoorsState = ReturnType<typeof useReferenceDoors>;

type Props = {
  state: ReferenceDoorsState;
  currentSPerKm: number | null;
  /** « Le faire maintenant » : seulement sur `/running-pace`, jamais dans l'accueil (§3.3). */
  allowGuidedTest: boolean;
  onStartTest?: () => void;
  /** Date (ISO) du test guidé dont la mesure pré-remplit la porte du test. */
  pendingTestDate?: string | null;
};

export function ReferencePaceDoors({ state, currentSPerKm, allowGuidedTest, onStartTest, pendingTestDate }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const { records } = useRunningRecords();

  const raceRecords = records.filter((r): r is typeof r & { distanceKey: RaceDistanceKey } =>
    (RACE_DISTANCE_KEYS as readonly string[]).includes(r.distanceKey),
  );
  const unitWord = units.system === 'imperial' ? 'mi' : 'm';
  const { evaluation } = state;

  const errorText = (() => {
    if (!evaluation) return null;
    const min = units.formatPace(PLAUSIBLE_PACE_S_PER_KM.min);
    const max = units.formatPace(PLAUSIBLE_PACE_S_PER_KM.max);
    switch (evaluation.status) {
      case 'tooFast':
        return state.door === 'known'
          ? t('running.refPace.error.knownTooFast', { min })
          : state.door === 'test'
            ? t('running.refPace.error.testTooFast', { min })
            : t('running.refPace.error.tooFast', { min });
      case 'tooSlow':
        return state.door === 'known'
          ? t('running.refPace.error.knownTooSlow', { max })
          : state.door === 'test'
            ? t('running.refPace.error.testTooSlow', { max })
            : t('running.refPace.error.tooSlow', { max });
      case 'badDistance':
        return t(units.system === 'imperial' ? 'running.refPace.error.badDistanceImperial' : 'running.refPace.error.badDistance');
      case 'unreadable':
        return state.door === 'known'
          ? t('running.refPace.error.unreadablePace', { example: units.system === 'imperial' ? '8:03' : '5:00' })
          : state.door === 'test'
            ? t(units.system === 'imperial' ? 'running.refPace.error.unreadableMiles' : 'running.refPace.error.unreadableMeters')
            : t('running.refPace.error.unreadableTime', { example: formatMmSs(RACE_TIME_EXAMPLE_S[state.distance]) });
      default:
        return null;
    }
  })();

  const ok = evaluation?.status === 'ok' ? evaluation.sPerKm : null;

  return (
    <View style={styles.wrap}>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('running.refPace.doorsLabel')} style={styles.doors}>
        <DoorCard
          testID="ref-door-race"
          title={t('running.refPace.door.race.title')}
          body={t('running.refPace.door.race.body')}
          selected={state.door === 'race'}
          onSelect={() => state.setDoor('race')}
        >
          {raceRecords.length > 0 ? (
            <View style={styles.group}>
              <Text style={[styles.groupLabel, { color: colors.textMuted }]}>{t('running.refPace.records')}</Text>
              <View style={styles.chips}>
                {raceRecords.map((record) => {
                  const date = dayMonth(record.achievedAt);
                  const distanceLabel = t(RECORD_DISTANCE_I18N_KEY[record.distanceKey]);
                  const time = formatMmSs(record.bestTimeSeconds);
                  return (
                    <Pressable
                      key={record.distanceKey}
                      testID={`ref-record-${record.distanceKey}`}
                      accessibilityRole="button"
                      accessibilityLabel={t('running.refPace.recordChipA11y', { distance: distanceLabel, time, date: date.long })}
                      onPress={() => {
                        state.setDistance(record.distanceKey);
                        state.setTimeText(time);
                      }}
                      style={[styles.recordChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                    >
                      <Text style={[styles.recordChipText, { color: colors.accent }]}>
                        {t('running.refPace.recordChip', { distance: distanceLabel, time, date: date.short })}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
          <View style={styles.group}>
            <Text style={[styles.groupLabel, { color: colors.textMuted }]}>{t('running.refPace.distance')}</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel={t('running.refPace.distance')} style={styles.chips}>
              {[...RACE_DISTANCE_KEYS, 'other' as const].map((key) => {
                const active = state.distance === key;
                return (
                  <Pressable
                    key={key}
                    testID={`ref-distance-${key}`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    onPress={() => state.setDistance(key)}
                    style={[
                      styles.pill,
                      { backgroundColor: active ? colors.accent : colors.surface, borderColor: active ? colors.accent : colors.borderStrong },
                    ]}
                  >
                    <Text style={[styles.pillText, { color: active ? colors.accentText : colors.text }]}>
                      {key === 'other' ? t('running.refPace.distanceOther') : t(RECORD_DISTANCE_I18N_KEY[key])}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          {state.distance === 'other' ? (
            <TextField
              testID="ref-custom-distance"
              label={t('running.refPace.customDistance', { unit: units.distanceSymbol })}
              value={state.customDistanceText}
              onChangeText={state.setCustomDistanceText}
              keyboardType="decimal-pad"
              placeholder={units.system === 'imperial' ? '5' : '8'}
            />
          ) : null}
          <TextField
            testID="ref-time"
            label={t('running.refPace.time')}
            value={state.timeText}
            onChangeText={state.setTimeText}
            keyboardType="numbers-and-punctuation"
            placeholder={formatMmSs(RACE_TIME_EXAMPLE_S[state.distance])}
          />
        </DoorCard>

        <DoorCard
          testID="ref-door-test"
          title={t('running.refPace.door.test.title')}
          body={t('running.refPace.door.test.body')}
          selected={state.door === 'test'}
          onSelect={() => state.setDoor('test')}
        >
          {allowGuidedTest ? (
            <View accessibilityRole="radiogroup" style={[styles.segment, { backgroundColor: colors.surfaceAlt }]}>
              {(['done', 'now'] as const).map((mode) => {
                const active = state.testMode === mode;
                return (
                  <Pressable
                    key={mode}
                    testID={`ref-test-${mode}`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    onPress={() => state.setTestMode(mode)}
                    style={[styles.segmentItem, active && { backgroundColor: colors.surface }]}
                  >
                    <Text style={[styles.segmentText, { color: active ? colors.accent : colors.textMuted }]}>
                      {t(mode === 'done' ? 'running.refPace.testDone' : 'running.refPace.testNow')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {state.testMode === 'done' ? (
            <View style={styles.group}>
              <TextField
                testID="ref-test-distance"
                label={t('running.refPace.testDistance', { unit: unitWord })}
                value={state.testDistanceText}
                onChangeText={state.setTestDistanceText}
                keyboardType={units.system === 'imperial' ? 'decimal-pad' : 'number-pad'}
                placeholder={units.system === 'imperial' ? '1.49' : '2400'}
              />
              {state.usesPendingTest && pendingTestDate ? (
                <Text testID="ref-test-pending" style={[styles.note, { color: colors.accent }]}>
                  {t('running.refPace.testPending', { date: dayMonth(pendingTestDate).short })}
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.group}>
              {(['warmup', 'run', 'screen'] as const).map((step, i) => (
                <Text key={step} style={[styles.protocol, { color: colors.text }]}>
                  {`${i + 1}. ${t(`running.refPace.protocol.${step}`)}`}
                </Text>
              ))}
              <Button testID="ref-start-test" label={t('running.refPace.startTest')} onPress={() => onStartTest?.()} />
            </View>
          )}
          {!allowGuidedTest ? (
            <Text style={[styles.note, { color: colors.textMuted }]}>{t('running.refPace.testLater')}</Text>
          ) : null}
        </DoorCard>

        <DoorCard
          testID="ref-door-known"
          title={t('running.refPace.door.known.title')}
          body={t('running.refPace.door.known.body')}
          selected={state.door === 'known'}
          onSelect={() => state.setDoor('known')}
        >
          <TextField
            testID="ref-known"
            label={t('running.refPace.knownField', { unit: units.distanceSymbol })}
            value={state.paceText}
            onChangeText={state.setPaceText}
            keyboardType="numbers-and-punctuation"
            placeholder={t(
              units.system === 'imperial'
                ? 'running.profile.ref5kPlaceholderImperial'
                : 'running.profile.ref5kPlaceholderMetric',
            )}
          />
        </DoorCard>

        {currentSPerKm == null ? (
          <DoorCard
            testID="ref-door-unknown"
            title={t('running.refPace.door.unknown.title')}
            body={t('running.refPace.door.unknown.body')}
            selected={state.door === 'unknown'}
            onSelect={() => state.setDoor('unknown')}
          >
            <Text style={[styles.detail, { color: colors.text }]}>{t('running.refPace.door.unknown.detail')}</Text>
          </DoorCard>
        ) : null}
      </View>

      {errorText ? (
        <View
          testID="ref-error"
          accessibilityRole="alert"
          style={[styles.error, { backgroundColor: colors.warn, borderColor: colors.warnBorder }]}
        >
          <Text style={[styles.errorText, { color: colors.warnText }]}>{errorText}</Text>
        </View>
      ) : null}

      {ok != null ? (
        // Pas de `accessible` sur le conteneur : il masquerait les quatre allures et « Avant », que le
        // lecteur d'écran doit lire une à une. Seule la ligne de l'allure s'annonce à chaque changement.
        <View testID="ref-preview" style={[styles.preview, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>{t('running.refPace.preview.eyebrow')}</Text>
          <View
            style={styles.previewRow}
            accessible
            accessibilityLiveRegion="polite"
            accessibilityLabel={t('running.refPace.preview.a11y', {
              pace: units.formatPace(ok),
              time: formatMmSs(ok * 5),
            })}
          >
            <Text style={[styles.previewPace, { color: colors.accent }]}>{units.formatPace(ok)}</Text>
            <Text style={[styles.previewEquivalent, { color: colors.text }]}>
              {t('running.refPace.preview.equivalent', { time: formatMmSs(ok * 5) })}
            </Text>
          </View>
          {currentSPerKm != null && currentSPerKm !== ok ? (
            <Text testID="ref-before" style={[styles.note, { color: colors.text }]}>
              {t('running.refPace.before', { pace: units.formatPace(currentSPerKm) })}
            </Text>
          ) : null}
          <TrainingPaceList refSPerKm={ok} />
        </View>
      ) : null}
    </View>
  );
}

function DoorCard({
  testID,
  title,
  body,
  selected,
  onSelect,
  children,
}: {
  testID: string;
  title: string;
  body: string;
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: selected ? colors.accent : colors.border, borderWidth: selected ? 1.5 : 1 },
      ]}
    >
      <Pressable
        testID={testID}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`${title}. ${body}`}
        onPress={onSelect}
        style={styles.cardHead}
      >
        <View style={[styles.radio, { borderColor: selected ? colors.accent : colors.borderStrong }]}>
          {selected ? <View style={[styles.radioDot, { backgroundColor: colors.accent }]} /> : null}
        </View>
        <View style={styles.cardTexts}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.cardBody, { color: colors.textMuted }]}>{body}</Text>
        </View>
      </Pressable>
      {selected ? <View style={styles.cardContent}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  doors: { gap: 10 },
  card: { borderRadius: 18, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, paddingHorizontal: 16, paddingVertical: 15, minHeight: 44 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  cardTexts: { flex: 1, gap: 2 },
  cardTitle: { fontFamily: fontFamily.bodyBold, fontSize: 15.5 },
  cardBody: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  cardContent: { gap: 12, paddingLeft: 51, paddingRight: 16, paddingBottom: 16 },
  group: { gap: 8 },
  groupLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, justifyContent: 'center' },
  pillText: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  recordChip: { minHeight: 44, paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, justifyContent: 'center' },
  recordChipText: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  segment: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14 },
  segmentItem: { flex: 1, minHeight: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segmentText: { fontFamily: fontFamily.bodyBold, fontSize: 13.5, textAlign: 'center' },
  protocol: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 19 },
  note: { fontFamily: fontFamily.bodySemi, fontSize: 12.5, lineHeight: 18 },
  detail: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 20 },
  error: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11 },
  errorText: { fontFamily: fontFamily.bodySemi, fontSize: 13.5, lineHeight: 19 },
  preview: { gap: 10, padding: 14, borderRadius: 18, borderWidth: 1 },
  eyebrow: { fontFamily: fontFamily.monoBold, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  previewRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 },
  previewPace: { fontFamily: fontFamily.monoBold, fontSize: 28 },
  previewEquivalent: { fontFamily: fontFamily.body, fontSize: 13 },
});
