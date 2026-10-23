/**
 * « Ton allure de référence » — les quatre portes (US CARDIO-02, §3.1, D1, D7).
 *
 * ── Pourquoi un écran à part ─────────────────────────────────────────────────────────────────────
 * L'allure de référence produit toutes les allures cibles du pilier, et on ne pouvait la donner que
 * d'une façon : taper « ton allure actuelle sur 5 km » dans le profil coureur, écrite à chaque frappe,
 * sans rien voir de ce qu'elle produisait (F2). Ici, quatre portes — un chrono, le test de 12 minutes,
 * l'allure connue, « je ne sais pas encore » — et un aperçu des allures **avant** de retenir. Rien
 * n'est écrit tant que le coureur n'a pas appuyé sur « Retenir cette allure » (R6).
 *
 * Toutes les entrées y mènent directement (D7) : la carte Premiers pas et la séance du jour du hub, le
 * bandeau des listes de séances, l'éditeur de séance, les zones d'allure, la carte du profil.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { KeyboardAwareScrollView } from '@/components/keyboard';
import {
  ReferencePaceDoors,
  parseReferenceDoor,
  useReferenceDoors,
} from '@/components/running/ReferencePaceDoors';
import { upsertRunnerProfile, useRunnerProfile } from '@/data/repositories/running-profile-repository';
import { useActionLock } from '@/hooks/useActionLock';
import { useMenuFocus } from '@/hooks/useMenuFocus';
import { usePendingCooperTest } from '@/running/cooper-measure';
import { useCooperTest } from '@/stores/cooper-test-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function RunningPaceScreen() {
  // L'identité du pilier appartient à l'écran (CARDIO-UX02) : il s'ouvre depuis le planning aussi.
  useMenuFocus('running');

  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { door } = useLocalSearchParams<{ door?: string }>();
  const { runnerProfile } = useRunnerProfile();
  const current = runnerProfile?.ref5kPaceSPerKm ?? null;
  const pending = usePendingCooperTest();
  const clearCooper = useCooperTest((s) => s.clear);

  const doors = useReferenceDoors({
    currentSPerKm: current,
    initialDoor: parseReferenceDoor(door),
    pendingTestDistanceM: pending?.distanceM ?? null,
    allowGuidedTest: true,
  });
  const ok = doors.evaluation?.status === 'ok' ? doors.evaluation.sPerKm : null;
  const lock = useActionLock();

  const onSave = () =>
    void lock(async () => {
      if (ok == null) return;
      await upsertRunnerProfile({ ref5kPaceSPerKm: ok });
      // Retenir la mesure d'un test guidé, c'est faire le choix que l'arrivée attendait (R8).
      if (doors.door === 'test' && doors.usesPendingTest) clearCooper();
      router.back();
    });

  return (
    <KeyboardAwareScrollView
      testID="running-pace-screen"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('running.refPace.subtitle')}</Text>
      <ReferencePaceDoors
        state={doors}
        currentSPerKm={current}
        allowGuidedTest
        pendingTestDate={pending?.date ?? null}
        onStartTest={() => router.push({ pathname: '/run', params: { test: 'cooper' } })}
      />
      <View style={styles.footer}>
        <Button
          testID="running-pace-save"
          label={t('running.refPace.save')}
          onPress={onSave}
          disabled={ok == null}
          haptic="confirm"
        />
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 32 },
  subtitle: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  footer: { marginTop: 4 },
});
