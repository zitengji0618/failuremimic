// FailureMimic project page: scroll reveals, and clips that load and play only while watched.

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Mark that JS is live, so the reveal styles only hide content we can bring back.
  document.documentElement.classList.add('js');

  // --- scroll reveals ---------------------------------------------------------
  // Each .reveal fades up once a slice of it has entered the viewport. One-shot:
  // scrolling back up does not replay it.
  function startReveals() {
    var items = document.querySelectorAll('.reveal');
    if (reduced || !('IntersectionObserver' in window)) {
      for (var i = 0; i < items.length; i++) items[i].classList.add('in');
      return;
    }
    var ob = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        ob.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) { ob.observe(el); });
  }

  // --- clips ------------------------------------------------------------------
  // A clip carries its address in data-src and fetches nothing until it is about a
  // screen away. It plays once a quarter of it is on screen and pauses when it
  // leaves, so the clip in view has the connection to itself. A clip the visitor
  // paused by hand stays paused, and under reduced motion nothing starts on its own.
  function startClips() {
    var vids = Array.prototype.slice.call(document.querySelectorAll('video[data-src]'));
    if (!vids.length) return;

    function attach(v) {
      if (!v.dataset.src) return;
      // Once the address is set, pull just enough to paint the first frame, so the
      // slot shows the clip rather than an empty box while it waits to be watched.
      v.preload = 'metadata';
      v.src = v.dataset.src;
      delete v.dataset.src;
    }

    if (!('IntersectionObserver' in window)) {
      vids.forEach(function (v) { attach(v); if (!reduced) v.play().catch(function () {}); });
      return;
    }

    // Fetch ahead of the viewport so a clip is ready by the time it is reached.
    var near = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        near.unobserve(e.target);
        attach(e.target);
      });
    }, { rootMargin: '600px 0px' });

    // Play only what is actually being watched, and only a few at a time: decoding
    // several clips at once is what makes a grid of them stutter. The most-visible
    // clips win; the rest hold on their first frame until they are scrolled to.
    var MAX_PLAYING = 2;
    var ratios = new Map();

    function rebalance() {
      var ranked = [];
      ratios.forEach(function (r, v) { if (r >= 0.25) ranked.push([v, r]); });
      ranked.sort(function (a, b) { return b[1] - a[1]; });
      var keep = new Set(ranked.slice(0, MAX_PLAYING).map(function (x) { return x[0]; }));
      ratios.forEach(function (r, v) {
        if (keep.has(v)) {
          if (reduced || v.dataset.userPaused === '1') return;
          attach(v);
          if (v.paused) v.play().catch(function () {});
        } else if (!v.paused) {
          v.pause();
        }
      });
    }

    var watch = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { ratios.set(e.target, e.intersectionRatio); });
      rebalance();
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });

    // Safety net: anything already in or near the viewport is attached on the next
    // frame, so a clip never sits blank waiting on an observer's first delivery.
    requestAnimationFrame(function () {
      var h = window.innerHeight || document.documentElement.clientHeight;
      vids.forEach(function (v) {
        if (!v.dataset.src) return;
        var r = v.getBoundingClientRect();
        if (r.top < h + 600 && r.bottom > -600) attach(v);
      });
    });

    vids.forEach(function (v) {
      // Remember a deliberate pause, so we do not fight the visitor on scroll.
      v.addEventListener('pause', function () {
        if (!v.seeking && v.readyState > 2) v.dataset.userPaused = '1';
      });
      v.addEventListener('play', function () { v.dataset.userPaused = '0'; });
      near.observe(v);
      watch.observe(v);
    });
  }

  // --- clip groups ------------------------------------------------------------
  // One panel visible per group. Hidden panels are display:none, so their videos
  // never intersect the viewport and the watcher never loads or plays them.
  var CLIP_GROUPS = {};
  window.fmShowClip = function (gid, i) {
    var fn = CLIP_GROUPS[gid];
    if (fn) { fn(i); return true; }
    return false;
  };

  function startGroups() {
    document.querySelectorAll('.clip-group').forEach(function (g) {
      var tabs = Array.prototype.slice.call(g.querySelectorAll('.clip-tab, .clip-thumb'));
      var panels = Array.prototype.slice.call(g.querySelectorAll('.clip-panel'));
      if (tabs.length !== panels.length) return;

      function show(i) {
        tabs.forEach(function (t, n) {
          t.classList.toggle('is-active', n === i);
          t.setAttribute('aria-selected', n === i ? 'true' : 'false');
        });
        panels.forEach(function (p, n) {
          var on = n === i;
          p.classList.toggle('is-active', on);
          var v = p.querySelector('video');
          if (!v) return;
          if (on) {
            v.dataset.userPaused = '0';
          } else if (!v.paused) {
            v.pause();
          }
        });
      }

      if (g.dataset.groupId) CLIP_GROUPS[g.dataset.groupId] = show;

      tabs.forEach(function (t, i) {
        t.addEventListener('click', function () { show(i); });
        t.addEventListener('keydown', function (e) {
          var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (!d) return;
          e.preventDefault();
          var n = (i + d + tabs.length) % tabs.length;
          tabs[n].focus();
          show(n);
        });
      });
    });
  }

  // --- section nav ------------------------------------------------------------
  // Marks the link for the section currently crossing the upper third of the page.
  function startNav() {
    var links = Array.prototype.slice.call(
      document.querySelectorAll('.sectionnav-links a[href^="#"]'));
    if (!links.length || !('IntersectionObserver' in window)) return;

    var byId = {};
    links.forEach(function (a) {
      var el = document.getElementById(a.getAttribute('href').slice(1));
      if (el) byId[el.id] = a;
    });
    var seen = {};

    var ob = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { seen[e.target.id] = e.isIntersecting; });
      var active = null;
      Object.keys(byId).forEach(function (id) { if (seen[id] && !active) active = id; });
      links.forEach(function (a) {
        a.classList.toggle('on', byId[active] === a);
      });
    }, { rootMargin: '-10% 0px -70% 0px', threshold: 0 });

    Object.keys(byId).forEach(function (id) {
      ob.observe(document.getElementById(id));
    });
  }

  // --- G1 joint diagram --------------------------------------------------------
  function startG1() {
    var svg = document.querySelector('.g1-svg');
    var out = document.querySelector('.g1-readout');
    if (!svg || !out) return;
    var hint = out.querySelector('.g1-hint');
    var box  = out.querySelector('.g1-detail');
    var name = out.querySelector('.g1-name');
    var meta = out.querySelector('.g1-meta');
    var demo = out.querySelector('.g1-demo');
    var joints = Array.prototype.slice.call(svg.querySelectorAll('.g1-joint'));
    var pinned = null;

    function render(el) {
      if (!el) { hint.hidden = false; box.hidden = true; return; }
      hint.hidden = true; box.hidden = false;
      name.textContent = el.dataset.label;
      meta.textContent = el.dataset.group + ' group';
      var st = el.dataset.state, where = el.dataset.where;
      if (st) {
        demo.innerHTML = '<span class="g1-badge ' + st + '">' + st + '</span>' +
          'shown in <b>' + where + '</b>';
      } else {
        demo.innerHTML = '<span class="g1-meta">Not impaired in any clip on this page.</span>';
      }
    }

    function select(el) {
      pinned = el;
      joints.forEach(function (j) { j.classList.toggle('is-sel', j === el); });
      render(el);
    }

    joints.forEach(function (j) {
      j.addEventListener('mouseenter', function () { if (!pinned) render(j); });
      j.addEventListener('mouseleave', function () { if (!pinned) render(null); });
      j.addEventListener('focus', function () { render(j); });
      j.addEventListener('click', function () { select(pinned === j ? null : j); });
      j.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(pinned === j ? null : j); }
      });
    });
  }

  // Overview diagram: hover/focus explains each block; flow runs only on screen.
  function startOverview() {
    document.querySelectorAll('.ovw').forEach(wireDiagram);
  }

  function wireDiagram(ovw) {
    var tip = ovw.querySelector('.ovw-tip');
    if (!tip) return;

    function place(target) {
      var r = target.getBoundingClientRect(), o = ovw.getBoundingClientRect();
      tip.hidden = false;
      tip.innerHTML = target.dataset.tip;
      var w = tip.offsetWidth, h = tip.offsetHeight;
      var x = r.left - o.left + r.width / 2 - w / 2;
      var y = r.top - o.top - h - 10;
      if (y < 0) y = r.bottom - o.top + 10;
      tip.style.left = Math.max(4, Math.min(o.width - w - 4, x)) + 'px';
      tip.style.top = y + 'px';
    }
    function hide() { tip.hidden = true; }

    ovw.querySelectorAll('.ovw-block').forEach(function (b) {
      b.addEventListener('mouseenter', function () { place(b); b.classList.add('is-on'); });
      b.addEventListener('mouseleave', function () { hide(); b.classList.remove('is-on'); });
      b.addEventListener('focus', function () { place(b); b.classList.add('is-on'); });
      b.addEventListener('blur', function () { hide(); b.classList.remove('is-on'); });
    });
    ovw.addEventListener('pointerleave', hide);

    var btn = ovw.querySelector('.ovw-flowbtn');
    if (btn) btn.addEventListener('click', function () {
      var off = ovw.classList.toggle('flow-off');
      btn.setAttribute('aria-pressed', off ? 'false' : 'true');
    });
  }

  function startFigFlow() {
    var stacks = document.querySelectorAll('.ovw');
    if (!stacks.length || !('IntersectionObserver' in window)) return;
    var ob = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle('is-live', e.isIntersecting); });
    }, { threshold: 0.15 });
    stacks.forEach(function (s) { ob.observe(s); });
  }

  // Theme toggle. Light unless the visitor picks dark; the choice is remembered.
  function startTheme() {
    var btn = document.querySelector('.theme-btn');
    if (!btn) return;
    var root = document.documentElement;

    function paint() {
      var dark = root.getAttribute('data-theme') === 'dark';
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
      btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    }
    paint();

    btn.addEventListener('click', function () {
      var dark = root.getAttribute('data-theme') === 'dark';
      if (dark) root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', 'dark');
      try { localStorage.setItem('fm-theme', dark ? 'light' : 'dark'); } catch (e) {}
      paint();
    });
  }

  function init() {
    // The carousel runs first: it may move or clone its slides, and the clip
    // observers must see the nodes that actually end up in the page.
    if (window.bulmaCarousel) {
      bulmaCarousel.attach('.carousel', {
        slidesToScroll: 1, slidesToShow: 3, loop: true, infinite: true, autoplay: false
      });
    }
    if (window.bulmaSlider) bulmaSlider.attach();
    startTheme();
    startNav();
    startFigFlow();
    startOverview();
    startG1();
    startGroups();
    startReveals();
    startClips();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
