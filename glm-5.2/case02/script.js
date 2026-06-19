/**
 * Relativity Sandbox — simplified N-body gravity in true 3D.
 *
 * Architecture (kept modular inside one file, no build step):
 *   - utils/        small math helpers + ids
 *   - config        tunable constants
 *   - Body          data + three.js mesh for one body
 *   - Simulation    physics: N-body gravity, integration, collisions
 *   - Curvature     deformable "spacetime fabric" grid mesh
 *   - Trails        per-body line trails
 *   - Renderer/Scene  three.js setup + orbit controls + animation loop
 *   - UI            DOM wiring (add/edit/delete, sliders, toggles)
 *
 * See README.md for the physics approximations and stability tricks.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ───────────────────────── config ───────────────────────── */
const CONFIG = {
  G: 1.0,                // gravitational constant (display units; scaled by gravity slider)
  softening: 1.2,        // epsilon — prevents singularities at close range
  maxAccel: 200,         // clamp on |a| (stability)
  maxSpeed: 60,          // clamp on |v| (stability)
  baseSubsteps: 2,       // physics substeps per render frame (more = more stable, slower)
  trailMax: 300,         // default trail point count (overridden by slider)
  curvatureSize: 120,    // width/depth of curvature grid in world units
  curvatureSegs: 96,     // grid resolution (96x96 verts)
  curvatureAmp: 0.9,     // vertical exaggeration of the wells
  // density -> radius: treat bodies as equal-density spheres, r = k * m^(1/3)
  radiusK: 0.16,
  radiusMin: 0.25,
  dt: 1 / 60,            // base timestep
  dilationStrength: 1.0, // how strongly potential wells redden bodies
};

/* ───────────────────────── utils ───────────────────────── */
const uid = (() => { let n = 1; return () => n++; })();

const tmpV = new THREE.Vector3();
function radiusFromMass(m) {
  return Math.max(CONFIG.radiusMin, CONFIG.radiusK * Math.cbrt(Math.max(m, 0)));
}
// gravitational-potential-like depth of a point under a body (used by curvature + dilation)
function wellDepth(pos, body) {
  const dx = pos.x - body.pos.x;
  const dy = pos.y - body.pos.y;
  const dz = pos.z - body.pos.z;
  const r2 = dx * dx + dy * dy + dz * dz + CONFIG.softening * CONFIG.softening;
  return body.mass / Math.sqrt(r2); // ~GM/r potential magnitude
}

