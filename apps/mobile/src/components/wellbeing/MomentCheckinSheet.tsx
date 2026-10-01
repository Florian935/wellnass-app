/**
 * US BIEN-03 — le check-in en deux temps (décision D4 du 01/10/2026).
 *
 * **Le matin** répond à « que faire aujourd'hui ? » : la nuit (durée et qualité), l'énergie, l'envie
 * de s'entraîner, et deux étiquettes (malade, en voyage). **Le soir** répond à « comment s'est passée
 * la journée ? » : l'humeur, le stress, deux étiquettes (journée chargée, soirée), et les modules
 * activés (alcool, café tardif, fringales, sieste). Les deux écrivent **la même ligne**.
 *
 * Même patron que la feuille de BIEN-01 (`WellbeingCheckinSheet`), dont elle prend la place quand le
 * pilier est activé : une feuille, pas un écran poussé ; rien d'obligatoire ; le formulaire est monté
 * à l'ouverture avec une `key`, l'état initial se lit dans les props (aucun effet de réamorçage).
 *
 * Trois règles à ne pas défaire :
 *  1. **une feuille n'écrit que les champs de son moment** — le soir ne touche pas à la nuit ;
 *  2. **une nuit lue dans Health Connect et non modifiée n'est pas réécrite** : la renvoyer la ferait
 *     passer pour une saisie manuelle, et la lecture suivante ne pourrait plus la compléter ;
 *  3. « Courbatures » n'est pas une étiquette : c'est la « gêne » du journal des douleurs (DOUL-01),
 *     ouvert en un tap — jamais un second endroit pour dire la même chose.
 */

import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ALCOHOL_DRINKS_MAX,
  NAP_MINUTES_MAX,
  NAP_MINUTES_STEP,
  SLEEP_MINUTES_MAX,
  SLEEP_MINUTES_MIN,
  SLEEP_MINUTES_STEP,
  formatDayFull,
  isEmptyCheckin,
  type CheckinMoment,
  type WellbeingCheckinInput,
  type WellbeingLevel,
  type WellbeingScaleKey,
  type WellbeingTag,
} from '@wellness/shared';

import { Button } from '@/components/Button';
import { Stepper } from '@/components/lab/Stepper';
import { formatMinutes } from '@/components/lab/lab-format';
import { WellbeingScale } from '@/components/wellbeing/WellbeingScale';
import { logWeight, useLatestWeight } from '@/data/repositories/bodyweight-repository';
import { saveWellbeing, type WellbeingEntry } from '@/data/repositories/daily-wellbeing-repository';
import { useSettings } from '@/data/repositories/settings-repository';
import { useWellbeingPillar } from '@/data/repositories/wellbeing-pillar-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Valeur de départ de la nuit, au premier « + » : une nuit ordinaire, pas un quart d'heure. */
const SLEEP_DEFAULT_MINUTES = 7 * 60;
/** Première sieste proposée au premier « + ». */
const NAP_DEFAULT_MINUTES = 20;

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Jour visé (AAAA-MM-JJ) — aujourd'hui, ou un jour de rattrapage. */
  logDate: string;
  moment: CheckinMoment;
  /** Check-in déjà enregistré pour ce jour : on corrige au lieu de recréer. */
  existing: WellbeingEntry | null;
  /**
   * Le matin, si le soir de la veille n'a pas été fait : ouvre la feuille du soir sur la veille.
   * `undefined` = pas de rattrapage proposé.
   */
  onCatchUpYesterday?: () => void;
};

export function MomentCheckinSheet({ visible, onClose, logDate, moment, existing, onCatchUpYesterday }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('wellbeing.closeSheet')} />
      <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
        {visible && (
          <MomentForm
            key={`${logDate}:${moment}:${existing?.id ?? 'new'}`}
            logDate={logDate}
            moment={moment}
            existing={existing}
            onDone={onClose}
            onCatchUpYesterday={onCatchUpYesterday}
          />
        )}
      </View>
    </Modal>
  );
}

