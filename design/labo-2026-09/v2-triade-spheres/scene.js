/* Le Labo — la triade en 3D (three.js r128). Trois volumes de pilier qui se chevauchent,
 * le socle en anneau autour, et les croisements qui s'allument entre eux.
 * Aucune donnée ici : l'app pousse la part de chaque pilier, les croisements et l'étape. */
(function () {
  'use strict';

  var FIELD_VS = 'varying vec3 vN; varying vec3 vW;' +
    'void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }';

  // Un champ de pilier : bord lumineux, cœur voilé. Additif : les chevauchements s'éclairent d'eux-mêmes.
  var FIELD_FS = 'uniform vec3 uColor; uniform float uAlpha; uniform float uDim; varying vec3 vN; varying vec3 vW;' +
    'void main(){ vec3 V = normalize(cameraPosition - vW); vec3 N = normalize(vN); float f = 1.0 - abs(dot(N, V));' +
    ' float rim = pow(f, 2.4); float a = (0.05 + rim * 0.7) * uAlpha * mix(1.0, 0.4, uDim);' +
    ' gl_FragColor = vec4(uColor * (0.55 + rim * 0.8), a); }';

  // Le niveau de la nutrition : il ondule à l'intérieur du champ vert.
  var LEVEL_FS = 'uniform vec3 uColor; uniform float uLevel; uniform float uTime; uniform float uAmp; uniform vec3 uCenter; uniform float uDim;' +
    'varying vec3 vN; varying vec3 vW;' +
    'void main(){ float y = vW.y - uCenter.y; float wave = (sin(vW.x * 5.0 + uTime * 1.8) * 0.035 + sin(vW.z * 4.0 - uTime * 1.3) * 0.025) * uAmp;' +
    ' if (y > uLevel + wave) discard; vec3 V = normalize(cameraPosition - vW); vec3 N = normalize(vN); float f = 1.0 - abs(dot(N, V));' +
    ' gl_FragColor = vec4(uColor * (0.22 + 0.45 * pow(f, 1.4)) * mix(1.0, 0.45, uDim), 0.5); }';

  // Le socle : un anneau en pointillés.
  var RING_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  var RING_FS = 'uniform vec3 uColor; uniform float uAlpha; uniform float uTime; varying vec2 vUv;' +
    'void main(){ float d = step(0.45, fract(vUv.x * 150.0 - uTime * 0.6)); if (d < 0.5) discard; gl_FragColor = vec4(uColor, uAlpha); }';

  var POINT_VS = 'attribute float aSize; attribute float aAlpha; uniform float uScale; varying float vA;' +
    'void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(0.1, -mv.z); vA = aAlpha; gl_Position = projectionMatrix * mv; }';
  var POINT_FS = 'uniform vec3 uColor; varying float vA;' +
    'void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p); if (d > 0.5) discard; float a = smoothstep(0.5, 0.05, d) * vA; gl_FragColor = vec4(uColor, a); }';

  var PILLARS = ['muscu', 'course', 'nutrition'];
  var COLOR = { muscu: '#e07a98', course: '#6fa8ef', nutrition: '#a9ba7e', socle: '#e0b155' };
  var KIND = { syn: '#f2d28a', tension: '#e0b155', guard: '#f08a7e' };

  function v3(hex) { var c = new THREE.Color(hex); return new THREE.Vector3(c.r, c.g, c.b); }
  function glowTexture(hex) {
    var c = document.createElement('canvas'); c.width = c.height = 128; var g = c.getContext('2d');
    var col = new THREE.Color(hex), rgb = Math.round(col.r * 255) + ',' + Math.round(col.g * 255) + ',' + Math.round(col.b * 255);
    var r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(' + rgb + ',0.9)'); r.addColorStop(0.4, 'rgba(' + rgb + ',0.28)'); r.addColorStop(0.9, 'rgba(' + rgb + ',0)'); r.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = r; g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill();
    var t = new THREE.CanvasTexture(c); t.premultiplyAlpha = true; return t;
  }
  function markerTexture(kind) {
    var c = document.createElement('canvas'); c.width = c.height = 128; var g = c.getContext('2d');
    var ring = KIND[kind] || KIND.syn;
    g.beginPath(); g.arc(64, 64, 40, 0, Math.PI * 2);
    g.fillStyle = kind === 'tension' ? '#1c150e' : ring; g.fill();
    g.lineWidth = 9; g.strokeStyle = ring; g.stroke();
    g.fillStyle = kind === 'tension' ? KIND.tension : '#1c150e';
    if (kind === 'syn') { g.beginPath(); g.moveTo(64, 38); g.lineTo(71, 57); g.lineTo(90, 64); g.lineTo(71, 71); g.lineTo(64, 90); g.lineTo(57, 71); g.lineTo(38, 64); g.lineTo(57, 57); g.closePath(); g.fill(); }
    else if (kind === 'tension') { g.fillRect(40, 60, 48, 8); g.beginPath(); g.moveTo(40, 64); g.lineTo(52, 50); g.lineTo(52, 78); g.fill(); g.beginPath(); g.moveTo(88, 64); g.lineTo(76, 50); g.lineTo(76, 78); g.fill(); }
    else if (kind === 'keep') { g.beginPath(); g.moveTo(48, 38); g.lineTo(80, 38); g.lineTo(80, 92); g.lineTo(64, 80); g.lineTo(48, 92); g.closePath(); g.fill(); }
    else { g.fillRect(60, 42, 8, 30); g.fillRect(60, 80, 8, 8); }
    return new THREE.CanvasTexture(c);
  }

  function create(canvas, opts) {
    opts = opts || {};
    if (!window.THREE) return { ok: false, reason: 'lib' };
    var probeGl = null;
    try { var probe = document.createElement('canvas'); probeGl = probe.getContext('webgl2') || probe.getContext('webgl') || probe.getContext('experimental-webgl'); } catch (e) { probeGl = null; }
    if (!probeGl) return { ok: false, reason: 'webgl' };
    var renderer = null, lastError = '';
    [{ antialias: true, alpha: true }, { antialias: false, alpha: true, powerPreference: 'low-power', precision: 'mediump' }].some(function (cfg) {
      try { renderer = new THREE.WebGLRenderer(Object.assign({ canvas: canvas }, cfg)); return true; } catch (e) { lastError = (e && e.message) || String(e); renderer = null; return false; }
    });
    if (!renderer) return { ok: false, reason: 'renderer', detail: lastError };
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); if (opts.onLost) opts.onLost(); });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    var reduced = !!opts.reducedMotion;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    var world = new THREE.Group(); scene.add(world);

    var HOME = { muscu: new THREE.Vector3(-0.95, 0.5, 0), course: new THREE.Vector3(0.95, 0.5, -0.05), nutrition: new THREE.Vector3(0, -0.72, 0.12) };
    var fields = {}, pointsUniformScale = { value: 400 };

    function makePoints(n, hex, additive) {
      var geo = new THREE.BufferGeometry();
      var pos = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n);
      for (var i = 0; i < n; i++) pos[i * 3 + 1] = -50;
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
      geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
      var mat = new THREE.ShaderMaterial({ vertexShader: POINT_VS, fragmentShader: POINT_FS, transparent: true, depthWrite: false, blending: additive === false ? THREE.NormalBlending : THREE.AdditiveBlending, uniforms: { uColor: { value: v3(hex) }, uScale: pointsUniformScale } });
      var p = new THREE.Points(geo, mat); p.frustumCulled = false;
      p.userData = { pos: pos, size: size, alpha: alpha, geo: geo, n: n };
      return p;
    }
    function flush(p) { p.userData.geo.attributes.position.needsUpdate = true; p.userData.geo.attributes.aSize.needsUpdate = true; p.userData.geo.attributes.aAlpha.needsUpdate = true; }

    // la poussière de fond
    var dust = makePoints(90, '#fff4e0'); scene.add(dust);
    for (var di = 0; di < 90; di++) { dust.userData.pos[di * 3] = (Math.random() - 0.5) * 12; dust.userData.pos[di * 3 + 1] = (Math.random() - 0.5) * 8; dust.userData.pos[di * 3 + 2] = -3 - Math.random() * 4; dust.userData.size[di] = 1.5 + Math.random() * 2.5; dust.userData.alpha[di] = 0.08 + Math.random() * 0.22; }
    flush(dust);

    PILLARS.forEach(function (p) {
      var g = new THREE.Group(); g.position.copy(HOME[p]); world.add(g);
      var mat = new THREE.ShaderMaterial({ vertexShader: FIELD_VS, fragmentShader: FIELD_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uColor: { value: v3(COLOR[p]) }, uAlpha: { value: 1 }, uDim: { value: 0 } } });
      var shell = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), mat); g.add(shell);
      var glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(COLOR[p]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.16 }));
      g.add(glow);
      var ghost = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.12, depthWrite: false }));
      ghost.visible = false; g.add(ghost);
      var f = { group: g, shell: shell, mat: mat, glow: glow, ghost: ghost, r: 1, rTarget: 1, active: true, bump: 0, sel: 0 };
      shell.userData.pillar = p; ghost.userData.pillar = p;

      if (p === 'muscu') {
        // l'onde de choc
        var imat = mat.clone(); imat.uniforms = THREE.UniformsUtils.clone(mat.uniforms);
        var impact = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), imat); g.add(impact); f.impact = impact;
      }
      if (p === 'course') {
        // le flux : trois comètes en orbite
        f.comets = makePoints(3 * 10, '#b7d6ff'); g.add(f.comets);
      }
      if (p === 'nutrition') {
        var lmat = new THREE.ShaderMaterial({ vertexShader: FIELD_VS, fragmentShader: LEVEL_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uColor: { value: v3('#a9ba7e') }, uLevel: { value: -0.1 }, uTime: { value: 0 }, uAmp: { value: 1 }, uCenter: { value: g.position }, uDim: { value: 0 } } });
        var level = new THREE.Mesh(new THREE.SphereGeometry(0.9, 48, 32), lmat); g.add(level); f.level = level; f.lmat = lmat;
      }
      fields[p] = f;
    });

    // le socle
    var ringMat = new THREE.ShaderMaterial({ vertexShader: RING_VS, fragmentShader: RING_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uColor: { value: v3(COLOR.socle) }, uAlpha: { value: 0.75 }, uTime: { value: 0 } } });
    var ring = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.011, 6, 320), ringMat);
    ring.rotation.x = 1.25; ring.position.y = -0.05; world.add(ring);
    var socle = { amount: 0.5, thick: 1 };

    // les croisements : un emplacement réutilisable par croisement
    var MARK = { syn: markerTexture('syn'), tension: markerTexture('tension'), guard: markerTexture('guard') };
    var HALO = { syn: glowTexture(KIND.syn), tension: glowTexture(KIND.tension), guard: glowTexture(KIND.guard) };
    var slots = [];
    for (var si = 0; si < 6; si++) {
      var marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: MARK.syn, depthTest: false, transparent: true }));
      marker.scale.setScalar(0.3); marker.renderOrder = 10; marker.visible = false; world.add(marker);
      var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: HALO.syn, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      halo.scale.setScalar(0.9); halo.visible = false; world.add(halo);
      var bridge = makePoints(18, KIND.syn); bridge.visible = false; world.add(bridge);
      var lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(14 * 3), 3));
      var line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(KIND.tension), transparent: true, opacity: 0.9, depthWrite: false })); line.visible = false; line.frustumCulled = false; world.add(line);
      slots.push({ marker: marker, halo: halo, bridge: bridge, line: line, kind: null, pair: null, born: 0 });
    }

    // la découverte du bilan
    var found = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#f2d28a'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    found.position.set(0, 2.15, 0.2); found.scale.setScalar(0.01); world.add(found);
    var foundMark = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTexture('keep'), depthTest: false, transparent: true, opacity: 0 }));
    foundMark.position.copy(found.position); foundMark.scale.setScalar(0.01); foundMark.renderOrder = 11; world.add(foundMark);
    var gather = makePoints(60, '#f2d28a'); gather.visible = false; world.add(gather);

    var state = { stage: 'compose', week: 0, bilan: 0, guard: false, selected: null };
    var crossings = [];

    function center(p) { return fields[p] ? fields[p].group.position : HOME.muscu; }
    function pairPoint(pair, out) {
      if (!pair || pair.length === 3) return out.set(0, 0.1, 0.55);
      if (pair.indexOf('socle') >= 0) { var o = pair[0] === 'socle' ? pair[1] : pair[0]; var c = center(o); var dir = c.clone().normalize(); return out.copy(c).add(dir.multiplyScalar(fields[o].r * 0.92)).setZ(0.6); }
      var a = center(pair[0]), b = center(pair[1]); return out.copy(a).add(b).multiplyScalar(0.5).setZ(0.55);
    }

    function setPillars(p) {
      PILLARS.forEach(function (k) {
        var f = fields[k], v = p[k] || { amount: 0, active: false };
        f.active = v.active !== false; f.rTarget = f.active ? 0.72 + 0.62 * v.amount : 0.95;
      });
      if (p.socle) socle.amount = p.socle.amount;
    }
    function setCrossings(list) {
      crossings = list.slice(0, slots.length);
      slots.forEach(function (s, i) {
        var c = crossings[i];
        if (!c) { s.kind = null; s.marker.visible = s.halo.visible = s.bridge.visible = s.line.visible = false; return; }
        var changed = s.kind !== c.kind || String(s.pair) !== String(c.pair);
        s.kind = c.kind; s.pair = c.pair; if (changed) s.born = performance.now();
        s.marker.material.map = MARK[c.kind]; s.marker.material.needsUpdate = true;
        s.halo.material.map = HALO[c.kind]; s.halo.material.needsUpdate = true;
        s.bridge.material.uniforms.uColor.value = v3(KIND[c.kind]);
        s.marker.visible = s.halo.visible = true;
        s.bridge.visible = c.kind === 'syn' && c.pair.length === 2 && c.pair.indexOf('socle') < 0;
        s.line.visible = c.kind === 'tension' && c.pair.length === 2;
      });
      state.guard = crossings.some(function (c) { return c.kind === 'guard'; });
    }
    function pulse(p) { if (fields[p]) fields[p].bump = 1; }
    function select(p) { state.selected = p; }
    function setStage(s) { state.stage = s; if (s === 'compose') { state.week = 0; state.bilan = 0; } }
    function setWeek(p) { state.week = p; PILLARS.forEach(pulse); }
    function setBilan(p) { state.bilan = p; }

    // gestes
    var down = null, yaw = 0, yawTarget = 0, pitch = 0, pitchTarget = 0, tilt = 0, raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
    canvas.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY, yaw: yawTarget, pitch: pitchTarget, moved: false }; });
    window.addEventListener('pointermove', function (e) {
      if (!down) return; var dx = e.clientX - down.x, dy = e.clientY - down.y; if (Math.abs(dx) + Math.abs(dy) > 6) down.moved = true;
      yawTarget = Math.max(-0.7, Math.min(0.7, down.yaw - dx * 0.005)); pitchTarget = Math.max(-0.3, Math.min(0.35, down.pitch + dy * 0.003));
    });
    window.addEventListener('pointerup', function (e) {
      if (!down) return; var click = !down.moved; down = null; if (!click) return;
      var r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      var hits = raycaster.intersectObjects(PILLARS.map(function (p) { return fields[p].active ? fields[p].shell : fields[p].ghost; }), false);
      if (hits.length && opts.onPick) opts.onPick(hits[0].object.userData.pillar);
    });
    window.addEventListener('deviceorientation', function (e) { if (e.gamma != null && !reduced) tilt = Math.max(-0.25, Math.min(0.25, e.gamma / 120)); });

    function resize() {
      var w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      pointsUniformScale.value = h * renderer.getPixelRatio() * 0.016;
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas); else window.addEventListener('resize', resize);
    resize();

    var time = 0, last = performance.now(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
    function frame() {
      requestAnimationFrame(frame);
      var now = performance.now();
      if (document.hidden) { last = now; return; }
      var dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; time += dt;
      var k = 1 - Math.pow(0.015, dt), m = reduced ? 0 : 1;
      var cycling = state.stage === 'incubating';

      yaw += (yawTarget + tilt - yaw) * k; pitch += (pitchTarget - pitch) * k;
      var sway = Math.sin(time * 0.22) * 0.08 * m;
      var dist = Math.max(7.2, 5.0 / (0.689 * camera.aspect));
      camera.position.set(Math.sin(yaw + sway) * dist, 0.9 + pitch * 6, Math.cos(yaw + sway) * dist);
      camera.lookAt(0, 0.05 + (state.bilan > 0 ? state.bilan * 0.45 : 0), 0);

      world.rotation.y += (cycling ? 0.5 : 0) * dt * m;
      if (!cycling) world.rotation.y += (0 - world.rotation.y) * k * 0.5;

      PILLARS.forEach(function (p, i) {
        var f = fields[p];
        f.r += (f.rTarget - f.r) * k * 0.8; f.bump = Math.max(0, f.bump - dt * 2.2);
        var breathe = 1 + Math.sin(time * (1.1 + i * 0.17) + i * 2) * 0.018 * m;
        var s = f.r * breathe * (1 + f.bump * 0.12);
        var drift = Math.sin(time * 0.5 + i * 2.1) * 0.04 * m;
        f.group.position.set(HOME[p].x, HOME[p].y + drift, HOME[p].z);
        var sel = state.selected === p ? 1 : 0; f.sel += (sel - f.sel) * k;
        f.shell.visible = f.active; f.glow.visible = f.active; f.ghost.visible = !f.active;
        f.shell.scale.setScalar(s); f.ghost.scale.setScalar(s); f.ghost.rotation.y += dt * 0.15 * m;
        f.mat.uniforms.uAlpha.value = 0.85 + f.sel * 0.45 + f.bump * 0.5;
        f.mat.uniforms.uDim.value += ((state.guard ? 1 : 0) - f.mat.uniforms.uDim.value) * k;
        f.glow.scale.setScalar(s * 1.9); f.glow.material.opacity = (0.16 + f.sel * 0.1 + f.bump * 0.2) * (state.guard ? 0.5 : 1);
        if (f.impact) {
          var t = reduced ? 0.5 : (time / 2.6) % 1; f.impact.visible = f.active && !reduced;
          f.impact.scale.setScalar(s * (0.6 + t * 0.62)); f.impact.material.uniforms.uAlpha.value = (1 - t) * 0.45;
        }
        if (f.comets) {
          var c = f.comets.userData; f.comets.visible = f.active;
          for (var q = 0; q < 3; q++) for (var j = 0; j < 10; j++) {
            var idx = q * 10 + j, ang = (reduced ? 0 : time * (0.9 + q * 0.12)) + q * 2.1 - j * 0.07, rr = s * 1.06;
            c.pos[idx * 3] = Math.cos(ang) * rr; c.pos[idx * 3 + 1] = Math.sin(ang) * rr * 0.35 * (q - 1); c.pos[idx * 3 + 2] = Math.sin(ang) * rr;
            c.size[idx] = 7 * (1 - j / 10); c.alpha[idx] = 0.95 * (1 - j / 10);
          }
          flush(f.comets);
        }
        if (f.level) {
          f.level.visible = f.active; f.level.scale.setScalar(s / 0.9 * 0.9);
          f.lmat.uniforms.uTime.value = time; f.lmat.uniforms.uAmp.value = m;
          f.lmat.uniforms.uLevel.value += ((-0.35 + f.r * 0.25) * s - f.lmat.uniforms.uLevel.value) * k;
          f.lmat.uniforms.uDim.value = f.mat.uniforms.uDim.value;
        }
      });

      ringMat.uniforms.uTime.value = reduced ? 0 : time;
      var rs = 1 + Math.sin(time * 0.8) * 0.015 * m; ring.scale.set(rs, rs, rs);
      ringMat.uniforms.uAlpha.value = 0.3 + socle.amount * 0.6;
      ring.rotation.z += dt * 0.05 * m;

      // croisements
      slots.forEach(function (sl, i) {
        if (!sl.kind) return;
        pairPoint(sl.pair, tmp);
        var age = Math.min(1, (now - sl.born) / 500);
        var pop = reduced ? 1 : (age < 1 ? 1 + Math.sin(age * Math.PI) * 0.6 : 1);
        sl.marker.position.copy(tmp); sl.marker.scale.setScalar(0.3 * pop);
        sl.halo.position.copy(tmp);
        var hp = sl.kind === 'tension' ? 0.7 : 0.9 + Math.sin(time * 3 + i) * 0.25 * m;
        sl.halo.scale.setScalar((sl.kind === 'guard' ? 1.6 : 0.8) * hp); sl.halo.material.opacity = sl.kind === 'guard' ? 0.6 : 0.4;
        if (sl.bridge.visible) {
          var a = center(sl.pair[0]), b = center(sl.pair[1]), B = sl.bridge.userData;
          for (var n = 0; n < 18; n++) {
            var tt = reduced ? n / 17 : (time * 0.35 + n / 18) % 1;
            tmp2.copy(a).lerp(b, tt); tmp2.z += Math.sin(tt * Math.PI) * 0.7; tmp2.y += Math.sin(tt * Math.PI) * 0.12;
            B.pos[n * 3] = tmp2.x; B.pos[n * 3 + 1] = tmp2.y; B.pos[n * 3 + 2] = tmp2.z;
            B.size[n] = 9 * Math.sin(tt * Math.PI) + 2; B.alpha[n] = 0.9 * Math.sin(tt * Math.PI);
          }
          flush(sl.bridge);
        }
        if (sl.line.visible) {
          var pa = center(sl.pair[0]), pb = center(sl.pair[1]), arr = sl.line.geometry.attributes.position.array;
          for (var z = 0; z < 14; z++) {
            var u = z / 13; tmp2.copy(pa).lerp(pb, 0.3 + u * 0.4); tmp2.z = 0.5;
            var jit = (z % 2 ? 1 : -1) * 0.09 * (reduced ? 1 : (0.6 + Math.random() * 0.6)) * (z === 0 || z === 13 ? 0 : 1);
            arr[z * 3] = tmp2.x; arr[z * 3 + 1] = tmp2.y + jit; arr[z * 3 + 2] = tmp2.z;
          }
          sl.line.geometry.attributes.position.needsUpdate = true;
          sl.line.material.opacity = reduced ? 0.9 : 0.55 + Math.random() * 0.45;
        }
      });

      // poussière
      var D = dust.userData;
      for (var dd = 0; dd < 90; dd++) { D.pos[dd * 3 + 1] += dt * (cycling ? 0.9 : 0.06) * m; if (D.pos[dd * 3 + 1] > 4) D.pos[dd * 3 + 1] = -4; }
      flush(dust);

      // bilan : les croisements remontent en une découverte
      gather.visible = state.bilan > 0 && state.bilan < 1 && !reduced;
      if (gather.visible) {
        var G = gather.userData;
        for (var gi = 0; gi < 60; gi++) {
          var src = crossings.length ? crossings[gi % crossings.length].pair : null;
          pairPoint(src, tmp); var tg = (state.bilan * 1.6 + gi / 60) % 1;
          tmp.lerp(found.position, tg); tmp.x += Math.sin(gi * 12.9 + time * 2) * 0.12 * (1 - tg);
          G.pos[gi * 3] = tmp.x; G.pos[gi * 3 + 1] = tmp.y; G.pos[gi * 3 + 2] = tmp.z; G.size[gi] = 6; G.alpha[gi] = 0.9 * (1 - tg * 0.6);
        }
        flush(gather);
      }
      var fs = state.bilan > 0 ? 0.6 + state.bilan * 1.8 : 0.01;
      var mp = Math.max(0, Math.min(1, (state.bilan - 0.5) / 0.3));
      foundMark.scale.setScalar(0.01 + 0.45 * mp); foundMark.material.opacity = mp;
      found.scale.setScalar(fs); found.material.opacity = state.bilan > 0 ? Math.min(0.95, state.bilan * 2) : 0;

      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);

    return { ok: true, setPillars: setPillars, setCrossings: setCrossings, pulse: pulse, select: select, setStage: setStage, setWeek: setWeek, setBilan: setBilan, setReducedMotion: function (b) { reduced = b; } };
  }

  window.LaboScene = { create: create };
})();
