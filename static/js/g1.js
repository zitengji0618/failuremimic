// Interactive Unitree G1 joint model.
// The robot is the MuJoCo Menagerie G1 (BSD-3, Unitree Robotics), baked to a single
// GLB at a fixed pose; the 29 joint markers are placed at their world positions from
// the same MJCF. Nothing loads until the section is scrolled near.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const COLORS = {
  trunk: 0x4a7fb5, larm: 0xe8943a, rarm: 0xb98bbd, lleg: 0x5eb562, rleg: 0xe8696b,
};
const GROUP_LABEL = {
  trunk: 'Trunk', larm: 'L arm', rarm: 'R arm', lleg: 'L leg', rleg: 'R leg',
};

const stage = document.querySelector('.g1-stage');
const canvas = document.querySelector('.g1-canvas');
const readout = document.querySelector('.g1-readout');
if (stage && canvas && readout) {
  const near = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    near.disconnect();
    boot().catch((err) => {
      console.error(err);
      const l = stage.querySelector('.g1-loading');
      if (l) l.textContent = 'Could not load the 3D model.';
    });
  }, { rootMargin: '400px 0px' });
  near.observe(stage);
}

async function boot() {
  const hint = readout.querySelector('.g1-hint');
  const box = readout.querySelector('.g1-detail');
  const nameEl = readout.querySelector('.g1-name');
  const metaEl = readout.querySelector('.g1-meta');
  const demoEl = readout.querySelector('.g1-demo');

  const joints = await fetch('./static/models/g1_joints.json').then((r) => r.json());

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x66707d, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(2.2, 3.0, 2.6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbcd2e8, 0.8);
  rim.position.set(-2.4, 1.2, -2.0);
  scene.add(rim);

  // MJCF is Z-up; Three is Y-up.
  const root = new THREE.Group();
  root.rotation.x = -Math.PI / 2;
  scene.add(root);

  const gltf = await new GLTFLoader().loadAsync('./static/models/g1.glb');
  // The GLB carries no normals: shading them per-face keeps the mechanical edges
  // crisp instead of averaging them into a soft, melted-looking surface.
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.material.flatShading = true;
    o.material.needsUpdate = true;
    if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
  });
  root.add(gltf.scene);

  // joint markers
  const geo = new THREE.SphereGeometry(0.0125, 18, 14);
  const markers = joints.map((j) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: COLORS[j.group] || 0x888888,
      depthTest: false, transparent: true, opacity: 1,
    }));
    m.renderOrder = 10;
    m.position.set(j.pos[0], j.pos[1], j.pos[2]);
    m.userData = j;
    root.add(m);
    if (j.state) {                                   // ring marks a demonstrated joint
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.0215, 0.0032, 8, 24),
        new THREE.MeshBasicMaterial({
          color: j.state === 'damped' ? 0xf0a500 : 0x14171c,
          depthTest: false, transparent: true, opacity: 1,
        }));
      ring.renderOrder = 11;
      ring.position.copy(m.position);
      ring.userData = j;
      root.add(ring);
      m.userData.ring = ring;
    }
    return m;
  });

  // frame the robot. MJCF is Z-up / +X-forward; after root's -90deg X rotation the
  // robot faces world +X, so the camera belongs on +X to see its front, not +Z.
  root.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(gltf.scene);
  const c = bb.getCenter(new THREE.Vector3());
  const h = bb.getSize(new THREE.Vector3()).y;
  const d = h * 2.0;                       // fits 1.32m at a 32deg vertical fov
  const CENTER = new THREE.Vector3().copy(c);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(c);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = h * 0.8;
  controls.maxDistance = h * 3.6;
  camera.position.set(c.x + d * 0.88, c.y + h * 0.06, c.z + d * 0.47);
  controls.update();

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.autoRotate = !reduced;
  controls.autoRotateSpeed = 0.9;
  ['pointerdown', 'wheel', 'touchstart'].forEach((e) =>
    renderer.domElement.addEventListener(e, () => { controls.autoRotate = false; }, { passive: true }));

  const loading = stage.querySelector('.g1-loading');
  if (loading) loading.remove();

  // picking
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  let hovered = null, pinned = null;

  function show(j) {
    if (!j) { hint.hidden = false; box.hidden = true; return; }
    hint.hidden = true; box.hidden = false;
    nameEl.textContent = j.label;
    metaEl.textContent = GROUP_LABEL[j.group] + ' group';
    const clips = j.clips || [];
    if (!j.state) {
      demoEl.innerHTML = '<span class="g1-dim">Not impaired in any clip on this page. ' +
        'Any joint can be, once a policy is trained for it.</span>';
    } else if (clips.length === 1) {
      demoEl.innerHTML = `<span class="g1-badge ${j.state}">${j.state}</span>` +
        `shown in <b>${clips[0].label}</b>` +
        '<span class="g1-go">click the joint to jump to the clip</span>';
    } else {
      demoEl.innerHTML = `<span class="g1-badge ${j.state}">${j.state}</span>` +
        `shown in <b>${clips.length} clips</b>` +
        '<span class="g1-go">click the joint, then pick one</span>' +
        '<span class="g1-choices">' + clips.map((c, i) =>
          `<button type="button" class="g1-choice" data-gid="${c.gid}" data-clip="${c.clip}">` +
          `${c.label}</button>`).join('') + '</span>';
    }
  }

  function goTo(gid, clip) {
    if (!window.fmShowClip || !window.fmShowClip(gid, clip)) return;
    const el = document.querySelector(`[data-group-id="${gid}"]`);
    if (!el) return;
    el.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center',
    });
    el.classList.add('clip-group--flash');
    setTimeout(() => el.classList.remove('clip-group--flash'), 1200);
  }

  readout.addEventListener('click', (ev) => {
    const b = ev.target.closest('.g1-choice');
    if (b) goTo(b.dataset.gid, Number(b.dataset.clip));
  });

  function paint() {
    markers.forEach((m) => {
      const on = m === pinned || m === hovered;
      m.scale.setScalar(on ? 1.75 : 1);
      if (m.userData.ring) m.userData.ring.scale.setScalar(on ? 1.35 : 1);
    });
  }

  // Markers are drawn over the mesh, so the ones round the back are faded to keep
  // the near side readable without hiding anything the visitor might want to click.
  const toCam = new THREE.Vector3(), toJoint = new THREE.Vector3();
  function depthFade() {
    toCam.copy(camera.position).sub(CENTER).normalize();
    markers.forEach((m) => {
      toJoint.copy(m.position).applyMatrix4(root.matrixWorld).sub(CENTER);
      const front = toJoint.dot(toCam) > -0.02;
      const o = (m === pinned || m === hovered) ? 1 : (front ? 1 : 0.28);
      m.material.opacity = o;
      if (m.userData.ring) m.userData.ring.material.opacity = o;
    });
  }

  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(markers, false)[0];
    return hit ? hit.object : null;
  }

  renderer.domElement.addEventListener('pointermove', (ev) => {
    hovered = pick(ev);
    renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
    if (!pinned) show(hovered ? hovered.userData : null);
    paint();
  });
  renderer.domElement.addEventListener('click', (ev) => {
    const hit = pick(ev);
    pinned = pinned === hit ? null : hit;
    show(pinned ? pinned.userData : null);
    paint();
    const j = hit && hit.userData;
    const clips = (j && j.clips) || [];
    if (clips.length === 1) goTo(clips[0].gid, clips[0].clip);
    // with several clips the readout now shows a chooser; the visitor picks.
  });

  function resize() {
    const w = stage.clientWidth, hh = stage.clientHeight;
    if (!w || !hh) return;
    renderer.setSize(w, hh, false);
    camera.aspect = w / hh;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; },
    { threshold: 0 }).observe(stage);

  (function loop() {
    requestAnimationFrame(loop);
    if (!visible) return;                 // no GPU work while off screen
    controls.update();
    markers.forEach((m) => { if (m.userData.ring) m.userData.ring.quaternion.copy(camera.quaternion); });
    depthFade();
    renderer.render(scene, camera);
  })();
}


