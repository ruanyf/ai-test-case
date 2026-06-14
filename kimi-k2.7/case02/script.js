// Three.js and OrbitControls are loaded as global scripts in index.html,
// so this file can run from a file:// origin without CORS issues.
const THREE = window.THREE;
const OrbitControls = THREE.OrbitControls;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CONFIG = {
  G: 1,
  softening: 2,
  dt: 0.1,
  substeps: 6,
  maxSpeed: 30,
  mergeThreshold: 0.9,
  trailLength: 100,
  curvatureSize: 260,
  curvatureResolution: 64,
  deepWell: 120,
  randomColor: true,
};

let nextId = 1;

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------
class Body {
  constructor(mass, position, velocity, color) {
    this.id = nextId++;
    this.mass = mass;
    this.pos = position.clone();
    this.vel = velocity.clone();
    this.radius = Math.max(0.25, Math.cbrt(mass) * 0.55);
    this.color = color ? color.clone() : new THREE.Color().setHSL(Math.random(), 0.85, 0.55);
    this.trail = [];
  }

  clone() {
    const b = new Body(this.mass, this.pos, this.vel, this.color);
    b.id = this.id;
    b.radius = this.radius;
    b.trail = this.trail.map(p => p.clone());
    return b;
  }
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------
class Simulation {
  constructor() {
    this.bodies = [];
    this.t = 0;
    this.paused = false;
    this.speed = 1;
    this.G = CONFIG.G;
    this.epsilon = CONFIG.softening;
  }

  add(body) {
    this.bodies.push(body);
  }

  remove(id) {
    const idx = this.bodies.findIndex(b => b.id === id);
    if (idx !== -1) this.bodies.splice(idx, 1);
  }

  reset() {
    this.bodies = [];
    this.t = 0;
    this.paused = false;
  }

  step(dt) {
    if (this.paused || this.speed <= 0) return;

    const subDt = (dt * this.speed) / CONFIG.substeps;
    for (let s = 0; s < CONFIG.substeps; s++) {
      this.subStep(subDt);
      this.handleCollisions();
    }
    this.t += dt * this.speed;
  }

  subStep(dt) {
    const n = this.bodies.length;
    if (n === 0) return;

    const accels = new Array(n).fill(null).map(() => new THREE.Vector3());
    const eps2 = this.epsilon * this.epsilon;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = this.bodies[i];
        const b = this.bodies[j];

        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const dz = b.pos.z - a.pos.z;
        const dist2 = dx * dx + dy * dy + dz * dz + eps2;
        const dist = Math.sqrt(dist2);
        const f = this.G / (dist2 * dist);

        const ax = dx * f * b.mass;
        const ay = dy * f * b.mass;
        const az = dz * f * b.mass;

        const bx = -dx * f * a.mass;
        const by = -dy * f * a.mass;
        const bz = -dz * f * a.mass;

        accels[i].x += ax;
        accels[i].y += ay;
        accels[i].z += az;

        accels[j].x += bx;
        accels[j].y += by;
        accels[j].z += bz;
      }
    }

