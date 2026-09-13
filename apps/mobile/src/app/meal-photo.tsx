/**
 * US DASH-01 (§7.2) — **photo du repas** : capturer, faire reconnaître, ajuster, ajouter.
 *
 * ── Ce que le modèle fait, et surtout ce qu'il ne fait pas ───────────────────────────────────────
 * Il rend des **aliments et des grammes**, jamais des calories. Les calories, les protéines et le
 * reste sont calculés ici, à partir du **catalogue local** (R5) : c'est ce qui rend le résultat
 * corrigeable (ajuster une portion recalcule tout) et cohérent avec le journal. Un aliment que le
 * catalogue ne connaît pas est affiché sans valeur et ne s'ajoute pas — mieux vaut une ligne
 * manquante qu'une ligne fausse.
 *
 * ── Les quatre refus ─────────────────────────────────────────────────────────────────────────────
 *  - **Sans consentement**, l'écran ne propose pas l'analyse : il renvoie vers les Réglages (§7.1).
 *  - **Hors ligne**, la photo est **gardée** et proposée au retour du réseau — jamais perdue, jamais
 *    envoyée en douce (`ai-photo-queue-store`).
 *  - **Rien n'est ajouté sans validation** : l'utilisateur voit ce qui va être écrit, et l'écrit.
 *  - **La ligne la moins sûre est signalée** — c'est celle qu'il faut regarder d'abord.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import {
  AI_LOW_CONFIDENCE,
  matchPhotoItems,
  mealPhotoResultSchema,
  parseAiJson,
  photoMealTotals,
  stepPortion,
  type CatalogCandidate,
  type MatchedPhotoItem,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PressableScale } from '@/components/motion/PressableScale';
import { addFoodEntry } from '@/data/repositories/journal-repository';
import { useFoodsByNames, type FoodListItem } from '@/data/repositories/food-repository';
import { useAiAvailability } from '@/hooks/useAiAvailability';
import { useTodayKey } from '@/hooks/useTodayKey';
import { callAiAssist, type AiErrorCode } from '@/lib/ai/ai-client';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics';
import { useAiPhotoQueue } from '@/stores/ai-photo-queue-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Phase = 'camera' | 'analyzing' | 'review' | 'error';

export default function MealPhotoScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const todayKey = useTodayKey();
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const dayKey = typeof params.date === 'string' ? params.date : todayKey;
  const mealKey = typeof params.meal === 'string' ? params.meal : 'snack';

  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const ai = useAiAvailability('photo');
  const pending = useAiPhotoQueue((s) => s.pending);
  const enqueue = useAiPhotoQueue((s) => s.enqueue);
  const clearPending = useAiPhotoQueue((s) => s.clear);
  const hydrate = useAiPhotoQueue((s) => s.hydrate);

  const [phase, setPhase] = useState<Phase>('camera');
  const [error, setError] = useState<AiErrorCode | null>(null);
  const [items, setItems] = useState<MatchedPhotoItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Les aliments du catalogue qui portent les noms rendus par le modèle : c'est EUX qui donnent les
  // valeurs nutritionnelles. Requête montée avec les noms, donc vide tant qu'il n'y a pas d'analyse.
  const [names, setNames] = useState<string[]>([]);
  const { foods } = useFoodsByNames(names);

  const candidates = useMemo<CatalogCandidate[]>(
    () =>
      foods.map((food: FoodListItem) => ({
        id: food.id,
        name: food.name,
        kcal100: food.kcalPer100g,
        protein100: food.proteinPer100g ?? 0,
        carbs100: food.carbsPer100g ?? 0,
        fat100: food.fatPer100g ?? 0,
      })),
    [foods],
  );

  /**
   * Le rapprochement nom → aliment du catalogue. Le premier candidat dont le nom **contient** celui
   * rendu par le modèle, ou l'inverse : « poulet grillé » doit retrouver « Poulet (blanc, cuit) ».
   */
  const lookup = useMemo(
    () => (name: string) => {
      const needle = name.trim().toLowerCase();
      return candidates.filter((candidate) => {
        const hay = candidate.name.toLowerCase();
        return hay.includes(needle) || needle.includes(hay);
      });
    },
    [candidates],
  );

  /**
   * Les lignes telles qu'elles s'affichent : l'état porte les **grammes** (que l'utilisateur
   * corrige), le catalogue porte les **valeurs**. Le rapprochement est donc dérivé à chaque rendu
   * plutôt que recopié dans l'état — sinon une réponse tardive du catalogue écraserait une portion
   * déjà ajustée.
   */
  const resolved = useMemo(
    () =>
      matchPhotoItems(
        items.map((item) => ({
          name: item.name,
          grams: item.grams,
          confidence: item.lowConfidence ? 0 : 1,
        })),
        lookup,
      ),
    [items, lookup],
  );

  const totals = photoMealTotals(resolved);

  /** Prend la photo, puis analyse — ou met en attente si le réseau manque. */
  const capture = async () => {
    const shot = await camera.current?.takePictureAsync({ quality: 0.55, base64: false });
    if (!shot?.uri) return;

    if (!ai.online) {
      // Hors ligne : la photo est gardée, jamais perdue — et rien ne part dans le dos (§7.2).
      enqueue({ uri: shot.uri, dayKey, mealKey, takenAt: new Date().toISOString() });
      setError('offline');
      setPhase('error');
      return;
    }
    await analyze(shot.uri);
  };

  const analyze = async (uri: string) => {
    setPhase('analyzing');
    setError(null);
    try {
      const imageBase64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const result = await callAiAssist({ kind: 'photo', imageBase64, imageMediaType: 'image/jpeg' });
      if (!result.ok) {
        setError(result.code);
        setPhase('error');
        return;
      }

      // Le texte du modèle n'est JAMAIS lu tel quel : zod le valide, sinon on le jette.
      const parsed = parseAiJson(mealPhotoResultSchema, result.text);
      if (!parsed) {
        setError('failed');
        setPhase('error');
        return;
      }

      clearPending();
      setNames(parsed.items.map((item) => item.name));
      // Les valeurs arrivent au rendu suivant, quand la requête catalogue a répondu : on pose
      // d'abord les lignes sans correspondance, `matchPhotoItems` les complète ensuite.
      setItems(matchPhotoItems(parsed.items, () => []));
      setPhase('review');
      void track(ANALYTICS_EVENTS.aiPhotoUsed);
    } catch {
      setError('failed');
      setPhase('error');
    }
  };

  const adjust = (index: number, direction: 1 | -1) => {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, grams: stepPortion(item.grams, direction) } : item)),
    );
  };

  const remove = (index: number) => setItems((current) => current.filter((_, i) => i !== index));

  const addAll = async () => {
    setSaving(true);
    try {
      for (const item of resolved) {
        if (!item.food) continue;
        const ratio = item.grams / 100;
        await addFoodEntry(dayKey, mealKey, {
          foodId: item.food.id,
          name: item.food.name,
          quantityG: item.grams,
          kcal: Math.round(item.food.kcal100 * ratio),
          proteinG: Math.round(item.food.protein100 * ratio),
          carbsG: Math.round(item.food.carbs100 * ratio),
          fatG: Math.round(item.food.fat100 * ratio),
        });
      }
      router.back();
    } catch {
      setError('failed');
      setPhase('error');
    } finally {
      setSaving(false);
    }
  };

  // ── Sans consentement : on explique, on n'analyse pas ──────────────────────────────────────────
  if (!ai.consented) {
    return (
      <Screen>
        <ScreenHeader title={t('mealPhoto.title')} />
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={44} color={colors.textMuted} />
          <Text style={[styles.info, { color: colors.text }]}>{t('mealPhoto.consentNeeded')}</Text>
          <Button label={t('mealPhoto.openSettings')} onPress={() => router.push('/settings')} />
        </View>
      </Screen>
    );
  }

  if (permission?.granted !== true) {
    return (
      <Screen>
        <ScreenHeader title={t('mealPhoto.title')} />
        <View style={styles.centered}>
          <Ionicons name="camera-outline" size={44} color={colors.textMuted} />
          <Text style={[styles.info, { color: colors.text }]}>{t('scan.permission')}</Text>
          <Button label={t('scan.grant')} onPress={() => void requestPermission()} />
        </View>
      </Screen>
    );
  }

  if (phase === 'analyzing') {
    return (
      <Screen>
        <ScreenHeader title={t('mealPhoto.title')} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.info, { color: colors.textMuted }]}>{t('mealPhoto.analyzing')}</Text>
        </View>
      </Screen>
    );
  }

  if (phase === 'error') {
    return (
      <Screen>
        <ScreenHeader title={t('mealPhoto.title')} />
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={44} color={colors.textMuted} />
          <Text style={[styles.info, { color: colors.text }]}>
            {t(`mealPhoto.errors.${error ?? 'failed'}`)}
          </Text>
          {/* Hors ligne, la photo attend : on propose de réessayer, pas de recommencer. */}
          {pending ? (
            <Button
              label={t('mealPhoto.retryPending')}
              onPress={() => void analyze(pending.uri)}
              disabled={!ai.online}
            />
          ) : (
            <Button label={t('mealPhoto.retake')} onPress={() => setPhase('camera')} />
          )}
          <Button label={t('common.close')} variant="ghost" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  if (phase === 'review') {
    const addable = resolved.filter((item) => item.food).length;
    return (
      <Screen>
        <ScreenHeader title={t('mealPhoto.title')} subtitle={t('mealPhoto.reviewHint')} />
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {resolved.map((item, index) => (
            <View
              key={`${item.name}-${index}`}
              style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <View style={styles.rowTexts}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {item.food?.name ?? item.name}
                </Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {item.food
                    ? t('mealPhoto.line', { grams: item.grams, kcal: item.kcal ?? 0 })
                    : t('mealPhoto.unknownFood')}
                </Text>
                {/* La ligne la moins sûre est nommée : c'est celle qu'il faut regarder. */}
                {item.lowConfidence ? (
                  <Text style={[styles.low, { color: colors.warnText }]}>
                    {t('mealPhoto.lowConfidence', { percent: Math.round(AI_LOW_CONFIDENCE * 100) })}
                  </Text>
                ) : null}
              </View>
              <View style={styles.stepper}>
                <PressableScale
                  haptic="select"
                  onPress={() => adjust(index, -1)}
                  accessibilityRole="button"
                  accessibilityLabel={t('mealPhoto.less', { name: item.food?.name ?? item.name })}
                  style={[styles.stepBtn, { borderColor: colors.borderStrong }]}
                >
                  <Text style={[styles.stepLabel, { color: colors.accent }]}>−</Text>
                </PressableScale>
                <PressableScale
                  haptic="select"
                  onPress={() => adjust(index, 1)}
                  accessibilityRole="button"
                  accessibilityLabel={t('mealPhoto.more', { name: item.food?.name ?? item.name })}
                  style={[styles.stepBtn, { borderColor: colors.borderStrong }]}
                >
                  <Text style={[styles.stepLabel, { color: colors.accent }]}>+</Text>
                </PressableScale>
                <Pressable
                  onPress={() => remove(index)}
                  accessibilityRole="button"
                  accessibilityLabel={t('mealPhoto.remove', { name: item.food?.name ?? item.name })}
                  hitSlop={8}
                  style={styles.removeBtn}
                >
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>
          ))}

          {resolved.length === 0 ? (
            <Text style={[styles.info, { color: colors.textMuted }]}>{t('mealPhoto.nothingFound')}</Text>
          ) : (
            <Text style={[styles.total, { color: colors.text }]}>
              {t('mealPhoto.total', { kcal: totals.kcal, protein: Math.round(totals.proteinG) })}
            </Text>
          )}
        </ScrollView>

        <View style={styles.actions}>
          <Button
            label={t('mealPhoto.addAll', { count: addable })}
            onPress={() => void addAll()}
            disabled={addable === 0 || saving}
          />
          <Button label={t('mealPhoto.retake')} variant="ghost" onPress={() => setPhase('camera')} />
        </View>
      </Screen>
    );
  }

  // ── Caméra ────────────────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />
      <View style={styles.overlay}>
        {pending ? (
          <View style={styles.pendingBanner}>
            <Image source={{ uri: pending.uri }} style={styles.thumb} />
            <Text style={styles.pendingText}>{t('mealPhoto.pending')}</Text>
            <Button
              label={t('mealPhoto.retryPending')}
              onPress={() => void analyze(pending.uri)}
              disabled={!ai.online}
            />
          </View>
        ) : (
          <Text style={styles.hint}>{t('mealPhoto.hint')}</Text>
        )}
        <PressableScale
          haptic="confirm"
          onPress={() => void capture()}
          accessibilityRole="button"
          accessibilityLabel={t('mealPhoto.capture')}
          style={styles.shutter}
        >
          <View style={styles.shutterInner} />
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 24,
    gap: 18,
  },
  hint: { fontFamily: fontFamily.bodyMedium, fontSize: 14, color: '#fff', textAlign: 'center' },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
  pendingBanner: {
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  pendingText: { fontFamily: fontFamily.bodyMedium, fontSize: 13, color: '#fff', textAlign: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  info: { fontFamily: fontFamily.body, fontSize: 14.5, lineHeight: 21, textAlign: 'center' },
  list: { gap: 10, paddingBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 12 },
  rowTexts: { flex: 1, gap: 2 },
  name: { fontFamily: fontFamily.bodyBold, fontSize: 14.5 },
  meta: { fontFamily: fontFamily.bodyMedium, fontSize: 12.5 },
  low: { fontFamily: fontFamily.bodySemi, fontSize: 11.5 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: { fontFamily: fontFamily.displayBold, fontSize: 17 },
  removeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  total: { fontFamily: fontFamily.displayBold, fontSize: 16, marginTop: 4 },
  actions: { gap: 8 },
});