/* ───────────────────────── Body ───────────────────────── */
class Body {
  constructor({ mass, pos, vel, color }) {
    this.id = uid();
    this.mass = mass;
    this.pos = new THREE.Vector3().copy(pos);
    this.vel = new THREE.Vector3().copy(vel);
    this.accel = new THREE.Vector3();
    this.baseColor = new THREE.Color(color);
    this.color = new THREE.Color().copy(this.baseColor);
    this.radius = radiusFromMass(mass);

    const geo = new THREE.SphereGeometry(1, 24, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: this.color,
      emissive: this.color.clone().multiplyScalar(0.35),
      roughness: 0.45,
      metalness: 0.1,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(this.pos);
    this.mesh.scale.setScalar(this.radius);
    this.mesh.userData.bodyId = this.id;

    // soft glow sprite for readability on dark bg
    this.glow = makeGlow(this.color);
    this.mesh.add(this.glow);
  }

  setMass(m) {
    this.mass = Math.max(1e-6, m);
    this.radius = radiusFromMass(this.mass);
    this.mesh.scale.setScalar(this.radius);
  }
  setColor(hex) {
    this.baseColor.set(hex);
    // color gets re-tinted each frame by dilation in the scene update
  }
  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

function makeGlow(color) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({
    map: tex, color, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(3.2, 3.2, 1);
  return sp;
}

/* ───────────────────────── Simulation ───────────────────────── */
class Simulation {
  constructor(scene) {
    this.scene = scene;
    this.bodies = [];
    this.G = CONFIG.G;
    this.mergeCount = 0;
  }

  add(opts) {
    const b = new Body(opts);
    this.bodies.push(b);
    this.scene.add(b.mesh);
    return b;
  }
  remove(id) {
    const i = this.bodies.findIndex(b => b.id === id);
    if (i < 0) return;
    this.bodies[i].dispose(this.scene);
    this.bodies.splice(i, 1);
  }
  clear() {
    for (const b of this.bodies) b.dispose(this.scene);
    this.bodies.length = 0;
    this.mergeCount = 0;
  }

  // Compute accelerations for all bodies (Newtonian N-body, softened).
  computeAccelerations() {
    const n = this.bodies.length;
    const eps2 = CONFIG.softening * CONFIG.softening;
    for (let i = 0; i < n; i++) this.bodies[i].accel.set(0, 0, 0);
    for (let i = 0; i < n; i++) {
      const a = this.bodies[i];
      for (let j = i + 1; j < n; j++) {
        const b = this.bodies[j];
        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const dz = b.pos.z - a.pos.z;
        const r2 = dx * dx + dy * dy + dz * dz + eps2;
        const invR = 1 / Math.sqrt(r2);
        const invR3 = invR / r2;            // 1 / (r^2+eps^2)^(3/2)
        // F on a from b  ∝  b.m * dir ; share work for the symmetric pair
        const ka = this.G * b.mass * invR3;
        const kb = this.G * a.mass * invR3;
        a.accel.x += ka * dx; a.accel.y += ka * dy; a.accel.z += ka * dz;
        b.accel.x -= kb * dx; b.accel.y -= kb * dy; b.accel.z -= kb * dz;
      }
      // clamp |a| for stability
      const am = a.accel.length();
      if (am > CONFIG.maxAccel) a.accel.multiplyScalar(CONFIG.maxAccel / am);
    }
  }

  // Velocity-Verlet integrator — symplectic-ish, good energy behavior for orbits.
  step(dt) {
    if (this.bodies.length === 0) return;
    const n = this.bodies.length;
    // x(t+dt) = x + v*dt + 0.5*a*dt^2
    for (let i = 0; i < n; i++) {
      const b = this.bodies[i];
      b.pos.x += b.vel.x * dt + 0.5 * b.accel.x * dt * dt;
      b.pos.y += b.vel.y * dt + 0.5 * b.accel.y * dt * dt;
      b.pos.z += b.vel.z * dt + 0.5 * b.accel.z * dt * dt;
    }
    // a(t+dt) using new positions; stash old accel for the velocity half-step
    const old = this.bodies.map(b => b.accel.clone());
    this.computeAccelerations();
    // v(t+dt) = v + 0.5*(a_old + a_new)*dt
    for (let i = 0; i < n; i++) {
      const b = this.bodies[i];
      b.vel.x += 0.5 * (old[i].x + b.accel.x) * dt;
      b.vel.y += 0.5 * (old[i].y + b.accel.y) * dt;
      b.vel.z += 0.5 * (old[i].z + b.accel.z) * dt;
      const vm = b.vel.length();
      if (vm > CONFIG.maxSpeed) b.vel.multiplyScalar(CONFIG.maxSpeed / vm);
    }
    this.handleCollisions();
  }

  handleCollisions() {
    // O(n^2) overlap check; fine for ~20 bodies. Merge conserves momentum + mass.
    const bs = this.bodies;
    let merged = true;
    while (merged) {
      merged = false;
      outer:
      for (let i = 0; i < bs.length; i++) {
        for (let j = i + 1; j < bs.length; j++) {
          const a = bs[i], b = bs[j];
          const d = a.pos.distanceTo(b.pos);
          if (d < a.radius + b.radius) {
            this.mergePair(i, j);
            merged = true;
            break outer;
          }
        }
      }
    }
  }

  mergePair(i, j) {
    // keep i (heavier preferred), absorb j
    let a = this.bodies[i], b = this.bodies[j];
    if (b.mass > a.mass) { a = this.bodies[j]; b = this.bodies[i]; }
    const M = a.mass + b.mass;
    // center of mass + momentum-conserving velocity
    a.pos.multiplyScalar(a.mass).addScaledVector(b.pos, b.mass).multiplyScalar(1 / M);
    a.vel.multiplyScalar(a.mass).addScaledVector(b.vel, b.mass).multiplyScalar(1 / M);
    // blend colors by mass, set new mass (and radius)
    const c = a.baseColor.clone().lerp(b.baseColor, b.mass / M);
    a.setMass(M);
    a.baseColor.copy(c);
    // remove the lighter one
    this.remove(b.id);
    this.mergeCount++;
  }

  heaviest() {
    let h = null;
    for (const b of this.bodies) if (!h || b.mass > h.mass) h = b;
    return h;
  }
}

/* ───────────────────────── Curvature grid ───────────────────────── */
class Curvature {
  constructor(scene) {
    this.scene = scene;
    const size = CONFIG.curvatureSize, seg = CONFIG.curvatureSegs;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2); // lay flat in XZ plane
    this.basePos = Float32Array.from(geo.attributes.position.array); // resting x,y,z
    // vertex colors: blue (flat) -> magenta (deep well) for visual cue
    const count = geo.attributes.position.count;
    this.colors = new Float32Array(count * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
      emissive: new THREE.Color(0x101830),
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = -8; // sit below the bodies
    scene.add(this.mesh);
    this.posAttr = geo.attributes.position;
  }

  update(bodies) {
    const pos = this.posAttr.array;
    const base = this.basePos;
    const colors = this.colors;
    const amp = CONFIG.curvatureAmp;
    const cFlat = [0.18, 0.32, 0.7];   // cool blue
    const cDeep = [0.85, 0.25, 0.95];  // magenta
    const n = pos.length / 3;
    for (let v = 0; v < n; v++) {
      const ix = v * 3;
      const x = base[ix];
      const z = base[ix + 2];
      let depth = 0;
      for (let k = 0; k < bodies.length; k++) {
        const b = bodies[k];
        const dx = x - b.pos.x;
        const dz = z - b.pos.z;
        const r2 = dx * dx + dz * dz + CONFIG.softening * CONFIG.softening;
        depth += b.mass / Math.sqrt(r2);
      }
      // squash + exaggerate so even small wells read
      const y = -amp * Math.atan(depth * 0.06) * 2.2;
      pos[ix + 1] = y;
      const t = Math.min(1, depth * 0.01);
      colors[ix]     = cFlat[0] + (cDeep[0] - cFlat[0]) * t;
      colors[ix + 1] = cFlat[1] + (cDeep[1] - cFlat[1]) * t;
      colors[ix + 2] = cFlat[2] + (cDeep[2] - cFlat[2]) * t;
    }
    this.posAttr.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
    this.mesh.geometry.computeBoundingSphere();
  }

  setVisible(v) { this.mesh.visible = v; }
}

/* ───────────────────────── Trails ───────────────────────── */
class Trails {
  constructor(scene) {
    this.scene = scene;
    this.max = CONFIG.trailMax;
    this.lines = new Map(); // bodyId -> {geo, positions, count, line}
  }
  ensure(body) {
    if (this.lines.has(body.id)) return this.lines.get(body.id);
    const max = this.max;
    const positions = new Float32Array(max * 3);
    const colors = new Float32Array(max * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    this.scene.add(line);
    const entry = { geo, positions, colors, count: 0, line };
    this.lines.set(body.id, entry);
    return entry;
  }
  push(body) {
    const e = this.ensure(body);
    const max = this.max;
    const { positions, colors } = e;
    if (e.count < max) {
      const ix = e.count * 3;
      positions[ix] = body.pos.x; positions[ix + 1] = body.pos.y; positions[ix + 2] = body.pos.z;
      e.count++;
    } else {
      // shift ring buffer
      positions.copyWithin(0, 3);
      const ix = (max - 1) * 3;
      positions[ix] = body.pos.x; positions[ix + 1] = body.pos.y; positions[ix + 2] = body.pos.z;
    }
    // gradient: head bright, tail dim
    for (let i = 0; i < e.count; i++) {
      const f = i / Math.max(1, e.count - 1); // 0..1 oldest->newest
      const c = body.color;
      colors[i * 3] = c.r * f;
      colors[i * 3 + 1] = c.g * f;
      colors[i * 3 + 2] = c.b * f;
    }
    e.geo.setDrawRange(0, e.count);
    e.geo.attributes.position.needsUpdate = true;
    e.geo.attributes.color.needsUpdate = true;
    e.geo.computeBoundingSphere();
  }
  remove(bodyId) {
    const e = this.lines.get(bodyId);
    if (!e) return;
    this.scene.remove(e.line);
    e.geo.dispose();
    e.line.material.dispose();
    this.lines.delete(bodyId);
  }
  clear() { for (const id of [...this.lines.keys()]) this.remove(id); }
  setMax(m) { this.max = m; this.clear(); /* re-seed on next push */ }
  setVisible(v) { for (const e of this.lines.values()) e.line.visible = v; }
}

/* ───────────────────────── Scene / Renderer ───────────────────────── */
class Scene {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x05060a, 1);
    container.appendChild(this.renderer.domElement);

    this.scene3 = new THREE.Scene();
    this.scene3.fog = new THREE.FogExp2(0x05060a, 0.006);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(0, 35, 70);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;

    // lighting
    this.scene3.add(new THREE.AmbientLight(0x404a66, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(40, 80, 30);
    this.scene3.add(sun);

    // starfield backdrop for depth/parallax
    this.addStars();

    // axes reference (thin, below)
    const grid = new THREE.GridHelper(CONFIG.curvatureSize, 24, 0x1a2238, 0x10141f);
    grid.position.y = -8.05;
    this.refGrid = grid;
    this.scene3.add(grid);

    window.addEventListener('resize', () => this.onResize());
  }

  addStars() {
    const N = 1800;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      // points on a large sphere shell -> gives parallax when orbiting
      const r = 600 + Math.random() * 300;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0x8893b0, size: 1.4, sizeAttenuation: true, transparent: true, opacity: 0.8 });
    this.stars = new THREE.Points(geo, mat);
    this.scene3.add(this.stars);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  add(o) { this.scene3.add(o); }
  remove(o) { this.scene3.remove(o); }
  render() { this.renderer.render(this.scene3, this.camera); }
}

/* ───────────────────────── App / wiring ───────────────────────── */
const state = {
  paused: false,
  showCurvature: true,
  showTrails: true,
  showVectors: false,
  gravity: 1.0,
  simSpeed: 1.0,
  trailLen: CONFIG.trailMax,
};

const container = document.getElementById('app');
const scene = new Scene(container);
const sim = new Simulation(scene.scene3);
const curvature = new Curvature(scene.scene3);
const trails = new Trails(scene.scene3);
curvature.setVisible(state.showCurvature);

// velocity vectors (ArrowHelper per body), created lazily
const vectors = new Map(); // bodyId -> ArrowHelper
function ensureVector(b) {
  if (vectors.has(b.id)) return vectors.get(b.id);
  const a = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0), b.pos.clone(), 1, b.color.getHex(), 1.2, 0.6
  );
  a.visible = state.showVectors;
  scene.add(a);
  vectors.set(b.id, a);
  return a;
}
function removeVector(id) {
  const a = vectors.get(id);
  if (a) { scene.remove(a); vectors.delete(id); }
}
function updateVectors() {
  for (const b of sim.bodies) {
    const a = ensureVector(b);
    a.visible = state.showVectors;
    if (!state.showVectors) continue;
    const speed = b.vel.length();
    if (speed < 1e-4) { a.visible = false; continue; }
    tmpV.copy(b.vel).normalize();
    a.position.copy(b.pos);
    a.setDirection(tmpV);
    a.setLength(Math.min(8, 1.5 + speed * 0.6), 1.2, 0.6);
    a.setColor(b.color.getHex());
  }
}

/* ---- per-body visual: mesh sync + dilation color tint ---- */
function applyDilation(b) {
  // Relativity-inspired effect A: gravitational redshift / time-dilation tint.
  // Deeper in a potential well (near heavy bodies) -> redder + dimmer.
  let phi = 0;
  for (const o of sim.bodies) {
    if (o === b) continue;
    phi += wellDepth(b.pos, o);
  }
  const dil = Math.min(1, phi * 0.01 * CONFIG.dilationStrength); // 0..1
  // lerp base color toward red as dil grows
  b.color.copy(b.baseColor).lerp(new THREE.Color(0xff3322), dil * 0.7);
  b.mesh.material.color.copy(b.color);
  b.mesh.material.emissive.copy(b.color).multiplyScalar(0.2 + 0.4 * (1 - dil));
}

/* ---- seed scene ---- */
function seedScene() {
  sim.clear();
  trails.clear();
  for (const id of [...vectors.keys()]) removeVector(id);
  // central "star"
  const star = sim.add({ mass: 1400, pos: new THREE.Vector3(0, 0, 0), vel: new THREE.Vector3(0, 0, 0), color: '#ffcc55' });
  // a few planets in roughly circular orbits (v = sqrt(GM/r))
  const planets = [
    { r: 14, m: 18, c: '#6ea8ff' },
    { r: 24, m: 30, c: '#7be3c4' },
    { r: 38, m: 12, c: '#b06eff' },
    { r: 54, m: 22, c: '#ff8fa3' },
  ];
  for (const p of planets) {
    const ang = Math.random() * Math.PI * 2;
    const tilt = (Math.random() - 0.5) * 0.5;
    const pos = new THREE.Vector3(Math.cos(ang) * p.r, Math.sin(tilt) * p.r * 0.6, Math.sin(ang) * p.r);
    const v = Math.sqrt((CONFIG.G * star.mass) / p.r);
    const vel = new THREE.Vector3(-Math.sin(ang), 0, Math.cos(ang)).multiplyScalar(v);
    sim.add({ mass: p.m, pos, vel, color: p.c });
  }
  refreshBodyList();
}

/* ---- animation loop ---- */
let last = performance.now();
let fpsAcc = 0, fpsFrames = 0, fpsTimer = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const realDt = Math.min(0.05, (now - last) / 1000); // clamp to avoid huge steps on tab refocus
  last = now;

