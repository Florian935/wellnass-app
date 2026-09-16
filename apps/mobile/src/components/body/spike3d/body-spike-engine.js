/* eslint-disable */
/**
 * Spike 3D — moteur de la silhouette. **Code jetable.**
 *
 * Voir docs/specs/technical/spike-3d-corps.md. Ce fichier ne sert qu'à MESURER six inconnues sur
 * un vrai téléphone ; il n'a aucune vocation à devenir le moteur de l'éditeur.
 *
 * ── Pourquoi en JavaScript ──────────────────────────────────────────────────────────────────────
 * Même raison que `lab/scene/engine.js` : il ne tourne que dans la WebView du composant DOM, et son
 * contrat public est retypé côté appelant (`BodySpikeScene3D.dom.tsx`). ⚠️ L'ADR-008 borne
 * explicitement sa portée — pour un moteur d'éditeur pérenne, écrit neuf, la question du
 * TypeScript se **repose**. Elle n'est pas tranchée ici, et ce fichier n'est pas un précédent.
 *
 * ── Ce que ce moteur mesure ─────────────────────────────────────────────────────────────────────
 * `stats()` remonte : images par seconde lissées, nombre de maillages, nombre de cibles de morph
 * par maillage, et le nombre d'influences non nulles réellement poussées. Le reste de la mesure se
 * fait **à l'œil**, sur l'appareil : combien de zones bougent quand on pousse les 14 curseurs.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** three r128 n'applique que 8 influences simultanées par maillage, et ignore le reste en silence. */
export const MORPH_LIMIT_R128 = 8;

