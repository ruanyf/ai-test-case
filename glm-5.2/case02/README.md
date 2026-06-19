# Relativity Sandbox — N-Body Gravity in 3D

An interactive, browser-based 3D sandbox that *visually* evokes general/special
relativity (spacetime curvature, gravitational redshift) while actually running a
simplified **Newtonian N-body** gravity simulation. Frontend only — no backend,
no build step, no package manager. Open `index.html` over a local server.

## Run it

Because the code uses ES modules + an import map, you need to serve the folder
over HTTP (not `file://`). Any static server works:

```bash
# from this directory
python3 -m http.server 8000
# then open http://localhost:8000
```

## What you get

- A true 3D scene: **orbit** (drag), **pan** (right-drag), **zoom** (scroll).
  Bodies, trails, the curvature grid, and a star shell all show real parallax.
- Add/remove bodies at runtime, each with mass, position, velocity, color.
- Mutual Newtonian gravity in 3D, integrated stably.
- A deformable **"spacetime fabric" grid** that dips under mass (curvature viz).
- **Trails** with a head-bright/tail-dim gradient.
- **Collisions → mergers** with momentum conservation.
- **Relativity-inspired effect chosen: gravitational redshift / time-dilation
  color mapping** — a body sitting deeper in a gravitational potential well is
  tinted redder and dimmer, mimicking gravitational redshift.
- Controls: pause/resume, reset; toggles for curvature/trails/vectors; sliders
  for gravity strength, simulation speed, and trail length.

## Physics approximations & stability tricks

**Newtonian N-body.** Acceleration on body *i*:

```
a_i = G · Σ_j  m_j · (r_j − r_i) / (|r_j − r_i|² + ε²)^(3/2)
```

This is plain Newtonian gravity — *not* relativity. It is shared symmetrically
across each pair (one `1/r³` term feeds both bodies), which is both faster and
bit-for-bit momentum-conserving.

**Stability measures:**

1. **Softening epsilon (`ε = 1.2`).** The `+ ε²` in the denominator prevents the
   `1/r` singularity when two bodies get very close, so the integrator never
   explodes. It slightly smears close-range forces (intentional simplification).
2. **Velocity-Verlet (symplectic-ish) integrator.** Instead of naive Euler
   (`v += a·dt; x += v·dt`), we use:
   ```
   x(t+dt) = x + v·dt + ½·a·dt²
   compute a(t+dt) from new positions
   v(t+dt) = v + ½·(a_old + a_new)·dt
   ```
   Verlet conserves orbital energy far better than Euler — orbits stay closed
   instead of spiraling out.
3. **Substepping.** Each rendered frame runs `baseSubsteps` (default 2) physics
   steps, so `dt` is small even when `simSpeed` is high.
4. **Acceleration and speed clamps** (`maxAccel`, `maxSpeed`) as a hard backstop
   against extreme slingshots.
5. **Real-time clamp** on frame `dt` so a tab refocus can't inject a huge jump.

**Collisions / mergers.** When two bodies overlap (`distance < r_i + r_j`) they
merge into the heavier one: mass adds, position becomes the center of mass,
velocity conserves momentum (`v = (m₁v₁ + m₂v₂)/M`), radius is recomputed from
mass assuming roughly constant density (`r ∝ m^(1/3)`), and colors blend by
mass. An O(n²) overlap scan repeats until no pair remains (handles chain mergers).

## What is accurate vs intentionally simplified

| | |
|---|---|
| ✅ Simplified but real | N-body mutual gravity; momentum-conserving mergers; symplectic integration; softened forces. |
| ⚠️ Intentionally simplified | Units are arbitrary display units (G=1), not SI. Gravity is Newtonian — there is no actual spacetime metric, no real time dilation, no light bending. |
| 🎨 Purely visual (not physical) | The curvature **grid** is a rendering of the 2D-projected gravitational potential `Σ m/√(r²+ε²)`, squashed vertically and colored — a *metaphor* for spacetime curvature, not a solution of Einstein's equations. The **redshift tint** is a color mapping of potential depth, not a real frequency shift. Trails/vectors are visualization aids. |

In short: the *motion* is a legitimate Newtonian N-body sim; the *relativity*
is a visual aesthetic layered on top.

## How rendering + the curvature visualization work

- **Renderer:** Three.js (CDN ES modules via an `<script type="importmap">`).
  One `WebGLRenderer`, a perspective camera, `OrbitControls` with damping, an
  ambient + directional light, a star shell for depth, and a faint reference
  grid.
- **Bodies:** `SphereGeometry` scaled by radius, `MeshStandardMaterial` with an
  additive glow sprite child. Their material color is re-tinted every frame by
  the dilation map.
- **Curvature grid:** a `PlaneGeometry` (96×96) laid flat. Every frame each
  vertex's `y` is set to `-amp·atan(depth)` where `depth = Σ m/√(Δx²+Δz²+ε²)`
  over all bodies — so heavy bodies carve visible wells. Vertex colors run
  blue (flat) → magenta (deep well). Rendered as a transparent wireframe so it
  reads as a "fabric" without hiding the bodies.
- **Trails:** one `THREE.Line` per body over a ring buffer of the last N
  positions, with per-vertex alpha-by-age via vertex colors and additive
  blending.
- **Vectors:** an `ArrowHelper` per body pointing along velocity, scaled by
  speed (toggle on/off).

## How to add a body & tweak parameters

**Via the UI (right panel):** fill in `mass`, `pos(x,y,z)`, `vel(vx,vy,vz)`, pick
a `color`, and press **＋ Add body**. **↻ Orbit** drops a body onto a roughly
circular orbit around the current heaviest body (handy for quickly populating a
system). Each body card in the list shows live mass/radius/speed and a ✕ to
delete.

**Programmatically** (`script.js`, anywhere after boot):

```js
sim.add({
  mass: 50,
  pos:  new THREE.Vector3(20, 0, 0),
  vel:  new THREE.Vector3(0, 0, 4.5),
  color: '#7be3c4',
});
```

**Tuning knobs** — edit the `CONFIG` object at the top of `script.js`:

| Constant | Effect |
|---|---|
| `G` | Base gravitational constant (also live-scaled by the gravity slider). |
| `softening` | ε — larger = more stable close passes but blurrier forces. |
| `maxAccel` / `maxSpeed` | Hard stability clamps. |
| `baseSubsteps` | More = more stable & accurate, more CPU. |
| `curvatureAmp` | How deep/exaggerated the curvature wells look. |
| `curvatureSegs` | Grid resolution (perf vs detail). |
| `radiusK` / `radiusMin` | Body size from mass. |
| `dilationStrength` | How strongly potential depth reddens bodies. |

## Code layout (single `script.js`, modular sections)

`config` → `utils` → `Body` → `Simulation` (physics) → `Curvature` (grid) →
`Trails` → `Scene`/`Renderer` → UI wiring → animation loop. Each is a small
class so the renderer, physics, and visuals stay cleanly separable.

## Browser support

Any modern browser with WebGL and ES-module import maps (Chrome, Edge, Firefox,
Safari). Needs to be served over HTTP, not opened as a `file://` URL.
