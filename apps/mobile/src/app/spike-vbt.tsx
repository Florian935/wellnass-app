/**
 * Spike VBT-01 — écran d'essai, **jetable et hors produit**.
 * Rapport : docs/specs/technical/spike-vbt01-vitesse-barre.md
 *
 * ⚠️ **Cet écran n'est pas une fonctionnalité.** Il embarque `react-native-vision-camera`, une
 * dépendance native, et il est fusionné dans `dev` sur demande de Florian (19/09/2026) pour tenir
 * dans **un seul APK** d'essai. 🔴 **À retirer avant le build de soumission Play** — lui et ses
 * dépendances : voir la note du rapport §5.
 *
 * Il sert à répondre aux quatre questions que seul un téléphone peut trancher (rapport §5.2) :
 * le suivi tient-il ±3 px, combien d'images par seconde, ça chauffe ?, combien de reps manquées.
 *
 * ── Ce qui est déjà prouvé avant lui, et qu'il n'a donc pas à prouver ─────────────────────────
 * La chaîne logicielle entière — pixels → position → vitesses → décision d'arrêt — est testée dans
 * `packages/shared` (51 tests, dont 5 qui l'enchaînent de bout en bout sur une vidéo fabriquée). Si
 * une vitesse paraît fausse ici, **le suspect est la prise de vue, pas le calcul**.
 *
 * ── Pourquoi tout se règle à l'écran ──────────────────────────────────────────────────────────
 * Le seuil de luminance et le diamètre du disque dépendent de la salle, de l'éclairage et de la
 * distance. Figés dans le code, ils condamneraient le déplacement : on ne recompile pas une app
 * entre deux séries. Ils se règlent donc **sur place**, avec un retour visuel immédiat.
 *
 * 🔴 **Jamais exécuté à ce jour** : écrit contre l'API de VisionCamera 5.2.3 lue dans le paquet
 * installé, typecheck vert, mais aucun device dans la boucle. Le raccord caméra → worklet est la
 * première chose à déboguer, pas la mesure.
 */

import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  Camera,
  CommonResolutions,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
  type Frame,
} from 'react-native-vision-camera';
import {
  analyseSet,
  metersPerPixel,
  rescaleToMilliseconds,
  trackBrightPoint,
  type BarSample,
  type BarSetAnalysis,
} from '@wellness/shared';

/**
 * Résolution d'analyse — délibérément basse.
 *
 * Le suivi lit les pixels **en JavaScript** : en 720p, une image fait 920 000 pixels, soit 230 000
 * lus même avec un pas de 2. En VGA 4:3 (480 × 640), c'est quatre fois moins — et la précision
 * demandée (±3 px sur un disque qui occupe ~120 px) reste largement tenable. C'est le premier
 * réglage à remonter si la cadence s'effondre.
 */
const ANALYSIS_RESOLUTION = CommonResolutions.VGA_4_3;

/** Réglages de départ, tous ajustables à l'écran. */
const INITIAL_THRESHOLD = 170;
const INITIAL_PLATE_PX = 120;

