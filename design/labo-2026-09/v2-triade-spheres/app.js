/* Le Labo — interface du prototype (v2) : leviers, croisements, cycle, bilan, son, voix. */
(function () {
  'use strict';
  var M = window.LaboMoteur, E = M.ELEMENTS;
  var $ = function (id) { return document.getElementById(id); };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var state = { idx: M.defaults(), stage: 'compose', version: 2, selected: 0, week: 0, metric: 'run', sound: true, voice: true, fiche: false, lastKeys: null, touched: false, essence: null };
  var NAMES = { 2: 'Hybride d’automne', 3: 'Hybride d’automne', 4: 'Affûtage 10 km', 5: 'Affûtage 10 km' };
  var PILLAR_NAME = { muscu: 'Musculation', course: 'Course', nutrition: 'Nutrition', socle: 'Sommeil & ressenti' };
  var ICON = {
    muscu: '<line x1="6" y1="12" x2="18" y2="12"></line><rect x="3" y="8" width="3" height="8" rx="1"></rect><rect x="18" y="8" width="3" height="8" rx="1"></rect>',
    course: '<path d="M3 17c3 0 3-4 6-4s3 4 6 4 3-7 6-7"></path>',
    nutrition: '<path d="M12 21c-5 0-8-4-8-9 0-4 3-6 5-6 1.5 0 2.3.7 3 .7s1.5-.7 3-.7c2 0 5 2 5 6 0 5-3 9-8 9z"></path><path d="M12 7c0-2 1-4 3-4"></path>',
    socle: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"></path>',
  };
  var icon = function (p, size) { return '<svg width="' + (size || 18) + '" height="' + (size || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[p] + '</svg>'; };
  var lens = function (pair) {
    var cls = pair.length === 3 ? ['muscu', 'course'] : pair;
    return '<svg class="lens" width="26" height="22" viewBox="0 0 26 22" aria-hidden="true"><circle class="p-' + cls[0] + '" cx="9" cy="11" r="7.5"></circle><circle class="p-' + cls[1] + '" cx="17" cy="11" r="7.5"></circle></svg>';
  };

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

  /* ---------- le repli 2D : la même triade, en SVG ---------- */
  var GLOW = { muscu: '#e07a98', course: '#6fa8ef', nutrition: '#a9ba7e', socle: '#e0b155' };
  var TONE2D = { syn: ['#f2d28a', '#f2d28a', '#1c150e'], tension: ['#1c150e', '#e0b155', '#e0b155'], guard: ['#f08a7e', '#f08a7e', '#1c150e'] };
  var C2D = { muscu: [133, 100], course: [217, 100], nutrition: [175, 166] };
  var Z2D = { 'course|muscu': [175, 80], 'muscu|nutrition': [140, 150], 'course|nutrition': [210, 150], tri: [175, 122], 'muscu|socle': [92, 50], 'course|socle': [258, 50], 'nutrition|socle': [175, 232] };
  function draw2D() {
    if (!document.body.classList.contains('no3d')) return;
    var pl = pillars(), a = M.analyse(state.idx), svg = '<defs>';
    ['muscu', 'course', 'nutrition'].forEach(function (p) { svg += '<radialGradient id="g2-' + p + '"><stop offset="0" stop-color="' + GLOW[p] + '" stop-opacity=".55"/><stop offset=".72" stop-color="' + GLOW[p] + '" stop-opacity=".2"/><stop offset="1" stop-color="' + GLOW[p] + '" stop-opacity=".08"/></radialGradient>'; });
    svg += '</defs><circle class="ring2" cx="175" cy="125" r="122" fill="none" stroke="#e0b155" stroke-width="' + (1 + pl.socle.amount * 1.4).toFixed(1) + '" stroke-dasharray="2 6"/>';
    ['muscu', 'course', 'nutrition'].forEach(function (p) {
      var c = C2D[p], v = pl[p], r = (v.active ? 44 + v.amount * 40 : 56).toFixed(1);
      svg += v.active
        ? '<circle class="f2 f2-' + p + '" cx="' + c[0] + '" cy="' + c[1] + '" r="' + r + '" fill="url(#g2-' + p + ')" stroke="' + GLOW[p] + '" stroke-width="1.5" style="mix-blend-mode: screen"/>'
        : '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="1.3" stroke-dasharray="4 5"/>';
    });
    var zones = {};
    a.reactions.forEach(function (r) {
      var key = r.pair.length === 3 ? 'tri' : r.pair.slice().sort().join('|');
      var z = zones[key] || (zones[key] = { n: 0, kind: r.kind });
      z.n += 1; if (r.kind === 'guard' || (r.kind === 'tension' && z.kind === 'syn')) z.kind = r.kind;
    });
    Object.keys(zones).forEach(function (key) {
      var p = Z2D[key]; if (!p) return; var t = TONE2D[zones[key].kind];
      svg += '<g class="mk2"><circle cx="' + p[0] + '" cy="' + p[1] + '" r="11.5" fill="' + t[0] + '" stroke="' + t[1] + '" stroke-width="2"/><text x="' + p[0] + '" y="' + (p[1] + 4) + '" font-family="Space Mono, monospace" font-size="11" font-weight="700" fill="' + t[2] + '" text-anchor="middle">' + zones[key].n + '</text></g>';
    });
    $('tri2d').innerHTML = svg;
  }
  function boot3D() {
    var old = $('scene'), fresh = old.cloneNode(false); old.parentNode.replaceChild(fresh, old);
    loadThree(function () {
      if (!window.LaboScene) return fail('scene');
      var res;
      try { res = window.LaboScene.create(fresh, { reducedMotion: reduced, onPick: pickPillar, onLost: function () { fail('lost'); } }); }
      catch (err) { return fail('renderer', err && err.message); }
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
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.className = 'toast k-' + kind; }, 3600);
  }

  /* ---------- données vers la scène ---------- */
  function norm(e) { return state.idx[e.id] / (e.values.length - 1); }
  function byId(id) { return E.filter(function (e) { return e.id === id; })[0]; }
  function pillars() {
    var v = M.values(state.idx);
    return {
      muscu: { active: v.fq > 0, amount: norm(byId('fq')) },
      course: { active: v.km > 0, amount: norm(byId('km')) * 0.7 + norm(byId('fr')) * 0.3 },
      nutrition: { active: true, amount: norm(byId('pr')) * 0.4 + norm(byId('kc')) * 0.3 + norm(byId('gl')) * 0.3 },
      socle: { active: true, amount: norm(byId('so')) },
    };
  }
  function syncScene() {
    if (!scene.ok) return;
    var a = M.analyse(state.idx);
    scene.setPillars(pillars());
    scene.setCrossings(a.reactions.map(function (r) { return { kind: r.kind, pair: r.pair }; }));
    scene.select(E[state.selected].pillar);
  }

  /* ---------- rendu du panneau ---------- */
  function render(announce) {
    var a = M.analyse(state.idx), editable = state.stage === 'compose';
    $('formulaName').textContent = (NAMES[state.version] || 'Formule') + ' · v' + state.version;
    $('stagePill').textContent = { compose: state.touched || state.version > 2 ? 'Brouillon' : 'Ta formule', incubating: 'Cycle en cours', incubated: 'Cycle terminé', distilling: 'Bilan en cours', distilled: 'Bilan' }[state.stage];
    $('verdict').textContent = a.verdict; $('verdict').className = 'verdict ' + (a.guard ? 'bad' : a.tension ? 'warn' : 'ok');

    $('gauges').innerHTML = a.gauges.map(function (g) {
      return '<div class="gauge"><div class="gauge-top"><span>' + g.label + '</span><span class="t-' + g.tone + '">' + g.word + '</span></div>' +
        '<div class="track"><div class="fill t-bg-' + g.tone + '" style="width:' + g.pct + '%"></div></div></div>';
    }).join('');

    var groups = ['muscu', 'course', 'nutrition', 'socle'];
    $('levers').innerHTML = groups.map(function (p) {
      var rows = E.map(function (e, i) { return [e, i]; }).filter(function (x) { return x[0].pillar === p; });
      return '<li class="group p-' + p + '"><div class="group-h">' + icon(p, 16) + '<span>' + PILLAR_NAME[p] + '</span></div><ul>' + rows.map(function (x) {
        var e = x[0], i = x[1], di = state.idx[e.id], sel = i === state.selected;
        return '<li class="lever' + (sel ? ' sel' : '') + '">' +
          '<button class="lever-pick" type="button" data-pick="' + i + '" aria-pressed="' + sel + '">' + e.name + '</button>' +
          '<div class="dose"><button type="button" class="step" data-step="' + i + '" data-d="-1" aria-label="Diminuer ' + e.name + '"' + (!editable || di === 0 ? ' disabled' : '') + '>−</button>' +
          '<output>' + e.fmt(e.values[di]) + '</output>' +
          '<button type="button" class="step" data-step="' + i + '" data-d="1" aria-label="Augmenter ' + e.name + '"' + (!editable || di === e.values.length - 1 ? ' disabled' : '') + '>+</button></div></li>';
      }).join('') + '</ul></li>';
    }).join('');

    $('reacCount').textContent = a.reactions.length ? a.reactions.length + (a.reactions.length > 1 ? ' actifs' : ' actif') : 'aucun';
    $('reactions').innerHTML = a.reactions.length ? a.reactions.map(function (r) {
      return '<li class="reac k-' + r.kind + '">' + lens(r.pair) + '<div class="reac-body"><div class="reac-top"><b>' + r.title + '</b><span class="reac-kind">' + { syn: 'synergie', tension: 'tension', guard: 'garde-fou' }[r.kind] + '</span></div>' +
        '<span class="reac-text">' + r.text + '</span><code>' + r.src + '</code></div></li>';
    }).join('') : '<li class="reac empty">Aucun croisement : tes piliers ne se touchent pas encore.</li>';

    var p = $('primary'), s = $('secondary');
    p.disabled = false; s.hidden = false;
    if (state.stage === 'compose') { p.textContent = a.guard ? 'Corrige le garde-fou pour lancer' : 'Lancer le cycle · 8 semaines'; p.disabled = a.guard; s.textContent = 'Revenir à la v2'; s.hidden = state.version === 2 && !state.touched; }
    else if (state.stage === 'incubating') { p.textContent = 'Semaine ' + state.week + ' sur 8…'; p.disabled = true; s.hidden = true; }
    else if (state.stage === 'incubated') { p.textContent = 'Faire le bilan'; s.textContent = 'Retour à Composer'; }
    else if (state.stage === 'distilling') { p.textContent = 'Bilan en cours…'; p.disabled = true; s.hidden = true; }
    else { p.textContent = 'Composer la v' + (state.version + 1) + ' depuis ce bilan'; s.textContent = 'Garder la v' + state.version; }

    if (announce) announceChanges(a);
    state.lastKeys = a.reactions.map(function (r) { return r.key; });
    draw2D();
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
  function select(i, fromScene) {
    state.selected = i; if (scene.ok) scene.select(E[i].pillar); render(false);
    if (fromScene) { var el = document.querySelector('[data-pick="' + i + '"]'); if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }); } SFX.click(); }
  }
  function pickPillar(p) {
    for (var i = 0; i < E.length; i++) if (E[i].pillar === p) return select(i, true);
  }

  function step(i, d) {
    if (state.stage !== 'compose') return;
    var e = E[i], ni = state.idx[e.id] + d; if (ni < 0 || ni >= e.values.length) return;
    state.idx[e.id] = ni; state.selected = i; state.touched = true; $('hint').hidden = true;
    buzz(10); SFX.dose(d > 0);
    if (scene.ok && d > 0) scene.pulse(e.pillar);
    syncScene(); render(true);
  }

  function launchCycle() {
    state.stage = 'incubating'; state.week = 0; $('projection').hidden = false; $('essence').hidden = true;
    if (scene.ok) scene.setStage('incubating');
    render(false); drawChart(); say('Cycle lancé. Huit semaines en accéléré.');
    var tick = function () {
      state.week += 1; if (scene.ok) scene.setWeek(state.week / 8); SFX.tick(); drawChart(); render(false);
      if (state.week < 8) setTimeout(tick, reduced ? 0 : 850);
      else { state.stage = 'incubated'; if (scene.ok) scene.setStage('incubated'); render(false); var last = M.project(state.idx)[8]; say('Huit semaines plus tard. Dix kilomètres projetés en ' + M.mmss(last.run.mid).replace(':', ' minutes ') + '.'); }
    };
    setTimeout(tick, reduced ? 0 : 700);
  }

  function makeBilan() {
    state.stage = 'distilling'; render(false); if (scene.ok) scene.setStage('distilling'); SFX.bilan(); say('Bilan du cycle.');
    var start = Date.now(), dur = reduced ? 1 : 3200;
    var run = function () {
      var p = Math.min(1, (Date.now() - start) / dur); if (scene.ok) scene.setBilan(p);
      if (p < 1) setTimeout(run, 40); else finishBilan();
    };
    run();
  }

  function finishBilan() {
    var d = M.distill(state.idx); state.essence = d; state.stage = 'distilled';
    if (scene.ok) scene.setStage('distilled');
    $('essResults').innerHTML = d.results.map(function (r) { return '<li><span>' + r.label + '<small>' + r.note + '</small></span><b>' + r.value + '</b></li>'; }).join('');
    $('essCarried').textContent = d.carried; $('essCost').textContent = d.cost;
    $('essChanges').innerHTML = d.changes.map(function (c) { return '<li>' + c + '</li>'; }).join('');
    $('essence').hidden = false; render(false); SFX.syn();
    say('Voici ce que ce cycle t’a appris. Ce qui a porté : ' + d.carried.replace(/×/g, 'et') + '.');
  }

  function composeNext() {
    var next = state.essence ? state.essence.next : state.idx;
    var grown = E.filter(function (e) { return next[e.id] > state.idx[e.id]; });
    state.idx = Object.assign({}, next); state.version += 1; backToCompose();
    grown.forEach(function (e, n) { setTimeout(function () { if (scene.ok) scene.pulse(e.pillar); SFX.dose(true); }, n * 500); });
  }

  function backToCompose() {
    state.stage = 'compose'; state.week = 0; $('projection').hidden = true; $('essence').hidden = true;
    if (scene.ok) { scene.setStage('compose'); scene.setBilan(0); }
    syncScene(); render(true);
  }

  /* ---------- projection ---------- */
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
    $('projChart').innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Projection ' + m.label + ' sur 8 semaines">' +
      '<line x1="' + L + '" y1="' + (H - B) + '" x2="' + (W - Rr) + '" y2="' + (H - B) + '" class="axis"/>' +
      '<text x="' + (L - 6) + '" y="' + (y(hi - pad) + 4) + '" class="tick" text-anchor="end">' + m.fmt(m.invert ? lo + pad : hi - pad) + '</text>' +
      '<text x="' + (L - 6) + '" y="' + (y(lo + pad) + 4) + '" class="tick" text-anchor="end">' + m.fmt(m.invert ? hi - pad : lo + pad) + '</text>' +
      [0, 4, 8].map(function (w) { return '<text x="' + x(w) + '" y="' + (H - 8) + '" class="tick" text-anchor="middle">S' + w + '</text>'; }).join('') +
      (m.goal ? '<line x1="' + L + '" y1="' + y(m.goal) + '" x2="' + (W - Rr) + '" y2="' + y(m.goal) + '" class="goal"/><text x="' + (W - Rr) + '" y="' + (y(m.goal) - 5) + '" class="tick goal-t" text-anchor="end">' + m.goalLabel + '</text>' : '') +
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
    if (t.hasAttribute('data-pick')) select(+t.getAttribute('data-pick'), false);
    else if (t.hasAttribute('data-step')) step(+t.getAttribute('data-step'), +t.getAttribute('data-d'));
    else if (t.hasAttribute('data-metric')) { state.metric = t.getAttribute('data-metric'); drawChart(); }
  });
  $('primary').addEventListener('click', function () {
    if (state.stage === 'compose') launchCycle(); else if (state.stage === 'incubated') makeBilan(); else if (state.stage === 'distilled') composeNext();
  });
  $('secondary').addEventListener('click', function () {
    if (state.stage === 'compose') { state.idx = M.defaults(); state.version = 2; state.touched = false; backToCompose(); }
    else backToCompose();
  });
  $('btnSound').addEventListener('click', function () { state.sound = !state.sound; this.setAttribute('aria-pressed', state.sound); this.querySelector('span').textContent = state.sound ? 'Son' : 'Muet'; });
  $('btnVoice').addEventListener('click', function () { state.voice = !state.voice; this.setAttribute('aria-pressed', state.voice); if (!state.voice && window.speechSynthesis) window.speechSynthesis.cancel(); });
  $('btnView').addEventListener('click', function () { state.fiche = !state.fiche; document.body.classList.toggle('fiche', state.fiche); this.setAttribute('aria-pressed', state.fiche); this.querySelector('span').textContent = state.fiche ? 'Vue 3D' : 'Vue sobre'; });
  $('fbRetry').addEventListener('click', boot3D);

  render(false); boot3D();
})();
