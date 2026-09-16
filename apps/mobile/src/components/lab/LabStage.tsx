/**
 * US LABO-01 — la scène du Labo, en tête de l'écran : les disques en 3D, ou les mêmes en 2D.
 *
 * ── Trois décisions ──────────────────────────────────────────────────────────────────────────────
 *  1. **Hauteur fixe.** La scène ne défile pas avec le corps : une WebView imbriquée dans une liste
 *     qui défile se dispute les gestes avec elle, et c'est l'utilisateur qui perd. Le corps défile
 *     sous une scène stable, et « Vue sobre » la retire complètement.
 *  2. **Le repli est décidé par la scène elle-même** : elle dit `ok: false` (WebGL absent, contexte
 *     perdu, bibliothèque en échec) et l'écran bascule en 2D, sans deviner à sa place.
 *  3. **Mouvement réduit respecté** : l'état est poussé avec `reducedMotion`, la scène fige alors
 *     ses transitions (et le repli 2D est statique de toute façon).
 */

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LabScene2D } from './scene/LabScene2D';
import LabScene3D, { type LabScene3DStatus } from './scene/LabScene3D.dom';
import type { LabSceneState, ScenePillar } from './scene/scene-state';
import { useStageTheme } from '@/components/stage/PillarStage';
import { fontFamily } from '@/theme/fonts';

/** Hauteur de la scène : assez pour lire les trois disques, assez basse pour laisser le corps. */
export const LAB_STAGE_HEIGHT = 300;

type Props = {
  state: LabSceneState;
  /** Le mode en cours, écrit en haut à gauche de la scène. */
  caption: string;
  onPick: (pillar: ScenePillar | null) => void;
  onLand: () => void;
};

export function LabStage({ state, caption, onPick, onLand }: Props) {
  const { t } = useTranslation();
  const stage = useStageTheme('lab');
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<LabScene3DStatus>({ ok: true });
  const [answered, setAnswered] = useState(false);

  /**
   * 🔴 **Chien de garde : la scène doit répondre, ou on passe en 2D.**
   *
   * Les trois cas prévus par R8 (WebGL absent, contexte perdu, bibliothèque en échec) ont un point
   * commun : la scène **dit** `ok: false`. Restait le cas où elle ne dit *rien* — WebView qui ne
   * monte pas, bundle DOM introuvable, JavaScript qui meurt avant le premier `onStatus`. Le statut
   * restait alors optimiste et la zone restait vide **indéfiniment**, sans même le message de repli.
   * Cinq secondes : assez pour un premier rendu WebGL sur un téléphone modeste, assez peu pour ne
   * pas laisser quelqu'un devant une bande vide.
   */
  useEffect(() => {
    if (answered) return;
    const timer = setTimeout(() => setStatus({ ok: false, reason: 'timeout' }), 5000);
    return () => clearTimeout(timer);
  }, [answered]);

  const hint = state.focus === null ? t('lab.stage.hint') : t('lab.stage.hintFocus');

  return (
    <View style={[styles.stage, { height: LAB_STAGE_HEIGHT + insets.top, backgroundColor: stage.surfaces[1] }]}>
      <LinearGradient colors={stage.gradient} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />

      {status.ok ? (
        <LabScene3D
          state={state}
          background={stage.surfaces[1]!}
          onPick={async (pillar) => onPick(pillar)}
          onStatus={async (next) => {
            setAnswered(true);
            setStatus(next);
          }}
          onLand={async () => onLand()}
          dom={{ style: styles.fill, matchContents: false, scrollEnabled: false }}
        />
      ) : (
        <Pressable style={StyleSheet.absoluteFill} onPress={() => onPick(null)} accessibilityRole="image" accessibilityLabel={caption}>
          <LabScene2D state={state} />
        </Pressable>
      )}

      <View style={[styles.overlay, { paddingTop: insets.top + 10 }]} pointerEvents="none">
        <Text style={[styles.caption, { color: stage.inkMuted }]}>{caption.toUpperCase()}</Text>
        <View style={styles.spacer} />
        <Text style={[styles.hint, { color: stage.inkMuted }]}>
          {status.ok ? hint : t('lab.stage.fallback')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { overflow: 'hidden', borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingBottom: 14 },
  spacer: { flex: 1 },
  caption: { fontFamily: fontFamily.mono, fontSize: 10.5, letterSpacing: 1.1 },
  hint: { fontFamily: fontFamily.body, fontSize: 12 },
});
