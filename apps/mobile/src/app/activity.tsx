/**
 * US AUTRE-01 — **saisir une autre activité** (vélo, natation, rando…), et voir ce que ça change.
 *
 * Un seul écran, deux états :
 *  1. **la saisie** — type, durée, intensité, et deux champs facultatifs (distance, chiffre de
 *     montre). La dépense se recalcule à chaque geste, en bas, avant même d'enregistrer ;
 *  2. **« ce que ça change »**, après enregistrement — la cible du jour, la série, la charge de la
 *     semaine et Health Connect. C'est la moitié utile de l'US : sans elle, l'activité aurait l'air
 *     d'être notée dans le vide, alors qu'elle irrigue quatre calculs.
 *
 * ── L'intensité se déclare au test de la parole ─────────────────────────────────────────────────
 * « Tu peux chanter / parler / quelques mots » plutôt qu'une échelle 1-10 : personne ne sait dire
 * « 7/10 » sans cardiofréquencemètre, et le test de la parole est enseigné partout. Il préremplit un
 * ressenti, qui est **ce qui donne sa charge à l'activité**.
 *
 * ⚠️ Ni « Course » ni « Musculation » dans le catalogue (décision D5) : elles ont leur pilier, avec
 * leurs records, leurs allures et leur historique. L'écran renvoie vers eux plutôt que de créer un
 * doublon que rien ne saurait dédoublonner ensuite.
 */

import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ACTIVITY_INTENSITIES,
  ACTIVITY_INTENSITY_RPE,
  ACTIVITY_TYPES,
  FREQUENT_ACTIVITY_TYPES,
  activityTypeDef,
  estimateActivityEnergy,
  formatHoursMinutes,
  localDayKey,
  sessionLoad,
  type ActivityIntensity,
} from '@wellness/shared';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormScreen } from '@/components/FormScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { EnergyCard } from '@/components/energy/EnergyCard';
import {
  addActivity,
  deleteActivity,
  updateActivity,
  useActivity,
  useActivityHabits,
} from '@/data/repositories/activity-repository';
import { useDayCalorieTarget, useStreakData } from '@/data/repositories/dashboard-repository';
import { useRestingMetabolismAt } from '@/data/repositories/energy-repository';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';
import { useSettings } from '@/data/repositories/settings-repository';
import { pushActivity } from '@/lib/health-connect';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Préréglages de durée — ils couvrent l'immense majorité des saisies réelles. */
const DURATION_PRESETS = [30, 45, 60, 90] as const;
/** Pas du stepper, en minutes. */
const DURATION_STEP = 5;
const MIN_MINUTES = 5;
const MAX_MINUTES = 600;