    for (let i = 0; i < n; i++) {
      const b = this.bodies[i];
      b.vel.x += accels[i].x * dt;
      b.vel.y += accels[i].y * dt;
      b.vel.z += accels[i].z * dt;

      // Speed clamp to avoid numerical explosions
      const speed2 = b.vel.lengthSq();
      if (speed2 > CONFIG.maxSpeed * CONFIG.maxSpeed) {
        const k = CONFIG.maxSpeed / Math.sqrt(speed2);
        b.vel.multiplyScalar(k);
      }

      b.pos.x += b.vel.x * dt;
      b.pos.y += b.vel.y * dt;
      b.pos.z += b.vel.z * dt;

      // Trail
      b.trail.push(b.pos.clone());
      if (b.trail.length > CONFIG.trailLength) {
        b.trail.shift();
      }
    }
  }

  handleCollisions() {
    const toRemove = new Set();

    for (let i = 0; i < this.bodies.length; i++) {
      if (toRemove.has(i)) continue;
      const a = this.bodies[i];

      for (let j = i + 1; j < this.bodies.length; j++) {
        if (toRemove.has(j)) continue;
        const b = this.bodies[j];

        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const dz = b.pos.z - a.pos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < (a.radius + b.radius) * CONFIG.mergeThreshold) {
          const totalMass = a.mass + b.mass;
          const invMass = 1 / totalMass;

          // Center-of-mass position
          a.pos.x = (a.pos.x * a.mass + b.pos.x * b.mass) * invMass;
          a.pos.y = (a.pos.y * a.mass + b.pos.y * b.mass) * invMass;
          a.pos.z = (a.pos.z * a.mass + b.pos.z * b.mass) * invMass;

          // Momentum conservation
          a.vel.x = (a.vel.x * a.mass + b.vel.x * b.mass) * invMass;
          a.vel.y = (a.vel.y * a.mass + b.vel.y * b.mass) * invMass;
          a.vel.z = (a.vel.z * a.mass + b.vel.z * b.mass) * invMass;

          a.mass = totalMass;
          a.radius = Math.max(0.25, Math.cbrt(totalMass) * 0.55);
          a.color.lerp(b.color, b.mass * invMass);

          // Keep the longer trail
          if (b.trail.length > a.trail.length) a.trail = b.trail;

          toRemove.add(j);
        }
      }
    }

    const indices = Array.from(toRemove).sort((a, b) => b - a);
    for (const idx of indices) {
      this.bodies.splice(idx, 1);
    }
  }

  potentialAt(pos) {
    let phi = 0;
    const eps2 = this.epsilon * this.epsilon;
    for (const b of this.bodies) {
      const dx = pos.x - b.pos.x;
      const dy = pos.y - b.pos.y;
      const dz = pos.z - b.pos.z;
      const d2 = dx * dx + dy * dy + dz * dz + eps2;
      phi -= this.G * b.mass / Math.sqrt(d2);
    }
    return phi;
  }
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070a);
    this.scene.fog = new THREE.FogExp2(0x05070a, 0.0035);

    const rect = canvas.getBoundingClientRect();
    this.camera = new THREE.PerspectiveCamera(60, rect.width / rect.height, 0.1, 2000);
    this.camera.position.set(0, 90, 140);

    this.webgl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.webgl.setSize(rect.width, rect.height, false);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0, 0);

    const ambient = new THREE.AmbientLight(0x404050, 0.6);
    this.scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(40, 80, 40);
    this.scene.add(dir);

    // Subtle starfield
    this.addStars();

    this.bodyMeshes = new Map();
    this.trailLines = new Map();
    this.arrows = new Map();

    this.curvatureMesh = this.createCurvatureMesh();
    this.scene.add(this.curvatureMesh);

    this.tmpColor = new THREE.Color();
    this.tmpVec = new THREE.Vector3();
  }

  addStars() {
    const count = 1200;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 1200;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xaaccee, size: 1.2, sizeAttenuation: true, transparent: true, opacity: 0.6 });
    this.scene.add(new THREE.Points(geo, mat));
  }

  createCurvatureMesh() {
    const size = CONFIG.curvatureSize;
    const seg = CONFIG.curvatureResolution;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);

    const colors = new Float32Array((seg + 1) * (seg + 1) * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geo, mat);
    return mesh;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    this.webgl.setSize(rect.width, rect.height, false);
  }

  update(simulation, showCurvature, showTrails, showVectors) {
    const bodies = simulation.bodies;

    this.updateBodies(bodies, simulation);
    this.updateTrails(bodies, showTrails);
    this.updateVectors(bodies, showVectors);
    this.updateCurvature(simulation, showCurvature);

    this.controls.update();
    this.webgl.render(this.scene, this.camera);
  }

  updateBodies(bodies, simulation) {
    const present = new Set();

    for (const b of bodies) {
      present.add(b.id);

      if (!this.bodyMeshes.has(b.id)) {
        const geo = new THREE.SphereGeometry(1, 32, 32);
        const mat = new THREE.MeshStandardMaterial({
          color: b.color,
          emissive: b.color,
          emissiveIntensity: 0.5,
          roughness: 0.35,
          metalness: 0.2,
        });
        const mesh = new THREE.Mesh(geo, mat);
        this.scene.add(mesh);
        this.bodyMeshes.set(b.id, mesh);
      }

      const mesh = this.bodyMeshes.get(b.id);
      mesh.position.copy(b.pos);
      mesh.scale.setScalar(b.radius);

      const t = this.gravitationalRedshift(b, bodies, simulation);
      const c = this.redshiftColor(t);
      mesh.material.color.copy(c);
      mesh.material.emissive.copy(c);
      mesh.material.emissiveIntensity = 0.4 + 0.4 * t;
    }

    for (const [id, mesh] of this.bodyMeshes) {
      if (!present.has(id)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        this.bodyMeshes.delete(id);
      }
    }
  }

  gravitationalRedshift(body, bodies, simulation) {
    let phi = 0;
    const eps2 = simulation.epsilon * simulation.epsilon;
    for (const b of bodies) {
      if (b === body) continue;
      const dx = body.pos.x - b.pos.x;
      const dy = body.pos.y - b.pos.y;
      const dz = body.pos.z - b.pos.z;
      const d2 = dx * dx + dy * dy + dz * dz + eps2;
      phi -= simulation.G * b.mass / Math.sqrt(d2);
    }
    return Math.min(Math.max(-phi / CONFIG.deepWell, 0), 1);
  }

  redshiftColor(t) {
    // t=0 -> blue/white in flat space; t=1 -> deep red in strong gravity
    const hue = 0.63 * (1 - t);
    const light = 0.55 + 0.18 * t;
    const sat = 0.7 + 0.25 * (1 - t);
    return this.tmpColor.setHSL(hue, sat, light);
  }

  updateTrails(bodies, show) {
    const present = new Set();

    for (const b of bodies) {
      present.add(b.id);

      if (!this.trailLines.has(b.id)) {
        const geo = new THREE.BufferGeometry();
        const mat = new THREE.LineBasicMaterial({ color: b.color, transparent: true, opacity: 0.55 });
        const line = new THREE.Line(geo, mat);
        this.scene.add(line);
        this.trailLines.set(b.id, line);
      }

      const line = this.trailLines.get(b.id);
      line.visible = show && b.trail.length > 1;

      if (line.visible) {
        const positions = new Float32Array(b.trail.length * 3);
        for (let i = 0; i < b.trail.length; i++) {
          const p = b.trail[i];
          positions[i * 3] = p.x;
          positions[i * 3 + 1] = p.y;
          positions[i * 3 + 2] = p.z;
        }
        line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        line.geometry.attributes.position.needsUpdate = true;
        line.material.color.copy(b.color);
      }
    }

    for (const [id, line] of this.trailLines) {
      if (!present.has(id)) {
        this.scene.remove(line);
        line.geometry.dispose();
        line.material.dispose();
        this.trailLines.delete(id);
      }
    }
  }

  updateVectors(bodies, show) {
    const present = new Set();

    for (const b of bodies) {
      present.add(b.id);

      if (!this.arrows.has(b.id)) {
        const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 1, 0xffffff);
        this.scene.add(arrow);
        this.arrows.set(b.id, arrow);
      }

      const arrow = this.arrows.get(b.id);
      arrow.visible = show && b.vel.lengthSq() > 1e-6;

      if (arrow.visible) {
        arrow.position.copy(b.pos);
        const len = b.vel.length();
        this.tmpVec.copy(b.vel).normalize();
        arrow.setDirection(this.tmpVec);
        arrow.setLength(Math.min(len * 3, b.radius * 6), b.radius * 0.8, b.radius * 0.4);
      }
    }

    for (const [id, arrow] of this.arrows) {
      if (!present.has(id)) {
        this.scene.remove(arrow);
        this.arrows.delete(id);
      }
    }
  }

  updateCurvature(simulation, show) {
    this.curvatureMesh.visible = show;
    if (!show) return;

    const geo = this.curvatureMesh.geometry;
    const posAttr = geo.attributes.position;
    const colAttr = geo.attributes.color;
    const count = posAttr.count;

    const eps2 = simulation.epsilon * simulation.epsilon;

    for (let i = 0; i < count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      let y = 0;

      for (const b of simulation.bodies) {
        const dx = x - b.pos.x;
        const dy = 0 - b.pos.y;
        const dz = z - b.pos.z;
        const d2 = dx * dx + dy * dy + dz * dz + eps2;
        y -= simulation.G * b.mass / Math.sqrt(d2);
      }

      // Scale visual displacement
      y *= 0.55;
      posAttr.setY(i, y);

      const t = Math.min(Math.max(-y / (CONFIG.deepWell * 0.55), 0), 1);
      this.tmpColor.setHSL(0.65 * (1 - t), 0.9, 0.45);
      colAttr.setXYZ(i, this.tmpColor.r, this.tmpColor.g, this.tmpColor.b);
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    geo.computeVertexNormals();
  }
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
class UI {
  constructor(simulation, renderer, app) {
    this.sim = simulation;
    this.renderer = renderer;
    this.app = app;

    this.elBodyList = document.getElementById('body-list');
    this.elPause = document.getElementById('btn-pause');
    this.elReset = document.getElementById('btn-reset');
    this.elRandom = document.getElementById('btn-random');
    this.elForm = document.getElementById('add-form');
    this.elStatBodies = document.getElementById('stat-bodies');
    this.elStatTime = document.getElementById('stat-time');

    this.elTogCurvature = document.getElementById('tog-curvature');
    this.elTogTrails = document.getElementById('tog-trails');
    this.elTogVectors = document.getElementById('tog-vectors');

    this.elSliderG = document.getElementById('slider-g');
    this.elSliderSpeed = document.getElementById('slider-speed');
    this.elSliderTrail = document.getElementById('slider-trail');
    this.elSliderSoft = document.getElementById('slider-soft');

    this.elValG = document.getElementById('val-g');
    this.elValSpeed = document.getElementById('val-speed');
    this.elValTrail = document.getElementById('val-trail');
    this.elValSoft = document.getElementById('val-soft');

    this.bindEvents();
  }

  bindEvents() {
    this.elPause.addEventListener('click', () => {
      this.sim.paused = !this.sim.paused;
      this.elPause.textContent = this.sim.paused ? 'Resume' : 'Pause';
    });

    this.elReset.addEventListener('click', () => {
      this.sim.reset();
      this.app.loadDemo();
    });

    this.elForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.addFromForm();
    });

    this.elRandom.addEventListener('click', () => this.addRandom());

    this.elTogCurvature.addEventListener('change', () => this.app.setShowCurvature(this.elTogCurvature.checked));
    this.elTogTrails.addEventListener('change', () => this.app.setShowTrails(this.elTogTrails.checked));
    this.elTogVectors.addEventListener('change', () => this.app.setShowVectors(this.elTogVectors.checked));

    this.elSliderG.addEventListener('input', () => {
      this.sim.G = parseFloat(this.elSliderG.value);
      this.elValG.textContent = this.sim.G.toFixed(2);
    });

    this.elSliderSpeed.addEventListener('input', () => {
      this.sim.speed = parseFloat(this.elSliderSpeed.value);
      this.elValSpeed.textContent = this.sim.speed.toFixed(2);
    });

    this.elSliderTrail.addEventListener('input', () => {
      CONFIG.trailLength = parseInt(this.elSliderTrail.value, 10);
      this.elValTrail.textContent = CONFIG.trailLength;
      // Trim existing trails
      for (const b of this.sim.bodies) {
        if (b.trail.length > CONFIG.trailLength) b.trail = b.trail.slice(-CONFIG.trailLength);
      }
    });

    this.elSliderSoft.addEventListener('input', () => {
      this.sim.epsilon = parseFloat(this.elSliderSoft.value);
      this.elValSoft.textContent = this.sim.epsilon.toFixed(2);
    });

    window.addEventListener('resize', () => this.renderer.resize());
  }

  addFromForm() {
    const mass = parseFloat(document.getElementById('in-mass').value) || 1;
    const px = parseFloat(document.getElementById('in-px').value) || 0;
    const py = parseFloat(document.getElementById('in-py').value) || 0;
    const pz = parseFloat(document.getElementById('in-pz').value) || 0;
    const vx = parseFloat(document.getElementById('in-vx').value) || 0;
    const vy = parseFloat(document.getElementById('in-vy').value) || 0;
    const vz = parseFloat(document.getElementById('in-vz').value) || 0;

    const pos = new THREE.Vector3(px, py, pz);
    const vel = new THREE.Vector3(vx, vy, vz);
    this.sim.add(new Body(mass, pos, vel));
    this.refreshBodyList();
  }

  addRandom() {
    const mass = 0.5 + Math.random() * 8;
    const r = 30 + Math.random() * 70;
    const theta = Math.random() * Math.PI * 2;
    const phi = (Math.random() - 0.5) * Math.PI * 0.5;

    const x = r * Math.cos(phi) * Math.cos(theta);
    const y = r * Math.sin(phi);
    const z = r * Math.cos(phi) * Math.sin(theta);

    const pos = new THREE.Vector3(x, y, z);

    // Approximate circular-ish velocity around origin, with random tilt
    const v = Math.sqrt(this.sim.G * 800 / r) * (0.7 + Math.random() * 0.5);
    const vel = new THREE.Vector3(-z, 0, x).normalize().multiplyScalar(v);
    vel.y += (Math.random() - 0.5) * v * 0.4;

    this.sim.add(new Body(mass, pos, vel));
    this.refreshBodyList();
  }

  removeBody(id) {
    this.sim.remove(id);
    this.refreshBodyList();
  }

  refreshBodyList() {
    this.elBodyList.innerHTML = '';
    for (const b of this.sim.bodies) {
      const li = document.createElement('li');
      li.className = 'body-item';
      li.innerHTML = `
        <span class="swatch" style="background:${b.color.getStyle()};color:${b.color.getStyle()}"></span>
        <div class="info">
          <div class="name">Body ${b.id} · m=${b.mass.toFixed(1)} · r=${b.radius.toFixed(2)}</div>
          <div class="coords">${b.pos.x.toFixed(1)}, ${b.pos.y.toFixed(1)}, ${b.pos.z.toFixed(1)}</div>
        </div>
        <button data-id="${b.id}">Delete</button>
      `;
      li.querySelector('button').addEventListener('click', () => this.removeBody(b.id));
      this.elBodyList.appendChild(li);
    }
  }

  updateStats() {
    this.elStatBodies.textContent = `Bodies: ${this.sim.bodies.length}`;
    this.elStatTime.textContent = `t: ${this.sim.t.toFixed(2)}`;
  }
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
class App {
  constructor() {
    this.sim = new Simulation();
    this.canvas = document.getElementById('sim-canvas');
    this.renderer = new Renderer(this.canvas);
    this.ui = new UI(this.sim, this.renderer, this);

    this.showCurvature = true;
    this.showTrails = true;
    this.showVectors = false;

    this.clock = new THREE.Clock();

    this.loadDemo();
    this.loop();
  }