// --- the small part-coloured G1 inside the overview diagram --------------------
const ovwCanvas = document.querySelector('.ovw-robot');
if (ovwCanvas) {
  const near2 = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return;
    near2.disconnect();
    bootOverviewRobot().catch((e) => { console.error(e); ovwCanvas.remove(); });
  }, { rootMargin: '400px 0px' });
  near2.observe(ovwCanvas);
}

async function bootOverviewRobot() {
  const PART = { trunk: 0x4a7fb5, larm: 0xe8943a, rarm: 0xb98bbd, lleg: 0x5eb562, rleg: 0xe8696b };
  const renderer = new THREE.WebGLRenderer({ canvas: ovwCanvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x7a828f, 2.4));
  const k = new THREE.DirectionalLight(0xffffff, 1.5); k.position.set(1.6, 2.4, 2.4); scene.add(k);

  const g = new THREE.Group(); g.rotation.x = -Math.PI / 2; scene.add(g);
  const gltf = await new GLTFLoader().loadAsync('./static/models/g1.glb');
  // Recolour by the part half of each material's name, so the robot reads as the
  // same five groups the decoder is factorized over.
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const part = (o.material.name || '').split('|')[0];
    o.material = new THREE.MeshStandardMaterial({
      color: PART[part] || 0x9aa3b0, flatShading: true, roughness: 0.55, metalness: 0.05,
    });
    if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
  });
  g.add(gltf.scene);
  g.updateMatrixWorld(true);

  const bb = new THREE.Box3().setFromObject(gltf.scene);
  const c = bb.getCenter(new THREE.Vector3());
  const h = bb.getSize(new THREE.Vector3()).y;
  cam.position.set(c.x + h * 1.9, c.y + h * 0.04, c.z + h * 0.65);
  cam.lookAt(c);

  function size() {
    const w = ovwCanvas.clientWidth, hh = ovwCanvas.clientHeight;
    if (!w || !hh) return;
    renderer.setSize(w, hh, false);
    cam.aspect = w / hh; cam.updateProjectionMatrix();
  }
  new ResizeObserver(size).observe(ovwCanvas); size();

  let on = true;
  new IntersectionObserver(([e]) => { on = e.isIntersecting; }, { threshold: 0 }).observe(ovwCanvas);
  // Drag turns the robot about its own vertical axis only. No pitch, so it can
  // never end up tipped or upside down, and no zoom, so the page still scrolls.
  let yaw = 0, dragging = false, lastX = 0, touched = false;
  const SPEED = 0.011;

  ovwCanvas.addEventListener('pointerdown', (e) => {
    dragging = true; touched = true; lastX = e.clientX;
    ovwCanvas.setPointerCapture(e.pointerId);
    ovwCanvas.style.cursor = 'grabbing';
  });
  ovwCanvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    yaw += (e.clientX - lastX) * SPEED;
    lastX = e.clientX;
  });
  const release = (e) => {
    if (!dragging) return;
    dragging = false;
    ovwCanvas.style.cursor = 'grab';
    if (e && e.pointerId !== undefined && ovwCanvas.hasPointerCapture(e.pointerId)) {
      ovwCanvas.releasePointerCapture(e.pointerId);
    }
  };
  ovwCanvas.addEventListener('pointerup', release);
  ovwCanvas.addEventListener('pointercancel', release);

  const sway = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const t0 = performance.now();
  (function loop() {
    requestAnimationFrame(loop);
    if (!on) return;
    // Front-on with a gentle sway until the visitor takes hold of it.
    g.rotation.z = touched ? yaw
      : (sway ? Math.sin((performance.now() - t0) / 2600) * 0.26 : 0);
    renderer.render(scene, cam);
  })();
}