export default function ActivityScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editingId = typeof params.id === 'string' && params.id.length > 0 ? params.id : null;

  const { activity } = useActivity(editingId);
  const { habits } = useActivityHabits();
  const { settings } = useSettings();
  const { nutritionProfile } = useNutritionProfile();

  const [typeId, setTypeId] = useState<string>('bike');
  const [minutes, setMinutes] = useState(60);
  const [intensity, setIntensity] = useState<ActivityIntensity>('moderate');
  const [distanceKm, setDistanceKm] = useState('');
  const [deviceKcal, setDeviceKcal] = useState('');
  const [showAllTypes, setShowAllTypes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  /** Une seule hydratation depuis la base : sinon chaque frappe serait écrasée par la ligne. */
  const [hydrated, setHydrated] = useState(false);

  if (editingId && activity && !hydrated) {
    setHydrated(true);
    setTypeId(activity.activityType);
    setMinutes(Math.round(activity.durationSeconds / 60));
    setIntensity(activity.intensity);
    setDistanceKm(activity.distanceM != null ? String(activity.distanceM / 1000) : '');
    setDeviceKcal(activity.deviceKcal != null ? String(activity.deviceKcal) : '');
  }

  const todayKey = localDayKey(new Date());
  const { resting } = useRestingMetabolismAt(todayKey);
  const { effectiveTarget } = useDayCalorieTarget(todayKey);
  const streak = useStreakData();

  const def = activityTypeDef(typeId);
  const durationSeconds = minutes * 60;
  const distanceM = (() => {
    const km = Number(distanceKm.replace(',', '.'));
    return Number.isFinite(km) && km > 0 ? Math.round(km * 1000) : null;
  })();
  const deviceKcalValue = (() => {
    const kcal = Number(deviceKcal);
    return Number.isFinite(kcal) && kcal > 0 ? Math.round(kcal) : null;
  })();

  const estimate = useMemo(
    () =>
      estimateActivityEnergy({
        activityType: typeId,
        intensity,
        durationSeconds,
        distanceM,
        deviceKcal: deviceKcalValue,
        resting,
      }),
    [typeId, intensity, durationSeconds, distanceM, deviceKcalValue, resting],
  );

  const visibleTypes = showAllTypes
    ? ACTIVITY_TYPES.map((a) => a.id)
    : FREQUENT_ACTIVITY_TYPES;

  const onSave = async () => {
    setSaving(true);
    try {
      const startedAt = new Date(Date.now() - durationSeconds * 1000).toISOString();
      if (editingId) {
        await updateActivity(editingId, {
          activityType: typeId,
          durationSeconds,
          intensity,
          distanceM,
          deviceKcal: deviceKcalValue,
        });
        // ⚠️ Health Connect n'est pas réécrit à l'édition : `clientRecordId` rendrait l'opération
        // idempotente, mais la permission peut avoir été révoquée entre-temps et l'écriture est
        // déjà fire-and-forget. Limite assumée, notée dans RECETTES.md.
        router.back();
        return;
      }
      const id = await addActivity({
        activityType: typeId,
        startedAt,
        durationSeconds,
        intensity,
        distanceM,
        deviceKcal: deviceKcalValue,
      });
      // Fire-and-forget, exactement comme `finishWorkout` : une écriture santé ne doit jamais
      // retarder l'interface ni faire échouer l'enregistrement local.
      void pushActivity(id, t(`activity.types.${def.id}`));
      setSavedId(id);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!editingId) return;
    Alert.alert(t('activity.delete.title'), t('activity.delete.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          // `.catch` obligatoire : un `void … .then(…)` nu laisse un rejet non capturé (test de
          // garde `no-uncaught-void-then`). Ici l'échec est bénin — la ligne reste, l'utilisateur
          // réessaie — mais il ne doit pas remonter en rejet non géré.
          void deleteActivity(editingId)
            .then(() => router.back())
            .catch(() => undefined);
        },
      },
    ]);
  };

  // ── État 2 : ce que ça change ─────────────────────────────────────────────
  if (savedId !== null) {
    const rpe = ACTIVITY_INTENSITY_RPE[intensity];
    const load = Math.round(sessionLoad({ rpe, durationSeconds }));
    const followsEnergy = (nutritionProfile?.trainingBonusMode ?? 'fixed') === 'activities';
    const hcOn = settings?.healthConnectEnabled ?? false;

    return (
      <FormScreen>
        <ScreenHeader
          title={t('activity.saved.title', { type: t(`activity.types.${def.id}`) })}
          subtitle={t('activity.saved.subtitle', {
            duration: formatHoursMinutes(durationSeconds),
            intensity: t(`activity.intensity.${intensity}.label`).toLowerCase(),
          })}
        />

        <Card>
          <Text style={[styles.effectsTitle, { color: colors.textMuted }]}>{t('activity.saved.effects')}</Text>
          {followsEnergy && estimate ? (
            <EffectRow
              icon="restaurant-outline"
              label={t('activity.saved.target')}
              detail={
                effectiveTarget != null
                  ? t('activity.saved.targetDetail', { target: effectiveTarget })
                  : t('activity.saved.targetNoProfile')
              }
              value={`+${estimate.low}`}
            />
          ) : (
            <EffectRow
              icon="restaurant-outline"
              label={t('activity.saved.targetOff')}
              detail={t('activity.saved.targetOffDetail')}
              value=""
            />
          )}
          <EffectRow
            icon="flame-outline"
            label={t('activity.saved.streak')}
            detail={t('activity.saved.streakDetail')}
            value={t('activity.saved.streakValue', { count: streak.current })}
          />
          <EffectRow
            icon="speedometer-outline"
            label={t('activity.saved.load')}
            detail={t('activity.saved.loadDetail', { rpe, minutes })}
            value={`+${load}`}
          />
          <EffectRow
            icon="heart-outline"
            label={t('activity.saved.healthConnect')}
            detail={hcOn ? t('activity.saved.healthConnectOn') : t('activity.saved.healthConnectOff')}
            value=""
          />
        </Card>

        <Button label={t('common.done')} onPress={() => router.back()} />
        <Button
          label={t('activity.saved.edit')}
          variant="ghost"
          onPress={() => {
            setSavedId(null);
            router.replace({ pathname: '/activity', params: { id: savedId } });
          }}
        />
      </FormScreen>
    );
  }

  // ── État 1 : la saisie ────────────────────────────────────────────────────
  return (
    <FormScreen>
      <ScreenHeader title={editingId ? t('activity.editTitle') : t('activity.title')} />

      {!editingId && habits.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('activity.habits')}</Text>
          <View style={styles.habitRow}>
            {habits.map((h) => (
              <Pressable
                key={`${h.activityType}-${h.durationSeconds}-${h.intensity}`}
                onPress={() => {
                  setTypeId(h.activityType);
                  setMinutes(Math.round(h.durationSeconds / 60));
                  setIntensity(h.intensity);
                }}
                accessibilityRole="button"
                style={[styles.habit, { borderColor: colors.border, backgroundColor: colors.surface }]}
              >
                <Text style={[styles.habitLabel, { color: colors.text }]}>
                  {t(`activity.types.${activityTypeDef(h.activityType).id}`)}
                </Text>
                <Text style={[styles.habitSub, { color: colors.textMuted }]}>
                  {formatHoursMinutes(h.durationSeconds)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('activity.type')}</Text>
        <View style={styles.grid}>
          {visibleTypes.map((id) => {
            const selected = id === typeId;
            return (
              <Pressable
                key={id}
                onPress={() => setTypeId(id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.tile,
                  selected
                    ? { borderColor: colors.accent, borderWidth: 2, backgroundColor: colors.surface }
                    : { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
                ]}
              >
                <Text
                  style={[styles.tileLabel, { color: selected ? colors.accent : colors.text }]}
                  numberOfLines={2}
                >
                  {t(`activity.types.${id}`)}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setShowAllTypes((v) => !v)}
            accessibilityRole="button"
            style={[styles.tile, { borderColor: colors.borderStrong, borderStyle: 'dashed' }]}
          >
            <Text style={[styles.tileLabel, { color: colors.textMuted }]} numberOfLines={2}>
              {showAllTypes ? t('activity.showLess') : t('activity.showAll')}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('activity.duration')}</Text>
        <View style={styles.stepperRow}>
          <Pressable
            onPress={() => setMinutes((m) => Math.max(MIN_MINUTES, m - DURATION_STEP))}
            accessibilityRole="button"
            accessibilityLabel={t('activity.durationMinus')}
            style={[styles.round, { borderColor: colors.borderStrong }]}
          >
            <Ionicons name="remove" size={20} color={colors.text} />
          </Pressable>
          <Text style={[styles.duration, { color: colors.text }]}>{formatHoursMinutes(durationSeconds)}</Text>
          <Pressable
            onPress={() => setMinutes((m) => Math.min(MAX_MINUTES, m + DURATION_STEP))}
            accessibilityRole="button"
            accessibilityLabel={t('activity.durationPlus')}
            style={[styles.round, { borderColor: colors.borderStrong }]}
          >
            <Ionicons name="add" size={20} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.presetRow}>
          {DURATION_PRESETS.map((p) => {
            const selected = p === minutes;
            return (
              <Pressable
                key={p}
                onPress={() => setMinutes(p)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.preset,
                  selected
                    ? { backgroundColor: colors.panel, borderColor: colors.panel }
                    : { borderColor: colors.border },
                ]}
              >
                <Text style={[styles.presetLabel, { color: selected ? colors.panelText : colors.text }]}>
                  {formatHoursMinutes(p * 60)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('activity.intensityLabel')}</Text>
        <View style={styles.intensityRow}>
          {ACTIVITY_INTENSITIES.map((level) => {
            const selected = level === intensity;
            return (
              <Pressable
                key={level}
                onPress={() => setIntensity(level)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.intensity,
                  selected
                    ? { borderColor: colors.accent, borderWidth: 2, backgroundColor: colors.surface }
                    : { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
                ]}
              >
                <Text style={[styles.intensityLabel, { color: selected ? colors.accent : colors.text }]}>
                  {t(`activity.intensity.${level}.label`)}
                </Text>
                <Text style={[styles.intensityHint, { color: colors.textMuted }]}>
                  {t(`activity.intensity.${level}.hint`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {def.distanceUseful ? (
        <TextField
          label={t('activity.distance')}
          value={distanceKm}
          onChangeText={setDistanceKm}
          keyboardType="decimal-pad"
          placeholder={t('activity.distancePlaceholder')}
        />
      ) : null}

      <TextField
        label={t('activity.deviceKcal')}
        value={deviceKcal}
        onChangeText={setDeviceKcal}
        keyboardType="number-pad"
        placeholder={t('activity.deviceKcalPlaceholder')}
      />

      <EnergyCard
        estimate={estimate}
        resting={resting}
        activeMinutes={minutes}
        detail={t('activity.estimateDetail', {
          type: t(`activity.types.${def.id}`),
          intensity: t(`activity.intensity.${intensity}.label`).toLowerCase(),
        })}
      />

      <Button
        label={editingId ? t('common.save') : t('activity.save')}
        onPress={() => void onSave()}
        loading={saving}
        disabled={saving}
      />
      {editingId ? <Button label={t('common.delete')} variant="destructive" onPress={onDelete} /> : null}
    </FormScreen>
  );
}

function EffectRow({
  icon,
  label,
  detail,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail: string;
  value: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.effectRow}>
      <Ionicons name={icon} size={20} color={colors.textMuted} />
      <View style={styles.effectTexts}>
        <Text style={[styles.effectLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.effectDetail, { color: colors.textMuted }]}>{detail}</Text>
      </View>
      {value ? <Text style={[styles.effectValue, { color: colors.text }]}>{value}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  sectionLabel: { fontFamily: fontFamily.monoBold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  habitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  habit: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  habitLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13.5 },
  habitSub: { fontFamily: fontFamily.mono, fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    width: '23%',
    minWidth: 76,
    flexGrow: 1,
    minHeight: 64,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tileLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12.5, textAlign: 'center' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  duration: { fontFamily: fontFamily.displayXBold, fontSize: 34, letterSpacing: -1 },
  presetRow: { flexDirection: 'row', gap: 8 },
  preset: { flex: 1, minHeight: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  presetLabel: { fontFamily: fontFamily.mono, fontSize: 12.5 },
  intensityRow: { flexDirection: 'row', gap: 8 },
  intensity: { flex: 1, minHeight: 72, borderRadius: 14, borderWidth: 1, padding: 10, gap: 3 },
  intensityLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  intensityHint: { fontFamily: fontFamily.body, fontSize: 11.5, lineHeight: 15 },
  effectsTitle: { fontFamily: fontFamily.monoBold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 },
  effectRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  effectTexts: { flex: 1, gap: 2 },
  effectLabel: { fontFamily: fontFamily.bodyBold, fontSize: 14.5 },
  effectDetail: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17 },
  effectValue: { fontFamily: fontFamily.monoBold, fontSize: 15 },
});
