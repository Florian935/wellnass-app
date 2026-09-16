'use dom';

/**
 * US LABO-01 — la scène 3D, rendue dans une WebView par un **composant DOM d'Expo**.
 *
 * ── Pourquoi un composant DOM plutôt que react-three-fiber ───────────────────────────────────────
 * La scène existe déjà, éprouvée, en three.js r128 (prototype du 15/09). Elle utilise des textures
 * dessinées au canvas 2D, une post-production maison et des lumières calibrées. La porter sur
 * `expo-gl` aurait voulu dire réécrire toutes les textures (pas de canvas 2D côté natif) et
 * retoucher l'éclairage — beaucoup de travail pour rendre *moins* que ce qui marche déjà.
 * Le composant DOM garde la scène **à l'identique**, et le bundle part avec l'app (hors ligne, R8).
 *
 * ⚠️ Les props traversent un pont : elles doivent rester sérialisables (`LabSceneState`), et les
 * fonctions deviennent asynchrones. On ne pousse donc **que** l'état, jamais un objet vivant.
 */

import { useEffect, useRef } from 'react';
import type { DOMProps } from 'expo/dom';

import { createLabScene } from './engine';
import type { LabSceneState, ScenePillar } from './scene-state';

export type LabScene3DStatus = { ok: boolean; reason?: string; quality?: string };

type Props = {
  state: LabSceneState;
  /** Fond de la scène : le dégradé des piliers, poussé par l'app (thème). */
  background: string;
  onPick: (pillar: ScenePillar | null) => Promise<void>;
  onStatus: (status: LabScene3DStatus) => Promise<void>;
  onLand: () => Promise<void>;
  dom?: DOMProps;
};

type SceneHandle = {
  setMode: (mode: 'week' | 'formula') => void;
  setValues: (values: Record<string, unknown>) => void;
  setReality: (reality: unknown) => void;
  setCrossings: (list: unknown[]) => void;
  setPillars: (pillars: Record<string, boolean>) => void;
  setLabels: (labels: Record<string, unknown>) => void;
  select: (pillar: string | null) => void;
  focus: (pillars: string[] | null) => void;
  setReducedMotion: (reduced: boolean) => void;
  quality: () => string;
  dispose: () => void;
};

export default function LabScene3D({ state, background, onPick, onStatus, onLand }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<SceneHandle | null>(null);

  // Une seule création pour la vie du composant : la scène est coûteuse, et l'état se pousse.
  useEffect(() => {
    // 🔴 **Donner une hauteur au document, sinon le canvas fait zéro pixel.**
    // Dans une WebView, `html` et `body` ont une hauteur AUTO : un canvas en `height: 100%` se
    // résout donc contre un parent sans hauteur, `clientHeight` vaut 0, et `resize()` retombe sur
    // son garde `|| 1` — le moteur rend une image d'un pixel de haut. WebGL marche parfaitement dans
    // ce cas, donc la scène se déclare `ok` et le repli 2D ne part pas : l'utilisateur voit une
    // bande vide, sans message. C'est exactement ce qui s'est passé sur le premier APK.
    // Le prototype ne l'avait pas parce que son canvas vivait dans un conteneur déjà dimensionné.
    const root = document.documentElement;
    root.style.height = '100%';
    document.body.style.height = '100%';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.background = background;
    const canvas = canvasRef.current;
    if (canvas === null) return;
    let handle: SceneHandle | null = null;
    let sizeCheck: ReturnType<typeof setTimeout> | undefined;
    try {
      const created = createLabScene(canvas, {
        reducedMotion: state.reducedMotion,
        labels: state.labels,
        onPick: (pillar: ScenePillar | null) => { void onPick(pillar); },
        onEvent: (type: string, info: { ghost: boolean }) => { if (type === 'land' && !info.ghost) void onLand(); },
        onLost: () => { void onStatus({ ok: false, reason: 'lost' }); },
      }) as SceneHandle & { ok: boolean; reason?: string };
      if (!created.ok) {
        void onStatus({ ok: false, reason: created.reason });
        return;
      }
      handle = created;
      sceneRef.current = created;
      void onStatus({ ok: true, quality: created.quality() });

      // Filet : WebGL peut très bien démarrer sur un canvas de taille nulle. On revérifie la taille
      // une fois la mise en page faite, et on bascule en 2D plutôt que de laisser une bande vide —
      // un repli lisible vaut mieux qu'un écran qui ne dit rien.
      sizeCheck = setTimeout(() => {
        if (canvas.clientWidth < 2 || canvas.clientHeight < 2) {
          void onStatus({ ok: false, reason: `size:${canvas.clientWidth}x${canvas.clientHeight}` });
        }
      }, 800);
    } catch (error) {
      void onStatus({ ok: false, reason: error instanceof Error ? error.message : 'renderer' });
      return;
    }
    return () => {
      if (sizeCheck !== undefined) clearTimeout(sizeCheck);
      handle?.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chaque changement d'état est poussé tel quel : la scène interpole elle-même.
  useEffect(() => {
    const scene = sceneRef.current;
    if (scene === null) return;
    scene.setLabels(state.labels);
    scene.setPillars(state.pillars);
    scene.setMode(state.mode);
    scene.setValues(state.values);
    if (state.reality !== null) scene.setReality(state.reality);
    scene.setCrossings(state.crossings);
    scene.select(state.selected);
    scene.focus(state.focus);
    scene.setReducedMotion(state.reducedMotion);
  }, [state]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      // `position: fixed` + les quatre cotes : le canvas se mesure sur la FENETRE de la WebView,
      // sans dependre d'une chaine de hauteurs entre lui et `body`. (`top/left/right/bottom`
      // plutot que `inset`, que les vieilles WebView Android ne connaissent pas.)
      style={{
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