  if (!state.paused) {
    sim.G = CONFIG.G * state.gravity;
    const sub = CONFIG.baseSubsteps;
    const dt = (CONFIG.dt * state.simSpeed) / sub;
    for (let s = 0; s < sub; s++) sim.step(dt);
  }

  // visuals
  for (const b of sim.bodies) {
    b.mesh.position.copy(b.pos);
    applyDilation(b);
    if (state.showTrails) trails.push(b);
  }
  // prune trails/vectors for removed bodies
  pruneDeadVisuals();
  if (state.showCurvature) curvature.update(sim.bodies);
  updateVectors();

  scene.controls.update();
  scene.render();

  // fps + stats
  fpsFrames++; fpsTimer += realDt;
  if (fpsTimer >= 0.5) {
    fpsAcc = Math.round(fpsFrames / fpsTimer);
    fpsFrames = 0; fpsTimer = 0;
    updateStats();
  }
}

function pruneDeadVisuals() {
  const ids = new Set(sim.bodies.map(b => b.id));
  for (const id of [...trails.lines.keys()]) if (!ids.has(id)) trails.remove(id);
  for (const id of [...vectors.keys()]) if (!ids.has(id)) removeVector(id);
}

function updateStats() {
  document.getElementById('stat-bodies').textContent = sim.bodies.length;
  document.getElementById('stat-merges').textContent = sim.mergeCount;
  document.getElementById('stat-fps').textContent = fpsAcc;
}

