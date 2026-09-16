/* Le Labo — interface du prototype : doses, réactions, incubation, distillation, son, voix. */
(function () {
  'use strict';
  var M = window.LaboMoteur, E = M.ELEMENTS;
  var $ = function (id) { return document.getElementById(id); };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var state = { idx: M.defaults(), stage: 'compose', version: 2, selected: 0, week: 0, metric: 'run', sound: true, voice: true, fiche: false, lastKeys: null, touched: false };
  var PILLAR_COLOR = { nutrition: '#a9ba7e', course: '#6fa8ef', muscu: '#e07a98', socle: '#e0b155' };
  var NAMES = { 2: 'Hybride d’automne', 3: 'Hybride d’automne', 4: 'Affûtage 10 km', 5: 'Affûtage 10 km' };

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
    $('fbReason').textContent = REASONS[reason] || REASONS.renderer;
    $('fbCode').textContent = 'code : ' + reason + (detail ? ' · ' + String(detail).slice(0, 120) : '');
  }
  function boot3D() {
    var old = $('scene'), fresh = old.cloneNode(false); old.parentNode.replaceChild(fresh, old);
    loadThree(function () {
      if (!window.LaboScene) return fail('scene');
      var res;
      try { res = window.LaboScene.create(fresh, { colors: E.map(function (e) { return e.color; }), reducedMotion: reduced, onPick: function (i) { select(i, true); }, onLost: function () { fail('lost'); } }); }
      catch (err) { return fail('renderer', err && err.message); }
      if (!res.ok) return fail(res.reason, res.detail);
      scene = res; document.body.classList.remove('no3d'); syncScene(0);
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
  function glug() {
    var a = audio(); if (!a) return; var t = a.currentTime, len = 0.7;
    var buf = a.createBuffer(1, a.sampleRate * len, a.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    var src = a.createBufferSource(); src.buffer = buf; var f = a.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(500, t); for (var k = 1; k < 8; k++) f.frequency.setValueAtTime(k % 2 ? 900 : 420, t + k * 0.08);
    var g = a.createGain(); g.gain.value = 0.35; src.connect(f).connect(g).connect(a.destination); src.start(t);
  }
  var SFX = {
    pour: function () { glug(); tone(220, 0.45, 'sine', 0.04, 0.05, 330); },
    syn: function () { tone(880, 0.5, 'sine', 0.1); tone(1318.5, 0.8, 'sine', 0.08, 0.1); },
    tension: function () { tone(110, 0.4, 'sawtooth', 0.05, 0, 96); tone(117, 0.4, 'sawtooth', 0.035); },
    guard: function () { tone(392, 0.25, 'triangle', 0.1); tone(261.6, 0.5, 'triangle', 0.1, 0.22); },
    tick: function () { tone(1500, 0.05, 'square', 0.02); },
    distill: function () { tone(330, 2.2, 'sine', 0.05, 0, 990); tone(495, 2.2, 'sine', 0.03, 0.2, 1320); },
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

  /* ---------- rendu ---------- */
  function inFormula(e, i) { return !(i === 0 && (e.id === 'fq' || e.id === 'km' || e.id === 'fr' || e.id === 'gl')); }
  function layers(idx) {
    var sums = { nutrition: 0, course: 0, muscu: 0, socle: 0 };
    E.forEach(function (e) { var i = idx[e.id]; if (inFormula(e, i)) sums[e.pillar] += 0.02 + (i / (e.values.length - 1)) * 0.09; });
    return ['nutrition', 'course', 'muscu', 'socle'].filter(function (p) { return sums[p] > 0; }).map(function (p) { return { color: PILLAR_COLOR[p], amount: sums[p] }; });
  }

  function syncScene(delay) {
    if (!scene.ok) return;
    var a = M.analyse(state.idx);
    var apply = function () { scene.setLayers(layers(state.idx)); scene.setMood({ synergy: a.synergy, tension: a.tension, guard: a.guard }); };
    scene.setInFormula(E.map(function (e) { return inFormula(e, state.idx[e.id]); }));
    scene.select(state.selected);
    if (delay) setTimeout(apply, delay); else apply();
  }

  function render(announce) {
    var a = M.analyse(state.idx), editable = state.stage === 'compose';
    $('formulaName').textContent = (NAMES[state.version] || 'Formule') + ' · v' + state.version;
    var pill = { compose: state.version > 2 ? 'Brouillon' : 'Sur la paillasse', incubating: 'En incubation', incubated: 'Incubée', distilling: 'Distillation', distilled: 'Distillée' }[state.stage];
    $('stagePill').textContent = pill;
    $('verdict').textContent = a.verdict; $('verdict').className = 'verdict ' + (a.guard ? 'bad' : a.tension ? 'warn' : 'ok');

    $('gauges').innerHTML = a.gauges.map(function (g) {
      return '<div class="gauge"><div class="gauge-top"><span>' + g.label + '</span><span class="t-' + g.tone + '">' + g.word + '</span></div>' +
        '<div class="track"><div class="fill t-bg-' + g.tone + '" style="width:' + g.pct + '%"></div></div></div>';
    }).join('');

    $('tubes').innerHTML = E.map(function (e, i) {
      var di = state.idx[e.id], sel = i === state.selected, on = inFormula(e, di);
      return '<li class="tube' + (sel ? ' sel' : '') + (on ? '' : ' off') + '" style="--c:' + e.color + '">' +
        '<button class="tube-pick" type="button" data-pick="' + i + '" aria-pressed="' + sel + '"><span class="sym">' + e.sym + '</span>' +
        '<span class="tube-name">' + e.name + '<small>' + M.PILLAR_LABEL[e.pillar] + '</small></span></button>' +
        '<div class="dose"><button type="button" class="step" data-step="' + i + '" data-d="-1" aria-label="Diminuer ' + e.name + '"' + (!editable || di === 0 ? ' disabled' : '') + '>−</button>' +
        '<output>' + e.fmt(e.values[di]) + '</output>' +
        '<button type="button" class="step" data-step="' + i + '" data-d="1" aria-label="Augmenter ' + e.name + '"' + (!editable || di === e.values.length - 1 ? ' disabled' : '') + '>+</button></div></li>';
    }).join('');

    $('reacCount').textContent = a.reactions.length ? a.reactions.length + (a.reactions.length > 1 ? ' actives' : ' active') : 'aucune';
    $('reactions').innerHTML = a.reactions.length ? a.reactions.map(function (r) {
      return '<li class="reac k-' + r.kind + '"><span class="reac-kind">' + { syn: 'Synergie', tension: 'Tension', guard: 'Garde-fou' }[r.kind] + '</span>' +
        '<b>' + r.title + '</b><span class="reac-text">' + r.text + '</span><code>' + r.src + '</code></li>';
    }).join('') : '<li class="reac empty">Aucune réaction : les éléments ne se croisent pas encore.</li>';

    var p = $('primary'), s = $('secondary');
    p.disabled = false; s.hidden = false;
    if (state.stage === 'compose') { p.textContent = a.guard ? 'Garde-fou : incubation impossible' : 'Incuber 8 semaines'; p.disabled = a.guard; s.textContent = 'Revenir à la v2'; s.hidden = state.version === 2 && !state.touched; }
    else if (state.stage === 'incubating') { p.textContent = 'Semaine ' + state.week + ' sur 8…'; p.disabled = true; s.hidden = true; }
    else if (state.stage === 'incubated') { p.textContent = 'Distiller l’essence'; s.textContent = 'Retour à la paillasse'; }
    else if (state.stage === 'distilling') { p.textContent = 'Distillation…'; p.disabled = true; s.hidden = true; }
    else { p.textContent = 'Composer la v' + (state.version + 1) + ' depuis l’essence'; s.textContent = 'Garder la v' + state.version; }

    if (announce) announceChanges(a);
    state.lastKeys = a.reactions.map(function (r) { return r.key; });
  }

  function announceChanges(a) {
    var prev = state.lastKeys || [];
    var fresh = a.reactions.filter(function (r) { return prev.indexOf(r.key) < 0; });
    if (!fresh.length) return;
    var r = fresh[0];
    toast(r.kind, r.title, r.text);
    setTimeout(function () { SFX[r.kind === 'syn' ? 'syn' : r.kind](); }, reduced ? 0 : 500);
    buzz(r.kind === 'guard' ? 90 : r.kind === 'tension' ? [30, 40, 30] : 15);
    say((r.kind === 'syn' ? 'Synergie. ' : r.kind === 'tension' ? 'Attention, ta formule tranche. ' : 'Garde-fou. ') + r.text.replace(/·/g, ','));
  }

  /* ---------- actions ---------- */
  function select(i, fromScene) {
    state.selected = i; if (scene.ok) scene.select(i); render(false);
    if (fromScene) { var el = document.querySelector('[data-pick="' + i + '"]'); if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }); } SFX.click(); }
  }

  function step(i, d) {
    if (state.stage !== 'compose') return;
    var e = E[i], ni = state.idx[e.id] + d; if (ni < 0 || ni >= e.values.length) return;
    state.idx[e.id] = ni; state.selected = i; state.touched = true; $('hint').hidden = true;
    buzz(10);
    if (d > 0 && scene.ok) { scene.pour(i); SFX.pour(); syncScene(reduced ? 0 : 560); } else { SFX.click(); syncScene(0); }
    render(true);
  }

  function incubate() {
    state.stage = 'incubating'; state.week = 0; $('projection').hidden = false; $('essence').hidden = true;
    if (scene.ok) scene.setStage('incubating');
    render(false); drawChart(); say('Incubation. Huit semaines en accéléré.');
    var tickWeek = function () {
      state.week += 1; if (scene.ok) scene.setIncubation(state.week / 8); SFX.tick(); drawChart(); render(false);
      if (state.week < 8) setTimeout(tickWeek, reduced ? 0 : 850);
      else { state.stage = 'incubated'; render(false); var last = M.project(state.idx)[8]; say('Huit semaines plus tard. Dix kilomètres projetés en ' + M.mmss(last.run.mid).replace(':', ' minutes ') + '.'); }
    };
    setTimeout(tickWeek, reduced ? 0 : 700);
  }

  function distill() {
    state.stage = 'distilling'; render(false); if (scene.ok) scene.setStage('distilling'); SFX.distill(); say('Distillation de la formule.');
    var start = performance.now(), dur = reduced ? 1 : 4200;
    var run = function (now) {
      var p = Math.min(1, (now - start) / dur); if (scene.ok) scene.setDistill(p);
      if (p < 1) requestAnimationFrame(run); else finishDistill();
    };
    requestAnimationFrame(run);
  }

  function finishDistill() {
    var d = M.distill(state.idx); state.essence = d; state.stage = 'distilled';
    if (scene.ok) scene.setStage('distilled');
    $('essResults').innerHTML = d.results.map(function (r) { return '<li><span>' + r.label + '<small>' + r.note + '</small></span><b>' + r.value + '</b></li>'; }).join('');
    $('essCarried').textContent = d.carried; $('essCost').textContent = d.cost;
    $('essChanges').innerHTML = d.changes.map(function (c) { return '<li>' + c + '</li>'; }).join('');
    $('essence').hidden = false; render(false); SFX.syn();
    say('Voici l’essence. Ce qui a porté : ' + d.carried.replace(/×/g, 'et') + '.');
  }

  function composeNext() {
    var next = state.essence ? state.essence.next : state.idx;
    var changed = E.map(function (e, i) { return next[e.id] > state.idx[e.id] ? i : -1; }).filter(function (i) { return i >= 0; });
    state.idx = Object.assign({}, next); state.version += 1; backToBench();
    changed.forEach(function (i, n) { setTimeout(function () { if (scene.ok) scene.pour(i); SFX.pour(); }, n * 1700); });
  }

  function backToBench() {
    state.stage = 'compose'; state.week = 0; $('projection').hidden = true; $('essence').hidden = true;
    if (scene.ok) { scene.setStage('compose'); scene.setIncubation(0); scene.setDistill(0); }
    syncScene(0); render(true);
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
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Projection ' + m.label + ' sur 8 semaines">' +
      '<line x1="' + L + '" y1="' + (H - B) + '" x2="' + (W - Rr) + '" y2="' + (H - B) + '" class="axis"/>' +
      '<text x="' + (L - 6) + '" y="' + (y(hi - pad) + 4) + '" class="tick" text-anchor="end">' + m.fmt(m.invert ? lo + pad : hi - pad) + '</text>' +
      '<text x="' + (L - 6) + '" y="' + (y(lo + pad) + 4) + '" class="tick" text-anchor="end">' + m.fmt(m.invert ? hi - pad : lo + pad) + '</text>' +
      [0, 4, 8].map(function (w) { return '<text x="' + x(w) + '" y="' + (H - 8) + '" class="tick" text-anchor="middle">S' + w + '</text>'; }).join('') +
      (m.goal ? '<line x1="' + L + '" y1="' + y(m.goal) + '" x2="' + (W - Rr) + '" y2="' + y(m.goal) + '" class="goal"/><text x="' + (W - Rr) + '" y="' + (y(m.goal) - 5) + '" class="tick goal-t" text-anchor="end">' + m.goalLabel + '</text>' : '') +
      '<path d="' + ghost + '" class="ghost"/>' + (shown.length > 1 ? '<polygon points="' + band + '" class="band"/>' : '') +
      '<path d="' + line + '" class="mid"/><circle cx="' + x(cur.w) + '" cy="' + y(cur[m.key].mid) + '" r="4.5" class="dot"/></svg>';
    $('projChart').innerHTML = svg;
    $('projValue').textContent = m.fmt(cur[m.key].mid);
    $('projRange').textContent = cur.w ? 'fourchette ' + m.fmt(m.invert ? cur[m.key].lo : cur[m.key].lo) + ' – ' + m.fmt(cur[m.key].hi) : 'point de départ';
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
    if (state.stage === 'compose') incubate(); else if (state.stage === 'incubated') distill(); else if (state.stage === 'distilled') composeNext();
  });
  $('secondary').addEventListener('click', function () {
    if (state.stage === 'compose') { state.idx = M.defaults(); state.version = 2; state.touched = false; backToBench(); }
    else backToBench();
  });
  $('btnSound').addEventListener('click', function () { state.sound = !state.sound; this.setAttribute('aria-pressed', state.sound); this.querySelector('span').textContent = state.sound ? 'Son' : 'Muet'; });
  $('btnVoice').addEventListener('click', function () { state.voice = !state.voice; this.setAttribute('aria-pressed', state.voice); if (!state.voice && window.speechSynthesis) window.speechSynthesis.cancel(); });
  $('btnView').addEventListener('click', function () { state.fiche = !state.fiche; document.body.classList.toggle('fiche', state.fiche); this.setAttribute('aria-pressed', state.fiche); this.querySelector('span').textContent = state.fiche ? 'Vue labo' : 'Vue fiche'; });

  $('fbRetry').addEventListener('click', boot3D);
  $('fbFiche').addEventListener('click', function () { $('btnView').click(); });
  render(false); boot3D();
})();