  loadDemo() {
    // Central heavy body
    const central = new Body(800, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0));
    central.color.setHSL(0.0, 0.9, 0.55);
    this.sim.add(central);

    // Inner planets
    this.addOrbiter(15, 0, 0, 0, 0, 7.30, 0.55, 1.2);
    this.addOrbiter(-22, 0, 0, 0, 0, -6.02, 0.75, 2.0);
    this.addOrbiter(0, 0, 35, 0, -4.77, 0, 0.35, 2.5);

    // Inclined orbiters
    this.addOrbiter(45, 10, 0, -3.5, 0, 4.0, 0.12, 1.5);
    this.addOrbiter(-50, -15, 20, 2.5, -1.2, -3.0, 0.90, 1.0);

    this.ui.refreshBodyList();
  }

  addOrbiter(x, y, z, vx, vy, vz, hue, mass) {
    const color = new THREE.Color().setHSL(hue, 0.85, 0.55);
    this.sim.add(new Body(mass, new THREE.Vector3(x, y, z), new THREE.Vector3(vx, vy, vz), color));
  }

  setShowCurvature(v) { this.showCurvature = v; }
  setShowTrails(v) { this.showTrails = v; }
  setShowVectors(v) { this.showVectors = v; }

  loop() {
    requestAnimationFrame(() => this.loop());

    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.sim.step(CONFIG.dt);
    this.renderer.update(this.sim, this.showCurvature, this.showTrails, this.showVectors);
    this.ui.updateStats();
  }
}

new App();
