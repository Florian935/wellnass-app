/* Le Labo — moteur de règles du prototype (v2).
 * Logique pure, sans DOM ni 3D : leviers, croisements entre piliers, équilibre, projection, bilan.
 * Règles FICTIVES inspirées du catalogue d'analyses (les codes cités existent) — pas un calcul validé. */
(function () {
  'use strict';

  var ELEMENTS = [
    { id: 'fq', sym: 'Fq', name: 'Musculation', pillar: 'muscu', color: '#e07a98', values: [0, 2, 3, 4, 5], def: 2, fmt: function (v) { return v === 0 ? 'absent' : v + ' séances/sem'; } },
    { id: 'km', sym: 'Km', name: 'Volume de course', pillar: 'course', color: '#6fa8ef', values: [0, 15, 25, 35], def: 2, fmt: function (v) { return v === 0 ? 'absent' : v + ' km/sem'; } },
    { id: 'fr', sym: 'Fr', name: 'Fractionné', pillar: 'course', color: '#b7d6ff', values: [0, 1, 2], def: 1, fmt: function (v) { return v === 0 ? 'aucun' : v + ' par semaine'; } },
    { id: 'pr', sym: 'Pr', name: 'Protéines', pillar: 'nutrition', color: '#a9ba7e', values: [1.2, 1.6, 1.8, 2.2], def: 2, fmt: function (v) { return String(v).replace('.', ',') + ' g/kg'; } },
    { id: 'kc', sym: 'Kc', name: 'Balance calorique', pillar: 'nutrition', color: '#d6e3b0', values: [0, -250, -500], def: 1, fmt: function (v) { return v === 0 ? 'maintien' : '−' + Math.abs(v) + ' kcal/j'; } },
    { id: 'gl', sym: 'Gl', name: 'Glucides périodisés', pillar: 'nutrition', color: '#e8f0d6', values: [0, 1], def: 0, fmt: function (v) { return v ? 'oui' : 'non'; } },
    { id: 'so', sym: 'So', name: 'Sommeil', pillar: 'socle', color: '#e0b155', values: [6.5, 7.5, 8.5], def: 1, fmt: function (v) { return String(v).replace('.5', ' h 30').replace(/^(\d)$/, '$1 h'); } },
  ];

  var PILLAR_LABEL = { muscu: 'Muscu', course: 'Course', nutrition: 'Nutrition', socle: 'Socle' };

  function defaults() {
    var d = {};
    ELEMENTS.forEach(function (e) { d[e.id] = e.def; });
    return d;
  }

  function values(idx) {
    var v = {};
    ELEMENTS.forEach(function (e) { v[e.id] = e.values[idx[e.id]]; });
    return v;
  }

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  function charge(v) { return v.fq * 9 + v.km * 1.2 + v.fr * 8; }
  var BASE = charge(values(defaults()));

  function analyse(idx) {
    var v = values(idx);
    var ch = charge(v);
    var jump = Math.round((ch / BASE - 1) * 100);
    var sessions = v.fq + (v.km > 0 ? Math.max(v.fr, 0) + Math.ceil(v.km / 12) : 0);
    var R = [];
    var add = function (kind, key, title, text, src, pair) { R.push({ kind: kind, key: key, title: title, text: text, src: src, pair: pair }); };

    if (v.kc === -500 && (v.km >= 35 || v.fq >= 5)) add('guard', 'reds', 'Déficit × volume', '500 kcal de déficit avec autant de volume : la formule ne peut pas incuber ainsi.', 'RN-10 · GARDE-01', ['course', 'nutrition']);
    if (sessions >= 9) add('guard', 'repos', 'Aucun jour de repos', sessions + ' séances pour 7 jours : il faut au moins un jour off.', 'GARDE-01 · MR-13', ['muscu', 'course', 'nutrition']);
    if (v.fq >= 4 && v.fr >= 1 && v.km >= 25) add('tension', 'interf', 'Jambes × fractionné', 'Squat lourd la veille du fractionné : environ 3 s perdues par fraction.', 'MR-08 · COLLIS-01', ['muscu', 'course']);
    if (jump > 15) add('tension', 'montee', 'Charge combinée +' + jump + ' %', 'Au-delà de +10 % de charge d’un coup, la récupération ne suit plus.', 'META-19 · MR-11', ['muscu', 'course']);
    if (v.kc === -500 && v.fq >= 3 && !R.some(function (r) { return r.key === 'reds'; })) add('tension', 'deficit', 'Déficit × force', 'À −500 kcal, la force recule vite si les protéines ne suivent pas.', 'MN-08', ['nutrition', 'muscu']);
    if (v.so === 6.5 && (v.fq >= 4 || v.fr >= 2)) add('tension', 'nuit', 'Nuits courtes × intensité', '6 h 30 de sommeil pour une semaine dure : la récupération décroche.', 'TRI-03', ['socle', 'muscu']);
    if (v.gl && v.fr >= 1) add('syn', 'glfr', 'Glucides × fractionné', '+1,5 g/kg les jours durs : l’allure des fractions tient.', 'FUEL-01 · RN-06', ['nutrition', 'course']);
    if (v.pr >= 1.6 && v.fq >= 3) add('syn', 'prfq', 'Protéines × musculation', v.pr >= 1.8 ? 'La dose couvre tes séances de force.' : 'Juste suffisant : 1,8 g/kg serait plus sûr.', 'MN-06', ['nutrition', 'muscu']);
    if (v.pr >= 2.2 && v.kc < 0) add('syn', 'prkc', 'Protéines × déficit', '2,2 g/kg protègent le muscle pendant la perte de poids.', 'MN-08 · MN-06', ['nutrition', 'muscu']);
    if (v.so >= 7.5 && (v.fq >= 4 || v.fr >= 2)) add('syn', 'sofq', 'Sommeil × intensité', 'Tes nuits soutiennent une semaine exigeante.', 'TRI-03', ['socle', 'muscu']);

    var order = { guard: 0, tension: 1, syn: 2 };
    R.sort(function (a, b) { return order[a.kind] - order[b.kind]; });

    var deficitCost = { 0: 0, '-250': 10, '-500': 26 }[v.kc];
    var recup = clamp(Math.round(108 - Math.max(0, ch - 60) * 0.9 - deficitCost - (v.so === 6.5 ? 14 : v.so === 8.5 ? -6 : 0)), 4, 100);
    var fuel = clamp(Math.round(70 + (v.gl ? 14 : 0) + (v.pr - 1.6) * 20 - { 0: 0, '-250': 14, '-500': 34 }[v.kc] - Math.max(0, v.km - 25) * 1.1 - v.fr * 3), 4, 100);
    var guard = R.some(function (r) { return r.kind === 'guard'; });
    var tension = R.some(function (r) { return r.kind === 'tension'; });

    return {
      v: v, reactions: R, guard: guard, tension: tension,
      synergy: R.some(function (r) { return r.kind === 'syn'; }),
      verdict: guard ? 'Formule bloquée' : tension ? 'Tes piliers se gênent' : 'Tes piliers s’accordent',
      gauges: [
        { id: 'charge', label: 'Charge', pct: clamp(Math.round(ch / 1.2), 4, 100), word: ch > 95 ? 'élevée' : ch > 55 ? 'productive' : 'légère', tone: ch > 95 ? 'warn' : 'ok' },
        { id: 'recup', label: 'Récupération', pct: recup, word: recup < 35 ? 'à la traîne' : recup < 60 ? 'juste' : 'suit', tone: recup < 35 ? 'bad' : recup < 60 ? 'warn' : 'ok' },
        { id: 'fuel', label: 'Énergie', pct: fuel, word: fuel < 35 ? 'à sec' : fuel < 60 ? 'juste' : 'pleine', tone: fuel < 35 ? 'bad' : fuel < 60 ? 'warn' : 'ok' },
      ],
      recupFactor: 0.55 + recup / 220,
    };
  }

  /* Projection sur 8 semaines, avec une fourchette qui s'élargit. */
  function project(idx) {
    var a = analyse(idx), v = a.v, rf = a.recupFactor;
    var interf = a.reactions.some(function (r) { return r.key === 'interf'; });
    var sbdWeek = [0, 0, 1.2, 1.8, 2.2, 2.3][v.fq] * (v.pr >= 1.8 ? 1 : v.pr >= 1.6 ? 0.8 : 0.55) * (v.kc === -500 ? 0.35 : v.kc < 0 ? 0.85 : 1) * rf - (interf ? 0.25 : 0);
    var kmWeek = v.km === 0 ? 0 : (v.km * 0.18 + v.fr * 3.5 * (v.gl ? 1.25 : 1)) * (v.kc === -500 ? 0.7 : 1) * rf - (interf ? 2.5 : 0);
    var kgWeek = (v.kc * 7) / 7700;
    var weeks = [];
    for (var w = 0; w <= 8; w++) {
      var spread = w === 0 ? 0 : 0.35 + w * 0.32;
      weeks.push({
        w: w,
        sbd: { mid: 372 + sbdWeek * w, lo: 372 + sbdWeek * w - spread * 2.2, hi: 372 + sbdWeek * w + spread * 2.2 },
        run: { mid: 2950 - kmWeek * w, lo: 2950 - kmWeek * w - spread * 9, hi: 2950 - kmWeek * w + spread * 9 },
        kg: { mid: 77.6 + kgWeek * w, lo: 77.6 + kgWeek * w - spread * 0.25, hi: 77.6 + kgWeek * w + spread * 0.25 },
      });
    }
    return weeks;
  }

  function mmss(s) { s = Math.round(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function num(x, d) { return x.toFixed(d).replace('.', ','); }

  /* Bilan de cycle : ce qui a porté, ce qui a coûté, et la version suivante proposée. */
  function distill(idx) {
    var a = analyse(idx), p = project(idx)[8];
    var syn = a.reactions.filter(function (r) { return r.kind === 'syn'; });
    var ten = a.reactions.filter(function (r) { return r.kind === 'tension'; });
    var next = Object.assign({}, idx), changes = [];
    ten.forEach(function (t) {
      if (t.key === 'interf' && idx.fq > 2) { next.fq = idx.fq - 1; changes.push('Fq ' + a.v.fq + ' → ' + ELEMENTS[0].values[next.fq]); }
      if (t.key === 'montee' && idx.km > 1 && next.km === idx.km) { next.km = idx.km - 1; changes.push('Km ' + a.v.km + ' → ' + ELEMENTS[1].values[next.km]); }
      if (t.key === 'nuit') { next.so = 1; changes.push('So → 7 h 30'); }
      if (t.key === 'deficit') { next.kc = 1; changes.push('Kc → −250'); }
    });
    if (!a.v.gl && a.v.fr >= 1) { next.gl = 1; changes.push('Gl → oui'); }
    if (!changes.length) changes.push('Doses gardées : affûtage J-10');
    return {
      results: [
        { label: 'Total SBD', value: Math.round(p.sbd.mid) + ' kg', note: 'départ 372 kg · fourchette ' + Math.round(p.sbd.lo) + '–' + Math.round(p.sbd.hi) },
        { label: '10 km', value: mmss(p.run.mid), note: p.run.mid <= 2880 ? 'objectif 48:00 atteint' : 'objectif 48:00 · manqué de ' + Math.round(p.run.mid - 2880) + ' s' },
        { label: 'Poids', value: num(p.kg.mid, 1) + ' kg', note: 'départ 77,6 kg' },
      ],
      carried: syn.length ? syn.slice(0, 2).map(function (s) { return s.title; }).join(' · ') : 'Aucune synergie nette : tes piliers ont avancé chacun de leur côté.',
      cost: ten.length ? ten[0].title + ' — ' + ten[0].text : 'Rien de coûteux repéré sur ce cycle.',
      next: next, changes: changes,
    };
  }

  window.LaboMoteur = { ELEMENTS: ELEMENTS, PILLAR_LABEL: PILLAR_LABEL, defaults: defaults, values: values, analyse: analyse, project: project, distill: distill, mmss: mmss, num: num };
})();