/** Une ligne de réglage : libellé, valeur, deux boutons. */
function Tuner({
  label,
  value,
  suffix,
  step,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  step: number;
  onChange: (next: number) => void;
}) {
  return (
    <View style={styles.tuner}>
      <Text style={styles.text}>{`${label} ${value}${suffix}`}</Text>
      <View style={styles.tunerButtons}>
        <Pressable onPress={() => onChange(value - step)} style={styles.smallButton} hitSlop={8}>
          <Text style={styles.buttonLabel}>−</Text>
        </Pressable>
        <Pressable onPress={() => onChange(value + step)} style={styles.smallButton} hitSlop={8}>
          <Text style={styles.buttonLabel}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function SpikeVbtScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');

  const [recording, setRecording] = useState(false);
  const [analysis, setAnalysis] = useState<BarSetAnalysis | null>(null);
  const [platePx, setPlatePx] = useState(INITIAL_PLATE_PX);
  const [threshold, setThreshold] = useState(INITIAL_THRESHOLD);
  /** Retour vivant du suivi, rafraîchi une image sur dix : voir le point AVANT de lancer la série. */
  const [live, setLive] = useState<{ x: number; y: number; pixels: number; w: number; h: number } | null>(null);
  const [count, setCount] = useState(0);

  /** Les échantillons de la série. Un `ref` : 30 écritures/s dans un état React tueraient l'écran. */
  const samples = useRef<BarSample[]>([]);
  const frames = useRef(0);

  /**
   * Valeurs partagées AVEC le worklet de la caméra : le worklet vit sur un autre runtime, il ne
   * voit pas l'état React. Sans ça, tourner le bouton du seuil ne changerait rien au suivi.
   */
  const lastX = useSharedValue(-1);
  const lastY = useSharedValue(-1);
  const thresholdSV = useSharedValue(INITIAL_THRESHOLD);
  const capturing = useSharedValue(false);

  const setThresholdBoth = useCallback(
    (next: number) => {
      const bounded = Math.max(40, Math.min(250, next));
      setThreshold(bounded);
      thresholdSV.set(bounded);
    },
    [thresholdSV],
  );

  /** Appelé depuis le worklet, une fois par image. Volontairement minuscule. */
  const onSample = useCallback(
    (t: number, y: number | null, x: number, pixels: number, w: number, h: number) => {
      if (capturing.get()) samples.current.push({ t, y });

      frames.current += 1;
      if (frames.current % 10 !== 0) return;
      setLive(y === null ? null : { x, y, pixels, w, h });
      setCount(samples.current.length);
    },
    [capturing],
  );

  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    targetResolution: ANALYSIS_RESOLUTION,
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
            threshold: thresholdSV.get(),
            step: 2,
            previous: lastX.get() < 0 ? null : { x: lastX.get(), y: lastY.get() },
            searchRadius: 80,
          },
        );

        if (found === null) {
          // Point perdu : on oublie l'accrochage, sinon la recherche resterait collée là où il n'y
          // a plus rien. Le trou est transmis tel quel — `analyseSet` sait quoi en faire.
          lastX.set(-1);
        } else {
          lastX.set(found.x);
          lastY.set(found.y);
        }

        scheduleOnRN(
          onSample,
          frame.timestamp,
          found === null ? null : found.y,
          found === null ? -1 : found.x,
          found === null ? 0 : found.pixels,
          luma.width,
          luma.height,
        );
      } finally {
        // Obligatoire : une image non libérée fait tomber toute la file de la caméra.
        frame.dispose();
      }
    },
  });

  const start = () => {
    samples.current = [];
    lastX.set(-1);
    setAnalysis(null);
    setCount(0);
    capturing.set(true);
    setRecording(true);
  };

  const stop = () => {
    capturing.set(false);
    setRecording(false);
    const mpp = metersPerPixel(platePx);
    if (mpp === null) return;
    // L'unité des horodatages de la caméra n'est pas garantie (ns, µs, ms, s selon l'appareil) :
    // on la ramène aux millisecondes avant toute mesure, sinon les vitesses sont fausses d'un
    // facteur mille ou un million — sans que la forme de la courbe ne trahisse quoi que ce soit.
    setAnalysis(analyseSet(rescaleToMilliseconds(samples.current), { metersPerPixel: mpp }));
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
      {/* La caméra tourne en continu : c'est ce qui permet de régler le seuil AVANT de filmer. */}
      <Camera device={device} isActive outputs={[frameOutput]} style={StyleSheet.absoluteFill} />

      <View style={styles.overlay}>
        <Text style={[styles.text, live === null ? styles.lost : styles.locked]}>
          {live === null
            ? 'POINT PERDU — augmente ou baisse le seuil'
            : `suivi : x ${live.x.toFixed(1)} · y ${live.y.toFixed(1)} · ${live.pixels} px · image ${live.w}×${live.h}`}
        </Text>

        <Tuner label="seuil" value={threshold} suffix="" step={10} onChange={setThresholdBoth} />
        <Tuner
          label="disque"
          value={platePx}
          suffix=" px"
          step={5}
          onChange={(next) => setPlatePx(Math.max(20, Math.min(400, next)))}
        />

        <Pressable onPress={recording ? stop : start} style={styles.button}>
          <Text style={styles.buttonLabel}>
            {recording ? `Arrêter (${count} images)` : 'Démarrer la série'}
          </Text>
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
  locked: { color: '#9adb7c' },
  lost: { color: '#f0a35e', fontWeight: '700' },
  tuner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tunerButtons: { flexDirection: 'row', gap: 10 },
  smallButton: {
    backgroundColor: '#ffffff22',
    borderRadius: 8,
    minWidth: 52,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: { backgroundColor: '#b14f2b', borderRadius: 10, padding: 14, alignItems: 'center' },
  buttonLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },
  result: { maxHeight: 200 },
});
