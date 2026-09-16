/* Le Labo — scène 3D (three.js r128). Aucune donnée ici : l'app pousse les couches, l'humeur et l'étape. */
(function () {
  'use strict';

  var GLASS_VS = 'varying vec3 vN; varying vec3 vW;' +
    'void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }';

  var GLASS_FS = 'uniform vec3 uTint; uniform float uOpacity; uniform vec3 uLight; varying vec3 vN; varying vec3 vW;' +
    'void main(){ vec3 V = normalize(cameraPosition - vW); vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;' +
    ' float fr = pow(1.0 - abs(dot(N, V)), 2.4); vec3 L = normalize(uLight - vW); vec3 H = normalize(L + V);' +
    ' float sp = pow(max(dot(N, H), 0.0), 80.0);' +
    ' vec3 col = mix(uTint * 0.2, uTint, fr) + vec3(1.0, 0.9, 0.74) * sp * 1.5;' +
    ' float a = clamp(0.04 + fr * 0.62 + sp, 0.0, 1.0) * uOpacity; gl_FragColor = vec4(col, a); }';

  var LIQ_FS = 'uniform vec3 uCols[4]; uniform vec4 uEdges; uniform float uLevel; uniform float uBottom; uniform float uTime;' +
    'uniform float uWob; uniform float uSep; uniform float uDim; uniform vec3 uLight; varying vec3 vN; varying vec3 vW;' +
    'void main(){ float wave = (sin(vW.x * 9.0 + uTime * 2.2) * 0.010 + sin(vW.z * 7.0 - uTime * 1.7) * 0.008) * (1.0 + uWob * 3.0) + sin(vW.x * 3.0 + uTime * 7.0) * 0.022 * uWob;' +
    ' if (vW.y > uLevel + wave) discard;' +
    ' float f = clamp((vW.y - uBottom) / max(uLevel - uBottom, 0.001), 0.0, 1.0); float b = 0.04 * (1.0 - uSep) + 0.004;' +
    ' vec3 c = mix(uCols[0], uCols[1], smoothstep(uEdges.x - b, uEdges.x + b, f));' +
    ' c = mix(c, uCols[2], smoothstep(uEdges.y - b, uEdges.y + b, f)); c = mix(c, uCols[3], smoothstep(uEdges.z - b, uEdges.z + b, f));' +
    ' float g = (1.0 - smoothstep(0.0, 0.025, abs(f - uEdges.x))) + (1.0 - smoothstep(0.0, 0.025, abs(f - uEdges.y))) + (1.0 - smoothstep(0.0, 0.025, abs(f - uEdges.z)));' +
    ' c *= 1.0 - uSep * 0.6 * clamp(g, 0.0, 1.0);' +
    ' vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N; vec3 V = normalize(cameraPosition - vW);' +
    ' float rim = pow(1.0 - abs(dot(N, V)), 2.0); float d = max(dot(N, normalize(uLight - vW)), 0.0) * 0.5 + 0.5;' +
    ' vec3 col = c * (0.5 + 0.6 * d) + c * rim * 0.55; col *= mix(1.0, 0.42, uDim); gl_FragColor = vec4(col, 1.0); }';

  var SKY_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  var SKY_FS = 'varying vec2 vUv; uniform float uPhase; uniform float uTime;' +
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }' +
    'void main(){ float day = 0.5 - 0.5 * cos(uPhase * 6.2831);' +
    ' vec3 top = mix(vec3(0.05, 0.07, 0.15), vec3(0.45, 0.62, 0.86), day); vec3 bot = mix(vec3(0.18, 0.12, 0.08), vec3(0.96, 0.72, 0.5), day);' +
    ' vec3 c = mix(bot, top, vUv.y); vec2 g = floor(vUv * vec2(60.0, 44.0));' +
    ' c += vec3(step(0.985, hash(g)) * (1.0 - day) * (0.6 + 0.4 * sin(uTime * 3.0 + hash(g) * 20.0)));' +
    ' vec2 p = vec2(fract(uPhase + 0.25), 0.5 + 0.32 * sin(uPhase * 6.2831));' +
    ' float d = distance(vUv * vec2(1.36, 1.0), vec2(p.x * 1.36, p.y)); c += mix(vec3(0.85, 0.88, 1.0), vec3(1.0, 0.86, 0.55), day) * smoothstep(0.075, 0.055, d);' +
    ' gl_FragColor = vec4(c, 1.0); }';

  var FLAME_FS = 'varying vec2 vUv; uniform float uTime; void main(){ float t = vUv.y; float fl = 0.8 + 0.2 * sin(uTime * 23.0 + t * 9.0);' +
    ' vec3 c = mix(vec3(0.35, 0.6, 1.0), vec3(1.0, 0.75, 0.35), smoothstep(0.2, 0.9, t)); gl_FragColor = vec4(c * fl, (1.0 - t) * 0.9); }';

  function col(hex) { return new THREE.Color(hex); }
  function lin(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function dotTexture(inner, outer) {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d'); var r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, inner); r.addColorStop(1, outer); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  function woodTexture() {
    var c = document.createElement('canvas'); c.width = 512; c.height = 128; var g = c.getContext('2d');
    g.fillStyle = '#3b2a1c'; g.fillRect(0, 0, 512, 128);
    for (var i = 0; i < 90; i++) { g.strokeStyle = 'rgba(' + (70 + Math.random() * 40 | 0) + ',' + (48 + Math.random() * 25 | 0) + ',30,' + (0.15 + Math.random() * 0.25) + ')'; g.lineWidth = 1 + Math.random() * 2; var y = Math.random() * 128; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(170, y + Math.random() * 8 - 4, 340, y + Math.random() * 8 - 4, 512, y); g.stroke(); }
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = THREE.RepeatWrapping; return t;
  }

  function lathe(profile, seg) { return new THREE.LatheGeometry(profile.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), seg || 48); }

  function flaskProfile(R, neckR, top) {
    var pts = [], jy = Math.acos(neckR / R);
    for (var i = 0; i <= 28; i++) { var a = -Math.PI / 2 + (i / 28) * (Math.PI / 2 + jy); pts.push([Math.max(0.0001, R * Math.cos(a)), R + R * Math.sin(a)]); }
    pts.push([neckR, top - 0.05], [neckR + 0.04, top - 0.02], [neckR + 0.04, top + 0.02], [neckR, top + 0.03]);
    return pts;
  }

  function create(canvas, opts) {
    opts = opts || {};
    if (!window.THREE) return { ok: false, reason: 'lib' };
    var probe = document.createElement('canvas');
    var probeGl = null;
    try { probeGl = probe.getContext('webgl2') || probe.getContext('webgl') || probe.getContext('experimental-webgl'); } catch (e) { probeGl = null; }
    if (!probeGl) return { ok: false, reason: 'webgl' };
    var renderer = null, lastError = '';
    [{ antialias: true, alpha: true }, { antialias: false, alpha: false, powerPreference: 'low-power', precision: 'mediump' }].some(function (cfg) {
      try { renderer = new THREE.WebGLRenderer(Object.assign({ canvas: canvas }, cfg)); return true; } catch (e) { lastError = (e && e.message) || String(e); renderer = null; return false; }
    });
    if (!renderer) return { ok: false, reason: 'renderer', detail: lastError };
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); if (opts.onLost) opts.onLost(); });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
    var LIGHT = new THREE.Vector3(1.9, 3.6, 2.0);
    var reduced = !!opts.reducedMotion;

    scene.add(new THREE.HemisphereLight(0xf2d6b0, 0x1c150e, 0.5));
    var fill = new THREE.DirectionalLight(0x8fa9d8, 0.25); fill.position.set(-3, 2, 4); scene.add(fill);
    var spot = new THREE.SpotLight(0xf2b872, 2.8, 16, 0.8, 0.7, 1.1);
    spot.position.copy(LIGHT); spot.target.position.set(0, 0.9, 0); spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0006; scene.add(spot); scene.add(spot.target);
    var alarm = new THREE.PointLight(0xf08a7e, 0, 4, 2); alarm.position.set(0, 1.1, 1.0); scene.add(alarm);

    // atelier
    var bench = new THREE.Mesh(new THREE.BoxGeometry(9, 0.3, 3.4), new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.82 }));
    bench.position.set(0, -0.15, 0.4); bench.receiveShadow = true; scene.add(bench);
    var wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshStandardMaterial({ color: lin('#2a2016'), roughness: 1 }));
    wall.position.set(0, 3, -1.9); wall.receiveShadow = true; scene.add(wall);
    var shelf = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.07, 0.42), new THREE.MeshStandardMaterial({ color: lin('#4a3524'), roughness: 0.9 }));
    shelf.position.set(-1.7, 2.05, -1.68); shelf.castShadow = true; scene.add(shelf);
    ['#e07a98', '#e07a98', '#6fa8ef', '#a9ba7e', '#e0b155', null, null].forEach(function (h, i) {
      var g = new THREE.Group(); g.position.set(-3.0 + i * 0.42, 2.09, -1.68);
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.26, 20), h ? new THREE.MeshStandardMaterial({ color: lin(h), roughness: 0.35, emissive: lin(h), emissiveIntensity: 0.25 }) : glassMat(0.6));
      body.position.y = 0.13; g.add(body);
      var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 12), h ? body.material : glassMat(0.6)); neck.position.y = 0.3; g.add(neck);
      scene.add(g);
    });
    var sky = new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: { uPhase: { value: 0.02 }, uTime: { value: 0 } } });
    var win = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.1), sky); win.position.set(1.95, 2.35, -1.88); scene.add(win);
    var frameMat = new THREE.MeshStandardMaterial({ color: lin('#4a3524'), roughness: 0.9 });
    [[0, 0.58, 1.62, 0.07], [0, -0.58, 1.62, 0.07], [-0.78, 0, 0.07, 1.22], [0.78, 0, 0.07, 1.22], [0, 0, 0.04, 1.1], [0, 0, 1.5, 0.04]].forEach(function (f) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(f[2], f[3], 0.06), frameMat); m.position.set(1.95 + f[0], 2.35 + f[1], -1.85); scene.add(m);
    });
    var glowMat = new THREE.SpriteMaterial({ map: dotTexture('rgba(242,184,114,0.9)', 'rgba(242,184,114,0)'), blending: THREE.AdditiveBlending, depthWrite: false });
    var glow = new THREE.Sprite(glowMat); glow.scale.set(1.6, 1.6, 1); glow.position.set(-0.2, 2.95, -1.2); scene.add(glow);
    var shade = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.3, 32, 1, true), new THREE.MeshStandardMaterial({ color: lin('#2a2016'), side: THREE.DoubleSide, roughness: 0.7 }));
    shade.position.set(-0.2, 3.12, -1.2); scene.add(shade);
    var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color: col('#ffd9a0') })); bulb.position.set(-0.2, 2.98, -1.2); scene.add(bulb);

    function glassMat(op) {
      return new THREE.ShaderMaterial({ vertexShader: GLASS_VS, fragmentShader: GLASS_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uTint: { value: new THREE.Vector3(0.95, 0.9, 0.85) }, uOpacity: { value: op || 1 }, uLight: { value: LIGHT } } });
    }

    // ballon
    var R = 0.72, C = new THREE.Vector3(0, 1.0, 0), TOP = C.y + 1.08;
    var flask = new THREE.Mesh(lathe(flaskProfile(R, 0.16, TOP - (C.y - R)), 64), glassMat(1));
    flask.position.set(0, C.y - R, 0); flask.renderOrder = 3; scene.add(flask);
    var stand = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 8, 48), new THREE.MeshStandardMaterial({ color: lin('#8a7458'), metalness: 0.6, roughness: 0.4 }));
    stand.rotation.x = Math.PI / 2; stand.position.y = 0.36; stand.castShadow = true; scene.add(stand);
    for (var li = 0; li < 3; li++) { var a = li * 2.094; var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.36, 8), stand.material); leg.position.set(Math.cos(a) * 0.42, 0.18, Math.sin(a) * 0.42); leg.castShadow = true; scene.add(leg); }
    var burner = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.12, 24), new THREE.MeshStandardMaterial({ color: lin('#5c4330'), roughness: 0.6 })); burner.position.y = 0.06; scene.add(burner);
    var flameU = { uTime: { value: 0 } };
    var flame = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 16, 1, true), new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: FLAME_FS, uniforms: flameU, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    flame.position.y = 0.22; flame.scale.setScalar(0.001); scene.add(flame);

    var liqU = {
      uCols: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
      uEdges: { value: new THREE.Vector4(1, 1, 1, 1) }, uLevel: { value: C.y - R }, uBottom: { value: C.y - R },
      uTime: { value: 0 }, uWob: { value: 0 }, uSep: { value: 0 }, uDim: { value: 0 }, uLight: { value: LIGHT },
    };
    var liquid = new THREE.Mesh(new THREE.SphereGeometry(R * 0.955, 56, 40), new THREE.ShaderMaterial({ vertexShader: GLASS_VS, fragmentShader: LIQ_FS, uniforms: liqU, side: THREE.DoubleSide }));
    liquid.position.copy(C); liquid.renderOrder = 1; scene.add(liquid);
    var surfMat = new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.15, metalness: 0, emissive: col('#000000') });
    var surface = new THREE.Mesh(new THREE.CircleGeometry(1, 48), surfMat); surface.rotation.x = -Math.PI / 2; surface.renderOrder = 2; scene.add(surface);
    var cork = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.16, 0.16, 20), new THREE.MeshStandardMaterial({ color: lin('#8a6419'), roughness: 0.9 }));
    cork.position.set(0, 3.4, 0); cork.visible = false; scene.add(cork);

    function points(n, size, color, additive, opacity) {
      var arr = new Float32Array(n * 3); for (var q = 1; q < n * 3; q += 3) arr[q] = -10; var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      var m = new THREE.PointsMaterial({ size: size, map: dotTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), color: col(color), transparent: true, opacity: opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
      var p = new THREE.Points(geo, m); p.frustumCulled = false; p.userData = { life: new Float32Array(n), vel: new Float32Array(n * 3) }; scene.add(p); return p;
    }
    var bubbles = points(36, 0.05, '#ffffff', false, 0.6);
    var stream = points(70, 0.06, '#ffffff', true, 0.95);
    var sparks = points(90, 0.09, '#f2d28a', true, 1);
    var smoke = points(28, 0.34, '#8a7e72', false, 0.28);

    // fioles
    var tubes = [], rackMat = new THREE.MeshStandardMaterial({ color: lin('#5c4330'), roughness: 0.8 });
    var rack = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.34, 0.05), rackMat); rack.position.set(0, 0.2, 1.1); rack.castShadow = true; scene.add(rack);
    var rackBase = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.05, 0.4), rackMat); rackBase.position.set(0, 0.025, 1.3); scene.add(rackBase);
    var tubeProfile = []; for (var ti = 0; ti <= 10; ti++) { var ta = -Math.PI / 2 + (ti / 10) * (Math.PI / 2); tubeProfile.push([Math.max(0.0001, 0.075 * Math.cos(ta)), 0.075 + 0.075 * Math.sin(ta)]); }
    tubeProfile.push([0.075, 0.62], [0.09, 0.64]);
    (opts.colors || []).forEach(function (hex, i) {
      var g = new THREE.Group(); var home = new THREE.Vector3(-1.08 + i * 0.36, 0.05, 1.3); g.position.copy(home);
      var glass = new THREE.Mesh(lathe(tubeProfile, 24), glassMat(1)); glass.renderOrder = 3; g.add(glass);
      var juice = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.46, 20), new THREE.MeshStandardMaterial({ color: lin(hex), emissive: lin(hex), emissiveIntensity: 0.35, roughness: 0.3 }));
      juice.position.y = 0.28; juice.castShadow = true; g.add(juice);
      var ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.14, 32), new THREE.MeshBasicMaterial({ color: col(hex), transparent: true, opacity: 0.0, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
      g.userData = { index: i, home: home, lift: 0, liftTarget: 0, ring: ring, color: hex };
      glass.userData.index = i; juice.userData.index = i; ring.userData.index = i;
      scene.add(g); tubes.push(g);
    });

    // alambic
    var curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, TOP, 0), new THREE.Vector3(0.06, TOP + 0.42, 0), new THREE.Vector3(0.55, TOP + 0.55, -0.05), new THREE.Vector3(1.25, TOP + 0.05, -0.12), new THREE.Vector3(1.66, 1.2, -0.15), new THREE.Vector3(1.72, 0.9, -0.15)]);
    var tubeGeo = new THREE.TubeGeometry(curve, 90, 0.045, 10, false);
    var condenser = new THREE.Mesh(tubeGeo, glassMat(1)); condenser.renderOrder = 3; tubeGeo.setDrawRange(0, 0); scene.add(condenser);
    var VIAL = new THREE.Vector3(1.72, 0.3, -0.15);
    var vial = new THREE.Mesh(lathe(flaskProfile(0.27, 0.06, 0.66), 40), glassMat(1)); vial.position.set(VIAL.x, 0.03, VIAL.z); vial.renderOrder = 3; scene.add(vial);
    var vialU = { uCols: { value: [0, 1, 2, 3].map(function () { return new THREE.Vector3(0.88, 0.69, 0.33); }) }, uEdges: { value: new THREE.Vector4(1, 1, 1, 1) }, uLevel: { value: 0.05 }, uBottom: { value: 0.05 }, uTime: liqU.uTime, uWob: { value: 0 }, uSep: { value: 0 }, uDim: { value: 0 }, uLight: { value: LIGHT } };
    var vialLiquid = new THREE.Mesh(new THREE.SphereGeometry(0.255, 32, 24), new THREE.ShaderMaterial({ vertexShader: GLASS_VS, fragmentShader: LIQ_FS, uniforms: vialU, side: THREE.DoubleSide }));
    vialLiquid.position.set(VIAL.x, 0.3, VIAL.z); scene.add(vialLiquid);
    var drops = []; for (var di = 0; di < 4; di++) { var dm = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: col('#f2d28a') })); dm.visible = false; scene.add(dm); drops.push(dm); }

    // état
    var target = { level: C.y - R, edges: [1, 1, 1], cols: [col('#000'), col('#000'), col('#000'), col('#000')], wob: 0, sep: 0, dim: 0, phase: 0.02, distill: 0, vial: 0.05 };
    var mood = { synergy: false, tension: false, guard: false };
    var stage = 'compose', pours = [], burstT = -1, time = 0, yaw = 0, yawTarget = 0, tilt = 0;

    function setLayers(layers) {
      var total = layers.reduce(function (s, l) { return s + l.amount; }, 0);
      var H = 2 * R * 0.955;
      target.level = (C.y - R * 0.955) + H * Math.min(0.82, total);
      var acc = 0, edges = [], cols = [];
      layers.forEach(function (l, i) { acc += l.amount; if (i < 3) edges.push(total ? acc / total : 1); cols.push(col(l.color)); });
      while (edges.length < 3) edges.push(1);
      if (!cols.length) cols.push(col('#1c150e'));
      while (cols.length < 4) cols.push(cols[cols.length - 1].clone());
      target.edges = edges; target.cols = cols.slice(0, 4);
      liquid.visible = total > 0.001;
    }

    function setMood(m) {
      if (m.synergy && !mood.synergy && !m.guard) burst();
      mood = m; target.wob = reduced ? 0 : (m.tension && !m.guard ? 1 : 0); target.sep = m.tension || m.guard ? 1 : 0; target.dim = m.guard ? 1 : 0;
      cork.visible = true; cork.userData.goal = m.guard ? TOP + 0.04 : 6;
    }

    function burst() {
      if (reduced) return;
      burstT = 0; var p = sparks.geometry.attributes.position.array, v = sparks.userData.vel;
      for (var i = 0; i < 90; i++) { var th = Math.random() * 6.283, ph = Math.random() * 3.14; var r = R * 1.05;
        p[i * 3] = C.x + Math.sin(ph) * Math.cos(th) * r; p[i * 3 + 1] = C.y + Math.cos(ph) * r; p[i * 3 + 2] = C.z + Math.sin(ph) * Math.sin(th) * r;
        v[i * 3] = (p[i * 3] - C.x) * 0.9; v[i * 3 + 1] = 0.6 + Math.random() * 0.9; v[i * 3 + 2] = (p[i * 3 + 2] - C.z) * 0.9; }
    }

    function pour(index) {
      var tube = tubes[index]; if (!tube) return Promise.resolve();
      if (reduced) return Promise.resolve();
      return new Promise(function (res) { pours.push({ tube: tube, t: 0, done: res }); });
    }

    function select(index) { tubes.forEach(function (t, i) { t.userData.liftTarget = i === index ? 0.14 : 0; }); }
    function setInFormula(flags) { tubes.forEach(function (t, i) { t.userData.ring.material.opacity = flags[i] ? 0.55 : 0.06; }); }
    function setStage(s) { stage = s; if (s === 'compose') { target.distill = 0; target.vial = 0.05; } }
    function setIncubation(p) { target.phase = 0.02 + p * 8; }
    function setDistill(p) { target.distill = p; target.vial = 0.05 + p * 0.34; }

    // interaction
    var down = null, raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
    canvas.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY, yaw: yawTarget, moved: false }; });
    window.addEventListener('pointermove', function (e) { if (!down) return; var dx = e.clientX - down.x; if (Math.abs(dx) > 6) down.moved = true; yawTarget = Math.max(-0.45, Math.min(0.45, down.yaw - dx * 0.004)); });
    window.addEventListener('pointerup', function (e) {
      if (!down) return; var wasClick = !down.moved; down = null; if (!wasClick) return;
      var r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      var hits = raycaster.intersectObjects(tubes, true);
      if (hits.length && opts.onPick) opts.onPick(hits[0].object.userData.index);
    });
    window.addEventListener('deviceorientation', function (e) { if (e.gamma != null && !reduced) tilt = Math.max(-0.2, Math.min(0.2, e.gamma / 150)); });

    function resize() {
      var w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas); else window.addEventListener('resize', resize);
    resize();

    var last = performance.now();
    function frame() {
      requestAnimationFrame(frame);
      var now = performance.now();
      if (document.hidden) { last = now; return; }
      var dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; time += dt;
      var k = 1 - Math.pow(0.02, dt);

      // caméra
      yaw += (yawTarget + tilt - yaw) * k; var sway = reduced ? 0 : Math.sin(time * 0.25) * 0.035;
      var dist = Math.max(6.2, Math.min(11.5, 8.1 / camera.aspect)), tx = 0.3;
      camera.position.set(tx + Math.sin(yaw + sway) * dist, 2.55, Math.cos(yaw + sway) * dist);
      camera.lookAt(tx, 1.2, 0);

      // liquide
      liqU.uTime.value = time; flameU.uTime.value = time; sky.uniforms.uTime.value = time;
      liqU.uLevel.value += (target.level - liqU.uLevel.value) * k * 0.7;
      liqU.uBottom.value = C.y - R * 0.955;
      var e = liqU.uEdges.value; e.x += (target.edges[0] - e.x) * k; e.y += (target.edges[1] - e.y) * k; e.z += (target.edges[2] - e.z) * k;
      liqU.uCols.value.forEach(function (v, i) { var c = target.cols[i]; v.x += (c.r - v.x) * k; v.y += (c.g - v.y) * k; v.z += (c.b - v.z) * k; });
      liqU.uWob.value += (target.wob - liqU.uWob.value) * k; liqU.uSep.value += (target.sep - liqU.uSep.value) * k; liqU.uDim.value += (target.dim - liqU.uDim.value) * k;
      var ly = liqU.uLevel.value - C.y, rr = R * 0.955, sr = Math.sqrt(Math.max(0, rr * rr - ly * ly));
      surface.position.set(0, liqU.uLevel.value, 0); surface.scale.setScalar(Math.max(0.001, sr)); surface.visible = liquid.visible && sr > 0.02;
      var topC = liqU.uCols.value[3]; surfMat.color.setRGB(topC.x, topC.y, topC.z).convertSRGBToLinear(); surfMat.emissive.setRGB(topC.x * 0.25, topC.y * 0.25, topC.z * 0.25).convertSRGBToLinear();
      if (mood.guard) surfMat.color.multiplyScalar(0.45);
      if (cork.userData.goal) { cork.position.y += (cork.userData.goal - cork.position.y) * k * 0.8; cork.visible = mood.guard || cork.position.y < 4.2; }
      alarm.intensity = mood.guard ? 0.8 + Math.sin(time * 4) * 0.4 : 0;

      // fioles
      tubes.forEach(function (t) { var u = t.userData; if (u.pouring) return; u.lift += (u.liftTarget - u.lift) * k; t.position.set(u.home.x, u.home.y + u.lift, u.home.z); t.rotation.set(0, 0, 0); });
      var sp = stream.geometry.attributes.position.array, sv = stream.userData.vel, sl = stream.userData.life, pouringNow = null;
      pours = pours.filter(function (p) {
        p.t += dt / 1.6; var t = p.tube, u = t.userData; u.pouring = true; pouringNow = p;
        var over = new THREE.Vector3(0.5, TOP + 0.5, 0.05);
        if (p.t < 0.3) { var a = ease(p.t / 0.3); t.position.lerpVectors(u.home, over, a); t.rotation.z = a * 2.2; }
        else if (p.t < 0.72) { t.position.copy(over); t.rotation.z = 2.2 + Math.sin(time * 18) * 0.02; }
        else if (p.t < 1) { var b = ease((p.t - 0.72) / 0.28); t.position.lerpVectors(over, u.home, b); t.rotation.z = 2.2 * (1 - b); }
        else { u.pouring = false; p.done(); return false; }
        return true;
      });
      if (pouringNow && pouringNow.t > 0.3 && pouringNow.t < 0.72) {
        stream.material.color.set(pouringNow.tube.userData.color);
        var mouth = new THREE.Vector3(0.5 - Math.sin(2.2) * 0.62, TOP + 0.5 + Math.cos(2.2) * 0.62, 0.05);
        for (var si = 0; si < 70; si++) { if (sl[si] <= 0 && Math.random() < 0.35) { sl[si] = 1; sp[si * 3] = mouth.x + (Math.random() - 0.5) * 0.03; sp[si * 3 + 1] = mouth.y; sp[si * 3 + 2] = mouth.z + (Math.random() - 0.5) * 0.03; sv[si * 3 + 1] = -0.5; } }
      }
      for (var sj = 0; sj < 70; sj++) {
        if (sl[sj] > 0) { sv[sj * 3 + 1] -= 9 * dt; sp[sj * 3 + 1] += sv[sj * 3 + 1] * dt; sp[sj * 3] += (0 - sp[sj * 3]) * dt * 3; if (sp[sj * 3 + 1] < liqU.uLevel.value) sl[sj] = 0; }
        if (sl[sj] <= 0) sp[sj * 3 + 1] = -10;
      }
      stream.geometry.attributes.position.needsUpdate = true;

      // bulles
      var bp = bubbles.geometry.attributes.position.array; bubbles.visible = liquid.visible && !reduced;
      for (var bi = 0; bi < 36; bi++) {
        var y = bp[bi * 3 + 1] + dt * (0.12 + (bi % 5) * 0.05) * (stage === 'distilling' ? 3 : 1);
        if (y > liqU.uLevel.value - 0.03 || y < C.y - R) { y = C.y - R * 0.8 + Math.random() * 0.1; var ry = y - C.y, rad = Math.sqrt(Math.max(0, rr * rr - ry * ry)) * 0.7 * Math.random(), an = Math.random() * 6.283; bp[bi * 3] = Math.cos(an) * rad; bp[bi * 3 + 2] = Math.sin(an) * rad; }
        bp[bi * 3 + 1] = y;
      }
      bubbles.geometry.attributes.position.needsUpdate = true;

      // étincelles
      if (burstT >= 0) { burstT += dt; var kp = sparks.geometry.attributes.position.array, kv = sparks.userData.vel;
        for (var ki = 0; ki < 90; ki++) { kp[ki * 3] += kv[ki * 3] * dt; kp[ki * 3 + 1] += kv[ki * 3 + 1] * dt; kp[ki * 3 + 2] += kv[ki * 3 + 2] * dt; kv[ki * 3 + 1] -= 0.4 * dt; }
        sparks.material.opacity = Math.max(0, 1 - burstT / 1.5); sparks.geometry.attributes.position.needsUpdate = true; if (burstT > 1.5) burstT = -1; }
      sparks.visible = burstT >= 0;

      // fumée
      var mp = smoke.geometry.attributes.position.array, ml = smoke.userData.life; var emit = mood.tension && !mood.guard && !reduced;
      for (var mi = 0; mi < 28; mi++) {
        if (ml[mi] <= 0 && emit && Math.random() < dt * 2.5) { ml[mi] = 1; mp[mi * 3] = (Math.random() - 0.5) * 0.1; mp[mi * 3 + 1] = TOP + 0.05; mp[mi * 3 + 2] = (Math.random() - 0.5) * 0.1; }
        if (ml[mi] > 0) { ml[mi] -= dt * 0.45; mp[mi * 3 + 1] += dt * 0.35; mp[mi * 3] += Math.sin(time + mi) * dt * 0.08; } else mp[mi * 3 + 1] = -10;
      }
      smoke.geometry.attributes.position.needsUpdate = true;

      // incubation et distillation
      sky.uniforms.uPhase.value += (target.phase - sky.uniforms.uPhase.value) * k * 0.6;
      var dCount = Math.floor(tubeGeo.index.count * Math.min(1, target.distill * 1.6)); tubeGeo.setDrawRange(0, dCount - (dCount % 3));
      var fs = stage === 'distilling' ? 1 : 0; flame.scale.setScalar(Math.max(0.001, flame.scale.x + (fs - flame.scale.x) * k));
      vialU.uLevel.value += (target.vial - vialU.uLevel.value) * k * 0.5; vialU.uBottom.value = 0.05;
      drops.forEach(function (d, i) { d.visible = stage === 'distilling' && target.distill > 0.62; if (!d.visible) return; var tt = (time * 0.35 + i / 4) % 1; curve.getPointAt(tt, d.position); });

      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);

    return { ok: true, setLayers: setLayers, setMood: setMood, burst: burst, pour: pour, select: select, setInFormula: setInFormula, setStage: setStage, setIncubation: setIncubation, setDistill: setDistill, setReducedMotion: function (b) { reduced = b; } };
  }

  window.LaboScene = { create: create };
})();