/* ───────────────────────── UI ───────────────────────── */
const $ = id => document.getElementById(id);

$('btn-pause').onclick = () => {
  state.paused = !state.paused;
  $('btn-pause').textContent = state.paused ? '▶ Resume' : '⏸ Pause';
};
$('btn-reset').onclick = seedScene;

$('tog-curvature').onchange = e => { state.showCurvature = e.target.checked; curvature.setVisible(state.showCurvature); scene.refGrid.visible = state.showCurvature; };
$('tog-trails').onchange = e => { state.showTrails = e.target.checked; trails.setVisible(state.showTrails); };
$('tog-vectors').onchange = e => { state.showVectors = e.target.checked; };

$('sl-gravity').oninput = e => { state.gravity = +e.target.value; $('val-gravity').textContent = state.gravity.toFixed(2); };
$('sl-speed').oninput = e => { state.simSpeed = +e.target.value; $('val-speed').textContent = state.simSpeed.toFixed(2); };
$('sl-trail').oninput = e => { state.trailLen = +e.target.value; $('val-trail').textContent = state.trailLen; trails.setMax(state.trailLen); };

function readForm() {
  return {
    mass: Math.max(0.0001, +$('in-mass').value || 1),
    pos: new THREE.Vector3(+$('in-px').value || 0, +$('in-py').value || 0, +$('in-pz').value || 0),
    vel: new THREE.Vector3(+$('in-vx').value || 0, +$('in-vy').value || 0, +$('in-vz').value || 0),
    color: $('in-color').value,
  };
}