function base64ToArrayBuffer(base64) {
  var binaire = atob(base64);
  var buffer = new ArrayBuffer(binaire.length);
  var octets = new Uint8Array(buffer);
  for (var i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return buffer;
}

export function createBodySpikeScene(canvas, opts) {
  opts = opts || {};

  // Sonde WebGL sur un canvas JETABLE : on ne brûle pas le vrai canvas avant de savoir.
  var probeGl = null;
  try {
    var probe = document.createElement('canvas');
    probeGl =
      probe.getContext('webgl2') || probe.getContext('webgl') || probe.getContext('experimental-webgl');
  } catch (e) {
    probeGl = null;
  }
  if (!probeGl) return { ok: false, reason: 'webgl' };

  var renderer = null,
    lastError = '';
  [
    { antialias: true, alpha: true },
    { antialias: false, alpha: true, powerPreference: 'low-power', precision: 'mediump' },
  ].some(function (cfg) {
    try {
      renderer = new THREE.WebGLRenderer(Object.assign({ canvas: canvas }, cfg));
      return true;
    } catch (e) {
      lastError = (e && e.message) || String(e);
      renderer = null;
      return false;
    }
  });
  if (!renderer) return { ok: false, reason: 'renderer', detail: lastError };

  var onLost = function () {
    if (opts.onLost) opts.onLost();
  };
  canvas.addEventListener('webglcontextlost', onLost);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.physicallyCorrectLights = true;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
  camera.position.set(0, 0.2, 7.2);
  var world = new THREE.Group();
  scene.add(world);

  // Éclairage minimal : une clé, deux contre-jours, une hémisphérique. Aucune ombre portée — on
  // mesure le coût des morphs, pas celui d'une shadow map.
  var key = new THREE.DirectionalLight(0xfff1e0, 2.6);
  key.position.set(-2.4, 6, 4);
  scene.add(key);
  var rimBlue = new THREE.DirectionalLight(0x86b4ff, 1.4);
  rimBlue.position.set(6, 3, -6);
  scene.add(rimBlue);
  var rimRose = new THREE.DirectionalLight(0xff8fb0, 1.0);
  rimRose.position.set(-6, 2.5, -4);
  scene.add(rimRose);
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x2a1d14, 0.5));

  var meshes = [];
  var morphIndex = {}; // nom de cible -> [{ mesh, index }]
  var loadError = '';
  var maillagePret = false;

  function indexerMorphs(objet) {
    objet.traverse(function (noeud) {
      if (!noeud.isMesh) return;
      noeud.material = new THREE.MeshStandardMaterial({
        color: 0xe8cdb5,
        roughness: 0.72,
        metalness: 0.02,
        morphTargets: true,
        morphNormals: false,
      });
      meshes.push(noeud);
      var dico = noeud.morphTargetDictionary || {};
      Object.keys(dico).forEach(function (nom) {
        if (!morphIndex[nom]) morphIndex[nom] = [];
        morphIndex[nom].push({ mesh: noeud, index: dico[nom] });
      });
    });
  }

  try {
    var loader = new GLTFLoader();
    // `parse` et non `load` : le maillage est **inliné en base64** dans le bundle DOM. Aucune
    // requête réseau, aucune URI d'asset React Native que la WebView n'aurait pas le droit de
    // lire — c'est ce qui garantit que la scène marche hors ligne.
    // 🔴 `parse()` est **ASYNCHRONE** : le rappel s'exécute plus tard, jamais dans cette pile.
    // Tester `meshes.length` juste après l'appel donnait donc toujours 0, et la scène se déclarait
    // « aucun maillage dans le glb » alors que le maillage se chargeait très bien une milliseconde
    // plus tard (défaut constaté en recette le 16/09/2026). Le verdict sur le maillage ne peut
    // être rendu que **depuis les rappels**, jamais de façon synchrone.
    loader.parse(
      base64ToArrayBuffer(opts.meshBase64 || ''),
      '',
      function (gltf) {
        indexerMorphs(gltf.scene);
        if (!meshes.length) {
          if (opts.onMeshError) opts.onMeshError('aucun maillage dans le glb');
          return;
        }
        // Le maillage est debout, pieds à y = 0 : sans recentrage il sort du cadre par le haut.
        // On le recentre sur sa boîte englobante et on l'ajuste à la hauteur visible.
        var boite = new THREE.Box3().setFromObject(gltf.scene);
        var centre = boite.getCenter(new THREE.Vector3());
        var taille = boite.getSize(new THREE.Vector3());
        gltf.scene.position.sub(centre);
        var hauteur = taille.y || 1;
        gltf.scene.scale.setScalar(3.4 / hauteur);
        world.add(gltf.scene);
        maillagePret = true;
        if (opts.onMeshReady) opts.onMeshReady(meshes.length);
      },
      function (erreur) {
        if (opts.onMeshError) opts.onMeshError((erreur && erreur.message) || 'glb illisible');
      },
    );
  } catch (e) {
    loadError = (e && e.message) || String(e);
  }
  if (loadError) return { ok: false, reason: 'mesh', detail: loadError };

  // ── Taille du canvas ───────────────────────────────────────────────────────────────────────────
  // 🔴 Pas de `|| 1` ici, et c'est délibéré. Le moteur du Labo retombait sur 1 pixel quand le
  // canvas mesurait 0 : three rendait consciencieusement une image d'un pixel de haut, la scène se
  // déclarait `ok`, et l'écran restait vide sans la moindre erreur (défaut du 16/09/2026). Un
  // canvas sans pixels est un ÉCHEC, pas un cas limite à absorber.
  var tailleValide = false;
  function resize() {
    var w = canvas.clientWidth,
      h = canvas.clientHeight;
    if (w < 2 || h < 2) {
      tailleValide = false;
      return;
    }
    tailleValide = true;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  var ro = null;
  if (window.ResizeObserver) {
    ro = new ResizeObserver(resize);
    ro.observe(canvas);
  } else {
    window.addEventListener('resize', resize);
  }
  resize();

  // ── Gestes : rotation au doigt ─────────────────────────────────────────────────────────────────
  var down = null,
    yaw = 0,
    yawT = 0,
    pitch = 0,
    pitchT = 0;
  var onDown = function (e) {
    down = { x: e.clientX, y: e.clientY, yaw: yawT, pitch: pitchT };
  };
  canvas.addEventListener('pointerdown', onDown);
  var onMove = function (e) {
    if (!down) return;
    yawT = down.yaw - (e.clientX - down.x) * 0.006;
    pitchT = Math.max(-0.35, Math.min(0.35, down.pitch + (e.clientY - down.y) * 0.003));
  };
  window.addEventListener('pointermove', onMove);
  var onUp = function () {
    down = null;
  };
  window.addEventListener('pointerup', onUp);

  // ── Influences ─────────────────────────────────────────────────────────────────────────────────
  // React pose des CIBLES, il ne pilote pas l'image : la boucle rattrape, exactement comme le Labo.
  var cibles = {},
    courantes = {},
    pousseesNonNulles = 0;

  function setInfluences(liste) {
    cibles = {};
    pousseesNonNulles = 0;
    (liste || []).forEach(function (influence) {
      cibles[influence.name] = influence.value;
      if (influence.value !== 0) pousseesNonNulles++;
    });
  }

  function appliquer(k) {
    Object.keys(cibles).forEach(function (nom) {
      var cible = cibles[nom];
      var courante = courantes[nom] === undefined ? 0 : courantes[nom];
      courante += (cible - courante) * k;
      if (Math.abs(cible - courante) < 0.001) courante = cible;
      courantes[nom] = courante;
      var entrees = morphIndex[nom];
      if (!entrees) return;
      for (var i = 0; i < entrees.length; i++) {
        var influences = entrees[i].mesh.morphTargetInfluences;
        if (influences) influences[entrees[i].index] = courante;
      }
    });
  }

  // ── Boucle ─────────────────────────────────────────────────────────────────────────────────────
  var raf = 0,
    disposed = false,
    last = performance.now(),
    reduced = !!opts.reducedMotion,
    fpsLisse = 0,
    premiereImage = 0;

  function frame() {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    var now = performance.now();
    if (document.hidden) {
      last = now;
      return;
    }
    var dt = Math.max(0.0001, Math.min(0.05, (now - last) / 1000));
    last = now;
    fpsLisse = fpsLisse === 0 ? 1 / dt : fpsLisse + (1 / dt - fpsLisse) * 0.08;

    var k = reduced ? 1 : 1 - Math.pow(0.02, dt);
    yaw += (yawT - yaw) * k;
    pitch += (pitchT - pitch) * k;
    world.rotation.y = yaw;
    world.rotation.x = pitch;
    appliquer(k);

    // Un canvas sans pixels ne rend pas : on ne maquille pas l'absence de surface.
    if (!tailleValide) return;
    renderer.render(scene, camera);
    if (!premiereImage) premiereImage = now;
  }
  raf = requestAnimationFrame(frame);

  function stats() {
    return {
      fps: Math.round(fpsLisse),
      meshes: meshes.length,
      morphsParMaillage: meshes.map(function (m) {
        return m.morphTargetInfluences ? m.morphTargetInfluences.length : 0;
      }),
      maillagePret: maillagePret,
      pousseesNonNulles: pousseesNonNulles,
      limite: MORPH_LIMIT_R128,
      premiereImageMs: premiereImage ? Math.round(premiereImage - debut) : 0,
    };
  }
  var debut = performance.now();

  function setReducedMotion(valeur) {
    reduced = !!valeur;
  }

  function dispose() {
    disposed = true;
    cancelAnimationFrame(raf);
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (ro) ro.disconnect();
    else window.removeEventListener('resize', resize);
    // `renderer.dispose()` NE SUFFIT PAS en r128 : il ne libère ni les géométries, ni les
    // matériaux. On parcourt. (Patron repris de lab/scene/engine.js.)
    scene.traverse(function (obj) {
      if (obj.geometry) obj.geometry.dispose();
      var mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
      mats.forEach(function (m) {
        Object.keys(m).forEach(function (cle) {
          var v = m[cle];
          if (v && v.isTexture) v.dispose();
        });
        m.dispose();
      });
    });
    renderer.dispose();
    // Un téléphone ne tolère qu'une poignée de contextes WebGL simultanés : on rend celui-ci tout
    // de suite au lieu d'attendre le ramasse-miettes.
    var lose = renderer.getContext().getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  }

  return {
    ok: true,
    setInfluences: setInfluences,
    setReducedMotion: setReducedMotion,
    stats: stats,
    dispose: dispose,
  };
}
