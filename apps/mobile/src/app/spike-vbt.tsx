/**
 * Spike VBT-01 — écran d'essai, **jetable et hors produit**.
 * Rapport : docs/specs/technical/spike-vbt01-vitesse-barre.md
 *
 * ⚠️ **Cet écran n'est pas une fonctionnalité.** Il vit sur la branche `spike/vbt01-camera`, il
 * n'est référencé par aucune navigation, et il ne doit **jamais** entrer dans le build de
 * soumission Play : il embarque `react-native-vision-camera`, une dépendance native.
 *
 * Il sert à répondre aux quatre questions que seul un téléphone peut trancher (rapport §5.2) :
 * le suivi tient-il ±3 px, combien d'images par seconde, ça chauffe ?, combien de reps manquées.
 *
 * ── Ce qui est déjà prouvé avant lui, et qu'il n'a donc pas à prouver ─────────────────────────
 * La chaîne logicielle entière — pixels → position → vitesses → décision d'arrêt — est testée dans
 * `packages/shared` (47 tests, dont 5 qui enchaînent les deux moitiés sur une vidéo fabriquée). Si
 * une vitesse paraît fausse ici, **le suspect est la prise de vue, pas le calcul**.
 *
 * 🔴 **Non exécuté à ce jour** : écrit le 19/09/2026 contre l'API de VisionCamera 5.2.3 lue dans le
 * paquet installé, compilé (typecheck vert), mais jamais lancé — aucun device dans la boucle. Le
 * raccord caméra → worklet est donc la première chose à déboguer, pas la mesure.
 */

import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
  type Frame,
} from 'react-native-vision-camera';
import {
  analyseSet,
  metersPerPixel,
  trackBrightPoint,
  type BarSample,
  type BarSetAnalysis,
} from '@wellness/shared';

/** Diamètre apparent du disque, en pixels de l'image analysée — à régler à l'œil avant la série. */
const DEFAULT_PLATE_PX = 120;

/** Seuil de luminance de départ. L'essai device dira s'il faut le calculer par image. */
const LUMA_THRESHOLD = 170;

export default function SpikeVbtScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');

  const [recording, setRecording] = useState(false);
  const [analysis, setAnalysis] = useState<BarSetAnalysis | null>(null);
  const [count, setCount] = useState(0);

  /** Les échantillons de la série en cours. Un `ref` : 60 écritures/s dans un état React tueraient l'écran. */
  const samples = useRef<BarSample[]>([]);

  /**
   * Dernière position connue, partagée AVEC le worklet de la caméra (donc une valeur Reanimated et
   * pas un `ref` : les deux mondes n'ont pas la même mémoire). C'est elle qui empêche le suivi de
   * sauter sur un néon du plafond.
   */
  const lastX = useSharedValue(-1);
  const lastY = useSharedValue(-1);

  /** Appelé depuis le worklet, une fois par image. Volontairement minuscule. */
  const onSample = useCallback((t: number, y: number | null) => {
    samples.current.push({ t, y });
    // On ne rend pas à chaque image : un compteur toutes les 15 images suffit à voir que ça vit.
    if (samples.current.length % 15 === 0) setCount(samples.current.length);
  }, []);

  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    onFrame: (frame: Frame) => {
      'worklet';

      try {
        const planes = frame.getPlanes();
        const luma = planes[0];
        if (luma === undefined) return;

        const found = trackBrightPoint(
          {
            data: new Uint8Array(luma.getPixelBuffer()),
            width: luma.width,
            height: luma.height,
            bytesPerRow: luma.bytesPerRow,
          },
          {
            threshold: LUMA_THRESHOLD,
            step: 2,
            previous: lastX.value < 0 ? null : { x: lastX.value, y: lastY.value },
            searchRadius: 80,
          },
        );

        if (found === null) {
          // Point perdu : on oublie l'accrochage, sinon la recherche resterait collée là où il
          // n'y a plus rien. Le trou est transmis tel quel — `analyseSet` sait quoi en faire.
          lastX.value = -1;
        } else {
          lastX.value = found.x;
          lastY.value = found.y;
        }

        scheduleOnRN(onSample, frame.timestamp, found === null ? null : found.y);
      } finally {
        // Obligatoire : une image non libérée fait tomber toute la file de la caméra.
        frame.dispose();
      }
    },
  });

  const start = () => {
    samples.current = [];
    lastX.value = -1;
    setAnalysis(null);
    setCount(0);
    setRecording(true);
  };

  const stop = () => {
    setRecording(false);
    const mpp = metersPerPixel(DEFAULT_PLATE_PX);
    if (mpp === null) return;
    setAnalysis(analyseSet(samples.current, { metersPerPixel: mpp }));
  };

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Caméra non autorisée.</Text>
        <Pressable onPress={() => void requestPermission()} style={styles.button}>
          <Text style={styles.buttonLabel}>Autoriser</Text>
        </Pressable>
      </View>
    );
  }

  if (device === undefined) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Aucune caméra arrière trouvée.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Camera
        device={device}
        isActive={recording}
        outputs={[frameOutput]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.overlay}>
        <Text style={styles.text}>{recording ? `${count} images` : 'Prêt'}</Text>

        <Pressable onPress={recording ? stop : start} style={styles.button}>
          <Text style={styles.buttonLabel}>{recording ? 'Arrêter la série' : 'Démarrer'}</Text>
        </Pressable>

        {analysis !== null && (
          <ScrollView style={styles.result}>
            <Text style={styles.text}>
              {`cadence ${analysis.quality.fps.toFixed(1)} i/s · perdues ${analysis.quality.lostFrames}` +
                ` · coupures ${analysis.quality.breaks} · ${analysis.quality.usable ? 'exploitable' : 'À REJETER'}`}
            </Text>
            {analysis.reps.map((rep) => (
              <Text key={rep.index} style={styles.text}>
                {`rep ${rep.index} : ${rep.meanVelocity.toFixed(3)} m/s · pointe ${rep.peakVelocity.toFixed(2)}` +
                  ` · ${rep.rangeM.toFixed(2)} m en ${rep.durationS.toFixed(2)} s${rep.interpolated ? ' (trou comblé)' : ''}`}
              </Text>
            ))}
            {analysis.velocityLossPct !== null && (
              <Text style={styles.text}>
                {`perte ${analysis.velocityLossPct.toFixed(1)} %${analysis.stop ? ' → ARRÊTER' : ''}`}
              </Text>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, gap: 10 },
  text: { color: '#fff', fontSize: 14 },
  button: { backgroundColor: '#b14f2b', borderRadius: 10, padding: 14, alignItems: 'center' },
  buttonLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },
  result: { maxHeight: 220 },
});