// --- the two small G1 renders inside the overview boxes -----------------------
// One offscreen renderer draws the robot twice (plain, and with the five tracked
// bodies marked); the results are blitted into the box canvases, so these cost a
// couple of frames rather than two more live WebGL contexts.
const refC = document.querySelector('.ovw-ref');
const cmdC = document.querySelector('.ovw-cmd');
if (refC && cmdC) {
  const near3 = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return;
    near3.disconnect();
    bootBoxFigures().catch((e) => { console.error(e); refC.remove(); cmdC.remove(); });
  }, { rootMargin: '400px 0px' });
  near3.observe(refC);
}

async function bootBoxFigures() {
  const PART = { trunk: 0x4a7fb5, larm: 0xe8943a, rarm: 0xb98bbd, lleg: 0x5eb562, rleg: 0xe8696b };
  const W = 420, H = 620;
  const off = document.createElement('canvas'); off.width = W; off.height = H;
  const r = new THREE.WebGLRenderer({ canvas: off, antialias: true, alpha: true });
  r.setPixelRatio(2);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(26, W / H, 0.1, 50);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x7a828f, 2.5));
  const k = new THREE.DirectionalLight(0xffffff, 1.4); k.position.set(1.4, 2.4, 2.6); scene.add(k);

  const g = new THREE.Group(); g.rotation.x = -Math.PI / 2; scene.add(g);
  const gltf = await new GLTFLoader().loadAsync('./static/models/g1.glb');
  const robot = gltf.scene;
  robot.traverse((o) => {
    if (!o.isMesh) return;
    const part = (o.material.name || '').split('|')[0];
    o.material = new THREE.MeshStandardMaterial({
      color: PART[part] || 0x9aa3b0, flatShading: true, roughness: 0.6, metalness: 0.04,
    });
    if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
  });
  g.add(robot); g.updateMatrixWorld(true);

  const bb = new THREE.Box3().setFromObject(robot);
  const c = bb.getCenter(new THREE.Vector3());
  const h = bb.getSize(new THREE.Vector3()).y;
  cam.position.set(c.x + h * 2.2, c.y, c.z); cam.lookAt(c);

  function blit(dst, draws) {
    const dpr = Math.min(devicePixelRatio, 2);
    dst.width = dst.clientWidth * dpr; dst.height = dst.clientHeight * dpr;
    const ctx = dst.getContext('2d');
    ctx.clearRect(0, 0, dst.width, dst.height);
    const s = Math.min(dst.width / W, dst.height / H);
    draws.forEach((d) => {
      ctx.globalAlpha = d.a;
      const w = W * s, hh = H * s;
      ctx.drawImage(off, (dst.width - w) / 2 + d.dx * dst.width, (dst.height - hh) / 2, w, hh);
    });
    ctx.globalAlpha = 1;
  }

  // 1. Reference motions: three frames of a stride, each its own posed model,
  //    drawn back to front so the sequence reads as movement rather than a shift.
  const poses = await Promise.all([0, 1, 2].map((i) =>
    new GLTFLoader().loadAsync(`./static/models/g1_pose${i}.glb`)));
  const ghosts = [];
  for (let i = 0; i < poses.length; i++) {
    const sc = poses[i].scene;
    sc.traverse((o) => {
      if (!o.isMesh) return;
      const part = (o.material.name || '').split('|')[0];
      o.material = new THREE.MeshStandardMaterial({
        color: PART[part] || 0x9aa3b0, flatShading: true, roughness: 0.6, metalness: 0.04,
      });
      if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
    });
    sc.visible = false;
    g.add(sc);
    ghosts.push(sc);
  }
  robot.visible = false;
  // Frame on the poses, not the base robot: bent knees change the extent.
  const pb = new THREE.Box3();
  g.updateMatrixWorld(true);
  ghosts.forEach((gh) => { gh.visible = true; pb.expandByObject(gh); });
  const pc = pb.getCenter(new THREE.Vector3());
  const ph = pb.getSize(new THREE.Vector3()).y;
  cam.position.set(pc.x + ph * 2.3, pc.y, pc.z);
  cam.lookAt(pc);

  const frames = [];
  for (let i = 0; i < ghosts.length; i++) {
    ghosts.forEach((gh, n) => { gh.visible = n === i; });
    r.render(scene, cam);
    // setPixelRatio resizes the drawing buffer, so copy at ITS size, not W/H.
    const c2 = document.createElement('canvas');
    c2.width = off.width; c2.height = off.height;
    c2.getContext('2d').drawImage(off, 0, 0);
    frames.push(c2);
  }
  ghosts.forEach((gh) => { gh.visible = false; });
  robot.visible = true;

  (function () {
    const dpr = Math.min(devicePixelRatio, 2);
    refC.width = refC.clientWidth * dpr; refC.height = refC.clientHeight * dpr;
    const ctx = refC.getContext('2d');
    const sw = frames[0].width, sh = frames[0].height;
    const sc = Math.min(refC.width / sw, refC.height / sh);
    const w = sw * sc, hh = sh * sc;
    [{ a: 0.3, dx: -0.17 }, { a: 0.6, dx: -0.085 }, { a: 1, dx: 0 }].forEach((d, i) => {
      ctx.globalAlpha = d.a;
      ctx.drawImage(frames[i], (refC.width - w) / 2 + d.dx * refC.width, (refC.height - hh) / 2, w, hh);
    });
    ctx.globalAlpha = 1;
  })();

  cam.position.set(c.x + h * 2.2, c.y, c.z); cam.lookAt(c);

  // 2. the same robot with the five tracked bodies marked
  const KP = [
    [0.00,  0.000, 0.95,  PART.trunk],
    [0.20,  0.149, 0.888, PART.larm],
    [0.20, -0.149, 0.888, PART.rarm],
    [0.00,  0.119, 0.036, PART.lleg],
    [0.00, -0.119, 0.036, PART.rleg],
  ];
  const sph = new THREE.SphereGeometry(0.052, 18, 14);
  KP.forEach(([x, y, z, col]) => {
    const m = new THREE.Mesh(sph, new THREE.MeshBasicMaterial({ color: col, depthTest: false }));
    m.position.set(x, y, z); m.renderOrder = 10; g.add(m);
  });
  r.render(scene, cam);
  blit(cmdC, [{ a: 1, dx: 0 }]);

  r.dispose();
}
