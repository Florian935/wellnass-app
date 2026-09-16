'use dom';

/**
 * Spike 3D — la scène, rendue dans une WebView par un composant DOM Expo. **Code jetable.**
 *
 * Patron repris de `lab/scene/LabScene3D.dom.tsx` (ADR-008). ⚠️ Les props traversent un **pont** :
 * elles doivent rester sérialisables, et toute fonction passée devient **asynchrone**.
 *
 * 🔴 Les cinq gestes anti-« zéro pixel » du correctif du 16/09/2026 sont repris ici à la lettre :
 * hauteur du document, canvas en `position: fixed` avec les quatre côtés nommés, contrôle de taille
 * à 800 ms, échec explicite, et un moteur qui refuse de rendre sans surface. Leur absence avait
 * coûté un APK de recette entier — la scène se déclarait `ok` et n'affichait rien.
 */

import { useEffect, useRef } from 'react';
import type { DOMProps } from 'expo/dom';

import { createBodySpikeScene } from './body-spike-engine';
import { SPIKE_MESH_SINGLE, SPIKE_MESH_SPLIT } from './body-spike-mesh';
import type { BodySpikeState } from './body-spike-state';

export type BodySpikeStatus = { ok: boolean; reason?: string };

export type BodySpikeStats = {
  fps: number;
  meshes: number;
  morphsParMaillage: number[];
  pousseesNonNulles: number;
  limite: number;
  premiereImageMs: number;
};

type SceneHandle = {
  setInfluences: (liste: BodySpikeState['influences']) => void;
  setReducedMotion: (valeur: boolean) => void;
  stats: () => BodySpikeStats;
  dispose: () => void;
};

type Props = {
  state: BodySpikeState;
  background: string;
  onStatus: (status: BodySpikeStatus) => Promise<void>;
  onStats: (stats: BodySpikeStats) => Promise<void>;
  dom?: DOMProps;
};

/**
 * ⚠️ Les maillages sont importés **ici**, donc bundlés avec la page DOM — et surtout **pas** passés
 * en prop. Les faire traverser le pont enverrait 464 Ko de base64 à la sérialisation, à chaque
 * montage : le pont est fait pour un état de quelques centaines d'octets, pas pour un asset. Le
 * prix se paie une fois, dans le poids du bundle, et c'est justement ce que le spike mesure.
 */
export default function BodySpikeScene3D({ state, background, onStatus, onStats }: Props) {
  const variant = state.variant;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<SceneHandle | null>(null);

  // Création — une seule fois. La scène est coûteuse ; l'état se pousse.
  useEffect(() => {
    // Sans ces quatre lignes, `html` et `body` ont une hauteur `auto` : un canvas en `height:100%`
    // se résout alors contre un parent sans hauteur et mesure zéro pixel.
    const root = document.documentElement;
    root.style.height = '100%';
    document.body.style.height = '100%';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';

    const canvas = canvasRef.current;
    if (!canvas) return;

    let sizeCheck: ReturnType<typeof setTimeout> | undefined;
    let statsTimer: ReturnType<typeof setInterval> | undefined;
    try {
      const created = createBodySpikeScene(canvas, {
        meshBase64: variant === 'single' ? SPIKE_MESH_SINGLE : SPIKE_MESH_SPLIT,
        reducedMotion: state.reducedMotion,
        onLost: () => void onStatus({ ok: false, reason: 'contexte-webgl-perdu' }),
      }) as SceneHandle & { ok: boolean; reason?: string; detail?: string };

      if (!created.ok) {
        void onStatus({ ok: false, reason: created.detail ?? created.reason });
        return;
      }
      sceneRef.current = created;
      void onStatus({ ok: true });

      // Le silence d'une WebView est un échec, pas un succès : on exige la preuve qu'on occupe
      // des pixels. C'est exactement le cas que personne ne couvrait avant le 16/09.
      sizeCheck = setTimeout(() => {
        if (canvas.clientWidth < 2 || canvas.clientHeight < 2) {
          void onStatus({
            ok: false,
            reason: `taille:${canvas.clientWidth}x${canvas.clientHeight}`,
          });
        }
      }, 800);

      statsTimer = setInterval(() => {
        const handle = sceneRef.current;
        if (handle) void onStats(handle.stats());
      }, 500);
    } catch (error) {
      void onStatus({ ok: false, reason: (error as Error)?.message ?? 'renderer' });
      return;
    }

    return () => {
      if (sizeCheck) clearTimeout(sizeCheck);
      if (statsTimer) clearInterval(statsTimer);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
    // ⚠️ Déps `[variant]` et non `[]`, contrairement au Labo : changer de variante doit **recréer**
    // la scène, puisque le maillage change. C'est assumé — et ça fait passer le chemin de
    // `dispose()` à chaque bascule, ce qui est précisément ce qu'on veut éprouver (« ouvrir et
    // quitter dix fois » du protocole).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  // Le fond suit le thème, dans son propre effet : le mettre dans l'effet de création laisserait
  // le `body` sur l'ancienne couleur après une bascule clair/sombre.
  useEffect(() => {
    document.body.style.background = background;
  }, [background]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setInfluences(state.influences);
    scene.setReducedMotion(state.reducedMotion);
  }, [state]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        // `top/left/right/bottom` nommés plutôt qu'`inset` : les vieilles WebView Android ignorent
        // `inset`, et le canvas retomberait à zéro pixel sans rien dire.
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        touchAction: 'none',
        background,
      }}
    />
  );
}
