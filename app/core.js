/* ÖZEN — общий слой: скоринг по ТЗ v2.1 §4 и коды обмена «родитель ↔ специалист». */
window.OZEN_CORE = (function (M) {
  'use strict';
  var AX4 = ['K', 'E', 'V', 'B'];

  function axisIndex(ans, ax) {
    var sum = 0, n = 0;
    M.questions.forEach(function (q) {
      if (q.ax !== ax || (q.t !== 'l' && q.t !== 'r')) { return; }
      var v = ans[q.id];
      if (!v) { return; }
      sum += q.t === 'r' ? 6 - v : v; n++;
    });
    return n ? ((sum / n - 1) / 4) * 100 : null;
  }
  function indices(ans) { return AX4.map(function (a) { return axisIndex(ans, a); }); }
  function band(v) { return v === null ? null : (v >= M.bands.high ? 'hi' : (v >= M.bands.mid ? 'mid' : 'lo')); }
  function flags(ans) {
    var n = 0;
    M.questions.forEach(function (q) { if (q.t === 'f' && ans[q.id] >= M.flagFrom) { n++; } });
    return n;
  }
  function level(n) { return n >= M.escalation.level3 ? 3 : (n >= M.escalation.level2 ? 2 : (n >= 1 ? 1 : 0)); }
  function cats(ans, ax) {
    var out = [];
    M.questions.forEach(function (q) {
      if (q.ax === ax && q.t === 'c' && ans[q.id]) { out.push(q.o[ans[q.id] - 1][1]); }
    });
    return out;
  }
  function answered(ans) {
    var n = 0;
    M.questions.forEach(function (q) { if (ans[q.id]) { n++; } });
    return n;
  }

  function b64e(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i++) { bin += String.fromCharCode(bytes[i]); }
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64d(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) { s += '='; }
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
    return new TextDecoder().decode(bytes);
  }
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }

  /* Код черновика: только год рождения, интересы и ответы. Имён и контактов в нём нет. */
  function packProfile(c) {
    var a = M.questions.map(function (q) { return String(c.ans[q.id] || 0); }).join('');
    return 'OZP1.' + b64e(JSON.stringify({ p: c.pid, y: c.year, i: c.interests, a: a }));
  }
  function unpackProfile(code) {
    try {
      code = String(code).trim();
      if (code.indexOf('OZP1.') !== 0) { return null; }
      var o = JSON.parse(b64d(code.slice(5)));
      if (!o.p || typeof o.a !== 'string' || o.a.length !== M.questions.length) { return null; }
      var ans = {};
      M.questions.forEach(function (q, i) { var v = Number(o.a.charAt(i)); if (v) { ans[q.id] = v; } });
      return { pid: o.p, year: o.y, interests: o.i || [], ans: ans };
    } catch (e) { return null; }
  }
  /* Код открытия: решение специалиста, привязанное к конкретному черновику. */
  function packOpen(pid, data) {
    var body = b64e(JSON.stringify(data));
    return 'OZO1.' + body + '.' + hash(pid + '|' + body);
  }
  function unpackOpen(code, pid) {
    try {
      var parts = String(code).trim().split('.');
      if (parts.length !== 3 || parts[0] !== 'OZO1') { return null; }
      if (hash(pid + '|' + parts[1]) !== parts[2]) { return null; }
      return JSON.parse(b64d(parts[1]));
    } catch (e) { return null; }
  }

  function pt(i, f, cx, cy, r) {
    var a = (-90 + 60 * i) * Math.PI / 180;
    return [cx + r * f * Math.cos(a), cy + r * f * Math.sin(a)];
  }
  /* Гексагон: четыре расчётные оси закрашены, зоны внимания и потенциала — полые точки (это не числа). */
  function hexSvg(idx, opt) {
    opt = opt || {};
    var w = opt.small ? 120 : 340, hgt = opt.small ? 110 : 316, cx = w / 2, cy = hgt / 2, r = opt.small ? 44 : 100;
    function ring(f) {
      var o = [];
      for (var i = 0; i < 6; i++) { var p = pt(i, f, cx, cy, r); o.push(p[0].toFixed(1) + ',' + p[1].toFixed(1)); }
      return o.join(' ');
    }
    var fr = idx.map(function (v) { return v === null ? 0.5 : 0.18 + 0.82 * v / 100; }).concat([0.5, 0.5]);
    var pts = fr.map(function (f, i) { return pt(i, f, cx, cy, r); });
    var poly = pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    var s = '<svg viewBox="0 0 ' + w + ' ' + hgt + '" role="img" aria-label="Гексагон профиля по шести осям">';
    s += '<polygon points="' + ring(1) + '" fill="none" stroke="#9AA6A1"/>';
    if (!opt.small) {
      s += '<polygon points="' + ring(0.66) + '" fill="none" stroke="#DAD6CC"/><polygon points="' + ring(0.33) + '" fill="none" stroke="#DAD6CC"/>';
      for (var i = 0; i < 6; i++) {
        var e = pt(i, 1, cx, cy, r);
        s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + e[0].toFixed(1) + '" y2="' + e[1].toFixed(1) + '" stroke="#DAD6CC"/>';
      }
    }
    s += '<polygon points="' + poly + '" fill="rgba(14,124,123,.16)" stroke="#0E7C7B" stroke-width="2" stroke-linejoin="round"/>';
    pts.forEach(function (p, j) {
      var solid = j < 4 && idx[j] !== null;
      s += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (opt.small ? 3 : 5) + '" fill="' + (solid ? '#0E7C7B' : '#fff') + '" stroke="' + (j === 5 ? '#C08A2D' : '#0E7C7B') + '" stroke-width="2"/>';
    });
    if (!opt.small) {
      M.axes.forEach(function (a, j) {
        var p = pt(j, 1.2, cx, cy, r);
        var anchor = (j === 0 || j === 3) ? 'middle' : (j < 3 ? 'start' : 'end');
        var dx = (j === 0 || j === 3) ? 0 : (j < 3 ? -14 : 14);
        s += '<text x="' + (p[0] + dx).toFixed(1) + '" y="' + (p[1] + 5).toFixed(1) + '" font-size="13" font-weight="600" fill="#14231F" text-anchor="' + anchor + '">' + a.short + '</text>';
      });
    }
    return s + '</svg>';
  }

  return { AX4: AX4, axisIndex: axisIndex, indices: indices, band: band, flags: flags, level: level, cats: cats, answered: answered,
    packProfile: packProfile, unpackProfile: unpackProfile, packOpen: packOpen, unpackOpen: unpackOpen, hexSvg: hexSvg };
})(window.OZEN_METHOD);
