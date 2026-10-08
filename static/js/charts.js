// Results charts. Data is Table I and Table II of the paper, transcribed verbatim.
(function () {
  'use strict';

  var MAGS = [0, 0.5, 1.0, 1.5, 2.0];
  var SERIES = [
    { key: 'transf', name: 'Transformer, K=5', slot: 1 },
    { key: 'mlp5',   name: 'MLP, K=5',         slot: 2 },
    { key: 'mlp1',   name: 'MLP, K=1',         slot: 3 },
  ];
  // Table II - fall-free survival (%), trained and evaluated at the same severity
  var SEV = [
    { label: '1 impaired joint',  transf: [95.7, 94.8, 92.6, 89.1, 84.3],
      mlp5: [92.5, 91.4, 88.5, 84.9, 80.1], mlp1: [91.0, 89.6, 86.7, 83.8, 77.9] },
    { label: '2 impaired joints', transf: [92.7, 91.6, 89.4, 83.5, 75.4],
      mlp5: [81.6, 80.0, 76.1, 70.4, 63.7], mlp1: [69.5, 68.1, 64.4, 59.2, 53.4] },
    { label: '3 impaired joints', transf: [91.3, 90.4, 86.9, 82.1, 75.1],
      mlp5: [80.1, 79.7, 74.9, 69.4, 61.5], mlp1: [62.4, 60.7, 56.4, 51.5, 44.0] },
  ];
  // Table I - survival on 500 novel stitched references
  var COMP = [
    { key: 'transf', name: 'Transformer, K=5', v: 76.8, lo: 72.9, hi: 80.3 },
    { key: 'mlp5',   name: 'MLP, K=5',         v: 44.0, lo: 39.7, hi: 48.4 },
    { key: 'mlp1',   name: 'MLP, K=1',         v: 46.8, lo: 42.5, hi: 51.2 },
  ];

  var NS = 'http://www.w3.org/2000/svg';
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function el(n, a) { var e = document.createElementNS(NS, n);
    for (var k in a) e.setAttribute(k, a[k]); return e; }
  function color(slot) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue('--series-' + slot).trim() || '#2a78d6';
  }
  function ease(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; }

  // ---- line chart ----------------------------------------------------------
  var lineSvg = document.querySelector('.chart-line');
  if (lineSvg) buildLine();

  function buildLine() {
    var W = 720, H = 340, P = { t: 18, r: 110, b: 44, l: 48 };
    var yMin = 40, yMax = 100;
    lineSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var x = function (m) { return P.l + (m / 2) * (W - P.l - P.r); };
    var y = function (v) { return P.t + (1 - (v - yMin) / (yMax - yMin)) * (H - P.t - P.b); };

    var g = el('g'); lineSvg.appendChild(g);
    // grid + y axis
    for (var v = yMin; v <= yMax; v += 10) {
      g.appendChild(el('line', { x1: P.l, x2: W - P.r, y1: y(v), y2: y(v), class: 'grid' }));
      var t = el('text', { x: P.l - 10, y: y(v) + 4, class: 'tick tick-y' });
      t.textContent = v + '%'; g.appendChild(t);
    }
    MAGS.forEach(function (m) {
      var t = el('text', { x: x(m), y: H - P.b + 20, class: 'tick tick-x' });
      t.textContent = m.toFixed(m === 0 ? 0 : 2).replace(/0$/, '').replace(/\.$/, '');
      g.appendChild(t);
    });
    var xl = el('text', { x: (P.l + W - P.r) / 2, y: H - 6, class: 'axis-label' });
    xl.textContent = 'Push magnitude (m/s)'; g.appendChild(xl);

    var state = 1, paths = {}, dots = {}, labels = {};
    SERIES.forEach(function (s) {
      var c = color(s.slot);
      paths[s.key] = el('path', { class: 'series-line', stroke: c, fill: 'none' });
      g.appendChild(paths[s.key]);
      dots[s.key] = MAGS.map(function () {
        var d = el('circle', { r: 4.5, fill: c, class: 'series-dot' });
        g.appendChild(d); return d;
      });
      labels[s.key] = el('text', { class: 'series-label', fill: c });
      labels[s.key].textContent = s.name; g.appendChild(labels[s.key]);
    });

    function dAttr(vals) {
      return vals.map(function (v, i) { return (i ? 'L' : 'M') + x(MAGS[i]) + ' ' + y(v); }).join(' ');
    }
    function place(vals) {
      SERIES.forEach(function (s) {
        paths[s.key].setAttribute('d', dAttr(vals[s.key]));
        vals[s.key].forEach(function (v, i) {
          dots[s.key][i].setAttribute('cx', x(MAGS[i]));
          dots[s.key][i].setAttribute('cy', y(v));
        });
        labels[s.key].setAttribute('x', W - P.r + 10);
        labels[s.key].setAttribute('y', y(vals[s.key][vals[s.key].length - 1]) + 4);
      });
    }

    var cur = {};
    SERIES.forEach(function (s) { cur[s.key] = SEV[state][s.key].slice(); });
    place(cur);

    function animateTo(idx) {
      var from = {}, to = {};
      SERIES.forEach(function (s) { from[s.key] = cur[s.key].slice(); to[s.key] = SEV[idx][s.key]; });
      if (reduced) { SERIES.forEach(function (s) { cur[s.key] = to[s.key].slice(); }); place(cur); return; }
      var t0 = performance.now(), D = 520;
      (function step(now) {
        var k = ease(Math.min(1, (now - t0) / D));
        SERIES.forEach(function (s) {
          cur[s.key] = from[s.key].map(function (a, i) { return a + (to[s.key][i] - a) * k; });
        });
        place(cur);
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    }

    // legend
    var leg = document.querySelector('.chart-legend');
    SERIES.forEach(function (s) {
      var i = document.createElement('span');
      i.className = 'lg';
      i.innerHTML = '<i style="background:' + color(s.slot) + '"></i>' + s.name;
      leg.appendChild(i);
    });

    // severity toggle
    document.querySelectorAll('.sev-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.sev-btn').forEach(function (o) { o.classList.remove('is-active'); });
        b.classList.add('is-active');
        state = Number(b.dataset.sev);
        animateTo(state);
        buildTable(state);
      });
    });

    // draw-in on first reveal
    var drawn = false;
    new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting || drawn) return;
      drawn = true;
      if (reduced) return;
      SERIES.forEach(function (s, n) {
        var p = paths[s.key], len = p.getTotalLength();
        p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
        p.style.transition = 'stroke-dashoffset 900ms cubic-bezier(.2,.7,.3,1) ' + (n * 110) + 'ms';
        requestAnimationFrame(function () { p.style.strokeDashoffset = 0; });
        dots[s.key].forEach(function (d, i) {
          d.style.opacity = 0;
          d.style.transition = 'opacity 260ms ease ' + (n * 110 + 420 + i * 70) + 'ms';
          requestAnimationFrame(function () { d.style.opacity = 1; });
        });
      });
    }, { threshold: 0.25 }).observe(lineSvg);

    // data table (also the relief for the light-mode contrast warning)
    var table = document.querySelector('.dtable');
    function buildTable(idx) {
      var h = '<caption>' + SEV[idx].label + '</caption><thead><tr><th>Push (m/s)</th>' +
        SERIES.map(function (s) { return '<th>' + s.name + '</th>'; }).join('') + '</tr></thead><tbody>';
      MAGS.forEach(function (m, i) {
        h += '<tr><td>' + m.toFixed(2) + '</td>' +
          SERIES.map(function (s) { return '<td>' + SEV[idx][s.key][i].toFixed(1) + '</td>'; }).join('') + '</tr>';
      });
      table.innerHTML = h + '</tbody>';
    }
    buildTable(state);

    // crosshair + tooltip
    var tip = document.createElement('div');
    tip.className = 'chart-tip'; tip.hidden = true;
    lineSvg.parentNode.appendChild(tip);
    var cross = el('line', { class: 'crosshair' }); g.appendChild(cross);
    cross.style.opacity = 0;

    lineSvg.addEventListener('pointermove', function (ev) {
      var r = lineSvg.getBoundingClientRect();
      var px = (ev.clientX - r.left) / r.width * W;
      var i = 0, best = 1e9;
      MAGS.forEach(function (m, n) { var d = Math.abs(x(m) - px); if (d < best) { best = d; i = n; } });
      cross.setAttribute('x1', x(MAGS[i])); cross.setAttribute('x2', x(MAGS[i]));
      cross.setAttribute('y1', P.t); cross.setAttribute('y2', H - P.b);
      cross.style.opacity = 1;
      tip.hidden = false;
      tip.innerHTML = '<b>' + MAGS[i].toFixed(2) + ' m/s</b>' + SERIES.map(function (s) {
        return '<span><i style="background:' + color(s.slot) + '"></i>' + s.name +
               '<b>' + SEV[state][s.key][i].toFixed(1) + '%</b></span>';
      }).join('');
      var lx = x(MAGS[i]) / W * r.width;
      tip.style.left = Math.min(r.width - 170, Math.max(8, lx + 12)) + 'px';
      tip.style.top = '12px';
    });
    lineSvg.addEventListener('pointerleave', function () {
      cross.style.opacity = 0; tip.hidden = true;
    });
  }

  // ---- bar chart -----------------------------------------------------------
  var barSvg = document.querySelector('.chart-bar');
  if (barSvg) {
    var W = 720, H = 400, P = { t: 26, r: 20, b: 52, l: 48 };
    barSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var y = function (v) { return P.t + (1 - v / 100) * (H - P.t - P.b); };
    var g = el('g'); barSvg.appendChild(g);
    for (var v = 0; v <= 100; v += 25) {
      g.appendChild(el('line', { x1: P.l, x2: W - P.r, y1: y(v), y2: y(v), class: 'grid' }));
      var t = el('text', { x: P.l - 10, y: y(v) + 4, class: 'tick tick-y' });
      t.textContent = v + '%'; g.appendChild(t);
    }
    var bw = 118, gap = (W - P.l - P.r - COMP.length * bw) / (COMP.length + 1);
    var rects = COMP.map(function (d, i) {
      var bx = P.l + gap + i * (bw + gap);
      var slot = SERIES.filter(function (s) { return s.key === d.key; })[0].slot;
      var r = el('rect', { x: bx, width: bw, rx: 4, fill: color(slot), y: y(0), height: 0 });
      g.appendChild(r);
      var lab = el('text', { x: bx + bw / 2, y: H - P.b + 20, class: 'tick tick-x' });
      lab.textContent = d.name; g.appendChild(lab);
      var val = el('text', { x: bx + bw / 2, y: y(d.v) - 10, class: 'bar-value' });
      val.textContent = d.v.toFixed(1) + '%'; val.style.opacity = 0; g.appendChild(val);
      return { r: r, val: val, d: d };
    });
    new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      rects.forEach(function (o, i) {
        var hgt = y(0) - y(o.d.v);
        if (reduced) { o.r.setAttribute('y', y(o.d.v)); o.r.setAttribute('height', hgt); o.val.style.opacity = 1; return; }
        o.r.style.transition = 'y 760ms cubic-bezier(.2,.7,.3,1) ' + (i*110) + 'ms, height 760ms cubic-bezier(.2,.7,.3,1) ' + (i*110) + 'ms';
        o.val.style.transition = 'opacity 300ms ease ' + (i*110 + 620) + 'ms';
        requestAnimationFrame(function () {
          o.r.setAttribute('y', y(o.d.v)); o.r.setAttribute('height', hgt); o.val.style.opacity = 1;
        });
      });
    }, { threshold: 0.3 }).observe(barSvg);
  }
})();
