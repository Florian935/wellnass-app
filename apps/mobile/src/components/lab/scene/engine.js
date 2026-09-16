/* eslint-disable no-var -- portage a l'identique du prototype (ES5), voir l'en-tete ci-dessous. */
/**
 * US LABO-01 — la scène 3D du Labo (three.js r128), portage du prototype validé le 15/09/2026
 * (design/labo-2026-09/prototype/scene.js).
 *
 * ── Pourquoi ce fichier est en JavaScript ────────────────────────────────────────────────────────
 * C'est un portage à l'identique d'un fichier déjà relu et éprouvé. Le retyper en TypeScript strict
 * (noUncheckedIndexedAccess) l'aurait réécrit ligne à ligne pour aucun gain de sûreté : il ne tourne
 * que dans la WebView du composant DOM, et son contrat public tient en une poignée de fonctions,
 * typées côté appelant (LabScene3D.dom.tsx).
 *
 * ── Ce que l'app lui pousse ──────────────────────────────────────────────────────────────────────
 * setMode (semaine / formule), setValues (doses), setReality (le réel de la semaine), setCrossings
 * (les médailles), setLabels (tous les textes, traduits par l'app), setPillars (piliers activés),
 * focus, select. Aucune règle métier ici.
 *
 * Original :
 * Le Labo — les disques en 3D (three.js r128), rendu réaliste.
 * Un podium de salle porte la triade, qui flotte au-dessus et y projette son ombre :
 * musculation = une pile de disques de fonte (un par séance), course = une piste d'athlétisme avec ses
 * lumières de pacing, nutrition = une assiette compartimentée (saumon grillé, riz, brocolis).
 * Socle : sept lampes-nuits serties dans l'anneau de laiton du podium.
 * Croisements : des médailles dont le ruban porte les couleurs des deux piliers.
 * Deux lectures : « formule » (les doses composées) et « semaine » (le réel : disques faits / prévus en verre,
 * kilomètres courus sur la lice, nuits passées). Atmosphère : lumières floues de salle, cône de lumière,
 * poussière ; post-production (halo, tonalité filmique, grain) si le téléphone suit, coupée sinon.
 * Aucune règle métier ici : l'app pousse les valeurs, le réel, les croisements et l'étape. */
