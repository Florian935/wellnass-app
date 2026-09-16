/**
 * Spike 3D — l'hôte React Native de la scène. **Code jetable.**
 *
 * Patron repris de `lab/LabStage.tsx`. Deux contraintes structurantes, toutes deux payées au prix
 * fort par LABO-01 :
 *
 * 1. **Hauteur fixe, hors de tout défilement.** Une WebView imbriquée dans une liste qui défile se
 *    dispute les gestes avec elle, et c'est l'utilisateur qui perd. Le corps de l'écran défile
 *    *sous* une scène stable. ⚠️ C'est aussi l'inconnue n° 6 du spike : savoir si un éditeur peut
 *    s'en affranchir.
 * 2. **Le silence est un échec.** Passé cinq secondes sans le moindre statut — WebView qui ne monte
 *    pas, bundle DOM introuvable, JS mort avant le premier appel — on replie et on le dit.
 */

import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BodySpikeScene3D, { type BodySpikeStats, type BodySpikeStatus } from './BodySpikeScene3D.dom';
import type { BodySpikeState } from './body-spike-state';

export const BODY_SPIKE_STAGE_HEIGHT = 340;

const DELAI_SILENCE_MS = 5000;

type Props = {
  state: BodySpikeState;
  onStats: (stats: BodySpikeStats) => void;
};

export function BodySpikeStage({ state, onStats }: Props) {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<BodySpikeStatus>({ ok: true });
  const answeredRef = useRef(false);

  useEffect(() => {
    const garde = setTimeout(() => {
      // ⚠️ Le drapeau est indispensable : sans lui, le chien de garde replierait aussi une scène
      // parfaitement saine au bout de cinq secondes, chez tout le monde.
      if (answeredRef.current) return;
      setStatus({ ok: false, reason: 'silence de la scène après 5 s' });
    }, DELAI_SILENCE_MS);
    return () => clearTimeout(garde);
  }, []);

  const recevoirStatut = (next: BodySpikeStatus) => {
    answeredRef.current = true;
    setStatus(next);
  };

  return (
    <View style={[styles.stage, { height: BODY_SPIKE_STAGE_HEIGHT + insets.top }]}>
      {status.ok ? (
        <BodySpikeScene3D
          state={state}
          background="#161012"
          onStatus={async (next) => recevoirStatut(next)}
          onStats={async (stats) => onStats(stats)}
          dom={{ style: styles.fill, matchContents: false, scrollEnabled: false }}
        />
      ) : (
        <View testID="spike-fallback" style={styles.fallback}>
          <Text style={styles.fallbackTitle}>Scène 3D indisponible</Text>
          {/* La raison brute est affichée exprès : sur un spike, « webgl » ou « taille:0x0 » EST
              le résultat de la mesure. La masquer reviendrait à reproduire le défaut qu'on
              instrumente — un écran vide qui ne dit pas pourquoi. */}
          <Text style={styles.fallbackReason}>{status.reason ?? 'raison inconnue'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { overflow: 'hidden', backgroundColor: '#161012' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  fallbackTitle: { color: '#f4e6d8', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  fallbackReason: { color: '#d8a48f', fontSize: 13, textAlign: 'center' },
});