$('btn-add').onclick = () => {
  sim.add(readForm());
  refreshBodyList();
};

$('btn-random').onclick = () => {
  // place a new body on a rough circular orbit around the heaviest body
  const h = sim.heaviest();
  const f = readForm();
  const r = 12 + Math.random() * 45;
  const ang = Math.random() * Math.PI * 2;
  const pos = new THREE.Vector3(
    (h ? h.pos.x : 0) + Math.cos(ang) * r,
    (h ? h.pos.y : 0) + (Math.random() - 0.5) * 4,
    (h ? h.pos.z : 0) + Math.sin(ang) * r,
  );
  const v = h ? Math.sqrt((CONFIG.G * state.gravity * h.mass) / r) : 3;
  const vel = new THREE.Vector3(-Math.sin(ang), 0, Math.cos(ang)).multiplyScalar(v);
  sim.add({ mass: f.mass, pos, vel, color: f.color });
  refreshBodyList();
};

function refreshBodyList() {
  const list = $('body-list');
  list.innerHTML = '';
  for (const b of sim.bodies) {
    const card = document.createElement('div');
    card.className = 'body-card';
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.style.background = '#' + b.baseColor.getHexString();
    sw.style.color = '#' + b.baseColor.getHexString();
    const info = document.createElement('div');
    info.className = 'info';
    info.innerHTML =
      `<div class="name">Body #${b.id}</div>` +
      `<div class="meta">m ${b.mass.toFixed(1)} · r ${b.radius.toFixed(2)} · v ${b.vel.length().toFixed(2)}</div>`;
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '✕';
    del.title = 'Delete body';
    del.onclick = () => { sim.remove(b.id); trails.remove(b.id); removeVector(b.id); refreshBodyList(); };
    card.append(sw, info, del);
    list.append(card);
  }
  updateStats();
}

/* ---- boot ---- */
seedScene();
requestAnimationFrame(loop);