import * as THREE from 'three';


  var PILLAR_HEX = { muscu: '#e07a98', course: '#6fa8ef', nutrition: '#a9ba7e', socle: '#e0b155' };
  var CENTER = { muscu: [-0.8, -0.36], course: [0.8, -0.36], nutrition: [0, 0.8] };
  var LIFT = { nutrition: 0.34, course: 0.76, muscu: 1.08 };
  var TAU = Math.PI * 2;
  var DISPLAY = '"Bricolage Grotesque", "Segoe UI", system-ui, sans-serif';
  var MONO = '"Space Mono", ui-monospace, "Cascadia Mono", monospace';

  function rng(seed) { var a = seed | 0; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function createLabScene(canvas, opts) {
    opts = opts || {};
    var probeGl = null;
    try { var probe = document.createElement('canvas'); probeGl = probe.getContext('webgl2') || probe.getContext('webgl') || probe.getContext('experimental-webgl'); } catch (_e) { probeGl = null; }
    if (!probeGl) return { ok: false, reason: 'webgl' };
    var renderer = null, lastError = '';
    [{ antialias: true, alpha: true }, { antialias: false, alpha: true, powerPreference: 'low-power', precision: 'mediump' }].some(function (cfg) {
      try { renderer = new THREE.WebGLRenderer(Object.assign({ canvas: canvas }, cfg)); return true; } catch (e) { lastError = (e && e.message) || String(e); renderer = null; return false; }
    });
    if (!renderer) return { ok: false, reason: 'renderer', detail: lastError };
    // Pas de `preventDefault()` : on ne demande PAS la restauration du contexte, puisqu'on bascule
    // definitivement en 2D. Le demander sans ecouter `webglcontextrestored` laissait la promesse
    // d'un retour qui n'arrivait jamais.
    var onLost = function () { if (opts.onLost) opts.onLost(); };
    canvas.addEventListener('webglcontextlost', onLost);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.physicallyCorrectLights = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    var aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);
    var reduced = !!opts.reducedMotion;
    var quality = opts.quality || 'auto'; // 'high' garde la post-production, 'low' la coupe, 'auto' mesure

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
    var world = new THREE.Group(); scene.add(world);

    /* ───────── outils : textures dessinées, profils tournés ───────── */
    var texts = [];
    function tex(size, draw, opt) {
      opt = opt || {};
      var c = document.createElement('canvas'); c.width = opt.w || size; c.height = opt.h || size;
      draw(c.getContext('2d'), c.width, c.height);
      var t = new THREE.CanvasTexture(c);
      if (!opt.linear) t.encoding = THREE.sRGBEncoding;
      t.anisotropy = aniso;
      if (opt.text) texts.push({ c: c, t: t, draw: draw });
      return t;
    }
    // Les textures qui portent du texte sont redessinées quand les polices de la page sont prêtes.
    function redrawTexts() { texts.forEach(function (e) { var g = e.c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.c.width, e.c.height); e.draw(g, e.c.width, e.c.height); e.t.needsUpdate = true; }); }
    if (document.fonts && document.fonts.load) {
      Promise.all(['700 40px "Space Mono"', '800 40px "Bricolage Grotesque"'].map(function (f) { return document.fonts.load(f); })).then(redrawTexts, function () {});
    }
    function grain(g, w, h, n, colors, dmin, dmax, seed) {
      var r = rng(seed);
      for (var i = 0; i < n; i++) { g.fillStyle = colors[(r() * colors.length) | 0]; var d = dmin + r() * (dmax - dmin); g.fillRect(r() * w, r() * h, d, d); }
    }
    function radial(stops) {
      return tex(256, function (g, s) { var r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); stops.forEach(function (st) { r.addColorStop(st[0], st[1]); }); g.fillStyle = r; g.fillRect(0, 0, s, s); });
    }
    // Profil (rayon, hauteur[, arête vive]) tourné autour de Y. Le profil est remis dans le sens
    // trigonométrique pour que les normales pointent vers l'extérieur ; une arête vive est doublée.
    function lathe(pts, seg) {
      var area = 0;
      for (var i = 0; i < pts.length; i++) { var p = pts[i], q = pts[(i + 1) % pts.length]; area += p[0] * q[1] - q[0] * p[1]; }
      if (area < 0) pts = pts.slice().reverse();
      var out = [];
      pts.forEach(function (p) { out.push(new THREE.Vector2(p[0], p[1])); if (p[2]) out.push(new THREE.Vector2(p[0], p[1])); });
      return new THREE.LatheGeometry(out, seg);
    }
    var tmpM = new THREE.Matrix4(), tmpM2 = new THREE.Matrix4(), tmpC = new THREE.Color();
    var tq = new THREE.Quaternion(), te = new THREE.Euler(), ts = new THREE.Vector3(), tp = new THREE.Vector3();
    // Lumière additive qui n'écrit pas l'alpha : un halo s'ajoute au fond de la page sans le masquer.
    function glowMat(mat) {
      mat.blending = THREE.CustomBlending; mat.blendEquation = THREE.AddEquation;
      mat.blendSrc = THREE.SrcAlphaFactor; mat.blendDst = THREE.OneFactor; mat.blendSrcAlpha = THREE.ZeroFactor; mat.blendDstAlpha = THREE.OneFactor;
      mat.transparent = true; mat.depthWrite = false; return mat;
    }

    /* ───────── environnement : un studio photo pour les reflets ───────── */
    (function buildEnvironment() {
      var env = new THREE.Scene();
      env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 16, 30), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.03, 0.022, 0.018), side: THREE.BackSide })));
      var panel = function (w, h, rgb, pos) { var mm = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(rgb[0], rgb[1], rgb[2]), side: THREE.DoubleSide })); mm.position.set(pos[0], pos[1], pos[2]); mm.lookAt(0, 0, 0); env.add(mm); };
      panel(12, 6, [5.2, 4.5, 3.7], [-1, 9, 3]);
      panel(3, 9, [0.35, 0.75, 2.1], [11, 3, -3]);
      panel(3, 9, [2.0, 0.35, 0.7], [-11, 3, -3]);
      panel(12, 2.5, [0.7, 0.55, 0.4], [0, 1, 12]);
      panel(12, 4, [2.4, 2.0, 1.6], [0, 6, -10]);
      var pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(env, 0.04).texture;
      pmrem.dispose();
    })();

    /* ───────── lumières ───────── */
    var KEY_I = 3.1;
    var key = new THREE.DirectionalLight(0xfff1e0, KEY_I);
    key.position.set(-2.4, 9, 3.4); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.015;
    var sc = key.shadow.camera; sc.left = -3.4; sc.right = 3.4; sc.top = 3.4; sc.bottom = -3.4; sc.near = 2; sc.far = 18;
    scene.add(key);
    var rimBlue = new THREE.DirectionalLight(0x86b4ff, 1.8); rimBlue.position.set(6, 3, -6); scene.add(rimBlue);
    var rimRose = new THREE.DirectionalLight(0xff8fb0, 1.3); rimRose.position.set(-6, 2.5, -4); scene.add(rimRose);
    scene.add(new THREE.HemisphereLight(0xfff4e6, 0x2a1d14, 0.45));
    var alarm = new THREE.PointLight(0xff5a48, 0, 5, 2); alarm.position.set(0, 0.15, 0.25); scene.add(alarm);

    /* ───────── l'atmosphère : lumières floues de la salle, cône de lumière, poussière ───────── */
    var bokehTex = tex(128, function (g, s) { var r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,.5)'); r.addColorStop(0.75, 'rgba(255,255,255,.6)'); r.addColorStop(0.9, 'rgba(255,255,255,.85)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.beginPath(); g.arc(s / 2, s / 2, s / 2, 0, TAU); g.fill(); });
    (function () {
      var r = rng(88), COLS = [0xffc488, 0xffa060, 0xff7aa8, 0x7fb0ff, 0xfff0d8, 0xffb070];
      for (var i = 0; i < 24; i++) {
        var a = Math.PI * (1.06 + r() * 0.88), rad = 10 + r() * 6;
        var sp = new THREE.Sprite(glowMat(new THREE.SpriteMaterial({ map: bokehTex, color: COLS[(r() * COLS.length) | 0], opacity: 0.04 + r() * 0.1 })));
        sp.position.set(Math.cos(a) * rad, 0.6 + r() * 6, Math.sin(a) * rad * 0.85 - 1.5); sp.scale.setScalar(0.5 + r() * 1.9); scene.add(sp);
      }
    })();
    var coneMat = glowMat(new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(0xffe0b0) }, strength: { value: 0.07 } },
      vertexShader: 'varying float vH; varying vec3 vN; varying vec3 vV; void main() { vH = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 color; uniform float strength; varying float vH; varying vec3 vN; varying vec3 vV; void main() { float f = pow(abs(dot(vN, vV)), 2.2); float h = smoothstep(0.62, 0.2, vH) * smoothstep(0.0, 0.08, vH); gl_FragColor = vec4(color * strength * f * h, 1.0); }',
      side: THREE.DoubleSide,
    }));
    var CONE_H = 8.5, CONE_TOP = 0.35, CONE_BOT = 2.55;
    var cone = new THREE.Mesh(new THREE.CylinderGeometry(CONE_TOP, CONE_BOT, CONE_H, 72, 1, true), coneMat);
    cone.position.set(0, 0.25 + CONE_H / 2, -0.15); cone.renderOrder = 5; scene.add(cone);
    var DUST = 170, dustPos = new Float32Array(DUST * 3), dustBase = [];
    (function () {
      var r = rng(99);
      for (var i = 0; i < DUST; i++) {
        var y = 0.35 + r() * 3.2, rad = (CONE_BOT - ((y - 0.25) / CONE_H) * (CONE_BOT - CONE_TOP)) * 0.85 * Math.sqrt(r()), a = r() * TAU;
        dustBase.push({ x: Math.cos(a) * rad, y: y, z: Math.sin(a) * rad - 0.15, ph: r() * TAU, sp: 0.03 + r() * 0.05 });
      }
    })();
    var dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    var dustTex = tex(64, function (g, s) { var r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); });
    var dust = new THREE.Points(dustGeo, glowMat(new THREE.PointsMaterial({ map: dustTex, size: 0.035, sizeAttenuation: true, color: 0xffe8c8, opacity: 0.6 })));
    dust.frustumCulled = false; scene.add(dust);

    /* ───────── le podium : sol de salle en granulés, anneau de laiton, liseré lumineux ───────── */
    var PODIUM_R = 2.3;
    var podium = new THREE.Group(); world.add(podium);
    var floorMap = tex(2048, function (g, w, h) {
      g.fillStyle = '#2a231d'; g.fillRect(0, 0, w, h);
      grain(g, w, h, 110000, ['rgba(0,0,0,.4)', 'rgba(255,240,220,.06)', 'rgba(70,58,46,.7)', 'rgba(14,11,9,.8)'], 1.2, 3.4, 51);
      grain(g, w, h, 7000, ['rgba(190,60,98,.75)', 'rgba(60,112,190,.75)', 'rgba(120,150,76,.75)', 'rgba(214,160,70,.7)'], 1.6, 3.6, 52);
    });
    var floorBump = tex(1024, function (g, w, h) { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); grain(g, w, h, 60000, ['#a2a2a2', '#585858'], 1, 2.6, 53); }, { linear: true });
    var floorTop = new THREE.Mesh(new THREE.CircleGeometry(PODIUM_R - 0.04, 160), new THREE.MeshPhysicalMaterial({ map: floorMap, bumpMap: floorBump, bumpScale: 0.008, roughness: 0.88, metalness: 0, clearcoat: 0.22, clearcoatRoughness: 0.55 }));
    floorTop.rotation.x = -Math.PI / 2; floorTop.receiveShadow = true; podium.add(floorTop);
    var edgeMat = new THREE.MeshStandardMaterial({ color: 0x2e2620, metalness: 0.8, roughness: 0.34 });
    var podiumEdge = new THREE.Mesh(lathe([[PODIUM_R - 0.3, -0.3], [PODIUM_R - 0.05, -0.3, 1], [PODIUM_R, -0.26, 1], [PODIUM_R, -0.035, 1], [PODIUM_R - 0.012, -0.004], [PODIUM_R - 0.04, 0.001, 1]], 180), edgeMat);
    podiumEdge.receiveShadow = true; podium.add(podiumEdge);
    var ledMat = new THREE.MeshBasicMaterial({ color: 0xffb46b });
    var led = new THREE.Mesh(new THREE.TorusGeometry(PODIUM_R - 0.02, 0.012, 8, 200), ledMat);
    led.rotation.x = Math.PI / 2; led.position.y = -0.3; podium.add(led);
    var underGlowTex = tex(512, function (g, s) {
      var r = g.createRadialGradient(s / 2, s / 2, s * 0.3, s / 2, s / 2, s / 2);
      r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.55, 'rgba(255,255,255,.55)'); r.addColorStop(0.72, 'rgba(255,255,255,.16)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, s, s);
    });
    var underGlow = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 7.2), new THREE.MeshBasicMaterial({ map: underGlowTex, color: 0xffa860, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
    underGlow.rotation.x = -Math.PI / 2; underGlow.position.y = -0.62; podium.add(underGlow);
    var dropShadow = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 6.4), new THREE.MeshBasicMaterial({ map: radial([[0, 'rgba(0,0,0,.75)'], [0.55, 'rgba(0,0,0,.45)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false }));
    dropShadow.rotation.x = -Math.PI / 2; dropShadow.position.y = -0.64; podium.add(dropShadow);

    // L'anneau des nuits : laiton brossé, jours gravés, sept lampes en forme de lune.
    var RING_IN = 1.95, RING_OUT = 2.17, LAMP_R = 2.06;
    // Tous les textes gravés dans la scène : l'app les pousse traduits (setLabels).
    var LABELS = opts.labels || {};
    LABELS.brand = LABELS.brand || 'FITTRIO';
    LABELS.plate = LABELS.plate || 'SEANCE';
    LABELS.trackBig = LABELS.trackBig || '';
    LABELS.trackSmall = LABELS.trackSmall || '';
    LABELS.days = LABELS.days || ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    var lampAngle = function (i) { return Math.PI / 2 - (i - 3) * (TAU / 7); };
    var ringMap = tex(2048, function (g, s) {
      var c = s / 2, k = c / RING_OUT;
      g.clearRect(0, 0, s, s);
      g.fillStyle = '#d0a462'; g.beginPath(); g.arc(c, c, RING_OUT * k, 0, TAU); g.arc(c, c, RING_IN * k, 0, TAU, true); g.fill();
      for (var i = 0; i < 90; i++) { var rr = RING_IN + (i / 90) * (RING_OUT - RING_IN); g.strokeStyle = i % 3 ? 'rgba(255,236,190,.10)' : 'rgba(60,36,10,.12)'; g.lineWidth = 1.5; g.beginPath(); g.arc(c, c, rr * k, 0, TAU); g.stroke(); }
      g.strokeStyle = 'rgba(40,24,8,.55)'; g.lineWidth = 3;
      [RING_IN + 0.02, RING_OUT - 0.02].forEach(function (rr) { g.beginPath(); g.arc(c, c, rr * k, 0, TAU); g.stroke(); });
      g.font = '700 38px ' + MONO; g.textAlign = 'center'; g.textBaseline = 'middle';
      LABELS.days.forEach(function (d, i) {
        var a = lampAngle(i) + 0.15;
        g.save(); g.translate(c + Math.cos(a) * LAMP_R * k, c + Math.sin(a) * LAMP_R * k); g.rotate(a - Math.PI / 2);
        g.fillStyle = 'rgba(255,236,190,.35)'; g.fillText(d, 1.5, 1.5); g.fillStyle = 'rgba(46,28,8,.8)'; g.fillText(d, 0, 0);
        g.restore();
      });
    }, { text: true });
    var ring = new THREE.Mesh(new THREE.RingGeometry(RING_IN, RING_OUT, 180, 1), new THREE.MeshStandardMaterial({ map: ringMap, transparent: true, metalness: 0.9, roughness: 0.26, polygonOffset: true, polygonOffsetFactor: -2 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.002; ring.receiveShadow = true; podium.add(ring);
    var moonTex = tex(256, function (g, s) {
      var c = document.createElement('canvas'); c.width = c.height = s; var h = c.getContext('2d');
      h.fillStyle = '#fff'; h.beginPath(); h.arc(s / 2, s / 2, s * 0.38, 0, TAU); h.fill();
      h.globalCompositeOperation = 'destination-out'; h.beginPath(); h.arc(s / 2 + s * 0.19, s / 2 - s * 0.12, s * 0.32, 0, TAU); h.fill();
      g.fillStyle = '#000'; g.fillRect(0, 0, s, s); g.drawImage(c, 0, 0);
    });
    var glowTex = radial([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.4)'], [1, 'rgba(255,255,255,0)']]);
    var lampGroup = new THREE.Group(); podium.add(lampGroup);
    var bezelGeo = lathe([[0, 0], [0.13, 0, 1], [0.13, 0.016, 1], [0.108, 0.024, 1], [0, 0.024]], 48);
    var lensGeo = new THREE.CircleGeometry(0.104, 48);
    var bezelMat = new THREE.MeshStandardMaterial({ color: 0x3a3029, metalness: 1, roughness: 0.3 });
    var lamps = [];
    for (var li = 0; li < 7; li++) {
      var la = lampAngle(li), lg = new THREE.Group();
      lg.position.set(Math.cos(la) * LAMP_R, 0, Math.sin(la) * LAMP_R);
      var bz = new THREE.Mesh(bezelGeo, bezelMat); bz.castShadow = false; lg.add(bz);
      var lensMat = new THREE.MeshPhysicalMaterial({ color: 0x120e0b, roughness: 0.35, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4, emissive: 0xff9a2e, emissiveMap: moonTex, emissiveIntensity: 0 });
      var lens = new THREE.Mesh(lensGeo, lensMat); lens.rotation.x = -Math.PI / 2; lens.rotation.z = -la - Math.PI / 2; lens.position.y = 0.0245; lg.add(lens);
      var lglow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff9f3a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
      lglow.scale.setScalar(0.95); lglow.position.y = 0.06; lg.add(lglow);
      lampGroup.add(lg); lamps.push({ mat: lensMat, glow: lglow, lit: 0, want: 0, pos: lg.position });
    }
    var todayRing = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.007, 8, 56), glowMat(new THREE.MeshBasicMaterial({ color: 0xfff1d6, opacity: 0 })));
    todayRing.rotation.x = Math.PI / 2; todayRing.position.y = 0.03; lampGroup.add(todayRing);
    var MOON_OK = new THREE.Color(0xff9a2e), MOON_SHORT = new THREE.Color(0xff3a1c);

    // Halo de contact sous chaque objet (occlusion douce), en plus des ombres portées.
    var blobTex = radial([[0, 'rgba(0,0,0,.85)'], [0.5, 'rgba(0,0,0,.5)'], [1, 'rgba(0,0,0,0)']]);
    function blob(p, size) { var b = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.4 })); b.rotation.x = -Math.PI / 2; b.position.set(CENTER[p][0], 0.004, CENTER[p][1]); podium.add(b); return b; }
    var blobs = { muscu: blob('muscu', 2.7), course: blob('course', 2.6), nutrition: blob('nutrition', 2.5) };
    var selRing = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.7), new THREE.MeshBasicMaterial({ map: radial([[0, 'rgba(255,255,255,.10)'], [0.62, 'rgba(255,255,255,.22)'], [0.8, 'rgba(255,255,255,.4)'], [1, 'rgba(255,255,255,0)']]), color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    selRing.rotation.x = -Math.PI / 2; selRing.position.y = 0.006; podium.add(selRing);

    /* ───────── MUSCULATION : la pile de disques de fonte (caoutchouc + insert acier) ───────── */
    var T = 0.15, GAP = 0.006, t2 = T / 2;
    var rubberMap = tex(512, function (g, w, h) { g.fillStyle = '#9b2452'; g.fillRect(0, 0, w, h); grain(g, w, h, 14000, ['rgba(255,190,215,.10)', 'rgba(0,0,0,.18)', 'rgba(60,0,20,.25)'], 0.8, 1.8, 11); });
    var rubberBump = tex(512, function (g, w, h) { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); grain(g, w, h, 9000, ['#9a9a9a', '#666'], 0.8, 1.6, 12); }, { linear: true });
    var rubberMat = new THREE.MeshPhysicalMaterial({ map: rubberMap, bumpMap: rubberBump, bumpScale: 0.003, roughness: 0.6, metalness: 0, clearcoat: 0.18, clearcoatRoughness: 0.5 });
    var brushed = tex(256, function (g, w, h) { g.fillStyle = '#6a6a6a'; g.fillRect(0, 0, w, h); var r = rng(13); for (var i = 0; i < h; i += 2) { g.fillStyle = 'rgba(' + (r() > 0.5 ? '255,255,255' : '0,0,0') + ',' + (0.05 + r() * 0.12).toFixed(2) + ')'; g.fillRect(0, i, w, 1); } }, { linear: true });
    var steelMat = new THREE.MeshStandardMaterial({ color: 0xdedbd5, metalness: 1, roughness: 0.3, roughnessMap: brushed });
    var boltMat = new THREE.MeshStandardMaterial({ color: 0x9d9a94, metalness: 1, roughness: 0.4 });
    var rubberGeo = lathe([
      [0.28, -t2, 1], [0.95, -t2], [0.985, -t2 + 0.012], [1.0, -t2 + 0.034, 1], [1.0, t2 - 0.034, 1], [0.985, t2 - 0.012], [0.95, t2, 1],
      [0.875, t2, 1], [0.855, t2 - 0.016, 1], [0.49, t2 - 0.016, 1], [0.47, t2, 1], [0.28, t2, 1], [0.28, -t2, 1],
    ], 128);
    var hubGeo = lathe([[0.1, -t2 - 0.006, 1], [0.262, -t2 - 0.006, 1], [0.285, -t2 + 0.006, 1], [0.285, t2 - 0.006, 1], [0.262, t2 + 0.006, 1], [0.1, t2 + 0.006, 1], [0.1, -t2 - 0.006, 1]], 72);
    var boltGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.012, 6);
    var decalGeo = new THREE.RingGeometry(0.49, 0.855, 128, 1);
    function plateDecal(n) {
      return tex(768, function (g, s) {
        var c = s / 2, k = c / 0.855;
        g.clearRect(0, 0, s, s);
        g.save(); g.translate(c, c);
        var arc = function (label, radius, a0, dir, size, spacing, color) {
          g.font = size; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
          var total = 0, widths = label.split('').map(function (ch) { var wd = g.measureText(ch).width + spacing; total += wd; return wd; });
          var ang = a0 - dir * (total / 2) / (radius * k), acc = 0;
          label.split('').forEach(function (ch, i) {
            var mid = ang + dir * (acc + widths[i] / 2) / (radius * k); acc += widths[i];
            g.save(); g.rotate(mid); g.translate(radius * k, 0); g.rotate(dir > 0 ? Math.PI / 2 : -Math.PI / 2); g.fillText(ch, 0, 0); g.restore();
          });
        };
        arc(LABELS.brand, 0.68, -Math.PI / 2, 1, '800 58px ' + DISPLAY, 6, 'rgba(250,240,244,.9)');
        arc(LABELS.plate + ' ' + n, 0.68, Math.PI / 2, -1, '700 40px ' + MONO, 4, 'rgba(250,240,244,.82)');
        g.strokeStyle = 'rgba(250,240,244,.5)'; g.lineWidth = 3;
        [0.535, 0.815].forEach(function (rr) { g.beginPath(); g.arc(0, 0, rr * k, 0, TAU); g.stroke(); });
        g.fillStyle = 'rgba(250,240,244,.85)';
        [0, Math.PI].forEach(function (a) { g.save(); g.rotate(a); g.fillRect(0.64 * k, -5, 0.08 * k, 10); g.restore(); });
        g.restore();
      }, { text: true });
    }
    var ghostMat = new THREE.MeshStandardMaterial({ color: 0xb0305e, roughness: 0.8, metalness: 0, transparent: true, opacity: 0.2, depthWrite: false });
    var dashTex = tex(256, function (g, w, h) { g.clearRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(0, 0, w * 0.55, h); }, { w: 256, h: 8 });
    dashTex.wrapS = THREE.RepeatWrapping; dashTex.repeat.set(44, 1);
    var ghostRimMat = glowMat(new THREE.MeshBasicMaterial({ map: dashTex, color: 0xffa6c4, opacity: 0.75, side: THREE.DoubleSide }));
    var rimGeo = new THREE.CylinderGeometry(1.004, 1.004, 0.014, 160, 1, true);
    function makePlate(n) {
      var g = new THREE.Group(), bolts = [], rims = [];
      var body = new THREE.Mesh(rubberGeo, rubberMat); body.castShadow = true; body.receiveShadow = true; g.add(body);
      var hub = new THREE.Mesh(hubGeo, steelMat); hub.castShadow = true; hub.receiveShadow = true; g.add(hub);
      for (var i = 0; i < 6; i++) { var a = (i / 6) * TAU; var b = new THREE.Mesh(boltGeo, boltMat); b.position.set(Math.cos(a) * 0.185, t2 + 0.01, Math.sin(a) * 0.185); g.add(b); bolts.push(b); }
      var dtex = plateDecal(n);
      var decal = new THREE.Mesh(decalGeo, new THREE.MeshStandardMaterial({ map: dtex, bumpMap: dtex, bumpScale: 0.0025, transparent: true, roughness: 0.55, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      decal.rotation.x = -Math.PI / 2; decal.position.y = t2 - 0.016 + 0.0008; decal.receiveShadow = true; g.add(decal);
      [t2 - 0.012].forEach(function (y) { var rim = new THREE.Mesh(rimGeo, ghostRimMat); rim.position.y = y; rim.visible = false; g.add(rim); rims.push(rim); });
      g.parts = { body: body, hub: hub, bolts: bolts, decal: decal, rims: rims, ghost: false };
      return g;
    }
    // Un disque « prévu » (séance pas encore faite) devient du verre teinté, cerclé de lumière.
    function setGhost(p, ghost) {
      var q = p.parts; if (q.ghost === ghost) return; q.ghost = ghost;
      q.body.material = ghost ? ghostMat : rubberMat; q.hub.material = ghost ? ghostMat : steelMat;
      q.body.castShadow = q.hub.castShadow = !ghost;
      q.bolts.forEach(function (b) { b.visible = !ghost; }); q.decal.visible = !ghost;
      q.rims.forEach(function (r) { r.visible = ghost; });
    }
    var stack = new THREE.Group(); stack.position.set(CENTER.muscu[0], LIFT.muscu, CENTER.muscu[1]); world.add(stack);
    var plates = [];
    for (var pi = 0; pi < 5; pi++) {
      var pl = makePlate(pi + 1); pl.visible = false;
      pl.userData = { y: 0, vy: 0, target: 0, shown: 0, scale: 0 };
      pl.rotation.set((pi % 2 ? 1 : -1) * 0.006, 0.45 + pi * 0.31, (pi % 3 ? -1 : 1) * 0.005);
      stack.add(pl); plates.push(pl);
    }

    /* ───────── COURSE : la piste, ses lumières de pacing, deux haies ───────── */
    var TH = 0.07;
    var infieldLabel = { big: '', small: '' };
    var trackMap = tex(2048, function (g, s) {
      var c = s / 2, px = function (r) { return r * c; };
      g.fillStyle = '#33383f'; g.fillRect(0, 0, s, s);
      grain(g, s, s, 30000, ['rgba(255,255,255,.05)', 'rgba(0,0,0,.2)'], 1, 2.4, 20);
      g.save(); g.beginPath(); g.arc(c, c, px(0.975), 0, TAU); g.clip();
      g.fillStyle = '#2f66b3'; g.fillRect(0, 0, s, s);
      grain(g, s, s, 90000, ['rgba(255,255,255,.07)', 'rgba(0,0,0,.16)', 'rgba(140,190,255,.10)', 'rgba(10,30,70,.25)'], 1, 2.6, 21);
      g.restore();
      g.lineWidth = px(0.01); g.strokeStyle = '#eef2f6';
      g.beginPath(); g.arc(c, c, px(0.97), 0, TAU); g.stroke();
      [0.895, 0.82, 0.745, 0.67, 0.595].forEach(function (r) { g.lineWidth = px(0.0055); g.strokeStyle = 'rgba(242,246,250,.92)'; g.beginPath(); g.arc(c, c, px(r), 0, TAU); g.stroke(); });
      g.save(); g.beginPath(); g.arc(c, c, px(0.53), 0, TAU); g.clip();
      for (var i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#4a7c30' : '#588f3b'; g.fillRect(px(0.47) + i * px(0.088), 0, px(0.088), s); }
      grain(g, s, s, 70000, ['rgba(20,60,10,.22)', 'rgba(200,240,160,.09)', 'rgba(40,90,20,.2)'], 1, 2.2, 22);
      g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = px(0.005);
      g.beginPath(); g.arc(c, c, px(0.13), 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(c - px(0.53), c); g.lineTo(c + px(0.53), c); g.stroke();
      g.restore();
      g.fillStyle = '#d9dde2'; g.beginPath(); g.arc(c, c, px(0.545), 0, TAU); g.arc(c, c, px(0.53), 0, TAU, true); g.fill();
      g.font = '700 ' + Math.round(px(0.045)) + 'px ' + MONO; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (var l = 0; l < 5; l++) {
        var rin = 0.595 + l * 0.075, rmid = rin + 0.0375, a = Math.PI / 2 + 0.36 + l * 0.085;
        g.strokeStyle = '#fff'; g.lineWidth = px(0.007);
        g.beginPath(); g.moveTo(c + Math.cos(a) * px(rin), c + Math.sin(a) * px(rin)); g.lineTo(c + Math.cos(a) * px(rin + 0.075), c + Math.sin(a) * px(rin + 0.075)); g.stroke();
        g.save(); g.translate(c + Math.cos(a + 0.075) * px(rmid), c + Math.sin(a + 0.075) * px(rmid)); g.rotate(a + 0.075 - Math.PI / 2); g.fillStyle = '#fff'; g.fillText(String(l + 1), 0, 0); g.restore();
      }
      for (var kk = 0; kk < 9; kk++) for (var j = 0; j < 2; j++) {
        var r0 = 0.545 + kk * 0.0472, a0 = Math.PI / 2 - 0.02 + j * 0.02;
        g.fillStyle = (kk + j) % 2 ? '#15181c' : '#f4f4f4';
        g.beginPath(); g.arc(c, c, px(r0 + 0.0472), a0, a0 + 0.02); g.arc(c, c, px(r0), a0 + 0.02, a0, true); g.closePath(); g.fill();
      }
    }, { text: true });
    var trackBump = tex(1024, function (g, w, h) { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); grain(g, w, h, 50000, ['#9c9c9c', '#626262'], 1, 2, 23); }, { linear: true });
    var track = new THREE.Group(); track.position.set(CENTER.course[0], LIFT.course, CENTER.course[1]); world.add(track);
    var trackInner = new THREE.Group(); track.add(trackInner);
    var trackTop = new THREE.Mesh(new THREE.CircleGeometry(1, 160), new THREE.MeshStandardMaterial({ map: trackMap, bumpMap: trackBump, bumpScale: 0.004, roughness: 0.82, metalness: 0 }));
    trackTop.rotation.x = -Math.PI / 2; trackTop.position.y = TH / 2; trackTop.receiveShadow = true; trackTop.castShadow = true; trackInner.add(trackTop);
    var trackSide = new THREE.Mesh(lathe([[0, -TH / 2], [0.975, -TH / 2], [0.993, -TH / 2 + 0.006], [1.0, -TH / 2 + 0.02, 1], [1.0, TH / 2, 1], [0.999, TH / 2]], 160), new THREE.MeshStandardMaterial({ color: 0x37414c, metalness: 0.55, roughness: 0.4 }));
    trackSide.castShadow = true; trackSide.receiveShadow = true; trackInner.add(trackSide);
    var infieldTex = tex(512, function (g, s) {
      g.clearRect(0, 0, s, s);
      g.fillStyle = 'rgba(250,252,246,.96)'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '800 150px ' + DISPLAY; g.fillText(infieldLabel.big, s / 2, s / 2 - 50);
      g.font = '700 50px ' + MONO; g.fillText(infieldLabel.small, s / 2, s / 2 + 62);
    }, { text: true });
    var infield = new THREE.Mesh(new THREE.CircleGeometry(0.44, 64), new THREE.MeshStandardMaterial({ map: infieldTex, transparent: true, roughness: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    infield.rotation.x = -Math.PI / 2; infield.position.set(0, TH / 2 + 0.0008, 0.02); infield.receiveShadow = true; trackInner.add(infield);
    var LEDS = 120, LED_R = 0.5375;
    var leds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.02, 0.008, 0.01), new THREE.MeshBasicMaterial({ color: 0xffffff }), LEDS);
    for (var ld = 0; ld < LEDS; ld++) {
      var lda = (ld / LEDS) * TAU;
      tq.setFromAxisAngle(ts.set(0, 1, 0), -lda + Math.PI / 2);
      tmpM.compose(tp.set(Math.cos(lda) * LED_R, TH / 2 + 0.004, Math.sin(lda) * LED_R), tq, ts.set(1, 1, 1));
      leds.setMatrixAt(ld, tmpM); leds.setColorAt(ld, tmpC.setRGB(0.1, 0.12, 0.14));
    }
    trackInner.add(leds);
    var pacerGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x9fd0ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
    pacerGlow.scale.setScalar(0.2); trackInner.add(pacerGlow);
    var hurdleTex = tex(128, function (g, w, h) { for (var i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#15181c' : '#f5f5f2'; g.fillRect((i * w) / 8, 0, w / 8, h); } }, { w: 128, h: 16 });
    var hurdleBarMat = new THREE.MeshStandardMaterial({ map: hurdleTex, roughness: 0.5 });
    var hurdleLegMat = new THREE.MeshStandardMaterial({ color: 0xcfd3d8, metalness: 1, roughness: 0.35 });
    [[-0.62, 0.858], [-0.46, 0.858]].forEach(function (hh) {
      var hg = new THREE.Group(), ha = hh[0] * Math.PI;
      var bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.024, 0.007), hurdleBarMat); bar.position.y = 0.085; bar.castShadow = true; hg.add(bar);
      [-0.072, 0.072].forEach(function (x) {
        var leg = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.085, 0.007), hurdleLegMat); leg.position.set(x, 0.043, 0); leg.castShadow = true; hg.add(leg);
        var foot = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.006, 0.07), hurdleLegMat); foot.position.set(x, 0.003, 0.03); hg.add(foot);
      });
      hg.position.set(Math.cos(ha) * hh[1], TH / 2, Math.sin(ha) * hh[1]);
      hg.rotation.y = -ha - Math.PI / 2;
      trackInner.add(hg);
    });

    /* ───────── NUTRITION : l'assiette compartimentée ───────── */
    var ceramicMap = tex(1024, function (g, w, h) { g.fillStyle = '#f5f0e7'; g.fillRect(0, 0, w, h); grain(g, w, h, 6000, ['rgba(120,100,80,.07)', 'rgba(255,255,255,.3)'], 0.8, 1.8, 31); });
    var ceramicMat = new THREE.MeshPhysicalMaterial({ map: ceramicMap, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08 });
    var dish = new THREE.Group(); dish.position.set(CENTER.nutrition[0], LIFT.nutrition, CENTER.nutrition[1]); world.add(dish);
    var plateMesh = new THREE.Mesh(lathe([
      [0, -0.006], [0.5, -0.006], [0.5, -0.022, 1], [0.56, -0.022], [0.62, -0.01], [0.78, 0.044], [0.94, 0.06], [0.99, 0.066], [1.0, 0.08], [0.986, 0.096], [0.94, 0.1], [0.78, 0.085], [0.72, 0.058], [0.66, 0.03], [0.6, 0.02], [0, 0.02],
    ], 160), ceramicMat);
    plateMesh.castShadow = true; plateMesh.receiveShadow = true; dish.add(plateMesh);
    var dividerShape = new THREE.Shape();
    (function () { var w = 0.022, h = 0.07; dividerShape.moveTo(-w, 0); dividerShape.lineTo(-w, h - 0.02); dividerShape.quadraticCurveTo(-w, h, 0, h); dividerShape.quadraticCurveTo(w, h, w, h - 0.02); dividerShape.lineTo(w, 0); dividerShape.lineTo(-w, 0); })();
    var dividerGeo = new THREE.ExtrudeGeometry(dividerShape, { depth: 0.62, bevelEnabled: false, curveSegments: 8 });
    var dividers = [0, 1, 2].map(function () {
      var holder = new THREE.Group();
      var mm = new THREE.Mesh(dividerGeo, ceramicMat); mm.position.set(0, 0.016, -0.66); mm.castShadow = true; mm.receiveShadow = true;
      holder.add(mm); dish.add(holder); return holder;
    });
    var foodRoot = new THREE.Group(); dish.add(foodRoot);

    // Riz : un monticule de grains, concentrés à la surface.
    var RICE = 1500;
    var riceMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0 }), RICE);
    riceMesh.castShadow = true; riceMesh.receiveShadow = true; foodRoot.add(riceMesh);
    // Brocolis : bouquets de boutons sur une tige, couchés dans l'assiette.
    var FLORETS = 7, BUDS = 64;
    var budMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0 }), FLORETS * BUDS);
    budMesh.castShadow = true; budMesh.receiveShadow = true; foodRoot.add(budMesh);
    var stemMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.03, 0.12, 10), new THREE.MeshStandardMaterial({ color: 0xa6c07a, roughness: 0.55 }), FLORETS);
    stemMesh.castShadow = true; foodRoot.add(stemMesh);
    var tomatoMat = new THREE.MeshPhysicalMaterial({ color: 0xc72c1c, roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.1 });
    var calyxMat = new THREE.MeshStandardMaterial({ color: 0x4e7a2c, roughness: 0.6 });
    var tomatoes = [0, 1].map(function () {
      var tg = new THREE.Group();
      var body = new THREE.Mesh(new THREE.SphereGeometry(0.052, 24, 16), tomatoMat); body.scale.y = 0.9; body.castShadow = true; body.receiveShadow = true; tg.add(body);
      var cx = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.012, 5), calyxMat); cx.position.y = 0.05; tg.add(cx);
      foodRoot.add(tg); return tg;
    });
    // Saumon : un pavé bombé, chair nacrée, marques de grill.
    function filletGeometry() {
      var geo = new THREE.SphereGeometry(1, 48, 24), p = geo.attributes.position, uv = geo.attributes.uv;
      var L = 0.21, W = 0.14, H = 0.058;
      for (var i = 0; i < p.count; i++) {
        var x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        var sx = Math.sign(x) * Math.pow(Math.abs(x), 0.45), sz = Math.sign(z) * Math.pow(Math.abs(z), 0.5);
        var along = (sx + 1) / 2, taper = 1 - 0.32 * along;
        var yy = y > 0 ? Math.pow(y, 0.4) * H * (1 - 0.3 * along) : y * 0.012;
        p.setXYZ(i, sx * L, yy, sz * W * taper);
        uv.setXY(i, along, (sz * taper + 1) / 2);
      }
      geo.computeVertexNormals();
      return geo;
    }
    var salmonMap = tex(512, function (g, s) {
      var grd = g.createLinearGradient(0, 0, s, 0); grd.addColorStop(0, '#f57f4f'); grd.addColorStop(0.6, '#fa9061'); grd.addColorStop(1, '#f07e50'); g.fillStyle = grd; g.fillRect(0, 0, s, s);
      g.strokeStyle = 'rgba(255,236,222,.7)'; g.lineWidth = 5;
      for (var i = -2; i < 12; i++) { var x0 = i * 46; g.beginPath(); g.moveTo(x0, 0); g.quadraticCurveTo(x0 + 34, s / 2, x0, s); g.stroke(); }
      g.filter = 'blur(5px)'; g.strokeStyle = 'rgba(58,24,8,.9)'; g.lineWidth = 26;
      for (var j = 0; j < 4; j++) { g.beginPath(); g.moveTo(60 + j * 120, -20); g.lineTo(-40 + j * 120, s + 20); g.stroke(); }
      g.filter = 'none';
      var edge = g.createRadialGradient(s / 2, s / 2, s * 0.25, s / 2, s / 2, s * 0.72); edge.addColorStop(0, 'rgba(160,70,30,0)'); edge.addColorStop(1, 'rgba(150,64,26,.55)');
      g.fillStyle = edge; g.fillRect(0, 0, s, s);
    });
    var salmonMat = new THREE.MeshPhysicalMaterial({ map: salmonMap, bumpMap: salmonMap, bumpScale: 0.003, roughness: 0.5, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.35 });
    var filletGeo = filletGeometry();
    var dillMat = new THREE.MeshStandardMaterial({ color: 0x3f6a2a, roughness: 0.7 });
    var fillets = [0, 1].map(function (fi) {
      var mm = new THREE.Mesh(filletGeo, salmonMat); mm.castShadow = true; mm.receiveShadow = true;
      var dill = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.003, 0.004), dillMat, 14), r = rng(70 + fi);
      for (var d = 0; d < 14; d++) {
        var dx = (r() - 0.5) * 0.26, dz = (r() - 0.5) * 0.12, along = (dx / 0.2 + 1) / 2;
        te.set(0, r() * TAU, 0); tq.setFromEuler(te);
        tmpM.compose(tp.set(dx, 0.068 * (1 - 0.35 * along) * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(dz) / 0.1, 2)), 0.35) + 0.002, dz), tq, ts.set(1, 1, 1));
        dill.setMatrixAt(d, tmpM);
      }
      mm.add(dill);
      foodRoot.add(mm); return mm;
    });
    var lemonTex = tex(256, function (g, s) {
      g.fillStyle = '#f3d24a'; g.beginPath(); g.arc(s / 2, s / 2, s / 2, 0, TAU); g.fill();
      g.fillStyle = '#fbf1c6'; g.beginPath(); g.arc(s / 2, s / 2, s * 0.44, 0, TAU); g.fill();
      for (var i = 0; i < 9; i++) { var a0 = (i / 9) * TAU + 0.05, a1 = ((i + 1) / 9) * TAU - 0.05; g.fillStyle = i % 2 ? '#f6dc62' : '#f3d550'; g.beginPath(); g.moveTo(s / 2 + Math.cos((a0 + a1) / 2) * 6, s / 2 + Math.sin((a0 + a1) / 2) * 6); g.arc(s / 2, s / 2, s * 0.41, a0, a1); g.closePath(); g.fill(); }
    });
    var lemon = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.014, 36), [new THREE.MeshStandardMaterial({ color: 0xf0cd3c, roughness: 0.5 }), new THREE.MeshPhysicalMaterial({ map: lemonTex, roughness: 0.3, clearcoat: 0.6 }), new THREE.MeshStandardMaterial({ map: lemonTex, roughness: 0.4 })]);
    lemon.castShadow = true; foodRoot.add(lemon);
    var steamTex = radial([[0, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]);
    var steam = [0, 1, 2, 3, 4].map(function (i) { var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 })); sp.userData.t = i / 5; dish.add(sp); return sp; });

    var dish3 = { P: 0.3, G: 0.36, portion: 0.88, laid: '' };
    var toXZ = function (theta, r) { return [Math.sin(theta) * r, -Math.cos(theta) * r]; };
    function layoutDish() {
      var aP = dish3.P * TAU, aG = (dish3.P + dish3.G) * TAU;
      dividers[0].rotation.y = 0; dividers[1].rotation.y = -aP; dividers[2].rotation.y = -aG;
      var key3 = dish3.P.toFixed(3) + '|' + dish3.G.toFixed(3);
      if (key3 === dish3.laid) return; dish3.laid = key3;
      var r = rng(41);
      var RICE_C = [0xfffaf0, 0xf7efdd, 0xfbf4e6, 0xeee3cb];
      for (var i = 0; i < RICE; i++) {
        var th = aP + 0.12 + r() * (aG - aP - 0.24), rr = 0.12 + Math.sqrt(r()) * 0.48;
        var ft = Math.sin(Math.PI * (th - aP) / (aG - aP)), fr = Math.sin(Math.PI * (rr - 0.08) / 0.56);
        var H = Math.pow(Math.max(0, ft), 0.5) * Math.pow(Math.max(0, fr), 0.6) * 0.13;
        var depth = r(), xz = toXZ(th, rr);
        te.set((r() - 0.5) * 0.9, r() * TAU, (r() - 0.5) * 0.9); tq.setFromEuler(te);
        var kr = 0.85 + r() * 0.3;
        tmpM.compose(tp.set(xz[0], 0.032 + H * (1 - 0.9 * depth * depth), xz[1]), tq, ts.set(0.03 * kr, 0.011 * kr, 0.012 * kr));
        riceMesh.setMatrixAt(i, tmpM); riceMesh.setColorAt(i, tmpC.setHex(RICE_C[(r() * RICE_C.length) | 0]));
      }
      riceMesh.instanceMatrix.needsUpdate = true; if (riceMesh.instanceColor) riceMesh.instanceColor.needsUpdate = true;
      var GREENS = [0x23501a, 0x2d5f1f, 0x386e25, 0x1c4414, 0x497f30, 0x5b8d3a];
      for (var f = 0; f < FLORETS; f++) {
        var span = TAU - aG - 0.4, fth = aG + 0.2 + ((f + 0.5) / FLORETS) * span + (r() - 0.5) * 0.12;
        var frr = f % 2 ? 0.44 : 0.26 + r() * 0.06, fxz = toXZ(fth, frr);
        var sF = 0.85 + r() * 0.3;
        te.set((r() - 0.5) * 0.9, r() * TAU, (r() - 0.5) * 0.9); tq.setFromEuler(te);
        tmpM2.compose(tp.set(fxz[0], 0.03, fxz[1]), tq, ts.set(sF, sF, sF));
        tmpM.compose(tp.set(0, 0.05, 0), tq.set(0, 0, 0, 1), ts.set(1, 1, 1)).premultiply(tmpM2); stemMesh.setMatrixAt(f, tmpM);
        for (var b = 0; b < BUDS; b++) {
          var u = r() * TAU, cv = 0.08 + r() * 0.92, sv = Math.sqrt(1 - cv * cv), rad = 0.09 * (0.94 + r() * 0.1);
          var bs = 0.017 + r() * 0.014;
          te.set(r() * 3, r() * 3, r() * 3); tq.setFromEuler(te);
          tmpM.compose(tp.set(sv * Math.cos(u) * rad, 0.11 + cv * rad * 0.62, sv * Math.sin(u) * rad), tq, ts.set(bs, bs, bs)).premultiply(tmpM2);
          budMesh.setMatrixAt(f * BUDS + b, tmpM);
          budMesh.setColorAt(f * BUDS + b, tmpC.setHex(GREENS[(r() * GREENS.length) | 0]).multiplyScalar(cv > 0.3 ? 1 : 0.7));
        }
      }
      stemMesh.instanceMatrix.needsUpdate = true; budMesh.instanceMatrix.needsUpdate = true; if (budMesh.instanceColor) budMesh.instanceColor.needsUpdate = true;
      tomatoes.forEach(function (tg, i) { var tt = aG + (TAU - aG) * (0.3 + i * 0.4), xz = toXZ(tt, 0.56 - i * 0.02); tg.position.set(xz[0], 0.078, xz[1]); tg.rotation.set(0.3, i * 2, 0.2); });
      fillets.forEach(function (mm, i) {
        var th = aP * (0.3 + i * 0.42), xz = toXZ(th, 0.37);
        mm.position.set(xz[0], 0.03 + i * 0.012, xz[1]);
        mm.rotation.set(0, -th + Math.PI / 2 + (i ? -0.25 : 0.2), i ? 0.05 : -0.03);
      });
      var lxz = toXZ(aP * 0.62, 0.56); lemon.position.set(lxz[0], 0.06, lxz[1]); lemon.rotation.set(0.55, 0.4, 0.35);
    }

    /* ───────── les médailles ───────── */
    var coinGeo = lathe([[0, -0.019], [0.152, -0.019, 1], [0.162, -0.027, 1], [0.188, -0.027], [0.197, -0.016, 1], [0.197, 0.016, 1], [0.188, 0.027], [0.162, 0.027, 1], [0.152, 0.019, 1], [0, 0.019]], 64);
    var faceGeo = new THREE.CircleGeometry(0.152, 48);
    function ribbonGeometry() {
      var geo = new THREE.PlaneGeometry(0.074, 0.27, 1, 10), p = geo.attributes.position;
      for (var i = 0; i < p.count; i++) { var y = p.getY(i) / 0.135; p.setZ(i, (1 - y * y) * 0.016); }
      geo.computeVertexNormals(); return geo;
    }
    var ribbonGeo = ribbonGeometry();
    var loopGeo = new THREE.TorusGeometry(0.028, 0.0065, 8, 28);
    function faceTexture(n, kind) {
      return tex(256, function (g, s) {
        g.clearRect(0, 0, s, s);
        g.strokeStyle = 'rgba(70,44,10,.45)'; g.lineWidth = 5; g.beginPath(); g.arc(s / 2, s / 2, s * 0.43, 0, TAU); g.stroke();
        for (var i = 0; i < 28; i++) { var a = (i / 28) * TAU; g.fillStyle = 'rgba(70,44,10,.4)'; g.beginPath(); g.arc(s / 2 + Math.cos(a) * s * 0.37, s / 2 + Math.sin(a) * s * 0.37, 3, 0, TAU); g.fill(); }
        g.font = '800 124px ' + DISPLAY; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = 'rgba(255,240,200,.55)'; g.fillText(String(n), s / 2 - 3, s / 2 + 4);
        g.fillStyle = kind === 'guard' ? '#5a1a10' : '#5b3a0c'; g.fillText(String(n), s / 2, s / 2 + 7);
      }, { text: true });
    }
    var faceCache = {};
    function faceMat(n, kind) { var kf = n + kind; if (!faceCache[kf]) faceCache[kf] = new THREE.MeshStandardMaterial({ map: faceTexture(n, kind), transparent: true, metalness: 0.5, roughness: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }); return faceCache[kf]; }
    var medalMats = {
      syn: new THREE.MeshStandardMaterial({ color: 0xf0c25e, metalness: 1, roughness: 0.24 }),
      tension: new THREE.MeshStandardMaterial({ color: 0xc27a3a, metalness: 1, roughness: 0.34 }),
      guard: new THREE.MeshStandardMaterial({ color: 0xe0735f, metalness: 0.7, roughness: 0.3, emissive: 0x4a1208 }),
    };
    var ribbonMats = {};
    function ribbonMat(hex) {
      if (!ribbonMats[hex]) {
        var map = tex(64, function (g, w, h) { g.fillStyle = hex; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(w * 0.18, 0, w * 0.08, h); g.fillRect(w * 0.74, 0, w * 0.08, h); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(w * 0.42, 0, w * 0.16, h); }, { w: 64, h: 16 });
        ribbonMats[hex] = new THREE.MeshStandardMaterial({ map: map, roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide });
      }
      return ribbonMats[hex];
    }
    var medals = [];
    for (var md = 0; md < 5; md++) {
      var holder = new THREE.Group();
      var spin = new THREE.Group(); holder.add(spin);
      var coin = new THREE.Mesh(coinGeo, medalMats.syn); coin.rotation.x = Math.PI / 2; spin.add(coin);
      var faceF = new THREE.Mesh(faceGeo, faceMat(1, 'syn')); faceF.position.z = 0.0195; spin.add(faceF);
      var faceB = new THREE.Mesh(faceGeo, faceMat(1, 'syn')); faceB.position.z = -0.0195; faceB.rotation.y = Math.PI; spin.add(faceB);
      var loop = new THREE.Mesh(loopGeo, medalMats.syn); loop.position.y = 0.215; spin.add(loop);
      var ribA = new THREE.Mesh(ribbonGeo, ribbonMat('#e07a98')); ribA.position.set(-0.045, 0.35, -0.006); ribA.rotation.z = 0.24; spin.add(ribA);
      var ribB = new THREE.Mesh(ribbonGeo, ribbonMat('#6fa8ef')); ribB.position.set(0.045, 0.35, 0.006); ribB.rotation.z = -0.24; spin.add(ribB);
      var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xf2d28a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.2 }));
      halo.scale.setScalar(0.6); holder.add(halo);
      holder.visible = false; holder.scale.setScalar(0.001);
      holder.userData = { spin: spin, coin: coin, loop: loop, faceF: faceF, faceB: faceB, ribA: ribA, ribB: ribB, halo: halo, target: new THREE.Vector3(0, 1.4, 0), key: '', zone: '', phase: md * 1.3, s: 0.001, pop: 0, kind: 'syn' };
      world.add(holder); medals.push(holder);
    }
    var discovery = new THREE.Group();
    (function () {
      var c = new THREE.Mesh(coinGeo, medalMats.syn); c.rotation.x = Math.PI / 2; c.scale.setScalar(1.7); discovery.add(c);
      var f = new THREE.Mesh(new THREE.CircleGeometry(0.25, 48), new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, metalness: 0.5, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2, map: tex(256, function (g, s) { g.clearRect(0, 0, s, s); g.fillStyle = '#5b3a0c'; g.beginPath(); g.moveTo(s * 0.34, s * 0.22); g.lineTo(s * 0.66, s * 0.22); g.lineTo(s * 0.66, s * 0.8); g.lineTo(s * 0.5, s * 0.65); g.lineTo(s * 0.34, s * 0.8); g.closePath(); g.fill(); }) }));
      f.position.z = 0.034; discovery.add(f);
      var h = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xf2d28a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 })); h.scale.setScalar(2); discovery.add(h);
    })();
    discovery.position.set(0, 2.35, 0.2); discovery.scale.setScalar(0.001); world.add(discovery);

    /* ───────── état poussé par l'app ───────── */
    var state = { fq: 3, km: 25, fr: 1, pr: 1.8, kc: -250, gl: 0, so: 7.5, fuel: 60, guard: false, stage: 'compose', week: 0, bilan: 0, selected: null, mode: 'formula', real: null, focus: null };
    // Les piliers activés. 🔴 Cette déclaration manquait, et le fichier est un module ES — donc en
    // mode strict, où une affectation sur un identifiant inconnu ne crée PAS un global : elle lève.
    // `setPillars()` levait donc à chaque appel, et surtout `frame()` levait au PREMIER tour de
    // boucle — une exception dans un callback `requestAnimationFrame` ne replanifie rien, la boucle
    // mourait sur place et le canvas restait noir pour toujours, sans erreur visible à l'écran.
    // Défaut par défaut à `true` : une scène qui n'a pas encore reçu ses piliers montre tout, elle
    // ne se cache pas.
    var pillarsOn = { muscu: true, course: true, nutrition: true };
    var pulses = { muscu: 0, course: 0, nutrition: 0 };
    var fullNights = 5;
    function refreshInfield() {
      var big = LABELS.trackBig, small = LABELS.trackSmall;
      if (big === infieldLabel.big && small === infieldLabel.small) return;
      infieldLabel.big = big; infieldLabel.small = small;
      var e = texts.filter(function (x) { return x.t === infieldTex; })[0];
      if (e) { var g = e.c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.c.width, e.c.height); e.draw(g, e.c.width, e.c.height); infieldTex.needsUpdate = true; }
    }
    function setMode(m) { state.mode = m === 'week' ? 'week' : 'formula'; refreshInfield(); }
    function setReality(r) { state.real = r; refreshInfield(); }
    function focus(list) { state.focus = list && list.length ? list.slice() : null; }

    function setValues(v) {
      Object.keys(v).forEach(function (kv) { state[kv] = v[kv]; });
      dish3.P = 0.22 + (state.pr - 1.2) * 0.12;
      dish3.G = state.gl ? 0.46 : 0.34;
      // La portion suit le SIGNE du delta calorique, pas une egalite exacte : comparer a -250 puis
      // retomber sur 0.78 donnait la meme assiette a une prise de masse (+300) qu'a une seche (-400)
      // — la scene contredisait le chiffre qu'elle illustre.
      dish3.portion = state.kc > 0 ? 1.12 : state.kc === 0 ? 1 : state.kc >= -250 ? 0.9 : 0.78;
      layoutDish();
      fullNights = state.so >= 8.5 ? 7 : state.so >= 7.5 ? 5 : 4;
      refreshInfield();
    }
    /** Décision H : un pilier désactivé n'a pas de disque du tout. */
    function setPillars(next) {
      pillarsOn.muscu = next.muscu !== false;
      pillarsOn.course = next.course !== false;
      pillarsOn.nutrition = next.nutrition !== false;
    }

    /** Les textes gravés (marque, mot « séance », gazon, jours) — traduits par l'app. */
    function setLabels(next) {
      var changed = false;
      ['brand', 'plate', 'trackBig', 'trackSmall'].forEach(function (key) {
        if (next[key] !== undefined && next[key] !== LABELS[key]) { LABELS[key] = next[key]; changed = true; }
      });
      if (next.days && next.days.join('|') !== LABELS.days.join('|')) { LABELS.days = next.days; changed = true; }
      if (changed) { redrawTexts(); refreshInfield(); }
    }

    var POS = {
      'course|muscu': new THREE.Vector3(0.32, 1.55, -0.1),
      'muscu|nutrition': new THREE.Vector3(-0.78, 1.0, 1.05),
      'course|nutrition': new THREE.Vector3(0.64, 1.12, 0.82),
      'muscu|socle': new THREE.Vector3(-1.95, 0.95, 0.35),
      'course|socle': new THREE.Vector3(1.95, 0.95, 0.35),
      'nutrition|socle': new THREE.Vector3(1.15, 0.8, 1.75),
      tri: new THREE.Vector3(0.04, 1.3, 0.58),
    };
    function setCrossings(list) {
      var zones = {}, order = [];
      list.forEach(function (c) {
        var zk = c.pair.length === 3 ? 'tri' : c.pair.slice().sort().join('|');
        if (!zones[zk]) { zones[zk] = { n: 0, kind: c.kind, pair: c.pair }; order.push(zk); }
        var z = zones[zk]; z.n += 1;
        if (c.kind === 'guard' || (c.kind === 'tension' && z.kind === 'syn')) z.kind = c.kind;
      });
      state.guard = list.some(function (c) { return c.kind === 'guard'; });
      // Une médaille garde sa zone tant que le croisement existe : elle ne glisse pas vers une autre.
      medals.forEach(function (mm) { var u = mm.userData; if (u.zone && !zones[u.zone]) { u.key = ''; u.zone = ''; } });
      order.forEach(function (zk) {
        if (!POS[zk]) return;
        var free = function (mm) { return !mm.userData.zone; };
        var mm = medals.filter(function (x) { return x.userData.zone === zk; })[0] || medals.filter(function (x) { return free(x) && x.userData.s < 0.05; })[0] || medals.filter(free)[0];
        if (!mm) return;
        var u = mm.userData, z = zones[zk], sig = zk + z.kind + z.n;
        if (u.zone !== zk) { u.zone = zk; mm.position.copy(POS[zk]).add(new THREE.Vector3(0, -0.6, 0)); }
        if (u.key !== sig) u.pop = 1;
        u.key = sig;
        u.target.copy(POS[zk]);
        u.coin.material = medalMats[z.kind]; u.loop.material = medalMats[z.kind];
        u.faceF.material = faceMat(z.n, z.kind); u.faceB.material = faceMat(z.n, z.kind);
        var pair = z.pair.length === 3 ? ['muscu', 'course'] : z.pair;
        u.ribA.material = ribbonMat(PILLAR_HEX[pair[0]]); u.ribB.material = ribbonMat(PILLAR_HEX[pair[1]]);
        u.halo.material.color.set(z.kind === 'guard' ? 0xff6a55 : z.kind === 'tension' ? 0xd99a45 : 0xf2d28a);
        u.kind = z.kind;
      });
    }
    function pulse(p) { if (p in pulses) pulses[p] = 1; }
    function select(p) { state.selected = p; }
    function setStage(s) { state.stage = s; if (s === 'compose') { state.week = 0; state.bilan = 0; } }
    function setWeek(p) { state.week = p; pulses.muscu = pulses.course = pulses.nutrition = 0.6; }
    function setBilan(p) { state.bilan = p; }

    /* ───────── gestes ───────── */
    var down = null, yaw = 0, yawT = 0, pitch = 0, pitchT = 0, tilt = 0, ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    var onDown = function (e) { down = { x: e.clientX, y: e.clientY, yaw: yawT, pitch: pitchT, moved: false }; };
    canvas.addEventListener('pointerdown', onDown);
    var onMove = function (e) { if (!down) return; var dx = e.clientX - down.x, dy = e.clientY - down.y; if (Math.abs(dx) + Math.abs(dy) > 6) down.moved = true; yawT = Math.max(-0.9, Math.min(0.9, down.yaw - dx * 0.005)); pitchT = Math.max(-0.25, Math.min(0.3, down.pitch + dy * 0.003)); };
    window.addEventListener('pointermove', onMove);
    var onUp = function (e) {
      if (!down) return; var click = !down.moved; down = null; if (!click) return;
      var rect = canvas.getBoundingClientRect(); ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      var best = null;
      [[stack, 'muscu'], [track, 'course'], [dish, 'nutrition'], [ring, 'socle'], [lampGroup, 'socle']].forEach(function (t) { var hit = ray.intersectObject(t[0], true)[0]; if (hit && (!best || hit.distance < best.d)) best = { d: hit.distance, p: t[1] }; });
      if (opts.onPick) opts.onPick(best ? best.p : null);
    };
    window.addEventListener('pointerup', onUp);
    var onTilt = function (e) { if (e.gamma != null && !reduced) tilt = Math.max(-0.2, Math.min(0.2, e.gamma / 150)); };
    window.addEventListener('deviceorientation', onTilt);

    /* ───────── post-production : halo lumineux, tonalité filmique, grain ───────── */
    var post = null, glow = 1;
    function makePost() {
      if (quality === 'low' || !renderer.capabilities.isWebGL2) return null;
      var ext = renderer.extensions, has = function (n) { return ext.has ? ext.has(n) : !!ext.get(n); };
      if (!has('EXT_color_buffer_float') && !has('EXT_color_buffer_half_float')) return null;
      var pars = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false };
      var rtScene = THREE.WebGLMultisampleRenderTarget
        ? new THREE.WebGLMultisampleRenderTarget(2, 2, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.HalfFloatType })
        : new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.HalfFloatType });
      if (rtScene.samples !== undefined) rtScene.samples = 4;
      var rts = [0, 1, 2, 3].map(function () { return new THREE.WebGLRenderTarget(2, 2, pars); });
      var VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
      var mk = function (frag, uniforms) { return new THREE.ShaderMaterial({ uniforms: uniforms, vertexShader: VERT, fragmentShader: frag, depthTest: false, depthWrite: false, blending: THREE.NoBlending }); };
      var bright = mk('uniform sampler2D tex; uniform float threshold; varying vec2 vUv; void main() { vec4 c = texture2D(tex, vUv); float br = max(c.r, max(c.g, c.b)); float w = smoothstep(threshold, threshold * 1.9, br); gl_FragColor = vec4(c.rgb * w, 1.0); }', { tex: { value: null }, threshold: { value: 2.2 } });
      var blur = mk('uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv; void main() { vec3 s = texture2D(tex, vUv).rgb * 0.2270270; s += (texture2D(tex, vUv + dir * 1.3846154).rgb + texture2D(tex, vUv - dir * 1.3846154).rgb) * 0.3162162; s += (texture2D(tex, vUv + dir * 3.2307692).rgb + texture2D(tex, vUv - dir * 3.2307692).rgb) * 0.0702703; gl_FragColor = vec4(s, 1.0); }', { tex: { value: null }, dir: { value: new THREE.Vector2() } });
      var comp = mk([
        'uniform sampler2D tScene; uniform sampler2D tBloomA; uniform sampler2D tBloomB; uniform float strength; uniform float exposure; uniform float seed; varying vec2 vUv;',
        'vec3 rrt(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }',
        'vec3 aces(vec3 c) { mat3 mi = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777)); mat3 mo = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602)); c *= exposure / 0.6; c = mi * c; c = rrt(c); c = mo * c; return clamp(c, 0.0, 1.0); }',
        'vec3 srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(0.4166667)) - 0.055, step(vec3(0.0031308), c)); }',
        'float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed) * 43758.5453); }',
        'void main() { vec4 s = texture2D(tScene, vUv); vec3 b = texture2D(tBloomA, vUv).rgb * 0.7 + texture2D(tBloomB, vUv).rgb * 1.3; vec3 c = srgb(aces(max(s.rgb, 0.0) + b * strength)); c += (hash(gl_FragCoord.xy) - 0.5) * 0.02 * s.a; gl_FragColor = vec4(max(c, 0.0), s.a); }',
      ].join('\n'), { tScene: { value: null }, tBloomA: { value: null }, tBloomB: { value: null }, strength: { value: 0.6 }, exposure: { value: 1.0 }, seed: { value: 0 } });
      var quadScene = new THREE.Scene(), quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      var quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), comp); quad.frustumCulled = false; quadScene.add(quad);
      var size = new THREE.Vector2();
      function pass(mat, target) { quad.material = mat; renderer.setRenderTarget(target); renderer.render(quadScene, quadCam); }
      return {
        setSize: function () {
          renderer.getDrawingBufferSize(size);
          var w = Math.max(4, size.x | 0), h = Math.max(4, size.y | 0);
          rtScene.setSize(w, h); rts[0].setSize(w >> 1, h >> 1); rts[1].setSize(w >> 1, h >> 1); rts[2].setSize(w >> 2, h >> 2); rts[3].setSize(w >> 2, h >> 2);
        },
        render: function (t) {
          renderer.setRenderTarget(rtScene); renderer.render(scene, camera);
          bright.uniforms.tex.value = rtScene.texture; pass(bright, rts[0]);
          blur.uniforms.tex.value = rts[0].texture; blur.uniforms.dir.value.set(1 / rts[0].width, 0); pass(blur, rts[1]);
          blur.uniforms.tex.value = rts[1].texture; blur.uniforms.dir.value.set(0, 1 / rts[1].height); pass(blur, rts[0]);
          blur.uniforms.tex.value = rts[0].texture; blur.uniforms.dir.value.set(2 / rts[2].width, 0); pass(blur, rts[2]);
          blur.uniforms.tex.value = rts[2].texture; blur.uniforms.dir.value.set(0, 2 / rts[2].height); pass(blur, rts[3]);
          comp.uniforms.tScene.value = rtScene.texture; comp.uniforms.tBloomA.value = rts[0].texture; comp.uniforms.tBloomB.value = rts[3].texture; comp.uniforms.seed.value = t % 7;
          pass(comp, null);
        },
        dispose: function () { rtScene.dispose(); rts.forEach(function (r) { r.dispose(); }); },
      };
    }
    function refreshMaterials() { scene.traverse(function (o) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (mt) { if (mt) mt.needsUpdate = true; }); }); }
    function applyPost(on) {
      if (on && !post) { try { post = makePost(); } catch (_e) { post = null; } }
      if (!on && post) { post.dispose(); post = null; }
      renderer.toneMapping = post ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
      glow = post ? 3.2 : 1;
      if (post) post.setSize();
      refreshMaterials();
    }

    function resize() {
      var w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      if (post) post.setSize();
    }
    var ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(resize); ro.observe(canvas); } else window.addEventListener('resize', resize);
    resize();
    setValues({});
    scene.traverse(function (o) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (mt) { if (mt && mt.blending === THREE.AdditiveBlending) glowMat(mt); }); });
    applyPost(quality !== 'low');

    /* ───────── boucle ───────── */
    var time = 0, last = performance.now(), v3 = new THREE.Vector3(), look = new THREE.Vector3(), warm = new THREE.Color(0xfff1e0);
    var LED_WARM = new THREE.Color(0xffb46b), LED_ALARM = new THREE.Color(0xff4a3a), trackShow = 1, dishShow = 1;
    var sprintCol = new THREE.Color(0xffa24a), paceCol = new THREE.Color(0x8fcaff), doneCol = new THREE.Color(0xd6ecff);
    var perf = { n: 0, acc: 0, done: quality !== 'auto' }, intro = reduced ? 0 : 1;
    var focusV = new THREE.Vector3(0, 0.62, 0.28), distMul = 1;
    var raf = 0, disposed = false;
    function frame() {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      var now = performance.now();
      if (document.hidden) { last = now; return; }
      var raw = (now - last) / 1000;
      var dt = Math.max(0, Math.min(0.05, raw)); last = now; time += dt;
      // Le téléphone ne suit pas (moins de ~30 images/s) : on coupe la post-production, puis on allège les ombres.
      if (!perf.done) {
        perf.n += 1;
        if (perf.n > 30) { perf.acc += raw; if (perf.n >= 90) { perf.done = true; var avg = perf.acc / 60; if (avg > 0.034 && post) applyPost(false); if (avg > 0.05) { renderer.setPixelRatio(1); key.shadow.mapSize.set(1024, 1024); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } resize(); } } }
      }
      // Mouvement réduit : les transitions sont instantanées.
      var k = reduced ? 1 : 1 - Math.pow(0.02, dt), m = reduced ? 0 : 1;
      var cycling = state.stage === 'incubating';

      yaw += (yawT + tilt - yaw) * k; pitch += (pitchT - pitch) * k;
      intro = Math.max(0, intro - dt / 2.8); var ie = intro * intro * intro;
      // Focus : la caméra s'approche des piliers en jeu (enquête, pilier touché).
      var kf = reduced ? 1 : 1 - Math.pow(0.12, dt), fx = 0, fy = 0.62, fz = 0.28, fd = 1;
      if (state.focus) {
        var n = 0; fx = 0; fy = 0; fz = 0;
        state.focus.forEach(function (p) {
          if (CENTER[p]) { fx += CENTER[p][0]; fz += CENTER[p][1]; fy += LIFT[p] + (p === 'muscu' ? 0.3 : 0.05); n += 1; }
          else if (p === 'socle') { fx += 0; fz += 1.7; fy += 0.05; n += 1; }
        });
        if (n) { fx /= n; fy /= n; fz /= n; fd = n === 1 ? 0.62 : 0.8; } else { fx = 0; fy = 0.62; fz = 0.28; }
      }
      focusV.x += (fx - focusV.x) * kf; focusV.y += (fy - focusV.y) * kf; focusV.z += (fz - focusV.z) * kf; distMul += (fd - distMul) * kf;
      var sway = Math.sin(time * 0.2) * 0.06 * m;
      var dist = Math.max(9.6, 9.4 / camera.aspect) * distMul * (1 + ie * 0.9);
      var polarA = 0.98 - pitch - ie * 0.42, yawI = yaw + sway + ie * 0.9;
      look.set(focusV.x, focusV.y + state.bilan * 0.7, focusV.z);
      camera.position.set(look.x + Math.sin(yawI) * Math.sin(polarA) * dist, look.y + Math.cos(polarA) * dist, look.z + Math.cos(yawI) * Math.sin(polarA) * dist);
      camera.lookAt(look);

      if (cycling) { var day = 0.5 + 0.5 * Math.sin(time * 2.4); key.intensity = 1.1 + day * 2.4; key.color.setRGB(1, 0.84 + day * 0.12, 0.68 + day * 0.22); }
      else { key.intensity += (KEY_I - key.intensity) * k; key.color.lerp(warm, k); }
      var guardPulse = state.guard ? 0.5 + 0.5 * Math.sin(time * 5) : 0;
      alarm.intensity = state.guard ? 1.5 + guardPulse * 3.5 : 0;
      ledMat.color.copy(state.guard ? LED_ALARM : LED_WARM).multiplyScalar((state.guard ? 0.7 + guardPulse * 0.8 : 1) * glow);
      underGlow.material.color.copy(state.guard ? LED_ALARM : LED_WARM);

      // Musculation : un disque par séance, qui tombe et rebondit sur la pile.
      var week = state.mode === 'week' && state.real;
      var want = pillarsOn.muscu ? Math.max(0, Math.min(5, Math.round(week ? state.real.sessions : state.fq))) : 0;
      var solid = week ? Math.min(want, state.real.sessionsDone) : want;
      plates.forEach(function (p, i) {
        var u = p.userData, show = i < want;
        setGhost(p, i >= solid);
        if (show && !u.shown) { u.shown = 1; p.visible = true; u.y = reduced ? i * (T + GAP) : 1.4 + i * 0.16; u.vy = 0; u.scale = 1; }
        if (!show && u.shown) u.shown = 0;
        u.target = i * (T + GAP);
        if (u.shown) {
          if (reduced) u.y = u.target;
          else {
            u.vy -= 14 * dt; u.y += u.vy * dt;
            if (u.y < u.target) { var impact = -u.vy; u.y = u.target; u.vy = -u.vy * 0.25; if (Math.abs(u.vy) < 0.3) u.vy = 0; if (impact > 2 && opts.onEvent) opts.onEvent('land', { index: i, ghost: i >= solid, impact: impact }); }
          }
        } else { u.scale += (0 - u.scale) * Math.min(1, k * 1.5); if (u.scale < 0.02) p.visible = false; }
        p.position.y = u.y + t2 + 0.012;
        p.scale.setScalar(Math.max(0.001, u.scale));
      });
      ['muscu', 'course', 'nutrition'].forEach(function (p) { pulses[p] = Math.max(0, pulses[p] - dt * 2); });
      var sel = function (p) { return state.selected === p ? 1 : 0; };
      var bob = function (ph) { return Math.sin(time * 1.1 + ph) * 0.022 * m; };
      stack.position.y += (LIFT.muscu + sel('muscu') * 0.12 + bob(0) + pulses.muscu * 0.06 - stack.position.y) * k;
      track.position.y += (LIFT.course + sel('course') * 0.12 + bob(2) + pulses.course * 0.08 - track.position.y) * k;
      dish.position.y += (LIFT.nutrition + sel('nutrition') * 0.12 + bob(4) + pulses.nutrition * 0.08 - dish.position.y) * k;
      stack.rotation.y += dt * 0.07 * m;
      trackShow += ((pillarsOn.course && state.km > 0 ? 1 : 0) - trackShow) * k;
      track.scale.setScalar(Math.max(0.001, trackShow)); track.visible = trackShow > 0.02;
      dishShow += ((pillarsOn.nutrition ? 1 : 0) - dishShow) * k;
      dish.scale.setScalar(Math.max(0.001, dishShow)); dish.visible = dishShow > 0.02;

      blobs.muscu.material.opacity = solid > 0 ? 0.36 + solid * 0.04 : want > 0 ? 0.12 : 0;
      blobs.course.material.opacity = 0.38 * trackShow;
      blobs.nutrition.material.opacity = 0.5 * dishShow;
      if (state.selected && CENTER[state.selected]) {
        selRing.position.x += (CENTER[state.selected][0] - selRing.position.x) * k; selRing.position.z += (CENTER[state.selected][1] - selRing.position.z) * k;
        selRing.material.color.set(PILLAR_HEX[state.selected]);
      }
      var ringOp = state.selected && CENTER[state.selected] ? 0.45 + pulses[state.selected] * 0.5 : 0;
      selRing.material.opacity += (ringOp - selRing.material.opacity) * k;

      // Course : les lumières de pacing tournent sur la lice, plus vite quand les kilomètres montent.
      var omega = (0.5 + (state.km / 35) * 1.6) * (cycling ? 3 : 1);
      var headA, headI;
      if (week) {
        // Semaine : la part courue reste allumée ; une lueur parcourt ce qu'il reste à courir.
        var ratio = Math.max(0, Math.min(1, state.real.kmDone / Math.max(1, state.real.km))), doneN = ratio * LEDS;
        var rest = LEDS - doneN, trav = reduced ? 0.35 : ((time * 0.12) % 1);
        headI = doneN + rest * trav; headA = (headI / LEDS) * TAU;
        for (var i = 0; i < LEDS; i++) {
          if (i < doneN) { tmpC.copy(doneCol).multiplyScalar(0.55 * glow); }
          else { var bk = headI - i, tr = bk >= 0 && bk < 12 ? Math.pow(1 - bk / 12, 1.8) : 0; tmpC.copy(sprintCol).multiplyScalar(0.05 + tr * 1.1 * glow); }
          leds.setColorAt(i, tmpC);
        }
      } else {
        headA = reduced ? 1.9 : (time * omega) % TAU; headI = (headA / TAU) * LEDS;
        for (var i2 = 0; i2 < LEDS; i2++) {
          var back = (headI - i2 + LEDS) % LEDS, lit = back < 18 ? Math.pow(1 - back / 18, 1.6) : 0;
          var sprint = state.fr >= 1 && back < 5 * state.fr;
          tmpC.copy(sprint ? sprintCol : paceCol).multiplyScalar(0.06 + lit * 1.3 * glow);
          leds.setColorAt(i2, tmpC);
        }
      }
      if (leds.instanceColor) leds.instanceColor.needsUpdate = true;
      pacerGlow.position.set(Math.cos(headA) * LED_R, TH / 2 + 0.03, Math.sin(headA) * LED_R);
      pacerGlow.material.color.copy(week || state.fr >= 1 ? sprintCol : paceCol);

      // Nutrition : les portions suivent la balance calorique, le saumon suit les protéines.
      foodRoot.scale.x += (dish3.portion - foodRoot.scale.x) * k; foodRoot.scale.z = foodRoot.scale.x; foodRoot.scale.y += (0.85 + dish3.portion * 0.15 - foodRoot.scale.y) * k;
      var sScale = (0.9 + (state.pr - 1.2) * 0.3) * (week ? Math.max(0.7, Math.min(1.05, state.real.protein)) : 1);
      fillets[1].visible = state.pr >= 1.6;
      fillets.forEach(function (f) { f.scale.x += (sScale - f.scale.x) * k; f.scale.y = f.scale.z = f.scale.x; });
      steam.forEach(function (s, i) {
        var t = (s.userData.t + time * 0.16) % 1, on = state.fuel >= 60 && !reduced ? 1 : 0;
        s.position.set(Math.sin(i * 2.1 + time * 0.6) * 0.2, 0.2 + t * 0.9, Math.cos(i * 1.7) * 0.18);
        s.scale.setScalar(0.25 + t * 0.55);
        s.material.opacity = on * Math.sin(t * Math.PI) * 0.18;
      });

      // Socle : les lampes-nuits ; pendant le cycle, l'anneau tourne comme les semaines.
      // En semaine, l'anneau tourne pour amener la lampe d'aujourd'hui devant toi.
      var lampRot = week && state.real.today != null ? -(state.real.today - 3) * (TAU / 7) : 0;
      lampGroup.rotation.y = cycling ? -state.week * TAU : lampGroup.rotation.y + (lampRot - lampGroup.rotation.y) * k;
      ring.rotation.z = lampGroup.rotation.y;
      lamps.forEach(function (l, i) {
        var flick = cycling ? 0.75 + 0.25 * Math.sin(time * 9 + i * 1.7) : 1, night = week ? state.real.nights[i] : null;
        l.want = week ? (night === 1 ? 1 : night === 0 ? 0.3 : 0) : (i < fullNights ? 1 : 0);
        l.lit += (l.want - l.lit) * k;
        l.mat.emissive.copy(week && night === 0 ? MOON_SHORT : MOON_OK);
        l.mat.emissiveIntensity = l.lit * 1.6 * flick * (post ? 1.15 : 1);
        l.glow.material.opacity = l.lit * 0.55 * flick;
        l.glow.material.color.copy(week && night === 0 ? MOON_SHORT : MOON_OK);
      });
      var todayOn = week && state.real.today != null ? 1 : 0;
      if (todayOn) { var tpos = lamps[state.real.today].pos; todayRing.position.x = tpos.x; todayRing.position.z = tpos.z; }
      todayRing.material.opacity += ((todayOn ? 0.55 + 0.35 * Math.sin(time * 2.2) * m : 0) - todayRing.material.opacity) * k;

      // Poussière dans le cône de lumière.
      for (var di = 0; di < DUST; di++) {
        var db = dustBase[di], yy = reduced ? db.y : 0.35 + ((db.y - 0.35 + time * db.sp) % 3.2);
        dustPos[di * 3] = db.x + Math.sin(time * 0.3 + db.ph) * 0.12 * m; dustPos[di * 3 + 1] = yy; dustPos[di * 3 + 2] = db.z + Math.cos(time * 0.25 + db.ph) * 0.12 * m;
      }
      dustGeo.attributes.position.needsUpdate = true;

      medals.forEach(function (mm, i) {
        var u = mm.userData, on = !!u.key && state.bilan < 0.5;
        if (on) mm.visible = true;
        u.s += ((on ? 1 : 0) - u.s) * Math.min(1, k * 1.4);
        u.pop = Math.max(0, u.pop - dt * 2.5);
        mm.scale.setScalar(Math.max(0.001, u.s * 0.85 * (1 + u.pop * 0.3)));
        if (u.s < 0.02 && !on) mm.visible = false;
        mm.position.lerp(state.bilan > 0 ? v3.copy(discovery.position) : u.target, k);
        mm.position.y += Math.sin(time * 1.4 + u.phase) * 0.0015 * m;
        var shake = u.kind === 'tension' && !reduced ? Math.sin(time * 38 + i) * 0.04 : 0;
        u.spin.rotation.y = Math.sin(time * 0.7 + u.phase) * 0.5 * m + yaw * 0.6 + shake + (reduced ? (i % 2 ? -0.35 : 0.35) : 0);
        u.spin.rotation.z = Math.sin(time * 1.2 + u.phase) * 0.05 * m;
        u.halo.material.opacity = u.kind === 'guard' ? 0.3 + guardPulse * 0.3 : 0.16;
      });
      discovery.scale.setScalar(Math.max(0.001, discovery.scale.x + ((state.bilan > 0.55 ? 1 : 0.001) - discovery.scale.x) * k));
      discovery.rotation.y = Math.sin(time * 0.8) * 0.5 * m + yaw;

      if (post) { try { post.render(time); } catch (_e) { applyPost(false); } }
      if (!post) { renderer.setRenderTarget(null); renderer.render(scene, camera); }
    }
    raf = requestAnimationFrame(frame);

    /**
     * Rend la mémoire GPU quand l'écran se démonte.
     *
     * 🔴 `renderer.dispose()` NE SUFFIT PAS : en three r128 il ne libère que les listes de rendu et
     * le contexte. Les géométries, les matériaux et surtout la dizaine de `CanvasTexture` (plusieurs
     * en 2048×2048) restent en mémoire. Il faut parcourir la scène, et retirer les écouteurs posés
     * sur `window` — qui, eux, survivent au canvas.
     *
     * Aujourd'hui la WebView du composant DOM est détruite au démontage, donc la fuite serait bornée
     * de toute façon. On ne s'appuie pas dessus : une WebView mutualisée, ou une scène recréée dans
     * le même document, transformerait ce raccourci en fuite franche.
     */
    function dispose() {
      disposed = true;
      cancelAnimationFrame(raf);

      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('deviceorientation', onTilt);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);

      scene.traverse(function (obj) {
        if (obj.geometry) obj.geometry.dispose();
        var mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
        mats.forEach(function (m) {
          Object.keys(m).forEach(function (key) {
            var v = m[key];
            if (v && v.isTexture) v.dispose();
          });
          m.dispose();
        });
      });

      if (post) post.dispose();
      if (scene.environment) scene.environment.dispose();
      renderer.dispose();
      // Libère le contexte WebGL tout de suite au lieu d'attendre le ramasse-miettes : un téléphone
      // n'en tolère qu'une poignée simultanément.
      var lose = renderer.getContext().getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    }

    return {
      ok: true, setPillars: setPillars, setValues: setValues, setCrossings: setCrossings, pulse: pulse, select: select, setStage: setStage, setWeek: setWeek, setBilan: setBilan,
      setMode: setMode, setReality: setReality, focus: focus, setLabels: setLabels, dispose: dispose,
      quality: function () { return post ? 'post' : 'direct'; },
      setReducedMotion: function (b) { reduced = b; },
    };
  }

