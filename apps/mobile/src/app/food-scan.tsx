import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { scaleMicronutrients, scaleNutrition } from '@wellness/shared';
import { Button } from '@/components/Button';
import { QuantityPanel, type PickTarget } from '@/components/QuantityPanel';
import { findFoodByBarcode, importOpenFoodFactsFood } from '@/data/repositories/food-repository';
import { addFoodEntry } from '@/data/repositories/journal-repository';
import { fetchOpenFoodFactsByBarcode } from '@/lib/openfoodfacts';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Codes-barres produits attendus (aliments industriels). */
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

type Phase = 'scanning' | 'resolving' | 'quantity' | 'notfound';

/**
 * Écran de scan de code-barres (item 4.10). Scanne un EAN/UPC → cherche l'aliment
 * d'abord en local (déjà importé), sinon sur OpenFoodFacts, puis propose la quantité
 * et l'ajoute au journal. Nécessite `expo-camera` (module natif → dev build).
 */
export default function FoodScanScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const date = params.date ?? '';
  const meal = params.meal ?? 'breakfast';
  const lang = i18n.language === 'en' ? 'en' : 'fr';

  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('scanning');
  const [target, setTarget] = useState<PickTarget | null>(null);
  const lockedCode = useRef<string | null>(null);

  const resolve = async (code: string) => {
    setPhase('resolving');
    const local = await findFoodByBarcode(code, lang);
    if (local) {
      setTarget(local);
      setPhase('quantity');
      return;
    }
    const off = await fetchOpenFoodFactsByBarcode(code, lang);
    if (off) {
      const id = await importOpenFoodFactsFood({ ...off, category: 'other' });
      setTarget({
        id,
        name: off.name,
        kcalPer100g: off.kcalPer100g,
        proteinPer100g: off.proteinPer100g,
        carbsPer100g: off.carbsPer100g,
        fatPer100g: off.fatPer100g,
        portions: [],
        micronutrients: off.micronutrients,
      });
      setPhase('quantity');
      return;
    }
    setPhase('notfound');
  };

  const onBarcodeScanned = ({ data }: BarcodeScanningResult) => {
    // Un seul déclenchement : la caméra rappelle en continu tant qu'un code est visible.
    if (phase !== 'scanning' || lockedCode.current === data) return;
    lockedCode.current = data;
    void resolve(data);
  };

  const rescan = () => {
    lockedCode.current = null;
    setTarget(null);
    setPhase('scanning');
  };

  // ── Permission caméra ─────────────────────────────────────────────────────
  if (!permission) {
    return <Centered><ActivityIndicator color={colors.accent} /></Centered>;
  }
  if (!permission.granted) {
    return (
      <Centered>
        <Ionicons name="camera-outline" size={48} color={colors.textMuted} />
        <Text style={[styles.info, { color: colors.text }]}>{t('scan.permission.message')}</Text>
        <Button label={t('scan.permission.grant')} onPress={() => void requestPermission()} />
        <Button label={t('common.cancel')} variant="ghost" onPress={() => router.back()} />
      </Centered>
    );
  }

  // ── Quantité (aliment résolu) ─────────────────────────────────────────────
  if (phase === 'quantity' && target) {
    return (
      <QuantityPanel
        target={target}
        onCancel={rescan}
        onConfirm={async (grams) => {
          const n = scaleNutrition(target, grams);
          const micronutrients = scaleMicronutrients(target.micronutrients ?? {}, grams);
          await addFoodEntry(date, meal, {
            foodId: target.id,
            name: target.name,
            quantityG: grams,
            kcal: n.kcal,
            proteinG: n.proteinG,
            carbsG: n.carbsG,
            fatG: n.fatG,
            micronutrients,
          });
          router.dismissAll();
        }}
      />
    );
  }

  // ── Introuvable ───────────────────────────────────────────────────────────
  if (phase === 'notfound') {
    return (
      <Centered>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
        <Text style={[styles.info, { color: colors.text }]}>{t('scan.notFound')}</Text>
        <Button label={t('scan.rescan')} onPress={rescan} />
        <Button
          label={t('journal.createFood')}
          variant="ghost"
          onPress={() => router.replace({ pathname: '/food-custom', params: { date, meal } })}
        />
      </Centered>
    );
  }

  // ── Caméra (scan / résolution) ────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        onBarcodeScanned={phase === 'scanning' ? onBarcodeScanned : undefined}
      />
      <View style={styles.overlay}>
        <View style={[styles.frame, { borderColor: colors.accent }]} />
        {phase === 'resolving' ? (
          <View style={styles.status}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.statusText}>{t('scan.resolving')}</Text>
          </View>
        ) : (
          <Text style={styles.hint}>{t('scan.hint')}</Text>
        )}
      </View>
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.centered, { backgroundColor: colors.background }]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  info: { fontFamily: fontFamily.body, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  frame: { width: 260, height: 160, borderWidth: 3, borderRadius: 20 },
  hint: { fontFamily: fontFamily.bodySemi, fontSize: 15, color: '#fff', textAlign: 'center', paddingHorizontal: 24 },
  status: { alignItems: 'center', gap: 10 },
  statusText: { fontFamily: fontFamily.bodySemi, fontSize: 15, color: '#fff' },
});