/** Les champs que chaque moment possède — la feuille n'écrit que ceux-là (règle 1). */
const MORNING_SCALES: readonly WellbeingScaleKey[] = ['sleepQuality', 'energy', 'motivation'];
const EVENING_SCALES: readonly WellbeingScaleKey[] = ['mood', 'stress'];
const MORNING_TAG_LIST: readonly WellbeingTag[] = ['sick', 'travel'];
const EVENING_TAG_LIST: readonly WellbeingTag[] = ['busyDay', 'lateNight'];

function initialValues(existing: WellbeingEntry | null): WellbeingCheckinInput {
  if (!existing) return {};
  return {
    mood: existing.mood,
    energy: existing.energy,
    stress: existing.stress,
    sleepMinutes: existing.sleepMinutes,
    sleepQuality: existing.sleepQuality,
    motivation: existing.motivation,
    cravings: existing.cravings,
    sick: existing.sick,
    busyDay: existing.busyDay,
    lateNight: existing.lateNight,
    travel: existing.travel,
    alcoholDrinks: existing.alcoholDrinks,
    lateCaffeine: existing.lateCaffeine,
    napMinutes: existing.napMinutes,
  };
}

function MomentForm({
  logDate,
  moment,
  existing,
  onDone,
  onCatchUpYesterday,
}: {
  logDate: string;
  moment: CheckinMoment;
  existing: WellbeingEntry | null;
  onDone: () => void;
  onCatchUpYesterday?: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();
  const { latest } = useLatestWeight();
  const { modules } = useWellbeingPillar();
  const { settings } = useSettings();
  const painJournal = settings?.painJournalEnabled === true;

  const [values, setValues] = useState<WellbeingCheckinInput>(() => initialValues(existing));
  const [sleepTouched, setSleepTouched] = useState(false);
  const [weightText, setWeightText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMorning = moment === 'morning';
  const sleepMinutes = values.sleepMinutes ?? null;
  const fromHealthConnect = existing?.sleepSource === 'health_connect' && !sleepTouched && sleepMinutes !== null;

  const stepSleep = (direction: 1 | -1) => {
    setSleepTouched(true);
    setValues((prev) => {
      const current = prev.sleepMinutes ?? null;
      if (current === null) return { ...prev, sleepMinutes: SLEEP_DEFAULT_MINUTES };
      const next = Math.min(SLEEP_MINUTES_MAX, Math.max(SLEEP_MINUTES_MIN, current + direction * SLEEP_MINUTES_STEP));
      return { ...prev, sleepMinutes: next };
    });
  };
  const stepNap = (direction: 1 | -1) =>
    setValues((prev) => {
      const current = prev.napMinutes ?? null;
      if (current === null) return { ...prev, napMinutes: direction > 0 ? NAP_DEFAULT_MINUTES : null };
      const next = current + direction * NAP_MINUTES_STEP;
      return { ...prev, napMinutes: next <= 0 ? null : Math.min(NAP_MINUTES_MAX, next) };
    });

  const toggleLevel = (key: WellbeingScaleKey, level: WellbeingLevel) =>
    // Retaper le niveau choisi le retire : seul moyen de corriger une erreur de tap sans quitter.
    setValues((prev) => ({ ...prev, [key]: prev[key] === level ? null : level }));
  const toggleTag = (tag: WellbeingTag) => setValues((prev) => ({ ...prev, [tag]: prev[tag] !== true }));

  const sameDayWeightKg = latest && latest.logDate === logDate ? latest.weightKg : null;
  const weightValue = weightText ?? (sameDayWeightKg == null ? '' : String(units.toWeightValue(sameDayWeightKg)));
  const weightKg = units.parseWeightToKg(weightValue);
  const hasWeight = isMorning && weightKg != null && weightKg > 0;
  const weightChanged = hasWeight && weightKg !== sameDayWeightKg;

  /** Ce que la feuille écrit : les champs de SON moment seulement, avec `null` pour un champ vidé. */
  const payload = (): WellbeingCheckinInput => {
    const out: WellbeingCheckinInput = {};
    const scales: WellbeingScaleKey[] = isMorning ? [...MORNING_SCALES] : [...EVENING_SCALES, ...(modules.cravings ? (['cravings'] as const) : [])];
    for (const key of scales) out[key] = values[key] ?? null;
    for (const tag of isMorning ? MORNING_TAG_LIST : EVENING_TAG_LIST) out[tag] = values[tag] === true;
    if (isMorning) {
      // Règle 2 : une nuit lue et non touchée ne part pas.
      if (sleepTouched || existing?.sleepSource !== 'health_connect') out.sleepMinutes = values.sleepMinutes ?? null;
    } else {
      if (modules.alcohol) out.alcoholDrinks = values.alcoholDrinks ?? null;
      if (modules.caffeine) out.lateCaffeine = values.lateCaffeine ?? null;
      if (modules.nap) out.napMinutes = values.napMinutes ?? null;
    }
    return out;
  };

  const body = payload();
  const canSave = !isEmptyCheckin(body) || hasWeight || existing !== null;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveWellbeing(logDate, body);
      if (weightChanged && weightKg != null) await logWeight(logDate, weightKg);
      onDone();
    } catch {
      // Un échec doit se voir : sans ça l'utilisateur croit avoir enregistré (leçon CONF-06).
      setError(t('wellbeing.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const chip = (selected: boolean) => [
    styles.chip,
    { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.track : 'transparent' },
  ];

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.overline, { color: colors.accent }]}>
        {t(isMorning ? 'wellbeing.moments.morning.overline' : 'wellbeing.moments.evening.overline')}
      </Text>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {t(isMorning ? 'wellbeing.moments.morning.title' : 'wellbeing.moments.evening.title')}
      </Text>
      <Text style={[styles.day, { color: colors.textMuted }]}>{formatDayFull(logDate)}</Text>

      {isMorning ? (
        <>
          <View style={[styles.box, { borderColor: colors.border }]} testID="moment-sleep">
            <View style={styles.boxHead}>
              <Text style={[styles.label, { color: colors.text }]}>{t('wellbeing.sleepLabel')}</Text>
              {fromHealthConnect ? (
                <Text style={[styles.badge, { color: colors.accent, borderColor: colors.accent }]}>{t('wellbeing.moments.fromHealthConnect')}</Text>
              ) : null}
              {/* « Non renseignée » reste atteignable (règle de BIEN-01 / LABO-01) — sauf pour une nuit
                  lue : effacée, la lecture suivante la réécrirait. Elle se corrige avec − / +. */}
              {sleepMinutes !== null && existing?.sleepSource !== 'health_connect' ? (
                <Text
                  testID="moment-sleep-clear"
                  accessibilityRole="button"
                  onPress={() => {
                    setSleepTouched(true);
                    setValues((prev) => ({ ...prev, sleepMinutes: null }));
                  }}
                  style={[styles.clear, { color: colors.textMuted }]}
                >
                  {t('wellbeing.sleepClear')}
                </Text>
              ) : null}
            </View>
            <View style={styles.stepRow}>
              <Stepper
                label={t('wellbeing.sleepLess')}
                icon="remove"
                onPress={() => stepSleep(-1)}
                disabled={sleepMinutes !== null && sleepMinutes <= SLEEP_MINUTES_MIN}
              />
              <Text
                testID="moment-sleep-value"
                style={[styles.stepValue, { color: sleepMinutes === null ? colors.textMuted : colors.text }]}
                maxFontSizeMultiplier={1.4}
              >
                {sleepMinutes === null ? t('wellbeing.sleepNone') : formatMinutes(sleepMinutes)}
              </Text>
              <Stepper
                label={t('wellbeing.sleepMore')}
                icon="add"
                onPress={() => stepSleep(1)}
                disabled={sleepMinutes !== null && sleepMinutes >= SLEEP_MINUTES_MAX}
              />
            </View>
          </View>
          {MORNING_SCALES.map((key) => (
            <WellbeingScale key={key} indicator={key} value={values[key] ?? null} onChange={(level) => toggleLevel(key, level)} />
          ))}
          <Text style={[styles.label, { color: colors.text }]}>{t('wellbeing.moments.tagsTitle')}</Text>
          <View style={styles.chips}>
            {MORNING_TAG_LIST.map((tag) => (
              <Pressable
                key={tag}
                testID={`moment-tag-${tag}`}
                onPress={() => toggleTag(tag)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: values[tag] === true }}
                style={chip(values[tag] === true)}
              >
                <Text style={[styles.chipLabel, { color: colors.text }]}>{t(`wellbeing.tags.${tag}`)}</Text>
              </Pressable>
            ))}
            {painJournal ? (
              <Pressable
                testID="moment-soreness"
                onPress={() => {
                  onDone();
                  router.push('/pain');
                }}
                accessibilityRole="link"
                accessibilityHint={t('wellbeing.moments.sorenessHint')}
                style={chip(false)}
              >
                <Text style={[styles.chipLabel, { color: colors.text }]}>{t('wellbeing.moments.soreness')}</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={[styles.weightCard, { borderColor: colors.border }]}>
            <View style={styles.grow}>
              <Text style={[styles.label, { color: colors.text }]}>{t('wellbeing.weightLabel')}</Text>
              <Text style={[styles.hint, { color: colors.textMuted }]}>{t('wellbeing.weightHint')}</Text>
            </View>
            <TextInput
              value={weightValue}
              onChangeText={setWeightText}
              keyboardType="decimal-pad"
              placeholder={units.weightSymbol}
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={t('wellbeing.weightLabel')}
              maxFontSizeMultiplier={1.4}
              style={[styles.weightInput, { color: colors.text, borderColor: colors.border }]}
            />
          </View>

          {onCatchUpYesterday ? (
            <Pressable
              testID="moment-catch-up"
              onPress={onCatchUpYesterday}
              accessibilityRole="button"
              style={[styles.catchUp, { borderColor: colors.border }]}
            >
              <Text style={[styles.catchUpText, { color: colors.text }]}>{t('wellbeing.moments.catchUp')}</Text>
              <Text style={[styles.hint, { color: colors.textMuted }]}>{t('wellbeing.moments.catchUpHint')}</Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <>
          {EVENING_SCALES.map((key) => (
            <WellbeingScale key={key} indicator={key} value={values[key] ?? null} onChange={(level) => toggleLevel(key, level)} />
          ))}
          <Text style={[styles.label, { color: colors.text }]}>{t('wellbeing.moments.tagsTitle')}</Text>
          <View style={styles.chips}>
            {EVENING_TAG_LIST.map((tag) => (
              <Pressable
                key={tag}
                testID={`moment-tag-${tag}`}
                onPress={() => toggleTag(tag)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: values[tag] === true }}
                style={chip(values[tag] === true)}
              >
                <Text style={[styles.chipLabel, { color: colors.text }]}>{t(`wellbeing.tags.${tag}`)}</Text>
              </Pressable>
            ))}
          </View>

          {modules.alcohol ? (
            <View style={styles.module} testID="moment-alcohol">
              <Text style={[styles.label, { color: colors.text }]}>{t('wellbeing.modules.alcohol.question')}</Text>
              <View style={styles.chips} accessibilityRole="radiogroup">
                {Array.from({ length: ALCOHOL_DRINKS_MAX + 1 }, (_, n) => n).map((n) => {
                  const selected = values.alcoholDrinks === n;
                  return (
                    <Pressable
                      key={n}
                      onPress={() => setValues((prev) => ({ ...prev, alcoholDrinks: prev.alcoholDrinks === n ? null : n }))}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={t('wellbeing.modules.alcohol.a11y', { count: n })}
                      style={[chip(selected), styles.chipSquare]}
                    >
                      <Text style={[styles.chipLabel, { color: colors.text }]}>
                        {n === ALCOHOL_DRINKS_MAX ? t('wellbeing.modules.alcohol.max') : String(n)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.hint, { color: colors.textMuted }]}>{t('wellbeing.modules.alcohol.hint')}</Text>
            </View>
          ) : null}

          {modules.caffeine ? (
            <View style={styles.module} testID="moment-caffeine">
              <Text style={[styles.label, { color: colors.text }]}>{t('wellbeing.modules.caffeine.question')}</Text>
              <View style={styles.chips} accessibilityRole="radiogroup">
                {([true, false] as const).map((answer) => {
                  const selected = values.lateCaffeine === answer;
                  return (
                    <Pressable
                      key={String(answer)}
                      onPress={() => setValues((prev) => ({ ...prev, lateCaffeine: prev.lateCaffeine === answer ? null : answer }))}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      style={chip(selected)}
                    >
                      <Text style={[styles.chipLabel, { color: colors.text }]}>{t(answer ? 'wellbeing.modules.caffeine.yes' : 'wellbeing.modules.caffeine.no')}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {modules.cravings ? (
            <WellbeingScale indicator="cravings" value={values.cravings ?? null} onChange={(level) => toggleLevel('cravings', level)} />
          ) : null}

          {modules.nap ? (
            <View style={[styles.box, { borderColor: colors.border }]} testID="moment-nap">
              <Text style={[styles.label, { color: colors.text }]}>{t('wellbeing.modules.nap.question')}</Text>
              <View style={styles.stepRow}>
                <Stepper label={t('wellbeing.modules.nap.less')} icon="remove" onPress={() => stepNap(-1)} disabled={(values.napMinutes ?? null) === null} />
                <Text style={[styles.stepValue, { color: (values.napMinutes ?? null) === null ? colors.textMuted : colors.text }]} maxFontSizeMultiplier={1.4}>
                  {(values.napMinutes ?? null) === null ? t('wellbeing.modules.nap.none') : formatMinutes(values.napMinutes as number)}
                </Text>
                <Stepper
                  label={t('wellbeing.modules.nap.more')}
                  icon="add"
                  onPress={() => stepNap(1)}
                  disabled={(values.napMinutes ?? 0) >= NAP_MINUTES_MAX}
                />
              </View>
            </View>
          ) : null}
        </>
      )}

      {error !== null && (
        <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
          {error}
        </Text>
      )}

      <Button label={t('wellbeing.moments.save')} onPress={submit} disabled={!canSave} loading={saving} />
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('wellbeing.partialHint')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, maxHeight: '92%' },
  content: { padding: 20, gap: 14 },
  overline: { fontFamily: fontFamily.bodyBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 22, marginTop: -8 },
  day: { fontFamily: fontFamily.body, fontSize: 13, marginTop: -10 },
  box: { gap: 10, borderWidth: 1, borderRadius: 14, padding: 13 },
  boxHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badge: { fontFamily: fontFamily.bodySemi, fontSize: 11, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  clear: { fontFamily: fontFamily.body, fontSize: 12, textDecorationLine: 'underline' },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stepValue: { flex: 1, textAlign: 'center', fontFamily: fontFamily.bodySemi, fontSize: 17 },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  hint: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipSquare: { minWidth: 52 },
  chipLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  module: { gap: 8 },
  grow: { flex: 1, minWidth: 0 },
  weightCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 13 },
  weightInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minWidth: 96,
    textAlign: 'right',
    fontFamily: fontFamily.bodySemi,
    fontSize: 15,
  },
  catchUp: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 12, gap: 2 },
  catchUpText: { fontFamily: fontFamily.bodySemi, fontSize: 13.5 },
  error: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
});
