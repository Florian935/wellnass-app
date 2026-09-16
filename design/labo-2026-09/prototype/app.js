/* Le Labo — interface du prototype (v3) : ta semaine, composer, pourquoi, acquis ; son, voix, repli 2D.
 * Le Labo part du réel (la semaine en cours), propose un geste pour chaque point, montre ce qui change
 * dans le plan avant de l'appliquer, enquête quand une courbe cale et garde ce qu'il apprend. */
(function () {
  'use strict';
  var M = window.LaboMoteur, E = M.ELEMENTS, D = window.LaboDonnees;
  var $ = function (id) { return document.getElementById(id); };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var copy = function (o) { return Object.assign({}, o); };
  var MINUS = '−';

  var state = {
    tab: 'semaine', base: M.defaults(), idx: M.defaults(), version: 2, stage: 'compose', selected: 0, week: 0, metric: 'run', essence: null, lastKeys: null,
    props: {}, flash: {}, enquete: 'squat', tests: {}, focus: null, sound: true, voice: true, fiche: false,
  };
  var NAME = 'Hybride d’automne';
  var PILLAR_NAME = { muscu: 'Musculation', course: 'Course', nutrition: 'Nutrition', socle: 'Sommeil & ressenti' };
  var ICON = {
    muscu: '<line x1="6" y1="12" x2="18" y2="12"></line><rect x="3" y="8" width="3" height="8" rx="1"></rect><rect x="18" y="8" width="3" height="8" rx="1"></rect>',
    course: '<path d="M3 17c3 0 3-4 6-4s3 4 6 4 3-7 6-7"></path>',
    nutrition: '<path d="M12 21c-5 0-8-4-8-9 0-4 3-6 5-6 1.5 0 2.3.7 3 .7s1.5-.7 3-.7c2 0 5 2 5 6 0 5-3 9-8 9z"></path><path d="M12 7c0-2 1-4 3-4"></path>',
    socle: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"></path>',
  };
  var icon = function (p, size) { return '<svg width="' + (size || 18) + '" height="' + (size || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[p] + '</svg>'; };
  var CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>';
  var lens = function (pair) {
    var cls = pair.length === 3 ? ['muscu', 'course'] : pair;
    return '<svg class="lens" width="26" height="22" viewBox="0 0 26 22" aria-hidden="true"><circle class="p-' + cls[0] + '" cx="9" cy="11" r="7.5"></circle><circle class="p-' + cls[1] + '" cx="17" cy="11" r="7.5"></circle></svg>';
  };
  var dec = function (x) { return String(x).replace('.', ','); };
  var signed = function (x, unit, digits) { var v = digits ? Math.abs(x).toFixed(digits).replace('.', ',') : Math.round(Math.abs(x)); return (x > 0 ? '+' : x < 0 ? MINUS : '±') + v + unit; };
  var thousands = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };

  /* ---------- la scène 3D ---------- */
  var scene = { ok: false };
  var REASONS = {
    lib: 'La bibliothèque 3D ne s’est pas chargée dans cette visionneuse.',
    webgl: 'Ce navigateur n’autorise pas la 3D (WebGL indisponible).',
    renderer: 'Le téléphone a refusé de créer la scène 3D.',
    lost: 'Le téléphone a coupé la 3D pour libérer de la mémoire.',
    scene: 'Le script de la scène ne s’est pas chargé.',
  };
  function loadThree(done) {
    if (window.THREE) return done();
    var urls = ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js'];
    (function next(i) {
      if (window.THREE || i >= urls.length) return done();
      var s = document.createElement('script'); s.src = urls[i]; s.onload = function () { next(window.THREE ? urls.length : i + 1); }; s.onerror = function () { next(i + 1); };
      document.head.appendChild(s);
    })(0);
  }
  function fail(reason, detail) {
    scene = { ok: false }; document.body.classList.add('no3d');
    var why = REASONS[reason] || REASONS.renderer; $('fbReason').textContent = why.charAt(0).toLowerCase() + why.slice(1);
    $('fbCode').textContent = 'code : ' + reason + (detail ? ' · ' + String(detail).slice(0, 120) : '');
    draw2D();
  }

  /* ---------- le repli 2D : les mêmes disques, en SVG ---------- */
  var f1 = function (x) { return Math.round(x * 10) / 10; };
  var TONE2D = { syn: ['#f2d28a', '#6b4a12'], tension: ['#d99a45', '#3a2708'], guard: ['#f08a7e', '#5a1a10'] };
  var Z2D = { 'course|muscu': [175, 86], 'muscu|nutrition': [146, 180], 'course|nutrition': [204, 180], tri: [175, 142], 'muscu|socle': [58, 96], 'course|socle': [292, 96], 'nutrition|socle': [250, 262] };
  var HEX2D = { muscu: '#e07a98', course: '#6fa8ef', nutrition: '#a9ba7e', socle: '#e0b155' };
  var STATIC2D = null;
  function static2D() {
    if (STATIC2D) return STATIC2D;
    var seed = 7, r = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    var S = { rice: '', florets: '', salmon: '', bolts: '', lanes: '', trail: '' }, i, a, d, x, y;
    for (i = 0; i < 150; i++) { a = r() * 6.2832; d = Math.sqrt(r()) * 46; x = f1(d * Math.cos(a)); y = f1(d * Math.sin(a)); S.rice += '<ellipse cx="' + x + '" cy="' + y + '" rx="2.3" ry="1.05" transform="rotate(' + Math.round(r() * 180) + ' ' + x + ' ' + y + ')" fill="#fffdf6" stroke="#e1d4bb" stroke-width=".35"/>'; }
    for (i = 0; i < 26; i++) { a = r() * 6.2832; d = Math.sqrt(r()) * 44; x = d * Math.cos(a); y = d * Math.sin(a); S.florets += '<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="5.2" fill="' + ['#6d8c3f', '#86a852', '#5a7733'][Math.floor(r() * 3)] + '"/><circle cx="' + f1(x - 2) + '" cy="' + f1(y - 2) + '" r="2.6" fill="#a6c46c" opacity=".75"/>'; }
    for (i = 0; i < 7; i++) S.salmon += '<rect x="-60" y="' + (-56 + i * 17) + '" width="120" height="14" rx="6" fill="' + (i % 2 ? '#f39a74' : '#ee8a64') + '" transform="rotate(-28)"/>';
    for (i = 0; i < 6; i++) { a = i * Math.PI / 3; S.bolts += '<circle cx="' + f1(12.5 * Math.cos(a)) + '" cy="' + f1(12.5 * Math.sin(a)) + '" r="1.7" fill="#d9d2c7"/>'; }
    [57, 52, 47, 42, 37].forEach(function (rr) { S.lanes += '<circle r="' + rr + '" fill="none" stroke="rgba(255,255,255,.62)" stroke-width=".8"/>'; });
    for (i = 0; i < 9; i++) { a = (-90 - i * 7) * Math.PI / 180; S.trail += '<circle cx="' + f1(49.5 * Math.cos(a)) + '" cy="' + f1(49.5 * Math.sin(a)) + '" r="' + f1(4.2 - i * 0.38) + '" fill="#fff" opacity="' + f1(1 - i * 0.11) + '"/>'; }
    S.defs = '<defs>' +
      '<radialGradient id="rub2" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#f7a9c2"/><stop offset=".35" stop-color="#d0668a"/><stop offset=".75" stop-color="#8a1a44"/><stop offset="1" stop-color="#5a0022"/></radialGradient>' +
      '<linearGradient id="steel2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6f2ea"/><stop offset=".45" stop-color="#a39c90"/><stop offset=".55" stop-color="#d9d3c8"/><stop offset="1" stop-color="#7a7368"/></linearGradient>' +
      '<radialGradient id="trk2" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#5a97e0"/><stop offset=".6" stop-color="#2a64ad"/><stop offset="1" stop-color="#173a70"/></radialGradient>' +
      '<radialGradient id="grs2" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#8db35c"/><stop offset="1" stop-color="#4a6c2e"/></radialGradient>' +
      '<radialGradient id="cer2" cx=".38" cy=".32" r=".85"><stop offset="0" stop-color="#fffdf8"/><stop offset=".7" stop-color="#efe6d6"/><stop offset="1" stop-color="#d6c8b0"/></radialGradient>' +
      '<filter id="drop2" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#000" flood-opacity=".5"/></filter>' +
      '</defs>';
    STATIC2D = S; return S;
  }
  function draw2D() {
    if (!document.body.classList.contains('no3d')) return;
    var S = static2D(), v = M.values(state.tab === 'composer' ? state.idx : state.base), R = 47;
    var P = 0.22 + (v.pr - 1.2) * 0.12, G = v.gl ? 0.46 : 0.34;
    var pt = function (f) { var a = -Math.PI / 2 + f * Math.PI * 2; return [f1(R * Math.cos(a)), f1(R * Math.sin(a))]; };
    var sec = function (a0, a1) { var p = pt(a0), q = pt(a1); return 'M0,0 L' + p[0] + ',' + p[1] + ' A' + R + ',' + R + ' 0 ' + (a1 - a0 > 0.5 ? 1 : 0) + ',1 ' + q[0] + ',' + q[1] + ' Z'; };
    var food = v.kc === 0 ? 1 : v.kc === -250 ? 0.88 : 0.74;
    var ms = v.fq ? 0.9 + (v.fq - 2) / 3 * 0.3 : 0.9, cs = v.km ? 0.9 + (v.km - 15) / 20 * 0.3 : 0.9;
    var full = v.so >= 8.5 ? 7 : v.so >= 7.5 ? 5 : 4, i;
    var svg = S.defs + '<path d="M28,126 A152,152 0 0,1 322,126" fill="none" stroke="#e0b155" stroke-width="1.1" stroke-dasharray="1.5 6" opacity=".55"/>';
    for (i = 0; i < 7; i++) {
      var a = (-150 + i * 20) * Math.PI / 180, x = f1(175 + 152 * Math.cos(a)), y = f1(165 + 152 * Math.sin(a));
      svg += i < full ? '<circle cx="' + x + '" cy="' + y + '" r="5" fill="#e0b155"/><circle cx="' + f1(x + 2) + '" cy="' + f1(y - 1.5) + '" r="4" fill="#1c150e" opacity=".9"/>' : '<circle cx="' + x + '" cy="' + y + '" r="4.5" fill="none" stroke="#e0b155" stroke-width="1.2" opacity=".6"/>';
    }
    svg += '<text x="175" y="40" font-family="Space Mono, monospace" font-size="8" font-weight="700" letter-spacing="1" fill="#e0b155" text-anchor="middle">NUITS · ' + full + '/7</text>';
    var d1 = pt(P), d2 = pt(P + G);
    svg += '<g transform="translate(175 212) scale(1.05)"><g filter="url(#drop2)"><circle r="62" fill="url(#cer2)" stroke="rgba(51,41,31,.3)"/><circle r="51" fill="#efe4d1"/>' +
      '<g transform="scale(' + food + ')"><defs><clipPath id="cp2P"><path d="' + sec(0, P) + '"/></clipPath><clipPath id="cp2G"><path d="' + sec(P, P + G) + '"/></clipPath><clipPath id="cp2L"><path d="' + sec(P + G, 1) + '"/></clipPath></defs>' +
      '<g clip-path="url(#cp2P)"><circle r="47" fill="#e9825c"/>' + S.salmon + '</g><g clip-path="url(#cp2G)"><circle r="47" fill="#f4ebda"/>' + S.rice + '</g><g clip-path="url(#cp2L)"><circle r="47" fill="#4f6b2f"/>' + S.florets + '</g>' +
      '<g stroke="#e8dcc8" stroke-width="3" stroke-linecap="round"><line x1="0" y1="0" x2="0" y2="-47"/><line x1="0" y1="0" x2="' + d1[0] + '" y2="' + d1[1] + '"/><line x1="0" y1="0" x2="' + d2[0] + '" y2="' + d2[1] + '"/></g></g>' +
      '<path d="M-55,22 A58,58 0 0,0 -20,55" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="3" stroke-linecap="round"/></g></g>';
    svg += '<g transform="translate(228 120) scale(' + cs.toFixed(3) + ')">' + (v.km
      ? '<g filter="url(#drop2)"><circle r="62" fill="url(#trk2)" stroke="#0f2547" stroke-width="1.5"/>' + S.lanes + '<circle r="33" fill="url(#grs2)" stroke="rgba(255,255,255,.7)"/><line x1="0" y1="-62" x2="0" y2="-37" stroke="#fff" stroke-width="2.4"/><g class="orbit2" style="animation-duration:' + (7 - v.km / 35 * 4.2).toFixed(2) + 's">' + S.trail + '</g>' +
        '<text y="5" font-family="Bricolage Grotesque, sans-serif" font-size="17" font-weight="800" fill="#fff" text-anchor="middle">' + v.km + '</text><text y="15" font-family="Space Mono, monospace" font-size="6" font-weight="700" letter-spacing=".8" fill="rgba(255,255,255,.9)" text-anchor="middle">KM / SEM</text></g>'
      : '<circle r="62" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="1.3" stroke-dasharray="4 5"/>') + '</g>';
    svg += '<g transform="translate(122 120) scale(' + ms.toFixed(3) + ')">' + (v.fq
      ? '<g filter="url(#drop2)"><circle r="62" fill="url(#rub2)" stroke="#3a0016" stroke-width="1.5"/><circle r="58.5" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="2.2"/><circle r="49" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="1.2"/>' +
        '<path id="ring2d" d="M-53,0 A53,53 0 1,1 53,0 A53,53 0 1,1 -53,0" fill="none"/><text font-family="Space Mono, monospace" font-size="6.6" font-weight="700" letter-spacing="2.2" fill="rgba(255,255,255,.72)"><textPath href="#ring2d" startOffset="2%">MUSCULATION · SÉANCES PAR SEMAINE · FITTRIO ·</textPath></text>' +
        '<text y="-24" font-family="Bricolage Grotesque, sans-serif" font-size="20" font-weight="800" fill="#fff" text-anchor="middle">' + v.fq + '</text><circle r="18" fill="url(#steel2)" stroke="#5c554b"/>' + S.bolts + '<circle r="8.5" fill="#1c150e" stroke="#8b847a"/>' +
        '<path d="M-54,-18 A57,57 0 0,1 -24,-52" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="3.5" stroke-linecap="round"/></g>'
      : '<circle r="62" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="1.3" stroke-dasharray="4 5"/>') + '</g>';
    var zones = {}, order = [];
    sceneCrossings().forEach(function (rc) {
      var key = rc.pair.length === 3 ? 'tri' : rc.pair.slice().sort().join('|');
      if (!zones[key]) { zones[key] = { n: 0, kind: rc.kind, pair: rc.pair }; order.push(key); }
      var z = zones[key]; z.n += 1; if (rc.kind === 'guard' || (rc.kind === 'tension' && z.kind === 'syn')) z.kind = rc.kind;
    });
    order.forEach(function (key) {
      var p = Z2D[key]; if (!p) return;
      var z = zones[key], t = TONE2D[z.kind], pair = z.pair.length === 3 ? ['muscu', 'course'] : z.pair;
      svg += '<g transform="translate(' + p[0] + ' ' + p[1] + ')"><g class="mk2">' +
        '<path d="M-10,-27 L-4,-27 L2,-8 L-4,-8 Z" fill="' + HEX2D[pair[0]] + '"/><path d="M4,-27 L10,-27 L4,-8 L-2,-8 Z" fill="' + HEX2D[pair[1]] + '"/>' +
        '<circle r="11" fill="' + t[0] + '" stroke="rgba(0,0,0,.35)" stroke-width="1"/><circle r="8" fill="none" stroke="' + t[1] + '" stroke-opacity=".45" stroke-width="1"/>' +
        '<text y="4" font-family="Space Mono, monospace" font-size="11" font-weight="700" fill="' + t[1] + '" text-anchor="middle">' + z.n + '</text></g></g>';
    });
    $('tri2d').innerHTML = svg;
  }

  function boot3D() {
    var old = $('scene'), fresh = old.cloneNode(false); old.parentNode.replaceChild(fresh, old);
    loadThree(function () {
      if (!window.LaboScene) return fail('scene');
      var res;
      try {
        res = window.LaboScene.create(fresh, {
          reducedMotion: reduced, quality: window.LABO_QUALITY || (location.search.match(/[?&]q=(\w+)/) || [])[1],
          onPick: onPick, onEvent: onSceneEvent, onLost: function () { fail('lost'); },
        });
      } catch (err) { return fail('renderer', err && err.message); }
      if (!res.ok) return fail(res.reason, res.detail);
      scene = res; document.body.classList.remove('no3d'); syncScene();
    });
  }

  /* ---------- son, voix, vibration ---------- */
  var ac = null;
  function audio() {
    if (!state.sound) return null;
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(f, dur, type, gain, when, slide) {
    var a = audio(); if (!a) return; var t = a.currentTime + (when || 0);
    var o = a.createOscillator(), g = a.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain || 0.08, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  var SFX = {
    dose: function (up) { tone(up ? 520 : 390, 0.18, 'sine', 0.05, 0, up ? 700 : 300); },
    syn: function () { tone(880, 0.5, 'sine', 0.09); tone(1318.5, 0.8, 'sine', 0.07, 0.1); },
    tension: function () { tone(185, 0.35, 'triangle', 0.06, 0, 160); tone(196, 0.35, 'triangle', 0.04, 0.05); },
    guard: function () { tone(392, 0.25, 'triangle', 0.1); tone(261.6, 0.5, 'triangle', 0.1, 0.22); },
    tick: function () { tone(1320, 0.05, 'sine', 0.03); },
    bilan: function () { [523.3, 659.3, 783.99, 1046.5].forEach(function (f, i) { tone(f, 0.9, 'sine', 0.05, i * 0.18); }); },
    click: function () { tone(640, 0.06, 'sine', 0.04); },
    apply: function () { [392, 523.3, 659.3, 783.99].forEach(function (f, i) { tone(f, 0.6, 'sine', 0.05, i * 0.08); }); },
    // Un disque de caoutchouc qui se pose : un bruit sourd filtré, et une basse brève.
    land: function () {
      var a = audio(); if (!a) return;
      var n = Math.floor(a.sampleRate * 0.16), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 5);
      var src = a.createBufferSource(), lp = a.createBiquadFilter(), g = a.createGain();
      src.buffer = buf; lp.type = 'lowpass'; lp.frequency.value = 480; g.gain.value = 0.32;
      src.connect(lp).connect(g).connect(a.destination); src.start();
      tone(64, 0.22, 'sine', 0.13, 0, 42);
    },
  };
  function say(text) {
    if (!state.voice || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(text); u.lang = 'fr-FR'; u.rate = 1.03;
      var v = window.speechSynthesis.getVoices().filter(function (x) { return /^fr/i.test(x.lang); })[0]; if (v) u.voice = v;
      window.speechSynthesis.speak(u);
    } catch (e) { /* voix indisponible */ }
  }
  function buzz(p) { if (navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { /* ignore */ } } }
  var toastTimer;
  function toast(kind, title, text) {
    var t = $('toast'); t.className = 'toast show k-' + kind; t.innerHTML = '<b>' + title + '</b><span>' + text + '</span>';
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.className = 'toast k-' + kind; }, 3800);
  }
  var lastLand = 0;
  function onSceneEvent(type, info) {
    if (type !== 'land' || info.ghost) return;
    var now = Date.now(); if (now - lastLand < 150) return; lastLand = now;
    SFX.land(); buzz(12);
  }

  /* ---------- le réel : la semaine, ses propositions, ce qu'elles changent ---------- */
  var findProp = function (id) { return D.propositions.filter(function (p) { return p.id === id; })[0]; };
  var propOn = function (id) { return !!state.props[id]; };
  var staged = function () { return D.propositions.filter(function (p) { return state.props[p.id] === 'staged'; }); };
  var openProps = function () { return D.propositions.filter(function (p) { return !state.props[p.id]; }); };
  function weekPlan() {
    var S = D.semaine, muscu = S.muscu.slice();
    if (propOn('swap')) { var t = muscu[2]; muscu[2] = muscu[4]; muscu[4] = t; }
    return { muscu: muscu, course: S.course };
  }
  function realForScene() {
    var R = D.semaine.reel;
    return { sessions: R.seances, sessionsDone: R.seancesFaites, km: R.km, kmDone: R.kmFaits, protein: propOn('prot') ? 1 : R.proteines / R.cibleProteines, nights: D.semaine.nuits.map(function (n) { return n ? n.ok : null; }), today: D.semaine.aujourdhui };
  }
  function nextSession(list) {
    var S = D.semaine;
    for (var i = S.aujourdhui + 1; i < 7; i++) if (list[i]) return S.jours[i].nom + ', ' + list[i].long.charAt(0).toLowerCase() + list[i].long.slice(1);
    return 'la semaine prochaine';
  }

  /* ---------- les objectifs, projetés au 15/11 ---------- */
  var GOAL_RUN = 2880;
  function penalties(onlyOpen) {
    var p = { run: 0, sbd: 0 };
    D.propositions.forEach(function (pr) { if (!onlyOpen || !propOn(pr.id)) { p.run -= pr.effet.run || 0; p.sbd -= pr.effet.sbd || 0; } });
    return p;
  }
  function goals() {
    var composing = state.tab === 'composer', base = M.project(state.base)[8], cur = composing ? M.project(state.idx)[8] : base;
    var pen = composing ? { run: 0, sbd: 0 } : penalties(true), all = composing ? { run: 0, sbd: 0 } : penalties(false);
    var run = cur.run.mid + pen.run, sbd = cur.sbd.mid + pen.sbd, kg = cur.kg.mid;
    var ref = { run: base.run.mid + all.run, sbd: base.sbd.mid + all.sbd, kg: base.kg.mid };
    return [
      { l: '10 km', v: M.mmss(run), d: Math.round(run - ref.run), unit: ' s', better: -1, n: run <= GOAL_RUN ? 'objectif 48:00 atteint' : 'il manque ' + Math.round(run - GOAL_RUN) + ' s', tone: run <= GOAL_RUN ? 'ok' : 'warn' },
      { l: 'Total SBD', v: Math.round(sbd) + ' kg', d: Math.round(sbd - ref.sbd), unit: ' kg', better: 1, n: '+' + Math.round(sbd - 372) + ' kg sur le cycle', tone: '' },
      { l: 'Poids', v: dec(kg.toFixed(1)) + ' kg', d: Math.round((kg - ref.kg) * 10) / 10, unit: ' kg', better: 0, digits: 1, n: signed(kg - 77.6, ' kg', 1) + ' sur le cycle', tone: '' },
    ];
  }
  function renderGoals() {
    $('goals').innerHTML = goals().map(function (g) {
      var cls = g.better === 0 ? 'neutral' : g.d * g.better > 0 ? 'good' : 'bad';
      var dl = g.d ? '<span class="delta ' + cls + '">' + signed(g.d, g.unit, g.digits) + '</span>' : '';
      return '<div class="goal"><span class="goal-l">' + g.l + '</span><div class="goal-v"><b>' + g.v + '</b>' + dl + '</div><span class="goal-n' + (g.tone ? ' t-' + g.tone : '') + '">' + g.n + '</span></div>';
    }).join('');
  }

  /* ---------- onglet Semaine ---------- */
  function renderWeek() {
    var S = D.semaine, R = S.reel, plan = weekPlan(), open = openProps().length, st = staged().length;
    var WORD = ['', 'Une chose', 'Deux choses', 'Trois choses'];
    $('weekLead').innerHTML = open ? WORD[open] + ' à régler avant jeudi.<small>Ta séance de fractionné de jeudi en dépend.</small>'
      : st ? 'Tout est prêt.<small>Il reste à l’appliquer à ton plan : rien ne change sans toi.</small>'
        : 'Ta semaine est calée.<small>Le Labo te prévient si une nuit ou un repas change la donne.</small>';
    var prot = R.proteines;
    var items = [
      { p: 'muscu', t: 'Musculation', v: R.seancesFaites + ' <small>sur ' + R.seances + ' séances</small>', pct: R.seancesFaites / R.seances, n: 'prochaine : ' + nextSession(plan.muscu) },
      { p: 'course', t: 'Course', v: dec(R.kmFaits) + ' <small>sur ' + R.km + ' km</small>', pct: R.kmFaits / R.km, n: 'prochaine : ' + nextSession(plan.course) },
      { p: 'nutrition', t: 'Protéines', v: dec(prot) + ' <small>sur 1,8 g/kg</small>', pct: prot / R.cibleProteines, warn: true, n: propOn('prot') ? 'petit-déjeuner renforcé dès demain' : 'moyenne de lundi et mardi' },
      { p: 'socle', t: 'Nuits', v: '1 <small>sur 2 au-dessus de 7 h</small>', pct: 0.5, warn: true, n: 'lundi 7 h 40 · mardi 6 h 10' },
    ];
    $('weekProgress').innerHTML = items.map(function (it) {
      return '<li class="p-' + it.p + '"><div class="prog-top">' + icon(it.p, 15) + '<span style="color:var(--ink)">' + it.t + '</span></div><span class="prog-v" style="color:var(--ink)">' + it.v + '</span>' +
        '<div class="bar' + (it.warn ? ' warn' : '') + '"><i style="width:' + Math.round(Math.min(1, it.pct) * 100) + '%"></i></div><span class="prog-n">' + it.n + '</span></li>';
    }).join('');

    var clash = !propOn('swap'), g = '<span></span>';
    g += S.jours.map(function (j, i) { return '<span class="wk-day' + (i === S.aujourdhui ? ' today' : '') + '" aria-label="' + j.nom + ' ' + j.d + '">' + j.l + '<small>' + j.d + '</small></span>'; }).join('');
    var row = function (p, list, clashAt, movedAt) {
      return '<span class="wk-ico p-' + p + '" title="' + PILLAR_NAME[p] + '">' + icon(p, 15) + '</span>' + list.map(function (x, i) {
        if (!x) return '<span class="wk-cell empty" aria-hidden="true">·</span>';
        var cls = 'wk-cell p-' + p + ' ' + (x.fait ? 'done' : 'plan') + (clash && i === clashAt ? ' clash' : '') + (!clash && movedAt.indexOf(i) >= 0 ? ' moved' : '');
        return '<span class="' + cls + '" title="' + S.jours[i].nom + ' : ' + x.long + (x.fait ? ' (fait)' : ' (prévu)') + '">' + x.n + '</span>';
      }).join('');
    };
    g += row('muscu', plan.muscu, 2, [2, 4]) + row('course', plan.course, 3, []);
    g += '<span class="wk-ico p-nutrition" title="Protéines (g/kg)">' + icon('nutrition', 15) + '</span>' + S.proteines.map(function (x, i) {
      return x == null ? '<span class="wk-cell empty" aria-hidden="true">·</span>' : '<span class="wk-cell num' + (x < R.cibleProteines ? ' low' : '') + '" title="' + S.jours[i].nom + ' : ' + dec(x) + ' g/kg de protéines">' + dec(x) + '</span>';
    }).join('');
    g += '<span class="wk-ico p-socle" title="Nuits">' + icon('socle', 15) + '</span>' + S.nuits.map(function (x, i) {
      if (!x) return '<span class="wk-cell empty" aria-hidden="true">·</span>';
      return x.ok ? '<span class="wk-cell night p-socle" title="Nuit de ' + S.jours[i].nom + ' : ' + x.h + '"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"></path></svg></span>'
        : '<span class="wk-cell num low" title="Nuit de ' + S.jours[i].nom + ' : ' + x.h + '">' + x.h + '</span>';
    }).join('');
    g += clash
      ? '<p class="wk-clash">' + lens(['muscu', 'course']) + '<span>Jambes mercredi, fractionné jeudi : environ 3 s perdues par 800 m.</span></p>'
      : '<p class="wk-clash ok">' + CHECK + '<span>Jambes à vendredi : 48 h entre le squat et ton prochain fractionné.</span></p>';
    $('weekGrid').innerHTML = g;

    $('propCount').textContent = open ? open + ' à régler' : 'tout est réglé';
    $('props').innerHTML = D.propositions.map(function (p) {
      var s = state.props[p.id], src = p.source.split(' · ');
      var foot = s === 'applied' ? '<span class="state">' + CHECK + 'Dans ton plan <button type="button" class="link" data-undo="' + p.id + '">annuler</button></span>'
        : s === 'staged' ? '<span class="state">' + CHECK + 'Prêt <button type="button" class="link" data-unstage="' + p.id + '">retirer</button></span>'
          : '<button type="button" class="act" data-stage="' + p.id + '">' + p.geste + '</button>';
      return '<li class="prop t-' + p.ton + (s ? ' ' + s : '') + '" id="prop-' + p.id + '"><div class="prop-top">' + lens(p.paire) + '<b>' + p.titre + '</b><span class="kind">' + p.genre + '</span></div>' +
        '<p>' + (s ? p.fait : p.texte) + '</p>' + (s ? '' : '<p class="src"><code>' + src[0] + '</code>' + (src[1] ? ' · ' + src[1] : '') + '</p>') +
        '<div class="prop-foot"><span class="effect">' + p.effetTexte + '</span>' + foot + '</div></li>';
    }).join('');
  }

  /* ---------- onglet Composer ---------- */
  var WEIGHT = 77.6, TDEE = 2750;
  var CHANGE = {
    fq: function (a, b) { return { p: 'muscu', titre: 'Musculation · programme', detail: a + ' → ' + b + ' séances par semaine', ou: 'Accueil, Musculation' }; },
    km: function (a, b) { return { p: 'course', titre: 'Course · plan 10 km', detail: 'Volume : ' + a + ' → ' + b + ' km par semaine', ou: 'Accueil, Course' }; },
    fr: function (a, b) { return { p: 'course', titre: 'Course · plan 10 km', detail: 'Fractionné : ' + a + ' → ' + b + ' séance' + (b > 1 ? 's' : '') + ' par semaine', ou: 'Accueil, Course' }; },
    pr: function (a, b) { return { p: 'nutrition', titre: 'Nutrition · cibles', detail: 'Protéines : ' + dec(a) + ' → ' + dec(b) + ' g/kg, soit ' + Math.round(b * WEIGHT) + ' g par jour', ou: 'Nutrition' }; },
    kc: function (a, b) { return { p: 'nutrition', titre: 'Nutrition · cibles', detail: 'Calories : ' + thousands(TDEE + a) + ' → ' + thousands(TDEE + b) + ' kcal par jour', ou: 'Accueil, Nutrition' }; },
    gl: function (a, b) { return { p: 'nutrition', titre: 'Nutrition · jours de fractionné', detail: b ? 'Glucides +1,5 g/kg les jours durs, repas types ajustés' : 'Mêmes glucides tous les jours', ou: 'Nutrition' }; },
    so: function (a, b) { return { p: 'socle', titre: 'Sommeil & ressenti', detail: 'Rappel du coucher calé sur ' + E[6].fmt(b) + ' de nuit', ou: 'Accueil' }; },
  };
  function formulaDiff() {
    var a = M.values(state.base), b = M.values(state.idx);
    return E.filter(function (e) { return a[e.id] !== b[e.id]; }).map(function (e) { return CHANGE[e.id](a[e.id], b[e.id]); });
  }
  // Chaque cran possible, essayé sur la projection : ce qui fait gagner le plus sur le 10 km sans coûter de force.
  function bestLevers() {
    var p0 = M.project(state.idx)[8], a0 = M.analyse(state.idx), out = [];
    E.forEach(function (e, i) {
      [-1, 1].forEach(function (d) {
        var ni = state.idx[e.id] + d; if (ni < 0 || ni >= e.values.length) return;
        if (e.id === 'so') return;
        if (e.id === 'kc' && d > 0) return; // jamais de déficit plus creusé proposé
        if ((e.id === 'fq' || e.id === 'km') && e.values[ni] === 0) return;
        var idx = copy(state.idx); idx[e.id] = ni;
        var a = M.analyse(idx); if (a.guard) return;
        var p = M.project(idx)[8], dRun = p.run.mid - p0.run.mid, dSbd = p.sbd.mid - p0.sbd.mid;
        var fresh = a.reactions.filter(function (r) { return r.kind === 'tension' && !a0.reactions.some(function (q) { return q.key === r.key; }); })[0];
        var score = -dRun + dSbd * 4 - (fresh ? 10 : 0) - (dSbd < -1.5 ? 20 : 0);
        out.push({ i: i, d: d, e: e, from: e.values[state.idx[e.id]], to: e.values[ni], dRun: dRun, dSbd: dSbd, tension: fresh, score: score });
      });
    });
    return out.filter(function (o) { return o.score > 3; }).sort(function (x, y) { return y.score - x.score; }).slice(0, 2);
  }
  function renderComposer() {
    var a = M.analyse(state.idx), editable = state.stage === 'compose';
    $('verdict').textContent = a.verdict; $('verdict').className = 'verdict ' + (a.guard ? 'bad' : a.tension ? 'warn' : 'ok');
    $('gauges').innerHTML = a.gauges.map(function (g) {
      return '<div class="gauge"><div class="gauge-top"><span>' + g.label + '</span><span class="t-' + g.tone + '">' + g.word + '</span></div><div class="track"><div class="fill t-bg-' + g.tone + '" style="width:' + g.pct + '%"></div></div></div>';
    }).join('');
    var best = bestLevers();
    $('best').innerHTML = best.length ? best.map(function (o) {
      return '<li><div class="best-body"><b>' + o.e.name + ' : ' + o.e.fmt(o.from) + ' → ' + o.e.fmt(o.to) + '</b><span class="eff">10 km ' + signed(o.dRun, ' s') + ' · SBD ' + signed(o.dSbd, ' kg') + '</span>' +
        (o.tension ? '<span class="cost">en échange : ' + o.tension.title.charAt(0).toLowerCase() + o.tension.title.slice(1) + '</span>' : '') + '</div>' +
        '<button type="button" class="act" data-try="' + o.i + '" data-d="' + o.d + '"' + (editable ? '' : ' disabled') + '>Essayer</button></li>';
    }).join('') : '<li><div class="best-body"><b>Rien de plus rentable à un cran près</b><span>Ta formule est déjà bien placée pour ton objectif.</span></div></li>';

    var groups = ['muscu', 'course', 'nutrition', 'socle'], baseV = M.values(state.base);
    $('levers').innerHTML = groups.map(function (p) {
      var rows = E.map(function (e, i) { return [e, i]; }).filter(function (x) { return x[0].pillar === p; });
      return '<li class="group p-' + p + '"><div class="group-h">' + icon(p, 16) + '<span>' + PILLAR_NAME[p] + '</span></div><ul>' + rows.map(function (x) {
        var e = x[0], i = x[1], di = state.idx[e.id], sel = i === state.selected, changed = e.values[di] !== baseV[e.id];
        return '<li class="lever' + (sel ? ' sel' : '') + '">' +
          '<button class="lever-pick" type="button" data-pick="' + i + '" aria-pressed="' + sel + '">' + e.name + (changed ? '<small>avant : ' + e.fmt(baseV[e.id]) + '</small>' : '') + '</button>' +
          '<div class="dose"><button type="button" class="step" data-step="' + i + '" data-d="-1" aria-label="Diminuer ' + e.name + '"' + (!editable || di === 0 ? ' disabled' : '') + '>−</button>' +
          '<output>' + e.fmt(e.values[di]) + '</output>' +
          '<button type="button" class="step" data-step="' + i + '" data-d="1" aria-label="Augmenter ' + e.name + '"' + (!editable || di === e.values.length - 1 ? ' disabled' : '') + '>+</button></div></li>';
      }).join('') + '</ul></li>';
    }).join('');
    $('resetFormula').hidden = !formulaDiff().length || !editable;
    $('reacCount').textContent = a.reactions.length ? a.reactions.length + (a.reactions.length > 1 ? ' actifs' : ' actif') : 'aucun';
    $('reactions').innerHTML = a.reactions.length ? a.reactions.map(function (r) {
      return '<li class="reac k-' + r.kind + '">' + lens(r.pair) + '<div class="reac-body"><div class="reac-top"><b>' + r.title + '</b><span class="reac-kind">' + { syn: 'synergie', tension: 'tension', guard: 'garde-fou' }[r.kind] + '</span></div>' +
        '<span class="reac-text">' + r.text + '</span><code>' + r.src + '</code></div></li>';
    }).join('') : '<li class="reac empty">Aucun croisement : tes piliers ne se touchent pas encore.</li>';
  }

  /* ---------- onglet Pourquoi ---------- */
  var enq = function () { return D.enquetes.filter(function (q) { return q.id === state.enquete; })[0]; };
  function spark(q) {
    var s = q.serie, lo = Math.min.apply(null, s), hi = Math.max.apply(null, s), pad = (hi - lo) * 0.15 || 1; lo -= pad; hi += pad;
    var fmt = q.unite === 's' ? M.mmss : function (v) { return dec(Math.round(v * 10) / 10) + ' ' + q.unite; };
    var W = 320, H = 104, L = 12 + Math.max(fmt(hi - pad).length, fmt(lo + pad).length) * 6.2, Rr = 10, T = 12, B = 22;
    var x = function (i) { return L + (i / (s.length - 1)) * (W - L - Rr); };
    var y = function (v) { return H - B - ((v - lo) / (hi - lo)) * (H - T - B); };
    var line = s.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1); }).join(' ');
    var area = line + ' L' + x(s.length - 1).toFixed(1) + ',' + (H - B) + ' L' + x(0).toFixed(1) + ',' + (H - B) + ' Z';
    var flat = s.slice(q.plat).map(function (v, k) { var i = q.plat + k; return (k ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1); }).join(' ');
    var top = hi - pad, bot = lo + pad;
    return '<div class="spark"><div class="spark-top"><b>' + fmt(s[s.length - 1]) + '</b><span>' + q.detecte + ' · <span class="code">' + q.code + '</span></span></div>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + q.question + ' : 8 dernières semaines">' +
      '<line class="grid" x1="' + L + '" y1="' + y(top).toFixed(1) + '" x2="' + (W - Rr) + '" y2="' + y(top).toFixed(1) + '"/><line class="grid" x1="' + L + '" y1="' + y(bot).toFixed(1) + '" x2="' + (W - Rr) + '" y2="' + y(bot).toFixed(1) + '"/>' +
      '<text class="tick" x="' + (L - 6) + '" y="' + (y(top) + 3).toFixed(1) + '" text-anchor="end">' + fmt(top) + '</text><text class="tick" x="' + (L - 6) + '" y="' + (y(bot) + 3).toFixed(1) + '" text-anchor="end">' + fmt(bot) + '</text>' +
      '<path class="area" d="' + area + '"/><path class="ln" d="' + line + '"/><path class="flat" d="' + flat + '"/>' +
      '<circle class="pt" cx="' + x(s.length - 1).toFixed(1) + '" cy="' + y(s[s.length - 1]).toFixed(1) + '" r="4.5"/>' +
      '<text class="tick" x="' + L + '" y="' + (H - 6) + '">il y a 7 sem.</text><text class="tick" x="' + (W - Rr) + '" y="' + (H - 6) + '" text-anchor="end">cette semaine</text></svg></div>';
  }
  function renderWhy() {
    $('questions').innerHTML = D.enquetes.map(function (q) {
      return '<button type="button" class="q" data-enq="' + q.id + '" aria-pressed="' + (q.id === state.enquete) + '"><b>' + q.question + '</b><span>' + q.detecte + '</span></button>';
    }).join('');
    var q = enq(), t = q.test, launched = t.enCours || state.tests[t.id];
    var sus = q.suspects.map(function (s) {
      return '<li class="sus">' + lens(s.paire) + '<div class="sus-body"><b>' + s.titre + '</b><span>' + s.preuve + ' · <span class="code">' + s.code + '</span></span></div>' +
        '<div class="force"><div class="bar"><i style="width:' + Math.round(s.force * 100) + '%"></i></div><em>' + s.niveau + '</em></div>' +
        (s.lien ? '<button type="button" class="link" data-goprop="' + s.lien + '">' + (propOn(s.lien) ? 'Déjà réglé dans ta semaine' : 'Le régler dans ta semaine →') + '</button>' : '') + '</li>';
    }).join('');
    $('enquete').innerHTML = spark(q) +
      '<div><div class="sec-h"><h2>Ce qui pèse, dans tes données</h2><span>du plus au moins probable</span></div><ol class="suspects">' + sus + '</ol></div>' +
      '<p class="cleared"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg><span>Écarté : ' + q.ecarte + '</span></p>' +
      '<div class="test"><span class="eyebrow">' + (t.rappel ? 'Pour trancher, sans risque' : 'Pour trancher') + '</span><b>' + t.titre + '</b><p>' + t.texte + '</p>' +
      (launched ? '<span class="state">' + CHECK + (t.enCours ? 'En cours · ' : t.rappel ? 'Rappel activé · ' : 'Lancée · ') + t.verdict + '</span>'
        : '<button type="button" class="act" data-test="' + t.id + '">' + (t.rappel ? 'Activer le rappel du week-end' : 'Lancer l’expérience · ' + t.verdict) + '</button>') + '</div>' +
      '<p class="honest">Des associations trouvées dans tes données, pas des preuves. L’expérience tranche.</p>';
  }

  /* ---------- onglet Acquis ---------- */
  function renderKnown() {
    var A = D.acquis, calibrated = A.cartes.filter(function (c) { return c.statut !== 'rien'; }).length;
    $('stats').innerHTML = [[A.semaines, 'semaines de données croisées'], [A.cartes.length, 'choses apprises sur toi'], [calibrated, 'réglages calés sur tes chiffres']].map(function (s) {
      return '<div class="stat"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>';
    }).join('');
    var runs = A.encours.slice();
    if (state.tests.jambes48) runs.unshift({ titre: 'Jambes 48 h avant le fractionné', jour: 0, sur: 21, suivi: 'démarre demain, mercredi 16/09', verdict: 'verdict scellé le 06/10' });
    $('running').innerHTML = runs.map(function (r) {
      return '<li class="run"><div class="run-top"><b>' + r.titre + '</b><span>J' + r.jour + ' / ' + r.sur + '</span></div><div class="bar"><i style="width:' + Math.max(3, Math.round((r.jour / r.sur) * 100)) + '%"></i></div><p>' + r.suivi + ' · ' + r.verdict + '</p></li>';
    }).join('');
    var LABEL = { verifie: 'vérifié par expérience', solide: 'lien solide', probable: 'probable', rien: 'pas de lien' };
    $('known').innerHTML = A.cartes.map(function (c) {
      return '<li class="kn">' + lens(c.paire) + '<div class="kn-body"><span class="kn-status s-' + c.statut + '">' + LABEL[c.statut] + '</span><b>' + c.titre + '</b><span>' + c.preuve + '</span><p class="kn-use" style="margin:0"><em>Sert à : </em>' + c.sert + '</p></div></li>';
    }).join('');
  }

  /* ---------- la scène suit l'onglet ---------- */
  function sceneCrossings() {
    var now = Date.now(), list = [];
    if (state.tab === 'composer') return M.analyse(state.idx).reactions.map(function (r) { return { kind: r.kind, pair: r.pair }; });
    if (state.tab === 'semaine') {
      D.propositions.forEach(function (p) {
        if (!state.props[p.id]) list.push({ kind: 'tension', pair: p.paire });
        else if (state.flash[p.id] > now) list.push({ kind: 'syn', pair: p.paire });
      });
    } else if (state.tab === 'pourquoi') {
      enq().suspects.slice(0, 2).forEach(function (s) { list.push({ kind: 'tension', pair: s.paire }); });
    } else {
      D.acquis.cartes.forEach(function (c) { if (c.statut !== 'rien') list.push({ kind: 'syn', pair: c.paire }); });
    }
    return list;
  }
  function syncScene() {
    draw2D();
    if (!scene.ok) return;
    var composing = state.tab === 'composer', a = M.analyse(state.idx);
    scene.setValues(Object.assign({}, M.values(composing ? state.idx : state.base), { fuel: a.gauges[2].pct }));
    scene.setMode(composing ? 'formula' : 'week');
    if (!composing) scene.setReality(realForScene());
    scene.setCrossings(sceneCrossings());
    scene.select(composing ? E[state.selected].pillar : null);
    scene.focus(state.focus || (state.tab === 'pourquoi' ? enq().focus : null));
  }
  var MODE = { semaine: 'Ta semaine, en vrai', composer: 'Ta formule, en projet', pourquoi: 'L’enquête', acquis: 'Ce que tu sais de toi' };
  function renderStageLabels() {
    $('stageMode').querySelector('span').textContent = state.tab === 'pourquoi' ? MODE.pourquoi + ' : ' + enq().question.charAt(0).toLowerCase() + enq().question.slice(1) : MODE[state.tab];
    $('stageNote').textContent = state.focus ? 'Touche le vide pour revenir à l’ensemble' : 'Glisse pour tourner autour · touche un disque pour t’en approcher';
  }
  function pillarSummary(p) {
    var R = D.semaine.reel, plan = weekPlan();
    return {
      muscu: R.seancesFaites + ' séance sur ' + R.seances + ' · prochaine : ' + nextSession(plan.muscu),
      course: dec(R.kmFaits) + ' km sur ' + R.km + ' · prochaine : ' + nextSession(plan.course),
      nutrition: 'Protéines ' + dec(R.proteines) + ' g/kg (cible 1,8) · ' + MINUS + Math.abs(R.kcal) + ' kcal/j (cible ' + MINUS + Math.abs(R.cibleKcal) + ')',
      socle: 'Lundi 7 h 40 · mardi 6 h 10 · 5 nuits sur 7 au-dessus de 7 h la semaine dernière',
    }[p];
  }
  function onPick(p) {
    if (!p || (state.focus && state.focus.length === 1 && state.focus[0] === p)) { state.focus = null; syncScene(); renderStageLabels(); return; }
    state.focus = [p]; SFX.click();
    if (state.tab === 'composer' && p !== 'socle') pickPillar(p);
    else toast('ok', PILLAR_NAME[p], pillarSummary(p));
    syncScene(); renderStageLabels();
  }

  /* ---------- rendu général ---------- */
  function render(announce) {
    var a = M.analyse(state.idx), diff = formulaDiff();
    $('formulaName').textContent = NAME + ' · v' + state.version;
    $('pill').textContent = state.tab === 'composer'
      ? { compose: diff.length ? 'Brouillon de la v' + (state.version + 1) : 'Ta formule appliquée', incubating: 'Simulation en cours', incubated: 'Simulation terminée', distilling: 'Bilan en cours', distilled: 'Bilan simulé' }[state.stage]
      : 'Mardi 15/09 · semaine ' + D.semaine.cycle.semaine + ' sur ' + D.semaine.cycle.sur;
    renderGoals();
    var open = openProps().length;
    $('t-semaine').innerHTML = 'Semaine' + (open ? '<span class="badge" aria-label="' + open + ' à régler">' + open + '</span>' : '');
    ['semaine', 'composer', 'pourquoi', 'acquis'].forEach(function (t) {
      var on = t === state.tab; $('t-' + t).setAttribute('aria-selected', on); $('t-' + t).tabIndex = on ? 0 : -1; $('p-' + t).hidden = !on;
    });
    if (state.tab === 'semaine') renderWeek();
    else if (state.tab === 'composer') renderComposer();
    else if (state.tab === 'pourquoi') renderWhy();
    else renderKnown();

    var pb = $('primary'), sb = $('secondary'), act = $('actions');
    pb.disabled = false; sb.hidden = true; act.hidden = false; pb.hidden = false;
    if (state.tab === 'semaine') {
      var n = staged().length;
      if (n) pb.textContent = 'Appliquer ' + (n > 1 ? n + ' changements' : 'ce changement') + ' à mon plan'; else act.hidden = true;
    } else if (state.tab === 'composer') {
      if (state.stage === 'compose') {
        if (a.guard) { pb.textContent = 'Corrige le garde-fou pour appliquer'; pb.disabled = true; }
        else if (diff.length) { pb.textContent = 'Appliquer la v' + (state.version + 1) + ' à mon plan'; sb.hidden = false; sb.textContent = 'Simuler les 8 semaines d’abord'; }
        else pb.textContent = 'Simuler les 8 semaines';
      } else if (state.stage === 'incubating') { pb.textContent = 'Semaine ' + state.week + ' sur 8…'; pb.disabled = true; }
      else if (state.stage === 'incubated') { pb.textContent = 'Faire le bilan'; sb.hidden = false; sb.textContent = 'Retour à Composer'; }
      else if (state.stage === 'distilling') { pb.textContent = 'Bilan en cours…'; pb.disabled = true; }
      else { pb.textContent = 'Préparer la v' + (state.version + 1) + ' depuis ce bilan'; sb.hidden = false; sb.textContent = 'Garder la v' + state.version; }
    } else act.hidden = true;

    renderStageLabels();
    if (announce && state.tab === 'composer') announceChanges(a);
    state.lastKeys = a.reactions.map(function (r) { return r.key; });
  }
  function announceChanges(a) {
    var prev = state.lastKeys || [];
    var fresh = a.reactions.filter(function (r) { return prev.indexOf(r.key) < 0; });
    if (!fresh.length) return;
    var r = fresh[0];
    toast(r.kind, r.title, r.text);
    setTimeout(function () { SFX[r.kind](); }, reduced ? 0 : 250);
    buzz(r.kind === 'guard' ? 90 : r.kind === 'tension' ? [30, 40, 30] : 15);
    say((r.kind === 'syn' ? 'Synergie. ' : r.kind === 'tension' ? 'Tes piliers se gênent. ' : 'Garde-fou. ') + r.text.replace(/·/g, ','));
  }

  /* ---------- actions ---------- */
  function setTab(t, focusTab) {
    if (t === state.tab) return;
    state.tab = t; state.focus = null;
    syncScene(); render(false);
    if (focusTab) $('t-' + t).focus();
  }
  function select(i, fromScene) {
    state.selected = i; if (scene.ok) scene.select(E[i].pillar); render(false);
    if (fromScene) { var el = document.querySelector('[data-pick="' + i + '"]'); if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }); } }
  }
  function pickPillar(p) { for (var i = 0; i < E.length; i++) if (E[i].pillar === p) return select(i, true); }
  function step(i, d) {
    if (state.stage !== 'compose') return;
    var e = E[i], ni = state.idx[e.id] + d; if (ni < 0 || ni >= e.values.length) return;
    state.idx[e.id] = ni; state.selected = i;
    buzz(10); SFX.dose(d > 0);
    if (scene.ok && d > 0) scene.pulse(e.pillar);
    syncScene(); render(true);
  }
  function stageProp(id) {
    var p = findProp(id); if (!p) return;
    state.props[id] = 'staged'; state.flash[id] = Date.now() + 1500;
    setTimeout(syncScene, 1600);
    SFX.syn(); buzz(15);
    if (scene.ok) scene.pulse(p.change.p === 'socle' ? 'course' : p.change.p);
    toast('ok', 'Prêt à appliquer', p.fait);
    syncScene(); render(false);
  }
  function unstage(id) { delete state.props[id]; SFX.click(); syncScene(); render(false); }

  var sheetMode = null, lastFocus = null;
  function openSheet(mode) {
    sheetMode = mode; lastFocus = document.activeElement;
    var items = mode === 'week' ? staged().map(function (p) { return p.change; }) : formulaDiff();
    $('sheetTitle').textContent = mode === 'week' ? 'Ce qui change dans ta semaine' : 'Ce qui change avec la v' + (state.version + 1);
    $('sheetSub').textContent = mode === 'week' ? 'Semaine du 14/09 · ' + items.length + ' changement' + (items.length > 1 ? 's' : '') + ', dès maintenant' : NAME + ' v' + (state.version + 1) + ' · à partir du lundi 21/09';
    $('sheetList').innerHTML = items.map(function (c) {
      return '<li><span class="diff-ico p-' + c.p + '">' + icon(c.p, 18) + '</span><div><b>' + c.titre + '</b><span>' + c.detail + '</span><small>Visible dans : ' + c.ou + '</small></div></li>';
    }).join('');
    $('sheetOk').textContent = mode === 'week' ? 'Appliquer à mon plan' : 'Appliquer la v' + (state.version + 1);
    $('sheet').hidden = false; $('sheetBack').hidden = false; $('sheetOk').focus();
  }
  function closeSheet() { $('sheet').hidden = true; $('sheetBack').hidden = true; sheetMode = null; if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); }
  function confirmSheet() {
    if (sheetMode === 'week') {
      staged().forEach(function (p) { state.props[p.id] = 'applied'; });
      toast('ok', 'C’est dans ton plan', 'Accueil, Musculation, Course et Nutrition suivent déjà.');
      say('C’est appliqué. Ton plan de la semaine est à jour.');
    } else if (sheetMode === 'formula') {
      state.base = copy(state.idx); state.version += 1;
      toast('ok', NAME + ' v' + state.version + ' appliquée', 'Elle démarre lundi 21/09. La v' + (state.version - 1) + ' reste dans ton historique.');
      say('Version ' + state.version + ' appliquée à ton plan.');
    }
    SFX.apply(); buzz([20, 40, 20]); closeSheet(); syncScene(); render(false);
  }

  function launchCycle() {
    state.stage = 'incubating'; state.week = 0; $('projection').hidden = false; $('essence').hidden = true;
    if (scene.ok) scene.setStage('incubating');
    render(false); drawChart(); say('Simulation lancée. Huit semaines en accéléré.');
    var tick = function () {
      state.week += 1; if (scene.ok) scene.setWeek(state.week / 8); SFX.tick(); drawChart(); render(false);
      if (state.week < 8) setTimeout(tick, reduced ? 0 : 850);
      else { state.stage = 'incubated'; if (scene.ok) scene.setStage('incubated'); render(false); var last = M.project(state.idx)[8]; say('Huit semaines plus tard. Dix kilomètres projetés en ' + M.mmss(last.run.mid).replace(':', ' minutes ') + '.'); }
    };
    setTimeout(tick, reduced ? 0 : 700);
  }
  function makeBilan() {
    state.stage = 'distilling'; render(false); if (scene.ok) scene.setStage('distilling'); SFX.bilan(); say('Bilan de la simulation.');
    var start = Date.now(), dur = reduced ? 1 : 3200;
    var run = function () { var p = Math.min(1, (Date.now() - start) / dur); if (scene.ok) scene.setBilan(p); if (p < 1) setTimeout(run, 40); else finishBilan(); };
    run();
  }
  function finishBilan() {
    var d = M.distill(state.idx); state.essence = d; state.stage = 'distilled';
    if (scene.ok) scene.setStage('distilled');
    $('essResults').innerHTML = d.results.map(function (r) { return '<li><span>' + r.label + '<small>' + r.note + '</small></span><b>' + r.value + '</b></li>'; }).join('');
    $('essCarried').textContent = d.carried; $('essCost').textContent = d.cost;
    $('essChanges').innerHTML = d.changes.map(function (c) { return '<li>' + c + '</li>'; }).join('');
    $('essence').hidden = false; render(false); SFX.syn();
    say('Voici ce que ce cycle t’apprendrait. Ce qui porte : ' + d.carried.replace(/×/g, 'et') + '.');
  }
  function composeNext() {
    var next = state.essence ? state.essence.next : state.idx;
    var grown = E.filter(function (e) { return next[e.id] > state.idx[e.id]; });
    state.idx = copy(next); backToCompose();
    grown.forEach(function (e, n) { setTimeout(function () { if (scene.ok) scene.pulse(e.pillar); SFX.dose(true); }, n * 500); });
  }
  function backToCompose() {
    state.stage = 'compose'; state.week = 0; $('projection').hidden = true; $('essence').hidden = true;
    if (scene.ok) { scene.setStage('compose'); scene.setBilan(0); }
    syncScene(); render(true);
  }

  /* ---------- simulation (graphique) ---------- */
  var METRICS = {
    run: { label: '10 km', key: 'run', fmt: M.mmss, invert: true, goal: 2880, goalLabel: 'objectif 48:00' },
    sbd: { label: 'Total SBD', key: 'sbd', fmt: function (v) { return Math.round(v) + ' kg'; } },
    kg: { label: 'Poids', key: 'kg', fmt: function (v) { return M.num(v, 1) + ' kg'; } },
  };
  function drawChart() {
    var m = METRICS[state.metric], pts = M.project(state.idx), W = 320, H = 150, L = 46, Rr = 10, T = 14, B = 26;
    var vals = []; pts.forEach(function (p) { vals.push(p[m.key].lo, p[m.key].hi); }); if (m.goal) vals.push(m.goal);
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
    var x = function (w) { return L + (w / 8) * (W - L - Rr); };
    var y = function (v) { var t = (v - lo) / (hi - lo); return m.invert ? T + t * (H - T - B) : H - B - t * (H - T - B); };
    var shown = pts.slice(0, state.week + 1);
    var band = shown.map(function (p) { return x(p.w) + ',' + y(p[m.key].hi); }).concat(shown.slice().reverse().map(function (p) { return x(p.w) + ',' + y(p[m.key].lo); })).join(' ');
    var line = shown.map(function (p, i) { return (i ? 'L' : 'M') + x(p.w).toFixed(1) + ',' + y(p[m.key].mid).toFixed(1); }).join(' ');
    var ghost = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(p.w).toFixed(1) + ',' + y(p[m.key].mid).toFixed(1); }).join(' ');
    var cur = shown[shown.length - 1];
    $('projChart').innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Simulation ' + m.label + ' sur 8 semaines">' +
      '<line x1="' + L + '" y1="' + (H - B) + '" x2="' + (W - Rr) + '" y2="' + (H - B) + '" class="axis"/>' +
      '<text x="' + (L - 6) + '" y="' + (y(hi - pad) + 4) + '" class="tick" text-anchor="end">' + m.fmt(m.invert ? lo + pad : hi - pad) + '</text>' +
      '<text x="' + (L - 6) + '" y="' + (y(lo + pad) + 4) + '" class="tick" text-anchor="end">' + m.fmt(m.invert ? hi - pad : lo + pad) + '</text>' +
      [0, 4, 8].map(function (w) { return '<text x="' + x(w) + '" y="' + (H - 8) + '" class="tick" text-anchor="middle">S' + w + '</text>'; }).join('') +
      (m.goal ? '<line x1="' + L + '" y1="' + y(m.goal) + '" x2="' + (W - Rr) + '" y2="' + y(m.goal) + '" class="goal-line"/><text x="' + (W - Rr) + '" y="' + (y(m.goal) - 5) + '" class="tick goal-t" text-anchor="end">' + m.goalLabel + '</text>' : '') +
      '<path d="' + ghost + '" class="ghost"/>' + (shown.length > 1 ? '<polygon points="' + band + '" class="band"/>' : '') +
      '<path d="' + line + '" class="mid"/><circle cx="' + x(cur.w) + '" cy="' + y(cur[m.key].mid) + '" r="4.5" class="dot"/></svg>';
    $('projValue').textContent = m.fmt(cur[m.key].mid);
    $('projRange').textContent = cur.w ? 'fourchette ' + m.fmt(cur[m.key].lo) + ' – ' + m.fmt(cur[m.key].hi) : 'point de départ';
    $('projWeek').textContent = 'Semaine ' + cur.w + ' sur 8';
    Array.prototype.forEach.call(document.querySelectorAll('[data-metric]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-metric') === state.metric); });
  }

  /* ---------- branchements ---------- */
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('button'); if (!t) return;
    audio();
    var g = function (k) { return t.getAttribute(k); };
    if (t.hasAttribute('data-tab')) setTab(g('data-tab'));
    else if (t.hasAttribute('data-pick')) select(+g('data-pick'), false);
    else if (t.hasAttribute('data-step')) step(+g('data-step'), +g('data-d'));
    else if (t.hasAttribute('data-try')) step(+g('data-try'), +g('data-d'));
    else if (t.hasAttribute('data-metric')) { state.metric = g('data-metric'); drawChart(); }
    else if (t.hasAttribute('data-stage')) stageProp(g('data-stage'));
    else if (t.hasAttribute('data-unstage') || t.hasAttribute('data-undo')) {
      var id = g('data-unstage') || g('data-undo'); if (t.hasAttribute('data-undo')) toast('warn', 'Annulé', findProp(id).titre + ' : ton plan revient comme avant.');
      unstage(id);
    }
    else if (t.hasAttribute('data-enq')) { state.enquete = g('data-enq'); state.focus = null; SFX.click(); syncScene(); render(false); }
    else if (t.hasAttribute('data-goprop')) {
      var pid = g('data-goprop'); setTab('semaine');
      var card = $('prop-' + pid); if (card) { card.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' }); var btn = card.querySelector('button'); if (btn) btn.focus({ preventScroll: true }); }
    }
    else if (t.hasAttribute('data-test')) {
      var tid = g('data-test'); state.tests[tid] = true; SFX.syn(); buzz(15);
      var q = enq(); toast('ok', q.test.rappel ? 'Rappel activé' : 'Expérience lancée', q.test.titre + ' · ' + q.test.verdict);
      say(q.test.rappel ? 'Rappel activé pour le week-end.' : 'Expérience lancée. Le verdict restera scellé jusqu’au bout.');
      render(false);
    }
  });
  $('primary').addEventListener('click', function () {
    if (state.tab === 'semaine') { if (staged().length) openSheet('week'); return; }
    if (state.tab !== 'composer') return;
    if (state.stage === 'compose') { if (formulaDiff().length) openSheet('formula'); else launchCycle(); }
    else if (state.stage === 'incubated') makeBilan();
    else if (state.stage === 'distilled') composeNext();
  });
  $('secondary').addEventListener('click', function () {
    if (state.tab !== 'composer') return;
    if (state.stage === 'compose') launchCycle(); else backToCompose();
  });
  $('resetFormula').addEventListener('click', function () { state.idx = copy(state.base); SFX.click(); syncScene(); render(false); });
  $('sheetOk').addEventListener('click', confirmSheet);
  $('sheetCancel').addEventListener('click', closeSheet);
  $('sheetBack').addEventListener('click', closeSheet);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('sheet').hidden) { closeSheet(); return; }
    var tab = e.target.closest && e.target.closest('[role="tab"]'); if (!tab) return;
    var order = ['semaine', 'composer', 'pourquoi', 'acquis'], i = order.indexOf(tab.getAttribute('data-tab'));
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setTab(order[(i + (e.key === 'ArrowRight' ? 1 : 3)) % 4], true); }
  });
  $('btnSound').addEventListener('click', function () { state.sound = !state.sound; this.setAttribute('aria-pressed', state.sound); this.querySelector('span').textContent = state.sound ? 'Son' : 'Muet'; });
  $('btnVoice').addEventListener('click', function () { state.voice = !state.voice; this.setAttribute('aria-pressed', state.voice); if (!state.voice && window.speechSynthesis) window.speechSynthesis.cancel(); });
  $('btnView').addEventListener('click', function () { state.fiche = !state.fiche; document.body.classList.toggle('fiche', state.fiche); this.setAttribute('aria-pressed', state.fiche); this.querySelector('span').textContent = state.fiche ? 'Vue 3D' : 'Vue sobre'; });
  $('fbRetry').addEventListener('click', boot3D);

  render(false); boot3D();
})();
